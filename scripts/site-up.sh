#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/bin:$PATH"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.omx/run"
LOG_DIR="$ROOT_DIR/.omx/logs"

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
  npm run build > "$LOG_DIR/backend-build.log" 2>&1
)

echo "Building frontend..."
(
  cd "$ROOT_DIR/tremor-guard-frontend"
  npm run build > "$LOG_DIR/frontend-build.log" 2>&1
)

nohup bash -lc "cd '$ROOT_DIR/backend' && exec /usr/local/bin/node dist/main.js" \
  > "$LOG_DIR/backend.log" 2>&1 < /dev/null &
echo $! > "$RUN_DIR/backend.pid"

nohup bash -lc "cd '$ROOT_DIR/tremor-guard-frontend' && exec /usr/local/bin/node node_modules/vite/bin/vite.js preview --host 0.0.0.0 --port 5173 --strictPort" \
  > "$LOG_DIR/frontend.log" 2>&1 < /dev/null &
echo $! > "$RUN_DIR/frontend.pid"

wait_for_url "http://localhost:3000/api/health" "Backend"
wait_for_url "http://localhost:5173/" "Frontend"

echo "Frontend: http://localhost:5173/"
echo "Backend docs: http://localhost:3000/docs"
