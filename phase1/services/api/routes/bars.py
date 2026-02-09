"""
REST endpoints for bar data retrieval.
"""

from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
import structlog

from ...persistence.repository import BarRepository
from ...persistence.cache import BarCache, TieredBarStore
from ...models import Bar


logger = structlog.get_logger()
router = APIRouter()

# Shared instances
_repository: Optional[BarRepository] = None
_cache: Optional[BarCache] = None
_store: Optional[TieredBarStore] = None


def get_store() -> TieredBarStore:
    """Get or create tiered store."""
    global _repository, _cache, _store
    if _store is None:
        _repository = BarRepository()
        _cache = BarCache()
        _store = TieredBarStore(cache=_cache, repository=_repository)
    return _store


class BarResponse(BaseModel):
    """Single bar response."""
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
    state: str
    hash: Optional[str] = None
    
    @classmethod
    def from_bar(cls, bar: Bar) -> "BarResponse":
        return cls(
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
            state=bar.state.value,
            hash=bar.bar_hash if bar.state.value != "BAR_FORMING" else None,
        )


class BarsListResponse(BaseModel):
    """List of bars response."""
    symbol: str
    timeframe: str
    count: int
    bars: List[BarResponse]


@router.get("/{symbol}/{timeframe}", response_model=BarsListResponse)
async def get_bars(
    symbol: str,
    timeframe: str,
    from_ts: Optional[int] = Query(None, alias="from", description="Start timestamp (ms or ISO)"),
    to_ts: Optional[int] = Query(None, alias="to", description="End timestamp (ms or ISO)"),
    limit: int = Query(1000, le=10000, description="Max bars to return"),
):
    """
    Get confirmed bars for a symbol and timeframe.
    
    - **symbol**: Stock symbol (e.g., AAPL)
    - **timeframe**: Bar timeframe (1m, 5m, 15m, 1h, 1d)
    - **from**: Start timestamp in UTC milliseconds
    - **to**: End timestamp in UTC milliseconds
    - **limit**: Maximum number of bars (default 1000, max 10000)
    """
    store = get_store()
    symbol = symbol.upper()
    
    # Parse timestamps if provided as ISO strings
    start_ms = _parse_timestamp(from_ts) if from_ts else None
    end_ms = _parse_timestamp(to_ts) if to_ts else None
    
    try:
        bars = await store.get_bars(
            symbol=symbol,
            timeframe=timeframe,
            start_ms=start_ms,
            end_ms=end_ms,
            limit=limit,
        )
        
        return BarsListResponse(
            symbol=symbol,
            timeframe=timeframe,
            count=len(bars),
            bars=[BarResponse.from_bar(b) for b in bars],
        )
    except Exception as e:
        logger.error("get_bars_error", error=str(e), symbol=symbol)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{symbol}/{timeframe}/latest", response_model=Optional[BarResponse])
async def get_latest_bar(
    symbol: str,
    timeframe: str,
):
    """Get the most recent bar for a symbol/timeframe."""
    store = get_store()
    symbol = symbol.upper()
    
    try:
        bar = await store.get_latest_bar(symbol, timeframe)
        
        if bar is None:
            raise HTTPException(status_code=404, detail="No bars found")
        
        return BarResponse.from_bar(bar)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_latest_error", error=str(e), symbol=symbol)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{symbol}/{timeframe}/{bar_index}", response_model=Optional[BarResponse])
async def get_bar_by_index(
    symbol: str,
    timeframe: str,
    bar_index: int,
):
    """Get a specific bar by index."""
    store = get_store()
    symbol = symbol.upper()
    
    try:
        bar = await store.get_bar(symbol, timeframe, bar_index)
        
        if bar is None:
            raise HTTPException(status_code=404, detail="Bar not found")
        
        return BarResponse.from_bar(bar)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_bar_error", error=str(e), symbol=symbol, bar_index=bar_index)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{symbol}/{timeframe}/count")
async def get_bar_count(
    symbol: str,
    timeframe: str,
    from_ts: Optional[int] = Query(None, alias="from"),
    to_ts: Optional[int] = Query(None, alias="to"),
):
    """Get count of bars for a symbol/timeframe."""
    store = get_store()
    symbol = symbol.upper()
    
    start_ms = _parse_timestamp(from_ts) if from_ts else None
    end_ms = _parse_timestamp(to_ts) if to_ts else None
    
    try:
        count = await store.repository.count_bars(
            symbol, timeframe, start_ms, end_ms
        )
        return {"symbol": symbol, "timeframe": timeframe, "count": count}
    except Exception as e:
        logger.error("count_bars_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


def _parse_timestamp(value) -> Optional[int]:
    """Parse timestamp from various formats."""
    if value is None:
        return None
    
    if isinstance(value, int):
        # Already milliseconds
        if value > 10000000000000:  # Likely ms
            return value
        elif value > 10000000000:  # Likely seconds
            return value * 1000
        return value * 1000  # Assume seconds
    
    if isinstance(value, str):
        try:
            # Try ISO format
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return int(dt.timestamp() * 1000)
        except ValueError:
            # Try as numeric string
            return int(float(value) * 1000)
    
    return None
