from __future__ import annotations

import io
import json
import math
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib import error as url_error
from urllib import request as url_request

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy import func
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .models import (
    Device,
    DeviceBinding,
    DeviceIngestBatch,
    DeviceSession,
    HealthReport,
    MedicalRecordArchive,
    MedicationRecord,
    PatientProfile,
    RehabPlan,
    TremorFeature,
    User,
    now_utc,
)
from .security import (
    create_access_token,
    create_device_token,
    current_device,
    current_user,
    hash_password,
    sha256,
    verify_password,
)
from .settings import settings

api = FastAPI(title="Tremor Guard FastAPI", version="1.0.0")
app = FastAPI(title="Tremor Guard")
allowed_origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def capture_body_for_device_signature(request: Request, call_next):
    body = await request.body()
    request.state.body_bytes = body

    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    request._receive = receive
    return await call_next(request)


@app.on_event("startup")
def startup():
    if settings.auto_create_tables:
        Base.metadata.create_all(bind=engine)


class RegisterIn(BaseModel):
    name: str = Field(min_length=1)
    email: str = Field(min_length=3)
    age: int | None = Field(default=None, ge=1, le=120)
    password: str = Field(min_length=6)


class LoginIn(BaseModel):
    email: str = Field(min_length=3)
    password: str


class OnboardingIn(BaseModel):
    sex: str | None = None
    diagnosisYear: int | None = Field(default=None, ge=1900, le=2100)
    primarySymptom: str | None = None
    mobilityLevel: str | None = None
    emergencyContact: str | None = None
    consentAccepted: bool = True


class BindDeviceIn(BaseModel):
    deviceName: str = Field(min_length=1)
    serialNumber: str = Field(min_length=6)
    verificationCode: str = Field(min_length=1)
    wearSide: str = Field(pattern="^(left|right)$")


class DeviceHandshakeIn(BaseModel):
    serialNumber: str
    deviceSecret: str


class HeartbeatIn(BaseModel):
    batteryPercent: int | None = Field(default=None, ge=0, le=100)
    firmwareVersion: str | None = None
    wearSide: str | None = None
    charging: bool | None = None


class MedicationIn(BaseModel):
    medication: str = "患者记录用药"
    dosage: str | None = None
    takenAt: datetime | None = None


class ArchiveIn(BaseModel):
    title: str = Field(min_length=1)
    patientName: str = Field(min_length=1)
    description: str | None = ""
    consentAccepted: bool = True


class RehabPlanIn(BaseModel):
    focus: str | None = None


class ChatIn(BaseModel):
    message: str = Field(min_length=1)


def public_user(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "age": user.age,
        "onboardingCompleted": user.onboarding_completed,
        "isDemo": user.is_demo,
        "createdAt": user.created_at.isoformat(),
    }


def auth_payload(user: User) -> dict[str, Any]:
    return {"success": True, "token": create_access_token({"sub": user.id, "email": user.email}), "user": public_user(user)}


def normalize_email(value: str) -> str:
    email = value.strip().lower()
    if "@" not in email or email.startswith("@") or email.endswith("@"):
        raise HTTPException(status_code=400, detail="请输入有效邮箱")
    return email


def today_range() -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    return start, start + timedelta(days=1)


def connected_binding(db: Session, user: User) -> DeviceBinding | None:
    return (
        db.query(DeviceBinding)
        .filter(DeviceBinding.user_id == user.id, DeviceBinding.connected.is_(True))
        .order_by(DeviceBinding.updated_at.desc())
        .first()
    )


def user_features_today(db: Session, user: User) -> list[TremorFeature]:
    binding = connected_binding(db, user)
    if binding is None:
        return []
    start, end = today_range()
    return (
        db.query(TremorFeature)
        .filter(TremorFeature.device_id == binding.device_id, TremorFeature.measured_at >= start, TremorFeature.measured_at < end)
        .order_by(TremorFeature.measured_at.asc())
        .all()
    )


def user_medications_today(db: Session, user: User) -> list[MedicationRecord]:
    start, end = today_range()
    return (
        db.query(MedicationRecord)
        .filter(MedicationRecord.user_id == user.id, MedicationRecord.taken_at >= start, MedicationRecord.taken_at < end)
        .order_by(MedicationRecord.taken_at.asc())
        .all()
    )


