"""
Credit Risk Engine — Pure-Python credit analysis and risk scoring.
Credit scoring models, probability of default, loss-given-default, expected loss,
bond spread analysis, transition matrices, Altman Z-score, Merton model (simplified),
credit VaR, and portfolio credit risk metrics.
No numpy/scipy dependency.
"""
from __future__ import annotations

import math
import random
import statistics
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, List, Dict, Tuple


# ═══════════════════════════════════════════════════════════════════════
# Enums
# ═══════════════════════════════════════════════════════════════════════

class CreditRating(str, Enum):
    AAA = "AAA"
    AA = "AA"
    A = "A"
    BBB = "BBB"
    BB = "BB"
    B = "B"
    CCC = "CCC"
    CC = "CC"
    C = "C"
    D = "D"          # Default


class CreditOutlook(str, Enum):
    POSITIVE = "positive"
    STABLE = "stable"
    NEGATIVE = "negative"
    WATCH_POSITIVE = "watch_positive"
    WATCH_NEGATIVE = "watch_negative"


class IndustryRisk(str, Enum):
    LOW = "low"
    BELOW_AVERAGE = "below_average"
    AVERAGE = "average"
    ABOVE_AVERAGE = "above_average"
    HIGH = "high"


# ═══════════════════════════════════════════════════════════════════════
# Data Classes
# ═══════════════════════════════════════════════════════════════════════

@dataclass
class CompanyFinancials:
    total_assets: float
    total_liabilities: float
    current_assets: float
    current_liabilities: float
    ebit: float
    revenue: float
    retained_earnings: float
    market_cap: float
    working_capital: float = 0.0
    interest_expense: float = 0.0
    net_income: float = 0.0
    total_debt: float = 0.0

    def __post_init__(self):
        if self.working_capital == 0:
            self.working_capital = self.current_assets - self.current_liabilities
        if self.total_debt == 0:
            self.total_debt = self.total_liabilities

    @property
    def equity(self) -> float:
        return self.total_assets - self.total_liabilities

    @property
    def debt_to_equity(self) -> float:
        eq = self.equity
        return self.total_debt / eq if eq > 0 else float('inf')

    @property
    def current_ratio(self) -> float:
        return self.current_assets / self.current_liabilities if self.current_liabilities > 0 else 0.0

    @property
    def interest_coverage(self) -> float:
        return self.ebit / self.interest_expense if self.interest_expense > 0 else float('inf')

    @property
    def leverage(self) -> float:
        return self.total_debt / self.total_assets if self.total_assets > 0 else 0.0

    @property
    def roa(self) -> float:
        return self.net_income / self.total_assets if self.total_assets > 0 else 0.0

    @property
    def profit_margin(self) -> float:
        return self.net_income / self.revenue if self.revenue > 0 else 0.0


@dataclass
class BondInfo:
    face_value: float
    coupon_rate: float      # annual
    maturity_years: float
    yield_to_maturity: float
    rating: CreditRating = CreditRating.BBB
    recovery_rate: float = 0.40

    @property
    def annual_coupon(self) -> float:
        return self.face_value * self.coupon_rate

    @property
    def credit_spread(self) -> float:
        """Spread over a risk-free benchmark (assumes rf = 0.04)."""
        return max(self.yield_to_maturity - 0.04, 0)


@dataclass
class CreditExposure:
    counterparty: str
    exposure_at_default: float      # EAD
    probability_of_default: float   # PD
    loss_given_default: float       # LGD (fraction)
    maturity: float = 1.0
    rating: CreditRating = CreditRating.BBB

    @property
    def expected_loss(self) -> float:
        return self.exposure_at_default * self.probability_of_default * self.loss_given_default

    @property
    def unexpected_loss(self) -> float:
        """Simple UL approximation."""
        pd = self.probability_of_default
        lgd = self.loss_given_default
        ead = self.exposure_at_default
        return ead * lgd * math.sqrt(pd * (1 - pd))


# ═══════════════════════════════════════════════════════════════════════
# Altman Z-Score
# ═══════════════════════════════════════════════════════════════════════

