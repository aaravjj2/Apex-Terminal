"""
options_v4.py — Options Pricing & Analytics API Routes (v4)
===========================================================
REST API powered by options_engine.py

Endpoints:
    POST /api/v4/options/price          → Price a single option (BSM/Binomial)
    POST /api/v4/options/greeks         → Get all 14 Greeks for an option
    POST /api/v4/options/iv             → Compute implied volatility
    POST /api/v4/options/chain          → Generate full options chain
    POST /api/v4/options/surface        → Build IV surface
    POST /api/v4/options/strategy       → Price an options strategy (P&L, Greeks)
    POST /api/v4/options/scenarios      → Scenario grid P&L
    GET  /api/v4/options/strategies     → List available strategy builders
    POST /api/v4/options/portfolio      → Aggregate portfolio-level Greeks
"""

from __future__ import annotations
from typing import Any, Dict, List, Literal, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import numpy as np
import math

try:
    from ...options_engine import (
        bsm_price,
        bsm_greeks,
        implied_volatility,
        binomial_price_american,
        binomial_american_greeks,
        generate_options_chain,
        IVSurface,
        build_iv_surface,
        put_call_parity_check,
        probability_itm,
        probability_touch,
        expected_move,
        iron_condor,
        butterfly_spread,
        straddle,
        strangle,
        covered_call,
        protective_put,
        vertical_spread,
        aggregate_portfolio_greeks,
        option_risk_metrics,
        price_option_full,
        OptionParams,
    )
    _OPTIONS_AVAILABLE = True
except ImportError:
    _OPTIONS_AVAILABLE = False


router = APIRouter(prefix="/api/v4/options", tags=["Options v4"])


# ─── PYDANTIC MODELS ──────────────────────────────────────────────────────────

class OptionPriceRequest(BaseModel):
    S: float = Field(..., gt=0, description="Underlying price")
    K: float = Field(..., gt=0, description="Strike price")
    T: float = Field(..., gt=0, description="Time to expiry in years")
    r: float = Field(0.05, description="Risk-free rate (annual)")
    sigma: float = Field(..., gt=0, description="Volatility (annual)")
    q: float = Field(0.0, description="Dividend yield")
    option_type: Literal["call", "put"] = "call"
    model: Literal["bsm", "binomial"] = "bsm"
    n_steps: int = Field(200, ge=10, le=2000, description="Binomial steps (American only)")


class IVRequest(BaseModel):
    market_price: float = Field(..., gt=0)
    S: float = Field(..., gt=0)
    K: float = Field(..., gt=0)
    T: float = Field(..., gt=0)
    r: float = 0.05
    q: float = 0.0
    option_type: Literal["call", "put"] = "call"


class ChainRequest(BaseModel):
    S: float = Field(..., gt=0, description="Current underlying price")
    r: float = Field(0.05, description="Risk-free rate")
    q: float = Field(0.0, description="Dividend yield")
    expiries: List[float] = Field(..., description="List of T values (years)")
    strikes: Optional[List[float]] = None  # If None, auto-generated ±30% around S
    vol_surface: Optional[Dict[str, Any]] = None  # {expiry_str: {strike_str: vol}}
    flat_vol: float = Field(0.25, description="Used if no vol_surface provided")


class StrategyRequest(BaseModel):
    S: float
    r: float = 0.05
    q: float = 0.0
    T: float
    strategy: str = "iron_condor"
    params: Dict[str, Any] = {}


class ScenarioRequest(BaseModel):
    S: float
    K: float
    T: float
    r: float = 0.05
    q: float = 0.0
    sigma: float
    option_type: Literal["call", "put"] = "call"
    price_range_pct: float = 0.20  # ±20% price range
    vol_range: List[float] = [0.10, 0.20, 0.30, 0.40, 0.50]


class PortfolioGreeksRequest(BaseModel):
    positions: List[Dict[str, Any]]  # Each: {S, K, T, r, sigma, q, option_type, quantity}


# ─── HELPERS ──────────────────────────────────────────────────────────────────

def safe_float(v) -> Optional[float]:
    if v is None:
        return None
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 8)
    except Exception:
        return None


# ─── ROUTES ───────────────────────────────────────────────────────────────────

@router.post("/price")
async def price_option(req: OptionPriceRequest):
    """
    Price a single European or American option.
    
    - European: Black-Scholes-Merton (exact formula)
    - American: Binomial tree (CRR method, n_steps steps)
    """
    if not _OPTIONS_AVAILABLE:
        raise HTTPException(503, "Options engine unavailable")

    try:
        if req.model == "bsm":
            price = bsm_price(req.S, req.K, req.T, req.r, req.sigma, req.q, req.option_type)
        else:
            price = binomial_price_american(req.S, req.K, req.T, req.r, req.sigma,
                                            req.q, req.option_type, req.n_steps)
        return {
            "price":  safe_float(price),
            "model":  req.model,
            "inputs": req.dict(),
        }
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/greeks")
async def compute_greeks(req: OptionPriceRequest):
    """
    Compute all 14 Greeks: delta, gamma, theta, vega, rho,
    vanna, volga, charm, color, speed, zomma, ultima, lambda_, dual_delta.
    """
    if not _OPTIONS_AVAILABLE:
        raise HTTPException(503, "Options engine unavailable")

    try:
        if req.model == "bsm":
            g = bsm_greeks(req.S, req.K, req.T, req.r, req.sigma, req.q, req.option_type)
        else:
            g = binomial_american_greeks(req.S, req.K, req.T, req.r, req.sigma,
                                          req.q, req.option_type, req.n_steps)

        # Convert dataclass to dict
        import dataclasses
        if dataclasses.is_dataclass(g):
            result = {k: safe_float(v) for k, v in dataclasses.asdict(g).items()}
        else:
            result = g if isinstance(g, dict) else vars(g)
            result = {k: safe_float(v) for k, v in result.items()}

        return {"greeks": result, "model": req.model}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/iv")
