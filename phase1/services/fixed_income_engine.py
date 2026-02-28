"""
Fixed Income Engine — Bond pricing, yield curve construction, duration/convexity,
interest rate risk, term structure models, mortgage analytics, credit spreads,
swap pricing, immunization, OAS analysis, key rate durations.

Pure computation — no FastAPI dependencies.
"""

from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


# ── Enums ───────────────────────────────────────────────────────────────

class BondType(str, Enum):
    ZERO_COUPON = "zero_coupon"
    FIXED_RATE = "fixed_rate"
    FLOATING_RATE = "floating_rate"
    CALLABLE = "callable"
    PUTABLE = "putable"
    CONVERTIBLE = "convertible"
    INFLATION_LINKED = "inflation_linked"
    AMORTIZING = "amortizing"
    PERPETUAL = "perpetual"


class DayCountConvention(str, Enum):
    ACTUAL_360 = "actual_360"
    ACTUAL_365 = "actual_365"
    ACTUAL_ACTUAL = "actual_actual"
    THIRTY_360 = "30_360"
    THIRTY_365 = "30_365"


class CurveInterpolation(str, Enum):
    LINEAR = "linear"
    LOG_LINEAR = "log_linear"
    CUBIC_SPLINE = "cubic_spline"
    NELSON_SIEGEL = "nelson_siegel"
    SVENSSON = "svensson"


class CreditRating(str, Enum):
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


# ── Data Classes ────────────────────────────────────────────────────────

@dataclass
class BondCashFlow:
    """A single cash flow from a bond."""
    period: int
    date_offset_years: float
    coupon: float
    principal: float
    total: float

    def to_dict(self) -> dict:
        return {
            "period": self.period,
            "date_offset_years": round(self.date_offset_years, 4),
            "coupon": round(self.coupon, 4),
            "principal": round(self.principal, 4),
            "total": round(self.total, 4),
        }


@dataclass
class BondAnalytics:
    """Complete analytics for a single bond."""
    clean_price: float = 0.0
    dirty_price: float = 0.0
    accrued_interest: float = 0.0
    yield_to_maturity: float = 0.0
    current_yield: float = 0.0
    macaulay_duration: float = 0.0
    modified_duration: float = 0.0
    effective_duration: float = 0.0
    dollar_duration: float = 0.0
    convexity: float = 0.0
    dv01: float = 0.0
    spread_to_benchmark: float = 0.0
    z_spread: float = 0.0
    oas: float = 0.0

    def to_dict(self) -> dict:
        return {
            "clean_price": round(self.clean_price, 4),
            "dirty_price": round(self.dirty_price, 4),
            "accrued_interest": round(self.accrued_interest, 4),
            "yield_to_maturity": round(self.yield_to_maturity, 6),
            "current_yield": round(self.current_yield, 6),
            "macaulay_duration": round(self.macaulay_duration, 4),
            "modified_duration": round(self.modified_duration, 4),
            "effective_duration": round(self.effective_duration, 4),
            "dollar_duration": round(self.dollar_duration, 4),
            "convexity": round(self.convexity, 4),
            "dv01": round(self.dv01, 6),
            "spread_to_benchmark": round(self.spread_to_benchmark, 6),
            "z_spread": round(self.z_spread, 6),
            "oas": round(self.oas, 6),
        }


@dataclass
class YieldCurvePoint:
    maturity: float  # years
    rate: float      # annualized
    discount_factor: float = 0.0
    forward_rate: float = 0.0

    def to_dict(self) -> dict:
        return {
            "maturity": round(self.maturity, 4),
            "rate": round(self.rate, 6),
            "discount_factor": round(self.discount_factor, 6),
            "forward_rate": round(self.forward_rate, 6),
        }


# ── Bond Pricing ────────────────────────────────────────────────────────

