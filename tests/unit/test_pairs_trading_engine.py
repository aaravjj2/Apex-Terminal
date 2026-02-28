"""
Comprehensive tests for PairsTradingEngine.
Tests: DistanceMethod, PairSpreadEngine, KalmanAdaptiveHedge,
PairSignalGenerator, PairsBacktester, PairRiskManager, and the orchestrator.
"""
import math
import random
import pytest

from phase1.services.pairs_trading_engine import (
    PairSignal, PairMethod, TradeStatus,
    PairConfig, PairTrade, PairPortfolio,
    DistanceMethod, PairSpreadEngine, KalmanAdaptiveHedge,
    PairSignalGenerator, PairsBacktester, PairRiskManager,
    PairsTradingEngine,
)


# ═══════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════

def _random_walk(n=500, start=100, seed=42):
    rng = random.Random(seed)
    prices = [start]
    for _ in range(n - 1):
        prices.append(prices[-1] * (1 + rng.gauss(0.0003, 0.015)))
    return prices


def _cointegrated_pair(n=500, seed=42):
    rng = random.Random(seed)
    x = _random_walk(n, 100, seed)
    noise = [rng.gauss(0, 2) for _ in range(n)]
    y = [1.5 * xi + 10 + ei for xi, ei in zip(x, noise)]
    return x, y


def _cfg(**kw):
    """Helper to create PairConfig with required symbol args."""
    kw.setdefault("symbol_a", "AAA")
    kw.setdefault("symbol_b", "BBB")
    return PairConfig(**kw)


# ═══════════════════════════════════════════════════════════════════════
# Enums
# ═══════════════════════════════════════════════════════════════════════

class TestEnums:
    def test_pair_signal(self):
        assert PairSignal.OPEN_LONG.value == "open_long"
        assert PairSignal.OPEN_SHORT.value == "open_short"
        assert PairSignal.CLOSE.value == "close"
        assert PairSignal.HOLD.value == "hold"
        assert PairSignal.STOP_LOSS.value == "stop_loss"
        assert len(PairSignal) == 5

    def test_pair_method(self):
        assert PairMethod.DISTANCE.value == "distance"
        assert PairMethod.COINTEGRATION.value == "cointegration"
        assert PairMethod.RATIO.value == "ratio"
        assert PairMethod.KALMAN.value == "kalman"
        assert len(PairMethod) == 4

    def test_trade_status(self):
        assert TradeStatus.OPEN.value == "open"
        assert TradeStatus.CLOSED.value == "closed"


# ═══════════════════════════════════════════════════════════════════════
# PairConfig
# ═══════════════════════════════════════════════════════════════════════

class TestPairConfig:
    def test_defaults(self):
        cfg = PairConfig(symbol_a="X", symbol_b="Y")
        assert cfg.entry_z == 2.0
        assert cfg.exit_z == 0.5
        assert cfg.stop_z == 4.0
        assert cfg.lookback == 60
        assert cfg.symbol_a == "X"
        assert cfg.symbol_b == "Y"

    def test_custom(self):
        cfg = PairConfig(symbol_a="A", symbol_b="B", entry_z=1.5, exit_z=0.3, stop_z=3.0, lookback=30)
        assert cfg.entry_z == 1.5
        assert cfg.lookback == 30

    def test_method_default(self):
        cfg = _cfg()
        assert cfg.method == PairMethod.COINTEGRATION

    def test_position_size_default(self):
        cfg = _cfg()
        assert cfg.position_size == 10000.0


# ═══════════════════════════════════════════════════════════════════════
# DistanceMethod
# ═══════════════════════════════════════════════════════════════════════

