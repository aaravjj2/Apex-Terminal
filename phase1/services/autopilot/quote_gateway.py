"""
Quote Gateway — Phase 1A: Real-time Market Data

Provides live stock quotes for the autopilot universe via:
  1. Alpaca Market Data WebSocket (primary) — real-time streaming
  2. Alpaca REST snapshot (fast fallback, <2s)
  3. yFinance (cold-start fallback)

Architecture:
  QuoteGateway  (singleton, long-lived)
  ├── AlpacaStreamManager  — manages WS subscribe/unsubscribe lifecycle
  ├── QuoteCache           — 1-second TTL in-memory quote cache
  └── QuoteDispatcher      — notifies subscribers (autopilot components)

Key invariants:
  - NEVER returns a price of 0.0 — raises QuoteUnavailableError or uses stale value
  - Prices are always from paper-safe sources (Alpaca paper data OR yFinance)
  - All quotes are timestamped so staleness can be detected downstream

Usage:
  from .quote_gateway import get_quote_gateway

  gw = get_quote_gateway()
  await gw.start()                    # start streaming
  q = await gw.get_quote("AAPL")      # live quote
  qs = await gw.get_quotes(["AAPL", "MSFT", "NVDA"])  # bulk
  await gw.stop()
"""

import asyncio
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Callable, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# MODELS
# ─────────────────────────────────────────────────────────────────────────────

class QuoteUnavailableError(Exception):
    """Raised when a live quote cannot be obtained for a symbol."""
    pass


@dataclass
class LiveQuote:
    """
    A single real-time price quote.

    Fields:
        symbol        : ticker symbol (upper-case)
        bid           : best bid (or last if no NBBO)
        ask           : best ask (or last if no NBBO)
        last          : last trade price
        size          : last trade size (shares)
        volume        : total trading volume today
        vwap          : volume-weighted average price
        timestamp     : quote timestamp (UTC)
        source        : "alpaca_ws" | "alpaca_rest" | "yfinance"
        stale         : True if quote is >60s old
    """
    symbol: str
    bid: float
    ask: float
    last: float
    size: float = 0.0
    volume: float = 0.0
    vwap: float = 0.0
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    source: str = "unknown"
    stale: bool = False

    @property
    def mid(self) -> float:
        """Mid-point of bid/ask."""
        if self.bid > 0 and self.ask > 0:
            return (self.bid + self.ask) / 2
        return self.last

    @property
    def spread(self) -> float:
        """Bid-ask spread in dollars."""
        return max(0.0, self.ask - self.bid)

    @property
    def spread_pct(self) -> float:
        """Bid-ask spread as % of mid."""
        m = self.mid
        if m <= 0:
            return 0.0
        return self.spread / m

    @property
    def age_seconds(self) -> float:
        """How old this quote is in seconds."""
        now = datetime.now(timezone.utc)
        ts = self.timestamp
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        return (now - ts).total_seconds()

    def is_stale(self, max_age_seconds: float = 60.0) -> bool:
        return self.age_seconds > max_age_seconds

    def to_dict(self) -> Dict:
        return {
            "symbol": self.symbol,
            "bid": round(self.bid, 4),
            "ask": round(self.ask, 4),
            "last": round(self.last, 4),
            "mid": round(self.mid, 4),
            "size": self.size,
            "volume": self.volume,
            "vwap": round(self.vwap, 4),
            "spread": round(self.spread, 4),
            "spread_pct": round(self.spread_pct * 100, 4),
            "timestamp": self.timestamp.isoformat(),
            "source": self.source,
            "stale": self.is_stale(),
            "age_seconds": round(self.age_seconds, 1),
        }


@dataclass
class QuoteBatch:
    """Bulk quote response for multiple symbols."""
    quotes: Dict[str, LiveQuote] = field(default_factory=dict)
    errors: Dict[str, str] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    source: str = "mixed"

    def get(self, symbol: str) -> Optional[LiveQuote]:
        return self.quotes.get(symbol)

    def all_available(self) -> List[str]:
        return list(self.quotes.keys())

    def to_dict(self) -> Dict:
        return {
            "timestamp": self.timestamp.isoformat(),
            "source": self.source,
            "count": len(self.quotes),
            "quotes": {s: q.to_dict() for s, q in self.quotes.items()},
            "errors": self.errors,
        }


# ─────────────────────────────────────────────────────────────────────────────
# QUOTE CACHE
# ─────────────────────────────────────────────────────────────────────────────