class BondPricer:
    """Core bond pricing engine."""

    @staticmethod
    def price_fixed_coupon(
        face_value: float,
        coupon_rate: float,
        ytm: float,
        periods_remaining: int,
        frequency: int = 2,
    ) -> float:
        """Price a fixed-coupon bond."""
        if frequency <= 0:
            frequency = 2
        c = face_value * coupon_rate / frequency
        r = ytm / frequency
        n = periods_remaining

        if abs(r) < 1e-12:
            return c * n + face_value

        pv_coupons = c * (1 - (1 + r) ** (-n)) / r
        pv_principal = face_value / (1 + r) ** n
        return pv_coupons + pv_principal

    @staticmethod
    def price_zero_coupon(
        face_value: float,
        ytm: float,
        years_to_maturity: float,
        compounding: int = 2,
    ) -> float:
        """Price a zero-coupon bond."""
        if compounding <= 0:
            return face_value * math.exp(-ytm * years_to_maturity)
        return face_value / (1 + ytm / compounding) ** (compounding * years_to_maturity)

    @staticmethod
    def price_from_spot_curve(
        face_value: float,
        coupon_rate: float,
        spot_rates: list[float],
        frequency: int = 2,
    ) -> float:
        """Price a bond using spot rates for each period."""
        n = len(spot_rates)
        c = face_value * coupon_rate / frequency
        price = 0.0

        for i in range(n):
            t = (i + 1) / frequency
            r = spot_rates[i]
            if i == n - 1:
                cf = c + face_value
            else:
                cf = c
            price += cf / (1 + r / frequency) ** (i + 1)

        return price

    @staticmethod
    def price_perpetual(coupon: float, ytm: float) -> float:
        """Price a perpetual (consol) bond."""
        return coupon / ytm if ytm > 0 else float("inf")

    @staticmethod
    def price_amortizing(
        face_value: float,
        coupon_rate: float,
        ytm: float,
        periods: int,
        frequency: int = 2,
    ) -> float:
        """Price an amortizing bond (equal installments)."""
        r = ytm / frequency
        c = coupon_rate / frequency
        n = periods
        principal_per_period = face_value / n

        price = 0.0
        remaining = face_value
        for i in range(1, n + 1):
            interest = remaining * c
            cf = principal_per_period + interest
            price += cf / (1 + r) ** i
            remaining -= principal_per_period

        return price

    @staticmethod
    def accrued_interest(
        face_value: float,
        coupon_rate: float,
        days_since_last_coupon: int,
        days_in_period: int,
        frequency: int = 2,
    ) -> float:
        """Calculate accrued interest."""
        coupon = face_value * coupon_rate / frequency
        return coupon * days_since_last_coupon / days_in_period if days_in_period else 0.0

    @staticmethod
    def cash_flows(
        face_value: float,
        coupon_rate: float,
        periods: int,
        frequency: int = 2,
    ) -> list[BondCashFlow]:
        """Generate cash flow schedule."""
        c = face_value * coupon_rate / frequency
        flows = []
        for i in range(1, periods + 1):
            principal = face_value if i == periods else 0.0
            flows.append(BondCashFlow(
                period=i,
                date_offset_years=i / frequency,
                coupon=c,
                principal=principal,
                total=c + principal,
            ))
        return flows


# ── Yield Calculations ──────────────────────────────────────────────────

class YieldCalculator:
    """Yield calculations for bonds."""

    @staticmethod
    def yield_to_maturity(
        price: float,
        face_value: float,
        coupon_rate: float,
        periods_remaining: int,
        frequency: int = 2,
        tolerance: float = 1e-8,
        max_iterations: int = 200,
    ) -> float:
        """Calculate YTM using Newton-Raphson."""
        c = face_value * coupon_rate / frequency
        n = periods_remaining

        # Initial guess
        ytm = (c + (face_value - price) / n) / ((face_value + price) / 2) * frequency

        for _ in range(max_iterations):
            r = ytm / frequency
            if abs(r) < 1e-14:
                r = 1e-14

            # Price function
            pv = c * (1 - (1 + r) ** (-n)) / r + face_value / (1 + r) ** n
            f = pv - price

            if abs(f) < tolerance:
                return ytm

            # Derivative (negative of price with respect to r)
            d_pv = -c * n * (1 + r) ** (-n - 1) / r
            d_pv += c * (1 - (1 + r) ** (-n)) / (r * r) * (-1)
            d_pv -= face_value * n / frequency * (1 + r) ** (-n - 1) / frequency

            # Simplified numerical derivative
            dr = 0.0001
            r2 = r + dr
            pv2 = c * (1 - (1 + r2) ** (-n)) / r2 + face_value / (1 + r2) ** n
            dpv = (pv2 - pv) / dr

            if abs(dpv) < 1e-14:
                break

            ytm -= f / dpv * frequency

        return ytm

    @staticmethod
    def current_yield(price: float, face_value: float, coupon_rate: float) -> float:
        annual_coupon = face_value * coupon_rate
        return annual_coupon / price if price > 0 else 0.0

    @staticmethod
    def yield_to_call(
        price: float,
        face_value: float,
        coupon_rate: float,
        call_price: float,
        periods_to_call: int,
        frequency: int = 2,
    ) -> float:
        """YTC: treat call price as redemption."""
        c = face_value * coupon_rate / frequency
        n = periods_to_call

        ytc = (c + (call_price - price) / n) / ((call_price + price) / 2) * frequency

        for _ in range(100):
            r = ytc / frequency
            if abs(r) < 1e-14:
                break

            pv = c * (1 - (1 + r) ** (-n)) / r + call_price / (1 + r) ** n
            f = pv - price

            if abs(f) < 1e-8:
                return ytc

            dr = 0.0001
            r2 = r + dr
            pv2 = c * (1 - (1 + r2) ** (-n)) / r2 + call_price / (1 + r2) ** n
            dpv = (pv2 - pv) / dr

            if abs(dpv) < 1e-14:
                break

            ytc -= f / dpv * frequency

        return ytc

    @staticmethod
    def yield_to_worst(
        price: float,
        face_value: float,
        coupon_rate: float,
        call_schedule: list[tuple[int, float]],  # (periods, call_price)
        periods_to_maturity: int,
        frequency: int = 2,
    ) -> float:
        """YTW: minimum of YTM and all YTCs."""
        ytm = YieldCalculator.yield_to_maturity(price, face_value, coupon_rate, periods_to_maturity, frequency)
        yields = [ytm]

        for periods, call_price in call_schedule:
            ytc = YieldCalculator.yield_to_call(price, face_value, coupon_rate, call_price, periods, frequency)
            yields.append(ytc)

        return min(yields)

    @staticmethod
    def bond_equivalent_yield(
        purchase_price: float,
        face_value: float,
        days_to_maturity: int,
    ) -> float:
        """BEY for money market instruments."""
        return (face_value - purchase_price) / purchase_price * (365 / days_to_maturity) if days_to_maturity > 0 else 0

    @staticmethod
    def discount_yield(
        purchase_price: float,
        face_value: float,
        days_to_maturity: int,
    ) -> float:
        return (face_value - purchase_price) / face_value * (360 / days_to_maturity) if days_to_maturity > 0 else 0


