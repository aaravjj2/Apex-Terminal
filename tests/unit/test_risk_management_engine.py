"""
test_risk_management_engine.py — Tests for Risk Management Engine
==================================================================
Tests: PositionSizer, ExposureLimiter, MarginCalculator, GreeksRisk,
       ScenarioEngine, ComplianceChecker, RiskReporter, CorrelationRisk,
       TailRisk, LiquidityRisk.
"""

import pytest
import numpy as np
import pandas as pd

from phase1.services.risk_management_engine import (
    PositionSizer, ExposureLimiter, MarginCalculator, GreeksRisk,
    ScenarioEngine, ComplianceChecker, RiskReporter, CorrelationRisk,
    TailRisk, LiquidityRisk,
    RiskLevel, SizingMethod, MarginType, RiskAlert, RiskLimits,
    GreeksSnapshot,
)


# ═══════════════════════════════════════════════════════════════════════════════
#  Fixtures
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def sample_positions():
    return [
        {"symbol": "AAPL", "market_value": 15000, "side": "long",
         "asset_class": "equity", "sector": "Tech", "quantity": 100,
         "avg_daily_volume": 50_000_000, "spread_bps": 2, "market_cap": 3e12},
        {"symbol": "GOOG", "market_value": 10000, "side": "long",
         "asset_class": "equity", "sector": "Tech", "quantity": 50,
         "avg_daily_volume": 20_000_000, "spread_bps": 3, "market_cap": 2e12},
        {"symbol": "JPM", "market_value": 8000, "side": "long",
         "asset_class": "equity", "sector": "Finance", "quantity": 60,
         "avg_daily_volume": 10_000_000, "spread_bps": 4, "market_cap": 5e11},
    ]


@pytest.fixture
def sample_returns():
    rng = np.random.RandomState(42)
    return pd.Series(rng.randn(300) * 0.01)


@pytest.fixture
def multi_asset_returns():
    rng = np.random.RandomState(42)
    return pd.DataFrame({
        'AAPL': rng.randn(300) * 0.015,
        'GOOG': rng.randn(300) * 0.012,
        'JPM': rng.randn(300) * 0.013,
    })


# ═══════════════════════════════════════════════════════════════════════════════
#  Test PositionSizer
# ═══════════════════════════════════════════════════════════════════════════════

class TestPositionSizer:
    def test_fixed_fractional(self):
        result = PositionSizer.fixed_fractional(100000, 0.02, 150, 145)
        assert result["shares"] > 0
        assert result["risk_amount"] == 2000

    def test_fixed_fractional_zero_risk(self):
        result = PositionSizer.fixed_fractional(100000, 0.02, 150, 150)
        assert result["shares"] == 0

    def test_kelly(self):
        result = PositionSizer.kelly(0.55, 200, 100)
        assert result["kelly_full"] > 0
        assert result["kelly_pct"] > 0

    def test_kelly_no_edge(self):
        result = PositionSizer.kelly(0.3, 100, 200)
        assert result["kelly_full"] < 0
        assert result["recommended_pct"] == 0

    def test_volatility_scaled(self):
        result = PositionSizer.volatility_scaled(100000, 0.10, 0.25, 150)
        assert result["shares"] > 0
        assert result["vol_ratio"] == pytest.approx(0.4)

    def test_optimal_f(self):
        trades = [100, -50, 200, -30, 150, -80, 50, -20]
        result = PositionSizer.optimal_f(trades)
        assert 0 < result["optimal_f"] < 1

    def test_atr_based(self):
        result = PositionSizer.atr_based(100000, 0.02, 2.5, atr_multiple=2, price=150)
        assert result["shares"] > 0
        assert result["stop_distance"] == 5.0

    def test_equal_weight(self):
        result = PositionSizer.equal_weight(100000, 5, 150)
        assert result["shares"] > 0
        assert result["weight"] == 20.0

    def test_max_drawdown_sized(self):
        result = PositionSizer.max_drawdown_sized(100000, 0.10, 0.20, 150)
        assert result["shares"] > 0


