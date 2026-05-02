# No-Mock-Data Validation

This project must not ship runtime mock data. Production-facing backend and frontend code should render persisted API/database state only. The only allowed seeded data is the explicit demo account/data created by `backend/scripts/seed-demo.ts`.

## Static Validation

Run from the repository root:

```bash
node scripts/validate-no-mock-data.mjs
```

The validator scans runtime source and bundled data locations:

- `backend/app`
- `backend/alembic`
- `backend/src`
- `backend/data`
- `backend/scripts`
- `device`
- `tremor-guard-frontend/src`
- `tremor-guard-frontend/api`
- `tremor-guard-frontend/scripts`
- `tremor-guard-frontend_Claude Design/src`
- `tremor-guard-frontend_Claude Design/api`
- `tremor-guard-frontend_Claude Design/scripts`

The validator intentionally does not scan docs, tests, dependency folders, build output, or process logs. Test doubles and fixtures belong in test-only files; explanatory wording belongs in documents.

The scan fails on:

- runtime `mock`, `fake`, `dummy`, `fixture`, or `sample` data markers
- Chinese equivalents for simulated, fake, placeholder, or sample data
- legacy test identities such as `test-user-YYYYMMDD@example.com`, `name@test.com`, and `Nancy Zhang`
- generic hard-coded device serials or verification codes such as `123456`, `000000`, `111111`, and `654321`
- demo account/device seed values outside the demo seed allowlist

## Demo Seed Allowlist

Allowed demo values are limited to `backend/scripts/seed-demo.ts`.

Permitted values there:

- `demo@tremorguard.local`
- `Demo123456`
- `TG-DEMO-001`
- `888888`
- `演示账号`
- `演示震颤卫士手环`

Rules for the demo seed:

- It must be opt-in through the documented seed command.
- It must be idempotent and safe to rerun.
- It must not be imported by backend services at runtime.
- It must not be copied into `backend/data`, frontend state, API fallbacks, migrations, or default service responses.

## Acceptance Checklist

### Empty User

- Start from a migrated database without running the demo seed.
- Create a new account through the normal registration path.
- Confirm the dashboard shows empty or zero-state summaries, not fabricated tremor trends, medication records, devices, AI conversations, reports, or medical archives.
- Confirm device pages show no bound device until the user binds one.
- Confirm report and archive pages show no uploaded files until the user uploads files.
- Confirm API responses return empty arrays, `null`, or explicit zero counts for missing user data instead of generated records.

### Demo User

- Run only the explicit demo seed command.
- Log in as `demo@tremorguard.local`.
- Confirm the seeded user, device binding, tremor features, and medication records match `backend/scripts/seed-demo.ts`.
- Confirm rerunning the seed replaces same-day demo tremor and medication rows instead of duplicating them.
- Confirm no additional bundled users, devices, records, or reports are created.
- Confirm demo data is visually usable for demos but clearly isolated from normal user creation and device upload flows.

### Device Upload

- Create a non-demo user in a clean database.
- Bind a device using a non-generic serial number and verification code.
- Upload medical/device archive files through the supported UI or API path.
- Confirm the uploaded file metadata and generated records belong only to that user.
- Confirm dashboard, report, and archive views derive from persisted upload/device data.
- Confirm disconnecting or unbinding a device does not reveal demo data or fallback records.
- Confirm static validation still passes after the upload flow implementation.