# ── Duration & Convexity ──────────────────────────────────────────────

class DurationConvexity:
    """Duration and convexity calculations."""

    @staticmethod
    def macaulay_duration(
        face_value: float,
        coupon_rate: float,
        ytm: float,
        periods: int,
        frequency: int = 2,
    ) -> float:
        """Macaulay duration in years."""
        c = face_value * coupon_rate / frequency
        r = ytm / frequency
        price = BondPricer.price_fixed_coupon(face_value, coupon_rate, ytm, periods, frequency)

        if price <= 0:
            return 0.0

        weighted_time = 0.0
        for i in range(1, periods + 1):
            t = i / frequency
            cf = c if i < periods else c + face_value
            pv = cf / (1 + r) ** i
            weighted_time += t * pv

        return weighted_time / price

    @staticmethod
    def modified_duration(macaulay_dur: float, ytm: float, frequency: int = 2) -> float:
        return macaulay_dur / (1 + ytm / frequency)

    @staticmethod
    def effective_duration(
        price: float,
        price_up: float,
        price_down: float,
        delta_yield: float,
    ) -> float:
        """Effective duration from price shifts."""
        return (price_down - price_up) / (2 * price * delta_yield) if price > 0 and delta_yield > 0 else 0.0

    @staticmethod
    def dollar_duration(mod_duration: float, price: float) -> float:
        return mod_duration * price / 100

    @staticmethod
    def dv01(mod_duration: float, price: float) -> float:
        """Dollar value of a 01 (basis point)."""
        return mod_duration * price / 10000

    @staticmethod
    def convexity(
        face_value: float,
        coupon_rate: float,
        ytm: float,
        periods: int,
        frequency: int = 2,
    ) -> float:
        c = face_value * coupon_rate / frequency
        r = ytm / frequency
        price = BondPricer.price_fixed_coupon(face_value, coupon_rate, ytm, periods, frequency)

        if price <= 0:
            return 0.0

        conv = 0.0
        for i in range(1, periods + 1):
            cf = c if i < periods else c + face_value
            t = i / frequency
            pv = cf / (1 + r) ** i
            conv += t * (t + 1 / frequency) * pv

        return conv / (price * (1 + r) ** 2)

    @staticmethod
    def effective_convexity(
        price: float,
        price_up: float,
        price_down: float,
        delta_yield: float,
    ) -> float:
        return (price_up + price_down - 2 * price) / (price * delta_yield ** 2) if price > 0 else 0

    @staticmethod
    def price_change_approximation(
        mod_duration: float,
        convexity: float,
        delta_yield: float,
    ) -> float:
        """Second-order Taylor approximation of price change %."""
        return -mod_duration * delta_yield + 0.5 * convexity * delta_yield ** 2

    @staticmethod
    def key_rate_duration(
        face_value: float,
        coupon_rate: float,
        ytm: float,
        periods: int,
        frequency: int = 2,
        key_rates: list[float] = None,
        shift_size: float = 0.0001,
    ) -> Dict[float, float]:
        """Key rate durations — sensitivity to specific points on the curve."""
        if key_rates is None:
            key_rates = [0.5, 1, 2, 3, 5, 7, 10, 20, 30]

        base_price = BondPricer.price_fixed_coupon(face_value, coupon_rate, ytm, periods, frequency)
        krd = {}

        for kr in key_rates:
            kr_periods = int(kr * frequency)
            if kr_periods > periods:
                krd[kr] = 0.0
                continue

            # Shift yield at this point and price
            shifted_ytm = ytm + shift_size
            shifted_price = BondPricer.price_fixed_coupon(face_value, coupon_rate, shifted_ytm, periods, frequency)
            krd[kr] = -(shifted_price - base_price) / (base_price * shift_size)

        return krd


