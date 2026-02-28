"""
options_greeks_routes.py
FastAPI routes for options pricing, Greeks calculation,
IV solving, volatility surface, option chains, and spread analytics.
"""

from __future__ import annotations
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, validator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/options", tags=["Options Analytics"])

# ─── Pydantic Models ──────────────────────────────────────────────────────────

class OptionPricingRequest(BaseModel):
    S: float = Field(..., gt=0, description="Spot price")
    K: float = Field(..., gt=0, description="Strike price")
    T: float = Field(..., gt=0, description="Time to expiry in years")
    r: float = Field(0.053, description="Risk-free rate")
    sigma: float = Field(..., gt=0, le=10.0, description="Annualized volatility")
    q: float = Field(0.0, ge=0, description="Continuous dividend yield")
    option_type: str = Field("call", description="'call' or 'put'")

    @validator('option_type')
    def validate_option_type(cls, v):
        if v.lower() not in ('call', 'put'):
            raise ValueError("option_type must be 'call' or 'put'")
        return v.lower()

class IVRequest(BaseModel):
    market_price: float = Field(..., gt=0)
    S: float = Field(..., gt=0)
    K: float = Field(..., gt=0)
    T: float = Field(..., gt=0)
    r: float = Field(0.053)
    option_type: str = Field("call")
    q: float = Field(0.0)
    initial_guess: float = Field(0.20, gt=0, le=5.0)

class VolSurfaceRequest(BaseModel):
    spot: float = Field(..., gt=0)
    r: float = Field(0.053)
    q: float = Field(0.0)
    expiries_days: Optional[List[int]] = None
    moneyness_levels: Optional[List[float]] = None

class OptionChainRequest(BaseModel):
    spot: float = Field(..., gt=0)
    expiry_days: int = Field(..., gt=0, le=1095)
    r: float = Field(0.053)
    q: float = Field(0.0)
    num_strikes: int = Field(20, ge=5, le=50)

class SpreadRequest(BaseModel):
    S: float = Field(..., gt=0)
    K_long: float = Field(..., gt=0)
    K_short: float = Field(..., gt=0)
    T: float = Field(..., gt=0)
    r: float = Field(0.053)
    sigma: float = Field(..., gt=0, le=10.0)
    q: float = Field(0.0)
    option_type: str = Field("call")

class IronCondorRequest(BaseModel):
    S: float
    K_put_long: float
    K_put_short: float
    K_call_short: float
    K_call_long: float
    T: float = Field(..., gt=0)
    r: float = Field(0.053)
    sigma_put: float = Field(..., gt=0)
    sigma_call: float = Field(..., gt=0)
    q: float = Field(0.0)

class PortfolioGreeksRequest(BaseModel):
    positions: List[Dict[str, Any]]

# ─── Engine setup ─────────────────────────────────────────────────────────────

try:
    from services.options_greeks_engine import (
        BlackScholesEngine, IVSolver, VolatilitySurfaceEngine,
        OptionChainBuilder, SpreadEngine, PortfolioGreeksEngine,
        OptionParams,
    )
    _bs = BlackScholesEngine()
    _iv = IVSolver()
    _vs = VolatilitySurfaceEngine()
    _chain = OptionChainBuilder()
    _spread = SpreadEngine()
    _pg = PortfolioGreeksEngine()
    _engine_ready = True
except Exception as e:
    logger.warning(f"Options engine import failed: {e}")
    _engine_ready = False

def _check_engine():
    if not _engine_ready:
        raise HTTPException(status_code=503, detail="Options engine unavailable")

# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/price")
async def calculate_price(req: OptionPricingRequest):
    """Calculate Black-Scholes option price."""
    _check_engine()
    try:
        params = OptionParams(S=req.S, K=req.K, T=req.T, r=req.r, sigma=req.sigma, q=req.q, option_type=req.option_type)
        price = _bs.price(params)
        return {"price": round(price, 6), "S": req.S, "K": req.K, "T": req.T, "sigma": req.sigma, "type": req.option_type}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/greeks")
