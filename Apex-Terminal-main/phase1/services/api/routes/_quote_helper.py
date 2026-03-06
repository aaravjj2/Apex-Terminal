"""
_quote_helper.py — Shared real-time quote fetching utility.

Used by market_data_v1_13.py and intelligence.py so neither falls back
to a hardcoded price=150.0.

Priority:
  1. Alpaca paper API (fastest, most accurate)
  2. yfinance (free, slightly slower)
  3. None — caller decides what to do (raise, default, etc.)
"""

from __future__ import annotations

import os
from typing import Optional

import structlog

logger = structlog.get_logger()


async def fetch_quote_alpaca(symbol: str) -> Optional[float]:
    """Try to get a real-time quote from Alpaca paper API."""
    try:
        key = os.getenv("APCA_API_KEY_ID", "")
        secret = os.getenv("APCA_API_SECRET_KEY", "")
        if not key or not secret:
            return None

        import httpx
        url = f"https://data.alpaca.markets/v2/stocks/{symbol}/trades/latest"
        headers = {"APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret}
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(url, headers=headers)
            if r.status_code == 200:
                price = r.json().get("trade", {}).get("p")
                if price:
                    return float(price)
    except Exception as e:
        logger.warning("alpaca_quote_failed", symbol=symbol, error=str(e))
    return None


async def fetch_quote_yfinance(symbol: str) -> Optional[float]:
    """Fallback: get quote via yfinance (sync wrapped in threadpool)."""
    try:
        import asyncio
        import yfinance as yf

        def _sync():
            info = yf.Ticker(symbol).fast_info
            p = getattr(info, "last_price", None) or getattr(info, "regularMarketPrice", None)
            return float(p) if p else None

        return await asyncio.get_event_loop().run_in_executor(None, _sync)
    except Exception as e:
        logger.warning("yfinance_quote_failed", symbol=symbol, error=str(e))
    return None


async def get_real_quote(symbol: str) -> Optional[float]:
    """
    Return a real-time price or None (never a hardcoded fake).
    Alpaca → yfinance → None.
    """
    symbol = symbol.upper().strip()
    price = await fetch_quote_alpaca(symbol)
    if price is not None:
        return price
    price = await fetch_quote_yfinance(symbol)
    return price
