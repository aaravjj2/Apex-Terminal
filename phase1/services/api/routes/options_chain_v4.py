"""
options_chain_v4.py — Real BSM Options Chain API
=================================================
POST /api/v4/options/chain  — Full options chain with BSM Greeks.
GET  /api/v4/options/chain/{symbol} — Quick GET variant.

Accepts the OptionsMatrixUI2.tsx payload format:
  { symbol, spot, r, n_strikes, option_type, expiry }

Returns chain rows with full Greeks + OI/volume mock data so the
OPTIONS CHAIN tab renders beautifully.
"""
from __future__ import annotations
import math
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v4/options", tags=["options-chain-v4"])


# ── BSM helpers ──────────────────────────────────────────────────────────────

def _norm_cdf(x: float) -> float:
    """Standard normal CDF via Horner's method."""
    a1, a2, a3, a4, a5 = 0.319381530, -0.356563782, 1.781477937, -1.821255978, 1.330274429
    k = 1.0 / (1.0 + 0.2316419 * abs(x))
    poly = ((((a5 * k + a4) * k + a3) * k + a2) * k + a1) * k
    p = 1.0 - (1.0 / math.sqrt(2 * math.pi)) * math.exp(-0.5 * x * x) * poly
    return p if x >= 0 else 1.0 - p


def _norm_pdf(x: float) -> float:
    return math.exp(-0.5 * x * x) / math.sqrt(2.0 * math.pi)


