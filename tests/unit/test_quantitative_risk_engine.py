"""
Comprehensive tests for QuantitativeRiskEngine.
Tests: HistoricalVaR, ParametricVaR, MonteCarloVaR, DrawdownCalculator,
PerformanceRatios, TailRiskAnalyzer, CorrelationAnalysis, ScenarioTester,
RiskClassifier, PortfolioPosition, and the orchestrator.
"""
import math
import random
import statistics
import pytest

from phase1.services.quantitative_risk_engine import (
    RiskLevel, DrawdownPhase, TailRiskCategory,
    PortfolioPosition, DrawdownResult, VaRResult,
    HistoricalVaR, ParametricVaR, MonteCarloVaR,
    DrawdownCalculator, PerformanceRatios, TailRiskAnalyzer,
    CorrelationAnalysis, ScenarioTester, RiskClassifier,
    QuantitativeRiskEngine,
)


# ═══════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════

def _gen_returns(n=252, mu=0.0003, sigma=0.015, seed=42):
    rng = random.Random(seed)
    return [mu + sigma * rng.gauss(0, 1) for _ in range(n)]


def _gen_bear_returns(n=252, seed=42):
    return _gen_returns(n, mu=-0.002, sigma=0.025, seed=seed)


def _gen_bull_returns(n=252, seed=42):
    return _gen_returns(n, mu=0.001, sigma=0.010, seed=seed)


def _make_position(sym, weight, n=252, seed=42):
    return PortfolioPosition(symbol=sym, weight=weight, returns=_gen_returns(n, seed=seed))


# ═══════════════════════════════════════════════════════════════════════
# Enums
# ═══════════════════════════════════════════════════════════════════════

class TestEnums:
    def test_risk_level_values(self):
        assert RiskLevel.MINIMAL.value == "minimal"
        assert RiskLevel.EXTREME.value == "extreme"
        assert len(RiskLevel) == 5

    def test_tail_risk_category(self):
        assert TailRiskCategory.FAT_TAILED.value == "fat_tailed"
        assert len(TailRiskCategory) == 4


# ═══════════════════════════════════════════════════════════════════════
# PortfolioPosition
# ═══════════════════════════════════════════════════════════════════════

class TestPortfolioPosition:
    def test_basic_properties(self):
        pos = _make_position("AAPL", 0.25)
        assert pos.symbol == "AAPL"
        assert pos.weight == 0.25
        assert len(pos.returns) == 252

    def test_mean_return(self):
        pos = _make_position("AAPL", 0.25)
        assert isinstance(pos.mean_return, float)
        assert -0.01 < pos.mean_return < 0.01

    def test_volatility(self):
        pos = _make_position("AAPL", 0.25)
        assert pos.volatility > 0
        assert pos.volatility < 0.1  # daily vol < 10%

    def test_annualized_return(self):
        pos = _make_position("AAPL", 0.25)
        assert abs(pos.annualized_return) < 1.0

    def test_annualized_vol(self):
        pos = _make_position("AAPL", 0.25)
        assert 0.05 < pos.annualized_vol < 0.50

    def test_empty_returns(self):
        pos = PortfolioPosition(symbol="X", weight=0.5)
        assert pos.mean_return == 0.0
        assert pos.volatility == 0.0

    def test_single_return(self):
        pos = PortfolioPosition(symbol="X", weight=0.5, returns=[0.01])
        assert pos.mean_return == 0.01
        assert pos.volatility == 0.0

    def test_to_dict(self):
        pos = _make_position("MSFT", 0.30)
        d = pos.to_dict()
        assert d["symbol"] == "MSFT"
        assert d["weight"] == 0.30
        assert "mean_return" in d
        assert "ann_vol" in d


# ═══════════════════════════════════════════════════════════════════════
# HistoricalVaR
# ═══════════════════════════════════════════════════════════════════════

