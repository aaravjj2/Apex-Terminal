"""
Macro Indicators Engine — Economic data processing: yield curve analysis,
FOMC rate decision impact, inflation regime detection, ISM/PMI signals,
leading/coincident/lagging indicator composite, recession probability model,
and macro factor regime classification.
Pure computation — no FastAPI dependencies.
"""
from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class MacroRegime(str, Enum):
    GOLDILOCKS = "goldilocks"      # Low inflation + high growth
    STAGFLATION = "stagflation"    # High inflation + low growth
    REFLATION = "reflation"        # Rising inflation + rising growth
    DEFLATION = "deflation"        # Low inflation + low growth


class YieldCurveShape(str, Enum):
    STEEP = "steep"
    FLAT = "flat"
    INVERTED = "inverted"
    HUMPED = "humped"
    NORMAL = "normal"


class FOMCStance(str, Enum):
    HAWKISH = "hawkish"
    HAWKISH_HOLD = "hawkish_hold"
    NEUTRAL = "neutral"
    DOVISH_HOLD = "dovish_hold"
    DOVISH = "dovish"


@dataclass
class YieldCurvePoint:
    maturity_years: float
    yield_rate: float           # decimal (0.05 = 5%)

    def to_dict(self) -> dict:
        return {
            "maturity_years": self.maturity_years,
            "yield_rate": round(self.yield_rate, 4),
        }


@dataclass
class MacroIndicator:
    name: str
    current_value: float
    previous_value: float
    consensus_estimate: float = 0.0
    unit: str = ""

    @property
    def surprise(self) -> float:
        if self.consensus_estimate == 0:
            return 0.0
        return (self.current_value - self.consensus_estimate) / abs(self.consensus_estimate)

    @property
    def mom_change(self) -> float:
        if self.previous_value == 0:
            return 0.0
        return (self.current_value - self.previous_value) / abs(self.previous_value)

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "current": self.current_value,
            "previous": self.previous_value,
            "surprise_pct": round(self.surprise * 100, 2),
            "mom_change_pct": round(self.mom_change * 100, 2),
        }


# ── Yield Curve Analysis ──────────────────────────────────────────────

class YieldCurveAnalyzer:
    """Analyze yield curve shape, inversions, and term premium."""

    @staticmethod
    def spread(curve: list[YieldCurvePoint], maturity_short: float, maturity_long: float) -> float:
        """Long minus short spread."""
        short = next((p.yield_rate for p in curve if abs(p.maturity_years - maturity_short) < 0.1), None)
        long_ = next((p.yield_rate for p in curve if abs(p.maturity_years - maturity_long) < 0.1), None)
        if short is None or long_ is None:
            return 0.0
        return round(long_ - short, 4)

    @staticmethod
    def classify_shape(curve: list[YieldCurvePoint]) -> dict:
        """Classify curve as steep/flat/inverted/humped."""
        if len(curve) < 2:
            return {"shape": YieldCurveShape.NORMAL.value}

        spread_2y10y = YieldCurveAnalyzer.spread(curve, 2, 10)
        spread_3m10y = YieldCurveAnalyzer.spread(curve, 0.25, 10)
        spread_5y30y = YieldCurveAnalyzer.spread(curve, 5, 30)

        if spread_3m10y < -0.002:
            shape = YieldCurveShape.INVERTED
        elif spread_2y10y > 0.015:
            shape = YieldCurveShape.STEEP
        elif abs(spread_2y10y) < 0.005:
            shape = YieldCurveShape.FLAT
        else:
            shape = YieldCurveShape.NORMAL

        return {
            "shape": shape.value,
            "spread_2y_10y": spread_2y10y,
            "spread_3m_10y": spread_3m10y,
            "spread_5y_30y": spread_5y30y,
            "is_inverted": spread_3m10y < 0 or spread_2y10y < 0,
            "recession_signal": spread_3m10y < -0.001 or spread_2y10y < -0.001,
        }

    @staticmethod
    def term_premium(
        long_yield: float,
        expected_short_rates: list[float],  # expected Fed Funds over next N years
    ) -> float:
        """Term premium = long yield - expected short rate average."""
        if not expected_short_rates:
            return 0.0
        avg_expected = statistics.mean(expected_short_rates)
        return round(long_yield - avg_expected, 4)

    @staticmethod
    def duration_adjusted_dv01(
        yield_rate: float,
        maturity: float,
        face_value: float = 1_000_000,
    ) -> float:
        """Dollar value of 1bp move on a zero-coupon bond."""
        duration = maturity / (1 + yield_rate)
        dv01 = duration * face_value * 0.0001
        return round(dv01, 2)

    @staticmethod
    def bear_steepener_vs_flattener(
        previous_curve: list[YieldCurvePoint],
        current_curve: list[YieldCurvePoint],
    ) -> dict:
        """Classify as bear/bull steepener/flattener."""
        prev_spread = YieldCurveAnalyzer.spread(previous_curve, 2, 10)
        curr_spread = YieldCurveAnalyzer.spread(current_curve, 2, 10)

        prev_10y = next((p.yield_rate for p in previous_curve if abs(p.maturity_years - 10) < 0.1), 0)
        curr_10y = next((p.yield_rate for p in current_curve if abs(p.maturity_years - 10) < 0.1), 0)

        spread_change = curr_spread - prev_spread
        yield_change = curr_10y - prev_10y

        if spread_change > 0:
            move = "steepening"
            category = "bear_steepener" if yield_change > 0 else "bull_steepener"
        else:
            move = "flattening"
            category = "bear_flattener" if yield_change > 0 else "bull_flattener"

        return {
            "spread_change": round(spread_change, 4),
            "10y_yield_change": round(yield_change, 4),
            "move": move,
            "category": category,
        }


