#!/usr/bin/env bash
# Unified Apex dev stack — single frontend (:5100) + phase1 API with TCC routers.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_PORT="${APEX_BACKEND_PORT:-8010}"
DB_PATH="${APEX_DB_PATH:-$ROOT/phase1/data/apex-dev.db}"
mkdir -p "$(dirname "$DB_PATH")"

export PROFILE=dev
export DATABASE_URL="sqlite+aiosqlite:///${DB_PATH}"
export TRADING_ENV=paper
export PAPER_DRY_RUN=true
export DEMO_MODE="${DEMO_MODE:-true}"
export APEX_ARB_SCAN_LOOP="${APEX_ARB_SCAN_LOOP:-true}"
export POLYMARKET_PAPER_TRADING_ENABLED="${POLYMARKET_PAPER_TRADING_ENABLED:-true}"
export SQLITE_PATH="${SQLITE_PATH:-$ROOT/data/audit.db}"
export VIBE_TRADING_CACHE_DIR="${VIBE_TRADING_CACHE_DIR:-/tmp/vibe-trading-cache}"
export AUDIT_LOG_PATH="${AUDIT_LOG_PATH:-/tmp/vibe-trading-audit/cycle_audit.jsonl}"
mkdir -p "$(dirname "$AUDIT_LOG_PATH")"

echo "==> API  http://127.0.0.1:${API_PORT}  (phase1 + TCC)"
echo "==> UI   http://127.0.0.1:5100/ui2/command-center"
echo "    APEX_BACKEND_PORT=${API_PORT}"

cd "$ROOT/phase1"
python -m uvicorn services.api.main:app --host 127.0.0.1 --port "$API_PORT" &
API_PID=$!

cleanup() {
  kill "$API_PID" 2>/dev/null || true
}
trap cleanup EXIT

for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${API_PORT}/health" >/dev/null; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "API failed to start on :${API_PORT} — check logs above"
    exit 1
  fi
  sleep 1
done

cd "$ROOT/frontend"
# HITL_DRY_RUN opens soft window for dev; live prices still come from liveQuoteStore
APEX_BACKEND_PORT="$API_PORT" VITE_HITL_DRY_RUN=true VITE_PIPELINE_JOB_ID=dry-run-apex-command-center npm run dev
