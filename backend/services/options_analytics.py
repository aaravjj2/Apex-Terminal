"""
Options Analytics Engine — §4.1–§4.4
=====================================
Full options analytics: chain data, Greeks, volatility surface,
implied volatility, strategy builder, pricing models.

Uses Polygon/Tradier for real options data with yfinance fallback.
"""

import os
import math
import logging
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from dataclasses import dataclass, field, asdict
from enum import Enum
from functools import lru_cache

import httpx

logger = logging.getLogger("options_analytics")

POLYGON_KEY = os.getenv("POLYGON_API_KEY", "")
TRADIER_KEY = os.getenv("TRADIER_API_KEY", "")
FINNHUB_KEY = os.getenv("FINNHUB_API_KEY", "")
TWELVE_KEY = os.getenv("TWELVEDATA_API_KEY", "")

RISK_FREE_RATE = 0.052  # ~5.2% current risk-free rate


# ═══════════════════════════════════════════════════════════════════════════════
# §4.4 — PRICING MODELS
# ═══════════════════════════════════════════════════════════════════════════════

def norm_cdf(x: float) -> float:
    """Standard normal CDF using error function approximation."""
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def norm_pdf(x: float) -> float:
    """Standard normal PDF."""
    return math.exp(-0.5 * x * x) / math.sqrt(2.0 * math.pi)


class BlackScholes:
    """Black-Scholes-Merton option pricing model."""

    @staticmethod
    def d1(S: float, K: float, T: float, r: float, sigma: float, q: float = 0.0) -> float:
        if T <= 0 or sigma <= 0:
            return 0.0
        return (math.log(S / K) + (r - q + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))

    @staticmethod
    def d2(S: float, K: float, T: float, r: float, sigma: float, q: float = 0.0) -> float:
        return BlackScholes.d1(S, K, T, r, sigma, q) - sigma * math.sqrt(T)

    @staticmethod
    def call_price(S: float, K: float, T: float, r: float, sigma: float, q: float = 0.0) -> float:
        if T <= 0:
            return max(S - K, 0.0)
        d1 = BlackScholes.d1(S, K, T, r, sigma, q)
        d2 = BlackScholes.d2(S, K, T, r, sigma, q)
        return S * math.exp(-q * T) * norm_cdf(d1) - K * math.exp(-r * T) * norm_cdf(d2)

    @staticmethod
    def put_price(S: float, K: float, T: float, r: float, sigma: float, q: float = 0.0) -> float:
        if T <= 0:
            return max(K - S, 0.0)
        d1 = BlackScholes.d1(S, K, T, r, sigma, q)
        d2 = BlackScholes.d2(S, K, T, r, sigma, q)
        return K * math.exp(-r * T) * norm_cdf(-d2) - S * math.exp(-q * T) * norm_cdf(-d1)


# ═══════════════════════════════════════════════════════════════════════════════
# GREEKS CALCULATION
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class Greeks:
    """Full Greeks for an option position."""
    delta: float = 0.0
    gamma: float = 0.0
    theta: float = 0.0
    vega: float = 0.0
    rho: float = 0.0
    lambda_: float = 0.0  # leverage ratio (omega)
    vanna: float = 0.0    # d(delta)/d(vol)
    volga: float = 0.0    # d(vega)/d(vol) aka vomma
    charm: float = 0.0    # d(delta)/d(time)
    speed: float = 0.0    # d(gamma)/d(spot)
    color: float = 0.0    # d(gamma)/d(time)
    dual_delta: float = 0.0  # d(price)/d(strike)
    dual_gamma: float = 0.0  # d²(price)/d(strike)²


class GreeksCalculator:
    """Calculate all Greeks for European options using Black-Scholes."""

    @staticmethod
    def calculate(S: float, K: float, T: float, r: float, sigma: float,
                  option_type: str = "call", q: float = 0.0) -> Greeks:
        if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
            return Greeks()

        d1 = BlackScholes.d1(S, K, T, r, sigma, q)
        d2 = d1 - sigma * math.sqrt(T)
        sqrt_T = math.sqrt(T)
        exp_qT = math.exp(-q * T)
        exp_rT = math.exp(-r * T)
        nd1 = norm_pdf(d1)

        g = Greeks()

        # Delta
        if option_type == "call":
            g.delta = exp_qT * norm_cdf(d1)
        else:
            g.delta = -exp_qT * norm_cdf(-d1)

        # Gamma (same for call and put)
        g.gamma = exp_qT * nd1 / (S * sigma * sqrt_T)

        # Theta
        term1 = -(S * sigma * exp_qT * nd1) / (2 * sqrt_T)
        if option_type == "call":
            term2 = -r * K * exp_rT * norm_cdf(d2)
            term3 = q * S * exp_qT * norm_cdf(d1)
        else:
            term2 = r * K * exp_rT * norm_cdf(-d2)
            term3 = -q * S * exp_qT * norm_cdf(-d1)
        g.theta = (term1 + term2 + term3) / 365.0  # Per calendar day

        # Vega
        g.vega = S * exp_qT * nd1 * sqrt_T / 100.0  # Per 1% vol change

        # Rho
        if option_type == "call":
            g.rho = K * T * exp_rT * norm_cdf(d2) / 100.0
        else:
            g.rho = -K * T * exp_rT * norm_cdf(-d2) / 100.0

        # Lambda (leverage)
        price = BlackScholes.call_price(S, K, T, r, sigma, q) if option_type == "call" else BlackScholes.put_price(S, K, T, r, sigma, q)
        if price > 0:
            g.lambda_ = g.delta * S / price

        # Vanna: d(delta)/d(sigma)
        g.vanna = -exp_qT * nd1 * d2 / sigma

        # Volga (Vomma): d(vega)/d(sigma)
        g.volga = S * exp_qT * nd1 * sqrt_T * d1 * d2 / sigma / 100.0

        # Charm: d(delta)/d(time)
        charm_term = exp_qT * nd1 * (2 * (r - q) * T - d2 * sigma * sqrt_T) / (2 * T * sigma * sqrt_T)
        if option_type == "call":
            g.charm = q * exp_qT * norm_cdf(d1) - charm_term
        else:
            g.charm = -q * exp_qT * norm_cdf(-d1) - charm_term
        g.charm /= 365.0

        # Speed: d(gamma)/d(S)
        g.speed = -(g.gamma / S) * (1 + d1 / (sigma * sqrt_T))

        # Color: d(gamma)/d(time)
        g.color = -exp_qT * nd1 / (2 * S * T * sigma * sqrt_T) * (
            2 * q * T + 1 + d1 * (2 * (r - q) * T - d2 * sigma * sqrt_T) / (sigma * sqrt_T)
        ) / 365.0

        # Dual Delta
        if option_type == "call":
            g.dual_delta = -exp_rT * norm_cdf(d2)
        else:
            g.dual_delta = exp_rT * norm_cdf(-d2)

        # Dual Gamma
        g.dual_gamma = exp_rT * nd1 / (K * sigma * sqrt_T)

        return g


