"""
T2: Greeks Calculator — Black-Scholes closed-form.

Computes per-leg and portfolio-level greeks (Δ, Γ, Vega, Θ)
using the Black-Scholes model with the IV and delta from the
snapshot fixture.  Fully deterministic — no LLM, no API keys.
"""

from __future__ import annotations

import math
from typing import Optional

from .schemas import PortfolioRow, Snapshot, SnapshotEntry
from .schemas_w2 import GreeksSummary
from .validator import normalize_ticker


# ── Black-Scholes helpers ───────────────────────────────────────────────────

def _norm_cdf(x: float) -> float:
    """Standard normal CDF (Abramowitz & Stegun approximation)."""
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def _norm_pdf(x: float) -> float:
    return math.exp(-0.5 * x * x) / math.sqrt(2.0 * math.pi)


def _bs_greeks(
    S: float,
    K: float,
    T: float,
    sigma: float,
    r: float,
    option_type: str,
) -> dict:
    """Compute Black-Scholes greeks for a single vanilla option.

    Returns dict with keys: delta, gamma, vega, theta.
    Values are per-contract (multiply by quantity * multiplier for portfolio).
    """
    if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        return {"delta": 0.0, "gamma": 0.0, "vega": 0.0, "theta": 0.0}

    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)

    # Gamma (same for call/put)
    gamma = _norm_pdf(d1) / (S * sigma * math.sqrt(T))

    # Vega (same for call/put) — per 1% vol move
    vega = S * _norm_pdf(d1) * math.sqrt(T) / 100.0

    if option_type == "call":
        delta = _norm_cdf(d1)
        theta = (
            -S * _norm_pdf(d1) * sigma / (2.0 * math.sqrt(T))
            - r * K * math.exp(-r * T) * _norm_cdf(d2)
        ) / 365.0
    else:  # put
        delta = _norm_cdf(d1) - 1.0
        theta = (
            -S * _norm_pdf(d1) * sigma / (2.0 * math.sqrt(T))
            + r * K * math.exp(-r * T) * _norm_cdf(-d2)
        ) / 365.0

    return {
        "delta": round(delta, 6),
        "gamma": round(gamma, 6),
        "vega": round(vega, 4),
        "theta": round(theta, 4),
    }


# ── Snapshot lookup ─────────────────────────────────────────────────────────

def _find_snapshot_entry(
    symbol: str, strike: float, option_type: str, expiry: str,
    snapshot: Snapshot,
) -> Optional[SnapshotEntry]:
    """Find a matching snapshot entry (symbol is already normalized)."""
    for e in snapshot.entries:
        if (
            e.symbol.upper() == symbol.upper()
            and abs(e.strike - strike) < 0.01
            and e.option_type.lower() == option_type.lower()
            and e.expiry == expiry
        ):
            return e
    return None


# ── Main calculator ────────────────────────────────────────────────────────

# Default underlying prices (synthetic demo data)
_DEMO_UNDERLYING: dict[str, float] = {
    "AAPL": 225.0,
    "MSFT": 435.0,
    "TSLA": 255.0,
    "BRK-B": 425.0,
    "AMZN": 195.0,
    "GOOGL": 160.0,
}

# Risk-free rate for BS model
_RISK_FREE_RATE = 0.05

# Default time-to-expiry in years (synthetic)
_DEFAULT_T = 0.15


def calculate_greeks(
    rows: list[PortfolioRow],
    snapshot: Snapshot,
) -> GreeksSummary:
    """Compute portfolio-level greeks using Black-Scholes.

    Uses snapshot IV for each leg. Fully deterministic.
    """
    per_leg: list[dict] = []
    net_delta = 0.0
    net_gamma = 0.0
    net_vega = 0.0
    net_theta = 0.0

    for row in rows:
        norm_sym, _ = normalize_ticker(row.symbol)
        S = _DEMO_UNDERLYING.get(norm_sym, 200.0)
        K = row.strike or 0.0
        otype = row.option_type.lower()
        qty = row.quantity or 0
        mult = row.multiplier or 100.0

        # Look up IV from snapshot
        entry = _find_snapshot_entry(norm_sym, K, otype, row.expiry, snapshot)
        sigma = entry.iv if entry else 0.30  # fallback IV

        greeks = _bs_greeks(S, K, _DEFAULT_T, sigma, _RISK_FREE_RATE, otype)

        # Scale by quantity * multiplier
        scaled = {
            "delta": round(greeks["delta"] * qty * mult, 4),
            "gamma": round(greeks["gamma"] * qty * mult, 6),
            "vega": round(greeks["vega"] * qty * mult, 4),
            "theta": round(greeks["theta"] * qty * mult, 4),
        }

        net_delta += scaled["delta"]
        net_gamma += scaled["gamma"]
        net_vega += scaled["vega"]
        net_theta += scaled["theta"]

        per_leg.append({
            "row": row.row_number,
            "symbol": norm_sym,
            "option_type": otype,
            "strike": K,
            "expiry": row.expiry,
            "quantity": qty,
            "iv_used": sigma,
            **scaled,
        })

    return GreeksSummary(
        net_delta=round(net_delta, 4),
        net_gamma=round(net_gamma, 6),
        net_vega=round(net_vega, 4),
        net_theta=round(net_theta, 4),
        per_leg=per_leg,
    )
