from __future__ import annotations

import json
import os
from datetime import datetime, timezone

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app
from app.models import Device
from app.security import sha256


client = TestClient(app)


def setup_function():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_empty_user_device_upload_dashboard_ai_rehab_report_loop():
    from app.database import SessionLocal

    register = client.post("/api/auth/register", json={"name": "Real User", "email": "real@example.com", "age": 66, "password": "secret123"})
    assert register.status_code == 200
    token = register.json()["token"]

    assert client.get("/api/dashboard/summary", headers=auth_headers(token)).json()["hasMonitoringData"] is False
    assert client.get("/api/tremor/timeline", headers=auth_headers(token)).json()[0]["intensity"] == 0

    onboarding = client.put("/api/patients/me/onboarding", headers=auth_headers(token), json={"primarySymptom": "右手震颤", "consentAccepted": True})
    assert onboarding.status_code == 200
    assert onboarding.json()["onboardingCompleted"] is True

    db = SessionLocal()
    try:
        db.add(Device(serial_number="TG-REAL-001", verification_code="246810", device_secret="real-secret", status="provisioned"))
        db.commit()
    finally:
        db.close()

    bind = client.post("/api/devices/bind", headers=auth_headers(token), json={"deviceName": "真实手环", "serialNumber": "TG-REAL-001", "verificationCode": "246810", "wearSide": "right"})
    assert bind.status_code == 200

    handshake = client.post("/api/device/v1/handshake", json={"serialNumber": "TG-REAL-001", "deviceSecret": "real-secret"})
    assert handshake.status_code == 200
    device_token = handshake.json()["deviceToken"]

    heartbeat = client.post("/api/device/v1/heartbeat", headers=auth_headers(device_token), json={"batteryPercent": 77, "firmwareVersion": "test-fw"})
    assert heartbeat.status_code == 200

    payload = {
        "batch": {"batchId": "batch-001", "capturedAt": "2026-05-02T08:00:00Z", "sampleRateHz": 100},
        "battery": {"percent": 76},
        "device": {"wearSide": "right"},
        "windows": [{"windowId": "w1", "startOffsetMs": 0, "durationMs": 10000, "sampleCount": 1000, "edgeSummary": {"accelRms": 5.4, "dominantFreqHz": 4.9}}],
    }
    upload = client.post("/api/device/v1/telemetry/batches", headers=auth_headers(device_token), json=payload)
    assert upload.status_code == 200
    assert upload.json()["acceptedWindows"] == ["w1"]
    duplicate = client.post("/api/device/v1/telemetry/batches", headers=auth_headers(device_token), json=payload)
    assert duplicate.json()["duplicateWindows"] == ["w1"]

    summary = client.get("/api/dashboard/summary", headers=auth_headers(token)).json()
    assert summary["hasMonitoringData"] is True
    assert summary["device"]["batteryLevel"] == 76

    ai = client.post("/api/ai/chat", headers=auth_headers(token), json={"message": "今天趋势如何"})
    assert "08:00" in ai.json()["text"]

    plan = client.post("/api/rehab-plans", headers=auth_headers(token), json={}).json()["plan"]
    confirmed = client.post(f"/api/rehab-plans/{plan['id']}/confirm", headers=auth_headers(token)).json()["plan"]
    assert confirmed["status"] == "confirmed"

    report = client.post("/api/health-reports", headers=auth_headers(token)).json()["report"]
    pdf = client.get(f"/api/health-reports/{report['id']}/pdf", headers=auth_headers(token))
    assert pdf.status_code == 200
    assert pdf.headers["content-type"] == "application/pdf"


def test_ai_fallback_does_not_invent_trends_without_data():
    register = client.post("/api/auth/register", json={"name": "Empty User", "email": "empty@example.com", "password": "secret123"})
    token = register.json()["token"]
    response = client.post("/api/ai/chat", headers=auth_headers(token), json={"message": "今天趋势如何"}).json()
    assert "没有足够的真实监测数据" in response["text"]
    assert "15:00" not in response["text"]


def test_ai_provider_receives_authenticated_user_database_context(monkeypatch):
    from app.database import SessionLocal
    from app.main import settings
    from app.models import DeviceBinding, MedicationRecord, TremorFeature, User

    user = User(email="context@example.com", name="Context User", age=70, password_hash="hashed")
    device = Device(serial_number="TG-CONTEXT-001", verification_code="135790", device_secret="context-secret", status="provisioned")
    db = SessionLocal()
    try:
        db.add_all([user, device])
        db.flush()
        db.add(DeviceBinding(user_id=user.id, device_id=device.id, device_name="Context Device", wear_side="left", connected=True))
        db.add(
            TremorFeature(
                device_id=device.id,
                measured_at=datetime(2026, 5, 2, 8, 0, tzinfo=timezone.utc),
                intensity_rms=5.4,
                dominant_freq_hz=4.9,
                sample_count=1000,
            )
        )
        db.add(MedicationRecord(user_id=user.id, medication="测试用药", status="done", taken_at=datetime(2026, 5, 2, 8, 30, tzinfo=timezone.utc)))
        db.commit()
        user_id = user.id
        user_email = user.email
    finally:
        db.close()

    monkeypatch.setattr(settings, "qwen_api_key", "test-key")
    captured: dict[str, object] = {}

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self):
            return json.dumps({"choices": [{"message": {"content": "已根据真实数据分析。"}}]}).encode()

    def fake_urlopen(request, timeout):
        captured["url"] = request.full_url
        captured["headers"] = dict(request.header_items())
        captured["payload"] = json.loads(request.data.decode())
        captured["timeout"] = timeout
        return FakeResponse()

    monkeypatch.setattr("app.main.url_request.urlopen", fake_urlopen)

    token = create_token_for_context_user(user_id, user_email)
    response = client.post("/api/ai/chat", headers=auth_headers(token), json={"message": "今天趋势如何"})

    assert response.status_code == 200
    assert response.json()["providerStatus"] == "live"
    assert captured["url"].endswith("/compatible-mode/v1/chat/completions")
    prompt = captured["payload"]["messages"][1]["content"]
    assert "Context User" in prompt
    assert '"time": "08:00"' in prompt
    assert '"intensity": 5.4' in prompt
    assert '"isMedication": true' in prompt


def create_token_for_context_user(user_id: str, email: str) -> str:
    from app.security import create_access_token

    return create_access_token({"sub": user_id, "email": email})
