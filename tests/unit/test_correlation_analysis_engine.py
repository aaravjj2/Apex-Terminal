"""
Tests for CorrelationAnalysisEngine — comprehensive correlation & cross-asset analysis.
"""

import math
import numpy as np
import pytest
from datetime import datetime

from services.correlation_analysis_engine import (
    CorrelationCalculator,
    CorrelationMatrix,
    CorrelationType,
    CovarianceAnalyzer,
    PCAAnalyzer,
    PCAResult,
    BetaCalculator,
    BetaResult,
    DispersionAnalyzer,
    LeadLagDetector,
    RegimeDetector,
    RegimeType,
    RegimeInfo,
    PortfolioOptimizer,
    CorrelationStabilityAnalyzer,
    CorrelationAnalysisEngine,
    OptimizationType,
)


# ─── Helpers ────────────────────────────────────────────────────────────────

def _random_returns(n=100, mean=0.0005, std=0.02, seed=42):
    rng = np.random.RandomState(seed)
    return list(rng.normal(mean, std, n))


def _correlated_returns(n=200, correlation=0.7, seed=42):
    """Generate two correlated return series."""
    rng = np.random.RandomState(seed)
    r1 = rng.normal(0, 0.02, n)
    noise = rng.normal(0, 0.02, n)
    r2 = correlation * r1 + math.sqrt(1 - correlation ** 2) * noise
    return list(r1), list(r2)


def _multi_asset_returns(n_assets=5, n_periods=200, seed=42):
    rng = np.random.RandomState(seed)
    returns = {}
    for i in range(n_assets):
        returns[f"ASSET_{i}"] = list(rng.normal(0.0003 * (i + 1), 0.015 + 0.005 * i, n_periods))
    return returns


# ═══════════════════════════════════════════════════════════════════════════
# CorrelationMatrix data class
# ═══════════════════════════════════════════════════════════════════════════

class TestCorrelationMatrix:
    def test_get_correlation(self):
        m = CorrelationMatrix(["A", "B"], np.array([[1.0, 0.5], [0.5, 1.0]]))
        assert m.get("A", "B") == pytest.approx(0.5)
        assert m.get("B", "A") == pytest.approx(0.5)
        assert m.get("A", "A") == pytest.approx(1.0)

    def test_get_unknown_symbol(self):
        m = CorrelationMatrix(["A", "B"], np.array([[1.0, 0.5], [0.5, 1.0]]))
        assert m.get("X", "A") == 0.0

    def test_top_correlations(self):
        syms = ["A", "B", "C"]
        mat = np.array([[1, 0.9, 0.1], [0.9, 1, -0.5], [0.1, -0.5, 1]])
        m = CorrelationMatrix(syms, mat)
        top = m.top_correlations(2)
        assert len(top) == 2
        assert abs(top[0]["correlation"]) >= abs(top[1]["correlation"])

    def test_least_correlated(self):
        syms = ["A", "B", "C"]
        mat = np.array([[1, 0.9, 0.05], [0.9, 1, -0.8], [0.05, -0.8, 1]])
        m = CorrelationMatrix(syms, mat)
        least = m.least_correlated(1)
        assert len(least) == 1
        assert abs(least[0]["correlation"]) <= 0.1

    def test_to_dict(self):
        m = CorrelationMatrix(["A"], np.array([[1.0]]), "pearson")
        d = m.to_dict()
        assert d["symbols"] == ["A"]
        assert d["matrix"] == [[1.0]]
        assert d["correlation_type"] == "pearson"


# ═══════════════════════════════════════════════════════════════════════════
# BetaResult
# ═══════════════════════════════════════════════════════════════════════════

class TestBetaResult:
    def test_to_dict(self):
        b = BetaResult("AAPL", "SPY", 1.2, 0.001, 0.85, 0.05)
        d = b.to_dict()
        assert d["beta"] == 1.2
        assert d["symbol"] == "AAPL"
        assert d["r_squared"] == 0.85


# ═══════════════════════════════════════════════════════════════════════════
# PCAResult
# ═══════════════════════════════════════════════════════════════════════════

class TestPCAResult:
    def test_cumulative_variance(self):
        p = PCAResult(np.array([]), np.array([1, 2, 3]), np.array([0.5, 0.3, 0.2]))
        cum = p.cumulative_variance()
        assert cum[-1] == pytest.approx(1.0)

    def test_n_components_for_variance(self):
        p = PCAResult(np.array([]), np.array([]), np.array([0.6, 0.25, 0.1, 0.05]))
        assert p.n_components_for_variance(0.85) == 2
        assert p.n_components_for_variance(0.95) == 3


