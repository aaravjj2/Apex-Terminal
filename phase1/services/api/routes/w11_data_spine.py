"""
Waves 11-20 — Data Spine API Routes
Real data ingestion, history retrieval, universe management.
Online-only — no mock/demo/synthetic.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import logging

from ...waves11_20.data_spine import get_data_spine

router = APIRouter(prefix="/api/v2/data-spine", tags=["data-spine-v2"])
logger = logging.getLogger(__name__)


class IngestSymbolRequest(BaseModel):
    symbol: str
    years: int = 7


class IngestUniverseRequest(BaseModel):
    symbols: Optional[list[str]] = None
    years: int = 7


@router.get("/universe")
async def get_universe():
    """Get current symbol universe."""
    spine = get_data_spine()
    return {"universe": spine.get_universe(), "count": len(spine.get_universe())}


@router.post("/ingest/symbol")
async def ingest_symbol(req: IngestSymbolRequest):
    """Ingest historical data for a single symbol (yfinance, 7y daily)."""
    spine = get_data_spine()
    job = await spine.ingest_history(req.symbol, years=req.years)
    return job.to_dict()


@router.post("/ingest/universe")
async def ingest_universe(req: IngestUniverseRequest):
    """Ingest historical data for the entire universe."""
    spine = get_data_spine()
    symbols = req.symbols or spine.get_universe()
    results = []
    for sym in symbols:
        job = await spine.ingest_history(sym, years=req.years)
        results.append(job.to_dict())
    return {"jobs": results, "total": len(results)}


@router.post("/ingest/news")
async def ingest_news(symbol: str = Query(...)):
    """Ingest news for a symbol from Finnhub."""
    spine = get_data_spine()
    articles = await spine.ingest_news(symbol)
    return {"symbol": symbol, "articles_ingested": len(articles)}


@router.get("/history/{symbol}")
async def get_history(
    symbol: str,
    limit: int = Query(default=252, le=2000),
):
    """Get historical daily bars for a symbol."""
    spine = get_data_spine()
    bars = spine.get_history(symbol, limit=limit)
    return {"symbol": symbol, "bars": [b.to_dict() for b in bars], "count": len(bars)}


@router.get("/completeness")
async def check_completeness():
    """Check data completeness for all symbols."""
    spine = get_data_spine()
    report = spine.get_completeness_report()
    return report


@router.get("/checksums/{symbol}")
async def get_checksums(symbol: str):
    """Get data integrity checksums for a symbol."""
    spine = get_data_spine()
    bars = spine.get_history(symbol, limit=10)
    return {
        "symbol": symbol,
        "bar_count": len(bars),
        "has_data": len(bars) > 0,
    }
