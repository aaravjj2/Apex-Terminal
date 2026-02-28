"""
Tiingo market data provider.

Uses Tiingo REST API for daily historical bars and real-time IEX quotes.
"""
from __future__ import annotations

import time
from datetime import datetime, timedelta
from typing import Optional, List

import httpx
import structlog

from .base import MarketDataProvider
from .types import (
    BarsRequest, BarsResponse, QuoteRequest, QuoteResponse,
    BarData, QuoteData, ProviderName,
)
from ..models import MarketDataError

logger = structlog.get_logger(__name__)

TIINGO_REST = "https://api.tiingo.com"
TIINGO_IEX  = "https://api.tiingo.com/iex"


class TiingoProvider(MarketDataProvider):
    """Tiingo provider — daily history + IEX real-time quotes."""

    def __init__(self, api_key: str):
        super().__init__(ProviderName.TIINGO)
        if not api_key:
            raise MarketDataError("MISSING_KEY", "TIINGO_API_KEY required", "tiingo")
        self._api_key = api_key
        self._headers = {
            "Content-Type": "application/json",
            "Authorization": f"Token {api_key}",
        }

    async def get_quote(self, request: QuoteRequest) -> QuoteResponse:
        try:
            t0 = time.monotonic()
            url = f"{TIINGO_IEX}/{request.symbol.upper()}"
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(url, headers=self._headers)
                resp.raise_for_status()
                data = resp.json()
            elapsed = (time.monotonic() - t0) * 1000
            if not data:
                raise MarketDataError("NO_DATA", f"No IEX quote for {request.symbol}", "tiingo", request.symbol)
            item = data[0] if isinstance(data, list) else data
            price = item.get("last") or item.get("tngoLast") or 0
            if price == 0:
                raise MarketDataError("NO_DATA", f"Zero price for {request.symbol}", "tiingo", request.symbol)
            quote = QuoteData(
                symbol=request.symbol.upper(),
                timestamp=datetime.utcnow(),
                price=float(price),
                bid=float(item["bidPrice"]) if item.get("bidPrice") else None,
                ask=float(item["askPrice"]) if item.get("askPrice") else None,
                volume=float(item.get("volume", 0)) if item.get("volume") else None,
            )
            logger.info("tiingo_quote", symbol=request.symbol, price=price, ms=round(elapsed, 1))
            return QuoteResponse(quote=quote, provider=self.provider_name, cached=False)
        except MarketDataError:
            raise
        except Exception as e:
            raise MarketDataError("FETCH_ERROR", str(e), "tiingo", request.symbol)

    async def get_bars(self, request: BarsRequest) -> BarsResponse:
        """Tiingo daily end-of-day bars — excellent for multi-year history."""
        try:
            t0 = time.monotonic()
            end_dt = request.end or datetime.utcnow()
            start_dt = request.start or (end_dt - timedelta(days=365 * 7))
            url = f"{TIINGO_REST}/tiingo/daily/{request.symbol.upper()}/prices"
            params = {
                "startDate": start_dt.strftime("%Y-%m-%d"),
                "endDate": end_dt.strftime("%Y-%m-%d"),
            }
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(url, headers=self._headers, params=params)
                resp.raise_for_status()
                data = resp.json()
            elapsed = (time.monotonic() - t0) * 1000
            bars: List[BarData] = []
            for row in data:
                ts_str = row.get("date", "")
                try:
                    ts = datetime.fromisoformat(ts_str.replace("T00:00:00.000Z", "").replace("T00:00:00+00:00", ""))
                except (ValueError, AttributeError):
                    ts = datetime.utcnow()
                bars.append(BarData(
                    timestamp=ts,
                    open=float(row["open"]),
                    high=float(row["high"]),
                    low=float(row["low"]),
                    close=float(row["close"]),
                    volume=int(row.get("volume", 0)),
                ))
            logger.info("tiingo_bars", symbol=request.symbol, count=len(bars), ms=round(elapsed, 1))
            return BarsResponse(symbol=request.symbol.upper(), bars=bars, provider=self.provider_name, cached=False)
        except MarketDataError:
            raise
        except Exception as e:
            raise MarketDataError("FETCH_ERROR", str(e), "tiingo", request.symbol)

    async def health_check(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{TIINGO_REST}/api/test",
                    headers=self._headers,
                )
                return resp.status_code == 200
        except Exception:
            return False
