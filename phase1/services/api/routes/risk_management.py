"""
risk_management.py — Risk Management REST API
===============================================
Endpoints for position sizing, exposure limits, margin calculations,
Greeks risk, scenario analysis, compliance, risk reporting, correlation,
tail and liquidity risk.

Endpoints:
    POST /api/v1/risk/sizing/fixed-fractional     → Fixed fractional sizing
    POST /api/v1/risk/sizing/kelly                 → Kelly criterion sizing
    POST /api/v1/risk/sizing/volatility            → Volatility-scaled sizing
    POST /api/v1/risk/sizing/optimal-f             → Optimal f sizing
    POST /api/v1/risk/sizing/atr                   → ATR-based sizing
    POST /api/v1/risk/sizing/equal-weight          → Equal weight sizing
    POST /api/v1/risk/sizing/max-drawdown          → Max drawdown sizing
    POST /api/v1/risk/exposure/check-position      → Check position limit
    POST /api/v1/risk/exposure/check-sector        → Check sector limit
    POST /api/v1/risk/exposure/check-leverage      → Check leverage
    POST /api/v1/risk/exposure/max-additional       → Max additional exposure
    POST /api/v1/risk/exposure/check-concentration  → Check concentration
    POST /api/v1/risk/margin/equity                → Reg-T equity margin
    POST /api/v1/risk/margin/options               → Options margin
    POST /api/v1/risk/margin/portfolio             → Portfolio margin estimate
    POST /api/v1/risk/margin/call-price            → Margin call trigger price
    POST /api/v1/risk/greeks/aggregate             → Aggregate Greeks
    POST /api/v1/risk/greeks/pnl-estimate          → Greeks P&L estimate
    POST /api/v1/risk/greeks/stress                → Greeks stress matrix
    POST /api/v1/risk/greeks/delta-hedge           → Delta hedge ratio
    POST /api/v1/risk/scenarios/run                → Run named scenario
    POST /api/v1/risk/scenarios/historical          → All historical scenarios
    POST /api/v1/risk/scenarios/sensitivity         → Sensitivity analysis
    POST /api/v1/risk/scenarios/custom              → Custom scenario
    POST /api/v1/risk/compliance/pre-trade          → Pre-trade check
    POST /api/v1/risk/compliance/portfolio          → Portfolio compliance
    POST /api/v1/risk/report/daily                  → Daily risk report
    POST /api/v1/risk/correlation/diversification    → Diversification ratio
    POST /api/v1/risk/correlation/regime             → Correlation regime
    POST /api/v1/risk/correlation/crowded            → Crowded trade score
    POST /api/v1/risk/tail/analysis                  → Full tail risk analysis
    POST /api/v1/risk/tail/crash-probability          → Crash probability
    POST /api/v1/risk/liquidity/days-to-liquidate    → Days to liquidate
    POST /api/v1/risk/liquidity/impact               → Market impact estimate
    POST /api/v1/risk/liquidity/score                → Liquidity score
    POST /api/v1/risk/liquidity/portfolio             → Portfolio liquidity
    GET  /api/v1/risk/capabilities                   → List capabilities
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import pandas as pd
import numpy as np

from phase1.services.risk_management_engine import (
    PositionSizer, ExposureLimiter, MarginCalculator,
    GreeksRisk, ScenarioEngine, ComplianceChecker,
    RiskReporter, CorrelationRisk, TailRisk, LiquidityRisk,
    RiskLimits, GreeksSnapshot,
)

router = APIRouter(prefix="/api/v1/risk", tags=["Risk Management"])


# ─── Pydantic Models ────────────────────────────────────────────────────────

class FixedFractionalRequest(BaseModel):
    equity: float
    risk_pct: float
    entry_price: float
    stop_price: float


class KellyRequest(BaseModel):
    win_rate: float
    avg_win: float
    avg_loss: float
    fraction: float = 0.5


class VolSizingRequest(BaseModel):
    equity: float
    risk_pct: float
    volatility: float
    target_vol: float = 0.10


class OptimalFRequest(BaseModel):
    equity: float
    max_loss: float
    win_rate: float
    avg_win: float
    avg_loss: float


class AtrSizingRequest(BaseModel):
    equity: float
    risk_pct: float
    atr: float
    atr_multiplier: float = 2.0
    entry_price: float = 100.0


class EqualWeightRequest(BaseModel):
    equity: float
    n_positions: int
    price: float


class MaxDDSizingRequest(BaseModel):
    equity: float
    max_dd_pct: float
    current_dd_pct: float
    base_risk_pct: float


class CheckPositionRequest(BaseModel):
    position_value: float
    total_equity: float
    max_position_pct: float = 0.10


class CheckSectorRequest(BaseModel):
    sector_exposure: float
    total_equity: float
    max_sector_pct: float = 0.25


class CheckLeverageRequest(BaseModel):
    gross_exposure: float
    total_equity: float
    max_leverage: float = 2.0


class MaxAdditionalRequest(BaseModel):
    current_exposure: float
    max_exposure: float


class CheckConcentrationRequest(BaseModel):
    position_values: List[float]
    max_hhi: float = 0.15


class EquityMarginRequest(BaseModel):
    positions: List[Dict[str, float]]
    cash: float


class OptionsMarginRequest(BaseModel):
    option_type: str
    side: str
    strike: float
    underlying_price: float
    premium: float
    quantity: int = 1


class PortfolioMarginRequest(BaseModel):
    equity_value: float
    options_value: float
    bonds_value: float = 0.0


class MarginCallRequest(BaseModel):
    equity: float
    loan: float
    maintenance_margin: float = 0.25


class GreeksSnapshotModel(BaseModel):
    delta: float = 0.0
    gamma: float = 0.0
    theta: float = 0.0
    vega: float = 0.0
    rho: float = 0.0
    charm: float = 0.0
    vanna: float = 0.0
    volga: float = 0.0
    speed: float = 0.0


class AggregateGreeksRequest(BaseModel):
    positions: List[GreeksSnapshotModel]
    quantities: List[float]


class GreeksPnlRequest(BaseModel):
    greeks: GreeksSnapshotModel
    ds: float = 0.0
    dt: float = 0.0
    dvol: float = 0.0


class GreeksStressRequest(BaseModel):
    greeks: GreeksSnapshotModel
    spot_range: List[float] = [-0.10, -0.05, 0.0, 0.05, 0.10]
    vol_range: List[float] = [-0.05, 0.0, 0.05]


class DeltaHedgeRequest(BaseModel):
    portfolio_delta: float
    underlying_delta: float = 1.0


class RunScenarioRequest(BaseModel):
    scenario_name: str
    portfolio_values: Dict[str, float]


class SensitivityRequest(BaseModel):
    portfolio_values: Dict[str, float]
    factor: str
    shock_range: List[float]


class CustomScenarioRequest(BaseModel):
    portfolio_values: Dict[str, float]
    shocks: Dict[str, float]


class PreTradeRequest(BaseModel):
    equity: float
    position_value: float
    current_positions: int
    current_drawdown: float
    daily_loss: float
    limits: Optional[Dict[str, float]] = None


class PortfolioComplianceRequest(BaseModel):
    equity: float
    positions: List[Dict[str, Any]]
    limits: Optional[Dict[str, float]] = None


class DailyReportRequest(BaseModel):
    returns: List[float]
    positions: List[Dict[str, Any]]
    equity: float


class CorrelationAnalysisRequest(BaseModel):
    returns: Dict[str, List[float]]


class CrowdedTradeRequest(BaseModel):
    returns: Dict[str, List[float]]
    weights: List[float]


class TailAnalysisRequest(BaseModel):
    returns: List[float]


class CrashProbRequest(BaseModel):
    returns: List[float]
    threshold: float = -0.05


class DaysToLiquidateRequest(BaseModel):
    position_value: float
    avg_daily_volume: float
    max_participation: float = 0.10


class MarketImpactRequest(BaseModel):
    order_size: float
    avg_daily_volume: float
    volatility: float
    urgency: float = 0.5


class LiquidityScoreRequest(BaseModel):
    avg_volume: float
    bid_ask_spread: float
    market_cap: float


class PortfolioLiquidityRequest(BaseModel):
    positions: List[Dict[str, float]]
    max_participation: float = 0.10


# ═══════════════════════════════════════════════════════════════════════════════
#  Position Sizing
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/sizing/fixed-fractional")
def sizing_fixed_fractional(req: FixedFractionalRequest) -> Dict[str, Any]:
    result = PositionSizer.fixed_fractional(req.equity, req.risk_pct,
                                             req.entry_price, req.stop_price)
    return {"shares": result["shares"], "risk_amount": result["risk_amount"],
            "position_value": result["position_value"]}


@router.post("/sizing/kelly")
def sizing_kelly(req: KellyRequest) -> Dict[str, Any]:
    return PositionSizer.kelly(req.win_rate, req.avg_win, req.avg_loss, req.fraction)


@router.post("/sizing/volatility")
def sizing_volatility(req: VolSizingRequest) -> Dict[str, Any]:
    return PositionSizer.volatility_scaled(req.equity, req.risk_pct,
                                            req.volatility, req.target_vol)


@router.post("/sizing/optimal-f")
def sizing_optimal_f(req: OptimalFRequest) -> Dict[str, Any]:
    return PositionSizer.optimal_f(req.equity, req.max_loss,
                                    req.win_rate, req.avg_win, req.avg_loss)


@router.post("/sizing/atr")
def sizing_atr(req: AtrSizingRequest) -> Dict[str, Any]:
    return PositionSizer.atr_based(req.equity, req.risk_pct, req.atr,
                                    req.atr_multiplier, req.entry_price)


@router.post("/sizing/equal-weight")
def sizing_equal_weight(req: EqualWeightRequest) -> Dict[str, Any]:
    return PositionSizer.equal_weight(req.equity, req.n_positions, req.price)


@router.post("/sizing/max-drawdown")
def sizing_max_drawdown(req: MaxDDSizingRequest) -> Dict[str, Any]:
    return PositionSizer.max_drawdown_sized(req.equity, req.max_dd_pct,
                                             req.current_dd_pct, req.base_risk_pct)


# ═══════════════════════════════════════════════════════════════════════════════
#  Exposure Limits
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/exposure/check-position")
def check_position_limit(req: CheckPositionRequest) -> Dict[str, Any]:
    result = ExposureLimiter.check_position_limit(
        req.position_value, req.total_equity, req.max_position_pct)
    return {"allowed": result["allowed"], "current_pct": result["current_pct"],
            "max_pct": result["max_pct"], "headroom": result["headroom"]}


@router.post("/exposure/check-sector")
def check_sector_limit(req: CheckSectorRequest) -> Dict[str, Any]:
    return ExposureLimiter.check_sector_limit(
        req.sector_exposure, req.total_equity, req.max_sector_pct)


@router.post("/exposure/check-leverage")
def check_leverage(req: CheckLeverageRequest) -> Dict[str, Any]:
    return ExposureLimiter.check_leverage(
        req.gross_exposure, req.total_equity, req.max_leverage)


@router.post("/exposure/max-additional")
def max_additional(req: MaxAdditionalRequest) -> Dict[str, Any]:
    return {"max_additional": ExposureLimiter.max_additional_exposure(
        req.current_exposure, req.max_exposure)}


@router.post("/exposure/check-concentration")
def check_concentration(req: CheckConcentrationRequest) -> Dict[str, Any]:
    return ExposureLimiter.check_concentration(req.position_values, req.max_hhi)


# ═══════════════════════════════════════════════════════════════════════════════
#  Margin
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/margin/equity")
def margin_equity(req: EquityMarginRequest) -> Dict[str, Any]:
    return MarginCalculator.reg_t_equity(req.positions, req.cash)


@router.post("/margin/options")
def margin_options(req: OptionsMarginRequest) -> Dict[str, Any]:
    return MarginCalculator.reg_t_options(req.option_type, req.side,
                                          req.strike, req.underlying_price,
                                          req.premium, req.quantity)


@router.post("/margin/portfolio")
def portfolio_margin(req: PortfolioMarginRequest) -> Dict[str, Any]:
    return MarginCalculator.portfolio_margin_estimate(
        req.equity_value, req.options_value, req.bonds_value)


@router.post("/margin/call-price")
def margin_call_price(req: MarginCallRequest) -> Dict[str, Any]:
    return MarginCalculator.margin_call_price(req.equity, req.loan,
                                               req.maintenance_margin)


# ═══════════════════════════════════════════════════════════════════════════════
#  Greeks Risk
# ═══════════════════════════════════════════════════════════════════════════════

def _to_greeks(m: GreeksSnapshotModel) -> GreeksSnapshot:
    return GreeksSnapshot(
        delta=m.delta, gamma=m.gamma, theta=m.theta, vega=m.vega,
        rho=m.rho, charm=m.charm, vanna=m.vanna, volga=m.volga, speed=m.speed)


@router.post("/greeks/aggregate")
def aggregate_greeks(req: AggregateGreeksRequest) -> Dict[str, Any]:
    snapshots = [_to_greeks(p) for p in req.positions]
    agg = GreeksRisk.aggregate_greeks(snapshots, req.quantities)
    return {
        "delta": agg.delta, "gamma": agg.gamma, "theta": agg.theta,
        "vega": agg.vega, "rho": agg.rho, "charm": agg.charm,
        "vanna": agg.vanna, "volga": agg.volga, "speed": agg.speed,
    }


@router.post("/greeks/pnl-estimate")
def greeks_pnl(req: GreeksPnlRequest) -> Dict[str, Any]:
    return GreeksRisk.greeks_pnl_estimate(_to_greeks(req.greeks),
                                           ds=req.ds, dt=req.dt, dvol=req.dvol)


@router.post("/greeks/stress")
def greeks_stress(req: GreeksStressRequest) -> Dict[str, Any]:
    matrix = GreeksRisk.greeks_stress_matrix(_to_greeks(req.greeks),
                                              req.spot_range, req.vol_range)
    return {"matrix": matrix}


@router.post("/greeks/delta-hedge")
def delta_hedge(req: DeltaHedgeRequest) -> Dict[str, Any]:
    return GreeksRisk.delta_hedge_ratio(req.portfolio_delta, req.underlying_delta)


# ═══════════════════════════════════════════════════════════════════════════════
#  Scenario Analysis
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/scenarios/run")
def run_scenario(req: RunScenarioRequest) -> Dict[str, Any]:
    result = ScenarioEngine.run_scenario(req.scenario_name, req.portfolio_values)
    if "error" in result:
        raise HTTPException(404, result["error"])
    return result


@router.post("/scenarios/historical")
def run_historical_scenarios(req: RunScenarioRequest) -> Dict[str, Any]:
    results = ScenarioEngine.run_historical_scenarios(req.portfolio_values)
    return {"scenarios": results}


@router.post("/scenarios/sensitivity")
def sensitivity_analysis(req: SensitivityRequest) -> Dict[str, Any]:
    return {"sensitivity": ScenarioEngine.sensitivity_analysis(
        req.portfolio_values, req.factor, req.shock_range)}


@router.post("/scenarios/custom")
def custom_scenario(req: CustomScenarioRequest) -> Dict[str, Any]:
    return ScenarioEngine.custom_scenario(req.portfolio_values, req.shocks)


# ═══════════════════════════════════════════════════════════════════════════════
#  Compliance
# ═══════════════════════════════════════════════════════════════════════════════

def _limits_from_dict(d: Optional[Dict[str, float]]) -> RiskLimits:
    if not d:
        return RiskLimits()
    return RiskLimits(**{k: v for k, v in d.items() if hasattr(RiskLimits, k)})


@router.post("/compliance/pre-trade")
def pre_trade_check(req: PreTradeRequest) -> Dict[str, Any]:
    lim = _limits_from_dict(req.limits)
    result = ComplianceChecker.pre_trade_check(
        equity=req.equity, position_value=req.position_value,
        current_positions=req.current_positions,
        current_drawdown=req.current_drawdown,
        daily_loss=req.daily_loss, limits=lim,
    )
    return {
        "approved": result["approved"],
        "alerts": [{"level": a.level.value, "category": a.category, "message": a.message}
                   for a in result.get("alerts", [])],
    }


@router.post("/compliance/portfolio")
def portfolio_compliance(req: PortfolioComplianceRequest) -> Dict[str, Any]:
    lim = _limits_from_dict(req.limits)
    result = ComplianceChecker.portfolio_compliance(
        equity=req.equity, positions=req.positions, limits=lim)
    return {
        "compliant": result["compliant"],
        "alerts": [{"level": a.level.value, "category": a.category, "message": a.message}
                   for a in result.get("alerts", [])],
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  Risk Reports
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/report/daily")
def daily_risk_report(req: DailyReportRequest) -> Dict[str, Any]:
    return RiskReporter.daily_risk_report(
        returns=pd.Series(req.returns),
        positions=req.positions,
        equity=req.equity,
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  Correlation Risk
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/correlation/diversification")
def diversification_ratio(req: CrowdedTradeRequest) -> Dict[str, float]:
    returns = pd.DataFrame(req.returns)
    return {"diversification_ratio": CorrelationRisk.diversification_ratio(
        returns, np.array(req.weights))}


@router.post("/correlation/regime")
def correlation_regime(req: CorrelationAnalysisRequest) -> Dict[str, Any]:
    returns = pd.DataFrame(req.returns)
    return CorrelationRisk.correlation_regime(returns)


@router.post("/correlation/crowded")
def crowded_trade_score(req: CrowdedTradeRequest) -> Dict[str, Any]:
    returns = pd.DataFrame(req.returns)
    return CorrelationRisk.crowded_trade_score(returns, np.array(req.weights))


# ═══════════════════════════════════════════════════════════════════════════════
#  Tail Risk
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/tail/analysis")
def tail_analysis(req: TailAnalysisRequest) -> Dict[str, Any]:
    rets = pd.Series(req.returns)
    return {
        "tail_ratio": TailRisk.tail_ratio(rets),
        "gain_to_pain": TailRisk.gain_to_pain(rets),
        "tail_dependence": TailRisk.tail_dependence(rets),
    }


@router.post("/tail/crash-probability")
def crash_probability(req: CrashProbRequest) -> Dict[str, Any]:
    return {"crash_probability": TailRisk.crash_probability(
        pd.Series(req.returns), req.threshold)}


# ═══════════════════════════════════════════════════════════════════════════════
#  Liquidity Risk
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/liquidity/days-to-liquidate")
def days_to_liquidate(req: DaysToLiquidateRequest) -> Dict[str, Any]:
    return {"days": LiquidityRisk.days_to_liquidate(
        req.position_value, req.avg_daily_volume, req.max_participation)}


@router.post("/liquidity/impact")
def market_impact(req: MarketImpactRequest) -> Dict[str, Any]:
    return LiquidityRisk.market_impact_estimate(
        req.order_size, req.avg_daily_volume, req.volatility, req.urgency)


@router.post("/liquidity/score")
def liquidity_score(req: LiquidityScoreRequest) -> Dict[str, Any]:
    return LiquidityRisk.liquidity_score(
        req.avg_volume, req.bid_ask_spread, req.market_cap)


@router.post("/liquidity/portfolio")
def portfolio_liquidity(req: PortfolioLiquidityRequest) -> Dict[str, Any]:
    return LiquidityRisk.portfolio_liquidity(req.positions, req.max_participation)


# ═══════════════════════════════════════════════════════════════════════════════
#  Capabilities
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/capabilities")
def capabilities() -> Dict[str, Any]:
    return {
        "features": [
            "Position Sizing: fixed fractional, Kelly, volatility-scaled, optimal f, ATR-based",
            "Exposure Limits: position, sector, leverage, concentration (HHI)",
            "Margin: Reg-T equity, Reg-T options (4 strategies), portfolio margin, margin call price",
            "Greeks Risk: aggregate, P&L estimate, stress matrix, delta hedge",
            "Scenarios: 8 historical (2008 crisis, COVID, etc.), sensitivity, custom",
            "Compliance: pre-trade checks, portfolio compliance with RiskAlerts",
            "Daily risk report with full metrics",
            "Correlation: diversification ratio, regime detection, crowded trade scoring",
            "Tail Risk: tail ratio, gain-to-pain, tail dependence, crash probability",
            "Liquidity: days to liquidate, market impact, score, portfolio liquidity",
        ],
        "endpoint_count": 37,
    }
