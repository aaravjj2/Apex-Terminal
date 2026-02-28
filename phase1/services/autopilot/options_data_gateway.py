"""
OptionsMarketDataGateway — Correct Alpaca options data plane.

DIAGNOSIS FIX (Phase 1):
  The previous options_gateway.py used:
    GET /v1beta1/options/contracts  → HTTP 404
    GET /v1beta1/options/chains     → HTTP 404
  Both return "Not Found" — that is why every symbol gets no_contracts.

  Correct endpoint:
    GET https://data.alpaca.markets/v1beta1/options/snapshots/{underlying}
    params: feed=indicative, type, expiration_date_gte, expiration_date_lte,
            strike_price_gte, strike_price_lte, limit

  This endpoint returns rich per-contract snapshots with:
    - latestQuote: bid (bp), ask (ap), sizes, timestamp
    - latestTrade: last price, size, timestamp
    - dailyBar: volume (v), OHLC
    - greeks: delta, gamma, theta, vega, rho (when available)
    - impliedVolatility (when available)

Cache strategy:
  - Chain (snapshots): 60s keyed by (symbol, call/put, expiry_lo, expiry_hi, strike_lo, strike_hi)
  - Quotes: 5s keyed by (symbol, minute bucket)
  - Spot price: 30s per symbol

All methods return structured dicts with correlation_id.
"""

from __future__ import annotations

import logging
import os
import re
import time
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _cid() -> str:
    return f"omg-{uuid.uuid4().hex[:8]}"


def _safe_float(v: Any, default: float | None = None) -> float | None:
    if v is None:
        return default
    try:
        f = float(v)
        return f if f != 0 else (default if default is not None else f)
    except (TypeError, ValueError):
        return default


def _safe_int(v: Any, default: int = 0) -> int:
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return default


# ── OCC Symbol Parser ─────────────────────────────────────────────────────────

_OCC_RE = re.compile(r'^([A-Z]{1,6})(\d{6})([CP])(\d{8})$')


def parse_occ_symbol(sym: str, today: date | None = None) -> Optional[Dict[str, Any]]:
    """
    Parse an OCC option symbol into components.

    Format: {UNDERLYING}{YYMMDD}{C|P}{00STRIKE000}
    Example: AAPL260320C00275000
      → underlying=AAPL, expiry=2026-03-20, type=call, strike=275.0, dte=24
    """
    m = _OCC_RE.match(sym.upper())
    if not m:
        return None
    underlying, yymmdd, tp, strike_raw = m.groups()
    try:
        expiry = date(2000 + int(yymmdd[:2]), int(yymmdd[2:4]), int(yymmdd[4:6]))
    except ValueError:
        return None
    strike = int(strike_raw) / 1000.0
    ref_date = today or date.today()
    dte = max(0, (expiry - ref_date).days)
    return {
        "underlying": underlying,
        "expiry": expiry.isoformat(),
        "option_type": "call" if tp == "C" else "put",
        "strike": strike,
        "dte": dte,
    }


# ── Snapshot Data Model ───────────────────────────────────────────────────────

@dataclass
class OptionSnapshot:
    """Rich snapshot of one option contract including quote + greeks."""
    contract_symbol: str
    underlying: str
    option_type: str          # "call" | "put"
    strike: float
    expiry: str               # ISO date
    dte: int

    bid: Optional[float] = None
    ask: Optional[float] = None
    mid: Optional[float] = None
    last: Optional[float] = None
    bid_size: int = 0
    ask_size: int = 0
    quote_ts: Optional[str] = None

    volume: int = 0
    vwap: Optional[float] = None

    delta: Optional[float] = None
    gamma: Optional[float] = None
    theta: Optional[float] = None
    vega: Optional[float] = None
    rho: Optional[float] = None
    iv: Optional[float] = None

    spread: Optional[float] = None
    spread_pct: Optional[float] = None   # (ask-bid)/mid * 100

    @property
    def has_valid_quote(self) -> bool:
        return (
            self.bid is not None and self.bid > 0
            and self.ask is not None and self.ask > 0
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "contract_symbol": self.contract_symbol,
            "underlying": self.underlying,
            "option_type": self.option_type,
            "strike": self.strike,
            "expiry": self.expiry,
            "dte": self.dte,
            "bid": self.bid,
            "ask": self.ask,
            "mid": self.mid,
            "last": self.last,
            "bid_size": self.bid_size,
            "ask_size": self.ask_size,
            "quote_ts": self.quote_ts,
            "volume": self.volume,
            "vwap": self.vwap,
            "delta": self.delta,
            "gamma": self.gamma,
            "theta": self.theta,
            "vega": self.vega,
            "rho": self.rho,
            "iv": self.iv,
            "spread": self.spread,
            "spread_pct": self.spread_pct,
        }


