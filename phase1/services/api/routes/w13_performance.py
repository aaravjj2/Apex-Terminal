"""
Waves 11-20 — Performance Loop API Routes
Strategy performance tracking, champion/challenger, auto-disable.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import logging

from ...waves11_20.performance import get_performance_ledger

router = APIRouter(prefix="/api/v2/performance", tags=["performance-v2"])
logger = logging.getLogger(__name__)


class RecordTradeRequest(BaseModel):
    strategy_id: str
    symbol: str
    side: str
    entry_price: float
    exit_price: float
    quantity: float
    holding_days: int = 1


class UpdateRoleRequest(BaseModel):
    strategy_id: str
    role: str  # "champion" or "challenger"


@router.post("/trades")
async def record_trade(req: RecordTradeRequest):
    """Record a completed trade for performance tracking."""
    ledger = get_performance_ledger()
    trade = ledger.record_trade(
        strategy_id=req.strategy_id,
        symbol=req.symbol,
        side=req.side,
        entry_price=req.entry_price,
        exit_price=req.exit_price,
        quantity=req.quantity,
        holding_days=req.holding_days,
    )
    return trade.to_dict()


@router.get("/metrics/{strategy_id}")
async def get_metrics(strategy_id: str):
    """Get performance metrics for a strategy."""
    ledger = get_performance_ledger()
    metrics = ledger.compute_metrics(strategy_id)
    return metrics.to_dict()


@router.get("/metrics")
async def get_all_metrics():
    """Get performance metrics for all strategies."""
    ledger = get_performance_ledger()
    all_metrics = ledger.get_all_metrics()
    return {"strategies": [m.to_dict() for m in all_metrics]}


@router.post("/roles")
async def update_role(req: UpdateRoleRequest):
    """Set champion/challenger role for a strategy."""
    ledger = get_performance_ledger()
    ledger.set_role(req.strategy_id, req.role)
    return {"ok": True, "strategy_id": req.strategy_id, "role": req.role}


@router.get("/auto-disable/check/{strategy_id}")
async def check_auto_disable(strategy_id: str):
    """Check if a strategy should be auto-disabled."""
    ledger = get_performance_ledger()
    events = ledger.check_auto_disable(strategy_id)
    return {
        "strategy_id": strategy_id,
        "should_disable": len(events) > 0,
        "events": [e.to_dict() for e in events],
    }


@router.get("/auto-disable/events")
async def get_disable_events():
    """Get all auto-disable events."""
    ledger = get_performance_ledger()
    events = ledger.get_disable_events()
    return {"events": [e.to_dict() for e in events]}


@router.get("/leaderboard")
async def leaderboard():
    """Get strategy leaderboard sorted by Sharpe."""
    ledger = get_performance_ledger()
    all_metrics = ledger.get_all_metrics()
    sorted_metrics = sorted(all_metrics, key=lambda m: m.sharpe_proxy, reverse=True)
    return {
        "leaderboard": [
            {
                "rank": i + 1,
                "strategy_id": m.strategy_id,
                "sharpe": round(m.sharpe_proxy, 4),
                "win_rate": round(m.win_rate, 4),
                "total_pnl": round(m.total_pnl, 2),
                "trade_count": m.trade_count,
                "role": m.role,
            }
            for i, m in enumerate(sorted_metrics)
        ]
    }
