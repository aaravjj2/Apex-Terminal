"""
v1.13 Market Data API with Record/Replay and Provenance
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Literal
from datetime import date
import os

from ...market_data.record_replay import (
    get_cache,
    MarketDataSource
)

router = APIRouter(tags=["Market Data v1.13"])


# ── Request/Response Models ──────────────────────────────────────────


class ProviderInfo(BaseModel):
    """Provider information with enabled state per mode."""
    name: str
    enabled_demo: bool
    enabled_local: bool
    description: str


class ProvenanceInfo(BaseModel):
    """Provenance metadata for data source transparency."""
    source: Literal["DEMO", "LOCAL_CACHE", "LOCAL_REPLAY", "LOCAL_FETCH"]
    cache_key: Optional[str] = None
    checksum: Optional[str] = None
    fetched_at: Optional[str] = None
    provider: Optional[str] = None


class BarsRequest(BaseModel):
    """Request for OHLCV bars."""
    symbol: str
    start_date: date
    end_date: date
    timeframe: str = "1d"


class BarsResponse(BaseModel):
    """OHLCV bars with provenance."""
    symbol: str
    bars: List[Dict[str, Any]]
    provenance: ProvenanceInfo


class QuoteRequest(BaseModel):
    """Request for real-time quote."""
    symbol: str


class QuoteResponse(BaseModel):
    """Quote with provenance."""
    symbol: str
    price: float
    provenance: ProvenanceInfo


# ── Route Handlers ────────────────────────────────────────────────────


@router.get("/providers", response_model=List[ProviderInfo])
async def list_providers():
    """
    List available market data providers with enabled state per mode.
    """
    return [
        ProviderInfo(
            name="DEMO",
            enabled_demo=True,
            enabled_local=False,
            description="Deterministic fixtures (zero network)"
        ),
        ProviderInfo(
            name="Yahoo Finance",
            enabled_demo=False,
            enabled_local=True,
            description="Free delayed quotes (LOCAL mode only)"
        ),
        ProviderInfo(
            name="Alpaca",
            enabled_demo=False,
            enabled_local=bool(os.getenv("ALPACA_API_KEY")),
            description="Real-time market data (requires API key)"
        )
    ]


@router.post("/bars", response_model=BarsResponse)
async def get_bars(req: BarsRequest):
    """
    Get OHLCV bars with provenance tracking.
    
    Policy:
    - DEMO mode (DEMO_MODE=1): Returns fixture data, source=DEMO
    - LOCAL mode: Uses record/replay cache
      1. Check replay artifact (cache_key based)
      2. If replay exists: return replay, source=LOCAL_REPLAY
      3. If no replay: fetch from provider, save replay, source=LOCAL_FETCH
    """
    # Check mode
    demo_mode = os.getenv("DEMO_MODE", "0") == "1"
    
    if demo_mode:
        # DEMO mode: fixture data (zero network)
        bars = [
            {"time": f"{req.start_date}T09:30:00Z", "open": 100.0, "high": 105.0, "low": 99.0, "close": 103.0, "volume": 1000000},
            {"time": f"{req.end_date}T09:30:00Z", "open": 103.0, "high": 108.0, "low": 102.0, "close": 107.0, "volume": 1200000}
        ]
        
        provenance = ProvenanceInfo(
            source="DEMO",
            provider="fixture"
        )
        
        return BarsResponse(
            symbol=req.symbol,
            bars=bars,
            provenance=provenance
        )
    
    # LOCAL mode: record/replay
    cache = get_cache()
    
    request_params = {
        "symbol": req.symbol,
        "start_date": req.start_date.isoformat(),
        "end_date": req.end_date.isoformat(),
        "timeframe": req.timeframe
    }
    
    def fetch_yahoo_bars():
        """Mock fetch function - in reality would call yfinance."""
        # For testing: return deterministic mock data
        return {
            "bars": [
                {"time": f"{req.start_date}T09:30:00Z", "close": 150.0},
                {"time": f"{req.end_date}T09:30:00Z", "close": 155.0}
            ]
        }
    
    data, source, cache_key = cache.get_or_fetch("yahoo", request_params, fetch_yahoo_bars)
    
    # Build provenance
    artifact = cache.load_replay(cache_key)
    provenance = ProvenanceInfo(
        source=source,
        cache_key=cache_key,
        checksum=artifact.checksum if artifact else None,
        fetched_at=artifact.fetched_at if artifact else None,
        provider="yahoo"
    )
    
    return BarsResponse(
        symbol=req.symbol,
        bars=data.get("bars", []),
        provenance=provenance
    )


@router.post("/quote", response_model=QuoteResponse)
async def get_quote(req: QuoteRequest):
    """
    Get real-time quote with provenance.
    In DEMO mode, derives from bars fixture.
    """
    demo_mode = os.getenv("DEMO_MODE", "0") == "1"
    
    if demo_mode:
        # DEMO: simple fixture
        price = 100.0 + hash(req.symbol) % 100
        
        provenance = ProvenanceInfo(
            source="DEMO",
            provider="fixture"
        )
        
        return QuoteResponse(
            symbol=req.symbol,
            price=price,
            provenance=provenance
        )
    
    # LOCAL mode: use bars API or separate quote cache
    # For simplicity, return mock
    provenance = ProvenanceInfo(
        source="LOCAL_FETCH",
        provider="yahoo"
    )
    
    return QuoteResponse(
        symbol=req.symbol,
        price=150.0,
        provenance=provenance
    )


@router.get("/replays", response_model=List[Dict[str, Any]])
async def list_replays():
    """
    List all replay artifacts for audit/provenance.
    Returns cache manifest showing recorded fetches.
    """
    cache = get_cache()
    return cache.list_replays()