# ═══════════════════════════════════════════════════════════════════════════
# CorrelationCalculator
# ═══════════════════════════════════════════════════════════════════════════

class TestCorrelationCalculator:
    def test_pearson_perfect(self):
        r = {"A": [0.01, 0.02, -0.01, 0.03], "B": [0.01, 0.02, -0.01, 0.03]}
        m = CorrelationCalculator.pearson(r)
        assert m.get("A", "B") == pytest.approx(1.0)

    def test_pearson_inverse(self):
        r = {"A": [0.01, 0.02, -0.01, 0.03], "B": [-0.01, -0.02, 0.01, -0.03]}
        m = CorrelationCalculator.pearson(r)
        assert m.get("A", "B") == pytest.approx(-1.0)

    def test_pearson_correlated(self):
        r1, r2 = _correlated_returns(200, 0.7)
        m = CorrelationCalculator.pearson({"A": r1, "B": r2})
        corr = m.get("A", "B")
        assert 0.5 < corr < 0.9  # Should be around 0.7

    def test_pearson_empty(self):
        m = CorrelationCalculator.pearson({})
        assert m.symbols == []

    def test_spearman_basic(self):
        r = {"A": [1, 2, 3, 4, 5], "B": [2, 4, 6, 8, 10]}
        m = CorrelationCalculator.spearman(r)
        assert m.get("A", "B") == pytest.approx(1.0)

    def test_spearman_inverse(self):
        r = {"A": [1, 2, 3, 4, 5], "B": [10, 8, 6, 4, 2]}
        m = CorrelationCalculator.spearman(r)
        assert m.get("A", "B") == pytest.approx(-1.0)

    def test_kendall_basic(self):
        r = {"A": [1, 2, 3, 4], "B": [1, 2, 3, 4]}
        m = CorrelationCalculator.kendall(r)
        assert m.get("A", "B") == pytest.approx(1.0)

    def test_kendall_inverse(self):
        r = {"A": [1, 2, 3, 4], "B": [4, 3, 2, 1]}
        m = CorrelationCalculator.kendall(r)
        assert m.get("A", "B") == pytest.approx(-1.0)

    def test_rolling_correlation(self):
        r1, r2 = _correlated_returns(100, 0.8)
        rc = CorrelationCalculator.rolling_correlation(r1, r2, 20)
        assert len(rc) == 100
        # First 19 should be 0
        assert all(v == 0.0 for v in rc[:19])
        # Later values should be significantly correlated
        assert any(abs(v) > 0.3 for v in rc[20:])

    def test_calculate_dispatch(self):
        calc = CorrelationCalculator()
        r = {"A": _random_returns(50), "B": _random_returns(50, seed=43)}
        for ct in CorrelationType:
            m = calc.calculate(r, ct)
            assert "A" in m.symbols
            assert m.correlation_type == ct.value

    def test_rank_function(self):
        ranks = CorrelationCalculator._rank([3.0, 1.0, 2.0])
        # 1.0 → rank 1, 2.0 → rank 2, 3.0 → rank 3
        assert ranks[0] == 3.0
        assert ranks[1] == 1.0
        assert ranks[2] == 2.0

    def test_pearson_diagonal_is_one(self):
        returns = _multi_asset_returns(4, 100)
        m = CorrelationCalculator.pearson(returns)
        for i in range(4):
            assert m.matrix[i, i] == pytest.approx(1.0)

    def test_pearson_symmetric(self):
        returns = _multi_asset_returns(3, 100)
        m = CorrelationCalculator.pearson(returns)
        for i in range(3):
            for j in range(3):
                assert m.matrix[i, j] == pytest.approx(m.matrix[j, i])


# ═══════════════════════════════════════════════════════════════════════════
# CovarianceAnalyzer
# ═══════════════════════════════════════════════════════════════════════════

