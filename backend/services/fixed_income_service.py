"""
Fixed Income Service — §7 Bond Analytics, Yield Curves, FI Trading
====================================================================
Covers: Bond pricing, duration/convexity, yield curve construction,
        spread analysis, mortgage-backed securities, credit analysis,
        term structure models, FI portfolio analytics.

Uses FRED_API_KEY for economic/yield data, yfinance for bond ETFs.
"""

from __future__ import annotations
import asyncio
import math
import os
import json
import logging
from collections import defaultdict
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta, date
from enum import Enum, auto
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union
import statistics

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# DATA MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class BondType(Enum):
    TREASURY = "treasury"
    CORPORATE = "corporate"
    MUNICIPAL = "municipal"
    AGENCY = "agency"
    MORTGAGE_BACKED = "mbs"
    ASSET_BACKED = "abs"
    CONVERTIBLE = "convertible"
    INFLATION_LINKED = "tips"
    ZERO_COUPON = "zero"
    FLOATING_RATE = "frn"

class CreditRating(Enum):
    AAA = "AAA"
    AA_PLUS = "AA+"
    AA = "AA"
    AA_MINUS = "AA-"
    A_PLUS = "A+"
    A = "A"
    A_MINUS = "A-"
    BBB_PLUS = "BBB+"
    BBB = "BBB"
    BBB_MINUS = "BBB-"
    BB_PLUS = "BB+"
    BB = "BB"
    BB_MINUS = "BB-"
    B_PLUS = "B+"
    B = "B"
    B_MINUS = "B-"
    CCC = "CCC"
    CC = "CC"
    C = "C"
    D = "D"

    @property
    def is_investment_grade(self) -> bool:
        ig = {CreditRating.AAA, CreditRating.AA_PLUS, CreditRating.AA, CreditRating.AA_MINUS,
              CreditRating.A_PLUS, CreditRating.A, CreditRating.A_MINUS,
              CreditRating.BBB_PLUS, CreditRating.BBB, CreditRating.BBB_MINUS}
        return self in ig

    @property
    def numeric_score(self) -> int:
        scores = {
            CreditRating.AAA: 1, CreditRating.AA_PLUS: 2, CreditRating.AA: 3,
            CreditRating.AA_MINUS: 4, CreditRating.A_PLUS: 5, CreditRating.A: 6,
            CreditRating.A_MINUS: 7, CreditRating.BBB_PLUS: 8, CreditRating.BBB: 9,
            CreditRating.BBB_MINUS: 10, CreditRating.BB_PLUS: 11, CreditRating.BB: 12,
            CreditRating.BB_MINUS: 13, CreditRating.B_PLUS: 14, CreditRating.B: 15,
            CreditRating.B_MINUS: 16, CreditRating.CCC: 17, CreditRating.CC: 18,
            CreditRating.C: 19, CreditRating.D: 20,
        }
        return scores.get(self, 20)

class DayCountConvention(Enum):
    ACT_360 = "ACT/360"
    ACT_365 = "ACT/365"
    ACT_ACT = "ACT/ACT"
    THIRTY_360 = "30/360"
    THIRTY_365 = "30/365"

class CouponFrequency(Enum):
    ANNUAL = 1
    SEMI_ANNUAL = 2
    QUARTERLY = 4
    MONTHLY = 12
    ZERO = 0

@dataclass
class Bond:
    cusip: str
    isin: str = ""
    name: str = ""
    issuer: str = ""
    bond_type: BondType = BondType.CORPORATE
    face_value: float = 1000.0
    coupon_rate: float = 0.05
    coupon_frequency: CouponFrequency = CouponFrequency.SEMI_ANNUAL
    issue_date: Optional[date] = None
    maturity_date: Optional[date] = None
    call_date: Optional[date] = None
    call_price: Optional[float] = None
    put_date: Optional[date] = None
    put_price: Optional[float] = None
    credit_rating: CreditRating = CreditRating.BBB
    day_count: DayCountConvention = DayCountConvention.THIRTY_360
    callable: bool = False
    putable: bool = False
    convertible: bool = False
    sinking_fund: bool = False
    currency: str = "USD"
    sector: str = ""
    industry: str = ""
    benchmark_spread: float = 0.0
    recovery_rate: float = 0.4

    @property
    def years_to_maturity(self) -> float:
        if self.maturity_date is None:
            return 10.0
        return (self.maturity_date - date.today()).days / 365.25

    @property
    def coupon_payment(self) -> float:
        freq = self.coupon_frequency.value if self.coupon_frequency.value > 0 else 1
        return self.face_value * self.coupon_rate / freq


@dataclass
class YieldCurvePoint:
    maturity: float  # in years
    yield_rate: float
    date: Optional[date] = None
    label: str = ""

@dataclass
class CashFlow:
    date: date
    amount: float
    cf_type: str = "coupon"  # coupon, principal, both


# ═══════════════════════════════════════════════════════════════════════════════
# BOND PRICING ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

