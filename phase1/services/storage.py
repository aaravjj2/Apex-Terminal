"""
Canonical market data storage layer.

Persists bars into the database, computes checksums, records batch
provenance. Every bar that enters the system goes through this gate.

NON-NEGOTIABLE: Only real market data is stored. No demo/mock/dummy.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional, Sequence

import structlog
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from .persistence.models import MarketBar, MarketDataBatch
from .market_data.models import (
    BarDaily, BatchRecord, compute_bars_sha256, MarketDataError,
)
from .market_data.providers.types import BarData, BarsResponse

logger = structlog.get_logger(__name__)


async def store_bars(
    session: AsyncSession,
    symbol: str,
    timeframe: str,
    provider: str,
    bars: Sequence[BarData],
    *,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> BatchRecord:
    """
    Persist a set of bars into market_bars and record the batch.

    1. Compute SHA-256 checksum over the bar list.
    2. Upsert bars into market_bars (skip duplicates).
    3. Insert a row into market_data_batches with provenance.

    Returns:
        BatchRecord with the batch metadata.
    """
    if not bars:
        raise MarketDataError("EMPTY_BARS", "Cannot store empty bar list", provider, symbol)

    # Build canonical representation for checksum
    canonicals: List[BarDaily] = []
    for b in bars:
        canonicals.append(BarDaily(
            symbol=symbol.upper(),
            date=b.timestamp,
            open=b.open,
            high=b.high,
            low=b.low,
            close=b.close,
            volume=int(b.volume),
            adj_close=b.close,
            source=provider,
            fetched_at=datetime.utcnow(),
        ))

    sha = compute_bars_sha256(canonicals)
    batch_id = f"batch-{uuid.uuid4().hex[:16]}"

    # Upsert bars — skip if (symbol, timeframe, timestamp) already exists
    inserted = 0
    for b in bars:
        existing = await session.execute(
            select(MarketBar.id).where(
                and_(
                    MarketBar.symbol == symbol.upper(),
                    MarketBar.timeframe == timeframe,
                    MarketBar.timestamp == b.timestamp,
                )
            )
        )
        if existing.scalar() is not None:
            continue  # skip duplicate
        row = MarketBar(
            symbol=symbol.upper(),
            timeframe=timeframe,
            timestamp=b.timestamp,
            open=b.open,
            high=b.high,
            low=b.low,
            close=b.close,
            volume=float(b.volume),
            provider=provider,
            ingested_at=datetime.utcnow(),
        )
        session.add(row)
        inserted += 1

    # Record batch provenance
    s_date = start_date or (bars[0].timestamp if bars else datetime.utcnow())
    e_date = end_date or (bars[-1].timestamp if bars else datetime.utcnow())

    batch_row = MarketDataBatch(
        batch_id=batch_id,
        provider=provider,
        symbol=symbol.upper(),
        timeframe=timeframe,
        start_date=s_date,
        end_date=e_date,
        row_count=len(bars),
        sha256=sha,
        status="ok",
        fetched_at=datetime.utcnow(),
    )
    session.add(batch_row)
    await session.flush()

    logger.info(
        "bars_stored",
        symbol=symbol,
        provider=provider,
        total=len(bars),
        inserted=inserted,
        batch_id=batch_id,
        sha256=sha[:16],
    )

    return BatchRecord(
        batch_id=batch_id,
        provider=provider,
        symbol=symbol.upper(),
        timeframe=timeframe,
        start_date=s_date,
        end_date=e_date,
        sha256=sha,
        row_count=len(bars),
    )


async def get_symbol_coverage(
    session: AsyncSession, symbol: str, timeframe: str = "1d"
) -> dict:
    """Return coverage stats for a symbol."""
    result = await session.execute(
        select(
            func.count(MarketBar.id).label("bar_count"),
            func.min(MarketBar.timestamp).label("first_bar"),
            func.max(MarketBar.timestamp).label("last_bar"),
        ).where(
            and_(
                MarketBar.symbol == symbol.upper(),
                MarketBar.timeframe == timeframe,
            )
        )
    )
    row = result.one_or_none()
    if row is None or row.bar_count == 0:
        return {"symbol": symbol, "bar_count": 0, "first_bar": None, "last_bar": None}
    return {
        "symbol": symbol.upper(),
        "bar_count": row.bar_count,
        "first_bar": row.first_bar.isoformat() if row.first_bar else None,
        "last_bar": row.last_bar.isoformat() if row.last_bar else None,
    }


async def get_all_batches(
    session: AsyncSession, symbol: Optional[str] = None, limit: int = 100
) -> List[dict]:
    """Return recent batch records, optionally filtered by symbol."""
    q = select(MarketDataBatch).order_by(MarketDataBatch.fetched_at.desc()).limit(limit)
    if symbol:
        q = q.where(MarketDataBatch.symbol == symbol.upper())
    result = await session.execute(q)
    rows = result.scalars().all()
    return [
        {
            "batch_id": r.batch_id,
            "provider": r.provider,
            "symbol": r.symbol,
            "timeframe": r.timeframe,
            "start_date": r.start_date.isoformat() if r.start_date else None,
            "end_date": r.end_date.isoformat() if r.end_date else None,
            "row_count": r.row_count,
            "sha256": r.sha256,
            "status": r.status,
            "fetched_at": r.fetched_at.isoformat() if r.fetched_at else None,
        }
        for r in rows
    ]
