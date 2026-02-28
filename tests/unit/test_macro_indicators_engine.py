"""
Tests for MacroIndicatorsEngine — yield curve, inflation, ISM, recession probability.
"""
import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../phase1'))

from services.macro_indicators_engine import (
    YieldCurvePoint,
    MacroIndicator,
    YieldCurveAnalyzer,
    InflationRegimeDetector,
    ISMAnalyzer,
    RecessionProbabilityModel,
    MacroRegimeClassifier,
    MacroIndicatorsEngine,
    MacroRegime,
    YieldCurveShape,
    FOMCStance,
)


# ── Fixtures ──────────────────────────────────────────────────────────

@pytest.fixture
def normal_curve():
    return [
        YieldCurvePoint(0.25, 0.050),
        YieldCurvePoint(0.5,  0.052),
        YieldCurvePoint(1.0,  0.055),
        YieldCurvePoint(2.0,  0.060),
        YieldCurvePoint(5.0,  0.065),
        YieldCurvePoint(10.0, 0.070),
        YieldCurvePoint(30.0, 0.075),
    ]


@pytest.fixture
def inverted_curve():
    return [
        YieldCurvePoint(0.25, 0.055),
        YieldCurvePoint(0.5,  0.054),
        YieldCurvePoint(1.0,  0.053),
        YieldCurvePoint(2.0,  0.052),
        YieldCurvePoint(5.0,  0.048),
        YieldCurvePoint(10.0, 0.044),
        YieldCurvePoint(30.0, 0.042),
    ]


@pytest.fixture
def flat_curve():
    return [YieldCurvePoint(m, 0.055) for m in [0.25, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0]]


@pytest.fixture
def engine():
    return MacroIndicatorsEngine()


# ── YieldCurvePoint ───────────────────────────────────────────────────

class TestYieldCurvePoint:
    def test_creation(self):
        p = YieldCurvePoint(10.0, 0.04)
        assert p.maturity_years == 10.0
        assert p.yield_rate == 0.04

    def test_to_dict(self):
        p = YieldCurvePoint(2.0, 0.05)
        d = p.to_dict()
        assert "maturity_years" in d
        assert "yield_rate" in d


# ── MacroIndicator ────────────────────────────────────────────────────

class TestMacroIndicator:
    def test_surprise_positive(self):
        # name, current_value, previous_value, consensus_estimate
        ind = MacroIndicator("ISM", 58.0, 55.0, 56.0)
        assert ind.surprise > 0

    def test_surprise_negative(self):
        ind = MacroIndicator("CPI", 0.30, 0.25, 0.40)
        assert ind.surprise < 0

    def test_surprise_no_consensus(self):
        # consensus_estimate=0 → surprise returns 0.0
        ind = MacroIndicator("Jobs", 200000, 180000, 0)
        assert ind.surprise == 0.0

    def test_mom_change(self):
        # current=0.35, previous=0.30 → mom_change = (0.35-0.30)/0.30
        ind = MacroIndicator("CPI", 0.35, 0.30, 0.33)
        expected = (0.35 - 0.30) / 0.30
        assert ind.mom_change == pytest.approx(expected, abs=1e-6)

    def test_mom_change_no_previous(self):
        # previous_value=0 → mom_change returns 0.0
        ind = MacroIndicator("ISM", 55.0, 0, 54.0)
        assert ind.mom_change == 0.0


# ── YieldCurveAnalyzer ────────────────────────────────────────────────

class TestYieldCurveAnalyzer:
    def test_spread_normal(self, normal_curve):
        # spread(curve, maturity_short, maturity_long) → long_yield - short_yield
        spread = YieldCurveAnalyzer.spread(normal_curve, 2.0, 10.0)
        assert spread > 0

    def test_spread_inverted(self, inverted_curve):
        spread = YieldCurveAnalyzer.spread(inverted_curve, 2.0, 10.0)
        assert spread < 0

    def test_spread_not_found(self, normal_curve):
        # Maturities 15 and 3 don't exist in curve → returns 0.0
        spread = YieldCurveAnalyzer.spread(normal_curve, 15.0, 3.0)
        assert spread == 0.0

    def test_classify_shape_normal(self, normal_curve):
        result = YieldCurveAnalyzer.classify_shape(normal_curve)
        assert result["shape"] == YieldCurveShape.NORMAL.value

    def test_classify_shape_inverted(self, inverted_curve):
        result = YieldCurveAnalyzer.classify_shape(inverted_curve)
        assert result["shape"] == YieldCurveShape.INVERTED.value

    def test_classify_shape_flat(self, flat_curve):
        result = YieldCurveAnalyzer.classify_shape(flat_curve)
        assert result["shape"] in {YieldCurveShape.FLAT.value, YieldCurveShape.NORMAL.value}

    def test_classify_includes_spreads(self, normal_curve):
        result = YieldCurveAnalyzer.classify_shape(normal_curve)
        assert "spread_2y_10y" in result
        assert "spread_3m_10y" in result

    def test_term_premium(self):
        # term_premium(long_yield, expected_short_rates)
        prem = YieldCurveAnalyzer.term_premium(0.070, [0.055, 0.06, 0.05])
        assert isinstance(prem, float)
        assert prem > 0

    def test_dv01(self):
        # duration_adjusted_dv01(yield_rate, maturity, face_value)
        dv01 = YieldCurveAnalyzer.duration_adjusted_dv01(0.07, 10.0, 1_000_000)
        assert dv01 > 0  # DV01 is always positive

    def test_empty_curve(self):
        result = YieldCurveAnalyzer.classify_shape([])
        assert result["shape"] == YieldCurveShape.NORMAL.value