class TestDistanceMethod:
    def test_normalized_prices(self):
        prices = [100, 110, 105, 115, 120]
        normed = DistanceMethod.normalized_prices(prices)
        assert normed[0] == 1.0
        assert abs(normed[-1] - 1.20) < 0.001

    def test_normalized_empty(self):
        assert DistanceMethod.normalized_prices([]) == []

    def test_sum_squared_distance(self):
        a = [1.0, 1.1, 1.2, 1.3]
        b = [1.0, 1.05, 1.15, 1.25]
        d = DistanceMethod.sum_squared_distance(a, b)
        assert d > 0

    def test_distance_identical(self):
        a = [1.0, 1.1, 1.2]
        d = DistanceMethod.sum_squared_distance(a, a)
        assert d == 0.0

    def test_rank_by_distance(self):
        universe = {}
        for i in range(6):
            universe[f"S{i}"] = _random_walk(100, seed=i)
        # Add a closely-related pair
        x = _random_walk(100, seed=100)
        rng = random.Random(200)
        y = [xi * (1 + rng.gauss(0, 0.001)) for xi in x]
        universe["A"] = x
        universe["B"] = y
        ranked = DistanceMethod.rank_by_distance(universe, top_n=5)
        assert isinstance(ranked, list)
        assert len(ranked) <= 5

    def test_rank_empty(self):
        assert DistanceMethod.rank_by_distance({}, 5) == []

    def test_rank_single(self):
        assert DistanceMethod.rank_by_distance({"X": [1, 2, 3]}, 5) == []


# ═══════════════════════════════════════════════════════════════════════
# PairSpreadEngine
# ═══════════════════════════════════════════════════════════════════════

class TestPairSpreadEngine:
    def test_hedge_ratio(self):
        x, y = _cointegrated_pair(300)
        result = PairSpreadEngine.calculate_hedge_ratio(y, x)
        assert "beta" in result
        assert abs(result["beta"] - 1.5) < 0.15

    def test_compute_spread(self):
        a = [100, 105, 110, 115, 120]
        b = [50, 52, 55, 57, 60]
        spread = PairSpreadEngine.compute_spread(a, b, 2.0)
        assert len(spread) == 5
        assert spread[0] == 0.0  # 100 - 2*50

    def test_z_score_series(self):
        rng = random.Random(42)
        spread = [rng.gauss(0, 2) for _ in range(200)]
        zs = PairSpreadEngine.z_score_series(spread, 30)
        assert len(zs) == 200

    def test_half_life(self):
        # Generate mean-reverting spread
        rng = random.Random(42)
        spread = [0.0]
        theta = 0.1
        for _ in range(499):
            dx = theta * (0 - spread[-1]) + rng.gauss(0, 1)
            spread.append(spread[-1] + dx)
        hl = PairSpreadEngine.half_life(spread)
        assert hl > 0

    def test_half_life_random_walk(self):
        rng = random.Random(42)
        rw = [0.0]
        for _ in range(499):
            rw.append(rw[-1] + rng.gauss(0, 1))
        hl = PairSpreadEngine.half_life(rw)
        assert isinstance(hl, float)

    def test_empty_spread(self):
        zs = PairSpreadEngine.z_score_series([], 30)
        assert zs == []


# ═══════════════════════════════════════════════════════════════════════
# KalmanAdaptiveHedge
# ═══════════════════════════════════════════════════════════════════════

class TestKalmanAdaptiveHedge:
    def test_basic_filter(self):
        x, y = _cointegrated_pair(200)
        result = KalmanAdaptiveHedge.filter(y, x)
        assert len(result) == 200
        assert "hedge_ratio" in result[0]
        assert "spread" in result[0]

    def test_hedge_ratio_convergence(self):
        x, y = _cointegrated_pair(500)
        result = KalmanAdaptiveHedge.filter(y, x)
        last_hr = result[-1]["hedge_ratio"]
        assert abs(last_hr - 1.5) < 0.5

    def test_spread_has_std(self):
        x, y = _cointegrated_pair(200)
        result = KalmanAdaptiveHedge.filter(y, x)
        assert "spread_std" in result[-1]

    def test_short_series(self):
        result = KalmanAdaptiveHedge.filter([100, 110], [50, 55])
        assert len(result) == 2

    def test_empty(self):
        result = KalmanAdaptiveHedge.filter([], [])
        assert result == []


# ═══════════════════════════════════════════════════════════════════════
# PairSignalGenerator
# ═══════════════════════════════════════════════════════════════════════