class TestHistoricalVaR:
    def test_var_95(self):
        rets = _gen_returns(1000)
        var = HistoricalVaR.calculate(rets, 0.95)
        assert var > 0  # VaR is a positive loss number

    def test_var_99_greater_than_95(self):
        rets = _gen_returns(1000)
        v95 = HistoricalVaR.calculate(rets, 0.95)
        v99 = HistoricalVaR.calculate(rets, 0.99)
        assert v99 >= v95

    def test_cvar(self):
        rets = _gen_returns(1000)
        cvar = HistoricalVaR.cvar(rets, 0.95)
        var = HistoricalVaR.calculate(rets, 0.95)
        assert cvar >= var  # CVaR >= VaR

    def test_empty_returns(self):
        assert HistoricalVaR.calculate([], 0.95) == 0.0
        assert HistoricalVaR.cvar([], 0.95) == 0.0

    def test_full_var(self):
        rets = _gen_returns(1000)
        result = HistoricalVaR.full_var(rets)
        assert isinstance(result, VaRResult)
        assert result.method == "historical"
        assert result.var_99 >= result.var_95

    def test_var_result_to_dict(self):
        rets = _gen_returns(500)
        result = HistoricalVaR.full_var(rets)
        d = result.to_dict()
        assert "var_95" in d
        assert "cvar_99" in d
        assert d["method"] == "historical"

    def test_all_positive_returns(self):
        rets = [0.01] * 100
        var = HistoricalVaR.calculate(rets, 0.95)
        assert var == -0.01  # negative means no loss

    def test_all_negative_returns(self):
        rets = [-0.02] * 100
        var = HistoricalVaR.calculate(rets, 0.95)
        assert var == 0.02

    def test_bear_market_var(self):
        rets = _gen_bear_returns(500)
        var = HistoricalVaR.calculate(rets, 0.95)
        assert var > 0.01  # significant VaR in bear market


# ═══════════════════════════════════════════════════════════════════════
# ParametricVaR
# ═══════════════════════════════════════════════════════════════════════

class TestParametricVaR:
    def test_basic(self):
        var = ParametricVaR.calculate(0.0005, 0.015, 0.95)
        assert var > 0

    def test_zero_std(self):
        assert ParametricVaR.calculate(0.001, 0, 0.95) == 0.0

    def test_99_greater_than_95(self):
        v95 = ParametricVaR.calculate(0.0005, 0.02, 0.95)
        v99 = ParametricVaR.calculate(0.0005, 0.02, 0.99)
        assert v99 > v95

    def test_portfolio_var(self):
        weights = [0.6, 0.4]
        means = [0.0005, 0.0003]
        stds = [0.015, 0.010]
        corr = [[1.0, 0.5], [0.5, 1.0]]
        var = ParametricVaR.portfolio_var(weights, means, stds, corr, 0.95)
        assert var > 0

    def test_portfolio_var_uncorrelated(self):
        weights = [0.5, 0.5]
        means = [0.001, 0.001]
        stds = [0.02, 0.02]
        corr = [[1, 0], [0, 1]]
        var_uncorr = ParametricVaR.portfolio_var(weights, means, stds, corr)
        corr2 = [[1, 1], [1, 1]]
        var_corr = ParametricVaR.portfolio_var(weights, means, stds, corr2)
        assert var_uncorr < var_corr  # diversification reduces VaR

    def test_empty_portfolio(self):
        assert ParametricVaR.portfolio_var([], [], [], [], 0.95) == 0.0


# ═══════════════════════════════════════════════════════════════════════
# MonteCarloVaR
# ═══════════════════════════════════════════════════════════════════════

class TestMonteCarloVaR:
    def test_simulate(self):
        sims = MonteCarloVaR.simulate(0.0005, 0.02, 1000, seed=42)
        assert len(sims) == 1000

    def test_var_from_simulations(self):
        sims = MonteCarloVaR.simulate(0.0005, 0.02, 10000, seed=42)
        var = MonteCarloVaR.var_from_simulations(sims, 0.95)
        assert var > 0

    def test_full_mc_var(self):
        result = MonteCarloVaR.full_mc_var(0.0005, 0.02, 10000, seed=42)
        assert result.method == "monte_carlo"
        assert result.var_99 >= result.var_95

    def test_deterministic_with_seed(self):
        r1 = MonteCarloVaR.full_mc_var(0.0005, 0.02, 5000, seed=123)
        r2 = MonteCarloVaR.full_mc_var(0.0005, 0.02, 5000, seed=123)
        assert r1.var_95 == r2.var_95

    def test_higher_vol_higher_var(self):
        r_low = MonteCarloVaR.full_mc_var(0.0005, 0.01, 5000, seed=42)
        r_high = MonteCarloVaR.full_mc_var(0.0005, 0.04, 5000, seed=42)
        assert r_high.var_95 > r_low.var_95


# ═══════════════════════════════════════════════════════════════════════
# DrawdownCalculator
# ═══════════════════════════════════════════════════════════════════════

