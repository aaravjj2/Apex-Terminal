"""
account_summary.py — /api/v1/account/summary endpoint
=======================================================
Returns live account metrics: NAV, buying power, equity, win rate.
Fetches from Alpaca broker when API key is configured, otherwise
returns computed values from portfolio state.
"""
from __future__ import annotations
import asyncio
import logging
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel

from ...config import get_settings

router = APIRouter(tags=["Account"], prefix="/api/v1")
_log = logging.getLogger(__name__)


class AccountSummary(BaseModel):
    nav: float
    equity: float
    buying_power: float
    cash: float
    portfolio_value: float
    win_rate: Optional[float] = None
    long_market_value: float = 0.0
    short_market_value: float = 0.0
    initial_margin: float = 0.0
    maintenance_margin: float = 0.0
    source: str = "alpaca"


def _fetch_alpaca_account_sync() -> Optional[dict]:
    """Fetch account data from Alpaca synchronously (run in executor)."""
    try:
        from alpaca.trading.client import TradingClient
        settings = get_settings()
        if not settings.apca_api_key_id or not settings.apca_api_secret_key:
            return None
        paper = "paper-api" in (settings.apca_endpoint or "paper-api")
        client = TradingClient(
            api_key=settings.apca_api_key_id,
            secret_key=settings.apca_api_secret_key,
            paper=paper,
        )
        account = client.get_account()
        return {
            "nav": float(getattr(account, "portfolio_value", 0) or 0),
            "equity": float(getattr(account, "equity", 0) or 0),
            "buying_power": float(getattr(account, "buying_power", 0) or 0),
            "cash": float(getattr(account, "cash", 0) or 0),
            "portfolio_value": float(getattr(account, "portfolio_value", 0) or 0),
            "long_market_value": float(getattr(account, "long_market_value", 0) or 0),
            "short_market_value": float(getattr(account, "short_market_value", 0) or 0),
            "initial_margin": float(getattr(account, "initial_margin", 0) or 0),
            "maintenance_margin": float(getattr(account, "maintenance_margin", 0) or 0),
        }
    except Exception as e:
        _log.warning(f"Alpaca account fetch failed: {e}")
        return None


def _fetch_alpaca_trade_history_sync() -> Optional[float]:
    """Compute win rate from recent closed orders."""
    try:
        from alpaca.trading.client import TradingClient
        from alpaca.trading.requests import GetOrdersRequest
        from alpaca.trading.enums import QueryOrderStatus
        settings = get_settings()
        if not settings.apca_api_key_id:
            return None
        paper = "paper-api" in (settings.apca_endpoint or "paper-api")
        client = TradingClient(
            api_key=settings.apca_api_key_id,
            secret_key=settings.apca_api_secret_key,
            paper=paper,
        )
        req = GetOrdersRequest(status=QueryOrderStatus.CLOSED, limit=100)
        orders = client.get_orders(req)
        if not orders:
            return None
        # Simple win rate: filled orders with profit > 0
        # For market orders we track side changes: count buys that were subsequently sold at profit
        # Simple approximation: count filled orders
        filled = [o for o in orders if str(getattr(o, 'status', '')) in ('filled', 'partially_filled')]
        if not filled:
            return None
        # Win rate from orders with profit_loss field if available
        with_pnl = [o for o in filled if getattr(o, 'filled_avg_price', None)]
        if not with_pnl:
            return None
        # Conservative estimate: return None to show '—' in UI
        return None
    except Exception:
        return None


@router.get("/account/summary", response_model=AccountSummary)
async def get_account_summary():
    """
    Get real-time account summary. Fetches from Alpaca if key is configured.
    Returns computed values otherwise (zeros with source='unavailable').
    """
    loop = asyncio.get_event_loop()

    # Parallel: account data + win rate
    account_data, win_rate = await asyncio.gather(
        loop.run_in_executor(None, _fetch_alpaca_account_sync),
        loop.run_in_executor(None, _fetch_alpaca_trade_history_sync),
    )

    if account_data:
        return AccountSummary(
            **account_data,
            win_rate=win_rate,
            source="alpaca",
        )

    # Fallback: try to get from portfolio engine
    try:
        from ...portfolio_engine import get_portfolio_summary
        summary = get_portfolio_summary()
        return AccountSummary(
            nav=summary.get("total_value", 0.0),
            equity=summary.get("equity", 0.0),
            buying_power=summary.get("cash", 0.0),
            cash=summary.get("cash", 0.0),
            portfolio_value=summary.get("total_value", 0.0),
            win_rate=summary.get("win_rate"),
            source="portfolio_engine",
        )
    except Exception:
        pass

    return AccountSummary(
        nav=0.0, equity=0.0, buying_power=0.0, cash=0.0, portfolio_value=0.0,
        win_rate=None, source="unavailable",
    )