class TestPairSignalGenerator:
    def test_open_long_signal(self):
        cfg = _cfg(entry_z=2.0, exit_z=0.5, stop_z=4.0)
        sig = PairSignalGenerator.generate(-2.5, cfg)
        assert sig == PairSignal.OPEN_LONG

    def test_open_short_signal(self):
        cfg = _cfg(entry_z=2.0)
        sig = PairSignalGenerator.generate(2.5, cfg)
        assert sig == PairSignal.OPEN_SHORT

    def test_close_with_position(self):
        cfg = _cfg(entry_z=2.0, exit_z=0.5)
        sig = PairSignalGenerator.generate(0.3, cfg, current_position="long")
        assert sig == PairSignal.CLOSE

    def test_hold_no_position(self):
        cfg = _cfg(entry_z=2.0, exit_z=0.5)
        sig = PairSignalGenerator.generate(0.3, cfg)
        assert sig == PairSignal.HOLD

    def test_hold_mid_range(self):
        cfg = _cfg(entry_z=2.0, exit_z=0.5)
        sig = PairSignalGenerator.generate(1.0, cfg)
        assert sig == PairSignal.HOLD

    def test_stop_loss_with_position(self):
        cfg = _cfg(entry_z=2.0, stop_z=4.0)
        sig = PairSignalGenerator.generate(4.5, cfg, current_position="short")
        assert sig == PairSignal.STOP_LOSS

    def test_generate_series(self):
        rng = random.Random(42)
        z_scores = [rng.gauss(0, 2) for _ in range(100)]
        cfg = _cfg()
        series = PairSignalGenerator.generate_series(z_scores, cfg)
        assert len(series) == 100
        assert all("signal" in s for s in series)

    @pytest.mark.parametrize("z", [-5, -3, -2, -1.5, -0.5, 0, 0.5, 1.5, 2, 3, 5])
    def test_all_z_ranges(self, z):
        cfg = _cfg()
        sig = PairSignalGenerator.generate(z, cfg)
        assert isinstance(sig, PairSignal)


# ═══════════════════════════════════════════════════════════════════════
# PairsBacktester
# ═══════════════════════════════════════════════════════════════════════

class TestPairsBacktester:
    def test_basic_backtest(self):
        x, y = _cointegrated_pair(300)
        cfg = _cfg(entry_z=2.0, exit_z=0.5, stop_z=4.0, lookback=60)
        result = PairsBacktester.backtest(y, x, cfg)
        assert "n_trades" in result
        assert "total_pnl" in result
        assert "win_rate" in result

    def test_backtest_deterministic(self):
        x, y = _cointegrated_pair(300, seed=42)
        cfg = _cfg()
        r1 = PairsBacktester.backtest(y, x, cfg)
        r2 = PairsBacktester.backtest(y, x, cfg)
        assert r1["total_pnl"] == r2["total_pnl"]

    def test_backtest_tight_entry(self):
        x, y = _cointegrated_pair(300)
        cfg = _cfg(entry_z=0.5)
        result = PairsBacktester.backtest(y, x, cfg)
        assert result["n_trades"] > 0

    def test_backtest_wide_entry(self):
        x, y = _cointegrated_pair(300)
        cfg = _cfg(entry_z=5.0)
        result = PairsBacktester.backtest(y, x, cfg)
        assert isinstance(result, dict)

    def test_backtest_short_series(self):
        result = PairsBacktester.backtest([100]*10, [50]*10, _cfg())
        assert isinstance(result, dict)

    def test_backtest_has_trades_list(self):
        x, y = _cointegrated_pair(300)
        result = PairsBacktester.backtest(y, x, _cfg())
        assert "trades" in result
        if result["n_trades"] > 0:
            trade = result["trades"][0]
            assert "entry_z" in trade or "pnl" in trade

    def test_backtest_returns_keys(self):
        x, y = _cointegrated_pair(300)
        result = PairsBacktester.backtest(y, x, _cfg())
        for key in ["n_trades", "wins", "losses", "win_rate", "total_pnl", "avg_pnl"]:
            assert key in result


# ═══════════════════════════════════════════════════════════════════════
# PairRiskManager
# ═══════════════════════════════════════════════════════════════════════

