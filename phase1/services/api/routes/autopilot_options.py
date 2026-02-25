"""
Autopilot Options Router — comprehensive API for the options autopilot.

Covers:
  - Phase 0: /api/ops/autopilot/health
  - Phase 1: Options connectivity (chain, quote, orders, positions)
  - Phase 2: Decision brain (run_now, decisions, rejections)
  - Phase 3: LLM narrative/risk
  - Phase 4: Live loop (arm/disarm, run_now, kill switch)
  - Phase 5: Order preview
  - Phase 6: Debug bundle

All responses are valid JSON with correlation_id.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
import uuid
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/autopilot-options", tags=["autopilot-options"])


# ── In-memory state (no demo data — empty on start) ─────────────────────────

_armed: bool = False
_kill_switch: bool = False
_decisions: List[Dict[str, Any]] = []
_rejections: List[Dict[str, Any]] = []
_loop_state: Dict[str, Any] = {
    "last_loop_ts": None,
    "last_decision_id": None,
    "last_error": None,
    "cycles_run": 0,
}

# ── Constants ────────────────────────────────────────────────────────────────

UNIVERSE = ["SPY", "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "TSLA", "GLD", "QQQ"]

RISK_CONTROLS = {
    "max_premium_risk_per_trade_usd": 150.0,
    "max_concurrent_option_positions": 10,
    "max_notional_exposure_usd": 5000.0,
    "max_delta_exposure": 5.0,
    "max_daily_loss_usd": 200.0,
    "min_dte": 14,
    "max_dte": 45,
    "max_spread_width_pct": 0.15,  # 15% bid-ask spread width max
    "min_volume": 10,
    "min_open_interest": 50,
}


def _cid() -> str:
    return f"ap-{uuid.uuid4().hex[:8]}"


# ── Request models ───────────────────────────────────────────────────────────

class ArmRequest(BaseModel):
    armed: bool

class KillSwitchRequest(BaseModel):
    active: bool
    close_all: bool = False

class RunNowRequest(BaseModel):
    symbols: Optional[List[str]] = None
    dry_run: bool = False


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 0 — HEALTH
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/health")
async def autopilot_health():
    """
    Comprehensive autopilot health panel.
    Returns armed state, market session, provider connectivity, loop state.
    """
    cid = _cid()

    # Market session from Alpaca
    market_session = {"status": "unknown", "is_open": False, "next_open": None, "next_close": None}
    alpaca_connected = False
    options_enabled = False
    last_contract_fetch_ts = None
    last_quote_ts = None

    try:
        from ...autopilot.alpaca_client import get_alpaca_client
        client = get_alpaca_client()
        if client.is_connected:
            alpaca_connected = True
            clock = await client.get_clock()
            if clock:
                market_session = {
                    "status": "open" if clock.is_open else "closed",
                    "is_open": clock.is_open,
                    "next_open": clock.next_open.isoformat() if clock.next_open else None,
                    "next_close": clock.next_close.isoformat() if clock.next_close else None,
                }
    except Exception as e:
        logger.debug(f"Health alpaca check: {e}")

    try:
        from ...autopilot.options_gateway import get_options_gateway
        gw = get_options_gateway()
        hc = await gw.health_check()
        options_enabled = hc.get("options_enabled", False)
        last_contract_fetch_ts = gw.last_chain_fetch_ts
        last_quote_ts = gw.last_quote_ts
        if hc.get("connected"):
            alpaca_connected = True
    except Exception as e:
        logger.debug(f"Health options check: {e}")

    return {
        "armed": _armed,
        "kill_switch_active": _kill_switch,
        "market_session": market_session,
        "providers": {
            "alpaca_paper_connected": alpaca_connected,
            "options_enabled": options_enabled,
            "last_contract_fetch_ts": last_contract_fetch_ts,
            "last_quote_ts": last_quote_ts,
        },
        "loop": {
            "last_loop_ts": _loop_state["last_loop_ts"],
            "last_decision_id": _loop_state["last_decision_id"],
            "last_error": _loop_state["last_error"][:100] if _loop_state["last_error"] else None,
            "cycles_run": _loop_state["cycles_run"],
        },
        "risk_controls": RISK_CONTROLS,
        "universe": UNIVERSE,
        "correlation_id": cid,
    }


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 1 — OPTIONS CONNECTIVITY
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/options/chain/{symbol}")
async def get_option_chain(
    symbol: str,
    expiration: Optional[str] = Query(default=None),
    option_type: Optional[str] = Query(default=None),
):
    """Fetch option contracts for an underlying symbol."""
    from ...autopilot.options_gateway import get_options_gateway
    gw = get_options_gateway()
    return await gw.get_option_chain(symbol.upper(), expiration, option_type)


@router.get("/options/quote/{contract_symbol}")
async def get_option_quote(contract_symbol: str):
    """Get latest quote for a specific option contract."""
    from ...autopilot.options_gateway import get_options_gateway
    gw = get_options_gateway()
    return await gw.get_option_quote(contract_symbol)


@router.get("/options/orders")
async def get_option_orders(status: str = Query(default="all")):
    """Fetch option orders from Alpaca."""
    from ...autopilot.options_gateway import get_options_gateway
    gw = get_options_gateway()
    return await gw.list_option_orders(status=status)


@router.get("/options/positions")
async def get_option_positions():
    """Fetch option positions from Alpaca."""
    from ...autopilot.options_gateway import get_options_gateway
    gw = get_options_gateway()
    return await gw.list_option_positions()


@router.get("/options/connectivity")
async def options_connectivity():
    """Options connectivity panel data."""
    cid = _cid()
    from ...autopilot.options_gateway import get_options_gateway
    gw = get_options_gateway()

    hc = await gw.health_check()
    acct = await gw.get_account_info()

    return {
        "paper_base_url": "https://paper-api.alpaca.markets (redacted)",
        "connected": hc.get("connected", False),
        "latency_ms": hc.get("latency_ms", 0),
        "options_enabled": hc.get("options_enabled", False),
        "options_trading_level": acct.get("options_trading_level"),
        "options_buying_power": acct.get("options_buying_power"),
        "equity": acct.get("equity"),
        "last_chain_fetch_ts": gw.last_chain_fetch_ts,
        "last_quote_ts": gw.last_quote_ts,
        "correlation_id": cid,
    }


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2 — AUTOPILOT BRAIN v1 (RULED + EXPLAINABLE)
# ══════════════════════════════════════════════════════════════════════════════

async def _run_decision_cycle(
    symbols: Optional[List[str]] = None,
    submit_orders: bool = False,
) -> Dict[str, Any]:
    """
    Core decision loop. Runs one cycle of the autopilot brain.
    
    Phases:
    1. Check market session
    2. Check kill switch / armed state
    3. Fetch chain + quotes for universe
    4. Compute features (price series, vol, IV)
    5. Apply strategy signal
    6. Select contract (DTE, strike)
    7. Risk gate checks
    8. Generate decision (BUY_CALL / BUY_PUT / EXIT / HOLD / REJECT)
    9. If submit_orders: place order via Alpaca paper
    10. Persist + emit event
    """
    global _loop_state
    cid = _cid()
    decision_id = f"dec-{uuid.uuid4().hex[:10]}"
    t0 = time.monotonic()
    cycle_decisions: List[Dict] = []
    cycle_rejections: List[Dict] = []
    orders_submitted: List[Dict] = []

    universe = [s.upper() for s in (symbols or UNIVERSE[:5])]

    # Phase 1: Market session check
    market_open = False
    try:
        from ...autopilot.alpaca_client import get_alpaca_client
        client = get_alpaca_client()
        clock = await client.get_clock()
        if clock:
            market_open = clock.is_open
    except Exception:
        pass

    if not market_open and submit_orders:
        rej = {
            "decision_id": decision_id,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "action": "REJECT",
            "reason": "market_closed",
            "detail": "Market is closed — no orders submitted. Analysis only.",
            "correlation_id": cid,
        }
        _rejections.append(rej)
        cycle_rejections.append(rej)

    # Phase 2: Kill switch / armed check
    if _kill_switch:
        rej = {
            "decision_id": decision_id,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "action": "REJECT",
            "reason": "kill_switch_active",
            "detail": "Kill switch is active — all trading halted.",
            "correlation_id": cid,
        }
        _rejections.append(rej)
        _loop_state["last_loop_ts"] = datetime.utcnow().isoformat() + "Z"
        _loop_state["last_decision_id"] = decision_id
        _loop_state["cycles_run"] += 1
        return {
            "ok": True,
            "decision_id": decision_id,
            "decisions": [],
            "rejections": [rej],
            "orders": [],
            "duration_ms": round((time.monotonic() - t0) * 1000, 1),
            "correlation_id": cid,
        }

    can_submit = submit_orders and _armed and market_open and not _kill_switch

    # ── Brain V2 — single call replaces entire per-symbol loop ───────────────
    from ...autopilot.brain_v2 import get_brain_v2
    brain = get_brain_v2()

    cycle_result = await brain.run_cycle(
        universe=universe,
        armed=_armed,
        submit_orders=can_submit,
        kill_switch=_kill_switch,
    )

    # Flatten into the legacy in-memory lists (kept for /decisions + /rejections endpoints)
    for dec in cycle_result.decisions:
        _decisions.append(dec.to_dict())
        cycle_decisions.append(dec.to_dict())
    for rej in cycle_result.rejections:
        _rejections.append(rej.to_dict())
        cycle_rejections.append(rej.to_dict())
    orders_submitted = cycle_result.orders_submitted

    # Update loop state
    _loop_state["last_loop_ts"] = datetime.utcnow().isoformat() + "Z"
    _loop_state["last_decision_id"] = decision_id
    _loop_state["last_chain_diagnostics"] = cycle_result.chain_diagnostics
    _loop_state["cycles_run"] += 1

    duration_ms = round((time.monotonic() - t0) * 1000, 1)

    return {
        "ok": True,
        "decision_id": decision_id,
        "decisions": cycle_decisions,
        "rejections": cycle_rejections,
        "orders": orders_submitted,
        "anomalies": cycle_result.anomalies,
        "duration_ms": duration_ms,
        "market_open": market_open,
        "armed": _armed,
        "symbols_analyzed": len(universe),
        "correlation_id": cid,
    }



@router.post("/run-now")
async def run_now(request: RunNowRequest):
    """
    Run a single decision cycle NOW.
    If disarmed: produces decisions/rejections but does NOT place orders.
    If armed + market open: will submit orders.
    """
    submit = _armed and not _kill_switch and not request.dry_run
    return await _run_decision_cycle(symbols=request.symbols, submit_orders=submit)


@router.get("/decisions")
async def get_decisions(limit: int = Query(default=50, le=200)):
    """Get latest decisions."""
    cid = _cid()
    return {
        "decisions": list(reversed(_decisions[-limit:])),
        "count": len(_decisions),
        "correlation_id": cid,
    }


@router.get("/rejections")
async def get_rejections(limit: int = Query(default=50, le=200)):
    """Get latest rejections."""
    cid = _cid()
    return {
        "rejections": list(reversed(_rejections[-limit:])),
        "count": len(_rejections),
        "correlation_id": cid,
    }


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3 — LLM INTEGRATION
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/llm/status")
async def llm_status():
    """Get LLM provider status."""
    from ...autopilot.llm_provider import get_llm_provider
    return get_llm_provider().status()


@router.post("/llm/narrative")
async def llm_narrative(decision_id: str = Query(...)):
    """Generate LLM decision narrative for a decision."""
    cid = _cid()
    # Find the decision
    dec = next((d for d in _decisions if d.get("decision_id") == decision_id), None)
    if not dec:
        return {"ok": False, "error": "Decision not found", "correlation_id": cid}

    from ...autopilot.llm_provider import get_llm_provider
    result = await get_llm_provider().decision_narrative(dec)
    return {
        "ok": not bool(result.error),
        "narrative": result.text,
        "provider": result.provider,
        "model": result.model,
        "cached": result.cached,
        "prompt_hash": result.prompt_hash,
        "response_hash": result.response_hash,
        "correlation_id": cid,
    }


@router.post("/llm/risk-checklist")
async def llm_risk_checklist(decision_id: str = Query(...)):
    """Generate LLM risk checklist for a decision."""
    cid = _cid()
    dec = next((d for d in _decisions if d.get("decision_id") == decision_id), None)
    if not dec:
        return {"ok": False, "error": "Decision not found", "correlation_id": cid}

    from ...autopilot.llm_provider import get_llm_provider
    result = await get_llm_provider().risk_checklist(dec)
    return {
        "ok": not bool(result.error),
        "checklist": result.text,
        "provider": result.provider,
        "cached": result.cached,
        "correlation_id": cid,
    }


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 4 — LIVE PAPER TRADING LOOP
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/arm")
async def set_armed(request: ArmRequest):
    """Arm or disarm the autopilot. Armed = can place orders when market open."""
    global _armed
    _armed = request.armed
    return {
        "armed": _armed,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "correlation_id": _cid(),
    }


@router.get("/arm")
async def get_armed():
    """Get armed state."""
    return {"armed": _armed, "correlation_id": _cid()}


@router.post("/kill-switch")
async def toggle_kill_switch(request: KillSwitchRequest):
    """Activate or deactivate kill switch. Instantly disables order submission."""
    global _kill_switch, _armed
    _kill_switch = request.active
    if request.active:
        _armed = False  # Auto-disarm on kill switch
        if request.close_all:
            # Close all option positions
            try:
                from ...autopilot.alpaca_client import get_alpaca_client
                client = get_alpaca_client()
                result = await client.flatten_all(reason="kill_switch")
                return {
                    "kill_switch": True,
                    "armed": False,
                    "flatten_result": result,
                    "correlation_id": _cid(),
                }
            except Exception as e:
                return {
                    "kill_switch": True,
                    "armed": False,
                    "flatten_error": str(e),
                    "correlation_id": _cid(),
                }

    return {
        "kill_switch": _kill_switch,
        "armed": _armed,
        "correlation_id": _cid(),
    }


@router.get("/kill-switch")
async def get_kill_switch():
    return {"active": _kill_switch, "armed": _armed, "correlation_id": _cid()}


@router.get("/pnl")
async def get_pnl_snapshot():
    """PnL snapshot from Alpaca paper account."""
    cid = _cid()
    try:
        from ...autopilot.alpaca_client import get_alpaca_client
        client = get_alpaca_client()
        acct = await client.get_account()
        positions = await client.list_positions()

        equity = float(acct.equity) if acct else 0
        last_equity = float(acct.last_equity) if acct else 0
        day_pnl = equity - last_equity

        total_unrealized = sum(float(p.unrealized_pl) for p in positions)
        option_positions = [p for p in positions if p.asset_class == "us_option" or len(p.symbol) > 10]

        return {
            "equity": equity,
            "cash": float(acct.cash) if acct else 0,
            "buying_power": float(acct.buying_power) if acct else 0,
            "day_pnl": day_pnl,
            "total_unrealized_pnl": total_unrealized,
            "option_unrealized_pnl": sum(float(p.unrealized_pl) for p in option_positions),
            "total_positions": len(positions),
            "option_positions": len(option_positions),
            "correlation_id": cid,
        }
    except Exception as e:
        return {"ok": False, "error": str(e), "correlation_id": cid}


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 5 — ORDER PREVIEW
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/order-preview")
async def order_preview(symbol: str = Query(default="AAPL")):
    """
    Returns the exact order payload that WOULD be submitted (but does not submit).
    Used for E2E testing determinism + safety.
    """
    cid = _cid()
    from ...autopilot.options_gateway import get_options_gateway
    gw = get_options_gateway()

    chain = await gw.get_option_chain(symbol.upper())
    contracts = chain.get("contracts", [])

    if not contracts:
        return {
            "ok": False,
            "error": f"No contracts for {symbol}",
            "preview": None,
            "correlation_id": cid,
        }

    # Filter by DTE and sort by volume
    min_dte = RISK_CONTROLS["min_dte"]
    max_dte = RISK_CONTROLS["max_dte"]
    eligible = [c for c in contracts if min_dte <= c.get("dte", 0) <= max_dte]
    eligible.sort(key=lambda c: c.get("volume", 0), reverse=True)

    if not eligible:
        return {
            "ok": False,
            "error": f"No eligible contracts (DTE {min_dte}-{max_dte}) for {symbol}",
            "preview": None,
            "correlation_id": cid,
        }

    selected = eligible[0]
    bid = selected.get("bid")
    ask = selected.get("ask")
    limit_price = round((bid + ask) / 2, 2) if (bid and ask) else selected.get("last", 0)

    preview = {
        "contract_symbol": selected.get("contract_symbol"),
        "underlying": symbol.upper(),
        "option_type": selected.get("option_type"),
        "strike": selected.get("strike"),
        "expiration": selected.get("expiration"),
        "dte": selected.get("dte"),
        "side": "buy",
        "qty": 1,
        "order_type": "limit",
        "limit_price": limit_price,
        "time_in_force": "day",
        "estimated_premium_usd": (limit_price or 0) * 100,
        "dry_run": True,
    }

    return {
        "ok": True,
        "preview": preview,
        "risk_checks": {
            "premium_within_limit": (limit_price or 0) * 100 <= RISK_CONTROLS["max_premium_risk_per_trade_usd"],
            "dte_in_range": min_dte <= selected.get("dte", 0) <= max_dte,
        },
        "correlation_id": cid,
    }


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 5 — DEBUG BUNDLE
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/debug-bundle")
async def debug_bundle():
    """Full state dump for debugging. Includes health, last decisions, LLM status."""
    cid = _cid()
    health = await autopilot_health()
    llm = None
    try:
        from ...autopilot.llm_provider import get_llm_provider
        llm = get_llm_provider().status()
    except Exception:
        pass

    return {
        "health": health,
        "armed": _armed,
        "kill_switch": _kill_switch,
        "loop_state": _loop_state,
        "last_5_decisions": list(reversed(_decisions[-5:])),
        "last_5_rejections": list(reversed(_rejections[-5:])),
        "llm": llm,
        "risk_controls": RISK_CONTROLS,
        "universe": UNIVERSE,
        "correlation_id": cid,
    }

@router.get("/debug-snapshot")
async def debug_snapshot(
    symbols: str = Query(default="AAPL,SPY", description="Comma-separated symbols"),
    dte_min: int = Query(default=14),
    dte_max: int = Query(default=45),
    option_type: str = Query(default="call"),
):
    """
    Phase 0 diagnostic endpoint.

    Fetches live option snapshots via the CORRECT Alpaca endpoint
    (/v1beta1/options/snapshots/{sym}) and returns full chain diagnostics.

    Use this to verify:
      1. Chain fetch is working (not returning 404)
      2. OCC symbols are being parsed correctly
      3. bid/ask/greeks are available
      4. Scorer is selecting a valid winner
    """
    cid = _cid()
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()]

    from ...autopilot.options_data_gateway import get_options_mdg
    from ...autopilot.contract_scorer import score_contracts, ScorerConfig

    mdg = get_options_mdg()
    scorer_cfg = ScorerConfig(min_dte=dte_min, max_dte=dte_max)

    results = {}
    for sym in syms[:5]:  # cap at 5
        spot = await mdg.get_spot_price(sym)
        chain = await mdg.fetch_chain_snapshots(sym, dte_min=dte_min, dte_max=dte_max, option_type=option_type)
        diag = mdg.get_last_chain_diag(sym)

        from ...autopilot.options_data_gateway import OptionSnapshot
        snapshots = []
        if chain.get("ok") and chain.get("snapshots"):
            for s in chain["snapshots"]:
                try:
                    snapshots.append(OptionSnapshot(**{k: v for k, v in s.items() if k in OptionSnapshot.__dataclass_fields__}))
                except Exception:
                    pass

        selection = score_contracts(snapshots, option_type=option_type, cfg=scorer_cfg, symbol=sym) if snapshots else None
        winner_info = None
        if selection and selection.winner:
            w = selection.winner
            winner_info = {
                "contract_symbol": w.snapshot.contract_symbol,
                "strike": w.snapshot.strike,
                "expiry": w.snapshot.expiry,
                "dte": w.snapshot.dte,
                "bid": w.snapshot.bid,
                "ask": w.snapshot.ask,
                "mid": w.snapshot.mid,
                "spread_pct": w.snapshot.spread_pct,
                "delta": w.snapshot.delta,
                "iv": w.snapshot.iv,
                "score": w.score,
            }

        results[sym] = {
            "spot": spot,
            "chain_fetch_ok": chain.get("ok", False),
            "hint": chain.get("hint") or chain.get("error") or "",
            "contracts_fetched": diag.get("contracts_fetched", 0),
            "contracts_after_filters": diag.get("contracts_after_filters", 0),
            "candidates_total": selection.candidates_total if selection else 0,
            "candidates_accepted": selection.candidates_accepted if selection else 0,
            "rejection_counts": selection.rejection_counts if selection else {},
            "winner": winner_info,
            "top_3": [
                {
                    "symbol": c.snapshot.contract_symbol,
                    "score": c.score,
                    "spread_pct": c.snapshot.spread_pct,
                    "dte": c.snapshot.dte,
                    "delta": c.snapshot.delta,
                    "mid": c.snapshot.mid,
                }
                for c in (selection.top_candidates[:3] if selection else [])
            ],
            "raw_diag": diag,
        }

    return {
        "ok": True,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "symbols": syms,
        "results": results,
        "last_cycle_chain_diag": _loop_state.get("last_chain_diagnostics", {}),
        "correlation_id": cid,
    }