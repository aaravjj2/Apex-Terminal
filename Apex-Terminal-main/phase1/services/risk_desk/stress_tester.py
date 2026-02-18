"""
T3: Stress Tester — scenario P&L + hedge candidate generation.

Computes portfolio P&L under a stress scenario (spot shift + vol shift)
using Black-Scholes repricing.  Generates exactly 2 hedge candidates:
  - Candidate A: Protective put spread (risk-defined)
  - Candidate B: Call spread collar (risk-defined)

Fully deterministic — no LLM, no API keys.
"""

from __future__ import annotations

import math
from typing import Optional

from .schemas import PortfolioRow, Snapshot
from .schemas_w2 import (
    HedgeCandidate,
    HedgeLeg,
    StressLegResult,
    StressResult,
    StressScenario,
)
from .greeks_calculator import _bs_greeks, _find_snapshot_entry, _DEMO_UNDERLYING, _RISK_FREE_RATE, _DEFAULT_T
from .validator import normalize_ticker


# ── Built-in scenarios ──────────────────────────────────────────────────────

SCENARIOS: dict[str, StressScenario] = {
    "moderate_selloff": StressScenario(
        id="moderate_selloff",
        label="Moderate Sell-off (-10% spot, +20% vol)",
        spot_shift_pct=-10.0,
        vol_shift_pct=20.0,
    ),
    "severe_crash": StressScenario(
        id="severe_crash",
        label="Severe Crash (-25% spot, +50% vol)",
        spot_shift_pct=-25.0,
        vol_shift_pct=50.0,
    ),
    "vol_expansion": StressScenario(
        id="vol_expansion",
        label="Vol Expansion (0% spot, +40% vol)",
        spot_shift_pct=0.0,
        vol_shift_pct=40.0,
    ),
}

DEFAULT_SCENARIO_ID = "moderate_selloff"


# ── BS pricing helper ──────────────────────────────────────────────────────

def _bs_price(
    S: float, K: float, T: float, sigma: float, r: float, option_type: str,
) -> float:
    """Black-Scholes option price."""
    if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        return max(0.0, (S - K) if option_type == "call" else (K - S))

    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)

    from .greeks_calculator import _norm_cdf

    if option_type == "call":
        return S * _norm_cdf(d1) - K * math.exp(-r * T) * _norm_cdf(d2)
    else:
        return K * math.exp(-r * T) * _norm_cdf(-d2) - S * _norm_cdf(-d1)


# ── Stress test engine ──────────────────────────────────────────────────────

def run_stress_test(
    rows: list[PortfolioRow],
    snapshot: Snapshot,
    scenario_id: str = DEFAULT_SCENARIO_ID,
) -> StressResult:
    """Run a stress test on the portfolio.

    1. Reprice each leg under base and stressed conditions.
    2. Compute per-leg and total P&L.
    3. Generate 2 hedge candidates.
    """
    scenario = SCENARIOS.get(scenario_id, SCENARIOS[DEFAULT_SCENARIO_ID])
    spot_mult = 1.0 + scenario.spot_shift_pct / 100.0
    vol_mult = 1.0 + scenario.vol_shift_pct / 100.0

    leg_results: list[StressLegResult] = []
    total_pnl = 0.0

    # Find the primary symbol for hedge candidate generation
    primary_symbol = "AAPL"
    primary_expiry = "2025-03-21"

    for row in rows:
        norm_sym, _ = normalize_ticker(row.symbol)
        S = _DEMO_UNDERLYING.get(norm_sym, 200.0)
        K = row.strike or 0.0
        otype = row.option_type.lower()
        qty = row.quantity or 0
        mult = row.multiplier or 100.0

        entry = _find_snapshot_entry(norm_sym, K, otype, row.expiry, snapshot)
        sigma = entry.iv if entry else 0.30

        # Base price
        base_price = _bs_price(S, K, _DEFAULT_T, sigma, _RISK_FREE_RATE, otype)
        base_value = base_price * qty * mult

        # Stressed price
        S_stressed = S * spot_mult
        sigma_stressed = sigma * vol_mult
        stressed_price = _bs_price(S_stressed, K, _DEFAULT_T, sigma_stressed, _RISK_FREE_RATE, otype)
        stressed_value = stressed_price * qty * mult

        pnl = stressed_value - base_value
        total_pnl += pnl

        leg_results.append(StressLegResult(
            symbol=norm_sym,
            option_type=otype,
            strike=K,
            base_value=round(base_value, 2),
            stressed_value=round(stressed_value, 2),
            pnl=round(pnl, 2),
        ))

        # Track primary symbol (largest absolute position)
        if abs(qty) >= 5:
            primary_symbol = norm_sym
            primary_expiry = row.expiry

    # Generate exactly 2 hedge candidates
    primary_S = _DEMO_UNDERLYING.get(primary_symbol, 200.0)
    hedges = _generate_hedge_candidates(
        primary_symbol, primary_S, primary_expiry, total_pnl, snapshot, scenario
    )

    return StressResult(
        scenario=scenario,
        total_pnl=round(total_pnl, 2),
        leg_results=leg_results,
        hedge_candidates=hedges,
    )


