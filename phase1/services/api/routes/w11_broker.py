"""
Waves 11-20 — Paper Broker API Routes
Paper-only Alpaca broker, kill switch, order management.
HARD REFUSAL of live trading.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import logging

from ...waves11_20.broker import (
    get_paper_broker, LiveTradingRefusedError, KillSwitchActiveError
)

router = APIRouter(prefix="/api/v2/broker", tags=["broker-v2"])
logger = logging.getLogger(__name__)


class SubmitOrderRequest(BaseModel):
    symbol: str
    side: str  # "buy" or "sell"
    quantity: float
    order_type: str = "market"
    limit_price: Optional[float] = None
    idempotency_key: Optional[str] = None


class KillSwitchRequest(BaseModel):
    reason: str


@router.get("/readiness")
async def trading_readiness():
    """Check if broker is ready for trading."""
    broker = get_paper_broker()
    return broker.get_trading_readiness()


@router.post("/orders")
async def submit_order(req: SubmitOrderRequest):
    """Submit a paper order. REFUSES live trading."""
    broker = get_paper_broker()
    try:
        order = broker.submit_order(
            symbol=req.symbol,
            side=req.side,
            quantity=req.quantity,
            order_type=req.order_type,
            limit_price=req.limit_price,
            idempotency_key=req.idempotency_key,
        )
        return order.to_dict()
    except LiveTradingRefusedError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except KillSwitchActiveError as e:
        raise HTTPException(status_code=423, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/orders")
async def list_orders(
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=50, le=200),
):
    """List paper orders."""
    broker = get_paper_broker()
    orders = broker.get_orders(status=status)
    return {"orders": [o.to_dict() for o in orders[-limit:]], "total": len(orders)}


@router.get("/positions")
async def list_positions():
    """List current paper positions."""
    broker = get_paper_broker()
    positions = broker.get_positions()
    return {"positions": [p.to_dict() for p in positions]}


@router.get("/positions/{symbol}")
async def get_position(symbol: str):
    """Get position for a specific symbol."""
    broker = get_paper_broker()
    pos = broker.get_position(symbol)
    if not pos:
        raise HTTPException(status_code=404, detail=f"No position for {symbol}")
    return pos.to_dict()


@router.post("/kill-switch/activate")
async def activate_kill_switch(req: KillSwitchRequest):
    """Activate the kill switch — halts all trading."""
    broker = get_paper_broker()
    broker.activate_kill_switch(req.reason)
    return {"ok": True, "message": "Kill switch activated", "reason": req.reason}


@router.post("/kill-switch/deactivate")
async def deactivate_kill_switch():
    """Deactivate the kill switch."""
    broker = get_paper_broker()
    broker.deactivate_kill_switch()
    return {"ok": True, "message": "Kill switch deactivated"}


@router.get("/kill-switch")
async def kill_switch_status():
    """Get kill switch state."""
    broker = get_paper_broker()
    return broker.get_kill_switch_state().to_dict()


@router.get("/pnl/daily")
async def daily_pnl():
    """Get today's P&L."""
    broker = get_paper_broker()
    pnl = broker.get_daily_pnl()
    return pnl.to_dict() if pnl else {"realized": 0, "unrealized": 0, "total": 0}


@router.post("/reconcile")
async def reconcile():
    """Reconcile positions with broker."""
    broker = get_paper_broker()
    result = await broker.reconcile_positions()
    return result
