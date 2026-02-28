"""
Tests — Position Sizing Engine
=================================
Kelly, fixed fractional, percent risk, volatility, optimal-f,
anti-martingale, max drawdown, margin-aware, portfolio heat,
scaling, risk-reward, multi-setup allocation.
"""

import pytest
import math
import numpy as np
from phase1.services.position_sizing_engine import (
    SizingMethod, RiskUnit,
    PositionSizeResult, PortfolioRiskBudget, TradeSetup,
    KellyCriterion, FixedFractionalSizer, PercentRiskSizer,
    VolatilityBasedSizer, OptimalFCalculator, AntiMartingaleSizer,
    MaxDrawdownSizer, MarginAwareSizer, PortfolioHeatMonitor,
    PositionScalingManager, RiskRewardAnalyzer, MultiSetupAllocator,
    PositionSizingEngine,
)


# ─── PositionSizeResult Tests ───────────────────────────────────────────────

class TestPositionSizeResult:
    def test_to_dict(self):
        r = PositionSizeResult("test", 100, 10000, 500, 0.005, 0.10, 5.0, "note")
        d = r.to_dict()
        assert d["method"] == "test"
        assert d["shares"] == 100
        assert d["notes"] == "note"

    def test_defaults(self):
        r = PositionSizeResult("x", 0, 0, 0, 0, 0)
        assert r.stop_distance == 0.0
        assert r.notes == ""


# ─── TradeSetup Tests ───────────────────────────────────────────────────────

class TestTradeSetup:
    def test_stop_distance(self):
        ts = TradeSetup("AAPL", 150.0, 145.0, 160.0)
        assert ts.stop_distance == 5.0
        assert abs(ts.stop_distance_pct - 5 / 150) < 0.0001

    def test_reward_risk_ratio(self):
        ts = TradeSetup("AAPL", 150.0, 145.0, 165.0)
        assert ts.reward_risk_ratio == 3.0  # 15/5

    def test_reward_risk_no_target(self):
        ts = TradeSetup("AAPL", 150.0, 145.0)
        assert ts.reward_risk_ratio == 1.0

    def test_to_dict(self):
        ts = TradeSetup("GOOG", 100.0, 95.0, 110.0)
        d = ts.to_dict()
        assert d["symbol"] == "GOOG"
        assert d["stop_distance"] == 5.0

    def test_zero_entry(self):
        ts = TradeSetup("X", 0.0, 0.0)
        assert ts.stop_distance_pct == 0.0
        assert ts.reward_risk_ratio == 0.0


# ─── KellyCriterion Tests ───────────────────────────────────────────────────

class TestKellyCriterion:
    def test_full_kelly_positive(self):
        # 60% win rate, 2:1 payout
        k = KellyCriterion.full_kelly(0.6, 2.0, 1.0)
        # K = 0.6 - 0.4/2 = 0.4
        assert abs(k - 0.4) < 0.001

    def test_full_kelly_coin_flip(self):
        # 50/50 at 1:1 = 0
        k = KellyCriterion.full_kelly(0.5, 1.0, 1.0)
        assert k == 0.0

    def test_full_kelly_losing_edge(self):
        k = KellyCriterion.full_kelly(0.3, 1.0, 1.0)
        assert k == 0.0  # Clamped to 0

    def test_half_kelly(self):
        k = KellyCriterion.fractional_kelly(0.6, 2.0, 1.0, 0.5)
        assert abs(k - 0.2) < 0.001

    def test_kelly_from_series(self):
        returns = [0.05, -0.03, 0.08, -0.02, 0.04, -0.01, 0.06, -0.025, 0.07, -0.015]
        k = KellyCriterion.kelly_from_series(returns)
        assert k > 0  # Should have positive edge

    def test_kelly_from_series_short(self):
        assert KellyCriterion.kelly_from_series([0.01]) == 0.0

    def test_kelly_from_series_all_wins(self):
        assert KellyCriterion.kelly_from_series([0.01, 0.02, 0.03]) == 0.0

    def test_kelly_multiple_bets(self):
        outcomes = [
            {"probability": 0.55, "payout_ratio": 2.0},
            {"probability": 0.60, "payout_ratio": 1.5},
        ]
        k = KellyCriterion.kelly_for_multiple_bets(outcomes)
        assert 0 < k <= 1.0

    def test_zero_avg_loss(self):
        assert KellyCriterion.full_kelly(0.5, 1.0, 0) == 0.0


# ─── FixedFractionalSizer Tests ─────────────────────────────────────────────