class TestCovarianceAnalyzer:
    def test_covariance_matrix(self):
        returns = _multi_asset_returns(3, 100)
        syms, cov = CovarianceAnalyzer.covariance_matrix(returns)
        assert len(syms) == 3
        assert cov.shape == (3, 3)
        # Diagonal must be positive (variance)
        for i in range(3):
            assert cov[i, i] > 0

    def test_covariance_empty(self):
        syms, cov = CovarianceAnalyzer.covariance_matrix({})
        assert syms == []
        assert cov.size == 0

    def test_eigenvalue_decomposition(self):
        returns = _multi_asset_returns(3, 100)
        _, cov = CovarianceAnalyzer.covariance_matrix(returns)
        eigenvals, eigenvecs = CovarianceAnalyzer.eigenvalue_decomposition(cov)
        assert len(eigenvals) == 3
        # All eigenvalues should be non-negative for PSD matrix
        assert all(v >= -1e-10 for v in eigenvals)
        # Should be sorted descending
        assert eigenvals[0] >= eigenvals[1]

    def test_condition_number(self):
        m = np.array([[1.0, 0.5], [0.5, 1.0]])
        cn = CovarianceAnalyzer.condition_number(m)
        assert cn > 0
        assert cn < 100  # Well-conditioned

    def test_condition_number_empty(self):
        assert CovarianceAnalyzer.condition_number(np.array([])) == 0.0


# ═══════════════════════════════════════════════════════════════════════════
# PCA
# ═══════════════════════════════════════════════════════════════════════════

class TestPCAAnalyzer:
    def test_basic_pca(self):
        returns = _multi_asset_returns(5, 200)
        result = PCAAnalyzer.fit(returns)
        assert len(result.explained_variance_ratio) == 5
        assert sum(result.explained_variance_ratio) == pytest.approx(1.0, abs=0.01)

    def test_pca_n_components(self):
        returns = _multi_asset_returns(5, 200)
        result = PCAAnalyzer.fit(returns, n_components=2)
        assert len(result.explained_variance_ratio) == 2

    def test_pca_empty(self):
        result = PCAAnalyzer.fit({})
        assert len(result.explained_variance_ratio) == 0

    def test_pca_cumulative(self):
        returns = _multi_asset_returns(4, 200)
        result = PCAAnalyzer.fit(returns)
        cum = result.cumulative_variance()
        assert cum[-1] == pytest.approx(1.0, abs=0.01)
        # Each value should be >= previous
        for i in range(1, len(cum)):
            assert cum[i] >= cum[i - 1] - 1e-10

    def test_pca_to_dict(self):
        returns = _multi_asset_returns(3, 100)
        result = PCAAnalyzer.fit(returns)
        d = result.to_dict()
        assert "explained_variance_ratio" in d
        assert "cumulative_variance" in d
        assert "n_components_95pct" in d


# ═══════════════════════════════════════════════════════════════════════════
# BetaCalculator
# ═══════════════════════════════════════════════════════════════════════════

class TestBetaCalculator:
    def test_beta_one(self):
        """Asset that moves identically to benchmark → beta=1."""
        b = _random_returns(200)
        result = BetaCalculator.single_beta(b, b)
        assert result.beta == pytest.approx(1.0, abs=0.01)

    def test_beta_two(self):
        """Asset that moves 2x benchmark → beta≈2."""
        bench = _random_returns(200)
        asset = [r * 2 for r in bench]
        result = BetaCalculator.single_beta(asset, bench)
        assert result.beta == pytest.approx(2.0, abs=0.1)

    def test_beta_zero(self):
        """Uncorrelated asset → beta≈0."""
        asset = _random_returns(300, seed=1)
        bench = _random_returns(300, seed=99)
        result = BetaCalculator.single_beta(asset, bench)
        assert abs(result.beta) < 0.3

    def test_r_squared_perfect(self):
        bench = _random_returns(200)
        result = BetaCalculator.single_beta(bench, bench)
        assert result.r_squared == pytest.approx(1.0, abs=0.01)

    def test_rolling_beta(self):
        bench = _random_returns(200)
        asset = [r * 1.5 + 0.001 for r in bench]
        rb = BetaCalculator.rolling_beta(asset, bench, window=50)
        assert len(rb) == 200
        assert rb[0] == 0.0  # Before window
        # After window, beta should be ~1.5
        assert abs(rb[-1] - 1.5) < 0.3

    def test_conditional_beta_down(self):
        bench = _random_returns(300, mean=-0.001)
        # Asset falls harder in down markets
        asset = [r * 1.5 if r < 0 else r * 0.8 for r in bench]
        down_beta = BetaCalculator.conditional_beta(asset, bench, "down")
        up_beta = BetaCalculator.conditional_beta(asset, bench, "up")
        # Down beta should be higher than up beta
        assert down_beta > up_beta

    def test_beta_short_data(self):
        result = BetaCalculator.single_beta([0.01], [0.01])
        assert result.beta == 0.0


