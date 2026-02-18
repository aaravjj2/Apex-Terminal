"""
Alpaca WebSocket Connector (async) for real-time quote/trade streaming.

This connector uses Alpaca's market data WebSocket (IEX) to receive real-time
quote and trade messages and emits RawTick objects to the ingestion pipeline.
"""

import asyncio
import json
from typing import Optional, List
import structlog
import websockets
from websockets.exceptions import ConnectionClosed

from .base import BaseConnector
from ...models import RawTick
from ...config import get_settings

logger = structlog.get_logger()


class AlpacaWSConnector(BaseConnector):
    """Alpaca real-time WebSocket connector."""

    STOCK_STREAM_URL = "wss://stream.data.alpaca.markets/v2/iex"

    def __init__(self, api_key: Optional[str] = None, api_secret: Optional[str] = None):
        super().__init__(name="alpaca-ws")
        settings = get_settings()
        self.api_key = api_key or settings.apca_api_key_id
        self.api_secret = api_secret or settings.apca_api_secret_key

        self._ws = None
        self._task: Optional[asyncio.Task] = None
        self._subscribed: set[str] = set()
        self._reconnect_delay = 2
        self._send_lock = asyncio.Lock()

        if not self.api_key or not self.api_secret:
            self.logger.warning("no_api_credentials", msg="Alpaca WS credentials not configured")

    async def connect(self) -> None:
        if not self.api_key or not self.api_secret:
            raise ValueError("Alpaca WS credentials required")

        self._running = True
        # Launch background task to manage connection
        if not self._task:
            self._task = asyncio.create_task(self._run_loop())
        self.logger.info("alpaca_ws_connecting")

    async def disconnect(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        if self._ws:
            try:
                await self._ws.close()
            except Exception:
                pass
            self._ws = None
        self._subscribed.clear()
        self.logger.info("alpaca_ws_disconnected")

    async def subscribe(self, symbols: List[str]) -> None:
        for s in symbols:
            self._subscribed.add(s.upper())

        # If already connected, send subscribe message
        if self._ws and self._ws.open and self._subscribed:
            msg = {"action": "subscribe", "quotes": list(self._subscribed)}
            sent = await self._safe_send(json.dumps(msg))
            if sent:
                self.logger.info("alpaca_ws_subscribed", symbols=list(self._subscribed))
            else:
                self.logger.warning("alpaca_ws_subscribe_error", error="send_failed")

    async def unsubscribe(self, symbols: List[str]) -> None:
        for s in symbols:
            self._subscribed.discard(s.upper())

        if self._ws and self._ws.open:
            msg = {"action": "unsubscribe", "quotes": list(symbols)}
            sent = await self._safe_send(json.dumps(msg))
            if sent:
                self.logger.info("alpaca_ws_unsubscribed", symbols=symbols)
            else:
                self.logger.warning("alpaca_ws_unsubscribe_error", error="send_failed")

    async def get_historical_ticks(self, symbol: str, start_ms: int, end_ms: int):
        # Use the REST endpoints via the existing AlpacaConnector for historicals
        from .alpaca_connector import AlpacaConnector
        tmp = AlpacaConnector()
        await tmp.connect()
        async for tick in tmp.get_historical_ticks(symbol, start_ms, end_ms):
            yield tick
        await tmp.disconnect()

    async def _run_loop(self) -> None:
        """Main loop: connect, authenticate, subscribe, and handle messages."""
        while self._running:
            try:
                async with websockets.connect(self.STOCK_STREAM_URL) as ws:
                    self._ws = ws
                    # Authenticate
                    auth_msg = {"action": "auth", "key": self.api_key, "secret": self.api_secret}
                    sent = await self._safe_send(json.dumps(auth_msg))
                    if not sent:
                        self.logger.warning("alpaca_ws_auth_send_failed")
                        await asyncio.sleep(self._reconnect_delay)
                        continue
                    # Wait for auth response
                    try:
                        auth_resp = await asyncio.wait_for(ws.recv(), timeout=5)
                        # If not authenticated, log and retry
                        try:
                            auth_data = json.loads(auth_resp)
                        except Exception:
                            auth_data = None

                        if not self._check_auth(auth_data):
                            self.logger.error("alpaca_ws_auth_failed", resp=auth_data)
                            await asyncio.sleep(self._reconnect_delay)
                            continue
                    except asyncio.TimeoutError:
                        self.logger.warning("alpaca_ws_auth_timeout")
                        await asyncio.sleep(self._reconnect_delay)
                        continue

                    # Subscribe to any existing symbols
                    if self._subscribed:
                        sub_msg = {"action": "subscribe", "quotes": list(self._subscribed)}
                        sent = await self._safe_send(json.dumps(sub_msg))
                        if sent:
                            self.logger.info("alpaca_ws_subscribed_on_connect", symbols=list(self._subscribed))
                        else:
                            self.logger.warning("alpaca_ws_subscribe_on_connect_failed", symbols=list(self._subscribed))

                    # Stream messages
                    while self._running:
                        try:
                            msg = await asyncio.wait_for(ws.recv(), timeout=30)
                            await self._handle_message(msg)
                        except asyncio.TimeoutError:
                            # Send ping to keep session alive
                            try:
                                pong = json.dumps({"action": "ping"})
                                sent = await self._safe_send(pong)
                                if not sent:
                                    # If cannot send ping, break to reconnect
                                    break
                            except Exception:
                                break
                        except ConnectionClosed:
                            break
                        except Exception as e:
                            self.logger.error("alpaca_ws_handle_error", error=str(e))
                            await asyncio.sleep(0.5)
                            continue
            except Exception as e:
                self.logger.error("alpaca_ws_conn_error", error=str(e))
                await asyncio.sleep(self._reconnect_delay)
                continue

    async def _handle_message(self, message: str) -> None:
        """Parse Alpaca WebSocket messages and emit RawTick objects."""
        try:
            data = json.loads(message)
            if isinstance(data, list):
                for item in data:
                    t = item.get("T")
                    if t == "q":  # Quote
                        symbol = item.get("S")
                        bid = item.get("bp", 0)
                        ask = item.get("ap", 0)
                        price = (bid + ask) / 2 if bid and ask else item.get("c", 0)
                        ts = item.get("t", "")
                        # Convert to ms if possible (ISO format)
                        ts_ms = self._parse_ts(ts)

                        tick = RawTick(
                            source="alpaca",
                            symbol=symbol,
                            ts_ms=ts_ms,
                            price=price,
                            size=0,
                            raw_data=item,
                        )
                        await self._emit_tick(tick)

                    elif t == "t":  # Trade
                        symbol = item.get("S")
                        price = item.get("p", 0)
                        size = item.get("s", 0)
                        ts = item.get("t", "")
                        ts_ms = self._parse_ts(ts)

                        tick = RawTick(
                            source="alpaca",
                            symbol=symbol,
                            ts_ms=ts_ms,
                            price=price,
                            size=size,
                            raw_data=item,
                        )
                        await self._emit_tick(tick)
        except json.JSONDecodeError:
            return
        except Exception as e:
            self.logger.error("alpaca_ws_msg_parse_error", error=str(e))

    def _check_auth(self, data) -> bool:
        if isinstance(data, list):
            for item in data:
                if item.get("T") == "success" and item.get("msg") in ("authenticated", "connected"):
                    return True
        return False

    def _parse_ts(self, ts_str: str) -> int:
        try:
            # Alpaca uses ISO timestamps
            if not ts_str:
                return 0
            ts_str = ts_str.replace("Z", "+00:00")

            # Handle nano-second precision by truncating or padding to microseconds
            if "." in ts_str:
                # Split fractional and timezone if present
                main, rest = ts_str.split(".", 1)
                frac = rest
                tz = ""
                # Extract timezone if present
                if "+" in rest:
                    frac, tz = rest.split("+", 1)
                    tz = "+" + tz
                elif "-" in rest:
                    frac, tz = rest.split("-", 1)
                    tz = "-" + tz
                # Truncate or pad to 6 digits (microseconds)
                frac = (frac + "000000")[:6]
                ts_str = f"{main}.{frac}{tz}"

            from datetime import datetime
            dt = datetime.fromisoformat(ts_str)
            return int(dt.timestamp() * 1000)
        except Exception:
            return 0

    async def _safe_send(self, payload: str) -> bool:
        """Safely send a payload over the websocket; return True on success."""
        # Check connection state properly - websockets library uses .state or check .closed
        try:
            from websockets.protocol import State
            if not self._ws or self._ws.state != State.OPEN:
                self.logger.debug("alpaca_ws_send_skipped", reason="not_connected")
                return False
        except (AttributeError, ImportError):
            # Fallback check
            if not self._ws or getattr(self._ws, "closed", True):
                self.logger.debug("alpaca_ws_send_skipped", reason="not_connected")
                return False
        try:
            async with self._send_lock:
                await self._ws.send(payload)
            return True
        except ConnectionClosed as e:
            self.logger.warning("alpaca_ws_send_failed_closed", error=str(e))
            return False
        except Exception as e:
            self.logger.error("alpaca_ws_send_failed", error=str(e))
            return False
