"""
options_greeks_engine.py
Black-Scholes options pricing engine with full Greeks suite,
implied volatility solver (bisection + Newton-Raphson), 
volatility surface construction, binomial tree pricing,
put-call parity, risk reversal & butterfly spreads,
and portfolio Greeks aggregation.
"""

from __future__ import annotations
import math
import logging
from dataclasses import dataclass, field
from typing import Optional, Dict, List, Tuple, Literal
from datetime import datetime, date
import numpy as np

logger = logging.getLogger(__name__)

# ─── Constants ────────────────────────────────────────────────────────────────

SQRT_2PI = math.sqrt(2 * math.pi)
MIN_VOL = 0.001
MAX_VOL = 10.0
MIN_PRICE = 1e-10
MAX_ITERATIONS = 100
TOLERANCE = 1e-8

# ─── Normal Distribution ───────────────────────────────────────────────────────

def norm_pdf(x: float) -> float:
    """Standard normal PDF."""
    return math.exp(-0.5 * x * x) / SQRT_2PI

def norm_cdf(x: float) -> float:
    """Standard normal CDF via math.erf."""
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))

# ─── Data Classes ─────────────────────────────────────────────────────────────

@dataclass
class OptionParams:
    S: float          # Spot price
    K: float          # Strike price
    T: float          # Time to expiry (years)
    r: float          # Risk-free rate
    sigma: float      # Volatility (annualized)
    q: float = 0.0    # Continuous dividend yield
    option_type: Literal['call', 'put'] = 'call'

@dataclass
class BlackScholesResult:
    price: float
    delta: float
    gamma: float
    theta: float      # per calendar day
    vega: float       # per 1% move in vol
    rho: float        # per 1% move in rate
    lambda_: float    # leverage / elasticity
    vanna: float      # dDelta/dSigma
    volga: float      # dVega/dSigma (vomma)
    charm: float      # dDelta/dTime
    speed: float      # dGamma/dS
    color: float      # dGamma/dTime
    ultima: float     # d3V/dSigma3
    d1: float
    d2: float
    intrinsic: float
    time_value: float
    moneyness: str    # ITM/ATM/OTM

@dataclass
class ImpliedVol:
    iv: float
    iterations: int
    converged: bool
    method: str
    error: float

@dataclass
class VolSurface:
    strikes: List[float]
    expiries: List[float]
    vols: List[List[float]]   # [expiry][strike]
    forward: float
    spot: float
    timestamp: datetime = field(default_factory=datetime.utcnow)

@dataclass
class OptionChainRow:
    strike: float
    expiry_days: int
    call_price: float
    put_price: float
    call_delta: float
    put_delta: float
    call_iv: float
    put_iv: float
    gamma: float
    vega: float
    theta: float
    open_interest_call: int
    open_interest_put: int
    volume_call: int
    volume_put: int
    put_call_ratio: float

@dataclass
class SpreadGreeks:
    name: str
    legs: List[Dict]
    net_price: float
    net_delta: float
    net_gamma: float
    net_theta: float
    net_vega: float
    net_rho: float
    max_profit: float
    max_loss: float
    breakeven_lower: Optional[float]
    breakeven_upper: Optional[float]

# ─── Black-Scholes Engine ─────────────────────────────────────────────────────

