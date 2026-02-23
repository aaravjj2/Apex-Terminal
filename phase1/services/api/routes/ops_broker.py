"""
Phase E — Alpaca Paper Broker Gateway
Official Alpaca paper endpoints ONLY. No custom paper broker simulation.
All endpoints return JSON always (including failures).
"""
from __future__ import annotations

import os
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx
import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/broker", tags=["broker-alpaca"])
logger = structlog.get_logger(__name__)

_ALPACA_PAPER_BASE = "https://paper-api.alpaca.markets"
_ALPACA_DATA_BASE = "https://data.alpaca.markets"

# ── State tracking ────────────────────────────────────────────────────
_last_sync: float = 0.0
_last_error: str = ""


def _headers() -> dict:
    key_id = os.environ.get("APCA_API_KEY_ID", "")
    secret = os.environ.get("APCA_API_SECRET_KEY", "")
    return {
        "APCA-API-KEY-ID": key_id,
        "APCA-API-SECRET-KEY": secret,
        "Content-Type": "application/json",
    }


def _cid() -> str:
    return str(uuid.uuid4())


def _is_configured() -> bool:
    return bool(os.environ.get("APCA_API_KEY_ID")) and bool(os.environ.get("APCA_API_SECRET_KEY"))


async def _alpaca_get(path: str, correlation_id: str) -> dict:
    """GET from Alpaca paper API. Always returns dict or raises."""
    global _last_sync, _last_error
    url = f"{_ALPACA_PAPER_BASE}{path}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(url, headers=_headers())
        _last_sync = time.time()
        if r.status_code >= 400:
            _last_error = f"HTTP {r.status_code}: {r.text[:200]}"
            return {
                "ok": False,
                "code": f"ALPACA_{r.status_code}",
                "message": r.text[:500],
                "correlation_id": correlation_id,
                "details": None,
            }
        return r.json()
    except Exception as e:
        _last_error = str(e)
        return {
            "ok": False,
            "code": "ALPACA_NETWORK_ERROR",
            "message": str(e),
            "correlation_id": correlation_id,
            "details": None,
        }


async def _alpaca_post(path: str, body: dict, correlation_id: str) -> dict:
    """POST to Alpaca paper API. Always returns dict."""
    global _last_sync, _last_error
    url = f"{_ALPACA_PAPER_BASE}{path}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(url, headers=_headers(), json=body)
        _last_sync = time.time()
        if r.status_code >= 400:
            _last_error = f"HTTP {r.status_code}: {r.text[:200]}"
            return {
                "ok": False,
                "code": f"ALPACA_{r.status_code}",
                "message": r.text[:500],
                "correlation_id": correlation_id,
                "details": None,
            }
        return r.json()
    except Exception as e:
        _last_error = str(e)
        return {
            "ok": False,
            "code": "ALPACA_NETWORK_ERROR",
            "message": str(e),
            "correlation_id": correlation_id,
            "details": None,
        }


# ── Health ─────────────────────────────────────────────────────────────

@router.get("/health")
async def broker_health():
    """Alpaca paper broker health check. Always returns JSON."""
    cid = _cid()
    if not _is_configured():
        return {
            "ok": False,
            "connected": False,
            "code": "NOT_CONFIGURED",
            "message": "APCA_API_KEY_ID / APCA_API_SECRET_KEY not set",
            "correlation_id": cid,
            "account_status": None,
            "last_sync": None,
            "staleness_s": None,
            "last_error": _last_error or None,
        }

    data = await _alpaca_get("/v2/account", cid)
    if isinstance(data, dict) and data.get("ok") is False:
        return {
            "ok": False,
            "connected": False,
            "correlation_id": cid,
            "account_status": None,
            "last_sync": _last_sync,
            "staleness_s": time.time() - _last_sync if _last_sync else None,
            "last_error": data.get("message"),
            **{k: v for k, v in data.items() if k not in ("ok",)},
        }

    return {
        "ok": True,
        "connected": True,
        "correlation_id": cid,
        "account_status": data.get("status", "unknown"),
        "account_id": data.get("id"),
        "buying_power": data.get("buying_power"),
        "cash": data.get("cash"),
        "portfolio_value": data.get("portfolio_value"),
        "last_sync": _last_sync,
        "staleness_s": round(time.time() - _last_sync, 1) if _last_sync else 0,
        "last_error": None,
    }


# ── Account ────────────────────────────────────────────────────────────

@router.get("/account")
async def broker_account():
    """Full Alpaca paper account info."""
    cid = _cid()
    if not _is_configured():
        return {"ok": False, "code": "NOT_CONFIGURED", "message": "Alpaca keys not set", "correlation_id": cid}
    data = await _alpaca_get("/v2/account", cid)
    if isinstance(data, dict) and data.get("ok") is False:
        return data
    return {"ok": True, "correlation_id": cid, "account": data}


# ── Orders ─────────────────────────────────────────────────────────────

class PlaceOrderRequest(BaseModel):
    symbol: str
    side: str  # "buy" or "sell"
    qty: float = 1
    type: str = "limit"  # market, limit, stop, stop_limit
    time_in_force: str = "day"  # day, gtc, ioc, fok
    limit_price: Optional[float] = None


@router.get("/orders")
async def broker_orders():
    """List Alpaca paper orders."""
    cid = _cid()
    if not _is_configured():
        return {"ok": False, "code": "NOT_CONFIGURED", "message": "Alpaca keys not set", "correlation_id": cid}
    data = await _alpaca_get("/v2/orders?status=all&limit=50", cid)
    if isinstance(data, dict) and data.get("ok") is False:
        return data
    # data is a list
    orders = data if isinstance(data, list) else []
    return {"ok": True, "correlation_id": cid, "orders": orders, "total": len(orders)}


@router.post("/orders")
async def broker_place_order(req: PlaceOrderRequest):
    """Place an Alpaca paper order. Safe for paper account."""
    cid = _cid()
    if not _is_configured():
        return {"ok": False, "code": "NOT_CONFIGURED", "message": "Alpaca keys not set", "correlation_id": cid}
    body = {
        "symbol": req.symbol.upper(),
        "side": req.side,
        "qty": str(req.qty),
        "type": req.type,
        "time_in_force": req.time_in_force,
    }
    if req.limit_price is not None:
        body["limit_price"] = str(req.limit_price)
    data = await _alpaca_post("/v2/orders", body, cid)
    if isinstance(data, dict) and data.get("ok") is False:
        return data
    return {"ok": True, "correlation_id": cid, "order": data}


# ── Positions ──────────────────────────────────────────────────────────

@router.get("/positions")
async def broker_positions():
    """List Alpaca paper positions."""
    cid = _cid()
    if not _is_configured():
        return {"ok": False, "code": "NOT_CONFIGURED", "message": "Alpaca keys not set", "correlation_id": cid}
    data = await _alpaca_get("/v2/positions", cid)
    if isinstance(data, dict) and data.get("ok") is False:
        return data
    positions = data if isinstance(data, list) else []
    return {"ok": True, "correlation_id": cid, "positions": positions, "total": len(positions)}