def user_timeline_entries(db: Session, user: User) -> list[dict[str, Any]]:
    entries = [{"time": f"{hour:02d}:00", "intensity": 0, "isMedication": False, "frequency": "0.0"} for hour in range(24)]
    for med in user_medications_today(db, user):
        entries[med.taken_at.hour]["isMedication"] = True
    buckets: dict[int, list[TremorFeature]] = {}
    for feature in user_features_today(db, user):
        buckets.setdefault(feature.measured_at.hour, []).append(feature)
    for hour, features in buckets.items():
        intensity = sum(item.intensity_rms for item in features) / len(features)
        freq = sum(item.dominant_freq_hz for item in features) / len(features)
        entries[hour]["intensity"] = round(intensity, 2)
        entries[hour]["frequency"] = f"{freq:.1f}"
    return entries


def dashboard_summary(db: Session, user: User) -> dict[str, Any]:
    binding = connected_binding(db, user)
    features = user_features_today(db, user)
    meds = user_medications_today(db, user)
    avg = sum(item.intensity_rms for item in features) / len(features) if features else 0.0
    peak = max(features, key=lambda item: item.intensity_rms, default=None)
    wearing_hours = len({item.measured_at.hour for item in features})
    done_count = len([item for item in meds if item.status == "done"])
    completion = round((done_count / len(meds)) * 100) if meds else 0

    if peak:
        insight = f"今日峰值出现在 {peak.measured_at.strftime('%H:%M')}，强度 {peak.intensity_rms:.1f} RMS，主频 {peak.dominant_freq_hz:.1f}Hz。"
        suggestion = "该信息仅用于复诊沟通和居家监测参考，不能作为诊断或用药调整依据。"
    elif binding:
        insight = "设备已绑定，等待真实设备同步监测数据。"
        suggestion = "设备上传后，系统会基于真实时间窗生成趋势和摘要。"
    else:
        insight = "尚未绑定设备，当前没有监测数据。"
        suggestion = "请先完成设备绑定，再开始日常监测。"

    return {
        "patient": {"name": user.name, "displayName": user.name, "id": user.id, "email": user.email, "age": user.age},
        "header": {"greeting": f"你好，{user.name}", "statusText": "今日数据来自真实设备上传或 demo seed。" if features else "暂无今日监测数据。"},
        "stats": [
            {"label": "平均震颤强度", "value": f"{avg:.1f}", "unit": "RMS", "color": "text-blue-600"},
            {"label": "峰值震颤强度", "value": f"{(peak.intensity_rms if peak else 0):.1f}", "unit": "RMS", "color": "text-slate-800"},
            {"label": "用药完成度", "value": f"{completion}%", "unit": f"{done_count}/{len(meds)}次", "color": "text-green-600"},
            {"label": "有效佩戴时长", "value": str(wearing_hours), "unit": "小时", "color": "text-slate-800"},
        ],
        "insights": {"summary": insight, "clinicalSuggestion": suggestion},
        "device": {
            "status": "已连接" if binding else "未连接",
            "batteryLevel": binding.device.battery_percent if binding and binding.device.battery_percent is not None else 0,
            "lastHeartbeatAt": binding.device.last_heartbeat_at.isoformat() if binding and binding.device.last_heartbeat_at else None,
        },
        "hasMonitoringData": bool(features),
    }


def today_context(db: Session, user: User) -> dict[str, Any]:
    features = user_features_today(db, user)
    meds = user_medications_today(db, user)
    binding = connected_binding(db, user)
    peak = max(features, key=lambda item: item.intensity_rms, default=None)
    avg = sum(item.intensity_rms for item in features) / len(features) if features else 0.0
    wearing_hours = len({item.measured_at.hour for item in features})
    done_count = len([item for item in meds if item.status == "done"])
    return {
        "features": features,
        "medications": meds,
        "binding": binding,
        "peak": peak,
        "avg": avg,
        "wearingHours": wearing_hours,
        "doneMedicationCount": done_count,
    }


