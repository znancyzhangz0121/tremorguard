#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/bin:$PATH"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.omx/run"
overall_status=0

print_pid_status() {
  local name="$1"
  local pid_file="$2"
  local port="$3"

  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file")"
    if kill -0 "$pid" >/dev/null 2>&1; then
      echo "$name: running (pid $pid)"
      return 0
    fi
  fi

  local listeners
  listeners="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"

  if [[ -n "$listeners" ]]; then
    echo "$name: running (port $port listener $listeners)"
  else
    echo "$name: not running"
    return 1
  fi
}

print_url_status() {
  local label="$1"
  local url="$2"

  if curl -fsS "$url" >/dev/null 2>&1; then
    echo "$label URL: healthy ($url)"
    return 0
  else
    echo "$label URL: unavailable ($url)"
    return 1
  fi
}

print_pid_status "Backend" "$RUN_DIR/backend.pid" 3000 || overall_status=1
print_pid_status "Frontend" "$RUN_DIR/frontend.pid" 5173 || overall_status=1
print_url_status "Backend" "http://localhost:3000/api/health" || overall_status=1
print_url_status "Frontend" "http://localhost:5173/" || overall_status=1

if [[ "$overall_status" -eq 0 ]]; then
  echo "Overall: healthy"
else
  echo "Overall: degraded"
fi

exit "$overall_status"
