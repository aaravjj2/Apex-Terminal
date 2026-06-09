"""Node 2 — Black-Scholes-Merton pricing, Greeks, Newton-Raphson IV."""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date
from typing import Literal

from .market_data import MarketContext, OptionQuote, build_market_context, fetch_option_quote

OptionRight = Literal["Call", "Put"]


def _norm_cdf(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def _norm_pdf(x: float) -> float:
    return math.exp(-0.5 * x * x) / math.sqrt(2.0 * math.pi)


def _d1_d2(S: float, K: float, t: float, r: float, sigma: float) -> tuple[float, float]:
    if t <= 0 or sigma <= 0:
        return (100.0 if S >= K else -100.0, 100.0 if S >= K else -100.0)
    d1 = (math.log(S / K) + (r + 0.5 * sigma * sigma) * t) / (sigma * math.sqrt(t))
    d2 = d1 - sigma * math.sqrt(t)
    return d1, d2


def bs_price(S: float, K: float, t: float, r: float, sigma: float, option_type: OptionRight) -> float:
    d1, d2 = _d1_d2(S, K, t, r, sigma)
    if option_type == "Call":
        return S * _norm_cdf(d1) - K * math.exp(-r * t) * _norm_cdf(d2)
    return K * math.exp(-r * t) * _norm_cdf(-d2) - S * _norm_cdf(-d1)


def bs_greeks(S: float, K: float, t: float, r: float, sigma: float, option_type: OptionRight) -> dict[str, float]:
    d1, d2 = _d1_d2(S, K, t, r, sigma)
    pdf_d1 = _norm_pdf(d1)
    sqrt_t = math.sqrt(t) if t > 0 else 0.0
    delta = _norm_cdf(d1) if option_type == "Call" else _norm_cdf(d1) - 1.0
    gamma = pdf_d1 / (S * sigma * sqrt_t) if t > 0 and sigma > 0 else 0.0
    vega = S * sqrt_t * pdf_d1 if t > 0 else 0.0
    if option_type == "Call":
        theta = -(S * pdf_d1 * sigma) / (2 * sqrt_t) - r * K * math.exp(-r * t) * _norm_cdf(d2) if t > 0 else 0.0
        rho = K * t * math.exp(-r * t) * _norm_cdf(d2) if t > 0 else 0.0
    else:
        theta = -(S * pdf_d1 * sigma) / (2 * sqrt_t) + r * K * math.exp(-r * t) * _norm_cdf(-d2) if t > 0 else 0.0
        rho = -K * t * math.exp(-r * t) * _norm_cdf(-d2) if t > 0 else 0.0
    return {
        "delta": round(delta, 4),
        "gamma": round(gamma, 4),
        "theta": round(theta, 4),
        "vega": round(vega, 4),
        "rho": round(rho, 4),
    }


def corrado_miller_initial_guess(
    S: float, K: float, t: float, r: float, market_price: float, option_type: OptionRight
) -> tuple[float, bool]:
    """Corrado-Miller closed-form IV seed. Returns (sigma, cm_valid)."""
    if t <= 0:
        return 0.25, False
    forward_diff = S - K * math.exp(-r * t)
    inner = market_price - forward_diff / 2.0
    radicand = inner * inner - (forward_diff * forward_diff) / math.pi
    if radicand < 0:
        return 0.25, False
    term = inner + math.sqrt(radicand)
    denom = (S + K * math.exp(-r * t)) * math.sqrt(t)
    if denom <= 0:
        return 0.25, False
    sigma = term * math.sqrt(2 * math.pi) / denom
    return max(0.05, min(3.0, sigma)), True


def jaeckel_rational_seed(
    S: float, K: float, t: float, r: float, market_price: float, option_type: OptionRight
) -> float:
    """
    Peter Jaeckel-style rational seed for deep OTM/ITM where Corrado-Miller fails.
    Uses Brenner-Subrahmanyam / extrinsic-normalized approximation.
    """
    if t <= 0 or market_price <= 0:
        return 0.25

    intrinsic = max(S - K * math.exp(-r * t), 0.0) if option_type == "Call" else max(K * math.exp(-r * t) - S, 0.0)
    extrinsic = max(market_price - intrinsic, 1e-6)
    moneyness = K / S if S > 0 else 1.0

    # ATM Brenner-Subrahmanyam
    if 0.9 <= moneyness <= 1.1:
        return max(0.05, min(3.0, math.sqrt(2 * math.pi / t) * market_price / S))

    # Deep OTM — scale by extrinsic
    if (option_type == "Call" and moneyness > 1.1) or (option_type == "Put" and moneyness < 0.9):
        return max(0.05, min(3.0, math.sqrt(2 * math.pi / t) * extrinsic / S))

    # Deep ITM — wider denominator stabilizes vega-near-zero region
    blend = S + K * math.exp(-r * t)
    return max(0.05, min(3.0, math.sqrt(2 * math.pi / t) * market_price / blend))


def _segmented_iv_seed(
    S: float, K: float, t: float, r: float, market_price: float, option_type: OptionRight
) -> tuple[float, str]:
    cm, cm_valid = corrado_miller_initial_guess(S, K, t, r, market_price, option_type)
    moneyness = K / S if S > 0 else 1.0
    deep = moneyness > 1.25 or moneyness < 0.75

    if cm_valid and not deep and 0.05 <= cm <= 2.5:
        return cm, "Corrado-Miller_Segmented"
    jaeckel = jaeckel_rational_seed(S, K, t, r, market_price, option_type)
    return jaeckel, "Jaeckel_Rational_Segmented"


def implied_volatility_newton(
    market_price: float,
    S: float,
    K: float,
    t: float,
    r: float,
    option_type: OptionRight,
    *,
    tolerance: float = 1e-8,
    max_iterations: int = 50,
) -> tuple[float, str, int, bool]:
    """
    Newton-Raphson IV with segmented Corrado-Miller → Jaeckel seed and bisection fallback.
    Returns (iv, initial_guess_method, iterations, reliable).
    """
    if t <= 0 or market_price <= 0:
        return 0.0, "degenerate", 0, False

    intrinsic = max(S - K * math.exp(-r * t), 0.0) if option_type == "Call" else max(K * math.exp(-r * t) - S, 0.0)
    if market_price <= intrinsic + 1e-8:
        return 0.0, "at_intrinsic", 0, False

    sigma, guess_method = _segmented_iv_seed(S, K, t, r, market_price, option_type)
    lo, hi = 1e-6, 5.0
    converged = False

    for i in range(1, max_iterations + 1):
        price = bs_price(S, K, t, r, sigma, option_type)
        diff = price - market_price
        if abs(diff) < tolerance:
            converged = True
            return round(sigma, 8), guess_method, i, True

        d1, _ = _d1_d2(S, K, t, r, sigma)
        vega = S * math.sqrt(t) * _norm_pdf(d1)
        if vega > 1e-12:
            step = sigma - diff / vega
            if lo < step < hi:
                if diff > 0:
                    hi = sigma
                else:
                    lo = sigma
                sigma = step
                continue

        if diff > 0:
            hi = sigma
        else:
            lo = sigma
        sigma = (lo + hi) / 2.0
        guess_method = f"{guess_method}_Bisection"

    reliable = converged and 0.01 <= sigma <= 3.0
    return round(sigma, 8), guess_method, max_iterations, reliable


@dataclass
class QuantEngineResult:
    spot_price: float
    black_scholes_theoretical_price: float
    market_bid_ask_mid: float
    market_bid: float | None
    market_ask: float | None
    implied_volatility: dict
    greeks: dict[str, float]
    moneyness: float
    days_to_expiry: int
    time_to_expiry_years: float
    intrinsic_value: float
    iv_reliable: bool
    market_data_source: str
    bid_ask_spread_pct: float | None
    risk_free_rate: float
    data_provenance: dict[str, str] = field(default_factory=dict)


def run_quant_engine(
    *,
    underlying: str,
    strike: float,
    expiration: date,
    option_type: OptionRight,
    market_mid: float | None = None,
    spot_override: float | None = None,
    risk_free_rate: float | None = None,
    as_of: date | None = None,
    use_live_market: bool = True,
    market_context: MarketContext | None = None,
) -> QuantEngineResult:
    ref = as_of or date.today()
    days = (expiration - ref).days
    t = max(days / 365.25, 1 / 365.25)

    ctx = market_context
    if ctx is None and use_live_market and spot_override is None:
        ctx = build_market_context(underlying)
    spot = spot_override if spot_override is not None else (ctx.spot if ctx else 100.0)
    rate = risk_free_rate if risk_free_rate is not None else (ctx.risk_free_rate if ctx else 0.045)

    quote: OptionQuote | None = None
    market_src = "synthetic_default"
    bid = ask = None
    spread_pct = None

    if market_mid is not None:
        mid = market_mid
        market_src = "user_override"
    elif use_live_market:
        quote = fetch_option_quote(underlying, expiration, strike, option_type)
        if quote:
            mid = quote.mid
            bid, ask = quote.bid, quote.ask
            market_src = "live_chain"
            if bid and ask and mid > 0:
                spread_pct = round((ask - bid) / mid * 100, 2)
        else:
            mid = max(spot * 0.02, 0.05)
            market_src = "synthetic_fallback"
    else:
        mid = max(spot * 0.02, 0.05)
        market_src = "synthetic_default"

    iv, guess_method, iters, reliable = implied_volatility_newton(mid, spot, strike, t, rate, option_type)

    # Prefer chain IV when Newton fails but yfinance reports IV
    if (not reliable or iv <= 0) and quote and quote.implied_volatility:
        iv = round(float(quote.implied_volatility), 8)
        guess_method = "Chain_IV_Fallback"
        reliable = True

    sigma_for_greeks = iv if reliable and iv > 0 else 0.0
    theo = bs_price(spot, strike, t, rate, sigma_for_greeks or 0.2, option_type)
    greeks = bs_greeks(spot, strike, t, rate, sigma_for_greeks or 0.2, option_type)

    intrinsic = (
        max(spot - strike * math.exp(-rate * t), 0.0)
        if option_type == "Call"
        else max(strike * math.exp(-rate * t) - spot, 0.0)
    )
    moneyness = round(strike / spot, 4) if spot > 0 else 1.0

    provenance = {
        "spot": ctx.spot_source if ctx and spot_override is None else "override" if spot_override else "fallback",
        "rate": ctx.rate_source if ctx and risk_free_rate is None else "override" if risk_free_rate else "fallback",
        "market_mid": market_src,
    }

    return QuantEngineResult(
        spot_price=round(spot, 4),
        black_scholes_theoretical_price=round(theo, 4),
        market_bid_ask_mid=round(mid, 4),
        market_bid=bid,
        market_ask=ask,
        implied_volatility={
            "value": iv,
            "algorithm": "Newton-Raphson",
            "initial_guess_method": guess_method,
            "convergence_iterations": iters,
            "tolerance_epsilon": 1e-08,
        },
        greeks=greeks,
        moneyness=moneyness,
        days_to_expiry=days,
        time_to_expiry_years=round(t, 6),
        intrinsic_value=round(intrinsic, 4),
        iv_reliable=reliable and iv > 0 and days > 0,
        market_data_source=market_src,
        bid_ask_spread_pct=spread_pct,
        risk_free_rate=rate,
        data_provenance=provenance,
    )