@api.get("/health")
def health():
    return {"status": "ok", "service": "tremor-guard-fastapi", "timestamp": now_utc().isoformat()}


@api.post("/auth/register")
def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = normalize_email(body.email)
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="该邮箱已经注册过账号")
    user = User(email=email, name=body.name.strip(), age=body.age, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return auth_payload(user)


@api.post("/auth/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == normalize_email(body.email)).first()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="邮箱或密码不正确")
    return auth_payload(user)


@api.get("/users/me")
def me(user: User = Depends(current_user)):
    return public_user(user)


@api.get("/patients/me")
def patient_me(user: User = Depends(current_user)):
    profile = user.profile
    return {
        "onboardingCompleted": user.onboarding_completed,
        "profile": None
        if profile is None
        else {
            "sex": profile.sex,
            "diagnosisYear": profile.diagnosis_year,
            "primarySymptom": profile.primary_symptom,
            "mobilityLevel": profile.mobility_level,
            "emergencyContact": profile.emergency_contact,
            "consentAccepted": profile.consent_accepted,
        },
    }


@api.put("/patients/me/onboarding")
def save_onboarding(body: OnboardingIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    profile = user.profile or PatientProfile(user_id=user.id)
    profile.sex = body.sex
    profile.diagnosis_year = body.diagnosisYear
    profile.primary_symptom = body.primarySymptom
    profile.mobility_level = body.mobilityLevel
    profile.emergency_contact = body.emergencyContact
    profile.consent_accepted = body.consentAccepted
    user.onboarding_completed = True
    db.add(profile)
    db.commit()
    return patient_me(user)


@api.get("/devices/me")
def get_my_device(user: User = Depends(current_user), db: Session = Depends(get_db)):
    binding = connected_binding(db, user)
    if binding is None:
        return {"binding": None}
    return {"binding": binding_payload(binding)}


def binding_payload(binding: DeviceBinding) -> dict[str, Any]:
    device = binding.device
    return {
        "email": binding.user.email,
        "deviceName": binding.device_name,
        "serialNumber": device.serial_number,
        "wearSide": binding.wear_side,
        "connected": binding.connected,
        "boundAt": binding.bound_at.isoformat(),
        "updatedAt": binding.updated_at.isoformat(),
        "batteryPercent": device.battery_percent,
        "lastHeartbeatAt": device.last_heartbeat_at.isoformat() if device.last_heartbeat_at else None,
        "firmwareVersion": device.firmware_version,
        "status": device.status,
    }


@api.post("/devices/bind")
def bind_device(body: BindDeviceIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.serial_number == body.serialNumber.strip().upper()).first()
    if device is None or device.verification_code != body.verificationCode.strip():
        raise HTTPException(status_code=404, detail="设备未登记或校验码不正确")
    existing = connected_binding(db, user)
    if existing:
        existing.connected = False
        existing.unbound_at = now_utc()
    binding = DeviceBinding(
        user_id=user.id,
        device_id=device.id,
        device_name=body.deviceName.strip(),
        wear_side=body.wearSide,
        source="demo_seed" if user.is_demo and device.is_demo else "user_input",
    )
    device.status = "active"
    device.wear_side = body.wearSide
    db.add(binding)
    db.commit()
    db.refresh(binding)
    return {"success": True, "binding": binding_payload(binding)}


@api.post("/devices/disconnect")
def disconnect_device(user: User = Depends(current_user), db: Session = Depends(get_db)):
    binding = connected_binding(db, user)
    if binding:
        binding.connected = False
        binding.unbound_at = now_utc()
    db.commit()
    return {"success": True, "binding": None}


@api.post("/device/v1/handshake")
def device_handshake(body: DeviceHandshakeIn, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.serial_number == body.serialNumber.strip().upper()).first()
    if device is None or device.device_secret != body.deviceSecret:
        raise HTTPException(status_code=401, detail="设备凭据无效")
    token = create_device_token()
    session = DeviceSession(device_id=device.id, token_hash=sha256(token), expires_at=now_utc() + timedelta(hours=12))
    db.add(session)
    db.commit()
    return {"deviceToken": token, "expiresAt": session.expires_at.isoformat(), "serverTime": now_utc().isoformat()}


@api.post("/device/v1/heartbeat")
def device_heartbeat(body: HeartbeatIn, device: Device = Depends(current_device), db: Session = Depends(get_db)):
    device.last_heartbeat_at = now_utc()
    device.battery_percent = body.batteryPercent
    device.firmware_version = body.firmwareVersion
    device.wear_side = body.wearSide or device.wear_side
    device.status = "online"
    db.commit()
    return {"accepted": True, "serverTime": now_utc().isoformat()}


@api.post("/device/v1/telemetry/batches")
def ingest_batch(payload: dict[str, Any], device: Device = Depends(current_device), db: Session = Depends(get_db)):
    batch_meta = payload.get("batch") or {}
    batch_id = str(batch_meta.get("batchId") or "").strip()
    if not batch_id:
        raise HTTPException(status_code=400, detail="batch.batchId is required")
    existing = db.query(DeviceIngestBatch).filter(DeviceIngestBatch.device_id == device.id, DeviceIngestBatch.batch_id == batch_id).first()
    if existing:
        return {"accepted": True, "batchId": batch_id, "serverTime": now_utc().isoformat(), "acceptedWindows": [], "duplicateWindows": [item.get("windowId") for item in payload.get("windows", [])], "rejectedWindows": [], "nextUploadAfterSec": 300}

    captured_at = parse_datetime(batch_meta.get("capturedAt")) or now_utc()
    battery = payload.get("battery") or {}
    windows = payload.get("windows") or []
    batch = DeviceIngestBatch(
        device_id=device.id,
        batch_id=batch_id,
        boot_id=batch_meta.get("bootId"),
        captured_at=captured_at,
        sample_rate_hz=int(batch_meta.get("sampleRateHz") or 100),
        battery_percent=battery.get("percent"),
        window_count=len(windows),
        payload=payload,
    )
    db.add(batch)
    db.flush()
    accepted: list[str] = []
    for window in windows:
        summary = window.get("edgeSummary") or {}
        duration_ms = int(window.get("durationMs") or 10000)
        measured_at = captured_at + timedelta(milliseconds=int(window.get("startOffsetMs") or 0))
        feature = TremorFeature(
            device_id=device.id,
            source_batch_id=batch.id,
            measured_at=measured_at,
            duration_sec=duration_ms / 1000,
            intensity_rms=float(summary.get("accelRms") or summary.get("intensityRms") or 0),
            dominant_freq_hz=float(summary.get("dominantFreqHz") or 0),
            sample_count=int(window.get("sampleCount") or 0),
            confidence=0.9 if int(window.get("sampleCount") or 0) >= 900 else 0.65,
            wear_side=payload.get("device", {}).get("wearSide") or device.wear_side,
            source="device_upload",
        )
        db.add(feature)
        accepted.append(str(window.get("windowId") or measured_at.isoformat()))
    device.battery_percent = battery.get("percent", device.battery_percent)
    device.last_heartbeat_at = now_utc()
    device.status = "online"
    db.commit()
    return {"accepted": True, "batchId": batch_id, "serverTime": now_utc().isoformat(), "acceptedWindows": accepted, "duplicateWindows": [], "rejectedWindows": [], "nextUploadAfterSec": 300}


def parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


@api.get("/dashboard/summary")
def dashboard(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return dashboard_summary(db, user)


@api.get("/tremor/timeline")
def timeline(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return user_timeline_entries(db, user)


@api.get("/tremor/events")
def tremor_events(user: User = Depends(current_user), db: Session = Depends(get_db)):
    events = [
        {
            "id": item.id,
            "measuredAt": item.measured_at.isoformat(),
            "durationSec": item.duration_sec,
            "intensityRms": item.intensity_rms,
            "dominantFreqHz": item.dominant_freq_hz,
            "confidence": item.confidence,
            "source": item.source,
        }
        for item in user_features_today(db, user)
        if item.intensity_rms >= 4
    ]
    return {"events": events}


@api.get("/medication/records")
def medication_records(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [{"time": item.taken_at.strftime("%H:%M"), "status": item.status, "medication": item.medication, "dosage": item.dosage} for item in user_medications_today(db, user)]


@api.post("/medication/check-in")
def medication_check_in(body: MedicationIn | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    body = body or MedicationIn()
    record = MedicationRecord(user_id=user.id, medication=body.medication.strip(), dosage=body.dosage, taken_at=body.takenAt or now_utc(), source="demo_seed" if user.is_demo else "user_input")
    db.add(record)
    db.commit()
    return {"success": True, "message": "服药打卡已记录。", "recordedAt": record.taken_at.isoformat()}


@api.post("/medical-records/archives")
def create_archive(body: ArchiveIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not body.consentAccepted:
        raise HTTPException(status_code=400, detail="创建档案前请先确认授权说明")
    archive = MedicalRecordArchive(user_id=user.id, title=body.title.strip(), patient_name=body.patientName.strip(), description=body.description or "", consent_accepted=True, source="demo_seed" if user.is_demo else "user_input")
    db.add(archive)
    db.commit()
    db.refresh(archive)
    return {"archive": archive_summary(archive)}


@api.get("/medical-records/archives")
def list_archives(user: User = Depends(current_user), db: Session = Depends(get_db)):
    archives = db.query(MedicalRecordArchive).filter(MedicalRecordArchive.user_id == user.id).order_by(MedicalRecordArchive.updated_at.desc()).all()
    return {"archives": [archive_summary(item) for item in archives], "policy": "病历资料仅用于健康管理和复诊沟通。"}


def archive_summary(archive: MedicalRecordArchive) -> dict[str, Any]:
    return {"id": archive.id, "title": archive.title, "patientName": archive.patient_name, "description": archive.description, "fileCount": 0, "reportCount": 0, "createdAt": archive.created_at.isoformat(), "updatedAt": archive.updated_at.isoformat()}


@api.post("/ai/chat")
def ai_chat(body: ChatIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return build_ai_response(body.message, user, db)


@api.post("/ai/chat/stream")
def ai_chat_stream(body: ChatIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    response = build_ai_response(body.message, user, db)

    def events():
        yield f"data: {{\"type\":\"delta\",\"text\":{response['text']!r}}}\n\n".replace("'", '"')
        yield f"data: {{\"type\":\"done\",\"providerStatus\":\"{response['providerStatus']}\",\"providerName\":\"local-safe\",\"providerError\":null,\"disclaimer\":{response['disclaimer']!r}}}\n\n".replace("'", '"')

    return StreamingResponse(events(), media_type="text/event-stream")


def build_ai_response(message: str, user: User, db: Session) -> dict[str, Any]:
    summary = dashboard_summary(db, user)
    timeline_entries = user_timeline_entries(db, user)
    features = user_features_today(db, user)
    provider = ai_provider_config()
    provider_error: str | None = None

    if provider and features:
        system_prompt, user_prompt = build_ai_prompts(message, user, summary, timeline_entries)
        completion = request_ai_completion(provider, system_prompt, user_prompt)
        if completion["text"]:
            return {
                "role": "ai",
                "text": completion["text"],
                "disclaimer": "AI 生成内容仅供健康管理参考，不能替代医生诊断与处方建议。",
                "providerStatus": "live",
                "providerName": provider["name"],
                "providerError": None,
            }
        provider_error = completion["error"]

    text = build_local_ai_text(message, features)
    provider_status = "fallback" if provider else "local"
    provider_name = provider["name"] if provider else "local-safe"
    return {
        "role": "ai",
        "text": text,
        "disclaimer": "AI 生成内容仅供健康管理参考，不能替代医生诊断与处方建议。",
        "providerStatus": provider_status,
        "providerName": provider_name,
        "providerError": provider_error,
    }


def build_local_ai_text(message: str, features: list[TremorFeature]) -> str:
    if "药" in message or "剂量" in message or "药量" in message:
        if not features:
            return "我可以解释监测趋势与用药记录的时间关系，但当前账号今天还没有足够的真实监测数据。药量调整或处方建议需要咨询主治医生。"
        peak = max(features, key=lambda item: item.intensity_rms)
        return f"我可以解释趋势和用药时间关系，但不能给出药量调整建议。当前账号今日峰值出现在 {peak.measured_at.strftime('%H:%M')}，强度 {peak.intensity_rms:.1f} RMS，主频约 {peak.dominant_freq_hz:.1f}Hz；建议把该时段与实际服药时间、活动和疲劳情况一起记录后带给医生。"
    if not features:
        return "当前账号今天还没有足够的真实监测数据可供分析。请先完成设备佩戴和数据同步后再查看趋势解读。"
    peak = max(features, key=lambda item: item.intensity_rms)
    return f"基于当前账号今日已同步的数据，峰值出现在 {peak.measured_at.strftime('%H:%M')}，强度 {peak.intensity_rms:.1f} RMS，主频约 {peak.dominant_freq_hz:.1f}Hz。建议记录当时活动、休息和用药时间，供复诊沟通使用。"


def ai_provider_config() -> dict[str, str] | None:
    if settings.qwen_api_key:
        return {
            "name": "qwen",
            "api_key": settings.qwen_api_key,
            "model": settings.qwen_model,
            "base_url": settings.qwen_base_url,
        }
    if settings.openai_api_key:
        return {
            "name": "openai-compatible",
            "api_key": settings.openai_api_key,
            "model": settings.openai_model,
            "base_url": settings.openai_base_url,
        }
    return None


def normalize_chat_completions_url(base_url: str, provider_name: str) -> str:
    base = base_url.rstrip("/")
    if base.endswith("/chat/completions"):
        return base
    if provider_name == "qwen" and base.endswith("/api/v1"):
        base = f"{base.removesuffix('/api/v1')}/compatible-mode/v1"
    if provider_name == "qwen" and "dashscope.aliyuncs.com" in base and not base.endswith("/compatible-mode/v1"):
        base = f"{base}/compatible-mode/v1"
    if not base.endswith("/v1") and not base.endswith("/compatible-mode/v1"):
        base = f"{base}/v1"
    return f"{base}/chat/completions"


def build_ai_prompts(message: str, user: User, summary: dict[str, Any], timeline_entries: list[dict[str, Any]]) -> tuple[str, str]:
    system_prompt = (
        "You are Tremor Guard AI, a cautious Parkinson tremor monitoring assistant. "
        "Use only the provided database context for the current authenticated user. "
        "Do not invent monitoring values. Do not diagnose disease, prescribe medication, or change dosage. "
        "Answer in concise Chinese and always state that results are for health management reference only."
    )
    context = {
        "patient": summary["patient"],
        "dashboardStats": summary["stats"],
        "insights": summary["insights"],
        "device": summary["device"],
        "hasMonitoringData": summary["hasMonitoringData"],
        "timeline": timeline_entries,
    }
    user_prompt = "\n".join(
        [
            f"Authenticated user id: {user.id}",
            "Current user database context:",
            json.dumps(context, ensure_ascii=False),
            f"User question: {message}",
            "Please ground the answer in the timeline, medication markers, dashboard stats, and device status above.",
        ]
    )
    return system_prompt, user_prompt


def request_ai_completion(provider: dict[str, str], system_prompt: str, user_prompt: str) -> dict[str, str | None]:
    payload = {
        "model": provider["model"],
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
    }
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = url_request.Request(
        normalize_chat_completions_url(provider["base_url"], provider["name"]),
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {provider['api_key']}",
            "Content-Type": "application/json",
        },
    )
    try:
        with url_request.urlopen(req, timeout=settings.ai_request_timeout_ms / 1000) as response:
            response_body = json.loads(response.read().decode("utf-8"))
    except (OSError, TimeoutError, url_error.URLError, url_error.HTTPError, json.JSONDecodeError) as exc:
        return {"text": None, "error": str(exc)}

    try:
        content = response_body["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        return {"text": None, "error": "AI provider returned an unexpected response"}
    return {"text": content.strip() if isinstance(content, str) else None, "error": None}


@api.post("/rehab-plans")
def create_rehab_plan(body: RehabPlanIn | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    summary = dashboard_summary(db, user)
    content = build_rehab_content(body.focus if body else None, summary, today_context(db, user))
    plan = RehabPlan(user_id=user.id, title=f"{user.name} 居家康复计划", content=content, source="demo_seed" if user.is_demo else "ai_generated")
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return {"plan": rehab_payload(plan)}


@api.post("/rehab-plans/{plan_id}/confirm")
def confirm_rehab_plan(plan_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    plan = db.query(RehabPlan).filter(RehabPlan.id == plan_id, RehabPlan.user_id == user.id).first()
    if plan is None:
        raise HTTPException(status_code=404, detail="康复计划不存在")
    plan.status = "confirmed"
    plan.confirmed_at = now_utc()
    db.commit()
    return {"plan": rehab_payload(plan)}


@api.get("/rehab-plans/current")
def current_rehab_plan(user: User = Depends(current_user), db: Session = Depends(get_db)):
    plan = db.query(RehabPlan).filter(RehabPlan.user_id == user.id).order_by(RehabPlan.created_at.desc()).first()
    return {"plan": rehab_payload(plan) if plan else None}


def rehab_payload(plan: RehabPlan) -> dict[str, Any]:
    return {"id": plan.id, "title": plan.title, "status": plan.status, "content": plan.content, "createdAt": plan.created_at.isoformat(), "confirmedAt": plan.confirmed_at.isoformat() if plan.confirmed_at else None}


def build_rehab_content(requested_focus: str | None, summary: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    features: list[TremorFeature] = context["features"]
    peak: TremorFeature | None = context["peak"]
    avg = context["avg"]
    wearing_hours = context["wearingHours"]
    done_count = context["doneMedicationCount"]
    battery_level = summary["device"]["batteryLevel"]

    if not features:
        focus = requested_focus or "建立设备佩戴、基础活动和症状记录习惯"
        return {
            "focus": focus,
            "generatedFrom": {
                "hasMonitoringData": False,
                "deviceStatus": summary["device"]["status"],
                "batteryLevel": battery_level,
                "medicationCount": done_count,
            },
            "items": [
                {"title": "设备佩戴准备", "durationMin": 5, "detail": "先完成设备佩戴和连接确认，记录训练前主观震颤、疲劳和安全环境。"},
                {"title": "基础关节活动", "durationMin": 8, "detail": "在稳定坐姿或扶手旁完成肩、肘、腕和踝膝轻柔活动，训练中如不适应立即停止。"},
                {"title": "训练后记录", "durationMin": 3, "detail": "记录训练后的震颤变化、疲劳程度和是否完成设备同步，供后续报告引用。"},
            ],
            "safetyNote": "当前账号暂无足够监测数据，计划仅用于建立居家记录流程，不能替代康复治疗师评估。",
        }

    peak_time = peak.measured_at.strftime("%H:%M") if peak else "未知时段"
    focus = requested_focus or f"围绕今日峰值 {peak_time} 的低强度活动、步态启动和状态记录"
    intensity_level = "偏高" if peak and peak.intensity_rms >= 6 else "平稳"
    return {
        "focus": focus,
        "generatedFrom": {
            "hasMonitoringData": True,
            "averageRms": round(avg, 2),
            "peakRms": round(peak.intensity_rms, 2) if peak else 0,
            "peakTime": peak_time,
            "dominantFreqHz": round(peak.dominant_freq_hz, 2) if peak else 0,
            "wearingHours": wearing_hours,
            "medicationCount": done_count,
            "deviceStatus": summary["device"]["status"],
            "batteryLevel": battery_level,
        },
        "items": [
            {
                "title": "峰值时段前后放松",
                "durationMin": 6 if intensity_level == "偏高" else 8,
                "detail": f"今日峰值出现在 {peak_time}，强度 {peak.intensity_rms:.1f} RMS。建议在该时段前后安排低强度呼吸放松和肩颈活动，避免疲劳叠加。",
            },
            {
                "title": "步态启动与转身记录",
                "durationMin": 10,
                "detail": f"今日有效佩戴约 {wearing_hours} 小时。训练时在扶手旁练习起步、转身和节律提示，并记录训练前后震颤主观变化。",
            },
            {
                "title": "用药与活动对照",
                "durationMin": 5,
                "detail": f"今日已记录 {done_count} 次用药。训练后补充用药、活动、休息与震颤变化的对应关系，供复诊沟通使用。",
            },
        ],
        "safetyNote": "计划根据当前账号今日监测摘要生成，仅供居家健康管理参考，不能替代康复治疗师评估。",
    }


@api.post("/health-reports")
def create_health_report(user: User = Depends(current_user), db: Session = Depends(get_db)):
    summary = dashboard_summary(db, user)
    latest_plan = db.query(RehabPlan).filter(RehabPlan.user_id == user.id).order_by(RehabPlan.created_at.desc()).first()
    plan_payload = rehab_payload(latest_plan) if latest_plan else None
    content = {
        "summary": summary,
        "rehabPlan": plan_payload,
        "sections": build_report_sections(summary, plan_payload),
        "disclaimer": "本报告仅用于健康管理和复诊沟通，不构成诊断或处方。",
    }
    report = HealthReport(user_id=user.id, title=f"{user.name} 健康报告", content=content, source="demo_seed" if user.is_demo else "generated")
    db.add(report)
    db.commit()
    db.refresh(report)
    return {"report": report_payload(report), "created": True}


@api.get("/health-reports")
def list_health_reports(user: User = Depends(current_user), db: Session = Depends(get_db)):
    reports = db.query(HealthReport).filter(HealthReport.user_id == user.id).order_by(HealthReport.created_at.desc()).all()
    return {"reports": [report_payload(item) for item in reports]}


def report_payload(report: HealthReport) -> dict[str, Any]:
    return {"id": report.id, "title": report.title, "content": report.content, "generatedAt": report.created_at.isoformat(), "hasPdf": True, "source": report.source}


def build_report_sections(summary: dict[str, Any], plan_payload: dict[str, Any] | None) -> list[dict[str, Any]]:
    sections = [
        {
            "title": "监测概览",
            "body": summary["insights"]["summary"],
            "metrics": summary["stats"],
        },
        {
            "title": "设备与数据状态",
            "body": f"设备状态：{summary['device']['status']}，电量：{summary['device']['batteryLevel']}%。",
            "metrics": [],
        },
    ]
    if plan_payload:
        generated_from = plan_payload["content"].get("generatedFrom", {})
        sections.append(
            {
                "title": "康复计划摘要",
                "body": f"计划状态：{plan_payload['status']}；重点：{plan_payload['content'].get('focus', '暂无')}。",
                "metrics": [
                    {"label": "峰值时段", "value": generated_from.get("peakTime", "暂无"), "unit": ""},
                    {"label": "有效佩戴", "value": str(generated_from.get("wearingHours", 0)), "unit": "小时"},
                    {"label": "用药记录", "value": str(generated_from.get("medicationCount", 0)), "unit": "次"},
                ],
            }
        )
    return sections


@api.get("/health-reports/{report_id}/pdf")
def report_pdf(report_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    report = db.query(HealthReport).filter(HealthReport.id == report_id, HealthReport.user_id == user.id).first()
    if report is None:
        raise HTTPException(status_code=404, detail="报告不存在")
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    pdf.setTitle(report.title)
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(48, 800, report.title)
    pdf.setFont("Helvetica", 10)
    pdf.drawString(48, 775, f"Generated at: {report.created_at.isoformat()}")
    content = report.content or {}
    summary = content.get("summary") or {}
    sections = content.get("sections") or []
    y = 750
    for stat in summary.get("stats", []):
        pdf.drawString(48, y, f"{stat.get('label')}: {stat.get('value')} {stat.get('unit')}")
        y -= 18
    for section in sections[:3]:
        y -= 10
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(48, y, str(section.get("title", ""))[:90])
        y -= 16
        pdf.setFont("Helvetica", 9)
        pdf.drawString(48, y, str(section.get("body", ""))[:110])
        y -= 18
        if y < 80:
            pdf.showPage()
            y = 800
    pdf.drawString(48, max(y - 12, 48), str(content.get("disclaimer") or "For health management and follow-up communication only.")[:110])
    pdf.showPage()
    pdf.save()
    buffer.seek(0)
    return Response(buffer.read(), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="health-report-{report.id}.pdf"'})


app.mount("/api", api)
