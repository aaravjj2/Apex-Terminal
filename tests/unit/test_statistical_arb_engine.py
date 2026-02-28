"""Tests for statistical_arb_engine.py — comprehensive coverage."""

import math
import random
import statistics

import pytest

from services.statistical_arb_engine import (
    CointegrationTester,
    CorrelationScreener,
    DistanceMethodRanker,
    MeanReversionAnalyzer,
    MultiPairPortfolio,
    PairCandidate,
    PairsPnLSimulator,
    SignalType,
    SpreadCalculator,
    SpreadSignal,
    StatArbRiskMetrics,
    StatArbSignalGenerator,
    StatisticalArbEngine,
)


# ── Helpers ─────────────────────────────────────────────────────────────

def _correlated_series(n: int = 200, corr: float = 0.9, seed: int = 42) -> tuple[list[float], list[float]]:
    """Generate two correlated price series."""
    random.seed(seed)
    a = [100.0]
    b = [100.0]
    for _ in range(n - 1):
        shock_common = random.gauss(0, 1)
        shock_a = random.gauss(0, 1)
        shock_b = random.gauss(0, 1)
        a.append(a[-1] + corr * shock_common + (1 - corr) * shock_a)
        b.append(b[-1] + corr * shock_common + (1 - corr) * shock_b)
    return a, b


def _cointegrated_series(n: int = 200, seed: int = 42) -> tuple[list[float], list[float]]:
    """Generate a cointegrated pair (b = 2*a + mean-reverting noise)."""
    random.seed(seed)
    a = [100.0]
    noise = [random.gauss(0, 1)]
    for i in range(1, n):
        a.append(a[-1] + random.gauss(0, 1))
        # Mean-reverting noise: OU process
        noise.append(noise[-1] * 0.9 + random.gauss(0, 0.5))
    b = [2 * ai + ni + 50 for ai, ni in zip(a, noise)]
    return a, b


def _sample_prices(n_symbols: int = 5, n_days: int = 200) -> dict[str, list[float]]:
    random.seed(42)
    prices = {}
    for i in range(n_symbols):
        p = 100.0
        series = []
        for _ in range(n_days):
            p += random.gauss(0.05, 2)
            p = max(p, 10)
            series.append(round(p, 2))
        prices[f"SYM{i}"] = series
    return prices


# ── PairCandidate ──────────────────────────────────────────────────────

class TestPairCandidate:
    def test_is_cointegrated(self):
        pc = PairCandidate("A", "B", 0.9, 0.01, 1.2, 15.0, 0.4, 5.0)
        assert pc.is_cointegrated is True
        pc2 = PairCandidate("A", "B", 0.9, 0.10, 1.2, 15.0, 0.4, 5.0)
        assert pc2.is_cointegrated is False

    def test_is_mean_reverting(self):
        pc = PairCandidate("A", "B", 0.9, 0.01, 1.2, 15.0, 0.35, 5.0)
        assert pc.is_mean_reverting is True
        pc2 = PairCandidate("A", "B", 0.9, 0.01, 1.2, 15.0, 0.65, 5.0)
        assert pc2.is_mean_reverting is False

    def test_quality_score(self):
        pc = PairCandidate("A", "B", 0.85, 0.005, 1.2, 20.0, 0.25, 5.0)
        score = pc.quality_score
        assert score > 80  # high quality pair

    def test_quality_score_low(self):
        pc = PairCandidate("A", "B", 0.3, 0.50, 1.2, 200.0, 0.8, 5.0)
        score = pc.quality_score
        assert score < 20

    def test_to_dict(self):
        pc = PairCandidate("AAPL", "MSFT", 0.85, 0.02, 1.1, 15.0, 0.4, 3.0)
        d = pc.to_dict()
        assert d["symbol_a"] == "AAPL"
        assert d["is_cointegrated"] is True
        assert "quality_score" in d


# ── CorrelationScreener ───────────────────────────────────────────────

class TestCorrelationScreener:
    def test_pearson_correlation_high(self):
        a, b = _correlated_series(100, corr=0.95)
        c = CorrelationScreener.pearson_correlation(a, b)
        assert c > 0.5  # Should be high

    def test_pearson_correlation_self(self):
        a = list(range(100))
        c = CorrelationScreener.pearson_correlation(a, a)
        assert abs(c - 1.0) < 0.01

    def test_pearson_short_series(self):
        assert CorrelationScreener.pearson_correlation([1, 2], [1, 2]) == 0.0

    def test_rank_pairs(self):
        prices = _sample_prices(5, 200)
        pairs = CorrelationScreener.rank_pairs_by_correlation(prices, min_corr=0.0)
        assert len(pairs) > 0
        # Should be sorted by absolute correlation
        for i in range(len(pairs) - 1):
            assert abs(pairs[i]["correlation"]) >= abs(pairs[i + 1]["correlation"])