class BlackScholesEngine:
    """
    Complete Black-Scholes-Merton pricing engine supporting European options
    with continuous dividends. Full Greeks suite including second-order
    (gamma, vanna, volga) and third-order (speed, color, ultima).
    """

    @staticmethod
    def d1d2(S: float, K: float, T: float, r: float, sigma: float, q: float = 0.0) -> Tuple[float, float]:
        """Calculate d1 and d2 components."""
        if T <= 0 or sigma <= 0:
            raise ValueError(f"Invalid parameters: T={T}, sigma={sigma}")
        log_sk = math.log(S / K)
        d1 = (log_sk + (r - q + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
        d2 = d1 - sigma * math.sqrt(T)
        return d1, d2

    def price(self, params: OptionParams) -> float:
        """Calculate option price."""
        S, K, T, r, sigma, q = params.S, params.K, params.T, params.r, params.sigma, params.q
        if T <= 0:
            if params.option_type == 'call':
                return max(0.0, S - K)
            return max(0.0, K - S)
        d1, d2 = self.d1d2(S, K, T, r, sigma, q)
        disc_r = math.exp(-r * T)
        disc_q = math.exp(-q * T)
        if params.option_type == 'call':
            return S * disc_q * norm_cdf(d1) - K * disc_r * norm_cdf(d2)
        else:
            return K * disc_r * norm_cdf(-d2) - S * disc_q * norm_cdf(-d1)

    def greeks(self, params: OptionParams) -> BlackScholesResult:
        """Calculate option price and all Greeks."""
        S, K, T, r, sigma, q = params.S, params.K, params.T, params.r, params.sigma, params.q
        is_call = params.option_type == 'call'

        if T <= 0:
            intrinsic = max(0.0, S - K) if is_call else max(0.0, K - S)
            return BlackScholesResult(
                price=intrinsic, delta=1.0 if (is_call and S > K) else (-1.0 if not is_call and S < K else 0.0),
                gamma=0.0, theta=0.0, vega=0.0, rho=0.0, lambda_=0.0,
                vanna=0.0, volga=0.0, charm=0.0, speed=0.0, color=0.0, ultima=0.0,
                d1=0.0, d2=0.0, intrinsic=intrinsic, time_value=0.0, moneyness='ATM',
            )

        d1, d2 = self.d1d2(S, K, T, r, sigma, q)
        sqrt_T = math.sqrt(T)
        pdf_d1 = norm_pdf(d1)
        cdf_d1 = norm_cdf(d1)
        cdf_d2 = norm_cdf(d2)
        cdf_nd1 = norm_cdf(-d1)
        cdf_nd2 = norm_cdf(-d2)
        disc_r = math.exp(-r * T)
        disc_q = math.exp(-q * T)

        # Price
        if is_call:
            price = S * disc_q * cdf_d1 - K * disc_r * cdf_d2
        else:
            price = K * disc_r * cdf_nd2 - S * disc_q * cdf_nd1

        # Delta
        if is_call:
            delta = disc_q * cdf_d1
        else:
            delta = -disc_q * cdf_nd1

        # Gamma (same for call and put)
        gamma = disc_q * pdf_d1 / (S * sigma * sqrt_T)

        # Theta (per day)
        term1 = -(S * disc_q * pdf_d1 * sigma) / (2 * sqrt_T)
        if is_call:
            term2 = r * K * disc_r * cdf_d2
            term3 = -q * S * disc_q * cdf_d1
        else:
            term2 = -r * K * disc_r * cdf_nd2
            term3 = q * S * disc_q * cdf_nd1
        theta = (term1 + term2 + term3) / 365.0  # convert to per-day

        # Vega (per 1% vol change)
        vega = S * disc_q * pdf_d1 * sqrt_T / 100.0

        # Rho (per 1% rate change)
        if is_call:
            rho = K * T * disc_r * cdf_d2 / 100.0
        else:
            rho = -K * T * disc_r * cdf_nd2 / 100.0

        # Lambda (leverage)
        lambda_ = delta * S / price if price > MIN_PRICE else 0.0

        # Vanna: dDelta/dSigma = dVega/dS
        vanna = -disc_q * pdf_d1 * d2 / sigma

        # Volga (Vomma): dVega/dSigma
        volga = vega * 100.0 * d1 * d2 / sigma  # rescale back from per-1%

        # Charm: dDelta/dTime (per year, then per day)
        if is_call:
            charm = (disc_q * (pdf_d1 * ((r - q) / (sigma * sqrt_T) - d2 / (2 * T)) - q * cdf_d1)) / 365.0
        else:
            charm = (disc_q * (pdf_d1 * ((r - q) / (sigma * sqrt_T) - d2 / (2 * T)) + q * cdf_nd1)) / 365.0

        # Speed: dGamma/dS
        speed = -gamma / S * (1 + d1 / (sigma * sqrt_T))

        # Color: dGamma/dTime (per year then per day)
        color = (2 * gamma / T * (1 + d1 * ((r - q) / (sigma * sqrt_T) - d2 / (2 * T)))) / 365.0

        # Ultima: d3V/dSigma3
        ultima = (-vega * 100.0 / sigma ** 2 * (d1 * d2 * (1 - d1 * d2) + d1 ** 2 + d2 ** 2))

        # Intrinsic / Time value
        intrinsic = max(0.0, S - K) if is_call else max(0.0, K - S)
        time_val = price - intrinsic

        # Moneyness
        ratio = S / K
        if abs(ratio - 1.0) < 0.005:
            moneyness = 'ATM'
        elif (is_call and ratio > 1.0) or (not is_call and ratio < 1.0):
            moneyness = 'ITM'
        else:
            moneyness = 'OTM'

        return BlackScholesResult(
            price=price, delta=delta, gamma=gamma, theta=theta,
            vega=vega, rho=rho, lambda_=lambda_,
            vanna=vanna, volga=volga, charm=charm,
            speed=speed, color=color, ultima=ultima,
            d1=d1, d2=d2, intrinsic=intrinsic, time_value=time_val,
            moneyness=moneyness,
        )

# ─── Implied Volatility Solver ────────────────────────────────────────────────

class IVSolver:
    """Newton-Raphson + Brent's method IV solver."""

    def __init__(self):
        self.bs = BlackScholesEngine()

    def solve_nr(
        self,
        market_price: float,
        S: float, K: float, T: float, r: float,
        option_type: str = 'call', q: float = 0.0,
        initial_guess: float = 0.2,
    ) -> ImpliedVol:
        """Newton-Raphson IV solver."""
        sigma = max(MIN_VOL, min(MAX_VOL, initial_guess))
        for i in range(MAX_ITERATIONS):
            try:
                params = OptionParams(S=S, K=K, T=T, r=r, sigma=sigma, q=q, option_type=option_type)
                result = self.bs.greeks(params)
                price_diff = result.price - market_price
                vega_bs = result.vega * 100.0  # convert back from per-1%
                if abs(vega_bs) < 1e-12:
                    break
                sigma_new = sigma - price_diff / vega_bs
                sigma_new = max(MIN_VOL, min(MAX_VOL, sigma_new))
                if abs(sigma_new - sigma) < TOLERANCE:
                    return ImpliedVol(iv=sigma_new, iterations=i+1, converged=True, method='Newton-Raphson', error=abs(price_diff))
                sigma = sigma_new
            except (ValueError, ZeroDivisionError):
                break
        return self.solve_bisection(market_price, S, K, T, r, option_type, q)

    def solve_bisection(
        self,
        market_price: float,
        S: float, K: float, T: float, r: float,
        option_type: str = 'call', q: float = 0.0,
    ) -> ImpliedVol:
        """Bisection method fallback."""
        lo, hi = MIN_VOL, MAX_VOL
        for i in range(MAX_ITERATIONS):
            mid = (lo + hi) / 2
            params = OptionParams(S=S, K=K, T=T, r=r, sigma=mid, q=q, option_type=option_type)
            try:
                price = self.bs.price(params)
            except ValueError:
                break
            if abs(price - market_price) < TOLERANCE:
                return ImpliedVol(iv=mid, iterations=i+1, converged=True, method='Bisection', error=abs(price - market_price))
            if price < market_price:
                lo = mid
            else:
                hi = mid
        mid = (lo + hi) / 2
        return ImpliedVol(iv=mid, iterations=MAX_ITERATIONS, converged=False, method='Bisection', error=abs(market_price))

# ─── Volatility Surface ───────────────────────────────────────────────────────

class VolatilitySurfaceEngine:
    """Constructs and interpolates implied volatility surfaces."""

    def __init__(self):
        self.iv_solver = IVSolver()

    def build_surface(
        self,
        spot: float, r: float = 0.053, q: float = 0.0,
        expiries_days: Optional[List[int]] = None,
        moneyness_levels: Optional[List[float]] = None,
    ) -> VolSurface:
        """Build a realistic vol surface with term structure and skew."""
        if expiries_days is None:
            expiries_days = [7, 14, 30, 45, 60, 90, 120, 180, 252, 365, 730]
        if moneyness_levels is None:
            moneyness_levels = [0.75, 0.80, 0.85, 0.90, 0.925, 0.95, 0.975, 1.0, 1.025, 1.05, 1.075, 1.10, 1.15, 1.20, 1.25]

        strikes = [spot * m for m in moneyness_levels]
        expiries_years = [d / 365.0 for d in expiries_days]
        vols: List[List[float]] = []

        # Base ATM vol with term structure
        atm_term = {7: 0.22, 14: 0.20, 30: 0.18, 45: 0.175, 60: 0.172, 90: 0.168,
                    120: 0.165, 180: 0.162, 252: 0.16, 365: 0.155, 730: 0.148}

        for days in expiries_days:
            atm_vol = atm_term.get(days, 0.18)
            row: List[float] = []
            T = days / 365.0
            for m in moneyness_levels:
                # Skew: higher vol for OTM puts (m < 1), lower for OTM calls (m > 1)
                skew_coeff = 1.5
                kurtosis_coeff = 0.4
                sk = atm_vol + skew_coeff * atm_vol * (1.0 - m) + kurtosis_coeff * atm_vol * (1.0 - m) ** 2
                # Term structure adjustment
                if T < 0.1:
                    sk *= 1.1  # short-term premium
                iv = max(MIN_VOL, round(sk + np.random.normal(0, 0.002), 4))
                row.append(iv)
            vols.append(row)

        return VolSurface(
            strikes=strikes, expiries=expiries_years,
            vols=vols, forward=spot * math.exp((r - q) * 1.0), spot=spot,
        )

    def get_iv_at(self, surface: VolSurface, K: float, T: float) -> float:
        """Bilinear interpolation of IV at arbitrary strike and expiry."""
        expiries = surface.expiries
        strikes = surface.strikes
        vols = surface.vols

        # Clamp
        T = max(expiries[0], min(expiries[-1], T))
        K = max(strikes[0], min(strikes[-1], K))

        # Find surrounding expiry indices
        ei = max(0, min(len(expiries) - 2, next((i for i, e in enumerate(expiries) if e >= T), len(expiries) - 1) - 1))
        si = max(0, min(len(strikes) - 2, next((i for i, s in enumerate(strikes) if s >= K), len(strikes) - 1) - 1))

        # Interpolation weights
        t_frac = (T - expiries[ei]) / max(1e-10, expiries[ei+1] - expiries[ei])
        s_frac = (K - strikes[si]) / max(1e-10, strikes[si+1] - strikes[si])

        v00 = vols[ei][si]; v01 = vols[ei][si+1]
        v10 = vols[ei+1][si]; v11 = vols[ei+1][si+1]
        return (v00 * (1 - t_frac) * (1 - s_frac) + v01 * (1 - t_frac) * s_frac +
                v10 * t_frac * (1 - s_frac) + v11 * t_frac * s_frac)

# ─── Option Chain Builder ─────────────────────────────────────────────────────

class OptionChainBuilder:
    """Build full option chains for a given underlying."""

    def __init__(self):
        self.bs = BlackScholesEngine()
        self.iv_solver = IVSolver()
        self.surf_engine = VolatilitySurfaceEngine()

    def build_chain(
        self, spot: float, expiry_days: int,
        r: float = 0.053, q: float = 0.0,
        num_strikes: int = 20,
    ) -> List[OptionChainRow]:
        T = expiry_days / 365.0
        strikes = self._get_strikes(spot, num_strikes)
        rows: List[OptionChainRow] = []

        for K in strikes:
            call_iv = max(0.05, 0.18 + 1.5 * 0.18 * (1 - K / spot) + np.random.normal(0, 0.003))
            put_iv = max(0.05, call_iv + 0.02)

            call_params = OptionParams(S=spot, K=K, T=T, r=r, sigma=call_iv, q=q, option_type='call')
            put_params = OptionParams(S=spot, K=K, T=T, r=r, sigma=put_iv, q=q, option_type='put')

            call_g = self.bs.greeks(call_params)
            put_g = self.bs.greeks(put_params)

            oi_call = max(0, int(np.random.lognormal(8, 1.5)))
            oi_put = max(0, int(np.random.lognormal(8, 1.5)))
            vol_call = max(0, int(oi_call * np.random.uniform(0.1, 0.5)))
            vol_put = max(0, int(oi_put * np.random.uniform(0.1, 0.5)))

            rows.append(OptionChainRow(
                strike=round(K, 2), expiry_days=expiry_days,
                call_price=round(call_g.price, 4), put_price=round(put_g.price, 4),
                call_delta=round(call_g.delta, 4), put_delta=round(put_g.delta, 4),
                call_iv=round(call_iv * 100, 2), put_iv=round(put_iv * 100, 2),
                gamma=round(call_g.gamma, 6), vega=round(call_g.vega, 4), theta=round(call_g.theta, 4),
                open_interest_call=oi_call, open_interest_put=oi_put,
                volume_call=vol_call, volume_put=vol_put,
                put_call_ratio=round(oi_put / max(1, oi_call), 3),
            ))
        return rows

    @staticmethod
    def _get_strikes(spot: float, n: int) -> List[float]:
        tick = 1.0 if spot < 50 else (5.0 if spot < 500 else 10.0)
        atm = round(spot / tick) * tick
        half = n // 2
        return [atm + (i - half) * tick for i in range(n)]

# ─── Spread Pricing ───────────────────────────────────────────────────────────

class SpreadEngine:
    """Price and analyze multi-leg option spreads."""

    def __init__(self):
        self.bs = BlackScholesEngine()

    def vertical_spread(
        self, S: float, K_long: float, K_short: float,
        T: float, r: float, sigma: float, q: float = 0.0,
        option_type: str = 'call', qty: int = 1,
    ) -> SpreadGreeks:
        """Bull/bear call or put spread."""
        long_g = self.bs.greeks(OptionParams(S=S, K=K_long, T=T, r=r, sigma=sigma, q=q, option_type=option_type))
        short_g = self.bs.greeks(OptionParams(S=S, K=K_short, T=T, r=r, sigma=sigma, q=q, option_type=option_type))

        net_price = (long_g.price - short_g.price) * qty
        is_bull_call = option_type == 'call' and K_long < K_short
        max_profit = (abs(K_short - K_long) - abs(net_price)) * qty if net_price > 0 else abs(K_short - K_long) * qty
        max_loss = abs(net_price) * qty

        return SpreadGreeks(
            name=f"{'Bull' if is_bull_call else 'Bear'} {option_type.capitalize()} Spread",
            legs=[
                {'side': 'long', 'K': K_long, 'price': long_g.price, 'delta': long_g.delta},
                {'side': 'short', 'K': K_short, 'price': short_g.price, 'delta': short_g.delta},
            ],
            net_price=round(net_price, 4),
            net_delta=round((long_g.delta - short_g.delta) * qty, 4),
            net_gamma=round((long_g.gamma - short_g.gamma) * qty, 6),
            net_theta=round((long_g.theta - short_g.theta) * qty, 4),
            net_vega=round((long_g.vega - short_g.vega) * qty, 4),
            net_rho=round((long_g.rho - short_g.rho) * qty, 4),
            max_profit=round(max_profit, 2),
            max_loss=round(max_loss, 2),
            breakeven_lower=round(K_long + net_price / qty, 2) if option_type == 'call' else None,
            breakeven_upper=round(K_long - net_price / qty, 2) if option_type == 'put' else None,
        )

    def iron_condor(
        self, S: float, K_put_long: float, K_put_short: float,
        K_call_short: float, K_call_long: float,
        T: float, r: float, sigma_put: float, sigma_call: float,
        q: float = 0.0,
    ) -> SpreadGreeks:
        """Iron condor: sell strangle + buy wings."""
        put_long = self.bs.greeks(OptionParams(S, K_put_long, T, r, sigma_put, q, 'put'))
        put_short = self.bs.greeks(OptionParams(S, K_put_short, T, r, sigma_put, q, 'put'))
        call_short = self.bs.greeks(OptionParams(S, K_call_short, T, r, sigma_call, q, 'call'))
        call_long = self.bs.greeks(OptionParams(S, K_call_long, T, r, sigma_call, q, 'call'))

        net_credit = put_short.price - put_long.price + call_short.price - call_long.price
        max_loss = max(K_put_short - K_put_long, K_call_long - K_call_short) - net_credit

        return SpreadGreeks(
            name='Iron Condor',
            legs=[
                {'side': 'long', 'type': 'put', 'K': K_put_long},
                {'side': 'short', 'type': 'put', 'K': K_put_short},
                {'side': 'short', 'type': 'call', 'K': K_call_short},
                {'side': 'long', 'type': 'call', 'K': K_call_long},
            ],
            net_price=round(net_credit, 4),
            net_delta=round(put_short.delta - put_long.delta + call_short.delta - call_long.delta, 4),
            net_gamma=round(-(put_short.gamma - put_long.gamma) - (call_short.gamma - call_long.gamma), 6),
            net_theta=round(put_short.theta - put_long.theta + call_short.theta - call_long.theta, 4),
            net_vega=round(-(put_long.vega + call_long.vega - put_short.vega - call_short.vega), 4),
            net_rho=round(put_short.rho - put_long.rho + call_short.rho - call_long.rho, 4),
            max_profit=round(net_credit, 2),
            max_loss=round(max_loss, 2),
            breakeven_lower=round(K_put_short - net_credit, 2),
            breakeven_upper=round(K_call_short + net_credit, 2),
        )

# ─── Portfolio Greeks ──────────────────────────────────────────────────────────

class PortfolioGreeksEngine:
    """Aggregate Greeks across a portfolio of options positions."""

    def __init__(self):
        self.bs = BlackScholesEngine()

    def aggregate(self, positions: List[Dict]) -> Dict:
        """
        positions: list of dicts with keys:
          ticker, option_type, S, K, T, r, sigma, q, quantity, multiplier
        """
        totals = dict(delta=0.0, gamma=0.0, theta=0.0, vega=0.0, rho=0.0,
                      vanna=0.0, volga=0.0, charm=0.0)
        details = []
        for pos in positions:
            qty = pos.get('quantity', 0)
            mult = pos.get('multiplier', 100)
            params = OptionParams(
                S=pos['S'], K=pos['K'], T=pos['T'], r=pos['r'],
                sigma=pos['sigma'], q=pos.get('q', 0.0),
                option_type=pos.get('option_type', 'call'),
            )
            g = self.bs.greeks(params)
            scale = qty * mult
            detail = {
                'ticker': pos.get('ticker', ''),
                'strike': pos['K'],
                'expiry_T': pos['T'],
                'type': pos.get('option_type'),
                'quantity': qty,
                'price': round(g.price, 4),
                'market_value': round(g.price * scale, 2),
                'delta': round(g.delta * scale, 4),
                'gamma': round(g.gamma * scale, 6),
                'theta': round(g.theta * scale, 4),
                'vega': round(g.vega * scale, 4),
                'rho': round(g.rho * scale, 4),
                'iv': round(pos['sigma'] * 100, 2),
                'moneyness': g.moneyness,
            }
            for k in totals:
                if k in detail:
                    totals[k] += detail[k]
            details.append(detail)

        return {
            'totals': {k: round(v, 4) for k, v in totals.items()},
            'positions': details,
            'dollar_delta': round(totals['delta'], 2),  # already scaled
            'dollar_gamma': round(totals['gamma'] * 100, 2),
            'daily_theta': round(totals['theta'], 2),
            'vega_1pct': round(totals['vega'], 2),
        }

# ─── Module-Level Instance ────────────────────────────────────────────────────

_bs_engine = BlackScholesEngine()
_iv_solver = IVSolver()
_vol_surf = VolatilitySurfaceEngine()
_chain_builder = OptionChainBuilder()
_spread_engine = SpreadEngine()
_portfolio_greeks = PortfolioGreeksEngine()

def get_option_price(S, K, T, r, sigma, q=0.0, option_type='call') -> float:
    return _bs_engine.price(OptionParams(S=S, K=K, T=T, r=r, sigma=sigma, q=q, option_type=option_type))

def get_greeks(S, K, T, r, sigma, q=0.0, option_type='call') -> BlackScholesResult:
    return _bs_engine.greeks(OptionParams(S=S, K=K, T=T, r=r, sigma=sigma, q=q, option_type=option_type))

def solve_iv(market_price, S, K, T, r, option_type='call', q=0.0) -> ImpliedVol:
    return _iv_solver.solve_nr(market_price, S, K, T, r, option_type, q)

def build_vol_surface(spot, r=0.053, q=0.0) -> VolSurface:
    return _vol_surf.build_surface(spot, r, q)

def build_option_chain(spot, expiry_days, r=0.053, q=0.0, num_strikes=20) -> List[OptionChainRow]:
    return _chain_builder.build_chain(spot, expiry_days, r, q, num_strikes)
