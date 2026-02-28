"""
Tests for StressTestingEngine — VaR, CVaR, drawdown, scenario analysis, loss distribution.
"""
import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../phase1'))

from services.stress_testing_engine import (
    VaRCalculator,
    CVaRCalculator,
    DrawdownAnalyzer,
    ScenarioAnalyzer,
    LossDistributionAnalyzer,
    StressTestingEngine,
    VaRMethod,
    HistoricalScenario,
    ScenarioType,
    HISTORICAL_SCENARIOS,
    _skewness,
    _excess_kurtosis,
)
import random
import math
import statistics


# ── Fixtures ──────────────────────────────────────────────────────────

@pytest.fixture
def daily_returns():
    rng = random.Random(42)
    return [rng.gauss(0.0003, 0.012) for _ in range(252)]


@pytest.fixture
def portfolio_weights():
    return {"equities": 0.6, "bonds": 0.3, "commodities": 0.1}


@pytest.fixture
def engine():
    return StressTestingEngine()


@pytest.fixture
def trending_up():
    return [0.001] * 100 + [-0.005, -0.010, -0.008, -0.015, -0.020] + [0.001] * 50


@pytest.fixture
def returns_with_fat_tails():
    rng = random.Random(123)
    base = [rng.gauss(0.0004, 0.015) for _ in range(200)]
    # Add some extreme events
    base[50] = -0.08
    base[100] = -0.06
    base[150] = 0.07
    return base


# ── VaRCalculator ─────────────────────────────────────────────────────

class TestVaRCalculator:
    def test_historical_var_95(self, daily_returns):
        var = VaRCalculator.historical_var(daily_returns, 0.95)
        assert var > 0
        assert var < 0.15  # sanity check

    def test_historical_var_99_gt_95(self, daily_returns):
        var_95 = VaRCalculator.historical_var(daily_returns, 0.95)
        var_99 = VaRCalculator.historical_var(daily_returns, 0.99)
        assert var_99 >= var_95

    def test_historical_var_empty(self):
        assert VaRCalculator.historical_var([], 0.95) == 0.0

    def test_parametric_var(self):
        var = VaRCalculator.parametric_var(0.0005, 0.015, 0.95)
        assert var > 0
        # At 95% confidence, parametric VaR should roughly be ≈ 1.645 * vol
        expected_approx = 1.645 * 0.015 - 0.0005
        assert abs(var - expected_approx) < 0.005

    def test_parametric_var_higher_at_99(self):
        var_95 = VaRCalculator.parametric_var(0.0005, 0.015, 0.95)
        var_99 = VaRCalculator.parametric_var(0.0005, 0.015, 0.99)
        assert var_99 > var_95

    def test_cornish_fisher_var(self, daily_returns):
        var = VaRCalculator.cornish_fisher_var(daily_returns, 0.95)
        assert var > 0

    def test_cornish_fisher_fat_tail_higher(self, returns_with_fat_tails, daily_returns):
        """CF-VaR should generally be higher for fat-tailed returns."""
        cf_fat = VaRCalculator.cornish_fisher_var(returns_with_fat_tails, 0.95)
        assert cf_fat > 0

    def test_monte_carlo_var(self):
        var = VaRCalculator.monte_carlo_var(0.0003, 0.012, 0.95, n_simulations=5000)
        assert var > 0

    def test_monte_carlo_var_deterministic(self):
        v1 = VaRCalculator.monte_carlo_var(0.0003, 0.012, 0.95, n_simulations=1000, seed=42)
        v2 = VaRCalculator.monte_carlo_var(0.0003, 0.012, 0.95, n_simulations=1000, seed=42)
        assert v1 == v2

    def test_rolling_var(self, daily_returns):
        rolling = VaRCalculator.rolling_var(daily_returns, window=60)
        assert len(rolling) == len(daily_returns)
        assert all(v >= 0 for v in rolling)


# ── CVaRCalculator ────────────────────────────────────────────────────

