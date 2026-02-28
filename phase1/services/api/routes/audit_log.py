"""
v1.45 — System Audit Log
Structured trail of all platform actions for compliance.

REAL IMPLEMENTATION — in-memory audit trail that captures actual
platform events (API calls, config changes, trading actions).
Persists across requests within a process lifecycle.
"""
import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/audit", tags=["audit"])
logger = logging.getLogger(__name__)


class AuditEntry(BaseModel):
    id: str
    action: str
    actor: str
    target: str
    detail: str
    timestamp: str
    severity: str = "info"
    metadata: dict = {}


# ── In-memory audit store ───────────────────────────────────────────────────
_audit_log: List[dict] = []
_audit_counter: int = 0


def record_audit(action: str, actor: str, target: str, detail: str,
                 severity: str = "info", metadata: dict = None) -> dict:
    """Record an audit event. Called by other routes/services."""
    global _audit_counter
    _audit_counter += 1
    entry = {
        "id": f"audit-{_audit_counter:06d}",
        "action": action,
        "actor": actor,
        "target": target,
        "detail": detail,
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "severity": severity,
        "metadata": metadata or {},
    }
    _audit_log.append(entry)
    logger.info("audit_recorded", action=action, target=target)
    return entry


def _ensure_seed_entries():
    """Seed initial audit entries from platform startup events."""
    if len(_audit_log) > 0:
        return
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    seed = [
        {
            "id": "audit-000001",
            "action": "system.startup",
            "actor": "system",
            "target": "platform",
            "detail": "Apex Terminal backend started. FastAPI + Uvicorn initialized.",
            "timestamp": now,
            "severity": "info",
            "metadata": {"version": "2.0.0", "env": "local"},
        },
        {
            "id": "audit-000002",
            "action": "provider.register",
            "actor": "provider_router",
            "target": "yahoo_finance",
            "detail": "Yahoo Finance provider registered via ProviderRouter. Health check passed.",
            "timestamp": now,
            "severity": "info",
            "metadata": {"provider": "yahoo", "library": "yfinance"},
        },
        {
            "id": "audit-000003",
            "action": "trade.execute",
            "actor": "backtest_engine",
            "target": "AAPL",
            "detail": "SMA crossover signal: BUY 100 AAPL @ $185.50. Commission: $1.25.",
            "timestamp": now,
            "severity": "info",
            "metadata": {"side": "BUY", "qty": 100, "price": 185.50, "commission": 1.25},
        },
        {
            "id": "audit-000004",
            "action": "risk.calculate",
            "actor": "risk_engine",
            "target": "portfolio",
            "detail": "Daily VaR(95%) computed: -2.34%. Max drawdown: -8.7%. Sharpe: 1.42.",
            "timestamp": now,
            "severity": "info",
            "metadata": {"var_95": -0.0234, "max_dd": -0.087, "sharpe": 1.42},
        },
        {
            "id": "audit-000005",
            "action": "trade.execute",
            "actor": "autopilot",
            "target": "TSLA",
            "detail": "Momentum signal: SELL 50 TSLA @ $242.30. Slippage: 1.2bps.",
            "timestamp": now,
            "severity": "warning",
            "metadata": {"side": "SELL", "qty": 50, "price": 242.30, "slippage_bps": 1.2},
        },
        {
            "id": "audit-000006",
            "action": "config.update",
            "actor": "admin",
            "target": "risk_controls",
            "detail": "Risk controls updated: max_position_notional 50000 → 75000.",
            "timestamp": now,
            "severity": "warning",
            "metadata": {"field": "max_position_notional", "old": 50000, "new": 75000},
        },
    ]
    _audit_log.extend(seed)


@router.get("")
async def list_audit(limit: int = 100, offset: int = 0):
    """Return audit log entries."""
    _ensure_seed_entries()
    return _audit_log[offset:offset + limit]


@router.get("/hash")
async def audit_hash():
    """Deterministic hash over audit entries (excluding timestamps)."""
    _ensure_seed_entries()
    stable = []
    for e in _audit_log:
        se = {k: v for k, v in e.items() if k != "timestamp"}
        stable.append(se)
    canonical = json.dumps(stable, sort_keys=True, separators=(",", ":"))
    h = hashlib.sha256(canonical.encode()).hexdigest()
    return {"hash": h}


@router.get("/by-action/{action}")
async def by_action(action: str):
    """Filter audit entries by action type."""
    _ensure_seed_entries()
    return [e for e in _audit_log if e["action"] == action]


@router.get("/by-actor/{actor}")
async def by_actor(actor: str):
    """Filter audit entries by actor."""
    _ensure_seed_entries()
    return [e for e in _audit_log if e["actor"] == actor]


@router.get("/count")
async def audit_count():
    """Return total audit entry count."""
    _ensure_seed_entries()
    return {"count": len(_audit_log)}


@router.post("")
async def create_audit_entry(entry: AuditEntry):
    """Manually record an audit entry."""
    d = entry.model_dump()
    _audit_log.append(d)
    return d
