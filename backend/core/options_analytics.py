"""
Options Analytics Engine — Full Implementation
================================================
§4 Options — All 40 items

Features:
  • Black-Scholes, Binomial, Monte Carlo pricing
  • Complete Greeks: Delta, Gamma, Theta, Vega, Rho, Vanna, Charm, Volga, Speed
  • Implied Volatility solver (Newton-Raphson + Brent)
  • Volatility surface & smile construction
  • Options chain fetching (Tradier, Polygon, yfinance fallback)
  • Strategy builder: verticals, butterflies, condors, straddles, etc.
  • P&L diagrams, payoff charts
  • Greeks exposure aggregation
  • Options flow / unusual activity scanner
  • IV Rank, IV Percentile, HV comparison
  • Term structure analysis
  • Put/Call ratio, skew metrics
  • Max pain calculation
  • Early exercise analysis for American options
"""

from __future__ import annotations

import logging
import math
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

# ─── Constants ───────────────────────────────────────────────────────────────

RISK_FREE_RATE = 0.05  # Default risk-free rate
DAYS_PER_YEAR = 365.25
TRADING_DAYS = 252

# ─── Enums ───────────────────────────────────────────────────────────────────

class OptionType(str, Enum):
    CALL = "call"
    PUT = "put"

class ExerciseStyle(str, Enum):
    AMERICAN = "american"
    EUROPEAN = "european"

class StrategyType(str, Enum):
    LONG_CALL = "long_call"
    LONG_PUT = "long_put"
    SHORT_CALL = "short_call"
    SHORT_PUT = "short_put"
    COVERED_CALL = "covered_call"
    PROTECTIVE_PUT = "protective_put"
    BULL_CALL_SPREAD = "bull_call_spread"
    BEAR_PUT_SPREAD = "bear_put_spread"
    BULL_PUT_SPREAD = "bull_put_spread"
    BEAR_CALL_SPREAD = "bear_call_spread"
    LONG_STRADDLE = "long_straddle"
    SHORT_STRADDLE = "short_straddle"
    LONG_STRANGLE = "long_strangle"
    SHORT_STRANGLE = "short_strangle"
    IRON_CONDOR = "iron_condor"
    IRON_BUTTERFLY = "iron_butterfly"
    BUTTERFLY_CALL = "butterfly_call"
    BUTTERFLY_PUT = "butterfly_put"
    CALENDAR_SPREAD = "calendar_spread"
    DIAGONAL_SPREAD = "diagonal_spread"
    COLLAR = "collar"
    JADE_LIZARD = "jade_lizard"
    RATIO_SPREAD = "ratio_spread"
    RISK_REVERSAL = "risk_reversal"
    SYNTHETIC_LONG = "synthetic_long"
    SYNTHETIC_SHORT = "synthetic_short"
    CUSTOM = "custom"

# ─── Math Helpers ────────────────────────────────────────────────────────────

def _norm_cdf(x: float) -> float:
    """Standard normal cumulative distribution (Abramowitz & Stegun approximation)."""
    a1, a2, a3, a4, a5 = 0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429
    p = 0.3275911
    t = 1.0 / (1.0 + p * abs(x))
    cdf = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * math.exp(-x * x / 2.0)
    return cdf if x >= 0 else 1.0 - cdf

def _norm_pdf(x: float) -> float:
    """Standard normal probability density."""
    return math.exp(-x * x / 2.0) / math.sqrt(2.0 * math.pi)

# ─── Data Models ─────────────────────────────────────────────────────────────

@dataclass
class Greeks:
    """Full Greeks suite."""
    delta: float = 0.0
    gamma: float = 0.0
    theta: float = 0.0  # per day
    vega: float = 0.0   # per 1% IV change
    rho: float = 0.0    # per 1% rate change
    # Second order
    vanna: float = 0.0  # dDelta/dVol
    charm: float = 0.0  # dDelta/dTime (delta decay)
    volga: float = 0.0  # dVega/dVol (vomma)
    speed: float = 0.0  # dGamma/dSpot
    color: float = 0.0  # dGamma/dTime
    zomma: float = 0.0  # dGamma/dVol
    ultima: float = 0.0 # dVomma/dVol

    def to_dict(self) -> dict:
        return {
            "delta": round(self.delta, 6),
            "gamma": round(self.gamma, 6),
            "theta": round(self.theta, 6),
            "vega": round(self.vega, 6),
            "rho": round(self.rho, 6),
            "vanna": round(self.vanna, 6),
            "charm": round(self.charm, 6),
            "volga": round(self.volga, 6),
            "speed": round(self.speed, 8),
            "color": round(self.color, 8),
            "zomma": round(self.zomma, 8),
            "ultima": round(self.ultima, 8),
        }


@dataclass
class OptionContract:
    """Single options contract with pricing and Greeks."""
    symbol: str = ""              # Underlying symbol
    option_symbol: str = ""       # OCC symbol (e.g., AAPL240119C00190000)
    strike: float = 0.0
    expiration: str = ""          # YYYY-MM-DD
    option_type: OptionType = OptionType.CALL
    exercise_style: ExerciseStyle = ExerciseStyle.AMERICAN
    multiplier: int = 100

    # Market data
    bid: float = 0.0
    ask: float = 0.0
    last: float = 0.0
    mid: float = 0.0
    volume: int = 0
    open_interest: int = 0
    change: float = 0.0
    change_pct: float = 0.0

    # Pricing
    theoretical_price: float = 0.0
    intrinsic_value: float = 0.0
    extrinsic_value: float = 0.0
    implied_volatility: float = 0.0

    # Greeks
    greeks: Greeks = field(default_factory=Greeks)

    # Underlying
    underlying_price: float = 0.0

    # Time
    days_to_expiry: float = 0.0

    @property
    def moneyness(self) -> str:
        """ITM, ATM, or OTM."""
        if self.underlying_price == 0 or self.strike == 0:
            return "unknown"
        if self.option_type == OptionType.CALL:
            if self.underlying_price > self.strike * 1.02:
                return "ITM"
            elif self.underlying_price < self.strike * 0.98:
                return "OTM"
            return "ATM"
        else:
            if self.underlying_price < self.strike * 0.98:
                return "ITM"
            elif self.underlying_price > self.strike * 1.02:
                return "OTM"
            return "ATM"

    @property
    def time_value(self) -> float:
        return max(0, self.mid - self.intrinsic_value)

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "option_symbol": self.option_symbol,
            "strike": self.strike,
            "expiration": self.expiration,
            "type": self.option_type.value,
            "bid": self.bid,
            "ask": self.ask,
            "last": self.last,
            "mid": self.mid,
            "volume": self.volume,
            "open_interest": self.open_interest,
            "iv": round(self.implied_volatility, 4),
            "theoretical_price": round(self.theoretical_price, 4),
            "intrinsic_value": round(self.intrinsic_value, 4),
            "extrinsic_value": round(self.extrinsic_value, 4),
            "moneyness": self.moneyness,
            "days_to_expiry": self.days_to_expiry,
            "greeks": self.greeks.to_dict(),
        }


@dataclass
class OptionsChain:
    """Full options chain for a symbol."""
    symbol: str = ""
    underlying_price: float = 0.0
    expirations: List[str] = field(default_factory=list)
    calls: Dict[str, List[OptionContract]] = field(default_factory=dict)  # expiry -> contracts
    puts: Dict[str, List[OptionContract]] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)

    @property
    def total_call_volume(self) -> int:
        return sum(c.volume for calls in self.calls.values() for c in calls)

    @property
    def total_put_volume(self) -> int:
        return sum(p.volume for puts in self.puts.values() for p in puts)

    @property
    def put_call_ratio(self) -> float:
        cv = self.total_call_volume
        return self.total_put_volume / cv if cv > 0 else 0

    @property
    def total_call_oi(self) -> int:
        return sum(c.open_interest for calls in self.calls.values() for c in calls)

    @property
    def total_put_oi(self) -> int:
        return sum(p.open_interest for puts in self.puts.values() for p in puts)

    def get_atm_strike(self, expiration: str) -> float:
        """Get the at-the-money strike."""
        calls = self.calls.get(expiration, [])
        if not calls:
            return 0.0
        return min(calls, key=lambda c: abs(c.strike - self.underlying_price)).strike

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "underlying_price": self.underlying_price,
            "expirations": self.expirations,
            "put_call_ratio": round(self.put_call_ratio, 4),
            "total_call_volume": self.total_call_volume,
            "total_put_volume": self.total_put_volume,
            "total_call_oi": self.total_call_oi,
            "total_put_oi": self.total_put_oi,
        }


