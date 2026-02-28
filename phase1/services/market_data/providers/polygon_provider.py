"""
Polygon.io market data provider.

Uses polygon-api-client for real-time quotes and intraday bars.
"""
from __future__ import annotations

import time
from datetime import datetime, timedelta
from typing import Optional, List

import structlog

from .base import MarketDataProvider
from .types import (
    BarsRequest, BarsResponse, QuoteRequest, QuoteResponse,
    BarData, QuoteData, ProviderName,
)
from ..models import MarketDataError

logger = structlog.get_logger(__name__)


class PolygonProvider(MarketDataProvider):
    """Polygon.io provider — quotes and limited daily bars."""

    def __init__(self, api_key: str):
        super().__init__(ProviderName.POLYGON)
        if not api_key:
            raise MarketDataError("MISSING_KEY", "POLYGON_API_KEY required", "polygon")
        self._api_key = api_key
        self._rest_client: Optional[object] = None
        self._init_client()

    def _init_client(self):
        try:
            from polygon import RESTClient
            self._rest_client = RESTClient(api_key=self._api_key)
            logger.info("Polygon REST client initialised")
        except ImportError:
            logger.warning("polygon-api-client not installed; pip install polygon-api-client")
            self._rest_client = None

    async def get_quote(self, request: QuoteRequest) -> QuoteResponse:
        if self._rest_client is None:
            raise MarketDataError("PROVIDER_UNAVAILABLE", "polygon-api-client not installed", "polygon", request.symbol)
        try:
            t0 = time.monotonic()
            snap = self._rest_client.get_snapshot_ticker(
                "stocks", request.symbol.upper()
            )
            elapsed = (time.monotonic() - t0) * 1000
            if snap is None:
                raise MarketDataError("NO_DATA", f"No snapshot for {request.symbol}", "polygon", request.symbol)
            last_trade = getattr(snap, "last_trade", None)
            last_quote = getattr(snap, "last_quote", None)
            price = getattr(last_trade, "price", 0) if last_trade else 0
            bid = getattr(last_quote, "bid_price", None) if last_quote else None
            ask = getattr(last_quote, "ask_price", None) if last_quote else None
            if price == 0:
                raise MarketDataError("NO_DATA", f"Zero price for {request.symbol}", "polygon", request.symbol)
            quote = QuoteData(
                symbol=request.symbol.upper(),
                timestamp=datetime.utcnow(),
                price=price,
                bid=bid,
                ask=ask,
                volume=None,
            )
            logger.info("polygon_quote", symbol=request.symbol, price=price, ms=round(elapsed, 1))
            return QuoteResponse(quote=quote, provider=self.provider_name, cached=False)
        except MarketDataError:
            raise
        except Exception as e:
            raise MarketDataError("FETCH_ERROR", str(e), "polygon", request.symbol)

    async def get_bars(self, request: BarsRequest) -> BarsResponse:
        """Polygon free-tier daily bars (limited calls/min)."""
        if self._rest_client is None:
            raise MarketDataError("PROVIDER_UNAVAILABLE", "polygon-api-client not installed", "polygon", request.symbol)
        try:
            t0 = time.monotonic()
            end_dt = request.end or datetime.utcnow()
            start_dt = request.start or (end_dt - timedelta(days=365))
            aggs = list(self._rest_client.list_aggs(
                ticker=request.symbol.upper(),
                multiplier=1,
                timespan="day",
                from_=start_dt.strftime("%Y-%m-%d"),
                to=end_dt.strftime("%Y-%m-%d"),
                limit=50000,
            ))
            elapsed = (time.monotonic() - t0) * 1000
            bars: List[BarData] = []
            for a in aggs:
                ts = datetime.utcfromtimestamp(a.timestamp / 1000.0) if a.timestamp else datetime.utcnow()
                bars.append(BarData(
                    timestamp=ts,
                    open=float(a.open),
                    high=float(a.high),
                    low=float(a.low),
                    close=float(a.close),
                    volume=int(a.volume) if a.volume else 0,
                ))
            logger.info("polygon_bars", symbol=request.symbol, count=len(bars), ms=round(elapsed, 1))
            return BarsResponse(symbol=request.symbol.upper(), bars=bars, provider=self.provider_name, cached=False)
        except MarketDataError:
            raise
        except Exception as e:
            raise MarketDataError("FETCH_ERROR", str(e), "polygon", request.symbol)

    async def health_check(self) -> bool:
        if self._rest_client is None:
            return False
        try:
            status = self._rest_client.get_market_status()
            return status is not None
        except Exception:
            return False
