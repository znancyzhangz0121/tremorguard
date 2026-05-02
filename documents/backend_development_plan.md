# TremorGuard FastAPI Backend Development Plan

## Current Direction

The backend delivery surface is now FastAPI. The previous Node/Nest implementation was removed as part of the replacement migration, so the running backend must come from `backend/app`.

## Backend Modules

- `auth`: account registration, login, JWT issuing, password hashing.
- `users` and `patients`: current user profile and onboarding state.
- `devices`: provisioned-device binding, disconnect, online state.
- `device/v1`: device handshake, heartbeat, telemetry batch upload.
- `tremor`: timeline and event queries from stored device-derived features.
- `dashboard`: patient workspace aggregation.
- `medication`: patient-entered medication events.
- `medical_records`: archive metadata for patient-provided records.
- `ai`: authenticated user-context interpretation with safe local fallback.
- `rehab_plans`: generated plan draft and confirmation.
- `health_reports`: generated report list and PDF export.

## Data Policy

Only demo seed data may be generated automatically, and it must be marked with `source = "demo_seed"` or equivalent demo flags. Non-demo users start with no device, monitoring, medication, record, plan, or report data.

Runtime data must live in the configured database or external storage, not repository JSON files.

## Device Ingestion

ESP32 devices do not use patient JWTs. They authenticate through device handshake tokens or HMAC-signed upload requests. Telemetry batches are idempotent by device and batch id, and generated tremor features must record their source batch and algorithm version.

## Verification

- `backend/.venv/bin/python -m pytest -q`
- `node scripts/validate-no-mock-data.mjs`
- Frontend integration tests under the current frontend directory.
- Device tools compile check with `python3 -m py_compile device/tools/*.py`.
