"""
Tests — Multi-Asset Analysis Engine
=====================================
Cross-asset correlation, relative value, carry trade, yield curve,
macro regime, allocation, currency hedging, flight-to-quality.
"""

import pytest
import numpy as np
from datetime import datetime
from phase1.services.multi_asset_analysis_engine import (
    AssetClass, Currency, MacroFactor, AllocationMethod,
    AssetInfo, AssetReturn, CrossAssetCorrelation, YieldCurvePoint,
    CarryTradeResult, MacroRegime,
    CrossAssetAnalyzer, RelativeValueAnalyzer, CarryTradeAnalyzer,
    YieldCurveAnalyzer, MacroFactorAnalyzer, MultiAssetAllocator,
    CurrencyHedger, FlightToQualityDetector, MultiAssetAnalysisEngine,
)


# ─── AssetInfo Tests ─────────────────────────────────────────────────────────

class TestAssetInfo:
    def test_to_dict(self):
        ai = AssetInfo("AAPL", "Apple Inc", AssetClass.EQUITY, Currency.USD, "Technology")
        d = ai.to_dict()
        assert d["symbol"] == "AAPL"
        assert d["asset_class"] == "equity"
        assert d["currency"] == "USD"
        assert d["sector"] == "Technology"

    def test_defaults(self):
        ai = AssetInfo("BTC", "Bitcoin", AssetClass.CRYPTO)
        assert ai.currency == Currency.USD
        assert ai.sector == ""


# ─── AssetReturn Tests ───────────────────────────────────────────────────────

class TestAssetReturn:
    def test_basic(self):
        ar = AssetReturn("T", [0.01, 0.02, -0.01, 0.005])
        assert ar.cumulative_return != 0
        assert ar.volatility > 0

    def test_empty(self):
        ar = AssetReturn("T", [])
        assert ar.cumulative_return == 0
        assert ar.annualized_return == 0
        assert ar.volatility == 0
        assert ar.sharpe_ratio == 0

    def test_to_dict(self):
        ar = AssetReturn("SPY", [0.01, -0.005, 0.015])
        d = ar.to_dict()
        assert d["symbol"] == "SPY"
        assert "cumulative_return" in d
        assert "annualized_return" in d
        assert d["num_observations"] == 3

    def test_constant_returns(self):
        ar = AssetReturn("CONST", [0.01] * 10)
        # Very low vol since returns are constant... actually std is 0 with ddof=1 if all same
        # With ddof=1 and identical: std = 0 → vol = 0 → sharpe = 0
        assert ar.sharpe_ratio == 0.0

    def test_negative_cumulative(self):
        ar = AssetReturn("DOWN", [-0.5, -0.5])
        assert ar.cumulative_return < 0


# ─── CrossAssetCorrelation Tests ─────────────────────────────────────────────

class TestCrossAssetCorrelation:
    def test_to_dict(self):
        c = CrossAssetCorrelation("SPY", "TLT", 0.15, 0.20, 0.18)
        d = c.to_dict()
        assert d["asset1"] == "SPY"
        assert d["correlation"] == 0.15
        assert d["rolling_30d"] == 0.2


# ─── CrossAssetAnalyzer Tests ───────────────────────────────────────────────

class TestCrossAssetAnalyzer:
    def test_correlation_matrix(self):
        np.random.seed(42)
        returns = {
            "SPY": np.random.normal(0.001, 0.01, 100).tolist(),
            "TLT": np.random.normal(0.0005, 0.005, 100).tolist(),
            "GLD": np.random.normal(0.0003, 0.008, 100).tolist(),
        }
        result = CrossAssetAnalyzer.correlation_matrix(returns)
        assert result["symbols"] == ["SPY", "TLT", "GLD"]
        assert len(result["matrix"]) == 3
        assert "avg_correlation" in result

    def test_single_asset(self):
        result = CrossAssetAnalyzer.correlation_matrix({"A": [0.01, 0.02]})
        assert result["matrix"] == [[1.0]]

    def test_rolling_correlation(self):
        np.random.seed(42)
        r1 = np.random.normal(0, 0.01, 60).tolist()
        r2 = np.random.normal(0, 0.01, 60).tolist()
        result = CrossAssetAnalyzer.rolling_correlation(r1, r2, 20)
        assert len(result) == 41  # 60 - 20 + 1

    def test_rolling_correlation_short(self):
        result = CrossAssetAnalyzer.rolling_correlation([0.01], [0.02], 30)
        assert result == []

    def test_pairwise_correlations(self):
        np.random.seed(42)
        returns = {
            "A": np.random.normal(0, 0.01, 50).tolist(),
            "B": np.random.normal(0, 0.01, 50).tolist(),
        }
        result = CrossAssetAnalyzer.pairwise_correlations(returns)
        assert len(result) == 1
        assert result[0].asset1 == "A"
        assert result[0].asset2 == "B"


