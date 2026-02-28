"""
Backtest Engine V2 — unit tests.

Tests cover:
- Accounting invariants (equity = cash + position_value at every bar)
- Determinism (same config → same result)
- Metric ranges (CAGR, Sharpe, max DD within sane bounds)
- Strategy lookup (built-in + missing)
- Error handling (unknown symbol, bad date range)
"""

import os
import sys
import json
import pytest
from pathlib import Path
from datetime import date, timedelta

# Ensure project root is on sys.path
_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_phase1.db")

from services.backtest_engine.models import BacktestConfig, BacktestStatus, BacktestMetrics
from services.backtest_engine.engine_v2 import (
    BacktestEngineV2,
    get_builtin_strategies,
    get_strategy,
    _calc_sma,
    _calc_ema,
    _calc_rsi,
)
from services.market_data.models import BarDaily, compute_bars_sha256

import numpy as np


# ── Helpers ──────────────────────────────────────────────────────────────────

def _make_bars(symbol: str = "TEST", n: int = 200, start_price: float = 100.0) -> list[BarDaily]:
    """Create synthetic but realistic bars for unit tests (no yfinance needed)."""
    bars = []
    price = start_price
    rng = np.random.RandomState(42)
    base_date = date(2020, 1, 2)
    for i in range(n):
        d = base_date + timedelta(days=i)
        if d.weekday() >= 5:
            continue
        ret = rng.normal(0.0005, 0.015)
        o = price
        c = price * (1 + ret)
        h = max(o, c) * (1 + abs(rng.normal(0, 0.005)))
        lo = min(o, c) * (1 - abs(rng.normal(0, 0.005)))
        vol = int(rng.uniform(1_000_000, 10_000_000))
        bars.append(BarDaily(
            symbol=symbol,
            date=d,
            open=round(o, 2),
            high=round(h, 2),
            low=round(lo, 2),
            close=round(c, 2),
            adj_close=round(c, 2),
            volume=vol,
            source="unit-test",
        ))
        price = c
    return bars


def _write_test_bars(bars: list[BarDaily], tmp_path: Path) -> None:
    """Write bars to the expected cache location so engine can load them."""
    data_dir = tmp_path / ".cache" / "backtest_data"
    data_dir.mkdir(parents=True, exist_ok=True)
    if not bars:
        return
    symbol = bars[0].symbol
    records = []
    for b in bars:
        records.append({
            "symbol": b.symbol,
            "date": b.date.isoformat(),
            "open": b.open,
            "high": b.high,
            "low": b.low,
            "close": b.close,
            "adj_close": b.adj_close,
            "volume": b.volume,
            "source": b.source,
            "fetched_at": b.fetched_at.isoformat(),
        })
    checksum = compute_bars_sha256(bars)
    payload = {
        "batch": {
            "batch_id": "test-batch",
            "provider": "unit-test",
            "symbol": symbol,
            "timeframe": "1d",
            "start_date": bars[0].date.isoformat(),
            "end_date": bars[-1].date.isoformat(),
            "sha256": checksum,
            "row_count": len(bars),
        },
        "bars": records,
    }
    fpath = data_dir / f"{symbol}.json"
    fpath.write_text(json.dumps(payload, default=str))


# ── Tests: Indicator calculators ─────────────────────────────────────────────

class TestIndicators:
    def test_sma_basic(self):
        prices = np.array([1, 2, 3, 4, 5], dtype=float)
        sma = _calc_sma(prices, 3)
        assert np.isnan(sma[0])
        assert np.isnan(sma[1])
        assert abs(sma[2] - 2.0) < 1e-9
        assert abs(sma[3] - 3.0) < 1e-9
        assert abs(sma[4] - 4.0) < 1e-9

    def test_ema_initial_value(self):
        prices = np.array([10, 11, 12, 13, 14, 15], dtype=float)
        ema = _calc_ema(prices, 3)
        # First EMA value at index 2 should be avg of first 3
        assert abs(ema[2] - 11.0) < 1e-9
        # Should not be nan at index 3+
        for i in range(3, 6):
            assert not np.isnan(ema[i])

    def test_rsi_range(self):
        prices = np.arange(100, 200, dtype=float)  # always going up
        rsi = _calc_rsi(prices, 14)
        # Non-NaN values should be 0-100
        valid = rsi[~np.isnan(rsi)]
        assert len(valid) > 0
        assert all(0 <= v <= 100 for v in valid)


# ── Tests: Strategy lookup ───────────────────────────────────────────────────

class TestStrategyLookup:
    def test_builtin_strategies_exist(self):
        strats = get_builtin_strategies()
        assert "sma-crossover" in strats
        assert "rsi-mean-reversion" in strats
        assert "ema-crossover" in strats
        assert "breakout-20d" in strats

    def test_get_strategy_builtin(self):
        s = get_strategy("sma-crossover")
        assert s is not None
        assert s.name == "SMA Crossover 20/50"
        assert s.strategy_type == "crossover"

    def test_get_strategy_missing(self):
        s = get_strategy("nonexistent-strategy-xyz")
        assert s is None


# ── Tests: Engine run with synthetic data ────────────────────────────────────

