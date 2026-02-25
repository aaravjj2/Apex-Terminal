"""
Alpaca Options Gateway — unified options connectivity for autopilot.

Wraps Alpaca Trading + Data APIs for:
- Contract discovery (option chains)
- Latest quote/trade for specific option contract
- Place single-leg options orders (buy_to_open / sell_to_close)
- Fetch options orders and positions
- All errors return structured JSON with correlation_id.
"""

from __future__ import annotations

import hashlib
import logging
import os
import time
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _correlation_id() -> str:
    return f"opts-{uuid.uuid4().hex[:8]}"


def _safe_float(v: Any, default: float = 0.0) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _occ_symbol(underlying: str, expiry: date, option_type: str, strike: float) -> str:
    """Generate standard OCC option symbol.

    Format: UNDERLYING + YYMMDD + C/P + 8-digit strike (*1000, zero-padded)
    Example: AAPL260320C00225000
    """
    ym = expiry.strftime("%y%m%d")
    tp = "C" if option_type.lower().startswith("c") else "P"
    st = f"{int(strike * 1000):08d}"
    return f"{underlying.upper()}{ym}{tp}{st}"


# ── Data Models ──────────────────────────────────────────────────────────────

class OptionSide(str, Enum):
    BUY_TO_OPEN = "buy_to_open"
    SELL_TO_CLOSE = "sell_to_close"


@dataclass
class OptionContractInfo:
    contract_symbol: str
    underlying: str
    option_type: str          # "call" | "put"
    strike: float
    expiration: date
    bid: Optional[float] = None
    ask: Optional[float] = None
    last: Optional[float] = None
    mark: Optional[float] = None
    volume: int = 0
    open_interest: int = 0
    implied_volatility: Optional[float] = None
    delta: Optional[float] = None
    gamma: Optional[float] = None
    theta: Optional[float] = None
    vega: Optional[float] = None
    dte: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "contract_symbol": self.contract_symbol,
            "underlying": self.underlying,
            "option_type": self.option_type,
            "strike": self.strike,
            "expiration": self.expiration.isoformat(),
            "bid": self.bid,
            "ask": self.ask,
            "last": self.last,
            "mark": self.mark,
            "volume": self.volume,
            "open_interest": self.open_interest,
            "implied_volatility": self.implied_volatility,
            "delta": self.delta,
            "gamma": self.gamma,
            "theta": self.theta,
            "vega": self.vega,
            "dte": self.dte,
        }


@dataclass
class OptionQuote:
    contract_symbol: str
    bid: Optional[float] = None
    ask: Optional[float] = None
    last: Optional[float] = None
    mid: Optional[float] = None
    spread: Optional[float] = None
    timestamp: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {k: v for k, v in self.__dict__.items()}


@dataclass
class OptionOrderResult:
    order_id: str
    client_order_id: str
    symbol: str
    side: str
    qty: int
    order_type: str
    limit_price: Optional[float]
    status: str
    created_at: Optional[str] = None
    correlation_id: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {k: v for k, v in self.__dict__.items()}


# ── Gateway ──────────────────────────────────────────────────────────────────