class AltmanZScore:
    """Altman Z-Score model for bankruptcy prediction."""

    @staticmethod
    def calculate(fin: CompanyFinancials) -> dict:
        ta = fin.total_assets
        if ta == 0:
            return {"z_score": 0.0, "zone": "distress", "components": {}}

        x1 = fin.working_capital / ta
        x2 = fin.retained_earnings / ta
        x3 = fin.ebit / ta
        x4 = fin.market_cap / fin.total_liabilities if fin.total_liabilities > 0 else 0
        x5 = fin.revenue / ta

        z = 1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4 + 1.0 * x5

        if z > 2.99:
            zone = "safe"
        elif z > 1.81:
            zone = "grey"
        else:
            zone = "distress"

        return {
            "z_score": round(z, 4),
            "zone": zone,
            "components": {
                "working_capital_ta": round(x1, 4),
                "retained_earnings_ta": round(x2, 4),
                "ebit_ta": round(x3, 4),
                "market_cap_tl": round(x4, 4),
                "revenue_ta": round(x5, 4),
            },
        }

    @staticmethod
    def classify_rating(z_score: float) -> CreditRating:
        if z_score > 3.5:
            return CreditRating.AA
        if z_score > 2.99:
            return CreditRating.A
        if z_score > 2.5:
            return CreditRating.BBB
        if z_score > 2.0:
            return CreditRating.BB
        if z_score > 1.81:
            return CreditRating.B
        if z_score > 1.0:
            return CreditRating.CCC
        return CreditRating.CC


# ═══════════════════════════════════════════════════════════════════════
# Default Probability Models
# ═══════════════════════════════════════════════════════════════════════

class DefaultProbabilityModel:
    """Estimate probability of default from various methods."""

    # Historical 1-year default rates by rating
    HISTORICAL_PD = {
        CreditRating.AAA: 0.0001,
        CreditRating.AA: 0.0003,
        CreditRating.A: 0.001,
        CreditRating.BBB: 0.002,
        CreditRating.BB: 0.01,
        CreditRating.B: 0.04,
        CreditRating.CCC: 0.15,
        CreditRating.CC: 0.30,
        CreditRating.C: 0.50,
        CreditRating.D: 1.0,
    }

    @staticmethod
    def from_rating(rating: CreditRating, horizon_years: float = 1.0) -> float:
        """Annual PD from credit rating, adjusted for horizon."""
        annual_pd = DefaultProbabilityModel.HISTORICAL_PD.get(rating, 0.05)
        cumulative_pd = 1 - (1 - annual_pd) ** horizon_years
        return round(min(cumulative_pd, 1.0), 6)

    @staticmethod
    def from_spread(credit_spread: float, lgd: float = 0.60) -> float:
        """Implied PD from credit spread: PD ≈ spread / LGD."""
        if lgd <= 0:
            return 0.0
        pd = credit_spread / lgd
        return round(min(max(pd, 0), 1.0), 6)

    @staticmethod
    def merton_model(
        asset_value: float,
        debt_face: float,
        asset_vol: float,
        risk_free: float = 0.04,
        maturity: float = 1.0,
    ) -> dict:
        """Simplified Merton structural model."""
        if asset_value <= 0 or debt_face <= 0 or asset_vol <= 0:
            return {"dd": 0, "pd": 1.0, "equity_value": 0}

        # Distance to default
        d1 = (math.log(asset_value / debt_face) + (risk_free + 0.5 * asset_vol**2) * maturity) / \
             (asset_vol * math.sqrt(maturity))
        d2 = d1 - asset_vol * math.sqrt(maturity)

        # Approximate normal CDF using logistic approximation
        pd = 1 / (1 + math.exp(1.7 * d2))

        # Equity = call option on assets
        nd1 = 1 / (1 + math.exp(-1.7 * d1))
        nd2 = 1 - pd
        equity = asset_value * nd1 - debt_face * math.exp(-risk_free * maturity) * nd2

        return {
            "distance_to_default": round(d2, 4),
            "pd": round(pd, 6),
            "equity_value": round(max(equity, 0), 2),
            "d1": round(d1, 4),
            "d2": round(d2, 4),
        }


# ═══════════════════════════════════════════════════════════════════════
# Loss-Given-Default Estimator
# ═══════════════════════════════════════════════════════════════════════