# ═══════════════════════════════════════════════════════════════════════════════
# IMPLIED VOLATILITY
# ═══════════════════════════════════════════════════════════════════════════════

class ImpliedVolatility:
    """Calculate implied volatility using Newton-Raphson and bisection."""

    @staticmethod
    def newton_raphson(market_price: float, S: float, K: float, T: float,
                       r: float, option_type: str = "call", q: float = 0.0,
                       max_iter: int = 100, tol: float = 1e-8) -> float:
        """Newton-Raphson method for implied volatility."""
        if T <= 0 or market_price <= 0:
            return 0.0

        # Initial guess using Brenner-Subrahmanyam approximation
        sigma = math.sqrt(2 * math.pi / T) * market_price / S

        for _ in range(max_iter):
            if option_type == "call":
                price = BlackScholes.call_price(S, K, T, r, sigma, q)
            else:
                price = BlackScholes.put_price(S, K, T, r, sigma, q)

            diff = price - market_price
            if abs(diff) < tol:
                return sigma

            # Vega
            d1 = BlackScholes.d1(S, K, T, r, sigma, q)
            vega = S * math.exp(-q * T) * norm_pdf(d1) * math.sqrt(T)

            if abs(vega) < 1e-12:
                break

            sigma -= diff / vega
            sigma = max(0.001, min(sigma, 10.0))  # Clamp

        return sigma

    @staticmethod
    def bisection(market_price: float, S: float, K: float, T: float,
                  r: float, option_type: str = "call", q: float = 0.0,
                  max_iter: int = 200, tol: float = 1e-8) -> float:
        """Bisection method — more robust for extreme cases."""
        low, high = 0.001, 5.0

        for _ in range(max_iter):
            mid = (low + high) / 2
            if option_type == "call":
                price = BlackScholes.call_price(S, K, T, r, mid, q)
            else:
                price = BlackScholes.put_price(S, K, T, r, mid, q)

            if abs(price - market_price) < tol:
                return mid

            if price > market_price:
                high = mid
            else:
                low = mid

        return (low + high) / 2

    @staticmethod
    def solve(market_price: float, S: float, K: float, T: float, r: float,
              option_type: str = "call", q: float = 0.0) -> float:
        """Solve IV using Newton-Raphson with bisection fallback."""
        try:
            iv = ImpliedVolatility.newton_raphson(market_price, S, K, T, r, option_type, q)
            if 0.001 < iv < 5.0:
                return iv
        except Exception:
            pass
        return ImpliedVolatility.bisection(market_price, S, K, T, r, option_type, q)


# ═══════════════════════════════════════════════════════════════════════════════
# §4.2 — VOLATILITY SURFACE
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class VolSurfacePoint:
    strike: float
    expiration: str
    iv: float
    moneyness: float  # K/S
    time_to_expiry: float  # years
    option_type: str = "call"


