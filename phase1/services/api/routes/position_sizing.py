"""
position_sizing_routes.py — Position Sizing REST API
======================================================
Kelly, fixed fractional, percent risk, volatility, optimal-f,
anti-martingale, max drawdown, margin-aware, portfolio heat,
scaling, risk-reward, multi-setup allocation.

Endpoints:
    POST /api/v2/sizing/kelly             → Kelly criterion sizing
    POST /api/v2/sizing/percent-risk      → Percent risk sizing
    POST /api/v2/sizing/volatility        → Volatility-based sizing
    POST /api/v2/sizing/fixed-fractional  → Fixed fractional sizing
    POST /api/v2/sizing/anti-martingale   → Anti-martingale sizing
    POST /api/v2/sizing/max-drawdown      → Max drawdown constrained
    POST /api/v2/sizing/margin            → Margin-aware sizing
    POST /api/v2/sizing/optimal-f         → Optimal-f calculation
    POST /api/v2/sizing/portfolio-heat    → Portfolio heat monitor
    POST /api/v2/sizing/scale-in          → Scale-in plan
    POST /api/v2/sizing/scale-out         → Scale-out plan
    POST /api/v2/sizing/evaluate          → Trade evaluation
    POST /api/v2/sizing/risk-of-ruin      → Risk of ruin
    POST /api/v2/sizing/compare           → Compare all methods
    POST /api/v2/sizing/allocate           → Multi-setup allocation
    GET  /api/v2/sizing/capabilities       → Engine capabilities
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

from phase1.services.position_sizing_engine import (
    PositionSizingEngine, KellyCriterion, OptimalFCalculator,
    PortfolioHeatMonitor, TradeSetup,
)

router = APIRouter(prefix="/api/v2/sizing", tags=["Position Sizing"])


class KellyRequest(BaseModel):
    capital: float = 100000
    win_rate: float = 0.55
    avg_win: float = 2.0
    avg_loss: float = 1.0
    entry_price: float = 100.0
    stop_price: float = 95.0
    fraction: float = 0.5

class PercentRiskRequest(BaseModel):
    capital: float = 100000
    risk_pct: float = 0.02
    entry_price: float = 100.0
    stop_price: float = 95.0

class VolatilityRequest(BaseModel):
    capital: float = 100000
    risk_pct: float = 0.02
    entry_price: float = 100.0
    atr: float = 2.5
    atr_multiplier: float = 2.0

class FixedFractionalRequest(BaseModel):
    capital: float = 100000
    fraction: float = 0.10
    entry_price: float = 100.0

class AntiMartingaleRequest(BaseModel):
    capital: float = 100000
    risk_pct: float = 0.02
    entry_price: float = 100.0
    stop_price: float = 95.0
    consecutive_wins: int = 0
    consecutive_losses: int = 0

class MaxDrawdownRequest(BaseModel):
    capital: float = 100000
    max_dd_pct: float = 0.20
    entry_price: float = 100.0
    stop_price: float = 95.0
    num_positions: int = 5
    correlation: float = 0.5

class MarginRequest(BaseModel):
    capital: float = 100000
    risk_pct: float = 0.02
    entry_price: float = 100.0
    stop_price: float = 95.0
    margin_multiplier: float = 2.0
    margin_used: float = 0.0

class OptimalFRequest(BaseModel):
    trade_returns: List[float]
    capital: float = 100000
    entry_price: float = 100.0

class PortfolioHeatRequest(BaseModel):
    capital: float = 100000
    positions: List[Dict[str, Any]]

class ScaleInRequest(BaseModel):
    total_shares: int
    entries: int = 3
    method: str = "pyramid"

class ScaleOutRequest(BaseModel):
    total_shares: int
    targets: List[float]
    entry_price: float

class EvaluateRequest(BaseModel):
    win_rate: float
    avg_win: float
    avg_loss: float

class RiskOfRuinRequest(BaseModel):
    win_rate: float
    payoff_ratio: float
    risk_per_trade_pct: float = 0.02

class CompareRequest(BaseModel):
    capital: float = 100000
    entry_price: float = 100.0
    stop_price: float = 95.0
    atr: float = 0.0
    win_rate: float = 0.5
    avg_win: float = 1.5
    avg_loss: float = 1.0

class SetupEntry(BaseModel):
    symbol: str
    entry_price: float
    stop_price: float
    target_price: float = 0.0
    win_rate: float = 0.5
    avg_win: float = 1.0
    avg_loss: float = 1.0
    daily_volatility: float = 0.0

class AllocateRequest(BaseModel):
    capital: float = 100000
    setups: List[SetupEntry]
    method: str = "equal_risk"
    total_risk_pct: float = 0.06


@router.post("/kelly")
def kelly(req: KellyRequest):
    engine = PositionSizingEngine(req.capital)
    result = engine.kelly_size(req.win_rate, req.avg_win, req.avg_loss,
                                req.entry_price, req.stop_price, req.fraction)
    return {"ok": True, "sizing": result.to_dict()}


@router.post("/percent-risk")
def percent_risk(req: PercentRiskRequest):
    engine = PositionSizingEngine(req.capital, req.risk_pct)
    result = engine.percent_risk_size(req.entry_price, req.stop_price)
    return {"ok": True, "sizing": result.to_dict()}


@router.post("/volatility")
def volatility(req: VolatilityRequest):
    engine = PositionSizingEngine(req.capital, req.risk_pct)
    result = engine.volatility_size(req.entry_price, req.atr, req.atr_multiplier)
    return {"ok": True, "sizing": result.to_dict()}


@router.post("/fixed-fractional")
def fixed_fractional(req: FixedFractionalRequest):
    engine = PositionSizingEngine(req.capital)
    result = engine.fixed_fractional_size(req.entry_price, req.fraction)
    return {"ok": True, "sizing": result.to_dict()}


@router.post("/anti-martingale")
def anti_martingale(req: AntiMartingaleRequest):
    engine = PositionSizingEngine(req.capital, req.risk_pct)
    result = engine.anti_martingale_size(req.entry_price, req.stop_price,
                                         req.consecutive_wins, req.consecutive_losses)
    return {"ok": True, "sizing": result.to_dict()}


@router.post("/max-drawdown")
def max_drawdown(req: MaxDrawdownRequest):
    engine = PositionSizingEngine(req.capital)
    result = engine.max_drawdown_size(req.entry_price, req.stop_price,
                                      req.max_dd_pct, req.num_positions)
    return {"ok": True, "sizing": result.to_dict()}


@router.post("/margin")
def margin(req: MarginRequest):
    engine = PositionSizingEngine(req.capital, req.risk_pct)
    result = engine.margin_size(req.entry_price, req.stop_price,
                                 req.margin_multiplier, req.margin_used)
    return {"ok": True, "sizing": result.to_dict()}


@router.post("/optimal-f")
def optimal_f(req: OptimalFRequest):
    f, twr = OptimalFCalculator.find_optimal_f(req.trade_returns)
    result = OptimalFCalculator.size_from_optimal_f(
        req.capital, f, abs(min(req.trade_returns)) if req.trade_returns else 1,
        req.entry_price)
    return {"ok": True, "optimal_f": f, "twr": twr, "sizing": result.to_dict()}


@router.post("/portfolio-heat")
def portfolio_heat(req: PortfolioHeatRequest):
    result = PortfolioHeatMonitor.calculate_heat(req.positions, req.capital)
    return {"ok": True, "heat": result}


@router.post("/scale-in")
def scale_in(req: ScaleInRequest):
    engine = PositionSizingEngine()
    result = engine.scale_in(req.total_shares, req.entries, req.method)
    return {"ok": True, "plan": result}


@router.post("/scale-out")
def scale_out(req: ScaleOutRequest):
    engine = PositionSizingEngine()
    result = engine.scale_out(req.total_shares, req.targets, req.entry_price)
    return {"ok": True, "plan": result}


@router.post("/evaluate")
def evaluate(req: EvaluateRequest):
    engine = PositionSizingEngine()
    result = engine.evaluate_trade(req.win_rate, req.avg_win, req.avg_loss)
    return {"ok": True, "evaluation": result}


@router.post("/risk-of-ruin")
def risk_of_ruin(req: RiskOfRuinRequest):
    engine = PositionSizingEngine()
    ror = engine.risk_of_ruin(req.win_rate, req.payoff_ratio, req.risk_per_trade_pct)
    return {"ok": True, "risk_of_ruin": round(ror, 6)}


@router.post("/compare")
def compare(req: CompareRequest):
    engine = PositionSizingEngine(req.capital)
    result = engine.compare_methods(req.entry_price, req.stop_price,
                                     req.atr, req.win_rate, req.avg_win, req.avg_loss)
    return {"ok": True, "methods": result}


@router.post("/allocate")
def allocate(req: AllocateRequest):
    setups = [TradeSetup(
        symbol=s.symbol, entry_price=s.entry_price, stop_price=s.stop_price,
        target_price=s.target_price, win_rate=s.win_rate,
        avg_win=s.avg_win, avg_loss=s.avg_loss, daily_volatility=s.daily_volatility)
        for s in req.setups]
    engine = PositionSizingEngine(req.capital)
    result = engine.allocate_setups(setups, req.method, req.total_risk_pct)
    return {"ok": True, "allocation": result}


@router.get("/capabilities")
def capabilities():
    engine = PositionSizingEngine()
    return {"ok": True, **engine.capabilities()}
