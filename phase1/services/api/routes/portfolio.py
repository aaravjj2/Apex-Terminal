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
    """Get current portfolio state from Alpaca broker."""
    manager = get_broker_position_manager()
    
    try:
        # Get enriched positions
        positions = await manager.get_positions()
        
        # Get real account data from broker
        from ...autopilot.alpaca_client import get_alpaca_client
        broker = get_alpaca_client()
        account = await broker.get_account() if broker and broker.is_connected else None
        
        # Calculate totals from positions
        total_market_value = sum(p.market_value for p in positions)
        total_unrealized_pnl = sum(p.unrealized_pnl for p in positions)
        
        # Use real broker data, fail-fast if unavailable
        if account:
            cash = account.cash
            equity = account.equity
        else:
            logger.warning("Broker not connected — cash/equity unavailable")
            cash = 0.0
            equity = 0.0
        
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
            cash=cash,
            equity=equity,
            total_market_value=total_market_value,
            realized_pnl=0.0,
            unrealized_pnl=total_unrealized_pnl,
            total_pnl=total_unrealized_pnl,
            return_pct=(total_unrealized_pnl / equity * 100) if equity > 0 else 0.0,
            positions=pos_responses,
        )
    except Exception as e:
        logger.error(f"Portfolio fetch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Stale-while-revalidate positions cache.
#   - Fresh (≤ FRESH_TTL): return cache instantly, no refetch.
#   - Stale  (≤ STALE_TTL): return cache instantly, kick off background refresh.
#   - Expired (> STALE_TTL): synchronously fetch from Alpaca.
# Alpaca paper API can take 3-7s on a single call.
import asyncio as _asyncio
_positions_cache: Dict[str, Any] = {"data": None, "ts": 0.0}
_POSITIONS_FRESH_S = 5.0
_POSITIONS_STALE_S = 60.0
_positions_refresh_lock = _asyncio.Lock()


async def _refresh_positions_from_alpaca() -> Optional[List[PositionResponse]]:
    import os as _os
    import time as _t
    import httpx
    key_id = _os.environ.get("APCA_API_KEY_ID")
    secret = _os.environ.get("APCA_API_SECRET_KEY")
    if not (key_id and secret):
        return None
    endpoint = _os.environ.get("APCA_ENDPOINT", "https://paper-api.alpaca.markets")
    headers = {"APCA-API-KEY-ID": key_id, "APCA-API-SECRET-KEY": secret}
    async with _positions_refresh_lock:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(f"{endpoint}/v2/positions", headers=headers)
        except Exception as e:
            logger.warning(f"Alpaca positions HTTP error: {e}")
            return None
        if r.status_code != 200:
            return None
        raw = r.json() or []
        out: List[PositionResponse] = []
        for p in raw:
            qty = float(p.get("qty") or 0)
            avg = float(p.get("avg_entry_price") or 0)
            cur = float(p.get("current_price") or 0)
            mv = float(p.get("market_value") or qty * cur)
            upl = float(p.get("unrealized_pl") or (mv - qty * avg))
            upl_pct = float(p.get("unrealized_plpc") or 0) * 100
            out.append(PositionResponse(
                symbol=p.get("symbol", ""),
                quantity=qty, avg_cost=avg, current_price=cur, market_value=mv,
                unrealized_pnl=upl, unrealized_pnl_pct=upl_pct,
                side=p.get("side", "long"),
                asset_class=p.get("asset_class", "us_equity"),
                underlying=None, dte=None, managed=False, run_id=None,
            ))
        _positions_cache["data"] = out
        _positions_cache["ts"] = _t.time()
        return out


@router.get("/positions", response_model=List[PositionResponse])
async def get_positions():
    """Stale-while-revalidate Alpaca positions. Always returns fast."""
    import os as _os
    import time as _t
    now = _t.time()
    cached = _positions_cache["data"]
    age = now - _positions_cache["ts"] if cached is not None else 1e9

    if cached is not None and age < _POSITIONS_FRESH_S:
        return cached
    if cached is not None and age < _POSITIONS_STALE_S:
        # Serve stale, refresh in background
        try:
            _asyncio.create_task(_refresh_positions_from_alpaca())
        except RuntimeError:
            pass
        return cached

    fresh = await _refresh_positions_from_alpaca()
    if fresh is not None:
        return fresh
    if cached is not None:
        return cached

    key_id = _os.environ.get("APCA_API_KEY_ID")
    secret = _os.environ.get("APCA_API_SECRET_KEY")
    if key_id and secret:
        endpoint = _os.environ.get("APCA_ENDPOINT", "https://paper-api.alpaca.markets")
        headers = {"APCA-API-KEY-ID": key_id, "APCA-API-SECRET-KEY": secret}
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get(f"{endpoint}/v2/positions", headers=headers)
            if r.status_code == 200:
                raw = r.json() or []
                out = []
                for p in raw:
                    qty = float(p.get("qty") or 0)
                    avg = float(p.get("avg_entry_price") or 0)
                    cur = float(p.get("current_price") or 0)
                    mv = float(p.get("market_value") or qty * cur)
                    upl = float(p.get("unrealized_pl") or (mv - qty * avg))
                    upl_pct = float(p.get("unrealized_plpc") or 0) * 100
                    out.append(PositionResponse(
                        symbol=p.get("symbol", ""),
                        quantity=qty,
                        avg_cost=avg,
                        current_price=cur,
                        market_value=mv,
                        unrealized_pnl=upl,
                        unrealized_pnl_pct=upl_pct,
                        side=p.get("side", "long"),
                        asset_class=p.get("asset_class", "us_equity"),
                        underlying=None,
                        dte=None,
                        managed=False,
                        run_id=None,
                    ))
                import time as _t2
                _positions_cache["data"] = out
                _positions_cache["ts"] = _t2.time()
                return out
        except Exception as e:
            logger.warning(f"Alpaca positions fetch failed: {e}")

    # Fallback to broker_position_manager
    try:
        manager = get_broker_position_manager()
        positions = await manager.get_positions()
        return [
            PositionResponse(
                symbol=p.symbol, quantity=float(p.qty), avg_cost=p.avg_entry_price,
                current_price=p.current_price, market_value=p.market_value,
                unrealized_pnl=p.unrealized_pnl, unrealized_pnl_pct=p.unrealized_pnl_pct,
                side=p.side, asset_class=p.asset_class, underlying=p.underlying,
                dte=p.dte, managed=p.managed, run_id=p.run_id,
            )
            for p in positions
        ]
    except Exception as e:
        logger.warning(f"Position manager fallback failed: {e}")
        return []


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
        
        # Get real account data from broker
        from ...autopilot.alpaca_client import get_alpaca_client
        broker = get_alpaca_client()
        account = await broker.get_account() if broker and broker.is_connected else None
        
        # Calculate stats
        total_market_value = sum(p.market_value for p in positions)
        unrealized_pnl = sum(p.unrealized_pnl for p in positions)
        
        # Use real broker data
        if account:
            total_equity = account.equity
            total_cash = account.cash
            buying_power = account.buying_power
            day_pnl = account.equity - account.last_equity
        else:
            logger.warning("Broker not connected — account data unavailable")
            total_equity = 0.0
            total_cash = 0.0
            buying_power = 0.0
            day_pnl = 0.0
        
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
                "total_equity": total_equity,
                "total_cash": total_cash,
                "buying_power": buying_power,
                "open_pnl": unrealized_pnl,
                "day_pnl": day_pnl,
                "position_count": len(positions),
                "order_count": len(ord_list),
                "options_exposure": total_market_value,
                "broker_connected": account is not None,
            }
        }
    except Exception as e:
        logger.error(f"Unified portfolio error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics")
