"""
Finnhub market data provider.

Uses finnhub-python SDK for real-time quotes.
Finnhub free tier has limited historical data, so it is quote-primary.
"""
from __future__ import annotations

import time
from datetime import datetime
from typing import Optional

import structlog

from .base import MarketDataProvider
from .types import (
    BarsRequest, BarsResponse, QuoteRequest, QuoteResponse,
    BarData, QuoteData, ProviderName,
)
from ..models import MarketDataError

logger = structlog.get_logger(__name__)


class FinnhubProvider(MarketDataProvider):
    """Finnhub quote provider (real-time quotes, limited bars)."""

    def __init__(self, api_key: str):
        super().__init__(ProviderName.FINNHUB)
        if not api_key:
            raise MarketDataError("MISSING_KEY", "FINNHUB_API_KEY required", "finnhub")
        self._api_key = api_key
        self._client: Optional[object] = None
        self._init_client()

    def _init_client(self):
        try:
            import finnhub
            self._client = finnhub.Client(api_key=self._api_key)
            logger.info("Finnhub client initialised")
        except ImportError:
            logger.warning("finnhub-python not installed; pip install finnhub-python")
            self._client = None

    async def get_quote(self, request: QuoteRequest) -> QuoteResponse:
        if self._client is None:
            raise MarketDataError("PROVIDER_UNAVAILABLE", "finnhub-python not installed", "finnhub", request.symbol)
        try:
            t0 = time.monotonic()
            q = self._client.quote(request.symbol.upper())
            elapsed = (time.monotonic() - t0) * 1000
            if not q or q.get("c", 0) == 0:
                raise MarketDataError("NO_DATA", f"No quote for {request.symbol}", "finnhub", request.symbol)
            quote = QuoteData(
                symbol=request.symbol.upper(),
                timestamp=datetime.utcnow(),
                price=q["c"],
                bid=None,
                ask=None,
                volume=None,
            )
            logger.info("finnhub_quote", symbol=request.symbol, price=q["c"], ms=round(elapsed, 1))
            return QuoteResponse(quote=quote, provider=self.provider_name, cached=False)
        except MarketDataError:
            raise
        except Exception as e:
            raise MarketDataError("FETCH_ERROR", str(e), "finnhub", request.symbol)

    async def get_bars(self, request: BarsRequest) -> BarsResponse:
        """Finnhub has limited free-tier historical data. Use yfinance for daily history."""
        raise MarketDataError(
            "NOT_SUPPORTED",
            "Finnhub free tier does not support extended daily history. Use yfinance.",
            "finnhub",
            request.symbol,
        )

    async def health_check(self) -> bool:
        if self._client is None:
            return False
        try:
            status = self._client.market_status(exchange="US")
            return status is not None
        except Exception:
            return False
