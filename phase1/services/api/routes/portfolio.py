"""
Portfolio API - REST endpoints for portfolio and positions.
Now connected to real Autopilot/Alpaca data.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging

from ...autopilot.repository import get_autopilot_repository
from ...autopilot.broker_position_manager import get_broker_position_manager

router = APIRouter(tags=["Portfolio"])
logger = logging.getLogger(__name__)


# ============================================================================
# RESPONSE MODELS
# ============================================================================

class PositionResponse(BaseModel):
    symbol: str
    quantity: float
    avg_cost: float
    current_price: float
    market_value: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    side: str
    asset_class: str
    underlying: Optional[str] = None
    dte: Optional[int] = None
    managed: bool = False
    run_id: Optional[str] = None

class PortfolioResponse(BaseModel):
    cash: float
    equity: float
    total_market_value: float
    realized_pnl: float
    unrealized_pnl: float
    total_pnl: float
    return_pct: float
    positions: List[PositionResponse]

class TradeResponse(BaseModel):
    id: str
    symbol: str
    side: str
    quantity: float
    price: float
    timestamp: str
    commission: float
    gross_value: float
    net_value: float

class OrderResponse(BaseModel):
    id: str
    client_order_id: str
    symbol: str
    side: str
    quantity: float
    order_type: str
    status: str
    submitted_at: str
    filled_at: Optional[str] = None
    limit_price: Optional[float] = None
    filled_price: Optional[float] = None
    filled_qty: float = 0
    source: str = "autopilot"
    run_id: Optional[str] = None
    retry_count: int = 0


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("", response_model=PortfolioResponse)
async def get_portfolio():
    """Get current portfolio state."""
    manager = get_broker_position_manager()
    
    try:
        # Get enriched positions
        positions = await manager.get_positions()
        
        # Calculate totals
        total_market_value = sum(p.market_value for p in positions)
        total_unrealized_pnl = sum(p.unrealized_pnl for p in positions)
        total_equity = 100000.0 + total_unrealized_pnl # Placeholder cash until real broker sync
        
        pos_responses = []
        for p in positions:
            pos_responses.append(PositionResponse(
                symbol=p.symbol,
                quantity=float(p.qty),
                avg_cost=p.avg_entry_price,
                current_price=p.current_price,
                market_value=p.market_value,
                unrealized_pnl=p.unrealized_pnl,
                unrealized_pnl_pct=p.unrealized_pnl_pct,
                side=p.side,
                asset_class=p.asset_class,
                underlying=p.underlying,
                dte=p.dte,
                managed=p.managed,
                run_id=p.run_id
            ))

        return PortfolioResponse(
            cash=100000.0, # Placeholder
            equity=total_equity,
            total_market_value=total_market_value,
            realized_pnl=0.0,
            unrealized_pnl=total_unrealized_pnl,
            total_pnl=total_unrealized_pnl,
            return_pct=0.0,
            positions=pos_responses,
        )
    except Exception as e:
        logger.error(f"Portfolio fetch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/positions", response_model=List[PositionResponse])
async def get_positions():
    """Get all positions."""
    manager = get_broker_position_manager()
    positions = await manager.get_positions()
    
    return [
        PositionResponse(
            symbol=p.symbol,
            quantity=float(p.qty),
            avg_cost=p.avg_entry_price,
            current_price=p.current_price,
            market_value=p.market_value,
            unrealized_pnl=p.unrealized_pnl,
            unrealized_pnl_pct=p.unrealized_pnl_pct,
            side=p.side,
            asset_class=p.asset_class,
            underlying=p.underlying,
            dte=p.dte,
            managed=p.managed,
            run_id=p.run_id
        )
        for p in positions
    ]


@router.get("/orders", response_model=List[OrderResponse])
async def get_orders(
    status: Optional[str] = None, 
    limit: int = 100,
    run_id: Optional[str] = None
):
    """Get pending and recent orders from DB."""
    repo = get_autopilot_repository()
    
    # Map API status to DB status if needed, or rely on exact match
    db_orders = repo.list_orders(run_id=run_id, status=status, limit=limit)
    
    results = []
    for o in db_orders:
        results.append(OrderResponse(
            id=o.id,
            client_order_id=o.client_order_id,
            symbol=o.symbol,
            side=o.side,
            quantity=float(o.qty),
            order_type=o.order_type,
            status=o.status,
            submitted_at=o.submitted_at.isoformat(),
            filled_at=o.filled_at.isoformat() if o.filled_at else None,
            limit_price=o.limit_price,
            filled_price=o.filled_avg_price,
            filled_qty=float(o.filled_qty),
            source="autopilot",
            run_id=o.run_id,
            retry_count=o.retry_count
        ))
        
    return results


@router.get("/unified")
async def get_unified_portfolio():
    """
    Get unified portfolio view with positions, orders, and stats.
    Used by the frontend EnhancedPortfolioView component.
    """
    manager = get_broker_position_manager()
    repo = get_autopilot_repository()
    
    try:
        # Parallel fetch if we were fully async, but repo is sync for now
        positions = await manager.get_positions()
        db_orders = repo.list_orders(limit=50) # Last 50 orders
        
        # Calculate stats
        total_market_value = sum(p.market_value for p in positions)
        unrealized_pnl = sum(p.unrealized_pnl for p in positions)
        
        # Format positions
        pos_list = [
            {
                "id": p.symbol,  # Use symbol as unique ID
                "symbol": p.symbol,
                "quantity": float(p.qty),
                "avg_cost": p.avg_entry_price,
                "current_price": p.current_price,
                "market_value": p.market_value,
                "unrealized_pnl": p.unrealized_pnl,
                "unrealized_pnl_pct": p.unrealized_pnl_pct,
                "side": p.side,
                "asset_class": p.asset_class,
                "dte": p.dte,
                "managed": p.managed
            }
            for p in positions
        ]
        
        # Format orders
        ord_list = [
            {
                "id": o.id,
                "client_order_id": o.client_order_id,
                "symbol": o.symbol,
                "side": o.side,
                "qty": float(o.qty),
                "type": o.order_type,
                "status": o.status,
                "limit_price": o.limit_price,
                "filled_price": o.filled_avg_price,
                "filled_qty": float(o.filled_qty),
                "created_at": o.submitted_at.isoformat(),
                "run_id": o.run_id
            }
            for o in db_orders
        ]
        
        return {
            "positions": pos_list,
            "orders": ord_list,
            "stats": {
                "total_equity": 100000.0 + unrealized_pnl, # Mock cash
                "total_cash": 100000.0,
                "buying_power": 200000.0,
                "open_pnl": unrealized_pnl,
                "day_pnl": 0.0,
                "position_count": len(positions),
                "order_count": len(ord_list), # Just recent ones
                "options_exposure": total_market_value
            }
        }
    except Exception as e:
        logger.error(f"Unified portfolio error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics")
async def get_portfolio_metrics():
    """Get portfolio performance metrics."""
    return {
        "equity": 100000.0,
        "cash": 100000.0,
        "sharpe_ratio": 0.0,
        "sortino_ratio": 0.0,
        "max_drawdown": 0.0,
        "total_return_pct": 0.0,
        "position_count": 0,
        "trade_count": 0,
    }