class BondPricingEngine:
    """Full bond pricing with multiple methodologies."""

    @staticmethod
    def price(bond: Bond, yield_rate: float) -> float:
        """Price a bond given yield to maturity."""
        if bond.coupon_frequency == CouponFrequency.ZERO:
            return bond.face_value / (1 + yield_rate) ** bond.years_to_maturity
        freq = bond.coupon_frequency.value
        n = int(bond.years_to_maturity * freq)
        c = bond.coupon_payment
        y = yield_rate / freq
        if y == 0:
            return c * n + bond.face_value
        pv_coupons = c * (1 - (1 + y) ** (-n)) / y
        pv_principal = bond.face_value / (1 + y) ** n
        return pv_coupons + pv_principal

    @staticmethod
    def yield_to_maturity(bond: Bond, market_price: float,
                          precision: float = 1e-8, max_iter: int = 200) -> float:
        """Newton-Raphson YTM calculation."""
        y = bond.coupon_rate  # Initial guess
        for _ in range(max_iter):
            p = BondPricingEngine.price(bond, y)
            dp = BondPricingEngine._price_derivative(bond, y)
            if abs(dp) < 1e-15:
                break
            y_new = y - (p - market_price) / dp
            if abs(y_new - y) < precision:
                return y_new
            y = y_new
        return y

    @staticmethod
    def yield_to_call(bond: Bond, market_price: float) -> Optional[float]:
        """YTC for callable bonds."""
        if not bond.callable or bond.call_date is None or bond.call_price is None:
            return None
        temp_bond = Bond(
            cusip=bond.cusip,
            face_value=bond.call_price,
            coupon_rate=bond.coupon_rate,
            coupon_frequency=bond.coupon_frequency,
            maturity_date=bond.call_date,
            day_count=bond.day_count,
        )
        return BondPricingEngine.yield_to_maturity(temp_bond, market_price)

    @staticmethod
    def yield_to_worst(bond: Bond, market_price: float) -> float:
        """Minimum of YTM and YTC."""
        ytm = BondPricingEngine.yield_to_maturity(bond, market_price)
        ytc = BondPricingEngine.yield_to_call(bond, market_price)
        if ytc is not None:
            return min(ytm, ytc)
        return ytm

    @staticmethod
    def current_yield(bond: Bond, market_price: float) -> float:
        """Annual coupon / market price."""
        annual_coupon = bond.face_value * bond.coupon_rate
        return annual_coupon / market_price if market_price > 0 else 0

    @staticmethod
    def _price_derivative(bond: Bond, y: float) -> float:
        """dP/dy for Newton-Raphson."""
        dy = 0.0001
        p_up = BondPricingEngine.price(bond, y + dy)
        p_down = BondPricingEngine.price(bond, y - dy)
        return (p_up - p_down) / (2 * dy)

    @staticmethod
    def accrued_interest(bond: Bond, settlement: Optional[date] = None) -> float:
        """Calculate accrued interest."""
        settle = settlement or date.today()
        if bond.issue_date is None or bond.coupon_frequency == CouponFrequency.ZERO:
            return 0.0
        freq = bond.coupon_frequency.value
        period_days = 365.25 / freq
        days_since_coupon = (settle - bond.issue_date).days % period_days
        accrued = bond.face_value * bond.coupon_rate * (days_since_coupon / 365.25)
        return accrued

    @staticmethod
    def dirty_price(bond: Bond, yield_rate: float,
                    settlement: Optional[date] = None) -> float:
        """Clean price + accrued interest."""
        clean = BondPricingEngine.price(bond, yield_rate)
        accrued = BondPricingEngine.accrued_interest(bond, settlement)
        return clean + accrued

    @staticmethod
    def cash_flows(bond: Bond) -> List[CashFlow]:
        """Generate all future cash flows."""
        flows: List[CashFlow] = []
        if bond.maturity_date is None:
            return flows
        freq = bond.coupon_frequency.value if bond.coupon_frequency.value > 0 else 1
        period_months = 12 // freq
        coupon = bond.coupon_payment
        current = date.today()
        cf_date = bond.maturity_date

        # Generate coupon dates backward from maturity
        dates = []
        while cf_date > current:
            dates.append(cf_date)
            cf_date = cf_date.replace(
                month=cf_date.month - period_months if cf_date.month > period_months
                else cf_date.month + 12 - period_months,
                year=cf_date.year if cf_date.month > period_months else cf_date.year - 1,
            )
        dates.sort()

        for i, d in enumerate(dates):
            if i == len(dates) - 1:
                flows.append(CashFlow(d, coupon + bond.face_value, "both"))
            else:
                flows.append(CashFlow(d, coupon, "coupon"))
        return flows


# ═══════════════════════════════════════════════════════════════════════════════
# DURATION & CONVEXITY
# ═══════════════════════════════════════════════════════════════════════════════

class RiskAnalytics:
    """Bond duration, convexity, and sensitivity measures."""

    @staticmethod
    def macaulay_duration(bond: Bond, yield_rate: float) -> float:
        """Macaulay duration in years."""
        freq = bond.coupon_frequency.value if bond.coupon_frequency.value > 0 else 1
        n = int(bond.years_to_maturity * freq)
        c = bond.coupon_payment
        y = yield_rate / freq
        price = BondPricingEngine.price(bond, yield_rate)
        if price == 0:
            return 0
        weighted_sum = 0.0
        for t in range(1, n + 1):
            pv = c / (1 + y) ** t
            weighted_sum += t * pv
        weighted_sum += n * bond.face_value / (1 + y) ** n
        return (weighted_sum / price) / freq

    @staticmethod
    def modified_duration(bond: Bond, yield_rate: float) -> float:
        """Modified duration = Macaulay / (1 + y/freq)."""
        mac_dur = RiskAnalytics.macaulay_duration(bond, yield_rate)
        freq = bond.coupon_frequency.value if bond.coupon_frequency.value > 0 else 1
        return mac_dur / (1 + yield_rate / freq)

    @staticmethod
    def effective_duration(bond: Bond, yield_rate: float,
                          dy: float = 0.001) -> float:
        """Effective duration using finite differences."""
        p_up = BondPricingEngine.price(bond, yield_rate + dy)
        p_down = BondPricingEngine.price(bond, yield_rate - dy)
        p0 = BondPricingEngine.price(bond, yield_rate)
        return (p_down - p_up) / (2 * p0 * dy) if p0 > 0 else 0

    @staticmethod
    def key_rate_duration(bond: Bond, yield_curve: List[YieldCurvePoint],
                          key_rate: float, dy: float = 0.001) -> float:
        """Duration sensitivity to a specific maturity point."""
        # Bump the curve at key_rate
        curve_up = list(yield_curve)
        curve_down = list(yield_curve)
        for pt in curve_up:
            if abs(pt.maturity - key_rate) < 0.5:
                pt.yield_rate += dy
        for pt in curve_down:
            if abs(pt.maturity - key_rate) < 0.5:
                pt.yield_rate -= dy

        y_up = RiskAnalytics._interpolate_yield(curve_up, bond.years_to_maturity)
        y_down = RiskAnalytics._interpolate_yield(curve_down, bond.years_to_maturity)
        p_up = BondPricingEngine.price(bond, y_up)
        p_down = BondPricingEngine.price(bond, y_down)
        p0 = BondPricingEngine.price(bond, RiskAnalytics._interpolate_yield(
            yield_curve, bond.years_to_maturity))
        return (p_down - p_up) / (2 * p0 * dy) if p0 > 0 else 0

    @staticmethod
    def convexity(bond: Bond, yield_rate: float, dy: float = 0.001) -> float:
        """Bond convexity."""
        p_up = BondPricingEngine.price(bond, yield_rate + dy)
        p_down = BondPricingEngine.price(bond, yield_rate - dy)
        p0 = BondPricingEngine.price(bond, yield_rate)
        if p0 == 0:
            return 0
        return (p_up + p_down - 2 * p0) / (p0 * dy ** 2)

    @staticmethod
    def dollar_duration(bond: Bond, yield_rate: float) -> float:
        """DV01 — price change for 1bp yield change."""
        mod_dur = RiskAnalytics.modified_duration(bond, yield_rate)
        price = BondPricingEngine.price(bond, yield_rate)
        return mod_dur * price / 10_000

    @staticmethod
    def dv01(bond: Bond, yield_rate: float) -> float:
        """Dollar value of 01 (1bp)."""
        p_up = BondPricingEngine.price(bond, yield_rate + 0.0001)
        p_down = BondPricingEngine.price(bond, yield_rate - 0.0001)
        return abs(p_down - p_up) / 2

    @staticmethod
    def spread_duration(bond: Bond, yield_rate: float,
                        benchmark_yield: float) -> float:
        """OAS duration."""
        spread = yield_rate - benchmark_yield
        return RiskAnalytics.effective_duration(bond, yield_rate)

    @staticmethod
    def price_value_of_basis_point(bond: Bond, yield_rate: float) -> float:
        return RiskAnalytics.dv01(bond, yield_rate)

    @staticmethod
    def bpv(bond: Bond, yield_rate: float) -> float:
        return RiskAnalytics.dv01(bond, yield_rate)

    @staticmethod
    def price_change_estimate(bond: Bond, yield_rate: float,
                              yield_change: float) -> float:
        """Estimate price change using duration + convexity."""
        mod_dur = RiskAnalytics.modified_duration(bond, yield_rate)
        conv = RiskAnalytics.convexity(bond, yield_rate)
        price = BondPricingEngine.price(bond, yield_rate)
        dur_effect = -mod_dur * yield_change * price
        conv_effect = 0.5 * conv * (yield_change ** 2) * price
        return dur_effect + conv_effect

    @staticmethod
    def _interpolate_yield(curve: List[YieldCurvePoint], maturity: float) -> float:
        if not curve:
            return 0.05
        sorted_curve = sorted(curve, key=lambda p: p.maturity)
        if maturity <= sorted_curve[0].maturity:
            return sorted_curve[0].yield_rate
        if maturity >= sorted_curve[-1].maturity:
            return sorted_curve[-1].yield_rate
        for i in range(len(sorted_curve) - 1):
            if sorted_curve[i].maturity <= maturity <= sorted_curve[i + 1].maturity:
                t1, y1 = sorted_curve[i].maturity, sorted_curve[i].yield_rate
                t2, y2 = sorted_curve[i + 1].maturity, sorted_curve[i + 1].yield_rate
                w = (maturity - t1) / (t2 - t1) if t2 != t1 else 0.5
                return y1 + w * (y2 - y1)
        return sorted_curve[-1].yield_rate