# ── CointegrationTester ────────────────────────────────────────────────

class TestCointegrationTester:
    def test_ols_regression(self):
        x = list(range(100))
        y = [2 * xi + 5 + random.gauss(0, 0.1) for xi in x]
        random.seed(42)
        alpha, beta, residuals = CointegrationTester.ols_regression(y, x)
        assert abs(beta - 2.0) < 0.5
        assert len(residuals) == 100

    def test_adf_stationary_series(self):
        # Create a mean-reverting series
        random.seed(42)
        series = [0.0]
        for _ in range(200):
            series.append(series[-1] * 0.8 + random.gauss(0, 1))
        stat, pval = CointegrationTester.adf_test_simplified(series)
        assert stat < 0  # Should be negative for stationary
        assert pval < 0.15  # Should be relatively low

    def test_adf_random_walk(self):
        random.seed(42)
        series = [0.0]
        for _ in range(200):
            series.append(series[-1] + random.gauss(0, 1))
        stat, pval = CointegrationTester.adf_test_simplified(series)
        # Random walk should have higher p-value (less likely to reject unit root)
        assert pval > 0.01

    def test_cointegration_test(self):
        a, b = _cointegrated_series(200)
        ct = CointegrationTester()
        result = ct.test_cointegration(a, b)
        assert "hedge_ratio" in result
        assert "p_value" in result
        assert "adf_statistic" in result
        assert "residual_std" in result


# ── SpreadCalculator ──────────────────────────────────────────────────

class TestSpreadCalculator:
    def test_ratio_spread(self):
        a = [100, 105, 110]
        b = [50, 52, 55]
        spread = SpreadCalculator.ratio_spread(a, b)
        assert len(spread) == 3
        assert spread[0] == pytest.approx(2.0)

    def test_log_ratio_spread(self):
        a = [100, 100]
        b = [50, 50]
        spread = SpreadCalculator.log_ratio_spread(a, b)
        assert len(spread) == 2
        assert spread[0] == pytest.approx(math.log(2.0))

    def test_residual_spread(self):
        a, b = _correlated_series(100)
        residuals, beta = SpreadCalculator.residual_spread(a, b)
        assert len(residuals) == 100
        assert isinstance(beta, float)

    def test_z_score(self):
        spread = [float(i % 10 - 5) for i in range(50)]
        z = SpreadCalculator.z_score(spread, lookback=20)
        assert len(z) == 50
        # Z-scores should be bounded for a bounded spread
        assert all(-5 < zi < 5 for zi in z)


# ── MeanReversionAnalyzer ─────────────────────────────────────────────

class TestMeanReversionAnalyzer:
    def test_half_life_mean_reverting(self):
        # OU process should have finite half-life
        random.seed(42)
        series = [0.0]
        for _ in range(200):
            series.append(series[-1] * 0.95 + random.gauss(0, 1))
        hl = MeanReversionAnalyzer.half_life(series)
        assert hl > 0
        assert hl < 100  # Should be finite

    def test_half_life_random_walk(self):
        random.seed(42)
        series = [0.0]
        for _ in range(200):
            series.append(series[-1] + random.gauss(0, 1))
        hl = MeanReversionAnalyzer.half_life(series)
        # Random walk should have very large or infinite half-life
        assert hl > 50 or hl == float("inf")

    def test_half_life_short(self):
        assert MeanReversionAnalyzer.half_life([1, 2, 3]) == float("inf")

    def test_hurst_mean_reverting(self):
        random.seed(42)
        series = [0.0]
        for _ in range(300):
            series.append(series[-1] * 0.9 + random.gauss(0, 1))
        h = MeanReversionAnalyzer.hurst_exponent(series)
        assert 0 <= h <= 1

    def test_hurst_trending(self):
        # Trending series
        series = list(range(300))
        h = MeanReversionAnalyzer.hurst_exponent(series)
        assert h > 0.4  # Should be > 0.5 for trending

    def test_hurst_short_series(self):
        h = MeanReversionAnalyzer.hurst_exponent([1, 2, 3])
        assert h == 0.5  # default


# ── SignalGenerator ────────────────────────────────────────────────────

