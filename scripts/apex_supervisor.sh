#!/bin/bash
# Apex Terminal supervisor — keeps backend alive with crash-loop backoff.
# Usage: bash scripts/apex_supervisor.sh [port]
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-${APEX_BACKEND_PORT:-8001}}"
LOG="$ROOT/apex-backend.log"
PIDFILE="$ROOT/.apex-backend.pid"
PYBIN="$ROOT/phase1/venv/bin/python"

if [ ! -x "$PYBIN" ]; then
  echo "venv missing — run scripts/launch_apex.sh first" >&2
  exit 1
fi

# Ignore HUP from parent shell — we want to keep running.
trap '' HUP
trap 'echo "[supervisor] shutting down"; [ -n "${CHILD:-}" ] && kill "$CHILD" 2>/dev/null; exit 0' INT TERM

backoff=1
while true; do
  echo "[supervisor] starting uvicorn on :$PORT" | tee -a "$LOG"
  "$PYBIN" -m uvicorn services.api.main:app \
    --host 0.0.0.0 --port "$PORT" \
    --app-dir "$ROOT/phase1" \
    --workers 1 \
    --timeout-keep-alive 30 \
    --log-level info \
    >> "$LOG" 2>&1 &
  CHILD=$!
  echo "$CHILD" > "$PIDFILE"
  wait "$CHILD"
  ec=$?
  echo "[supervisor] uvicorn exited code=$ec — restarting in ${backoff}s" | tee -a "$LOG"
  sleep "$backoff"
  backoff=$(( backoff < 30 ? backoff * 2 : 30 ))
done
