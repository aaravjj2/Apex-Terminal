"""
Event-Driven Engine — Pure-Python event-driven strategy analysis.
Earnings plays, M&A arbitrage, spin-offs, special dividends, index rebalancing,
corporate actions, catalyst calendars, event windows, and abnormal return detection.
No numpy/scipy dependency.
"""
from __future__ import annotations

import math
import random
import statistics
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, List, Dict, Tuple
from datetime import datetime, timedelta


# ═══════════════════════════════════════════════════════════════════════
# Enums
# ═══════════════════════════════════════════════════════════════════════

class EventType(str, Enum):
    EARNINGS = "earnings"
    MERGER_ANNOUNCEMENT = "merger_announcement"
    MERGER_CLOSE = "merger_close"
    SPINOFF = "spinoff"
    SPECIAL_DIVIDEND = "special_dividend"
    INDEX_ADD = "index_add"
    INDEX_REMOVE = "index_remove"
    SHARE_BUYBACK = "share_buyback"
    SECONDARY_OFFERING = "secondary_offering"
    ACTIVIST_STAKE = "activist_stake"
    FDA_DECISION = "fda_decision"
    PRODUCT_LAUNCH = "product_launch"
    LEGAL_RULING = "legal_ruling"
    MANAGEMENT_CHANGE = "management_change"
    DIVIDEND_CUT = "dividend_cut"
    DIVIDEND_RAISE = "dividend_raise"
    STOCK_SPLIT = "stock_split"
    RIGHTS_OFFERING = "rights_offering"


class EventImpact(str, Enum):
    VERY_POSITIVE = "very_positive"   # +5% or more
    POSITIVE = "positive"             # +1% to +5%
    NEUTRAL = "neutral"               # -1% to +1%
    NEGATIVE = "negative"             # -5% to -1%
    VERY_NEGATIVE = "very_negative"   # -5% or worse


class MergerStatus(str, Enum):
    ANNOUNCED = "announced"
    REGULATORY_REVIEW = "regulatory_review"
    SHAREHOLDER_VOTE = "shareholder_vote"
    CLOSING = "closing"
    COMPLETED = "completed"
    TERMINATED = "terminated"


class EarningsSurprise(str, Enum):
    BEAT = "beat"
    MEET = "meet"
    MISS = "miss"
    HUGE_BEAT = "huge_beat"
    HUGE_MISS = "huge_miss"


# ═══════════════════════════════════════════════════════════════════════
# Data Classes
# ═══════════════════════════════════════════════════════════════════════

@dataclass
class CorporateEvent:
    symbol: str
    event_type: EventType
    event_date: str                    # ISO format
    description: str = ""
    expected_impact: float = 0.0       # expected return
    actual_impact: float = 0.0         # realized return
    confidence: float = 0.5

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "type": self.event_type.value,
            "date": self.event_date,
            "description": self.description,
            "expected_impact": round(self.expected_impact, 4),
            "actual_impact": round(self.actual_impact, 4),
            "confidence": round(self.confidence, 4),
        }


@dataclass
class MergerDeal:
    target: str
    acquirer: str
    offer_price: float
    offer_type: str = "cash"       # "cash", "stock", "mixed"
    exchange_ratio: float = 0.0    # for stock deals
    announced_date: str = ""
    expected_close_date: str = ""
    status: MergerStatus = MergerStatus.ANNOUNCED
    regulatory_risk: float = 0.2   # 0-1 probability of block
    synergy_estimate: float = 0.0  # in millions

    @property
    def days_to_close(self) -> int:
        """Estimate days until close (simplified)."""
        if self.status == MergerStatus.COMPLETED:
            return 0
        if self.status == MergerStatus.TERMINATED:
            return -1
        # Rough estimate
        status_days = {
            MergerStatus.ANNOUNCED: 180,
            MergerStatus.REGULATORY_REVIEW: 120,
            MergerStatus.SHAREHOLDER_VOTE: 60,
            MergerStatus.CLOSING: 30,
        }
        return status_days.get(self.status, 90)


