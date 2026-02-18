"""
REST endpoints for data ingestion.
"""

import csv
import io
from typing import Optional, List
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Request
from pydantic import BaseModel
import structlog

from ...models import RawTick, CanonicalTick, Bar
from ...ingestion.normalizer import TickNormalizer
from ...ingestion.connectors.mock import MockConnector
from ...bar_engine import BarEngine
from ...persistence.repository import BarRepository
from ...persistence.cache import BarCache, TieredBarStore


logger = structlog.get_logger()
router = APIRouter()


class IngestResult(BaseModel):
    """Result of ingestion operation."""
    success: bool
    ticks_received: int
    ticks_normalized: int
    bars_created: int
    bars_confirmed: int
    errors: List[str] = []


class TickInput(BaseModel):
    """Single tick input for injection."""
    symbol: str
    ts_ms: int
    price: float
    size: float = 0.0


class TickBatchInput(BaseModel):
    """Batch of ticks for injection."""
    ticks: List[TickInput]


# Shared instances
_bar_engine: Optional[BarEngine] = None
_store: Optional[TieredBarStore] = None


def get_engine() -> BarEngine:
    """Get or create bar engine."""
    global _bar_engine, _store
    
    if _bar_engine is None:
        repository = BarRepository()
        cache = BarCache()
        _store = TieredBarStore(cache=cache, repository=repository)
        
        _bar_engine = BarEngine()
        
        # Set persist callback
        async def persist_bar(bar: Bar):
            await _store.save_bar(bar)
        
        _bar_engine.set_persist_callback(persist_bar)
    
    return _bar_engine


@router.post("/mock", response_model=IngestResult)
async def ingest_mock_csv(
    file: UploadFile = File(..., description="CSV file with tick data"),
):
    """
    Upload and process a test tick CSV file.
    
    Expected CSV columns: symbol, ts_ms, price, size (optional)
    
    The ticks will be processed through the full pipeline:
    normalization → bar aggregation → persistence.
    """
    engine = get_engine()
    normalizer = TickNormalizer()
    
    errors = []
    ticks_received = 0
    ticks_normalized = 0
    
    try:
        # Read CSV content
        content = await file.read()
        text = content.decode("utf-8")
        
        # Parse CSV
        reader = csv.DictReader(io.StringIO(text))
        ticks = []
        
        for row in reader:
            ticks_received += 1
            try:
                raw_tick = RawTick(
                    source="mock",
                    symbol=row.get("symbol", "UNKNOWN").upper(),
                    ts_ms=int(row["ts_ms"]),
                    price=float(row["price"]),
                    size=float(row.get("size", 0)),
                )
                ticks.append(raw_tick)
            except (KeyError, ValueError) as e:
                errors.append(f"Row {ticks_received}: {str(e)}")
        
        # Sort by timestamp for deterministic processing
        ticks.sort(key=lambda t: t.ts_ms)
        
        # Register engine as normalizer callback
        async def process_canonical(tick: CanonicalTick):
            await engine.process_tick(tick)
        
        normalizer.register_callback(process_canonical)
        
        # Process all ticks
        for raw_tick in ticks:
            result = await normalizer.process_tick(raw_tick)
            if result:
                ticks_normalized += 1
        
        # Force confirm remaining bars
        await engine.force_confirm_all()
        
        stats = engine.get_stats()
        
        return IngestResult(
            success=len(errors) == 0,
            ticks_received=ticks_received,
            ticks_normalized=ticks_normalized,
            bars_created=stats.get("bars_formed", 0),
            bars_confirmed=stats.get("bars_confirmed", 0),
            errors=errors[:10],  # Limit errors in response
        )
        
    except Exception as e:
        logger.error("ingest_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ticks", response_model=IngestResult)
async def ingest_ticks(
    data: TickBatchInput,
):
    """
    Inject a batch of ticks directly via JSON.
    
    Useful for testing and programmatic ingestion.
    """
    engine = get_engine()
    normalizer = TickNormalizer()
    
    ticks_received = len(data.ticks)
    ticks_normalized = 0
    
    # Register engine callback
    async def process_canonical(tick: CanonicalTick):
        await engine.process_tick(tick)
    
    normalizer.register_callback(process_canonical)
    
    # Sort by timestamp
    sorted_ticks = sorted(data.ticks, key=lambda t: t.ts_ms)
    
    for tick_input in sorted_ticks:
        raw_tick = RawTick(
            source="mock",
            symbol=tick_input.symbol.upper(),
            ts_ms=tick_input.ts_ms,
            price=tick_input.price,
            size=tick_input.size,
        )
        
        result = await normalizer.process_tick(raw_tick)
        if result:
            ticks_normalized += 1
    
    # Force confirm
    await engine.force_confirm_all()
    
    stats = engine.get_stats()
    
    return IngestResult(
        success=True,
        ticks_received=ticks_received,
        ticks_normalized=ticks_normalized,
        bars_created=stats.get("bars_formed", 0),
        bars_confirmed=stats.get("bars_confirmed", 0),
    )


@router.post("/replay/{symbol}")
async def replay_historical(
    symbol: str,
    background_tasks: BackgroundTasks,
    start_ms: Optional[int] = None,
    end_ms: Optional[int] = None,
    source: str = "yfinance",
):
    """
    Trigger historical data replay for a symbol.
    
    This runs in the background and fetches data from the specified source.
    """
    # This would integrate with the connectors
    # For now, return a placeholder
    return {
        "status": "started",
        "symbol": symbol.upper(),
        "source": source,
        "message": "Historical replay started in background",
    }


@router.delete("/bars/{symbol}/{timeframe}")
async def delete_bars(
    symbol: str,
    timeframe: str,
    from_ts: Optional[int] = None,
    to_ts: Optional[int] = None,
):
    """Delete bars for a symbol/timeframe (for testing/maintenance)."""
    repository = BarRepository()
    
    count = await repository.delete_bars(
        symbol=symbol.upper(),
        timeframe=timeframe,
        start_ms=from_ts,
        end_ms=to_ts,
    )
    
    return {
        "deleted": count,
        "symbol": symbol.upper(),
        "timeframe": timeframe,
    }


@router.get("/provider-status")
async def provider_status(request: Request):
    """Return ingestion provider status (connector type and running state)."""
    ingestion = getattr(request.app.state, "ingestion", None)
    if not ingestion:
        return {"provider": None, "running": False}

    connector = getattr(ingestion, "connector", None)
    provider_name = connector.name if connector else None
    running = connector.is_running if connector else False

    return {"provider": provider_name, "running": running}


@router.get("/status")
async def ingestion_status(request: Request):
    """Return detailed ingestion status including mode, provider, last tick time."""
    ingestion = getattr(request.app.state, "ingestion", None)
    if not ingestion:
        return {
            "mode": "unknown",
            "provider": None,
            "running": False,
            "last_tick_time": None,
            "symbols": [],
        }

    connector = getattr(ingestion, "connector", None)
    provider_name = connector.name if connector else None
    running = connector.is_running if connector else False

    # Get last tick time from bar engine if available
    bar_engine = getattr(ingestion, "bar_engine", None)
    last_tick_time = None
    if bar_engine:
        # Bar engine should track last tick timestamp
        # For now, return current time if running
        last_tick_time = ingestion.mode if running else None

    return {
        "mode": ingestion.mode,
        "provider": provider_name,
        "running": running,
        "last_tick_time": last_tick_time,
        "symbols": ingestion.symbols,
    }