class TestFixedFractionalSizer:
    def test_basic(self):
        r = FixedFractionalSizer.size(100000, 0.10, 50.0)
        assert r.shares == 200
        assert r.position_value == 10000

    def test_zero_capital(self):
        r = FixedFractionalSizer.size(0, 0.10, 50.0)
        assert r.shares == 0

    def test_zero_price(self):
        r = FixedFractionalSizer.size(100000, 0.10, 0)
        assert r.shares == 0


# ─── PercentRiskSizer Tests ─────────────────────────────────────────────────

class TestPercentRiskSizer:
    def test_basic(self):
        # 100k capital, 2% risk, entry=100, stop=95
        r = PercentRiskSizer.size(100000, 0.02, 100.0, 95.0)
        # Risk = $2000, stop_distance = $5, shares = 400
        assert r.shares == 400
        assert r.risk_amount == 2000
        assert abs(r.risk_percent - 0.02) < 0.001

    def test_tight_stop(self):
        r = PercentRiskSizer.size(100000, 0.02, 100.0, 99.0)
        # Risk = $2000, stop = $1, shares = 2000
        assert r.shares == 2000

    def test_wide_stop(self):
        r = PercentRiskSizer.size(100000, 0.02, 100.0, 80.0)
        # Risk = $2000, stop = $20, shares = 100
        assert r.shares == 100

    def test_same_entry_stop(self):
        r = PercentRiskSizer.size(100000, 0.02, 100.0, 100.0)
        assert r.shares == 0


# ─── VolatilityBasedSizer Tests ──────────────────────────────────────────────

class TestVolatilityBasedSizer:
    def test_atr_sizing(self):
        r = VolatilityBasedSizer.size_by_atr(100000, 0.02, 100.0, 2.5, 2.0)
        # Risk=$2000, stop=2.5*2=5, shares=400
        assert r.shares == 400
        assert r.stop_distance == 5.0

    def test_zero_atr(self):
        r = VolatilityBasedSizer.size_by_atr(100000, 0.02, 100.0, 0, 2.0)
        assert r.shares == 0

    def test_volatility_target(self):
        r = VolatilityBasedSizer.size_by_volatility(100000, 0.10, 100.0, 0.015)
        assert r.shares > 0
        assert "annual_vol" in r.notes

    def test_zero_vol(self):
        r = VolatilityBasedSizer.size_by_volatility(100000, 0.10, 100.0, 0)
        assert r.shares == 0


# ─── OptimalFCalculator Tests ───────────────────────────────────────────────

class TestOptimalFCalculator:
    def test_find_optimal_f(self):
        trades = [100, -50, 80, -40, 120, -30, 60, -45, 90, -25]
        f, twr = OptimalFCalculator.find_optimal_f(trades)
        assert 0 < f <= 1.0
        assert twr > 1.0

    def test_empty_trades(self):
        f, twr = OptimalFCalculator.find_optimal_f([])
        assert f == 0.0

    def test_all_wins(self):
        f, twr = OptimalFCalculator.find_optimal_f([10, 20, 30])
        # No losses => max_loss = 1.0. With positive returns, any f can grow.
        assert twr >= 1.0

    def test_size_from_f(self):
        r = OptimalFCalculator.size_from_optimal_f(100000, 0.3, 5.0, 100.0)
        # (100000 * 0.3) / 5 = 6000 shares
        assert r.shares == 6000


# ─── AntiMartingaleSizer Tests ───────────────────────────────────────────────

class TestAntiMartingaleSizer:
    def test_neutral(self):
        r = AntiMartingaleSizer.size(100000, 0.02, 100.0, 95.0, 0, 0)
        assert r.shares == 400  # Same as basic percent risk

    def test_winning_streak(self):
        r = AntiMartingaleSizer.size(100000, 0.02, 100.0, 95.0, 3, 0)
        assert r.shares > 400  # Should be larger

    def test_losing_streak(self):
        r = AntiMartingaleSizer.size(100000, 0.02, 100.0, 95.0, 0, 2)
        assert r.shares < 400  # Should be smaller

    def test_capped_at_10pct(self):
        r = AntiMartingaleSizer.size(100000, 0.02, 100.0, 95.0, 20, 0)
        # Even with huge win streak, capped at 10% risk
        assert r.risk_percent <= 0.101


# ─── MaxDrawdownSizer Tests ─────────────────────────────────────────────────

class TestMaxDrawdownSizer:
    def test_single_position(self):
        r = MaxDrawdownSizer.size(100000, 0.20, 100.0, 95.0, 1, 0.5)
        assert r.shares > 0

    def test_multiple_positions(self):
        r1 = MaxDrawdownSizer.size(100000, 0.20, 100.0, 95.0, 1, 0.5)
        r5 = MaxDrawdownSizer.size(100000, 0.20, 100.0, 95.0, 5, 0.5)
        assert r5.shares < r1.shares  # More positions = smaller each

    def test_high_correlation(self):
        r_low = MaxDrawdownSizer.size(100000, 0.20, 100.0, 95.0, 5, 0.2)
        r_high = MaxDrawdownSizer.size(100000, 0.20, 100.0, 95.0, 5, 0.9)
        assert r_high.shares < r_low.shares