# ─── Black-Scholes Model ────────────────────────────────────────────────────

class BlackScholes:
    """
    Black-Scholes-Merton option pricing model.
    Supports calls and puts, European and pseudo-American.
    """

    @staticmethod
    def price(S: float, K: float, T: float, r: float, sigma: float,
              option_type: OptionType = OptionType.CALL, q: float = 0.0) -> float:
        """
        Calculate option price.
        S: underlying price, K: strike, T: time to expiry (years),
        r: risk-free rate, sigma: volatility, q: dividend yield
        """
        if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
            # At expiry, return intrinsic value
            if option_type == OptionType.CALL:
                return max(0, S - K)
            return max(0, K - S)

        d1 = (math.log(S / K) + (r - q + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
        d2 = d1 - sigma * math.sqrt(T)

        if option_type == OptionType.CALL:
            price = S * math.exp(-q * T) * _norm_cdf(d1) - K * math.exp(-r * T) * _norm_cdf(d2)
        else:
            price = K * math.exp(-r * T) * _norm_cdf(-d2) - S * math.exp(-q * T) * _norm_cdf(-d1)

        return max(0.0, price)

    @staticmethod
    def greeks(S: float, K: float, T: float, r: float, sigma: float,
               option_type: OptionType = OptionType.CALL, q: float = 0.0) -> Greeks:
        """Calculate all Greeks for an option."""
        if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
            return Greeks()

        sqrt_T = math.sqrt(T)
        d1 = (math.log(S / K) + (r - q + 0.5 * sigma ** 2) * T) / (sigma * sqrt_T)
        d2 = d1 - sigma * sqrt_T

        nd1 = _norm_cdf(d1)
        nd2 = _norm_cdf(d2)
        pd1 = _norm_pdf(d1)
        exp_qT = math.exp(-q * T)
        exp_rT = math.exp(-r * T)

        # Delta
        if option_type == OptionType.CALL:
            delta = exp_qT * nd1
        else:
            delta = -exp_qT * _norm_cdf(-d1)

        # Gamma (same for call and put)
        gamma = exp_qT * pd1 / (S * sigma * sqrt_T)

        # Theta (per day)
        theta_common = -(S * sigma * exp_qT * pd1) / (2 * sqrt_T)
        if option_type == OptionType.CALL:
            theta = theta_common - r * K * exp_rT * nd2 + q * S * exp_qT * nd1
        else:
            theta = theta_common + r * K * exp_rT * _norm_cdf(-d2) - q * S * exp_qT * _norm_cdf(-d1)
        theta /= DAYS_PER_YEAR  # Per day

        # Vega (per 1% change)
        vega = S * exp_qT * sqrt_T * pd1 / 100

        # Rho (per 1% change)
        if option_type == OptionType.CALL:
            rho = K * T * exp_rT * nd2 / 100
        else:
            rho = -K * T * exp_rT * _norm_cdf(-d2) / 100

        # Vanna (dDelta/dVol = dVega/dSpot)
        vanna = -exp_qT * pd1 * d2 / sigma

        # Charm (delta decay) — dDelta/dTime
        charm_val = -exp_qT * (pd1 * (2 * (r - q) * T - d2 * sigma * sqrt_T) / (2 * T * sigma * sqrt_T))
        if option_type == OptionType.PUT:
            charm_val += q * exp_qT * _norm_cdf(-d1)
        else:
            charm_val -= q * exp_qT * nd1

        # Volga (Vomma) — dVega/dVol
        volga = vega * d1 * d2 / sigma

        # Speed — dGamma/dSpot
        speed = -gamma / S * (d1 / (sigma * sqrt_T) + 1)

        # Color — dGamma/dTime
        color_val = -exp_qT * pd1 / (2 * S * T * sigma * sqrt_T) * (
            2 * q * T + 1 + (2 * (r - q) * T - d2 * sigma * sqrt_T) * d1 / (sigma * sqrt_T)
        )

        # Zomma — dGamma/dVol
        zomma = gamma * (d1 * d2 - 1) / sigma

        # Ultima — dVomma/dVol
        ultima = -vega / (sigma ** 2) * (d1 * d2 * (1 - d1 * d2) + d1 ** 2 + d2 ** 2)

        return Greeks(
            delta=delta,
            gamma=gamma,
            theta=theta,
            vega=vega,
            rho=rho,
            vanna=vanna,
            charm=charm_val,
            volga=volga,
            speed=speed,
            color=color_val,
            zomma=zomma,
            ultima=ultima,
        )

    @staticmethod
    def implied_volatility(option_price: float, S: float, K: float, T: float,
                            r: float, option_type: OptionType = OptionType.CALL,
                            q: float = 0.0, max_iter: int = 100,
                            tolerance: float = 1e-8) -> float:
        """
        Solve for implied volatility using Newton-Raphson with Brent failover.
        """
        if option_price <= 0 or T <= 0 or S <= 0 or K <= 0:
            return 0.0

        # Intrinsic value check
        if option_type == OptionType.CALL:
            intrinsic = max(0, S - K)
        else:
            intrinsic = max(0, K - S)

        if option_price < intrinsic:
            return 0.0

        # Initial guess using Brenner-Subrahmanyam approximation
        sigma = math.sqrt(2 * math.pi / T) * option_price / S

        # Newton-Raphson
        for i in range(max_iter):
            price = BlackScholes.price(S, K, T, r, sigma, option_type, q)
            diff = price - option_price

            if abs(diff) < tolerance:
                return sigma

            # Vega for Newton step
            sqrt_T = math.sqrt(T)
            d1 = (math.log(S / K) + (r - q + 0.5 * sigma ** 2) * T) / (sigma * sqrt_T)
            vega_raw = S * math.exp(-q * T) * sqrt_T * _norm_pdf(d1)

            if abs(vega_raw) < 1e-12:
                break

            sigma -= diff / vega_raw
            sigma = max(0.001, min(sigma, 10.0))  # Clamp

        # Brent's method fallback
        return BlackScholes._brent_iv(option_price, S, K, T, r, option_type, q)

    @staticmethod
    def _brent_iv(target: float, S: float, K: float, T: float, r: float,
                   option_type: OptionType, q: float) -> float:
        """Brent's method for IV solving."""
        a, b = 0.001, 5.0
        fa = BlackScholes.price(S, K, T, r, a, option_type, q) - target
        fb = BlackScholes.price(S, K, T, r, b, option_type, q) - target

        if fa * fb > 0:
            return 0.0

        if abs(fa) < abs(fb):
            a, b = b, a
            fa, fb = fb, fa

        c, fc = a, fa
        s = 0.0
        d = 0.0
        mflag = True

        for _ in range(100):
            if abs(b - a) < 1e-8:
                break
            if abs(fb) < 1e-8:
                return b

            if fa != fc and fb != fc:
                # Inverse quadratic interpolation
                s = (a * fb * fc / ((fa - fb) * (fa - fc)) +
                     b * fa * fc / ((fb - fa) * (fb - fc)) +
                     c * fa * fb / ((fc - fa) * (fc - fb)))
            else:
                s = b - fb * (b - a) / (fb - fa)

            # Conditions for bisection
            cond1 = not ((3 * a + b) / 4 < s < b or b < s < (3 * a + b) / 4)
            cond2 = mflag and abs(s - b) >= abs(b - c) / 2
            cond3 = not mflag and abs(s - b) >= abs(c - d) / 2
            cond4 = mflag and abs(b - c) < 1e-8
            cond5 = not mflag and abs(c - d) < 1e-8

            if cond1 or cond2 or cond3 or cond4 or cond5:
                s = (a + b) / 2
                mflag = True
            else:
                mflag = False

            fs = BlackScholes.price(S, K, T, r, s, option_type, q) - target
            d = c
            c = b
            fc = fb

            if fa * fs < 0:
                b = s
                fb = fs
            else:
                a = s
                fa = fs

            if abs(fa) < abs(fb):
                a, b = b, a
                fa, fb = fb, fa

        return b


# ─── Binomial Tree Model ────────────────────────────────────────────────────

class BinomialTree:
    """
    Cox-Ross-Rubinstein binomial tree for American option pricing.
    """

    @staticmethod
    def price(S: float, K: float, T: float, r: float, sigma: float,
              option_type: OptionType = OptionType.CALL,
              steps: int = 200, exercise: ExerciseStyle = ExerciseStyle.AMERICAN,
              q: float = 0.0) -> Tuple[float, Greeks]:
        """
        Price an option using CRR binomial tree.
        Returns (price, greeks).
        """
        if T <= 0 or sigma <= 0:
            if option_type == OptionType.CALL:
                return max(0, S - K), Greeks()
            return max(0, K - S), Greeks()

        dt = T / steps
        u = math.exp(sigma * math.sqrt(dt))
        d = 1.0 / u
        p = (math.exp((r - q) * dt) - d) / (u - d)
        df = math.exp(-r * dt)

        # Build price tree at expiry
        prices = [0.0] * (steps + 1)
        for i in range(steps + 1):
            prices[i] = S * (u ** (steps - i)) * (d ** i)

        # Option values at expiry
        values = [0.0] * (steps + 1)
        for i in range(steps + 1):
            if option_type == OptionType.CALL:
                values[i] = max(0, prices[i] - K)
            else:
                values[i] = max(0, K - prices[i])

        # Backward induction
        for j in range(steps - 1, -1, -1):
            for i in range(j + 1):
                spot = S * (u ** (j - i)) * (d ** i)
                cont_value = df * (p * values[i] + (1 - p) * values[i + 1])

                if exercise == ExerciseStyle.AMERICAN:
                    if option_type == OptionType.CALL:
                        exercise_value = max(0, spot - K)
                    else:
                        exercise_value = max(0, K - spot)
                    values[i] = max(cont_value, exercise_value)
                else:
                    values[i] = cont_value

        option_price = values[0]

        # Greeks from the tree
        # Delta from step 1
        v_up = df * (p * values[0] + (1 - p) * values[1]) if steps >= 1 else option_price
        v_down = df * (p * values[1] + (1 - p) * values[2]) if steps >= 2 else option_price

        # Approximate delta and gamma
        delta_val = (v_up - v_down) / (S * u - S * d) if (S * u - S * d) != 0 else 0
        # These are rough approximations from the tree
        greeks = Greeks(delta=delta_val)

        return option_price, greeks


# ─── Monte Carlo Pricing ────────────────────────────────────────────────────

class MonteCarloPricer:
    """
    Monte Carlo simulation for option pricing.
    Supports exotic options, barrier options, Asian options.
    """

    @staticmethod
    def price(S: float, K: float, T: float, r: float, sigma: float,
              option_type: OptionType = OptionType.CALL,
              num_paths: int = 50000, num_steps: int = 252,
              q: float = 0.0, antithetic: bool = True) -> Tuple[float, float]:
        """
        Monte Carlo option pricing.
        Returns (price, standard_error).
        """
        import random

        dt = T / num_steps
        sqrt_dt = math.sqrt(dt)
        drift = (r - q - 0.5 * sigma ** 2) * dt

        payoffs = []

        for _ in range(num_paths):
            path = S
            path_anti = S  # Antithetic variate

            for _ in range(num_steps):
                z = random.gauss(0, 1)
                path *= math.exp(drift + sigma * sqrt_dt * z)
                if antithetic:
                    path_anti *= math.exp(drift + sigma * sqrt_dt * (-z))

            if option_type == OptionType.CALL:
                payoff = max(0, path - K)
                if antithetic:
                    payoff = (payoff + max(0, path_anti - K)) / 2
            else:
                payoff = max(0, K - path)
                if antithetic:
                    payoff = (payoff + max(0, K - path_anti)) / 2

            payoffs.append(payoff)

        avg_payoff = sum(payoffs) / len(payoffs)
        price = avg_payoff * math.exp(-r * T)

        # Standard error
        variance = sum((p - avg_payoff) ** 2 for p in payoffs) / (len(payoffs) - 1)
        se = math.sqrt(variance / len(payoffs)) * math.exp(-r * T)

        return price, se

    @staticmethod
    def asian_option_price(S: float, K: float, T: float, r: float, sigma: float,
                            option_type: OptionType = OptionType.CALL,
                            num_paths: int = 20000, num_steps: int = 252,
                            q: float = 0.0) -> Tuple[float, float]:
        """Price an Asian (average price) option."""
        import random

        dt = T / num_steps
        sqrt_dt = math.sqrt(dt)
        drift = (r - q - 0.5 * sigma ** 2) * dt

        payoffs = []

        for _ in range(num_paths):
            path_sum = S
            spot = S
            for _ in range(num_steps):
                z = random.gauss(0, 1)
                spot *= math.exp(drift + sigma * sqrt_dt * z)
                path_sum += spot

            avg_price = path_sum / (num_steps + 1)

            if option_type == OptionType.CALL:
                payoff = max(0, avg_price - K)
            else:
                payoff = max(0, K - avg_price)
            payoffs.append(payoff)

        avg = sum(payoffs) / len(payoffs)
        price = avg * math.exp(-r * T)
        variance = sum((p - avg) ** 2 for p in payoffs) / (len(payoffs) - 1)
        se = math.sqrt(variance / len(payoffs)) * math.exp(-r * T)

        return price, se

    @staticmethod
    def barrier_option_price(S: float, K: float, T: float, r: float, sigma: float,
                              barrier: float, barrier_type: str = "down-and-out",
                              option_type: OptionType = OptionType.CALL,
                              num_paths: int = 20000, num_steps: int = 252,
                              q: float = 0.0) -> Tuple[float, float]:
        """Price barrier options (knock-in/knock-out)."""
        import random

        dt = T / num_steps
        sqrt_dt = math.sqrt(dt)
        drift = (r - q - 0.5 * sigma ** 2) * dt

        payoffs = []

        for _ in range(num_paths):
            spot = S
            knocked = False

            for _ in range(num_steps):
                z = random.gauss(0, 1)
                spot *= math.exp(drift + sigma * sqrt_dt * z)

                if barrier_type.startswith("down"):
                    if spot <= barrier:
                        knocked = True
                elif barrier_type.startswith("up"):
                    if spot >= barrier:
                        knocked = True

            if option_type == OptionType.CALL:
                payoff = max(0, spot - K)
            else:
                payoff = max(0, K - spot)

            if "out" in barrier_type:
                payoff = 0 if knocked else payoff
            elif "in" in barrier_type:
                payoff = payoff if knocked else 0

            payoffs.append(payoff)

        avg = sum(payoffs) / len(payoffs)
        price = avg * math.exp(-r * T)
        variance = sum((p - avg) ** 2 for p in payoffs) / max(1, len(payoffs) - 1)
        se = math.sqrt(variance / len(payoffs)) * math.exp(-r * T)

        return price, se


# ─── Volatility Surface ─────────────────────────────────────────────────────

@dataclass
class VolSurfacePoint:
    """A single point on the volatility surface."""
    strike: float
    expiry_days: float
    iv: float
    moneyness: float  # strike / spot
    log_moneyness: float  # ln(K/S)
    delta: float

@dataclass
class VolatilitySurface:
    """
    Implied volatility surface construction and interpolation.
    """
    symbol: str = ""
    underlying_price: float = 0.0
    points: List[VolSurfacePoint] = field(default_factory=list)
    strikes: List[float] = field(default_factory=list)
    expiries: List[float] = field(default_factory=list)
    surface_grid: List[List[float]] = field(default_factory=list)  # [expiry_idx][strike_idx]
    timestamp: float = field(default_factory=time.time)

    def build(self, chain: OptionsChain, r: float = RISK_FREE_RATE) -> None:
        """Build volatility surface from options chain."""
        self.symbol = chain.symbol
        self.underlying_price = chain.underlying_price
        self.points = []

        for expiry_str, calls in chain.calls.items():
            # Calculate days to expiry
            try:
                exp_date = datetime.strptime(expiry_str, "%Y-%m-%d")
                dte = (exp_date - datetime.now()).days
            except ValueError:
                dte = 30

            for c in calls:
                if c.implied_volatility > 0 and c.mid > 0:
                    moneyness = c.strike / chain.underlying_price
                    self.points.append(VolSurfacePoint(
                        strike=c.strike,
                        expiry_days=dte,
                        iv=c.implied_volatility,
                        moneyness=moneyness,
                        log_moneyness=math.log(moneyness) if moneyness > 0 else 0,
                        delta=c.greeks.delta,
                    ))

        for expiry_str, puts in chain.puts.items():
            try:
                exp_date = datetime.strptime(expiry_str, "%Y-%m-%d")
                dte = (exp_date - datetime.now()).days
            except ValueError:
                dte = 30

            for p in puts:
                if p.implied_volatility > 0 and p.mid > 0:
                    moneyness = p.strike / chain.underlying_price
                    self.points.append(VolSurfacePoint(
                        strike=p.strike,
                        expiry_days=dte,
                        iv=p.implied_volatility,
                        moneyness=moneyness,
                        log_moneyness=math.log(moneyness) if moneyness > 0 else 0,
                        delta=p.greeks.delta,
                    ))

        # Build grid
        self._build_grid()

    def _build_grid(self) -> None:
        """Construct a regular grid from scattered points."""
        if not self.points:
            return

        unique_strikes = sorted(set(p.strike for p in self.points))
        unique_expiries = sorted(set(p.expiry_days for p in self.points))

        self.strikes = unique_strikes
        self.expiries = unique_expiries
        self.surface_grid = []

        for exp in unique_expiries:
            row = []
            for strike in unique_strikes:
                # Find nearest point
                matching = [p for p in self.points if p.strike == strike and p.expiry_days == exp]
                if matching:
                    row.append(matching[0].iv)
                else:
                    # Interpolate
                    iv = self._interpolate(strike, exp)
                    row.append(iv)
            self.surface_grid.append(row)

    def _interpolate(self, strike: float, expiry: float) -> float:
        """Simple bilinear interpolation."""
        if not self.points:
            return 0.3  # Default 30%

        # Find nearest 4 points
        nearby = sorted(self.points, key=lambda p: (p.strike - strike) ** 2 + (p.expiry_days - expiry) ** 2)[:4]
        if not nearby:
            return 0.3

        # Distance-weighted average
        total_weight = 0.0
        total_iv = 0.0
        for p in nearby:
            dist = math.sqrt((p.strike - strike) ** 2 + (p.expiry_days - expiry) ** 2) + 1e-6
            weight = 1.0 / dist
            total_weight += weight
            total_iv += weight * p.iv

        return total_iv / total_weight if total_weight > 0 else 0.3

    def get_iv(self, strike: float, expiry_days: float) -> float:
        """Get interpolated IV for any strike/expiry."""
        return self._interpolate(strike, expiry_days)

    def get_skew(self, expiry_days: float) -> Dict[str, float]:
        """Calculate volatility skew metrics for a given expiry."""
        points = sorted([p for p in self.points if abs(p.expiry_days - expiry_days) < 5],
                       key=lambda p: p.strike)
        if len(points) < 3:
            return {}

        atm_idx = min(range(len(points)), key=lambda i: abs(points[i].moneyness - 1.0))
        atm_iv = points[atm_idx].iv

        # 25-delta skew (approximate)
        otm_put_iv = points[0].iv if points else atm_iv
        otm_call_iv = points[-1].iv if points else atm_iv

        return {
            "atm_iv": round(atm_iv, 4),
            "25d_put_iv": round(otm_put_iv, 4),
            "25d_call_iv": round(otm_call_iv, 4),
            "skew": round(otm_put_iv - otm_call_iv, 4),
            "risk_reversal": round(otm_call_iv - otm_put_iv, 4),
            "butterfly": round((otm_put_iv + otm_call_iv) / 2 - atm_iv, 4),
        }

    def get_term_structure(self) -> List[Dict[str, float]]:
        """ATM implied volatility term structure."""
        result = []
        for exp in sorted(set(p.expiry_days for p in self.points)):
            atm_points = [p for p in self.points if abs(p.expiry_days - exp) < 2 and abs(p.moneyness - 1.0) < 0.05]
            if atm_points:
                avg_iv = sum(p.iv for p in atm_points) / len(atm_points)
                result.append({"days": exp, "iv": round(avg_iv, 4)})
        return result

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "underlying_price": self.underlying_price,
            "strikes": self.strikes,
            "expiries": self.expiries,
            "surface": self.surface_grid,
            "num_points": len(self.points),
        }


# ─── Options Strategy Builder ───────────────────────────────────────────────

@dataclass
class StrategyLeg:
    """A single leg of an options strategy."""
    option: OptionContract
    quantity: int = 1  # Positive for long, negative for short
    is_stock: bool = False  # True for stock leg (covered call, etc.)

    @property
    def notional(self) -> float:
        if self.is_stock:
            return self.option.underlying_price * abs(self.quantity)
        return self.option.mid * abs(self.quantity) * self.option.multiplier

@dataclass
class OptionsStrategy:
    """Multi-leg options strategy with analytics."""
    name: str = ""
    strategy_type: StrategyType = StrategyType.CUSTOM
    legs: List[StrategyLeg] = field(default_factory=list)
    underlying_price: float = 0.0
    symbol: str = ""

    @property
    def net_debit(self) -> float:
        """Net debit (positive) or credit (negative) to enter."""
        total = 0.0
        for leg in self.legs:
            if leg.is_stock:
                total += leg.quantity * self.underlying_price
            else:
                total += leg.quantity * leg.option.mid * leg.option.multiplier
        return total

    @property
    def max_profit(self) -> float:
        """Calculate theoretical max profit."""
        payoffs = self._payoff_range()
        return max(payoffs) if payoffs else 0.0

    @property
    def max_loss(self) -> float:
        """Calculate theoretical max loss."""
        payoffs = self._payoff_range()
        return min(payoffs) if payoffs else 0.0

    @property
    def breakeven_points(self) -> List[float]:
        """Find breakeven price points."""
        payoffs = self._payoff_range()
        breakevens = []
        prices = self._price_range()
        for i in range(1, len(payoffs)):
            if payoffs[i - 1] * payoffs[i] < 0:
                # Linear interpolation
                p1, p2 = prices[i - 1], prices[i]
                v1, v2 = payoffs[i - 1], payoffs[i]
                be = p1 - v1 * (p2 - p1) / (v2 - v1)
                breakevens.append(round(be, 2))
        return breakevens

    @property
    def total_greeks(self) -> Greeks:
        """Aggregate Greeks across all legs."""
        g = Greeks()
        for leg in self.legs:
            if leg.is_stock:
                g.delta += leg.quantity
            else:
                og = leg.option.greeks
                g.delta += og.delta * leg.quantity
                g.gamma += og.gamma * leg.quantity
                g.theta += og.theta * leg.quantity
                g.vega += og.vega * leg.quantity
                g.rho += og.rho * leg.quantity
                g.vanna += og.vanna * leg.quantity
                g.charm += og.charm * leg.quantity
                g.volga += og.volga * leg.quantity
        return g

    @property
    def risk_reward_ratio(self) -> float:
        """Risk/reward ratio."""
        if self.max_loss == 0:
            return float('inf')
        return abs(self.max_profit / self.max_loss)

    @property
    def probability_of_profit(self) -> float:
        """Rough probability of profit estimation based on delta."""
        if not self.legs:
            return 0.5
        # For simple strategies, use delta as POP proxy
        first_leg = self.legs[0]
        if first_leg.option.option_type == OptionType.CALL:
            if first_leg.quantity > 0:
                return first_leg.option.greeks.delta  # Long call
            else:
                return 1.0 - first_leg.option.greeks.delta  # Short call
        else:
            if first_leg.quantity > 0:
                return -first_leg.option.greeks.delta  # Long put
            else:
                return 1.0 + first_leg.option.greeks.delta  # Short put

    def _price_range(self) -> List[float]:
        """Generate price range for payoff calculation."""
        if not self.legs:
            return []
        strikes = [leg.option.strike for leg in self.legs if not leg.is_stock]
        if not strikes:
            strikes = [self.underlying_price]
        min_strike = min(strikes)
        max_strike = max(strikes)
        margin = (max_strike - min_strike) * 0.5 or self.underlying_price * 0.2
        low = min_strike - margin
        high = max_strike + margin
        num_points = 200
        step = (high - low) / num_points
        return [low + i * step for i in range(num_points + 1)]

    def _payoff_range(self) -> List[float]:
        """Calculate P&L at each price point at expiry."""
        prices = self._price_range()
        payoffs = []
        for price in prices:
            pnl = -self.net_debit
            for leg in self.legs:
                if leg.is_stock:
                    pnl += leg.quantity * (price - self.underlying_price)
                else:
                    opt = leg.option
                    if opt.option_type == OptionType.CALL:
                        intrinsic = max(0, price - opt.strike)
                    else:
                        intrinsic = max(0, opt.strike - price)
                    pnl += leg.quantity * intrinsic * opt.multiplier
            payoffs.append(pnl)
        return payoffs

    def payoff_diagram(self, num_points: int = 200) -> List[Dict[str, float]]:
        """Generate payoff diagram data."""
        prices = self._price_range()
        payoffs = self._payoff_range()
        return [{"price": round(p, 2), "pnl": round(v, 2)} for p, v in zip(prices, payoffs)]

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "type": self.strategy_type.value,
            "symbol": self.symbol,
            "underlying_price": self.underlying_price,
            "net_debit": round(self.net_debit, 2),
            "max_profit": round(self.max_profit, 2),
            "max_loss": round(self.max_loss, 2),
            "breakevens": self.breakeven_points,
            "risk_reward": round(self.risk_reward_ratio, 4),
            "pop": round(self.probability_of_profit, 4),
            "greeks": self.total_greeks.to_dict(),
            "legs": [{
                "symbol": leg.option.option_symbol,
                "type": leg.option.option_type.value,
                "strike": leg.option.strike,
                "expiry": leg.option.expiration,
                "quantity": leg.quantity,
                "mid": leg.option.mid,
                "is_stock": leg.is_stock,
            } for leg in self.legs],
        }