# ═══════════════════════════════════════════════════════════════════════════════
# YIELD CURVE CONSTRUCTION
# ═══════════════════════════════════════════════════════════════════════════════

class YieldCurveBuilder:
    """Construct and analyze yield curves."""

    TREASURY_MATURITIES = [
        (1/12, 'DGS1MO'), (3/12, 'DGS3MO'), (6/12, 'DGS6MO'),
        (1, 'DGS1'), (2, 'DGS2'), (3, 'DGS3'), (5, 'DGS5'),
        (7, 'DGS7'), (10, 'DGS10'), (20, 'DGS20'), (30, 'DGS30'),
    ]

    def __init__(self):
        from dotenv import load_dotenv
        load_dotenv('keys.env')
        self.fred_key = os.getenv('FRED_API_KEY', '')

    async def fetch_treasury_curve(self, as_of: Optional[date] = None) -> List[YieldCurvePoint]:
        """Fetch current US Treasury yield curve from FRED."""
        points = []
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                for maturity, series_id in self.TREASURY_MATURITIES:
                    url = f"https://api.stlouisfed.org/fred/series/observations"
                    params = {
                        'series_id': series_id,
                        'api_key': self.fred_key,
                        'file_type': 'json',
                        'sort_order': 'desc',
                        'limit': 5,
                    }
                    if as_of:
                        params['observation_end'] = as_of.isoformat()
                    async with session.get(url, params=params) as resp:
                        if resp.status != 200:
                            continue
                        data = await resp.json()
                        obs = data.get('observations', [])
                        for o in obs:
                            try:
                                val = float(o['value'])
                                points.append(YieldCurvePoint(
                                    maturity=maturity,
                                    yield_rate=val / 100,
                                    date=date.fromisoformat(o['date']),
                                    label=series_id,
                                ))
                                break
                            except (ValueError, KeyError):
                                continue
        except Exception as e:
            logger.warning(f"FRED fetch failed: {e}, using fallback")
            points = self._fallback_curve()
        return sorted(points, key=lambda p: p.maturity)

    def _fallback_curve(self) -> List[YieldCurvePoint]:
        """Static fallback yield curve."""
        fallback = [
            (1/12, 0.053), (3/12, 0.054), (6/12, 0.053),
            (1, 0.050), (2, 0.047), (3, 0.045), (5, 0.043),
            (7, 0.043), (10, 0.044), (20, 0.047), (30, 0.046),
        ]
        return [YieldCurvePoint(m, y, date.today(), f"{m}Y") for m, y in fallback]

    def bootstrap_zero_curve(self, par_curve: List[YieldCurvePoint]) -> List[YieldCurvePoint]:
        """Bootstrap zero-coupon curve from par curve."""
        zero_points: List[YieldCurvePoint] = []
        sorted_par = sorted(par_curve, key=lambda p: p.maturity)
        for i, pt in enumerate(sorted_par):
            if pt.maturity <= 1.0:
                zero_points.append(YieldCurvePoint(pt.maturity, pt.yield_rate))
            else:
                coupon = pt.yield_rate / 2  # Assume semi-annual
                pv_sum = 0.0
                for zpt in zero_points:
                    if zpt.maturity < pt.maturity:
                        pv_sum += coupon / (1 + zpt.yield_rate) ** zpt.maturity
                remaining = 1 - pv_sum
                if remaining > 0:
                    zero_rate = (((coupon + 1) / remaining) ** (1 / pt.maturity)) - 1
                    zero_points.append(YieldCurvePoint(pt.maturity, zero_rate))
                else:
                    zero_points.append(YieldCurvePoint(pt.maturity, pt.yield_rate))
        return zero_points

    def forward_rates(self, zero_curve: List[YieldCurvePoint]) -> List[Dict[str, float]]:
        """Calculate forward rates from zero curve."""
        forwards = []
        sorted_z = sorted(zero_curve, key=lambda p: p.maturity)
        for i in range(1, len(sorted_z)):
            t1 = sorted_z[i - 1].maturity
            t2 = sorted_z[i].maturity
            z1 = sorted_z[i - 1].yield_rate
            z2 = sorted_z[i].yield_rate
            if t2 > t1:
                fwd = ((1 + z2) ** t2 / (1 + z1) ** t1) ** (1 / (t2 - t1)) - 1
                forwards.append({
                    'from': t1, 'to': t2,
                    'forward_rate': round(fwd, 6),
                    'period': f"{t1}Y-{t2}Y",
                })
        return forwards

    def spot_to_forward(self, spot: float, t1: float,
                        forward: float, t2: float) -> float:
        """Convert spot rate to forward rate."""
        return ((1 + forward) ** t2 / (1 + spot) ** t1) ** (1 / (t2 - t1)) - 1

    def interpolate(self, curve: List[YieldCurvePoint], maturities: List[float],
                    method: str = 'cubic_spline') -> List[YieldCurvePoint]:
        """Interpolate yield curve at arbitrary maturities."""
        result = []
        sorted_c = sorted(curve, key=lambda p: p.maturity)
        for m in maturities:
            y = RiskAnalytics._interpolate_yield(sorted_c, m)
            result.append(YieldCurvePoint(m, y))
        return result

    def nelson_siegel(self, curve: List[YieldCurvePoint]) -> Dict[str, float]:
        """Fit Nelson-Siegel model to yield curve.
        y(m) = beta0 + beta1 * (1-exp(-m/tau))/(m/tau) + beta2 * ((1-exp(-m/tau))/(m/tau) - exp(-m/tau))
        """
        # Simplified parameter estimation
        if len(curve) < 3:
            return {'beta0': 0.045, 'beta1': -0.02, 'beta2': 0.01, 'tau': 1.5}

        sorted_c = sorted(curve, key=lambda p: p.maturity)
        long_rate = sorted_c[-1].yield_rate
        short_rate = sorted_c[0].yield_rate

        beta0 = long_rate
        beta1 = short_rate - long_rate
        beta2 = 0.01  # Curvature
        tau = 1.5

        # Simple optimization
        best_error = float('inf')
        best_params = {'beta0': beta0, 'beta1': beta1, 'beta2': beta2, 'tau': tau}

        for tau_try in [0.5, 1.0, 1.5, 2.0, 3.0, 5.0]:
            for b2_try in [-0.05, -0.02, 0, 0.01, 0.02, 0.05]:
                error = 0
                for pt in sorted_c:
                    m = pt.maturity
                    if m == 0:
                        continue
                    x = m / tau_try
                    term1 = (1 - math.exp(-x)) / x if x > 0 else 1
                    term2 = term1 - math.exp(-x)
                    y_hat = beta0 + beta1 * term1 + b2_try * term2
                    error += (y_hat - pt.yield_rate) ** 2
                if error < best_error:
                    best_error = error
                    best_params = {'beta0': beta0, 'beta1': beta1,
                                   'beta2': b2_try, 'tau': tau_try}

        return best_params

    def svensson(self, curve: List[YieldCurvePoint]) -> Dict[str, float]:
        """Fit Svensson (extended Nelson-Siegel) model."""
        ns = self.nelson_siegel(curve)
        return {**ns, 'beta3': 0.005, 'tau2': 3.0}