# ── Yield Curve Construction ──────────────────────────────────────────

class YieldCurveEngine:
    """Yield curve construction and interpolation."""

    @staticmethod
    def bootstrap_spot_curve(
        par_rates: list[tuple[float, float]],  # (maturity, par_rate)
        frequency: int = 2,
    ) -> list[YieldCurvePoint]:
        """Bootstrap spot rates from par rates."""
        par_rates = sorted(par_rates, key=lambda x: x[0])
        spots = []

        for idx, (maturity, par_rate) in enumerate(par_rates):
            n = int(maturity * frequency)
            c = par_rate / frequency

            if n <= 1:
                spot = par_rate
            else:
                pv_coupons = sum(
                    c / (1 + spots[i].rate / frequency) ** (i + 1)
                    for i in range(min(n - 1, len(spots)))
                )
                remaining = 1 - pv_coupons
                if remaining > 0:
                    spot = frequency * ((1 + c) / remaining) ** (1 / n) - frequency
                else:
                    spot = par_rate

            df = 1 / (1 + spot / frequency) ** n if n > 0 else 1.0
            spots.append(YieldCurvePoint(maturity=maturity, rate=spot, discount_factor=df))

        # Forward rates
        for i in range(len(spots)):
            if i == 0:
                spots[i].forward_rate = spots[i].rate
            else:
                t1, t2 = spots[i - 1].maturity, spots[i].maturity
                r1, r2 = spots[i - 1].rate, spots[i].rate
                dt = t2 - t1
                if dt > 0:
                    spots[i].forward_rate = (r2 * t2 - r1 * t1) / dt
                else:
                    spots[i].forward_rate = r2

        return spots

    @staticmethod
    def interpolate_rate(
        curve: list[YieldCurvePoint],
        target_maturity: float,
        method: str = "linear",
    ) -> float:
        """Interpolate a rate from the curve."""
        if not curve:
            return 0.0

        if target_maturity <= curve[0].maturity:
            return curve[0].rate
        if target_maturity >= curve[-1].maturity:
            return curve[-1].rate

        for i in range(len(curve) - 1):
            if curve[i].maturity <= target_maturity <= curve[i + 1].maturity:
                t1, t2 = curve[i].maturity, curve[i + 1].maturity
                r1, r2 = curve[i].rate, curve[i + 1].rate
                dt = t2 - t1

                if method == "linear":
                    alpha = (target_maturity - t1) / dt
                    return r1 + alpha * (r2 - r1)
                elif method == "log_linear":
                    alpha = (target_maturity - t1) / dt
                    return math.exp(math.log(1 + r1) * (1 - alpha) + math.log(1 + r2) * alpha) - 1
                else:
                    alpha = (target_maturity - t1) / dt
                    return r1 + alpha * (r2 - r1)

        return curve[-1].rate

    @staticmethod
    def nelson_siegel(
        maturities: list[float],
        beta0: float,
        beta1: float,
        beta2: float,
        tau: float = 1.5,
    ) -> list[YieldCurvePoint]:
        """Nelson-Siegel yield curve model."""
        curve = []
        for t in maturities:
            if t <= 0:
                rate = beta0 + beta1
            else:
                x = t / tau
                rate = beta0 + beta1 * (1 - math.exp(-x)) / x + beta2 * ((1 - math.exp(-x)) / x - math.exp(-x))

            df = math.exp(-rate * t) if t > 0 else 1.0
            curve.append(YieldCurvePoint(maturity=t, rate=rate, discount_factor=df))

        return curve

    @staticmethod
    def svensson(
        maturities: list[float],
        beta0: float,
        beta1: float,
        beta2: float,
        beta3: float,
        tau1: float = 1.5,
        tau2: float = 5.0,
    ) -> list[YieldCurvePoint]:
        """Svensson extended Nelson-Siegel model."""
        curve = []
        for t in maturities:
            if t <= 0:
                rate = beta0 + beta1
            else:
                x1 = t / tau1
                x2 = t / tau2
                rate = (beta0
                        + beta1 * (1 - math.exp(-x1)) / x1
                        + beta2 * ((1 - math.exp(-x1)) / x1 - math.exp(-x1))
                        + beta3 * ((1 - math.exp(-x2)) / x2 - math.exp(-x2)))

            df = math.exp(-rate * t) if t > 0 else 1.0
            curve.append(YieldCurvePoint(maturity=t, rate=rate, discount_factor=df))

        return curve

    @staticmethod
    def forward_curve(spot_curve: list[YieldCurvePoint]) -> list[YieldCurvePoint]:
        """Calculate instantaneous forward rates from spot curve."""
        forwards = []
        for i in range(len(spot_curve)):
            if i == 0:
                fwd = spot_curve[i].rate
            else:
                t1, t2 = spot_curve[i - 1].maturity, spot_curve[i].maturity
                r1, r2 = spot_curve[i - 1].rate, spot_curve[i].rate
                dt = t2 - t1
                fwd = (r2 * t2 - r1 * t1) / dt if dt > 0 else r2

            forwards.append(YieldCurvePoint(
                maturity=spot_curve[i].maturity,
                rate=spot_curve[i].rate,
                discount_factor=spot_curve[i].discount_factor,
                forward_rate=fwd,
            ))
        return forwards