class LGDEstimator:
    """Estimate loss-given-default."""

    # Recovery rates by seniority
    RECOVERY_BY_SENIORITY = {
        "senior_secured": 0.65,
        "senior_unsecured": 0.45,
        "subordinated": 0.30,
        "junior_subordinated": 0.20,
        "equity": 0.05,
    }

    @staticmethod
    def from_seniority(seniority: str) -> float:
        recovery = LGDEstimator.RECOVERY_BY_SENIORITY.get(seniority, 0.40)
        return round(1 - recovery, 4)

    @staticmethod
    def from_collateral(
        exposure: float,
        collateral_value: float,
        haircut: float = 0.20,
    ) -> float:
        """LGD with collateral."""
        effective_collateral = collateral_value * (1 - haircut)
        if exposure <= 0:
            return 0.0
        lgd = max(0, exposure - effective_collateral) / exposure
        return round(lgd, 4)

    @staticmethod
    def economic_cycle_adjustment(base_lgd: float, in_recession: bool = False) -> float:
        """Downturn LGD is typically higher."""
        if in_recession:
            return round(min(base_lgd * 1.25, 1.0), 4)
        return base_lgd


# ═══════════════════════════════════════════════════════════════════════
# Expected Loss Calculator
# ═══════════════════════════════════════════════════════════════════════

class ExpectedLossCalculator:
    """EL = EAD × PD × LGD."""

    @staticmethod
    def calculate(ead: float, pd: float, lgd: float) -> dict:
        el = ead * pd * lgd
        return {
            "expected_loss": round(el, 2),
            "ead": round(ead, 2),
            "pd": round(pd, 6),
            "lgd": round(lgd, 4),
            "expected_loss_pct": round(el / ead * 100, 4) if ead > 0 else 0,
        }

    @staticmethod
    def portfolio_expected_loss(exposures: list[CreditExposure]) -> dict:
        total_ead = sum(e.exposure_at_default for e in exposures)
        total_el = sum(e.expected_loss for e in exposures)
        total_ul = math.sqrt(sum(e.unexpected_loss**2 for e in exposures))  # assumes independence

        return {
            "total_ead": round(total_ead, 2),
            "total_expected_loss": round(total_el, 2),
            "total_unexpected_loss": round(total_ul, 2),
            "avg_pd": round(statistics.mean([e.probability_of_default for e in exposures]), 6) if exposures else 0,
            "avg_lgd": round(statistics.mean([e.loss_given_default for e in exposures]), 4) if exposures else 0,
            "n_exposures": len(exposures),
            "el_as_pct_ead": round(total_el / total_ead * 100, 4) if total_ead > 0 else 0,
        }


# ═══════════════════════════════════════════════════════════════════════
# Credit Spread Analysis
# ═══════════════════════════════════════════════════════════════════════

class CreditSpreadAnalyzer:
    """Analyze credit spreads and term structure."""

    # Typical spreads in bps by rating
    TYPICAL_SPREADS_BPS = {
        CreditRating.AAA: 20,
        CreditRating.AA: 40,
        CreditRating.A: 70,
        CreditRating.BBB: 120,
        CreditRating.BB: 250,
        CreditRating.B: 450,
        CreditRating.CCC: 800,
        CreditRating.CC: 1500,
    }

    @staticmethod
    def z_spread(
        bond_price: float,
        face_value: float,
        coupon_rate: float,
        maturity_years: int,
        risk_free_curve: list[float],
    ) -> float:
        """Find Z-spread that equates discounted CFs to bond price."""
        if bond_price <= 0 or maturity_years <= 0:
            return 0.0

        annual_coupon = face_value * coupon_rate
        # Binary search for z-spread
        low, high = -0.05, 0.50

        for _ in range(100):
            mid = (low + high) / 2
            pv = 0.0
            for t in range(1, maturity_years + 1):
                rf_t = risk_free_curve[min(t - 1, len(risk_free_curve) - 1)] if risk_free_curve else 0.04
                discount = 1 / (1 + rf_t + mid) ** t
                cf = annual_coupon if t < maturity_years else annual_coupon + face_value
                pv += cf * discount

            if abs(pv - bond_price) < 0.01:
                return round(mid, 6)

            if pv > bond_price:
                low = mid
            else:
                high = mid

        return round((low + high) / 2, 6)

    @staticmethod
    def spread_relative_value(
        actual_spread_bps: float,
        rating: CreditRating,
    ) -> dict:
        """Is the spread rich or cheap vs. typical for its rating?"""
        typical = CreditSpreadAnalyzer.TYPICAL_SPREADS_BPS.get(rating, 100)
        diff = actual_spread_bps - typical
        relative = diff / typical if typical > 0 else 0

        if relative < -0.20:
            assessment = "very_rich"
        elif relative < -0.05:
            assessment = "rich"
        elif relative < 0.05:
            assessment = "fair"
        elif relative < 0.20:
            assessment = "cheap"
        else:
            assessment = "very_cheap"

        return {
            "actual_spread_bps": round(actual_spread_bps, 1),
            "typical_spread_bps": typical,
            "difference_bps": round(diff, 1),
            "relative_value": round(relative, 4),
            "assessment": assessment,
        }