async def calculate_greeks(req: OptionPricingRequest):
    """Calculate full Greeks suite (delta, gamma, theta, vega, rho + higher-order)."""
    _check_engine()
    try:
        params = OptionParams(S=req.S, K=req.K, T=req.T, r=req.r, sigma=req.sigma, q=req.q, option_type=req.option_type)
        g = _bs.greeks(params)
        return {
            "price": round(g.price, 6),
            "intrinsic": round(g.intrinsic, 6),
            "time_value": round(g.time_value, 6),
            "moneyness": g.moneyness,
            "first_order": {
                "delta": round(g.delta, 6),
                "theta": round(g.theta, 6),
                "vega": round(g.vega, 6),
                "rho": round(g.rho, 6),
                "lambda": round(g.lambda_, 4),
            },
            "second_order": {
                "gamma": round(g.gamma, 8),
                "vanna": round(g.vanna, 6),
                "volga": round(g.volga, 6),
                "charm": round(g.charm, 8),
            },
            "third_order": {
                "speed": round(g.speed, 10),
                "color": round(g.color, 10),
                "ultima": round(g.ultima, 6),
            },
            "d1": round(g.d1, 6),
            "d2": round(g.d2, 6),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/iv")
async def solve_implied_vol(req: IVRequest):
    """Solve for implied volatility given market price."""
    _check_engine()
    try:
        result = _iv.solve_nr(
            market_price=req.market_price, S=req.S, K=req.K, T=req.T,
            r=req.r, option_type=req.option_type, q=req.q, initial_guess=req.initial_guess
        )
        return {
            "iv": round(result.iv, 6),
            "iv_pct": round(result.iv * 100, 4),
            "converged": result.converged,
            "iterations": result.iterations,
            "method": result.method,
            "error": result.error,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/vol-surface")
async def get_vol_surface(req: VolSurfaceRequest):
    """Build implied volatility surface for a given underlying."""
    _check_engine()
    try:
        surf = _vs.build_surface(spot=req.spot, r=req.r, q=req.q,
                                  expiries_days=req.expiries_days,
                                  moneyness_levels=req.moneyness_levels)
        return {
            "spot": surf.spot,
            "forward": round(surf.forward, 4),
            "strikes": [round(k, 2) for k in surf.strikes],
            "expiries_years": [round(t, 6) for t in surf.expiries],
            "expiries_days": [round(t * 365) for t in surf.expiries],
            "vols": [[round(v * 100, 3) for v in row] for row in surf.vols],
            "moneyness": [round(k / surf.spot, 4) for k in surf.strikes],
            "generated_at": surf.timestamp.isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/chain")
async def get_option_chain(req: OptionChainRequest):
    """Build option chain for a given expiry."""
    _check_engine()
    try:
        chain = _chain.build_chain(spot=req.spot, expiry_days=req.expiry_days,
                                    r=req.r, q=req.q, num_strikes=req.num_strikes)
        rows = []
        for row in chain:
            rows.append({
                "strike": row.strike, "expiry_days": row.expiry_days,
                "call_price": row.call_price, "put_price": row.put_price,
                "call_delta": row.call_delta, "put_delta": row.put_delta,
                "call_iv": row.call_iv, "put_iv": row.put_iv,
                "gamma": row.gamma, "vega": row.vega, "theta": row.theta,
                "oi_call": row.open_interest_call, "oi_put": row.open_interest_put,
                "vol_call": row.volume_call, "vol_put": row.volume_put,
                "put_call_ratio": row.put_call_ratio,
            })
        total_calls_oi = sum(r["oi_call"] for r in rows)
        total_puts_oi = sum(r["oi_put"] for r in rows)
        return {
            "spot": req.spot, "expiry_days": req.expiry_days,
            "chain": rows,
            "summary": {
                "total_call_oi": total_calls_oi,
                "total_put_oi": total_puts_oi,
                "overall_pcr": round(total_puts_oi / max(1, total_calls_oi), 3),
                "atm_strike": min(chain, key=lambda r: abs(r.strike - req.spot)).strike,
                "max_call_oi_strike": max(chain, key=lambda r: r.open_interest_call).strike,
                "max_put_oi_strike": max(chain, key=lambda r: r.open_interest_put).strike,
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/spread/vertical")
async def price_vertical_spread(req: SpreadRequest):
    """Price a vertical (bull/bear call/put) spread."""
    _check_engine()
    try:
        result = _spread.vertical_spread(
            S=req.S, K_long=req.K_long, K_short=req.K_short,
            T=req.T, r=req.r, sigma=req.sigma, q=req.q, option_type=req.option_type)
        return {
            "name": result.name, "net_price": result.net_price,
            "greeks": {"delta": result.net_delta, "gamma": result.net_gamma,
                       "theta": result.net_theta, "vega": result.net_vega, "rho": result.net_rho},
            "risk_reward": {"max_profit": result.max_profit, "max_loss": result.max_loss,
                            "risk_reward_ratio": round(result.max_profit / max(0.01, result.max_loss), 3)},
            "breakeven_lower": result.breakeven_lower, "breakeven_upper": result.breakeven_upper,
            "legs": result.legs,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/spread/iron-condor")
async def price_iron_condor(req: IronCondorRequest):
    """Price an iron condor spread."""
    _check_engine()
    try:
        result = _spread.iron_condor(
            S=req.S, K_put_long=req.K_put_long, K_put_short=req.K_put_short,
            K_call_short=req.K_call_short, K_call_long=req.K_call_long,
            T=req.T, r=req.r, sigma_put=req.sigma_put, sigma_call=req.sigma_call, q=req.q)
        return {
            "name": result.name, "net_credit": result.net_price,
            "greeks": {"delta": result.net_delta, "gamma": result.net_gamma,
                       "theta": result.net_theta, "vega": result.net_vega},
            "risk_reward": {"max_profit": result.max_profit, "max_loss": result.max_loss},
            "breakeven_lower": result.breakeven_lower, "breakeven_upper": result.breakeven_upper,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/portfolio-greeks")
async def get_portfolio_greeks(req: PortfolioGreeksRequest):
    """Aggregate Greeks across a portfolio of options."""
    _check_engine()
    try:
        result = _pg.aggregate(req.positions)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/quick-price")
async def quick_price(
    S: float = Query(..., gt=0),
    K: float = Query(..., gt=0),
    T: float = Query(..., gt=0),
    sigma: float = Query(..., gt=0),
    r: float = Query(0.053),
    option_type: str = Query("call"),
):
    """Quick option price via GET (for simple lookups)."""
    _check_engine()
    try:
        params = OptionParams(S=S, K=K, T=T, r=r, sigma=sigma, q=0.0, option_type=option_type)
        g = _bs.greeks(params)
        return {
            "price": round(g.price, 4), "delta": round(g.delta, 4),
            "gamma": round(g.gamma, 6), "theta": round(g.theta, 4), "vega": round(g.vega, 4),
            "iv_pct": round(sigma * 100, 2), "moneyness": g.moneyness,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/scenarios")
async def run_scenarios(
    S: float = Query(..., gt=0),
    K: float = Query(..., gt=0),
    T: float = Query(..., gt=0),
    sigma: float = Query(..., gt=0),
    r: float = Query(0.053),
    option_type: str = Query("call"),
):
    """Run price scenarios across spot and vol range."""
    _check_engine()
    try:
        spot_range = [S * (1 + pct / 100) for pct in range(-20, 25, 5)]
        vol_range = [max(0.01, sigma + dv) for dv in [-0.06, -0.04, -0.02, 0, 0.02, 0.04, 0.06]]
        scenarios = []
        for spot in spot_range:
            row = {"spot": round(spot, 2), "spot_pct": round((spot - S) / S * 100, 1), "prices": {}}
            for vol in vol_range:
                params = OptionParams(S=spot, K=K, T=T, r=r, sigma=vol, q=0.0, option_type=option_type)
                price = _bs.price(params)
                row["prices"][f"vol_{round(vol * 100, 0):.0f}pct"] = round(price, 4)
            scenarios.append(row)
        return {"S": S, "K": K, "T": T, "option_type": option_type, "scenarios": scenarios, "vol_range": [round(v * 100, 1) for v in vol_range]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/health")
async def health_check():
    return {"status": "operational", "engine_ready": _engine_ready}
