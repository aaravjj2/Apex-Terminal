"""
Wave 21 — Canonical Schema & Provenance
Defines the canonical OHLCV bar schema with full provenance tracking,
data lineage, and integrity hashing for backtest data.
"""
from __future__ import annotations
import hashlib
import json
from dataclasses import dataclass, field, asdict
from datetime import datetime, date
from enum import Enum
from typing import Optional, List, Dict, Any


class DataSource(str, Enum):
    YFINANCE = "yfinance"
    ALPACA = "alpaca"
    FINNHUB = "finnhub"
    POLYGON = "polygon"
    MANUAL = "manual"


class AdjustmentType(str, Enum):
    NONE = "none"
    SPLIT = "split"
    DIVIDEND = "dividend"
    SPLIT_AND_DIVIDEND = "split_and_dividend"


class BarResolution(str, Enum):
    MINUTE_1 = "1m"
    MINUTE_5 = "5m"
    MINUTE_15 = "15m"
    MINUTE_30 = "30m"
    HOUR_1 = "1h"
    HOUR_4 = "4h"
    DAILY = "1d"
    WEEKLY = "1w"
    MONTHLY = "1M"


@dataclass(frozen=True)
class Provenance:
    """Full data lineage for a single bar or bar series."""
    source: DataSource
    fetched_at: str  # ISO timestamp
    api_version: str = "v1"
    request_id: str = ""
    raw_hash: str = ""    # SHA-256 of raw response bytes
    adjustments_applied: List[AdjustmentType] = field(default_factory=list)
    gap_filled: bool = False
    quality_score: float = 1.0  # 0.0–1.0

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["source"] = self.source.value
        d["adjustments_applied"] = [a.value for a in self.adjustments_applied]
        return d


@dataclass(frozen=True)
class CanonicalBar:
    """Canonical OHLCV bar with provenance."""
    symbol: str
    timestamp: str     # ISO-8601 date or datetime
    resolution: BarResolution
    open: float
    high: float
    low: float
    close: float
    volume: int
    adj_close: Optional[float] = None
    vwap: Optional[float] = None
    trade_count: Optional[int] = None
    provenance: Optional[Provenance] = None

    @property
    def bar_hash(self) -> str:
        payload = f"{self.symbol}|{self.timestamp}|{self.resolution.value}|{self.open}|{self.high}|{self.low}|{self.close}|{self.volume}"
        return hashlib.sha256(payload.encode()).hexdigest()[:16]

    def to_dict(self) -> Dict[str, Any]:
        d = {
            "symbol": self.symbol,
            "timestamp": self.timestamp,
            "resolution": self.resolution.value,
            "open": self.open,
            "high": self.high,
            "low": self.low,
            "close": self.close,
            "volume": self.volume,
            "adj_close": self.adj_close,
            "vwap": self.vwap,
            "trade_count": self.trade_count,
            "bar_hash": self.bar_hash,
        }
        if self.provenance:
            d["provenance"] = self.provenance.to_dict()
        return d

    def validate(self) -> List[str]:
        """Return list of validation errors."""
        errors: List[str] = []
        if self.high < self.low:
            errors.append(f"high ({self.high}) < low ({self.low})")
        if self.open < self.low or self.open > self.high:
            errors.append(f"open ({self.open}) outside [low, high]")
        if self.close < self.low or self.close > self.high:
            errors.append(f"close ({self.close}) outside [low, high]")
        if self.volume < 0:
            errors.append(f"negative volume ({self.volume})")
        return errors


@dataclass
class BarSeries:
    """Collection of CanonicalBars for a symbol with series-level provenance."""
    symbol: str
    resolution: BarResolution
    bars: List[CanonicalBar] = field(default_factory=list)
    source: DataSource = DataSource.YFINANCE
    fetched_at: str = ""
    start_date: str = ""
    end_date: str = ""

    @property
    def series_hash(self) -> str:
        """Hash across all bars for determinism."""
        bar_hashes = "|".join(b.bar_hash for b in sorted(self.bars, key=lambda b: b.timestamp))
        return hashlib.sha256(bar_hashes.encode()).hexdigest()[:16]

    @property
    def count(self) -> int:
        return len(self.bars)

    def completeness(self, expected_count: int) -> float:
        """Data completeness ratio."""
        if expected_count <= 0:
            return 1.0
        return min(1.0, self.count / expected_count)

    def gaps(self) -> List[str]:
        """Return list of date gaps in the series (for daily resolution)."""
        if len(self.bars) < 2:
            return []
        sorted_bars = sorted(self.bars, key=lambda b: b.timestamp)
        gap_dates: List[str] = []
        for i in range(1, len(sorted_bars)):
            prev_ts = sorted_bars[i - 1].timestamp[:10]
            curr_ts = sorted_bars[i].timestamp[:10]
            try:
                prev_d = date.fromisoformat(prev_ts)
                curr_d = date.fromisoformat(curr_ts)
                delta = (curr_d - prev_d).days
                if delta > 1:
                    # Record each missing business day
                    for j in range(1, delta):
                        missing = prev_d.replace(day=prev_d.day)
                        from datetime import timedelta
                        missing = prev_d + timedelta(days=j)
                        if missing.weekday() < 5:
                            gap_dates.append(missing.isoformat())
            except ValueError:
                continue
        return gap_dates

    def quality_score(self) -> float:
        """Aggregate quality score across all bars."""
        if not self.bars:
            return 0.0
        valid_bars = sum(1 for b in self.bars if not b.validate())
        completeness = valid_bars / len(self.bars)
        # Weighted: 70% bar validity, 30% provenance quality
        prov_quality = sum(
            (b.provenance.quality_score if b.provenance else 0.5)
            for b in self.bars
        ) / len(self.bars)
        return round(0.7 * completeness + 0.3 * prov_quality, 4)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "resolution": self.resolution.value,
            "count": self.count,
            "series_hash": self.series_hash,
            "source": self.source.value,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "quality_score": self.quality_score(),
        }
