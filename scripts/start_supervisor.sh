#!/bin/bash
# Detach the supervisor from the calling shell so it survives logout/reload.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-8001}"
mkdir -p "$ROOT/logs" 2>/dev/null
exec >> "$ROOT/apex-supervisor.log" 2>&1
exec </dev/null
nohup setsid bash "$ROOT/scripts/apex_supervisor.sh" "$PORT" &
disown
echo "[start_supervisor] launched supervisor (pid $!) on :$PORT"