class QuoteCache:
    """
    Thread-safe in-memory quote cache with configurable TTL.

    Default TTL: 2 seconds for WS-updated quotes, 30s for REST quotes.
    """

    def __init__(self, default_ttl_seconds: float = 2.0):
        self._cache: Dict[str, LiveQuote] = {}
        self._default_ttl = default_ttl_seconds

    def put(self, quote: LiveQuote) -> None:
        self._cache[quote.symbol.upper()] = quote

    def get(self, symbol: str, max_age: float = None) -> Optional[LiveQuote]:
        q = self._cache.get(symbol.upper())
        if q is None:
            return None
        age_limit = max_age if max_age is not None else self._default_ttl
        if q.age_seconds > age_limit:
            return None
        return q

    def get_stale_ok(self, symbol: str) -> Optional[LiveQuote]:
        """Return quote regardless of age, for fallback use."""
        return self._cache.get(symbol.upper())

    def get_all(self) -> Dict[str, LiveQuote]:
        return dict(self._cache)

    def symbols(self) -> Set[str]:
        return set(self._cache.keys())

    def evict_old(self, max_age_seconds: float = 300.0) -> int:
        """Remove quotes older than max_age_seconds. Returns eviction count."""
        stale = [s for s, q in self._cache.items() if q.age_seconds > max_age_seconds]
        for s in stale:
            del self._cache[s]
        return len(stale)

    def size(self) -> int:
        return len(self._cache)


# ─────────────────────────────────────────────────────────────────────────────
# ALPACA REST QUOTE FETCHER
# ─────────────────────────────────────────────────────────────────────────────

class AlpacaRestQuoteFetcher:
    """
    Fetches real-time snapshots/latest quotes from Alpaca Market Data REST API.
    No WebSocket required — suitable for polling or cold-start.

    Alpaca Market Data v2 endpoints:
      GET /v2/stocks/snapshots?symbols=AAPL,MSFT   — bulk snapshot
      GET /v2/stocks/{symbol}/snapshot             — single
    """

    DATA_BASE_URL = "https://data.alpaca.markets"
    PAPER_DATA_BASE_URL = "https://data.alpaca.markets"  # same for paper

    def __init__(self, api_key: str, api_secret: str):
        self._key = api_key
        self._secret = api_secret
        self._session = None

    def _headers(self) -> Dict[str, str]:
        return {
            "APCA-API-KEY-ID": self._key,
            "APCA-API-SECRET-KEY": self._secret,
            "Accept": "application/json",
        }

    async def _get_session(self):
        try:
            import aiohttp
            if self._session is None or self._session.closed:
                self._session = aiohttp.ClientSession(headers=self._headers())
            return self._session
        except ImportError:
            raise RuntimeError("aiohttp not installed: pip install aiohttp")

    async def get_snapshot(self, symbol: str) -> Optional[LiveQuote]:
        """Fetch a single stock snapshot from Alpaca."""
        try:
            sess = await self._get_session()
            url = f"{self.DATA_BASE_URL}/v2/stocks/{symbol}/snapshot"
            async with sess.get(url, timeout=5) as resp:
                if resp.status != 200:
                    logger.warning(f"AlpacaREST snapshot {symbol}: HTTP {resp.status}")
                    return None
                data = await resp.json()
                return self._parse_snapshot(symbol, data)
        except Exception as exc:
            logger.debug(f"AlpacaREST snapshot error {symbol}: {exc}")
            return None

    async def get_snapshots(self, symbols: List[str]) -> Dict[str, LiveQuote]:
        """Fetch bulk snapshots for multiple symbols."""
        if not symbols:
            return {}
        try:
            sess = await self._get_session()
            url = f"{self.DATA_BASE_URL}/v2/stocks/snapshots"
            params = {"symbols": ",".join(symbols)}
            async with sess.get(url, params=params, timeout=8) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    logger.warning(f"AlpacaREST bulk snapshots: HTTP {resp.status} {body[:100]}")
                    return {}
                data = await resp.json()
                result = {}
                for sym, snap in data.items():
                    q = self._parse_snapshot(sym, snap)
                    if q:
                        result[sym] = q
                return result
        except Exception as exc:
            logger.debug(f"AlpacaREST bulk snapshots error: {exc}")
            return {}

    def _parse_snapshot(self, symbol: str, data: Dict) -> Optional[LiveQuote]:
        """Parse Alpaca snapshot response into LiveQuote."""
        try:
            lq = data.get("latestQuote") or {}
            lt = data.get("latestTrade") or {}
            dbar = data.get("dailyBar") or {}
            prevbar = data.get("prevDailyBar") or {}

            bid = float(lq.get("bp", 0) or 0)
            ask = float(lq.get("ap", 0) or 0)
            last = float(lt.get("p", 0) or 0)
            size = float(lt.get("s", 0) or 0)
            volume = float(dbar.get("v", 0) or 0)
            vwap = float(dbar.get("vw", 0) or 0)

            # Parse timestamp
            ts_str = lt.get("t") or lq.get("t")
            if ts_str:
                try:
                    ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                except Exception:
                    ts = datetime.now(timezone.utc)
            else:
                ts = datetime.now(timezone.utc)

            if last <= 0 and bid <= 0 and ask <= 0:
                return None

            # Use last as bid/ask fallback
            if bid <= 0:
                bid = last
            if ask <= 0:
                ask = last

            return LiveQuote(
                symbol=symbol.upper(),
                bid=bid,
                ask=ask,
                last=last,
                size=size,
                volume=volume,
                vwap=vwap,
                timestamp=ts,
                source="alpaca_rest",
            )
        except Exception as exc:
            logger.debug(f"Failed to parse snapshot for {symbol}: {exc}")
            return None

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()


