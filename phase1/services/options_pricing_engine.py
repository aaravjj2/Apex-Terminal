"""
options_pricing_engine.py — Bloomberg-grade Options Pricing & Analytics
=======================================================================
Pure computation engine — no FastAPI imports.

Components:
    BlackScholes       — European option pricing (call/put), full Greeks chain
    BinomialTree       — American & European via CRR binomial tree
    MonteCarloOption   — MC pricing with variance reduction
    ImpliedVolatility  — Newton-Raphson IV solver, IV smile/surface
    VolatilitySurface  — Build/interpolate vol surface (strike×expiry)
    OptionChainAnalyzer— Unusual activity, put/call ratio, max pain, OI analysis
    StrategyBuilder    — Multi-leg strategy P&L (vertical, iron condor, butterfly…)
    GreeksCalculator   — Full Greeks for any leg/strategy
    ExoticOptions      — Barrier, Asian, Lookback, Digital/Binary
    EarlyExercise      — Optimal early exercise boundary for Americans
"""

from __future__ import annotations
import math
import numpy as np
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field


# ─── Constants ───────────────────────────────────────────────────────────────

_SQRT2PI = math.sqrt(2.0 * math.pi)
_INV_SQRT2 = 1.0 / math.sqrt(2.0)


def _norm_cdf(x: float) -> float:
    """Standard normal CDF via error function."""
    return 0.5 * (1.0 + math.erf(x * _INV_SQRT2))


def _norm_pdf(x: float) -> float:
    """Standard normal PDF."""
    return math.exp(-0.5 * x * x) / _SQRT2PI


# ═══════════════════════════════════════════════════════════════════════════════
# 1. BlackScholes — European option pricing
# ═══════════════════════════════════════════════════════════════════════════════