async def compute_iv(req: IVRequest):
    """
    Compute implied volatility from market price using Newton-Raphson (Brent fallback).
    Returns IV as decimal (e.g., 0.25 = 25%).
    """
    if not _OPTIONS_AVAILABLE:
        raise HTTPException(503, "Options engine unavailable")

    try:
        iv = implied_volatility(req.market_price, req.S, req.K, req.T,
                                req.r, req.q, req.option_type)
        return {
            "implied_volatility": safe_float(iv),
            "iv_pct":  safe_float(iv * 100) if iv else None,
        }
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/chain")
async def generate_chain(req: ChainRequest):
    """
    Generate a full options chain for given expiries and strikes.
    Auto-generates strikes around current price if not provided.
    
    Returns per-expiry chains with calls and puts including all Greeks + IV.
    """
    if not _OPTIONS_AVAILABLE:
        raise HTTPException(503, "Options engine unavailable")

    S = req.S
    strikes = req.strikes

    if not strikes:
        # Auto-generate: ±30% around ATM in ~20 strikes
        atm   = S
        steps = np.linspace(0.70 * atm, 1.30 * atm, 21)
        # Round to nearest $1 for readability
        strikes = sorted(set([round(k) for k in steps]))

    # Build flat vol surface if none provided
    vol_surface = {}
    if req.vol_surface:
        for exp_str, k_vols in req.vol_surface.items():
            vol_surface[exp_str] = {float(k): float(v) for k, v in k_vols.items()}
    else:
        for T in req.expiries:
            key = f"{T:.4f}"
            vol_surface[key] = {k: req.flat_vol for k in strikes}

    try:
        chain_df = generate_options_chain(
            S=S, r=req.r, q=req.q,
            expiries=req.expiries,
            strikes=strikes,
            vol_surface=vol_surface,
        )

        # Convert to nested JSON
        chain_list = []
        for _, row in chain_df.iterrows():
            row_dict = {}
            for k, v in row.items():
                row_dict[k] = safe_float(v) if isinstance(v, float) else v
            chain_list.append(row_dict)

        return {
            "chain":    chain_list,
            "total_contracts": len(chain_list),
            "strikes":  strikes,
            "expiries": req.expiries,
            "spot":     S,
        }
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/pcp_check")
async def pcp_arbitrage_check(req: OptionPriceRequest):
    """
    Check put-call parity for arbitrage violations.
    Returns the arbitrage amount (should be near 0 for fair prices).
    """
    if not _OPTIONS_AVAILABLE:
        raise HTTPException(503, "Options engine unavailable")

    try:
        call_price = bsm_price(req.S, req.K, req.T, req.r, req.sigma, req.q, "call")
        put_price  = bsm_price(req.S, req.K, req.T, req.r, req.sigma, req.q, "put")
        result     = put_call_parity_check(call_price, put_price, req.S, req.K, req.T, req.r, req.q)
        return {"pcp_check": result}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/probability")
