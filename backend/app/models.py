from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from .database import Base


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(40), default="patient")
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[str] = mapped_column(String(40), default="user_input")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    profile: Mapped["PatientProfile | None"] = relationship(back_populates="user", cascade="all, delete-orphan")
    bindings: Mapped[list["DeviceBinding"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    medications: Mapped[list["MedicationRecord"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    archives: Mapped[list["MedicalRecordArchive"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    rehab_plans: Mapped[list["RehabPlan"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    reports: Mapped[list["HealthReport"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    sex: Mapped[str | None] = mapped_column(String(40), nullable=True)
    diagnosis_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    primary_symptom: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mobility_level: Mapped[str | None] = mapped_column(String(80), nullable=True)
    emergency_contact: Mapped[str | None] = mapped_column(String(120), nullable=True)
    consent_accepted: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    user: Mapped[User] = relationship(back_populates="profile")


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    serial_number: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    model: Mapped[str] = mapped_column(String(80), default="TG-V1.0-ESP")
    verification_code: Mapped[str] = mapped_column(String(80))
    device_secret: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(40), default="provisioned")
    firmware_version: Mapped[str | None] = mapped_column(String(80), nullable=True)
    battery_percent: Mapped[int | None] = mapped_column(Integer, nullable=True)
    wear_side: Mapped[str | None] = mapped_column(String(20), nullable=True)
    last_heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[str] = mapped_column(String(40), default="provisioned")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    bindings: Mapped[list["DeviceBinding"]] = relationship(back_populates="device", cascade="all, delete-orphan")
    batches: Mapped[list["DeviceIngestBatch"]] = relationship(back_populates="device", cascade="all, delete-orphan")
    features: Mapped[list["TremorFeature"]] = relationship(back_populates="device", cascade="all, delete-orphan")
    sessions: Mapped[list["DeviceSession"]] = relationship(back_populates="device", cascade="all, delete-orphan")


class DeviceBinding(Base):
    __tablename__ = "device_bindings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"))
    device_name: Mapped[str] = mapped_column(String(120))
    wear_side: Mapped[str] = mapped_column(String(20))
    connected: Mapped[bool] = mapped_column(Boolean, default=True)
    bound_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    unbound_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)
    source: Mapped[str] = mapped_column(String(40), default="user_input")

    user: Mapped[User] = relationship(back_populates="bindings")
    device: Mapped[Device] = relationship(back_populates="bindings")


class DeviceSession(Base):
    __tablename__ = "device_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    device: Mapped[Device] = relationship(back_populates="sessions")


class DeviceIngestBatch(Base):
    __tablename__ = "device_ingest_batches"
    __table_args__ = (UniqueConstraint("device_id", "batch_id", name="uq_device_batch"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"))
    batch_id: Mapped[str] = mapped_column(String(160), index=True)
    boot_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    sample_rate_hz: Mapped[int] = mapped_column(Integer, default=100)
    battery_percent: Mapped[int | None] = mapped_column(Integer, nullable=True)
    window_count: Mapped[int] = mapped_column(Integer, default=0)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    source: Mapped[str] = mapped_column(String(40), default="device_upload")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    device: Mapped[Device] = relationship(back_populates="batches")
    features: Mapped[list["TremorFeature"]] = relationship(back_populates="batch", cascade="all, delete-orphan")


class TremorFeature(Base):
    __tablename__ = "tremor_features"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"))
    source_batch_id: Mapped[str | None] = mapped_column(ForeignKey("device_ingest_batches.id", ondelete="SET NULL"), nullable=True)
    measured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    duration_sec: Mapped[float] = mapped_column(Float, default=10.0)
    intensity_rms: Mapped[float] = mapped_column(Float)
    dominant_freq_hz: Mapped[float] = mapped_column(Float)
    sample_count: Mapped[int] = mapped_column(Integer)
    confidence: Mapped[float] = mapped_column(Float, default=0.85)
    wear_side: Mapped[str | None] = mapped_column(String(20), nullable=True)
    algorithm_version: Mapped[str] = mapped_column(String(40), default="edge-summary-v1")
    source: Mapped[str] = mapped_column(String(40), default="device_upload")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    device: Mapped[Device] = relationship(back_populates="features")
    batch: Mapped[DeviceIngestBatch | None] = relationship(back_populates="features")


class MedicationRecord(Base):
    __tablename__ = "medication_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    medication: Mapped[str] = mapped_column(String(160))
    dosage: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="done")
    taken_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    source: Mapped[str] = mapped_column(String(40), default="user_input")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    user: Mapped[User] = relationship(back_populates="medications")


class MedicalRecordArchive(Base):
    __tablename__ = "medical_record_archives"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(160))
    patient_name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    consent_accepted: Mapped[bool] = mapped_column(Boolean, default=True)
    source: Mapped[str] = mapped_column(String(40), default="user_input")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    user: Mapped[User] = relationship(back_populates="archives")


class RehabPlan(Base):
    __tablename__ = "rehab_plans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(40), default="draft")
    content: Mapped[dict] = mapped_column(JSON, default=dict)
    source: Mapped[str] = mapped_column(String(40), default="ai_generated")
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    user: Mapped[User] = relationship(back_populates="rehab_plans")


class HealthReport(Base):
    __tablename__ = "health_reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(160))
    content: Mapped[dict] = mapped_column(JSON, default=dict)
    source: Mapped[str] = mapped_column(String(40), default="generated")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    user: Mapped[User] = relationship(back_populates="reports")
