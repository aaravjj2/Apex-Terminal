"""
Recorded-real cache for tests.

Loads bars from the local_cache/market/ directory (populated by
prime_market_cache.py) to supply REAL historical bars to tests.
NO synthetic bar generation. If cache is empty, tests skip gracefully.

Usage in tests:
    from tests.helpers.recorded_real_cache import get_real_bars, require_real_bars

    bars = get_real_bars("AAPL")           # returns list[BarData] or []
    bars = require_real_bars("AAPL")       # skips test if no cache
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import pytest

# Allow import from both phase1/tests and project root
_WORKSPACE = Path(__file__).resolve().parents[3]  # up from phase1/tests/helpers/
_CACHE_DIR = _WORKSPACE / "local_cache" / "market"


def get_cache_dir() -> Path:
    """Return the market cache directory."""
    return _CACHE_DIR


def get_real_bars(symbol: str) -> list:
    """
    Load real bars for a symbol from the local cache.
    Returns list of BarData-compatible dicts.
    Returns empty list if cache not primed.
    """
    from phase1.services.market_data.providers.types import BarData

    sym_file = _CACHE_DIR / f"{symbol.upper()}_daily.jsonl"
    if not sym_file.exists():
        return []

    bars: List[BarData] = []
    with open(sym_file) as f:
        for line in f:
            d = json.loads(line.strip())
            bars.append(BarData(
                timestamp=datetime.fromisoformat(d["timestamp"]),
                open=d["open"],
                high=d["high"],
                low=d["low"],
                close=d["close"],
                volume=int(d["volume"]),
            ))
    return bars


def require_real_bars(symbol: str, min_bars: int = 10) -> list:
    """
    Load real bars or skip the test if the cache is not primed.
    """
    bars = get_real_bars(symbol)
    if len(bars) < min_bars:
        pytest.skip(f"Real cache not primed for {symbol} (need {min_bars} bars, got {len(bars)})")
    return bars


def get_manifest() -> Optional[dict]:
    """Load the cache manifest.json if available."""
    manifest_path = _CACHE_DIR / "manifest.json"
    if not manifest_path.exists():
        return None
    with open(manifest_path) as f:
        return json.load(f)


def cached_symbols() -> List[str]:
    """Return list of symbols available in the cache."""
    manifest = get_manifest()
    if manifest is None:
        return []
    return list(manifest.get("symbols", {}).keys())