# ─────────────────────────────────────────────────────────────────────────────
# YFINANCE FALLBACK FETCHER
# ─────────────────────────────────────────────────────────────────────────────

class YFinanceQuoteFetcher:
    """Fetches quotes from yFinance as a last-resort fallback."""

    def __init__(self):
        self._yf = None
        self._init()

    def _init(self):
        try:
            import yfinance as yf
            self._yf = yf
        except ImportError:
            logger.warning("yfinance not available for quote fallback")

    def get_quote(self, symbol: str) -> Optional[LiveQuote]:
        if not self._yf:
            return None
        try:
            t = self._yf.Ticker(symbol)
            info = t.fast_info
            last = getattr(info, "last_price", None) or getattr(info, "regularMarketPrice", None)
            if not last:
                return None
            bid = getattr(info, "bid", last) or last
            ask = getattr(info, "ask", last) or last
            volume = getattr(info, "three_month_average_volume", 0) or 0
            return LiveQuote(
                symbol=symbol.upper(),
                bid=float(bid),
                ask=float(ask),
                last=float(last),
                volume=float(volume),
                timestamp=datetime.now(timezone.utc),
                source="yfinance",
            )
        except Exception as exc:
            logger.debug(f"yFinance quote error {symbol}: {exc}")
            return None

    def get_quotes(self, symbols: List[str]) -> Dict[str, LiveQuote]:
        return {s: q for s in symbols if (q := self.get_quote(s)) is not None}


# ─────────────────────────────────────────────────────────────────────────────
# ALPACA WEBSOCKET STREAM MANAGER
# ─────────────────────────────────────────────────────────────────────────────

class AlpacaStreamManager:
    """
    Manages an Alpaca Market Data WebSocket connection for real-time quotes.

    Uses alpaca-py's DataStream if available.
    Falls back to manual aiohttp WebSocket connection.

    Automatically reconnects on disconnect with exponential back-off.
    """

    STREAM_URL = "wss://stream.data.alpaca.markets/v2/iex"  # free IEX feed
    STREAM_URL_SIP = "wss://stream.data.alpaca.markets/v2/sip"  # SIP (requires paid plan)

    def __init__(self, api_key: str, api_secret: str, cache: QuoteCache):
        self._key = api_key
        self._secret = api_secret
        self._cache = cache
        self._subscribed: Set[str] = set()
        self._running = False
        self._ws_task: Optional[asyncio.Task] = None
        self._reconnect_delay = 1.0
        self._max_reconnect_delay = 60.0
        self._connected = False

    async def start(self, symbols: List[str]) -> None:
        """Start streaming quotes for the given symbols."""
        self._subscribed = set(s.upper() for s in symbols)
        if not self._running:
            self._running = True
            self._ws_task = asyncio.create_task(self._stream_loop())
            logger.info(f"QuoteGateway: WS stream started for {len(self._subscribed)} symbols")

    async def subscribe(self, symbols: List[str]) -> None:
        """Subscribe to additional symbols."""
        new_syms = {s.upper() for s in symbols} - self._subscribed
        if new_syms:
            self._subscribed.update(new_syms)
            logger.info(f"QuoteGateway: Added {new_syms} to subscription")

    async def stop(self) -> None:
        """Stop streaming."""
        self._running = False
        if self._ws_task and not self._ws_task.done():
            self._ws_task.cancel()
            try:
                await self._ws_task
            except asyncio.CancelledError:
                pass
        self._connected = False
        logger.info("QuoteGateway: WS stream stopped")

    @property
    def is_connected(self) -> bool:
        return self._connected

    async def _stream_loop(self) -> None:
        """Main reconnect loop."""
        while self._running:
            try:
                await self._run_ws_session()
                self._reconnect_delay = 1.0  # reset on clean disconnect
            except asyncio.CancelledError:
                break
            except Exception as exc:
                self._connected = False
                logger.warning(f"QuoteGateway WS error: {exc}. Reconnecting in {self._reconnect_delay}s")
                await asyncio.sleep(self._reconnect_delay)
                self._reconnect_delay = min(self._reconnect_delay * 2, self._max_reconnect_delay)

    async def _run_ws_session(self) -> None:
        """Run a single WebSocket session."""
        import json
        try:
            import aiohttp
        except ImportError:
            logger.warning("aiohttp not available — WS streaming disabled")
            self._running = False
            return

        url = self.STREAM_URL
        async with aiohttp.ClientSession() as sess:
            async with sess.ws_connect(
                url,
                heartbeat=30,
                timeout=aiohttp.ClientWSTimeout(ws_connect=10),
            ) as ws:
                # Auth
                await ws.send_json({"action": "auth", "key": self._key, "secret": self._secret})
                auth_resp = await ws.receive_json(timeout=10)
                if isinstance(auth_resp, list):
                    auth_resp = auth_resp[0] if auth_resp else {}
                if auth_resp.get("T") == "error":
                    raise RuntimeError(f"Alpaca WS auth failed: {auth_resp.get('msg')}")

                # Subscribe to quotes + trades
                symbols_list = list(self._subscribed)
                await ws.send_json({
                    "action": "subscribe",
                    "quotes": symbols_list,
                    "trades": symbols_list,
                })

                self._connected = True
                logger.info(f"QuoteGateway: WS authenticated, subscribed to {len(symbols_list)} symbols")

                # Consume messages
                async for msg in ws:
                    if not self._running:
                        break
                    if msg.type == aiohttp.WSMsgType.TEXT:
                        try:
                            events = json.loads(msg.data)
                            if not isinstance(events, list):
                                events = [events]
                            for evt in events:
                                self._handle_event(evt)
                        except Exception:
                            pass
                    elif msg.type in (aiohttp.WSMsgType.ERROR, aiohttp.WSMsgType.CLOSE):
                        break

        self._connected = False

    def _handle_event(self, evt: Dict) -> None:
        """Process a single WS event and update cache."""
        t = evt.get("T", "")

        if t == "q":  # Quote
            sym = evt.get("S", "")
            if not sym:
                return
            bid = float(evt.get("bp", 0) or 0)
            ask = float(evt.get("ap", 0) or 0)
            stale_q = self._cache.get_stale_ok(sym)
            last = stale_q.last if stale_q else ((bid + ask) / 2 if bid > 0 else 0)
            q = LiveQuote(
                symbol=sym,
                bid=bid,
                ask=ask,
                last=last,
                timestamp=datetime.now(timezone.utc),
                source="alpaca_ws",
            )
            self._cache.put(q)

        elif t == "t":  # Trade
            sym = evt.get("S", "")
            if not sym:
                return
            price = float(evt.get("p", 0) or 0)
            size = float(evt.get("s", 0) or 0)
            stale_q = self._cache.get_stale_ok(sym)
            bid = stale_q.bid if stale_q else price
            ask = stale_q.ask if stale_q else price
            q = LiveQuote(
                symbol=sym,
                bid=bid,
                ask=ask,
                last=price,
                size=size,
                volume=(stale_q.volume if stale_q else 0),
                timestamp=datetime.now(timezone.utc),
                source="alpaca_ws",
            )
            self._cache.put(q)


