"""
Data Pipeline — unit tests.

Tests cover:
- store_bars / load_bars round-trip
- Checksum verification
- Symbol health computation
- Date range filtering
- Empty data handling
"""

import os
import sys
import json
import pytest
from pathlib import Path
from datetime import date, timedelta, datetime

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_phase1.db")

import numpy as np
from services.market_data.models import BarDaily, compute_bars_sha256, BatchRecord
from services.backtest_engine import data_pipeline as dp


# ── Helpers ──────────────────────────────────────────────────────────────────

def _make_bars(symbol: str = "TEST", n: int = 100) -> list[BarDaily]:
    bars = []
    price = 100.0
    rng = np.random.RandomState(99)
    base = date(2020, 1, 2)
    for i in range(n):
        d = base + timedelta(days=i)
        if d.weekday() >= 5:
            continue
        ret = rng.normal(0, 0.01)
        c = price * (1 + ret)
        bars.append(BarDaily(
            symbol=symbol, date=d,
            open=round(price, 2), high=round(max(price, c) * 1.005, 2),
            low=round(min(price, c) * 0.995, 2), close=round(c, 2),
            adj_close=round(c, 2), volume=int(rng.uniform(1e6, 5e6)),
            source="unit-test",
        ))
        price = c
    return bars


# ── Tests ────────────────────────────────────────────────────────────────────

class TestDataPipeline:
    def setup_method(self):
        self._orig_dir = dp._DATA_DIR

    def teardown_method(self):
        dp._DATA_DIR = self._orig_dir

    def test_store_and_load_roundtrip(self, tmp_path):
        dp._DATA_DIR = tmp_path
        bars = _make_bars("ROUND")
        batch = dp.store_bars(bars)
        assert batch.row_count == len(bars)
        assert batch.sha256 == compute_bars_sha256(bars)

        loaded, batch2 = dp.load_bars("ROUND")
        assert len(loaded) == len(bars)
        assert batch2 is not None
        assert batch2.sha256 == batch.sha256

    def test_load_nonexistent_returns_empty(self, tmp_path):
        dp._DATA_DIR = tmp_path
        loaded, batch = dp.load_bars("NOEXIST")
        assert loaded == []
        assert batch is None

    def test_date_range_filtering(self, tmp_path):
        dp._DATA_DIR = tmp_path
        bars = _make_bars("FILT", n=200)
        dp.store_bars(bars)

        # Load only a sub-range
        mid = bars[len(bars) // 2].date
        loaded, _ = dp.load_bars("FILT", start=mid)
        assert all(b.date >= mid for b in loaded)
        assert len(loaded) < len(bars)

    def test_checksum_verify(self, tmp_path):
        dp._DATA_DIR = tmp_path
        bars = _make_bars("CHK")
        dp.store_bars(bars)
        assert dp.verify_checksum("CHK") is True

    def test_checksum_detect_corruption(self, tmp_path):
        dp._DATA_DIR = tmp_path
        bars = _make_bars("COR")
        dp.store_bars(bars)

        # Corrupt the file by modifying a bar
        fpath = tmp_path / "COR.json"
        data = json.loads(fpath.read_text())
        data["bars"][0]["close"] = 999999.99
        fpath.write_text(json.dumps(data, default=str))

        assert dp.verify_checksum("COR") is False

    def test_symbol_health(self, tmp_path):
        dp._DATA_DIR = tmp_path
        bars = _make_bars("HLTH", n=100)
        dp.store_bars(bars)

        health = dp.get_symbol_health("HLTH")
        assert health.symbol == "HLTH"
        assert health.total_rows == len(bars)
        assert health.status in ("ok", "warning")
        assert health.earliest_date == bars[0].date
        assert health.latest_date == bars[-1].date

    def test_symbol_health_not_primed(self, tmp_path):
        dp._DATA_DIR = tmp_path
        health = dp.get_symbol_health("NOPE")
        assert health.total_rows == 0
        assert health.status in ("unknown", "error")  # Not primed — could be either

    def test_sha256_deterministic(self):
        bars = _make_bars("DET", n=50)
        h1 = compute_bars_sha256(bars)
        h2 = compute_bars_sha256(bars)
        assert h1 == h2
        assert len(h1) == 64

    def test_store_empty_list(self, tmp_path):
        dp._DATA_DIR = tmp_path
        # store_bars with empty list should not crash but may raise
        try:
            batch = dp.store_bars([])
            assert batch.row_count == 0
        except (ValueError, IndexError):
            pass  # Acceptable to reject empty