# ═══════════════════════════════════════════════════════════════════════
# Rating Transition Matrix
# ═══════════════════════════════════════════════════════════════════════

class RatingTransitionMatrix:
    """Credit rating transition probabilities."""

    # Simplified 1-year transition matrix (rows = from, cols = to)
    # Probabilities that a BBB company transitions to each rating in 1 year
    TRANSITIONS = {
        CreditRating.AAA: {
            CreditRating.AAA: 0.91, CreditRating.AA: 0.07, CreditRating.A: 0.01,
            CreditRating.BBB: 0.005, CreditRating.BB: 0.003, CreditRating.B: 0.001,
            CreditRating.CCC: 0.001, CreditRating.D: 0.0,
        },
        CreditRating.AA: {
            CreditRating.AAA: 0.01, CreditRating.AA: 0.90, CreditRating.A: 0.07,
            CreditRating.BBB: 0.01, CreditRating.BB: 0.005, CreditRating.B: 0.003,
            CreditRating.CCC: 0.001, CreditRating.D: 0.001,
        },
        CreditRating.A: {
            CreditRating.AAA: 0.001, CreditRating.AA: 0.02, CreditRating.A: 0.91,
            CreditRating.BBB: 0.05, CreditRating.BB: 0.01, CreditRating.B: 0.005,
            CreditRating.CCC: 0.002, CreditRating.D: 0.002,
        },
        CreditRating.BBB: {
            CreditRating.AAA: 0.0, CreditRating.AA: 0.005, CreditRating.A: 0.04,
            CreditRating.BBB: 0.88, CreditRating.BB: 0.05, CreditRating.B: 0.015,
            CreditRating.CCC: 0.005, CreditRating.D: 0.005,
        },
        CreditRating.BB: {
            CreditRating.AAA: 0.0, CreditRating.AA: 0.001, CreditRating.A: 0.01,
            CreditRating.BBB: 0.05, CreditRating.BB: 0.83, CreditRating.B: 0.08,
            CreditRating.CCC: 0.02, CreditRating.D: 0.009,
        },
        CreditRating.B: {
            CreditRating.AAA: 0.0, CreditRating.AA: 0.0, CreditRating.A: 0.005,
            CreditRating.BBB: 0.01, CreditRating.BB: 0.05, CreditRating.B: 0.82,
            CreditRating.CCC: 0.07, CreditRating.D: 0.045,
        },
        CreditRating.CCC: {
            CreditRating.AAA: 0.0, CreditRating.AA: 0.0, CreditRating.A: 0.0,
            CreditRating.BBB: 0.005, CreditRating.BB: 0.02, CreditRating.B: 0.10,
            CreditRating.CCC: 0.65, CreditRating.D: 0.225,
        },
    }

    @staticmethod
    def get_transition(from_rating: CreditRating) -> dict[CreditRating, float]:
        return RatingTransitionMatrix.TRANSITIONS.get(from_rating, {})

    @staticmethod
    def downgrade_probability(from_rating: CreditRating) -> float:
        """Probability of being downgraded within 1 year."""
        transitions = RatingTransitionMatrix.get_transition(from_rating)
        ratings_order = [CreditRating.AAA, CreditRating.AA, CreditRating.A,
                         CreditRating.BBB, CreditRating.BB, CreditRating.B,
                         CreditRating.CCC, CreditRating.CC, CreditRating.C, CreditRating.D]
        from_idx = ratings_order.index(from_rating) if from_rating in ratings_order else 0
        prob = sum(transitions.get(r, 0) for r in ratings_order[from_idx + 1:])
        return round(prob, 4)

    @staticmethod
    def upgrade_probability(from_rating: CreditRating) -> float:
        """Probability of being upgraded within 1 year."""
        transitions = RatingTransitionMatrix.get_transition(from_rating)
        ratings_order = [CreditRating.AAA, CreditRating.AA, CreditRating.A,
                         CreditRating.BBB, CreditRating.BB, CreditRating.B,
                         CreditRating.CCC, CreditRating.CC, CreditRating.C, CreditRating.D]
        from_idx = ratings_order.index(from_rating) if from_rating in ratings_order else 0
        prob = sum(transitions.get(r, 0) for r in ratings_order[:from_idx])
        return round(prob, 4)

    @staticmethod
    def simulate_path(
        start_rating: CreditRating,
        n_years: int = 5,
        seed: int = 42,
    ) -> list[str]:
        """Simulate rating path over n years."""
        rng = random.Random(seed)
        path = [start_rating.value]
        current = start_rating

        ratings_order = [CreditRating.AAA, CreditRating.AA, CreditRating.A,
                         CreditRating.BBB, CreditRating.BB, CreditRating.B,
                         CreditRating.CCC, CreditRating.D]

        for _ in range(n_years):
            trans = RatingTransitionMatrix.get_transition(current)
            if not trans:
                path.append(current.value)
                continue

            r = rng.random()
            cumulative = 0.0
            new_rating = current
            for rating in ratings_order:
                cumulative += trans.get(rating, 0)
                if r < cumulative:
                    new_rating = rating
                    break

            current = new_rating
            path.append(current.value)

        return path