class TestDrawdownCalculator:
    def test_basic(self):
        rets = _gen_returns(252)
        dd = DrawdownCalculator.calculate(rets)
        assert isinstance(dd, DrawdownResult)
        assert dd.max_drawdown >= 0
        assert dd.max_drawdown <= 1.0

    def test_empty(self):
        dd = DrawdownCalculator.calculate([])
        assert dd.max_drawdown == 0.0

    def test_pure_bull(self):
        rets = [0.01] * 100
        dd = DrawdownCalculator.calculate(rets)
        assert dd.max_drawdown == 0.0

    def test_crash_then_recovery(self):
        rets = [0.01] * 50 + [-0.05] * 10 + [0.03] * 50
        dd = DrawdownCalculator.calculate(rets)
        assert dd.max_drawdown > 0.1

    def test_drawdown_series_length(self):
        rets = _gen_returns(100)
        dd = DrawdownCalculator.calculate(rets)
        assert len(dd.drawdown_series) == 101  # wealth has n+1 points

    def test_underwater_periods(self):
        rets = [0.01]*20 + [-0.05]*5 + [0.01]*20 + [-0.05]*5 + [0.01]*20
        periods = DrawdownCalculator.underwater_periods(rets, threshold=0.01)
        assert isinstance(periods, list)

    def test_bear_market_large_dd(self):
        rets = _gen_bear_returns(252)
        dd = DrawdownCalculator.calculate(rets)
        assert dd.max_drawdown > 0.1


# ═══════════════════════════════════════════════════════════════════════
# PerformanceRatios
# ═══════════════════════════════════════════════════════════════════════

class TestPerformanceRatios:
    def test_sharpe(self):
        rets = _gen_returns(252)
        sr = PerformanceRatios.sharpe_ratio(rets)
        assert isinstance(sr, float)
        assert -5 < sr < 5

    def test_sharpe_insufficient_data(self):
        assert PerformanceRatios.sharpe_ratio([]) == 0.0
        assert PerformanceRatios.sharpe_ratio([0.01]) == 0.0

    def test_sortino(self):
        rets = _gen_returns(252)
        sor = PerformanceRatios.sortino_ratio(rets)
        assert isinstance(sor, float)

    def test_calmar(self):
        rets = _gen_returns(252)
        cal = PerformanceRatios.calmar_ratio(rets)
        assert isinstance(cal, float)

    def test_omega(self):
        rets = _gen_returns(252)
        omega = PerformanceRatios.omega_ratio(rets)
        assert omega >= 0

    def test_omega_all_gains(self):
        rets = [0.01] * 100
        omega = PerformanceRatios.omega_ratio(rets)
        assert omega == float('inf')

    def test_omega_all_losses(self):
        rets = [-0.01] * 100
        omega = PerformanceRatios.omega_ratio(rets)
        assert omega == 0

    def test_information_ratio(self):
        port = _gen_returns(252, seed=1)
        bench = _gen_returns(252, seed=2)
        ir = PerformanceRatios.information_ratio(port, bench)
        assert isinstance(ir, float)

    def test_information_ratio_mismatched(self):
        assert PerformanceRatios.information_ratio([0.01], [0.01, 0.02]) == 0.0

    def test_beta(self):
        port = _gen_returns(252, seed=1)
        bench = _gen_returns(252, seed=2)
        b = PerformanceRatios.beta(port, bench)
        assert isinstance(b, float)

    def test_beta_identical(self):
        rets = _gen_returns(252)
        b = PerformanceRatios.beta(rets, rets)
        assert abs(b - 1.0) < 0.01

    def test_alpha(self):
        port = _gen_returns(252, seed=1)
        bench = _gen_returns(252, seed=2)
        a = PerformanceRatios.alpha(port, bench)
        assert isinstance(a, float)

    def test_treynor(self):
        port = _gen_returns(252, seed=1)
        bench = _gen_returns(252, seed=2)
        t = PerformanceRatios.treynor_ratio(port, bench)
        assert isinstance(t, float)

    def test_bull_vs_bear_sharpe(self):
        bull = _gen_bull_returns(252)
        bear = _gen_bear_returns(252)
        assert PerformanceRatios.sharpe_ratio(bull) > PerformanceRatios.sharpe_ratio(bear)


# ═══════════════════════════════════════════════════════════════════════
# TailRiskAnalyzer
# ═══════════════════════════════════════════════════════════════════════

