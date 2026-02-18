"""
v1.45 — System Audit Log (DEMO-first)
Structured trail of all platform actions for compliance.
"""
import hashlib
import json
from typing import List
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/audit", tags=["audit"])

DEMO_AUDIT_ENTRIES: List[dict] = [
    {
        "id": "audit-001",
        "action": "trade.execute",
        "actor": "autopilot",
        "target": "AAPL 170C 2025-03-21",
        "detail": "Filled 2 contracts at $5.20",
        "ip": "127.0.0.1",
        "timestamp": "2025-01-15T09:30:00Z",
    },
    {
        "id": "audit-002",
        "action": "kill_switch.activate",
        "actor": "user:admin",
        "target": "autopilot",
        "detail": "Emergency stop — all open orders cancelled",
        "ip": "127.0.0.1",
        "timestamp": "2025-01-15T09:45:00Z",
    },
    {
        "id": "audit-003",
        "action": "strategy.create",
        "actor": "user:admin",
        "target": "SMA Crossover v2",
        "detail": "New strategy template saved",
        "ip": "127.0.0.1",
        "timestamp": "2025-01-15T10:00:00Z",
    },
    {
        "id": "audit-004",
        "action": "backtest.start",
        "actor": "user:admin",
        "target": "Iron Condor — SPY",
        "detail": "Backtest queued with 365-day window",
        "ip": "127.0.0.1",
        "timestamp": "2025-01-15T10:30:00Z",
    },
    {
        "id": "audit-005",
        "action": "settings.update",
        "actor": "user:admin",
        "target": "risk_limits",
        "detail": "Max delta updated from 50 to 60",
        "ip": "127.0.0.1",
        "timestamp": "2025-01-15T11:00:00Z",
    },
    {
        "id": "audit-006",
        "action": "agent.deploy",
        "actor": "user:admin",
        "target": "Momentum Scanner v1",
        "detail": "Agent deployed to production sandbox",
        "ip": "127.0.0.1",
        "timestamp": "2025-01-15T11:30:00Z",
    },
]


@router.get("")
async def list_audit():
    """Return full audit log."""
    return DEMO_AUDIT_ENTRIES


@router.get("/hash")
async def audit_hash():
    """Determinism hash."""
    canonical = json.dumps(DEMO_AUDIT_ENTRIES, sort_keys=True, separators=(",", ":"))
    h = hashlib.sha256(canonical.encode()).hexdigest()
    return {"hash": h}


@router.get("/by-action/{action}")
async def by_action(action: str):
    """Filter by action type."""
    return [e for e in DEMO_AUDIT_ENTRIES if e["action"] == action]


@router.get("/by-actor/{actor}")
async def by_actor(actor: str):
    """Filter by actor."""
    return [e for e in DEMO_AUDIT_ENTRIES if e["actor"] == actor]


@router.get("/count")
async def audit_count():
    """Total audit entries."""
    return {"count": len(DEMO_AUDIT_ENTRIES)}