# ═══════════════════════════════════════════════════════════════════════════════
#  Test ExposureLimiter
# ═══════════════════════════════════════════════════════════════════════════════

class TestExposureLimiter:
    def test_position_limit_ok(self):
        result = ExposureLimiter.check_position_limit(5000, 100000, 0.10)
        assert result["allowed"]
        assert result["headroom"] > 0

    def test_position_limit_breach(self):
        result = ExposureLimiter.check_position_limit(15000, 100000, 0.10)
        assert not result["allowed"]

    def test_sector_limit_ok(self):
        result = ExposureLimiter.check_sector_limit(
            {"Tech": 20000, "Finance": 10000}, 100000, 0.30
        )
        assert result["compliant"]

    def test_sector_limit_breach(self):
        result = ExposureLimiter.check_sector_limit(
            {"Tech": 40000, "Finance": 10000}, 100000, 0.30
        )
        assert not result["compliant"]
        assert len(result["breaches"]) == 1

    def test_leverage_check(self):
        limits = RiskLimits()
        result = ExposureLimiter.check_leverage(180000, 50000, 100000, limits)
        assert result["gross_leverage"] == 1.8
        assert result["gross_ok"]

    def test_leverage_breach(self):
        limits = RiskLimits(max_gross_leverage=1.5)
        result = ExposureLimiter.check_leverage(200000, 50000, 100000, limits)
        assert not result["gross_ok"]

    def test_concentration(self):
        result = ExposureLimiter.check_concentration([0.5, 0.3, 0.2])
        assert result["hhi"] > 0
        assert result["effective_positions"] > 0

    def test_max_additional_exposure(self):
        result = ExposureLimiter.max_additional_exposure(150000, 100000, 2.0)
        assert result == 50000


# ═══════════════════════════════════════════════════════════════════════════════
#  Test MarginCalculator
# ═══════════════════════════════════════════════════════════════════════════════

class TestMarginCalculator:
    def test_reg_t_equity(self):
        result = MarginCalculator.reg_t_equity(10000, is_long=True)
        assert result["initial_margin"] == 5000
        assert result["maintenance_margin"] == 2500

    def test_reg_t_short(self):
        result = MarginCalculator.reg_t_equity(10000, is_long=False)
        assert result["maintenance_margin"] == 3000

    def test_long_call_margin(self):
        result = MarginCalculator.reg_t_options("long_call", 150, 155, 3.0, 1)
        assert result["margin"] == 300
        assert result["type"] == "debit"

    def test_short_call_margin(self):
        result = MarginCalculator.reg_t_options("short_call", 150, 155, 3.0, 1)
        assert result["margin"] > 0
        assert result["type"] == "credit"

    def test_portfolio_margin(self, sample_positions):
        result = MarginCalculator.portfolio_margin_estimate(sample_positions)
        assert result["total_margin"] > 0

    def test_margin_call_price(self):
        result = MarginCalculator.margin_call_price(50000, 0.25, 50000, 1000)
        assert result > 0


# ═══════════════════════════════════════════════════════════════════════════════
#  Test GreeksRisk
# ═══════════════════════════════════════════════════════════════════════════════