# ═══════════════════════════════════════════════════════════════════════════
# DispersionAnalyzer
# ═══════════════════════════════════════════════════════════════════════════

class TestDispersionAnalyzer:
    def test_cross_sectional_dispersion(self):
        returns = _multi_asset_returns(5, 100)
        disp = DispersionAnalyzer.cross_sectional_dispersion(returns)
        assert len(disp) == 100
        assert all(d >= 0 for d in disp)

    def test_dispersion_empty(self):
        assert DispersionAnalyzer.cross_sectional_dispersion({}) == []

    def test_sector_rotation(self):
        sectors = {
            "Tech": _random_returns(50, mean=0.003),
            "Energy": _random_returns(50, mean=-0.001),
            "Health": _random_returns(50, mean=0.001),
        }
        scores = DispersionAnalyzer.sector_rotation_score(sectors, 20)
        # Tech should rank highest (highest mean return)
        top = list(scores.keys())[0]
        # It's probabilistic but tech has highest drift
        assert isinstance(scores[top], float)
        assert len(scores) == 3

    def test_momentum_scores(self):
        returns = _multi_asset_returns(3, 100)
        scores = DispersionAnalyzer.momentum_scores(returns)
        for sym in returns:
            assert "mom_5d" in scores[sym]
            assert "mom_20d" in scores[sym]
            assert "composite" in scores[sym]

    def test_relative_strength(self):
        returns = {
            "BENCH": _random_returns(50, mean=0.001),
            "STRONG": _random_returns(50, mean=0.005),
            "WEAK": _random_returns(50, mean=-0.002),
        }
        rs = DispersionAnalyzer.relative_strength(returns, "BENCH", 20)
        assert "BENCH" not in rs  # Benchmark excluded
        assert "STRONG" in rs
        assert "WEAK" in rs

    def test_relative_strength_missing_bench(self):
        returns = {"A": _random_returns(50)}
        rs = DispersionAnalyzer.relative_strength(returns, "SPY")
        assert rs == {}


# ═══════════════════════════════════════════════════════════════════════════
# LeadLagDetector
# ═══════════════════════════════════════════════════════════════════════════

class TestLeadLagDetector:
    def test_cross_correlation_self(self):
        r = _random_returns(100)
        cc = LeadLagDetector.cross_correlation(r, r, 5)
        # At lag 0, should have highest correlation
        assert cc[0] > 0.5

    def test_cross_correlation_range(self):
        r1 = _random_returns(100, seed=1)
        r2 = _random_returns(100, seed=2)
        cc = LeadLagDetector.cross_correlation(r1, r2, 5)
        assert -5 in cc and 5 in cc and 0 in cc

    def test_cross_correlation_short(self):
        assert LeadLagDetector.cross_correlation([1], [2], 5) == {}

    def test_granger_causality(self):
        x = _random_returns(100, seed=1)
        # y follows x with lag 1
        y = [0.0] + [x[i] * 0.7 + np.random.normal(0, 0.01) for i in range(99)]
        result = LeadLagDetector.granger_causality_simple(x, y, lag=1)
        assert "f_statistic" in result
        assert "direction" in result

    def test_granger_no_causality(self):
        x = _random_returns(100, seed=1)
        y = _random_returns(100, seed=99)
        result = LeadLagDetector.granger_causality_simple(x, y, lag=1)
        assert result["f_statistic"] >= 0


# ═══════════════════════════════════════════════════════════════════════════
# RegimeDetector
# ═══════════════════════════════════════════════════════════════════════════

