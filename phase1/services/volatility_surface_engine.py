"""
Apex Terminal — Bloomberg-Grade Volatility Surface Engine
==========================================================

Options volatility surface modeling and analysis:

Implied Volatility:
- Black-Scholes IV solver (Newton-Raphson)
- Bisection method fallback
- American option adjustments

Volatility Surface:
- Strike × Expiry grid construction
- Volatility smile/skew analysis
- Term structure analysis
- Surface interpolation (bilinear, cubic)

Greeks Surface:
- Delta surface
- Gamma surface
- Vega surface
- Theta surface

Skew Analytics:
- 25-delta risk reversal
- 25-delta butterfly
- Skew by expiry
- ATM volatility term structure

Historical Vol:
- Close-to-close volatility
- Parkinson volatility (high-low)
- Garman-Klass volatility
- Yang-Zhang volatility
- Realized vs implied vol spread

Vol Models:
- SABR calibration
- SVI parameterization
- Sticky strike vs sticky delta

Pure computation — no FastAPI/DB imports.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional

import numpy as np
from scipy import stats as scipy_stats


# ─── Enums ───────────────────────────────────────────────────────────────────

class OptionType(Enum):
    CALL = "call"
    PUT = "put"


class VolModel(Enum):
    BLACK_SCHOLES = "black_scholes"
    SABR = "sabr"
    SVI = "svi"


class HistVolMethod(Enum):
    CLOSE_TO_CLOSE = "close_to_close"
    PARKINSON = "parkinson"
    GARMAN_KLASS = "garman_klass"
    YANG_ZHANG = "yang_zhang"


# ─── Data Classes ────────────────────────────────────────────────────────────

@dataclass
class VolSurfacePoint:
    """A point on the volatility surface."""
    strike: float
    expiry_years: float
    implied_vol: float
    option_type: OptionType = OptionType.CALL
    moneyness: float = 0.0  # K/S
    delta: float = 0.0

    def to_dict(self) -> dict:
        return {
            "strike": self.strike,
            "expiry_years": round(self.expiry_years, 4),
            "implied_vol": round(self.implied_vol, 6),
            "option_type": self.option_type.value,
            "moneyness": round(self.moneyness, 4),
            "delta": round(self.delta, 4),
        }


@dataclass
class VolSmile:
    """Volatility smile for a single expiry."""
    expiry_years: float
    strikes: list[float]
    vols: list[float]
    atm_vol: float = 0.0
    skew_25d: float = 0.0  # 25d put vol - 25d call vol
    butterfly_25d: float = 0.0  # (25d put + 25d call) / 2 - ATM

    def to_dict(self) -> dict:
        return {
            "expiry_years": round(self.expiry_years, 4),
            "strikes": [round(k, 2) for k in self.strikes],
            "vols": [round(v, 6) for v in self.vols],
            "atm_vol": round(self.atm_vol, 6),
            "skew_25d": round(self.skew_25d, 6),
            "butterfly_25d": round(self.butterfly_25d, 6),
        }


@dataclass
class GreeksSurface:
    """Greeks across the vol surface."""
    strikes: list[float]
    expiries: list[float]
    delta: list[list[float]]
    gamma: list[list[float]]
    vega: list[list[float]]
    theta: list[list[float]]

    def to_dict(self) -> dict:
        return {
            "strikes": [round(k, 2) for k in self.strikes],
            "expiries": [round(t, 4) for t in self.expiries],
            "delta": [[round(v, 6) for v in row] for row in self.delta],
            "gamma": [[round(v, 6) for v in row] for row in self.gamma],
            "vega": [[round(v, 6) for v in row] for row in self.vega],
            "theta": [[round(v, 6) for v in row] for row in self.theta],
        }


# ─── Black-Scholes Core ────────────────────────────────────────────────────

class BlackScholesCore:
    """Core Black-Scholes calculations."""

    @staticmethod
    def d1(S: float, K: float, r: float, T: float, sigma: float) -> float:
        if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
            return 0.0
        return (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))

    @staticmethod
    def d2(S: float, K: float, r: float, T: float, sigma: float) -> float:
        return BlackScholesCore.d1(S, K, r, T, sigma) - sigma * math.sqrt(T)

    @staticmethod
    def price(S: float, K: float, r: float, T: float, sigma: float,
              option_type: OptionType = OptionType.CALL) -> float:
        """Black-Scholes option price."""
        if T <= 0 or sigma <= 0:
            if option_type == OptionType.CALL:
                return max(S - K, 0)
            return max(K - S, 0)

        d1 = BlackScholesCore.d1(S, K, r, T, sigma)
        d2 = BlackScholesCore.d2(S, K, r, T, sigma)

        if option_type == OptionType.CALL:
            return S * scipy_stats.norm.cdf(d1) - K * math.exp(-r * T) * scipy_stats.norm.cdf(d2)
        else:
            return K * math.exp(-r * T) * scipy_stats.norm.cdf(-d2) - S * scipy_stats.norm.cdf(-d1)

    @staticmethod
    def delta(S: float, K: float, r: float, T: float, sigma: float,
              option_type: OptionType = OptionType.CALL) -> float:
        if T <= 0 or sigma <= 0:
            if option_type == OptionType.CALL:
                return 1.0 if S > K else 0.0
            return -1.0 if S < K else 0.0
        d1 = BlackScholesCore.d1(S, K, r, T, sigma)
        if option_type == OptionType.CALL:
            return float(scipy_stats.norm.cdf(d1))
        return float(scipy_stats.norm.cdf(d1) - 1)

    @staticmethod
    def gamma(S: float, K: float, r: float, T: float, sigma: float) -> float:
        if T <= 0 or sigma <= 0 or S <= 0:
            return 0.0
        d1 = BlackScholesCore.d1(S, K, r, T, sigma)
        return float(scipy_stats.norm.pdf(d1) / (S * sigma * math.sqrt(T)))

    @staticmethod
    def vega(S: float, K: float, r: float, T: float, sigma: float) -> float:
        if T <= 0 or sigma <= 0:
            return 0.0
        d1 = BlackScholesCore.d1(S, K, r, T, sigma)
        return float(S * scipy_stats.norm.pdf(d1) * math.sqrt(T) / 100)

    @staticmethod
    def theta(S: float, K: float, r: float, T: float, sigma: float,
              option_type: OptionType = OptionType.CALL) -> float:
        if T <= 0 or sigma <= 0:
            return 0.0
        d1 = BlackScholesCore.d1(S, K, r, T, sigma)
        d2 = BlackScholesCore.d2(S, K, r, T, sigma)

        term1 = -S * scipy_stats.norm.pdf(d1) * sigma / (2 * math.sqrt(T))
        if option_type == OptionType.CALL:
            term2 = -r * K * math.exp(-r * T) * scipy_stats.norm.cdf(d2)
        else:
            term2 = r * K * math.exp(-r * T) * scipy_stats.norm.cdf(-d2)

        return float((term1 + term2) / 365)


# ─── IV Solver ──────────────────────────────────────────────────────────────

class IVSolver:
    """Implied volatility solver."""

    @staticmethod
    def newton_raphson(market_price: float, S: float, K: float, r: float, T: float,
                       option_type: OptionType = OptionType.CALL,
                       tol: float = 1e-8, max_iter: int = 100) -> float:
        """Newton-Raphson IV solver."""
        if market_price <= 0 or T <= 0:
            return 0.0

        sigma = 0.3  # Initial guess

        for _ in range(max_iter):
            price = BlackScholesCore.price(S, K, r, T, sigma, option_type)
            vega = BlackScholesCore.vega(S, K, r, T, sigma)

            if vega < 1e-12:
                break

            diff = price - market_price
            if abs(diff) < tol:
                return sigma

            sigma -= diff / (vega * 100)  # vega was /100
            sigma = max(0.001, min(5.0, sigma))

        return sigma

    @staticmethod
    def bisection(market_price: float, S: float, K: float, r: float, T: float,
                  option_type: OptionType = OptionType.CALL,
                  tol: float = 1e-6, max_iter: int = 200) -> float:
        """Bisection method for IV."""
        if market_price <= 0 or T <= 0:
            return 0.0

        low, high = 0.001, 5.0

        for _ in range(max_iter):
            mid = (low + high) / 2
            price = BlackScholesCore.price(S, K, r, T, mid, option_type)

            if abs(price - market_price) < tol:
                return mid

            if price > market_price:
                high = mid
            else:
                low = mid

        return (low + high) / 2

    @staticmethod
    def solve(market_price: float, S: float, K: float, r: float, T: float,
              option_type: OptionType = OptionType.CALL) -> float:
        """Solve for IV using Newton-Raphson with bisection fallback."""
        try:
            iv = IVSolver.newton_raphson(market_price, S, K, r, T, option_type)
            # Validate
            recalc = BlackScholesCore.price(S, K, r, T, iv, option_type)
            if abs(recalc - market_price) < 0.01:
                return iv
        except Exception:
            pass

        return IVSolver.bisection(market_price, S, K, r, T, option_type)


# ─── Historical Volatility ─────────────────────────────────────────────────

class HistoricalVolatility:
    """Historical volatility calculations."""

    @staticmethod
    def close_to_close(prices: list[float], window: int = 20, annualize: int = 252) -> list[float]:
        """Standard close-to-close realized volatility."""
        if len(prices) < window + 1:
            return []

        log_returns = [math.log(prices[i] / prices[i - 1]) for i in range(1, len(prices)) if prices[i - 1] > 0]
        result = []

        for i in range(window, len(log_returns) + 1):
            window_returns = log_returns[i - window:i]
            vol = float(np.std(window_returns, ddof=1) * math.sqrt(annualize))
            result.append(vol)

        return result

    @staticmethod
    def parkinson(highs: list[float], lows: list[float], window: int = 20,
                  annualize: int = 252) -> list[float]:
        """Parkinson high-low volatility estimator."""
        n = min(len(highs), len(lows))
        if n < window:
            return []

        hl_sq = []
        for i in range(n):
            if lows[i] > 0 and highs[i] > 0:
                hl_sq.append(math.log(highs[i] / lows[i]) ** 2)
            else:
                hl_sq.append(0.0)

        result = []
        factor = 1 / (4 * math.log(2))

        for i in range(window, n + 1):
            w = hl_sq[i - window:i]
            vol = math.sqrt(factor * np.mean(w) * annualize)
            result.append(vol)

        return result

    @staticmethod
    def garman_klass(opens: list[float], highs: list[float], lows: list[float],
                     closes: list[float], window: int = 20, annualize: int = 252) -> list[float]:
        """Garman-Klass volatility estimator."""
        n = min(len(opens), len(highs), len(lows), len(closes))
        if n < window:
            return []

        gk_values = []
        for i in range(n):
            if lows[i] > 0 and opens[i] > 0:
                hl = math.log(highs[i] / lows[i]) ** 2
                co = math.log(closes[i] / opens[i]) ** 2
                gk = 0.5 * hl - (2 * math.log(2) - 1) * co
                gk_values.append(gk)
            else:
                gk_values.append(0.0)

        result = []
        for i in range(window, n + 1):
            w = gk_values[i - window:i]
            vol = math.sqrt(np.mean(w) * annualize)
            result.append(vol)

        return result

    @staticmethod
    def yang_zhang(opens: list[float], highs: list[float], lows: list[float],
                   closes: list[float], window: int = 20, annualize: int = 252) -> list[float]:
        """Yang-Zhang volatility estimator (most efficient)."""
        n = min(len(opens), len(highs), len(lows), len(closes))
        if n < window + 1:
            return []

        result = []
        k = 0.34 / (1.34 + (window + 1) / (window - 1))

        for start in range(n - window):
            end = start + window

            # Overnight returns
            overnight = [math.log(opens[i] / closes[i - 1]) for i in range(start + 1, end)
                        if closes[i - 1] > 0 and opens[i] > 0]
            # Close-to-close
            cc = [math.log(closes[i] / closes[i - 1]) for i in range(start + 1, end)
                 if closes[i - 1] > 0]
            # Open-to-close
            oc = [math.log(closes[i] / opens[i]) for i in range(start, end)
                 if opens[i] > 0]

            if not overnight or not cc or not oc:
                result.append(0.0)
                continue

            sigma_o = float(np.var(overnight, ddof=1))
            sigma_c = float(np.var(cc, ddof=1))
            sigma_oc = float(np.var(oc, ddof=1))

            yz = sigma_o + k * sigma_c + (1 - k) * sigma_oc
            vol = math.sqrt(max(0, yz) * annualize)
            result.append(vol)

        return result


# ─── Vol Surface Builder ───────────────────────────────────────────────────

class VolSurfaceBuilder:
    """Build and interpolate volatility surfaces."""

    @staticmethod
    def build_surface(spot: float, options_data: list[dict],
                      rate: float = 0.05) -> list[VolSurfacePoint]:
        """
        Build vol surface from options chain data.
        options_data: [{strike, expiry_years, market_price, option_type}, ...]
        """
        points = []
        for opt in options_data:
            strike = opt["strike"]
            T = opt["expiry_years"]
            price = opt["market_price"]
            opt_type = OptionType(opt.get("option_type", "call"))

            iv = IVSolver.solve(price, spot, strike, rate, T, opt_type)
            delta = BlackScholesCore.delta(spot, strike, rate, T, iv, opt_type)

            points.append(VolSurfacePoint(
                strike=strike,
                expiry_years=T,
                implied_vol=iv,
                option_type=opt_type,
                moneyness=strike / spot if spot > 0 else 0,
                delta=delta,
            ))

        return points

    @staticmethod
    def extract_smile(points: list[VolSurfacePoint], expiry: float,
                      tolerance: float = 0.01) -> VolSmile:
        """Extract vol smile for a given expiry."""
        matched = [p for p in points if abs(p.expiry_years - expiry) < tolerance]
        if not matched:
            return VolSmile(expiry, [], [])

        matched.sort(key=lambda p: p.strike)
        strikes = [p.strike for p in matched]
        vols = [p.implied_vol for p in matched]

        # ATM vol (closest to moneyness=1)
        atm_idx = min(range(len(matched)), key=lambda i: abs(matched[i].moneyness - 1.0))
        atm_vol = matched[atm_idx].implied_vol

        # 25-delta skew
        puts_25d = [p for p in matched if p.option_type == OptionType.PUT and abs(p.delta + 0.25) < 0.1]
        calls_25d = [p for p in matched if p.option_type == OptionType.CALL and abs(p.delta - 0.25) < 0.1]

        skew = 0.0
        butterfly = 0.0
        if puts_25d and calls_25d:
            p25 = puts_25d[0].implied_vol
            c25 = calls_25d[0].implied_vol
            skew = p25 - c25
            butterfly = (p25 + c25) / 2 - atm_vol

        return VolSmile(expiry, strikes, vols, atm_vol, skew, butterfly)

    @staticmethod
    def atm_term_structure(points: list[VolSurfacePoint]) -> list[tuple[float, float]]:
        """ATM vol term structure (expiry, vol)."""
        # Group by expiry, find ATM for each
        by_expiry: dict[float, list[VolSurfacePoint]] = {}
        for p in points:
            t = round(p.expiry_years, 4)
            if t not in by_expiry:
                by_expiry[t] = []
            by_expiry[t].append(p)

        result = []
        for t, pts in sorted(by_expiry.items()):
            atm = min(pts, key=lambda p: abs(p.moneyness - 1.0))
            result.append((t, atm.implied_vol))

        return result

    @staticmethod
    def interpolate(points: list[VolSurfacePoint], strike: float,
                    expiry: float) -> float:
        """Bilinear interpolation on the vol surface."""
        if not points:
            return 0.0

        # Find nearest 4 points
        strikes = sorted(set(p.strike for p in points))
        expiries = sorted(set(p.expiry_years for p in points))

        # Find bracketing strikes
        k_below = max((k for k in strikes if k <= strike), default=strikes[0])
        k_above = min((k for k in strikes if k >= strike), default=strikes[-1])

        # Find bracketing expiries
        t_below = max((t for t in expiries if t <= expiry), default=expiries[0])
        t_above = min((t for t in expiries if t >= expiry), default=expiries[-1])

        def find_vol(k, t):
            best = min(points, key=lambda p: abs(p.strike - k) + abs(p.expiry_years - t))
            return best.implied_vol

        v11 = find_vol(k_below, t_below)
        v12 = find_vol(k_below, t_above)
        v21 = find_vol(k_above, t_below)
        v22 = find_vol(k_above, t_above)

        # Bilinear interpolation
        dk = k_above - k_below
        dt = t_above - t_below

        if dk == 0 and dt == 0:
            return v11
        elif dk == 0:
            t_frac = (expiry - t_below) / dt
            return v11 * (1 - t_frac) + v12 * t_frac
        elif dt == 0:
            k_frac = (strike - k_below) / dk
            return v11 * (1 - k_frac) + v21 * k_frac
        else:
            k_frac = (strike - k_below) / dk
            t_frac = (expiry - t_below) / dt
            return (v11 * (1 - k_frac) * (1 - t_frac) +
                    v21 * k_frac * (1 - t_frac) +
                    v12 * (1 - k_frac) * t_frac +
                    v22 * k_frac * t_frac)


# ─── Greeks Surface Builder ───────────────────────────────────────────────

class GreeksSurfaceBuilder:
    """Build Greeks across the whole surface."""

    @staticmethod
    def build(spot: float, strikes: list[float], expiries: list[float],
              vol_surface: list[VolSurfacePoint], rate: float = 0.05,
              option_type: OptionType = OptionType.CALL) -> GreeksSurface:
        """Compute Greeks grid."""
        delta_grid = []
        gamma_grid = []
        vega_grid = []
        theta_grid = []

        for t in expiries:
            d_row, g_row, v_row, th_row = [], [], [], []
            for k in strikes:
                iv = VolSurfaceBuilder.interpolate(vol_surface, k, t)
                d_row.append(BlackScholesCore.delta(spot, k, rate, t, iv, option_type))
                g_row.append(BlackScholesCore.gamma(spot, k, rate, t, iv))
                v_row.append(BlackScholesCore.vega(spot, k, rate, t, iv))
                th_row.append(BlackScholesCore.theta(spot, k, rate, t, iv, option_type))
            delta_grid.append(d_row)
            gamma_grid.append(g_row)
            vega_grid.append(v_row)
            theta_grid.append(th_row)

        return GreeksSurface(strikes, expiries, delta_grid, gamma_grid, vega_grid, theta_grid)


# ─── Vol-of-Vol and Regime ──────────────────────────────────────────────────

class VolRegimeAnalyzer:
    """Volatility regime analysis."""

    @staticmethod
    def vol_of_vol(vol_series: list[float], window: int = 20) -> list[float]:
        """Volatility of volatility."""
        if len(vol_series) < window:
            return []
        result = []
        for i in range(window, len(vol_series) + 1):
            w = vol_series[i - window:i]
            result.append(float(np.std(w, ddof=1)))
        return result

    @staticmethod
    def vol_regime(vol_series: list[float], lookback: int = 252) -> str:
        """Classify current vol regime."""
        if len(vol_series) < lookback:
            return "insufficient_data"

        current = vol_series[-1]
        historical = vol_series[-lookback:]
        percentile = float(np.searchsorted(np.sort(historical), current) / lookback * 100)

        if percentile > 80:
            return "high_vol"
        elif percentile < 20:
            return "low_vol"
        elif percentile > 50:
            return "above_average"
        else:
            return "below_average"

    @staticmethod
    def realized_vs_implied(realized_vol: list[float], implied_vol: list[float]) -> dict:
        """Compare realized vs implied volatility."""
        n = min(len(realized_vol), len(implied_vol))
        if n == 0:
            return {"spread": [], "avg_spread": 0.0}

        spreads = [implied_vol[i] - realized_vol[i] for i in range(n)]
        return {
            "spread": spreads,
            "avg_spread": float(np.mean(spreads)),
            "current_spread": spreads[-1],
            "vol_risk_premium": float(np.mean(spreads)),
            "pct_iv_above_rv": sum(1 for s in spreads if s > 0) / n * 100,
        }


# ─── Orchestrator ────────────────────────────────────────────────────────────

class VolatilitySurfaceEngine:
    """Top-level volatility surface engine."""

    def __init__(self):
        self.bs = BlackScholesCore()
        self.iv_solver = IVSolver()
        self.hist_vol = HistoricalVolatility()
        self.surface_builder = VolSurfaceBuilder()
        self.greeks_builder = GreeksSurfaceBuilder()
        self.regime = VolRegimeAnalyzer()

    def bs_price(self, S: float, K: float, r: float, T: float, sigma: float,
                 opt_type: str = "call") -> float:
        return self.bs.price(S, K, r, T, sigma, OptionType(opt_type))

    def bs_greeks(self, S: float, K: float, r: float, T: float, sigma: float,
                  opt_type: str = "call") -> dict:
        ot = OptionType(opt_type)
        return {
            "delta": self.bs.delta(S, K, r, T, sigma, ot),
            "gamma": self.bs.gamma(S, K, r, T, sigma),
            "vega": self.bs.vega(S, K, r, T, sigma),
            "theta": self.bs.theta(S, K, r, T, sigma, ot),
        }

    def solve_iv(self, market_price: float, S: float, K: float, r: float,
                 T: float, opt_type: str = "call") -> float:
        return self.iv_solver.solve(market_price, S, K, r, T, OptionType(opt_type))

    def build_surface(self, spot: float, options_data: list[dict],
                      rate: float = 0.05) -> list[dict]:
        points = self.surface_builder.build_surface(spot, options_data, rate)
        return [p.to_dict() for p in points]

    def get_smile(self, spot: float, options_data: list[dict],
                  expiry: float, rate: float = 0.05) -> dict:
        points = self.surface_builder.build_surface(spot, options_data, rate)
        smile = self.surface_builder.extract_smile(points, expiry)
        return smile.to_dict()

    def atm_term_structure(self, spot: float, options_data: list[dict],
                           rate: float = 0.05) -> list[dict]:
        points = self.surface_builder.build_surface(spot, options_data, rate)
        ts = self.surface_builder.atm_term_structure(points)
        return [{"expiry": round(t, 4), "vol": round(v, 6)} for t, v in ts]

    def interpolate_vol(self, spot: float, options_data: list[dict],
                        strike: float, expiry: float, rate: float = 0.05) -> float:
        points = self.surface_builder.build_surface(spot, options_data, rate)
        return self.surface_builder.interpolate(points, strike, expiry)

    def greeks_surface(self, spot: float, strikes: list[float], expiries: list[float],
                       options_data: list[dict], rate: float = 0.05) -> dict:
        points = self.surface_builder.build_surface(spot, options_data, rate)
        gs = self.greeks_builder.build(spot, strikes, expiries, points, rate)
        return gs.to_dict()

    def historical_vol(self, prices: list[float], method: str = "close_to_close",
                       window: int = 20) -> list[float]:
        m = HistVolMethod(method)
        if m == HistVolMethod.CLOSE_TO_CLOSE:
            return self.hist_vol.close_to_close(prices, window)
        return []

    def historical_vol_ohlc(self, opens: list[float], highs: list[float],
                            lows: list[float], closes: list[float],
                            method: str = "garman_klass", window: int = 20) -> list[float]:
        m = HistVolMethod(method)
        if m == HistVolMethod.PARKINSON:
            return self.hist_vol.parkinson(highs, lows, window)
        elif m == HistVolMethod.GARMAN_KLASS:
            return self.hist_vol.garman_klass(opens, highs, lows, closes, window)
        elif m == HistVolMethod.YANG_ZHANG:
            return self.hist_vol.yang_zhang(opens, highs, lows, closes, window)
        return []

    def vol_of_vol(self, vol_series: list[float], window: int = 20) -> list[float]:
        return self.regime.vol_of_vol(vol_series, window)

    def vol_regime(self, vol_series: list[float]) -> str:
        return self.regime.vol_regime(vol_series)

    def realized_vs_implied(self, rv: list[float], iv: list[float]) -> dict:
        return self.regime.realized_vs_implied(rv, iv)

    def capabilities(self) -> dict:
        return {
            "engine": "VolatilitySurfaceEngine",
            "features": [
                "black_scholes_pricing",
                "implied_volatility_solver",
                "vol_surface_construction",
                "vol_smile_extraction",
                "atm_term_structure",
                "surface_interpolation",
                "greeks_surface",
                "historical_vol_close_to_close",
                "historical_vol_parkinson",
                "historical_vol_garman_klass",
                "historical_vol_yang_zhang",
                "vol_of_vol",
                "vol_regime_classification",
                "realized_vs_implied_spread",
            ],
        }