class TestTailRiskAnalyzer:
    def test_skewness(self):
        rets = _gen_returns(500)
        sk = TailRiskAnalyzer.skewness(rets)
        assert isinstance(sk, float)
        assert -3 < sk < 3

    def test_kurtosis(self):
        rets = _gen_returns(500)
        k = TailRiskAnalyzer.kurtosis(rets)
        assert isinstance(k, float)

    def test_skewness_insufficient(self):
        assert TailRiskAnalyzer.skewness([]) == 0.0
        assert TailRiskAnalyzer.skewness([1, 2]) == 0.0

    def test_kurtosis_insufficient(self):
        assert TailRiskAnalyzer.kurtosis([1, 2, 3]) == 0.0

    def test_tail_ratio(self):
        rets = _gen_returns(500)
        tr = TailRiskAnalyzer.tail_ratio(rets)
        assert tr > 0

    def test_classify_tail_risk(self):
        rets = _gen_returns(500)
        result = TailRiskAnalyzer.classify_tail_risk(rets)
        assert "category" in result
        assert "kurtosis" in result
        assert "skewness" in result
        assert "left_tail_risk" in result
        assert isinstance(result["left_tail_risk"], bool)

    def test_fat_tail_detection(self):
        # Generate returns with fat tails
        rng = random.Random(42)
        fat = [rng.gauss(0, 1) * (10 if rng.random() < 0.05 else 1) * 0.01 for _ in range(1000)]
        result = TailRiskAnalyzer.classify_tail_risk(fat)
        assert result["kurtosis"] > 0  # positive excess kurtosis


# ═══════════════════════════════════════════════════════════════════════
# CorrelationAnalysis
# ═══════════════════════════════════════════════════════════════════════

class TestCorrelationAnalysis:
    def test_pearson_identical(self):
        x = _gen_returns(100, seed=1)
        assert abs(CorrelationAnalysis.pearson(x, x) - 1.0) < 0.001

    def test_pearson_opposite(self):
        x = _gen_returns(100, seed=1)
        neg_x = [-r for r in x]
        assert abs(CorrelationAnalysis.pearson(x, neg_x) + 1.0) < 0.001

    def test_pearson_uncorrelated(self):
        x = _gen_returns(1000, seed=1)
        y = _gen_returns(1000, seed=2)
        corr = CorrelationAnalysis.pearson(x, y)
        assert abs(corr) < 0.15

    def test_pearson_insufficient(self):
        assert CorrelationAnalysis.pearson([], []) == 0.0
        assert CorrelationAnalysis.pearson([1], [2]) == 0.0

    def test_correlation_matrix(self):
        assets = {
            "A": _gen_returns(100, seed=1),
            "B": _gen_returns(100, seed=2),
            "C": _gen_returns(100, seed=3),
        }
        matrix = CorrelationAnalysis.correlation_matrix(assets)
        assert matrix["A"]["A"] == 1.0
        assert matrix["B"]["B"] == 1.0
        assert abs(matrix["A"]["B"] - matrix["B"]["A"]) < 0.001

    def test_rolling_correlation(self):
        x = _gen_returns(200, seed=1)
        y = _gen_returns(200, seed=2)
        rc = CorrelationAnalysis.rolling_correlation(x, y, window=60)
        assert len(rc) == 200 - 60 + 1
        for c in rc:
            assert -1 <= c <= 1

    def test_rolling_correlation_short(self):
        x = [0.01] * 30
        y = [0.01] * 30
        assert CorrelationAnalysis.rolling_correlation(x, y, 60) == []

    def test_diversification_ratio(self):
        weights = [0.5, 0.5]
        stds = [0.20, 0.20]
        corr = [[1.0, 0.3], [0.3, 1.0]]
        dr = CorrelationAnalysis.diversification_ratio(weights, stds, corr)
        assert dr > 1.0  # diversified portfolio

    def test_diversification_ratio_perfect_corr(self):
        weights = [0.5, 0.5]
        stds = [0.20, 0.20]
        corr = [[1.0, 1.0], [1.0, 1.0]]
        dr = CorrelationAnalysis.diversification_ratio(weights, stds, corr)
        assert abs(dr - 1.0) < 0.01

    def test_diversification_ratio_empty(self):
        assert CorrelationAnalysis.diversification_ratio([], [], []) == 0.0


# ═══════════════════════════════════════════════════════════════════════
# ScenarioTester
# ═══════════════════════════════════════════════════════════════════════

