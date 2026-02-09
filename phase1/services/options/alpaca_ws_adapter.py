"""
Alpaca Options WebSocket Adapter (experimental)

Provides a minimal async connector to subscribe to Alpaca options stream
and emit OptionChain snapshots to registered callbacks. This is best-effort
and intended for environments where Alpaca options streaming is available.
"""

import asyncio
import json
import logging
from typing import Optional, List

import websockets
from websockets.exceptions import ConnectionClosed

from .models import OptionContract, OptionChain, OptionType
from ..config import get_settings
from datetime import datetime

logger = logging.getLogger(__name__)


class AlpacaOptionsWSAdapter:
    OPTIONS_STREAM_URL = "wss://stream.data.alpaca.markets/v1beta1/options"

    def __init__(self):
        settings = get_settings()
        self.api_key = settings.apca_api_key_id
        self.api_secret = settings.apca_api_secret_key
        self._ws = None
        self._task: Optional[asyncio.Task] = None
        self._subscribed: set[str] = set()
        self._send_lock = asyncio.Lock()
        self._running = False
        self._callbacks = []
        self._reconnect_delay = 2

    def register_callback(self, cb):
        self._callbacks.append(cb)

    async def _emit_chain(self, chain: OptionChain):
        for cb in self._callbacks:
            try:
                await cb(chain)
            except Exception:
                logger.exception("callback_error")

    async def _safe_send(self, payload: str) -> bool:
        if not self._ws or not getattr(self._ws, "open", False) or getattr(self._ws, "closed", False):
            logger.warning("alpaca_options_ws_send_skipped")
            return False
        try:
            async with self._send_lock:
                await self._ws.send(payload)
            return True
        except ConnectionClosed as e:
            logger.warning("alpaca_options_ws_send_failed_closed", error=str(e))
            return False
        except Exception as e:
            logger.exception("alpaca_options_ws_send_failed")
            return False

    async def connect(self):
        if not self.api_key or not self.api_secret:
            raise ValueError("Alpaca credentials required for options WS")
        self._running = True
        if not self._task:
            self._task = asyncio.create_task(self._run_loop())
        logger.info("alpaca_options_ws_connecting")

    async def disconnect(self):
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
        logger.info("alpaca_options_ws_disconnected")

    async def subscribe(self, symbol: str):
        self._subscribed.add(symbol.upper())
        if self._ws and getattr(self._ws, "open", False):
            msg = {"action": "subscribe", "symbols": list(self._subscribed)}
            await self._safe_send(json.dumps(msg))

    async def _run_loop(self):
        while self._running:
            try:
                async with websockets.connect(self.OPTIONS_STREAM_URL) as ws:
                    self._ws = ws
                    auth_msg = {"action": "auth", "key": self.api_key, "secret": self.api_secret}
                    sent = await self._safe_send(json.dumps(auth_msg))
                    if not sent:
                        await asyncio.sleep(self._reconnect_delay)
                        continue

                    # subscribe if needed
                    if self._subscribed:
                        sub_msg = {"action": "subscribe", "symbols": list(self._subscribed)}
                        await self._safe_send(json.dumps(sub_msg))

                    while self._running:
                        try:
                            msg = await asyncio.wait_for(ws.recv(), timeout=30)
                            await self._handle_message(msg)
                        except asyncio.TimeoutError:
                            pong = json.dumps({"action": "ping"})
                            sent = await self._safe_send(pong)
                            if not sent:
                                break
                        except ConnectionClosed:
                            break
                        except Exception:
                            logger.exception("alpaca_options_ws_handle_error")
                            await asyncio.sleep(0.5)
                            continue
            except Exception:
                logger.exception("alpaca_options_ws_conn_error")
                await asyncio.sleep(self._reconnect_delay)
                continue

    async def _handle_message(self, message: str):
        try:
            data = json.loads(message)
        except Exception:
            return

        # Expect messages of shape {"type":"chain","symbol":"AAPL","contracts":[...]} or list
        if isinstance(data, list):
            for item in data:
                await self._maybe_emit_chain(item)
        elif isinstance(data, dict):
            await self._maybe_emit_chain(data)

    async def _maybe_emit_chain(self, item: dict):
        try:
            if item.get("type") != "chain":
                return
            symbol = item.get("symbol")
            contracts_raw = item.get("contracts", [])
            expirations_raw = item.get("expirations", [])

            contracts = []
            expirations = []
            for e in expirations_raw:
                try:
                    expirations.append(datetime.fromisoformat(e).date())
                except Exception:
                    continue

            for it in contracts_raw:
                try:
                    opt_type = OptionType.CALL if str(it.get("option_type", "")).lower().startswith("c") else OptionType.PUT
                    strike = float(it.get("strike"))
                    exp_date = datetime.fromisoformat(str(it.get("expiration"))[:10]).date()
                    bid = float(it.get("bid")) if it.get("bid") is not None else None
                    ask = float(it.get("ask")) if it.get("ask") is not None else None
                    last = float(it.get("last")) if it.get("last") is not None else None
                    volume = int(it.get("volume", 0)) if it.get("volume") else 0
                    oi = int(it.get("open_interest", 0)) if it.get("open_interest") else 0

                    mark = (bid + ask) / 2 if (bid is not None and ask is not None) else last

                    contract = OptionContract(
                        symbol=symbol,
                        contract_symbol=it.get("contract_symbol") or it.get("symbol"),
                        option_type=opt_type,
                        strike=strike,
                        expiration=exp_date,
                        bid=bid,
                        ask=ask,
                        last=last,
                        mark=mark,
                        volume=volume,
                        open_interest=oi,
                        implied_volatility=None,
                        greeks=None,
                        in_the_money=False,
                        days_to_expiration=max(0, (exp_date - datetime.utcnow().date()).days),
                    )
                    contracts.append(contract)
                except Exception:
                    continue

            if not contracts:
                return

            chain = OptionChain(
                symbol=symbol,
                underlying_price=0.0,
                expirations=expirations,
                contracts=contracts,
                timestamp=datetime.utcnow(),
                provider="alpaca-ws",
            )

            await self._emit_chain(chain)
        except Exception:
            logger.exception("emit_chain_failed")