def _generate_hedge_candidates(
    symbol: str,
    underlying_price: float,
    expiry: str,
    portfolio_stress_pnl: float,
    snapshot: Snapshot,
    scenario: StressScenario,
) -> list[HedgeCandidate]:
    """Generate exactly 2 deterministic hedge candidates.

    Candidate A: Protective put spread (buy ATM put, sell OTM put)
    Candidate B: Call spread collar (sell OTM call, buy OTM put)
    """
    atm_strike = round(underlying_price / 5) * 5  # Round to nearest 5
    otm_put_strike = atm_strike - 10
    otm_call_strike = atm_strike + 10

    # Estimate premiums from BS
    sigma = 0.30  # fallback
    for e in snapshot.entries:
        if e.symbol.upper() == symbol.upper():
            sigma = e.iv
            break

    atm_put_premium = _bs_price(underlying_price, atm_strike, _DEFAULT_T, sigma, _RISK_FREE_RATE, "put")
    otm_put_premium = _bs_price(underlying_price, otm_put_strike, _DEFAULT_T, sigma, _RISK_FREE_RATE, "put")
    otm_call_premium = _bs_price(underlying_price, otm_call_strike, _DEFAULT_T, sigma, _RISK_FREE_RATE, "call")

    # Candidate A: Protective put spread
    spread_cost = (atm_put_premium - otm_put_premium) * 100  # 1 contract
    max_loss_reduction_a = abs(portfolio_stress_pnl) * 0.35  # ~35% loss reduction

    # Candidate B: Call spread collar
    collar_cost = (otm_put_premium - otm_call_premium) * 100  # sell call, buy put
    max_loss_reduction_b = abs(portfolio_stress_pnl) * 0.25

    return [
        HedgeCandidate(
            id="hedge_A",
            name="Protective Put Spread",
            strategy_type="protective_put_spread",
            legs=[
                HedgeLeg(
                    symbol=symbol,
                    option_type="put",
                    strike=atm_strike,
                    expiry=expiry,
                    side="buy",
                    quantity=5,
                    premium_est=round(atm_put_premium, 2),
                ),
                HedgeLeg(
                    symbol=symbol,
                    option_type="put",
                    strike=otm_put_strike,
                    expiry=expiry,
                    side="sell",
                    quantity=-5,
                    premium_est=round(otm_put_premium, 2),
                ),
            ],
            net_cost_est=round(spread_cost * 5, 2),  # 5 contracts
            max_loss_reduction_est=round(max_loss_reduction_a, 2),
            explanation=(
                f"Buy {atm_strike} puts / sell {otm_put_strike} puts on {symbol}. "
                f"Defined-risk protective spread limiting downside in {scenario.label} scenario."
            ),
        ),
        HedgeCandidate(
            id="hedge_B",
            name="Call Spread Collar",
            strategy_type="call_spread_collar",
            legs=[
                HedgeLeg(
                    symbol=symbol,
                    option_type="put",
                    strike=otm_put_strike,
                    expiry=expiry,
                    side="buy",
                    quantity=5,
                    premium_est=round(otm_put_premium, 2),
                ),
                HedgeLeg(
                    symbol=symbol,
                    option_type="call",
                    strike=otm_call_strike,
                    expiry=expiry,
                    side="sell",
                    quantity=-5,
                    premium_est=round(otm_call_premium, 2),
                ),
            ],
            net_cost_est=round(collar_cost * 5, 2),
            max_loss_reduction_est=round(max_loss_reduction_b, 2),
            explanation=(
                f"Sell {otm_call_strike} calls / buy {otm_put_strike} puts on {symbol}. "
                f"Defined-risk collar hedging vol expansion risk."
            ),
        ),
    ]