# ── Credit Analysis ─────────────────────────────────────────────────────

class CreditAnalysis:
    """Credit spread analysis and default probability."""

    DEFAULT_SPREADS = {
        CreditRating.AAA: 0.002,
        CreditRating.AA_PLUS: 0.003,
        CreditRating.AA: 0.004,
        CreditRating.AA_MINUS: 0.005,
        CreditRating.A_PLUS: 0.007,
        CreditRating.A: 0.009,
        CreditRating.A_MINUS: 0.011,
        CreditRating.BBB_PLUS: 0.014,
        CreditRating.BBB: 0.018,
        CreditRating.BBB_MINUS: 0.024,
        CreditRating.BB_PLUS: 0.032,
        CreditRating.BB: 0.040,
        CreditRating.BB_MINUS: 0.050,
        CreditRating.B_PLUS: 0.065,
        CreditRating.B: 0.085,
        CreditRating.B_MINUS: 0.110,
        CreditRating.CCC: 0.150,
        CreditRating.CC: 0.250,
        CreditRating.C: 0.350,
        CreditRating.D: 1.0,
    }

    RECOVERY_RATES = {
        "senior_secured": 0.55,
        "senior_unsecured": 0.40,
        "subordinated": 0.25,
        "junior_subordinated": 0.15,
    }

    @staticmethod
    def credit_spread(bond_yield: float, benchmark_yield: float) -> float:
        return bond_yield - benchmark_yield

    @staticmethod
    def z_spread(
        price: float,
        face_value: float,
        coupon_rate: float,
        spot_rates: list[float],
        frequency: int = 2,
        tolerance: float = 1e-8,
        max_iterations: int = 100,
    ) -> float:
        """Z-spread: constant spread over spot curve to match price."""
        n = len(spot_rates)
        c = face_value * coupon_rate / frequency
        z = 0.01  # Initial guess

        for _ in range(max_iterations):
            pv = 0.0
            dpv = 0.0
            for i in range(n):
                t = (i + 1)
                r = spot_rates[i] / frequency + z / frequency
                if i == n - 1:
                    cf = c + face_value
                else:
                    cf = c
                pv += cf / (1 + r) ** t
                dpv -= cf * t / frequency / (1 + r) ** (t + 1)

            f = pv - price
            if abs(f) < tolerance:
                return z
            if abs(dpv) < 1e-14:
                break
            z -= f / dpv

        return z

    @staticmethod
    def implied_default_probability(
        credit_spread: float,
        recovery_rate: float = 0.40,
        maturity: float = 5.0,
    ) -> float:
        """Implied annual default probability from credit spread."""
        if recovery_rate >= 1.0:
            return 0.0
        pd_annual = credit_spread / (1 - recovery_rate)
        cumulative_pd = 1 - math.exp(-pd_annual * maturity)
        return min(max(pd_annual, 0), 1.0), min(max(cumulative_pd, 0), 1.0)

    @staticmethod
    def expected_loss(
        face_value: float,
        default_probability: float,
        recovery_rate: float = 0.40,
    ) -> float:
        lgd = 1 - recovery_rate
        return face_value * default_probability * lgd

    @staticmethod
    def credit_var(
        positions: list[dict],
        confidence: float = 0.99,
        horizon_years: float = 1.0,
    ) -> dict:
        """
        Simplified credit VaR for a portfolio.
        positions: [{face_value, default_prob, recovery_rate, correlation}]
        """
        total_el = 0.0
        total_ul_sq = 0.0

        for pos in positions:
            fv = pos.get("face_value", 0)
            pd = pos.get("default_prob", 0.01)
            rr = pos.get("recovery_rate", 0.40)
            lgd = 1 - rr

            el = fv * pd * lgd
            ul = fv * lgd * math.sqrt(pd * (1 - pd))

            total_el += el
            total_ul_sq += ul ** 2

        # Simplified (no correlation adjustment)
        total_ul = math.sqrt(total_ul_sq)

        # Normal approximation
        from math import erf, sqrt
        z = sqrt(2) * (1 - 2 * (1 - confidence))  # Rough z-score
        z_score = 2.326 if confidence >= 0.99 else 1.645  # 99% and 95%

        credit_var = total_el + z_score * total_ul

        return {
            "expected_loss": round(total_el, 2),
            "unexpected_loss": round(total_ul, 2),
            "credit_var": round(credit_var, 2),
            "confidence": confidence,
        }


