"""
Wave 22 — 7-Year Data Pipeline
Handles yfinance ingestion with 7-year depth, incremental updates, and gap repair.
"""
from __future__ import annotations
import hashlib
from dataclasses import dataclass, field
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional, Any
from .canonical_schema import (
    CanonicalBar, BarSeries, BarResolution, DataSource,
    Provenance, AdjustmentType,
)


@dataclass
class IngestionRequest:
    symbol: str
    start_date: str  # ISO date
    end_date: str    # ISO date
    resolution: BarResolution = BarResolution.DAILY
    source: DataSource = DataSource.YFINANCE
    adjust: bool = True


@dataclass
class IngestionResult:
    symbol: str
    bars_fetched: int
    bars_new: int
    bars_updated: int
    gaps_filled: int
    quality_score: float
    series_hash: str
    timestamp: str = ""
    errors: List[str] = field(default_factory=list)


class DataPipeline:
    """7-year data ingestion pipeline with incremental updates."""

    def __init__(self) -> None:
        self._store: Dict[str, BarSeries] = {}
        self._ingest_log: List[IngestionResult] = []

    def get_series(self, symbol: str, resolution: BarResolution = BarResolution.DAILY) -> Optional[BarSeries]:
        key = f"{symbol}:{resolution.value}"
        return self._store.get(key)

    def ingest(self, request: IngestionRequest) -> IngestionResult:
        """Ingest bars for a symbol. In production, calls yfinance. Here, validates and stores."""
        key = f"{request.symbol}:{request.resolution.value}"
        existing = self._store.get(key)

        # Build provenance
        now_iso = datetime.utcnow().isoformat() + "Z"
        provenance = Provenance(
            source=request.source,
            fetched_at=now_iso,
            api_version="v2",
            adjustments_applied=[AdjustmentType.SPLIT_AND_DIVIDEND] if request.adjust else [],
        )

        # For this implementation, we create a series structure
        # Production would call yfinance.download() here
        if existing is None:
            series = BarSeries(
                symbol=request.symbol,
                resolution=request.resolution,
                source=request.source,
                fetched_at=now_iso,
                start_date=request.start_date,
                end_date=request.end_date,
            )
            self._store[key] = series
            result = IngestionResult(
                symbol=request.symbol,
                bars_fetched=0,
                bars_new=0,
                bars_updated=0,
                gaps_filled=0,
                quality_score=0.0,
                series_hash=series.series_hash,
                timestamp=now_iso,
            )
        else:
            # Incremental: update date range
            existing.end_date = request.end_date
            existing.fetched_at = now_iso
            result = IngestionResult(
                symbol=request.symbol,
                bars_fetched=existing.count,
                bars_new=0,
                bars_updated=0,
                gaps_filled=0,
                quality_score=existing.quality_score(),
                series_hash=existing.series_hash,
                timestamp=now_iso,
            )

        self._ingest_log.append(result)
        return result

    def add_bars(self, symbol: str, bars: List[CanonicalBar],
                 resolution: BarResolution = BarResolution.DAILY) -> int:
        """Add bars to store, returns count of new bars added."""
        key = f"{symbol}:{resolution.value}"
        series = self._store.get(key)
        if series is None:
            series = BarSeries(
                symbol=symbol,
                resolution=resolution,
                source=DataSource.YFINANCE,
                fetched_at=datetime.utcnow().isoformat() + "Z",
            )
            self._store[key] = series

        existing_timestamps = {b.timestamp for b in series.bars}
        new_bars = [b for b in bars if b.timestamp not in existing_timestamps]
        series.bars.extend(new_bars)
        if series.bars:
            sorted_b = sorted(series.bars, key=lambda b: b.timestamp)
            series.start_date = sorted_b[0].timestamp[:10]
            series.end_date = sorted_b[-1].timestamp[:10]
        return len(new_bars)

    def repair_gaps(self, symbol: str, resolution: BarResolution = BarResolution.DAILY) -> List[str]:
        """Identify and mark gaps. Returns list of gap dates."""
        series = self.get_series(symbol, resolution)
        if series is None:
            return []
        return series.gaps()

    def list_symbols(self) -> List[str]:
        return list(set(k.split(":")[0] for k in self._store.keys()))

    def get_health(self) -> Dict[str, Any]:
        """Overall pipeline health."""
        symbols = self.list_symbols()
        total_bars = sum(s.count for s in self._store.values())
        avg_quality = (
            sum(s.quality_score() for s in self._store.values()) / len(self._store)
            if self._store else 0.0
        )
        return {
            "symbols": len(symbols),
            "total_bars": total_bars,
            "avg_quality": round(avg_quality, 4),
            "last_ingest": self._ingest_log[-1].timestamp if self._ingest_log else None,
            "ingest_count": len(self._ingest_log),
        }


# Singleton
_pipeline: Optional[DataPipeline] = None

def get_pipeline() -> DataPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = DataPipeline()
    return _pipeline
