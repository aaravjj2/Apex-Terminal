"""
Wave 9 — Kill Switch Recovery
Auto-recovery logic for kill switch with configurable cool-down.
"""
import hashlib
import json
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/kill-switch-recovery", tags=["kill-switch-recovery"])


class RecoveryConfig(BaseModel):
    cooldown_minutes: int = 30
    max_daily_activations: int = 3
    auto_recover: bool = True
    require_manual_override: bool = False


class RecoveryEvent(BaseModel):
    event_id: str
    timestamp: str
    action: str  # activated / deactivated / auto-recovered / manual-override
    reason: str
    cooldown_remaining_sec: int


class RecoveryStatus(BaseModel):
    kill_switch_active: bool
    auto_recover_enabled: bool
    activations_today: int
    max_activations: int
    cooldown_minutes: int
    last_activation: Optional[str]
    next_auto_recovery: Optional[str]
    can_auto_recover: bool
    events: List[RecoveryEvent]


DEMO_EVENTS: List[dict] = [
    {"event_id": "ks-evt-001", "timestamp": "2026-01-16T09:45:00Z", "action": "activated", "reason": "Daily loss cap reached (-$150)", "cooldown_remaining_sec": 0},
    {"event_id": "ks-evt-002", "timestamp": "2026-01-16T10:15:00Z", "action": "auto-recovered", "reason": "Cooldown expired, conditions normalized", "cooldown_remaining_sec": 0},
    {"event_id": "ks-evt-003", "timestamp": "2026-01-16T11:30:00Z", "action": "activated", "reason": "Consecutive loss limit (3 losses)", "cooldown_remaining_sec": 900},
    {"event_id": "ks-evt-004", "timestamp": "2026-01-16T12:00:00Z", "action": "auto-recovered", "reason": "Cooldown expired", "cooldown_remaining_sec": 0},
    {"event_id": "ks-evt-005", "timestamp": "2026-01-16T14:00:00Z", "action": "activated", "reason": "VIX spike > 30", "cooldown_remaining_sec": 1800},
]


@router.get("/status")
async def recovery_status():
    return RecoveryStatus(
        kill_switch_active=True,
        auto_recover_enabled=True,
        activations_today=3,
        max_activations=3,
        cooldown_minutes=30,
        last_activation="2026-01-16T14:00:00Z",
        next_auto_recovery="2026-01-16T14:30:00Z",
        can_auto_recover=False,  # max activations reached
        events=[RecoveryEvent(**e) for e in DEMO_EVENTS],
    ).model_dump()


@router.get("/config")
async def get_recovery_config():
    return RecoveryConfig().model_dump()


@router.post("/config")
async def update_recovery_config(config: RecoveryConfig):
    return {"status": "updated", "config": config.model_dump()}


@router.post("/manual-override")
async def manual_override():
    return {
        "status": "overridden",
        "kill_switch_active": False,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "message": "Kill switch manually deactivated. Cooldown and activation counters reset.",
    }


@router.get("/events")
async def list_events(limit: int = 20):
    return {"events": DEMO_EVENTS[:limit], "total": len(DEMO_EVENTS)}


@router.get("/hash")
async def recovery_hash():
    canonical = json.dumps(DEMO_EVENTS, sort_keys=True, separators=(",", ":"))
    return {"hash": hashlib.sha256(canonical.encode()).hexdigest()}