class StrategyFactory:
    """Factory for creating common options strategies."""

    @staticmethod
    def bull_call_spread(chain: OptionsChain, expiration: str,
                          lower_strike: float, upper_strike: float,
                          quantity: int = 1) -> OptionsStrategy:
        calls = chain.calls.get(expiration, [])
        lower = next((c for c in calls if c.strike == lower_strike), None)
        upper = next((c for c in calls if c.strike == upper_strike), None)
        if not lower or not upper:
            raise ValueError("Could not find calls at specified strikes")

        strategy = OptionsStrategy(
            name=f"Bull Call Spread {lower_strike}/{upper_strike}",
            strategy_type=StrategyType.BULL_CALL_SPREAD,
            underlying_price=chain.underlying_price,
            symbol=chain.symbol,
            legs=[
                StrategyLeg(option=lower, quantity=quantity),
                StrategyLeg(option=upper, quantity=-quantity),
            ]
        )
        return strategy

    @staticmethod
    def bear_put_spread(chain: OptionsChain, expiration: str,
                         upper_strike: float, lower_strike: float,
                         quantity: int = 1) -> OptionsStrategy:
        puts = chain.puts.get(expiration, [])
        upper = next((p for p in puts if p.strike == upper_strike), None)
        lower = next((p for p in puts if p.strike == lower_strike), None)
        if not upper or not lower:
            raise ValueError("Could not find puts at specified strikes")

        return OptionsStrategy(
            name=f"Bear Put Spread {upper_strike}/{lower_strike}",
            strategy_type=StrategyType.BEAR_PUT_SPREAD,
            underlying_price=chain.underlying_price,
            symbol=chain.symbol,
            legs=[
                StrategyLeg(option=upper, quantity=quantity),
                StrategyLeg(option=lower, quantity=-quantity),
            ]
        )

    @staticmethod
    def iron_condor(chain: OptionsChain, expiration: str,
                     put_lower: float, put_upper: float,
                     call_lower: float, call_upper: float,
                     quantity: int = 1) -> OptionsStrategy:
        puts = chain.puts.get(expiration, [])
        calls = chain.calls.get(expiration, [])

        legs = []
        for strike, side_list, q in [
            (put_lower, puts, quantity), (put_upper, puts, -quantity),
            (call_lower, calls, -quantity), (call_upper, calls, quantity),
        ]:
            contract = next((c for c in side_list if c.strike == strike), None)
            if not contract:
                raise ValueError(f"Could not find contract at strike {strike}")
            legs.append(StrategyLeg(option=contract, quantity=q))

        return OptionsStrategy(
            name=f"Iron Condor {put_lower}/{put_upper}/{call_lower}/{call_upper}",
            strategy_type=StrategyType.IRON_CONDOR,
            underlying_price=chain.underlying_price,
            symbol=chain.symbol,
            legs=legs,
        )

    @staticmethod
    def straddle(chain: OptionsChain, expiration: str, strike: float,
                  long: bool = True, quantity: int = 1) -> OptionsStrategy:
        calls = chain.calls.get(expiration, [])
        puts = chain.puts.get(expiration, [])
        call = next((c for c in calls if c.strike == strike), None)
        put = next((p for p in puts if p.strike == strike), None)
        if not call or not put:
            raise ValueError(f"Could not find call/put at strike {strike}")

        q = quantity if long else -quantity
        return OptionsStrategy(
            name=f"{'Long' if long else 'Short'} Straddle {strike}",
            strategy_type=StrategyType.LONG_STRADDLE if long else StrategyType.SHORT_STRADDLE,
            underlying_price=chain.underlying_price,
            symbol=chain.symbol,
            legs=[
                StrategyLeg(option=call, quantity=q),
                StrategyLeg(option=put, quantity=q),
            ]
        )

    @staticmethod
    def strangle(chain: OptionsChain, expiration: str,
                  put_strike: float, call_strike: float,
                  long: bool = True, quantity: int = 1) -> OptionsStrategy:
        calls = chain.calls.get(expiration, [])
        puts = chain.puts.get(expiration, [])
        call = next((c for c in calls if c.strike == call_strike), None)
        put = next((p for p in puts if p.strike == put_strike), None)
        if not call or not put:
            raise ValueError("Could not find call/put at specified strikes")

        q = quantity if long else -quantity
        return OptionsStrategy(
            name=f"{'Long' if long else 'Short'} Strangle {put_strike}/{call_strike}",
            strategy_type=StrategyType.LONG_STRANGLE if long else StrategyType.SHORT_STRANGLE,
            underlying_price=chain.underlying_price,
            symbol=chain.symbol,
            legs=[
                StrategyLeg(option=put, quantity=q),
                StrategyLeg(option=call, quantity=q),
            ]
        )

    @staticmethod
    def butterfly(chain: OptionsChain, expiration: str,
                   lower: float, middle: float, upper: float,
                   option_type: OptionType = OptionType.CALL,
                   quantity: int = 1) -> OptionsStrategy:
        contracts = chain.calls.get(expiration, []) if option_type == OptionType.CALL else chain.puts.get(expiration, [])
        lower_c = next((c for c in contracts if c.strike == lower), None)
        middle_c = next((c for c in contracts if c.strike == middle), None)
        upper_c = next((c for c in contracts if c.strike == upper), None)
        if not all([lower_c, middle_c, upper_c]):
            raise ValueError("Could not find contracts at specified strikes")

        return OptionsStrategy(
            name=f"Butterfly {lower}/{middle}/{upper}",
            strategy_type=StrategyType.BUTTERFLY_CALL if option_type == OptionType.CALL else StrategyType.BUTTERFLY_PUT,
            underlying_price=chain.underlying_price,
            symbol=chain.symbol,
            legs=[
                StrategyLeg(option=lower_c, quantity=quantity),
                StrategyLeg(option=middle_c, quantity=-2 * quantity),
                StrategyLeg(option=upper_c, quantity=quantity),
            ]
        )

    @staticmethod
    def covered_call(chain: OptionsChain, expiration: str,
                      strike: float, shares: int = 100) -> OptionsStrategy:
        calls = chain.calls.get(expiration, [])
        call = next((c for c in calls if c.strike == strike), None)
        if not call:
            raise ValueError(f"Could not find call at strike {strike}")

        stock_leg = OptionContract(
            symbol=chain.symbol,
            strike=0,
            underlying_price=chain.underlying_price,
        )

        return OptionsStrategy(
            name=f"Covered Call {strike}",
            strategy_type=StrategyType.COVERED_CALL,
            underlying_price=chain.underlying_price,
            symbol=chain.symbol,
            legs=[
                StrategyLeg(option=stock_leg, quantity=shares, is_stock=True),
                StrategyLeg(option=call, quantity=-1),
            ]
        )