@dataclass
class EventWindowReturn:
    pre_event: list[float] = field(default_factory=list)    # returns before event
    event_day: float = 0.0                                  # event day return
    post_event: list[float] = field(default_factory=list)   # returns after event

    @property
    def cumulative_pre(self) -> float:
        if not self.pre_event:
            return 0.0
        cum = 1.0
        for r in self.pre_event:
            cum *= (1 + r)
        return round(cum - 1, 6)

    @property
    def cumulative_post(self) -> float:
        if not self.post_event:
            return 0.0
        cum = 1.0
        for r in self.post_event:
            cum *= (1 + r)
        return round(cum - 1, 6)

    @property
    def total_return(self) -> float:
        all_returns = self.pre_event + [self.event_day] + self.post_event
        cum = 1.0
        for r in all_returns:
            cum *= (1 + r)
        return round(cum - 1, 6)


# ═══════════════════════════════════════════════════════════════════════
# Earnings Event Analyzer
# ═══════════════════════════════════════════════════════════════════════

class EarningsEventAnalyzer:
    """Analyze earnings events and their impact."""

    @staticmethod
    def classify_surprise(actual_eps: float, consensus_eps: float) -> dict:
        if consensus_eps == 0:
            surprise_pct = 0.0
        else:
            surprise_pct = (actual_eps - consensus_eps) / abs(consensus_eps) * 100

        if surprise_pct > 20:
            category = EarningsSurprise.HUGE_BEAT
        elif surprise_pct > 2:
            category = EarningsSurprise.BEAT
        elif surprise_pct > -2:
            category = EarningsSurprise.MEET
        elif surprise_pct > -20:
            category = EarningsSurprise.MISS
        else:
            category = EarningsSurprise.HUGE_MISS

        return {
            "actual": actual_eps,
            "consensus": consensus_eps,
            "surprise_pct": round(surprise_pct, 2),
            "category": category.value,
        }

    @staticmethod
    def expected_move(implied_vol: float, days_to_earnings: int = 1) -> float:
        """Expected percentage move from options-implied volatility."""
        if days_to_earnings <= 0:
            return 0.0
        daily_vol = implied_vol / math.sqrt(252)
        return round(daily_vol * math.sqrt(days_to_earnings) * 100, 2)

    @staticmethod
    def post_earnings_drift(
        surprise_pct: float,
        pre_event_returns: list[float],
    ) -> dict:
        """Estimate post-earnings announcement drift direction and magnitude."""
        # PEAD: stocks that beat tend to continue up for 60 days
        if surprise_pct > 10:
            drift = 0.03      # ~3% drift
            direction = "up"
        elif surprise_pct > 2:
            drift = 0.01
            direction = "up"
        elif surprise_pct < -10:
            drift = -0.03
            direction = "down"
        elif surprise_pct < -2:
            drift = -0.01
            direction = "down"
        else:
            drift = 0.0
            direction = "flat"

        # Adjust for pre-event drift (if already moved, less PEAD)
        if pre_event_returns:
            pre_drift = sum(pre_event_returns)
            if (direction == "up" and pre_drift > 0.02) or (direction == "down" and pre_drift < -0.02):
                drift *= 0.5  # already priced in

        return {
            "expected_drift": round(drift, 4),
            "direction": direction,
            "confidence": round(0.6 if abs(surprise_pct) > 10 else 0.4, 2),
        }

    @staticmethod
    def earnings_quality_score(
        revenue_surprise_pct: float,
        eps_surprise_pct: float,
        guidance_vs_consensus: float = 0.0,
        revenue_growth: float = 0.0,
    ) -> dict:
        """Score earnings quality 0-100."""
        score = 50.0  # neutral start

        # EPS surprise
        score += min(max(eps_surprise_pct * 2, -25), 25)
        # Revenue surprise (more important)
        score += min(max(revenue_surprise_pct * 3, -15), 15)
        # Guidance
        score += min(max(guidance_vs_consensus * 5, -10), 10)

        score = max(0, min(100, score))

        if score >= 80:
            assessment = "excellent"
        elif score >= 65:
            assessment = "good"
        elif score >= 45:
            assessment = "neutral"
        elif score >= 30:
            assessment = "poor"
        else:
            assessment = "terrible"

        return {
            "score": round(score, 1),
            "assessment": assessment,
        }


