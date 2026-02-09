#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# scripts/run_risk_desk_demo.sh
#
# Single-command demo for Week 1 Risk Desk.
# Starts backend (mock mode) + frontend, opens browser.
# ──────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
    echo "Shutting down…"
    [[ -n "$BACKEND_PID" ]] && kill "$BACKEND_PID" 2>/dev/null || true
    [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
    wait 2>/dev/null
}
trap cleanup EXIT

echo "═══════════════════════════════════════════"
echo "  Risk Desk Demo — Week 1"
echo "═══════════════════════════════════════════"

# ── 1) Backend ──────────────────────────────────────────────
echo "▶ Starting backend (mock mode, port 8000)…"
cd "$ROOT/phase1"
E2E_MODE=1 python3 -m uvicorn services.api.main:app \
    --host 0.0.0.0 --port 8000 --log-level warning &
BACKEND_PID=$!

# Wait for backend health
for i in $(seq 1 30); do
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        echo "  ✓ Backend healthy"
        break
    fi
    sleep 1
done

# ── 2) Frontend ─────────────────────────────────────────────
echo "▶ Starting frontend (port 5100)…"
cd "$ROOT/frontend"
npx vite --port 5100 --host 0.0.0.0 &
FRONTEND_PID=$!

# Wait for frontend
for i in $(seq 1 30); do
    if curl -sf http://localhost:5100 > /dev/null 2>&1; then
        echo "  ✓ Frontend ready"
        break
    fi
    sleep 1
done

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ Demo running!"
echo ""
echo "  Frontend:  http://localhost:5100"
echo "  API Docs:  http://localhost:8000/docs"
echo ""
echo "  → Navigate to Options → Risk Desk tab"
echo "  → Click 'Load Demo Portfolio'"
echo "  → Click 'Validate'"
echo ""
echo "  Press Ctrl+C to stop."
echo "═══════════════════════════════════════════"

wait