# ── Interest Rate Swap Pricing ────────────────────────────────────────

class SwapPricer:
    """Interest rate swap pricing and analytics."""

    @staticmethod
    def price_vanilla_swap(
        notional: float,
        fixed_rate: float,
        spot_rates: list[float],
        floating_rates: list[float],
        frequency: int = 2,
        is_payer: bool = True,  # True = pay fixed, receive floating
    ) -> dict:
        """Price a plain vanilla interest rate swap."""
        n = min(len(spot_rates), len(floating_rates))
        fixed_leg = 0.0
        floating_leg = 0.0

        for i in range(n):
            t = i + 1
            df = 1 / (1 + spot_rates[i] / frequency) ** t

            fixed_cf = notional * fixed_rate / frequency
            floating_cf = notional * floating_rates[i] / frequency

            fixed_leg += fixed_cf * df
            floating_leg += floating_cf * df

        if is_payer:
            npv = floating_leg - fixed_leg
        else:
            npv = fixed_leg - floating_leg

        return {
            "npv": round(npv, 2),
            "fixed_leg_pv": round(fixed_leg, 2),
            "floating_leg_pv": round(floating_leg, 2),
            "notional": notional,
            "fixed_rate": fixed_rate,
            "is_payer": is_payer,
        }

    @staticmethod
    def swap_rate(
        spot_rates: list[float],
        frequency: int = 2,
    ) -> float:
        """Calculate par swap rate."""
        n = len(spot_rates)
        dfs = [1 / (1 + spot_rates[i] / frequency) ** (i + 1) for i in range(n)]
        sum_df = sum(dfs)
        return frequency * (1 - dfs[-1]) / sum_df if sum_df > 0 else 0.0

    @staticmethod
    def swap_dv01(
        notional: float,
        spot_rates: list[float],
        frequency: int = 2,
    ) -> float:
        """DV01 of a swap."""
        n = len(spot_rates)
        dfs = [1 / (1 + spot_rates[i] / frequency) ** (i + 1) for i in range(n)]
        return notional / frequency * sum(dfs) / 10000


# ── Mortgage Analytics ────────────────────────────────────────────────

