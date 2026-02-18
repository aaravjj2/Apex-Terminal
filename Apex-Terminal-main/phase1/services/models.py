"""
Shared data models for the Phase 1 pipeline.
Defines canonical schemas for ticks, bars, and bar lifecycle states.
"""

from __future__ import annotations
import hashlib
import json
from datetime import datetime
from enum import Enum
from typing import Optional, Any
from pydantic import BaseModel, Field, field_validator, computed_field


class BarState(str, Enum):
    """Bar lifecycle states."""
    FORMING = "BAR_FORMING"       # Mutable, being updated by incoming ticks
    CONFIRMED = "BAR_CONFIRMED"   # Locked at timeframe boundary
    HISTORICAL = "BAR_HISTORICAL" # Immutable, loaded from storage


class TickSource(str, Enum):
    """Data source identifiers."""
    YFINANCE = "yfinance"
    FINNHUB = "finnhub"
    ALPACA = "alpaca"
    MOCK = "mock"


class CanonicalTick(BaseModel):
    """
    Canonical tick record after normalization.
    All timestamps in UTC milliseconds.
    """
    source: TickSource
    symbol: str
    ts_ms: int = Field(description="UTC timestamp in milliseconds")
    price: float = Field(description="Trade price (64-bit float, no rounding)")
    size: float = Field(default=0.0, description="Trade size/volume")
    
    @computed_field
    @property
    def tick_hash(self) -> str:
        """Deterministic hash for deduplication."""
        data = f"{self.source.value}:{self.symbol}:{self.ts_ms}:{self.price}:{self.size}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]
    
    def to_canonical_dict(self) -> dict:
        """Export as canonical dict with alphabetical key ordering."""
        return {
            "price": self.price,
            "size": self.size,
            "source": self.source.value,
            "symbol": self.symbol,
            "ts_ms": self.ts_ms,
        }
    
    class Config:
        frozen = True  # Immutable after creation


class Bar(BaseModel):
    """
    OHLCV bar with lifecycle state tracking.
    Supports both forming (mutable) and confirmed (immutable) states.
    """
    symbol: str
    timeframe: str
    bar_index: int = Field(description="Deterministic bar sequence number")
    ts_start_ms: int = Field(description="Bar interval start (inclusive)")
    ts_end_ms: int = Field(description="Bar interval end (exclusive)")
    
    # OHLCV data - use Optional for NaN representation
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: Optional[float] = None
    volume: float = 0.0
    
    # Lifecycle
    state: BarState = BarState.FORMING
    tick_count: int = 0
    last_update_ms: Optional[int] = None
    
    def update_with_tick(self, tick: CanonicalTick) -> None:
        """
        Update bar with incoming tick data.
        Only allowed in FORMING state.
        """
        if self.state != BarState.FORMING:
            raise ValueError(f"Cannot update bar in {self.state} state")
        
        price = tick.price
        size = tick.size
        
        # First tick sets OHLC
        if self.open is None:
            self.open = price
            self.high = price
            self.low = price
            self.close = price
        else:
            # Update HLC
            if self.high is None or price > self.high:
                self.high = price
            if self.low is None or price < self.low:
                self.low = price
            self.close = price
        
        self.volume += size
        self.tick_count += 1
        self.last_update_ms = tick.ts_ms
    
    def confirm(self) -> None:
        """Lock the bar, transitioning to CONFIRMED state."""
        if self.state != BarState.FORMING:
            raise ValueError(f"Cannot confirm bar in {self.state} state")
        self.state = BarState.CONFIRMED
    
    def to_historical(self) -> None:
        """Mark as historical (immutable from storage)."""
        self.state = BarState.HISTORICAL
    
    def to_canonical_dict(self) -> dict:
        """Export as canonical dict with alphabetical key ordering for hashing."""
        return {
            "bar_index": self.bar_index,
            "close": self.close,
            "high": self.high,
            "low": self.low,
            "open": self.open,
            "state": self.state.value,
            "symbol": self.symbol,
            "tick_count": self.tick_count,
            "timeframe": self.timeframe,
            "ts_end_ms": self.ts_end_ms,
            "ts_start_ms": self.ts_start_ms,
            "volume": self.volume,
        }
    
    @computed_field
    @property
    def bar_hash(self) -> str:
        """
        Deterministic SHA256 hash of canonical bar data.
        Used for parity verification.
        """
        canonical = self.to_canonical_dict()
        # Remove state from hash since it can change
        canonical.pop("state", None)
        json_str = json.dumps(canonical, sort_keys=True, separators=(",", ":"))
        return f"sha256:{hashlib.sha256(json_str.encode()).hexdigest()}"
    
    def is_empty(self) -> bool:
        """Check if bar has no data (no ticks received)."""
        return self.open is None
    
    class Config:
        use_enum_values = False


class BarMessage(BaseModel):
    """WebSocket message for bar updates."""
    type: str  # "BAR_FORMING" or "BAR_CONFIRMED"
    symbol: str
    timeframe: str
    bar_index: int
    ts_start_ms: int
    ts_end_ms: int
    open: Optional[float]
    high: Optional[float]
    low: Optional[float]
    close: Optional[float]
    volume: float
    last_update_ms: Optional[int] = None
    hash: Optional[str] = None  # Only for confirmed bars
    
    @classmethod
    def from_bar(cls, bar: Bar) -> "BarMessage":
        """Create message from Bar instance."""
        return cls(
            type=bar.state.value,
            symbol=bar.symbol,
            timeframe=bar.timeframe,
            bar_index=bar.bar_index,
            ts_start_ms=bar.ts_start_ms,
            ts_end_ms=bar.ts_end_ms,
            open=bar.open,
            high=bar.high,
            low=bar.low,
            close=bar.close,
            volume=bar.volume,
            last_update_ms=bar.last_update_ms,
            hash=bar.bar_hash if bar.state == BarState.CONFIRMED else None,
        )


class RawTick(BaseModel):
    """
    Raw tick from connector before normalization.
    Flexible schema to accommodate different sources.
    """
    source: str
    symbol: str
    ts_ms: int
    price: float
    size: Optional[float] = None
    side: Optional[str] = None  # "buy", "sell", or None
    raw_data: Optional[dict[str, Any]] = None  # Original payload for debugging
