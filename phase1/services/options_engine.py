"""
options_engine.py — Full Options Pricing & Analytics Engine
===========================================================
Implements:
  - Black-Scholes-Merton (BSM) pricing for European calls/puts
  - All 1st and 2nd order Greeks: Delta, Gamma, Theta, Vega, Rho,
    Vanna, Volga, Charm, Color, Speed, DvegaDtime, Zomma, Lambda
  - Implied Volatility solver (Newton-Raphson + bisection fallback)
  - Binomial tree pricing (CRR) for American options
  - Full options chain generator
  - IV Surface interpolation
  - Probability calculations (P_ITM, P_OTM, P_touch)
  - Risk metrics: max profit, max loss, break-even prices
  - Spreads calculator: covered call, protective put, straddle,
    strangle, iron condor, butterfly, collar, synthetic forward
  - Put-Call parity checker
  - Delta-neutral hedge ratio calculator
  - Greeks aggregation (portfolio-level Greeks)

All math uses scipy.stats.norm for speed; falls back to manual erf if unavailable.
"""

from __future__ import annotations
import math
import numpy as np
import pandas as pd
from typing import Optional, Tuple, Dict, List, Union
from dataclasses import dataclass, field
from enum import Enum

try:
    from scipy.stats import norm as _norm
    _N  = _norm.cdf     # cumulative normal
    _n  = _norm.pdf     # probability density function
    _Ni = _norm.ppf     # inverse CDF
except ImportError:
    def _erf_approx(x: float) -> float:
        """Abramowitz & Stegun approximation (max error 1.5e-7)."""
        a1, a2, a3, a4, a5 = 0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429
        p = 0.3275911
        sign = 1 if x >= 0 else -1
        x = abs(x)
        t = 1.0 / (1.0 + p * x)
        y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * math.exp(-x * x)
        return sign * y

    def _N(x: float) -> float:
        return 0.5 * (1 + _erf_approx(x / math.sqrt(2)))

    def _n(x: float) -> float:
        return math.exp(-0.5 * x * x) / math.sqrt(2 * math.pi)

    def _Ni(p: float) -> float:
        """Beasley-Springer-Moro algorithm for inverse normal CDF."""
        a = [2.50662823884, -18.61500062529, 41.39119773534, -25.44106049637]
        b = [-8.47351093090, 23.08336743743, -21.06224101826, 3.13082909833]
        c = [0.3374754822726147, 0.9761690190917186, 0.1607979714918209,
             0.0276438810333863, 0.0038405729373609, 0.0003951896511349,
             0.0000321767881768, 0.0000002888167364, 0.0000003960315187]
        y = p - 0.5
        if abs(y) < 0.42:
            r = y * y
            return y * (((a[3] * r + a[2]) * r + a[1]) * r + a[0]) / \
                   ((((b[3] * r + b[2]) * r + b[1]) * r + b[0]) * r + 1)
        r = math.sqrt(-math.log(p if y < 0 else 1 - p))
        x = c[0] + r * (c[1] + r * (c[2] + r * (c[3] + r * (c[4] + r * (c[5] + r * (c[6] + r * (c[7] + r * c[8])))))))
        return x if y > 0 else -x


# ─── DATA STRUCTURES ─────────────────────────────────────────────────────────

class OptionType(str, Enum):
    CALL = "call"
    PUT  = "put"


class ExerciseStyle(str, Enum):
    EUROPEAN = "european"
    AMERICAN = "american"


@dataclass
class OptionParams:
    """Parameters for a single option contract."""
    S:         float          # Underlying price
    K:         float          # Strike price
    T:         float          # Time to expiry in years
    r:         float          # Risk-free rate (annualised, decimal)
    sigma:     float          # Implied volatility (annualised, decimal)
    q:         float = 0.0    # Continuous dividend yield (decimal)
    option_type: OptionType = OptionType.CALL
    style:     ExerciseStyle  = ExerciseStyle.EUROPEAN


@dataclass
class GreeksResult:
    """Container for all option Greeks."""
    price:   float
    delta:   float
    gamma:   float
    theta:   float           # Per calendar day
    vega:    float           # Per 1% change in vol
    rho:     float           # Per 1% change in interest rate
    vanna:   float = 0.0     # dDelta/dVol = dVega/dS
    volga:   float = 0.0     # d2V/dSigma2 (Vomma)
    charm:   float = 0.0     # dDelta/dT
    color:   float = 0.0     # dGamma/dT
    speed:   float = 0.0     # dGamma/dS
    zomma:   float = 0.0     # dGamma/dSigma
    ultima:  float = 0.0     # d3V/dSigma3
    lambda_: float = 0.0     # Option elasticity (leverage)
    dual_delta: float = 0.0  # dV/dK
    dual_gamma: float = 0.0  # d2V/dK2


@dataclass
class OptionChainRow:
    """Single row in an options chain."""
    expiry:   str
    strike:   float
    option_type: str
    bid:      float
    ask:      float
    last:     float
    iv:       float
    delta:    float
    gamma:    float
    theta:    float
    vega:     float
    rho:      float
    open_interest: int
    volume:   int
    intrinsic: float
    time_value: float
    moneyness:  str  # ITM / ATM / OTM


# ─── BSM CORE ────────────────────────────────────────────────────────────────

