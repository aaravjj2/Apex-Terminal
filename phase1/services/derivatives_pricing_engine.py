"""
Derivatives Pricing Engine — Exotic options, multi-asset options, structured products,
variance swaps, barrier options, Asian options, lookback, digital, cliquet,
autocallable, quanto, rainbow options, Greeks for all types.

Pure computation — no FastAPI dependencies.
"""

from __future__ import annotations

import math
import random
import statistics
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


# ── Enums ───────────────────────────────────────────────────────────────

class OptionStyle(str, Enum):
    EUROPEAN = "european"
    AMERICAN = "american"
    BERMUDAN = "bermudan"


class ExoticType(str, Enum):
    BARRIER = "barrier"
    ASIAN = "asian"
    LOOKBACK = "lookback"
    DIGITAL = "digital"
    COMPOUND = "compound"
    CHOOSER = "chooser"
    CLIQUET = "cliquet"
    RAINBOW = "rainbow"
    QUANTO = "quanto"
    VARIANCE_SWAP = "variance_swap"
    AUTOCALLABLE = "autocallable"
    RANGE_ACCRUAL = "range_accrual"
    POWER = "power"
    EXCHANGE = "exchange"
    SPREAD = "spread"


class BarrierType(str, Enum):
    UP_AND_IN = "up_and_in"
    UP_AND_OUT = "up_and_out"
    DOWN_AND_IN = "down_and_in"
    DOWN_AND_OUT = "down_and_out"


class AsianAverageType(str, Enum):
    ARITHMETIC = "arithmetic"
    GEOMETRIC = "geometric"


# ── Data Classes ────────────────────────────────────────────────────────

@dataclass
class OptionResult:
    """Result of an option pricing calculation."""
    price: float
    option_type: str
    delta: float = 0.0
    gamma: float = 0.0
    theta: float = 0.0
    vega: float = 0.0
    rho: float = 0.0
    lambda_leverage: float = 0.0
    intrinsic_value: float = 0.0
    time_value: float = 0.0

    def to_dict(self) -> dict:
        return {
            "price": round(self.price, 6),
            "option_type": self.option_type,
            "delta": round(self.delta, 6),
            "gamma": round(self.gamma, 6),
            "theta": round(self.theta, 6),
            "vega": round(self.vega, 6),
            "rho": round(self.rho, 6),
            "lambda": round(self.lambda_leverage, 4),
            "intrinsic_value": round(self.intrinsic_value, 6),
            "time_value": round(self.time_value, 6),
        }


@dataclass
class StructuredProductResult:
    price: float
    components: list[dict] = field(default_factory=list)
    participation_rate: float = 1.0
    max_return: float = 0.0
    protection_level: float = 0.0

    def to_dict(self) -> dict:
        return {
            "price": round(self.price, 6),
            "components": self.components,
            "participation_rate": round(self.participation_rate, 4),
            "max_return": round(self.max_return, 4),
            "protection_level": round(self.protection_level, 4),
        }


# ── Normal Distribution Utilities ────────────────────────────────────