# ─────────────────────────────────────────────────────────────────────────────
# QUOTE GATEWAY  (main public interface)
# ─────────────────────────────────────────────────────────────────────────────

class QuoteGateway:
    """
    Unified real-time quote gateway.

    Priority order for quote retrieval:
      1. Alpaca WS cache (< 2s old)
      2. Alpaca REST snapshot
      3. yFinance

    Never returns price = 0. Raises QuoteUnavailableError if all sources fail.
    """

    # Stale threshold for WS cache before falling back to REST
    WS_CACHE_MAX_AGE = 5.0     # seconds
    REST_CACHE_MAX_AGE = 30.0  # seconds for REST quotes

    def __init__(self):
        self._api_key = os.environ.get("APCA_API_KEY_ID", "")
        self._api_secret = os.environ.get("APCA_API_SECRET_KEY", "")
        self._cache = QuoteCache(default_ttl_seconds=self.WS_CACHE_MAX_AGE)
        self._rest = AlpacaRestQuoteFetcher(self._api_key, self._api_secret)
        self._stream = AlpacaStreamManager(self._api_key, self._api_secret, self._cache)
        self._yf = YFinanceQuoteFetcher()
        self._started = False
        self._universe: List[str] = []

        # Subscribers: callbacks notified on each quote update
        self._subscribers: List[Callable[[LiveQuote], None]] = []

        # Perf stats
        self._stats = {
            "ws_hits": 0,
            "rest_hits": 0,
            "yf_hits": 0,
            "misses": 0,
            "total_requests": 0,
        }

    @property
    def is_connected(self) -> bool:
        return self._stream.is_connected

    @property
    def stats(self) -> Dict:
        return dict(self._stats)

    def set_universe(self, symbols: List[str]) -> None:
        """Set the trading universe for streaming."""
        self._universe = [s.upper() for s in symbols]

    async def start(self, symbols: Optional[List[str]] = None) -> None:
        """Start the quote gateway (WS streaming + REST warmup)."""
        if self._started:
            return

        if symbols:
            self._universe = [s.upper() for s in symbols]

        if not self._api_key or not self._api_secret:
            logger.warning("QuoteGateway: Alpaca credentials missing — REST-only mode")
        else:
            # Warm up cache with REST snapshots first (immediate availability)
            if self._universe:
                logger.info(f"QuoteGateway: Warming up REST snapshots for {len(self._universe)} symbols...")
                rest_quotes = await self._rest.get_snapshots(self._universe)
                for q in rest_quotes.values():
                    self._cache.put(q)
                logger.info(f"QuoteGateway: Warmed {len(rest_quotes)} quotes via REST")

            # Start WebSocket stream for real-time updates
            try:
                await self._stream.start(self._universe)
            except Exception as exc:
                logger.warning(f"QuoteGateway: WS start failed ({exc}) — REST-only fallback")

        self._started = True
        logger.info("QuoteGateway started")

    async def stop(self) -> None:
        """Stop the gateway."""
        await self._stream.stop()
        await self._rest.close()
        self._started = False
        logger.info("QuoteGateway stopped")

    def subscribe(self, callback: Callable[[LiveQuote], None]) -> None:
        """Register a callback for quote updates."""
        self._subscribers.append(callback)

    async def get_quote(self, symbol: str) -> LiveQuote:
        """
        Get a live quote for a single symbol.

        Tries WS cache → REST → yFinance.
        Raises QuoteUnavailableError if all sources fail.
        """
        symbol = symbol.upper()
        self._stats["total_requests"] += 1

        # 1. WS cache (freshest)
        q = self._cache.get(symbol, max_age=self.WS_CACHE_MAX_AGE)
        if q and q.last > 0:
            self._stats["ws_hits"] += 1
            return q

        # 2. Alpaca REST
        if self._api_key:
            q = await self._rest.get_snapshot(symbol)
            if q and q.last > 0:
                self._cache.put(q)
                self._stats["rest_hits"] += 1
                return q

        # 3. yFinance
        q = self._yf.get_quote(symbol)
        if q and q.last > 0:
            self._cache.put(q)
            self._stats["yf_hits"] += 1
            return q

        # 4. Stale cache (better than nothing)
        stale = self._cache.get_stale_ok(symbol)
        if stale and stale.last > 0:
            stale.stale = True
            logger.warning(f"QuoteGateway: Returning stale quote for {symbol} (age={stale.age_seconds:.1f}s)")
            return stale

        self._stats["misses"] += 1
        raise QuoteUnavailableError(f"No quote available for {symbol}")

    async def get_quotes(
        self,
        symbols: List[str],
        allow_partial: bool = True,
    ) -> QuoteBatch:
        """
        Get live quotes for multiple symbols efficiently.

        Uses REST bulk API for symbols not in cache + WS cache for fresh ones.
        """
        symbols = [s.upper() for s in symbols]
        result = QuoteBatch()

        # 1. Fill from WS cache
        needs_rest: List[str] = []
        for s in symbols:
            q = self._cache.get(s, max_age=self.WS_CACHE_MAX_AGE)
            if q and q.last > 0:
                result.quotes[s] = q
                self._stats["ws_hits"] += 1
            else:
                needs_rest.append(s)

        # 2. Bulk REST for missing
        if needs_rest and self._api_key:
            rest_quotes = await self._rest.get_snapshots(needs_rest)
            for s, q in rest_quotes.items():
                self._cache.put(q)
                result.quotes[s] = q
                self._stats["rest_hits"] += 1
            needs_rest = [s for s in needs_rest if s not in rest_quotes]

        # 3. yFinance for still-missing
        if needs_rest:
            for s in needs_rest:
                q = self._yf.get_quote(s)
                if q and q.last > 0:
                    self._cache.put(q)
                    result.quotes[s] = q
                    self._stats["yf_hits"] += 1
                else:
                    stale = self._cache.get_stale_ok(s)
                    if stale and stale.last > 0:
                        stale.stale = True
                        result.quotes[s] = stale
                    elif not allow_partial:
                        result.errors[s] = "quote_unavailable"
                    self._stats["misses"] += 1

        self._stats["total_requests"] += len(symbols)
        result.source = "mixed"
        return result

    async def get_universe_quotes(self) -> QuoteBatch:
        """Get quotes for all symbols in the configured universe."""
        if not self._universe:
            return QuoteBatch()
        return await self.get_quotes(self._universe)

    def get_cached(self, symbol: str) -> Optional[LiveQuote]:
        """Return cached quote (no network call). None if not cached."""
        return self._cache.get_stale_ok(symbol.upper())

    async def refresh_universe(self) -> int:
        """Force-refresh all universe quotes via REST. Returns updated count."""
        if not self._universe:
            return 0
        rest_quotes = await self._rest.get_snapshots(self._universe)
        for q in rest_quotes.values():
            self._cache.put(q)
        return len(rest_quotes)

    def health(self) -> Dict:
        """Return gateway health snapshot."""
        return {
            "started": self._started,
            "ws_connected": self._stream.is_connected,
            "cache_size": self._cache.size(),
            "universe_size": len(self._universe),
            "stats": self._stats,
            "api_key_configured": bool(self._api_key),
            "yfinance_available": self._yf._yf is not None,
        }


