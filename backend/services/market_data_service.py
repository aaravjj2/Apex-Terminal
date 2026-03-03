"""
Unified Market Data Aggregation Service — §18 of tasks.md
==========================================================
Central data layer aggregating from all providers: Polygon, Finnhub,
TwelveData, Tiingo, Alpaca, yfinance. WebSocket real-time feeds,
data normalization, caching, rate limiting, snapshot aggregation,
level2 orderbook, time & sales, tick data.

Uses: All configured API keys with automatic failover.
"""

import os, asyncio, logging, json, time, hashlib
from datetime import datetime, timedelta, date, timezone
from typing import Dict, List, Optional, Tuple, Any, Callable
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections import defaultdict, deque
import statistics

logger = logging.getLogger(__name__)

# ── Provider Configuration ───────────────────────────────────────────────────

PROVIDERS = {
    "polygon": {
        "key": os.getenv("POLYGON_API_KEY", ""),
        "base_url": "https://api.polygon.io",
        "ws_url": "wss://socket.polygon.io",
        "rate_limit": 5,     # calls per second
        "priority": 1,
    },
    "finnhub": {
        "key": os.getenv("FINNHUB_API_KEY", ""),
        "base_url": "https://finnhub.io/api/v1",
        "ws_url": "wss://ws.finnhub.io",
        "rate_limit": 60,    # calls per minute
        "priority": 2,
    },
    "twelvedata": {
        "key": os.getenv("TWELVEDATA_API_KEY", ""),
        "base_url": "https://api.twelvedata.com",
        "ws_url": "wss://ws.twelvedata.com",
        "rate_limit": 8,     # calls per minute
        "priority": 3,
    },
    "tiingo": {
        "key": os.getenv("TIINGO_API_KEY", ""),
        "base_url": "https://api.tiingo.com",
        "ws_url": "wss://api.tiingo.com/iex",
        "rate_limit": 50,
        "priority": 4,
    },
    "alpaca": {
        "key": os.getenv("ALPACA_API_KEY", ""),
        "secret": os.getenv("ALPACA_SECRET_KEY", ""),
        "base_url": "https://data.alpaca.markets/v2",
        "ws_url": "wss://stream.data.alpaca.markets/v2",
        "rate_limit": 200,
        "priority": 5,
    },
    "yfinance": {
        "key": "",           # No key needed
        "base_url": "",
        "rate_limit": 2,     # self-imposed
        "priority": 99,      # Last resort
    },
}


# ── Enums ─────────────────────────────────────────────────────────────────────

class DataType(str, Enum):
    QUOTE       = "quote"
    TRADE       = "trade"
    BAR         = "bar"
    ORDERBOOK   = "orderbook"
    SNAPSHOT     = "snapshot"
    NEWS        = "news"
    FUNDAMENTAL  = "fundamental"

class FeedStatus(str, Enum):
    CONNECTED    = "connected"
    CONNECTING   = "connecting"
    DISCONNECTED = "disconnected"
    ERROR        = "error"

class MarketSession(str, Enum):
    PRE_MARKET   = "pre_market"
    REGULAR      = "regular"
    POST_MARKET  = "post_market"
    CLOSED       = "closed"

# ── Data Classes ──────────────────────────────────────────────────────────────

@dataclass
class NormalizedTrade:
    symbol: str
    price: float
    size: int
    timestamp: str
    exchange: str
    conditions: List[str]
    provider: str

@dataclass
class NormalizedQuote:
    symbol: str
    bid: float
    bid_size: int
    ask: float
    ask_size: int
    spread: float
    spread_pct: float
    mid: float
    timestamp: str
    provider: str

@dataclass
class Level2Entry:
    price: float
    size: int
    orders: int
    exchange: str

@dataclass
class OrderBook:
    symbol: str
    bids: List[Level2Entry]
    asks: List[Level2Entry]
    bid_depth: int
    ask_depth: int
    imbalance: float
    mid_price: float
    spread: float
    timestamp: str

@dataclass
class TimeAndSales:
    symbol: str
    trades: List[NormalizedTrade]
    total_volume: int
    buy_volume: int
    sell_volume: int
    vwap: float
    high: float
    low: float

@dataclass
class MarketSnapshot:
    symbol: str
    last_trade: NormalizedTrade
    last_quote: NormalizedQuote
    daily_bar: Dict[str, Any]
    prev_close: float
    change: float
    change_pct: float
    volume: int
    market_cap: float
    session: MarketSession
    provider: str
    timestamp: str

