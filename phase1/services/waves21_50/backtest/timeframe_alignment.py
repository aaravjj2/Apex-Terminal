"""
Wave 25 — Multi-Timeframe Alignment & Resampler
Resample bars between timeframes with proper alignment.
"""
from __future__ import annotations
from typing import List, Dict, Optional
from .canonical_schema import CanonicalBar, BarSeries, BarResolution


# Map resolutions to minutes for comparison
_RESOLUTION_MINUTES: Dict[str, int] = {
    "1m": 1, "5m": 5, "15m": 15, "30m": 30,
    "1h": 60, "4h": 240, "1d": 1440, "1w": 10080, "1M": 43200,
}


def resolution_minutes(res: BarResolution) -> int:
    return _RESOLUTION_MINUTES.get(res.value, 1440)


def can_resample(source: BarResolution, target: BarResolution) -> bool:
    """Only upsample (aggregate smaller into larger)."""
    return resolution_minutes(source) < resolution_minutes(target)


def _group_key(timestamp: str, target: BarResolution) -> str:
    """Group bars by target resolution bucket."""
    dt_str = timestamp[:10]  # YYYY-MM-DD
    if target in (BarResolution.DAILY, BarResolution.WEEKLY, BarResolution.MONTHLY):
        if target == BarResolution.WEEKLY:
            from datetime import date
            d = date.fromisoformat(dt_str)
            # ISO week start (Monday)
            start = d - __import__('datetime').timedelta(days=d.weekday())
            return start.isoformat()
        elif target == BarResolution.MONTHLY:
            return dt_str[:7] + "-01"
        else:
            return dt_str
    return timestamp[:16]  # Include time for intraday


def resample(bars: List[CanonicalBar], target: BarResolution) -> List[CanonicalBar]:
    """Aggregate bars into a coarser resolution."""
    if not bars:
        return []

    # Group by bucket
    groups: Dict[str, List[CanonicalBar]] = {}
    for bar in sorted(bars, key=lambda b: b.timestamp):
        key = _group_key(bar.timestamp, target)
        if key not in groups:
            groups[key] = []
        groups[key].append(bar)

    # Aggregate each group into one bar
    resampled: List[CanonicalBar] = []
    for key, group in sorted(groups.items()):
        if not group:
            continue
        resampled.append(CanonicalBar(
            symbol=group[0].symbol,
            timestamp=key,
            resolution=target,
            open=group[0].open,
            high=max(b.high for b in group),
            low=min(b.low for b in group),
            close=group[-1].close,
            volume=sum(b.volume for b in group),
            adj_close=group[-1].adj_close,
            vwap=None,
            trade_count=sum(b.trade_count or 0 for b in group) or None,
            provenance=group[0].provenance,
        ))

    return resampled


def align_series(series_list: List[BarSeries], target: BarResolution) -> List[BarSeries]:
    """Align multiple bar series to the same resolution and date range."""
    if not series_list:
        return []

    # Find common date range
    all_dates = set()
    for s in series_list:
        for b in s.bars:
            all_dates.add(b.timestamp[:10])

    if not all_dates:
        return series_list

    common_start = max(min(b.timestamp[:10] for b in s.bars) for s in series_list if s.bars)
    common_end = min(max(b.timestamp[:10] for b in s.bars) for s in series_list if s.bars)

    aligned: List[BarSeries] = []
    for s in series_list:
        filtered = [b for b in s.bars if common_start <= b.timestamp[:10] <= common_end]
        if resolution_minutes(s.resolution) < resolution_minutes(target):
            resampled_bars = resample(filtered, target)
        else:
            resampled_bars = filtered

        aligned.append(BarSeries(
            symbol=s.symbol,
            resolution=target,
            bars=resampled_bars,
            source=s.source,
            fetched_at=s.fetched_at,
            start_date=common_start,
            end_date=common_end,
        ))

    return aligned