# ─── MarginAwareSizer Tests ─────────────────────────────────────────────────

class TestMarginAwareSizer:
    def test_no_margin_used(self):
        r = MarginAwareSizer.size(100000, 0.02, 100.0, 95.0, 2.0, 0)
        assert r.shares == 400

    def test_high_margin_used(self):
        r = MarginAwareSizer.size(100000, 0.02, 100.0, 95.0, 2.0, 90000)
        # Buying power = (100k - 90k) * 2 = 20k, so only 200 shares max
        assert r.shares <= 200

    def test_full_margin_used(self):
        r = MarginAwareSizer.size(100000, 0.02, 100.0, 95.0, 2.0, 100000)
        assert r.shares == 0


# ─── PortfolioHeatMonitor Tests ──────────────────────────────────────────────

class TestPortfolioHeatMonitor:
    def test_calculate_heat(self):
        positions = [
            {"shares": 100, "entry": 100, "stop": 95, "sector": "tech"},
            {"shares": 200, "entry": 50, "stop": 48, "sector": "finance"},
        ]
        h = PortfolioHeatMonitor.calculate_heat(positions, 100000)
        assert h["total_heat"] == 900  # 100*5 + 200*2
        assert abs(h["heat_pct"] - 0.009) < 0.001
        assert "tech" in h["by_sector"]

    def test_empty(self):
        h = PortfolioHeatMonitor.calculate_heat([], 100000)
        assert h["total_heat"] == 0

    def test_remaining_budget(self):
        remaining = PortfolioHeatMonitor.remaining_risk_budget(0.03, 0.06, 100000)
        assert remaining == 3000

    def test_can_add_position(self):
        assert PortfolioHeatMonitor.can_add_position(0.04, 0.01, 0.06) == True
        assert PortfolioHeatMonitor.can_add_position(0.05, 0.02, 0.06) == False


# ─── PositionScalingManager Tests ────────────────────────────────────────────

class TestPositionScalingManager:
    def test_scale_in_equal(self):
        plan = PositionScalingManager.scale_in_plan(300, 3, "equal")
        assert len(plan) == 3
        assert sum(e["shares"] for e in plan) == 300

    def test_scale_in_pyramid(self):
        plan = PositionScalingManager.scale_in_plan(300, 3, "pyramid")
        assert len(plan) == 3
        assert plan[0]["shares"] > plan[2]["shares"]
        assert sum(e["shares"] for e in plan) == 300

    def test_scale_in_inverted(self):
        plan = PositionScalingManager.scale_in_plan(300, 3, "inverted_pyramid")
        assert plan[0]["shares"] < plan[2]["shares"]

    def test_scale_out(self):
        plan = PositionScalingManager.scale_out_plan(300, [110, 120, 130], 100)
        assert len(plan) == 3
        assert plan[-1]["remaining_after"] == 0
        assert all(e["projected_pnl"] > 0 for e in plan)

    def test_scale_empty(self):
        assert PositionScalingManager.scale_in_plan(0, 3) == []
        assert PositionScalingManager.scale_out_plan(100, [], 100) == []


# ─── RiskRewardAnalyzer Tests ────────────────────────────────────────────────

class TestRiskRewardAnalyzer:
    def test_expectancy_positive(self):
        exp = RiskRewardAnalyzer.expectancy(0.6, 2.0, 1.0)
        assert abs(exp - 0.8) < 0.001  # 0.6*2 - 0.4*1

    def test_expectancy_negative(self):
        exp = RiskRewardAnalyzer.expectancy(0.3, 1.0, 1.0)
        assert exp < 0

    def test_edge_ratio(self):
        assert RiskRewardAnalyzer.edge_ratio(2.0, 4.0) == 2.0

    def test_payoff_ratio(self):
        assert RiskRewardAnalyzer.payoff_ratio(3.0, 1.5) == 2.0

    def test_breakeven_win_rate(self):
        be = RiskRewardAnalyzer.breakeven_win_rate(2.0)
        assert abs(be - 1 / 3) < 0.001

    def test_should_take_trade_yes(self):
        result = RiskRewardAnalyzer.should_take_trade(0.6, 2.0, 1.0)
        assert result["take_trade"] == True
        assert result["expectancy"] > 0

    def test_should_take_trade_no(self):
        result = RiskRewardAnalyzer.should_take_trade(0.3, 1.0, 1.0)
        assert result["take_trade"] == False

    def test_risk_of_ruin_low(self):
        ror = RiskRewardAnalyzer.risk_of_ruin(0.6, 2.0, 0.02)
        assert 0 < ror < 0.1  # Low risk with good edge

    def test_risk_of_ruin_high(self):
        ror = RiskRewardAnalyzer.risk_of_ruin(0.45, 1.0, 0.10)
        assert ror > 0.5  # High risk with bad edge and high risk