# ─── RelativeValueAnalyzer Tests ────────────────────────────────────────────

class TestRelativeValueAnalyzer:
    def test_z_score(self):
        series = list(range(100))
        z = RelativeValueAnalyzer.z_score(series, 60)
        assert z > 0  # Last value (99) is above mean of window

    def test_z_score_short(self):
        z = RelativeValueAnalyzer.z_score([1.0], 60)
        assert z == 0.0

    def test_spread_analysis(self):
        s1 = list(range(100, 200))
        s2 = list(range(50, 150))
        result = RelativeValueAnalyzer.spread_analysis(s1, s2)
        assert "spread" in result
        assert result["current_spread"] == 50  # 199 - 149
        assert "z_score" in result

    def test_spread_short(self):
        result = RelativeValueAnalyzer.spread_analysis([1], [2])
        assert result["z_score"] == 0.0

    def test_ratio_analysis(self):
        s1 = [100.0, 110.0, 120.0, 130.0, 140.0]
        s2 = [50.0, 55.0, 60.0, 65.0, 70.0]
        result = RelativeValueAnalyzer.ratio_analysis(s1, s2)
        assert result["current_ratio"] == 2.0

    def test_ratio_with_zero(self):
        result = RelativeValueAnalyzer.ratio_analysis([100], [0])
        # Should handle division by zero
        assert isinstance(result, dict)

    def test_z_score_constant(self):
        z = RelativeValueAnalyzer.z_score([5.0] * 100, 30)
        assert z == 0.0


# ─── CarryTradeAnalyzer Tests ───────────────────────────────────────────────

class TestCarryTradeAnalyzer:
    def test_basic_carry(self):
        result = CarryTradeAnalyzer.calculate_carry(5.0, 1.0, [0.001] * 60)
        d = result.to_dict()
        assert d["carry_return"] > 0
        assert d["total_return"] > 0

    def test_zero_returns(self):
        result = CarryTradeAnalyzer.calculate_carry(3.0, 1.0, [])
        assert result.total_return == 0

    def test_carry_rankings(self):
        rates = {"AUD": 4.0, "USD": 5.0, "JPY": 0.1}
        spot_returns = {
            "AUD/JPY": [0.001] * 20,
            "USD/JPY": [0.0005] * 20,
        }
        result = CarryTradeAnalyzer.carry_rankings(rates, spot_returns)
        assert isinstance(result, list)
        # Should rank by total return
        if len(result) >= 2:
            assert result[0]["total_return"] >= result[1]["total_return"]


# ─── YieldCurveAnalyzer Tests ───────────────────────────────────────────────