class TestPairRiskManager:
    def test_position_size(self):
        result = PairRiskManager.position_size(
            capital=1_000_000,
            spread_volatility=0.02,
            target_risk_pct=0.01,
        )
        assert result["notional"] > 0
        assert result["risk_per_unit"] > 0

    def test_conservative_sizing(self):
        r_low = PairRiskManager.position_size(1_000_000, 0.02, 0.005)
        r_high = PairRiskManager.position_size(1_000_000, 0.02, 0.02)
        assert r_high["notional"] > r_low["notional"]

    def test_high_vol_smaller_size(self):
        r_low_vol = PairRiskManager.position_size(1_000_000, 0.01, 0.01)
        r_high_vol = PairRiskManager.position_size(1_000_000, 0.05, 0.01)
        assert r_high_vol["notional"] < r_low_vol["notional"]

    def test_zero_vol(self):
        result = PairRiskManager.position_size(1_000_000, 0.0, 0.01)
        assert isinstance(result, dict)

    def test_return_keys(self):
        result = PairRiskManager.position_size(1_000_000, 0.02, 0.01)
        for key in ["notional", "risk_per_unit", "risk_budget", "risk_pct"]:
            assert key in result

    @pytest.mark.parametrize("capital", [100_000, 500_000, 1_000_000, 10_000_000])
    def test_various_capitals(self, capital):
        result = PairRiskManager.position_size(capital, 0.02, 0.01)
        assert result["notional"] > 0


# ═══════════════════════════════════════════════════════════════════════
# PairsTradingEngine Orchestrator
# ═══════════════════════════════════════════════════════════════════════

class TestPairsTradingEngine:
    @pytest.fixture
    def engine(self):
        return PairsTradingEngine()

    def test_analyze_pair(self, engine):
        x, y = _cointegrated_pair(300)
        result = engine.analyze_pair(y, x)
        assert "hedge_ratio" in result
        assert "half_life" in result

    def test_find_pairs(self, engine):
        universe = {}
        for i in range(6):
            universe[f"S{i}"] = _random_walk(200, seed=i)
        result = engine.find_pairs(universe)
        assert isinstance(result, list)

    def test_backtest(self, engine):
        x, y = _cointegrated_pair(300)
        result = engine.backtest(y, x)
        assert "n_trades" in result
        assert "total_pnl" in result

    def test_backtest_with_config(self, engine):
        x, y = _cointegrated_pair(300)
        cfg = _cfg(entry_z=1.5, exit_z=0.3)
        result = engine.backtest(y, x, config=cfg)
        assert isinstance(result, dict)

    def test_capabilities(self, engine):
        caps = engine.capabilities()
        assert caps["engine"] == "PairsTradingEngine"
        assert len(caps["features"]) > 5


# ═══════════════════════════════════════════════════════════════════════
# Parametric Tests
# ═══════════════════════════════════════════════════════════════════════

class TestParametric:
    @pytest.mark.parametrize("seed", range(10))
    def test_hedge_ratio_consistency(self, seed):
        x, y = _cointegrated_pair(300, seed=seed)
        result = PairSpreadEngine.calculate_hedge_ratio(y, x)
        assert 1.0 < result["beta"] < 2.0

    @pytest.mark.parametrize("lookback", [20, 30, 60, 90])
    def test_z_score_lookbacks(self, lookback):
        rng = random.Random(42)
        spread = [rng.gauss(0, 2) for _ in range(200)]
        zs = PairSpreadEngine.z_score_series(spread, lookback)
        assert len(zs) == 200

    @pytest.mark.parametrize("entry_z", [1.0, 1.5, 2.0, 2.5, 3.0])
    def test_entry_thresholds(self, entry_z):
        x, y = _cointegrated_pair(300)
        cfg = _cfg(entry_z=entry_z)
        result = PairsBacktester.backtest(y, x, cfg)
        assert isinstance(result["n_trades"], int)


# ═══════════════════════════════════════════════════════════════════════
# Stress Tests
# ═══════════════════════════════════════════════════════════════════════

class TestStress:
    def test_long_series(self):
        x, y = _cointegrated_pair(5000, seed=42)
        result = PairsBacktester.backtest(y, x, _cfg())
        assert isinstance(result["n_trades"], int)

    def test_many_pairs_ranking(self):
        universe = {}
        for i in range(20):
            universe[f"S{i}"] = _random_walk(200, seed=i)
        ranked = DistanceMethod.rank_by_distance(universe, top_n=10)
        assert len(ranked) <= 10

    def test_kalman_long_series(self):
        x, y = _cointegrated_pair(2000, seed=42)
        result = KalmanAdaptiveHedge.filter(y, x)
        assert len(result) == 2000

    def test_signal_series_long(self):
        rng = random.Random(42)
        z_scores = [rng.gauss(0, 2.5) for _ in range(5000)]
        cfg = _cfg()
        series = PairSignalGenerator.generate_series(z_scores, cfg)
        assert len(series) == 5000
