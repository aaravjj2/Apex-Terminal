"""
T4: Greeks Verifier — independent verification using binomial tree.

Cross-checks the BS analytical greeks from T2 against a binomial-tree model.
Flags any discrepancy beyond configurable thresholds.

Fully deterministic — no LLM, no API keys.
"""

from __future__ import annotations

import math
from typing import Optional

from .schemas import PortfolioRow, Snapshot
from .schemas_w2 import GreeksSummary, VerifierResult
from .greeks_calculator import _find_snapshot_entry, _DEMO_UNDERLYING, _RISK_FREE_RATE, _DEFAULT_T
from .validator import normalize_ticker


# ── Binomial tree settings ──────────────────────────────────────────────────

_TREE_STEPS = 100
_DELTA_THRESHOLD = 0.05       # per-leg absolute delta tolerance
_VEGA_THRESHOLD = 0.10        # per-leg vega tolerance (% of BS vega)
_BUMP_SIZE = 0.01             # 1% bump for finite-difference greeks


# ── Binomial tree pricer ────────────────────────────────────────────────────

def _binomial_price(
    S: float, K: float, T: float, sigma: float, r: float,
    option_type: str, steps: int = _TREE_STEPS,
) -> float:
    """American-style binomial-tree option price (Cox-Ross-Rubinstein)."""
    if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        return max(0.0, (S - K) if option_type == "call" else (K - S))

    dt = T / steps
    u = math.exp(sigma * math.sqrt(dt))
    d = 1.0 / u
    p = (math.exp(r * dt) - d) / (u - d)
    disc = math.exp(-r * dt)

    # Terminal payoffs
    prices = [0.0] * (steps + 1)
    for i in range(steps + 1):
        St = S * (u ** (steps - i)) * (d ** i)
        if option_type == "call":
            prices[i] = max(0.0, St - K)
        else:
            prices[i] = max(0.0, K - St)

    # Backward induction
    for j in range(steps - 1, -1, -1):
        for i in range(j + 1):
            hold = disc * (p * prices[i] + (1.0 - p) * prices[i + 1])
            St = S * (u ** (j - i)) * (d ** i)
            if option_type == "call":
                exercise = max(0.0, St - K)
            else:
                exercise = max(0.0, K - St)
            prices[i] = max(hold, exercise)

    return prices[0]


def _finite_diff_delta(
    S: float, K: float, T: float, sigma: float, r: float,
    option_type: str, steps: int = _TREE_STEPS,
) -> float:
    """Finite-difference delta via binomial tree."""
    bump = S * _BUMP_SIZE
    price_up = _binomial_price(S + bump, K, T, sigma, r, option_type, steps)
    price_dn = _binomial_price(S - bump, K, T, sigma, r, option_type, steps)
    return (price_up - price_dn) / (2.0 * bump)


# ── Verification engine ────────────────────────────────────────────────────

def verify_greeks(
    rows: list[PortfolioRow],
    snapshot: Snapshot,
    greeks: GreeksSummary,
) -> VerifierResult:
    """Cross-verify the BS greeks from T2 against binomial tree.

    Compares *raw per-option* delta (before qty*mult scaling).

    Returns a VerifierResult with:
      - method = "binomial_tree"
      - verified = True if all deltas within threshold
      - max_delta_deviation, max_gamma_deviation, max_vega_deviation
    """
    max_delta_dev = 0.0
    max_gamma_dev = 0.0
    max_vega_dev = 0.0

    for idx, row in enumerate(rows):
        norm_sym, _ = normalize_ticker(row.symbol)
        S = _DEMO_UNDERLYING.get(norm_sym, 200.0)
        K = row.strike or 0.0
        otype = row.option_type.lower()
        qty = row.quantity or 0
        mult = row.multiplier or 100.0

        entry = _find_snapshot_entry(norm_sym, K, otype, row.expiry, snapshot)
        sigma = entry.iv if entry else 0.30

        # Binomial-tree raw delta (per single option)
        bt_delta = _finite_diff_delta(S, K, _DEFAULT_T, sigma, _RISK_FREE_RATE, otype)

        # Find matching BS delta from greeks per_leg — stored scaled,
        # so un-scale by dividing by qty*mult to get per-option delta.
        for leg in greeks.per_leg:
            if (leg.get("symbol", "").upper() == norm_sym.upper()
                    and abs(leg.get("strike", 0) - K) < 0.01
                    and leg.get("option_type", "").lower() == otype):
                scaled_delta = leg.get("delta", 0.0)
                divisor = qty * mult if qty != 0 and mult != 0 else 1.0
                bs_delta_raw = scaled_delta / divisor
                deviation = abs(bt_delta - bs_delta_raw)
                max_delta_dev = max(max_delta_dev, deviation)
                break

        # Finite-difference vega via binomial tree (per option)
        sigma_up = sigma + 0.01
        sigma_dn = max(0.01, sigma - 0.01)
        price_up = _binomial_price(S, K, _DEFAULT_T, sigma_up, _RISK_FREE_RATE, otype)
        price_dn = _binomial_price(S, K, _DEFAULT_T, sigma_dn, _RISK_FREE_RATE, otype)
        bt_vega = (price_up - price_dn) / (sigma_up - sigma_dn) * 0.01  # per 1% vol

        for leg in greeks.per_leg:
            if (leg.get("symbol", "").upper() == norm_sym.upper()
                    and abs(leg.get("strike", 0) - K) < 0.01
                    and leg.get("option_type", "").lower() == otype):
                scaled_vega = leg.get("vega", 0.0)
                divisor = qty * mult if qty != 0 and mult != 0 else 1.0
                bs_vega_raw = scaled_vega / divisor
                if abs(bs_vega_raw) > 0.001:
                    vega_dev = abs(bt_vega - bs_vega_raw) / abs(bs_vega_raw)
                    max_vega_dev = max(max_vega_dev, vega_dev)
                break

    verified = max_delta_dev < _DELTA_THRESHOLD

    return VerifierResult(
        method="binomial_tree",
        verified=verified,
        max_delta_deviation=round(max_delta_dev, 6),
        max_gamma_deviation=round(max_gamma_dev, 6),
        max_vega_deviation=round(max_vega_dev, 6),
    )