class TestYieldCurveAnalyzer:
    def test_calculate_spread(self):
        curve = [
            YieldCurvePoint(2, 4.5),
            YieldCurvePoint(10, 4.8),
            YieldCurvePoint(30, 5.0),
        ]
        spread = YieldCurveAnalyzer.calculate_spread(curve, 2, 10)
        assert spread == pytest.approx(0.3)

    def test_curve_shape_normal(self):
        curve = [
            YieldCurvePoint(1, 3.0),
            YieldCurvePoint(5, 4.0),
            YieldCurvePoint(10, 4.5),
            YieldCurvePoint(30, 5.0),
        ]
        assert YieldCurveAnalyzer.curve_shape(curve) == "normal"

    def test_curve_shape_inverted(self):
        curve = [
            YieldCurvePoint(1, 5.5),
            YieldCurvePoint(5, 5.0),
            YieldCurvePoint(10, 4.5),
            YieldCurvePoint(30, 4.0),
        ]
        assert YieldCurveAnalyzer.curve_shape(curve) == "inverted"

    def test_curve_shape_flat(self):
        curve = [
            YieldCurvePoint(1, 4.5),
            YieldCurvePoint(30, 4.6),
        ]
        assert YieldCurveAnalyzer.curve_shape(curve) == "flat"

    def test_real_yield(self):
        real = YieldCurveAnalyzer.real_yield(5.0, 3.0)
        assert real == pytest.approx(1.9417, abs=0.01)

    def test_forward_rate(self):
        fwd = YieldCurveAnalyzer.forward_rate(4.0, 2, 5.0, 5)
        assert fwd > 0

    def test_forward_rate_invalid(self):
        assert YieldCurveAnalyzer.forward_rate(4.0, 5, 5.0, 2) == 0.0

    def test_curve_insufficient(self):
        assert YieldCurveAnalyzer.curve_shape([YieldCurvePoint(1, 4.0)]) == "insufficient_data"


# ─── MacroFactorAnalyzer Tests ──────────────────────────────────────────────

class TestMacroFactorAnalyzer:
    def test_factor_exposure(self):
        np.random.seed(42)
        asset_ret = np.random.normal(0.001, 0.01, 60).tolist()
        factor_ret = {
            "market": np.random.normal(0.0005, 0.008, 60).tolist(),
            "size": np.random.normal(0, 0.005, 60).tolist(),
        }
        result = MacroFactorAnalyzer.factor_exposure(asset_ret, factor_ret)
        assert "market" in result
        assert "size" in result

    def test_factor_exposure_short(self):
        result = MacroFactorAnalyzer.factor_exposure([0.01], {"mkt": [0.02]})
        assert result["mkt"] == 0.0

    def test_detect_regime_risk_on(self):
        indicators = {
            "growth": [0.5] * 20,
            "volatility": [-0.3] * 20,
            "inflation": [0.1] * 20,
            "rates": [0.0] * 20,
        }
        result = MacroFactorAnalyzer.detect_regime(indicators)
        assert result.regime == "risk_on"

    def test_detect_regime_risk_off(self):
        indicators = {
            "growth": [-0.5] * 20,
            "volatility": [0.5] * 20,
        }
        result = MacroFactorAnalyzer.detect_regime(indicators)
        assert result.regime == "risk_off"

    def test_detect_regime_inflationary(self):
        indicators = {"inflation": [0.8] * 20}
        result = MacroFactorAnalyzer.detect_regime(indicators)
        assert result.regime == "inflationary"

    def test_detect_regime_empty(self):
        result = MacroFactorAnalyzer.detect_regime({})
        assert result.regime == "neutral"


# ─── MultiAssetAllocator Tests ──────────────────────────────────────────────

class TestMultiAssetAllocator:
    def test_equal_weight(self):
        w = MultiAssetAllocator.equal_weight(4)
        assert len(w) == 4
        assert sum(w) == pytest.approx(1.0)

    def test_equal_weight_zero(self):
        assert MultiAssetAllocator.equal_weight(0) == []

    def test_inverse_volatility(self):
        w = MultiAssetAllocator.inverse_volatility([0.1, 0.2, 0.3])
        assert sum(w) == pytest.approx(1.0)
        assert w[0] > w[1] > w[2]  # Lower vol gets higher weight

    def test_inverse_vol_all_zero(self):
        w = MultiAssetAllocator.inverse_volatility([0, 0, 0])
        assert sum(w) == pytest.approx(1.0)  # Falls back to equal weight

    def test_risk_parity(self):
        cov = [[0.04, 0.01], [0.01, 0.09]]
        w = MultiAssetAllocator.risk_parity(cov)
        assert len(w) == 2
        assert sum(w) == pytest.approx(1.0)

    def test_risk_parity_empty(self):
        assert MultiAssetAllocator.risk_parity([]) == []

    def test_momentum_weighted(self):
        returns = {
            "A": [0.01] * 60,
            "B": [-0.01] * 60,
            "C": [0.02] * 60,
        }
        w = MultiAssetAllocator.momentum_weighted(returns)
        assert w["C"] > w["A"]  # C has higher momentum
        assert w["B"] == 0  # Negative momentum gets 0


