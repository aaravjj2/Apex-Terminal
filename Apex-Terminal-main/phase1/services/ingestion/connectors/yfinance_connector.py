"""
yfinance connector for historical data.
"""

import asyncio
from datetime import datetime, timezone, timedelta
from typing import AsyncIterator, Optional
import structlog

from .base import BaseConnector
from ...models import RawTick


logger = structlog.get_logger()


class YFinanceConnector(BaseConnector):
    """
    yfinance connector for historical market data.
    Primarily used for backfilling historical data.
    Note: yfinance provides OHLCV bars, not individual ticks.
    """
    
    def __init__(self):
        """Initialize yfinance connector."""
        super().__init__(name="yfinance")
        self._yf = None
    
    async def connect(self) -> None:
        """Import yfinance (lazy load)."""
        try:
            import yfinance as yf
            self._yf = yf
            self._running = True
            self.logger.info("yfinance_connected")
        except ImportError:
            raise RuntimeError("yfinance not installed. Run: pip install yfinance")
    
    async def disconnect(self) -> None:
        """Disconnect (no-op for yfinance)."""
        self._running = False
        self.logger.info("yfinance_disconnected")
    
    async def subscribe(self, symbols: list[str]) -> None:
        """Subscribe to symbols (no-op for historical connector)."""
        self.logger.info("yfinance_subscribe_noop", symbols=symbols)
    
    async def unsubscribe(self, symbols: list[str]) -> None:
        """Unsubscribe (no-op for historical connector)."""
        pass
    
    async def get_historical_ticks(
        self,
        symbol: str,
        start_ms: int,
        end_ms: int,
    ) -> AsyncIterator[RawTick]:
        """
        Fetch historical data and convert to tick-like format.
        
        Note: yfinance provides OHLCV bars, not individual ticks.
        We generate synthetic ticks from 1-minute bars for compatibility.
        Each bar generates 4 ticks (OHLC) distributed within the minute.
        """
        if not self._yf:
            raise RuntimeError("yfinance not initialized")
        
        # Convert timestamps
        start_dt = datetime.fromtimestamp(start_ms / 1000, tz=timezone.utc)
        end_dt = datetime.fromtimestamp(end_ms / 1000, tz=timezone.utc)
        
        # yfinance wants date strings
        start_str = start_dt.strftime("%Y-%m-%d")
        end_str = (end_dt + timedelta(days=1)).strftime("%Y-%m-%d")  # Inclusive
        
        self.logger.info("yfinance_fetch_start", 
                        symbol=symbol, 
                        start=start_str, 
                        end=end_str)
        
        try:
            # Run yfinance in thread pool (it's synchronous)
            loop = asyncio.get_event_loop()
            data = await loop.run_in_executor(
                None,
                self._fetch_data,
                symbol,
                start_str,
                end_str,
            )
            
            if data is None or data.empty:
                self.logger.warning("yfinance_no_data", symbol=symbol)
                return
            
            # Convert bars to ticks
            for idx, row in data.iterrows():
                # Get timestamp in ms
                if hasattr(idx, 'timestamp'):
                    ts_ms = int(idx.timestamp() * 1000)
                else:
                    ts_ms = int(idx * 1000)
                
                # Filter by time range
                if ts_ms < start_ms or ts_ms >= end_ms:
                    continue
                
                # Generate single tick per bar using close price
                # This preserves volume correctly
                tick = RawTick(
                    source="yfinance",
                    symbol=symbol,
                    ts_ms=ts_ms,
                    price=float(row["Close"]),
                    size=float(row.get("Volume", 0)),
                    raw_data={
                        "open": float(row["Open"]),
                        "high": float(row["High"]),
                        "low": float(row["Low"]),
                        "close": float(row["Close"]),
                        "volume": float(row.get("Volume", 0)),
                    },
                )
                yield tick
            
            self.logger.info("yfinance_fetch_complete", symbol=symbol)
            
        except Exception as e:
            self.logger.error("yfinance_fetch_error", symbol=symbol, error=str(e))
            raise
    
    def _fetch_data(self, symbol: str, start: str, end: str):
        """Synchronous data fetch (run in executor)."""
        ticker = self._yf.Ticker(symbol)
        return ticker.history(
            start=start,
            end=end,
            interval="1m",
            prepost=True,  # Include pre/post market
        )
    
    async def get_historical_bars(
        self,
        symbol: str,
        interval: str,
        start_ms: int,
        end_ms: int,
    ) -> AsyncIterator[dict]:
        """
        Fetch historical OHLCV bars directly.
        
        Args:
            symbol: Stock symbol
            interval: Bar interval ('1m', '5m', '15m', '1h', '1d', etc.)
            start_ms: Start timestamp in UTC milliseconds
            end_ms: End timestamp in UTC milliseconds
        """
        if not self._yf:
            raise RuntimeError("yfinance not initialized")
        
        # Map interval to yfinance format
        interval_map = {
            "1m": "1m",
            "5m": "5m",
            "15m": "15m",
            "1h": "1h",
            "1d": "1d",
        }
        yf_interval = interval_map.get(interval, "1m")
        
        start_dt = datetime.fromtimestamp(start_ms / 1000, tz=timezone.utc)
        end_dt = datetime.fromtimestamp(end_ms / 1000, tz=timezone.utc)
        
        start_str = start_dt.strftime("%Y-%m-%d")
        end_str = (end_dt + timedelta(days=1)).strftime("%Y-%m-%d")
        
        try:
            loop = asyncio.get_event_loop()
            data = await loop.run_in_executor(
                None,
                lambda: self._yf.Ticker(symbol).history(
                    start=start_str,
                    end=end_str,
                    interval=yf_interval,
                    prepost=True,
                ),
            )
            
            if data is None or data.empty:
                return
            
            for idx, row in data.iterrows():
                if hasattr(idx, 'timestamp'):
                    ts_ms = int(idx.timestamp() * 1000)
                else:
                    ts_ms = int(idx * 1000)
                
                if ts_ms < start_ms or ts_ms >= end_ms:
                    continue
                
                yield {
                    "symbol": symbol,
                    "timeframe": interval,
                    "ts_start_ms": ts_ms,
                    "open": float(row["Open"]),
                    "high": float(row["High"]),
                    "low": float(row["Low"]),
                    "close": float(row["Close"]),
                    "volume": float(row.get("Volume", 0)),
                }
                
        except Exception as e:
            self.logger.error("yfinance_bars_error", symbol=symbol, error=str(e))
            raise
    
    async def get_ticker_info(self, symbol: str) -> Optional[dict]:
        """Get ticker information."""
        if not self._yf:
            raise RuntimeError("yfinance not initialized")
        
        try:
            loop = asyncio.get_event_loop()
            ticker = self._yf.Ticker(symbol)
            info = await loop.run_in_executor(None, lambda: ticker.info)
            return info
        except Exception as e:
            self.logger.error("yfinance_info_error", symbol=symbol, error=str(e))
            return None
