"""
Ticker normalization and resolution models.
"""
from pydantic import BaseModel
from typing import List, Optional


class TickerResolveRequest(BaseModel):
    """Request model for single ticker resolution."""
    ticker: str


class TickerResolveResponse(BaseModel):
    """Response model for single ticker resolution."""
    ticker: str
    normalized: str
    confidence: str  # 'high' | 'low'
    reason: str
    collision: bool


class TickerBatchRequest(BaseModel):
    """Request model for batch ticker resolution."""
    tickers: List[str]


class TickerBatchResponse(BaseModel):
    """Response model for batch ticker resolution."""
    results: List[TickerResolveResponse]


class TickerNormalizeRequest(BaseModel):
    """Request model for quick normalization."""
    ticker: str


class TickerNormalizeResponse(BaseModel):
    """Response model for quick normalization."""
    normalized: str