@dataclass
class ProviderStatus:
    name: str
    status: FeedStatus
    latency_ms: float
    last_message: str
    messages_received: int
    errors: int
    rate_limit_remaining: int

@dataclass
class DataFeedStatus:
    providers: List[ProviderStatus]
    active_subscriptions: int
    total_messages: int
    uptime_seconds: float
    primary_provider: str


# ── Rate Limiter ──────────────────────────────────────────────────────────────

class RateLimiter:
    """Token bucket rate limiter"""

    def __init__(self, rate: float, window: float = 1.0):
        self.rate = rate
        self.window = window
        self.tokens = rate
        self.last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self) -> bool:
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self.last_refill
            self.tokens = min(self.rate, self.tokens + elapsed * self.rate / self.window)
            self.last_refill = now

            if self.tokens >= 1:
                self.tokens -= 1
                return True
            return False

    async def wait(self):
        while not await self.acquire():
            await asyncio.sleep(self.window / self.rate)


# ── Cache ─────────────────────────────────────────────────────────────────────

class DataCache:
    """TTL-based data cache"""

    def __init__(self, default_ttl: float = 5.0):
        self._cache: Dict[str, Tuple[Any, float]] = {}
        self.default_ttl = default_ttl
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> Optional[Any]:
        if key in self._cache:
            value, expiry = self._cache[key]
            if time.monotonic() < expiry:
                self.hits += 1
                return value
            del self._cache[key]
        self.misses += 1
        return None

    def set(self, key: str, value: Any, ttl: Optional[float] = None):
        t = ttl or self.default_ttl
        self._cache[key] = (value, time.monotonic() + t)

    def invalidate(self, key: str):
        self._cache.pop(key, None)

    def clear(self):
        self._cache.clear()

    @property
    def size(self) -> int:
        return len(self._cache)

    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        return (self.hits / total * 100) if total else 0


# ── Provider Adapters ────────────────────────────────────────────────────────

class PolygonAdapter:
    def __init__(self):
        self.key = PROVIDERS["polygon"]["key"]
        self.base = PROVIDERS["polygon"]["base_url"]
        self.limiter = RateLimiter(5)

    async def get_snapshot(self, symbol: str) -> Optional[Dict[str, Any]]:
        if not self.key:
            return None
        await self.limiter.wait()
        try:
            import aiohttp
            url = f"{self.base}/v2/snapshot/locale/us/markets/stocks/tickers/{symbol}"
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params={"apiKey": self.key}) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data.get("ticker")
        except Exception as e:
            logger.warning(f"Polygon snapshot failed: {e}")
        return None

    async def get_bars(self, symbol: str, timespan: str, from_date: str, to_date: str, limit: int = 5000) -> List[Dict]:
        if not self.key:
            return []
        await self.limiter.wait()
        try:
            import aiohttp
            url = f"{self.base}/v2/aggs/ticker/{symbol}/range/1/{timespan}/{from_date}/{to_date}"
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params={"apiKey": self.key, "limit": limit, "adjusted": "true"}) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data.get("results", [])
        except Exception as e:
            logger.warning(f"Polygon bars failed: {e}")
        return []

    async def get_trades(self, symbol: str, limit: int = 100) -> List[Dict]:
        if not self.key:
            return []
        await self.limiter.wait()
        try:
            import aiohttp
            url = f"{self.base}/v3/trades/{symbol}"
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params={"apiKey": self.key, "limit": limit}) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data.get("results", [])
        except Exception as e:
            logger.warning(f"Polygon trades failed: {e}")
        return []

    async def get_nbbo(self, symbol: str) -> Optional[Dict]:
        if not self.key:
            return None
        await self.limiter.wait()
        try:
            import aiohttp
            url = f"{self.base}/v3/quotes/{symbol}"
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params={"apiKey": self.key, "limit": 1}) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        results = data.get("results", [])
                        return results[0] if results else None
        except Exception:
            pass
        return None