class TestGreeksRisk:
    def test_aggregate_greeks(self):
        positions = [
            {"delta": 0.60, "gamma": 0.05, "theta": -0.10, "vega": 0.20,
             "rho": 0.01, "vanna": 0, "charm": 0, "quantity": 10, "multiplier": 100},
            {"delta": -0.30, "gamma": 0.03, "theta": -0.05, "vega": 0.15,
             "rho": 0.005, "vanna": 0, "charm": 0, "quantity": 5, "multiplier": 100},
        ]
        greeks = GreeksRisk.aggregate_greeks(positions)
        assert greeks.delta == 450  # 0.60*10*100 + (-0.30)*5*100
        assert greeks.gamma > 0

    def test_greeks_pnl_estimate(self):
        greeks = GreeksSnapshot(delta=500, gamma=50, theta=-100, vega=200)
        result = GreeksRisk.greeks_pnl_estimate(greeks, price_change=2.0, vol_change=0.01)
        assert result["delta_pnl"] == 1000
        assert result["vega_pnl"] == 2.0

    def test_stress_matrix(self):
        greeks = GreeksSnapshot(delta=500, gamma=50, vega=200)
        result = GreeksRisk.greeks_stress_matrix(greeks, steps=5)
        assert len(result["pnl_matrix"]) == 5
        assert len(result["pnl_matrix"][0]) == 5

    def test_delta_hedge(self):
        result = GreeksRisk.delta_hedge_ratio(350, 150)
        assert result["shares_needed"] == -350
        assert result["hedge_cost"] > 0


# ═══════════════════════════════════════════════════════════════════════════════
#  Test ScenarioEngine
# ═══════════════════════════════════════════════════════════════════════════════

class TestScenarioEngine:
    def test_run_scenario(self, sample_positions):
        scenario = {"AAPL": -0.10, "GOOG": -0.15, "JPM": -0.05}
        result = ScenarioEngine.run_scenario(sample_positions, scenario)
        assert result["total_pnl"] < 0

    def test_historical_scenarios(self, sample_positions):
        result = ScenarioEngine.run_historical_scenarios(sample_positions)
        assert "2008_financial_crisis" in result
        assert "2020_covid_crash" in result

    def test_sensitivity_analysis(self, sample_positions):
        result = ScenarioEngine.sensitivity_analysis(sample_positions)
        assert len(result["sensitivity"]) == 10

    def test_custom_scenario(self, sample_positions):
        result = ScenarioEngine.custom_scenario(
            sample_positions, {"AAPL": -0.20, "GOOG": 0.10, "JPM": -0.05}
        )
        assert "total_pnl" in result


# ═══════════════════════════════════════════════════════════════════════════════
#  Test ComplianceChecker
# ═══════════════════════════════════════════════════════════════════════════════

class TestComplianceChecker:
    def test_pre_trade_ok(self, sample_positions):
        limits = RiskLimits()
        result = ComplianceChecker.pre_trade_check(
            "NFLX", "long", 10, 400, 100000, sample_positions, limits
        )
        assert result["approved"]

    def test_pre_trade_size_breach(self, sample_positions):
        limits = RiskLimits(max_position_size_pct=0.05)
        result = ComplianceChecker.pre_trade_check(
            "NFLX", "long", 200, 400, 100000, sample_positions, limits
        )
        assert not result["approved"]

    def test_portfolio_compliance_ok(self, sample_positions):
        limits = RiskLimits()  # max_position_size_pct=0.10
        # Use large enough equity so individual positions are under 10%
        result = ComplianceChecker.portfolio_compliance(sample_positions, 500000, limits)
        assert result["compliant"]

    def test_portfolio_compliance_breach(self, sample_positions):
        limits = RiskLimits(max_position_size_pct=0.05)
        result = ComplianceChecker.portfolio_compliance(sample_positions, 100000, limits)
        assert not result["compliant"]


# ═══════════════════════════════════════════════════════════════════════════════
#  Test RiskReporter
# ═══════════════════════════════════════════════════════════════════════════════

class TestRiskReporter:
    def test_daily_report(self, sample_positions, sample_returns):
        limits = RiskLimits()
        report = RiskReporter.daily_risk_report(
            sample_positions, 100000, sample_returns, limits
        )
        assert "exposure" in report
        assert "risk_metrics" in report
        assert "compliance" in report

    def test_daily_report_with_greeks(self, sample_positions, sample_returns):
        limits = RiskLimits()
        greeks = GreeksSnapshot(delta=500, gamma=50, theta=-100, vega=200)
        report = RiskReporter.daily_risk_report(
            sample_positions, 100000, sample_returns, limits, greeks=greeks
        )
        assert "greeks" in report
        assert report["greeks"]["delta"] == 500