# ── Inflation Regime Detector ─────────────────────────────────────────

class InflationRegimeDetector:
    """Classify current inflation environment and its market implications."""

    @staticmethod
    def classify_inflation(
        cpi_yoy: float,
        cpi_mom: float,
        core_cpi_yoy: float,
        pce_yoy: float = 0.0,
        breakeven_10y: float = 0.025,
    ) -> dict:
        """Classify inflation regime and trending direction."""
        avg_inflation = (cpi_yoy + core_cpi_yoy + (pce_yoy if pce_yoy else cpi_yoy)) / (3 if pce_yoy else 2)

        if avg_inflation > 0.06:
            regime = "high_inflation"
        elif avg_inflation > 0.03:
            regime = "elevated_inflation"
        elif avg_inflation > 0.015:
            regime = "target_inflation"
        else:
            regime = "below_target"

        trend = "rising" if cpi_mom > 0.003 else "falling" if cpi_mom < -0.001 else "stable"

        market_implications = {
            "high_inflation": "bearish_bonds_bullish_commodities",
            "elevated_inflation": "cautious_equities",
            "target_inflation": "goldilocks_equities_bonds",
            "below_target": "bullish_bonds_cautious_equities",
        }

        return {
            "regime": regime,
            "trend": trend,
            "cpi_yoy": round(cpi_yoy, 4),
            "core_cpi_yoy": round(core_cpi_yoy, 4),
            "breakeven_vs_cpi": round(breakeven_10y - cpi_yoy, 4),
            "market_implication": market_implications.get(regime, "neutral"),
        }

    @staticmethod
    def real_rates(nominal_yield: float, breakeven_inflation: float) -> dict:
        """Real rate = nominal - breakeven inflation."""
        real = nominal_yield - breakeven_inflation
        return {
            "nominal_yield": round(nominal_yield, 4),
            "breakeven_inflation": round(breakeven_inflation, 4),
            "real_rate": round(real, 4),
            "real_rate_regime": (
                "deeply_negative" if real < -0.01
                else "negative" if real < 0
                else "zero_boundary" if real < 0.005
                else "positive_supportive" if real < 0.015
                else "restrictive"
            ),
        }


# ── ISM / PMI Analyzer ───────────────────────────────────────────────

class ISMAnalyzer:
    """Process ISM / PMI data for market signals."""

    ISM_THRESHOLDS = {
        "expansion": 50.0,
        "strong_expansion": 55.0,
        "contraction": 50.0,
        "deep_contraction": 45.0,
    }

    @staticmethod
    def classify_ism(ism_value: float, previous: float = 0) -> dict:
        expansion = ism_value >= 50
        change = ism_value - previous if previous else 0
        acceleration = change > 0

        if ism_value >= 55:
            regime = "strong_expansion"
        elif ism_value >= 50:
            regime = "expansion"
        elif ism_value >= 45:
            regime = "mild_contraction"
        else:
            regime = "recession_territory"

        return {
            "ism_value": round(ism_value, 1),
            "expanding": expansion,
            "regime": regime,
            "mom_change": round(change, 1),
            "accelerating": acceleration,
            "signal": (
                "strong_buy" if ism_value > 55 and acceleration
                else "buy" if expansion and acceleration
                else "sell" if not expansion and not acceleration
                else "neutral"
            ),
        }

    @staticmethod
    def ism_composite(
        manufacturing: float,
        services: float,
        employment: float = 0.0,
    ) -> dict:
        """Composite PMI from manufacturing and services."""
        mfg_weight = 0.3
        svc_weight = 0.7
        composite = mfg_weight * manufacturing + svc_weight * services
        return {
            "composite_pmi": round(composite, 1),
            "manufacturing_pmi": round(manufacturing, 1),
            "services_pmi": round(services, 1),
            "expansion": composite >= 50,
        }