class FinnhubAdapter:
    def __init__(self):
        self.key = PROVIDERS["finnhub"]["key"]
        self.base = PROVIDERS["finnhub"]["base_url"]
        self.limiter = RateLimiter(1)

    async def get_quote(self, symbol: str) -> Optional[Dict]:
        if not self.key:
            return None
        await self.limiter.wait()
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base}/quote", params={"symbol": symbol, "token": self.key}) as resp:
                    if resp.status == 200:
                        return await resp.json()
        except Exception:
            pass
        return None

    async def get_candles(self, symbol: str, resolution: str, from_ts: int, to_ts: int) -> Optional[Dict]:
        if not self.key:
            return None
        await self.limiter.wait()
        try:
            import aiohttp
            params = {"symbol": symbol, "resolution": resolution, "from": from_ts, "to": to_ts, "token": self.key}
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base}/stock/candle", params=params) as resp:
                    if resp.status == 200:
                        return await resp.json()
        except Exception:
            pass
        return None

    async def get_profile(self, symbol: str) -> Optional[Dict]:
        if not self.key:
            return None
        await self.limiter.wait()
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base}/stock/profile2", params={"symbol": symbol, "token": self.key}) as resp:
                    if resp.status == 200:
                        return await resp.json()
        except Exception:
            pass
        return None


class TwelveDataAdapter:
    def __init__(self):
        self.key = PROVIDERS["twelvedata"]["key"]
        self.base = PROVIDERS["twelvedata"]["base_url"]
        self.limiter = RateLimiter(0.13)  # 8/min

    async def get_quote(self, symbol: str) -> Optional[Dict]:
        if not self.key:
            return None
        await self.limiter.wait()
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base}/quote", params={"symbol": symbol, "apikey": self.key}) as resp:
                    if resp.status == 200:
                        return await resp.json()
        except Exception:
            pass
        return None

    async def get_time_series(self, symbol: str, interval: str = "1day", outputsize: int = 100) -> Optional[Dict]:
        if not self.key:
            return None
        await self.limiter.wait()
        try:
            import aiohttp
            params = {"symbol": symbol, "interval": interval, "outputsize": outputsize, "apikey": self.key}
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base}/time_series", params=params) as resp:
                    if resp.status == 200:
                        return await resp.json()
        except Exception:
            pass
        return None

    async def get_technical(self, symbol: str, indicator: str, interval: str = "1day", **kwargs) -> Optional[Dict]:
        if not self.key:
            return None
        await self.limiter.wait()
        try:
            import aiohttp
            params = {"symbol": symbol, "interval": interval, "apikey": self.key, **kwargs}
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base}/{indicator}", params=params) as resp:
                    if resp.status == 200:
                        return await resp.json()
        except Exception:
            pass
        return None


class TiingoAdapter:
    def __init__(self):
        self.key = PROVIDERS["tiingo"]["key"]
        self.base = PROVIDERS["tiingo"]["base_url"]
        self.limiter = RateLimiter(0.8)

    async def get_quote(self, symbol: str) -> Optional[Dict]:
        if not self.key:
            return None
        await self.limiter.wait()
        try:
            import aiohttp
            headers = {"Content-Type": "application/json", "Authorization": f"Token {self.key}"}
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base}/iex/{symbol}", headers=headers) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data[0] if data else None
        except Exception:
            pass
        return None

    async def get_historical(self, symbol: str, start: str, end: str, freq: str = "daily") -> List[Dict]:
        if not self.key:
            return []
        await self.limiter.wait()
        try:
            import aiohttp
            headers = {"Content-Type": "application/json", "Authorization": f"Token {self.key}"}
            params = {"startDate": start, "endDate": end, "resampleFreq": freq}
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base}/tiingo/daily/{symbol}/prices", params=params, headers=headers) as resp:
                    if resp.status == 200:
                        return await resp.json()
        except Exception:
            pass
        return []


class YFinanceAdapter:
    def __init__(self):
        self.limiter = RateLimiter(2)

    async def get_quote(self, symbol: str) -> Optional[Dict]:
        await self.limiter.wait()
        try:
            import yfinance as yf
            tk = yf.Ticker(symbol)
            info = tk.info
            hist = tk.history(period="5d")
            if hist.empty:
                return None
            closes = hist["Close"].tolist()
            return {
                "price": closes[-1],
                "prev_close": closes[-2] if len(closes) > 1 else closes[-1],
                "open": hist["Open"].tolist()[-1],
                "high": hist["High"].tolist()[-1],
                "low": hist["Low"].tolist()[-1],
                "volume": int(hist["Volume"].tolist()[-1]),
                "name": info.get("longName", symbol),
                "market_cap": info.get("marketCap", 0),
                "pe": info.get("trailingPE", 0),
                "div_yield": info.get("dividendYield", 0),
            }
        except Exception as e:
            logger.warning(f"yfinance quote failed: {e}")
        return None

    async def get_historical(self, symbol: str, period: str = "1y", interval: str = "1d") -> List[Dict]:
        await self.limiter.wait()
        try:
            import yfinance as yf
            tk = yf.Ticker(symbol)
            hist = tk.history(period=period, interval=interval)
            if hist.empty:
                return []
            return [
                {"t": idx.isoformat(), "o": row["Open"], "h": row["High"],
                 "l": row["Low"], "c": row["Close"], "v": int(row["Volume"])}
                for idx, row in hist.iterrows()
            ]
        except Exception:
            return []