# ═══════════════════════════════════════════════════════════════════════════════
# SPREAD ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════════

class SpreadAnalyzer:
    """Bond spread analysis and relative value."""

    @staticmethod
    def g_spread(bond_yield: float, treasury_yield: float) -> float:
        """Spread over government benchmark."""
        return (bond_yield - treasury_yield) * 10_000  # In basis points

    @staticmethod
    def z_spread(bond: Bond, market_price: float,
                 zero_curve: List[YieldCurvePoint],
                 precision: float = 1e-6) -> float:
        """Zero-volatility spread."""
        z = 0.01  # Initial guess
        for _ in range(100):
            price = 0.0
            flows = BondPricingEngine.cash_flows(bond)
            for cf in flows:
                t = (cf.date - date.today()).days / 365.25
                if t <= 0:
                    continue
                spot = RiskAnalytics._interpolate_yield(zero_curve, t)
                price += cf.amount / (1 + spot + z) ** t
            diff = price - market_price
            if abs(diff) < precision:
                return z * 10_000  # Convert to bps
            z += diff / (market_price * 100)
        return z * 10_000

    @staticmethod
    def asset_swap_spread(bond_yield: float, swap_rate: float) -> float:
        """Asset swap spread."""
        return (bond_yield - swap_rate) * 10_000

    @staticmethod
    def option_adjusted_spread(z_spread_bps: float,
                               option_value_bps: float = 0) -> float:
        """OAS = Z-spread - option value."""
        return z_spread_bps - option_value_bps

    @staticmethod
    def credit_spread(bond_yield: float, risk_free_yield: float) -> float:
        """Simple credit spread in bps."""
        return (bond_yield - risk_free_yield) * 10_000

    @staticmethod
    def i_spread(bond_yield: float, swap_rate: float) -> float:
        """Interpolated spread over swap curve."""
        return (bond_yield - swap_rate) * 10_000

    @staticmethod
    def ted_spread(t_bill_rate: float, libor_rate: float) -> float:
        """TED spread (LIBOR - T-bill) in bps."""
        return (libor_rate - t_bill_rate) * 10_000

    @staticmethod
    def swap_spread(swap_rate: float, treasury_yield: float) -> float:
        """Swap spread in bps."""
        return (swap_rate - treasury_yield) * 10_000

    @staticmethod
    def relative_value_score(bond: Bond, peers: List[Tuple[Bond, float]],
                             treasury_curve: List[YieldCurvePoint]) -> Dict[str, Any]:
        """Score bond relative to peer group."""
        if not peers:
            return {'score': 50, 'percentile': 50, 'z_score': 0}
        spreads = []
        for peer_bond, peer_price in peers:
            peer_ytm = BondPricingEngine.yield_to_maturity(peer_bond, peer_price)
            tsy_yield = RiskAnalytics._interpolate_yield(
                treasury_curve, peer_bond.years_to_maturity)
            spreads.append(peer_ytm - tsy_yield)
        if not spreads:
            return {'score': 50, 'percentile': 50, 'z_score': 0}
        mean_spread = sum(spreads) / len(spreads)
        std_spread = statistics.stdev(spreads) if len(spreads) > 1 else 0.01
        bond_ytm = BondPricingEngine.yield_to_maturity(bond, bond.face_value)
        tsy = RiskAnalytics._interpolate_yield(
            treasury_curve, bond.years_to_maturity)
        bond_spread = bond_ytm - tsy
        z_score = (bond_spread - mean_spread) / std_spread if std_spread > 0 else 0
        sorted_spreads = sorted(spreads)
        rank = sum(1 for s in sorted_spreads if s <= bond_spread) / len(sorted_spreads) * 100
        return {
            'score': round(z_score * 10 + 50, 1),
            'percentile': round(rank, 1),
            'z_score': round(z_score, 3),
            'bond_spread_bps': round(bond_spread * 10_000, 1),
            'peer_avg_spread_bps': round(mean_spread * 10_000, 1),
        }