# ─── Max Pain Calculator ────────────────────────────────────────────────────

class MaxPainCalculator:
    """Calculate the Max Pain price for options expiration."""

    @staticmethod
    def calculate(chain: OptionsChain, expiration: str) -> Dict[str, Any]:
        """Calculate max pain and related metrics."""
        calls = chain.calls.get(expiration, [])
        puts = chain.puts.get(expiration, [])

        if not calls and not puts:
            return {"max_pain": 0, "strikes": [], "pain": []}

        all_strikes = sorted(set(c.strike for c in calls) | set(p.strike for p in puts))
        pain_values = []

        for test_price in all_strikes:
            total_pain = 0.0

            # Pain for call holders (they lose money below their strike)
            for call in calls:
                if test_price < call.strike:
                    total_pain += call.open_interest * (call.strike - test_price) * call.multiplier
                # Calls expire worthless at test_price, that's max pain for call holders

            # Pain for put holders (they lose money above their strike)
            for put in puts:
                if test_price > put.strike:
                    total_pain += put.open_interest * (test_price - put.strike) * put.multiplier

            pain_values.append(total_pain)

        if not pain_values:
            return {"max_pain": 0, "strikes": [], "pain": []}

        min_pain_idx = pain_values.index(min(pain_values))
        max_pain_price = all_strikes[min_pain_idx]

        return {
            "max_pain": max_pain_price,
            "current_price": chain.underlying_price,
            "distance": round(max_pain_price - chain.underlying_price, 2),
            "distance_pct": round((max_pain_price - chain.underlying_price) / chain.underlying_price * 100, 2),
            "strikes": [round(s, 2) for s in all_strikes],
            "pain": [round(p, 0) for p in pain_values],
            "total_call_oi": sum(c.open_interest for c in calls),
            "total_put_oi": sum(p.open_interest for p in puts),
        }


