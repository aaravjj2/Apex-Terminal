"""
Canonical market data models.

All providers MUST convert their data to these canonical shapes.
Every record carries provenance (source, fetched_at).
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
from typing import List, Optional

from pydantic import BaseModel, Field


class BarDaily(BaseModel):
    """Canonical daily OHLCV bar with provenance."""
    symbol: str = Field(..., description="Ticker symbol (upper-case)")
    date: dt.date = Field(..., description="Trading date (UTC-normalised)")
    open: float
    high: float
    low: float
    close: float
    adj_close: float = Field(..., description="Split/dividend-adjusted close")
    volume: int
    source: str = Field(..., description="Provider name that produced this bar")
    fetched_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)

    class Config:
        json_encoders = {dt.date: str, dt.datetime: lambda v: v.isoformat()}


class Quote(BaseModel):
    """Real-time quote with provenance."""
    symbol: str
    ts: dt.datetime = Field(..., description="Quote timestamp (UTC)")
    bid: Optional[float] = None
    ask: Optional[float] = None
    last: float
    volume: Optional[int] = None
    source: str
    fetched_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)


class FetchProvenance(BaseModel):
    """Provenance metadata attached to every provider fetch."""
    provider: str
    fetched_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
    request_params: dict = Field(default_factory=dict)
    row_count: int = 0
    duration_ms: float = 0.0


class BatchRecord(BaseModel):
    """Metadata for a batch of ingested bars, stored in market_data_batches table."""
    batch_id: str
    provider: str
    symbol: str
    timeframe: str = "1d"
    start_date: dt.date
    end_date: dt.date
    fetched_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
    sha256: str = ""
    row_count: int = 0


class SymbolHealth(BaseModel):
    """Health status for a single symbol's data coverage."""
    symbol: str
    total_rows: int = 0
    earliest_date: Optional[dt.date] = None
    latest_date: Optional[dt.date] = None
    missing_pct: float = 0.0
    expected_trading_days: int = 0
    actual_trading_days: int = 0
    last_fetch: Optional[dt.datetime] = None
    provider: str = ""
    status: str = "unknown"   # ok | warning | error


class MarketDataError(Exception):
    """Structured error for market data failures."""
    def __init__(self, code: str, message: str, provider: str = "", symbol: str = ""):
        self.code = code
        self.message = message
        self.provider = provider
        self.symbol = symbol
        super().__init__(f"[{code}] {provider}/{symbol}: {message}")


# ── Checksum helper ──────────────────────────────────────────────────────────

def compute_bars_sha256(bars: List[BarDaily]) -> str:
    """Compute deterministic SHA-256 over a list of BarDaily records.

    Rows are sorted by (symbol, date) to ensure stable ordering.
    """
    sorted_bars = sorted(bars, key=lambda b: (b.symbol, b.date.isoformat()))
    canonical = json.dumps(
        [
            {
                "symbol": b.symbol,
                "date": b.date.isoformat(),
                "open": b.open,
                "high": b.high,
                "low": b.low,
                "close": b.close,
                "adj_close": b.adj_close,
                "volume": b.volume,
            }
            for b in sorted_bars
        ],
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