# ── InflationRegimeDetector ───────────────────────────────────────────

class TestInflationRegimeDetector:
    def test_classify_high_inflation(self):
        # classify_inflation(cpi_yoy, cpi_mom, core_cpi_yoy, pce_yoy, breakeven_10y)
        result = InflationRegimeDetector.classify_inflation(
            cpi_yoy=0.08, cpi_mom=0.005, core_cpi_yoy=0.075
        )
        assert result["regime"] == "high_inflation"

    def test_classify_target_inflation(self):
        result = InflationRegimeDetector.classify_inflation(
            cpi_yoy=0.020, cpi_mom=0.001, core_cpi_yoy=0.018
        )
        assert result["regime"] == "target_inflation"

    def test_classify_below_target(self):
        result = InflationRegimeDetector.classify_inflation(
            cpi_yoy=0.008, cpi_mom=-0.001, core_cpi_yoy=0.006
        )
        assert result["regime"] == "below_target"

    def test_classify_includes_market_implication(self):
        # Positional: (cpi_yoy, cpi_mom, core_cpi_yoy)
        result = InflationRegimeDetector.classify_inflation(0.07, 0.005, 0.065)
        assert "market_implication" in result

    def test_real_rates_positive(self):
        # real_rates(nominal_yield, breakeven_inflation) → returns dict
        result = InflationRegimeDetector.real_rates(0.05, 0.025)
        assert result["real_rate"] == pytest.approx(0.025, abs=1e-8)

    def test_real_rates_negative(self):
        result = InflationRegimeDetector.real_rates(0.02, 0.04)
        assert result["real_rate"] < 0


# ── ISMAnalyzer ───────────────────────────────────────────────────────

class TestISMAnalyzer:
    def test_classify_expansion(self):
        # classify_ism(ism_value, previous)
        result = ISMAnalyzer.classify_ism(58.0, 55.0)
        assert result["regime"] == "strong_expansion"

    def test_classify_contraction(self):
        result = ISMAnalyzer.classify_ism(45.0, 47.0)
        assert result["regime"] == "mild_contraction"

    def test_classify_includes_signal(self):
        result = ISMAnalyzer.classify_ism(60.0, 59.0)
        assert "signal" in result

    def test_classify_acceleration(self):
        result = ISMAnalyzer.classify_ism(57.0, 54.0)
        assert result["accelerating"] == True

    def test_ism_composite_weighted(self):
        # ism_composite(manufacturing, services)
        result = ISMAnalyzer.ism_composite(manufacturing=55.0, services=62.0)
        expected = 55.0 * 0.30 + 62.0 * 0.70
        assert abs(result["composite_pmi"] - expected) < 1e-8

    def test_ism_composite_expansion(self):
        result = ISMAnalyzer.ism_composite(55.0, 62.0)
        assert "expansion" in result


# ── RecessionProbabilityModel ─────────────────────────────────────────

class TestRecessionProbabilityModel:
    def test_low_probability_goldilocks(self):
        # estimate(spread_10y_3m, ism_manufacturing, unemployment_rate, ...)
        result = RecessionProbabilityModel.estimate(
            spread_10y_3m=0.020,
            ism_manufacturing=58.0,
            unemployment_rate=0.035,
            leading_index_6m_change=0.05,
        )
        assert 0 <= result["recession_probability"] <= 100
        assert result["recession_probability"] < 40

    def test_high_probability_recessionary(self):
        result = RecessionProbabilityModel.estimate(
            spread_10y_3m=-0.012,
            ism_manufacturing=44.0,
            unemployment_rate=0.07,
            unemployment_change_3m=0.005,
            leading_index_6m_change=-0.10,
        )
        assert result["recession_probability"] > 40

    def test_probability_range(self):
        for spread in [-0.02, -0.01, 0.0, 0.01, 0.02]:
            result = RecessionProbabilityModel.estimate(spread, 51.0, 0.045, 0.01)
            assert 0 <= result["recession_probability"] <= 100