# ─── IV Rank & Percentile ───────────────────────────────────────────────────

class IVAnalyzer:
    """Implied Volatility analysis: rank, percentile, HV comparison."""

    @staticmethod
    def iv_rank(current_iv: float, iv_history: List[float]) -> float:
        """
        IV Rank: (Current IV - 52wk Low) / (52wk High - 52wk Low)
        Result: 0-100
        """
        if not iv_history:
            return 50.0
        low = min(iv_history)
        high = max(iv_history)
        if high == low:
            return 50.0
        return round((current_iv - low) / (high - low) * 100, 2)

    @staticmethod
    def iv_percentile(current_iv: float, iv_history: List[float]) -> float:
        """
        IV Percentile: % of days IV was below current level
        Result: 0-100
        """
        if not iv_history:
            return 50.0
        below = sum(1 for iv in iv_history if iv < current_iv)
        return round(below / len(iv_history) * 100, 2)

    @staticmethod
    def realized_vol(returns: List[float], window: int = 20,
                      annualize: bool = True) -> float:
        """Calculate historical/realized volatility."""
        if len(returns) < window:
            return 0.0
        recent = returns[-window:]
        avg = sum(recent) / len(recent)
        variance = sum((r - avg) ** 2 for r in recent) / (len(recent) - 1)
        vol = math.sqrt(variance)
        if annualize:
            vol *= math.sqrt(TRADING_DAYS)
        return round(vol, 4)

    @staticmethod
    def iv_hv_spread(current_iv: float, hv: float) -> Dict[str, float]:
        """Compare implied vs historical volatility."""
        spread = current_iv - hv
        return {
            "iv": round(current_iv, 4),
            "hv": round(hv, 4),
            "spread": round(spread, 4),
            "ratio": round(current_iv / hv, 4) if hv > 0 else 0,
            "overpriced": spread > 0,
        }