# ─────────────────────────────────────────────────────────────────────────────
# OPTIONS CHAIN GATEWAY
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class OptionsContract:
    """
    A single options contract with live market data.

    Fields follow OCC symbology: AAPL230616C00185000
    """
    symbol: str               # OCC symbol
    underlying: str           # ticker (AAPL)
    option_type: str          # "call" | "put"
    strike: float
    expiry: str               # YYYY-MM-DD
    dte: int                  # days to expiry
    bid: float
    ask: float
    last: float
    volume: int
    open_interest: int
    iv: float                 # implied volatility (0-1)
    delta: Optional[float] = None
    gamma: Optional[float] = None
    theta: Optional[float] = None
    vega: Optional[float] = None
    underlying_price: float = 0.0
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    source: str = "unknown"

    @property
    def mid(self) -> float:
        if self.bid > 0 and self.ask > 0:
            return (self.bid + self.ask) / 2
        return self.last

    @property
    def spread_pct(self) -> float:
        m = self.mid
        if m <= 0:
            return 0.0
        return (self.ask - self.bid) / m

    @property
    def moneyness(self) -> str:
        if self.underlying_price <= 0:
            return "unknown"
        if self.option_type == "call":
            ratio = self.underlying_price / self.strike
        else:
            ratio = self.strike / self.underlying_price
        if ratio > 1.03:
            return "itm"
        elif ratio < 0.97:
            return "otm"
        return "atm"

    def to_dict(self) -> Dict:
        return {
            "symbol": self.symbol,
            "underlying": self.underlying,
            "option_type": self.option_type,
            "strike": self.strike,
            "expiry": self.expiry,
            "dte": self.dte,
            "bid": self.bid,
            "ask": self.ask,
            "last": self.last,
            "mid": round(self.mid, 4),
            "volume": self.volume,
            "open_interest": self.open_interest,
            "iv": round(self.iv, 4),
            "delta": self.delta,
            "gamma": self.gamma,
            "theta": self.theta,
            "vega": self.vega,
            "underlying_price": self.underlying_price,
            "spread_pct": round(self.spread_pct * 100, 2),
            "moneyness": self.moneyness,
            "timestamp": self.timestamp.isoformat(),
            "source": self.source,
        }


