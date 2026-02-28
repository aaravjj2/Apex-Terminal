"""
statistical_arb_routes.py — Statistical Arbitrage Engine REST API
===================================================================
Pair screening, cointegration testing, spread calculation, mean reversion,
signal generation, backtesting, distance ranking, portfolio construction.

Endpoints:
    POST /api/v2/statarb/screen             → Screen pairs by correlation
    POST /api/v2/statarb/analyze            → Analyze a pair in detail
    POST /api/v2/statarb/signals            → Generate trading signals
    POST /api/v2/statarb/backtest           → Backtest a pair
    POST /api/v2/statarb/distance-rank      → Distance method ranking
    POST /api/v2/statarb/correlation-risk   → Correlation breakdown risk
    POST /api/v2/statarb/portfolio          → Build multi-pair portfolio
    GET  /api/v2/statarb/capabilities       → Engine capabilities
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from phase1.services.statistical_arb_engine import (
    StatisticalArbEngine, PairCandidate,
)

router = APIRouter(prefix="/api/v2/statarb", tags=["Statistical Arbitrage"])

_engine = StatisticalArbEngine()


# ── Pydantic Models ─────────────────────────────────────────────────────

class ScreenPairsRequest(BaseModel):
    prices: Dict[str, List[float]]
    min_correlation: float = 0.7


class AnalyzePairRequest(BaseModel):
    prices_a: List[float]
    prices_b: List[float]
    symbol_a: str = "A"
    symbol_b: str = "B"


class GenerateSignalsRequest(BaseModel):
    prices_a: List[float]
    prices_b: List[float]
    entry_z: float = 2.0
    exit_z: float = 0.5
    stop_z: float = 3.5


class BacktestPairRequest(BaseModel):
    prices_a: List[float]
    prices_b: List[float]
    entry_z: float = 2.0
    exit_z: float = 0.5
    stop_z: float = 3.5
    capital_per_leg: float = 10000.0


class DistanceRankRequest(BaseModel):
    prices: Dict[str, List[float]]
    top_n: int = 10


class CorrelationRiskRequest(BaseModel):
    prices_a: List[float]
    prices_b: List[float]
    window: int = 30


class PortfolioRequest(BaseModel):
    candidates: List[Dict[str, Any]]
    total_capital: float = 100000.0
    max_pairs: int = 5
    method: str = "quality_weighted"


# ── Endpoints ───────────────────────────────────────────────────────────

@router.post("/screen")
async def screen_pairs(req: ScreenPairsRequest) -> Dict[str, Any]:
    """Screen pairs by correlation."""
    result = _engine.screen_pairs(req.prices, min_correlation=req.min_correlation)
    return {"pairs": result, "total": len(result)}


@router.post("/analyze")
async def analyze_pair(req: AnalyzePairRequest) -> Dict[str, Any]:
    """Analyze a single pair in detail."""
    return _engine.analyze_pair(req.prices_a, req.prices_b, req.symbol_a, req.symbol_b)


@router.post("/signals")
async def generate_signals(req: GenerateSignalsRequest) -> Dict[str, Any]:
    """Generate trading signals for a pair."""
    signals = _engine.generate_signals(
        req.prices_a, req.prices_b,
        entry_z=req.entry_z, exit_z=req.exit_z, stop_z=req.stop_z,
    )
    return {"signals": [{"index": s.date_idx, "type": s.signal_type.value, "z_score": round(s.z_score, 4)} for s in signals], "total": len(signals)}


@router.post("/backtest")
async def backtest_pair(req: BacktestPairRequest) -> Dict[str, Any]:
    """Backtest a pair trading strategy."""
    return _engine.backtest_pair(
        req.prices_a, req.prices_b,
        entry_z=req.entry_z, exit_z=req.exit_z, stop_z=req.stop_z,
        capital_per_leg=req.capital_per_leg,
    )


@router.post("/distance-rank")
async def distance_ranking(req: DistanceRankRequest) -> Dict[str, Any]:
    """Rank pairs by distance method."""
    result = _engine.distance_ranking(req.prices, top_n=req.top_n)
    return {"ranked_pairs": result, "total": len(result)}


@router.post("/correlation-risk")
async def correlation_risk(req: CorrelationRiskRequest) -> Dict[str, Any]:
    """Assess correlation breakdown risk."""
    return _engine.correlation_risk(req.prices_a, req.prices_b, window=req.window)


@router.post("/portfolio")
async def build_portfolio(req: PortfolioRequest) -> Dict[str, Any]:
    """Build a multi-pair portfolio."""
    candidates = []
    for c in req.candidates:
        candidates.append(PairCandidate(
            symbol_a=c.get("symbol_a", "A"),
            symbol_b=c.get("symbol_b", "B"),
            correlation=c.get("correlation", 0.8),
            cointegration_pvalue=c.get("cointegration_pvalue", 0.05),
            hedge_ratio=c.get("hedge_ratio", 1.0),
            half_life=c.get("half_life", 20.0),
            hurst_exponent=c.get("hurst_exponent", 0.4),
            spread_std=c.get("spread_std", 3.0),
        ))
    return _engine.build_portfolio(candidates, req.total_capital, req.max_pairs, req.method)


@router.get("/capabilities")
async def capabilities() -> Dict[str, Any]:
    """Get engine capabilities."""
    return _engine.capabilities()