# ═══════════════════════════════════════════════════════════════════════════════
#  Test CorrelationRisk
# ═══════════════════════════════════════════════════════════════════════════════

class TestCorrelationRisk:
    def test_diversification_ratio(self):
        w = np.array([0.4, 0.3, 0.3])
        cov = np.array([[0.04, 0.01, 0.005],
                         [0.01, 0.03, 0.008],
                         [0.005, 0.008, 0.02]])
        dr = CorrelationRisk.diversification_ratio(w, cov)
        assert dr >= 1.0  # DR >= 1 for non-perfectly-correlated assets

    def test_effective_correlation(self):
        w = np.array([0.5, 0.5])
        cov = np.array([[0.04, 0.02], [0.02, 0.04]])
        rho = CorrelationRisk.effective_correlation(w, cov)
        assert -1 <= rho <= 1

    def test_correlation_regime(self, multi_asset_returns):
        result = CorrelationRisk.correlation_regime(multi_asset_returns, window=30)
        valid = result.dropna()
        assert len(valid) > 0

    def test_crowded_trade_score(self, multi_asset_returns):
        result = CorrelationRisk.crowded_trade_score(multi_asset_returns, threshold=0.3, window=60)
        assert "score" in result
        assert "pairs" in result


# ═══════════════════════════════════════════════════════════════════════════════
#  Test TailRisk
# ═══════════════════════════════════════════════════════════════════════════════

class TestTailRisk:
    def test_tail_ratio(self, sample_returns):
        tr = TailRisk.tail_ratio(sample_returns)
        assert tr > 0

    def test_gain_to_pain(self, sample_returns):
        gtp = TailRisk.gain_to_pain(sample_returns)
        assert isinstance(gtp, float)

    def test_tail_dependence(self):
        rng = np.random.RandomState(42)
        a = pd.Series(rng.randn(500))
        b = pd.Series(rng.randn(500))
        result = TailRisk.tail_dependence(a, b)
        assert "lower" in result
        assert "upper" in result
        assert 0 <= result["lower"] <= 1
        assert 0 <= result["upper"] <= 1

    def test_crash_probability(self, sample_returns):
        prob = TailRisk.crash_probability(sample_returns, threshold=-0.05, window=60)
        assert 0 <= prob <= 1

    def test_expected_shortfall_decomposition(self, multi_asset_returns):
        w = np.array([0.33, 0.33, 0.34])
        result = TailRisk.expected_shortfall_decomposition(multi_asset_returns, w)
        assert "total_es" in result
        assert "contributions" in result


# ═══════════════════════════════════════════════════════════════════════════════
#  Test LiquidityRisk
# ═══════════════════════════════════════════════════════════════════════════════

class TestLiquidityRisk:
    def test_days_to_liquidate(self):
        dtl = LiquidityRisk.days_to_liquidate(10000, 1_000_000, 0.10)
        assert dtl == 0.1  # 10000 / 100000

    def test_market_impact(self):
        result = LiquidityRisk.market_impact_estimate(
            50000, 1_000_000, spread_bps=5, price=150, volatility=0.25
        )
        assert result["total_impact_bps"] > 0
        assert result["total_cost"] > 0

    def test_liquidity_score(self):
        score = LiquidityRisk.liquidity_score(50_000_000, 2, 3e12)
        assert 0 <= score <= 1

    def test_portfolio_liquidity(self, sample_positions):
        result = LiquidityRisk.portfolio_liquidity(sample_positions)
        assert result["avg_days_to_liquidate"] >= 0
        assert len(result["scores"]) == 3

    def test_empty_portfolio(self):
        result = LiquidityRisk.portfolio_liquidity([])
        assert result["avg_days_to_liquidate"] == 0