class AlpacaOptionsGateway:
    """
    Unified gateway for Alpaca paper options operations.

    Uses httpx (async) for Data API and alpaca-py TradingClient for orders.
    """

    TRADE_BASE = "https://paper-api.alpaca.markets"
    DATA_BASE = "https://data.alpaca.markets"

    def __init__(self):
        from ..config import get_settings
        settings = get_settings()
        self._api_key = settings.apca_api_key_id or os.environ.get("APCA_API_KEY_ID", "")
        self._api_secret = settings.apca_api_secret_key or os.environ.get("APCA_API_SECRET_KEY", "")
        self._headers = {
            "APCA-API-KEY-ID": self._api_key,
            "APCA-API-SECRET-KEY": self._api_secret,
        }
        self._trading_client = None
        self._last_chain_ts: Optional[str] = None
        self._last_quote_ts: Optional[str] = None
        self._init_trading_client()

    def _init_trading_client(self):
        if not self._api_key or not self._api_secret:
            return
        try:
            from alpaca.trading.client import TradingClient
            self._trading_client = TradingClient(
                api_key=self._api_key,
                secret_key=self._api_secret,
                paper=True,
            )
        except Exception as e:
            logger.warning(f"alpaca-py TradingClient init failed: {e}")

    @property
    def is_configured(self) -> bool:
        return bool(self._api_key and self._api_secret)

    @property
    def is_connected(self) -> bool:
        return self._trading_client is not None

    @property
    def last_chain_fetch_ts(self) -> Optional[str]:
        return self._last_chain_ts

    @property
    def last_quote_ts(self) -> Optional[str]:
        return self._last_quote_ts

    # ── Contract Discovery ───────────────────────────────────────────────

    async def get_option_chain(
        self,
        symbol: str,
        expiration_date: Optional[str] = None,
        option_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Fetch option contracts / option chain for a given underlying."""
        cid = _correlation_id()
        if not self.is_configured:
            return {"ok": False, "error": "Alpaca not configured", "contracts": [], "correlation_id": cid}

        params: Dict[str, str] = {"underlying_symbols": symbol.upper()}
        if expiration_date:
            params["expiration_date"] = expiration_date
        if option_type:
            params["type"] = option_type.lower()

        endpoints = [
            f"{self.DATA_BASE}/v1beta1/options/contracts",
            f"{self.DATA_BASE}/v1beta1/options/chains",
        ]

        contracts: List[OptionContractInfo] = []
        raw_data = None
        today = date.today()

        async with httpx.AsyncClient(headers=self._headers, timeout=10) as client:
            for url in endpoints:
                try:
                    resp = await client.get(url, params=params)
                    if resp.status_code == 200:
                        raw_data = resp.json()
                        break
                except Exception as e:
                    logger.debug(f"Chain endpoint {url} failed: {e}")

        if raw_data:
            self._last_chain_ts = datetime.utcnow().isoformat() + "Z"
            items = []
            if isinstance(raw_data, dict):
                items = raw_data.get("option_contracts") or raw_data.get("contracts") or raw_data.get("data") or []
                if isinstance(items, dict):
                    # nested by symbol key
                    for v in items.values():
                        if isinstance(v, list):
                            items = v
                            break
            elif isinstance(raw_data, list):
                items = raw_data

            for it in items:
                try:
                    exp_str = str(it.get("expiration_date") or it.get("expiration") or "")[:10]
                    if not exp_str:
                        continue
                    exp = date.fromisoformat(exp_str)
                    dte = max(0, (exp - today).days)
                    strike = _safe_float(it.get("strike_price") or it.get("strike"))
                    ot = str(it.get("type") or it.get("option_type") or "call").lower()
                    ot = "call" if ot.startswith("c") else "put"
                    csym = it.get("symbol") or it.get("contract_symbol") or _occ_symbol(symbol, exp, ot, strike)

                    contracts.append(OptionContractInfo(
                        contract_symbol=csym,
                        underlying=symbol.upper(),
                        option_type=ot,
                        strike=strike,
                        expiration=exp,
                        bid=_safe_float(it.get("bid"), None),
                        ask=_safe_float(it.get("ask"), None),
                        last=_safe_float(it.get("close_price") or it.get("last"), None),
                        volume=int(_safe_float(it.get("volume"))),
                        open_interest=int(_safe_float(it.get("open_interest"))),
                        dte=dte,
                    ))
                except Exception:
                    continue

        return {
            "ok": True,
            "symbol": symbol.upper(),
            "contracts": [c.to_dict() for c in contracts],
            "count": len(contracts),
            "fetched_at": self._last_chain_ts,
            "correlation_id": cid,
        }

    # ── Latest Quote ─────────────────────────────────────────────────────

    async def get_option_quote(self, contract_symbol: str) -> Dict[str, Any]:
        """Get latest quote/trade for a specific option contract symbol."""
        cid = _correlation_id()
        if not self.is_configured:
            return {"ok": False, "error": "Alpaca not configured", "correlation_id": cid}

        endpoints = [
            f"{self.DATA_BASE}/v1beta1/options/quotes/latest",
            f"{self.DATA_BASE}/v1beta1/options/trades/latest",
        ]

        quote = OptionQuote(contract_symbol=contract_symbol)

        async with httpx.AsyncClient(headers=self._headers, timeout=10) as client:
            # Try quotes first
            for url in endpoints:
                try:
                    resp = await client.get(url, params={"symbols": contract_symbol})
                    if resp.status_code == 200:
                        data = resp.json()
                        # data may be keyed by symbol
                        item = data.get(contract_symbol) or data.get("quotes", {}).get(contract_symbol) or data.get("trades", {}).get(contract_symbol)
                        if item:
                            quote.bid = _safe_float(item.get("bp") or item.get("bid"), None)
                            quote.ask = _safe_float(item.get("ap") or item.get("ask"), None)
                            quote.last = _safe_float(item.get("p") or item.get("last") or item.get("price"), None)
                            quote.timestamp = item.get("t") or item.get("timestamp")
                            if quote.bid is not None and quote.ask is not None:
                                quote.mid = round((quote.bid + quote.ask) / 2, 4)
                                quote.spread = round(quote.ask - quote.bid, 4)
                            self._last_quote_ts = datetime.utcnow().isoformat() + "Z"
                            break
                except Exception as e:
                    logger.debug(f"Quote endpoint {url} failed: {e}")

        return {"ok": True, "quote": quote.to_dict(), "correlation_id": cid}

    # ── Place Options Order ──────────────────────────────────────────────

    async def place_option_order(
        self,
        contract_symbol: str,
        qty: int,
        side: str,            # "buy" or "sell"
        limit_price: float,
        time_in_force: str = "day",
        client_order_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Place a single-leg options order (buy_to_open / sell_to_close).

        V1 COMPLIANCE: only limit orders. Market orders are banned.
        """
        cid = _correlation_id()
        if not self.is_connected:
            return {"ok": False, "error": "Alpaca TradingClient not connected", "correlation_id": cid}

        if limit_price <= 0:
            return {"ok": False, "error": "limit_price must be > 0", "correlation_id": cid}

        try:
            from alpaca.trading.requests import LimitOrderRequest
            from alpaca.trading.enums import OrderSide, TimeInForce

            side_enum = OrderSide.BUY if side.lower() == "buy" else OrderSide.SELL
            tif = TimeInForce.DAY if time_in_force == "day" else TimeInForce.GTC

            req = LimitOrderRequest(
                symbol=contract_symbol,
                qty=qty,
                side=side_enum,
                time_in_force=tif,
                limit_price=limit_price,
                client_order_id=client_order_id or f"apex-opt-{uuid.uuid4().hex[:10]}",
            )

            result = self._trading_client.submit_order(req)

            order = OptionOrderResult(
                order_id=str(result.id),
                client_order_id=result.client_order_id,
                symbol=result.symbol,
                side=result.side.value if hasattr(result.side, "value") else str(result.side),
                qty=int(result.qty) if result.qty else qty,
                order_type=result.order_type.value if hasattr(result.order_type, "value") else "limit",
                limit_price=float(result.limit_price) if result.limit_price else limit_price,
                status=result.status.value if hasattr(result.status, "value") else str(result.status),
                created_at=str(result.created_at) if result.created_at else None,
                correlation_id=cid,
            )

            return {"ok": True, "order": order.to_dict(), "correlation_id": cid}

        except Exception as e:
            logger.error(f"Option order failed: {e}")
            return {"ok": False, "error": str(e), "correlation_id": cid}

    # ── Fetch Options Orders ─────────────────────────────────────────────

    async def list_option_orders(self, status: str = "all", limit: int = 50) -> Dict[str, Any]:
        """Fetch orders (filtered to options asset class where possible)."""
        cid = _correlation_id()
        if not self.is_connected:
            return {"ok": False, "orders": [], "correlation_id": cid}

        try:
            from alpaca.trading.requests import GetOrdersRequest
            from alpaca.trading.enums import QueryOrderStatus

            status_map = {
                "open": QueryOrderStatus.OPEN,
                "closed": QueryOrderStatus.CLOSED,
                "all": QueryOrderStatus.ALL,
            }

            req = GetOrdersRequest(
                status=status_map.get(status, QueryOrderStatus.ALL),
                limit=limit,
            )
            orders = self._trading_client.get_orders(req)

            result = []
            for o in orders:
                ac = o.asset_class.value if hasattr(o, "asset_class") and o.asset_class else "us_equity"
                if ac == "us_option" or (hasattr(o, "symbol") and len(o.symbol) > 10):
                    result.append({
                        "order_id": str(o.id),
                        "client_order_id": o.client_order_id,
                        "symbol": o.symbol,
                        "side": o.side.value if hasattr(o.side, "value") else str(o.side),
                        "qty": int(o.qty) if o.qty else 0,
                        "filled_qty": int(o.filled_qty) if o.filled_qty else 0,
                        "order_type": o.order_type.value if hasattr(o.order_type, "value") else str(o.order_type),
                        "limit_price": float(o.limit_price) if o.limit_price else None,
                        "status": o.status.value if hasattr(o.status, "value") else str(o.status),
                        "created_at": str(o.created_at) if o.created_at else None,
                        "filled_at": str(o.filled_at) if o.filled_at else None,
                        "asset_class": ac,
                    })

            return {"ok": True, "orders": result, "count": len(result), "correlation_id": cid}

        except Exception as e:
            logger.error(f"List option orders failed: {e}")
            return {"ok": False, "orders": [], "error": str(e), "correlation_id": cid}

    # ── Fetch Options Positions ──────────────────────────────────────────

    async def list_option_positions(self) -> Dict[str, Any]:
        """Fetch all positions, filtered to options."""
        cid = _correlation_id()
        if not self.is_connected:
            return {"ok": False, "positions": [], "correlation_id": cid}

        try:
            all_pos = self._trading_client.get_all_positions()
            result = []
            for p in all_pos:
                ac = p.asset_class.value if hasattr(p.asset_class, "value") else str(p.asset_class)
                if ac == "us_option" or len(p.symbol) > 10:
                    result.append({
                        "symbol": p.symbol,
                        "qty": int(p.qty),
                        "side": p.side.value if hasattr(p.side, "value") else str(p.side),
                        "avg_entry_price": float(p.avg_entry_price),
                        "current_price": float(p.current_price),
                        "market_value": float(p.market_value),
                        "unrealized_pnl": float(p.unrealized_pl),
                        "unrealized_pnl_pct": float(p.unrealized_plpc) * 100,
                        "asset_class": ac,
                    })

            return {"ok": True, "positions": result, "count": len(result), "correlation_id": cid}

        except Exception as e:
            logger.error(f"List option positions failed: {e}")
            return {"ok": False, "positions": [], "error": str(e), "correlation_id": cid}

    # ── Account Info ─────────────────────────────────────────────────────

    async def get_account_info(self) -> Dict[str, Any]:
        """Get account info including options buying power."""
        cid = _correlation_id()
        if not self.is_connected:
            return {"ok": False, "error": "Not connected", "correlation_id": cid}
        try:
            acct = self._trading_client.get_account()
            return {
                "ok": True,
                "equity": float(acct.equity),
                "cash": float(acct.cash),
                "buying_power": float(acct.buying_power),
                "options_buying_power": float(acct.options_buying_power) if hasattr(acct, "options_buying_power") and acct.options_buying_power else float(acct.buying_power),
                "options_trading_level": getattr(acct, "options_trading_level", None),
                "status": acct.status.value if hasattr(acct.status, "value") else str(acct.status),
                "correlation_id": cid,
            }
        except Exception as e:
            logger.error(f"Account info failed: {e}")
            return {"ok": False, "error": str(e), "correlation_id": cid}

    # ── Health Check ─────────────────────────────────────────────────────

    async def health_check(self) -> Dict[str, Any]:
        cid = _correlation_id()
        connected = False
        latency_ms = 0.0
        options_enabled = False
        try:
            if self._trading_client:
                t0 = time.monotonic()
                acct = self._trading_client.get_account()
                latency_ms = round((time.monotonic() - t0) * 1000, 1)
                connected = True
                options_enabled = bool(getattr(acct, "options_approved_level", None) or getattr(acct, "options_trading_level", None))
        except Exception as e:
            logger.debug(f"Options health check failed: {e}")

        return {
            "ok": True,
            "connected": connected,
            "latency_ms": latency_ms,
            "options_enabled": options_enabled,
            "last_chain_fetch_ts": self._last_chain_ts,
            "last_quote_ts": self._last_quote_ts,
            "correlation_id": cid,
        }


# ── Singleton ────────────────────────────────────────────────────────────────

_gateway: Optional[AlpacaOptionsGateway] = None


def get_options_gateway() -> AlpacaOptionsGateway:
    global _gateway
    if _gateway is None:
        _gateway = AlpacaOptionsGateway()
    return _gateway
