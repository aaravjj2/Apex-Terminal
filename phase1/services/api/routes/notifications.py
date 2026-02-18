"""
v1.44 — Notifications Center (DEMO-first)
Unified notification feed across all subsystems.
"""
import hashlib
import json
from typing import List
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])

DEMO_NOTIFICATIONS: List[dict] = [
    {
        "id": "notif-001",
        "type": "trade",
        "severity": "info",
        "title": "Trade Executed",
        "message": "AAPL 170C filled at $5.20 (paper)",
        "source": "autopilot",
        "read": False,
        "timestamp": "2025-01-15T09:30:00Z",
    },
    {
        "id": "notif-002",
        "type": "risk",
        "severity": "warning",
        "title": "Risk Limit Approaching",
        "message": "Portfolio delta exposure at 85% of limit",
        "source": "risk_desk",
        "read": False,
        "timestamp": "2025-01-15T10:15:00Z",
    },
    {
        "id": "notif-003",
        "type": "system",
        "severity": "info",
        "title": "Backtest Completed",
        "message": "SMA Crossover backtest finished: Sharpe 1.45",
        "source": "backtest",
        "read": True,
        "timestamp": "2025-01-15T11:00:00Z",
    },
    {
        "id": "notif-004",
        "type": "alert",
        "severity": "critical",
        "title": "Kill Switch Triggered",
        "message": "Emergency stop activated by user",
        "source": "autopilot",
        "read": True,
        "timestamp": "2025-01-15T14:30:00Z",
    },
    {
        "id": "notif-005",
        "type": "system",
        "severity": "info",
        "title": "Strategy Validated",
        "message": "Iron Condor template passed schema validation",
        "source": "strategy_lab",
        "read": False,
        "timestamp": "2025-01-15T15:00:00Z",
    },
]


@router.get("")
async def list_notifications():
    """Return all demo notifications."""
    return DEMO_NOTIFICATIONS


@router.get("/hash")
async def notifications_hash():
    """Determinism hash."""
    canonical = json.dumps(DEMO_NOTIFICATIONS, sort_keys=True, separators=(",", ":"))
    h = hashlib.sha256(canonical.encode()).hexdigest()
    return {"hash": h}


@router.get("/unread")
async def unread_count():
    """Return count of unread notifications."""
    count = sum(1 for n in DEMO_NOTIFICATIONS if not n["read"])
    return {"unread": count}


@router.get("/by-type/{notif_type}")
async def get_by_type(notif_type: str):
    """Filter notifications by type."""
    return [n for n in DEMO_NOTIFICATIONS if n["type"] == notif_type]


@router.get("/by-severity/{severity}")
async def get_by_severity(severity: str):
    """Filter notifications by severity."""
    return [n for n in DEMO_NOTIFICATIONS if n["severity"] == severity]