# ─── CurrencyHedger Tests ───────────────────────────────────────────────────

class TestCurrencyHedger:
    def test_fully_hedged(self):
        r = CurrencyHedger.hedged_return(0.05, 0.03, 1.0)
        assert r == 0.05  # Full hedge = local return

    def test_unhedged(self):
        r = CurrencyHedger.hedged_return(0.05, 0.03, 0.0)
        expected = (1.05) * (1.03) - 1
        assert r == pytest.approx(expected)

    def test_partial_hedge(self):
        r = CurrencyHedger.hedged_return(0.05, 0.03, 0.5)
        assert r > 0.05  # Partial hedge, positive FX return

    def test_hedged_series(self):
        asset_r = [0.01, 0.02, -0.01]
        fx_r = [0.005, -0.003, 0.01]
        result = CurrencyHedger.hedged_series(asset_r, fx_r, 1.0)
        assert len(result) == 3
        assert result[0] == 0.01  # Fully hedged

    def test_optimal_hedge_short(self):
        assert CurrencyHedger.optimal_hedge_ratio([0.01], [0.02]) == 1.0

    def test_optimal_hedge_ratio(self):
        np.random.seed(42)
        asset = np.random.normal(0.001, 0.01, 100).tolist()
        fx = np.random.normal(0.0005, 0.005, 100).tolist()
        h = CurrencyHedger.optimal_hedge_ratio(asset, fx)
        assert 0 <= h <= 1


# ─── FlightToQualityDetector Tests ──────────────────────────────────────────

class TestFlightToQualityDetector:
    def test_flight_to_quality_detected(self):
        eq = [-0.02, -0.03, -0.025, -0.015, -0.02]
        bd = [0.01, 0.015, 0.008, 0.012, 0.01]
        gd = [0.005, 0.008, 0.006, 0.007, 0.004]
        vx = [0.1, 0.15, 0.08, 0.12, 0.09]
        result = FlightToQualityDetector.detect(eq, bd, gd, vx)
        assert result["flight_to_quality"] is True
        assert result["score"] > 0.5

    def test_no_flight(self):
        eq = [0.01, 0.02, 0.015, 0.01, 0.02]
        bd = [0.001, 0.002, 0.001, 0.001, 0.002]
        gd = [0.001, -0.001, 0.001, 0, 0.001]
        vx = [-0.01, -0.02, -0.01, -0.005, -0.01]
        result = FlightToQualityDetector.detect(eq, bd, gd, vx)
        assert result["flight_to_quality"] is False

    def test_insufficient_data(self):
        result = FlightToQualityDetector.detect([0.01], [0.01], [0.01], [0.01])
        assert result["flight_to_quality"] is False


# ─── MultiAssetAnalysisEngine Tests ─────────────────────────────────────────

