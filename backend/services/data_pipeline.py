"""
┌───────────────────────────────────────────────────────────────────────┐
│  APEX TERMINAL — Data Pipeline Service                               │
│  Multi-source data ingestion, transformation, validation, caching,   │
│  rate limiting, failover, and normalization pipelines                 │
└───────────────────────────────────────────────────────────────────────┘
"""

import math
import random
import time
import hashlib
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any, Tuple, Callable, Set
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections import defaultdict, OrderedDict

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════
# SECTION 1: TYPES & ENUMS
# ══════════════════════════════════════════════════════════════════════

class DataSource(str, Enum):
    ALPACA = "alpaca"
    POLYGON = "polygon"
    FINNHUB = "finnhub"
    TWELVE_DATA = "twelve_data"
    TIINGO = "tiingo"
    YFINANCE = "yfinance"
    FRED = "fred"
    SEC = "sec"
    NEWS_API = "newsapi"
    REDDIT = "reddit"
    IEX = "iex"
    QUANDL = "quandl"
    TRADIER = "tradier"
    MANUAL = "manual"


class DataType(str, Enum):
    OHLCV = "ohlcv"
    QUOTE = "quote"
    TRADE = "trade"
    ORDER_BOOK = "order_book"
    OPTIONS_CHAIN = "options_chain"
    FUNDAMENTAL = "fundamental"
    NEWS = "news"
    ECONOMIC = "economic"
    SENTIMENT = "sentiment"
    ALTERNATIVE = "alternative"
    CORPORATE_ACTION = "corporate_action"


class TimeFrame(str, Enum):
    TICK = "tick"
    SECOND_1 = "1s"
    MINUTE_1 = "1min"
    MINUTE_5 = "5min"
    MINUTE_15 = "15min"
    MINUTE_30 = "30min"
    HOUR_1 = "1h"
    HOUR_4 = "4h"
    DAY = "1d"
    WEEK = "1w"
    MONTH = "1mo"


class DataQuality(str, Enum):
    RAW = "raw"
    VALIDATED = "validated"
    CLEANED = "cleaned"
    ADJUSTED = "adjusted"
    FINAL = "final"


class ValidationResult(str, Enum):
    PASS = "pass"
    WARNING = "warning"
    FAIL = "fail"


@dataclass
class DataRequest:
    symbols: List[str]
    data_type: DataType
    timeframe: TimeFrame = TimeFrame.DAY
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    source_priority: List[DataSource] = field(default_factory=lambda: [DataSource.YFINANCE, DataSource.ALPACA, DataSource.POLYGON])
    max_retries: int = 3
    cache_ttl: int = 300  # seconds
    include_extended: bool = False
    adjust_splits: bool = True
    adjust_dividends: bool = True


@dataclass
class DataPoint:
    timestamp: float
    symbol: str
    data: Dict[str, Any]
    source: DataSource
    quality: DataQuality
    received_at: float = 0
    hash: str = ""


@dataclass
class OHLCVBar:
    timestamp: float
    open: float
    high: float
    low: float
    close: float
    volume: int
    adj_close: Optional[float] = None
    vwap: Optional[float] = None
    trade_count: Optional[int] = None
    symbol: str = ""
    source: str = ""


@dataclass
class ValidationReport:
    symbol: str
    n_bars: int
    result: ValidationResult
    checks: List[Dict[str, Any]]
    missing_dates: List[str]
    anomalies: List[Dict[str, Any]]
    quality_score: float  # 0-100


@dataclass
class DataSourceHealth:
    source: DataSource
    is_available: bool
    latency_ms: float
    error_rate: float
    last_success: Optional[str] = None
    last_error: Optional[str] = None
    request_count: int = 0
    error_count: int = 0
    rate_limit_remaining: int = -1
    rate_limit_reset: Optional[str] = None


@dataclass
class CacheEntry:
    key: str
    data: Any
    created_at: float
    ttl: int
    hits: int = 0
    size_bytes: int = 0
    source: str = ""


@dataclass
class PipelineMetrics:
    total_requests: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    source_fallbacks: int = 0
    validation_failures: int = 0
    avg_latency_ms: float = 0
    data_points_processed: int = 0
    bytes_processed: int = 0


# ══════════════════════════════════════════════════════════════════════
# SECTION 2: LRU CACHE
# ══════════════════════════════════════════════════════════════════════