class TestScenarioTester:
    def test_apply_scenario(self):
        positions = [
            PortfolioPosition("SPY", 0.60, asset_class="equities"),
            PortfolioPosition("TLT", 0.30, asset_class="bonds"),
            PortfolioPosition("GLD", 0.10, asset_class="commodities"),
        ]
        result = ScenarioTester.apply_scenario(positions, ScenarioTester.HISTORICAL_SCENARIOS["gfc_2008"])
        assert result["total_pnl"] < 0
        assert len(result["positions"]) == 3
        assert result["worst_hit"] != ""

    def test_all_historical_scenarios(self):
        positions = [
            PortfolioPosition("SPY", 0.70, asset_class="equities"),
            PortfolioPosition("AGG", 0.30, asset_class="bonds"),
        ]
        results = ScenarioTester.all_historical_scenarios(positions)
        assert "gfc_2008" in results
        assert "covid_2020" in results
        assert len(results) == 6

    def test_custom_scenario(self):
        positions = [
            PortfolioPosition("SPY", 1.0, asset_class="equities"),
        ]
        result = ScenarioTester.custom_scenario(positions, {"equities": -0.50})
        assert abs(result["total_pnl"] + 0.50) < 0.001

    def test_empty_positions(self):
        result = ScenarioTester.apply_scenario([], {"equities": -0.2})
        assert result["total_pnl"] == 0.0

    def test_gfc_worst_for_equities(self):
        positions = [
            PortfolioPosition("EQ", 0.5, asset_class="equities"),
            PortfolioPosition("BD", 0.5, asset_class="bonds"),
        ]
        result = ScenarioTester.apply_scenario(positions, ScenarioTester.HISTORICAL_SCENARIOS["gfc_2008"])
        eq_pnl = next(p for p in result["positions"] if p["symbol"] == "EQ")
        bd_pnl = next(p for p in result["positions"] if p["symbol"] == "BD")
        assert eq_pnl["pnl"] < 0
        assert bd_pnl["pnl"] > 0


# ═══════════════════════════════════════════════════════════════════════
# RiskClassifier
# ═══════════════════════════════════════════════════════════════════════

class TestRiskClassifier:
    def test_minimal_risk(self):
        result = RiskClassifier.classify(0.005, 0.02, 0.05)
        assert result["level"] == "minimal"

    def test_extreme_risk(self):
        result = RiskClassifier.classify(0.10, 0.50, 0.50)
        assert result["level"] == "extreme"

    def test_moderate_risk(self):
        result = RiskClassifier.classify(0.025, 0.10, 0.12)
        assert result["level"] in ("low", "moderate")

    def test_score_ranges(self):
        result = RiskClassifier.classify(0.10, 0.50, 0.50)
        assert result["score"] >= 70

    def test_structure(self):
        result = RiskClassifier.classify(0.02, 0.10, 0.15)
        assert "level" in result
        assert "score" in result
        assert "var_contribution" in result


# ═══════════════════════════════════════════════════════════════════════
# QuantitativeRiskEngine Orchestrator
# ═══════════════════════════════════════════════════════════════════════

class TestQuantitativeRiskEngine:
    @pytest.fixture
    def engine(self):
        return QuantitativeRiskEngine()

    @pytest.fixture
    def returns(self):
        return _gen_returns(500)

    def test_historical_var(self, engine, returns):
        result = engine.historical_var(returns)
        assert "var_95" in result
        assert "cvar_99" in result
        assert result["method"] == "historical"

    def test_parametric_var(self, engine):
        result = engine.parametric_var(0.0005, 0.02)
        assert "var_95" in result
        assert result["method"] == "parametric"

    def test_monte_carlo_var(self, engine):
        result = engine.monte_carlo_var(0.0005, 0.02, 5000)
        assert result["method"] == "monte_carlo"

    def test_drawdown_analysis(self, engine, returns):
        result = engine.drawdown_analysis(returns)
        assert "max_drawdown" in result
        assert "recovered" in result

    def test_performance_summary(self, engine, returns):
        result = engine.performance_summary(returns)
        assert "sharpe" in result
        assert "sortino" in result
        assert "calmar" in result

    def test_performance_with_benchmark(self, engine, returns):
        bench = _gen_returns(500, seed=99)
        result = engine.performance_summary(returns, bench)
        assert "information_ratio" in result
        assert "beta" in result
        assert "alpha" in result

    def test_tail_risk(self, engine, returns):
        result = engine.tail_risk(returns)
        assert "category" in result
        assert "kurtosis" in result

    def test_stress_test(self, engine):
        positions = [
            PortfolioPosition("EQ", 0.6, asset_class="equities"),
            PortfolioPosition("BD", 0.4, asset_class="bonds"),
        ]
        result = engine.stress_test(positions)
        assert len(result) == 6

    def test_risk_classification(self, engine, returns):
        result = engine.risk_classification(returns)
        assert "level" in result
        assert result["level"] in [e.value for e in RiskLevel]

    def test_full_risk_report(self, engine, returns):
        report = engine.full_risk_report(returns)
        assert "historical_var" in report
        assert "drawdown" in report
        assert "performance" in report
        assert "tail_risk" in report
        assert "risk_level" in report
        assert "annualized_vol" in report

    def test_full_risk_report_with_benchmark(self, engine, returns):
        bench = _gen_returns(500, seed=99)
        report = engine.full_risk_report(returns, bench)
        assert "information_ratio" in report["performance"]

    def test_capabilities(self, engine):
        caps = engine.capabilities()
        assert caps["engine"] == "QuantitativeRiskEngine"
        assert len(caps["features"]) > 10


