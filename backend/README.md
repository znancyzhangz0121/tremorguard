# TremorGuard FastAPI Backend

## Local setup

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python -m app.seed_demo
uvicorn app.main:app --host 0.0.0.0 --port 3000
```

The API is mounted under `/api`; OpenAPI is available through FastAPI at `/docs`.

Only the demo seed may create demo data. Non-demo users start from an empty state until they complete onboarding, bind a provisioned device, and receive real device telemetry.
