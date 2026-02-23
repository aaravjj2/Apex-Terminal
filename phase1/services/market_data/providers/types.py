"""
Shared types for market data providers.
"""

from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum


class ProviderName(str, Enum):
    """Supported market data providers."""
    DEMO = "demo"
    YAHOO = "yahoo"
    FINNHUB = "finnhub"
    POLYGON = "polygon"
    TIINGO = "tiingo"


class IntervalType(str, Enum):
    """Supported time intervals."""
    MIN_1 = "1min"
    MIN_5 = "5min"
    MIN_15 = "15min"
    MIN_30 = "30min"
    HOUR_1 = "1h"
    HOUR_4 = "4h"
    DAY_1 = "1d"
    WEEK_1 = "1w"
    MONTH_1 = "1mo"


class BarData(BaseModel):
    """Single OHLCV bar."""
    timestamp: datetime = Field(..., description="Bar timestamp (UTC)")
    open: float = Field(..., description="Open price")
    high: float = Field(..., description="High price")
    low: float = Field(..., description="Low price")
    close: float = Field(..., description="Close price")
    volume: int = Field(..., description="Trading volume")


class QuoteData(BaseModel):
    """Real-time quote snapshot."""
    symbol: str = Field(..., description="Ticker symbol")
    timestamp: datetime = Field(..., description="Quote timestamp (UTC)")
    price: float = Field(..., description="Last price")
    bid: Optional[float] = Field(None, description="Bid price")
    ask: Optional[float] = Field(None, description="Ask price")
    volume: Optional[int] = Field(None, description="Daily volume")


class BarsRequest(BaseModel):
    """Request for historical bars."""
    symbol: str = Field(..., description="Ticker symbol (e.g., AAPL)")
    start: datetime = Field(..., description="Start time (UTC)")
    end: datetime = Field(..., description="End time (UTC)")
    interval: IntervalType = Field(IntervalType.DAY_1, description="Bar interval")


class BarsResponse(BaseModel):
    """Response with historical bars."""
    symbol: str
    bars: List[BarData]
    provider: ProviderName
    cached: bool = Field(False, description="True if served from cache")


class QuoteRequest(BaseModel):
    """Request for real-time quote."""
    symbol: str = Field(..., description="Ticker symbol")


class QuoteResponse(BaseModel):
    """Response with real-time quote."""
    quote: QuoteData
    provider: ProviderName
    cached: bool = Field(False, description="True if served from cache")


class ProviderInfo(BaseModel):
    """Provider metadata."""
    name: ProviderName
    enabled: bool
    description: str
    requires_auth: bool = Field(False, description="True if API keys required")
    supports_realtime: bool = Field(False, description="True if real-time quotes supported")
    replay_available: bool = Field(False, description="True if replay artifacts available")
    replay_enabled: bool = Field(False, description="True if replay save enabled (LOCAL mode)")
    mode: str = Field("DEMO", description="Current mode (DEMO/LOCAL)")