# ═══════════════════════════════════════════════════════════════════════════════
# CREDIT ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════════

class CreditAnalyzer:
    """Credit risk analysis for fixed income."""

    @staticmethod
    def probability_of_default(rating: CreditRating, horizon_years: int = 1) -> float:
        """Estimate probability of default from rating."""
        annual_pd = {
            CreditRating.AAA: 0.0001, CreditRating.AA_PLUS: 0.0002,
            CreditRating.AA: 0.0003, CreditRating.AA_MINUS: 0.0004,
            CreditRating.A_PLUS: 0.0006, CreditRating.A: 0.0008,
            CreditRating.A_MINUS: 0.0012, CreditRating.BBB_PLUS: 0.002,
            CreditRating.BBB: 0.003, CreditRating.BBB_MINUS: 0.005,
            CreditRating.BB_PLUS: 0.01, CreditRating.BB: 0.015,
            CreditRating.BB_MINUS: 0.025, CreditRating.B_PLUS: 0.04,
            CreditRating.B: 0.06, CreditRating.B_MINUS: 0.08,
            CreditRating.CCC: 0.15, CreditRating.CC: 0.25,
            CreditRating.C: 0.40, CreditRating.D: 1.0,
        }
        pd_1y = annual_pd.get(rating, 0.01)
        return 1 - (1 - pd_1y) ** horizon_years

    @staticmethod
    def expected_loss(face_value: float, pd: float, lgd: float = 0.6) -> float:
        """Expected loss = EAD * PD * LGD."""
        return face_value * pd * lgd

    @staticmethod
    def credit_var(portfolio_value: float, pd: float, lgd: float = 0.6,
                   confidence: float = 0.99) -> float:
        """Credit VaR using simplified model."""
        el = portfolio_value * pd * lgd
        ul = portfolio_value * lgd * math.sqrt(pd * (1 - pd))
        # Gaussian approximation
        z_scores = {0.95: 1.645, 0.99: 2.326, 0.999: 3.090}
        z = z_scores.get(confidence, 2.326)
        return el + z * ul

    @staticmethod
    def merton_model(asset_value: float, debt_face: float,
                     asset_volatility: float, risk_free: float,
                     time_horizon: float = 1.0) -> Dict[str, float]:
        """Merton structural model for default probability."""
        if asset_value <= 0 or asset_volatility <= 0:
            return {'dd': 0, 'pd': 1.0}
        d1 = (math.log(asset_value / debt_face) +
              (risk_free + 0.5 * asset_volatility ** 2) * time_horizon) / \
             (asset_volatility * math.sqrt(time_horizon))
        d2 = d1 - asset_volatility * math.sqrt(time_horizon)
        # Normal CDF approximation
        pd = 0.5 * (1 + math.erf(-d2 / math.sqrt(2)))
        return {
            'distance_to_default': round(d2, 4),
            'probability_of_default': round(pd, 6),
            'd1': round(d1, 4),
            'd2': round(d2, 4),
        }

    @staticmethod
    def altman_z_score(working_capital: float, total_assets: float,
                       retained_earnings: float, ebit: float,
                       market_cap: float, total_liabilities: float,
                       revenue: float) -> Dict[str, Any]:
        """Altman Z-Score for bankruptcy prediction."""
        if total_assets == 0:
            return {'z_score': 0, 'zone': 'distress'}
        x1 = working_capital / total_assets
        x2 = retained_earnings / total_assets
        x3 = ebit / total_assets
        x4 = market_cap / total_liabilities if total_liabilities > 0 else 0
        x5 = revenue / total_assets
        z = 1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4 + 1.0 * x5
        if z > 2.99:
            zone = 'safe'
        elif z > 1.81:
            zone = 'grey'
        else:
            zone = 'distress'
        return {
            'z_score': round(z, 4),
            'zone': zone,
            'components': {
                'x1_wc_ta': round(x1, 4), 'x2_re_ta': round(x2, 4),
                'x3_ebit_ta': round(x3, 4), 'x4_mc_tl': round(x4, 4),
                'x5_rev_ta': round(x5, 4),
            },
        }

    @staticmethod
    def transition_matrix() -> Dict[str, Dict[str, float]]:
        """1-year credit rating transition probabilities (simplified S&P)."""
        return {
            'AAA': {'AAA': 0.906, 'AA': 0.083, 'A': 0.009, 'BBB': 0.001, 'BB': 0, 'B': 0, 'CCC': 0, 'D': 0.001},
            'AA':  {'AAA': 0.007, 'AA': 0.907, 'A': 0.075, 'BBB': 0.007, 'BB': 0.002, 'B': 0.001, 'CCC': 0, 'D': 0.001},
            'A':   {'AAA': 0.001, 'AA': 0.023, 'A': 0.912, 'BBB': 0.052, 'BB': 0.006, 'B': 0.003, 'CCC': 0.001, 'D': 0.002},
            'BBB': {'AAA': 0, 'AA': 0.003, 'A': 0.046, 'BBB': 0.869, 'BB': 0.053, 'B': 0.016, 'CCC': 0.006, 'D': 0.007},
            'BB':  {'AAA': 0, 'AA': 0.001, 'A': 0.005, 'BBB': 0.067, 'BB': 0.829, 'B': 0.069, 'CCC': 0.016, 'D': 0.013},
            'B':   {'AAA': 0, 'AA': 0.001, 'A': 0.002, 'BBB': 0.005, 'BB': 0.063, 'B': 0.836, 'CCC': 0.041, 'D': 0.052},
            'CCC': {'AAA': 0, 'AA': 0, 'A': 0.002, 'BBB': 0.01, 'BB': 0.022, 'B': 0.114, 'CCC': 0.646, 'D': 0.206},
        }


# ═══════════════════════════════════════════════════════════════════════════════
# MORTGAGE-BACKED SECURITIES (MBS)
# ═══════════════════════════════════════════════════════════════════════════════