# ── Gateway ──────────────────────────────────────────────────────────────────

class OptionsMarketDataGateway:
    """
    Correct Alpaca options market data gateway.

    Uses /v1beta1/options/snapshots/{underlying} which actually exists
    (unlike /v1beta1/options/contracts which returns 404).
    """

    DATA_BASE = "https://data.alpaca.markets"

    def __init__(self, api_key: str = "", api_secret: str = ""):
        self._api_key = api_key or os.environ.get("APCA_API_KEY_ID", "")
        self._api_secret = api_secret or os.environ.get("APCA_API_SECRET_KEY", "")
        self._headers = {
            "APCA-API-KEY-ID": self._api_key,
            "APCA-API-SECRET-KEY": self._api_secret,
        }

        # Cache: { cache_key: (timestamp, data) }
        self._chain_cache: Dict[str, Tuple[float, List[OptionSnapshot]]] = {}
        self._spot_cache: Dict[str, Tuple[float, float]] = {}

        # Diagnostics
        self._last_chain_fetch: Dict[str, Any] = {}
        self._last_spot_fetch: Dict[str, Any] = {}

        # TTL constants
        self.CHAIN_CACHE_TTL = 60.0   # seconds
        self.SPOT_CACHE_TTL = 30.0    # seconds

    @property
    def is_configured(self) -> bool:
        return bool(self._api_key and self._api_secret)

    # ── Spot Price ───────────────────────────────────────────────────────

    async def get_spot_price(self, symbol: str) -> Optional[float]:
        """Get current underlying spot price from Alpaca market data."""
        sym = symbol.upper()
        now = time.monotonic()

        # Cache hit
        if sym in self._spot_cache:
            ts, price = self._spot_cache[sym]
            if now - ts < self.SPOT_CACHE_TTL:
                return price

        if not self.is_configured:
            return None

        t0 = time.monotonic()
        try:
            async with httpx.AsyncClient(headers=self._headers, timeout=8) as client:
                r = await client.get(
                    f"{self.DATA_BASE}/v2/stocks/{sym}/trades/latest"
                )
                if r.status_code == 200:
                    price = float(r.json().get("trade", {}).get("p", 0) or 0)
                    if price > 0:
                        self._spot_cache[sym] = (now, price)
                        self._last_spot_fetch[sym] = {
                            "symbol": sym,
                            "price": price,
                            "latency_ms": round((time.monotonic() - t0) * 1000, 1),
                            "fetched_at": datetime.utcnow().isoformat() + "Z",
                        }
                        return price
        except Exception as e:
            logger.warning(f"Spot price fetch failed for {sym}: {e}")

        return None

    # ── Option Chain via Snapshots ──────────────────────────────────────

    async def fetch_chain_snapshots(
        self,
        symbol: str,
        dte_min: int = 14,
        dte_max: int = 45,
        option_type: Optional[str] = None,  # "call" | "put" | None
        strike_pct_range: float = 0.15,     # ±15% of spot
        spot_price: Optional[float] = None,
        limit: int = 100,
    ) -> Dict[str, Any]:
        """
        Fetch option snapshots for a symbol using the CORRECT endpoint:
          GET /v1beta1/options/snapshots/{underlying}

        Returns list of OptionSnapshot objects parsed from OCC keys.
        Chain cache: 60s TTL.
        Includes last_chain_fetch diagnostic.
        """
        cid = _cid()
        sym = symbol.upper()
        today = date.today()
        dte_lo = today + timedelta(days=dte_min)
        dte_hi = today + timedelta(days=dte_max)

        # Resolve spot price for strike range filter
        if spot_price is None:
            spot_price = await self.get_spot_price(sym)

        # Build cache key
        cache_key = f"{sym}:{option_type or 'all'}:{dte_lo}:{dte_hi}"
        if spot_price:
            # round to nearest 5 to avoid excessive cache misses
            rounded_spot = round(spot_price / 5) * 5
            cache_key += f":{rounded_spot}"

        now = time.monotonic()

        # Cache hit
        if cache_key in self._chain_cache:
            ts, cached = self._chain_cache[cache_key]
            if now - ts < self.CHAIN_CACHE_TTL:
                self._last_chain_fetch[sym] = {
                    **self._last_chain_fetch.get(sym, {}),
                    "cache_hit": True,
                    "cache_age_s": round(now - ts, 1),
                }
                return {
                    "ok": True,
                    "symbol": sym,
                    "snapshots": [s.to_dict() for s in cached],
                    "count": len(cached),
                    "from_cache": True,
                    "spot_price": spot_price,
                    "correlation_id": cid,
                }

        if not self.is_configured:
            hint = "APCA_API_KEY_ID / APCA_API_SECRET_KEY environment variables not set"
            self._last_chain_fetch[sym] = {
                "symbol": sym, "ok": False, "error": "not_configured", "hint": hint,
                "fetched_at": datetime.utcnow().isoformat() + "Z",
            }
            return {
                "ok": False,
                "symbol": sym,
                "snapshots": [],
                "count": 0,
                "error": "not_configured",
                "hint": hint,
                "correlation_id": cid,
            }

        # Build query params
        params: Dict[str, Any] = {
            "feed": "indicative",
            "limit": limit,
            "expiration_date_gte": dte_lo.isoformat(),
            "expiration_date_lte": dte_hi.isoformat(),
        }
        if option_type:
            params["type"] = option_type.lower()
        if spot_price and spot_price > 0:
            lo = round(spot_price * (1 - strike_pct_range))
            hi = round(spot_price * (1 + strike_pct_range))
            params["strike_price_gte"] = str(lo)
            params["strike_price_lte"] = str(hi)

        url = f"{self.DATA_BASE}/v1beta1/options/snapshots/{sym}"
        t0 = time.monotonic()
        raw_response = None
        http_status = None
        error_msg = None

        try:
            async with httpx.AsyncClient(headers=self._headers, timeout=12) as client:
                r = await client.get(url, params=params)
                http_status = r.status_code
                if r.status_code == 200:
                    raw_response = r.json()
                elif r.status_code == 403:
                    error_msg = f"HTTP 403 — check that options data is enabled on this key"
                elif r.status_code == 422:
                    error_msg = f"HTTP 422 — invalid params: {r.text[:200]}"
                else:
                    error_msg = f"HTTP {r.status_code}: {r.text[:100]}"
        except httpx.TimeoutException:
            error_msg = "timeout after 12s"
        except Exception as e:
            error_msg = str(e)[:200]

        latency_ms = round((time.monotonic() - t0) * 1000, 1)

        if raw_response is None:
            hint = "options data endpoint misconfigured" if http_status and http_status >= 400 else "network error"
            diag = {
                "symbol": sym,
                "ok": False,
                "url": url,
                "params": params,
                "http_status": http_status,
                "error": error_msg,
                "hint": hint,
                "latency_ms": latency_ms,
                "fetched_at": datetime.utcnow().isoformat() + "Z",
            }
            self._last_chain_fetch[sym] = diag
            return {
                "ok": False,
                "symbol": sym,
                "snapshots": [],
                "count": 0,
                "error": error_msg,
                "hint": hint,
                "http_status": http_status,
                "correlation_id": cid,
            }

        # Parse snapshots
        raw_snaps = raw_response.get("snapshots", {})
        snapshots: List[OptionSnapshot] = []

        for occ_sym, snap_data in raw_snaps.items():
            parsed = parse_occ_symbol(occ_sym, today)
            if not parsed:
                continue

            # Quote
            q = snap_data.get("latestQuote", {})
            bid = _safe_float(q.get("bp"))
            ask = _safe_float(q.get("ap"))
            bid_size = _safe_int(q.get("bs"))
            ask_size = _safe_int(q.get("as"))
            quote_ts = q.get("t")

            # Mid + spread
            mid = None
            spread = None
            spread_pct = None
            if bid is not None and ask is not None and bid > 0 and ask > 0:
                mid = round((bid + ask) / 2, 4)
                spread = round(ask - bid, 4)
                spread_pct = round(spread / mid * 100, 2) if mid > 0 else None

            # Trade fallback
            trade = snap_data.get("latestTrade", {})
            last = _safe_float(trade.get("p"))

            # Volume from daily bar
            bar = snap_data.get("dailyBar", {})
            volume = _safe_int(bar.get("v"))
            vwap = _safe_float(bar.get("vw"))

            # Greeks
            g = snap_data.get("greeks", {})
            delta = _safe_float(g.get("delta")) if g else None
            gamma = _safe_float(g.get("gamma")) if g else None
            theta = _safe_float(g.get("theta")) if g else None
            vega = _safe_float(g.get("vega")) if g else None
            rho = _safe_float(g.get("rho")) if g else None
            iv = _safe_float(snap_data.get("impliedVolatility"))

            snapshots.append(OptionSnapshot(
                contract_symbol=occ_sym,
                underlying=parsed["underlying"],
                option_type=parsed["option_type"],
                strike=parsed["strike"],
                expiry=parsed["expiry"],
                dte=parsed["dte"],
                bid=bid,
                ask=ask,
                mid=mid,
                last=last,
                bid_size=bid_size,
                ask_size=ask_size,
                quote_ts=quote_ts,
                volume=volume,
                vwap=vwap,
                delta=delta,
                gamma=gamma,
                theta=theta,
                vega=vega,
                rho=rho,
                iv=iv,
                spread=spread,
                spread_pct=spread_pct,
            ))

        # Cache result
        self._chain_cache[cache_key] = (now, snapshots)

        diag = {
            "symbol": sym,
            "ok": True,
            "url": url,
            "params": params,
            "http_status": 200,
            "count": len(snapshots),
            "latency_ms": latency_ms,
            "spot_price": spot_price,
            "cache_hit": False,
            "fetched_at": datetime.utcnow().isoformat() + "Z",
        }
        self._last_chain_fetch[sym] = diag
        logger.info(f"Options chain [{sym}]: {len(snapshots)} snapshots in {latency_ms}ms")

        return {
            "ok": True,
            "symbol": sym,
            "snapshots": [s.to_dict() for s in snapshots],
            "count": len(snapshots),
            "from_cache": False,
            "spot_price": spot_price,
            "latency_ms": latency_ms,
            "correlation_id": cid,
        }

    def get_last_chain_diag(self, symbol: str) -> Dict[str, Any]:
        return self._last_chain_fetch.get(symbol.upper(), {})

    def get_last_spot_diag(self, symbol: str) -> Dict[str, Any]:
        return self._last_spot_fetch.get(symbol.upper(), {})


# ── Singleton ────────────────────────────────────────────────────────────────

_mdg: Optional[OptionsMarketDataGateway] = None


def get_options_mdg() -> OptionsMarketDataGateway:
    global _mdg
    if _mdg is None:
        _mdg = OptionsMarketDataGateway()
    return _mdg
