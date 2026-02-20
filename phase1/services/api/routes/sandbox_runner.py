"""Wave 7 — Sandbox Runner: deterministic agent simulation producing events."""
import hashlib, json
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/sandbox-runner", tags=["sandbox-runner"])

DEMO_EVENTS: list = [
    {"event_id": "se-001", "seq": 1, "type": "agent_start",     "agent_id": "arb_v1", "payload": {"mode": "sandbox", "capital": 100000}, "timestamp": "2026-01-16T09:30:00.000Z"},
    {"event_id": "se-002", "seq": 2, "type": "scan_complete",   "agent_id": "arb_v1", "payload": {"candidates": 45, "filtered": 8},       "timestamp": "2026-01-16T09:30:01.120Z"},
    {"event_id": "se-003", "seq": 3, "type": "signal_generated","agent_id": "arb_v1", "payload": {"symbol": "AAPL", "action": "BUY", "confidence": 0.87}, "timestamp": "2026-01-16T09:30:02.340Z"},
    {"event_id": "se-004", "seq": 4, "type": "risk_check",      "agent_id": "arb_v1", "payload": {"passed": True, "checks": ["position_size", "var", "sector"]}, "timestamp": "2026-01-16T09:30:02.500Z"},
    {"event_id": "se-005", "seq": 5, "type": "order_simulated", "agent_id": "arb_v1", "payload": {"symbol": "AAPL", "qty": 50, "price": 190.25, "total": 9512.50}, "timestamp": "2026-01-16T09:30:02.900Z"},
    {"event_id": "se-006", "seq": 6, "type": "signal_generated","agent_id": "arb_v1", "payload": {"symbol": "MSFT", "action": "BUY", "confidence": 0.79}, "timestamp": "2026-01-16T09:30:04.100Z"},
    {"event_id": "se-007", "seq": 7, "type": "order_simulated", "agent_id": "arb_v1", "payload": {"symbol": "MSFT", "qty": 30, "price": 421.10, "total": 12633.00}, "timestamp": "2026-01-16T09:30:04.400Z"},
    {"event_id": "se-008", "seq": 8, "type": "cycle_complete",  "agent_id": "arb_v1", "payload": {"orders": 2, "signals": 2, "pnl_sim": 145.20, "duration_ms": 4400}, "timestamp": "2026-01-16T09:30:05.000Z"},
]

def _hash():
    return hashlib.sha256(json.dumps(DEMO_EVENTS, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

DEMO_HASH = _hash()

@router.get("/events")
async def list_events():
    return {"events": DEMO_EVENTS, "count": len(DEMO_EVENTS), "hash": DEMO_HASH}

@router.post("/run")
async def run_agent(body: dict = {}):
    return {"events": DEMO_EVENTS, "hash": DEMO_HASH, "status": "complete", "orders_placed": 2, "signals_generated": 2}

@router.get("/hash")
async def get_hash():
    return {"hash": DEMO_HASH}

@router.get("/status")
async def get_status():
    return {"agent_id": "arb_v1", "mode": "sandbox", "status": "idle", "last_run_events": len(DEMO_EVENTS), "hash": DEMO_HASH}