# ═══════════════════════════════════════════════════════════════════════
# Property-Based Tests
# ═══════════════════════════════════════════════════════════════════════

class TestPropertyBased:
    @pytest.mark.parametrize("seed", range(10))
    def test_var99_gte_var95(self, seed):
        rets = _gen_returns(500, seed=seed)
        v95 = HistoricalVaR.calculate(rets, 0.95)
        v99 = HistoricalVaR.calculate(rets, 0.99)
        assert v99 >= v95

    @pytest.mark.parametrize("seed", range(10))
    def test_cvar_gte_var(self, seed):
        rets = _gen_returns(500, seed=seed)
        var = HistoricalVaR.calculate(rets, 0.95)
        cvar = HistoricalVaR.cvar(rets, 0.95)
        assert cvar >= var

    @pytest.mark.parametrize("seed", range(5))
    def test_drawdown_bounded(self, seed):
        rets = _gen_returns(252, seed=seed)
        dd = DrawdownCalculator.calculate(rets)
        assert 0 <= dd.max_drawdown <= 1.0

    @pytest.mark.parametrize("n", [10, 50, 100, 252, 500, 1000])
    def test_var_scales_with_data(self, n):
        rets = _gen_returns(n, seed=42)
        var = HistoricalVaR.calculate(rets, 0.95)
        assert isinstance(var, float)

    @pytest.mark.parametrize("corr_val", [-0.5, 0.0, 0.3, 0.7, 1.0])
    def test_portfolio_var_monotonic_corr(self, corr_val):
        w = [0.5, 0.5]
        m = [0.001, 0.001]
        s = [0.02, 0.02]
        corr = [[1, corr_val], [corr_val, 1]]
        var = ParametricVaR.portfolio_var(w, m, s, corr)
        assert var >= 0


# ═══════════════════════════════════════════════════════════════════════
# Stress / Edge Case Tests
# ═══════════════════════════════════════════════════════════════════════

class TestStressAndEdge:
    def test_var_single_return(self):
        var = HistoricalVaR.calculate([0.01], 0.95)
        assert isinstance(var, float)

    def test_var_constant_returns(self):
        var = HistoricalVaR.calculate([0.005] * 100, 0.95)
        assert var == -0.005  # constant positive is no loss

    def test_sharpe_constant_returns(self):
        rets = [0.005] * 100
        sr = PerformanceRatios.sharpe_ratio(rets)
        assert sr == 0.0  # zero vol

    def test_correlation_constant(self):
        x = [0.01] * 100
        y = _gen_returns(100)
        assert CorrelationAnalysis.pearson(x, y) == 0.0

    def test_large_portfolio_scenario(self):
        positions = [
            PortfolioPosition(f"SYM_{i}", 1.0/20, asset_class="equities")
            for i in range(20)
        ]
        result = ScenarioTester.apply_scenario(positions, {"equities": -0.30})
        assert abs(result["total_pnl"] + 0.30) < 0.001

    def test_mc_var_zero_vol(self):
        result = MonteCarloVaR.full_mc_var(0.001, 0.0, 100, seed=42)
        # zero vol means each sim is exactly the mean
        assert result.var_95 <= 0  # no loss when positive mean, zero vol

    def test_tail_ratio_empty(self):
        assert TailRiskAnalyzer.tail_ratio([]) == 1.0

    def test_very_long_returns(self):
        rets = _gen_returns(10000, seed=42)
        var = HistoricalVaR.calculate(rets, 0.99)
        dd = DrawdownCalculator.calculate(rets)
        assert var > 0
        assert dd.max_drawdown > 0
