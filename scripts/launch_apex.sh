#!/bin/bash
# Launch Apex Terminal (backend + frontend) with automatic port selection.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ── Pick backend port (8000 if free, else 8001) ───────────────────────────────
pick_backend_port() {
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 1 "http://localhost:8000/" 2>/dev/null || echo "000")
  if [ "$code" = "000" ]; then
    echo 8000
    return
  fi
  # Port in use — check if it's Apex
  if curl -s --max-time 1 "http://localhost:8000/" 2>/dev/null | grep -q "Apex Terminal"; then
    echo 8000
    return
  fi
  echo 8001
}

BACKEND_PORT="${APEX_BACKEND_PORT:-$(pick_backend_port)}"
export APEX_BACKEND_PORT="$BACKEND_PORT"

echo "============================================"
echo "  Apex Terminal — full stack launch"
echo "  Backend port: $BACKEND_PORT"
echo "============================================"

# ── keys.env ──────────────────────────────────────────────────────────────────
if [ -f "$ROOT/keys.env" ] && [ ! -f "$ROOT/phase1/keys.env" ]; then
  ln -sf "$ROOT/keys.env" "$ROOT/phase1/keys.env"
  echo "Linked keys.env → phase1/keys.env"
fi

# ── Python venv + deps ────────────────────────────────────────────────────────
cd "$ROOT/phase1"
if [ ! -d "venv" ]; then
  echo "Creating Python venv..."
  python3 -m venv venv
fi
# shellcheck disable=SC1091
source venv/bin/activate
pip install -q -r requirements.txt

# ── Start backend via supervisor (auto-restart, no reload thrash) ────────────
if curl -s --max-time 1 "http://localhost:$BACKEND_PORT/health" 2>/dev/null | grep -qE 'healthy|degraded|Apex'; then
  echo "Backend already running on :$BACKEND_PORT"
else
  echo "Starting backend supervisor on :$BACKEND_PORT..."
  python3 - <<PY
import subprocess
subprocess.Popen(
    ['bash', '$ROOT/scripts/apex_supervisor.sh', '$BACKEND_PORT'],
    stdin=subprocess.DEVNULL,
    stdout=open('$ROOT/apex-supervisor.log', 'a'),
    stderr=subprocess.STDOUT,
    start_new_session=True, close_fds=True,
)
PY
  for i in $(seq 1 40); do
    if curl -s --max-time 2 "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
      echo "Backend ready."
      break
    fi
    sleep 1
  done
fi

# ── Frontend ──────────────────────────────────────────────────────────────────
cd "$ROOT/frontend"
if [ ! -d "node_modules" ]; then
  echo "Installing frontend dependencies..."
  npm install
fi

export APEX_BACKEND_PORT="$BACKEND_PORT"
echo ""
echo "============================================"
echo "  ✅ Apex Terminal"
echo "============================================"
echo "  UI:       http://localhost:5100/ui2/dashboard"
echo "  API:      http://localhost:$BACKEND_PORT"
echo "  API docs: http://localhost:$BACKEND_PORT/docs"
echo "  Logs:     $ROOT/apex-backend.log"
echo "============================================"
echo ""

npm run dev