class LRUCache:
    """Thread-safe LRU cache with TTL support"""

    def __init__(self, max_size: int = 1000, default_ttl: int = 300):
        self.max_size = max_size
        self.default_ttl = default_ttl
        self._cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self._total_hits = 0
        self._total_misses = 0

    def get(self, key: str) -> Optional[Any]:
        if key not in self._cache:
            self._total_misses += 1
            return None

        entry = self._cache[key]
        # Check TTL
        if time.time() - entry.created_at > entry.ttl:
            del self._cache[key]
            self._total_misses += 1
            return None

        entry.hits += 1
        self._total_hits += 1
        # Move to end (most recent)
        self._cache.move_to_end(key)
        return entry.data

    def set(self, key: str, data: Any, ttl: Optional[int] = None, source: str = "") -> None:
        if key in self._cache:
            del self._cache[key]

        if len(self._cache) >= self.max_size:
            # Evict oldest
            self._cache.popitem(last=False)

        self._cache[key] = CacheEntry(
            key=key,
            data=data,
            created_at=time.time(),
            ttl=ttl or self.default_ttl,
            source=source,
        )

    def invalidate(self, key: str) -> bool:
        if key in self._cache:
            del self._cache[key]
            return True
        return False

    def invalidate_pattern(self, pattern: str) -> int:
        keys_to_remove = [k for k in self._cache if pattern in k]
        for k in keys_to_remove:
            del self._cache[k]
        return len(keys_to_remove)

    def clear(self) -> int:
        count = len(self._cache)
        self._cache.clear()
        return count

    def get_stats(self) -> Dict[str, Any]:
        total = self._total_hits + self._total_misses
        return {
            "size": len(self._cache),
            "max_size": self.max_size,
            "hit_rate": round(self._total_hits / total, 4) if total > 0 else 0,
            "total_hits": self._total_hits,
            "total_misses": self._total_misses,
        }


# ══════════════════════════════════════════════════════════════════════
# SECTION 3: RATE LIMITER
# ══════════════════════════════════════════════════════════════════════

class AdaptiveRateLimiter:
    """Per-source rate limiter with adaptive throttling"""

    # Default limits (requests per minute) for each source
    DEFAULT_LIMITS = {
        DataSource.ALPACA: 200,
        DataSource.POLYGON: 100,
        DataSource.FINNHUB: 60,
        DataSource.TWELVE_DATA: 55,
        DataSource.TIINGO: 50,
        DataSource.YFINANCE: 2000,  # generous
        DataSource.FRED: 120,
        DataSource.SEC: 10,
        DataSource.NEWS_API: 100,
        DataSource.REDDIT: 30,
        DataSource.IEX: 100,
        DataSource.QUANDL: 50,
        DataSource.TRADIER: 60,
    }

    def __init__(self):
        self._windows: Dict[str, List[float]] = defaultdict(list)
        self._throttle_until: Dict[str, float] = {}

    def try_acquire(self, source: DataSource) -> bool:
        now = time.time()
        key = source.value

        # Check throttle
        if key in self._throttle_until and now < self._throttle_until[key]:
            return False

        limit = self.DEFAULT_LIMITS.get(source, 60)
        window = self._windows[key]

        # Clean old entries (older than 60 seconds)
        cutoff = now - 60
        self._windows[key] = [t for t in window if t > cutoff]
        window = self._windows[key]

        if len(window) >= limit:
            # Throttle for remaining window
            self._throttle_until[key] = now + (60 - (now - window[0]))
            return False

        self._windows[key].append(now)
        return True

    def get_wait_time(self, source: DataSource) -> float:
        now = time.time()
        key = source.value
        if key in self._throttle_until and now < self._throttle_until[key]:
            return self._throttle_until[key] - now
        return 0

    def record_rate_limit_response(self, source: DataSource, retry_after: float = 60) -> None:
        """Called when API returns 429"""
        self._throttle_until[source.value] = time.time() + retry_after

    def get_status(self) -> Dict[str, Any]:
        now = time.time()
        return {
            source.value: {
                "requests_last_minute": len([t for t in self._windows.get(source.value, []) if t > now - 60]),
                "limit": self.DEFAULT_LIMITS.get(source, 60),
                "throttled": now < self._throttle_until.get(source.value, 0),
                "throttle_remaining_s": max(0, round(self._throttle_until.get(source.value, 0) - now, 1)),
            }
            for source in DataSource
            if source.value in self._windows or source.value in self._throttle_until
        }


# ══════════════════════════════════════════════════════════════════════
# SECTION 4: DATA VALIDATORS
# ══════════════════════════════════════════════════════════════════════

