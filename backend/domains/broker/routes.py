"""
backend/domains/broker/routes.py
----------------------------------
Broker domain router: /api/v3/broker/*

Provides:
  GET /api/v3/broker/health   – live broker connection health
  GET /api/v3/broker/account  – live account snapshot (redacted)
"""
from __future__ import annotations

from fastapi import APIRouter

from backend.core.startup_checks import check_broker
from backend.core.contracts.common import new_correlation_id, utc_now_ms
from .models import BrokerHealth, BrokerHealthResponse

router = APIRouter(prefix="/api/v3/broker", tags=["broker-v3"])


@router.get("/health", response_model=BrokerHealthResponse)
async def broker_health() -> BrokerHealthResponse:
    """Return live broker connection health with latency."""
    result = await check_broker()
    return BrokerHealthResponse(
        correlation_id=new_correlation_id(),
        checked_at=utc_now_ms(),
        broker=BrokerHealth(
            connected=result.get("connected", False),
            latency_ms=result.get("latency_ms", 0.0),
            error=result.get("error"),
            account_status=result.get("account_status"),
            account_number=result.get("account_number"),
            trading_blocked=result.get("trading_blocked"),
            cash=result.get("cash"),
        ),
    )


@router.get("/account")
async def broker_account() -> dict:
    """Return redacted live account snapshot (no keys, no PII beyond account number)."""
    result = await check_broker()
    if not result.get("connected"):
        return {
            "connected": False,
            "error": result.get("error", "Broker unreachable"),
        }
    acct = result.get("account_number") or ""
    redacted_acct = ("***" + acct[-4:]) if len(acct) > 4 else "***REDACTED***"
    return {
        "connected": True,
        "account_number": redacted_acct,
        "account_status": result.get("account_status"),
        "trading_blocked": result.get("trading_blocked"),
        # Redact exact cash; expose only whether funded
        "funded": (result.get("cash") or 0) > 0,
    }