class TestStatArbSignalGenerator:
    def test_entry_long(self):
        z_scores = [0, -0.5, -1.0, -1.5, -2.5, -1.0, -0.3, 0.0]
        gen = StatArbSignalGenerator(entry_z=2.0, exit_z=0.5)
        signals = gen.generate_signals(z_scores)
        entries = [s for s in signals if s.signal_type == SignalType.ENTRY_LONG]
        assert len(entries) == 1
        assert entries[0].date_idx == 4

    def test_entry_short(self):
        z_scores = [0, 0.5, 1.0, 1.5, 2.5, 1.0, 0.3, 0.0]
        gen = StatArbSignalGenerator(entry_z=2.0, exit_z=0.5)
        signals = gen.generate_signals(z_scores)
        entries = [s for s in signals if s.signal_type == SignalType.ENTRY_SHORT]
        assert len(entries) == 1

    def test_exit_signal(self):
        z_scores = [0, -2.5, -1.0, -0.3]
        gen = StatArbSignalGenerator(entry_z=2.0, exit_z=0.5)
        signals = gen.generate_signals(z_scores)
        exits = [s for s in signals if s.signal_type == SignalType.EXIT]
        assert len(exits) == 1

    def test_stop_signal(self):
        z_scores = [0, -2.5, -3.0, -3.6]
        gen = StatArbSignalGenerator(entry_z=2.0, exit_z=0.5, stop_z=3.5)
        signals = gen.generate_signals(z_scores)
        stops = [s for s in signals if s.signal_type == SignalType.STOP]
        assert len(stops) == 1

    def test_no_signals(self):
        z_scores = [0.0, 0.5, -0.5, 0.1]
        gen = StatArbSignalGenerator(entry_z=2.0)
        signals = gen.generate_signals(z_scores)
        assert len(signals) == 0


# ── PairsPnLSimulator ─────────────────────────────────────────────────

class TestPairsPnLSimulator:
    def test_simulate_basic(self):
        prices_a = [100 + i * 0.5 for i in range(50)]
        prices_b = [200 + i * 0.3 for i in range(50)]
        signals = [
            SpreadSignal(5, SignalType.ENTRY_LONG, -2.5, -2.5, "buy", "sell"),
            SpreadSignal(15, SignalType.EXIT, -0.3, -0.3, "sell", "buy"),
        ]
        result = PairsPnLSimulator.simulate(prices_a, prices_b, signals)
        assert result["total_trades"] == 1
        assert "total_pnl" in result
        assert "win_rate" in result

    def test_simulate_empty(self):
        result = PairsPnLSimulator.simulate([100], [200], [])
        assert result["total_trades"] == 0

    def test_simulate_multiple_trades(self):
        prices_a = [100 + i * 0.1 for i in range(100)]
        prices_b = [200 + i * 0.15 for i in range(100)]
        signals = [
            SpreadSignal(5, SignalType.ENTRY_LONG, -2.5, -2.5, "buy", "sell"),
            SpreadSignal(15, SignalType.EXIT, -0.3, -0.3, "sell", "buy"),
            SpreadSignal(30, SignalType.ENTRY_SHORT, 2.5, 2.5, "sell", "buy"),
            SpreadSignal(45, SignalType.EXIT, 0.3, 0.3, "buy", "sell"),
        ]
        result = PairsPnLSimulator.simulate(prices_a, prices_b, signals)
        assert result["total_trades"] == 2


# ── DistanceMethodRanker ──────────────────────────────────────────────

class TestDistanceMethodRanker:
    def test_normalize(self):
        prices = [100, 110, 120]
        norm = DistanceMethodRanker.normalize(prices)
        assert norm[0] == 1.0
        assert norm[1] == pytest.approx(1.1)

    def test_squared_distance(self):
        a = [1.0, 1.1, 1.2]
        b = [1.0, 1.05, 1.15]
        dist = DistanceMethodRanker.squared_distance(a, b)
        assert dist > 0

    def test_rank_pairs(self):
        prices = _sample_prices(5, 100)
        ranker = DistanceMethodRanker()
        result = ranker.rank_pairs(prices, top_n=3)
        assert len(result) <= 3
        # Should be sorted by distance ascending
        for i in range(len(result) - 1):
            assert result[i]["distance"] <= result[i + 1]["distance"]


# ── MultiPairPortfolio ────────────────────────────────────────────────