@dataclass
class OptionsChain:
    """Full options chain for a symbol at a given expiry."""
    underlying: str
    expiry: str
    underlying_price: float
    contracts: List[OptionsContract] = field(default_factory=list)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    source: str = "unknown"

    @property
    def calls(self) -> List[OptionsContract]:
        return [c for c in self.contracts if c.option_type == "call"]

    @property
    def puts(self) -> List[OptionsContract]:
        return [c for c in self.contracts if c.option_type == "put"]

    def get_by_delta(self, target_delta: float, option_type: str = "put") -> Optional[OptionsContract]:
        """Find the contract closest to target_delta."""
        candidates = [c for c in self.contracts if c.option_type == option_type and c.delta is not None]
        if not candidates:
            return None
        target = abs(target_delta)
        return min(candidates, key=lambda c: abs(abs(c.delta) - target))

    def get_by_strike(self, strike: float, option_type: str = "put") -> Optional[OptionsContract]:
        """Find the contract at or nearest to the given strike."""
        candidates = [c for c in self.contracts if c.option_type == option_type]
        if not candidates:
            return None
        return min(candidates, key=lambda c: abs(c.strike - strike))

    def to_dict(self) -> Dict:
        return {
            "underlying": self.underlying,
            "expiry": self.expiry,
            "underlying_price": self.underlying_price,
            "contract_count": len(self.contracts),
            "calls_count": len(self.calls),
            "puts_count": len(self.puts),
            "timestamp": self.timestamp.isoformat(),
            "source": self.source,
            "contracts": [c.to_dict() for c in self.contracts],
        }