# ═══════════════════════════════════════════════════════════════════════
# Merger Arbitrage Analyzer
# ═══════════════════════════════════════════════════════════════════════

class MergerArbAnalyzer:
    """Analyze merger arbitrage opportunities."""

    @staticmethod
    def calculate_spread(
        target_price: float,
        offer_price: float,
        acquirer_price: float = 0.0,
        exchange_ratio: float = 0.0,
    ) -> dict:
        """Merger arb spread calculation."""
        if offer_price > 0:
            # Cash deal
            effective_offer = offer_price
        elif exchange_ratio > 0 and acquirer_price > 0:
            # Stock deal
            effective_offer = exchange_ratio * acquirer_price
        else:
            return {"error": "invalid deal terms"}

        if target_price <= 0:
            return {"error": "invalid target price"}

        spread = effective_offer - target_price
        spread_pct = spread / target_price * 100

        return {
            "target_price": round(target_price, 4),
            "effective_offer": round(effective_offer, 4),
            "spread": round(spread, 4),
            "spread_pct": round(spread_pct, 4),
            "upside_if_close": round(spread_pct, 4),
        }

    @staticmethod
    def annualized_return(
        spread_pct: float,
        days_to_close: int,
    ) -> float:
        """Annualize the merger arb spread."""
        if days_to_close <= 0:
            return 0.0
        return round(spread_pct * 365 / days_to_close, 4)

    @staticmethod
    def risk_adjusted_return(
        spread_pct: float,
        days_to_close: int,
        completion_probability: float = 0.85,
        downside_if_fail: float = -20.0,
    ) -> dict:
        """Expected return considering deal break risk."""
        ann_return = MergerArbAnalyzer.annualized_return(spread_pct, days_to_close)
        expected = completion_probability * spread_pct + (1 - completion_probability) * downside_if_fail
        ann_expected = MergerArbAnalyzer.annualized_return(expected, days_to_close)

        return {
            "raw_ann_return": round(ann_return, 4),
            "expected_return": round(expected, 4),
            "risk_adjusted_ann": round(ann_expected, 4),
            "completion_prob": round(completion_probability, 4),
            "profitable": expected > 0,
        }

    @staticmethod
    def deal_break_cost(
        target_price: float,
        pre_announcement_price: float,
    ) -> float:
        """If deal fails, estimate how much target reverts."""
        if pre_announcement_price <= 0:
            return 0.0
        loss = (target_price - pre_announcement_price) / target_price * 100
        return round(loss, 4)


# ═══════════════════════════════════════════════════════════════════════
# Index Rebalancing Analyzer
# ═══════════════════════════════════════════════════════════════════════

