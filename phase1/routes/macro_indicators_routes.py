"""
FastAPI routes for MacroIndicatorsEngine — yield curve, inflation, ISM, recession probability.
"""
from __future__ import annotations

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.macro_indicators_engine import (
    MacroIndicatorsEngine,
    YieldCurvePoint,
    MacroIndicator,
    MacroRegime,
    FOMCStance,
)

router = APIRouter(prefix="/api/macro", tags=["Macro Indicators"])
_engine = MacroIndicatorsEngine()


# ─── Request / Response Models ────────────────────────────────────────────────

class YieldCurvePointInput(BaseModel):
    maturity_years: float = Field(..., ge=0.0, description="Maturity in years")
    yield_rate: float = Field(..., ge=0.0, le=0.30, description="Yield rate as decimal (e.g. 0.045 = 4.5%)")


class YieldCurveRequest(BaseModel):
    points: List[YieldCurvePointInput] = Field(..., min_items=2, description="Yield curve points")


class InflationRequest(BaseModel):
    cpi_yoy: float = Field(..., description="CPI year-over-year change (decimal)")
    pce_yoy: float = Field(..., description="PCE year-over-year change (decimal)")
    breakeven_10y: float = Field(..., description="10-year breakeven inflation rate (decimal)")
    prev_cpi_yoy: Optional[float] = Field(None, description="Prior month CPI YoY for trend")


class ISMRequest(BaseModel):
    series: str = Field(..., description="ISM series: manufacturing|services")
    current: float = Field(..., ge=0, le=100, description="Current ISM reading")
    previous: float = Field(..., ge=0, le=100, description="Previous month ISM reading")


class ISMCompositeRequest(BaseModel):
    mfg_ism: float = Field(..., ge=0, le=100)
    services_ism: float = Field(..., ge=0, le=100)
    prev_mfg: Optional[float] = Field(None)
    prev_svc: Optional[float] = Field(None)


class RecessionProbRequest(BaseModel):
    yield_curve_spread: float = Field(..., description="10y-2y or 10y-3m spread (decimal)")
    ism_composite: float = Field(..., ge=0, le=100)
    unemployment_rate: float = Field(..., ge=0, le=1, description="Unemployment rate as decimal (e.g. 0.04 = 4%)")
    leading_index_yoy: float = Field(..., description="Conference Board LEI YoY change")


class MacroRegimeRequest(BaseModel):
    gdp_growth: float = Field(..., description="GDP growth rate (decimal, e.g. 0.025 = 2.5%)")
    inflation: float = Field(..., description="Inflation rate (decimal, e.g. 0.03 = 3%)")


class FOMCRequest(BaseModel):
    fed_funds_rate: float = Field(..., description="Current federal funds rate (decimal)")
    inflation: float = Field(..., description="Current inflation rate (decimal)")
    neutral_rate: float = Field(0.025, description="Estimated neutral rate (decimal)")
    unemployment: Optional[float] = Field(None, description="Current unemployment rate")
    gdp_growth: Optional[float] = Field(None, description="Current GDP growth")


class FullMacroDashboardRequest(BaseModel):
    yield_curve: List[YieldCurvePointInput] = Field(..., min_items=2)
    cpi_yoy: float
    pce_yoy: float
    breakeven_10y: float
    ism_mfg: float = Field(..., ge=0, le=100)
    ism_mfg_prev: float = Field(..., ge=0, le=100)
    ism_svc: float = Field(..., ge=0, le=100)
    ism_svc_prev: float = Field(..., ge=0, le=100)
    unemployment: float = Field(..., ge=0, le=1)
    leading_index_yoy: float
    gdp_growth: float
    fed_funds_rate: float
    neutral_rate: float = Field(0.025)
    prev_cpi_yoy: Optional[float] = Field(None)


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/capabilities")
def get_capabilities():
    """Return engine capabilities and supported indicators."""
    return _engine.capabilities()


