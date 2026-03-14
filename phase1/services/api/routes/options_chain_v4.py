"""
options_chain_v4.py — Real BSM Options Chain API
=================================================
POST /api/v4/options/chain  — Full options chain with BSM Greeks.
GET  /api/v4/options/chain/{symbol} — Quick GET variant.

Accepts the OptionsMatrixUI2.tsx payload format:
  { symbol, spot, r, n_strikes, option_type, expiry }

Returns chain rows with full Greeks. OI/volume is deterministically
seeded (no real-time OI source available for free; labeled as estimated).
Spot price is fetched live from yfinance; SPOT_MAP is a stale emergency
fallback only — a warning is logged when it is used.
"""
from __future__ import annotations
import logging
import math
from datetime import date, timedelta
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v4/options", tags=["options-chain-v4"])
_log = logging.getLogger(__name__)


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


# ── Emergency fallback spot prices (stale — live yfinance is always tried first) ──
# WARNING: These prices are approximate reference values only. A warning is logged
# whenever a fallback price is used. Do not rely on these for real trading decisions.

SPOT_MAP: Dict[str, float] = {
    "AAPL": 220.0, "MSFT": 410.0, "NVDA": 875.0, "AMZN": 195.0,
    "GOOG": 175.0, "GOOGL": 175.0, "META": 550.0, "SPY": 550.0,
    "QQQ":  470.0, "TSLA": 250.0, "BTC":  85000.0, "ETH":  3200.0,
    "JPM":  240.0, "GS":   530.0, "BAC":  45.0,   "XOM":  115.0,
    "CVX":  155.0,
}

# Vol (IV) map — realistic long-run estimates per symbol (used when Tradier/live IV unavailable)
VOL_MAP: Dict[str, float] = {
    "AAPL": 0.24, "MSFT": 0.22, "NVDA": 0.50, "AMZN": 0.28,
    "GOOG": 0.26, "GOOGL": 0.26, "META": 0.35, "SPY":  0.16,
    "QQQ":  0.20, "TSLA": 0.60, "BTC":  0.75, "ETH":  0.80,
    "JPM":  0.24, "GS":   0.27, "BAC":  0.30, "XOM":  0.23,
    "CVX":  0.25,
}


# ── Dynamic expiry-bucket computation ─────────────────────────────────────────

def _third_friday(year: int, month: int) -> date:
    """Return the 3rd Friday of a given year/month (standard monthly expiry)."""
    d = date(year, month, 1)
    # weekday(): 0=Mon … 4=Fri
    first_friday = d + timedelta(days=(4 - d.weekday()) % 7)
    return first_friday + timedelta(weeks=2)


def _next_friday() -> date:
    today = date.today()
    days = (4 - today.weekday()) % 7
    if days == 0:
        days = 7  # if today is Friday, jump to next Friday
    return today + timedelta(days=days)


def _compute_expiry_buckets() -> List[tuple]:
    """
    Dynamically compute 5 standard options expiry dates from today:
      0 — next weekly Friday
      1 — 3rd Friday ~1 month out
      2 — 3rd Friday ~3 months out
      3 — 3rd Friday ~6 months out
      4 — 3rd Friday ~15 months out (LEAPS)
    Returns list of (iso_date, T_in_years) tuples.
    """
    today = date.today()
    buckets: List[tuple] = []

    # Weekly: next Friday
    nf = _next_friday()
    t0 = max(0.005, (nf - today).days / 365.25)
    buckets.append((nf.isoformat(), round(t0, 4)))

    # Monthly expirations at ~1, 3, 6, 15 month offsets
    for month_offset in (1, 3, 6, 15):
        raw_month = today.month + month_offset
        target_year = today.year + (raw_month - 1) // 12
        target_month = ((raw_month - 1) % 12) + 1
        exp = _third_friday(target_year, target_month)
        # Ensure exp is strictly in the future
        if exp <= today:
            exp += timedelta(weeks=4)
        t = max(0.01, (exp - today).days / 365.25)
        buckets.append((exp.isoformat(), round(t, 4)))

    return buckets


def _build_chain(sym: str, S: float, r: float, q: float, sigma: float,
                  n_strikes: int, pct_width: float,
                  option_type: str) -> List[Dict[str, Any]]:
    """Generate BSM options chain rows with dynamically computed expiry dates."""
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

    # Use fresh dynamic expiry buckets (never stale hardcoded dates)
    expiry_buckets = _compute_expiry_buckets()

    for T, exp_date in [(bkt[1], bkt[0]) for bkt in expiry_buckets[:3]]:
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

                # Estimated OI and volume (deterministic seed by symbol+K+side+expiry).
                # NOTE: These are estimates only — no real-time OI source is available
                # for free. Seeded deterministically so the UI is stable across refreshes.
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
                    "oi_source": "estimated",
                })

    return rows


# ── Routes ────────────────────────────────────────────────────────────────────

async def _get_live_spot(symbol: str) -> Optional[float]:
    """Fetch live spot price from yfinance."""
    import asyncio, logging
    try:
        import yfinance as yf
        loop = asyncio.get_event_loop()
        def _fetch():
            t = yf.Ticker(symbol)
            hist = t.history(period="2d")
            if not hist.empty:
                return float(hist["Close"].iloc[-1])
            return None
        return await loop.run_in_executor(None, _fetch)
    except Exception as e:
        logging.getLogger(__name__).debug(f"Live spot fetch failed for {symbol}: {e}")
        return None


@router.post("/chain")
async def post_options_chain(req: ChainRequest):
    sym = req.symbol.upper()
    live_spot = None
    if req.spot is None:
        live_spot = await _get_live_spot(sym)
    fallback_used = False
    if req.spot:
        S = req.spot
    elif live_spot is not None:
        S = live_spot
    else:
        fallback_price = SPOT_MAP.get(sym, 100.0)
        _log.warning(
            f"Live spot price unavailable for {sym} — using stale fallback ${fallback_price:.2f}. "
            "This price may be significantly out of date."
        )
        S = fallback_price
        fallback_used = True

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
        "spot_source": "request" if req.spot else ("yfinance" if not fallback_used else "stale_fallback"),
        "expiries": expiries,
        "chain": chain,
        "metadata": {
            "total_rows": len(chain),
            "strikes": req.n_strikes,
            "iv_model": "bsm_flat_skew",
            "r": req.r,
            "q": req.q,
            "oi_note": "Open interest values are estimates (no real-time OI source)",
        },
    }


@router.get("/chain/{symbol}")
async def get_options_chain(symbol: str, n_strikes: int = 20, r: float = 0.04):
    sym = symbol.upper()
    live_spot = await _get_live_spot(sym)
    if live_spot is None:
        fallback_price = SPOT_MAP.get(sym, 100.0)
        _log.warning(
            f"Live spot price unavailable for {sym} — using stale fallback ${fallback_price:.2f}."
        )
        S = fallback_price
        spot_source = "stale_fallback"
    else:
        S = live_spot
        spot_source = "yfinance"

    sigma = VOL_MAP.get(sym, 0.30)
    chain = _build_chain(sym, S, r, 0.0, sigma, n_strikes, 20.0, "both")
    expiries = sorted({row["expiry"] for row in chain})
    return {
        "ok": True,
        "symbol": sym,
        "spot_price": S,
        "spot_source": spot_source,
        "expiries": expiries,
        "chain": chain,
        "metadata": {
            "total_rows": len(chain),
            "oi_note": "Open interest values are estimates (no real-time OI source)",
        },
    }