class IndexRebalancingAnalyzer:
    """Predict and analyze index add/delete impact."""

    # Historical average impact by index
    INDEX_ADD_IMPACT = {
        "SP500": {"pre_add_drift": 0.05, "add_day": 0.02, "post_add_reversal": -0.01},
        "NASDAQ100": {"pre_add_drift": 0.04, "add_day": 0.015, "post_add_reversal": -0.005},
        "RUSSELL2000": {"pre_add_drift": 0.02, "add_day": 0.01, "post_add_reversal": -0.005},
        "DJIA": {"pre_add_drift": 0.03, "add_day": 0.015, "post_add_reversal": -0.01},
    }

    INDEX_REMOVE_IMPACT = {
        "SP500": {"pre_remove_drift": -0.05, "remove_day": -0.025, "post_remove_reversal": 0.015},
        "NASDAQ100": {"pre_remove_drift": -0.04, "remove_day": -0.02, "post_remove_reversal": 0.01},
        "RUSSELL2000": {"pre_remove_drift": -0.02, "remove_day": -0.01, "post_remove_reversal": 0.005},
    }

    @staticmethod
    def expected_impact(
        index_name: str,
        is_addition: bool,
        market_cap: float = 0.0,
    ) -> dict:
        """Estimate price impact from index rebalancing."""
        if is_addition:
            impacts = IndexRebalancingAnalyzer.INDEX_ADD_IMPACT.get(index_name, {})
            pre = impacts.get("pre_add_drift", 0.02)
            event = impacts.get("add_day", 0.01)
            post = impacts.get("post_add_reversal", -0.005)
        else:
            impacts = IndexRebalancingAnalyzer.INDEX_REMOVE_IMPACT.get(index_name, {})
            pre = impacts.get("pre_remove_drift", -0.02)
            event = impacts.get("remove_day", -0.01)
            post = impacts.get("post_remove_reversal", 0.005)

        # Smaller caps have larger impact
        size_multiplier = 1.0
        if 0 < market_cap < 5e9:
            size_multiplier = 1.5
        elif market_cap < 20e9:
            size_multiplier = 1.2

        return {
            "pre_event_drift": round(pre * size_multiplier, 4),
            "event_day_impact": round(event * size_multiplier, 4),
            "post_event_reversal": round(post * size_multiplier, 4),
            "total_expected": round((pre + event + post) * size_multiplier, 4),
            "optimal_entry": "announcement" if is_addition else "post_removal",
        }


# ═══════════════════════════════════════════════════════════════════════
# Abnormal Return Detector
# ═══════════════════════════════════════════════════════════════════════

class AbnormalReturnDetector:
    """Detect abnormal returns around events."""

    @staticmethod
    def calculate_car(
        stock_returns: list[float],
        market_returns: list[float],
        event_index: int,
        pre_window: int = 10,
        post_window: int = 10,
        estimation_window: int = 120,
    ) -> dict:
        """Cumulative Abnormal Return around event."""
        n = min(len(stock_returns), len(market_returns))
        if event_index < estimation_window or event_index + post_window >= n:
            return {"car": 0, "error": "insufficient data"}

        # Estimate normal return model (market model)
        est_start = event_index - estimation_window - pre_window
        est_end = event_index - pre_window

        y = stock_returns[est_start:est_end]
        x = market_returns[est_start:est_end]

        mx = statistics.mean(x)
        my = statistics.mean(y)
        cov = sum((x[i] - mx) * (y[i] - my) for i in range(len(y))) / max(len(y) - 1, 1)
        var_x = sum((xi - mx)**2 for xi in x) / max(len(x) - 1, 1)
        beta = cov / var_x if var_x > 0 else 0
        alpha = my - beta * mx

        # Calculate abnormal returns in event window
        window_start = event_index - pre_window
        window_end = event_index + post_window + 1
        abnormal_returns = []

        for i in range(window_start, min(window_end, n)):
            expected = alpha + beta * market_returns[i]
            ar = stock_returns[i] - expected
            abnormal_returns.append(round(ar, 6))

        car = round(sum(abnormal_returns), 6)

        # Statistical test (t-test)
        if len(abnormal_returns) > 1:
            ar_std = statistics.stdev(abnormal_returns)
            t_stat = car / (ar_std * math.sqrt(len(abnormal_returns))) if ar_std > 0 else 0
        else:
            t_stat = 0.0

        significant = abs(t_stat) > 1.96

        return {
            "car": car,
            "abnormal_returns": abnormal_returns,
            "t_stat": round(t_stat, 4),
            "significant": significant,
            "alpha": round(alpha, 6),
            "beta": round(beta, 4),
            "pre_event_car": round(sum(abnormal_returns[:pre_window]), 6),
            "event_day_ar": abnormal_returns[pre_window] if len(abnormal_returns) > pre_window else 0,
            "post_event_car": round(sum(abnormal_returns[pre_window + 1:]), 6),
        }

    @staticmethod
    def classify_impact(car: float) -> EventImpact:
        if car > 0.05:
            return EventImpact.VERY_POSITIVE
        elif car > 0.01:
            return EventImpact.POSITIVE
        elif car > -0.01:
            return EventImpact.NEUTRAL
        elif car > -0.05:
            return EventImpact.NEGATIVE
        else:
            return EventImpact.VERY_NEGATIVE