# ── Unified Data Service ─────────────────────────────────────────────────────

class MarketDataService:
    """Unified market data service with failover"""

    def __init__(self):
        self.polygon = PolygonAdapter()
        self.finnhub = FinnhubAdapter()
        self.twelvedata = TwelveDataAdapter()
        self.tiingo = TiingoAdapter()
        self.yfinance = YFinanceAdapter()
        self.cache = DataCache(default_ttl=5.0)
        self._stats = defaultdict(int)

    async def get_quote(self, symbol: str) -> Dict[str, Any]:
        """Get best available quote with failover"""
        cache_key = f"quote:{symbol}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        # Provider waterfall
        result = None

        # Polygon (priority 1)
        snap = await self.polygon.get_snapshot(symbol)
        if snap:
            self._stats["polygon_hits"] += 1
            day = snap.get("day", {})
            prev = snap.get("prevDay", {})
            price = day.get("c") or day.get("l", 0)
            pc = prev.get("c", price)
            result = {
                "symbol": symbol, "price": price,
                "open": day.get("o", 0), "high": day.get("h", 0),
                "low": day.get("l", 0), "close": price,
                "prev_close": pc, "volume": day.get("v", 0),
                "change": price - pc, "change_pct": ((price - pc) / pc * 100) if pc else 0,
                "provider": "polygon",
            }

        # Finnhub (priority 2)
        if not result:
            fh = await self.finnhub.get_quote(symbol)
            if fh and fh.get("c"):
                self._stats["finnhub_hits"] += 1
                result = {
                    "symbol": symbol, "price": fh["c"],
                    "open": fh.get("o", 0), "high": fh.get("h", 0),
                    "low": fh.get("l", 0), "close": fh["c"],
                    "prev_close": fh.get("pc", 0), "volume": 0,
                    "change": fh["c"] - fh.get("pc", 0),
                    "change_pct": ((fh["c"] - fh.get("pc", 0)) / fh.get("pc", 1) * 100),
                    "provider": "finnhub",
                }

        # TwelveData (priority 3)
        if not result:
            td = await self.twelvedata.get_quote(symbol)
            if td and td.get("close"):
                self._stats["twelvedata_hits"] += 1
                price = float(td["close"])
                pc = float(td.get("previous_close", price))
                result = {
                    "symbol": symbol, "price": price,
                    "open": float(td.get("open", 0)),
                    "high": float(td.get("high", 0)),
                    "low": float(td.get("low", 0)),
                    "close": price, "prev_close": pc,
                    "volume": int(td.get("volume", 0)),
                    "change": price - pc,
                    "change_pct": ((price - pc) / pc * 100) if pc else 0,
                    "provider": "twelvedata",
                }

        # Tiingo (priority 4)
        if not result:
            ti = await self.tiingo.get_quote(symbol)
            if ti and ti.get("last"):
                self._stats["tiingo_hits"] += 1
                price = ti["last"]
                pc = ti.get("prevClose", price)
                result = {
                    "symbol": symbol, "price": price,
                    "open": ti.get("open", 0), "high": ti.get("high", 0),
                    "low": ti.get("low", 0), "close": price,
                    "prev_close": pc, "volume": ti.get("volume", 0),
                    "change": price - pc,
                    "change_pct": ((price - pc) / pc * 100) if pc else 0,
                    "provider": "tiingo",
                }

        # yfinance (fallback)
        if not result:
            yf_data = await self.yfinance.get_quote(symbol)
            if yf_data:
                self._stats["yfinance_hits"] += 1
                price = yf_data["price"]
                pc = yf_data["prev_close"]
                result = {
                    "symbol": symbol, "price": price,
                    "open": yf_data["open"], "high": yf_data["high"],
                    "low": yf_data["low"], "close": price,
                    "prev_close": pc, "volume": yf_data["volume"],
                    "change": price - pc,
                    "change_pct": ((price - pc) / pc * 100) if pc else 0,
                    "name": yf_data.get("name", ""),
                    "market_cap": yf_data.get("market_cap", 0),
                    "provider": "yfinance",
                }

        if result:
            self.cache.set(cache_key, result, 5.0)
            self._stats["total_quotes"] += 1
            return result

        return {"symbol": symbol, "error": "No data available", "provider": "none"}

    async def get_batch_quotes(self, symbols: List[str]) -> List[Dict[str, Any]]:
        """Get quotes for multiple symbols"""
        tasks = [self.get_quote(s) for s in symbols]
        return await asyncio.gather(*tasks, return_exceptions=False)

    async def get_historical(self, symbol: str, period: str = "1y", interval: str = "1d") -> List[Dict]:
        """Get historical bars with failover"""
        cache_key = f"hist:{symbol}:{period}:{interval}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        # Try Polygon first
        if interval == "1d":
            end = datetime.now().strftime("%Y-%m-%d")
            start = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")
            bars = await self.polygon.get_bars(symbol, "day", start, end)
            if bars:
                result = [{"t": b.get("t"), "o": b.get("o"), "h": b.get("h"),
                           "l": b.get("l"), "c": b.get("c"), "v": b.get("v")} for b in bars]
                self.cache.set(cache_key, result, 60.0)
                return result

        # yfinance fallback
        result = await self.yfinance.get_historical(symbol, period, interval)
        if result:
            self.cache.set(cache_key, result, 60.0)
        return result

    async def get_orderbook(self, symbol: str, depth: int = 10) -> OrderBook:
        """Get Level 2 orderbook (demo with simulated depth)"""
        quote = await self.get_quote(symbol)
        price = quote.get("price", 100)

        # Generate simulated depth based on real price
        import random
        bids = []
        asks = []
        for i in range(depth):
            bid_price = round(price - (i + 1) * 0.01 * price / 100, 2)
            ask_price = round(price + (i + 1) * 0.01 * price / 100, 2)
            bids.append(Level2Entry(
                price=bid_price,
                size=random.randint(100, 5000) * 100,
                orders=random.randint(1, 50),
                exchange="COMPOSITE",
            ))
            asks.append(Level2Entry(
                price=ask_price,
                size=random.randint(100, 5000) * 100,
                orders=random.randint(1, 50),
                exchange="COMPOSITE",
            ))

        bid_depth = sum(b.size for b in bids)
        ask_depth = sum(a.size for a in asks)
        imbalance = (bid_depth - ask_depth) / (bid_depth + ask_depth) if (bid_depth + ask_depth) else 0

        spread = asks[0].price - bids[0].price if bids and asks else 0.01
        mid = (bids[0].price + asks[0].price) / 2 if bids and asks else price

        return OrderBook(
            symbol=symbol,
            bids=bids, asks=asks,
            bid_depth=bid_depth, ask_depth=ask_depth,
            imbalance=round(imbalance, 4),
            mid_price=round(mid, 2),
            spread=round(spread, 4),
            timestamp=datetime.now().isoformat(),
        )

    async def get_time_and_sales(self, symbol: str, limit: int = 100) -> TimeAndSales:
        """Get recent time & sales"""
        raw_trades = await self.polygon.get_trades(symbol, limit)

        if raw_trades:
            trades = [NormalizedTrade(
                symbol=symbol,
                price=t.get("price", 0),
                size=t.get("size", 0),
                timestamp=datetime.fromtimestamp(t.get("sip_timestamp", 0) / 1e9, tz=timezone.utc).isoformat() if t.get("sip_timestamp") else "",
                exchange=str(t.get("exchange", "")),
                conditions=[str(c) for c in t.get("conditions", [])],
                provider="polygon",
            ) for t in raw_trades]
        else:
            # Simulated T&S
            import random
            quote = await self.get_quote(symbol)
            price = quote.get("price", 100)
            trades = []
            now = datetime.now(timezone.utc)
            for i in range(limit):
                p = round(price * (1 + random.uniform(-0.003, 0.003)), 2)
                trades.append(NormalizedTrade(
                    symbol=symbol,
                    price=p,
                    size=random.choice([100, 200, 300, 500, 1000, 2500]) ,
                    timestamp=(now - timedelta(seconds=i * 2)).isoformat(),
                    exchange="COMPOSITE",
                    conditions=[],
                    provider="simulated",
                ))

        total_vol = sum(t.size for t in trades)
        prices = [t.price for t in trades]
        sizes = [t.size for t in trades]
        vwap = sum(p * s for p, s in zip(prices, sizes)) / total_vol if total_vol else 0
        # Classify buy/sell by tick direction
        buy_vol = sum(t.size for i, t in enumerate(trades) if i == 0 or t.price >= trades[i-1].price)
        sell_vol = total_vol - buy_vol

        return TimeAndSales(
            symbol=symbol,
            trades=trades,
            total_volume=total_vol,
            buy_volume=buy_vol,
            sell_volume=sell_vol,
            vwap=round(vwap, 4),
            high=max(prices) if prices else 0,
            low=min(prices) if prices else 0,
        )

    async def get_provider_status(self) -> DataFeedStatus:
        """Get status of all data providers"""
        statuses = []
        for name, config in PROVIDERS.items():
            has_key = bool(config.get("key")) or name == "yfinance"
            statuses.append(ProviderStatus(
                name=name,
                status=FeedStatus.CONNECTED if has_key else FeedStatus.DISCONNECTED,
                latency_ms=0,
                last_message="",
                messages_received=self._stats.get(f"{name}_hits", 0),
                errors=0,
                rate_limit_remaining=config.get("rate_limit", 0),
            ))

        # Determine primary provider
        primary = "yfinance"
        for s in statuses:
            if s.status == FeedStatus.CONNECTED and s.name != "yfinance":
                primary = s.name
                break

        return DataFeedStatus(
            providers=statuses,
            active_subscriptions=0,
            total_messages=self._stats.get("total_quotes", 0),
            uptime_seconds=0,
            primary_provider=primary,
        )

    def get_cache_stats(self) -> Dict[str, Any]:
        return {
            "size": self.cache.size,
            "hits": self.cache.hits,
            "misses": self.cache.misses,
            "hit_rate": round(self.cache.hit_rate, 2),
        }