# ─── MultiSetupAllocator Tests ──────────────────────────────────────────────

class TestMultiSetupAllocator:
    def setup_method(self):
        self.setups = [
            TradeSetup("AAPL", 150, 145, 160, win_rate=0.6, avg_win=2.0, avg_loss=1.0,
                       daily_volatility=0.015),
            TradeSetup("MSFT", 300, 290, 320, win_rate=0.55, avg_win=1.5, avg_loss=1.0,
                       daily_volatility=0.02),
        ]

    def test_equal_risk(self):
        result = MultiSetupAllocator.equal_risk_allocation(100000, self.setups)
        assert len(result) == 2
        # Both should have approximately equal risk
        r1 = result[0]["risk_pct"]
        r2 = result[1]["risk_pct"]
        assert abs(r1 - r2) < 0.01

    def test_expectancy_weighted(self):
        result = MultiSetupAllocator.expectancy_weighted_allocation(100000, self.setups)
        assert len(result) == 2
        assert all("weight" in r for r in result)

    def test_volatility_parity(self):
        result = MultiSetupAllocator.volatility_parity_allocation(100000, self.setups)
        assert len(result) == 2
        # Lower vol stock should get more shares proportionally
        assert result[0]["weight"] > result[1]["weight"]  # AAPL lower vol

    def test_empty_setups(self):
        assert MultiSetupAllocator.equal_risk_allocation(100000, []) == []


# ─── PositionSizingEngine Tests ──────────────────────────────────────────────

class TestPositionSizingEngine:
    def setup_method(self):
        self.engine = PositionSizingEngine(100000, 0.02)

    def test_kelly_size(self):
        r = self.engine.kelly_size(0.6, 2.0, 1.0, 100.0, 95.0)
        assert r.shares > 0
        assert "kelly" in r.method

    def test_percent_risk_size(self):
        r = self.engine.percent_risk_size(100.0, 95.0)
        assert r.shares == 400

    def test_volatility_size(self):
        r = self.engine.volatility_size(100.0, 2.5)
        assert r.shares > 0

    def test_fixed_fractional_size(self):
        r = self.engine.fixed_fractional_size(100.0)
        assert r.shares == 100  # 10% of 100k / 100

    def test_anti_martingale_size(self):
        r = self.engine.anti_martingale_size(100.0, 95.0, 2, 0)
        assert r.shares > 0

    def test_max_drawdown_size(self):
        r = self.engine.max_drawdown_size(100.0, 95.0)
        assert r.shares > 0

    def test_margin_size(self):
        r = self.engine.margin_size(100.0, 95.0)
        assert r.shares > 0

    def test_portfolio_heat(self):
        positions = [
            {"shares": 100, "entry": 100, "stop": 95, "sector": "tech"},
        ]
        h = self.engine.portfolio_heat(positions)
        assert h["total_heat"] == 500

    def test_scale_in(self):
        plan = self.engine.scale_in(300, 3)
        assert len(plan) == 3

    def test_scale_out(self):
        plan = self.engine.scale_out(300, [110, 120], 100)
        assert len(plan) == 2

    def test_evaluate_trade(self):
        result = self.engine.evaluate_trade(0.6, 2.0, 1.0)
        assert result["take_trade"] == True

    def test_risk_of_ruin(self):
        ror = self.engine.risk_of_ruin(0.6, 2.0)
        assert 0 <= ror <= 1.0

    def test_compare_methods(self):
        results = self.engine.compare_methods(100.0, 95.0, atr=2.5)
        assert len(results) >= 6
        methods = [r["method"] for r in results]
        assert "percent_risk" in methods
        assert "fixed_fractional" in methods

    def test_allocate_setups(self):
        setups = [
            TradeSetup("AAPL", 150, 145, 160),
            TradeSetup("GOOG", 100, 95, 110),
        ]
        result = self.engine.allocate_setups(setups)
        assert len(result) == 2

    def test_capabilities(self):
        caps = self.engine.capabilities()
        assert caps["engine"] == "PositionSizingEngine"
        assert len(caps["features"]) >= 15
        assert len(caps["sizing_methods"]) == len(SizingMethod)

    def test_zero_capital_engine(self):
        eng = PositionSizingEngine(0, 0.02)
        r = eng.percent_risk_size(100.0, 95.0)
        assert r.shares == 0