# ═══════════════════════════════════════════════════════════════════════
# Credit Score Model
# ═══════════════════════════════════════════════════════════════════════

class CreditScoreModel:
    """Multi-factor credit score (0-100)."""

    @staticmethod
    def calculate(fin: CompanyFinancials, industry_risk: IndustryRisk = IndustryRisk.AVERAGE) -> dict:
        score = 0.0

        # Factor 1: Leverage (25 points)
        leverage = fin.leverage
        if leverage < 0.3:
            score += 25
        elif leverage < 0.5:
            score += 20
        elif leverage < 0.7:
            score += 12
        elif leverage < 0.9:
            score += 5
        else:
            score += 0

        # Factor 2: Interest coverage (20 points)
        ic = fin.interest_coverage
        if ic == float('inf') or ic > 10:
            score += 20
        elif ic > 5:
            score += 16
        elif ic > 3:
            score += 10
        elif ic > 1.5:
            score += 5
        else:
            score += 0

        # Factor 3: Profitability (20 points)
        pm = fin.profit_margin
        if pm > 0.20:
            score += 20
        elif pm > 0.10:
            score += 16
        elif pm > 0.05:
            score += 10
        elif pm > 0:
            score += 5
        else:
            score += 0

        # Factor 4: Liquidity (15 points)
        cr = fin.current_ratio
        if cr > 2.0:
            score += 15
        elif cr > 1.5:
            score += 12
        elif cr > 1.0:
            score += 8
        elif cr > 0.5:
            score += 3
        else:
            score += 0

        # Factor 5: Size/scale proxy (10 points)
        if fin.total_assets > 50e9:
            score += 10
        elif fin.total_assets > 10e9:
            score += 8
        elif fin.total_assets > 1e9:
            score += 5
        elif fin.total_assets > 100e6:
            score += 2
        else:
            score += 0

        # Factor 6: Industry risk (10 points)
        industry_scores = {
            IndustryRisk.LOW: 10,
            IndustryRisk.BELOW_AVERAGE: 8,
            IndustryRisk.AVERAGE: 6,
            IndustryRisk.ABOVE_AVERAGE: 3,
            IndustryRisk.HIGH: 0,
        }
        score += industry_scores.get(industry_risk, 5)

        # Map to rating
        if score >= 85:
            rating = CreditRating.AAA
        elif score >= 75:
            rating = CreditRating.AA
        elif score >= 65:
            rating = CreditRating.A
        elif score >= 55:
            rating = CreditRating.BBB
        elif score >= 45:
            rating = CreditRating.BB
        elif score >= 35:
            rating = CreditRating.B
        elif score >= 20:
            rating = CreditRating.CCC
        else:
            rating = CreditRating.CC

        return {
            "score": round(score, 1),
            "rating": rating.value,
            "factors": {
                "leverage": round(leverage, 4),
                "interest_coverage": round(min(ic, 999), 2),
                "profit_margin": round(pm, 4),
                "current_ratio": round(cr, 4),
                "total_assets": round(fin.total_assets, 0),
                "industry_risk": industry_risk.value,
            },
        }


