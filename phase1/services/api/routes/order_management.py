"""
Order Management API Routes
=============================
30 endpoints for order creation, management, fills, positions, and analytics.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from phase1.services.order_management_engine import OrderManagementEngine

router = APIRouter(prefix="/api/v1/orders", tags=["order-management"])
engine = OrderManagementEngine()


# ─── Pydantic Models ────────────────────────────────────────────────────────

class MarketOrderRequest(BaseModel):
    symbol: str
    side: str
    quantity: int


class LimitOrderRequest(BaseModel):
    symbol: str
    side: str
    quantity: int
    price: float


class StopOrderRequest(BaseModel):
    symbol: str
    side: str
    quantity: int
    stop_price: float


class StopLimitRequest(BaseModel):
    symbol: str
    side: str
    quantity: int
    stop_price: float
    limit_price: float


class TrailingStopRequest(BaseModel):
    symbol: str
    side: str
    quantity: int
    trail_amount: Optional[float] = None
    trail_percent: Optional[float] = None


class BracketRequest(BaseModel):
    symbol: str
    side: str
    quantity: int
    entry_price: float
    take_profit: float
    stop_loss: float


class FillRequest(BaseModel):
    market_price: float


class BuyingPowerRequest(BaseModel):
    amount: float


class RouteRequest(BaseModel):
    preference: str = "best_price"


# ─── Order Creation ─────────────────────────────────────────────────────────

@router.post("/market")
def create_market_order(req: MarketOrderRequest):
    o = engine.create_market_order(req.symbol, req.side, req.quantity)
    return o.to_dict()


@router.post("/limit")
def create_limit_order(req: LimitOrderRequest):
    o = engine.create_limit_order(req.symbol, req.side, req.quantity, req.price)
    return o.to_dict()


@router.post("/stop")
def create_stop_order(req: StopOrderRequest):
    o = engine.create_stop_order(req.symbol, req.side, req.quantity, req.stop_price)
    return o.to_dict()


@router.post("/stop-limit")
def create_stop_limit(req: StopLimitRequest):
    o = engine.create_stop_limit_order(
        req.symbol, req.side, req.quantity, req.stop_price, req.limit_price)
    return o.to_dict()


@router.post("/trailing-stop")
def create_trailing_stop(req: TrailingStopRequest):
    o = engine.create_trailing_stop(
        req.symbol, req.side, req.quantity,
        trail_amount=req.trail_amount, trail_percent=req.trail_percent)
    return o.to_dict()


@router.post("/bracket")
def create_bracket(req: BracketRequest):
    result = engine.create_bracket_order(
        req.symbol, req.side, req.quantity,
        req.entry_price, req.take_profit, req.stop_loss)
    return {k: v.to_dict() if hasattr(v, 'to_dict') else v
            for k, v in result.items()}


# ─── Order Management ───────────────────────────────────────────────────────

@router.get("/")
def list_orders():
    orders = engine.book.get_all()
    return {"orders": [o.to_dict() for o in orders], "count": len(orders)}


@router.get("/active")
def active_orders():
    orders = engine.get_active_orders()
    return {"orders": [o.to_dict() for o in orders], "count": len(orders)}


@router.get("/filled")
def filled_orders():
    orders = engine.get_filled_orders()
    return {"orders": [o.to_dict() for o in orders], "count": len(orders)}


@router.get("/symbol/{symbol}")
def orders_by_symbol(symbol: str):
    orders = engine.get_orders_by_symbol(symbol)
    return {"symbol": symbol, "orders": [o.to_dict() for o in orders]}


@router.get("/{order_id}")
def get_order(order_id: str):
    o = engine.get_order(order_id)
    if not o:
        raise HTTPException(404, "Order not found")
    return o.to_dict()


@router.delete("/{order_id}")
def cancel_order(order_id: str):
    ok = engine.cancel_order(order_id)
    return {"success": ok, "order_id": order_id}


@router.post("/cancel-all")
def cancel_all(symbol: str = ""):
    count = engine.cancel_all(symbol)
    return {"cancelled": count}


# ─── Fill Processing ────────────────────────────────────────────────────────

@router.post("/{order_id}/fill")
def process_fill(order_id: str, req: FillRequest):
    fill = engine.process_market_fill(order_id, req.market_price)
    if not fill:
        raise HTTPException(400, "Fill not possible")
    return fill.to_dict()


# ─── Positions ──────────────────────────────────────────────────────────────

@router.get("/positions/all")
def all_positions():
    positions = engine.get_all_positions()
    return {"positions": [p.to_dict() for p in positions]}


@router.get("/positions/{symbol}")
def position_by_symbol(symbol: str):
    p = engine.get_position(symbol)
    if not p:
        return {"symbol": symbol, "quantity": 0}
    return p.to_dict()


@router.get("/portfolio/summary")
def portfolio_summary():
    return engine.get_portfolio_summary()


# ─── Account ────────────────────────────────────────────────────────────────

@router.post("/account/buying-power")
def set_buying_power(req: BuyingPowerRequest):
    engine.set_buying_power(req.amount)
    return {"buying_power": engine.buying_power}


@router.get("/account/buying-power")
def get_buying_power():
    return {"buying_power": engine.buying_power}


# ─── Analytics ──────────────────────────────────────────────────────────────

@router.get("/analytics/execution-quality")
def execution_quality():
    return engine.execution_quality()


@router.get("/analytics/summary")
def order_summary():
    return engine.order_summary()


@router.get("/analytics/history")
def order_history(limit: int = 100):
    return {"history": engine.get_history(limit)}


# ─── Routing ────────────────────────────────────────────────────────────────

@router.post("/{order_id}/route")
def route_order(order_id: str, req: RouteRequest):
    exchange = engine.route_order(order_id, req.preference)
    if not exchange:
        raise HTTPException(404, "Order not found")
    return {"order_id": order_id, "exchange": exchange}


@router.get("/routing/exchanges")
def exchange_fees():
    return {"exchanges": engine.router.get_exchange_fees()}


# ─── Meta ───────────────────────────────────────────────────────────────────

@router.get("/capabilities")
def capabilities():
    return engine.capabilities()