class TestCVaRCalculator:
    def test_historical_cvar(self, daily_returns):
        cvar = CVaRCalculator.historical_cvar(daily_returns, 0.95)
        assert cvar > 0

    def test_cvar_exceeds_var(self, daily_returns):
        var = VaRCalculator.historical_var(daily_returns, 0.95)
        cvar = CVaRCalculator.historical_cvar(daily_returns, 0.95)
        assert cvar >= var

    def test_cvar_empty(self):
        assert CVaRCalculator.historical_cvar([], 0.95) == 0.0

    def test_parametric_cvar(self):
        cvar = CVaRCalculator.parametric_cvar(0.0005, 0.015, 0.95)
        assert cvar > 0

    def test_component_cvar(self):
        weights = [0.6, 0.4]
        returns_matrix = [
            [0.01, -0.02, 0.005, -0.03, 0.008, -0.025, 0.01, -0.015, 0.002, -0.04],
            [0.002, -0.01, 0.001, -0.005, 0.003, -0.008, 0.001, -0.006, 0.001, -0.012],
        ]
        comp = CVaRCalculator.component_cvar(weights, returns_matrix)
        assert len(comp) == 2

    def test_component_cvar_empty(self):
        result = CVaRCalculator.component_cvar([], [])
        assert result == []


# ── DrawdownAnalyzer ──────────────────────────────────────────────────

class TestDrawdownAnalyzer:
    def test_drawdown_series_positive_returns(self):
        returns = [0.01] * 50
        dd = DrawdownAnalyzer.drawdown_series(returns)
        assert all(d == 0.0 for d in dd)

    def test_drawdown_series_negative_period(self, trending_up):
        dd = DrawdownAnalyzer.drawdown_series(trending_up)
        assert min(dd) < 0

    def test_drawdown_empty(self):
        assert DrawdownAnalyzer.drawdown_series([]) == []

    def test_max_drawdown(self, trending_up):
        result = DrawdownAnalyzer.max_drawdown(trending_up)
        assert result["max_drawdown"] < 0
        assert "peak_index" in result
        assert "trough_index" in result

    def test_max_drawdown_no_dd(self):
        returns = [0.01] * 100
        result = DrawdownAnalyzer.max_drawdown(returns)
        assert result["max_drawdown"] == 0.0

    def test_max_drawdown_empty(self):
        result = DrawdownAnalyzer.max_drawdown([])
        assert result["max_drawdown"] == 0

    def test_calmar_ratio(self, daily_returns):
        calmar = DrawdownAnalyzer.calmar_ratio(daily_returns)
        assert isinstance(calmar, float)

    def test_calmar_ratio_positive_only(self):
        returns = [0.001] * 252
        calmar = DrawdownAnalyzer.calmar_ratio(returns)
        assert calmar == 0.0  # no drawdown

    def test_underwater_curve(self, trending_up):
        result = DrawdownAnalyzer.underwater_curve(trending_up)
        assert "days_underwater" in result
        assert result["days_underwater"] >= 0

    def test_underwater_curve_empty(self):
        result = DrawdownAnalyzer.underwater_curve([])
        assert result == {}


# ── ScenarioAnalyzer ──────────────────────────────────────────────────

class TestScenarioAnalyzer:
    def test_apply_scenario_basic(self, portfolio_weights):
        scenario = HISTORICAL_SCENARIOS[0]  # GFC
        result = ScenarioAnalyzer.apply_scenario(portfolio_weights, scenario)
        assert result["total_pnl"] < 0  # GFC should be negative
        assert "contributions" in result

    def test_scenario_contributions_sum_to_total(self, portfolio_weights):
        scenario = HISTORICAL_SCENARIOS[0]
        result = ScenarioAnalyzer.apply_scenario(portfolio_weights, scenario)
        total = sum(result["contributions"].values())
        assert abs(total - result["total_pnl"]) < 1e-9

    def test_batch_scenarios_count(self, portfolio_weights):
        results = ScenarioAnalyzer.batch_scenarios(portfolio_weights)
        assert len(results) == len(HISTORICAL_SCENARIOS)

    def test_batch_scenarios_sorted_by_loss(self, portfolio_weights):
        results = ScenarioAnalyzer.batch_scenarios(portfolio_weights)
        pnls = [r["total_pnl"] for r in results]
        assert pnls == sorted(pnls)  # worst first

    def test_worst_case_scenario(self, portfolio_weights):
        result = ScenarioAnalyzer.worst_case_scenario(portfolio_weights)
        assert result["total_pnl"] <= 0

    def test_scenario_pct_loss(self, portfolio_weights):
        scenario = HISTORICAL_SCENARIOS[0]
        result = ScenarioAnalyzer.apply_scenario(portfolio_weights, scenario)
        assert abs(result["pct_loss"] - result["total_pnl"] * 100) < 1e-6


# ── LossDistributionAnalyzer ──────────────────────────────────────────

