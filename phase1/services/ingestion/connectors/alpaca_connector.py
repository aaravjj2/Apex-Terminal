"""
Alpaca connector for paper trading REST API.
"""

import asyncio
from datetime import datetime, timezone
from typing import AsyncIterator, Optional
import httpx
import structlog

from .base import BaseConnector
from ...models import RawTick
from ...config import get_settings


logger = structlog.get_logger()


class AlpacaConnector(BaseConnector):
    """
    Alpaca Markets data connector.
    Uses paper trading REST API for tick/trade data.
    """
    
    DATA_URL = "https://data.alpaca.markets"
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        api_secret: Optional[str] = None,
        endpoint: Optional[str] = None,
    ):
        """
        Initialize Alpaca connector.
        
        Args:
            api_key: Alpaca API key (defaults to env var)
            api_secret: Alpaca API secret (defaults to env var)
            endpoint: API endpoint (paper or live)
        """
        super().__init__(name="alpaca")
        settings = get_settings()
        
        self.api_key = api_key or settings.apca_api_key_id
        self.api_secret = api_secret or settings.apca_api_secret_key
        self.endpoint = endpoint or settings.apca_endpoint
        
        if not self.api_key or not self.api_secret:
            self.logger.warning("no_api_credentials", msg="Alpaca credentials not configured")
        
        self._http_client: Optional[httpx.AsyncClient] = None
        self._subscribed_symbols: set[str] = set()
        self._poll_task: Optional[asyncio.Task] = None
        self._poll_interval = 1.0  # seconds
    
    def _get_headers(self) -> dict:
        """Get API authentication headers."""
        return {
            "APCA-API-KEY-ID": self.api_key or "",
            "APCA-API-SECRET-KEY": self.api_secret or "",
        }
    
    async def connect(self) -> None:
        """Initialize HTTP client."""
        if not self.api_key or not self.api_secret:
            raise ValueError("Alpaca API credentials required")
        
        self._http_client = httpx.AsyncClient(
            timeout=30.0,
            headers=self._get_headers(),
        )
        self._running = True
        self.logger.info("alpaca_connected", endpoint=self.endpoint)
    
    async def disconnect(self) -> None:
        """Close HTTP client."""
        self._running = False
        
        if self._poll_task:
            self._poll_task.cancel()
            try:
                await self._poll_task
            except asyncio.CancelledError:
                pass
            self._poll_task = None
        
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None
        
        self._subscribed_symbols.clear()
        self.logger.info("alpaca_disconnected")
    
    async def subscribe(self, symbols: list[str]) -> None:
        """
        Subscribe to symbols for polling.
        Alpaca REST doesn't have true streaming, so we poll.
        """
        self._subscribed_symbols.update(symbols)
        
        # Start polling if not already running
        if not self._poll_task and self._running:
            self._poll_task = asyncio.create_task(self._poll_loop())
        
        self.logger.info("alpaca_subscribed", symbols=symbols)
    
    async def unsubscribe(self, symbols: list[str]) -> None:
        """Unsubscribe from symbols."""
        self._subscribed_symbols.difference_update(symbols)
        
        # Stop polling if no symbols left
        if not self._subscribed_symbols and self._poll_task:
            self._poll_task.cancel()
            try:
                await self._poll_task
            except asyncio.CancelledError:
                pass
            self._poll_task = None
        
        self.logger.info("alpaca_unsubscribed", symbols=symbols)
    
    async def _poll_loop(self) -> None:
        """Poll for latest trades at regular intervals."""
        try:
            while self._running and self._subscribed_symbols:
                try:
                    for symbol in list(self._subscribed_symbols):
                        await self._fetch_latest_trade(symbol)
                    await asyncio.sleep(self._poll_interval)
                except Exception as e:
                    self.logger.error("poll_error", error=str(e))
                    await asyncio.sleep(5)  # Back off on error
        except asyncio.CancelledError:
            pass
    
    async def _fetch_latest_trade(self, symbol: str) -> None:
        """Fetch and emit latest trade for a symbol."""
        if not self._http_client:
            return
        
        url = f"{self.DATA_URL}/v2/stocks/{symbol}/trades/latest"
        
        try:
            response = await self._http_client.get(url)
            response.raise_for_status()
            data = response.json()
            
            trade = data.get("trade", {})
            if trade:
                # Parse timestamp (ISO 8601)
                ts_str = trade.get("t", "")
                ts_ms = self._parse_timestamp(ts_str)
                
                tick = RawTick(
                    source="alpaca",
                    symbol=symbol,
                    ts_ms=ts_ms,
                    price=trade.get("p", 0),
                    size=trade.get("s", 0),
                    raw_data=trade,
                )
                await self._emit_tick(tick)
        except httpx.HTTPStatusError as e:
            if e.response.status_code != 404:  # Ignore 404 for no trades
                self.logger.warning("fetch_trade_error", symbol=symbol, status=e.response.status_code)
        except Exception as e:
            self.logger.error("fetch_trade_error", symbol=symbol, error=str(e))
    
    async def get_historical_ticks(
        self,
        symbol: str,
        start_ms: int,
        end_ms: int,
    ) -> AsyncIterator[RawTick]:
        """
        Fetch historical trades from Alpaca.
        Uses pagination to handle large date ranges.
        """
        if not self._http_client:
            self._http_client = httpx.AsyncClient(
                timeout=30.0,
                headers=self._get_headers(),
            )
        
        # Convert to RFC 3339 format
        start_dt = datetime.fromtimestamp(start_ms / 1000, tz=timezone.utc)
        end_dt = datetime.fromtimestamp(end_ms / 1000, tz=timezone.utc)
        
        url = f"{self.DATA_URL}/v2/stocks/{symbol}/trades"
        params = {
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat(),
            "limit": 10000,
        }
        
        page_token = None
        total_fetched = 0
        
        while True:
            if page_token:
                params["page_token"] = page_token
            
            try:
                response = await self._http_client.get(url, params=params)
                response.raise_for_status()
                data = response.json()
                
                trades = data.get("trades", [])
                for trade in trades:
                    ts_ms = self._parse_timestamp(trade.get("t", ""))
                    tick = RawTick(
                        source="alpaca",
                        symbol=symbol,
                        ts_ms=ts_ms,
                        price=trade.get("p", 0),
                        size=trade.get("s", 0),
                        side=self._map_side(trade.get("c", [])),
                        raw_data=trade,
                    )
                    yield tick
                    total_fetched += 1
                
                # Check for more pages
                page_token = data.get("next_page_token")
                if not page_token or not trades:
                    break
                
                # Rate limiting
                await asyncio.sleep(0.2)
                
            except httpx.HTTPStatusError as e:
                self.logger.error("historical_fetch_error", 
                                symbol=symbol, 
                                status=e.response.status_code)
                break
            except Exception as e:
                self.logger.error("historical_fetch_error", symbol=symbol, error=str(e))
                break
        
        self.logger.info("historical_fetch_complete", 
                        symbol=symbol, 
                        total_fetched=total_fetched)
    
    async def get_historical_bars(
        self,
        symbol: str,
        timeframe: str,
        start_ms: int,
        end_ms: int,
    ) -> AsyncIterator[dict]:
        """
        Fetch historical bars directly from Alpaca.
        Useful for backfilling or verification.
        """
        if not self._http_client:
            self._http_client = httpx.AsyncClient(
                timeout=30.0,
                headers=self._get_headers(),
            )
        
        # Map timeframe to Alpaca format
        tf_map = {"1m": "1Min", "5m": "5Min", "15m": "15Min", "1h": "1Hour", "1d": "1Day"}
        alpaca_tf = tf_map.get(timeframe, "1Min")
        
        start_dt = datetime.fromtimestamp(start_ms / 1000, tz=timezone.utc)
        end_dt = datetime.fromtimestamp(end_ms / 1000, tz=timezone.utc)
        
        url = f"{self.DATA_URL}/v2/stocks/{symbol}/bars"
        params = {
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat(),
            "timeframe": alpaca_tf,
            "limit": 10000,
        }
        
        page_token = None
        
        while True:
            if page_token:
                params["page_token"] = page_token
            
            try:
                response = await self._http_client.get(url, params=params)
                response.raise_for_status()
                data = response.json()
                
                bars = data.get("bars", [])
                for bar in bars:
                    yield {
                        "symbol": symbol,
                        "timeframe": timeframe,
                        "ts_start_ms": self._parse_timestamp(bar.get("t", "")),
                        "open": bar.get("o"),
                        "high": bar.get("h"),
                        "low": bar.get("l"),
                        "close": bar.get("c"),
                        "volume": bar.get("v", 0),
                    }
                
                page_token = data.get("next_page_token")
                if not page_token or not bars:
                    break
                
                await asyncio.sleep(0.2)
                
            except Exception as e:
                self.logger.error("bar_fetch_error", symbol=symbol, error=str(e))
                break
    
    def _parse_timestamp(self, ts_str: str) -> int:
        """Parse ISO 8601 timestamp to milliseconds."""
        if not ts_str:
            return 0
        try:
            # Handle various formats
            ts_str = ts_str.replace("Z", "+00:00")
            dt = datetime.fromisoformat(ts_str)
            return int(dt.timestamp() * 1000)
        except ValueError:
            return 0
    
    def _map_side(self, conditions: list) -> Optional[str]:
        """Map trade conditions to side if determinable."""
        # Alpaca trade conditions that indicate side
        # This is simplified - real implementation would be more complex
        return None