@router.post("/yield-curve/analyze")
def analyze_yield_curve(body: YieldCurveRequest):
    """Analyze yield curve shape, spreads, and term premium."""
    try:
        points = [YieldCurvePoint(p.maturity_years, p.yield_rate) for p in body.points]
        result = _engine.analyze_yield_curve(points)
        if not result:
            raise HTTPException(status_code=422, detail="Insufficient yield curve data")
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/real-rates")
def real_rates(nominal_10y: float, breakeven_10y: float):
    """Compute real 10-year rates (nominal minus breakeven inflation)."""
    try:
        rr = _engine.real_rates(nominal_10y, breakeven_10y)
        label = "positive" if rr > 0 else "negative"
        context = (
            "Restrictive monetary environment" if rr > 0.01
            else "Loose monetary conditions" if rr < -0.005
            else "Neutral real rates"
        )
        return {
            "nominal_10y": nominal_10y,
            "breakeven_10y": breakeven_10y,
            "real_rate": round(rr, 6),
            "real_rate_pct": round(rr * 100, 3),
            "label": label,
            "context": context,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/inflation/regime")
def inflation_regime(body: InflationRequest):
    """Classify current inflation regime and provide market implications."""
    try:
        result = _engine.inflation_regime(body.cpi_yoy, body.pce_yoy, body.breakeven_10y)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/ism/signal")
def ism_signal(body: ISMRequest):
    """Classify ISM reading and generate economic signal."""
    try:
        result = _engine.ism_signal(body.series, body.current, body.previous)
        return {"series": body.series, **result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/ism/composite")
def ism_composite(body: ISMCompositeRequest):
    """Compute weighted ISM composite (30% manufacturing + 70% services)."""
    try:
        from services.macro_indicators_engine import ISMAnalyzer
        result = ISMAnalyzer.ism_composite(body.mfg_ism, body.services_ism)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/recession-probability")
def recession_probability(body: RecessionProbRequest):
    """Estimate recession probability (0-100) from macro indicators."""
    try:
        prob = _engine.recession_prob(
            body.yield_curve_spread,
            body.ism_composite,
            body.unemployment_rate,
            body.leading_index_yoy,
        )
        risk_level = (
            "low" if prob < 20
            else "elevated" if prob < 40
            else "high" if prob < 65
            else "very_high"
        )
        return {
            "recession_probability": round(prob, 2),
            "risk_level": risk_level,
            "inputs": {
                "yield_curve_spread_pct": round(body.yield_curve_spread * 100, 3),
                "ism_composite": body.ism_composite,
                "unemployment_pct": round(body.unemployment_rate * 100, 2),
                "leading_index_yoy_pct": round(body.leading_index_yoy * 100, 2),
            }
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/macro-regime")
def macro_regime(body: MacroRegimeRequest):
    """Classify the macro regime quadrant (Goldilocks, Stagflation, Reflation, Deflation)."""
    try:
        result = _engine.macro_regime(body.gdp_growth, body.inflation)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/fomc/stance")
def fomc_stance(body: FOMCRequest):
    """Classify FOMC monetary policy stance on the hawkish-dovish spectrum."""
    try:
        result = _engine.fomc_stance(body.fed_funds_rate, body.inflation, body.neutral_rate)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/dashboard")
def full_macro_dashboard(body: FullMacroDashboardRequest):
    """Generate comprehensive macro indicators dashboard."""
    try:
        points = [YieldCurvePoint(p.maturity_years, p.yield_rate) for p in body.yield_curve]
        result = _engine.full_macro_dashboard(
            yield_curve=points,
            cpi_yoy=body.cpi_yoy,
            pce_yoy=body.pce_yoy,
            breakeven_10y=body.breakeven_10y,
            ism_mfg=body.ism_mfg,
            ism_mfg_prev=body.ism_mfg_prev,
            ism_svc=body.ism_svc,
            ism_svc_prev=body.ism_svc_prev,
            unemployment=body.unemployment,
            leading_index_yoy=body.leading_index_yoy,
            gdp_growth=body.gdp_growth,
            fed_funds_rate=body.fed_funds_rate,
            neutral_rate=body.neutral_rate,
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/regimes/all")
def all_regimes():
    """Return all macro regime definitions and their characteristic allocations."""
    results = {}
    from services.macro_indicators_engine import MacroRegimeClassifier
    regime_inputs = [
        (MacroRegime.GOLDILOCKS, 0.03, 0.022),
        (MacroRegime.STAGFLATION, 0.01, 0.07),
        (MacroRegime.REFLATION, 0.04, 0.055),
        (MacroRegime.DEFLATION, 0.005, 0.008),
    ]
    for regime, gdp, inflation in regime_inputs:
        results[regime.value] = MacroRegimeClassifier.classify(gdp, inflation)
    return results


@router.get("/fomc/stances")
def all_fomc_stances():
    """Return all FOMC stance definitions with example conditions."""
    return {
        "stances": [s.value for s in FOMCStance],
        "description": {
            "very_hawkish": "Real rates well above neutral, aggressive tightening bias",
            "hawkish": "Above-neutral rates, inflation-fighting priority",
            "neutral": "At or near neutral rate, data-dependent",
            "dovish": "Below neutral, supporting growth",
            "very_dovish": "Near-zero rates, potential QE, financial stress response",
        }
    }