# ── MacroRegimeClassifier ─────────────────────────────────────────────

class TestMacroRegimeClassifier:
    def test_classify_goldilocks(self):
        # classify(gdp_growth_rate, inflation_rate)
        result = MacroRegimeClassifier.classify(
            gdp_growth_rate=0.03,
            inflation_rate=0.022,
        )
        assert result["regime"] == MacroRegime.GOLDILOCKS.value

    def test_classify_stagflation(self):
        result = MacroRegimeClassifier.classify(
            gdp_growth_rate=0.005,
            inflation_rate=0.07,
        )
        assert result["regime"] == MacroRegime.STAGFLATION.value

    def test_classify_reflation(self):
        result = MacroRegimeClassifier.classify(
            gdp_growth_rate=0.04,
            inflation_rate=0.06,
        )
        assert result["regime"] == MacroRegime.REFLATION.value

    def test_classify_deflation(self):
        result = MacroRegimeClassifier.classify(
            gdp_growth_rate=0.001,
            inflation_rate=0.005,
        )
        assert result["regime"] == MacroRegime.DEFLATION.value

    def test_classify_includes_allocation(self):
        result = MacroRegimeClassifier.classify(0.03, 0.022)
        assert "recommended_allocation" in result

    def test_fomc_stance_hawkish(self):
        # fomc_stance(fed_funds_rate, neutral_rate, latest_move_bps, ...)
        result = MacroRegimeClassifier.fomc_stance(
            fed_funds_rate=0.055,
            neutral_rate=0.025,
            latest_move_bps=50,
        )
        assert result["stance"] == FOMCStance.HAWKISH.value

    def test_fomc_stance_dovish(self):
        result = MacroRegimeClassifier.fomc_stance(
            fed_funds_rate=0.025,
            neutral_rate=0.025,
            latest_move_bps=-25,
            inflation_gap=-0.01,
        )
        assert result["stance"] == FOMCStance.DOVISH.value

    def test_fomc_includes_market_implication(self):
        result = MacroRegimeClassifier.fomc_stance(0.045, 0.025, 50)
        assert "market_implication" in result


# ── MacroIndicatorsEngine Orchestrator ───────────────────────────────

class TestMacroIndicatorsEngine:
    def test_analyze_yield_curve(self, engine, normal_curve):
        result = engine.analyze_yield_curve(normal_curve)
        assert "shape" in result

    def test_real_rates(self, engine):
        # real_rates(nominal, breakeven) → returns dict
        result = engine.real_rates(0.045, 0.025)
        assert result["real_rate"] == pytest.approx(0.02, abs=1e-8)

    def test_inflation_regime(self, engine):
        # inflation_regime(cpi_yoy, cpi_mom, core_cpi_yoy)
        result = engine.inflation_regime(0.035, 0.003, 0.032)
        assert "regime" in result

    def test_ism_signal(self, engine):
        # ism_signal(manufacturing, services)
        result = engine.ism_signal(56.0, 54.0)
        assert "composite_pmi" in result

    def test_recession_prob(self, engine):
        # recession_prob(spread_10y_3m, ism_mfg, unemployment, unemployment_change)
        result = engine.recession_prob(0.01, 55.0, 0.04, 0.02)
        assert 0 <= result["recession_probability"] <= 100

    def test_macro_regime(self, engine):
        result = engine.macro_regime(0.03, 0.025)
        assert "regime" in result

    def test_fomc_stance(self, engine):
        # fomc_stance(fed_rate, latest_bps)
        result = engine.fomc_stance(0.05, 50)
        assert "stance" in result

    def test_full_macro_dashboard(self, engine, normal_curve):
        # full_macro_dashboard(curve, cpi_yoy, core_cpi_yoy, cpi_mom, ism_mfg, ism_svc, gdp_growth, fed_rate, unemployment)
        result = engine.full_macro_dashboard(
            curve=normal_curve,
            cpi_yoy=0.035,
            core_cpi_yoy=0.032,
            cpi_mom=0.003,
            ism_mfg=54.0,
            ism_svc=57.0,
            gdp_growth=0.028,
            fed_rate=0.050,
            unemployment=0.040,
        )
        assert "yield_curve" in result
        assert "inflation" in result
        assert "macro_regime" in result
        assert "recession_probability" in result

    def test_capabilities(self, engine):
        caps = engine.capabilities()
        assert caps["engine"] == "MacroIndicatorsEngine"
        assert len(caps["features"]) >= 14
