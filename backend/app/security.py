from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .database import get_db
from .models import Device, DeviceSession, User
from .settings import settings

password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return password_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return password_context.verify(password, password_hash)


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def create_access_token(payload: dict[str, Any]) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode({**payload, "exp": expires_at}, settings.jwt_secret, algorithm="HS256")


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bearer token") from exc

    user = db.query(User).filter(User.id == payload.get("sub")).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def create_device_token() -> str:
    return secrets.token_urlsafe(32)


def current_device(
    request: Request,
    x_device_serial: str | None = Header(default=None),
    x_device_timestamp: str | None = Header(default=None),
    x_device_nonce: str | None = Header(default=None),
    x_device_signature: str | None = Header(default=None),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Device:
    if credentials is not None:
        token_hash = sha256(credentials.credentials)
        session = db.query(DeviceSession).filter(DeviceSession.token_hash == token_hash).first()
        if session and ensure_aware(session.expires_at) > datetime.now(timezone.utc):
            return session.device

    if x_device_serial and x_device_timestamp and x_device_nonce and x_device_signature:
        device = db.query(Device).filter(Device.serial_number == x_device_serial.strip().upper()).first()
        if device is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown device")

        body = getattr(request.state, "body_bytes", b"")
        body_hash = hashlib.sha256(body).hexdigest()
        signing_string = "\n".join([
            request.method.upper(),
            request.url.path,
            x_device_timestamp,
            x_device_nonce,
            body_hash,
        ])
        expected = hmac.new(device.device_secret.encode("utf-8"), signing_string.encode("utf-8"), hashlib.sha256).hexdigest()
        if hmac.compare_digest(expected, x_device_signature):
            return device

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid device credentials")


def ensure_aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