class TestMultiPairPortfolio:
    def _candidates(self) -> list[PairCandidate]:
        return [
            PairCandidate("A", "B", 0.9, 0.01, 1.2, 15, 0.3, 3.0),
            PairCandidate("C", "D", 0.85, 0.02, 1.1, 20, 0.35, 4.0),
            PairCandidate("A", "C", 0.88, 0.015, 0.9, 18, 0.32, 3.5),  # shares A with first
            PairCandidate("E", "F", 0.80, 0.03, 1.3, 25, 0.4, 5.0),
        ]

    def test_select_uncorrelated(self):
        candidates = self._candidates()
        selected = MultiPairPortfolio.select_uncorrelated_pairs(candidates, max_pairs=3)
        # Should not select pair sharing symbols with already-selected pairs
        symbols = set()
        for s in selected:
            assert s.symbol_a not in symbols
            assert s.symbol_b not in symbols
            symbols.add(s.symbol_a)
            symbols.add(s.symbol_b)

    def test_equal_allocation(self):
        candidates = self._candidates()[:2]
        allocs = MultiPairPortfolio.portfolio_allocation(candidates, total_capital=100000, method="equal")
        assert len(allocs) == 2
        assert allocs[0]["capital_allocated"] == pytest.approx(50000)

    def test_quality_weighted(self):
        candidates = self._candidates()[:2]
        allocs = MultiPairPortfolio.portfolio_allocation(candidates, total_capital=100000, method="quality_weighted")
        assert len(allocs) == 2
        total = sum(a["capital_allocated"] for a in allocs)
        assert abs(total - 100000) < 1  # should sum to total


# ── StatArbRiskMetrics ────────────────────────────────────────────────

class TestStatArbRiskMetrics:
    def test_spread_risk(self):
        spread = [float(i % 10 - 5) for i in range(50)]
        result = StatArbRiskMetrics.spread_risk(spread)
        assert "mean" in result
        assert "std" in result
        assert "current_z" in result
        assert "return_vol" in result

    def test_spread_risk_short(self):
        result = StatArbRiskMetrics.spread_risk([1.0])
        assert "insufficient_data" in result

    def test_correlation_breakdown(self):
        a, b = _correlated_series(100)
        result = StatArbRiskMetrics.correlation_breakdown_risk(a, b, window=20)
        assert "current_correlation" in result
        assert "breakdown_risk" in result

    def test_correlation_breakdown_short(self):
        result = StatArbRiskMetrics.correlation_breakdown_risk([1, 2], [1, 2])
        assert "insufficient_data" in result


# ── StatisticalArbEngine (Orchestrator) ────────────────────────────────

class TestStatisticalArbEngine:
    def _engine(self) -> StatisticalArbEngine:
        return StatisticalArbEngine()

    def test_screen_pairs(self):
        engine = self._engine()
        prices = _sample_prices(5, 200)
        result = engine.screen_pairs(prices, min_correlation=0.0)
        assert len(result) > 0

    def test_analyze_pair(self):
        engine = self._engine()
        a, b = _cointegrated_series(200)
        result = engine.analyze_pair(a, b, "AAPL", "MSFT")
        assert "pair" in result
        assert "cointegration" in result
        assert "half_life" in result
        assert "hurst_exponent" in result
        assert "spread_risk" in result

    def test_generate_signals(self):
        engine = self._engine()
        a, b = _cointegrated_series(200)
        signals = engine.generate_signals(a, b, entry_z=1.5)
        assert isinstance(signals, list)

    def test_backtest_pair(self):
        engine = self._engine()
        a, b = _cointegrated_series(200)
        result = engine.backtest_pair(a, b, entry_z=1.5, capital_per_leg=10000)
        assert "total_trades" in result
        assert "total_pnl" in result

    def test_distance_ranking(self):
        engine = self._engine()
        prices = _sample_prices(5, 100)
        result = engine.distance_ranking(prices, top_n=3)
        assert len(result) <= 3

    def test_correlation_risk(self):
        engine = self._engine()
        a, b = _correlated_series(100)
        result = engine.correlation_risk(a, b)
        assert "breakdown_risk" in result

    def test_build_portfolio(self):
        engine = self._engine()
        candidates = [
            PairCandidate("A", "B", 0.9, 0.01, 1.2, 15, 0.3, 3.0),
            PairCandidate("C", "D", 0.85, 0.02, 1.1, 20, 0.35, 4.0),
        ]
        result = engine.build_portfolio(candidates, total_capital=200000, max_pairs=3)
        assert result["selected_pairs"] == 2
        assert len(result["allocations"]) == 2

    def test_capabilities(self):
        engine = self._engine()
        caps = engine.capabilities()
        assert caps["engine"] == "StatisticalArbEngine"
        assert len(caps["features"]) >= 10