# ─── Options Data Fetcher ───────────────────────────────────────────────────

class OptionsDataFetcher:
    """
    Fetches options data from Tradier, with Polygon and yfinance fallback.
    """

    def __init__(self):
        self.tradier_key = os.environ.get("TRADIER_SANDBOX_KEY", "")
        self.polygon_key = os.environ.get("POLYGON_API_KEY", "")
        self.tradier_url = "https://sandbox.tradier.com"

    async def fetch_chain(self, symbol: str, expiration: Optional[str] = None) -> OptionsChain:
        """Fetch full options chain."""
        # Try Tradier first
        if self.tradier_key:
            try:
                return await self._fetch_tradier(symbol, expiration)
            except Exception as e:
                logger.warning(f"Tradier fetch failed: {e}")

        # Polygon fallback
        if self.polygon_key:
            try:
                return await self._fetch_polygon(symbol, expiration)
            except Exception as e:
                logger.warning(f"Polygon fetch failed: {e}")

        # yfinance fallback
        return await self._fetch_yfinance(symbol, expiration)

    async def _fetch_tradier(self, symbol: str, expiration: Optional[str]) -> OptionsChain:
        """Fetch from Tradier."""
        async with httpx.AsyncClient(
            headers={"Authorization": f"Bearer {self.tradier_key}", "Accept": "application/json"},
            timeout=30.0,
        ) as client:
            # Get expirations
            exp_resp = await client.get(f"{self.tradier_url}/v1/markets/options/expirations",
                                       params={"symbol": symbol})
            exp_data = exp_resp.json()
            expirations = exp_data.get("expirations", {}).get("date", [])
            if isinstance(expirations, str):
                expirations = [expirations]

            # Get underlying price
            quote_resp = await client.get(f"{self.tradier_url}/v1/markets/quotes",
                                         params={"symbols": symbol})
            quote_data = quote_resp.json()
            quote = quote_data.get("quotes", {}).get("quote", {})
            underlying_price = float(quote.get("last", 0))

            chain = OptionsChain(
                symbol=symbol,
                underlying_price=underlying_price,
                expirations=expirations,
            )

            # Fetch chain for each expiration (or just requested one)
            target_expirations = [expiration] if expiration else expirations[:5]

            for exp in target_expirations:
                resp = await client.get(f"{self.tradier_url}/v1/markets/options/chains",
                                       params={"symbol": symbol, "expiration": exp, "greeks": "true"})
                data = resp.json()
                options = data.get("options", {}).get("option", [])
                if isinstance(options, dict):
                    options = [options]

                for opt in options:
                    contract = self._parse_tradier_option(opt, underlying_price, exp)
                    if contract.option_type == OptionType.CALL:
                        chain.calls.setdefault(exp, []).append(contract)
                    else:
                        chain.puts.setdefault(exp, []).append(contract)

            return chain

    def _parse_tradier_option(self, opt: dict, underlying_price: float, expiration: str) -> OptionContract:
        """Parse Tradier option data into OptionContract."""
        greeks_data = opt.get("greeks", {}) or {}
        option_type = OptionType.CALL if opt.get("option_type") == "call" else OptionType.PUT
        strike = float(opt.get("strike", 0))
        bid = float(opt.get("bid", 0) or 0)
        ask = float(opt.get("ask", 0) or 0)
        mid = (bid + ask) / 2

        # Calculate intrinsic value
        if option_type == OptionType.CALL:
            intrinsic = max(0, underlying_price - strike)
        else:
            intrinsic = max(0, strike - underlying_price)

        iv = float(greeks_data.get("mid_iv", 0) or greeks_data.get("ask_iv", 0) or 0)

        greeks = Greeks(
            delta=float(greeks_data.get("delta", 0) or 0),
            gamma=float(greeks_data.get("gamma", 0) or 0),
            theta=float(greeks_data.get("theta", 0) or 0),
            vega=float(greeks_data.get("vega", 0) or 0),
            rho=float(greeks_data.get("rho", 0) or 0),
        )

        # Days to expiry
        try:
            exp_date = datetime.strptime(expiration, "%Y-%m-%d")
            dte = max(0, (exp_date - datetime.now()).days)
        except ValueError:
            dte = 30

        return OptionContract(
            symbol=opt.get("underlying", ""),
            option_symbol=opt.get("symbol", ""),
            strike=strike,
            expiration=expiration,
            option_type=option_type,
            bid=bid,
            ask=ask,
            last=float(opt.get("last", 0) or 0),
            mid=mid,
            volume=int(opt.get("volume", 0) or 0),
            open_interest=int(opt.get("open_interest", 0) or 0),
            change=float(opt.get("change", 0) or 0),
            change_pct=float(opt.get("change_percentage", 0) or 0),
            implied_volatility=iv,
            intrinsic_value=intrinsic,
            extrinsic_value=max(0, mid - intrinsic),
            greeks=greeks,
            underlying_price=underlying_price,
            days_to_expiry=dte,
        )

    async def _fetch_polygon(self, symbol: str, expiration: Optional[str]) -> OptionsChain:
        """Fetch from Polygon.io."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Get snapshot
            resp = await client.get(
                f"https://api.polygon.io/v3/snapshot/options/{symbol}",
                params={"apiKey": self.polygon_key, "limit": 250}
            )
            data = resp.json()
            results = data.get("results", [])

            chain = OptionsChain(symbol=symbol)

            for item in results:
                details = item.get("details", {})
                ot = OptionType.CALL if details.get("contract_type") == "call" else OptionType.PUT
                greeks_data = item.get("greeks", {})
                day = item.get("day", {})
                exp = details.get("expiration_date", "")

                contract = OptionContract(
                    symbol=symbol,
                    option_symbol=details.get("ticker", ""),
                    strike=float(details.get("strike_price", 0)),
                    expiration=exp,
                    option_type=ot,
                    volume=int(day.get("volume", 0)),
                    open_interest=int(item.get("open_interest", 0)),
                    implied_volatility=float(item.get("implied_volatility", 0)),
                    greeks=Greeks(
                        delta=float(greeks_data.get("delta", 0)),
                        gamma=float(greeks_data.get("gamma", 0)),
                        theta=float(greeks_data.get("theta", 0)),
                        vega=float(greeks_data.get("vega", 0)),
                    ),
                    underlying_price=float(item.get("underlying_asset", {}).get("price", 0)),
                )

                if ot == OptionType.CALL:
                    chain.calls.setdefault(exp, []).append(contract)
                else:
                    chain.puts.setdefault(exp, []).append(contract)

                if exp not in chain.expirations:
                    chain.expirations.append(exp)

            if results and chain.underlying_price == 0:
                first = results[0]
                chain.underlying_price = float(first.get("underlying_asset", {}).get("price", 0))

            chain.expirations.sort()
            return chain

    async def _fetch_yfinance(self, symbol: str, expiration: Optional[str]) -> OptionsChain:
        """Fallback: fetch from yfinance (synchronous, wrapped)."""
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._yfinance_sync, symbol, expiration)

    def _yfinance_sync(self, symbol: str, expiration: Optional[str]) -> OptionsChain:
        """Synchronous yfinance fetch."""
        try:
            import yfinance as yf
            ticker = yf.Ticker(symbol)
            info = ticker.info or {}
            underlying_price = info.get("regularMarketPrice", info.get("currentPrice", 0))

            expirations = list(ticker.options) if hasattr(ticker, 'options') else []
            chain = OptionsChain(
                symbol=symbol,
                underlying_price=underlying_price,
                expirations=expirations,
            )

            target_exp = [expiration] if expiration else expirations[:3]

            for exp in target_exp:
                try:
                    opt_chain = ticker.option_chain(exp)
                except Exception:
                    continue

                # Parse calls
                if hasattr(opt_chain, 'calls') and not opt_chain.calls.empty:
                    for _, row in opt_chain.calls.iterrows():
                        contract = OptionContract(
                            symbol=symbol,
                            option_symbol=str(row.get("contractSymbol", "")),
                            strike=float(row.get("strike", 0)),
                            expiration=exp,
                            option_type=OptionType.CALL,
                            bid=float(row.get("bid", 0) or 0),
                            ask=float(row.get("ask", 0) or 0),
                            last=float(row.get("lastPrice", 0) or 0),
                            mid=float((row.get("bid", 0) or 0) + (row.get("ask", 0) or 0)) / 2,
                            volume=int(row.get("volume", 0) or 0),
                            open_interest=int(row.get("openInterest", 0) or 0),
                            implied_volatility=float(row.get("impliedVolatility", 0) or 0),
                            underlying_price=underlying_price,
                        )
                        # Calculate Greeks
                        dte = max(1, (datetime.strptime(exp, "%Y-%m-%d") - datetime.now()).days)
                        T = dte / DAYS_PER_YEAR
                        if contract.implied_volatility > 0:
                            contract.greeks = BlackScholes.greeks(
                                underlying_price, contract.strike, T,
                                RISK_FREE_RATE, contract.implied_volatility,
                                OptionType.CALL,
                            )
                        contract.days_to_expiry = dte
                        contract.intrinsic_value = max(0, underlying_price - contract.strike)
                        contract.extrinsic_value = max(0, contract.mid - contract.intrinsic_value)
                        chain.calls.setdefault(exp, []).append(contract)

                # Parse puts
                if hasattr(opt_chain, 'puts') and not opt_chain.puts.empty:
                    for _, row in opt_chain.puts.iterrows():
                        contract = OptionContract(
                            symbol=symbol,
                            option_symbol=str(row.get("contractSymbol", "")),
                            strike=float(row.get("strike", 0)),
                            expiration=exp,
                            option_type=OptionType.PUT,
                            bid=float(row.get("bid", 0) or 0),
                            ask=float(row.get("ask", 0) or 0),
                            last=float(row.get("lastPrice", 0) or 0),
                            mid=float((row.get("bid", 0) or 0) + (row.get("ask", 0) or 0)) / 2,
                            volume=int(row.get("volume", 0) or 0),
                            open_interest=int(row.get("openInterest", 0) or 0),
                            implied_volatility=float(row.get("impliedVolatility", 0) or 0),
                            underlying_price=underlying_price,
                        )
                        dte = max(1, (datetime.strptime(exp, "%Y-%m-%d") - datetime.now()).days)
                        T = dte / DAYS_PER_YEAR
                        if contract.implied_volatility > 0:
                            contract.greeks = BlackScholes.greeks(
                                underlying_price, contract.strike, T,
                                RISK_FREE_RATE, contract.implied_volatility,
                                OptionType.PUT,
                            )
                        contract.days_to_expiry = dte
                        contract.intrinsic_value = max(0, contract.strike - underlying_price)
                        contract.extrinsic_value = max(0, contract.mid - contract.intrinsic_value)
                        chain.puts.setdefault(exp, []).append(contract)

            return chain

        except Exception as e:
            logger.error(f"yfinance options fetch failed: {e}")
            return OptionsChain(symbol=symbol)


# ─── Unusual Options Activity Scanner ───────────────────────────────────────

class UnusualActivityScanner:
    """Scans for unusual options activity / flow."""

    @staticmethod
    def scan(chain: OptionsChain, volume_threshold: float = 2.0,
             oi_threshold: float = 1.5) -> List[Dict[str, Any]]:
        """
        Find unusual options activity.
        volume_threshold: volume/OI ratio for unusual flag
        oi_threshold: OI must be above median * this factor
        """
        unusual = []

        for expiry in chain.expirations:
            all_contracts = chain.calls.get(expiry, []) + chain.puts.get(expiry, [])

            # Calculate medians
            volumes = [c.volume for c in all_contracts if c.volume > 0]
            ois = [c.open_interest for c in all_contracts if c.open_interest > 0]

            if not volumes or not ois:
                continue

            median_vol = sorted(volumes)[len(volumes) // 2]
            median_oi = sorted(ois)[len(ois) // 2]

            for contract in all_contracts:
                flags = []

                # High volume/OI ratio
                if contract.open_interest > 0:
                    vol_oi = contract.volume / contract.open_interest
                    if vol_oi >= volume_threshold:
                        flags.append(f"Vol/OI ratio: {vol_oi:.1f}x")

                # Volume spike vs median
                if contract.volume > median_vol * 3:
                    flags.append(f"Volume {contract.volume / median_vol:.1f}x median")

                # Large OI
                if contract.open_interest > median_oi * oi_threshold * 5:
                    flags.append(f"High OI: {contract.open_interest}")

                # Significant premium
                notional = contract.mid * contract.volume * contract.multiplier
                if notional > 100_000:  # >$100k in premium
                    flags.append(f"Premium: ${notional:,.0f}")

                if flags:
                    unusual.append({
                        "symbol": contract.option_symbol,
                        "underlying": contract.symbol,
                        "type": contract.option_type.value,
                        "strike": contract.strike,
                        "expiration": expiry,
                        "volume": contract.volume,
                        "open_interest": contract.open_interest,
                        "iv": round(contract.implied_volatility, 4),
                        "bid": contract.bid,
                        "ask": contract.ask,
                        "mid": contract.mid,
                        "moneyness": contract.moneyness,
                        "premium_traded": round(notional, 0),
                        "flags": flags,
                        "sentiment": "bullish" if contract.option_type == OptionType.CALL else "bearish",
                    })

        # Sort by premium traded
        unusual.sort(key=lambda x: x.get("premium_traded", 0), reverse=True)
        return unusual[:50]  # Top 50 most unusual


# ─── Options Analytics Engine (Main Orchestrator) ────────────────────────────

class OptionsAnalyticsEngine:
    """
    Main orchestrator for all options analytics.
    """

    def __init__(self):
        self.fetcher = OptionsDataFetcher()
        self.bs = BlackScholes()
        self.binomial = BinomialTree()
        self.mc = MonteCarloPricer()
        self.iv_analyzer = IVAnalyzer()
        self.max_pain = MaxPainCalculator()
        self.unusual_scanner = UnusualActivityScanner()
        self.strategy_factory = StrategyFactory()
        self._chain_cache: Dict[str, Tuple[OptionsChain, float]] = {}

    async def get_chain(self, symbol: str, expiration: Optional[str] = None,
                         use_cache: bool = True) -> OptionsChain:
        """Get options chain with caching."""
        cache_key = f"{symbol}:{expiration or 'all'}"
        if use_cache and cache_key in self._chain_cache:
            chain, cached_at = self._chain_cache[cache_key]
            if time.time() - cached_at < 60:  # 1 minute cache
                return chain

        chain = await self.fetcher.fetch_chain(symbol, expiration)
        self._chain_cache[cache_key] = (chain, time.time())
        return chain

    async def price_option(self, S: float, K: float, T: float, sigma: float,
                            option_type: OptionType = OptionType.CALL,
                            model: str = "black-scholes",
                            r: float = RISK_FREE_RATE) -> Dict[str, Any]:
        """Price an option using specified model."""
        if model == "black-scholes":
            price = self.bs.price(S, K, T, r, sigma, option_type)
            greeks = self.bs.greeks(S, K, T, r, sigma, option_type)
            return {"price": round(price, 4), "greeks": greeks.to_dict(), "model": "Black-Scholes"}

        elif model == "binomial":
            price, greeks = self.binomial.price(S, K, T, r, sigma, option_type)
            return {"price": round(price, 4), "greeks": greeks.to_dict(), "model": "Binomial Tree"}

        elif model == "monte-carlo":
            price, se = self.mc.price(S, K, T, r, sigma, option_type)
            return {"price": round(price, 4), "standard_error": round(se, 6), "model": "Monte Carlo"}

        return {"error": f"Unknown model: {model}"}

    async def get_volatility_surface(self, symbol: str) -> Dict[str, Any]:
        """Build volatility surface for a symbol."""
        chain = await self.get_chain(symbol)
        surface = VolatilitySurface()
        surface.build(chain)
        return surface.to_dict()

    async def get_max_pain(self, symbol: str, expiration: str) -> Dict[str, Any]:
        """Calculate max pain for an expiration."""
        chain = await self.get_chain(symbol, expiration)
        return self.max_pain.calculate(chain, expiration)

    async def scan_unusual_activity(self, symbol: str) -> List[Dict[str, Any]]:
        """Scan for unusual options activity."""
        chain = await self.get_chain(symbol)
        return self.unusual_scanner.scan(chain)

    async def build_strategy(self, symbol: str, strategy_type: str,
                              params: Dict[str, Any]) -> Dict[str, Any]:
        """Build and analyze an options strategy."""
        chain = await self.get_chain(symbol)
        exp = params.get("expiration", chain.expirations[0] if chain.expirations else "")

        try:
            if strategy_type == "bull_call_spread":
                strategy = self.strategy_factory.bull_call_spread(
                    chain, exp, params["lower_strike"], params["upper_strike"]
                )
            elif strategy_type == "bear_put_spread":
                strategy = self.strategy_factory.bear_put_spread(
                    chain, exp, params["upper_strike"], params["lower_strike"]
                )
            elif strategy_type == "iron_condor":
                strategy = self.strategy_factory.iron_condor(
                    chain, exp, params["put_lower"], params["put_upper"],
                    params["call_lower"], params["call_upper"]
                )
            elif strategy_type == "straddle":
                strategy = self.strategy_factory.straddle(
                    chain, exp, params["strike"], params.get("long", True)
                )
            elif strategy_type == "strangle":
                strategy = self.strategy_factory.strangle(
                    chain, exp, params["put_strike"], params["call_strike"],
                    params.get("long", True)
                )
            elif strategy_type == "butterfly":
                strategy = self.strategy_factory.butterfly(
                    chain, exp, params["lower"], params["middle"], params["upper"]
                )
            elif strategy_type == "covered_call":
                strategy = self.strategy_factory.covered_call(
                    chain, exp, params["strike"]
                )
            else:
                return {"error": f"Unknown strategy: {strategy_type}"}

            result = strategy.to_dict()
            result["payoff_diagram"] = strategy.payoff_diagram()
            return result

        except Exception as e:
            return {"error": str(e)}

    async def analyze_position(self, positions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze a portfolio of options positions."""
        total_delta = 0.0
        total_gamma = 0.0
        total_theta = 0.0
        total_vega = 0.0
        total_notional = 0.0

        for pos in positions:
            qty = pos.get("quantity", 0)
            greeks = pos.get("greeks", {})
            total_delta += greeks.get("delta", 0) * qty
            total_gamma += greeks.get("gamma", 0) * qty
            total_theta += greeks.get("theta", 0) * qty
            total_vega += greeks.get("vega", 0) * qty
            total_notional += pos.get("mid", 0) * abs(qty) * 100

        return {
            "total_delta": round(total_delta, 4),
            "total_gamma": round(total_gamma, 4),
            "total_theta": round(total_theta, 4),
            "total_vega": round(total_vega, 4),
            "total_notional": round(total_notional, 2),
            "delta_neutral": abs(total_delta) < 0.05,
            "positions_count": len(positions),
        }