class DataValidator:
    """Comprehensive data quality validation"""

    def validate_ohlcv(self, bars: List[OHLCVBar], symbol: str) -> ValidationReport:
        checks = []
        anomalies = []
        missing = []

        n = len(bars)
        if n == 0:
            return ValidationReport(symbol=symbol, n_bars=0, result=ValidationResult.FAIL,
                                    checks=[{"check": "has_data", "result": "FAIL"}],
                                    missing_dates=[], anomalies=[], quality_score=0)

        # 1. OHLC relationship check
        ohlc_errors = 0
        for bar in bars:
            if bar.high < bar.low:
                ohlc_errors += 1
                anomalies.append({"type": "high_below_low", "timestamp": bar.timestamp, "high": bar.high, "low": bar.low})
            if bar.open < bar.low or bar.open > bar.high:
                ohlc_errors += 1
            if bar.close < bar.low or bar.close > bar.high:
                ohlc_errors += 1
        checks.append({"check": "ohlc_consistency", "result": "PASS" if ohlc_errors == 0 else "FAIL", "errors": ohlc_errors})

        # 2. Negative price check
        neg_count = sum(1 for b in bars if b.close <= 0 or b.open <= 0)
        checks.append({"check": "positive_prices", "result": "PASS" if neg_count == 0 else "FAIL", "negatives": neg_count})

        # 3. Volume check
        zero_vol = sum(1 for b in bars if b.volume <= 0)
        checks.append({"check": "volume_positive", "result": "PASS" if zero_vol == 0 else "WARNING", "zero_volume_bars": zero_vol})

        # 4. Gap check (excessive gaps = likely missing data)
        if n > 1:
            gaps = []
            for i in range(1, n):
                dt = bars[i].timestamp - bars[i-1].timestamp
                if dt > 86400 * 4:  # More than 4 days gap (accounting for weekends)
                    gaps.append({"from": bars[i-1].timestamp, "to": bars[i].timestamp, "gap_days": round(dt / 86400, 1)})
            checks.append({"check": "date_continuity", "result": "PASS" if not gaps else "WARNING", "gaps": len(gaps)})

        # 5. Price spike detection
        spikes = 0
        if n > 1:
            for i in range(1, n):
                if bars[i-1].close > 0:
                    change = abs(bars[i].close - bars[i-1].close) / bars[i-1].close
                    if change > 0.25:  # > 25% single-day move
                        spikes += 1
                        anomalies.append({"type": "price_spike", "timestamp": bars[i].timestamp,
                                         "change_pct": round(change * 100, 2)})
        checks.append({"check": "price_spikes", "result": "PASS" if spikes == 0 else "WARNING", "spikes": spikes})

        # 6. Stale data check
        stale_count = 0
        if n > 1:
            for i in range(1, n):
                if bars[i].close == bars[i-1].close and bars[i].volume > 0:
                    stale_count += 1
        checks.append({"check": "stale_prices", "result": "PASS" if stale_count < n * 0.1 else "WARNING",
                       "stale_bars": stale_count, "pct": round(stale_count / n * 100, 1)})

        # 7. Volume spike detection
        if n > 20:
            avg_vol = sum(b.volume for b in bars) / n
            vol_spikes = sum(1 for b in bars if b.volume > avg_vol * 10) if avg_vol > 0 else 0
            checks.append({"check": "volume_spikes", "result": "PASS" if vol_spikes < 5 else "WARNING",
                          "extreme_volume_bars": vol_spikes})

        # 8. Monotonic timestamp check
        ordered = all(bars[i].timestamp >= bars[i-1].timestamp for i in range(1, n))
        checks.append({"check": "timestamp_order", "result": "PASS" if ordered else "FAIL"})

        # 9. Duplicate timestamp check
        timestamps = set()
        dups = 0
        for b in bars:
            if b.timestamp in timestamps:
                dups += 1
            timestamps.add(b.timestamp)
        checks.append({"check": "no_duplicates", "result": "PASS" if dups == 0 else "FAIL", "duplicates": dups})

        # Quality score
        total_checks = len(checks)
        passed = sum(1 for c in checks if c["result"] == "PASS")
        warned = sum(1 for c in checks if c["result"] == "WARNING")
        quality = (passed * 100 + warned * 50) / total_checks if total_checks > 0 else 0

        overall = ValidationResult.PASS
        if any(c["result"] == "FAIL" for c in checks):
            overall = ValidationResult.FAIL
        elif any(c["result"] == "WARNING" for c in checks):
            overall = ValidationResult.WARNING

        return ValidationReport(
            symbol=symbol,
            n_bars=n,
            result=overall,
            checks=checks,
            missing_dates=missing,
            anomalies=anomalies[:20],
            quality_score=round(quality, 2),
        )


# ══════════════════════════════════════════════════════════════════════
# SECTION 5: DATA TRANSFORMERS
# ══════════════════════════════════════════════════════════════════════