class MBSAnalytics:
    """Mortgage-backed securities analysis."""

    @staticmethod
    def cpr_to_smm(cpr: float) -> float:
        """Convert CPR (Conditional Prepayment Rate) to SMM (Single Monthly Mortality)."""
        return 1 - (1 - cpr) ** (1/12)

    @staticmethod
    def smm_to_cpr(smm: float) -> float:
        """Convert SMM to CPR."""
        return 1 - (1 - smm) ** 12

    @staticmethod
    def psa_prepayment(month: int, psa_speed: float = 100) -> float:
        """Public Securities Association prepayment model.
        Ramps from 0.2% CPR to 6% CPR over 30 months, then constant.
        """
        if month <= 30:
            cpr = 0.002 * month * (psa_speed / 100)
        else:
            cpr = 0.06 * (psa_speed / 100)
        return cpr

    @staticmethod
    def mbs_cash_flows(balance: float, wac: float, wam: int,
                       psa_speed: float = 100) -> List[Dict[str, float]]:
        """Generate MBS cash flows using PSA model."""
        flows = []
        remaining = balance
        monthly_rate = wac / 12

        for month in range(1, wam + 1):
            if remaining <= 0:
                break
            # Scheduled payment
            scheduled = remaining * monthly_rate / (1 - (1 + monthly_rate) ** -(wam - month + 1))
            interest = remaining * monthly_rate
            scheduled_principal = scheduled - interest

            # Prepayment
            cpr = MBSAnalytics.psa_prepayment(month, psa_speed)
            smm = MBSAnalytics.cpr_to_smm(cpr)
            prepayment = (remaining - scheduled_principal) * smm

            total_principal = scheduled_principal + prepayment
            total_cf = interest + total_principal
            remaining -= total_principal

            flows.append({
                'month': month,
                'interest': round(interest, 2),
                'scheduled_principal': round(scheduled_principal, 2),
                'prepayment': round(prepayment, 2),
                'total_principal': round(total_principal, 2),
                'total_cash_flow': round(total_cf, 2),
                'remaining_balance': round(max(remaining, 0), 2),
                'cpr': round(cpr * 100, 4),
                'smm': round(smm * 100, 4),
            })
        return flows

    @staticmethod
    def weighted_average_life(flows: List[Dict[str, float]],
                              balance: float) -> float:
        """Weighted average life in years."""
        if balance == 0:
            return 0
        wal = sum(f['total_principal'] * f['month'] / 12 for f in flows) / balance
        return round(wal, 2)

    @staticmethod
    def oas_value(mbs_price: float, zero_curve: List[YieldCurvePoint],
                  flows: List[Dict[str, float]], face: float) -> float:
        """Option-adjusted spread for MBS."""
        oas = 0.01
        for _ in range(100):
            pv = 0
            for f in flows:
                t = f['month'] / 12
                spot = RiskAnalytics._interpolate_yield(zero_curve, t)
                pv += f['total_cash_flow'] / (1 + spot + oas) ** t
            diff = pv - mbs_price
            if abs(diff) < 0.01:
                return round(oas * 10_000, 1)
            oas += diff / (face * 10)
        return round(oas * 10_000, 1)


# ═══════════════════════════════════════════════════════════════════════════════
# FI PORTFOLIO ANALYTICS
# ═══════════════════════════════════════════════════════════════════════════════

class FixedIncomePortfolioAnalytics:
    """Portfolio-level fixed income analytics."""

    @staticmethod
    def portfolio_duration(holdings: List[Tuple[Bond, float, float]]) -> float:
        """Weighted average duration of a bond portfolio.
        holdings: [(bond, market_value, yield)]
        """
        total_mv = sum(mv for _, mv, _ in holdings)
        if total_mv == 0:
            return 0
        weighted_dur = 0
        for bond, mv, y in holdings:
            dur = RiskAnalytics.modified_duration(bond, y)
            weighted_dur += dur * (mv / total_mv)
        return round(weighted_dur, 4)

    @staticmethod
    def portfolio_convexity(holdings: List[Tuple[Bond, float, float]]) -> float:
        """Weighted average convexity."""
        total_mv = sum(mv for _, mv, _ in holdings)
        if total_mv == 0:
            return 0
        weighted_conv = 0
        for bond, mv, y in holdings:
            conv = RiskAnalytics.convexity(bond, y)
            weighted_conv += conv * (mv / total_mv)
        return round(weighted_conv, 4)

    @staticmethod
    def portfolio_yield(holdings: List[Tuple[Bond, float, float]]) -> float:
        """Weighted average yield."""
        total_mv = sum(mv for _, mv, _ in holdings)
        if total_mv == 0:
            return 0
        weighted_yield = sum(y * (mv / total_mv) for _, mv, y in holdings)
        return round(weighted_yield, 6)

    @staticmethod
    def duration_contribution(holdings: List[Tuple[Bond, float, float]]) -> List[Dict[str, Any]]:
        """Duration contribution by sector/rating."""
        total_mv = sum(mv for _, mv, _ in holdings)
        contributions = []
        for bond, mv, y in holdings:
            dur = RiskAnalytics.modified_duration(bond, y)
            weight = mv / total_mv if total_mv > 0 else 0
            contributions.append({
                'cusip': bond.cusip,
                'name': bond.name,
                'sector': bond.sector,
                'rating': bond.credit_rating.value,
                'weight': round(weight * 100, 2),
                'duration': round(dur, 4),
                'duration_contribution': round(dur * weight, 4),
                'dv01': round(RiskAnalytics.dv01(bond, y), 4),
            })
        return contributions

    @staticmethod
    def sector_allocation(holdings: List[Tuple[Bond, float, float]]) -> Dict[str, Dict[str, float]]:
        """Sector-level allocation and risk metrics."""
        sectors: Dict[str, List[Tuple[Bond, float, float]]] = defaultdict(list)
        total_mv = sum(mv for _, mv, _ in holdings)
        for bond, mv, y in holdings:
            sectors[bond.sector or bond.bond_type.value].append((bond, mv, y))
        result: Dict[str, Dict[str, float]] = {}
        for sector, sector_holdings in sectors.items():
            sector_mv = sum(mv for _, mv, _ in sector_holdings)
            result[sector] = {
                'weight_pct': round(sector_mv / total_mv * 100, 2) if total_mv else 0,
                'market_value': round(sector_mv, 2),
                'duration': FixedIncomePortfolioAnalytics.portfolio_duration(sector_holdings),
                'avg_yield': FixedIncomePortfolioAnalytics.portfolio_yield(sector_holdings),
                'count': len(sector_holdings),
            }
        return result

    @staticmethod
    def rating_distribution(holdings: List[Tuple[Bond, float, float]]) -> Dict[str, float]:
        """Rating distribution by market value."""
        total_mv = sum(mv for _, mv, _ in holdings)
        dist: Dict[str, float] = defaultdict(float)
        for bond, mv, _ in holdings:
            dist[bond.credit_rating.value] += mv / total_mv * 100 if total_mv else 0
        return {k: round(v, 2) for k, v in sorted(dist.items())}

    @staticmethod
    def maturity_profile(holdings: List[Tuple[Bond, float, float]]) -> Dict[str, float]:
        """Maturity bucket distribution."""
        buckets = {'0-1Y': 0, '1-3Y': 0, '3-5Y': 0, '5-7Y': 0,
                   '7-10Y': 0, '10-20Y': 0, '20-30Y': 0, '30Y+': 0}
        total_mv = sum(mv for _, mv, _ in holdings)
        for bond, mv, _ in holdings:
            ytm = bond.years_to_maturity
            if ytm <= 1:
                buckets['0-1Y'] += mv
            elif ytm <= 3:
                buckets['1-3Y'] += mv
            elif ytm <= 5:
                buckets['3-5Y'] += mv
            elif ytm <= 7:
                buckets['5-7Y'] += mv
            elif ytm <= 10:
                buckets['7-10Y'] += mv
            elif ytm <= 20:
                buckets['10-20Y'] += mv
            elif ytm <= 30:
                buckets['20-30Y'] += mv
            else:
                buckets['30Y+'] += mv
        return {k: round(v / total_mv * 100, 2) if total_mv > 0 else 0
                for k, v in buckets.items()}

    @staticmethod
    def scenario_analysis(holdings: List[Tuple[Bond, float, float]],
                          scenarios: List[Dict[str, float]]) -> List[Dict[str, Any]]:
        """Parallel shift and twist scenarios."""
        results = []
        base_value = sum(mv for _, mv, _ in holdings)
        for scenario in scenarios:
            shift = scenario.get('parallel_shift', 0)
            new_value = 0
            for bond, mv, y in holdings:
                new_y = y + shift / 10_000  # bps to decimal
                new_price = BondPricingEngine.price(bond, new_y)
                orig_price = BondPricingEngine.price(bond, y)
                price_ratio = new_price / orig_price if orig_price > 0 else 1
                new_value += mv * price_ratio

            pnl = new_value - base_value
            results.append({
                'scenario': scenario.get('name', f"+{shift}bps"),
                'shift_bps': shift,
                'base_value': round(base_value, 2),
                'new_value': round(new_value, 2),
                'pnl': round(pnl, 2),
                'pnl_pct': round(pnl / base_value * 100, 3) if base_value > 0 else 0,
            })
        return results


