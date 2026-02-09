"""
Debug endpoints for development and testing.
"""

from typing import Optional
from fastapi import APIRouter, Query
from pydantic import BaseModel
import structlog

from ...config import get_settings
from ...bar_engine import BarIndexCalculator, NYSESessionCalendar
from ...persistence.cache import BarCache


logger = structlog.get_logger()
router = APIRouter()


class BarIndexInfo(BaseModel):
    """BarIndex calculation details."""
    symbol: str
    timeframe: str
    ts_ms: int
    bar_index: int
    interval_start_ms: int
    interval_end_ms: int
    epoch_ms: int


class SessionInfo(BaseModel):
    """Session calendar information."""
    ts_ms: int
    market_open: bool
    session_start_ms: int
    session_end_ms: int
    next_session_start_ms: int


@router.get("/barindex/{symbol}/{timeframe}")
async def get_barindex_info(
    symbol: str,
    timeframe: str,
    ts_ms: Optional[int] = Query(None, description="Timestamp to check (default: now)"),
):
    """
    Debug endpoint to inspect BarIndex calculations.
    
    Shows how a timestamp maps to bar_index and interval boundaries.
    """
    import time
    
    if ts_ms is None:
        ts_ms = int(time.time() * 1000)
    
    settings = get_settings()
    calendar = NYSESessionCalendar(
        include_extended_hours=settings.enable_extended_hours
    )
    
    calc = BarIndexCalculator(
        symbol=symbol.upper(),
        timeframe=timeframe,
        calendar=calendar,
    )
    
    try:
        bar_index = calc.calculate_bar_index(ts_ms)
        interval_start, interval_end = calc.get_interval_bounds(ts_ms)
        
        return BarIndexInfo(
            symbol=symbol.upper(),
            timeframe=timeframe,
            ts_ms=ts_ms,
            bar_index=bar_index,
            interval_start_ms=interval_start,
            interval_end_ms=interval_end,
            epoch_ms=calc.epoch_ms,
        )
    except Exception as e:
        logger.error("barindex_error", error=str(e))
        return {"error": str(e)}


@router.get("/session")
async def get_session_info(
    ts_ms: Optional[int] = Query(None, description="Timestamp to check"),
    extended_hours: bool = Query(False, description="Include extended hours"),
):
    """
    Debug endpoint to inspect session calendar calculations.
    """
    import time
    
    if ts_ms is None:
        ts_ms = int(time.time() * 1000)
    
    calendar = NYSESessionCalendar(include_extended_hours=extended_hours)
    
    session_start, session_end = calendar.get_session_bounds(ts_ms)
    next_session = calendar.get_next_session_start(ts_ms)
    
    return SessionInfo(
        ts_ms=ts_ms,
        market_open=calendar.is_market_open(ts_ms),
        session_start_ms=session_start,
        session_end_ms=session_end,
        next_session_start_ms=next_session,
    )


@router.get("/cache/stats")
async def get_cache_stats():
    """Get bar cache statistics."""
    cache = BarCache()
    return await cache.get_stats()


@router.get("/config")
async def get_config():
    """Get current configuration (sanitized)."""
    settings = get_settings()
    
    return {
        "database_url": _sanitize_url(settings.database_url),
        "api_host": settings.api_host,
        "api_port": settings.api_port,
        "ingestion_mode": settings.ingestion_mode,
        "supported_timeframes": settings.timeframes_list,
        "enable_extended_hours": settings.enable_extended_hours,
        "bar_cache_size": settings.bar_cache_size,
        "log_level": settings.log_level,
        "debug_mode": settings.debug_mode,
    }


@router.get("/health/deep")
async def deep_health_check():
    """
    Deep health check including database connectivity.
    """
    from ...persistence import get_database
    
    checks = {
        "api": "healthy",
        "database": "unknown",
    }
    
    try:
        db = get_database()
        async with db.get_session() as session:
            from sqlalchemy import text
            await session.execute(text("SELECT 1"))
            checks["database"] = "healthy"
    except Exception as e:
        checks["database"] = f"unhealthy: {str(e)}"
    
    overall = "healthy" if all(v == "healthy" for v in checks.values()) else "degraded"
    
    return {
        "status": overall,
        "checks": checks,
    }


def _sanitize_url(url: str) -> str:
    """Remove credentials from URL."""
    if "@" in url:
        # Has credentials
        scheme_end = url.find("://")
        at_pos = url.find("@")
        return url[:scheme_end + 3] + "***@" + url[at_pos + 1:]
    return url
