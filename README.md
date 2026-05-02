# Tremor Guard Workspace

## Local Startup

Install the FastAPI backend dependencies once:

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python -m app.seed_demo
```

Then use the workspace root scripts:

```bash
npm run site:up
```

Useful commands:

```bash
npm run site:status
npm run site:down
npm run site:restart
```

## Local URLs

- Frontend: `http://localhost:5173/`
- Backend docs: `http://localhost:3000/docs`
- Backend health: `http://localhost:3000/api/health`

## Demo Account

- Email: `demo@tremorguard.local`
- Password: `Demo123456`

The demo account is the only allowed seeded business data. Non-demo users start with no device, no monitoring records, no medication records, and no reports.

## Device Tooling

ESP32 + MPU6050 firmware and upload verification tools live under `device/`.

## Logs

Logs are written to:

- `.omx/logs/backend.log`
- `.omx/logs/frontend.log`