class VolatilitySurface:
    """Build and interpolate the volatility surface (smile/skew)."""

    def __init__(self, spot: float, risk_free: float = RISK_FREE_RATE):
        self.spot = spot
        self.risk_free = risk_free
        self.points: list[VolSurfacePoint] = []
        self.skew_params: dict[str, dict] = {}

    def add_point(self, strike: float, expiration: str, iv: float, option_type: str = "call"):
        exp_date = datetime.strptime(expiration, "%Y-%m-%d") if isinstance(expiration, str) else expiration
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        tte = max((exp_date - now).days / 365.0, 0.001)
        moneyness = strike / self.spot

        self.points.append(VolSurfacePoint(
            strike=strike, expiration=expiration, iv=iv,
            moneyness=moneyness, time_to_expiry=tte,
            option_type=option_type,
        ))

    def build_from_chain(self, chain: list[dict]):
        """Build surface from options chain data."""
        for opt in chain:
            if opt.get("iv") and opt.get("iv") > 0:
                self.add_point(
                    strike=float(opt["strike"]),
                    expiration=opt["expiration"],
                    iv=float(opt["iv"]),
                    option_type=opt.get("option_type", "call"),
                )

    def interpolate(self, strike: float, expiration: str) -> float:
        """Bilinear interpolation of IV at given strike/expiry."""
        if not self.points:
            return 0.20  # Default 20% vol

        exp_date = datetime.strptime(expiration, "%Y-%m-%d") if isinstance(expiration, str) else expiration
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        target_tte = max((exp_date - now).days / 365.0, 0.001)
        target_moneyness = strike / self.spot

        # Find nearest points
        weighted_iv = 0.0
        total_weight = 0.0

        for p in self.points:
            dm = abs(p.moneyness - target_moneyness)
            dt = abs(p.time_to_expiry - target_tte)
            dist = math.sqrt(dm ** 2 + dt ** 2)
            if dist < 0.001:
                return p.iv
            weight = 1.0 / (dist ** 2)
            weighted_iv += p.iv * weight
            total_weight += weight

        return weighted_iv / total_weight if total_weight > 0 else 0.20

    def get_smile(self, expiration: str) -> list[dict]:
        """Get volatility smile for a given expiration."""
        smile_points = [p for p in self.points if p.expiration == expiration]
        smile_points.sort(key=lambda p: p.strike)
        return [{"strike": p.strike, "iv": p.iv, "moneyness": p.moneyness} for p in smile_points]

    def get_term_structure(self, moneyness: float = 1.0, tolerance: float = 0.05) -> list[dict]:
        """Get term structure (IV vs time) at fixed moneyness."""
        atm_points = [p for p in self.points if abs(p.moneyness - moneyness) < tolerance]
        atm_points.sort(key=lambda p: p.time_to_expiry)

        # Average IV per expiry
        by_exp: dict[str, list[float]] = {}
        for p in atm_points:
            by_exp.setdefault(p.expiration, []).append(p.iv)

        return [
            {"expiration": exp, "iv": sum(ivs) / len(ivs), "tte": atm_points[0].time_to_expiry}
            for exp, ivs in by_exp.items()
        ]

    def get_skew(self, expiration: str) -> dict:
        """Calculate volatility skew metrics."""
        smile = self.get_smile(expiration)
        if len(smile) < 3:
            return {"skew": 0, "kurtosis": 0}

        ivs = [p["iv"] for p in smile]
        moneyness = [p["moneyness"] for p in smile]

        # Find ATM
        atm_idx = min(range(len(moneyness)), key=lambda i: abs(moneyness[i] - 1.0))
        atm_iv = ivs[atm_idx]

        # 25-delta skew
        otm_put_iv = ivs[0] if moneyness[0] < 1.0 else atm_iv
        otm_call_iv = ivs[-1] if moneyness[-1] > 1.0 else atm_iv
        skew_25d = otm_put_iv - otm_call_iv

        # Skew ratio
        skew_ratio = otm_put_iv / atm_iv if atm_iv > 0 else 1.0

        # Butterfly (smile convexity)
        butterfly = (otm_put_iv + otm_call_iv) / 2 - atm_iv

        return {
            "atm_iv": atm_iv,
            "otm_put_iv": otm_put_iv,
            "otm_call_iv": otm_call_iv,
            "skew_25d": skew_25d,
            "skew_ratio": skew_ratio,
            "butterfly": butterfly,
            "num_points": len(smile),
        }

    def to_matrix(self) -> dict:
        """Return the full IV matrix for 3D surface visualization."""
        expirations = sorted(set(p.expiration for p in self.points))
        strikes = sorted(set(p.strike for p in self.points))

        matrix = []
        for exp in expirations:
            row = []
            for strike in strikes:
                iv = self.interpolate(strike, exp)
                row.append(iv)
            matrix.append(row)

        return {
            "expirations": expirations,
            "strikes": strikes,
            "ivs": matrix,
            "spot": self.spot,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# §4.3 — STRATEGY BUILDER
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class OptionLeg:
    option_type: str  # "call" or "put"
    strike: float
    expiration: str
    side: str  # "buy" or "sell"
    qty: int = 1
    premium: float = 0.0
    iv: float = 0.0
    greeks: Optional[Greeks] = None


@dataclass
class OptionStrategy:
    name: str
    legs: list = field(default_factory=list)  # OptionLeg[]
    underlying_price: float = 0.0
    risk_free: float = RISK_FREE_RATE
    net_premium: float = 0.0
    max_profit: float = 0.0
    max_loss: float = 0.0
    breakeven: list = field(default_factory=list)
    probability_of_profit: float = 0.0
    net_greeks: Optional[Greeks] = None

    def calculate_payoff(self, price_range: Optional[list[float]] = None) -> list[dict]:
        """Calculate P&L across price range at expiration."""
        if price_range is None:
            min_strike = min(leg.strike for leg in self.legs)
            max_strike = max(leg.strike for leg in self.legs)
            center = (min_strike + max_strike) / 2
            spread = max_strike - min_strike
            lo = center - spread * 2
            hi = center + spread * 2
            price_range = [lo + i * (hi - lo) / 200 for i in range(201)]

        payoff = []
        for price in price_range:
            pnl = -self.net_premium  # Start with net premium paid/received
            for leg in self.legs:
                if leg.option_type == "call":
                    intrinsic = max(price - leg.strike, 0)
                else:
                    intrinsic = max(leg.strike - price, 0)

                if leg.side == "buy":
                    pnl += intrinsic * leg.qty
                else:
                    pnl -= intrinsic * leg.qty

            payoff.append({"price": round(price, 2), "pnl": round(pnl, 2)})

        return payoff

    def calculate_greeks(self, S: float, T: float, sigma: float = 0.25) -> Greeks:
        """Calculate net Greeks for the strategy."""
        net = Greeks()
        for leg in self.legs:
            g = GreeksCalculator.calculate(S, leg.strike, T, self.risk_free, leg.iv or sigma, leg.option_type)
            multiplier = leg.qty if leg.side == "buy" else -leg.qty

            net.delta += g.delta * multiplier
            net.gamma += g.gamma * multiplier
            net.theta += g.theta * multiplier
            net.vega += g.vega * multiplier
            net.rho += g.rho * multiplier
            net.vanna += g.vanna * multiplier
            net.volga += g.volga * multiplier
            net.charm += g.charm * multiplier

        self.net_greeks = net
        return net


class StrategyTemplates:
    """Pre-built options strategy templates."""

    @staticmethod
    def covered_call(S: float, K_call: float, exp: str, call_premium: float) -> OptionStrategy:
        return OptionStrategy(
            name="Covered Call",
            underlying_price=S,
            legs=[OptionLeg(option_type="call", strike=K_call, expiration=exp, side="sell", premium=call_premium)],
            net_premium=-call_premium,
            max_profit=K_call - S + call_premium,
            max_loss=S - call_premium,
        )

    @staticmethod
    def protective_put(S: float, K_put: float, exp: str, put_premium: float) -> OptionStrategy:
        return OptionStrategy(
            name="Protective Put",
            underlying_price=S,
            legs=[OptionLeg(option_type="put", strike=K_put, expiration=exp, side="buy", premium=put_premium)],
            net_premium=put_premium,
            max_profit=float('inf'),
            max_loss=S - K_put + put_premium,
        )

    @staticmethod
    def bull_call_spread(S: float, K_low: float, K_high: float, exp: str,
                         premium_low: float, premium_high: float) -> OptionStrategy:
        net = premium_low - premium_high
        return OptionStrategy(
            name="Bull Call Spread",
            underlying_price=S,
            legs=[
                OptionLeg(option_type="call", strike=K_low, expiration=exp, side="buy", premium=premium_low),
                OptionLeg(option_type="call", strike=K_high, expiration=exp, side="sell", premium=premium_high),
            ],
            net_premium=net,
            max_profit=K_high - K_low - net,
            max_loss=net,
            breakeven=[K_low + net],
        )

    @staticmethod
    def bear_put_spread(S: float, K_high: float, K_low: float, exp: str,
                        premium_high: float, premium_low: float) -> OptionStrategy:
        net = premium_high - premium_low
        return OptionStrategy(
            name="Bear Put Spread",
            underlying_price=S,
            legs=[
                OptionLeg(option_type="put", strike=K_high, expiration=exp, side="buy", premium=premium_high),
                OptionLeg(option_type="put", strike=K_low, expiration=exp, side="sell", premium=premium_low),
            ],
            net_premium=net,
            max_profit=K_high - K_low - net,
            max_loss=net,
            breakeven=[K_high - net],
        )

    @staticmethod
    def long_straddle(S: float, K: float, exp: str,
                      call_premium: float, put_premium: float) -> OptionStrategy:
        net = call_premium + put_premium
        return OptionStrategy(
            name="Long Straddle",
            underlying_price=S,
            legs=[
                OptionLeg(option_type="call", strike=K, expiration=exp, side="buy", premium=call_premium),
                OptionLeg(option_type="put", strike=K, expiration=exp, side="buy", premium=put_premium),
            ],
            net_premium=net,
            max_profit=float('inf'),
            max_loss=net,
            breakeven=[K - net, K + net],
        )

    @staticmethod
    def short_straddle(S: float, K: float, exp: str,
                       call_premium: float, put_premium: float) -> OptionStrategy:
        net = -(call_premium + put_premium)
        return OptionStrategy(
            name="Short Straddle",
            underlying_price=S,
            legs=[
                OptionLeg(option_type="call", strike=K, expiration=exp, side="sell", premium=call_premium),
                OptionLeg(option_type="put", strike=K, expiration=exp, side="sell", premium=put_premium),
            ],
            net_premium=net,
            max_profit=-net,
            max_loss=float('inf'),
            breakeven=[K + net, K - net],
        )

    @staticmethod
    def long_strangle(S: float, K_put: float, K_call: float, exp: str,
                      call_premium: float, put_premium: float) -> OptionStrategy:
        net = call_premium + put_premium
        return OptionStrategy(
            name="Long Strangle",
            underlying_price=S,
            legs=[
                OptionLeg(option_type="call", strike=K_call, expiration=exp, side="buy", premium=call_premium),
                OptionLeg(option_type="put", strike=K_put, expiration=exp, side="buy", premium=put_premium),
            ],
            net_premium=net,
            max_profit=float('inf'),
            max_loss=net,
            breakeven=[K_put - net, K_call + net],
        )

    @staticmethod
    def iron_condor(S: float, K_pl: float, K_ps: float, K_cs: float, K_cl: float, exp: str,
                    premiums: dict) -> OptionStrategy:
        net = -(premiums.get("ps", 0) + premiums.get("cs", 0)) + premiums.get("pl", 0) + premiums.get("cl", 0)
        return OptionStrategy(
            name="Iron Condor",
            underlying_price=S,
            legs=[
                OptionLeg(option_type="put", strike=K_pl, expiration=exp, side="buy", premium=premiums.get("pl", 0)),
                OptionLeg(option_type="put", strike=K_ps, expiration=exp, side="sell", premium=premiums.get("ps", 0)),
                OptionLeg(option_type="call", strike=K_cs, expiration=exp, side="sell", premium=premiums.get("cs", 0)),
                OptionLeg(option_type="call", strike=K_cl, expiration=exp, side="buy", premium=premiums.get("cl", 0)),
            ],
            net_premium=net,
            max_profit=-net,
            max_loss=max(K_ps - K_pl, K_cl - K_cs) + net,
        )

    @staticmethod
    def butterfly(S: float, K_low: float, K_mid: float, K_high: float, exp: str,
                  option_type: str = "call", premiums: dict = {}) -> OptionStrategy:
        net = premiums.get("low", 0) + premiums.get("high", 0) - 2 * premiums.get("mid", 0)
        legs = [
            OptionLeg(option_type=option_type, strike=K_low, expiration=exp, side="buy", premium=premiums.get("low", 0)),
            OptionLeg(option_type=option_type, strike=K_mid, expiration=exp, side="sell", qty=2, premium=premiums.get("mid", 0)),
            OptionLeg(option_type=option_type, strike=K_high, expiration=exp, side="buy", premium=premiums.get("high", 0)),
        ]
        return OptionStrategy(
            name="Butterfly",
            underlying_price=S,
            legs=legs,
            net_premium=net,
            max_profit=K_mid - K_low - net,
            max_loss=net,
            breakeven=[K_low + net, K_high - net],
        )

    @staticmethod
    def calendar_spread(S: float, K: float, near_exp: str, far_exp: str,
                        near_premium: float, far_premium: float,
                        option_type: str = "call") -> OptionStrategy:
        net = far_premium - near_premium
        return OptionStrategy(
            name="Calendar Spread",
            underlying_price=S,
            legs=[
                OptionLeg(option_type=option_type, strike=K, expiration=near_exp, side="sell", premium=near_premium),
                OptionLeg(option_type=option_type, strike=K, expiration=far_exp, side="buy", premium=far_premium),
            ],
            net_premium=net,
        )

    @staticmethod
    def ratio_spread(S: float, K_buy: float, K_sell: float, exp: str,
                     buy_premium: float, sell_premium: float,
                     ratio: int = 2, option_type: str = "call") -> OptionStrategy:
        net = buy_premium - ratio * sell_premium
        return OptionStrategy(
            name=f"Ratio Spread ({ratio}:1)",
            underlying_price=S,
            legs=[
                OptionLeg(option_type=option_type, strike=K_buy, expiration=exp, side="buy", premium=buy_premium),
                OptionLeg(option_type=option_type, strike=K_sell, expiration=exp, side="sell", qty=ratio, premium=sell_premium),
            ],
            net_premium=net,
        )

    @staticmethod
    def jade_lizard(S: float, K_put: float, K_call: float, K_call_high: float, exp: str,
                    put_premium: float, call_premium: float, call_high_premium: float) -> OptionStrategy:
        net = -(put_premium + call_premium) + call_high_premium
        return OptionStrategy(
            name="Jade Lizard",
            underlying_price=S,
            legs=[
                OptionLeg(option_type="put", strike=K_put, expiration=exp, side="sell", premium=put_premium),
                OptionLeg(option_type="call", strike=K_call, expiration=exp, side="sell", premium=call_premium),
                OptionLeg(option_type="call", strike=K_call_high, expiration=exp, side="buy", premium=call_high_premium),
            ],
            net_premium=net,
        )


# ═══════════════════════════════════════════════════════════════════════════════
# §4.1 — OPTIONS CHAIN DATA
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class OptionContract:
    symbol: str = ""
    underlying: str = ""
    option_type: str = "call"
    strike: float = 0.0
    expiration: str = ""
    bid: float = 0.0
    ask: float = 0.0
    last: float = 0.0
    volume: int = 0
    open_interest: int = 0
    iv: float = 0.0
    delta: float = 0.0
    gamma: float = 0.0
    theta: float = 0.0
    vega: float = 0.0
    rho: float = 0.0
    in_the_money: bool = False
    mid: float = 0.0
    spread: float = 0.0
    moneyness: float = 0.0


class OptionsChainFetcher:
    """Fetch real options chain data from multiple providers."""

    def __init__(self):
        self._http: Optional[httpx.AsyncClient] = None

    async def _get_http(self) -> httpx.AsyncClient:
        if self._http is None or self._http.is_closed:
            self._http = httpx.AsyncClient(timeout=15.0)
        return self._http

    async def get_chain(self, symbol: str, expiration: Optional[str] = None) -> dict:
        """Fetch options chain — tries Polygon, Tradier, then yfinance."""
        # Try Polygon first
        if POLYGON_KEY:
            try:
                return await self._fetch_polygon_chain(symbol, expiration)
            except Exception as e:
                logger.warning(f"Polygon chain failed: {e}")

        # Try Tradier
        if TRADIER_KEY:
            try:
                return await self._fetch_tradier_chain(symbol, expiration)
            except Exception as e:
                logger.warning(f"Tradier chain failed: {e}")

        # yfinance fallback
        return await self._fetch_yfinance_chain(symbol, expiration)

    async def _fetch_polygon_chain(self, symbol: str, expiration: Optional[str]) -> dict:
        http = await self._get_http()
        url = f"https://api.polygon.io/v3/reference/options/contracts?underlying_ticker={symbol}&limit=250&apiKey={POLYGON_KEY}"
        if expiration:
            url += f"&expiration_date={expiration}"

        resp = await http.get(url)
        data = resp.json()
        contracts = data.get("results", [])

        # Also get underlying price
        snap_url = f"https://api.polygon.io/v2/aggs/ticker/{symbol}/prev?apiKey={POLYGON_KEY}"
        snap_resp = await http.get(snap_url)
        snap_data = snap_resp.json()
        underlying_price = snap_data.get("results", [{}])[0].get("c", 100.0)

        calls = []
        puts = []
        expirations = set()

        for c in contracts:
            ticker = c.get("ticker", "")
            exp = c.get("expiration_date", "")
            strike = float(c.get("strike_price", 0))
            opt_type = c.get("contract_type", "call").lower()
            expirations.add(exp)

            contract = OptionContract(
                symbol=ticker,
                underlying=symbol,
                option_type=opt_type,
                strike=strike,
                expiration=exp,
                moneyness=strike / underlying_price if underlying_price > 0 else 0,
                in_the_money=(opt_type == "call" and strike < underlying_price) or
                             (opt_type == "put" and strike > underlying_price),
            )

            # Get snapshot for greeks/prices if available
            try:
                snap = f"https://api.polygon.io/v3/snapshot/options/{ticker}?apiKey={POLYGON_KEY}"
                s_resp = await http.get(snap)
                s_data = s_resp.json()
                if s_data.get("results"):
                    r = s_data["results"]
                    day = r.get("day", {})
                    greeks = r.get("greeks", {})
                    contract.last = float(day.get("close", 0))
                    contract.volume = int(day.get("volume", 0))
                    contract.open_interest = int(r.get("open_interest", 0))
                    contract.iv = float(r.get("implied_volatility", 0))
                    contract.delta = float(greeks.get("delta", 0))
                    contract.gamma = float(greeks.get("gamma", 0))
                    contract.theta = float(greeks.get("theta", 0))
                    contract.vega = float(greeks.get("vega", 0))
            except Exception:
                pass

            if opt_type == "call":
                calls.append(asdict(contract))
            else:
                puts.append(asdict(contract))

        return {
            "symbol": symbol,
            "underlying_price": underlying_price,
            "expirations": sorted(expirations),
            "calls": sorted(calls, key=lambda x: (x["expiration"], x["strike"])),
            "puts": sorted(puts, key=lambda x: (x["expiration"], x["strike"])),
            "source": "polygon",
        }

    async def _fetch_tradier_chain(self, symbol: str, expiration: Optional[str]) -> dict:
        http = await self._get_http()

        # Get expirations
        exp_url = f"https://api.tradier.com/v1/markets/options/expirations?symbol={symbol}"
        exp_resp = await http.get(exp_url, headers={
            "Authorization": f"Bearer {TRADIER_KEY}",
            "Accept": "application/json",
        })
        exp_data = exp_resp.json()
        all_exps = exp_data.get("expirations", {}).get("date", [])

        target_exp = expiration or (all_exps[0] if all_exps else None)
        if not target_exp:
            return {"error": "No expirations available"}

        # Get chain for expiration
        chain_url = f"https://api.tradier.com/v1/markets/options/chains?symbol={symbol}&expiration={target_exp}&greeks=true"
        chain_resp = await http.get(chain_url, headers={
            "Authorization": f"Bearer {TRADIER_KEY}",
            "Accept": "application/json",
        })
        chain_data = chain_resp.json()
        options = chain_data.get("options", {}).get("option", [])

        # Get underlying price
        quote_url = f"https://api.tradier.com/v1/markets/quotes?symbols={symbol}"
        q_resp = await http.get(quote_url, headers={
            "Authorization": f"Bearer {TRADIER_KEY}",
            "Accept": "application/json",
        })
        q_data = q_resp.json()
        underlying_price = float(q_data.get("quotes", {}).get("quote", {}).get("last", 100))

        calls = []
        puts = []

        for opt in options:
            greeks = opt.get("greeks", {})
            contract = OptionContract(
                symbol=opt.get("symbol", ""),
                underlying=symbol,
                option_type=opt.get("option_type", "call").lower(),
                strike=float(opt.get("strike", 0)),
                expiration=opt.get("expiration_date", target_exp),
                bid=float(opt.get("bid", 0)),
                ask=float(opt.get("ask", 0)),
                last=float(opt.get("last", 0)),
                volume=int(opt.get("volume", 0)),
                open_interest=int(opt.get("open_interest", 0)),
                iv=float(greeks.get("mid_iv", 0)),
                delta=float(greeks.get("delta", 0)),
                gamma=float(greeks.get("gamma", 0)),
                theta=float(greeks.get("theta", 0)),
                vega=float(greeks.get("vega", 0)),
                rho=float(greeks.get("rho", 0)),
                mid=(float(opt.get("bid", 0)) + float(opt.get("ask", 0))) / 2,
                spread=float(opt.get("ask", 0)) - float(opt.get("bid", 0)),
                moneyness=float(opt.get("strike", 0)) / underlying_price if underlying_price > 0 else 0,
            )
            contract.in_the_money = (
                (contract.option_type == "call" and contract.strike < underlying_price) or
                (contract.option_type == "put" and contract.strike > underlying_price)
            )

            if contract.option_type == "call":
                calls.append(asdict(contract))
            else:
                puts.append(asdict(contract))

        return {
            "symbol": symbol,
            "underlying_price": underlying_price,
            "expirations": all_exps,
            "calls": sorted(calls, key=lambda x: x["strike"]),
            "puts": sorted(puts, key=lambda x: x["strike"]),
            "source": "tradier",
        }

    async def _fetch_yfinance_chain(self, symbol: str, expiration: Optional[str]) -> dict:
        """yfinance fallback — runs in thread pool."""
        import concurrent.futures

        def _fetch():
            try:
                import yfinance as yf
                ticker = yf.Ticker(symbol)
                info = ticker.info
                underlying_price = info.get("regularMarketPrice", info.get("previousClose", 100))

                exps = list(ticker.options)
                if not exps:
                    return {"error": "No options available", "symbol": symbol}

                target_exp = expiration if expiration in exps else exps[0]
                chain = ticker.option_chain(target_exp)

                calls = []
                for _, row in chain.calls.iterrows():
                    contract = {
                        "symbol": row.get("contractSymbol", ""),
                        "underlying": symbol,
                        "option_type": "call",
                        "strike": float(row.get("strike", 0)),
                        "expiration": target_exp,
                        "bid": float(row.get("bid", 0)),
                        "ask": float(row.get("ask", 0)),
                        "last": float(row.get("lastPrice", 0)),
                        "volume": int(row.get("volume", 0)) if row.get("volume") else 0,
                        "open_interest": int(row.get("openInterest", 0)) if row.get("openInterest") else 0,
                        "iv": float(row.get("impliedVolatility", 0)),
                        "in_the_money": bool(row.get("inTheMoney", False)),
                        "mid": (float(row.get("bid", 0)) + float(row.get("ask", 0))) / 2,
                        "moneyness": float(row.get("strike", 0)) / underlying_price if underlying_price > 0 else 0,
                    }
                    # Calculate Greeks
                    if contract["iv"] > 0 and contract["strike"] > 0:
                        exp_date = datetime.strptime(target_exp, "%Y-%m-%d")
                        now = datetime.now()
                        T = max((exp_date - now).days / 365.0, 0.001)
                        greeks = GreeksCalculator.calculate(underlying_price, contract["strike"], T, RISK_FREE_RATE, contract["iv"], "call")
                        contract["delta"] = round(greeks.delta, 4)
                        contract["gamma"] = round(greeks.gamma, 6)
                        contract["theta"] = round(greeks.theta, 4)
                        contract["vega"] = round(greeks.vega, 4)
                        contract["rho"] = round(greeks.rho, 4)
                    calls.append(contract)

                puts = []
                for _, row in chain.puts.iterrows():
                    contract = {
                        "symbol": row.get("contractSymbol", ""),
                        "underlying": symbol,
                        "option_type": "put",
                        "strike": float(row.get("strike", 0)),
                        "expiration": target_exp,
                        "bid": float(row.get("bid", 0)),
                        "ask": float(row.get("ask", 0)),
                        "last": float(row.get("lastPrice", 0)),
                        "volume": int(row.get("volume", 0)) if row.get("volume") else 0,
                        "open_interest": int(row.get("openInterest", 0)) if row.get("openInterest") else 0,
                        "iv": float(row.get("impliedVolatility", 0)),
                        "in_the_money": bool(row.get("inTheMoney", False)),
                        "mid": (float(row.get("bid", 0)) + float(row.get("ask", 0))) / 2,
                        "moneyness": float(row.get("strike", 0)) / underlying_price if underlying_price > 0 else 0,
                    }
                    if contract["iv"] > 0 and contract["strike"] > 0:
                        exp_date = datetime.strptime(target_exp, "%Y-%m-%d")
                        now = datetime.now()
                        T = max((exp_date - now).days / 365.0, 0.001)
                        greeks = GreeksCalculator.calculate(underlying_price, contract["strike"], T, RISK_FREE_RATE, contract["iv"], "put")
                        contract["delta"] = round(greeks.delta, 4)
                        contract["gamma"] = round(greeks.gamma, 6)
                        contract["theta"] = round(greeks.theta, 4)
                        contract["vega"] = round(greeks.vega, 4)
                        contract["rho"] = round(greeks.rho, 4)
                    puts.append(contract)

                return {
                    "symbol": symbol,
                    "underlying_price": underlying_price,
                    "expirations": exps,
                    "calls": sorted(calls, key=lambda x: x["strike"]),
                    "puts": sorted(puts, key=lambda x: x["strike"]),
                    "source": "yfinance",
                }
            except Exception as e:
                return {"error": str(e), "symbol": symbol}

        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as pool:
            result = await loop.run_in_executor(pool, _fetch)
        return result

    async def get_expirations(self, symbol: str) -> list[str]:
        """Get available expiration dates."""
        chain = await self.get_chain(symbol)
        return chain.get("expirations", [])

    async def get_unusual_activity(self, symbol: str) -> list[dict]:
        """Detect unusual options activity (high volume/OI ratios)."""
        chain = await self.get_chain(symbol)
        unusual = []

        for opt_type in ["calls", "puts"]:
            for opt in chain.get(opt_type, []):
                vol = opt.get("volume", 0)
                oi = opt.get("open_interest", 0)
                if oi > 0 and vol > 0:
                    vol_oi_ratio = vol / oi
                    if vol_oi_ratio > 3.0 and vol > 100:
                        unusual.append({
                            **opt,
                            "vol_oi_ratio": round(vol_oi_ratio, 2),
                            "signal": "unusual_volume",
                        })

        unusual.sort(key=lambda x: x.get("vol_oi_ratio", 0), reverse=True)
        return unusual[:20]


# ═══════════════════════════════════════════════════════════════════════════════
# BINOMIAL TREE MODEL (American options)
# ═══════════════════════════════════════════════════════════════════════════════

class BinomialTree:
    """Cox-Ross-Rubinstein binomial tree for American option pricing."""

    @staticmethod
    def price(S: float, K: float, T: float, r: float, sigma: float,
              option_type: str = "call", steps: int = 100,
              american: bool = True, q: float = 0.0) -> float:
        dt = T / steps
        u = math.exp(sigma * math.sqrt(dt))
        d = 1.0 / u
        p = (math.exp((r - q) * dt) - d) / (u - d)
        disc = math.exp(-r * dt)

        # Build price tree at expiry
        prices = [S * (u ** (steps - 2 * j)) for j in range(steps + 1)]

        # Calculate option values at expiry
        if option_type == "call":
            values = [max(price - K, 0) for price in prices]
        else:
            values = [max(K - price, 0) for price in prices]

        # Backward induction
        for i in range(steps - 1, -1, -1):
            for j in range(i + 1):
                continuation = disc * (p * values[j] + (1 - p) * values[j + 1])
                if american:
                    spot = S * (u ** (i - 2 * j))
                    if option_type == "call":
                        exercise = max(spot - K, 0)
                    else:
                        exercise = max(K - spot, 0)
                    values[j] = max(continuation, exercise)
                else:
                    values[j] = continuation

        return values[0]


# ═══════════════════════════════════════════════════════════════════════════════
# MONTE CARLO PRICING
# ═══════════════════════════════════════════════════════════════════════════════

class MonteCarloPricer:
    """Monte Carlo simulation for exotic option pricing."""

    @staticmethod
    def european(S: float, K: float, T: float, r: float, sigma: float,
                 option_type: str = "call", num_paths: int = 50000,
                 q: float = 0.0) -> dict:
        """Price European option using Monte Carlo."""
        import random
        dt = T
        drift = (r - q - 0.5 * sigma ** 2) * dt
        diffusion = sigma * math.sqrt(dt)

        payoffs = []
        for _ in range(num_paths):
            z = random.gauss(0, 1)
            ST = S * math.exp(drift + diffusion * z)
            if option_type == "call":
                payoff = max(ST - K, 0)
            else:
                payoff = max(K - ST, 0)
            payoffs.append(payoff)

        mean_payoff = sum(payoffs) / num_paths
        price = math.exp(-r * T) * mean_payoff

        # Standard error
        variance = sum((p - mean_payoff) ** 2 for p in payoffs) / (num_paths - 1)
        std_error = math.sqrt(variance / num_paths) * math.exp(-r * T)

        return {
            "price": round(price, 4),
            "std_error": round(std_error, 6),
            "confidence_95": [round(price - 1.96 * std_error, 4), round(price + 1.96 * std_error, 4)],
            "num_paths": num_paths,
        }

    @staticmethod
    def asian(S: float, K: float, T: float, r: float, sigma: float,
              option_type: str = "call", num_paths: int = 50000,
              num_steps: int = 252, average_type: str = "arithmetic") -> dict:
        """Price Asian option (average price)."""
        import random
        dt = T / num_steps
        drift = (r - 0.5 * sigma ** 2) * dt
        diffusion = sigma * math.sqrt(dt)

        payoffs = []
        for _ in range(num_paths):
            path = [S]
            for _ in range(num_steps):
                z = random.gauss(0, 1)
                path.append(path[-1] * math.exp(drift + diffusion * z))

            if average_type == "arithmetic":
                avg = sum(path) / len(path)
            else:
                avg = math.exp(sum(math.log(p) for p in path) / len(path))

            if option_type == "call":
                payoff = max(avg - K, 0)
            else:
                payoff = max(K - avg, 0)
            payoffs.append(payoff)

        mean_payoff = sum(payoffs) / num_paths
        price = math.exp(-r * T) * mean_payoff

        return {"price": round(price, 4), "type": "asian", "average": average_type}

    @staticmethod
    def barrier(S: float, K: float, T: float, r: float, sigma: float,
                barrier: float, barrier_type: str = "down_and_out",
                option_type: str = "call", num_paths: int = 50000,
                num_steps: int = 252) -> dict:
        """Price barrier option."""
        import random
        dt = T / num_steps
        drift = (r - 0.5 * sigma ** 2) * dt
        diffusion = sigma * math.sqrt(dt)

        payoffs = []
        for _ in range(num_paths):
            path = [S]
            knocked = False
            for _ in range(num_steps):
                z = random.gauss(0, 1)
                new_price = path[-1] * math.exp(drift + diffusion * z)
                path.append(new_price)

                if barrier_type in ("down_and_out", "down_and_in"):
                    if new_price <= barrier:
                        knocked = True
                elif barrier_type in ("up_and_out", "up_and_in"):
                    if new_price >= barrier:
                        knocked = True

            ST = path[-1]
            if option_type == "call":
                intrinsic = max(ST - K, 0)
            else:
                intrinsic = max(K - ST, 0)

            if barrier_type.endswith("_out"):
                payoff = 0 if knocked else intrinsic
            else:  # _in
                payoff = intrinsic if knocked else 0

            payoffs.append(payoff)

        mean_payoff = sum(payoffs) / num_paths
        price = math.exp(-r * T) * mean_payoff

        return {"price": round(price, 4), "type": "barrier", "barrier_type": barrier_type, "barrier": barrier}


# ═══════════════════════════════════════════════════════════════════════════════
# UNIFIED OPTIONS ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

class OptionsAnalyticsEngine:
    """
    Unified options analytics engine — the main entry point.
    Combines chain data, Greeks, volatility surface, strategy builder,
    and pricing models.
    """

    def __init__(self):
        self.chain_fetcher = OptionsChainFetcher()
        self.vol_surfaces: dict[str, VolatilitySurface] = {}
        self.strategies = StrategyTemplates()
        self.bs = BlackScholes()
        self.greeks_calc = GreeksCalculator()
        self.iv_solver = ImpliedVolatility()
        self.binomial = BinomialTree()
        self.monte_carlo = MonteCarloPricer()

    async def get_chain(self, symbol: str, expiration: Optional[str] = None) -> dict:
        return await self.chain_fetcher.get_chain(symbol, expiration)

    async def get_expirations(self, symbol: str) -> list[str]:
        return await self.chain_fetcher.get_expirations(symbol)

    def price_option(self, S: float, K: float, T: float, sigma: float,
                     option_type: str = "call", model: str = "bs",
                     american: bool = False, r: float = RISK_FREE_RATE) -> dict:
        """Price an option using the specified model."""
        if model == "bs":
            if option_type == "call":
                price = self.bs.call_price(S, K, T, r, sigma)
            else:
                price = self.bs.put_price(S, K, T, r, sigma)
        elif model == "binomial":
            price = self.binomial.price(S, K, T, r, sigma, option_type, american=american)
        elif model == "mc":
            result = self.monte_carlo.european(S, K, T, r, sigma, option_type)
            return result
        else:
            price = self.bs.call_price(S, K, T, r, sigma) if option_type == "call" else self.bs.put_price(S, K, T, r, sigma)

        greeks = self.greeks_calc.calculate(S, K, T, r, sigma, option_type)

        return {
            "price": round(price, 4),
            "model": model,
            "greeks": asdict(greeks),
            "inputs": {"S": S, "K": K, "T": T, "r": r, "sigma": sigma, "type": option_type},
        }

    def calculate_iv(self, market_price: float, S: float, K: float, T: float,
                     option_type: str = "call", r: float = RISK_FREE_RATE) -> float:
        return round(self.iv_solver.solve(market_price, S, K, T, r, option_type), 6)

    async def build_vol_surface(self, symbol: str) -> dict:
        """Build volatility surface from options chain."""
        chain = await self.get_chain(symbol)
        underlying_price = chain.get("underlying_price", 100.0)

        surface = VolatilitySurface(underlying_price)

        for opt_type in ["calls", "puts"]:
            for opt in chain.get(opt_type, []):
                iv = opt.get("iv", 0)
                if iv > 0.01:
                    surface.add_point(
                        strike=opt["strike"],
                        expiration=opt["expiration"],
                        iv=iv,
                        option_type="call" if opt_type == "calls" else "put",
                    )

        self.vol_surfaces[symbol] = surface
        return surface.to_matrix()

    async def get_unusual_activity(self, symbol: str) -> list[dict]:
        return await self.chain_fetcher.get_unusual_activity(symbol)

    def build_strategy(self, strategy_type: str, params: dict) -> dict:
        """Build a pre-defined option strategy."""
        S = params.get("underlying_price", 100)

        builders = {
            "covered_call": lambda: self.strategies.covered_call(
                S, params.get("call_strike", S * 1.05), params.get("expiration", ""),
                params.get("call_premium", 2.0)),
            "protective_put": lambda: self.strategies.protective_put(
                S, params.get("put_strike", S * 0.95), params.get("expiration", ""),
                params.get("put_premium", 2.0)),
            "bull_call_spread": lambda: self.strategies.bull_call_spread(
                S, params.get("low_strike", S * 0.95), params.get("high_strike", S * 1.05),
                params.get("expiration", ""), params.get("low_premium", 5.0), params.get("high_premium", 2.0)),
            "bear_put_spread": lambda: self.strategies.bear_put_spread(
                S, params.get("high_strike", S * 1.05), params.get("low_strike", S * 0.95),
                params.get("expiration", ""), params.get("high_premium", 5.0), params.get("low_premium", 2.0)),
            "long_straddle": lambda: self.strategies.long_straddle(
                S, params.get("strike", S), params.get("expiration", ""),
                params.get("call_premium", 3.0), params.get("put_premium", 3.0)),
            "iron_condor": lambda: self.strategies.iron_condor(
                S, params.get("put_buy", S * 0.9), params.get("put_sell", S * 0.95),
                params.get("call_sell", S * 1.05), params.get("call_buy", S * 1.1),
                params.get("expiration", ""), params.get("premiums", {})),
            "butterfly": lambda: self.strategies.butterfly(
                S, params.get("low_strike", S * 0.95), params.get("mid_strike", S),
                params.get("high_strike", S * 1.05), params.get("expiration", ""),
                params.get("option_type", "call"), params.get("premiums", {})),
        }

        builder = builders.get(strategy_type)
        if not builder:
            return {"error": f"Unknown strategy: {strategy_type}"}

        strategy = builder()
        payoff = strategy.calculate_payoff()

        return {
            "name": strategy.name,
            "underlying_price": S,
            "legs": [asdict(leg) if hasattr(leg, '__dataclass_fields__') else leg for leg in strategy.legs],
            "net_premium": round(strategy.net_premium, 2),
            "max_profit": round(strategy.max_profit, 2) if strategy.max_profit != float('inf') else "unlimited",
            "max_loss": round(strategy.max_loss, 2) if strategy.max_loss != float('inf') else "unlimited",
            "breakeven": [round(b, 2) for b in strategy.breakeven],
            "payoff": payoff,
        }

    def what_if_analysis(self, S: float, K: float, T: float, sigma: float,
                         option_type: str = "call") -> dict:
        """What-if analysis: Greeks sensitivity to changes in underlying/vol/time."""
        base_greeks = self.greeks_calc.calculate(S, K, T, RISK_FREE_RATE, sigma, option_type)

        # Price sensitivity to underlying
        price_sens = []
        for pct in range(-20, 21, 2):
            new_S = S * (1 + pct / 100)
            if option_type == "call":
                price = self.bs.call_price(new_S, K, T, RISK_FREE_RATE, sigma)
            else:
                price = self.bs.put_price(new_S, K, T, RISK_FREE_RATE, sigma)
            g = self.greeks_calc.calculate(new_S, K, T, RISK_FREE_RATE, sigma, option_type)
            price_sens.append({
                "underlying_change_pct": pct,
                "underlying": round(new_S, 2),
                "price": round(price, 4),
                "delta": round(g.delta, 4),
                "gamma": round(g.gamma, 6),
            })

        # Volatility sensitivity
        vol_sens = []
        for vol_change in range(-50, 51, 5):
            new_sigma = sigma * (1 + vol_change / 100)
            if new_sigma <= 0:
                continue
            if option_type == "call":
                price = self.bs.call_price(S, K, T, RISK_FREE_RATE, new_sigma)
            else:
                price = self.bs.put_price(S, K, T, RISK_FREE_RATE, new_sigma)
            vol_sens.append({
                "vol_change_pct": vol_change,
                "iv": round(new_sigma, 4),
                "price": round(price, 4),
            })

        # Time decay
        time_sens = []
        for days in range(0, int(T * 365) + 1, max(1, int(T * 365 / 20))):
            new_T = max((T * 365 - days) / 365, 0.001)
            if option_type == "call":
                price = self.bs.call_price(S, K, new_T, RISK_FREE_RATE, sigma)
            else:
                price = self.bs.put_price(S, K, new_T, RISK_FREE_RATE, sigma)
            time_sens.append({
                "days_elapsed": days,
                "days_remaining": int(new_T * 365),
                "price": round(price, 4),
            })

        return {
            "base_greeks": asdict(base_greeks),
            "price_sensitivity": price_sens,
            "vol_sensitivity": vol_sens,
            "time_decay": time_sens,
        }


# ── Singleton ──
_options_instance: Optional[OptionsAnalyticsEngine] = None

def get_options_engine() -> OptionsAnalyticsEngine:
    global _options_instance
    if _options_instance is None:
        _options_instance = OptionsAnalyticsEngine()
    return _options_instance
