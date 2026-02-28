"""
Comprehensive tests for StatisticalArbitrageEngine.
Tests: CorrelationCalculator, HedgeRatioEstimator, SpreadCalculator,
CointegrationTest, OrnsteinUhlenbeckEstimator, MeanReversionDetector,
StatArbSignalGenerator, PairsRanker, and the orchestrator.
"""
import math
import random
import pytest

from phase1.services.statistical_arbitrage_engine import (
    SpreadSignal, MeanReversionStrength, PairStatus,
    PairCandidate, SpreadState, OUParameters,
    CorrelationCalculator, HedgeRatioEstimator, SpreadCalculator,
    CointegrationTest, OrnsteinUhlenbeckEstimator, MeanReversionDetector,
    StatArbSignalGenerator, PairsRanker, StatisticalArbitrageEngine,
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


def _gen_returns(n=252, seed=42):
    rng = random.Random(seed)
    return [rng.gauss(0.0003, 0.015) for _ in range(n)]


# ═══════════════════════════════════════════════════════════════════════
# Enums
# ═══════════════════════════════════════════════════════════════════════

class TestEnums:
    def test_spread_signals(self):
        assert SpreadSignal.STRONG_BUY.value == "strong_buy"
        assert SpreadSignal.BUY.value == "buy"
        assert SpreadSignal.HOLD.value == "hold"
        assert SpreadSignal.SELL.value == "sell"
        assert SpreadSignal.STRONG_SELL.value == "strong_sell"
        assert SpreadSignal.STOP_LOSS.value == "stop_loss"
        assert len(SpreadSignal) == 6

    def test_mean_reversion_strength(self):
        assert MeanReversionStrength.STRONG.value == "strong"
        assert MeanReversionStrength.NONE.value == "none"
        assert MeanReversionStrength.WEAK.value == "weak"
        assert MeanReversionStrength.MODERATE.value == "moderate"
        assert MeanReversionStrength.VERY_STRONG.value == "very_strong"

    def test_pair_status(self):
        assert PairStatus.ACTIVE.value == "active"
        assert PairStatus.MONITORING.value == "monitoring"
        assert PairStatus.DIVERGED.value == "diverged"
        assert PairStatus.CONVERGED.value == "converged"


# ═══════════════════════════════════════════════════════════════════════
# CorrelationCalculator
# ═══════════════════════════════════════════════════════════════════════

class TestCorrelationCalculator:
    def test_pearson_perfect(self):
        x = list(range(50))
        y = [2 * xi + 3 for xi in x]
        assert abs(CorrelationCalculator.pearson(x, y) - 1.0) < 0.001

    def test_pearson_negative(self):
        x = list(range(50))
        y = [-xi for xi in x]
        assert abs(CorrelationCalculator.pearson(x, y) + 1.0) < 0.001

    def test_pearson_random_low(self):
        x = _gen_returns(500, seed=1)
        y = _gen_returns(500, seed=99)
        assert abs(CorrelationCalculator.pearson(x, y)) < 0.15

    def test_spearman_monotone(self):
        x = list(range(50))
        y = [xi**2 for xi in x]  # monotonically increasing
        assert CorrelationCalculator.spearman(x, y) > 0.9

    def test_spearman_perfect(self):
        x = list(range(50))
        y = list(range(50))
        assert abs(CorrelationCalculator.spearman(x, y) - 1.0) < 0.001

    def test_rolling_correlation(self):
        x = _gen_returns(200, seed=1)
        y = _gen_returns(200, seed=2)
        rc = CorrelationCalculator.rolling_correlation(x, y, 30)
        assert len(rc) == 171
        for c in rc:
            assert -1 <= c <= 1

    def test_rolling_short(self):
        assert CorrelationCalculator.rolling_correlation([1], [1], 30) == []

    def test_empty(self):
        assert CorrelationCalculator.pearson([], []) == 0.0
        assert CorrelationCalculator.spearman([], []) == 0.0


# ═══════════════════════════════════════════════════════════════════════
# HedgeRatioEstimator
# ═══════════════════════════════════════════════════════════════════════

class TestHedgeRatioEstimator:
    def test_ols_hedge_ratio(self):
        x, y = _cointegrated_pair(500)
        result = HedgeRatioEstimator.ols_hedge_ratio(y, x)
        assert "beta" in result
        assert "alpha" in result
        assert "r_squared" in result
        assert abs(result["beta"] - 1.5) < 0.1  # should be close to 1.5

    def test_ols_r_squared_high(self):
        x, y = _cointegrated_pair(500)
        result = HedgeRatioEstimator.ols_hedge_ratio(y, x)
        assert result["r_squared"] > 0.90

    def test_tls_hedge_ratio(self):
        x, y = _cointegrated_pair(500)
        result = HedgeRatioEstimator.total_least_squares(y, x)
        assert "beta" in result
        assert abs(result["beta"] - 1.5) < 0.15

    def test_ols_empty(self):
        result = HedgeRatioEstimator.ols_hedge_ratio([], [])
        assert result["beta"] == 0.0

    def test_ols_mismatched(self):
        result = HedgeRatioEstimator.ols_hedge_ratio([1, 2], [1])
        assert result["beta"] == 0.0


# ═══════════════════════════════════════════════════════════════════════
# SpreadCalculator
# ═══════════════════════════════════════════════════════════════════════

class TestSpreadCalculator:
    def test_price_spread(self):
        a = [100, 101, 102, 103]
        b = [50, 50.5, 51, 51.5]
        spread = SpreadCalculator.price_spread(a, b, 2.0)
        assert len(spread) == 4
        assert spread[0] == 0.0  # 100 - 2*50

    def test_log_spread(self):
        a = [100, 110, 120]
        b = [50, 55, 60]
        spread = SpreadCalculator.log_spread(a, b)
        assert len(spread) == 3

    def test_ratio_spread(self):
        a = [100, 110, 120]
        b = [50, 55, 60]
        spread = SpreadCalculator.ratio_spread(a, b)
        assert all(abs(s - 2.0) < 0.01 for s in spread)

    def test_z_score(self):
        spread = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
                  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        zs = SpreadCalculator.z_score(spread, lookback=10)
        assert len(zs) == len(spread)

    def test_percentile_rank(self):
        history = list(range(100))
        rank = SpreadCalculator.percentile_rank(50, history)
        assert abs(rank - 50.0) < 2.0

    def test_z_score_constant(self):
        spread = [5.0] * 50
        zs = SpreadCalculator.z_score(spread, lookback=20)
        # constant spread => z-score should be 0 or NaN
        for z in zs[20:]:
            assert abs(z) < 0.001 or z == 0.0


# ═══════════════════════════════════════════════════════════════════════
# CointegrationTest
# ═══════════════════════════════════════════════════════════════════════

class TestCointegrationTest:
    def test_cointegrated_pair(self):
        x, y = _cointegrated_pair(500)
        result = CointegrationTest.test(y, x)
        assert "cointegrated" in result
        assert "hedge_ratio" in result
        assert "half_life" in result
        assert abs(result["hedge_ratio"] - 1.5) < 0.15

    def test_non_cointegrated(self):
        x = _random_walk(500, seed=1)
        y = _random_walk(500, seed=99)
        result = CointegrationTest.test(y, x)
        assert "cointegrated" in result

    def test_insufficient_data(self):
        result = CointegrationTest.test([1, 2], [3, 4])
        assert result["cointegrated"] is False

    def test_result_keys(self):
        x, y = _cointegrated_pair(300)
        result = CointegrationTest.test(y, x)
        for key in ["cointegrated", "hedge_ratio", "half_life", "residual_adf_stat"]:
            assert key in result


# ═══════════════════════════════════════════════════════════════════════
# OrnsteinUhlenbeckEstimator
# ═══════════════════════════════════════════════════════════════════════

class TestOUEstimator:
    def test_fit_mean_reverting(self):
        rng = random.Random(42)
        mu, theta, sigma = 0.0, 0.5, 1.0
        x = [0.0]
        for _ in range(499):
            dx = theta * (mu - x[-1]) + sigma * rng.gauss(0, 1)
            x.append(x[-1] + dx)
        params = OrnsteinUhlenbeckEstimator.fit(x)
        assert isinstance(params, OUParameters)
        assert params.theta > 0  # mean-reverting

    def test_fit_random_walk(self):
        rng = random.Random(42)
        x = [0.0]
        for _ in range(499):
            x.append(x[-1] + rng.gauss(0, 1))
        params = OrnsteinUhlenbeckEstimator.fit(x)
        assert isinstance(params.theta, float)

    def test_empty(self):
        params = OrnsteinUhlenbeckEstimator.fit([])
        assert params.theta == 0.0


# ═══════════════════════════════════════════════════════════════════════
# MeanReversionDetector
# ═══════════════════════════════════════════════════════════════════════

class TestMeanReversionDetector:
    def test_mean_reverting_series(self):
        rng = random.Random(42)
        x = [0.0]
        theta = 0.3
        for _ in range(499):
            dx = theta * (0.0 - x[-1]) + rng.gauss(0, 0.5)
            x.append(x[-1] + dx)
        result = MeanReversionDetector.classify(x)
        assert "strength" in result
        assert "half_life" in result
        assert "mean_reverting" in result

    def test_random_walk(self):
        rng = random.Random(42)
        x = [0.0]
        for _ in range(499):
            x.append(x[-1] + rng.gauss(0, 1))
        result = MeanReversionDetector.classify(x)
        assert "mean_reverting" in result
        assert "strength" in result

    def test_variance_ratio(self):
        rng = random.Random(42)
        x = [rng.gauss(0, 1) for _ in range(200)]
        result = MeanReversionDetector.classify(x)
        assert "variance_ratio" in result

    def test_short_series(self):
        result = MeanReversionDetector.classify([1, 2])
        assert result["mean_reverting"] is False


# ═══════════════════════════════════════════════════════════════════════
# StatArbSignalGenerator
# ═══════════════════════════════════════════════════════════════════════

class TestStatArbSignalGenerator:
    def test_buy_signal(self):
        # z < -entry_threshold => BUY or STRONG_BUY
        sig = StatArbSignalGenerator.generate_signal(-2.5, entry_threshold=2.0, exit_threshold=0.5, stop_threshold=4.0)
        assert sig in (SpreadSignal.BUY, SpreadSignal.STRONG_BUY)

    def test_sell_signal(self):
        # z > entry_threshold => SELL or STRONG_SELL
        sig = StatArbSignalGenerator.generate_signal(2.5, entry_threshold=2.0, exit_threshold=0.5, stop_threshold=4.0)
        assert sig in (SpreadSignal.SELL, SpreadSignal.STRONG_SELL)

    def test_hold_signal_near_zero(self):
        # |z| < exit_threshold => HOLD
        sig = StatArbSignalGenerator.generate_signal(0.3, entry_threshold=2.0, exit_threshold=0.5, stop_threshold=4.0)
        assert sig == SpreadSignal.HOLD

    def test_stop_loss_signal(self):
        sig = StatArbSignalGenerator.generate_signal(4.5, entry_threshold=2.0, exit_threshold=0.5, stop_threshold=4.0)
        assert sig == SpreadSignal.STOP_LOSS

    def test_stop_loss_negative(self):
        sig = StatArbSignalGenerator.generate_signal(-4.5, entry_threshold=2.0, exit_threshold=0.5, stop_threshold=4.0)
        assert sig == SpreadSignal.STOP_LOSS

    def test_hold_in_grey_zone(self):
        # 0.5 < |z| < 2.0 => HOLD (in between entry and exit)
        sig = StatArbSignalGenerator.generate_signal(1.5, entry_threshold=2.0, exit_threshold=0.5, stop_threshold=4.0)
        assert sig == SpreadSignal.HOLD

    def test_strong_buy_very_negative(self):
        sig = StatArbSignalGenerator.generate_signal(-3.5, entry_threshold=2.0, exit_threshold=0.5, stop_threshold=4.0)
        assert sig in (SpreadSignal.STRONG_BUY, SpreadSignal.BUY)

    def test_strong_sell_very_positive(self):
        sig = StatArbSignalGenerator.generate_signal(3.5, entry_threshold=2.0, exit_threshold=0.5, stop_threshold=4.0)
        assert sig in (SpreadSignal.STRONG_SELL, SpreadSignal.SELL)

    def test_backtest_signals(self):
        rng = random.Random(42)
        spread = [rng.gauss(0, 2) for _ in range(200)]
        result = StatArbSignalGenerator.backtest_signals(spread, entry=2.0, exit_threshold=0.5, stop=4.0)
        assert "trades" in result
        assert "total_trades" in result
        assert "total_pnl" in result

    def test_backtest_has_win_rate(self):
        rng = random.Random(42)
        spread = [rng.gauss(0, 2) for _ in range(200)]
        result = StatArbSignalGenerator.backtest_signals(spread, entry=2.0, exit_threshold=0.5, stop=4.0)
        assert "win_rate" in result
        assert "wins" in result
        assert "losses" in result

    @pytest.mark.parametrize("z", [-5, -3, -2, -1, 0, 1, 2, 3, 5])
    def test_all_zscore_ranges(self, z):
        sig = StatArbSignalGenerator.generate_signal(z, entry_threshold=2.0, exit_threshold=0.5, stop_threshold=4.0)
        assert isinstance(sig, SpreadSignal)


# ═══════════════════════════════════════════════════════════════════════
# PairsRanker
# ═══════════════════════════════════════════════════════════════════════

class TestPairsRanker:
    def test_rank_pairs(self):
        universe = {}
        for i in range(5):
            universe[f"S{i}"] = _random_walk(200, seed=i)
        # Add a cointegrated pair
        x = _random_walk(200, seed=100)
        rng = random.Random(200)
        y = [1.5 * xi + rng.gauss(0, 1) for xi in x]
        universe["A"] = x
        universe["B"] = y
        pairs = PairsRanker.rank_pairs(universe, min_correlation=0.5)
        assert isinstance(pairs, list)

    def test_empty_universe(self):
        pairs = PairsRanker.rank_pairs({})
        assert pairs == []

    def test_single_stock(self):
        pairs = PairsRanker.rank_pairs({"X": [1, 2, 3]})
        assert pairs == []


# ═══════════════════════════════════════════════════════════════════════
# StatisticalArbitrageEngine Orchestrator
# ═══════════════════════════════════════════════════════════════════════

class TestStatisticalArbitrageEngine:
    @pytest.fixture
    def engine(self):
        return StatisticalArbitrageEngine()

    def test_analyze_pair(self, engine):
        x, y = _cointegrated_pair(300)
        result = engine.analyze_pair(y, x)
        assert "hedge_ratio" in result
        assert "correlation" in result
        assert "half_life" in result
        assert "signal" in result
        assert "current_z_score" in result
        assert "cointegrated" in result
        assert "mean_reversion" in result

    def test_analyze_pair_with_symbols(self, engine):
        x, y = _cointegrated_pair(300)
        result = engine.analyze_pair(y, x, symbol_a="AAPL", symbol_b="MSFT")
        assert result["pair"] == "AAPL/MSFT"

    def test_scan_universe(self, engine):
        universe = {}
        for i in range(4):
            universe[f"S{i}"] = _random_walk(200, seed=i)
        result = engine.scan_universe(universe)
        assert isinstance(result, list)

    def test_spread_state(self, engine):
        x, y = _cointegrated_pair(200)
        state = engine.spread_state(y, x)
        assert isinstance(state, dict)
        assert "z_score" in state
        assert "signal" in state
        assert "spread" in state

    def test_capabilities(self, engine):
        caps = engine.capabilities()
        assert caps["engine"] == "StatisticalArbitrageEngine"
        assert len(caps["features"]) > 5


# ═══════════════════════════════════════════════════════════════════════
# Parametric Tests
# ═══════════════════════════════════════════════════════════════════════

class TestParametric:
    @pytest.mark.parametrize("seed", range(10))
    def test_cointegration_consistent(self, seed):
        x, y = _cointegrated_pair(300, seed=seed)
        result = CointegrationTest.test(y, x)
        assert abs(result["hedge_ratio"] - 1.5) < 0.25

    @pytest.mark.parametrize("n", [50, 100, 200, 500])
    def test_hedge_ratio_various_lengths(self, n):
        x, y = _cointegrated_pair(n)
        result = HedgeRatioEstimator.ols_hedge_ratio(y, x)
        assert 1.0 < result["beta"] < 2.0

    @pytest.mark.parametrize("lookback", [10, 20, 30, 60])
    def test_zscore_lookbacks(self, lookback):
        rng = random.Random(42)
        spread = [rng.gauss(0, 2) for _ in range(200)]
        zs = SpreadCalculator.z_score(spread, lookback)
        assert len(zs) == 200
