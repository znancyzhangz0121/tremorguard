#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/bin:$PATH"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$ROOT_DIR/scripts/site-down.sh"
"$ROOT_DIR/scripts/site-up.sh"