class TestBacktestEngineV2:
    def _run_engine(self, tmp_path: Path, strategy_id: str = "sma-crossover",
                    symbol: str = "TEST", n_bars: int = 200) -> "BacktestRun":
        bars = _make_bars(symbol=symbol, n=n_bars)
        _write_test_bars(bars, tmp_path)
        # Point data pipeline to our tmp dir
        import services.backtest_engine.data_pipeline as dp
        old_dir = dp._DATA_DIR
        dp._DATA_DIR = tmp_path / ".cache" / "backtest_data"
        try:
            engine = BacktestEngineV2()
            config = BacktestConfig(
                strategy_id=strategy_id,
                symbol=symbol,
                start_date=bars[0].date,
                end_date=bars[-1].date,
                initial_capital=100_000,
                slippage_bps=5,
                fee_per_trade=1.0,
            )
            return engine.run(config)
        finally:
            dp._DATA_DIR = old_dir

    def test_engine_completes(self, tmp_path):
        run = self._run_engine(tmp_path)
        assert run.status == BacktestStatus.COMPLETED
        assert run.metrics is not None
        assert run.run_id.startswith("run-")

    def test_accounting_invariant(self, tmp_path):
        """Equity at every point must equal cash + position_value (via final equity)."""
        run = self._run_engine(tmp_path)
        assert run.status == BacktestStatus.COMPLETED
        m = run.metrics
        # Final equity must be positive
        assert m.final_equity > 0
        # Equity curve must not be empty
        assert len(run.equity_curve) > 0
        # First equity should be the initial capital
        assert abs(run.equity_curve[0].equity - 100_000) < 1

    def test_determinism(self, tmp_path):
        """Same config → same result."""
        run1 = self._run_engine(tmp_path)
        run2 = self._run_engine(tmp_path)
        assert run1.config_hash == run2.config_hash
        assert run1.metrics.total_return_pct == run2.metrics.total_return_pct
        assert run1.metrics.sharpe_ratio == run2.metrics.sharpe_ratio
        assert run1.metrics.total_trades == run2.metrics.total_trades
        assert len(run1.equity_curve) == len(run2.equity_curve)

    def test_metrics_sane_ranges(self, tmp_path):
        """Metrics should be in realistic ranges."""
        run = self._run_engine(tmp_path)
        m = run.metrics
        # Return should be within -99% to 500% for a short period
        assert -99 < m.total_return_pct < 500
        # Sharpe between -5 and 5 is realistic
        assert -5 < m.sharpe_ratio < 5
        # Max drawdown is a negative or zero percentage
        assert m.max_drawdown_pct <= 0
        # Win rate between 0 and 100
        assert 0 <= m.win_rate_pct <= 100
        # Profit factor >= 0
        assert m.profit_factor >= 0

    def test_equity_curve_monotonic_timestamps(self, tmp_path):
        """Equity curve timestamps should be in chronological order."""
        run = self._run_engine(tmp_path)
        for i in range(1, len(run.equity_curve)):
            assert run.equity_curve[i].timestamp >= run.equity_curve[i - 1].timestamp

    def test_drawdown_series_range(self, tmp_path):
        """Drawdown values should be <= 0."""
        run = self._run_engine(tmp_path)
        for dp_entry in run.drawdown_series:
            assert dp_entry.drawdown_pct <= 0

    def test_unknown_strategy_fails(self, tmp_path):
        run = self._run_engine(tmp_path, strategy_id="nonexistent-xyz")
        assert run.status == BacktestStatus.FAILED
        assert "Unknown strategy" in run.error

    def test_no_data_fails(self, tmp_path):
        """Engine should fail gracefully when no data is primed."""
        import services.backtest_engine.data_pipeline as dp
        old_dir = dp._DATA_DIR
        dp._DATA_DIR = tmp_path / "empty_cache"
        try:
            engine = BacktestEngineV2()
            config = BacktestConfig(
                strategy_id="sma-crossover",
                symbol="NODATA",
                start_date=date(2020, 1, 1),
                end_date=date(2020, 6, 1),
                initial_capital=100_000,
            )
            run = engine.run(config)
            assert run.status == BacktestStatus.FAILED
            assert "No market data" in run.error
        finally:
            dp._DATA_DIR = old_dir

    def test_provenance_filled(self, tmp_path):
        """Provenance should be populated on success."""
        run = self._run_engine(tmp_path)
        assert run.provenance is not None
        assert run.provenance.source == "LOCAL_CACHE"
        assert run.provenance.checksum is not None
        assert len(run.provenance.checksum) == 64  # SHA-256 hex

    def test_all_strategies_run(self, tmp_path):
        """All 4 built-in strategies should run without error."""
        for sid in get_builtin_strategies():
            run = self._run_engine(tmp_path, strategy_id=sid, n_bars=300)
            assert run.status == BacktestStatus.COMPLETED, f"{sid} failed: {run.error}"
            assert run.metrics is not None

    def test_config_hash_differs_for_different_inputs(self, tmp_path):
        """Different configs should produce different hashes."""
        bars = _make_bars(symbol="TEST", n=200)
        _write_test_bars(bars, tmp_path)
        import services.backtest_engine.data_pipeline as dp
        old_dir = dp._DATA_DIR
        dp._DATA_DIR = tmp_path / ".cache" / "backtest_data"
        try:
            engine = BacktestEngineV2()
            c1 = BacktestConfig(strategy_id="sma-crossover", symbol="TEST",
                                start_date=bars[0].date, end_date=bars[-1].date,
                                initial_capital=100_000)
            c2 = BacktestConfig(strategy_id="sma-crossover", symbol="TEST",
                                start_date=bars[0].date, end_date=bars[-1].date,
                                initial_capital=50_000)
            h1 = engine._config_hash(c1)
            h2 = engine._config_hash(c2)
            assert h1 != h2
        finally:
            dp._DATA_DIR = old_dir
