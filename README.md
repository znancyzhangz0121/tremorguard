# Tremor Guard Workspace

## Local startup

Use the workspace root so you can start or stop both frontend and backend together.
These scripts build the apps first and then run stable local servers:

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

## Logs

Logs are written to:

- `.omx/logs/backend.log`
- `.omx/logs/frontend.log`