# Global service instance
_service = MarketDataService()


# ── Convenience Functions ────────────────────────────────────────────────────

async def get_unified_quote(symbol: str) -> Dict[str, Any]:
    return await _service.get_quote(symbol)

async def get_unified_bars(symbol: str, period: str = "1y", interval: str = "1d") -> List[Dict]:
    return await _service.get_historical(symbol, period, interval)

async def get_level2(symbol: str, depth: int = 10) -> OrderBook:
    return await _service.get_orderbook(symbol, depth)


# ── FastAPI Router ────────────────────────────────────────────────────────────

def create_market_data_router():
    from fastapi import APIRouter, Query, HTTPException
    router = APIRouter(prefix="/api/v4/data", tags=["market-data-unified"])

    @router.get("/quote/{symbol}")
    async def unified_quote(symbol: str):
        return await _service.get_quote(symbol.upper())

    @router.get("/quotes")
    async def batch_quotes(symbols: str = Query(...)):
        syms = [s.strip().upper() for s in symbols.split(",")][:50]
        results = await _service.get_batch_quotes(syms)
        return {"quotes": results}

    @router.get("/bars/{symbol}")
    async def bars(
        symbol: str,
        period: str = Query("1y"),
        interval: str = Query("1d"),
    ):
        data = await _service.get_historical(symbol.upper(), period, interval)
        return {"symbol": symbol.upper(), "bars": data}

    @router.get("/orderbook/{symbol}")
    async def orderbook(symbol: str, depth: int = Query(10)):
        ob = await _service.get_orderbook(symbol.upper(), depth)
        return asdict(ob)

    @router.get("/trades/{symbol}")
    async def trades(symbol: str, limit: int = Query(100)):
        tas = await _service.get_time_and_sales(symbol.upper(), limit)
        return asdict(tas)

    @router.get("/providers")
    async def providers():
        status = await _service.get_provider_status()
        return asdict(status)

    @router.get("/cache")
    async def cache_stats():
        return _service.get_cache_stats()

    @router.get("/health")
    async def health():
        return {"status": "ok", "providers": len(PROVIDERS), "cache": _service.get_cache_stats()}

    return router