# ── Recession Probability Model ───────────────────────────────────────

class RecessionProbabilityModel:
    """
    Estimate recession probability using yield curve, ISM, and unemployment.
    Uses a simplified probit-style scoring.
    """

    @staticmethod
    def estimate(
        spread_10y_3m: float,      # 10y minus 3m Treasury spread
        ism_manufacturing: float,
        unemployment_rate: float,
        unemployment_change_3m: float = 0.0,  # positive = rising
        leading_index_6m_change: float = 0.0,
    ) -> dict:
        """
        Simple recession probability score 0-100.
        Based on Fed NY model approximation.
        """
        score = 0.0

        # Yield curve inversion is strongest predictor
        if spread_10y_3m < -0.01:
            score += 40 + abs(spread_10y_3m) * 500  # deeper inversion = higher prob
        elif spread_10y_3m < 0.005:
            score += 15

        # ISM below 50 = contraction
        if ism_manufacturing < 45:
            score += 25
        elif ism_manufacturing < 50:
            score += 10

        # Unemployment rising
        if unemployment_change_3m > 0.003:
            score += 20
        elif unemployment_change_3m > 0.001:
            score += 10

        # Leading index declining
        if leading_index_6m_change < -0.03:
            score += 15
        elif leading_index_6m_change < 0:
            score += 5

        prob = min(score, 100)

        return {
            "recession_probability": round(prob, 1),
            "risk_level": (
                "high" if prob > 60
                else "elevated" if prob > 40
                else "moderate" if prob > 20
                else "low"
            ),
            "components": {
                "yield_curve_contribution": min(max(40 + abs(spread_10y_3m) * 500 if spread_10y_3m < -0.01 else 0, 0), 40),
                "ism_contribution": 25 if ism_manufacturing < 45 else 10 if ism_manufacturing < 50 else 0,
                "unemployment_contribution": 20 if unemployment_change_3m > 0.003 else 0,
            },
        }


# ── Macro Regime ──────────────────────────────────────────────────────

class MacroRegimeClassifier:
    """Classify macro regime based on growth + inflation combination."""

    @staticmethod
    def classify(
        gdp_growth_rate: float,    # annualized
        inflation_rate: float,     # CPI YoY
        growth_trend: str = "stable",  # "rising", "falling", "stable"
        inflation_trend: str = "stable",
    ) -> dict:
        growth_above_trend = gdp_growth_rate > 0.025  # ~2.5% trend
        inflation_above_target = inflation_rate > 0.03

        if growth_above_trend and not inflation_above_target:
            regime = MacroRegime.GOLDILOCKS
        elif growth_above_trend and inflation_above_target:
            regime = MacroRegime.REFLATION
        elif not growth_above_trend and inflation_above_target:
            regime = MacroRegime.STAGFLATION
        else:
            regime = MacroRegime.DEFLATION

        asset_allocation = {
            MacroRegime.GOLDILOCKS: {"equities": 0.65, "bonds": 0.20, "commodities": 0.10, "cash": 0.05},
            MacroRegime.REFLATION: {"equities": 0.55, "commodities": 0.25, "bonds": 0.10, "cash": 0.10},
            MacroRegime.STAGFLATION: {"commodities": 0.35, "inflation_bonds": 0.25, "equities": 0.25, "cash": 0.15},
            MacroRegime.DEFLATION: {"bonds": 0.50, "cash": 0.30, "equities": 0.15, "commodities": 0.05},
        }

        return {
            "regime": regime.value,
            "gdp_growth": round(gdp_growth_rate, 4),
            "inflation_rate": round(inflation_rate, 4),
            "growth_trend": growth_trend,
            "inflation_trend": inflation_trend,
            "recommended_allocation": asset_allocation.get(regime, {}),
        }

    @staticmethod
    def fomc_stance(
        fed_funds_rate: float,
        neutral_rate: float = 0.025,        # r-star
        latest_move_bps: int = 0,
        dot_plot_next_12m: float = 0.0,     # implied path
        inflation_gap: float = 0.0,         # inflation vs 2% target
    ) -> dict:
        """Classify FOMC stance on dovish-hawkish spectrum."""
        rate_gap = fed_funds_rate - neutral_rate

        if latest_move_bps >= 50 or (rate_gap < 0 and dot_plot_next_12m > 0.01):
            stance = FOMCStance.HAWKISH
        elif latest_move_bps >= 25 or rate_gap < -0.005:
            stance = FOMCStance.HAWKISH_HOLD
        elif inflation_gap < -0.005 and latest_move_bps <= -25:
            stance = FOMCStance.DOVISH
        elif inflation_gap < 0 or dot_plot_next_12m < -0.005:
            stance = FOMCStance.DOVISH_HOLD
        else:
            stance = FOMCStance.NEUTRAL

        return {
            "stance": stance.value,
            "fed_funds_rate": round(fed_funds_rate, 4),
            "neutral_rate": round(neutral_rate, 4),
            "rate_gap_vs_neutral": round(rate_gap, 4),
            "latest_move_bps": latest_move_bps,
            "market_implication": {
                FOMCStance.HAWKISH.value: "bearish_bonds_bearish_growth_equities",
                FOMCStance.HAWKISH_HOLD.value: "flat_bonds_mixed_equities",
                FOMCStance.NEUTRAL.value: "neutral_all",
                FOMCStance.DOVISH_HOLD.value: "mildly_bullish_bonds",
                FOMCStance.DOVISH.value: "bullish_bonds_bullish_equities",
            }.get(stance.value, "neutral"),
        }


