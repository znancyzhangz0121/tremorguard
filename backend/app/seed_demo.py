from __future__ import annotations

from datetime import datetime, timedelta, timezone

from .database import Base, SessionLocal, engine
from .models import Device, DeviceBinding, MedicationRecord, PatientProfile, TremorFeature, User
from .security import hash_password
from .settings import settings

DEMO_EMAIL = "demo@tremorguard.local"
DEMO_DEVICE_SERIAL = "TG-DEMO-001"
DEMO_DEVICE_SECRET = "demo-device-secret"
DEMO_VERIFICATION_CODE = "638214"


def seed_demo() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == DEMO_EMAIL).first()
        if user is None:
            user = User(email=DEMO_EMAIL, name="Demo Patient", age=68, password_hash=hash_password(settings.demo_password), onboarding_completed=True, is_demo=True, source="demo_seed")
            db.add(user)
            db.flush()
        else:
            user.password_hash = hash_password(settings.demo_password)
            user.onboarding_completed = True
            user.is_demo = True
            user.source = "demo_seed"

        if user.profile is None:
            db.add(PatientProfile(user_id=user.id, sex="unspecified", diagnosis_year=2021, primary_symptom="震颤波动", mobility_level="independent", emergency_contact="Demo Contact", consent_accepted=True))

        device = db.query(Device).filter(Device.serial_number == DEMO_DEVICE_SERIAL).first()
        if device is None:
            device = Device(serial_number=DEMO_DEVICE_SERIAL, verification_code=DEMO_VERIFICATION_CODE, device_secret=DEMO_DEVICE_SECRET, status="online", firmware_version="demo-1.0.0", battery_percent=86, wear_side="right", is_demo=True, source="demo_seed")
            db.add(device)
            db.flush()
        else:
            device.verification_code = DEMO_VERIFICATION_CODE
            device.device_secret = DEMO_DEVICE_SECRET
            device.is_demo = True
            device.source = "demo_seed"

        db.query(TremorFeature).filter(TremorFeature.device_id == device.id, TremorFeature.source == "demo_seed").delete()
        db.query(MedicationRecord).filter(MedicationRecord.user_id == user.id, MedicationRecord.source == "demo_seed").delete()
        for binding in db.query(DeviceBinding).filter(DeviceBinding.user_id == user.id).all():
            binding.connected = False
        binding = DeviceBinding(user_id=user.id, device_id=device.id, device_name="演示震颤卫士手环", wear_side="right", connected=True, source="demo_seed")
        db.add(binding)

        start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        for hour in range(24):
            intensity = max(0.6, 2.0 + 2.5 * abs((hour - 15) / 9) + (3.8 if hour in (15, 16) else 0))
            db.add(
                TremorFeature(
                    device_id=device.id,
                    measured_at=start + timedelta(hours=hour),
                    duration_sec=600,
                    intensity_rms=round(intensity, 2),
                    dominant_freq_hz=round(4.6 + (hour % 5) * 0.15, 2),
                    sample_count=60000,
                    confidence=0.92,
                    wear_side="right",
                    algorithm_version="demo-seed-v1",
                    source="demo_seed",
                )
            )

        for hour in (8, 13, 18):
            db.add(MedicationRecord(user_id=user.id, medication="演示用药记录", dosage="遵医嘱", status="done", taken_at=start + timedelta(hours=hour), source="demo_seed"))

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo()