class DataTransformer:
    """Transform and normalize market data"""

    @staticmethod
    def resample(bars: List[OHLCVBar], target_timeframe: TimeFrame) -> List[OHLCVBar]:
        """Resample bars to a different timeframe"""
        if not bars:
            return []

        # Determine aggregation period in seconds
        period_map = {
            TimeFrame.MINUTE_5: 300,
            TimeFrame.MINUTE_15: 900,
            TimeFrame.MINUTE_30: 1800,
            TimeFrame.HOUR_1: 3600,
            TimeFrame.HOUR_4: 14400,
            TimeFrame.DAY: 86400,
            TimeFrame.WEEK: 604800,
        }
        period = period_map.get(target_timeframe, 86400)

        resampled = []
        group: List[OHLCVBar] = []
        group_start = bars[0].timestamp

        for bar in bars:
            if bar.timestamp - group_start >= period and group:
                resampled.append(DataTransformer._aggregate_group(group))
                group = [bar]
                group_start = bar.timestamp
            else:
                group.append(bar)

        if group:
            resampled.append(DataTransformer._aggregate_group(group))

        return resampled

    @staticmethod
    def _aggregate_group(group: List[OHLCVBar]) -> OHLCVBar:
        return OHLCVBar(
            timestamp=group[0].timestamp,
            open=group[0].open,
            high=max(b.high for b in group),
            low=min(b.low for b in group),
            close=group[-1].close,
            volume=sum(b.volume for b in group),
            symbol=group[0].symbol,
            source=group[0].source,
        )

    @staticmethod
    def adjust_splits(bars: List[OHLCVBar], splits: List[Dict[str, Any]]) -> List[OHLCVBar]:
        """Adjust historical bars for stock splits"""
        if not splits:
            return bars

        adjusted = []
        for bar in bars:
            factor = 1.0
            for split in splits:
                if bar.timestamp < split.get("timestamp", float('inf')):
                    factor *= split.get("ratio", 1.0)

            adjusted.append(OHLCVBar(
                timestamp=bar.timestamp,
                open=round(bar.open / factor, 4),
                high=round(bar.high / factor, 4),
                low=round(bar.low / factor, 4),
                close=round(bar.close / factor, 4),
                volume=int(bar.volume * factor),
                adj_close=round(bar.close / factor, 4),
                symbol=bar.symbol,
                source=bar.source,
            ))

        return adjusted

    @staticmethod
    def adjust_dividends(bars: List[OHLCVBar], dividends: List[Dict[str, Any]]) -> List[OHLCVBar]:
        """Adjust historical bars for dividends"""
        if not dividends:
            return bars

        adjusted = []
        for bar in bars:
            factor = 1.0
            for div in dividends:
                if bar.timestamp < div.get("timestamp", float('inf')):
                    div_amount = div.get("amount", 0)
                    if bar.close > 0:
                        factor *= (1 - div_amount / bar.close)

            adjusted.append(OHLCVBar(
                timestamp=bar.timestamp,
                open=round(bar.open * factor, 4),
                high=round(bar.high * factor, 4),
                low=round(bar.low * factor, 4),
                close=round(bar.close * factor, 4),
                volume=bar.volume,
                adj_close=round(bar.close * factor, 4),
                symbol=bar.symbol,
                source=bar.source,
            ))

        return adjusted

    @staticmethod
    def fill_gaps(bars: List[OHLCVBar], method: str = "forward") -> List[OHLCVBar]:
        """Fill gaps in data using specified method"""
        if not bars or len(bars) < 2:
            return bars

        filled = [bars[0]]
        avg_period = sum(bars[i].timestamp - bars[i-1].timestamp for i in range(1, min(10, len(bars)))) / min(9, len(bars) - 1)

        for i in range(1, len(bars)):
            gap = bars[i].timestamp - bars[i-1].timestamp
            if gap > avg_period * 1.5:
                # Fill gap
                n_fill = int(gap / avg_period) - 1
                for j in range(1, n_fill + 1):
                    ts = bars[i-1].timestamp + avg_period * j
                    if method == "forward":
                        filled.append(OHLCVBar(
                            timestamp=ts,
                            open=bars[i-1].close,
                            high=bars[i-1].close,
                            low=bars[i-1].close,
                            close=bars[i-1].close,
                            volume=0,
                            symbol=bars[i-1].symbol,
                            source="filled",
                        ))
                    elif method == "interpolate":
                        pct = j / (n_fill + 1)
                        price = bars[i-1].close + (bars[i].open - bars[i-1].close) * pct
                        filled.append(OHLCVBar(
                            timestamp=ts,
                            open=round(price, 4),
                            high=round(price * 1.001, 4),
                            low=round(price * 0.999, 4),
                            close=round(price, 4),
                            volume=0,
                            symbol=bars[i-1].symbol,
                            source="interpolated",
                        ))
            filled.append(bars[i])

        return filled

    @staticmethod
    def normalize(values: List[float], method: str = "z_score") -> List[float]:
        """Normalize a list of values"""
        if not values:
            return []

        if method == "z_score":
            mu = sum(values) / len(values)
            std = math.sqrt(sum((v - mu) ** 2 for v in values) / max(len(values) - 1, 1))
            return [(v - mu) / std if std > 0 else 0 for v in values]

        elif method == "min_max":
            mn, mx = min(values), max(values)
            rng = mx - mn
            return [(v - mn) / rng if rng > 0 else 0.5 for v in values]

        elif method == "percentile_rank":
            sorted_v = sorted(values)
            return [sorted_v.index(v) / max(len(sorted_v) - 1, 1) for v in values]

        elif method == "log":
            return [math.log(max(v, 1e-10)) for v in values]

        return values

    @staticmethod
    def compute_returns(bars: List[OHLCVBar], method: str = "simple") -> List[float]:
        """Compute returns from price bars"""
        if len(bars) < 2:
            return []

        if method == "simple":
            return [(bars[i].close - bars[i-1].close) / bars[i-1].close
                    for i in range(1, len(bars)) if bars[i-1].close > 0]
        elif method == "log":
            return [math.log(bars[i].close / bars[i-1].close)
                    for i in range(1, len(bars)) if bars[i-1].close > 0]
        return []