class TestLossDistributionAnalyzer:
    def test_simulate_losses(self):
        weights = [0.5, 0.5]
        means = [0.0003, 0.0001]
        vols = [0.012, 0.006]
        corr = [[1.0, 0.4], [0.4, 1.0]]
        losses = LossDistributionAnalyzer.simulate_portfolio_losses(weights, means, vols, corr, n_sims=500)
        assert len(losses) == 500
        assert losses == sorted(losses)  # should be sorted

    def test_loss_distribution_summary(self):
        rng = random.Random(42)
        losses = sorted([rng.gauss(0.002, 0.015) for _ in range(10000)])
        summary = LossDistributionAnalyzer.loss_distribution_summary(losses)
        assert "var_95" in summary
        assert "var_99" in summary
        assert "cvar_95" in summary
        assert summary["cvar_99"] >= summary["var_99"]

    def test_simulate_empty(self):
        losses = LossDistributionAnalyzer.simulate_portfolio_losses([], [], [], [])
        assert losses == []


# ── Helper functions ──────────────────────────────────────────────────

class TestHelpers:
    def test_skewness_normal(self):
        rng = random.Random(42)
        normal = [rng.gauss(0, 1) for _ in range(1000)]
        skew = _skewness(normal)
        assert abs(skew) < 0.3  # roughly symmetric

    def test_skewness_positive(self):
        pos_skew = [1.0] * 90 + [10.0] * 10  # right tail
        skew = _skewness(pos_skew)
        assert skew > 0

    def test_excess_kurtosis_normal(self):
        rng = random.Random(42)
        normal = [rng.gauss(0, 1) for _ in range(2000)]
        kurt = _excess_kurtosis(normal)
        assert abs(kurt) < 1.0  # normal ≈ 0 excess kurtosis

    def test_excess_kurtosis_fat_tail(self):
        fat = [0.01] * 950 + [-0.20, -0.25, -0.30, -0.15, -0.10] + [0.20, 0.25]
        kurt = _excess_kurtosis(fat)
        assert kurt > 0  # fat tails → positive excess kurtosis


# ── StressTestingEngine Orchestrator ──────────────────────────────────

class TestStressTestingEngine:
    def test_var_historical(self, engine, daily_returns):
        var = engine.var(daily_returns, 0.95, VaRMethod.HISTORICAL)
        assert var > 0

    def test_var_parametric(self, engine, daily_returns):
        var = engine.var(daily_returns, 0.95, VaRMethod.PARAMETRIC)
        assert var > 0

    def test_var_monte_carlo(self, engine, daily_returns):
        var = engine.var(daily_returns, 0.95, VaRMethod.MONTE_CARLO)
        assert var > 0

    def test_cvar(self, engine, daily_returns):
        cvar = engine.cvar(daily_returns, 0.95)
        assert cvar > 0

    def test_full_var_suite(self, engine, daily_returns):
        suite = engine.full_var_suite(daily_returns)
        assert "historical_var_95" in suite
        assert "parametric_var_99" in suite
        assert "cvar_99" in suite
        assert suite["cvar_99"] >= suite["historical_var_99"]

    def test_full_var_suite_insufficient(self, engine):
        result = engine.full_var_suite([0.01, 0.02])
        assert result == {}

    def test_max_drawdown(self, engine, trending_up):
        result = engine.max_drawdown(trending_up)
        assert result["max_drawdown"] < 0

    def test_calmar(self, engine, daily_returns):
        calmar = engine.calmar(daily_returns)
        assert isinstance(calmar, float)

    def test_scenario_analysis(self, engine, portfolio_weights):
        results = engine.scenario_analysis(portfolio_weights)
        assert len(results) == len(HISTORICAL_SCENARIOS)

    def test_worst_scenario(self, engine, portfolio_weights):
        ws = engine.worst_scenario(portfolio_weights)
        assert ws["total_pnl"] <= 0

    def test_monte_carlo_loss_dist(self, engine):
        weights = [0.6, 0.4]
        means = [0.0005, 0.0002]
        vols = [0.012, 0.005]
        corr = [[1.0, 0.3], [0.3, 1.0]]
        result = engine.monte_carlo_loss_dist(weights, means, vols, corr, n_sims=1000)
        assert "var_95" in result
        assert "max_loss" in result

    def test_full_risk_report(self, engine, daily_returns, portfolio_weights):
        report = engine.full_risk_report(daily_returns, portfolio_weights)
        assert "var_suite" in report
        assert "drawdown" in report
        assert "scenario_analysis" in report

    def test_capabilities(self, engine):
        caps = engine.capabilities()
        assert caps["engine"] == "StressTestingEngine"
        assert len(caps["features"]) >= 15