async def get_portfolio_metrics():
    """Get portfolio performance metrics from broker."""
    from ...autopilot.alpaca_client import get_alpaca_client
    broker = get_alpaca_client()
    account = await broker.get_account() if broker and broker.is_connected else None
    
    if account:
        return {
            "equity": account.equity,
            "cash": account.cash,
            "buying_power": account.buying_power,
            "sharpe_ratio": 0.0,  # TODO: compute from trade history
            "sortino_ratio": 0.0,
            "max_drawdown": 0.0,
            "total_return_pct": round((account.equity - account.last_equity) / account.last_equity * 100, 4) if account.last_equity > 0 else 0.0,
            "position_count": 0,
            "trade_count": 0,
            "broker_connected": True,
        }
    
    return {
        "equity": 0.0,
        "cash": 0.0,
        "buying_power": 0.0,
        "sharpe_ratio": 0.0,
        "sortino_ratio": 0.0,
        "max_drawdown": 0.0,
        "total_return_pct": 0.0,
        "position_count": 0,
        "trade_count": 0,
        "broker_connected": False,
    }


@router.get("/holdings")
async def get_holdings():
    """Alias for /positions — returns holdings in portfolio-friendly format."""
    positions = await get_positions()
    # Transform to holdings format expected by frontend
    holdings = []
    for pos in positions:
        holdings.append({
            "symbol": pos.symbol,
            "name": pos.symbol,  # fallback name
            "qty": pos.quantity,
            "avgPrice": pos.avg_cost,
            "mktPrice": pos.current_price,
            "sector": "Unknown",
            "weight": 0.0,  # computed below
            "beta": 1.0,
            "dailyReturn": 0.0,
            "totalReturn": pos.unrealized_pnl_pct,
        })
    # Compute weights
    total_value = sum(h["qty"] * h["mktPrice"] for h in holdings)
    if total_value > 0:
        for h in holdings:
            h["weight"] = round(h["qty"] * h["mktPrice"] / total_value * 100, 2)
    return {"holdings": holdings, "total_value": total_value}