# ═══════════════════════════════════════════════════════════════════════
# Special Situations Analyzer
# ═══════════════════════════════════════════════════════════════════════

class SpecialSituationsAnalyzer:
    """Analyze special corporate situations."""

    @staticmethod
    def spinoff_value(
        parent_market_cap: float,
        spinoff_revenue: float,
        parent_revenue: float,
        sector_ev_revenue_multiple: float = 3.0,
    ) -> dict:
        """Estimate spinoff value."""
        if parent_revenue <= 0:
            return {"spinoff_value": 0, "pct_of_parent": 0}

        rev_share = spinoff_revenue / parent_revenue
        implied_value = spinoff_revenue * sector_ev_revenue_multiple
        pct = implied_value / parent_market_cap * 100 if parent_market_cap > 0 else 0

        return {
            "spinoff_value": round(implied_value, 2),
            "revenue_share": round(rev_share, 4),
            "pct_of_parent": round(pct, 2),
            "ev_revenue_multiple": sector_ev_revenue_multiple,
        }

    @staticmethod
    def buyback_impact(
        shares_outstanding: int,
        buyback_amount: float,
        current_price: float,
    ) -> dict:
        """Estimate impact of share buyback."""
        if current_price <= 0 or shares_outstanding <= 0:
            return {"shares_retired": 0, "eps_accretion_pct": 0}

        shares_retired = int(buyback_amount / current_price)
        pct_retired = shares_retired / shares_outstanding * 100
        # EPS accretion ≈ % shares retired
        eps_accretion = pct_retired

        return {
            "shares_retired": shares_retired,
            "pct_retired": round(pct_retired, 2),
            "eps_accretion_pct": round(eps_accretion, 2),
            "new_shares_outstanding": shares_outstanding - shares_retired,
        }

    @staticmethod
    def rights_offering_dilution(
        shares_outstanding: int,
        new_shares: int,
        subscription_price: float,
        market_price: float,
    ) -> dict:
        """Calculate dilution from rights offering."""
        if market_price <= 0 or shares_outstanding <= 0:
            return {"dilution_pct": 0, "terp": 0}

        total_shares = shares_outstanding + new_shares
        dilution = new_shares / total_shares * 100

        # TERP (Theoretical Ex-Rights Price)
        terp = (shares_outstanding * market_price + new_shares * subscription_price) / total_shares
        value_of_right = market_price - terp

        return {
            "dilution_pct": round(dilution, 2),
            "terp": round(terp, 4),
            "value_of_right": round(max(value_of_right, 0), 4),
            "total_shares_after": total_shares,
        }


# ═══════════════════════════════════════════════════════════════════════
# Event Calendar
# ═══════════════════════════════════════════════════════════════════════

class EventCalendar:
    """Manage and filter corporate event calendars."""

    def __init__(self):
        self._events: list[CorporateEvent] = []

    def add_event(self, event: CorporateEvent):
        self._events.append(event)

    def add_events(self, events: list[CorporateEvent]):
        self._events.extend(events)

    def filter_by_type(self, event_type: EventType) -> list[dict]:
        return [e.to_dict() for e in self._events if e.event_type == event_type]

    def filter_by_symbol(self, symbol: str) -> list[dict]:
        return [e.to_dict() for e in self._events if e.symbol == symbol]

    def filter_by_date_range(self, start: str, end: str) -> list[dict]:
        return [e.to_dict() for e in self._events if start <= e.event_date <= end]

    def upcoming(self, n: int = 10) -> list[dict]:
        sorted_events = sorted(self._events, key=lambda e: e.event_date)
        return [e.to_dict() for e in sorted_events[:n]]

    @property
    def count(self) -> int:
        return len(self._events)

    def summary(self) -> dict:
        by_type = {}
        for e in self._events:
            by_type[e.event_type.value] = by_type.get(e.event_type.value, 0) + 1
        return {
            "total_events": len(self._events),
            "by_type": by_type,
        }