class NormalDist:
    """Standard normal distribution functions."""

    @staticmethod
    def cdf(x: float) -> float:
        """Standard normal CDF using Abramowitz and Stegun approximation."""
        if x > 6:
            return 1.0
        if x < -6:
            return 0.0

        a1 = 0.254829592
        a2 = -0.284496736
        a3 = 1.421413741
        a4 = -1.453152027
        a5 = 1.061405429
        p = 0.3275911

        sign = 1 if x >= 0 else -1
        x_abs = abs(x)

        t = 1.0 / (1.0 + p * x_abs)
        y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * math.exp(-x_abs * x_abs / 2)

        return 0.5 * (1.0 + sign * y)

    @staticmethod
    def pdf(x: float) -> float:
        return math.exp(-x * x / 2) / math.sqrt(2 * math.pi)

    @staticmethod
    def inv_cdf(p: float) -> float:
        """Inverse standard normal CDF (Beasley-Springer-Moro)."""
        if p <= 0:
            return -6.0
        if p >= 1:
            return 6.0

        a = [0, -3.969683028665376e1, 2.209460984245205e2,
             -2.759285104469687e2, 1.383577518672690e2,
             -3.066479806614716e1, 2.506628277459239e0]
        b = [0, -5.447609879822406e1, 1.615858368580409e2,
             -1.556989798598866e2, 6.680131188771972e1,
             -1.328068155288572e1]
        c = [0, -7.784894002430293e-3, -3.223964580411365e-1,
             -2.400758277161838e0, -2.549732539343734e0,
             4.374664141464968e0, 2.938163982698783e0]
        d = [0, 7.784695709041462e-3, 3.224671290700398e-1,
             2.445134137142996e0, 3.754408661907416e0]

        p_low = 0.02425
        p_high = 1 - p_low

        if p < p_low:
            q = math.sqrt(-2 * math.log(p))
            return (((((c[1] * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) * q + c[6]) / \
                   ((((d[1] * q + d[2]) * q + d[3]) * q + d[4]) * q + 1)
        elif p <= p_high:
            q = p - 0.5
            r = q * q
            return (((((a[1] * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * r + a[6]) * q / \
                   (((((b[1] * r + b[2]) * r + b[3]) * r + b[4]) * r + b[5]) * r + 1)
        else:
            q = math.sqrt(-2 * math.log(1 - p))
            return -(((((c[1] * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) * q + c[6]) / \
                    ((((d[1] * q + d[2]) * q + d[3]) * q + d[4]) * q + 1)


# ── Black-Scholes Base ───────────────────────────────────────────────

class BlackScholesExotic:
    """Extended Black-Scholes for various option types."""

    @staticmethod
    def d1(S: float, K: float, r: float, q: float, sigma: float, T: float) -> float:
        if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
            return 0.0
        return (math.log(S / K) + (r - q + sigma ** 2 / 2) * T) / (sigma * math.sqrt(T))

    @staticmethod
    def d2(S: float, K: float, r: float, q: float, sigma: float, T: float) -> float:
        return BlackScholesExotic.d1(S, K, r, q, sigma, T) - sigma * math.sqrt(T)

    @staticmethod
    def call_price(S: float, K: float, r: float, q: float, sigma: float, T: float) -> float:
        if T <= 0:
            return max(S - K, 0)
        d1 = BlackScholesExotic.d1(S, K, r, q, sigma, T)
        d2 = d1 - sigma * math.sqrt(T)
        return S * math.exp(-q * T) * NormalDist.cdf(d1) - K * math.exp(-r * T) * NormalDist.cdf(d2)

    @staticmethod
    def put_price(S: float, K: float, r: float, q: float, sigma: float, T: float) -> float:
        if T <= 0:
            return max(K - S, 0)
        d1 = BlackScholesExotic.d1(S, K, r, q, sigma, T)
        d2 = d1 - sigma * math.sqrt(T)
        return K * math.exp(-r * T) * NormalDist.cdf(-d2) - S * math.exp(-q * T) * NormalDist.cdf(-d1)

    @staticmethod
    def greeks(S: float, K: float, r: float, q: float, sigma: float, T: float, is_call: bool = True) -> dict:
        if T <= 0 or sigma <= 0:
            return {"delta": 0, "gamma": 0, "theta": 0, "vega": 0, "rho": 0}

        d1 = BlackScholesExotic.d1(S, K, r, q, sigma, T)
        d2 = d1 - sigma * math.sqrt(T)
        sqrt_t = math.sqrt(T)

        gamma = NormalDist.pdf(d1) * math.exp(-q * T) / (S * sigma * sqrt_t)
        vega = S * math.exp(-q * T) * NormalDist.pdf(d1) * sqrt_t / 100

        if is_call:
            delta = math.exp(-q * T) * NormalDist.cdf(d1)
            theta = (-S * NormalDist.pdf(d1) * sigma * math.exp(-q * T) / (2 * sqrt_t)
                     + q * S * NormalDist.cdf(d1) * math.exp(-q * T)
                     - r * K * math.exp(-r * T) * NormalDist.cdf(d2)) / 365
            rho = K * T * math.exp(-r * T) * NormalDist.cdf(d2) / 100
        else:
            delta = math.exp(-q * T) * (NormalDist.cdf(d1) - 1)
            theta = (-S * NormalDist.pdf(d1) * sigma * math.exp(-q * T) / (2 * sqrt_t)
                     - q * S * NormalDist.cdf(-d1) * math.exp(-q * T)
                     + r * K * math.exp(-r * T) * NormalDist.cdf(-d2)) / 365
            rho = -K * T * math.exp(-r * T) * NormalDist.cdf(-d2) / 100

        return {
            "delta": round(delta, 6),
            "gamma": round(gamma, 6),
            "theta": round(theta, 6),
            "vega": round(vega, 6),
            "rho": round(rho, 6),
        }


# ── Barrier Options ──────────────────────────────────────────────────

class BarrierOptionPricer:
    """Barrier option pricing via closed-form and Monte Carlo."""

    @staticmethod
    def analytical_barrier(
        S: float, K: float, B: float,
        r: float, q: float, sigma: float, T: float,
        barrier_type: str = "down_and_out",
        is_call: bool = True,
        rebate: float = 0.0,
    ) -> float:
        """Analytical barrier option pricing."""
        if T <= 0 or sigma <= 0:
            return 0.0

        lam = (r - q + sigma ** 2 / 2) / (sigma ** 2)
        y = math.log(B ** 2 / (S * K)) / (sigma * math.sqrt(T)) + lam * sigma * math.sqrt(T)
        x1 = math.log(S / B) / (sigma * math.sqrt(T)) + lam * sigma * math.sqrt(T)
        y1 = math.log(B / S) / (sigma * math.sqrt(T)) + lam * sigma * math.sqrt(T)

        vanilla = BlackScholesExotic.call_price(S, K, r, q, sigma, T) if is_call else \
            BlackScholesExotic.put_price(S, K, r, q, sigma, T)

        if barrier_type == "down_and_out":
            if S <= B:
                return rebate * math.exp(-r * T)
            if is_call and K > B:
                # Standard down-and-out call
                di = (B / S) ** (2 * lam) * BlackScholesExotic.call_price(
                    B ** 2 / S, K, r, q, sigma, T)
                return vanilla - di
            return max(vanilla - rebate, 0)

        elif barrier_type == "down_and_in":
            if S <= B:
                return vanilla
            out = BarrierOptionPricer.analytical_barrier(
                S, K, B, r, q, sigma, T, "down_and_out", is_call, 0)
            return vanilla - out + rebate * math.exp(-r * T)

        elif barrier_type == "up_and_out":
            if S >= B:
                return rebate * math.exp(-r * T)
            if is_call and K < B:
                di = (B / S) ** (2 * lam) * BlackScholesExotic.call_price(
                    B ** 2 / S, K, r, q, sigma, T)
                return vanilla - di
            return max(vanilla - rebate, 0)

        elif barrier_type == "up_and_in":
            if S >= B:
                return vanilla
            out = BarrierOptionPricer.analytical_barrier(
                S, K, B, r, q, sigma, T, "up_and_out", is_call, 0)
            return vanilla - out + rebate * math.exp(-r * T)

        return vanilla

    @staticmethod
    def monte_carlo_barrier(
        S: float, K: float, B: float,
        r: float, q: float, sigma: float, T: float,
        barrier_type: str = "down_and_out",
        is_call: bool = True,
        n_paths: int = 50000,
        n_steps: int = 252,
        rebate: float = 0.0,
        seed: int = 42,
    ) -> OptionResult:
        """Monte Carlo barrier option pricing."""
        random.seed(seed)
        dt = T / n_steps
        drift = (r - q - 0.5 * sigma ** 2) * dt
        vol = sigma * math.sqrt(dt)

        payoffs = []
        for _ in range(n_paths):
            path = [S]
            breached = False

            for _ in range(n_steps):
                z = NormalDist.inv_cdf(random.random())
                new_price = path[-1] * math.exp(drift + vol * z)
                path.append(new_price)

                if barrier_type in ("down_and_out", "down_and_in") and new_price <= B:
                    breached = True
                elif barrier_type in ("up_and_out", "up_and_in") and new_price >= B:
                    breached = True

            spot_final = path[-1]
            intrinsic = max(spot_final - K, 0) if is_call else max(K - spot_final, 0)

            if barrier_type in ("down_and_out", "up_and_out"):
                payoff = rebate if breached else intrinsic
            else:  # knock-in
                payoff = intrinsic if breached else rebate

            payoffs.append(payoff)

        price = math.exp(-r * T) * statistics.mean(payoffs)
        return OptionResult(price=price, option_type=f"barrier_{barrier_type}")


# ── Asian Options ──────────────────────────────────────────────────────

class AsianOptionPricer:
    """Asian option pricing."""

    @staticmethod
    def geometric_asian_call(
        S: float, K: float, r: float, q: float, sigma: float, T: float, n: int = 252,
    ) -> float:
        """Closed-form geometric average Asian call."""
        sigma_a = sigma * math.sqrt((2 * n + 1) / (6 * (n + 1)))
        mu_a = (r - q - sigma ** 2 / 2) * (n + 1) / (2 * n) + sigma_a ** 2 / 2

        d1 = (math.log(S / K) + (mu_a + sigma_a ** 2 / 2) * T) / (sigma_a * math.sqrt(T))
        d2 = d1 - sigma_a * math.sqrt(T)

        return math.exp(-r * T) * (S * math.exp(mu_a * T) * NormalDist.cdf(d1) - K * NormalDist.cdf(d2))

    @staticmethod
    def geometric_asian_put(
        S: float, K: float, r: float, q: float, sigma: float, T: float, n: int = 252,
    ) -> float:
        sigma_a = sigma * math.sqrt((2 * n + 1) / (6 * (n + 1)))
        mu_a = (r - q - sigma ** 2 / 2) * (n + 1) / (2 * n) + sigma_a ** 2 / 2

        d1 = (math.log(S / K) + (mu_a + sigma_a ** 2 / 2) * T) / (sigma_a * math.sqrt(T))
        d2 = d1 - sigma_a * math.sqrt(T)

        return math.exp(-r * T) * (K * NormalDist.cdf(-d2) - S * math.exp(mu_a * T) * NormalDist.cdf(-d1))

    @staticmethod
    def monte_carlo_asian(
        S: float, K: float, r: float, q: float, sigma: float, T: float,
        is_call: bool = True,
        average_type: str = "arithmetic",
        n_paths: int = 50000,
        n_steps: int = 252,
        seed: int = 42,
    ) -> OptionResult:
        random.seed(seed)
        dt = T / n_steps
        drift = (r - q - 0.5 * sigma ** 2) * dt
        vol = sigma * math.sqrt(dt)

        payoffs = []
        for _ in range(n_paths):
            prices = [S]
            for _ in range(n_steps):
                z = NormalDist.inv_cdf(random.random())
                prices.append(prices[-1] * math.exp(drift + vol * z))

            if average_type == "arithmetic":
                avg = statistics.mean(prices[1:])
            else:
                log_prices = [math.log(p) for p in prices[1:]]
                avg = math.exp(statistics.mean(log_prices))

            if is_call:
                payoffs.append(max(avg - K, 0))
            else:
                payoffs.append(max(K - avg, 0))

        price = math.exp(-r * T) * statistics.mean(payoffs)
        return OptionResult(price=price, option_type=f"asian_{average_type}")


# ── Lookback Options ──────────────────────────────────────────────────

class LookbackOptionPricer:
    """Lookback option pricing."""

    @staticmethod
    def floating_lookback_call(
        S: float, S_min: float, r: float, q: float, sigma: float, T: float,
    ) -> float:
        """Floating strike lookback call: payoff = S_T - S_min."""
        if T <= 0:
            return max(S - S_min, 0)

        a1 = (math.log(S / S_min) + (r - q + sigma ** 2 / 2) * T) / (sigma * math.sqrt(T))
        a2 = a1 - sigma * math.sqrt(T)
        a3 = (math.log(S / S_min) + (-r + q + sigma ** 2 / 2) * T) / (sigma * math.sqrt(T))

        y = 2 * (r - q - sigma ** 2 / 2) / sigma ** 2

        price = (S * math.exp(-q * T) * NormalDist.cdf(a1)
                 - S_min * math.exp(-r * T) * NormalDist.cdf(a2)
                 + S * math.exp(-r * T) * (sigma ** 2 / (2 * (r - q))) *
                 (-math.exp(-q * T) * (S / S_min) ** (-y) * NormalDist.cdf(-a1 + y * sigma * math.sqrt(T))
                  + math.exp((r - q) * T) * NormalDist.cdf(-a3)))

        return max(price, 0)

    @staticmethod
    def floating_lookback_put(
        S: float, S_max: float, r: float, q: float, sigma: float, T: float,
    ) -> float:
        """Floating strike lookback put: payoff = S_max - S_T."""
        if T <= 0:
            return max(S_max - S, 0)

        b1 = (math.log(S / S_max) + (r - q + sigma ** 2 / 2) * T) / (sigma * math.sqrt(T))
        b2 = b1 - sigma * math.sqrt(T)
        b3 = (math.log(S / S_max) + (-r + q + sigma ** 2 / 2) * T) / (sigma * math.sqrt(T))

        y = 2 * (r - q - sigma ** 2 / 2) / sigma ** 2

        price = (-S * math.exp(-q * T) * NormalDist.cdf(-b1)
                 + S_max * math.exp(-r * T) * NormalDist.cdf(-b2)
                 + S * math.exp(-r * T) * (sigma ** 2 / (2 * (r - q))) *
                 (math.exp(-q * T) * (S / S_max) ** (-y) * NormalDist.cdf(b1 - y * sigma * math.sqrt(T))
                  - math.exp((r - q) * T) * NormalDist.cdf(b3)))

        return max(price, 0)

    @staticmethod
    def monte_carlo_lookback(
        S: float, r: float, q: float, sigma: float, T: float,
        is_call: bool = True,
        fixed_strike: Optional[float] = None,
        n_paths: int = 50000,
        n_steps: int = 252,
        seed: int = 42,
    ) -> OptionResult:
        random.seed(seed)
        dt = T / n_steps
        drift = (r - q - 0.5 * sigma ** 2) * dt
        vol = sigma * math.sqrt(dt)

        payoffs = []
        for _ in range(n_paths):
            prices = [S]
            for _ in range(n_steps):
                z = NormalDist.inv_cdf(random.random())
                prices.append(prices[-1] * math.exp(drift + vol * z))

            s_min = min(prices)
            s_max = max(prices)
            s_final = prices[-1]

            if fixed_strike is not None:
                if is_call:
                    payoffs.append(max(s_max - fixed_strike, 0))
                else:
                    payoffs.append(max(fixed_strike - s_min, 0))
            else:
                if is_call:
                    payoffs.append(s_final - s_min)
                else:
                    payoffs.append(s_max - s_final)

        price = math.exp(-r * T) * statistics.mean(payoffs)
        return OptionResult(price=price, option_type="lookback")


# ── Digital (Binary) Options ──────────────────────────────────────────

class DigitalOptionPricer:
    """Digital/binary option pricing."""

    @staticmethod
    def cash_or_nothing_call(
        S: float, K: float, r: float, q: float, sigma: float, T: float,
        cash_amount: float = 1.0,
    ) -> float:
        if T <= 0:
            return cash_amount if S > K else 0
        d2 = BlackScholesExotic.d2(S, K, r, q, sigma, T)
        return cash_amount * math.exp(-r * T) * NormalDist.cdf(d2)

    @staticmethod
    def cash_or_nothing_put(
        S: float, K: float, r: float, q: float, sigma: float, T: float,
        cash_amount: float = 1.0,
    ) -> float:
        if T <= 0:
            return cash_amount if S < K else 0
        d2 = BlackScholesExotic.d2(S, K, r, q, sigma, T)
        return cash_amount * math.exp(-r * T) * NormalDist.cdf(-d2)

    @staticmethod
    def asset_or_nothing_call(
        S: float, K: float, r: float, q: float, sigma: float, T: float,
    ) -> float:
        if T <= 0:
            return S if S > K else 0
        d1 = BlackScholesExotic.d1(S, K, r, q, sigma, T)
        return S * math.exp(-q * T) * NormalDist.cdf(d1)

    @staticmethod
    def asset_or_nothing_put(
        S: float, K: float, r: float, q: float, sigma: float, T: float,
    ) -> float:
        if T <= 0:
            return S if S < K else 0
        d1 = BlackScholesExotic.d1(S, K, r, q, sigma, T)
        return S * math.exp(-q * T) * NormalDist.cdf(-d1)

    @staticmethod
    def gap_option(
        S: float, K1: float, K2: float, r: float, q: float, sigma: float, T: float,
        is_call: bool = True,
    ) -> float:
        """Gap option: triggers at K1, pays based on K2."""
        if T <= 0:
            if is_call:
                return max(S - K2, 0) if S > K1 else 0
            return max(K2 - S, 0) if S < K1 else 0

        d1 = BlackScholesExotic.d1(S, K1, r, q, sigma, T)
        d2 = BlackScholesExotic.d2(S, K1, r, q, sigma, T)

        if is_call:
            return S * math.exp(-q * T) * NormalDist.cdf(d1) - K2 * math.exp(-r * T) * NormalDist.cdf(d2)
        else:
            return K2 * math.exp(-r * T) * NormalDist.cdf(-d2) - S * math.exp(-q * T) * NormalDist.cdf(-d1)


# ── Compound Options ──────────────────────────────────────────────────

class CompoundOptionPricer:
    """Compound option (option on option) pricing."""

    @staticmethod
    def price(
        S: float, K1: float, K2: float,
        r: float, q: float, sigma: float,
        T1: float, T2: float,
        outer_call: bool = True,
        inner_call: bool = True,
        n_simulations: int = 50000,
        seed: int = 42,
    ) -> OptionResult:
        """Price a compound option via Monte Carlo."""
        random.seed(seed)

        payoffs = []
        drift = (r - q - 0.5 * sigma ** 2)

        for _ in range(n_simulations):
            z1 = NormalDist.inv_cdf(random.random())
            S_T1 = S * math.exp(drift * T1 + sigma * math.sqrt(T1) * z1)

            # Inner option value at T1
            remaining = T2 - T1
            if inner_call:
                inner_value = BlackScholesExotic.call_price(S_T1, K2, r, q, sigma, remaining)
            else:
                inner_value = BlackScholesExotic.put_price(S_T1, K2, r, q, sigma, remaining)

            # Outer option payoff
            if outer_call:
                payoff = max(inner_value - K1, 0)
            else:
                payoff = max(K1 - inner_value, 0)

            payoffs.append(payoff)

        price = math.exp(-r * T1) * statistics.mean(payoffs)
        return OptionResult(price=price, option_type="compound")


# ── Chooser Options ──────────────────────────────────────────────────

class ChooserOptionPricer:
    """Chooser (as-you-like-it) option pricing."""

    @staticmethod
    def simple_chooser(
        S: float, K: float, r: float, q: float, sigma: float,
        T_choose: float, T_expiry: float,
    ) -> float:
        """Simple chooser option: choose call or put at T_choose."""
        call = BlackScholesExotic.call_price(S, K, r, q, sigma, T_expiry)
        put_adjustment = K * math.exp(-r * (T_expiry - T_choose)) - S * math.exp(-q * (T_expiry - T_choose))

        d = BlackScholesExotic.d1(S, K * math.exp(-(r - q) * (T_expiry - T_choose)), r, q, sigma, T_choose)

        return call + BlackScholesExotic.put_price(
            S, K * math.exp(-(r - q) * (T_expiry - T_choose)), r, q, sigma, T_choose)


# ── Cliquet / Ratchet Options ────────────────────────────────────────

class CliquetOptionPricer:
    """Cliquet (ratchet) option pricing via Monte Carlo."""

    @staticmethod
    def price(
        S: float, r: float, q: float, sigma: float,
        T: float, n_resets: int,
        local_floor: float = 0.0,
        local_cap: float = float("inf"),
        global_floor: float = 0.0,
        global_cap: float = float("inf"),
        n_paths: int = 50000,
        seed: int = 42,
    ) -> OptionResult:
        random.seed(seed)
        dt = T / n_resets
        drift = (r - q - 0.5 * sigma ** 2) * dt
        vol = sigma * math.sqrt(dt)

        payoffs = []
        for _ in range(n_paths):
            total_return = 0.0
            s = S

            for _ in range(n_resets):
                z = NormalDist.inv_cdf(random.random())
                s_new = s * math.exp(drift + vol * z)
                local_ret = (s_new - s) / s

                # Apply local floor and cap
                local_ret = max(local_floor, min(local_cap, local_ret))
                total_return += local_ret
                s = s_new

            # Apply global floor and cap
            total_return = max(global_floor, min(global_cap, total_return))
            payoffs.append(S * total_return)

        price = math.exp(-r * T) * statistics.mean(payoffs)
        return OptionResult(price=max(price, 0), option_type="cliquet")


# ── Rainbow Options ──────────────────────────────────────────────────

class RainbowOptionPricer:
    """Multi-asset rainbow option pricing."""

    @staticmethod
    def best_of_two_call(
        S1: float, S2: float, K: float,
        r: float, q1: float, q2: float,
        sigma1: float, sigma2: float,
        rho: float, T: float,
        n_paths: int = 50000,
        seed: int = 42,
    ) -> OptionResult:
        """Call on the best of two assets."""
        random.seed(seed)
        dt = T
        drift1 = (r - q1 - 0.5 * sigma1 ** 2) * dt
        drift2 = (r - q2 - 0.5 * sigma2 ** 2) * dt

        payoffs = []
        for _ in range(n_paths):
            z1 = NormalDist.inv_cdf(random.random())
            z_indep = NormalDist.inv_cdf(random.random())
            z2 = rho * z1 + math.sqrt(1 - rho ** 2) * z_indep

            s1_t = S1 * math.exp(drift1 + sigma1 * math.sqrt(dt) * z1)
            s2_t = S2 * math.exp(drift2 + sigma2 * math.sqrt(dt) * z2)

            payoffs.append(max(max(s1_t, s2_t) - K, 0))

        price = math.exp(-r * T) * statistics.mean(payoffs)
        return OptionResult(price=price, option_type="rainbow_best_of_two")

    @staticmethod
    def worst_of_two_call(
        S1: float, S2: float, K: float,
        r: float, q1: float, q2: float,
        sigma1: float, sigma2: float,
        rho: float, T: float,
        n_paths: int = 50000,
        seed: int = 42,
    ) -> OptionResult:
        random.seed(seed)
        dt = T
        drift1 = (r - q1 - 0.5 * sigma1 ** 2) * dt
        drift2 = (r - q2 - 0.5 * sigma2 ** 2) * dt

        payoffs = []
        for _ in range(n_paths):
            z1 = NormalDist.inv_cdf(random.random())
            z_indep = NormalDist.inv_cdf(random.random())
            z2 = rho * z1 + math.sqrt(1 - rho ** 2) * z_indep

            s1_t = S1 * math.exp(drift1 + sigma1 * math.sqrt(dt) * z1)
            s2_t = S2 * math.exp(drift2 + sigma2 * math.sqrt(dt) * z2)

            payoffs.append(max(min(s1_t, s2_t) - K, 0))

        price = math.exp(-r * T) * statistics.mean(payoffs)
        return OptionResult(price=price, option_type="rainbow_worst_of_two")

    @staticmethod
    def spread_option(
        S1: float, S2: float, K: float,
        r: float, q1: float, q2: float,
        sigma1: float, sigma2: float,
        rho: float, T: float,
        n_paths: int = 50000,
        seed: int = 42,
    ) -> OptionResult:
        random.seed(seed)
        dt = T
        drift1 = (r - q1 - 0.5 * sigma1 ** 2) * dt
        drift2 = (r - q2 - 0.5 * sigma2 ** 2) * dt

        payoffs = []
        for _ in range(n_paths):
            z1 = NormalDist.inv_cdf(random.random())
            z_indep = NormalDist.inv_cdf(random.random())
            z2 = rho * z1 + math.sqrt(1 - rho ** 2) * z_indep

            s1_t = S1 * math.exp(drift1 + sigma1 * math.sqrt(dt) * z1)
            s2_t = S2 * math.exp(drift2 + sigma2 * math.sqrt(dt) * z2)

            payoffs.append(max(s1_t - s2_t - K, 0))

        price = math.exp(-r * T) * statistics.mean(payoffs)
        return OptionResult(price=price, option_type="spread")


# ── Variance Swap ──────────────────────────────────────────────────────

class VarianceSwapPricer:
    """Variance and volatility swap pricing."""

    @staticmethod
    def realized_variance(returns: list[float], annualization: int = 252) -> float:
        if len(returns) < 2:
            return 0.0
        return statistics.variance(returns) * annualization

    @staticmethod
    def fair_strike(
        sigma: float,
        T: float,
        r: float = 0.0,
    ) -> float:
        """Fair variance strike in a simple model."""
        return sigma ** 2

    @staticmethod
    def price(
        realized_var: float,
        var_strike: float,
        notional: float,
        T_remaining: float,
        T_total: float,
        r: float = 0.0,
    ) -> dict:
        """Mark-to-market a variance swap."""
        t_elapsed = T_total - T_remaining
        t_ratio = t_elapsed / T_total if T_total > 0 else 0

        # Expected total variance
        expected_var = t_ratio * realized_var + (1 - t_ratio) * var_strike

        pnl = notional * (expected_var - var_strike)
        pv = pnl * math.exp(-r * T_remaining)

        return {
            "realized_variance": round(realized_var, 6),
            "variance_strike": round(var_strike, 6),
            "expected_variance": round(expected_var, 6),
            "pnl": round(pnl, 2),
            "present_value": round(pv, 2),
            "notional": notional,
        }


# ── Autocallable ──────────────────────────────────────────────────────

class AutocallablePricer:
    """Autocallable structured product pricing."""

    @staticmethod
    def price(
        S: float,
        autocall_barrier: float,  # e.g., 1.05 * S
        coupon: float,  # per observation period
        knock_in_barrier: float,  # put knock-in, e.g., 0.70 * S
        observation_dates: int = 4,  # quarterly over 1 year
        T: float = 1.0,
        r: float = 0.05,
        q: float = 0.02,
        sigma: float = 0.25,
        face_value: float = 1000.0,
        n_paths: int = 50000,
        seed: int = 42,
    ) -> StructuredProductResult:
        random.seed(seed)
        dt = T / observation_dates
        drift = (r - q - 0.5 * sigma ** 2) * dt
        vol = sigma * math.sqrt(dt)

        payoffs = []
        autocalled_count = 0
        ki_count = 0

        for _ in range(n_paths):
            s = S
            autocalled = False
            knock_in = False

            for obs in range(1, observation_dates + 1):
                z = NormalDist.inv_cdf(random.random())
                s = s * math.exp(drift + vol * z)

                if s <= knock_in_barrier:
                    knock_in = True

                if s >= autocall_barrier:
                    # Autocalled: receive face + coupon × obs periods
                    payoff = face_value * (1 + coupon * obs)
                    payoff *= math.exp(-r * obs * dt)
                    payoffs.append(payoff)
                    autocalled = True
                    autocalled_count += 1
                    break

            if not autocalled:
                if knock_in:
                    ki_count += 1
                    final_return = s / S
                    payoff = face_value * final_return
                else:
                    payoff = face_value * (1 + coupon * observation_dates)
                payoffs.append(payoff * math.exp(-r * T))

        price = statistics.mean(payoffs)

        return StructuredProductResult(
            price=price,
            components=[
                {"type": "autocall_probability", "value": autocalled_count / n_paths},
                {"type": "knock_in_probability", "value": ki_count / n_paths},
                {"type": "face_value", "value": face_value},
                {"type": "coupon_per_period", "value": coupon},
            ],
            protection_level=knock_in_barrier / S,
        )


# ── Power Options ──────────────────────────────────────────────────────

class PowerOptionPricer:
    """Power option pricing."""

    @staticmethod
    def powered_call(
        S: float, K: float, r: float, q: float, sigma: float, T: float,
        power: float = 2.0,
        n_paths: int = 50000,
        seed: int = 42,
    ) -> float:
        """max(S^power - K, 0)"""
        random.seed(seed)
        drift = (r - q - 0.5 * sigma ** 2) * T
        vol = sigma * math.sqrt(T)

        payoffs = []
        for _ in range(n_paths):
            z = NormalDist.inv_cdf(random.random())
            s_t = S * math.exp(drift + vol * z)
            payoffs.append(max(s_t ** power - K, 0))

        return math.exp(-r * T) * statistics.mean(payoffs)

    @staticmethod
    def asymmetric_power(
        S: float, K: float, r: float, q: float, sigma: float, T: float,
        power: float = 2.0,
        is_call: bool = True,
        n_paths: int = 50000,
        seed: int = 42,
    ) -> float:
        """(max(S-K, 0))^power"""
        random.seed(seed)
        drift = (r - q - 0.5 * sigma ** 2) * T
        vol = sigma * math.sqrt(T)

        payoffs = []
        for _ in range(n_paths):
            z = NormalDist.inv_cdf(random.random())
            s_t = S * math.exp(drift + vol * z)
            if is_call:
                payoffs.append(max(s_t - K, 0) ** power)
            else:
                payoffs.append(max(K - s_t, 0) ** power)

        return math.exp(-r * T) * statistics.mean(payoffs)


# ── Exchange Options ──────────────────────────────────────────────────

class ExchangeOptionPricer:
    """Margrabe's exchange option."""

    @staticmethod
    def price(
        S1: float, S2: float,
        q1: float, q2: float,
        sigma1: float, sigma2: float,
        rho: float, T: float,
    ) -> float:
        """Price of an option to exchange asset 2 for asset 1."""
        if T <= 0:
            return max(S1 - S2, 0)

        sigma = math.sqrt(sigma1 ** 2 + sigma2 ** 2 - 2 * rho * sigma1 * sigma2)
        d1 = (math.log(S1 / S2) + (q2 - q1 + sigma ** 2 / 2) * T) / (sigma * math.sqrt(T))
        d2 = d1 - sigma * math.sqrt(T)

        return S1 * math.exp(-q1 * T) * NormalDist.cdf(d1) - S2 * math.exp(-q2 * T) * NormalDist.cdf(d2)


# ── Structured Products ──────────────────────────────────────────────

class StructuredProductEngine:
    """Structured product decomposition and pricing."""

    @staticmethod
    def principal_protected_note(
        face_value: float,
        S: float, K: float,
        r: float, q: float, sigma: float, T: float,
        participation_rate: float = 1.0,
    ) -> StructuredProductResult:
        """Principal-protected note = zero coupon bond + call option."""
        bond_pv = face_value * math.exp(-r * T)
        option_budget = face_value - bond_pv
        call = BlackScholesExotic.call_price(S, K, r, q, sigma, T)

        # How many options can we buy?
        n_options = option_budget / call if call > 0 else 0
        effective_participation = n_options * S / face_value

        price = bond_pv + n_options * call

        return StructuredProductResult(
            price=price,
            components=[
                {"type": "zero_coupon_bond", "value": round(bond_pv, 2)},
                {"type": "call_option", "value": round(n_options * call, 2)},
            ],
            participation_rate=round(effective_participation, 4),
            protection_level=1.0,
        )

    @staticmethod
    def reverse_convertible(
        face_value: float,
        S: float, K: float,
        r: float, q: float, sigma: float, T: float,
        coupon_rate: float = 0.10,
    ) -> StructuredProductResult:
        """Reverse convertible = bond + short put."""
        bond_pv = face_value * (1 + coupon_rate) * math.exp(-r * T)
        put = BlackScholesExotic.put_price(S, K, r, q, sigma, T)
        # Note: investor is short the put (receives premium embedded in coupon)
        price = bond_pv - put * face_value / S

        return StructuredProductResult(
            price=price,
            components=[
                {"type": "coupon_bond", "value": round(bond_pv, 2)},
                {"type": "short_put", "value": round(-put * face_value / S, 2)},
            ],
            max_return=coupon_rate,
        )

    @staticmethod
    def bull_spread_note(
        face_value: float,
        S: float, K1: float, K2: float,
        r: float, q: float, sigma: float, T: float,
    ) -> StructuredProductResult:
        """Bull spread note = bond + call spread."""
        bond_pv = face_value * math.exp(-r * T)
        long_call = BlackScholesExotic.call_price(S, K1, r, q, sigma, T)
        short_call = BlackScholesExotic.call_price(S, K2, r, q, sigma, T)
        spread = long_call - short_call

        n_spreads = (face_value - bond_pv) / spread if spread > 0 else 0
        price = bond_pv + n_spreads * spread

        return StructuredProductResult(
            price=price,
            components=[
                {"type": "zero_coupon_bond", "value": round(bond_pv, 2)},
                {"type": "long_call", "value": round(n_spreads * long_call, 2)},
                {"type": "short_call", "value": round(-n_spreads * short_call, 2)},
            ],
            protection_level=1.0,
            max_return=round((K2 - K1) / S * n_spreads, 4),
        )


# ── Orchestrator ──────────────────────────────────────────────────────

class DerivativesPricingEngine:
    """Top-level orchestrator for derivatives pricing."""

    def __init__(self) -> None:
        self.bs = BlackScholesExotic()
        self.barrier = BarrierOptionPricer()
        self.asian = AsianOptionPricer()
        self.lookback = LookbackOptionPricer()
        self.digital = DigitalOptionPricer()
        self.compound = CompoundOptionPricer()
        self.chooser = ChooserOptionPricer()
        self.cliquet = CliquetOptionPricer()
        self.rainbow = RainbowOptionPricer()
        self.variance = VarianceSwapPricer()
        self.autocallable = AutocallablePricer()
        self.power = PowerOptionPricer()
        self.exchange = ExchangeOptionPricer()
        self.structured = StructuredProductEngine()

    def price_vanilla(self, S, K, r, q, sigma, T, is_call=True) -> dict:
        if is_call:
            price = self.bs.call_price(S, K, r, q, sigma, T)
        else:
            price = self.bs.put_price(S, K, r, q, sigma, T)
        greeks = self.bs.greeks(S, K, r, q, sigma, T, is_call)
        return {"price": round(price, 6), **greeks}

    def price_barrier(self, S, K, B, r, q, sigma, T, barrier_type="down_and_out", is_call=True) -> dict:
        result = self.barrier.monte_carlo_barrier(S, K, B, r, q, sigma, T, barrier_type, is_call)
        return result.to_dict()

    def price_asian(self, S, K, r, q, sigma, T, is_call=True, avg_type="arithmetic") -> dict:
        result = self.asian.monte_carlo_asian(S, K, r, q, sigma, T, is_call, avg_type)
        return result.to_dict()

    def price_lookback(self, S, r, q, sigma, T, is_call=True, strike=None) -> dict:
        result = self.lookback.monte_carlo_lookback(S, r, q, sigma, T, is_call, strike)
        return result.to_dict()

    def price_digital(self, S, K, r, q, sigma, T, is_call=True, cash=1.0) -> dict:
        if is_call:
            price = self.digital.cash_or_nothing_call(S, K, r, q, sigma, T, cash)
        else:
            price = self.digital.cash_or_nothing_put(S, K, r, q, sigma, T, cash)
        return {"price": round(price, 6), "type": "digital"}

    def price_rainbow(self, S1, S2, K, r, q1, q2, sigma1, sigma2, rho, T, best=True) -> dict:
        if best:
            result = self.rainbow.best_of_two_call(S1, S2, K, r, q1, q2, sigma1, sigma2, rho, T)
        else:
            result = self.rainbow.worst_of_two_call(S1, S2, K, r, q1, q2, sigma1, sigma2, rho, T)
        return result.to_dict()

    def price_autocallable(self, S, barrier, coupon, ki_barrier, obs_dates=4, T=1.0, r=0.05, sigma=0.25) -> dict:
        result = self.autocallable.price(S, barrier, coupon, ki_barrier, obs_dates, T, r, sigma=sigma)
        return result.to_dict()

    def capabilities(self) -> dict:
        return {
            "engine": "DerivativesPricingEngine",
            "version": "1.0.0",
            "features": [
                "european_options (Black-Scholes, full Greeks)",
                "barrier_options (up/down, in/out, analytical + MC)",
                "asian_options (arithmetic/geometric, MC)",
                "lookback_options (floating/fixed strike, closed-form + MC)",
                "digital_options (cash-or-nothing, asset-or-nothing, gap)",
                "compound_options (option on option, MC)",
                "chooser_options (simple chooser)",
                "cliquet_options (local/global floors/caps, MC)",
                "rainbow_options (best/worst of two, spread, MC)",
                "variance_swaps (pricing, mark-to-market)",
                "autocallable_products (barrier + coupon, MC)",
                "power_options (symmetric/asymmetric)",
                "exchange_options (Margrabe formula)",
                "structured_products (PPN, reverse convertible, bull spread note)",
            ],
        }