# ═══════════════════════════════════════════════════════════════════════
# Bond Valuation
# ═══════════════════════════════════════════════════════════════════════

class BondValuation:
    """Bond pricing and analytics."""

    @staticmethod
    def price(
        face_value: float,
        coupon_rate: float,
        ytm: float,
        maturity_years: int,
        frequency: int = 2,
    ) -> float:
        """Bond price from yield."""
        periods = maturity_years * frequency
        periodic_coupon = face_value * coupon_rate / frequency
        periodic_yield = ytm / frequency

        if periodic_yield == 0:
            return periodic_coupon * periods + face_value

        pv_coupons = periodic_coupon * (1 - (1 + periodic_yield)**(-periods)) / periodic_yield
        pv_face = face_value / (1 + periodic_yield)**periods
        return round(pv_coupons + pv_face, 4)

    @staticmethod
    def duration(
        face_value: float,
        coupon_rate: float,
        ytm: float,
        maturity_years: int,
        frequency: int = 2,
    ) -> dict:
        """Macaulay and modified duration."""
        periods = maturity_years * frequency
        periodic_coupon = face_value * coupon_rate / frequency
        periodic_yield = ytm / frequency

        if periodic_yield == 0:
            mac_dur = maturity_years
            mod_dur = maturity_years
            bond_price = BondValuation.price(face_value, coupon_rate, ytm, maturity_years, frequency)
            return {
                "macaulay_duration": round(mac_dur, 4),
                "modified_duration": round(mod_dur, 4),
                "price": round(bond_price, 4),
            }

        weighted_cf = 0.0
        total_pv = 0.0

        for t in range(1, periods + 1):
            cf = periodic_coupon if t < periods else periodic_coupon + face_value
            disc = (1 + periodic_yield)**(-t)
            pv = cf * disc
            weighted_cf += (t / frequency) * pv
            total_pv += pv

        mac_dur = weighted_cf / total_pv if total_pv > 0 else 0
        mod_dur = mac_dur / (1 + periodic_yield)

        return {
            "macaulay_duration": round(mac_dur, 4),
            "modified_duration": round(mod_dur, 4),
            "price": round(total_pv, 4),
        }

    @staticmethod
    def convexity(
        face_value: float,
        coupon_rate: float,
        ytm: float,
        maturity_years: int,
        frequency: int = 2,
    ) -> float:
        """Bond convexity."""
        periods = maturity_years * frequency
        periodic_coupon = face_value * coupon_rate / frequency
        periodic_yield = ytm / frequency

        conv = 0.0
        total_pv = 0.0

        for t in range(1, periods + 1):
            cf = periodic_coupon if t < periods else periodic_coupon + face_value
            disc = (1 + periodic_yield)**(-(t + 2))
            conv += cf * t * (t + 1) * disc
            total_pv += cf / (1 + periodic_yield)**t

        if total_pv == 0:
            return 0.0

        return round(conv / (total_pv * frequency**2), 4)


# ═══════════════════════════════════════════════════════════════════════
# Portfolio Credit Risk
# ═══════════════════════════════════════════════════════════════════════