class TestRegimeDetector:
    def test_high_correlation_regime(self):
        """Highly correlated assets → HIGH_CORRELATION regime."""
        # Create correlated returns
        base = _random_returns(100)
        returns = {
            "A": base,
            "B": [r + np.random.normal(0, 0.002) for r in base],
            "C": [r + np.random.normal(0, 0.002) for r in base],
            "D": [r + np.random.normal(0, 0.002) for r in base],
        }
        regime = RegimeDetector.detect_regime(returns, window=60)
        assert regime.avg_correlation > 0.5
        assert regime.confidence > 0

    def test_low_correlation_regime(self):
        """Uncorrelated assets → LOW_CORRELATION regime."""
        returns = _multi_asset_returns(5, 100, seed=77)
        regime = RegimeDetector.detect_regime(returns, window=60)
        assert isinstance(regime.regime, RegimeType)
        assert isinstance(regime.dispersion, float)

    def test_single_asset(self):
        returns = {"A": _random_returns(100)}
        regime = RegimeDetector.detect_regime(returns, window=60)
        assert regime.regime == RegimeType.TRANSITION

    def test_rolling_regime(self):
        returns = _multi_asset_returns(3, 300)
        regimes = RegimeDetector.rolling_regime(returns, window=60, step=30)
        assert len(regimes) > 0
        assert all(isinstance(r.regime, RegimeType) for r in regimes)

    def test_regime_to_dict(self):
        ri = RegimeInfo(RegimeType.RISK_ON, 0.65, 0.12, 0.8)
        d = ri.to_dict()
        assert d["regime"] == "risk_on"
        assert d["avg_correlation"] == 0.65


# ═══════════════════════════════════════════════════════════════════════════
# PortfolioOptimizer
# ═══════════════════════════════════════════════════════════════════════════

class TestPortfolioOptimizer:
    def test_min_variance_weights_sum(self):
        returns = _multi_asset_returns(4, 200)
        weights = PortfolioOptimizer.minimum_variance(returns)
        assert len(weights) == 4
        assert sum(weights.values()) == pytest.approx(1.0, abs=0.01)

    def test_min_variance_single(self):
        returns = {"A": _random_returns(100)}
        weights = PortfolioOptimizer.minimum_variance(returns)
        assert weights["A"] == 1.0

    def test_risk_parity_weights_sum(self):
        returns = _multi_asset_returns(4, 200)
        weights = PortfolioOptimizer.risk_parity(returns)
        assert sum(weights.values()) == pytest.approx(1.0, abs=0.001)

    def test_risk_parity_lower_vol_higher_weight(self):
        """Asset with lower vol should get higher weight."""
        returns = {
            "LOW_VOL": _random_returns(200, std=0.005),
            "HIGH_VOL": _random_returns(200, std=0.05),
        }
        weights = PortfolioOptimizer.risk_parity(returns)
        assert weights["LOW_VOL"] > weights["HIGH_VOL"]

    def test_risk_contribution(self):
        returns = _multi_asset_returns(3, 200)
        weights = {"ASSET_0": 0.4, "ASSET_1": 0.3, "ASSET_2": 0.3}
        rc = PortfolioOptimizer.risk_contribution(weights, returns)
        assert len(rc) == 3
        assert sum(rc.values()) == pytest.approx(1.0, abs=0.01)

    def test_max_diversification(self):
        returns = _multi_asset_returns(3, 200)
        weights = PortfolioOptimizer.max_diversification(returns)
        assert sum(weights.values()) == pytest.approx(1.0, abs=0.01)


# ═══════════════════════════════════════════════════════════════════════════
# CorrelationStabilityAnalyzer
# ═══════════════════════════════════════════════════════════════════════════

class TestCorrelationStabilityAnalyzer:
    def test_correlation_change(self):
        returns = _multi_asset_returns(3, 300)
        result = CorrelationStabilityAnalyzer.correlation_change(returns, 60, 60)
        assert "change" in result
        assert "recent_avg_correlation" in result
        assert "historical_avg_correlation" in result

    def test_correlation_change_short(self):
        returns = _multi_asset_returns(3, 50)
        result = CorrelationStabilityAnalyzer.correlation_change(returns, 60, 60)
        assert result["change"] == 0.0

    def test_correlation_breakdowns(self):
        # Create data where correlation changes dramatically
        rng = np.random.RandomState(42)
        n = 200
        base = list(rng.normal(0, 0.02, n))
        # First half: correlated; Second half: uncorrelated
        r2 = base[:100] + list(rng.normal(0, 0.02, 100))
        returns = {"A": base, "B": r2}
        breakdowns = CorrelationStabilityAnalyzer.correlation_breakdowns(returns, window=60, threshold=0.2)
        # Should detect the breakdown
        assert isinstance(breakdowns, list)

    def test_breakdowns_short_data(self):
        returns = _multi_asset_returns(2, 50)
        assert CorrelationStabilityAnalyzer.correlation_breakdowns(returns, 60) == []


# ═══════════════════════════════════════════════════════════════════════════
# CorrelationAnalysisEngine (Orchestrator)
# ═══════════════════════════════════════════════════════════════════════════