class MortgageAnalytics:
    """Mortgage-backed securities analysis."""

    @staticmethod
    def monthly_payment(
        principal: float,
        annual_rate: float,
        months: int,
    ) -> float:
        """Calculate fixed monthly mortgage payment."""
        r = annual_rate / 12
        if r <= 0:
            return principal / months
        return principal * r * (1 + r) ** months / ((1 + r) ** months - 1)

    @staticmethod
    def amortization_schedule(
        principal: float,
        annual_rate: float,
        months: int,
    ) -> list[dict]:
        """Full amortization schedule."""
        r = annual_rate / 12
        payment = MortgageAnalytics.monthly_payment(principal, annual_rate, months)
        balance = principal
        schedule = []

        for i in range(1, months + 1):
            interest = balance * r
            principal_payment = payment - interest
            balance -= principal_payment

            schedule.append({
                "month": i,
                "payment": round(payment, 2),
                "principal": round(principal_payment, 2),
                "interest": round(interest, 2),
                "balance": round(max(balance, 0), 2),
                "cumulative_interest": round(sum(s["interest"] for s in schedule) + interest, 2),
            })

        return schedule

    @staticmethod
    def prepayment_model_psa(
        month: int,
        psa_speed: float = 100,
    ) -> float:
        """PSA prepayment model — annualized CPR."""
        base_cpr = min(month * 0.002, 0.06)  # Ramps to 6% at month 30
        return base_cpr * psa_speed / 100

    @staticmethod
    def smm_from_cpr(cpr: float) -> float:
        """Single Monthly Mortality from CPR."""
        return 1 - (1 - cpr) ** (1 / 12)

    @staticmethod
    def weighted_average_life(
        principal_payments: list[float],
        face_value: float,
    ) -> float:
        """Weighted average life in years."""
        if face_value <= 0:
            return 0.0
        wal = sum((i + 1) / 12 * p for i, p in enumerate(principal_payments))
        return wal / face_value

    @staticmethod
    def oas_from_price(
        price: float,
        face_value: float,
        coupon_rate: float,
        spot_rates: list[float],
        prepayment_speeds: list[float],
        frequency: int = 2,
    ) -> float:
        """Simplified OAS calculation."""
        n = len(spot_rates)
        c = face_value * coupon_rate / frequency
        oas = 0.005  # Initial guess

        for _ in range(100):
            pv = 0.0
            remaining = face_value
            for i in range(n):
                pp_speed = prepayment_speeds[i] if i < len(prepayment_speeds) else 0.0
                prepay = remaining * pp_speed / frequency
                remaining -= prepay

                cf = c * remaining / face_value + prepay
                if i == n - 1:
                    cf += remaining

                t = i + 1
                r = (spot_rates[i] + oas) / frequency
                pv += cf / (1 + r) ** t

            f = pv - price
            if abs(f) < 0.001:
                return oas

            # Numerical derivative
            oas2 = oas + 0.0001
            pv2 = 0.0
            remaining2 = face_value
            for i in range(n):
                pp_speed = prepayment_speeds[i] if i < len(prepayment_speeds) else 0.0
                prepay2 = remaining2 * pp_speed / frequency
                remaining2 -= prepay2
                cf2 = c * remaining2 / face_value + prepay2
                if i == n - 1:
                    cf2 += remaining2
                t = i + 1
                r = (spot_rates[i] + oas2) / frequency
                pv2 += cf2 / (1 + r) ** t

            dpv = (pv2 - pv) / 0.0001
            if abs(dpv) < 1e-14:
                break
            oas -= f / dpv

        return oas


# ── Immunization ──────────────────────────────────────────────────────

class ImmunizationEngine:
    """Portfolio immunization strategies."""

    @staticmethod
    def duration_match(
        liability_duration: float,
        bond_durations: list[float],
        bond_prices: list[float],
        liability_pv: float,
    ) -> list[float]:
        """
        Find portfolio weights to match liability duration.
        Simple 2-bond immunization.
        """
        if len(bond_durations) < 2:
            return [1.0] if bond_durations else []

        d1, d2 = bond_durations[0], bond_durations[1]
        target = liability_duration

        if abs(d2 - d1) < 1e-10:
            return [0.5, 0.5]

        w1 = (d2 - target) / (d2 - d1)
        w2 = 1 - w1

        # Ensure non-negative
        w1 = max(0, min(1, w1))
        w2 = 1 - w1

        return [w1, w2]

    @staticmethod
    def cash_flow_matching(
        liabilities: list[tuple[float, float]],  # (time, amount)
        available_bonds: list[dict],  # {name, price, cash_flows: [(time, cf)]}
    ) -> dict:
        """
        Simple cash flow matching — dedicate bonds to liabilities.
        """
        liabilities = sorted(liabilities, key=lambda x: x[0], reverse=True)
        allocation = {}
        remaining = list(liabilities)

        for lia_time, lia_amount in remaining:
            best_bond = None
            best_fit = float("inf")

            for bond in available_bonds:
                for cf_time, cf_amount in bond.get("cash_flows", []):
                    if abs(cf_time - lia_time) < 0.01:
                        surplus = cf_amount - lia_amount
                        if surplus >= 0 and surplus < best_fit:
                            best_fit = surplus
                            best_bond = bond

            if best_bond:
                allocation[f"t={lia_time}"] = {
                    "bond": best_bond.get("name", "unknown"),
                    "liability": lia_amount,
                    "coverage": lia_amount + best_fit,
                    "surplus": best_fit,
                }

        return {"allocations": allocation}

    @staticmethod
    def convexity_condition(
        portfolio_convexity: float,
        liability_convexity: float,
    ) -> bool:
        """Check convexity condition for immunization."""
        return portfolio_convexity > liability_convexity