class PortfolioCreditRisk:
    """Portfolio-level credit risk metrics."""

    @staticmethod
    def concentration_by_rating(exposures: list[CreditExposure]) -> dict:
        total_ead = sum(e.exposure_at_default for e in exposures)
        if total_ead == 0:
            return {}
        result = {}
        for e in exposures:
            rating = e.rating.value
            result[rating] = round(result.get(rating, 0) + e.exposure_at_default / total_ead, 4)
        return result

    @staticmethod
    def largest_exposures(exposures: list[CreditExposure], top_n: int = 5) -> list[dict]:
        sorted_exp = sorted(exposures, key=lambda e: e.exposure_at_default, reverse=True)
        return [
            {
                "counterparty": e.counterparty,
                "ead": round(e.exposure_at_default, 2),
                "pd": round(e.probability_of_default, 6),
                "el": round(e.expected_loss, 2),
            }
            for e in sorted_exp[:top_n]
        ]

    @staticmethod
    def credit_var(
        exposures: list[CreditExposure],
        confidence: float = 0.99,
        n_simulations: int = 10000,
        seed: int = 42,
    ) -> dict:
        """Monte Carlo credit VaR."""
        rng = random.Random(seed)
        n = len(exposures)
        losses = []

        for _ in range(n_simulations):
            total_loss = 0.0
            for e in exposures:
                if rng.random() < e.probability_of_default:
                    total_loss += e.exposure_at_default * e.loss_given_default
            losses.append(total_loss)

        losses.sort()
        var_idx = int(confidence * len(losses))
        var_idx = min(var_idx, len(losses) - 1)
        var = losses[var_idx]

        el = statistics.mean(losses)
        cvar_tail = losses[var_idx:]
        cvar = statistics.mean(cvar_tail) if cvar_tail else var

        return {
            "credit_var": round(var, 2),
            "expected_loss": round(el, 2),
            "credit_cvar": round(cvar, 2),
            "confidence": confidence,
            "n_simulations": n_simulations,
        }


# ═══════════════════════════════════════════════════════════════════════
# Orchestrator
# ═══════════════════════════════════════════════════════════════════════

class CreditRiskEngine:
    """Top-level credit risk engine."""

    def __init__(self):
        self.altman = AltmanZScore()
        self.pd_model = DefaultProbabilityModel()
        self.lgd = LGDEstimator()
        self.el_calc = ExpectedLossCalculator()
        self.spread_analyzer = CreditSpreadAnalyzer()
        self.transition = RatingTransitionMatrix()
        self.score_model = CreditScoreModel()
        self.bond_val = BondValuation()
        self.portfolio_risk = PortfolioCreditRisk()

    def company_credit_analysis(
        self,
        fin: CompanyFinancials,
        industry_risk: IndustryRisk = IndustryRisk.AVERAGE,
    ) -> dict:
        z = self.altman.calculate(fin)
        score = self.score_model.calculate(fin, industry_risk)
        rating = CreditRating(score["rating"])
        pd = self.pd_model.from_rating(rating)

        return {
            "altman_z": z,
            "credit_score": score,
            "implied_pd": pd,
            "downgrade_prob": self.transition.downgrade_probability(rating),
        }

    def bond_analysis(self, bond: BondInfo) -> dict:
        price = self.bond_val.price(bond.face_value, bond.coupon_rate, bond.yield_to_maturity, int(bond.maturity_years))
        dur = self.bond_val.duration(bond.face_value, bond.coupon_rate, bond.yield_to_maturity, int(bond.maturity_years))
        conv = self.bond_val.convexity(bond.face_value, bond.coupon_rate, bond.yield_to_maturity, int(bond.maturity_years))
        rv = self.spread_analyzer.spread_relative_value(bond.credit_spread * 10000, bond.rating)

        return {
            "price": price,
            "duration": dur,
            "convexity": conv,
            "relative_value": rv,
        }

    def portfolio_analysis(self, exposures: list[CreditExposure]) -> dict:
        el = self.el_calc.portfolio_expected_loss(exposures)
        concentration = self.portfolio_risk.concentration_by_rating(exposures)
        largest = self.portfolio_risk.largest_exposures(exposures)
        var = self.portfolio_risk.credit_var(exposures)

        return {
            "expected_loss": el,
            "concentration": concentration,
            "largest_exposures": largest,
            "credit_var": var,
        }

    def capabilities(self) -> dict:
        return {
            "engine": "CreditRiskEngine",
            "version": "1.0.0",
            "features": [
                "altman_z_score",
                "multi_factor_credit_score",
                "rating_based_pd",
                "spread_implied_pd",
                "merton_structural_model",
                "lgd_by_seniority",
                "collateral_lgd",
                "expected_unexpected_loss",
                "portfolio_credit_risk",
                "z_spread_calculation",
                "spread_relative_value",
                "rating_transition_matrix",
                "rating_path_simulation",
                "bond_pricing_duration_convexity",
                "monte_carlo_credit_var",
                "concentration_analysis",
            ],
        }
