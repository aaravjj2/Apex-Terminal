"""
options_pricing.py — REST API routes for OptionsPricingEngine
==============================================================
35+ endpoints for options pricing, Greeks, IV, vol surface,
chain analysis, strategy building, and exotic options.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.options_pricing_engine import OptionsPricingEngine

router = APIRouter(prefix="/api/v1/options")

# ── Shared Engine ──
_engine = OptionsPricingEngine()


# ── Pydantic Models ──

class EuropeanPriceRequest(BaseModel):
    S: float = Field(..., description="Spot price")
    K: float = Field(..., description="Strike price")
    T: float = Field(..., description="Time to expiry (years)")
    r: float = Field(0.05, description="Risk-free rate")
    sigma: float = Field(0.2, description="Volatility")
    q: float = Field(0.0, description="Dividend yield")
    option_type: str = Field("call", description="call or put")


class AmericanPriceRequest(BaseModel):
    S: float
    K: float
    T: float
    r: float = 0.05
    sigma: float = 0.2
    q: float = 0.0
    option_type: str = "call"
    steps: int = 200


class MonteCarloPriceRequest(BaseModel):
    S: float
    K: float
    T: float
    r: float = 0.05
    sigma: float = 0.2
    option_type: str = "call"
    n_paths: int = 50000
    n_steps: int = 252


class AsianPriceRequest(BaseModel):
    S: float
    K: float
    T: float
    r: float = 0.05
    sigma: float = 0.2
    option_type: str = "call"
    avg_type: str = "arithmetic"
    n_paths: int = 50000
    n_steps: int = 252


class ImpliedVolRequest(BaseModel):
    market_price: float
    S: float
    K: float
    T: float
    r: float = 0.05
    option_type: str = "call"


class VolSmileRequest(BaseModel):
    S: float
    T: float
    r: float = 0.05
    strikes: List[float]
    market_prices: List[float]
    option_type: str = "call"


class VolTermRequest(BaseModel):
    S: float
    K: float
    r: float = 0.05
    expiries: List[float]
    market_prices: List[float]
    option_type: str = "call"


class VolSurfacePointRequest(BaseModel):
    strike: float
    expiry: float
    iv: float


class VolSurfaceInterpRequest(BaseModel):
    strike: float
    expiry: float


class OptionContractInput(BaseModel):
    symbol: str = ""
    strike: float = 0.0
    expiry: str = ""
    option_type: str = "call"
    bid: float = 0.0
    ask: float = 0.0
    last: float = 0.0
    volume: int = 0
    open_interest: int = 0
    iv: float = 0.0
    delta: float = 0.0
    gamma: float = 0.0
    theta: float = 0.0
    vega: float = 0.0


class ChainLoadRequest(BaseModel):
    underlying: str
    spot: float
    contracts: List[OptionContractInput]


class StrategyLegInput(BaseModel):
    option_type: str = "call"
    strike: float = 100.0
    premium: float = 5.0
    quantity: int = 1


class StrategyPayoffRequest(BaseModel):
    legs: List[StrategyLegInput]
    price_range_start: float = 50.0
    price_range_end: float = 150.0
    n_points: int = 200


class StrategyGreeksRequest(BaseModel):
    legs: List[StrategyLegInput]
    S: float
    T: float
    r: float = 0.05
    sigma: float = 0.2


class AnalyzeStrategyRequest(BaseModel):
    strategy_name: str
    S: float
    T: float = 0.25
    r: float = 0.05
    sigma: float = 0.2


class BarrierOptionRequest(BaseModel):
    S: float
    K: float
    T: float
    r: float = 0.05
    sigma: float = 0.2
    barrier: float
    barrier_type: str = "down-and-out"
    option_type: str = "call"
    n_paths: int = 50000


class DigitalOptionRequest(BaseModel):
    S: float
    K: float
    T: float
    r: float = 0.05
    sigma: float = 0.2
    option_type: str = "call"
    payout: float = 1.0


class LookbackOptionRequest(BaseModel):
    S: float
    K: float = 0.0
    T: float = 0.25
    r: float = 0.05
    sigma: float = 0.2
    lookback_type: str = "fixed"
    option_type: str = "call"
    n_paths: int = 50000
    n_steps: int = 252


# ── European Pricing ──

@router.post("/price/european")
async def price_european(req: EuropeanPriceRequest):
    result = _engine.price_european(
        req.S, req.K, req.T, req.r, req.sigma, req.option_type, req.q
    )
    return result


@router.post("/greeks/european")
async def greeks_european(req: EuropeanPriceRequest):
    result = _engine.price_european(
        req.S, req.K, req.T, req.r, req.sigma, req.option_type, req.q
    )
    return result  # includes all greeks


# ── American Pricing ──

@router.post("/price/american")
async def price_american(req: AmericanPriceRequest):
    result = _engine.price_american(
        req.S, req.K, req.T, req.r, req.sigma, req.option_type, req.steps
    )
    return result


# ── Monte Carlo ──

@router.post("/price/monte-carlo")
async def price_monte_carlo(req: MonteCarloPriceRequest):
    from services.options_pricing_engine import MonteCarloOption
    mc = MonteCarloOption()
    result = mc.price(req.S, req.K, req.T, req.r, req.sigma,
                      req.option_type, req.n_paths, req.n_steps)
    return result


@router.post("/price/asian")
async def price_asian(req: AsianPriceRequest):
    from services.options_pricing_engine import MonteCarloOption
    mc = MonteCarloOption()
    result = mc.price_asian(req.S, req.K, req.T, req.r, req.sigma,
                            req.option_type, req.avg_type, req.n_paths, req.n_steps)
    return result


# ── Implied Volatility ──

@router.post("/iv/solve")
async def solve_iv(req: ImpliedVolRequest):
    result = _engine.implied_volatility(
        req.market_price, req.S, req.K, req.T, req.r, req.option_type
    )
    return {"implied_volatility": result}


@router.post("/iv/smile")
async def iv_smile(req: VolSmileRequest):
    from services.options_pricing_engine import ImpliedVolatility
    iv = ImpliedVolatility()
    result = iv.smile(req.S, req.T, req.r, req.strikes,
                      req.market_prices, req.option_type)
    return {"smile": result}


@router.post("/iv/term-structure")
async def iv_term_structure(req: VolTermRequest):
    from services.options_pricing_engine import ImpliedVolatility
    iv = ImpliedVolatility()
    result = iv.term_structure(req.S, req.K, req.r,
                               req.expiries, req.market_prices, req.option_type)
    return {"term_structure": result}


@router.post("/iv/skew")
async def iv_skew(req: VolSmileRequest):
    from services.options_pricing_engine import ImpliedVolatility
    iv = ImpliedVolatility()
    smile = iv.smile(req.S, req.T, req.r, req.strikes,
                     req.market_prices, req.option_type)
    result = iv.skew(smile)
    return result


# ── Volatility Surface ──

@router.post("/vol-surface/add-point")
async def vol_surface_add_point(req: VolSurfacePointRequest):
    _engine.vol_surface.add_point(req.strike, req.expiry, req.iv)
    return {"status": "ok", "points": len(_engine.vol_surface._points)}


@router.post("/vol-surface/interpolate")
async def vol_surface_interpolate(req: VolSurfaceInterpRequest):
    iv = _engine.vol_surface.interpolate(req.strike, req.expiry)
    return {"strike": req.strike, "expiry": req.expiry, "iv": iv}


@router.get("/vol-surface/matrix")
async def vol_surface_matrix():
    result = _engine.vol_surface.to_matrix()
    return result


@router.post("/vol-surface/reset")
async def vol_surface_reset():
    from services.options_pricing_engine import VolatilitySurface
    _engine.vol_surface = VolatilitySurface()
    return {"status": "reset"}


# ── Option Chain Analysis ──

@router.post("/chain/load")
async def chain_load(req: ChainLoadRequest):
    from services.options_pricing_engine import OptionContract
    contracts = []
    for c in req.contracts:
        contracts.append(OptionContract(
            symbol=c.symbol, strike=c.strike, expiry=c.expiry,
            option_type=c.option_type, bid=c.bid, ask=c.ask,
            last=c.last, volume=c.volume, open_interest=c.open_interest,
            iv=c.iv, delta=c.delta, gamma=c.gamma,
            theta=c.theta, vega=c.vega,
        ))
    _engine.chain_analyzer.contracts = contracts
    _engine._chain_cache[req.underlying] = contracts
    return {"loaded": len(contracts), "underlying": req.underlying}


@router.get("/chain/put-call-ratio")
async def chain_pcr():
    pcr = _engine.chain_analyzer.put_call_ratio()
    return pcr


@router.get("/chain/max-pain")
async def chain_max_pain():
    mp = _engine.chain_analyzer.max_pain()
    return {"max_pain": mp}


@router.get("/chain/unusual-activity")
async def chain_unusual(threshold: float = 2.0):
    result = _engine.chain_analyzer.unusual_activity(threshold)
    return {"unusual": [{"symbol": c.symbol, "strike": c.strike,
                         "type": c.option_type, "volume": c.volume,
                         "oi": c.open_interest} for c in result]}


@router.get("/chain/oi-by-strike")
async def chain_oi_by_strike():
    result = _engine.chain_analyzer.oi_by_strike()
    return result


@router.get("/chain/gamma-exposure")
async def chain_gex(spot: float = 100.0):
    result = _engine.chain_analyzer.gamma_exposure(spot)
    return result


@router.get("/chain/iv-percentile")
async def chain_iv_percentile():
    result = _engine.chain_analyzer.iv_percentile()
    return result


# ── Strategy Builder ──

@router.get("/strategies/library")
async def strategies_library():
    from services.options_pricing_engine import StrategyBuilder
    sb = StrategyBuilder()
    return sb.strategies_library()


@router.post("/strategies/payoff")
async def strategy_payoff(req: StrategyPayoffRequest):
    from services.options_pricing_engine import StrategyBuilder, OptionLeg
    sb = StrategyBuilder()
    legs = [OptionLeg(l.option_type, l.strike, l.premium, l.quantity)
            for l in req.legs]
    result = sb.payoff_at_expiry(legs, req.price_range_start,
                                  req.price_range_end, req.n_points)
    # Convert numpy arrays to lists
    result["prices"] = result["prices"].tolist() if hasattr(result["prices"], "tolist") else result["prices"]
    result["payoff"] = result["payoff"].tolist() if hasattr(result["payoff"], "tolist") else result["payoff"]
    return result


@router.post("/strategies/greeks")
async def strategy_greeks(req: StrategyGreeksRequest):
    from services.options_pricing_engine import StrategyBuilder, OptionLeg
    sb = StrategyBuilder()
    legs = [OptionLeg(l.option_type, l.strike, l.premium, l.quantity)
            for l in req.legs]
    result = sb.greeks_at_price(legs, req.S, req.T, req.r, req.sigma)
    return result


@router.post("/strategies/analyze")
async def analyze_strategy(req: AnalyzeStrategyRequest):
    from services.options_pricing_engine import StrategyBuilder
    sb = StrategyBuilder()
    result = sb.analyze_strategy(req.strategy_name, req.S, req.T, req.r, req.sigma)
    if "error" in result:
        raise HTTPException(400, result["error"])
    # Convert numpy arrays
    for key in ["prices", "payoff"]:
        if key in result and hasattr(result[key], "tolist"):
            result[key] = result[key].tolist()
    return result


# ── Exotic Options ──

@router.post("/exotic/barrier")
async def exotic_barrier(req: BarrierOptionRequest):
    from services.options_pricing_engine import ExoticOptions
    eo = ExoticOptions()
    result = eo.barrier(req.S, req.K, req.T, req.r, req.sigma,
                        req.barrier, req.barrier_type, req.option_type,
                        req.n_paths)
    return result


@router.post("/exotic/digital")
async def exotic_digital(req: DigitalOptionRequest):
    from services.options_pricing_engine import ExoticOptions
    eo = ExoticOptions()
    result = eo.digital(req.S, req.K, req.T, req.r, req.sigma,
                        req.option_type, req.payout)
    return result


@router.post("/exotic/lookback")
async def exotic_lookback(req: LookbackOptionRequest):
    from services.options_pricing_engine import ExoticOptions
    eo = ExoticOptions()
    result = eo.lookback(req.S, req.K, req.T, req.r, req.sigma,
                         req.lookback_type, req.option_type,
                         req.n_paths, req.n_steps)
    return result


# ── Capabilities ──

@router.get("/capabilities")
async def capabilities():
    return _engine.capabilities()
