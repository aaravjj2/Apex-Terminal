"""
Yahoo Finance market data provider.

Uses yfinance library to fetch live data, with disk caching for determinism.
Only enabled in LOCAL mode (not DEMO mode).
"""

from datetime import datetime
from typing import List, Optional
import structlog
import os

from .base import MarketDataProvider
from .types import (
    BarsRequest, BarsResponse, QuoteRequest, QuoteResponse,
    BarData, QuoteData, ProviderName, IntervalType
)
from .cache import get_cache

logger = structlog.get_logger(__name__)


class YahooProvider(MarketDataProvider):
    """Yahoo Finance provider with caching."""
    
    def __init__(self):
        super().__init__(ProviderName.YAHOO)
        self.cache = get_cache()
        self._check_yfinance()
    
    def _check_yfinance(self):
        """Check if yfinance is available."""
        try:
            import yfinance
            self.yfinance = yfinance
            logger.info("yfinance library loaded successfully")
        except ImportError:
            logger.warning("yfinance not installed. Yahoo provider will fail.")
            self.yfinance = None
    
    def _map_interval(self, interval: IntervalType) -> str:
        """Map our interval to yfinance interval."""
        mapping = {
            IntervalType.MIN_1: "1m",
            IntervalType.MIN_5: "5m",
            IntervalType.MIN_15: "15m",
            IntervalType.MIN_30: "30m",
            IntervalType.HOUR_1: "1h",
            IntervalType.HOUR_4: "4h",
            IntervalType.DAY_1: "1d",
            IntervalType.WEEK_1: "1wk",
            IntervalType.MONTH_1: "1mo"
        }
        return mapping.get(interval, "1d")
    
    async def get_bars(self, request: BarsRequest) -> BarsResponse:
        """
        Fetch bars from Yahoo Finance with caching.
        
        Cache key = (provider, symbol, start, end, interval)
        """
        if self.yfinance is None:
            raise RuntimeError("yfinance library not available")
        
        # Check cache first
        cache_key_params = {
            "provider": self.provider_name.value,
            "symbol": request.symbol,
            "start": request.start,
            "end": request.end,
            "interval": request.interval.value
        }
        
        cached_data = self.cache.get(**cache_key_params)
        if cached_data is not None:
            logger.info(f"Cache hit for {request.symbol} {request.interval}")
            # Reconstruct BarsResponse from cached data
            bars = [BarData(**bar) for bar in cached_data["bars"]]
            return BarsResponse(
                symbol=request.symbol,
                bars=bars,
                provider=self.provider_name,
                cached=True
            )
        
        # Cache miss - fetch from Yahoo
        logger.info(f"Cache miss for {request.symbol} {request.interval}, fetching from Yahoo...")
        
        try:
            ticker = self.yfinance.Ticker(request.symbol)
            yf_interval = self._map_interval(request.interval)
            
            # Download data
            hist = ticker.history(
                start=request.start,
                end=request.end,
                interval=yf_interval
            )
            
            bars = []
            for index, row in hist.iterrows():
                bar = BarData(
                    timestamp=index.to_pydatetime(),
                    open=float(row['Open']),
                    high=float(row['High']),
                    low=float(row['Low']),
                    close=float(row['Close']),
                    volume=int(row['Volume'])
                )
                bars.append(bar)
            
            logger.info(f"Downloaded {len(bars)} bars for {request.symbol}")
            
            # Cache the result
            cache_data = {
                "symbol": request.symbol,
                "bars": [bar.dict() for bar in bars],
                "provider": self.provider_name.value
            }
            self.cache.set(cache_data, **cache_key_params)
            
            return BarsResponse(
                symbol=request.symbol,
                bars=bars,
                provider=self.provider_name,
                cached=False
            )
        
        except Exception as e:
            logger.error(f"Yahoo fetch error for {request.symbol}: {e}")
            raise RuntimeError(f"Failed to fetch data from Yahoo: {e}")
    
    async def get_quote(self, request: QuoteRequest) -> QuoteResponse:
        """
        Get real-time quote from Yahoo Finance.
        
        For simplicity, we fetch the most recent 1-day bar and use its close.
        """
        if self.yfinance is None:
            raise RuntimeError("yfinance library not available")
        
        # Check cache first (quotes cached for 1 minute)
        from datetime import timedelta
        now = datetime.utcnow()
        cache_key_params = {
            "provider": self.provider_name.value,
            "symbol": request.symbol,
            "type": "quote",
            "minute": now.replace(second=0, microsecond=0)  # Cache per minute
        }
        
        cached_data = self.cache.get(**cache_key_params)
        if cached_data is not None:
            logger.info(f"Cache hit for quote {request.symbol}")
            quote = QuoteData(**cached_data["quote"])
            return QuoteResponse(
                quote=quote,
                provider=self.provider_name,
                cached=True
            )
        
        # Cache miss - fetch from Yahoo
        logger.info(f"Cache miss for quote {request.symbol}, fetching from Yahoo...")
        
        try:
            ticker = self.yfinance.Ticker(request.symbol)
            info = ticker.info
            
            # Get last close price
            hist = ticker.history(period="1d")
            if hist.empty:
                raise ValueError(f"No data available for {request.symbol}")
            
            last_close = float(hist['Close'].iloc[-1])
            last_timestamp = hist.index[-1].to_pydatetime()
            
            quote = QuoteData(
                symbol=request.symbol,
                timestamp=last_timestamp,
                price=last_close,
                bid=info.get('bid'),
                ask=info.get('ask'),
                volume=info.get('volume')
            )
            
            # Cache the quote
            cache_data = {
                "quote": quote.dict(),
                "provider": self.provider_name.value
            }
            self.cache.set(cache_data, **cache_key_params)
            
            return QuoteResponse(
                quote=quote,
                provider=self.provider_name,
                cached=False
            )
        
        except Exception as e:
            logger.error(f"Yahoo quote error for {request.symbol}: {e}")
            raise RuntimeError(f"Failed to fetch quote from Yahoo: {e}")
    
    async def health_check(self) -> bool:
        """Check if Yahoo Finance is accessible."""
        if self.yfinance is None:
            return False
        
        try:
            # Try to fetch a dummy ticker (minimal request)
            ticker = self.yfinance.Ticker("AAPL")
            info = ticker.info
            return info is not None
        except Exception as e:
            logger.warning(f"Yahoo health check failed: {e}")
            return False
