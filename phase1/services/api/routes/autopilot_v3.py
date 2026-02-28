"""
Autopilot V3 Router — State-backed endpoints for the closed-loop trading system.

Endpoints:
  GET  /api/autopilot/cycles/latest
  GET  /api/autopilot/cycles/{cycle_id}
  GET  /api/autopilot/positions
  GET  /api/autopilot/orders
  GET  /api/autopilot/decisions
  GET  /api/autopilot/exits
  GET  /api/autopilot/evaluations
  GET  /api/autopilot/thresholds
  GET  /api/autopilot/invariants
  GET  /api/autopilot/risk-snapshot
  GET  /api/autopilot/signals
  POST /api/autopilot/run-v3
  GET  /api/autopilot/ops-summary
  GET  /api/autopilot/incidents
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/autopilot", tags=["autopilot-v3"])

# ── In-memory state (V3 router has its own armed/kill state for clean separation)
_armed_v3: bool = False
_kill_switch_v3: bool = False


def _cid() -> str:
    return f"v3-{uuid.uuid4().hex[:8]}"


# ── Request Models ────────────────────────────────────────────────────────────

class RunV3Request(BaseModel):
    symbols: Optional[List[str]] = None
    dry_run: bool = False


class ArmV3Request(BaseModel):
    armed: bool


class KillV3Request(BaseModel):
    active: bool


# ══════════════════════════════════════════════════════════════════════════════
# ARM / KILL SWITCH
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/arm")
async def v3_arm(request: ArmV3Request):
    """Arm or disarm the V3 autopilot."""
    global _armed_v3
    _armed_v3 = request.armed
    return {"armed": _armed_v3, "timestamp": datetime.utcnow().isoformat() + "Z", "correlation_id": _cid()}


@router.post("/kill-switch")
async def v3_kill_switch(request: KillV3Request):
    """Activate or deactivate V3 kill switch."""
    global _kill_switch_v3, _armed_v3
    _kill_switch_v3 = request.active
    if request.active:
        _armed_v3 = False
    return {"kill_switch": _kill_switch_v3, "armed": _armed_v3, "correlation_id": _cid()}


@router.get("/arm")
async def v3_get_armed():
    return {"armed": _armed_v3, "kill_switch": _kill_switch_v3, "correlation_id": _cid()}


# ══════════════════════════════════════════════════════════════════════════════
# CYCLES
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/cycles/latest")
async def get_latest_cycles(n: int = Query(default=10, le=50)):
    """
    Get the N most recent autopilot cycles with their decision/rejection counts.
    """
    cid = _cid()
    try:
        from ...autopilot.v3_store import cycle_get_latest
        cycles = cycle_get_latest(n)
        return {
            "ok": True,
            "cycles": cycles,
            "count": len(cycles),
            "correlation_id": cid,
        }
    except Exception as e:
        logger.error(f"get_latest_cycles: {e}")
        return {"ok": False, "error": str(e), "cycles": [], "correlation_id": cid}


@router.get("/cycles/{cycle_id}")
async def get_cycle(cycle_id: str):
    """Get a specific cycle by ID with all its decisions and orders."""
    cid = _cid()
    try:
        from ...autopilot.v3_store import cycle_get, decisions_list, orders_list
        cycle = cycle_get(cycle_id)
        if not cycle:
            return {"ok": False, "error": "Cycle not found", "correlation_id": cid}
        decisions = decisions_list(cycle_id=cycle_id)
        orders = orders_list(cycle_id=cycle_id)
        return {
            "ok": True,
            "cycle": cycle,
            "decisions": decisions,
            "orders": orders,
            "correlation_id": cid,
        }
    except Exception as e:
        return {"ok": False, "error": str(e), "correlation_id": cid}


# ══════════════════════════════════════════════════════════════════════════════
# POSITIONS (truth from v3_store)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/positions")
async def get_positions_v3(status: Optional[str] = Query(default="open")):
    """
    Get persisted positions from v3_store (the system of record).
    Use status=open|closed|all.
    """
    cid = _cid()
    try:
        from ...autopilot.v3_store import positions_list
        status_filter = None if status == "all" else status
        positions = positions_list(status=status_filter)

        # Also try to get current broker positions for live PnL
        broker_snap = []
        try:
            from ...autopilot.options_gateway import get_options_gateway
            gw = get_options_gateway()
            result = await gw.list_option_positions()
            broker_snap = result.get("positions", [])
        except Exception:
            pass

        # Enrich stored positions with live broker data
        broker_by_contract = {p.get("symbol", ""): p for p in broker_snap}
        for pos in positions:
            broker_p = broker_by_contract.get(pos.get("contract_symbol", ""))
            if broker_p:
                pos["current_price"] = broker_p.get("current_price") or pos.get("current_price")
                pos["unrealized_pnl_pct"] = broker_p.get("unrealized_pnl_pct") or pos.get("unrealized_pnl_pct")
                pos["unrealized_pnl"] = broker_p.get("unrealized_pl") or pos.get("unrealized_pnl")

        return {
            "ok": True,
            "positions": positions,
            "count": len(positions),
            "broker_positions_count": len(broker_snap),
            "correlation_id": cid,
        }
    except Exception as e:
        logger.error(f"get_positions_v3: {e}")
        return {"ok": False, "error": str(e), "positions": [], "correlation_id": cid}


# ══════════════════════════════════════════════════════════════════════════════
# ORDERS (truth from v3_store)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/orders")
async def get_orders_v3(cycle_id: Optional[str] = Query(default=None), limit: int = Query(default=50, le=200)):
    """Get persisted orders from v3_store."""
    cid = _cid()
    try:
        from ...autopilot.v3_store import orders_list
        orders = orders_list(cycle_id=cycle_id, limit=limit)
        return {"ok": True, "orders": orders, "count": len(orders), "correlation_id": cid}
    except Exception as e:
        return {"ok": False, "error": str(e), "orders": [], "correlation_id": cid}


# ══════════════════════════════════════════════════════════════════════════════
# DECISIONS (truth from v3_store)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/decisions")
async def get_decisions_v3(
    cycle_id: Optional[str] = Query(default=None),
    symbol: Optional[str] = Query(default=None),
    limit: int = Query(default=50, le=200),
):
    """Get persisted decisions from v3_store."""
    cid = _cid()
    try:
        from ...autopilot.v3_store import decisions_list
        decisions = decisions_list(cycle_id=cycle_id, symbol=symbol, limit=limit)
        return {"ok": True, "decisions": decisions, "count": len(decisions), "correlation_id": cid}
    except Exception as e:
        return {"ok": False, "error": str(e), "decisions": [], "correlation_id": cid}


# ══════════════════════════════════════════════════════════════════════════════
# EXITS + EVALUATIONS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/exits")
async def get_exits_v3(limit: int = Query(default=50, le=200)):
    """Get all recorded exits."""
    cid = _cid()
    try:
        from ...autopilot.v3_store import exits_list
        exits = exits_list(limit=limit)
        return {"ok": True, "exits": exits, "count": len(exits), "correlation_id": cid}
    except Exception as e:
        return {"ok": False, "error": str(e), "exits": [], "correlation_id": cid}


@router.get("/evaluations")
async def get_evaluations_v3(
    since: Optional[str] = Query(default=None, description="ISO-8601 UTC timestamp"),
    limit: int = Query(default=100, le=500),
):
    """Get evaluation records, optionally filtered by since timestamp."""
    cid = _cid()
    try:
        from ...autopilot.v3_store import evaluations_list
        evals = evaluations_list(since=since, limit=limit)
        return {"ok": True, "evaluations": evals, "count": len(evals), "correlation_id": cid}
    except Exception as e:
        return {"ok": False, "error": str(e), "evaluations": [], "correlation_id": cid}


# ══════════════════════════════════════════════════════════════════════════════
# THRESHOLDS + LEARNING
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/thresholds")
async def get_thresholds_v3():
    """Get current adaptive thresholds and the threshold change history."""
    cid = _cid()
    try:
        from ...autopilot.evaluator import get_evaluator
        from ...autopilot.v3_store import threshold_history_list
        evaluator = get_evaluator()
        thresholds = evaluator.get_thresholds()
        history = threshold_history_list(limit=50)
        return {
            "ok": True,
            "current_thresholds": thresholds.to_dict(),
            "history": history,
            "history_count": len(history),
            "correlation_id": cid,
        }
    except Exception as e:
        return {"ok": False, "error": str(e), "correlation_id": cid}


# ══════════════════════════════════════════════════════════════════════════════
# INVARIANTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/invariants")
async def check_invariants():
    """
    Server-side invariant checker.
    Returns ok=True if no violations, else lists them as incidents.
    """
    cid = _cid()
    try:
        from ...autopilot.v3_store import invariant_check
        result = invariant_check()
        return {**result, "correlation_id": cid}
    except Exception as e:
        return {"ok": False, "error": str(e), "violations": [], "correlation_id": cid}


# ══════════════════════════════════════════════════════════════════════════════
# RISK SNAPSHOT
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/risk-snapshot")
async def get_risk_snapshot():
    """Compute real-time portfolio risk metrics from broker positions."""
    cid = _cid()
    try:
        from ...autopilot.risk_engine import get_risk_engine
        from ...autopilot.options_gateway import get_options_gateway
        gw = get_options_gateway()
        positions_result = await gw.list_option_positions()
        account_info = await gw.get_account_info()

        engine = get_risk_engine()
        snap = engine.compute_portfolio_snapshot(
            positions_result.get("positions", []),
            account_info,
        )

        return {
            "ok": True,
            "risk_snapshot": snap.to_dict(),
            "caps": {
                "max_premium_per_trade_usd": engine.cfg.max_premium_per_trade_usd,
                "max_total_premium_open_usd": engine.cfg.max_total_premium_open_usd,
                "max_positions": engine.cfg.max_positions,
                "max_daily_loss_usd": engine.cfg.max_daily_loss_usd,
                "max_delta_notional_total": engine.cfg.max_delta_notional_total,
                "max_delta_notional_per_symbol": engine.cfg.max_delta_notional_per_symbol,
                "max_bp_utilization_pct": engine.cfg.max_bp_utilization_pct,
            },
            "account": {
                "equity": account_info.get("equity"),
                "buying_power": account_info.get("buying_power"),
                "options_buying_power": account_info.get("options_buying_power"),
            },
            "correlation_id": cid,
        }
    except Exception as e:
        logger.error(f"risk-snapshot: {e}")
        return {"ok": False, "error": str(e), "correlation_id": cid}


# ══════════════════════════════════════════════════════════════════════════════
# SIGNALS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/signals")
async def get_signals(
    symbols: str = Query(default="AAPL,SPY,MSFT,NVDA", description="Comma-separated symbols"),
):
    """Get current directional signals for symbols."""
    cid = _cid()
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()][:10]
    try:
        from ...autopilot.signal_provider import get_signals_batch
        signals = await get_signals_batch(syms)
        return {
            "ok": True,
            "signals": {k: v.to_dict() for k, v in signals.items()},
            "correlation_id": cid,
        }
    except Exception as e:
        return {"ok": False, "error": str(e), "signals": {}, "correlation_id": cid}


# ══════════════════════════════════════════════════════════════════════════════
# V3 RUN
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/run-v3")
async def run_v3(request: RunV3Request):
    """
    Run a full V3 decision cycle.
    - DISARMED: analysis only, no orders submitted, all state written to DB.
    - ARMED + market open: will submit orders.
    """
    cid = _cid()
    from ...autopilot.brain_v3 import get_brain_v3

    UNIVERSE = ["SPY", "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "TSLA"]
    universe = [s.upper() for s in (request.symbols or UNIVERSE[:5])]

    submit = _armed_v3 and not _kill_switch_v3 and not request.dry_run
    brain = get_brain_v3()

    result = await brain.run_cycle(
        universe=universe,
        armed=_armed_v3,
        submit_orders=submit,
        kill_switch=_kill_switch_v3,
    )

    return {
        "ok": True,
        "cycle_id": result.cycle_id,
        "decisions": [d.to_dict() for d in result.decisions],
        "rejections": [r.to_dict() for r in result.rejections],
        "exit_proposals": result.exit_proposals,
        "orders_submitted": result.orders_submitted,
        "anomalies": result.anomalies,
        "portfolio_snapshot": result.portfolio_snapshot,
        "duration_ms": result.duration_ms,
        "market_open": result.market_open,
        "armed": result.armed,
        "symbols_analyzed": len(universe),
        "correlation_id": result.correlation_id,
    }


# ══════════════════════════════════════════════════════════════════════════════
# OPS SUMMARY
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/ops-summary")
async def get_ops_summary():
    """
    Complete ops summary for the autopilot health panel.
    Includes: last cycle, positions, risk, invariants, incidents, thresholds.
    """
    cid = _cid()
    try:
        from ...autopilot.v3_store import (
            get_summary_stats, cycle_get_latest, invariant_check, incidents_list
        )
        from ...autopilot.evaluator import get_evaluator

        stats = get_summary_stats()
        latest_cycles = cycle_get_latest(3)
        inv = invariant_check()
        incidents = incidents_list(limit=10, unresolved_only=True)
        evaluator = get_evaluator()
        thresholds = evaluator.get_thresholds()

        return {
            "ok": True,
            "stats": stats,
            "last_cycle": latest_cycles[0] if latest_cycles else None,
            "recent_cycles": latest_cycles,
            "invariants": inv,
            "unresolved_incidents": incidents,
            "current_thresholds": thresholds.to_dict(),
            "armed": _armed_v3,
            "kill_switch": _kill_switch_v3,
            "correlation_id": cid,
        }
    except Exception as e:
        logger.error(f"ops-summary: {e}")
        return {"ok": False, "error": str(e), "correlation_id": cid}


# ══════════════════════════════════════════════════════════════════════════════
# INCIDENTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/incidents")
async def get_incidents(
    unresolved_only: bool = Query(default=False),
    limit: int = Query(default=50, le=200),
):
    """Get autopilot incidents."""
    cid = _cid()
    try:
        from ...autopilot.v3_store import incidents_list
        incidents = incidents_list(limit=limit, unresolved_only=unresolved_only)
        return {"ok": True, "incidents": incidents, "count": len(incidents), "correlation_id": cid}
    except Exception as e:
        return {"ok": False, "error": str(e), "incidents": [], "correlation_id": cid}


# ══════════════════════════════════════════════════════════════════════════════
# EXIT PROPOSALS (for UI preview)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/exit-proposals")
async def get_exit_proposals():
    """
    Compute exit proposals for current open positions without running a full cycle.
    Safe to call at any time for UI preview.
    """
    cid = _cid()
    try:
        from ...autopilot.exit_manager import get_exit_manager
        from ...autopilot.options_gateway import get_options_gateway

        gw = get_options_gateway()
        positions_result = await gw.list_option_positions()
        broker_positions = positions_result.get("positions", [])

        em = get_exit_manager()
        proposals = await em.evaluate_positions(broker_positions, armed=False)

        return {
            "ok": True,
            "proposals": [p.to_dict() for p in proposals],
            "positions_checked": len(broker_positions),
            "exits_triggered": len(proposals),
            "correlation_id": cid,
        }
    except Exception as e:
        return {"ok": False, "error": str(e), "proposals": [], "correlation_id": cid}