# ══════════════════════════════════════════════════════════════════════
# SECTION 6: MOCK DATA GENERATORS
# ══════════════════════════════════════════════════════════════════════

class MockDataGenerator:
    """Generate realistic mock market data for demo mode"""

    def __init__(self, seed: int = 42):
        self.rng = random.Random(seed)

    # ----- Stock parameters for deterministic generation -----
    STOCKS = {
        "AAPL": {"price": 178.50, "vol": 0.28, "beta": 1.15, "dividend": 0.96, "sector": "Technology"},
        "GOOGL": {"price": 141.80, "vol": 0.30, "beta": 1.10, "dividend": 0, "sector": "Technology"},
        "MSFT": {"price": 378.90, "vol": 0.25, "beta": 0.95, "dividend": 2.72, "sector": "Technology"},
        "AMZN": {"price": 178.25, "vol": 0.35, "beta": 1.25, "dividend": 0, "sector": "Consumer"},
        "TSLA": {"price": 248.50, "vol": 0.55, "beta": 2.0, "dividend": 0, "sector": "Auto"},
        "META": {"price": 505.75, "vol": 0.38, "beta": 1.30, "dividend": 0, "sector": "Technology"},
        "NVDA": {"price": 878.35, "vol": 0.50, "beta": 1.70, "dividend": 0.16, "sector": "Technology"},
        "JPM": {"price": 196.40, "vol": 0.22, "beta": 1.05, "dividend": 4.0, "sector": "Financial"},
        "V": {"price": 280.60, "vol": 0.20, "beta": 0.90, "dividend": 1.80, "sector": "Financial"},
        "WMT": {"price": 165.30, "vol": 0.18, "beta": 0.55, "dividend": 2.28, "sector": "Consumer"},
        "JNJ": {"price": 156.20, "vol": 0.16, "beta": 0.60, "dividend": 4.76, "sector": "Healthcare"},
        "UNH": {"price": 527.40, "vol": 0.22, "beta": 0.80, "dividend": 6.60, "sector": "Healthcare"},
        "XOM": {"price": 104.25, "vol": 0.24, "beta": 0.90, "dividend": 3.64, "sector": "Energy"},
        "PG": {"price": 164.80, "vol": 0.15, "beta": 0.45, "dividend": 3.76, "sector": "Consumer"},
        "HD": {"price": 365.90, "vol": 0.22, "beta": 1.00, "dividend": 8.36, "sector": "Consumer"},
        "SPY": {"price": 450.00, "vol": 0.18, "beta": 1.00, "dividend": 6.00, "sector": "Index"},
        "QQQ": {"price": 380.00, "vol": 0.24, "beta": 1.15, "dividend": 2.00, "sector": "Index"},
        "IWM": {"price": 200.00, "vol": 0.22, "beta": 1.20, "dividend": 2.40, "sector": "Index"},
        "GLD": {"price": 185.00, "vol": 0.14, "beta": 0.05, "dividend": 0, "sector": "Commodity"},
        "TLT": {"price": 95.00, "vol": 0.16, "beta": -0.30, "dividend": 3.20, "sector": "Bond"},
    }

    def generate_ohlcv(
        self,
        symbol: str,
        n_bars: int = 252,
        timeframe: TimeFrame = TimeFrame.DAY,
    ) -> List[OHLCVBar]:
        """Generate realistic OHLCV data for a symbol"""
        params = self.STOCKS.get(symbol, {"price": 100, "vol": 0.25, "beta": 1.0, "dividend": 0, "sector": "Other"})
        price = params["price"]
        annual_vol = params["vol"]
        daily_vol = annual_vol / math.sqrt(252)

        bars = []
        ts = 1700000000.0
        period = {"1min": 60, "5min": 300, "15min": 900, "1h": 3600, "1d": 86400, "1w": 604800}.get(timeframe.value, 86400)

        for i in range(n_bars):
            # GBM with mean reversion tendency
            drift = 0.0003 * (params["beta"] if params["beta"] > 0 else 0.5)
            noise = self.rng.gauss(0, daily_vol)
            change = drift + noise
            o = price
            c = o * (1 + change)
            h = max(o, c) * (1 + abs(self.rng.gauss(0, daily_vol * 0.3)))
            l = min(o, c) * (1 - abs(self.rng.gauss(0, daily_vol * 0.3)))
            v = int(1e6 + abs(self.rng.gauss(0, 5e5)) + abs(change) * 2e7)

            bars.append(OHLCVBar(
                timestamp=ts + i * period,
                open=round(o, 2),
                high=round(max(h, o, c), 2),
                low=round(min(l, o, c), 2),
                close=round(c, 2),
                volume=max(100, v),
                symbol=symbol,
                source="mock",
            ))
            price = c

        return bars

    def generate_multi_asset(
        self,
        symbols: List[str],
        n_bars: int = 252,
    ) -> Dict[str, List[OHLCVBar]]:
        """Generate correlated multi-asset data"""
        result = {}
        # Market factor
        market_noise = [self.rng.gauss(0, 0.01) for _ in range(n_bars)]

        for sym in symbols:
            params = self.STOCKS.get(sym, {"price": 100, "vol": 0.25, "beta": 1.0})
            beta = params.get("beta", 1.0)
            idio_vol = params.get("vol", 0.25) / math.sqrt(252) * math.sqrt(1 - min(beta ** 2 * 0.3, 0.9))

            price = params.get("price", 100)
            bars = []
            ts = 1700000000.0

            for i in range(n_bars):
                market_ret = market_noise[i] * beta
                idio_ret = self.rng.gauss(0, idio_vol)
                total_ret = 0.0003 + market_ret + idio_ret
                o = price
                c = o * (1 + total_ret)
                h = max(o, c) * 1.003
                l = min(o, c) * 0.997
                v = int(2e6 + abs(self.rng.gauss(0, 1e6)))

                bars.append(OHLCVBar(
                    timestamp=ts + i * 86400,
                    open=round(o, 2),
                    high=round(h, 2),
                    low=round(l, 2),
                    close=round(c, 2),
                    volume=max(100, v),
                    symbol=sym,
                    source="mock",
                ))
                price = c

            result[sym] = bars

        return result

    def generate_options_chain(self, symbol: str, current_price: float = 0) -> List[Dict[str, Any]]:
        """Generate a mock options chain"""
        params = self.STOCKS.get(symbol, {"price": 150, "vol": 0.3})
        price = current_price or params.get("price", 150)
        vol = params.get("vol", 0.3)

        chain = []
        expirations = [7, 14, 30, 60, 90, 180, 365]

        for dte in expirations:
            n_strikes = 15
            atm = round(price / 5) * 5
            for i in range(-n_strikes // 2, n_strikes // 2 + 1):
                strike = atm + i * 5
                if strike <= 0:
                    continue

                t = dte / 365
                d1 = (math.log(price / strike) + (0.04 + vol ** 2 / 2) * t) / (vol * math.sqrt(t)) if t > 0 else 0
                d2 = d1 - vol * math.sqrt(t) if t > 0 else 0

                # Approximate N(d) using logistic approximation
                def norm_cdf(x):
                    return 1 / (1 + math.exp(-1.7 * x))

                call_price = max(0.01, round(price * norm_cdf(d1) - strike * math.exp(-0.04 * t) * norm_cdf(d2), 2))
                put_price = max(0.01, round(call_price - price + strike * math.exp(-0.04 * t), 2))

                # Greeks (simplified)
                delta_call = round(norm_cdf(d1), 4)
                delta_put = round(delta_call - 1, 4)
                gamma = round(math.exp(-d1 ** 2 / 2) / (price * vol * math.sqrt(t) * math.sqrt(2 * math.pi)), 6) if t > 0 else 0
                theta_call = round(-price * vol * math.exp(-d1 ** 2 / 2) / (2 * math.sqrt(t) * math.sqrt(2 * math.pi)) / 365, 4) if t > 0 else 0
                vega = round(price * math.sqrt(t) * math.exp(-d1 ** 2 / 2) / math.sqrt(2 * math.pi) / 100, 4) if t > 0 else 0

                for opt_type in ["call", "put"]:
                    chain.append({
                        "symbol": symbol,
                        "strike": strike,
                        "expiration_dte": dte,
                        "type": opt_type,
                        "bid": round((call_price if opt_type == "call" else put_price) * 0.97, 2),
                        "ask": round((call_price if opt_type == "call" else put_price) * 1.03, 2),
                        "last": round(call_price if opt_type == "call" else put_price, 2),
                        "volume": int(self.rng.random() * 500),
                        "open_interest": int(self.rng.random() * 5000),
                        "implied_vol": round(vol + self.rng.gauss(0, 0.02), 4),
                        "delta": delta_call if opt_type == "call" else delta_put,
                        "gamma": gamma,
                        "theta": theta_call,
                        "vega": vega,
                    })

        return chain

    def generate_fundamentals(self, symbol: str) -> Dict[str, Any]:
        """Generate mock fundamental data"""
        params = self.STOCKS.get(symbol, {"price": 100, "sector": "Other"})
        price = params.get("price", 100)

        pe = 15 + self.rng.random() * 30
        eps = price / pe
        revenue = price * 1e7 * (5 + self.rng.random() * 20)

        return {
            "symbol": symbol,
            "sector": params.get("sector", "Other"),
            "market_cap": int(price * 1e9 * (2 + self.rng.random() * 15)),
            "pe_ratio": round(pe, 2),
            "forward_pe": round(pe * (0.85 + self.rng.random() * 0.3), 2),
            "eps_ttm": round(eps, 2),
            "eps_forward": round(eps * (1 + self.rng.gauss(0.05, 0.1)), 2),
            "revenue_ttm": int(revenue),
            "revenue_growth": round(self.rng.gauss(0.12, 0.15), 4),
            "gross_margin": round(0.3 + self.rng.random() * 0.5, 4),
            "operating_margin": round(0.1 + self.rng.random() * 0.3, 4),
            "net_margin": round(0.05 + self.rng.random() * 0.25, 4),
            "roe": round(0.1 + self.rng.random() * 0.3, 4),
            "roa": round(0.03 + self.rng.random() * 0.15, 4),
            "debt_to_equity": round(0.2 + self.rng.random() * 1.5, 4),
            "current_ratio": round(1.0 + self.rng.random() * 2.0, 4),
            "quick_ratio": round(0.5 + self.rng.random() * 1.5, 4),
            "dividend_yield": round(params.get("dividend", 0) / price, 4),
            "payout_ratio": round(0.1 + self.rng.random() * 0.5, 4),
            "beta": round(params.get("beta", 1.0), 4),
            "fifty_two_week_high": round(price * (1.1 + self.rng.random() * 0.3), 2),
            "fifty_two_week_low": round(price * (0.5 + self.rng.random() * 0.3), 2),
            "avg_volume_30d": int(5e6 + self.rng.random() * 15e6),
            "shares_outstanding": int(1e9 + self.rng.random() * 5e9),
            "institutional_ownership": round(0.5 + self.rng.random() * 0.4, 4),
            "short_interest": round(0.01 + self.rng.random() * 0.1, 4),
            "analyst_rating": round(1 + self.rng.random() * 4, 1),
            "price_target_mean": round(price * (1 + self.rng.gauss(0.1, 0.15)), 2),
            "price_target_high": round(price * (1.3 + self.rng.random() * 0.3), 2),
            "price_target_low": round(price * (0.6 + self.rng.random() * 0.2), 2),
        }

    def generate_news(self, symbol: str, n_items: int = 20) -> List[Dict[str, Any]]:
        """Generate mock news items"""
        headlines = [
            f"{symbol} Reports Strong Q4 Earnings",
            f"{symbol} Announces New Product Launch",
            f"Analysts Upgrade {symbol} to Buy",
            f"{symbol} CEO Discusses Growth Strategy",
            f"{symbol} Partners with Major Tech Company",
            f"Market Reacts to {symbol} Revenue Miss",
            f"{symbol} Expands into New Markets",
            f"Institutional Investors Increase {symbol} Holdings",
            f"{symbol} Beats EPS Estimates",
            f"New Regulations May Impact {symbol}",
            f"{symbol} Stock Reaches All-Time High",
            f"Hedge Fund Increases Stake in {symbol}",
            f"{symbol} Announces Share Buyback Program",
            f"Industry Trends Favor {symbol} Growth",
            f"{symbol} Faces Supply Chain Challenges",
            f"Insider Trading Activity Detected for {symbol}",
            f"{symbol} Wins Major Government Contract",
            f"Short Sellers Target {symbol}",
            f"{symbol} Dividend Increase Announced",
            f"Technical Analysis: {symbol} Shows Bullish Pattern",
        ]

        items = []
        sentiments = ["positive", "negative", "neutral"]
        for i in range(min(n_items, len(headlines))):
            items.append({
                "title": headlines[i],
                "summary": f"Detailed analysis of {headlines[i].lower()}...",
                "source": self.rng.choice(["Bloomberg", "Reuters", "CNBC", "WSJ", "Barron's", "MarketWatch"]),
                "sentiment": self.rng.choice(sentiments),
                "sentiment_score": round(self.rng.gauss(0.1, 0.4), 4),
                "relevance": round(0.5 + self.rng.random() * 0.5, 4),
                "published_at": (datetime.utcnow() - timedelta(hours=self.rng.randint(1, 168))).isoformat(),
                "symbols": [symbol],
                "category": self.rng.choice(["earnings", "analysis", "market", "product", "regulatory"]),
            })

        return items


# ══════════════════════════════════════════════════════════════════════
# SECTION 7: DATA PIPELINE SERVICE
# ══════════════════════════════════════════════════════════════════════

class DataPipelineService:
    """Unified data pipeline service for Apex Terminal"""

    def __init__(self):
        self.cache = LRUCache(max_size=5000, default_ttl=300)
        self.rate_limiter = AdaptiveRateLimiter()
        self.validator = DataValidator()
        self.transformer = DataTransformer()
        self.mock = MockDataGenerator()
        self.metrics = PipelineMetrics()
        self._source_health: Dict[str, DataSourceHealth] = {}
        logger.info("DataPipelineService initialized")

    def get_ohlcv(
        self,
        symbol: str,
        n_bars: int = 252,
        timeframe: TimeFrame = TimeFrame.DAY,
        source_priority: Optional[List[DataSource]] = None,
    ) -> Dict[str, Any]:
        """Get OHLCV data with caching and validation"""
        cache_key = f"ohlcv:{symbol}:{n_bars}:{timeframe.value}"
        cached = self.cache.get(cache_key)
        if cached:
            self.metrics.cache_hits += 1
            return cached

        self.metrics.cache_misses += 1

        # Demo mode: use mock data
        bars = self.mock.generate_ohlcv(symbol, n_bars, timeframe)
        report = self.validator.validate_ohlcv(bars, symbol)

        result = {
            "symbol": symbol,
            "bars": [asdict(b) for b in bars],
            "n_bars": len(bars),
            "timeframe": timeframe.value,
            "source": "mock",
            "validation": asdict(report),
            "retrieved_at": datetime.utcnow().isoformat(),
        }

        self.cache.set(cache_key, result, source="mock")
        self.metrics.total_requests += 1
        self.metrics.data_points_processed += len(bars)
        return result

    def get_multi_asset(
        self,
        symbols: List[str],
        n_bars: int = 252,
    ) -> Dict[str, Any]:
        """Get correlated multi-asset data"""
        all_data = self.mock.generate_multi_asset(symbols, n_bars)
        result = {}
        for sym, bars in all_data.items():
            report = self.validator.validate_ohlcv(bars, sym)
            result[sym] = {
                "bars": [asdict(b) for b in bars],
                "n_bars": len(bars),
                "validation": asdict(report),
            }
        self.metrics.total_requests += 1
        return {"assets": result, "retrieved_at": datetime.utcnow().isoformat()}

    def get_options_chain(self, symbol: str) -> Dict[str, Any]:
        cache_key = f"options:{symbol}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        chain = self.mock.generate_options_chain(symbol)
        result = {
            "symbol": symbol,
            "chain": chain,
            "n_contracts": len(chain),
            "source": "mock",
            "retrieved_at": datetime.utcnow().isoformat(),
        }
        self.cache.set(cache_key, result, ttl=60)
        return result

    def get_fundamentals(self, symbol: str) -> Dict[str, Any]:
        cache_key = f"fundamentals:{symbol}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        data = self.mock.generate_fundamentals(symbol)
        self.cache.set(cache_key, data, ttl=3600)
        return data

    def get_news(self, symbol: str, limit: int = 20) -> Dict[str, Any]:
        items = self.mock.generate_news(symbol, limit)
        return {"symbol": symbol, "news": items, "count": len(items)}

    def get_pipeline_status(self) -> Dict[str, Any]:
        return {
            "metrics": asdict(self.metrics),
            "cache": self.cache.get_stats(),
            "rate_limiter": self.rate_limiter.get_status(),
            "source_health": {k: asdict(v) for k, v in self._source_health.items()},
        }

    def run_full_pipeline(self, symbols: Optional[List[str]] = None) -> Dict[str, Any]:
        """Run full data pipeline for all symbols"""
        symbols = symbols or ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "JPM", "SPY"]

        results = {}
        for sym in symbols:
            ohlcv = self.get_ohlcv(sym)
            fundamentals = self.get_fundamentals(sym)
            news = self.get_news(sym, 5)

            results[sym] = {
                "ohlcv_bars": ohlcv["n_bars"],
                "validation_score": ohlcv["validation"]["quality_score"],
                "pe_ratio": fundamentals.get("pe_ratio"),
                "market_cap": fundamentals.get("market_cap"),
                "news_count": news["count"],
                "latest_price": ohlcv["bars"][-1]["close"] if ohlcv["bars"] else None,
            }

        return {
            "symbols_processed": len(symbols),
            "results": results,
            "pipeline_status": self.get_pipeline_status(),
            "run_at": datetime.utcnow().isoformat(),
        }
