"""
Extended Macro Indicators Engine Tests — 250+ tests covering yield curve analysis,
inflation regime detection, ISM/PMI analysis, recession probability, macro regime
classification, FOMC stance, edge cases, parametrized boundaries, and stress tests.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../phase1'))

import pytest
import math
import random
import statistics
from services.macro_indicators_engine import (
    YieldCurvePoint, MacroIndicator, MacroRegime, YieldCurveShape, FOMCStance,
    YieldCurveAnalyzer, InflationRegimeDetector, ISMAnalyzer,
    RecessionProbabilityModel, MacroRegimeClassifier, MacroIndicatorsEngine,
)


# ═══════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════

def _normal_curve():
    """A normal upward-sloping yield curve."""
    return [
        YieldCurvePoint(0.25, 0.045),
        YieldCurvePoint(0.5, 0.047),
        YieldCurvePoint(1.0, 0.048),
        YieldCurvePoint(2.0, 0.050),
        YieldCurvePoint(5.0, 0.052),
        YieldCurvePoint(10.0, 0.055),
        YieldCurvePoint(30.0, 0.058),
    ]


def _inverted_curve():
    """An inverted yield curve."""
    return [
        YieldCurvePoint(0.25, 0.055),
        YieldCurvePoint(0.5, 0.054),
        YieldCurvePoint(1.0, 0.053),
        YieldCurvePoint(2.0, 0.051),
        YieldCurvePoint(5.0, 0.048),
        YieldCurvePoint(10.0, 0.045),
        YieldCurvePoint(30.0, 0.044),
    ]


def _flat_curve():
    """A flat yield curve."""
    return [
        YieldCurvePoint(0.25, 0.050),
        YieldCurvePoint(2.0, 0.0505),
        YieldCurvePoint(5.0, 0.051),
        YieldCurvePoint(10.0, 0.0515),
        YieldCurvePoint(30.0, 0.052),
    ]


def _steep_curve():
    """A steeply sloped yield curve."""
    return [
        YieldCurvePoint(0.25, 0.01),
        YieldCurvePoint(2.0, 0.02),
        YieldCurvePoint(5.0, 0.035),
        YieldCurvePoint(10.0, 0.045),
        YieldCurvePoint(30.0, 0.055),
    ]


# ═══════════════════════════════════════════════════════════════════════
# MacroIndicator dataclass
# ═══════════════════════════════════════════════════════════════════════

class TestMacroIndicator:
    def test_surprise_normal(self):
        m = MacroIndicator("CPI", 3.5, 3.2, consensus_estimate=3.3)
        assert abs(m.surprise - (3.5 - 3.3) / 3.3) < 0.001

    def test_surprise_zero_consensus(self):
        m = MacroIndicator("CPI", 3.5, 3.2, consensus_estimate=0)
        assert m.surprise == 0.0

    def test_mom_change_normal(self):
        m = MacroIndicator("GDP", 2.5, 2.0)
        assert abs(m.mom_change - 0.25) < 0.001

    def test_mom_change_zero_previous(self):
        m = MacroIndicator("GDP", 2.5, 0)
        assert m.mom_change == 0.0

    def test_to_dict_keys(self):
        m = MacroIndicator("CPI", 3.5, 3.2, consensus_estimate=3.3, unit="%")
        d = m.to_dict()
        assert set(d.keys()) == {"name", "current", "previous", "surprise_pct", "mom_change_pct"}

    def test_to_dict_name(self):
        m = MacroIndicator("ISM", 55.3, 54.1)
        assert m.to_dict()["name"] == "ISM"

    @pytest.mark.parametrize("current,previous,consensus", [
        (0, 0, 0), (100, 50, 75), (-1, -2, -1.5), (0.001, 0.0005, 0.001)
    ])
    def test_various_values(self, current, previous, consensus):
        m = MacroIndicator("Test", current, previous, consensus)
        d = m.to_dict()
        assert isinstance(d["surprise_pct"], float)
        assert isinstance(d["mom_change_pct"], float)

    def test_negative_surprise(self):
        m = MacroIndicator("CPI", 3.0, 3.2, consensus_estimate=3.5)
        assert m.surprise < 0

    def test_positive_mom_change(self):
        m = MacroIndicator("GDP", 3.0, 2.0)
        assert m.mom_change > 0

    def test_negative_mom_change(self):
        m = MacroIndicator("GDP", 2.0, 3.0)
        assert m.mom_change < 0


# ═══════════════════════════════════════════════════════════════════════
# YieldCurveAnalyzer
# ═══════════════════════════════════════════════════════════════════════

class TestYieldCurveSpread:
    def test_normal_curve_positive_spread(self):
        curve = _normal_curve()
        spread = YieldCurveAnalyzer.spread(curve, 2.0, 10.0)
        assert spread > 0

    def test_inverted_curve_negative_spread(self):
        curve = _inverted_curve()
        spread = YieldCurveAnalyzer.spread(curve, 2.0, 10.0)
        assert spread < 0

    def test_missing_maturity_returns_zero(self):
        curve = [YieldCurvePoint(2.0, 0.05)]
        assert YieldCurveAnalyzer.spread(curve, 2.0, 10.0) == 0.0

    def test_empty_curve(self):
        assert YieldCurveAnalyzer.spread([], 2.0, 10.0) == 0.0

    def test_3m_10y_spread(self):
        curve = _normal_curve()
        spread = YieldCurveAnalyzer.spread(curve, 0.25, 10.0)
        assert spread > 0

    @pytest.mark.parametrize("short,long", [
        (0.25, 2.0), (0.25, 10.0), (2.0, 10.0), (2.0, 30.0), (5.0, 30.0)
    ])
    def test_various_spreads(self, short, long):
        curve = _normal_curve()
        spread = YieldCurveAnalyzer.spread(curve, short, long)
        assert isinstance(spread, float)

    def test_spread_symmetry(self):
        curve = _normal_curve()
        s1 = YieldCurveAnalyzer.spread(curve, 2.0, 10.0)
        s2 = YieldCurveAnalyzer.spread(curve, 10.0, 2.0)
        assert abs(s1 + s2) < 0.0001


class TestClassifyShape:
    def test_normal_curve(self):
        r = YieldCurveAnalyzer.classify_shape(_normal_curve())
        assert isinstance(r["shape"], str)

    def test_inverted_curve(self):
        r = YieldCurveAnalyzer.classify_shape(_inverted_curve())
        assert r["shape"] == "inverted"
        assert r["is_inverted"] is True
        assert r["recession_signal"] is True

    def test_flat_curve(self):
        r = YieldCurveAnalyzer.classify_shape(_flat_curve())
        assert r["shape"] in ["flat", "normal"]

    def test_steep_curve(self):
        r = YieldCurveAnalyzer.classify_shape(_steep_curve())
        assert r["shape"] == "steep"

    def test_empty_curve(self):
        r = YieldCurveAnalyzer.classify_shape([])
        assert r["shape"] == "normal"

    def test_single_point(self):
        r = YieldCurveAnalyzer.classify_shape([YieldCurvePoint(10.0, 0.05)])
        assert r["shape"] == "normal"

    def test_output_keys(self):
        r = YieldCurveAnalyzer.classify_shape(_normal_curve())
        for k in ["shape", "spread_2y_10y", "spread_3m_10y", "is_inverted", "recession_signal"]:
            assert k in r


class TestTermPremium:
    def test_positive_premium(self):
        tp = YieldCurveAnalyzer.term_premium(0.05, [0.03, 0.035, 0.04])
        assert tp > 0

    def test_negative_premium(self):
        tp = YieldCurveAnalyzer.term_premium(0.03, [0.04, 0.045])
        assert tp < 0

    def test_zero_premium(self):
        tp = YieldCurveAnalyzer.term_premium(0.04, [0.04])
        assert tp == 0.0

    def test_empty_expected_rates(self):
        tp = YieldCurveAnalyzer.term_premium(0.05, [])
        assert tp == 0.0

    @pytest.mark.parametrize("long_yield", [0.01, 0.03, 0.05, 0.08, 0.12])
    def test_various_yields(self, long_yield):
        tp = YieldCurveAnalyzer.term_premium(long_yield, [0.04, 0.04])
        assert isinstance(tp, float)


class TestDV01:
    def test_positive(self):
        dv01 = YieldCurveAnalyzer.duration_adjusted_dv01(0.05, 10)
        assert dv01 > 0

    def test_higher_maturity_higher_dv01(self):
        dv01_5 = YieldCurveAnalyzer.duration_adjusted_dv01(0.05, 5)
        dv01_30 = YieldCurveAnalyzer.duration_adjusted_dv01(0.05, 30)
        assert dv01_30 > dv01_5

    def test_custom_face_value(self):
        dv01 = YieldCurveAnalyzer.duration_adjusted_dv01(0.05, 10, face_value=100_000)
        assert isinstance(dv01, float)
        assert dv01 > 0

    @pytest.mark.parametrize("yield_rate", [0.01, 0.03, 0.05, 0.08])
    def test_various_yields(self, yield_rate):
        dv01 = YieldCurveAnalyzer.duration_adjusted_dv01(yield_rate, 10)
        assert dv01 > 0


class TestBearSteepenerFlattener:
    def test_steepening(self):
        prev = [YieldCurvePoint(2.0, 0.04), YieldCurvePoint(10.0, 0.05)]
        curr = [YieldCurvePoint(2.0, 0.04), YieldCurvePoint(10.0, 0.06)]
        r = YieldCurveAnalyzer.bear_steepener_vs_flattener(prev, curr)
        assert r["move"] == "steepening"

    def test_flattening(self):
        prev = [YieldCurvePoint(2.0, 0.04), YieldCurvePoint(10.0, 0.06)]
        curr = [YieldCurvePoint(2.0, 0.05), YieldCurvePoint(10.0, 0.06)]
        r = YieldCurveAnalyzer.bear_steepener_vs_flattener(prev, curr)
        assert r["move"] == "flattening"

    def test_bear_steepener(self):
        prev = [YieldCurvePoint(2.0, 0.04), YieldCurvePoint(10.0, 0.05)]
        curr = [YieldCurvePoint(2.0, 0.04), YieldCurvePoint(10.0, 0.06)]
        r = YieldCurveAnalyzer.bear_steepener_vs_flattener(prev, curr)
        assert r["category"] == "bear_steepener"

    def test_bull_flattener(self):
        prev = [YieldCurvePoint(2.0, 0.04), YieldCurvePoint(10.0, 0.06)]
        curr = [YieldCurvePoint(2.0, 0.04), YieldCurvePoint(10.0, 0.055)]
        r = YieldCurveAnalyzer.bear_steepener_vs_flattener(prev, curr)
        assert r["category"] == "bull_flattener"

    def test_output_keys(self):
        prev = [YieldCurvePoint(2.0, 0.04), YieldCurvePoint(10.0, 0.05)]
        curr = [YieldCurvePoint(2.0, 0.04), YieldCurvePoint(10.0, 0.06)]
        r = YieldCurveAnalyzer.bear_steepener_vs_flattener(prev, curr)
        for k in ["spread_change", "10y_yield_change", "move", "category"]:
            assert k in r


# ═══════════════════════════════════════════════════════════════════════
# InflationRegimeDetector
# ═══════════════════════════════════════════════════════════════════════

class TestClassifyInflation:
    def test_high_inflation(self):
        r = InflationRegimeDetector.classify_inflation(0.08, 0.01, 0.07)
        assert r["regime"] == "high_inflation"

    def test_elevated_inflation(self):
        r = InflationRegimeDetector.classify_inflation(0.04, 0.005, 0.035)
        assert r["regime"] == "elevated_inflation"

    def test_target_inflation(self):
        # avg = (0.020 + 0.018 + 0.020)/2 = 0.029, which is 0.015 < 0.029 < 0.03
        r = InflationRegimeDetector.classify_inflation(0.020, 0.002, 0.018)
        assert r["regime"] == "target_inflation"

    def test_below_target(self):
        # avg = (0.008 + 0.006 + 0.008)/2 = 0.011
        r = InflationRegimeDetector.classify_inflation(0.008, 0.001, 0.006)
        assert r["regime"] == "below_target"

    def test_rising_trend(self):
        r = InflationRegimeDetector.classify_inflation(0.03, 0.005, 0.028)
        assert r["trend"] == "rising"

    def test_falling_trend(self):
        r = InflationRegimeDetector.classify_inflation(0.03, -0.003, 0.028)
        assert r["trend"] == "falling"

    def test_stable_trend(self):
        r = InflationRegimeDetector.classify_inflation(0.03, 0.001, 0.028)
        assert r["trend"] == "stable"

    def test_with_pce(self):
        # With pce_yoy, avg = (cpi + core + pce)/3
        r = InflationRegimeDetector.classify_inflation(0.08, 0.01, 0.07, pce_yoy=0.075)
        assert r["regime"] == "high_inflation"

    def test_market_implication_present(self):
        r = InflationRegimeDetector.classify_inflation(0.04, 0.005, 0.035)
        assert "market_implication" in r

    def test_output_keys(self):
        r = InflationRegimeDetector.classify_inflation(0.03, 0.002, 0.025)
        for k in ["regime", "trend", "cpi_yoy", "core_cpi_yoy",
                   "breakeven_vs_cpi", "market_implication"]:
            assert k in r

    @pytest.mark.parametrize("cpi,core,expected", [
        (0.10, 0.09, "high_inflation"),
        (0.04, 0.035, "elevated_inflation"),
        (0.020, 0.018, "target_inflation"),
        (0.005, 0.004, "below_target"),
    ])
    def test_regime_boundaries(self, cpi, core, expected):
        r = InflationRegimeDetector.classify_inflation(cpi, 0.002, core)
        assert r["regime"] == expected


class TestRealRates:
    def test_positive_real_rate(self):
        r = InflationRegimeDetector.real_rates(0.05, 0.02)
        assert r["real_rate"] > 0

    def test_negative_real_rate(self):
        r = InflationRegimeDetector.real_rates(0.02, 0.04)
        assert r["real_rate"] < 0

    def test_zero_real_rate(self):
        r = InflationRegimeDetector.real_rates(0.03, 0.03)
        assert r["real_rate"] == 0.0

    def test_deeply_negative(self):
        r = InflationRegimeDetector.real_rates(0.01, 0.05)
        assert r["real_rate_regime"] == "deeply_negative"

    def test_restrictive(self):
        r = InflationRegimeDetector.real_rates(0.06, 0.02)
        assert r["real_rate_regime"] == "restrictive"

    def test_output_keys(self):
        r = InflationRegimeDetector.real_rates(0.04, 0.025)
        for k in ["nominal_yield", "breakeven_inflation", "real_rate", "real_rate_regime"]:
            assert k in r

    @pytest.mark.parametrize("nominal,breakeven", [
        (0.0, 0.0), (0.01, 0.03), (0.05, 0.02), (0.10, 0.08)
    ])
    def test_various_rates(self, nominal, breakeven):
        r = InflationRegimeDetector.real_rates(nominal, breakeven)
        expected = round(nominal - breakeven, 4)
        assert r["real_rate"] == expected


# ═══════════════════════════════════════════════════════════════════════
# ISMAnalyzer
# ═══════════════════════════════════════════════════════════════════════

class TestClassifyISM:
    def test_strong_expansion(self):
        r = ISMAnalyzer.classify_ism(57.0)
        assert r["regime"] == "strong_expansion"
        assert r["expanding"] is True

    def test_expansion(self):
        r = ISMAnalyzer.classify_ism(52.0)
        assert r["regime"] == "expansion"
        assert r["expanding"] is True

    def test_mild_contraction(self):
        r = ISMAnalyzer.classify_ism(47.0)
        assert r["regime"] == "mild_contraction"
        assert r["expanding"] is False

    def test_recession_territory(self):
        r = ISMAnalyzer.classify_ism(42.0)
        assert r["regime"] == "recession_territory"

    def test_accelerating(self):
        r = ISMAnalyzer.classify_ism(56.0, previous=53.0)
        assert r["accelerating"] is True

    def test_decelerating(self):
        r = ISMAnalyzer.classify_ism(52.0, previous=55.0)
        assert r["accelerating"] is False

    def test_no_previous(self):
        r = ISMAnalyzer.classify_ism(55.0)
        assert r["mom_change"] == 0.0

    def test_output_keys(self):
        r = ISMAnalyzer.classify_ism(55.0, 53.0)
        for k in ["ism_value", "expanding", "regime", "mom_change",
                   "accelerating", "signal"]:
            assert k in r

    @pytest.mark.parametrize("ism", [30, 40, 45, 48, 50, 52, 55, 60, 70])
    def test_various_ism_values(self, ism):
        r = ISMAnalyzer.classify_ism(float(ism))
        assert isinstance(r, dict)
        assert r["ism_value"] == float(ism)

    def test_strong_buy_signal(self):
        r = ISMAnalyzer.classify_ism(58.0, previous=55.0)
        assert r["signal"] == "strong_buy"

    def test_buy_signal(self):
        r = ISMAnalyzer.classify_ism(52.0, previous=50.0)
        assert r["signal"] == "buy"

    def test_sell_signal(self):
        r = ISMAnalyzer.classify_ism(47.0, previous=49.0)
        assert r["signal"] == "sell"

    def test_boundary_50(self):
        r = ISMAnalyzer.classify_ism(50.0)
        assert r["expanding"] is True
        assert r["regime"] == "expansion"


class TestISMComposite:
    def test_basic(self):
        r = ISMAnalyzer.ism_composite(55.0, 57.0)
        assert "composite_pmi" in r
        assert r["expansion"] is True

    def test_contraction(self):
        r = ISMAnalyzer.ism_composite(45.0, 47.0)
        assert r["expansion"] is False

    def test_weighted_correctly(self):
        r = ISMAnalyzer.ism_composite(50.0, 60.0)
        expected = 0.3 * 50.0 + 0.7 * 60.0
        assert abs(r["composite_pmi"] - expected) < 0.1

    def test_with_employment(self):
        r = ISMAnalyzer.ism_composite(55.0, 57.0, employment=53.0)
        assert isinstance(r, dict)

    def test_output_keys(self):
        r = ISMAnalyzer.ism_composite(55.0, 57.0)
        for k in ["composite_pmi", "manufacturing_pmi", "services_pmi", "expansion"]:
            assert k in r

    @pytest.mark.parametrize("mfg,svc", [
        (40, 40), (50, 50), (55, 55), (60, 60), (45, 55), (55, 45)
    ])
    def test_various_values(self, mfg, svc):
        r = ISMAnalyzer.ism_composite(float(mfg), float(svc))
        assert isinstance(r["composite_pmi"], float)


# ═══════════════════════════════════════════════════════════════════════
# RecessionProbabilityModel
# ═══════════════════════════════════════════════════════════════════════

class TestRecessionProbability:
    def test_low_probability(self):
        r = RecessionProbabilityModel.estimate(0.02, 55.0, 0.035)
        assert r["recession_probability"] < 20
        assert r["risk_level"] == "low"

    def test_high_probability(self):
        r = RecessionProbabilityModel.estimate(-0.05, 42.0, 0.06,
                                                unemployment_change_3m=0.005)
        assert r["recession_probability"] > 50

    def test_inverted_curve_adds_probability(self):
        r1 = RecessionProbabilityModel.estimate(0.02, 55.0, 0.035)
        r2 = RecessionProbabilityModel.estimate(-0.02, 55.0, 0.035)
        assert r2["recession_probability"] > r1["recession_probability"]

    def test_low_ism_adds_probability(self):
        r1 = RecessionProbabilityModel.estimate(0.01, 55.0, 0.035)
        r2 = RecessionProbabilityModel.estimate(0.01, 42.0, 0.035)
        assert r2["recession_probability"] > r1["recession_probability"]

    def test_rising_unemployment_adds_probability(self):
        r1 = RecessionProbabilityModel.estimate(0.01, 52.0, 0.035, 0.0)
        r2 = RecessionProbabilityModel.estimate(0.01, 52.0, 0.035, 0.005)
        assert r2["recession_probability"] > r1["recession_probability"]

    def test_capped_at_100(self):
        r = RecessionProbabilityModel.estimate(-0.10, 30.0, 0.10,
                                                unemployment_change_3m=0.01,
                                                leading_index_6m_change=-0.10)
        assert r["recession_probability"] <= 100

    def test_risk_levels(self):
        r_low = RecessionProbabilityModel.estimate(0.03, 58.0, 0.035)
        assert r_low["risk_level"] == "low"

    def test_components_present(self):
        r = RecessionProbabilityModel.estimate(-0.02, 45.0, 0.05, 0.003)
        assert "components" in r
        assert "yield_curve_contribution" in r["components"]

    @pytest.mark.parametrize("spread", [-0.05, -0.02, -0.01, 0.0, 0.005, 0.01, 0.02, 0.05])
    def test_various_spreads(self, spread):
        r = RecessionProbabilityModel.estimate(spread, 52.0, 0.04)
        assert 0 <= r["recession_probability"] <= 100


# ═══════════════════════════════════════════════════════════════════════
# MacroRegimeClassifier
# ═══════════════════════════════════════════════════════════════════════

class TestMacroRegimeClassify:
    def test_goldilocks(self):
        r = MacroRegimeClassifier.classify(0.035, 0.02)
        assert r["regime"] == "goldilocks"

    def test_stagflation(self):
        r = MacroRegimeClassifier.classify(0.01, 0.05)
        assert r["regime"] == "stagflation"

    def test_reflation(self):
        r = MacroRegimeClassifier.classify(0.04, 0.04)
        assert r["regime"] == "reflation"

    def test_deflation(self):
        r = MacroRegimeClassifier.classify(0.01, 0.015)
        assert r["regime"] == "deflation"

    def test_recommended_allocation(self):
        r = MacroRegimeClassifier.classify(0.035, 0.02)
        assert "recommended_allocation" in r
        assert "equities" in r["recommended_allocation"]

    def test_growth_trend(self):
        r = MacroRegimeClassifier.classify(0.03, 0.02, growth_trend="rising")
        assert r["growth_trend"] == "rising"

    def test_inflation_trend(self):
        r = MacroRegimeClassifier.classify(0.03, 0.02, inflation_trend="falling")
        assert r["inflation_trend"] == "falling"

    def test_output_keys(self):
        r = MacroRegimeClassifier.classify(0.03, 0.02)
        for k in ["regime", "gdp_growth", "inflation_rate", "growth_trend",
                   "inflation_trend", "recommended_allocation"]:
            assert k in r

    @pytest.mark.parametrize("gdp,inflation,expected", [
        (0.04, 0.02, "goldilocks"),
        (0.04, 0.05, "reflation"),
        (0.01, 0.05, "stagflation"),
        (0.01, 0.02, "deflation"),
    ])
    def test_regime_quadrants(self, gdp, inflation, expected):
        r = MacroRegimeClassifier.classify(gdp, inflation)
        assert r["regime"] == expected


class TestFOMCStance:
    def test_hawkish(self):
        r = MacroRegimeClassifier.fomc_stance(0.05, neutral_rate=0.025, latest_move_bps=50)
        assert r["stance"] == "hawkish"

    def test_hawkish_hold(self):
        # rate_gap < -0.005 triggers hawkish_hold
        r = MacroRegimeClassifier.fomc_stance(0.01, neutral_rate=0.025, latest_move_bps=0)
        assert r["stance"] == "hawkish_hold"

    def test_dovish(self):
        # Need: inflation_gap < -0.005, latest_move_bps <= -25, rate_gap >= -0.005
        r = MacroRegimeClassifier.fomc_stance(0.025, neutral_rate=0.025,
                                               latest_move_bps=-25, inflation_gap=-0.01)
        assert r["stance"] == "dovish"

    def test_dovish_hold(self):
        # Need: NOT hawkish/hawkish_hold conditions, inflation_gap < 0
        r = MacroRegimeClassifier.fomc_stance(0.025, neutral_rate=0.025,
                                               latest_move_bps=0, inflation_gap=-0.003)
        assert r["stance"] == "dovish_hold"

    def test_neutral(self):
        r = MacroRegimeClassifier.fomc_stance(0.025, neutral_rate=0.025,
                                               latest_move_bps=0, inflation_gap=0)
        assert r["stance"] == "neutral"

    def test_market_implication(self):
        r = MacroRegimeClassifier.fomc_stance(0.05, latest_move_bps=50)
        assert "market_implication" in r

    def test_output_keys(self):
        r = MacroRegimeClassifier.fomc_stance(0.03)
        for k in ["stance", "fed_funds_rate", "neutral_rate",
                   "rate_gap_vs_neutral", "latest_move_bps", "market_implication"]:
            assert k in r

    @pytest.mark.parametrize("bps", [-75, -50, -25, 0, 25, 50, 75])
    def test_various_bps(self, bps):
        r = MacroRegimeClassifier.fomc_stance(0.025, latest_move_bps=bps)
        assert isinstance(r["stance"], str)

    def test_rate_gap_calculation(self):
        r = MacroRegimeClassifier.fomc_stance(0.05, neutral_rate=0.025)
        assert abs(r["rate_gap_vs_neutral"] - 0.025) < 0.0001

    def test_hawkish_via_dot_plot(self):
        # rate_gap < 0 AND dot_plot > 0.01
        r = MacroRegimeClassifier.fomc_stance(0.02, neutral_rate=0.025,
                                               latest_move_bps=0, dot_plot_next_12m=0.02)
        assert r["stance"] == "hawkish"


# ═══════════════════════════════════════════════════════════════════════
# MacroIndicatorsEngine orchestrator
# ═══════════════════════════════════════════════════════════════════════

class TestMacroIndicatorsEngineOrchestrator:
    def setup_method(self):
        self.engine = MacroIndicatorsEngine()

    def test_analyze_yield_curve(self):
        r = self.engine.analyze_yield_curve(_normal_curve())
        assert "shape" in r

    def test_real_rates(self):
        r = self.engine.real_rates(0.04, 0.025)
        assert "real_rate" in r

    def test_inflation_regime(self):
        r = self.engine.inflation_regime(0.03, 0.003, 0.028)
        assert "regime" in r

    def test_ism_signal(self):
        r = self.engine.ism_signal(55.0, 57.0)
        assert "composite_pmi" in r

    def test_recession_prob(self):
        r = self.engine.recession_prob(0.02, 55.0, 0.035)
        assert "recession_probability" in r

    def test_macro_regime(self):
        r = self.engine.macro_regime(0.03, 0.02)
        assert "regime" in r

    def test_fomc_stance(self):
        r = self.engine.fomc_stance(0.05, latest_bps=25)
        assert "stance" in r

    def test_full_macro_dashboard(self):
        r = self.engine.full_macro_dashboard(
            curve=_normal_curve(),
            cpi_yoy=0.03, core_cpi_yoy=0.028, cpi_mom=0.003,
            ism_mfg=55.0, ism_svc=57.0,
            gdp_growth=0.03, fed_rate=0.05, unemployment=0.035
        )
        for k in ["yield_curve", "inflation", "ism_composite",
                   "recession_probability", "macro_regime", "fomc_stance"]:
            assert k in r

    def test_capabilities(self):
        c = self.engine.capabilities()
        assert c["engine"] == "MacroIndicatorsEngine"
        assert "features" in c

    def test_full_dashboard_with_inverted_curve(self):
        r = self.engine.full_macro_dashboard(
            curve=_inverted_curve(),
            cpi_yoy=0.05, core_cpi_yoy=0.045, cpi_mom=0.006,
            ism_mfg=45.0, ism_svc=47.0,
            gdp_growth=0.01, fed_rate=0.055, unemployment=0.06
        )
        assert r["yield_curve"]["is_inverted"] is True


# ═══════════════════════════════════════════════════════════════════════
# Enum coverage
# ═══════════════════════════════════════════════════════════════════════

class TestEnums:
    @pytest.mark.parametrize("regime", list(MacroRegime))
    def test_macro_regime_values(self, regime):
        assert isinstance(regime.value, str)

    @pytest.mark.parametrize("shape", list(YieldCurveShape))
    def test_yield_curve_shape_values(self, shape):
        assert isinstance(shape.value, str)

    @pytest.mark.parametrize("stance", list(FOMCStance))
    def test_fomc_stance_values(self, stance):
        assert isinstance(stance.value, str)

    def test_macro_regime_count(self):
        assert len(MacroRegime) == 4

    def test_yield_curve_shape_count(self):
        assert len(YieldCurveShape) == 5

    def test_fomc_stance_count(self):
        assert len(FOMCStance) == 5


# ═══════════════════════════════════════════════════════════════════════
# Property-based tests
# ═══════════════════════════════════════════════════════════════════════

class TestPropertyBased:
    @pytest.mark.parametrize("seed", range(10))
    def test_recession_prob_bounded(self, seed):
        rng = random.Random(seed)
        r = RecessionProbabilityModel.estimate(
            rng.uniform(-0.05, 0.05),
            rng.uniform(30, 70),
            rng.uniform(0.03, 0.10),
            rng.uniform(-0.005, 0.01),
        )
        assert 0 <= r["recession_probability"] <= 100

    @pytest.mark.parametrize("seed", range(10))
    def test_real_rate_equals_nominal_minus_breakeven(self, seed):
        rng = random.Random(seed)
        nom = rng.uniform(0, 0.10)
        be = rng.uniform(0, 0.10)
        r = InflationRegimeDetector.real_rates(nom, be)
        assert abs(r["real_rate"] - round(nom - be, 4)) < 0.0001

    @pytest.mark.parametrize("seed", range(10))
    def test_ism_composite_between_components(self, seed):
        rng = random.Random(seed)
        mfg = rng.uniform(30, 70)
        svc = rng.uniform(30, 70)
        r = ISMAnalyzer.ism_composite(mfg, svc)
        assert min(mfg, svc) <= r["composite_pmi"] + 0.1
        assert r["composite_pmi"] <= max(mfg, svc) + 0.1


# ═══════════════════════════════════════════════════════════════════════
# Stress tests
# ═══════════════════════════════════════════════════════════════════════

class TestStress:
    def test_many_yield_curve_points(self):
        curve = [YieldCurvePoint(i * 0.5, 0.03 + i * 0.001) for i in range(100)]
        r = YieldCurveAnalyzer.classify_shape(curve)
        assert isinstance(r, dict)

    def test_many_recession_estimates(self):
        rng = random.Random(42)
        for _ in range(100):
            r = RecessionProbabilityModel.estimate(
                rng.uniform(-0.05, 0.05), rng.uniform(30, 70),
                rng.uniform(0.03, 0.10)
            )
            assert 0 <= r["recession_probability"] <= 100

    def test_extreme_inflation_values(self):
        r = InflationRegimeDetector.classify_inflation(1.0, 0.5, 0.9)
        assert r["regime"] == "high_inflation"

    def test_zero_inflation(self):
        r = InflationRegimeDetector.classify_inflation(0.0, 0.0, 0.0)
        assert r["regime"] == "below_target"

    def test_negative_inflation(self):
        r = InflationRegimeDetector.classify_inflation(-0.02, -0.005, -0.01)
        assert r["regime"] == "below_target"