# ═══════════════════════════════════════════════════════════════════════
# Event Study Framework
# ═══════════════════════════════════════════════════════════════════════

class EventStudyFramework:
    """Run event studies across multiple events."""

    @staticmethod
    def aggregate_cars(
        events: list[dict],
    ) -> dict:
        """
        events: list of {"car": float, "t_stat": float, ...}
        Aggregate CARs across events for statistical significance.
        """
        if not events:
            return {"avg_car": 0, "t_stat": 0, "n_events": 0}

        cars = [e.get("car", 0) for e in events]
        avg_car = statistics.mean(cars)
        if len(cars) > 1:
            car_std = statistics.stdev(cars)
            t_stat = avg_car / (car_std / math.sqrt(len(cars))) if car_std > 0 else 0
        else:
            t_stat = 0

        positive = sum(1 for c in cars if c > 0)
        return {
            "avg_car": round(avg_car, 6),
            "median_car": round(statistics.median(cars), 6),
            "t_stat": round(t_stat, 4),
            "significant": abs(t_stat) > 1.96,
            "n_events": len(events),
            "pct_positive": round(positive / len(events) * 100, 2),
        }


# ═══════════════════════════════════════════════════════════════════════
# Orchestrator
# ═══════════════════════════════════════════════════════════════════════

class EventDrivenEngine:
    """Top-level event-driven strategy engine."""

    def __init__(self):
        self.earnings = EarningsEventAnalyzer()
        self.merger_arb = MergerArbAnalyzer()
        self.index_rebal = IndexRebalancingAnalyzer()
        self.abnormal = AbnormalReturnDetector()
        self.special = SpecialSituationsAnalyzer()
        self.calendar = EventCalendar()
        self.study = EventStudyFramework()

    def analyze_earnings_event(
        self,
        actual_eps: float,
        consensus_eps: float,
        implied_vol: float = 0.30,
        pre_returns: list[float] = None,
    ) -> dict:
        surprise = self.earnings.classify_surprise(actual_eps, consensus_eps)
        expected_move = self.earnings.expected_move(implied_vol)
        drift = self.earnings.post_earnings_drift(
            surprise["surprise_pct"],
            pre_returns or [],
        )
        return {
            "surprise": surprise,
            "expected_move_pct": expected_move,
            "post_earnings_drift": drift,
        }

    def analyze_merger(
        self,
        target_price: float,
        offer_price: float,
        days_to_close: int = 90,
        completion_prob: float = 0.85,
        pre_announcement_price: float = 0.0,
    ) -> dict:
        spread = self.merger_arb.calculate_spread(target_price, offer_price)
        risk_adj = self.merger_arb.risk_adjusted_return(
            spread.get("spread_pct", 0), days_to_close, completion_prob,
        )
        break_cost = 0.0
        if pre_announcement_price > 0:
            break_cost = self.merger_arb.deal_break_cost(target_price, pre_announcement_price)

        return {
            "spread": spread,
            "risk_adjusted": risk_adj,
            "deal_break_cost_pct": break_cost,
        }

    def capabilities(self) -> dict:
        return {
            "engine": "EventDrivenEngine",
            "version": "1.0.0",
            "event_types": [t.value for t in EventType],
            "features": [
                "earnings_surprise_classification",
                "expected_move_from_iv",
                "post_earnings_drift_estimate",
                "earnings_quality_score",
                "merger_arb_spread",
                "annualized_merger_return",
                "risk_adjusted_merger_eval",
                "deal_break_cost",
                "index_rebalancing_impact",
                "cumulative_abnormal_return",
                "event_impact_classification",
                "spinoff_valuation",
                "buyback_impact",
                "rights_offering_dilution",
                "event_calendar_management",
                "event_study_aggregation",
            ],
        }
