"""
FastAPI routes for FactorModelEngine — Fama-French analysis, smart beta, factor attribution.
"""
from __future__ import annotations

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.factor_model_engine import (
    FactorModelEngine,
    StockFactorData,
    FactorType,
)

router = APIRouter(prefix="/api/factor-model", tags=["Factor Model"])
_engine = FactorModelEngine()


# ─── Request / Response Models ────────────────────────────────────────────────

class StockFactorInput(BaseModel):
    symbol: str = Field(..., description="Ticker symbol")
    market_cap: float = Field(..., description="Market cap in USD")
    book_value: float = Field(..., description="Book value per share in USD")
    price: float = Field(..., description="Current price in USD")
    eps_ttm: float = Field(0.0, description="EPS trailing twelve months")
    revenue_growth: float = Field(0.0, description="YoY revenue growth decimal")
    roe: float = Field(0.0, description="Return on equity decimal")
    debt_to_equity: float = Field(0.0, description="Debt-to-equity ratio")
    gross_margin: float = Field(0.0, description="Gross margin decimal")
    prices_12m: List[float] = Field(default_factory=list, description="12 months of monthly prices")


class FamaFrenchInput(BaseModel):
    excess_returns: List[float] = Field(..., description="Stock excess returns over risk-free")
    mkt_rf: List[float] = Field(..., description="Market excess return (MKT-RF)")
    smb: List[float] = Field(..., description="Small-minus-big factor returns")
    hml: List[float] = Field(..., description="High-minus-low factor returns")
    rmw: Optional[List[float]] = Field(None, description="Robust-minus-weak (5-factor)")
    cma: Optional[List[float]] = Field(None, description="Conservative-minus-aggressive (5-factor)")

    class Config:
        schema_extra = {
            "example": {
                "excess_returns": [0.01, -0.02, 0.015],
                "mkt_rf": [0.008, -0.015, 0.012],
                "smb": [0.002, 0.001, -0.001],
                "hml": [-0.001, 0.003, 0.002],
            }
        }


class FactorAttributionInput(BaseModel):
    stock_returns: List[float] = Field(..., description="Individual stock return series")
    factor_returns: Dict[str, List[float]] = Field(..., description="Factor return series keyed by factor name")
    factor_exposures: Dict[str, float] = Field(..., description="Factor exposures/betas keyed by factor name")


class PortfolioAttributionInput(BaseModel):
    holdings: List[Dict[str, Any]] = Field(
        ..., description="List of {symbol, weight, factor_exposures, stock_returns}"
    )
    factor_returns: Dict[str, List[float]] = Field(..., description="Factor return series")


class SmartBetaInput(BaseModel):
    stocks: List[StockFactorInput] = Field(..., description="Stock universe for smart-beta construction")
    factor_weights: Optional[Dict[str, float]] = Field(None, description="Custom factor weights (must sum to 1)")


class PortfolioConstructionInput(BaseModel):
    stocks: List[StockFactorInput] = Field(..., description="Stock universe")
    long_pct: float = Field(0.20, ge=0.05, le=0.50, description="Top percentile for long leg")
    short_pct: float = Field(0.20, ge=0.05, le=0.50, description="Bottom percentile for short leg")


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/capabilities")
def get_capabilities():
    """Return engine capabilities and supported features."""
    return _engine.capabilities()


@router.post("/score-stocks")
def score_stocks(stocks: List[StockFactorInput]):
    """Score a universe of stocks on all factor dimensions."""
    try:
        stock_objects = []
        for s in stocks:
            sd = StockFactorData(
                symbol=s.symbol,
                market_cap=s.market_cap,
                book_value=s.book_value,
                price=s.price,
                eps_ttm=s.eps_ttm,
                revenue_growth=s.revenue_growth,
                roe=s.roe,
                debt_to_equity=s.debt_to_equity,
                gross_margin=s.gross_margin,
                prices_12m=s.prices_12m,
            )
            stock_objects.append(sd)
        results = _engine.score_stocks(stock_objects)
        return {"count": len(results), "scores": results}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/three-factor-alpha")
def three_factor_alpha(body: FamaFrenchInput):
    """Compute Fama-French 3-factor alpha and betas."""
    try:
        result = _engine.three_factor_alpha(
            body.excess_returns, body.mkt_rf, body.smb, body.hml
        )
        if not result:
            raise HTTPException(status_code=422, detail="Insufficient data for 3-factor regression")
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/five-factor-alpha")
def five_factor_alpha(body: FamaFrenchInput):
    """Compute Fama-French 5-factor alpha and betas."""
    try:
        if body.rmw is None or body.cma is None:
            raise HTTPException(status_code=422, detail="RMW and CMA required for 5-factor model")
        result = _engine.five_factor_alpha(
            body.excess_returns, body.mkt_rf, body.smb, body.hml, body.rmw, body.cma
        )
        if not result:
            raise HTTPException(status_code=422, detail="Insufficient data")
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/attribute-returns")
def attribute_returns(body: FactorAttributionInput):
    """Decompose stock returns into factor contributions."""
    try:
        result = _engine.attribute_returns(
            body.stock_returns, body.factor_returns, body.factor_exposures
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/portfolio-attribution")
def portfolio_attribution(body: PortfolioAttributionInput):
    """Compute aggregate factor attribution for a portfolio."""
    try:
        result = _engine.portfolio_attribution(body.holdings, body.factor_returns)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/factor-tilt/{phase}")
def get_factor_tilt(phase: str):
    """Get recommended factor tilts for a given business cycle phase."""
    valid_phases = ["early_cycle", "mid_cycle", "late_cycle", "recession"]
    if phase.lower() not in valid_phases:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid phase '{phase}'. Valid: {valid_phases}"
        )
    result = _engine.get_factor_tilt(phase.lower())
    return result


@router.post("/build-portfolio")
def build_portfolio(body: PortfolioConstructionInput):
    """Build a long-short factor portfolio from scored stocks."""
    try:
        stock_objects = [
            StockFactorData(
                symbol=s.symbol, market_cap=s.market_cap, book_value=s.book_value,
                price=s.price, eps_ttm=s.eps_ttm, revenue_growth=s.revenue_growth,
                roe=s.roe, debt_to_equity=s.debt_to_equity, gross_margin=s.gross_margin,
                prices_12m=s.prices_12m,
            )
            for s in body.stocks
        ]
        result = _engine.build_portfolio(
            stock_objects, body.long_pct, body.short_pct
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/smart-beta")
def smart_beta(body: SmartBetaInput):
    """Construct a smart-beta factor-weighted portfolio."""
    try:
        stock_objects = [
            StockFactorData(
                symbol=s.symbol, market_cap=s.market_cap, book_value=s.book_value,
                price=s.price, eps_ttm=s.eps_ttm, revenue_growth=s.revenue_growth,
                roe=s.roe, debt_to_equity=s.debt_to_equity, gross_margin=s.gross_margin,
                prices_12m=s.prices_12m,
            )
            for s in body.stocks
        ]
        scores = _engine.score_stocks(stock_objects)
        from services.factor_model_engine import SmartBetaCalculator
        factor_scores = [s.get("composite_score", 50) / 100.0 for s in scores]
        weights = SmartBetaCalculator.factor_weighted_portfolio(
            [s.symbol for s in stock_objects], factor_scores
        )
        return {"weights": weights, "stock_count": len(weights)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