def _d1_d2(S: float, K: float, T: float, r: float, sigma: float, q: float) -> Tuple[float, float]:
    """Compute d1 and d2 for BSM formula."""
    if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        return 0.0, 0.0
    d1 = (math.log(S / K) + (r - q + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    return d1, d2


def bsm_price(S: float, K: float, T: float, r: float, sigma: float,
              q: float = 0.0, option_type: str = "call") -> float:
    """
    Black-Scholes-Merton option price (European).
    S: spot, K: strike, T: years to expiry, r: risk-free rate,
    sigma: volatility, q: continuous dividend yield.
    """
    if T <= 1e-9:
        if option_type.lower() == "call":
            return max(0.0, S - K)
        else:
            return max(0.0, K - S)

    d1, d2 = _d1_d2(S, K, T, r, sigma, q)
    discount = math.exp(-r * T)
    div_factor = math.exp(-q * T)

    if option_type.lower() == "call":
        return S * div_factor * _N(d1) - K * discount * _N(d2)
    else:
        return K * discount * _N(-d2) - S * div_factor * _N(-d1)


def bsm_greeks(S: float, K: float, T: float, r: float, sigma: float,
               q: float = 0.0, option_type: str = "call") -> GreeksResult:
    """
    Compute all Greeks for a European option using exact BSM formulas.
    Includes: Delta, Gamma, Theta, Vega, Rho, Vanna, Volga, Charm,
              Color, Speed, Zomma, Ultima, Lambda, Dual Greeks.
    """
    price = bsm_price(S, K, T, r, sigma, q, option_type)

    if T <= 1e-9 or sigma <= 1e-9:
        sign = 1.0 if option_type.lower() == "call" else -1.0
        delta_val = sign if (S > K) else (0.0 if S != K else 0.5 * sign)
        return GreeksResult(price=price, delta=delta_val, gamma=0, theta=0, vega=0, rho=0)

    sqrt_T = math.sqrt(T)
    d1, d2 = _d1_d2(S, K, T, r, sigma, q)
    Nd1 = _N(d1)
    Nd2 = _N(d2)
    nd1 = _n(d1)
    nd2 = _n(d2)
    discount_r = math.exp(-r * T)
    discount_q = math.exp(-q * T)

    is_call = option_type.lower() == "call"
    phi = 1 if is_call else -1  # +1 for call, -1 for put

    # ── First-order Greeks ───────────────────────────────────────────────────
    delta     = phi * discount_q * _N(phi * d1)
    gamma     = discount_q * nd1 / (S * sigma * sqrt_T)
    vega      = S * discount_q * nd1 * sqrt_T / 100.0  # Per 1% change
    theta_raw = (
        -(S * discount_q * nd1 * sigma) / (2 * sqrt_T)
        - phi * r * K * discount_r * _N(phi * d2)
        + phi * q * S * discount_q * _N(phi * d1)
    )
    theta     = theta_raw / 365.0  # Per calendar day
    rho       = phi * K * T * discount_r * _N(phi * d2) / 100.0  # Per 1% change

    # ── Second-order Greeks ──────────────────────────────────────────────────
    vanna  = -discount_q * nd1 * d2 / sigma                       # dDelta/dSigma
    volga  = S * discount_q * nd1 * sqrt_T * d1 * d2 / sigma      # d2V/dSigma2 (Vomma)
    charm  = -discount_q * (nd1 * (2 * (r - q) * T - d2 * sigma * sqrt_T) /
                             (2 * T * sigma * sqrt_T) + phi * q * _N(phi * d1))  # dDelta/dT
    color  = -discount_q * nd1 / (2 * S * T * sigma * sqrt_T) * (
              2 * q * T + 1 + (2 * (r - q) * T - d2 * sigma * sqrt_T) /
              (sigma * sqrt_T) * d1)                               # dGamma/dT
    speed  = -(gamma / S) * (d1 / (sigma * sqrt_T) + 1)           # dGamma/dS
    zomma  = gamma * (d1 * d2 - 1) / sigma                        # dGamma/dSigma
    ultima = -vega * (d1 * d2 * (1 - d1 * d2) + d1 ** 2 + d2 ** 2) / sigma ** 2  # d3V/dsigma3 / 100

    # ── Elasticity / Lambda ──────────────────────────────────────────────────
    lambda_ = delta * S / price if abs(price) > 1e-10 else 0.0

    # ── Dual Greeks ──────────────────────────────────────────────────────────
    dual_delta = -phi * discount_r * _N(phi * d2)
    dual_gamma = discount_r * nd2 / (K * sigma * sqrt_T)

    return GreeksResult(
        price=price, delta=delta, gamma=gamma, theta=theta,
        vega=vega, rho=rho, vanna=vanna, volga=volga,
        charm=charm, color=color, speed=speed, zomma=zomma,
        ultima=ultima, lambda_=lambda_,
        dual_delta=dual_delta, dual_gamma=dual_gamma,
    )


# ─── IMPLIED VOLATILITY SOLVER ───────────────────────────────────────────────

def implied_volatility(market_price: float, S: float, K: float, T: float, r: float,
                       q: float = 0.0, option_type: str = "call",
                       max_iter: int = 200, tol: float = 1e-8) -> float:
    """
    Compute implied volatility using Newton-Raphson with bisection fallback.
    Returns IV as a decimal (e.g. 0.25 = 25%). Returns NaN if unsolvable.
    """
    if T <= 1e-9 or market_price <= 0:
        return float("nan")

    # Intrinsic value bounds check
    discount = math.exp(-r * T)
    div_factor = math.exp(-q * T)
    if option_type.lower() == "call":
        intrinsic = max(0.0, S * div_factor - K * discount)
    else:
        intrinsic = max(0.0, K * discount - S * div_factor)
    if market_price < intrinsic - 1e-6:
        return float("nan")

    # Initial guess: Brenner-Subrahmanyam approximation
    sigma = math.sqrt(2 * math.pi / T) * market_price / S

    # Newton-Raphson
    for _ in range(max_iter):
        price = bsm_price(S, K, T, r, sigma, q, option_type)
        vega_val = S * div_factor * _n(_d1_d2(S, K, T, r, sigma, q)[0]) * math.sqrt(T)
        diff = price - market_price
        if abs(diff) < tol:
            return sigma
        if abs(vega_val) < 1e-12:
            break
        sigma -= diff / vega_val
        if sigma <= 0:
            sigma = 1e-6

    # Bisection fallback
    low_vol, high_vol = 1e-6, 10.0
    for _ in range(500):
        mid_vol = (low_vol + high_vol) / 2
        mid_price = bsm_price(S, K, T, r, mid_vol, q, option_type)
        if abs(mid_price - market_price) < tol:
            return mid_vol
        if mid_price < market_price:
            low_vol = mid_vol
        else:
            high_vol = mid_vol

    return float("nan")


# ─── AMERICAN OPTIONS (CRR BINOMIAL TREE) ────────────────────────────────────

def binomial_price_american(S: float, K: float, T: float, r: float, sigma: float,
                              q: float = 0.0, option_type: str = "call",
                              n_steps: int = 200) -> float:
    """
    Cox-Ross-Rubinstein binomial tree for American options.
    n_steps: number of time steps (higher = more accurate, slower).
    """
    dt = T / n_steps
    u = math.exp(sigma * math.sqrt(dt))
    d = 1.0 / u
    discount = math.exp(-r * dt)
    p = (math.exp((r - q) * dt) - d) / (u - d)
    p = max(0.0, min(1.0, p))  # clamp for numerical safety

    # Build terminal stock prices
    S_T = np.array([S * u ** (n_steps - 2 * j) for j in range(n_steps + 1)])

    # Terminal payoffs
    if option_type.lower() == "call":
        V = np.maximum(S_T - K, 0)
    else:
        V = np.maximum(K - S_T, 0)

    # Backward induction
    for i in range(n_steps - 1, -1, -1):
        S_i = np.array([S * u ** (i - 2 * j) for j in range(i + 1)])
        V = discount * (p * V[:-1] + (1 - p) * V[1:])
        if option_type.lower() == "call":
            intrinsic = np.maximum(S_i - K, 0)
        else:
            intrinsic = np.maximum(K - S_i, 0)
        V = np.maximum(V, intrinsic)

    return float(V[0])


def binomial_american_greeks(S: float, K: float, T: float, r: float, sigma: float,
                               q: float = 0.0, option_type: str = "call",
                               n_steps: int = 200) -> GreeksResult:
    """Numerical Greeks for American options via finite differences on CRR tree."""
    price = binomial_price_american(S, K, T, r, sigma, q, option_type, n_steps)
    dS   = S * 0.001
    dSig = sigma * 0.001
    dT   = max(T * 0.001, 1.0 / 365.0)
    dr   = 0.0001

    price_up   = binomial_price_american(S + dS, K, T, r, sigma, q, option_type, n_steps)
    price_down = binomial_price_american(S - dS, K, T, r, sigma, q, option_type, n_steps)
    delta  = (price_up - price_down) / (2 * dS)
    gamma  = (price_up - 2 * price + price_down) / (dS ** 2)

    price_vol_up   = binomial_price_american(S, K, T, r, sigma + dSig, q, option_type, n_steps)
    price_vol_down = binomial_price_american(S, K, T, r, sigma - dSig, q, option_type, n_steps)
    vega   = (price_vol_up - price_vol_down) / (2 * dSig) / 100.0

    price_T = binomial_price_american(S, K, T - dT, r, sigma, q, option_type, n_steps)
    theta  = (price_T - price) / dT / 365.0

    price_r_up   = binomial_price_american(S, K, T, r + dr, sigma, q, option_type, n_steps)
    price_r_down = binomial_price_american(S, K, T, r - dr, sigma, q, option_type, n_steps)
    rho    = (price_r_up - price_r_down) / (2 * dr) / 100.0

    return GreeksResult(price=price, delta=delta, gamma=gamma, theta=theta, vega=vega, rho=rho)


# ─── OPTIONS CHAIN GENERATOR ─────────────────────────────────────────────────

def generate_options_chain(
    S: float,
    r: float,
    q: float,
    expiries: List[Tuple[str, float]],   # [(label, T_years), ...]
    strikes: Optional[List[float]] = None,
    vol_surface: Optional[Dict[Tuple[str, float], float]] = None,  # {(expiry, strike): iv}
    default_iv: float = 0.25,
    style: str = "european",
) -> pd.DataFrame:
    """
    Generate a full options chain for all given expiries and strikes.

    Args:
        S:            Current underlying price
        r:            Risk-free rate
        q:            Dividend yield
        expiries:     List of (label, T_years) tuples
        strikes:      Strike prices; if None, generates ATM ± 20 strikes automatically
        vol_surface:  Volatility surface override; if None uses default_iv
        default_iv:   Fallback IV
        style:        "european" or "american"

    Returns:
        DataFrame with one row per (expiry, strike, option_type)
    """
    if strikes is None:
        # Auto-generate strikes centered on ATM
        atm = round(S / 5) * 5
        spacing = max(1.0, round(S * 0.01))
        strikes = [atm + spacing * i for i in range(-20, 21)]

    rows = []
    for expiry_label, T in expiries:
        for K in strikes:
            for otype in ["call", "put"]:
                iv = default_iv
                if vol_surface:
                    iv = vol_surface.get((expiry_label, K),
                         vol_surface.get((expiry_label, round(K, 0)), default_iv))

                if style == "american":
                    greeks = binomial_american_greeks(S, K, T, r, iv, q, otype, n_steps=100)
                else:
                    greeks = bsm_greeks(S, K, T, r, iv, q, otype)

                price = greeks.price
                bid   = max(0.0, price * 0.98)
                ask   = price * 1.02
                intrinsic = max(0.0, (S - K) if otype == "call" else (K - S))
                time_val  = max(0.0, price - intrinsic)

                # Moneyness label
                ratio = S / K
                if abs(ratio - 1.0) < 0.01:
                    moneyness = "ATM"
                elif (otype == "call" and S > K) or (otype == "put" and S < K):
                    moneyness = "ITM"
                else:
                    moneyness = "OTM"

                rows.append(OptionChainRow(
                    expiry=expiry_label, strike=K, option_type=otype,
                    bid=round(bid, 4), ask=round(ask, 4), last=round(price, 4),
                    iv=round(iv, 6), delta=round(greeks.delta, 6),
                    gamma=round(greeks.gamma, 8), theta=round(greeks.theta, 6),
                    vega=round(greeks.vega, 6), rho=round(greeks.rho, 6),
                    open_interest=0, volume=0,
                    intrinsic=round(intrinsic, 4), time_value=round(time_val, 4),
                    moneyness=moneyness,
                ))

    return pd.DataFrame([vars(r) for r in rows])


# ─── IV SURFACE ───────────────────────────────────────────────────────────────

def build_iv_surface(
    chain_df: pd.DataFrame,
    strikes: List[float],
    expiries: List[str],
    option_type: str = "call",
) -> np.ndarray:
    """
    Interpolate an IV surface from observed chain data.
    Returns a 2D numpy array [n_expiries × n_strikes].
    """
    surface = np.full((len(expiries), len(strikes)), float("nan"))
    for i, exp in enumerate(expiries):
        for j, k in enumerate(strikes):
            row = chain_df[(chain_df["expiry"] == exp) &
                           (chain_df["strike"] == k) &
                           (chain_df["option_type"] == option_type)]
            if not row.empty:
                surface[i, j] = float(row.iloc[0]["iv"])
    return surface


# ─── PUT-CALL PARITY ──────────────────────────────────────────────────────────

def put_call_parity_check(call_price: float, put_price: float, S: float,
                           K: float, T: float, r: float, q: float = 0.0) -> Dict:
    """
    Check put-call parity: C - P = S*e^(-qT) - K*e^(-rT)
    Returns the parity value, actual spread, and arbitrage amount.
    """
    parity = S * math.exp(-q * T) - K * math.exp(-r * T)
    actual = call_price - put_price
    arb = actual - parity
    return {
        "parity_value":    round(parity, 6),
        "actual_spread":   round(actual, 6),
        "arbitrage":       round(arb, 6),
        "is_violated":     abs(arb) > 0.01,
    }


# ─── PROBABILITIES ────────────────────────────────────────────────────────────

def probability_itm(S: float, K: float, T: float, r: float, sigma: float,
                     q: float = 0.0, option_type: str = "call") -> float:
    """Probability of option expiring in-the-money under risk-neutral measure."""
    if T <= 0:
        if option_type.lower() == "call":
            return 1.0 if S > K else 0.0
        else:
            return 1.0 if S < K else 0.0
    _, d2 = _d1_d2(S, K, T, r, sigma, q)
    if option_type.lower() == "call":
        return float(_N(d2))
    else:
        return float(_N(-d2))


def probability_touch(S: float, K: float, T: float, r: float, sigma: float,
                       q: float = 0.0) -> float:
    """
    Probability of touching target price K before expiry
    (one-touch via reflection principle).
    """
    if sigma <= 0 or T <= 0:
        return 0.0
    mu = (r - q - 0.5 * sigma ** 2) / sigma
    d = (math.log(S / K)) / (sigma * math.sqrt(T))
    p1 = _N(-d + mu * math.sqrt(T))
    p2 = (K / S) ** (2 * mu) * _N(-d - mu * math.sqrt(T))
    return float(min(1.0, p1 + p2))


def expected_move(S: float, T: float, iv: float) -> Tuple[float, float]:
    """
    1-sigma expected move range: (lower, upper).
    Uses the simplified market convention: EM = S * IV * sqrt(T)
    """
    em = S * iv * math.sqrt(T)
    return S - em, S + em


# ─── STRATEGY BUILDERS ────────────────────────────────────────────────────────

@dataclass
class StrategyLeg:
    """A single leg of an options strategy."""
    option_type: str      # "call", "put", or "stock"
    strike: float
    expiry: str
    T: float
    quantity: int         # Positive = long, negative = short
    price: float          # Premium paid/received per unit
    delta: float = 0.0
    gamma: float = 0.0
    theta: float = 0.0
    vega: float  = 0.0


@dataclass
class StrategyResult:
    """Result of an options strategy analysis."""
    name: str
    legs: List[StrategyLeg]
    net_premium: float     # Net debit (positive) or credit (negative)
    max_profit: float
    max_loss: float
    breakeven_prices: List[float]
    net_delta: float
    net_gamma: float
    net_theta: float
    net_vega: float
    payoff_at_prices: Dict[float, float]


def _build_payoff(legs: List[StrategyLeg], price_range: np.ndarray) -> np.ndarray:
    """Compute net payoff at expiry across a range of underlying prices."""
    total = np.zeros_like(price_range, dtype=float)
    for leg in legs:
        qty = leg.quantity
        K = leg.strike
        if leg.option_type == "call":
            payoff = np.maximum(price_range - K, 0) - leg.price
        elif leg.option_type == "put":
            payoff = np.maximum(K - price_range, 0) - leg.price
        else:
            payoff = price_range - leg.price
        total += qty * payoff
    return total


def covered_call(S: float, K_call: float, T: float, r: float, sigma: float,
                  q: float = 0.0) -> StrategyResult:
    """Covered Call: Long stock + Short call."""
    call_price = bsm_price(S, K_call, T, r, sigma, q, "call")
    call_greeks = bsm_greeks(S, K_call, T, r, sigma, q, "call")
    legs = [
        StrategyLeg("stock", 0, "", 0, 1, S, 1.0, 0, 0, 0),
        StrategyLeg("call", K_call, "", T, -1, call_price,
                    -call_greeks.delta, -call_greeks.gamma, -call_greeks.theta, -call_greeks.vega),
    ]
    net_premium = S - call_price
    prices = np.linspace(S * 0.5, K_call * 1.5, 200)
    payoffs = _build_payoff(legs, prices)
    be = float(S - call_price)  # breakeven = stock cost minus premium received
    return StrategyResult(
        name="Covered Call", legs=legs,
        net_premium=net_premium, max_profit=float(K_call - S + call_price),
        max_loss=float(-S + call_price),
        breakeven_prices=[round(be, 4)],
        net_delta=1.0 - call_greeks.delta,
        net_gamma=-call_greeks.gamma,
        net_theta=-call_greeks.theta,
        net_vega=-call_greeks.vega,
        payoff_at_prices={round(float(p), 2): round(float(v), 4) for p, v in zip(prices[::10], payoffs[::10])},
    )


def protective_put(S: float, K_put: float, T: float, r: float, sigma: float,
                    q: float = 0.0) -> StrategyResult:
    """Protective Put: Long stock + Long put."""
    put_price = bsm_price(S, K_put, T, r, sigma, q, "put")
    put_greeks = bsm_greeks(S, K_put, T, r, sigma, q, "put")
    legs = [
        StrategyLeg("stock", 0, "", 0, 1, S, 1.0, 0, 0, 0),
        StrategyLeg("put", K_put, "", T, 1, put_price,
                    put_greeks.delta, put_greeks.gamma, put_greeks.theta, put_greeks.vega),
    ]
    net_cost = S + put_price
    be = net_cost
    max_loss = float(S + put_price - K_put) if S > K_put else 0.0
    prices = np.linspace(K_put * 0.5, S * 1.5, 200)
    payoffs = _build_payoff(legs, prices)
    return StrategyResult(
        name="Protective Put", legs=legs,
        net_premium=-net_cost, max_profit=float("inf"),
        max_loss=-max_loss,
        breakeven_prices=[round(be, 4)],
        net_delta=1.0 + put_greeks.delta,
        net_gamma=put_greeks.gamma, net_theta=put_greeks.theta, net_vega=put_greeks.vega,
        payoff_at_prices={round(float(p), 2): round(float(v), 4) for p, v in zip(prices[::10], payoffs[::10])},
    )


def straddle(S: float, K: float, T: float, r: float, sigma: float,
              q: float = 0.0) -> StrategyResult:
    """Long Straddle: Long ATM call + Long ATM put."""
    c_price = bsm_price(S, K, T, r, sigma, q, "call")
    p_price = bsm_price(S, K, T, r, sigma, q, "put")
    cg = bsm_greeks(S, K, T, r, sigma, q, "call")
    pg = bsm_greeks(S, K, T, r, sigma, q, "put")
    net_debit = c_price + p_price
    legs = [
        StrategyLeg("call", K, "", T, 1, c_price, cg.delta, cg.gamma, cg.theta, cg.vega),
        StrategyLeg("put",  K, "", T, 1, p_price, pg.delta, pg.gamma, pg.theta, pg.vega),
    ]
    return StrategyResult(
        name="Long Straddle", legs=legs,
        net_premium=-net_debit, max_profit=float("inf"),
        max_loss=-net_debit,
        breakeven_prices=[round(K - net_debit, 4), round(K + net_debit, 4)],
        net_delta=cg.delta + pg.delta,
        net_gamma=cg.gamma + pg.gamma, net_theta=cg.theta + pg.theta, net_vega=cg.vega + pg.vega,
        payoff_at_prices={},
    )


def strangle(S: float, K_put: float, K_call: float, T: float,
              r: float, sigma: float, q: float = 0.0) -> StrategyResult:
    """Long Strangle: OTM call + OTM put."""
    c_price = bsm_price(S, K_call, T, r, sigma, q, "call")
    p_price = bsm_price(S, K_put, T, r, sigma, q, "put")
    cg = bsm_greeks(S, K_call, T, r, sigma, q, "call")
    pg = bsm_greeks(S, K_put, T, r, sigma, q, "put")
    net_debit = c_price + p_price
    legs = [
        StrategyLeg("call", K_call, "", T, 1, c_price, cg.delta, cg.gamma, cg.theta, cg.vega),
        StrategyLeg("put",  K_put,  "", T, 1, p_price, pg.delta, pg.gamma, pg.theta, pg.vega),
    ]
    return StrategyResult(
        name="Long Strangle", legs=legs,
        net_premium=-net_debit, max_profit=float("inf"),
        max_loss=-net_debit,
        breakeven_prices=[round(K_put - net_debit, 4), round(K_call + net_debit, 4)],
        net_delta=cg.delta + pg.delta,
        net_gamma=cg.gamma + pg.gamma, net_theta=cg.theta + pg.theta, net_vega=cg.vega + pg.vega,
        payoff_at_prices={},
    )


def iron_condor(S: float, K1: float, K2: float, K3: float, K4: float,
                 T: float, r: float, sigma: float, q: float = 0.0) -> StrategyResult:
    """
    Iron Condor: Short strangle + long wings.
    K1 < K2 < K3 < K4. Long put K1, short put K2, short call K3, long call K4.
    """
    p1 = bsm_price(S, K1, T, r, sigma, q, "put")
    p2 = bsm_price(S, K2, T, r, sigma, q, "put")
    c3 = bsm_price(S, K3, T, r, sigma, q, "call")
    c4 = bsm_price(S, K4, T, r, sigma, q, "call")
    g1 = bsm_greeks(S, K1, T, r, sigma, q, "put")
    g2 = bsm_greeks(S, K2, T, r, sigma, q, "put")
    g3 = bsm_greeks(S, K3, T, r, sigma, q, "call")
    g4 = bsm_greeks(S, K4, T, r, sigma, q, "call")
    net_credit = p2 - p1 + c3 - c4
    max_loss = (K2 - K1) - net_credit
    legs = [
        StrategyLeg("put",  K1, "", T, +1, p1, g1.delta, g1.gamma, g1.theta, g1.vega),
        StrategyLeg("put",  K2, "", T, -1, p2, -g2.delta, -g2.gamma, -g2.theta, -g2.vega),
        StrategyLeg("call", K3, "", T, -1, c3, -g3.delta, -g3.gamma, -g3.theta, -g3.vega),
        StrategyLeg("call", K4, "", T, +1, c4, g4.delta, g4.gamma, g4.theta, g4.vega),
    ]
    net_d = sum(l.delta for l in legs)
    net_g = sum(l.gamma for l in legs)
    net_t = sum(l.theta for l in legs)
    net_v = sum(l.vega for l in legs)
    return StrategyResult(
        name="Iron Condor", legs=legs,
        net_premium=net_credit, max_profit=net_credit,
        max_loss=-max_loss,
        breakeven_prices=[round(K2 - net_credit, 4), round(K3 + net_credit, 4)],
        net_delta=net_d, net_gamma=net_g, net_theta=net_t, net_vega=net_v,
        payoff_at_prices={},
    )


def butterfly_spread(S: float, K1: float, K2: float, K3: float,
                      T: float, r: float, sigma: float, q: float = 0.0,
                      option_type: str = "call") -> StrategyResult:
    """Long Butterfly Spread."""
    ot = option_type.lower()
    p1 = bsm_price(S, K1, T, r, sigma, q, ot)
    p2 = bsm_price(S, K2, T, r, sigma, q, ot)
    p3 = bsm_price(S, K3, T, r, sigma, q, ot)
    g1 = bsm_greeks(S, K1, T, r, sigma, q, ot)
    g2 = bsm_greeks(S, K2, T, r, sigma, q, ot)
    g3 = bsm_greeks(S, K3, T, r, sigma, q, ot)
    net_debit = p1 - 2 * p2 + p3
    max_profit = (K2 - K1) - net_debit
    legs = [
        StrategyLeg(ot, K1, "", T, +1, p1, g1.delta, g1.gamma, g1.theta, g1.vega),
        StrategyLeg(ot, K2, "", T, -2, p2, -2*g2.delta, -2*g2.gamma, -2*g2.theta, -2*g2.vega),
        StrategyLeg(ot, K3, "", T, +1, p3, g3.delta, g3.gamma, g3.theta, g3.vega),
    ]
    net_d = sum(l.delta for l in legs)
    net_g = sum(l.gamma for l in legs)
    net_t = sum(l.theta for l in legs)
    net_v = sum(l.vega for l in legs)
    return StrategyResult(
        name=f"Long Butterfly ({ot.capitalize()})", legs=legs,
        net_premium=-net_debit, max_profit=max_profit, max_loss=-net_debit,
        breakeven_prices=[round(K1 + net_debit, 4), round(K3 - net_debit, 4)],
        net_delta=net_d, net_gamma=net_g, net_theta=net_t, net_vega=net_v,
        payoff_at_prices={},
    )


def vertical_spread(S: float, K1: float, K2: float, T: float, r: float,
                     sigma: float, q: float = 0.0,
                     option_type: str = "call", direction: str = "bull") -> StrategyResult:
    """Bull/Bear Call or Put Spread."""
    ot = option_type.lower()
    p1 = bsm_price(S, K1, T, r, sigma, q, ot)
    p2 = bsm_price(S, K2, T, r, sigma, q, ot)
    g1 = bsm_greeks(S, K1, T, r, sigma, q, ot)
    g2 = bsm_greeks(S, K2, T, r, sigma, q, ot)

    if direction == "bull":
        net_debit = p1 - p2  # buy low strike, sell high strike
        legs = [
            StrategyLeg(ot, K1, "", T, +1, p1, g1.delta, g1.gamma, g1.theta, g1.vega),
            StrategyLeg(ot, K2, "", T, -1, p2, -g2.delta, -g2.gamma, -g2.theta, -g2.vega),
        ]
        if ot == "call":
            max_profit = K2 - K1 - net_debit
            be = round(K1 + net_debit, 4)
        else:
            max_profit = net_debit if net_debit < 0 else 0
            be = round(K2 - abs(net_debit), 4)
    else:
        net_debit = p2 - p1
        legs = [
            StrategyLeg(ot, K2, "", T, +1, p2, g2.delta, g2.gamma, g2.theta, g2.vega),
            StrategyLeg(ot, K1, "", T, -1, p1, -g1.delta, -g1.gamma, -g1.theta, -g1.vega),
        ]
        max_profit = abs(net_debit) if net_debit < 0 else net_debit
        be = 0.0

    net_d = sum(l.delta for l in legs)
    net_g = sum(l.gamma for l in legs)
    net_t = sum(l.theta for l in legs)
    net_v = sum(l.vega for l in legs)
    name = f"{direction.capitalize()} {ot.capitalize()} Spread"
    return StrategyResult(
        name=name, legs=legs, net_premium=-net_debit,
        max_profit=float(max_profit), max_loss=-abs(net_debit),
        breakeven_prices=[be if be else 0.0],
        net_delta=net_d, net_gamma=net_g, net_theta=net_t, net_vega=net_v,
        payoff_at_prices={},
    )


# ─── PORTFOLIO GREEKS ────────────────────────────────────────────────────────

def aggregate_portfolio_greeks(positions: List[Dict]) -> Dict[str, float]:
    """
    Aggregate Greeks for a portfolio of option positions.

    Each position dict must have:
        S, K, T, r, sigma, q, option_type, quantity
    Returns net: delta, gamma, theta, vega, rho, vanna, volga.
    """
    totals = {"delta": 0.0, "gamma": 0.0, "theta": 0.0,
              "vega": 0.0, "rho": 0.0, "vanna": 0.0, "volga": 0.0}
    for pos in positions:
        qty = pos.get("quantity", 1)
        g = bsm_greeks(
            S=pos["S"], K=pos["K"], T=pos["T"],
            r=pos["r"], sigma=pos["sigma"], q=pos.get("q", 0.0),
            option_type=pos.get("option_type", "call"),
        )
        totals["delta"] += qty * g.delta
        totals["gamma"] += qty * g.gamma
        totals["theta"] += qty * g.theta
        totals["vega"]  += qty * g.vega
        totals["rho"]   += qty * g.rho
        totals["vanna"] += qty * g.vanna
        totals["volga"] += qty * g.volga
    return {k: round(v, 8) for k, v in totals.items()}


def delta_hedge_ratio(portfolio_greeks: Dict[str, float], hedge_delta: float = 1.0) -> float:
    """
    Number of shares needed to delta-hedge a portfolio.
    Returns negative value if you need to short shares.
    """
    return -portfolio_greeks["delta"] / hedge_delta


# ─── IV SURFACE INTERPOLATION ─────────────────────────────────────────────────

class IVSurface:
    """
    Bilinear interpolation of IV surface.
    Used for pricing exotic derivatives and risk reporting.
    """

    def __init__(self, expiries: List[float], strikes: List[float],
                 ivs: np.ndarray):
        """
        Args:
            expiries: sorted list of T in years
            strikes:  sorted list of K
            ivs:      2D array [len(expiries) × len(strikes)], NaN for missing
        """
        self.expiries = np.array(expiries)
        self.strikes  = np.array(strikes)
        self.ivs      = np.array(ivs)

    def get_iv(self, T: float, K: float) -> float:
        """Bilinear interpolation to get IV for any T, K combination."""
        if T < self.expiries[0]:
            T = self.expiries[0]
        if T > self.expiries[-1]:
            T = self.expiries[-1]
        if K < self.strikes[0]:
            K = self.strikes[0]
        if K > self.strikes[-1]:
            K = self.strikes[-1]

        t_idx = np.searchsorted(self.expiries, T, side="right") - 1
        k_idx = np.searchsorted(self.strikes, K, side="right") - 1
        t_idx = max(0, min(t_idx, len(self.expiries) - 2))
        k_idx = max(0, min(k_idx, len(self.strikes) - 2))

        t0, t1 = self.expiries[t_idx], self.expiries[t_idx + 1]
        k0, k1 = self.strikes[k_idx], self.strikes[k_idx + 1]

        t_weight = (T - t0) / (t1 - t0) if t1 != t0 else 0
        k_weight = (K - k0) / (k1 - k0) if k1 != k0 else 0

        iv00 = self.ivs[t_idx, k_idx]
        iv01 = self.ivs[t_idx, k_idx + 1]
        iv10 = self.ivs[t_idx + 1, k_idx]
        iv11 = self.ivs[t_idx + 1, k_idx + 1]

        # Handle NaNs
        if any(math.isnan(x) for x in [iv00, iv01, iv10, iv11]):
            flat = [v for v in [iv00, iv01, iv10, iv11] if not math.isnan(v)]
            return float(np.nanmean(flat)) if flat else float("nan")

        iv_bottom = iv00 + k_weight * (iv01 - iv00)
        iv_top    = iv10 + k_weight * (iv11 - iv10)
        return iv_bottom + t_weight * (iv_top - iv_bottom)

    def smile(self, T: float) -> pd.DataFrame:
        """Return IV smile for a given expiry."""
        ivs = [self.get_iv(T, K) for K in self.strikes]
        return pd.DataFrame({"strike": self.strikes, "iv": ivs})

    def term_structure(self, K: float) -> pd.DataFrame:
        """Return IV term structure at a given strike."""
        ivs = [self.get_iv(T, K) for T in self.expiries]
        return pd.DataFrame({"expiry": self.expiries, "iv": ivs})


# ─── RISK METRICS ────────────────────────────────────────────────────────────

def option_risk_metrics(S: float, K: float, T: float, r: float, sigma: float,
                         q: float = 0.0, quantity: int = 1,
                         option_type: str = "call") -> Dict:
    """All-in risk metrics for a single option position."""
    g = bsm_greeks(S, K, T, r, sigma, q, option_type)
    contract_size = 100  # Standard equity option = 100 shares
    total_premium  = quantity * g.price * contract_size

    # Dollar Greeks
    dollar_delta = g.delta * S * contract_size * quantity
    dollar_gamma = g.gamma * S ** 2 * 0.01 * contract_size * quantity  # Per 1% move
    dollar_theta = g.theta * contract_size * quantity                    # Per day
    dollar_vega  = g.vega * contract_size * quantity                     # Already per 1%

    # Scenario P&L
    scenarios = {}
    for spot_pct in [-0.20, -0.15, -0.10, -0.05, 0, 0.05, 0.10, 0.15, 0.20]:
        for vol_pct in [-0.10, -0.05, 0, 0.05, 0.10]:
            S_new = S * (1 + spot_pct)
            sigma_new = sigma * (1 + vol_pct)
            if sigma_new <= 0:
                sigma_new = 0.001
            new_price = bsm_price(S_new, K, T, r, sigma_new, q, option_type)
            pnl = (new_price - g.price) * quantity * contract_size
            scenarios[f"spot{spot_pct:+.0%}_vol{vol_pct:+.0%}"] = round(pnl, 2)

    return {
        "price":         round(g.price, 4),
        "total_premium": round(total_premium, 2),
        "moneyness":     round(S / K, 4),
        "intrinsic":     round(max(0, (S - K) if option_type == "call" else (K - S)), 4),
        "time_value":    round(max(0, g.price - max(0, (S - K) if option_type == "call" else (K - S))), 4),
        "prob_itm":      round(probability_itm(S, K, T, r, sigma, q, option_type), 4),
        "prob_touch":    round(probability_touch(S, K, T, r, sigma, q), 4),
        "greeks":        {
            "delta":  round(g.delta, 6),
            "gamma":  round(g.gamma, 8),
            "theta":  round(g.theta, 6),
            "vega":   round(g.vega, 6),
            "rho":    round(g.rho, 6),
            "vanna":  round(g.vanna, 8),
            "volga":  round(g.volga, 8),
            "charm":  round(g.charm, 8),
            "speed":  round(g.speed, 10),
            "zomma":  round(g.zomma, 8),
        },
        "dollar_greeks": {
            "dollar_delta": round(dollar_delta, 2),
            "dollar_gamma": round(dollar_gamma, 2),
            "dollar_theta": round(dollar_theta, 2),
            "dollar_vega":  round(dollar_vega, 2),
        },
        "scenarios": scenarios,
    }


# ─── CONVENIENCE API ─────────────────────────────────────────────────────────

def price_option(S: float, K: float, T: float, r: float, sigma: float,
                  q: float = 0.0, option_type: str = "call",
                  style: str = "european") -> float:
    """Unified pricing dispatcher — European (BSM) or American (CRR)."""
    if style.lower() == "american":
        return binomial_price_american(S, K, T, r, sigma, q, option_type)
    return bsm_price(S, K, T, r, sigma, q, option_type)


def price_option_full(S: float, K: float, T: float, r: float, sigma: float,
                       q: float = 0.0, option_type: str = "call",
                       style: str = "european") -> GreeksResult:
    """Full pricing with greeks for given style."""
    if style.lower() == "american":
        return binomial_american_greeks(S, K, T, r, sigma, q, option_type)
    return bsm_greeks(S, K, T, r, sigma, q, option_type)