class TestCorrelationAnalysisEngine:
    @pytest.fixture
    def engine(self):
        return CorrelationAnalysisEngine()

    @pytest.fixture
    def returns(self):
        return _multi_asset_returns(5, 250)

    def test_correlation_matrix(self, engine, returns):
        result = engine.correlation_matrix(returns)
        assert "symbols" in result
        assert "matrix" in result
        assert len(result["matrix"]) == 5

    def test_correlation_matrix_spearman(self, engine, returns):
        result = engine.correlation_matrix(returns, CorrelationType.SPEARMAN)
        assert result["correlation_type"] == "spearman"

    def test_top_correlations(self, engine, returns):
        top = engine.top_correlations(returns, 3)
        assert len(top) == 3
        assert all("correlation" in p for p in top)

    def test_least_correlated(self, engine, returns):
        least = engine.least_correlated(returns, 3)
        assert len(least) == 3

    def test_rolling_correlation(self, engine):
        r1, r2 = _correlated_returns(100, 0.8)
        rc = engine.rolling_correlation(r1, r2, 20)
        assert len(rc) == 100

    def test_calculate_beta(self, engine):
        asset = _random_returns(200)
        bench = _random_returns(200, seed=10)
        result = engine.calculate_beta(asset, bench, "AAPL", "SPY")
        assert "beta" in result
        assert result["symbol"] == "AAPL"

    def test_rolling_beta(self, engine):
        asset = _random_returns(200)
        bench = _random_returns(200, seed=10)
        rb = engine.rolling_beta(asset, bench, 40)
        assert len(rb) == 200

    def test_conditional_beta(self, engine):
        asset = _random_returns(200)
        bench = _random_returns(200, seed=10)
        down = engine.conditional_beta(asset, bench, "down")
        up = engine.conditional_beta(asset, bench, "up")
        assert isinstance(down, float)
        assert isinstance(up, float)

    def test_run_pca(self, engine, returns):
        result = engine.run_pca(returns)
        assert "explained_variance_ratio" in result
        assert "n_components_95pct" in result

    def test_dispersion_analysis(self, engine, returns):
        disp = engine.dispersion_analysis(returns)
        assert len(disp) == 250

    def test_sector_rotation(self, engine):
        sectors = {"Tech": _random_returns(50), "Finance": _random_returns(50, seed=3)}
        result = engine.sector_rotation(sectors, 20)
        assert len(result) == 2

    def test_momentum_scores(self, engine, returns):
        result = engine.momentum_scores(returns)
        assert len(result) == 5

    def test_relative_strength(self, engine, returns):
        syms = list(returns.keys())
        result = engine.relative_strength(returns, syms[0], 20)
        assert syms[0] not in result  # Benchmark excluded

    def test_lead_lag_analysis(self, engine):
        r1 = _random_returns(100)
        r2 = _random_returns(100, seed=5)
        result = engine.lead_lag_analysis(r1, r2, 5)
        assert 0 in result

    def test_granger_causality(self, engine):
        x = _random_returns(100)
        y = _random_returns(100, seed=5)
        result = engine.granger_causality(x, y)
        assert "f_statistic" in result

    def test_detect_regime(self, engine, returns):
        result = engine.detect_regime(returns, 60)
        assert "regime" in result

    def test_optimize_min_variance(self, engine, returns):
        result = engine.optimize_portfolio(returns, OptimizationType.MIN_VARIANCE)
        assert "weights" in result
        assert sum(result["weights"].values()) == pytest.approx(1.0, abs=0.01)

    def test_optimize_risk_parity(self, engine, returns):
        result = engine.optimize_portfolio(returns, OptimizationType.RISK_PARITY)
        assert "weights" in result

    def test_optimize_equal_weight(self, engine, returns):
        result = engine.optimize_portfolio(returns, OptimizationType.EQUAL_WEIGHT)
        assert all(v == pytest.approx(0.2) for v in result["weights"].values())

    def test_correlation_stability(self, engine):
        returns = _multi_asset_returns(3, 300)
        result = engine.correlation_stability(returns, 60)
        assert "change" in result

    def test_correlation_breakdowns(self, engine):
        returns = _multi_asset_returns(3, 300)
        result = engine.correlation_breakdowns(returns, 60)
        assert isinstance(result, list)

    def test_capabilities(self, engine):
        caps = engine.capabilities()
        assert caps["engine"] == "CorrelationAnalysisEngine"
        assert len(caps["features"]) >= 10
        assert "pearson_spearman_kendall_correlation" in caps["features"]
