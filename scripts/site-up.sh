#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/bin:$PATH"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.omx/run"
LOG_DIR="$ROOT_DIR/.omx/logs"
NODE_BIN="$(command -v node)"
PYTHON_BIN="${PYTHON_BIN:-python3}"
FRONTEND_DIR="${FRONTEND_DIR:-tremor-guard-frontend}"
if [[ -x "$ROOT_DIR/backend/.venv/bin/python" && "${PYTHON_BIN}" == "python3" ]]; then
  PYTHON_BIN="$ROOT_DIR/backend/.venv/bin/python"
fi

mkdir -p "$RUN_DIR" "$LOG_DIR"

kill_port_listener() {
  local port="$1"
  local pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"

  if [[ -n "$pids" ]]; then
    echo "$pids" | xargs kill >/dev/null 2>&1 || true
  fi
}

wait_for_url() {
  local url="$1"
  local label="$2"

  for _ in {1..30}; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "$label is ready at $url"
      return 0
    fi
    sleep 1
  done

  echo "Timed out waiting for $label at $url" >&2
  return 1
}

kill_port_listener 3000
kill_port_listener 5173

echo "Building backend..."
(
  cd "$ROOT_DIR/backend"
  "$PYTHON_BIN" -m py_compile app/*.py > "$LOG_DIR/backend-build.log" 2>&1
)

echo "Building frontend..."
(
  cd "$ROOT_DIR/$FRONTEND_DIR"
  npm run build > "$LOG_DIR/frontend-build.log" 2>&1
)

nohup bash -lc "cd '$ROOT_DIR/backend' && exec '$PYTHON_BIN' -m uvicorn app.main:app --host 0.0.0.0 --port 3000" \
  > "$LOG_DIR/backend.log" 2>&1 < /dev/null &
echo $! > "$RUN_DIR/backend.pid"

nohup bash -lc "cd '$ROOT_DIR/$FRONTEND_DIR' && exec '$NODE_BIN' node_modules/vite/bin/vite.js preview --host 0.0.0.0 --port 5173 --strictPort" \
  > "$LOG_DIR/frontend.log" 2>&1 < /dev/null &
echo $! > "$RUN_DIR/frontend.pid"

wait_for_url "http://localhost:3000/api/health" "Backend"
wait_for_url "http://localhost:5173/" "Frontend"

echo "Frontend: http://localhost:5173/"
echo "Backend docs: http://localhost:3000/docs"
