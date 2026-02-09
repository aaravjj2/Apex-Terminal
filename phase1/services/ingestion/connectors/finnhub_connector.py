"""
Finnhub connector for live tick data via WebSocket and REST.
"""

import asyncio
import json
from typing import AsyncIterator, Optional
import httpx
import structlog

from .base import BaseConnector
from ...models import RawTick
from ...config import get_settings


logger = structlog.get_logger()


class FinnhubConnector(BaseConnector):
    """
    Finnhub data connector.
    Supports both WebSocket streaming and REST historical data.
    """
    
    WS_URL = "wss://ws.finnhub.io"
    REST_URL = "https://finnhub.io/api/v1"
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Finnhub connector.
        
        Args:
            api_key: Finnhub API key (defaults to env var)
        """
        super().__init__(name="finnhub")
        settings = get_settings()
        self.api_key = api_key or settings.finnhub_api_key
        
        if not self.api_key:
            self.logger.warning("no_api_key", msg="Finnhub API key not configured")
        
        self._ws = None
        self._ws_task: Optional[asyncio.Task] = None
        self._subscribed_symbols: set[str] = set()
        self._http_client: Optional[httpx.AsyncClient] = None
    
    async def connect(self) -> None:
        """Connect to Finnhub WebSocket."""
        if not self.api_key:
            raise ValueError("Finnhub API key required")
        
        try:
            import websockets
            self._ws = await websockets.connect(
                f"{self.WS_URL}?token={self.api_key}",
                ping_interval=30,
                ping_timeout=10,
            )
            self._running = True
            self._ws_task = asyncio.create_task(self._listen())
            self.logger.info("finnhub_connected")
        except Exception as e:
            self.logger.error("finnhub_connect_error", error=str(e))
            raise
    
    async def disconnect(self) -> None:
        """Disconnect from Finnhub WebSocket."""
        self._running = False
        
        if self._ws_task:
            self._ws_task.cancel()
            try:
                await self._ws_task
            except asyncio.CancelledError:
                pass
            self._ws_task = None
        
        if self._ws:
            await self._ws.close()
            self._ws = None
        
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None
        
        self._subscribed_symbols.clear()
        self.logger.info("finnhub_disconnected")
    
    async def subscribe(self, symbols: list[str]) -> None:
        """Subscribe to trade updates for symbols."""
        if not self._ws:
            raise RuntimeError("Not connected to Finnhub")
        
        for symbol in symbols:
            if symbol not in self._subscribed_symbols:
                msg = json.dumps({"type": "subscribe", "symbol": symbol})
                await self._ws.send(msg)
                self._subscribed_symbols.add(symbol)
                self.logger.info("finnhub_subscribed", symbol=symbol)
    
    async def unsubscribe(self, symbols: list[str]) -> None:
        """Unsubscribe from trade updates."""
        if not self._ws:
            return
        
        for symbol in symbols:
            if symbol in self._subscribed_symbols:
                msg = json.dumps({"type": "unsubscribe", "symbol": symbol})
                await self._ws.send(msg)
                self._subscribed_symbols.discard(symbol)
                self.logger.info("finnhub_unsubscribed", symbol=symbol)
    
    async def _listen(self) -> None:
        """Listen for WebSocket messages."""
        try:
            while self._running and self._ws:
                try:
                    message = await asyncio.wait_for(
                        self._ws.recv(),
                        timeout=60.0
                    )
                    await self._handle_message(message)
                except asyncio.TimeoutError:
                    continue
                except Exception as e:
                    self.logger.error("ws_receive_error", error=str(e))
                    if self._running:
                        await asyncio.sleep(1)  # Brief delay before retry
        except asyncio.CancelledError:
            pass
        except Exception as e:
            self.logger.error("ws_listen_error", error=str(e))
    
    async def _handle_message(self, message: str) -> None:
        """Parse and emit ticks from WebSocket message."""
        try:
            data = json.loads(message)
            
            if data.get("type") == "trade":
                trades = data.get("data", [])
                for trade in trades:
                    tick = RawTick(
                        source="finnhub",
                        symbol=trade["s"],
                        ts_ms=trade["t"],  # Finnhub sends ms timestamp
                        price=trade["p"],
                        size=trade.get("v", 0),
                        raw_data=trade,
                    )
                    await self._emit_tick(tick)
            elif data.get("type") == "ping":
                # Heartbeat - nothing to do
                pass
            elif data.get("type") == "error":
                self.logger.error("finnhub_error", msg=data.get("msg"))
        except json.JSONDecodeError as e:
            self.logger.warning("json_decode_error", error=str(e), message=message[:100])
        except Exception as e:
            self.logger.error("message_handle_error", error=str(e))
    
    async def get_historical_ticks(
        self,
        symbol: str,
        start_ms: int,
        end_ms: int,
    ) -> AsyncIterator[RawTick]:
        """
        Fetch historical tick data via REST.
        Note: Finnhub tick data requires premium subscription.
        Falls back to aggregated trades if not available.
        """
        if not self._http_client:
            self._http_client = httpx.AsyncClient(timeout=30.0)
        
        # Convert to seconds for API
        start_s = start_ms // 1000
        end_s = end_ms // 1000
        
        try:
            # Use stock/tick endpoint for tick data
            url = f"{self.REST_URL}/stock/tick"
            params = {
                "symbol": symbol,
                "date": "",  # Would need date formatting
                "token": self.api_key,
            }
            
            # Finnhub tick data has specific date format requirements
            # For now, use candles as fallback
            self.logger.info("fetching_historical", symbol=symbol, start_ms=start_ms, end_ms=end_ms)
            
            # Fallback to candle data converted to synthetic ticks
            async for tick in self._get_candle_ticks(symbol, start_s, end_s):
                yield tick
                
        except Exception as e:
            self.logger.error("historical_fetch_error", error=str(e), symbol=symbol)
    
    async def _get_candle_ticks(
        self,
        symbol: str,
        start_s: int,
        end_s: int,
    ) -> AsyncIterator[RawTick]:
        """
        Fetch candle data and convert to synthetic ticks.
        Used as fallback when tick data not available.
        """
        if not self._http_client:
            self._http_client = httpx.AsyncClient(timeout=30.0)
        
        url = f"{self.REST_URL}/stock/candle"
        params = {
            "symbol": symbol,
            "resolution": "1",  # 1-minute candles
            "from": start_s,
            "to": end_s,
            "token": self.api_key,
        }
        
        response = await self._http_client.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        if data.get("s") != "ok":
            self.logger.warning("candle_no_data", symbol=symbol, response=data)
            return
        
        # Convert candles to ticks (using close price at candle timestamp)
        timestamps = data.get("t", [])
        closes = data.get("c", [])
        volumes = data.get("v", [])
        
        for i, ts in enumerate(timestamps):
            tick = RawTick(
                source="finnhub",
                symbol=symbol,
                ts_ms=ts * 1000,  # Convert to ms
                price=closes[i],
                size=volumes[i] if i < len(volumes) else 0,
                raw_data={"candle_index": i, "resolution": "1"},
            )
            yield tick
    
    async def get_quote(self, symbol: str) -> Optional[dict]:
        """Get current quote for a symbol."""
        if not self._http_client:
            self._http_client = httpx.AsyncClient(timeout=30.0)
        
        url = f"{self.REST_URL}/quote"
        params = {"symbol": symbol, "token": self.api_key}
        
        response = await self._http_client.get(url, params=params)
        response.raise_for_status()
        return response.json()