@router.get("/performance")
async def get_performance(period: str = "1y"):
    """Portfolio performance history — equity curve + benchmark from Alpaca."""
    import os as _os
    import httpx
    metrics = await get_portfolio_metrics()

    # Map UI period to Alpaca portfolio/history params.
    period_map = {
        "1w":  ("1W",  "1H"),
        "1m":  ("1M",  "1D"),
        "3m":  ("3M",  "1D"),
        "6m":  ("6M",  "1D"),
        "ytd": ("1A",  "1D"),
        "1y":  ("1A",  "1D"),
        "all": ("ALL", "1D"),
    }
    p_param, tf_param = period_map.get(period.lower(), ("1A", "1D"))

    equity_curve: List[Dict[str, Any]] = []
    key_id = _os.environ.get("APCA_API_KEY_ID")
    secret = _os.environ.get("APCA_API_SECRET_KEY")
    endpoint = _os.environ.get("APCA_ENDPOINT", "https://paper-api.alpaca.markets")

    if key_id and secret:
        try:
            headers = {"APCA-API-KEY-ID": key_id, "APCA-API-SECRET-KEY": secret}
            async with httpx.AsyncClient(timeout=8.0) as client:
                r = await client.get(
                    f"{endpoint}/v2/account/portfolio/history",
                    params={"period": p_param, "timeframe": tf_param},
                    headers=headers,
                )
            if r.status_code == 200:
                hist = r.json() or {}
                ts = hist.get("timestamp") or []
                eq = hist.get("equity") or []
                base = hist.get("base_value") or (eq[0] if eq else 0) or 1
                from datetime import datetime as _dt
                for t, v in zip(ts, eq):
                    if v is None:
                        continue
                    iso = _dt.utcfromtimestamp(t).isoformat()
                    pnl_pct = ((float(v) - base) / base) * 100 if base else 0.0
                    equity_curve.append({
                        "date": iso[:10],
                        "timestamp": iso,
                        "equity": float(v),
                        "benchmark": float(v),    # placeholder until SPY series wired
                        "pnl_pct": round(pnl_pct, 4),
                    })
        except Exception as e:
            logger.warning(f"alpaca portfolio history failed: {e}")

    return {
        "equity_curve": equity_curve,
        "metrics": metrics,
        "period": period,
        "source": "alpaca" if equity_curve else "empty",
    }