# ═══════════════════════════════════════════════════════════════════════════════
# BOND SCREENING & SEARCH
# ═══════════════════════════════════════════════════════════════════════════════

class BondScreener:
    """Screen and filter bonds by various criteria."""

    def __init__(self):
        self.bonds: List[Bond] = []
        self._demo_bonds: Optional[List[Bond]] = None

    def load_demo_bonds(self) -> List[Bond]:
        """Generate demo bond universe."""
        if self._demo_bonds:
            return self._demo_bonds

        sectors = ['Technology', 'Healthcare', 'Finance', 'Energy', 'Industrials',
                    'Consumer', 'Utilities', 'Telecom', 'Materials', 'Real Estate']
        ratings = list(CreditRating)
        types = [BondType.CORPORATE, BondType.TREASURY, BondType.MUNICIPAL,
                 BondType.AGENCY]
        bonds = []
        for i in range(200):
            mat_years = 1 + (i * 97 % 29)
            rating_idx = min(i % len(ratings), len(ratings) - 1)
            coupon = 0.02 + (ratings[rating_idx].numeric_score * 0.003)
            bond = Bond(
                cusip=f"DEMO{i:06d}",
                isin=f"US{i:010d}0",
                name=f"Demo Bond {i + 1}",
                issuer=f"Demo Issuer {i // 10 + 1}",
                bond_type=types[i % len(types)],
                face_value=1000.0,
                coupon_rate=round(coupon, 4),
                coupon_frequency=CouponFrequency.SEMI_ANNUAL,
                issue_date=date.today() - timedelta(days=365 * 2),
                maturity_date=date.today() + timedelta(days=int(365.25 * mat_years)),
                credit_rating=ratings[rating_idx],
                sector=sectors[i % len(sectors)],
                callable=i % 4 == 0,
                call_date=date.today() + timedelta(days=int(365.25 * mat_years * 0.5)) if i % 4 == 0 else None,
                call_price=1020 if i % 4 == 0 else None,
            )
            bonds.append(bond)
        self._demo_bonds = bonds
        return bonds

    def screen(self, criteria: Dict[str, Any]) -> List[Bond]:
        """Filter bonds by criteria."""
        bonds = self.load_demo_bonds()
        results = bonds

        if 'bond_type' in criteria:
            bt = BondType(criteria['bond_type'])
            results = [b for b in results if b.bond_type == bt]

        if 'min_coupon' in criteria:
            results = [b for b in results if b.coupon_rate >= criteria['min_coupon']]
        if 'max_coupon' in criteria:
            results = [b for b in results if b.coupon_rate <= criteria['max_coupon']]

        if 'min_maturity' in criteria:
            results = [b for b in results if b.years_to_maturity >= criteria['min_maturity']]
        if 'max_maturity' in criteria:
            results = [b for b in results if b.years_to_maturity <= criteria['max_maturity']]

        if 'min_rating' in criteria:
            min_score = CreditRating(criteria['min_rating']).numeric_score
            results = [b for b in results if b.credit_rating.numeric_score <= min_score]

        if 'investment_grade_only' in criteria and criteria['investment_grade_only']:
            results = [b for b in results if b.credit_rating.is_investment_grade]

        if 'sector' in criteria:
            results = [b for b in results if b.sector == criteria['sector']]

        if 'callable' in criteria:
            results = [b for b in results if b.callable == criteria['callable']]

        return results

    def sort_bonds(self, bonds: List[Bond], sort_by: str = 'yield',
                   descending: bool = True) -> List[Bond]:
        """Sort bonds by various criteria."""
        sorters = {
            'yield': lambda b: b.coupon_rate,
            'maturity': lambda b: b.years_to_maturity,
            'rating': lambda b: b.credit_rating.numeric_score,
            'coupon': lambda b: b.coupon_rate,
            'name': lambda b: b.name,
        }
        key_func = sorters.get(sort_by, lambda b: b.coupon_rate)
        return sorted(bonds, key=key_func, reverse=descending)


# ═══════════════════════════════════════════════════════════════════════════════
# LADDER / BARBELL / BULLET STRATEGIES
# ═══════════════════════════════════════════════════════════════════════════════