class BlackScholes:
    """Black-Scholes-Merton model for European options."""

    @staticmethod
    def d1(S: float, K: float, T: float, r: float, sigma: float, q: float = 0.0) -> float:
        if T <= 0 or sigma <= 0:
            return 0.0
        return (math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * math.sqrt(T))

    @staticmethod
    def d2(S: float, K: float, T: float, r: float, sigma: float, q: float = 0.0) -> float:
        return BlackScholes.d1(S, K, T, r, sigma, q) - sigma * math.sqrt(T)

    @staticmethod
    def call_price(S: float, K: float, T: float, r: float, sigma: float, q: float = 0.0) -> float:
        if T <= 0:
            return max(S - K, 0.0)
        d1 = BlackScholes.d1(S, K, T, r, sigma, q)
        d2 = d1 - sigma * math.sqrt(T)
        return S * math.exp(-q * T) * _norm_cdf(d1) - K * math.exp(-r * T) * _norm_cdf(d2)

    @staticmethod
    def put_price(S: float, K: float, T: float, r: float, sigma: float, q: float = 0.0) -> float:
        if T <= 0:
            return max(K - S, 0.0)
        d1 = BlackScholes.d1(S, K, T, r, sigma, q)
        d2 = d1 - sigma * math.sqrt(T)
        return K * math.exp(-r * T) * _norm_cdf(-d2) - S * math.exp(-q * T) * _norm_cdf(-d1)

    @staticmethod
    def price(S: float, K: float, T: float, r: float, sigma: float,
              option_type: str = "call", q: float = 0.0) -> float:
        if option_type.lower() == "call":
            return BlackScholes.call_price(S, K, T, r, sigma, q)
        return BlackScholes.put_price(S, K, T, r, sigma, q)

    @staticmethod
    def delta(S: float, K: float, T: float, r: float, sigma: float,
              option_type: str = "call", q: float = 0.0) -> float:
        if T <= 0:
            if option_type.lower() == "call":
                return 1.0 if S > K else 0.0
            return -1.0 if S < K else 0.0
        d1 = BlackScholes.d1(S, K, T, r, sigma, q)
        if option_type.lower() == "call":
            return math.exp(-q * T) * _norm_cdf(d1)
        return math.exp(-q * T) * (_norm_cdf(d1) - 1.0)

    @staticmethod
    def gamma(S: float, K: float, T: float, r: float, sigma: float, q: float = 0.0) -> float:
        if T <= 0 or sigma <= 0:
            return 0.0
        d1 = BlackScholes.d1(S, K, T, r, sigma, q)
        return math.exp(-q * T) * _norm_pdf(d1) / (S * sigma * math.sqrt(T))

    @staticmethod
    def theta(S: float, K: float, T: float, r: float, sigma: float,
              option_type: str = "call", q: float = 0.0) -> float:
        if T <= 0:
            return 0.0
        d1 = BlackScholes.d1(S, K, T, r, sigma, q)
        d2 = d1 - sigma * math.sqrt(T)
        term1 = -S * math.exp(-q * T) * _norm_pdf(d1) * sigma / (2.0 * math.sqrt(T))
        if option_type.lower() == "call":
            term2 = -r * K * math.exp(-r * T) * _norm_cdf(d2)
            term3 = q * S * math.exp(-q * T) * _norm_cdf(d1)
        else:
            term2 = r * K * math.exp(-r * T) * _norm_cdf(-d2)
            term3 = -q * S * math.exp(-q * T) * _norm_cdf(-d1)
        return (term1 + term2 + term3) / 365.0  # per calendar day

    @staticmethod
    def vega(S: float, K: float, T: float, r: float, sigma: float, q: float = 0.0) -> float:
        if T <= 0:
            return 0.0
        d1 = BlackScholes.d1(S, K, T, r, sigma, q)
        return S * math.exp(-q * T) * _norm_pdf(d1) * math.sqrt(T) / 100.0  # per 1% vol

    @staticmethod
    def rho(S: float, K: float, T: float, r: float, sigma: float,
            option_type: str = "call", q: float = 0.0) -> float:
        if T <= 0:
            return 0.0
        d2 = BlackScholes.d2(S, K, T, r, sigma, q)
        if option_type.lower() == "call":
            return K * T * math.exp(-r * T) * _norm_cdf(d2) / 100.0
        return -K * T * math.exp(-r * T) * _norm_cdf(-d2) / 100.0

    @staticmethod
    def charm(S: float, K: float, T: float, r: float, sigma: float,
              option_type: str = "call", q: float = 0.0) -> float:
        """Delta decay — dDelta/dT."""
        if T <= 0:
            return 0.0
        d1 = BlackScholes.d1(S, K, T, r, sigma, q)
        d2 = d1 - sigma * math.sqrt(T)
        factor = _norm_pdf(d1) * (2.0 * (r - q) * T - d2 * sigma * math.sqrt(T)) / (2.0 * T * sigma * math.sqrt(T))
        if option_type.lower() == "call":
            return -q * math.exp(-q * T) * _norm_cdf(d1) + math.exp(-q * T) * factor
        return q * math.exp(-q * T) * _norm_cdf(-d1) + math.exp(-q * T) * factor

    @staticmethod
    def vanna(S: float, K: float, T: float, r: float, sigma: float, q: float = 0.0) -> float:
        """dDelta/dVol (or dVega/dSpot)."""
        if T <= 0 or sigma <= 0:
            return 0.0
        d1 = BlackScholes.d1(S, K, T, r, sigma, q)
        d2 = d1 - sigma * math.sqrt(T)
        return -math.exp(-q * T) * _norm_pdf(d1) * d2 / sigma

    @staticmethod
    def volga(S: float, K: float, T: float, r: float, sigma: float, q: float = 0.0) -> float:
        """dVega/dVol — vomma."""
        if T <= 0 or sigma <= 0:
            return 0.0
        d1 = BlackScholes.d1(S, K, T, r, sigma, q)
        d2 = d1 - sigma * math.sqrt(T)
        v = BlackScholes.vega(S, K, T, r, sigma, q) * 100.0  # undo /100
        return v * d1 * d2 / sigma

    @staticmethod
    def speed(S: float, K: float, T: float, r: float, sigma: float, q: float = 0.0) -> float:
        """dGamma/dSpot."""
        if T <= 0 or sigma <= 0 or S <= 0:
            return 0.0
        d1 = BlackScholes.d1(S, K, T, r, sigma, q)
        g = BlackScholes.gamma(S, K, T, r, sigma, q)
        return -g / S * (d1 / (sigma * math.sqrt(T)) + 1.0)

    @staticmethod
    def all_greeks(S: float, K: float, T: float, r: float, sigma: float,
                   option_type: str = "call", q: float = 0.0) -> Dict[str, float]:
        return {
            "price": BlackScholes.price(S, K, T, r, sigma, option_type, q),
            "delta": BlackScholes.delta(S, K, T, r, sigma, option_type, q),
            "gamma": BlackScholes.gamma(S, K, T, r, sigma, q),
            "theta": BlackScholes.theta(S, K, T, r, sigma, option_type, q),
            "vega": BlackScholes.vega(S, K, T, r, sigma, q),
            "rho": BlackScholes.rho(S, K, T, r, sigma, option_type, q),
            "charm": BlackScholes.charm(S, K, T, r, sigma, option_type, q),
            "vanna": BlackScholes.vanna(S, K, T, r, sigma, q),
            "volga": BlackScholes.volga(S, K, T, r, sigma, q),
            "speed": BlackScholes.speed(S, K, T, r, sigma, q),
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 2. BinomialTree — CRR binomial tree for American/European
# ═══════════════════════════════════════════════════════════════════════════════

class BinomialTree:
    """Cox-Ross-Rubinstein binomial tree."""

    @staticmethod
    def price(S: float, K: float, T: float, r: float, sigma: float,
              option_type: str = "call", style: str = "american",
              steps: int = 200, q: float = 0.0) -> float:
        dt = T / steps
        u = math.exp(sigma * math.sqrt(dt))
        d = 1.0 / u
        p = (math.exp((r - q) * dt) - d) / (u - d)
        disc = math.exp(-r * dt)
        is_call = option_type.lower() == "call"
        is_american = style.lower() == "american"

        # Terminal values
        prices = np.array([S * (u ** (steps - i)) * (d ** i) for i in range(steps + 1)])
        if is_call:
            values = np.maximum(prices - K, 0.0)
        else:
            values = np.maximum(K - prices, 0.0)

        # Backward induction
        for step in range(steps - 1, -1, -1):
            prices = np.array([S * (u ** (step - i)) * (d ** i) for i in range(step + 1)])
            values = disc * (p * values[:-1] + (1.0 - p) * values[1:])
            if is_american:
                if is_call:
                    intrinsic = np.maximum(prices - K, 0.0)
                else:
                    intrinsic = np.maximum(K - prices, 0.0)
                values = np.maximum(values, intrinsic)

        return float(values[0])

    @staticmethod
    def price_with_greeks(S: float, K: float, T: float, r: float, sigma: float,
                          option_type: str = "call", style: str = "american",
                          steps: int = 200, q: float = 0.0) -> Dict[str, float]:
        """Price + finite-difference Greeks."""
        ds = S * 0.01  # 1% bump
        dv = 0.01      # 1% vol bump
        dt_bump = 1.0 / 365.0

        price = BinomialTree.price(S, K, T, r, sigma, option_type, style, steps, q)
        p_up = BinomialTree.price(S + ds, K, T, r, sigma, option_type, style, steps, q)
        p_dn = BinomialTree.price(S - ds, K, T, r, sigma, option_type, style, steps, q)

        delta = (p_up - p_dn) / (2.0 * ds)
        gamma = (p_up - 2.0 * price + p_dn) / (ds * ds)

        T_next = max(T - dt_bump, 1e-10)
        p_t = BinomialTree.price(S, K, T_next, r, sigma, option_type, style, steps, q)
        theta = (p_t - price) / dt_bump  # already per day since dt_bump = 1/365

        p_v_up = BinomialTree.price(S, K, T, r, sigma + dv, option_type, style, steps, q)
        vega = (p_v_up - price) / (dv * 100.0)  # per 1%

        p_r_up = BinomialTree.price(S, K, T, r + 0.01, sigma, option_type, style, steps, q)
        rho = (p_r_up - price)  # per 1%

        return {
            "price": price, "delta": delta, "gamma": gamma,
            "theta": theta, "vega": vega, "rho": rho,
        }

    @staticmethod
    def early_exercise_boundary(S: float, K: float, T: float, r: float, sigma: float,
                                option_type: str = "put", steps: int = 200,
                                q: float = 0.0) -> List[Dict[str, float]]:
        """Find optimal early exercise boundary at each time step."""
        dt = T / steps
        u = math.exp(sigma * math.sqrt(dt))
        d = 1.0 / u
        p = (math.exp((r - q) * dt) - d) / (u - d)
        disc = math.exp(-r * dt)
        is_call = option_type.lower() == "call"

        # Build full tree
        tree_prices = []
        for step in range(steps + 1):
            prices = [S * (u ** (step - i)) * (d ** i) for i in range(step + 1)]
            tree_prices.append(prices)

        # Terminal
        if is_call:
            values = [max(p - K, 0.0) for p in tree_prices[steps]]
        else:
            values = [max(K - p, 0.0) for p in tree_prices[steps]]

        boundary = []
        # Backward induction tracking exercise boundary
        for step in range(steps - 1, -1, -1):
            new_values = []
            exercise_price = None
            for i in range(step + 1):
                hold = disc * (p * values[i] + (1.0 - p) * values[i + 1])
                spot = tree_prices[step][i]
                if is_call:
                    intrinsic = max(spot - K, 0.0)
                else:
                    intrinsic = max(K - spot, 0.0)
                if intrinsic > hold and exercise_price is None:
                    exercise_price = spot
                new_values.append(max(hold, intrinsic))
            values = new_values
            if exercise_price is not None:
                boundary.append({"time": step * dt, "exercise_price": exercise_price})

        return boundary


# ═══════════════════════════════════════════════════════════════════════════════
# 3. MonteCarloOption — MC pricing with antithetic variates
# ═══════════════════════════════════════════════════════════════════════════════

class MonteCarloOption:
    """Monte Carlo option pricing with variance reduction."""

    @staticmethod
    def price(S: float, K: float, T: float, r: float, sigma: float,
              option_type: str = "call", n_paths: int = 100000,
              n_steps: int = 252, q: float = 0.0,
              antithetic: bool = True, seed: int | None = None) -> Dict[str, float]:
        rng = np.random.default_rng(seed)
        dt = T / n_steps
        drift = (r - q - 0.5 * sigma ** 2) * dt
        vol = sigma * math.sqrt(dt)

        half = n_paths // 2 if antithetic else n_paths
        Z = rng.standard_normal((half, n_steps))

        # GBM paths
        log_returns = drift + vol * Z
        paths = S * np.exp(np.cumsum(log_returns, axis=1))
        final = paths[:, -1]

        if antithetic:
            log_returns_anti = drift - vol * Z
            paths_anti = S * np.exp(np.cumsum(log_returns_anti, axis=1))
            final_anti = paths_anti[:, -1]
            final = np.concatenate([final, final_anti])

        is_call = option_type.lower() == "call"
        if is_call:
            payoffs = np.maximum(final - K, 0.0)
        else:
            payoffs = np.maximum(K - final, 0.0)

        discounted = math.exp(-r * T) * payoffs
        price = float(np.mean(discounted))
        std_err = float(np.std(discounted) / math.sqrt(len(discounted)))

        return {
            "price": price,
            "std_error": std_err,
            "confidence_95": [price - 1.96 * std_err, price + 1.96 * std_err],
            "n_paths": len(discounted),
        }

    @staticmethod
    def price_asian(S: float, K: float, T: float, r: float, sigma: float,
                    option_type: str = "call", n_paths: int = 50000,
                    n_steps: int = 252, q: float = 0.0,
                    averaging: str = "arithmetic",
                    seed: int | None = None) -> Dict[str, float]:
        """Asian option pricing — arithmetic or geometric average."""
        rng = np.random.default_rng(seed)
        dt = T / n_steps
        drift = (r - q - 0.5 * sigma ** 2) * dt
        vol = sigma * math.sqrt(dt)

        Z = rng.standard_normal((n_paths, n_steps))
        log_returns = drift + vol * Z
        paths = S * np.exp(np.cumsum(log_returns, axis=1))

        if averaging == "geometric":
            avg = np.exp(np.mean(np.log(paths), axis=1))
        else:
            avg = np.mean(paths, axis=1)

        is_call = option_type.lower() == "call"
        if is_call:
            payoffs = np.maximum(avg - K, 0.0)
        else:
            payoffs = np.maximum(K - avg, 0.0)

        discounted = math.exp(-r * T) * payoffs
        price = float(np.mean(discounted))
        std_err = float(np.std(discounted) / math.sqrt(n_paths))

        return {"price": price, "std_error": std_err, "averaging": averaging}


# ═══════════════════════════════════════════════════════════════════════════════
# 4. ImpliedVolatility — Newton-Raphson solver
# ═══════════════════════════════════════════════════════════════════════════════

class ImpliedVolatility:
    """Implied volatility solver and surface builder."""

    @staticmethod
    def solve(market_price: float, S: float, K: float, T: float, r: float,
              option_type: str = "call", q: float = 0.0,
              tol: float = 1e-8, max_iter: int = 100) -> float:
        """Newton-Raphson IV solver."""
        sigma = 0.25  # initial guess
        for _ in range(max_iter):
            price = BlackScholes.price(S, K, T, r, sigma, option_type, q)
            vega = BlackScholes.vega(S, K, T, r, sigma, q) * 100.0  # undo /100 scaling
            diff = price - market_price
            if abs(diff) < tol:
                return sigma
            if abs(vega) < 1e-12:
                break
            sigma -= diff / vega
            sigma = max(sigma, 0.001)
            sigma = min(sigma, 5.0)
        return sigma

    @staticmethod
    def smile(S: float, T: float, r: float, market_prices: Dict[float, float],
              option_type: str = "call", q: float = 0.0) -> Dict[float, float]:
        """IV smile across strikes: {strike: iv}."""
        result = {}
        for strike, mkt_price in market_prices.items():
            iv = ImpliedVolatility.solve(mkt_price, S, strike, T, r, option_type, q)
            result[strike] = iv
        return result

    @staticmethod
    def term_structure(S: float, K: float, r: float,
                       market_prices: Dict[float, float],
                       option_type: str = "call", q: float = 0.0) -> Dict[float, float]:
        """IV term structure across expiries: {T: iv}."""
        result = {}
        for T, mkt_price in market_prices.items():
            iv = ImpliedVolatility.solve(mkt_price, S, K, T, r, option_type, q)
            result[T] = iv
        return result

    @staticmethod
    def skew(S: float, T: float, r: float, market_prices: Dict[float, float],
             option_type: str = "call", q: float = 0.0) -> Dict[str, float]:
        """Compute skew metrics from IV smile."""
        smile = ImpliedVolatility.smile(S, T, r, market_prices, option_type, q)
        if len(smile) < 3:
            return {"skew": 0.0, "smile_width": 0.0}
        strikes = sorted(smile.keys())
        ivs = [smile[k] for k in strikes]
        atm_idx = min(range(len(strikes)), key=lambda i: abs(strikes[i] - S))
        atm_iv = ivs[atm_idx]
        otm_put_iv = ivs[0]       # lowest strike (OTM put)
        otm_call_iv = ivs[-1]     # highest strike (OTM call)

        return {
            "skew": otm_put_iv - otm_call_iv,
            "smile_width": otm_put_iv + otm_call_iv - 2.0 * atm_iv,
            "atm_iv": atm_iv,
            "otm_put_iv": otm_put_iv,
            "otm_call_iv": otm_call_iv,
            "put_call_skew": otm_put_iv - atm_iv,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 5. VolatilitySurface — strike × expiry IV surface
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class VolSurfacePoint:
    strike: float
    expiry: float
    iv: float
    option_type: str = "call"


class VolatilitySurface:
    """Build and interpolate a volatility surface."""

    def __init__(self):
        self.points: List[VolSurfacePoint] = []

    def add_point(self, strike: float, expiry: float, iv: float,
                  option_type: str = "call") -> None:
        self.points.append(VolSurfacePoint(strike, expiry, iv, option_type))

    def build_from_chain(self, S: float, r: float,
                         chain: List[Dict[str, float]], q: float = 0.0) -> None:
        """Build surface from option chain: [{strike, expiry, price, type}]."""
        for opt in chain:
            strike = opt["strike"]
            expiry = opt["expiry"]
            price = opt["price"]
            otype = opt.get("type", "call")
            iv = ImpliedVolatility.solve(price, S, strike, expiry, r, otype, q)
            self.add_point(strike, expiry, iv, otype)

    def interpolate(self, strike: float, expiry: float) -> float:
        """Bilinear interpolation on the surface."""
        if not self.points:
            return 0.25
        # Find neighbors
        strikes = sorted(set(p.strike for p in self.points))
        expiries = sorted(set(p.expiry for p in self.points))

        # Nearest-neighbor fallback for single-point axes
        k_lo = max([k for k in strikes if k <= strike], default=strikes[0])
        k_hi = min([k for k in strikes if k >= strike], default=strikes[-1])
        t_lo = max([t for t in expiries if t <= expiry], default=expiries[0])
        t_hi = min([t for t in expiries if t >= expiry], default=expiries[-1])

        def _get_iv(k: float, t: float) -> float:
            best = None
            best_dist = float("inf")
            for p in self.points:
                d = abs(p.strike - k) + abs(p.expiry - t)
                if d < best_dist:
                    best_dist = d
                    best = p.iv
            return best or 0.25

        if k_lo == k_hi and t_lo == t_hi:
            return _get_iv(k_lo, t_lo)

        # Bilinear
        iv_ll = _get_iv(k_lo, t_lo)
        iv_lh = _get_iv(k_lo, t_hi)
        iv_hl = _get_iv(k_hi, t_lo)
        iv_hh = _get_iv(k_hi, t_hi)

        if k_hi != k_lo:
            kw = (strike - k_lo) / (k_hi - k_lo)
        else:
            kw = 0.0
        if t_hi != t_lo:
            tw = (expiry - t_lo) / (t_hi - t_lo)
        else:
            tw = 0.0

        iv_lo = iv_ll * (1 - kw) + iv_hl * kw
        iv_hi = iv_lh * (1 - kw) + iv_hh * kw
        return iv_lo * (1 - tw) + iv_hi * tw

    def to_matrix(self) -> Dict[str, Any]:
        """Export surface as matrix for visualization."""
        strikes = sorted(set(p.strike for p in self.points))
        expiries = sorted(set(p.expiry for p in self.points))
        matrix = []
        for t in expiries:
            row = []
            for k in strikes:
                row.append(self.interpolate(k, t))
            matrix.append(row)
        return {"strikes": strikes, "expiries": expiries, "ivs": matrix}


# ═══════════════════════════════════════════════════════════════════════════════
# 6. OptionChainAnalyzer — OI, unusual activity, max pain
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class OptionContract:
    strike: float
    expiry: float
    option_type: str      # "call" or "put"
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


class OptionChainAnalyzer:
    """Analyze option chain data for trading signals."""

    @staticmethod
    def put_call_ratio(chain: List[OptionContract]) -> Dict[str, float]:
        call_vol = sum(c.volume for c in chain if c.option_type == "call")
        put_vol = sum(c.volume for c in chain if c.option_type == "put")
        call_oi = sum(c.open_interest for c in chain if c.option_type == "call")
        put_oi = sum(c.open_interest for c in chain if c.option_type == "put")
        return {
            "volume_pcr": put_vol / call_vol if call_vol > 0 else 0.0,
            "oi_pcr": put_oi / call_oi if call_oi > 0 else 0.0,
            "call_volume": call_vol,
            "put_volume": put_vol,
            "call_oi": call_oi,
            "put_oi": put_oi,
        }

    @staticmethod
    def max_pain(chain: List[OptionContract]) -> Dict[str, Any]:
        """Find max pain strike — price at which option writers suffer least."""
        strikes = sorted(set(c.strike for c in chain))
        if not strikes:
            return {"max_pain_strike": 0.0, "pain_by_strike": {}}
        pain = {}
        for s in strikes:
            total = 0.0
            for c in chain:
                if c.option_type == "call":
                    total += max(s - c.strike, 0.0) * c.open_interest
                else:
                    total += max(c.strike - s, 0.0) * c.open_interest
            pain[s] = total
        mp = min(pain, key=pain.get)
        return {"max_pain_strike": mp, "pain_by_strike": pain}

    @staticmethod
    def unusual_activity(chain: List[OptionContract],
                         vol_oi_threshold: float = 2.0,
                         min_volume: int = 100) -> List[Dict[str, Any]]:
        """Detect unusual options activity — volume >> OI."""
        unusual = []
        for c in chain:
            if c.volume < min_volume:
                continue
            ratio = c.volume / c.open_interest if c.open_interest > 0 else float("inf")
            if ratio >= vol_oi_threshold:
                unusual.append({
                    "strike": c.strike, "type": c.option_type,
                    "volume": c.volume, "open_interest": c.open_interest,
                    "vol_oi_ratio": round(ratio, 2),
                    "iv": c.iv, "expiry": c.expiry,
                })
        unusual.sort(key=lambda x: x["vol_oi_ratio"], reverse=True)
        return unusual

    @staticmethod
    def oi_by_strike(chain: List[OptionContract]) -> Dict[str, Any]:
        """Open interest distribution across strikes."""
        call_oi: Dict[float, int] = {}
        put_oi: Dict[float, int] = {}
        for c in chain:
            if c.option_type == "call":
                call_oi[c.strike] = call_oi.get(c.strike, 0) + c.open_interest
            else:
                put_oi[c.strike] = put_oi.get(c.strike, 0) + c.open_interest
        return {"call_oi": call_oi, "put_oi": put_oi}

    @staticmethod
    def gamma_exposure(chain: List[OptionContract], S: float) -> Dict[str, Any]:
        """Net gamma exposure (GEX) by strike — dealer hedging pressure."""
        gex_by_strike: Dict[float, float] = {}
        for c in chain:
            # Dealers are short what market buys → negate
            sign = 1.0 if c.option_type == "call" else -1.0
            gex = sign * c.gamma * c.open_interest * 100 * S * S * 0.01
            gex_by_strike[c.strike] = gex_by_strike.get(c.strike, 0.0) + gex
        total_gex = sum(gex_by_strike.values())
        flip_strike = 0.0
        # Find zero-gamma crossing
        sorted_strikes = sorted(gex_by_strike.keys())
        for i in range(len(sorted_strikes) - 1):
            g1 = gex_by_strike[sorted_strikes[i]]
            g2 = gex_by_strike[sorted_strikes[i + 1]]
            if g1 * g2 < 0:
                # Linear interpolation
                flip_strike = sorted_strikes[i] + (sorted_strikes[i + 1] - sorted_strikes[i]) * abs(g1) / (abs(g1) + abs(g2))
                break
        return {"gex_by_strike": gex_by_strike, "total_gex": total_gex,
                "gamma_flip": flip_strike}

    @staticmethod
    def iv_percentile(iv_history: List[float], current_iv: float) -> Dict[str, float]:
        """IV rank and percentile."""
        if not iv_history:
            return {"iv_rank": 0.0, "iv_percentile": 0.0}
        sorted_iv = sorted(iv_history)
        rank = (current_iv - min(sorted_iv)) / (max(sorted_iv) - min(sorted_iv)) if max(sorted_iv) > min(sorted_iv) else 0.0
        pct = sum(1 for h in sorted_iv if h <= current_iv) / len(sorted_iv)
        return {"iv_rank": rank, "iv_percentile": pct, "iv_high": max(sorted_iv),
                "iv_low": min(sorted_iv), "iv_mean": sum(sorted_iv) / len(sorted_iv)}


# ═══════════════════════════════════════════════════════════════════════════════
# 7. StrategyBuilder — Multi-leg option strategies
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class OptionLeg:
    strike: float
    option_type: str      # "call" or "put"
    side: str             # "long" or "short"
    quantity: int = 1
    premium: float = 0.0
    expiry: float = 0.0   # years
    sigma: float = 0.25


class StrategyBuilder:
    """Build and analyze multi-leg option strategies."""

    @staticmethod
    def payoff_at_expiry(legs: List[OptionLeg],
                         price_range: Optional[Tuple[float, float]] = None,
                         n_points: int = 200) -> Dict[str, Any]:
        """Calculate P&L across price range at expiry."""
        if not legs:
            return {"prices": [], "payoff": [], "breakevens": []}

        strikes = [leg.strike for leg in legs]
        low = min(strikes) * 0.7
        high = max(strikes) * 1.3
        if price_range:
            low, high = price_range

        prices = np.linspace(low, high, n_points)
        payoff = np.zeros(n_points)

        # Net premium (debit paid / credit received)
        net_premium = 0.0
        for leg in legs:
            sign = -1.0 if leg.side == "long" else 1.0  # long pays, short receives
            net_premium += sign * leg.premium * leg.quantity

        for leg in legs:
            sign = 1.0 if leg.side == "long" else -1.0
            for i, S in enumerate(prices):
                if leg.option_type == "call":
                    intrinsic = max(S - leg.strike, 0.0)
                else:
                    intrinsic = max(leg.strike - S, 0.0)
                payoff[i] += sign * intrinsic * leg.quantity

        # Subtract cost basis
        payoff += net_premium

        # Find breakevens (zero crossings)
        breakevens = []
        for i in range(len(payoff) - 1):
            if payoff[i] * payoff[i + 1] < 0:
                # Linear interpolation
                be = prices[i] + (prices[i + 1] - prices[i]) * abs(payoff[i]) / (abs(payoff[i]) + abs(payoff[i + 1]))
                breakevens.append(round(float(be), 2))

        return {
            "prices": prices.tolist(),
            "payoff": payoff.tolist(),
            "breakevens": breakevens,
            "max_profit": float(np.max(payoff)),
            "max_loss": float(np.min(payoff)),
            "net_premium": net_premium,
        }

    @staticmethod
    def greeks_at_price(legs: List[OptionLeg], S: float, r: float = 0.05,
                        q: float = 0.0) -> Dict[str, float]:
        """Aggregate Greeks for all legs at a given underlying price."""
        total = {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0, "rho": 0.0}
        for leg in legs:
            sign = 1.0 if leg.side == "long" else -1.0
            T = leg.expiry if leg.expiry > 0 else 30 / 365.0
            greeks = BlackScholes.all_greeks(S, leg.strike, T, r, leg.sigma, leg.option_type, q)
            for key in total:
                total[key] += sign * greeks[key] * leg.quantity
        return total

    @staticmethod
    def strategies_library() -> Dict[str, Any]:
        """Return predefined strategies with leg templates."""
        return {
            "long_call": {"legs": [{"type": "call", "side": "long"}], "sentiment": "bullish"},
            "long_put": {"legs": [{"type": "put", "side": "long"}], "sentiment": "bearish"},
            "covered_call": {
                "legs": [{"type": "stock", "side": "long"}, {"type": "call", "side": "short"}],
                "sentiment": "neutral-bullish",
            },
            "protective_put": {
                "legs": [{"type": "stock", "side": "long"}, {"type": "put", "side": "long"}],
                "sentiment": "bullish-hedged",
            },
            "bull_call_spread": {
                "legs": [
                    {"type": "call", "side": "long", "strike": "lower"},
                    {"type": "call", "side": "short", "strike": "higher"},
                ],
                "sentiment": "moderately bullish",
            },
            "bear_put_spread": {
                "legs": [
                    {"type": "put", "side": "long", "strike": "higher"},
                    {"type": "put", "side": "short", "strike": "lower"},
                ],
                "sentiment": "moderately bearish",
            },
            "iron_condor": {
                "legs": [
                    {"type": "put", "side": "short", "strike": "lower-mid"},
                    {"type": "put", "side": "long", "strike": "lower"},
                    {"type": "call", "side": "short", "strike": "upper-mid"},
                    {"type": "call", "side": "long", "strike": "upper"},
                ],
                "sentiment": "neutral",
            },
            "iron_butterfly": {
                "legs": [
                    {"type": "put", "side": "long", "strike": "lower"},
                    {"type": "put", "side": "short", "strike": "middle"},
                    {"type": "call", "side": "short", "strike": "middle"},
                    {"type": "call", "side": "long", "strike": "upper"},
                ],
                "sentiment": "neutral",
            },
            "straddle": {
                "legs": [
                    {"type": "call", "side": "long", "strike": "atm"},
                    {"type": "put", "side": "long", "strike": "atm"},
                ],
                "sentiment": "volatile",
            },
            "strangle": {
                "legs": [
                    {"type": "call", "side": "long", "strike": "otm-call"},
                    {"type": "put", "side": "long", "strike": "otm-put"},
                ],
                "sentiment": "volatile",
            },
            "calendar_spread": {
                "legs": [
                    {"type": "call", "side": "short", "strike": "same", "expiry": "near"},
                    {"type": "call", "side": "long", "strike": "same", "expiry": "far"},
                ],
                "sentiment": "neutral",
            },
            "ratio_spread": {
                "legs": [
                    {"type": "call", "side": "long", "strike": "lower", "qty": 1},
                    {"type": "call", "side": "short", "strike": "higher", "qty": 2},
                ],
                "sentiment": "neutral-bullish",
            },
            "jade_lizard": {
                "legs": [
                    {"type": "put", "side": "short", "strike": "otm-put"},
                    {"type": "call", "side": "short", "strike": "otm-call-lower"},
                    {"type": "call", "side": "long", "strike": "otm-call-upper"},
                ],
                "sentiment": "neutral-bullish",
            },
        }

    @staticmethod
    def analyze_strategy(legs: List[OptionLeg], S: float, r: float = 0.05,
                         q: float = 0.0) -> Dict[str, Any]:
        """Full strategy analysis — payoff, Greeks, risk/reward."""
        payoff = StrategyBuilder.payoff_at_expiry(legs)
        greeks = StrategyBuilder.greeks_at_price(legs, S, r, q)

        max_profit = payoff["max_profit"]
        max_loss = payoff["max_loss"]
        risk_reward = abs(max_profit / max_loss) if max_loss != 0 else float("inf")

        return {
            "payoff_summary": {
                "breakevens": payoff["breakevens"],
                "max_profit": max_profit,
                "max_loss": max_loss,
                "net_premium": payoff["net_premium"],
                "risk_reward_ratio": round(risk_reward, 2),
            },
            "greeks": greeks,
            "legs": len(legs),
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 8. ExoticOptions — Barrier, Digital, Lookback
# ═══════════════════════════════════════════════════════════════════════════════

class ExoticOptions:
    """Pricing for exotic option types via Monte Carlo."""

    @staticmethod
    def barrier(S: float, K: float, T: float, r: float, sigma: float,
                barrier: float, barrier_type: str = "down-and-out",
                option_type: str = "call", n_paths: int = 50000,
                n_steps: int = 252, q: float = 0.0,
                seed: int | None = None) -> Dict[str, float]:
        """Price barrier options via MC simulation."""
        rng = np.random.default_rng(seed)
        dt = T / n_steps
        drift = (r - q - 0.5 * sigma ** 2) * dt
        vol = sigma * math.sqrt(dt)

        Z = rng.standard_normal((n_paths, n_steps))
        log_returns = drift + vol * Z
        paths = np.column_stack([np.full(n_paths, S),
                                  S * np.exp(np.cumsum(log_returns, axis=1))])

        is_call = option_type.lower() == "call"

        if barrier_type == "down-and-out":
            alive = np.all(paths >= barrier, axis=1)
        elif barrier_type == "down-and-in":
            alive = np.any(paths < barrier, axis=1)
        elif barrier_type == "up-and-out":
            alive = np.all(paths <= barrier, axis=1)
        elif barrier_type == "up-and-in":
            alive = np.any(paths > barrier, axis=1)
        else:
            alive = np.ones(n_paths, dtype=bool)

        final = paths[:, -1]
        if is_call:
            payoffs = np.maximum(final - K, 0.0) * alive
        else:
            payoffs = np.maximum(K - final, 0.0) * alive

        price = float(math.exp(-r * T) * np.mean(payoffs))
        std_err = float(math.exp(-r * T) * np.std(payoffs) / math.sqrt(n_paths))

        return {"price": price, "std_error": std_err, "barrier_type": barrier_type,
                "knock_pct": float(np.mean(alive))}

    @staticmethod
    def digital(S: float, K: float, T: float, r: float, sigma: float,
                option_type: str = "call", payout: float = 1.0,
                q: float = 0.0) -> Dict[str, float]:
        """Digital (binary/cash-or-nothing) option — analytical."""
        d2 = BlackScholes.d2(S, K, T, r, sigma, q)
        if option_type.lower() == "call":
            price = payout * math.exp(-r * T) * _norm_cdf(d2)
        else:
            price = payout * math.exp(-r * T) * _norm_cdf(-d2)
        return {"price": price, "payout": payout}

    @staticmethod
    def lookback(S: float, K: float, T: float, r: float, sigma: float,
                 option_type: str = "call", lookback_type: str = "fixed",
                 n_paths: int = 50000, n_steps: int = 252, q: float = 0.0,
                 seed: int | None = None) -> Dict[str, float]:
        """Lookback option pricing via MC."""
        rng = np.random.default_rng(seed)
        dt = T / n_steps
        drift = (r - q - 0.5 * sigma ** 2) * dt
        vol = sigma * math.sqrt(dt)

        Z = rng.standard_normal((n_paths, n_steps))
        log_returns = drift + vol * Z
        paths = np.column_stack([np.full(n_paths, S),
                                  S * np.exp(np.cumsum(log_returns, axis=1))])

        if lookback_type == "floating":
            # Floating strike: call pays S_T - S_min, put pays S_max - S_T
            if option_type.lower() == "call":
                payoffs = paths[:, -1] - np.min(paths, axis=1)
            else:
                payoffs = np.max(paths, axis=1) - paths[:, -1]
        else:
            # Fixed strike: call pays max(S_max - K, 0), put pays max(K - S_min, 0)
            if option_type.lower() == "call":
                payoffs = np.maximum(np.max(paths, axis=1) - K, 0.0)
            else:
                payoffs = np.maximum(K - np.min(paths, axis=1), 0.0)

        price = float(math.exp(-r * T) * np.mean(payoffs))
        std_err = float(math.exp(-r * T) * np.std(payoffs) / math.sqrt(n_paths))
        return {"price": price, "std_error": std_err, "lookback_type": lookback_type}


# ═══════════════════════════════════════════════════════════════════════════════
# 9. OptionsPricingEngine — Unified orchestrator
# ═══════════════════════════════════════════════════════════════════════════════

class OptionsPricingEngine:
    """Unified options pricing engine wrapping all components."""

    def __init__(self):
        self.vol_surface = VolatilitySurface()
        self._chain_cache: Dict[str, List[OptionContract]] = {}

    def price_european(self, S: float, K: float, T: float, r: float, sigma: float,
                       option_type: str = "call", q: float = 0.0) -> Dict[str, float]:
        return BlackScholes.all_greeks(S, K, T, r, sigma, option_type, q)

    def price_american(self, S: float, K: float, T: float, r: float, sigma: float,
                       option_type: str = "call", steps: int = 200,
                       q: float = 0.0) -> Dict[str, float]:
        return BinomialTree.price_with_greeks(S, K, T, r, sigma, option_type,
                                               "american", steps, q)

    def price_monte_carlo(self, S: float, K: float, T: float, r: float, sigma: float,
                          option_type: str = "call", n_paths: int = 100000,
                          q: float = 0.0) -> Dict[str, float]:
        return MonteCarloOption.price(S, K, T, r, sigma, option_type, n_paths, q=q)

    def implied_vol(self, market_price: float, S: float, K: float, T: float,
                    r: float, option_type: str = "call", q: float = 0.0) -> float:
        return ImpliedVolatility.solve(market_price, S, K, T, r, option_type, q)

    def build_surface(self, S: float, r: float, chain: List[Dict[str, float]],
                      q: float = 0.0) -> Dict[str, Any]:
        self.vol_surface = VolatilitySurface()
        self.vol_surface.build_from_chain(S, r, chain, q)
        return self.vol_surface.to_matrix()

    def store_chain(self, symbol: str, contracts: List[OptionContract]) -> int:
        self._chain_cache[symbol] = contracts
        return len(contracts)

    def analyze_chain(self, symbol: str) -> Dict[str, Any]:
        chain = self._chain_cache.get(symbol, [])
        if not chain:
            return {"error": "No chain data"}
        return {
            "put_call_ratio": OptionChainAnalyzer.put_call_ratio(chain),
            "max_pain": OptionChainAnalyzer.max_pain(chain),
            "unusual_activity": OptionChainAnalyzer.unusual_activity(chain),
        }

    def strategy_payoff(self, legs: List[OptionLeg], S: float,
                        r: float = 0.05) -> Dict[str, Any]:
        return StrategyBuilder.analyze_strategy(legs, S, r)

    def capabilities(self) -> Dict[str, Any]:
        return {
            "pricing_models": [
                "Black-Scholes (European, analytical)",
                "CRR Binomial Tree (American/European, N-step)",
                "Monte Carlo with antithetic variates",
            ],
            "greeks": [
                "delta", "gamma", "theta", "vega", "rho",
                "charm", "vanna", "volga", "speed",
            ],
            "exotics": ["barrier (4 types)", "digital/binary", "lookback (fixed/floating)", "asian"],
            "analysis": [
                "Implied volatility (Newton-Raphson)",
                "Volatility surface (bilinear interpolation)",
                "IV smile, term structure, skew",
                "Put/call ratio, max pain, gamma exposure",
                "Unusual activity detection",
                "IV rank & percentile",
                "Multi-leg strategy builder (13+ strategies)",
                "Early exercise boundary",
            ],
        }