async def compute_probability(req: OptionPriceRequest):
    """
    Compute probability statistics for option.
    Returns: prob_ITM, prob_touch, expected_move.
    """
    if not _OPTIONS_AVAILABLE:
        raise HTTPException(503, "Options engine unavailable")

    try:
        pitm  = probability_itm(req.S, req.K, req.T, req.r, req.sigma, req.q, req.option_type)
        ptouch = probability_touch(req.S, req.K, req.T, req.r, req.sigma)
        em    = expected_move(req.S, req.T, req.sigma)

        return {
            "probability_itm":    safe_float(pitm),
            "probability_touch":  safe_float(ptouch),
            "expected_move_1sd":  safe_float(em),
            "expected_move_pct":  safe_float(em / req.S * 100),
            "lower_bound_1sd":    safe_float(req.S - em),
            "upper_bound_1sd":    safe_float(req.S + em),
        }
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/strategy")
async def price_strategy(req: StrategyRequest):
    """
    Price a multi-leg options strategy.
    
    Supported strategies: straddle, strangle, iron_condor, butterfly,
    covered_call, protective_put, vertical_spread.
    
    Returns: legs, total cost, max profit, max loss, breakevens, Greeks.
    """
    if not _OPTIONS_AVAILABLE:
        raise HTTPException(503, "Options engine unavailable")

    p = req.params
    S, r, q, T = req.S, req.r, req.q, req.T

    try:
        strategy_map = {
            "straddle":        lambda: straddle(S, p.get("K", S), T, r, p.get("sigma", 0.25), q),
            "strangle":        lambda: strangle(S, p.get("K_put", S*0.95), p.get("K_call", S*1.05),
                                                 T, r, p.get("sigma", 0.25), q),
            "iron_condor":     lambda: iron_condor(
                S,
                p.get("K_put_long", S*0.90),
                p.get("K_put_short", S*0.95),
                p.get("K_call_short", S*1.05),
                p.get("K_call_long", S*1.10),
                T, r, p.get("sigma", 0.25), q
            ),
            "butterfly":       lambda: butterfly_spread(
                S,
                p.get("K_low",    S*0.95),
                p.get("K_middle", S),
                p.get("K_high",   S*1.05),
                p.get("option_type", "call"),
                T, r, p.get("sigma", 0.25), q
            ),
            "covered_call":    lambda: covered_call(S, p.get("K", S*1.05), T, r,
                                                      p.get("sigma", 0.25), q),
            "protective_put":  lambda: protective_put(S, p.get("K", S*0.95), T, r,
                                                       p.get("sigma", 0.25), q),
            "vertical_spread": lambda: vertical_spread(
                S,
                p.get("K_long", S*0.95),
                p.get("K_short", S*1.05),
                p.get("option_type", "call"),
                T, r, p.get("sigma", 0.25), q
            ),
        }

        fn = strategy_map.get(req.strategy)
        if not fn:
            raise HTTPException(400, f"Unknown strategy: {req.strategy}. "
                                f"Available: {list(strategy_map.keys())}")

        result = fn()

        # Convert to JSON-safe dict
        import dataclasses
        if dataclasses.is_dataclass(result):
            result_dict = dataclasses.asdict(result)
        elif hasattr(result, "__dict__"):
            result_dict = vars(result)
        else:
            result_dict = result

        def safe_convert(obj):
            if isinstance(obj, dict):
                return {k: safe_convert(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [safe_convert(v) for v in obj]
            elif isinstance(obj, float):
                return safe_float(obj)
            return obj

        return {"strategy": req.strategy, "result": safe_convert(result_dict)}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/scenarios")
async def scenario_pnl(req: ScenarioRequest):
    """
    Compute P&L grid across price and volatility scenarios.
    Returns a 2D matrix: rows = price levels, cols = vol levels.
    """
    if not _OPTIONS_AVAILABLE:
        raise HTTPException(503, "Options engine unavailable")

    try:
        prices = np.linspace(
            req.S * (1 - req.price_range_pct),
            req.S * (1 + req.price_range_pct),
            21
        )
        initial_price = bsm_price(req.S, req.K, req.T, req.r, req.sigma, req.q, req.option_type)

        grid = []
        for vol in req.vol_range:
            row = []
            for price in prices:
                new_price = bsm_price(price, req.K, req.T, req.r, vol, req.q, req.option_type)
                pnl = round(new_price - initial_price, 4)
                row.append(safe_float(pnl))
            grid.append(row)

        return {
            "price_levels": [round(float(p), 2) for p in prices],
            "vol_levels":   [round(v, 4) for v in req.vol_range],
            "pnl_grid":     grid,   # [vol_idx][price_idx]
            "initial_price": safe_float(initial_price),
        }
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/portfolio_greeks")
async def portfolio_greeks(req: PortfolioGreeksRequest):
    """
    Compute net Greeks for a portfolio of option positions.
    Each position: {S, K, T, r, sigma, q, option_type, quantity}
    """
    if not _OPTIONS_AVAILABLE:
        raise HTTPException(503, "Options engine unavailable")

    try:
        net = aggregate_portfolio_greeks(req.positions)
        return {"net_greeks": {k: safe_float(v) for k, v in net.items()}}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.get("/strategies")
async def list_strategies():
    """List all available strategy builders."""
    return {
        "strategies": [
            {
                "name": "straddle",
                "description": "Buy ATM call and put — profits from big moves in either direction",
                "params": ["K", "sigma"],
            },
            {
                "name": "strangle",
                "description": "Buy OTM call and put — cheaper than straddle, needs bigger move",
                "params": ["K_put", "K_call", "sigma"],
            },
            {
                "name": "iron_condor",
                "description": "Short straddle with long wings — profits in sideways markets",
                "params": ["K_put_long", "K_put_short", "K_call_short", "K_call_long", "sigma"],
            },
            {
                "name": "butterfly",
                "description": "Three-strike butterfly — profits near middle strike at expiry",
                "params": ["K_low", "K_middle", "K_high", "option_type", "sigma"],
            },
            {
                "name": "covered_call",
                "description": "Long stock + short OTM call — generate income on existing position",
                "params": ["K", "sigma"],
            },
            {
                "name": "protective_put",
                "description": "Long stock + long put — portfolio insurance",
                "params": ["K", "sigma"],
            },
            {
                "name": "vertical_spread",
                "description": "Debit or credit spread — directional with limited risk/reward",
                "params": ["K_long", "K_short", "option_type", "sigma"],
            },
        ]
    }