# ── Orchestrator ──────────────────────────────────────────────────────

class MacroIndicatorsEngine:
    """Top-level orchestrator for all macro analytics."""

    def __init__(self):
        self.yield_curve = YieldCurveAnalyzer()
        self.inflation = InflationRegimeDetector()
        self.ism = ISMAnalyzer()
        self.recession = RecessionProbabilityModel()
        self.regime = MacroRegimeClassifier()

    def analyze_yield_curve(self, curve: list[YieldCurvePoint]) -> dict:
        return self.yield_curve.classify_shape(curve)

    def real_rates(self, nominal: float, breakeven: float) -> dict:
        return self.inflation.real_rates(nominal, breakeven)

    def inflation_regime(
        self, cpi_yoy: float, cpi_mom: float, core_cpi_yoy: float
    ) -> dict:
        return self.inflation.classify_inflation(cpi_yoy, cpi_mom, core_cpi_yoy)

    def ism_signal(self, manufacturing: float, services: float) -> dict:
        return self.ism.ism_composite(manufacturing, services)

    def recession_prob(
        self,
        spread_10y_3m: float,
        ism_mfg: float,
        unemployment: float,
        unemployment_change: float = 0.0,
    ) -> dict:
        return self.recession.estimate(spread_10y_3m, ism_mfg, unemployment, unemployment_change)

    def macro_regime(self, gdp: float, inflation: float) -> dict:
        return self.regime.classify(gdp, inflation)

    def fomc_stance(self, fed_rate: float, latest_bps: int = 0) -> dict:
        return self.regime.fomc_stance(fed_rate, latest_move_bps=latest_bps)

    def full_macro_dashboard(
        self,
        curve: list[YieldCurvePoint],
        cpi_yoy: float,
        core_cpi_yoy: float,
        cpi_mom: float,
        ism_mfg: float,
        ism_svc: float,
        gdp_growth: float,
        fed_rate: float,
        unemployment: float,
    ) -> dict:
        """One-shot comprehensive macro snapshot."""
        yc = self.yield_curve.classify_shape(curve)
        spread_3m_10y = yc.get("spread_3m_10y", 0)

        return {
            "yield_curve": yc,
            "inflation": self.inflation.classify_inflation(cpi_yoy, cpi_mom, core_cpi_yoy),
            "ism_composite": self.ism.ism_composite(ism_mfg, ism_svc),
            "recession_probability": self.recession.estimate(
                spread_3m_10y, ism_mfg, unemployment
            ),
            "macro_regime": self.regime.classify(gdp_growth, cpi_yoy),
            "fomc_stance": self.regime.fomc_stance(fed_rate),
        }

    def capabilities(self) -> dict:
        return {
            "engine": "MacroIndicatorsEngine",
            "version": "1.0.0",
            "features": [
                "yield_curve_shape_classification",
                "2y10y_3m10y_spread_analysis",
                "term_premium_estimation",
                "bear_bull_steepener_flattener",
                "duration_dv01_calculation",
                "inflation_regime_detection",
                "real_rate_calculation",
                "cpi_core_pce_analysis",
                "breakeven_inflation_signal",
                "ism_manufacturing_services_classification",
                "composite_pmi",
                "recession_probability_model",
                "yield_curve_recession_signal",
                "macro_regime_goldilocks_stagflation",
                "fomc_stance_dovish_hawkish",
                "full_macro_dashboard_snapshot",
            ],
        }