def bsm(S: float, K: float, T: float, r: float, sigma: float, q: float,
        option_type: str) -> Dict[str, float]:
    """
    Black-Scholes-Merton pricing + all first-order Greeks.
    Returns dict: price, delta, gamma, theta, vega, rho.
    """
    if T <= 0 or sigma <= 0:
        intrinsic = max(0, S - K) if option_type == "call" else max(0, K - S)
        return {"price": intrinsic, "delta": 1.0 if option_type == "call" and S > K else 0.0,
                "gamma": 0.0, "theta": 0.0, "vega": 0.0, "rho": 0.0, "iv": sigma}

    d1 = (math.log(S / K) + (r - q + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    nd1 = _norm_pdf(d1)

    if option_type == "call":
        price = S * math.exp(-q * T) * _norm_cdf(d1) - K * math.exp(-r * T) * _norm_cdf(d2)
        delta = math.exp(-q * T) * _norm_cdf(d1)
        rho = K * T * math.exp(-r * T) * _norm_cdf(d2) * 0.01
    else:
        price = K * math.exp(-r * T) * _norm_cdf(-d2) - S * math.exp(-q * T) * _norm_cdf(-d1)
        delta = -math.exp(-q * T) * _norm_cdf(-d1)
        rho = -K * T * math.exp(-r * T) * _norm_cdf(-d2) * 0.01

    gamma = nd1 * math.exp(-q * T) / (S * sigma * math.sqrt(T))
    vega = S * math.exp(-q * T) * nd1 * math.sqrt(T) * 0.01  # per 1% vol change
    theta = (-(S * math.exp(-q * T) * nd1 * sigma) / (2 * math.sqrt(T))
             - r * K * math.exp(-r * T) * (_norm_cdf(d2) if option_type == "call" else _norm_cdf(-d2))
             + q * S * math.exp(-q * T) * (_norm_cdf(d1) if option_type == "call" else _norm_cdf(-d1)))
    theta = theta / 365.0  # per calendar day

    return {
        "price": round(max(0.0, price), 4),
        "delta": round(delta, 4),
        "gamma": round(gamma, 6),
        "theta": round(theta, 4),
        "vega": round(vega, 4),
        "rho": round(rho, 4),
        "iv": sigma,
    }


# ── Request/Response models ───────────────────────────────────────────────────

class ChainRequest(BaseModel):
    symbol: str = "AAPL"
    spot: Optional[float] = None    # None → use SPOT_MAP default
    r: float = 0.04
    q: float = 0.0
    n_strikes: int = Field(default=20, ge=4, le=60)
    pct_width: float = Field(default=20.0, ge=5.0, le=50.0)  # ±% around spot
    flat_vol: float = Field(default=0.28, ge=0.01, le=5.0)
    option_type: Literal["call", "put", "both"] = "both"
    expiry: Optional[str] = None   # ISO date string — ignored, use T_list


# ── Approximate spot prices for demo symbols ─────────────────────────────────

SPOT_MAP: Dict[str, float] = {
    "AAPL": 272.95, "MSFT": 401.72, "NVDA": 184.89, "AMZN": 207.92,
    "GOOG": 307.15, "META": 657.01, "SPY":  689.30,  "QQQ":  484.20,
    "TSLA": 408.58, "BTC":  29.83,  "ETH":  19.17,   "JPM":  238.45,
    "GS":   620.10, "BAC":  45.23,  "XOM":  113.55,  "CVX":  158.30,
}

# Vol (IV) map — realistic skew baked in per symbol
VOL_MAP: Dict[str, float] = {
    "AAPL": 0.24, "MSFT": 0.22, "NVDA": 0.45, "AMZN": 0.28,
    "GOOG": 0.26, "META": 0.32, "SPY":  0.16, "QQQ":  0.20,
    "TSLA": 0.55, "BTC":  0.68, "ETH":  0.72, "JPM":  0.23,
    "GS":   0.26, "BAC":  0.28, "XOM":  0.22, "CVX":  0.24,
}

# Expiry buckets (T in years)
EXPIRY_BUCKETS = [
    ("2026-03-21", 0.063),
    ("2026-04-17", 0.13),
    ("2026-06-19", 0.31),
    ("2026-09-18", 0.56),
    ("2027-01-15", 1.38),
]


def _build_chain(sym: str, S: float, r: float, q: float, sigma: float,
                  n_strikes: int, pct_width: float,
                  option_type: str) -> List[Dict[str, Any]]:
    """Generate BSM options chain rows."""
    step_pct = pct_width / (n_strikes // 2)
    raw_step = S * step_pct / 100.0
    # Round step to a "clean" tick
    magnitude = 10 ** math.floor(math.log10(raw_step))
    tick = magnitude * round(raw_step / magnitude)
    tick = max(tick, 0.5)

    # Strikes: n_strikes centred around S
    atm = round(S / tick) * tick
    half = n_strikes // 2
    strikes = [round(atm + (i - half) * tick, 2) for i in range(n_strikes + 1) if atm + (i - half) * tick > 0]

    rows: List[Dict[str, Any]] = []
    import random, hashlib

    for T, exp_date in [(bkt[1], bkt[0]) for bkt in EXPIRY_BUCKETS[:3]]:
        for side in (["call", "put"] if option_type == "both" else [option_type]):
            for K in strikes:
                # Skew: OTM puts have higher vol, OTM calls slightly lower
                moneyness = K / S
                if side == "put":
                    skew_adj = 0.04 * max(0, 1.0 - moneyness)
                else:
                    skew_adj = -0.01 * max(0, moneyness - 1.0)
                vol = max(0.05, sigma + skew_adj)

                g = bsm(S, K, T, r, vol, q, side)
                price = g["price"]

                spread = max(0.01, price * 0.03)
                bid = round(price - spread / 2, 2)
                ask = round(price + spread / 2, 2)

                # Mock OI and volume (seeded by symbol+K+side for determinism)
                seed = int(hashlib.md5(f"{sym}{K}{side}{exp_date}".encode()).hexdigest()[:8], 16)
                rng = random.Random(seed)
                oi = rng.randint(50, 25000)
                vol_trades = rng.randint(0, oi // 5 + 1)

                rows.append({
                    "symbol": sym,
                    "option_type": side,
                    "strike": K,
                    "expiry": exp_date,
                    "T": T,
                    "bid": max(0.01, bid),
                    "ask": max(0.02, ask),
                    "mid": round((bid + ask) / 2, 2),
                    "last": round((bid + ask) / 2 + rng.uniform(-0.05, 0.05), 2),
                    "iv": round(vol, 4),
                    "delta": g["delta"],
                    "gamma": g["gamma"],
                    "theta": g["theta"],
                    "vega": g["vega"],
                    "rho": g["rho"],
                    "open_interest": oi,
                    "volume": vol_trades,
                    "itm": (K < S if side == "call" else K > S),
                })

    return rows


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/chain")
async def post_options_chain(req: ChainRequest):
    sym = req.symbol.upper()
    S = req.spot or SPOT_MAP.get(sym, 100.0)
    sigma = VOL_MAP.get(sym, 0.30)
    if req.flat_vol and req.flat_vol != 0.28:
        sigma = req.flat_vol

    chain = _build_chain(sym, S, req.r, req.q, sigma,
                         req.n_strikes, req.pct_width, req.option_type)

    expiries = sorted({r["expiry"] for r in chain})

    return {
        "ok": True,
        "symbol": sym,
        "spot_price": S,
        "expiries": expiries,
        "chain": chain,
        "metadata": {
            "total_rows": len(chain),
            "strikes": req.n_strikes,
            "iv_model": "bsm_flat_skew",
            "r": req.r,
            "q": req.q,
        },
    }


@router.get("/chain/{symbol}")
async def get_options_chain(symbol: str, n_strikes: int = 20, r: float = 0.04):
    sym = symbol.upper()
    S = SPOT_MAP.get(sym, 100.0)
    sigma = VOL_MAP.get(sym, 0.30)
    chain = _build_chain(sym, S, r, 0.0, sigma, n_strikes, 20.0, "both")
    expiries = sorted({row["expiry"] for row in chain})
    return {
        "ok": True,
        "symbol": sym,
        "spot_price": S,
        "expiries": expiries,
        "chain": chain,
        "metadata": {"total_rows": len(chain)},
    }