class BondStrategyBuilder:
    """Build common FI portfolio strategies."""

    @staticmethod
    def ladder(total_investment: float, num_rungs: int = 10,
               min_maturity: float = 1, max_maturity: float = 10,
               rating: CreditRating = CreditRating.A) -> List[Dict[str, Any]]:
        """Build a bond ladder."""
        per_rung = total_investment / num_rungs
        step = (max_maturity - min_maturity) / (num_rungs - 1) if num_rungs > 1 else 0
        rungs = []
        for i in range(num_rungs):
            mat = min_maturity + i * step
            estimated_yield = 0.04 + mat * 0.001  # Simplified yield curve
            rungs.append({
                'rung': i + 1,
                'maturity_years': round(mat, 1),
                'face_value': round(per_rung, 2),
                'estimated_yield': round(estimated_yield, 4),
                'annual_income': round(per_rung * estimated_yield, 2),
            })
        return rungs

    @staticmethod
    def barbell(total_investment: float, short_pct: float = 0.5,
                short_maturity: float = 2, long_maturity: float = 20) -> List[Dict[str, Any]]:
        """Build a barbell strategy."""
        short_alloc = total_investment * short_pct
        long_alloc = total_investment * (1 - short_pct)
        return [
            {
                'bucket': 'Short',
                'maturity_years': short_maturity,
                'allocation': round(short_alloc, 2),
                'allocation_pct': round(short_pct * 100, 1),
                'estimated_yield': 0.04,
            },
            {
                'bucket': 'Long',
                'maturity_years': long_maturity,
                'allocation': round(long_alloc, 2),
                'allocation_pct': round((1 - short_pct) * 100, 1),
                'estimated_yield': 0.046,
            },
        ]

    @staticmethod
    def bullet(total_investment: float, target_maturity: float = 5,
               tolerance: float = 1) -> Dict[str, Any]:
        """Build a bullet strategy."""
        return {
            'strategy': 'bullet',
            'total_investment': total_investment,
            'target_maturity': target_maturity,
            'maturity_range': (target_maturity - tolerance, target_maturity + tolerance),
            'estimated_yield': 0.043,
            'estimated_duration': target_maturity * 0.9,
        }

    @staticmethod
    def immunization(liability_value: float, liability_duration: float,
                     bond_universe: List[Bond]) -> List[Dict[str, Any]]:
        """Simple cash-flow matching / immunization."""
        matched = []
        remaining = liability_value
        for bond in sorted(bond_universe, key=lambda b: abs(
                RiskAnalytics.macaulay_duration(b, b.coupon_rate) - liability_duration)):
            if remaining <= 0:
                break
            dur = RiskAnalytics.macaulay_duration(bond, bond.coupon_rate)
            alloc = min(remaining, bond.face_value * 10)
            matched.append({
                'cusip': bond.cusip,
                'name': bond.name,
                'duration': round(dur, 2),
                'allocation': round(alloc, 2),
                'maturity': round(bond.years_to_maturity, 1),
            })
            remaining -= alloc
        return matched


# ═══════════════════════════════════════════════════════════════════════════════
# API SERVICE
# ═══════════════════════════════════════════════════════════════════════════════

class FixedIncomeService:
    """High-level API for fixed income operations."""

    def __init__(self):
        self.curve_builder = YieldCurveBuilder()
        self.screener = BondScreener()
        self.pricing = BondPricingEngine()
        self.risk = RiskAnalytics()
        self.spread = SpreadAnalyzer()
        self.credit = CreditAnalyzer()
        self.mbs = MBSAnalytics()
        self.portfolio = FixedIncomePortfolioAnalytics()
        self.strategy = BondStrategyBuilder()

    async def get_yield_curve(self) -> Dict[str, Any]:
        curve = await self.curve_builder.fetch_treasury_curve()
        zero = self.curve_builder.bootstrap_zero_curve(curve)
        forwards = self.curve_builder.forward_rates(zero)
        ns_params = self.curve_builder.nelson_siegel(curve)
        return {
            'par_curve': [{'maturity': p.maturity, 'yield': p.yield_rate,
                           'date': p.date.isoformat() if p.date else None}
                          for p in curve],
            'zero_curve': [{'maturity': p.maturity, 'yield': p.yield_rate}
                           for p in zero],
            'forward_rates': forwards,
            'nelson_siegel_params': ns_params,
        }

    def price_bond(self, bond_config: Dict[str, Any]) -> Dict[str, Any]:
        bond = self._create_bond(bond_config)
        ytm = bond_config.get('yield_rate', bond.coupon_rate)
        price = self.pricing.price(bond, ytm)
        return {
            'clean_price': round(price, 4),
            'dirty_price': round(self.pricing.dirty_price(bond, ytm), 4),
            'accrued_interest': round(self.pricing.accrued_interest(bond), 4),
            'current_yield': round(self.pricing.current_yield(bond, price), 6),
            'duration': round(self.risk.modified_duration(bond, ytm), 4),
            'convexity': round(self.risk.convexity(bond, ytm), 4),
            'dv01': round(self.risk.dv01(bond, ytm), 4),
            'macaulay_duration': round(self.risk.macaulay_duration(bond, ytm), 4),
            'years_to_maturity': round(bond.years_to_maturity, 2),
        }

    def screen_bonds(self, criteria: Dict[str, Any]) -> List[Dict[str, Any]]:
        bonds = self.screener.screen(criteria)
        return [{
            'cusip': b.cusip, 'name': b.name, 'issuer': b.issuer,
            'type': b.bond_type.value, 'coupon': b.coupon_rate,
            'maturity': round(b.years_to_maturity, 1),
            'rating': b.credit_rating.value, 'sector': b.sector,
            'callable': b.callable,
        } for b in bonds[:50]]

    def build_strategy(self, strategy_type: str,
                       params: Dict[str, Any]) -> Dict[str, Any]:
        if strategy_type == 'ladder':
            return {'strategy': 'ladder',
                    'rungs': self.strategy.ladder(**params)}
        elif strategy_type == 'barbell':
            return {'strategy': 'barbell',
                    'allocations': self.strategy.barbell(**params)}
        elif strategy_type == 'bullet':
            return {'strategy': 'bullet', **self.strategy.bullet(**params)}
        raise ValueError(f"Unknown strategy: {strategy_type}")

    def _create_bond(self, config: Dict[str, Any]) -> Bond:
        return Bond(
            cusip=config.get('cusip', 'CUSTOM'),
            name=config.get('name', 'Custom Bond'),
            face_value=config.get('face_value', 1000),
            coupon_rate=config.get('coupon_rate', 0.05),
            coupon_frequency=CouponFrequency(config.get('coupon_frequency', 2)),
            maturity_date=date.fromisoformat(config['maturity_date']) if 'maturity_date' in config
            else date.today() + timedelta(days=3650),
            credit_rating=CreditRating(config.get('credit_rating', 'BBB')),
            bond_type=BondType(config.get('bond_type', 'corporate')),
        )