class OptionsChainGateway:
    """
    Provides live options chain data from multiple sources.

    Priority:
      1. Tradier (real greeks, real-time)
      2. Alpaca options snapshot (v2/options/snapshots)
      3. yFinance option_chain (no greeks but has strikes/IV)

    Cache TTL: 60s (options chains change relatively slowly intraday).
    """

    CHAIN_CACHE_TTL = 60.0  # seconds

    def __init__(self, quote_gateway: QuoteGateway):
        self._quote_gw = quote_gateway
        self._cache: Dict[str, Tuple[float, OptionsChain]] = {}  # key -> (ts, chain)
        self._tradier_key = os.environ.get("TRADIER_BROKERAGE_KEY", "")
        self._alpaca_key = os.environ.get("APCA_API_KEY_ID", "")
        self._alpaca_secret = os.environ.get("APCA_API_SECRET_KEY", "")

    def _cache_key(self, symbol: str, expiry: str) -> str:
        return f"{symbol.upper()}_{expiry}"

    def _is_cached(self, key: str) -> bool:
        if key not in self._cache:
            return False
        ts, _ = self._cache[key]
        return (time.monotonic() - ts) < self.CHAIN_CACHE_TTL

    async def get_chain(
        self,
        symbol: str,
        expiry: Optional[str] = None,
        weekly_only: bool = False,
    ) -> Optional[OptionsChain]:
        """
        Get the options chain for a symbol.

        If expiry is None, uses the nearest weekly expiry.
        """
        from datetime import date

        symbol = symbol.upper()

        # Resolve expiry
        if expiry is None:
            expiry = self._get_next_weekly_expiry().strftime("%Y-%m-%d")

        cache_key = self._cache_key(symbol, expiry)
        if self._is_cached(cache_key):
            _, chain = self._cache[cache_key]
            return chain

        # Try sources in priority order
        chain = None
        if self._tradier_key:
            chain = await self._fetch_tradier_chain(symbol, expiry)
        if chain is None and self._alpaca_key:
            chain = await self._fetch_alpaca_chain(symbol, expiry)
        if chain is None:
            chain = await self._fetch_yfinance_chain(symbol, expiry)

        if chain:
            self._cache[cache_key] = (time.monotonic(), chain)

        return chain

    def _get_next_weekly_expiry(self):
        """Get the next Friday expiry."""
        from datetime import date, timedelta
        today = date.today()
        days_to_friday = (4 - today.weekday()) % 7
        if days_to_friday == 0:
            days_to_friday = 7
        return today + timedelta(days=days_to_friday)

    def _get_dte(self, expiry_str: str) -> int:
        """Calculate days to expiry."""
        from datetime import date
        try:
            expiry_date = date.fromisoformat(expiry_str)
            return max(0, (expiry_date - date.today()).days)
        except Exception:
            return 0

    async def _fetch_tradier_chain(self, symbol: str, expiry: str) -> Optional[OptionsChain]:
        """Fetch from Tradier brokerage API."""
        try:
            import aiohttp
            dte = self._get_dte(expiry)
            underlying_price = 0.0

            # Get underlying price from quote gateway
            try:
                q = await self._quote_gw.get_quote(symbol)
                underlying_price = q.last
            except Exception:
                pass

            url = "https://api.tradier.com/v1/markets/options/chains"
            headers = {
                "Authorization": f"Bearer {self._tradier_key}",
                "Accept": "application/json",
            }
            params = {
                "symbol": symbol,
                "expiration": expiry,
                "greeks": "true",
            }

            async with aiohttp.ClientSession() as sess:
                async with sess.get(url, headers=headers, params=params, timeout=8) as resp:
                    if resp.status != 200:
                        logger.debug(f"Tradier chain {symbol}: HTTP {resp.status}")
                        return None
                    data = await resp.json()

            options = data.get("options", {})
            if not options:
                return None
            option_list = options.get("option", [])
            if not option_list:
                return None
            if isinstance(option_list, dict):
                option_list = [option_list]

            contracts = []
            for opt in option_list:
                greeks = opt.get("greeks") or {}
                try:
                    c = OptionsContract(
                        symbol=opt.get("symbol", ""),
                        underlying=symbol,
                        option_type=opt.get("option_type", "").lower(),
                        strike=float(opt.get("strike", 0)),
                        expiry=expiry,
                        dte=dte,
                        bid=float(opt.get("bid", 0) or 0),
                        ask=float(opt.get("ask", 0) or 0),
                        last=float(opt.get("last", 0) or 0),
                        volume=int(opt.get("volume", 0) or 0),
                        open_interest=int(opt.get("open_interest", 0) or 0),
                        iv=float(opt.get("mid_iv", 0) or opt.get("ask_iv", 0) or 0),
                        delta=float(greeks.get("delta", 0) or 0) if greeks else None,
                        gamma=float(greeks.get("gamma", 0) or 0) if greeks else None,
                        theta=float(greeks.get("theta", 0) or 0) if greeks else None,
                        vega=float(greeks.get("vega", 0) or 0) if greeks else None,
                        underlying_price=underlying_price,
                        source="tradier",
                    )
                    contracts.append(c)
                except Exception:
                    continue

            return OptionsChain(
                underlying=symbol,
                expiry=expiry,
                underlying_price=underlying_price,
                contracts=contracts,
                source="tradier",
            )
        except Exception as exc:
            logger.debug(f"Tradier chain fetch failed for {symbol}: {exc}")
            return None

    async def _fetch_alpaca_chain(self, symbol: str, expiry: str) -> Optional[OptionsChain]:
        """Fetch from Alpaca v2 options snapshot API."""
        try:
            import aiohttp
            dte = self._get_dte(expiry)
            underlying_price = 0.0

            try:
                q = await self._quote_gw.get_quote(symbol)
                underlying_price = q.last
            except Exception:
                pass

            # Format expiry for Alpaca: YYYY-MM-DD
            url = "https://data.alpaca.markets/v2/options/snapshots"
            headers = {
                "APCA-API-KEY-ID": self._alpaca_key,
                "APCA-API-SECRET-KEY": self._alpaca_secret,
            }
            params = {
                "underlying_symbols": symbol,
                "expiration_date": expiry,
                "limit": 500,
            }

            async with aiohttp.ClientSession() as sess:
                async with sess.get(url, headers=headers, params=params, timeout=8) as resp:
                    if resp.status != 200:
                        logger.debug(f"Alpaca options snapshot {symbol}: HTTP {resp.status}")
                        return None
                    data = await resp.json()

            snapshots = data.get("snapshots", {})
            if not snapshots:
                return None

            contracts = []
            for occ_sym, snap in snapshots.items():
                try:
                    details = snap.get("details", {}) or {}
                    lq = snap.get("latestQuote", {}) or {}
                    lt = snap.get("latestTrade", {}) or {}
                    greeks = snap.get("greeks", {}) or {}

                    opt_type = details.get("type", "").lower()
                    strike = float(details.get("strikePrice", 0) or 0)
                    exp_str = details.get("expirationDate", expiry)

                    c = OptionsContract(
                        symbol=occ_sym,
                        underlying=symbol,
                        option_type=opt_type,
                        strike=strike,
                        expiry=exp_str,
                        dte=self._get_dte(exp_str),
                        bid=float(lq.get("bp", 0) or 0),
                        ask=float(lq.get("ap", 0) or 0),
                        last=float(lt.get("p", 0) or 0),
                        volume=int(lt.get("s", 0) or 0),
                        open_interest=0,
                        iv=float(greeks.get("impliedVolatility", 0) or 0),
                        delta=float(greeks.get("delta", 0) or 0) or None,
                        gamma=float(greeks.get("gamma", 0) or 0) or None,
                        theta=float(greeks.get("theta", 0) or 0) or None,
                        vega=float(greeks.get("vega", 0) or 0) or None,
                        underlying_price=underlying_price,
                        source="alpaca",
                    )
                    contracts.append(c)
                except Exception:
                    continue

            if not contracts:
                return None

            return OptionsChain(
                underlying=symbol,
                expiry=expiry,
                underlying_price=underlying_price,
                contracts=contracts,
                source="alpaca",
            )
        except Exception as exc:
            logger.debug(f"Alpaca options chain failed for {symbol}: {exc}")
            return None

    async def _fetch_yfinance_chain(self, symbol: str, expiry: str) -> Optional[OptionsChain]:
        """Fetch from yFinance (no greeks, but has strikes and IV)."""
        try:
            import yfinance as yf
            from datetime import date as date_obj

            underlying_price = 0.0
            try:
                q = await self._quote_gw.get_quote(symbol)
                underlying_price = q.last
            except Exception:
                pass

            t = yf.Ticker(symbol)
            expirations = t.options
            if not expirations:
                return None

            # Find closest expiry  
            target = date_obj.fromisoformat(expiry)
            available = sorted(expirations, key=lambda e: abs((date_obj.fromisoformat(e) - target).days))
            chosen_expiry = available[0]

            chain = t.option_chain(chosen_expiry)
            dte = self._get_dte(chosen_expiry)

            contracts = []
            for df, opt_type in [(chain.calls, "call"), (chain.puts, "put")]:
                for _, row in df.iterrows():
                    try:
                        c = OptionsContract(
                            symbol=str(row.get("contractSymbol", "")),
                            underlying=symbol,
                            option_type=opt_type,
                            strike=float(row.get("strike", 0)),
                            expiry=chosen_expiry,
                            dte=dte,
                            bid=float(row.get("bid", 0) or 0),
                            ask=float(row.get("ask", 0) or 0),
                            last=float(row.get("lastPrice", 0) or 0),
                            volume=int(row.get("volume", 0) or 0),
                            open_interest=int(row.get("openInterest", 0) or 0),
                            iv=float(row.get("impliedVolatility", 0) or 0),
                            underlying_price=underlying_price,
                            source="yfinance",
                        )
                        contracts.append(c)
                    except Exception:
                        continue

            if not contracts:
                return None

            return OptionsChain(
                underlying=symbol,
                expiry=chosen_expiry,
                underlying_price=underlying_price,
                contracts=contracts,
                source="yfinance",
            )
        except Exception as exc:
            logger.debug(f"yFinance chain failed for {symbol}: {exc}")
            return None

    def health(self) -> Dict:
        return {
            "tradier_configured": bool(self._tradier_key),
            "alpaca_configured": bool(self._alpaca_key),
            "cache_entries": len(self._cache),
        }


# ─────────────────────────────────────────────────────────────────────────────
# SINGLETON ACCESSORS
# ─────────────────────────────────────────────────────────────────────────────

_quote_gateway: Optional[QuoteGateway] = None
_options_gateway: Optional[OptionsChainGateway] = None


def get_quote_gateway() -> QuoteGateway:
    """Get or create the singleton QuoteGateway."""
    global _quote_gateway
    if _quote_gateway is None:
        _quote_gateway = QuoteGateway()
    return _quote_gateway


def get_options_gateway() -> OptionsChainGateway:
    """Get or create the singleton OptionsChainGateway."""
    global _options_gateway
    if _options_gateway is None:
        _options_gateway = OptionsChainGateway(get_quote_gateway())
    return _options_gateway


async def start_gateways(symbols: List[str]) -> None:
    """Start both gateways with the given universe."""
    gw = get_quote_gateway()
    gw.set_universe(symbols)
    await gw.start(symbols)
    logger.info(f"Gateways started for {len(symbols)} symbols")


async def stop_gateways() -> None:
    """Stop both gateways cleanly."""
    global _quote_gateway
    if _quote_gateway:
        await _quote_gateway.stop()
    logger.info("Gateways stopped")