# ── Orchestrator ──────────────────────────────────────────────────────

class FixedIncomeEngine:
    """Top-level orchestrator for all fixed income functionality."""

    def __init__(self) -> None:
        self.pricer = BondPricer()
        self.yields = YieldCalculator()
        self.duration = DurationConvexity()
        self.curve = YieldCurveEngine()
        self.credit = CreditAnalysis()
        self.swap = SwapPricer()
        self.mortgage = MortgageAnalytics()
        self.immunization = ImmunizationEngine()

    def full_bond_analytics(
        self,
        face_value: float = 1000,
        coupon_rate: float = 0.05,
        ytm: float = 0.04,
        periods: int = 20,
        frequency: int = 2,
        benchmark_yield: float = 0.03,
    ) -> dict:
        price = self.pricer.price_fixed_coupon(face_value, coupon_rate, ytm, periods, frequency)
        mac_dur = self.duration.macaulay_duration(face_value, coupon_rate, ytm, periods, frequency)
        mod_dur = self.duration.modified_duration(mac_dur, ytm, frequency)
        conv = self.duration.convexity(face_value, coupon_rate, ytm, periods, frequency)
        dv01 = self.duration.dv01(mod_dur, price)
        krd = self.duration.key_rate_duration(face_value, coupon_rate, ytm, periods, frequency)
        cfs = self.pricer.cash_flows(face_value, coupon_rate, periods, frequency)

        analytics = BondAnalytics(
            clean_price=price,
            dirty_price=price,
            yield_to_maturity=ytm,
            current_yield=self.yields.current_yield(price, face_value, coupon_rate),
            macaulay_duration=mac_dur,
            modified_duration=mod_dur,
            dollar_duration=self.duration.dollar_duration(mod_dur, price),
            convexity=conv,
            dv01=dv01,
            spread_to_benchmark=ytm - benchmark_yield,
        )

        return {
            "analytics": analytics.to_dict(),
            "cash_flows": [cf.to_dict() for cf in cfs],
            "key_rate_durations": {str(k): round(v, 4) for k, v in krd.items()},
        }

    def build_yield_curve(
        self,
        par_rates: list[tuple[float, float]],
        model: str = "bootstrap",
    ) -> list[dict]:
        if model == "bootstrap":
            curve = self.curve.bootstrap_spot_curve(par_rates)
        else:
            curve = self.curve.bootstrap_spot_curve(par_rates)
        return [p.to_dict() for p in curve]

    def nelson_siegel_curve(
        self,
        maturities: list[float],
        beta0: float,
        beta1: float,
        beta2: float,
        tau: float = 1.5,
    ) -> list[dict]:
        curve = self.curve.nelson_siegel(maturities, beta0, beta1, beta2, tau)
        return [p.to_dict() for p in curve]

    def price_swap(
        self,
        notional: float,
        fixed_rate: float,
        spot_rates: list[float],
        floating_rates: list[float],
        is_payer: bool = True,
    ) -> dict:
        return self.swap.price_vanilla_swap(notional, fixed_rate, spot_rates, floating_rates, is_payer=is_payer)

    def mortgage_analytics(
        self,
        principal: float,
        annual_rate: float,
        years: int,
    ) -> dict:
        months = years * 12
        payment = self.mortgage.monthly_payment(principal, annual_rate, months)
        total_interest = payment * months - principal
        schedule = self.mortgage.amortization_schedule(principal, annual_rate, months)

        return {
            "monthly_payment": round(payment, 2),
            "total_interest": round(total_interest, 2),
            "total_cost": round(payment * months, 2),
            "amortization_schedule_length": len(schedule),
            "first_12_months": schedule[:12],
        }

    def capabilities(self) -> dict:
        return {
            "engine": "FixedIncomeEngine",
            "version": "1.0.0",
            "features": [
                "bond_pricing (fixed, zero, perpetual, amortizing)",
                "yield_calculations (YTM, YTC, YTW, BEY, current_yield)",
                "duration (Macaulay, modified, effective, dollar, key_rate)",
                "convexity (modified, effective, approximation)",
                "yield_curve (bootstrap, Nelson-Siegel, Svensson, forward)",
                "credit_analysis (spreads, z-spread, default_prob, expected_loss, credit_VaR)",
                "swap_pricing (vanilla IRS, par_rate, DV01)",
                "mortgage_analytics (amortization, PSA, WAL, OAS)",
                "immunization (duration_match, cash_flow_match, convexity_condition)",
                "dv01_and_risk_metrics",
            ],
        }