class TestMultiAssetAnalysisEngine:
    def setup_method(self):
        self.engine = MultiAssetAnalysisEngine()

    def test_register_and_list_assets(self):
        self.engine.register_asset(AssetInfo("AAPL", "Apple", AssetClass.EQUITY))
        self.engine.register_asset(AssetInfo("BTCUSD", "Bitcoin", AssetClass.CRYPTO))
        all_assets = self.engine.list_assets()
        assert len(all_assets) == 2
        equities = self.engine.list_assets(AssetClass.EQUITY)
        assert len(equities) == 1

    def test_get_asset(self):
        self.engine.register_asset(AssetInfo("SPY", "S&P 500 ETF", AssetClass.INDEX))
        assert self.engine.get_asset("SPY") is not None
        assert self.engine.get_asset("NOPE") is None

    def test_correlation_matrix(self):
        np.random.seed(42)
        returns = {
            "A": np.random.normal(0, 0.01, 50).tolist(),
            "B": np.random.normal(0, 0.01, 50).tolist(),
        }
        result = self.engine.correlation_matrix(returns)
        assert "matrix" in result

    def test_pairwise_correlations(self):
        np.random.seed(42)
        returns = {
            "A": np.random.normal(0, 0.01, 50).tolist(),
            "B": np.random.normal(0, 0.01, 50).tolist(),
        }
        result = self.engine.pairwise_correlations(returns)
        assert isinstance(result, list)

    def test_spread_analysis(self):
        result = self.engine.spread_analysis(list(range(50)), list(range(0, 100, 2)))
        assert "z_score" in result

    def test_ratio_analysis(self):
        result = self.engine.ratio_analysis([100, 110, 120], [50, 55, 60])
        assert "current_ratio" in result

    def test_z_score(self):
        z = self.engine.z_score(list(range(100)))
        assert z > 0

    def test_yield_spread(self):
        curve = [YieldCurvePoint(2, 4.5), YieldCurvePoint(10, 5.0)]
        assert self.engine.yield_spread(curve, 2, 10) == pytest.approx(0.5)

    def test_curve_shape(self):
        curve = [YieldCurvePoint(1, 3.0), YieldCurvePoint(10, 4.5), YieldCurvePoint(30, 5.0)]
        assert self.engine.curve_shape(curve) == "normal"

    def test_real_yield(self):
        assert self.engine.real_yield(5.0, 3.0) > 0

    def test_forward_rate(self):
        fwd = self.engine.forward_rate(4.0, 2, 5.0, 5)
        assert fwd > 0

    def test_factor_exposure(self):
        np.random.seed(42)
        result = self.engine.factor_exposure(
            np.random.normal(0, 0.01, 50).tolist(),
            {"mkt": np.random.normal(0, 0.01, 50).tolist()})
        assert "mkt" in result

    def test_detect_regime(self):
        result = self.engine.detect_regime({"growth": [0.5] * 20, "volatility": [-0.3] * 20})
        assert result["regime"] == "risk_on"

    def test_allocations(self):
        assert sum(self.engine.equal_weight_allocation(3)) == pytest.approx(1.0)
        assert sum(self.engine.inverse_vol_allocation([0.1, 0.2])) == pytest.approx(1.0)
        assert sum(self.engine.risk_parity_allocation([[0.04, 0.01], [0.01, 0.09]])) == pytest.approx(1.0)

    def test_momentum_allocation(self):
        returns = {"A": [0.01] * 60, "B": [0.02] * 60}
        w = self.engine.momentum_allocation(returns)
        assert w["B"] > w["A"]

    def test_hedged_return(self):
        assert self.engine.hedged_return(0.05, 0.03, 1.0) == 0.05

    def test_hedged_series(self):
        result = self.engine.hedged_series([0.01, 0.02], [0.005, -0.003], 1.0)
        assert len(result) == 2

    def test_optimal_hedge(self):
        np.random.seed(42)
        h = self.engine.optimal_hedge_ratio(
            np.random.normal(0, 0.01, 50).tolist(),
            np.random.normal(0, 0.005, 50).tolist())
        assert 0 <= h <= 1

    def test_flight_to_quality(self):
        result = self.engine.flight_to_quality(
            [-0.02] * 5, [0.01] * 5, [0.005] * 5, [0.1] * 5)
        assert "flight_to_quality" in result

    def test_asset_summary(self):
        returns = {"SPY": [0.01, -0.005, 0.02], "TLT": [0.002, 0.003, -0.001]}
        summary = self.engine.asset_summary(returns)
        assert len(summary) == 2
        assert summary[0]["symbol"] == "SPY"

    def test_capabilities(self):
        caps = self.engine.capabilities()
        assert caps["engine"] == "MultiAssetAnalysisEngine"
        assert len(caps["features"]) >= 10
        assert len(caps["asset_classes"]) == 7
