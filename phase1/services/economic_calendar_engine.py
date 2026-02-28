"""
Apex Terminal — Bloomberg-Grade Economic Calendar & Events Engine
=================================================================

Comprehensive economic event tracking and analysis:
- Economic data release tracking (GDP, CPI, NFP, PMI, etc.)
- Earnings calendar with consensus estimates
- Dividend calendar and ex-date tracking
- Central bank meeting schedule and rate decisions
- IPO calendar
- Economic indicator analysis and surprise calculation
- Historical event impact analysis
- Event-driven volatility forecasting
- Seasonal patterns in economic data
- Event clustering and conflict detection
- Countdown timers and notification scheduling
- Forward-looking economic calendar construction

Pure computation module — no FastAPI/DB imports.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta, date
from enum import Enum
from typing import Optional

import numpy as np


# ─── Enums ───────────────────────────────────────────────────────────────────

class EventImportance(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class EventCategory(Enum):
    ECONOMIC = "economic"
    EARNINGS = "earnings"
    DIVIDEND = "dividend"
    CENTRAL_BANK = "central_bank"
    IPO = "ipo"
    SPLIT = "split"
    POLITICAL = "political"
    GEOPOLITICAL = "geopolitical"
    TECHNICAL = "technical"
    FED_SPEAK = "fed_speak"


class EconomicIndicator(Enum):
    GDP = "gdp"
    CPI = "cpi"
    PPI = "ppi"
    NFP = "nfp"
    UNEMPLOYMENT = "unemployment"
    RETAIL_SALES = "retail_sales"
    PMI_MANUFACTURING = "pmi_manufacturing"
    PMI_SERVICES = "pmi_services"
    CONSUMER_CONFIDENCE = "consumer_confidence"
    HOUSING_STARTS = "housing_starts"
    INDUSTRIAL_PRODUCTION = "industrial_production"
    TRADE_BALANCE = "trade_balance"
    DURABLE_GOODS = "durable_goods"
    INITIAL_CLAIMS = "initial_claims"
    ISM_MANUFACTURING = "ism_manufacturing"
    PCE = "pce"
    FOMC_RATE = "fomc_rate"
    ECB_RATE = "ecb_rate"
    BOJ_RATE = "boj_rate"
    BOE_RATE = "boe_rate"


class Country(Enum):
    US = "US"
    EU = "EU"
    UK = "UK"
    JP = "JP"
    CN = "CN"
    CA = "CA"
    AU = "AU"
    CH = "CH"
    NZ = "NZ"
    DE = "DE"
    FR = "FR"


class EarningsResult(Enum):
    BEAT = "beat"
    MEET = "meet"
    MISS = "miss"
    NOT_REPORTED = "not_reported"


# ─── Data Classes ────────────────────────────────────────────────────────────

@dataclass
class EconomicEvent:
    """Single economic calendar event."""
    event_id: str
    name: str
    category: EventCategory
    importance: EventImportance
    scheduled_time: datetime
    country: Country = Country.US
    indicator: EconomicIndicator | None = None
    previous: float | None = None
    consensus: float | None = None
    actual: float | None = None
    revision: float | None = None
    unit: str = ""
    description: str = ""
    source: str = ""
    is_released: bool = False

    @property
    def surprise(self) -> float | None:
        """Calculate surprise vs consensus."""
        if self.actual is not None and self.consensus is not None and self.consensus != 0:
            return self.actual - self.consensus
        return None

    @property
    def surprise_pct(self) -> float | None:
        """Surprise as percentage of consensus."""
        if self.actual is not None and self.consensus is not None and self.consensus != 0:
            return ((self.actual - self.consensus) / abs(self.consensus)) * 100
        return None

    @property
    def change_from_previous(self) -> float | None:
        if self.actual is not None and self.previous is not None:
            return self.actual - self.previous
        return None

    @property
    def time_until(self) -> timedelta | None:
        if not self.is_released:
            return self.scheduled_time - datetime.now()
        return None

    def to_dict(self) -> dict:
        return {
            "event_id": self.event_id,
            "name": self.name,
            "category": self.category.value,
            "importance": self.importance.value,
            "scheduled_time": self.scheduled_time.isoformat(),
            "country": self.country.value,
            "indicator": self.indicator.value if self.indicator else None,
            "previous": self.previous,
            "consensus": self.consensus,
            "actual": self.actual,
            "surprise": self.surprise,
            "surprise_pct": self.surprise_pct,
            "is_released": self.is_released,
            "unit": self.unit,
        }


@dataclass
class EarningsEvent:
    """Earnings release event."""
    symbol: str
    company_name: str
    report_date: datetime
    fiscal_quarter: str = ""
    fiscal_year: int = 0
    eps_estimate: float | None = None
    eps_actual: float | None = None
    revenue_estimate: float | None = None
    revenue_actual: float | None = None
    is_reported: bool = False
    guidance_low: float | None = None
    guidance_high: float | None = None
    report_time: str = "AMC"  # AMC (after market close) or BMO (before market open)

    @property
    def eps_surprise(self) -> float | None:
        if self.eps_actual is not None and self.eps_estimate is not None:
            return self.eps_actual - self.eps_estimate
        return None

    @property
    def eps_surprise_pct(self) -> float | None:
        if self.eps_actual is not None and self.eps_estimate is not None and self.eps_estimate != 0:
            return ((self.eps_actual - self.eps_estimate) / abs(self.eps_estimate)) * 100
        return None

    @property
    def revenue_surprise(self) -> float | None:
        if self.revenue_actual is not None and self.revenue_estimate is not None:
            return self.revenue_actual - self.revenue_estimate
        return None

    @property
    def revenue_surprise_pct(self) -> float | None:
        if self.revenue_actual is not None and self.revenue_estimate is not None and self.revenue_estimate != 0:
            return ((self.revenue_actual - self.revenue_estimate) / abs(self.revenue_estimate)) * 100
        return None

    @property
    def result(self) -> EarningsResult:
        if not self.is_reported:
            return EarningsResult.NOT_REPORTED
        if self.eps_surprise is None:
            return EarningsResult.NOT_REPORTED
        if self.eps_surprise > 0.01:
            return EarningsResult.BEAT
        elif self.eps_surprise < -0.01:
            return EarningsResult.MISS
        return EarningsResult.MEET

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "company_name": self.company_name,
            "report_date": self.report_date.isoformat(),
            "fiscal_quarter": self.fiscal_quarter,
            "fiscal_year": self.fiscal_year,
            "eps_estimate": self.eps_estimate,
            "eps_actual": self.eps_actual,
            "eps_surprise": self.eps_surprise,
            "eps_surprise_pct": self.eps_surprise_pct,
            "revenue_estimate": self.revenue_estimate,
            "revenue_actual": self.revenue_actual,
            "revenue_surprise": self.revenue_surprise,
            "revenue_surprise_pct": self.revenue_surprise_pct,
            "result": self.result.value,
            "report_time": self.report_time,
            "is_reported": self.is_reported,
        }


@dataclass
class DividendEvent:
    """Dividend calendar event."""
    symbol: str
    ex_date: datetime
    record_date: datetime | None = None
    pay_date: datetime | None = None
    amount: float = 0.0
    yield_pct: float = 0.0
    frequency: str = "quarterly"
    declaration_date: datetime | None = None
    is_special: bool = False

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "ex_date": self.ex_date.isoformat(),
            "record_date": self.record_date.isoformat() if self.record_date else None,
            "pay_date": self.pay_date.isoformat() if self.pay_date else None,
            "amount": self.amount,
            "yield_pct": self.yield_pct,
            "frequency": self.frequency,
            "is_special": self.is_special,
        }


@dataclass
class IPOEvent:
    """IPO calendar event."""
    symbol: str
    company_name: str
    expected_date: datetime
    price_range_low: float = 0.0
    price_range_high: float = 0.0
    shares_offered: int = 0
    exchange: str = ""
    underwriter: str = ""
    status: str = "expected"  # expected, priced, withdrawn

    @property
    def midpoint_price(self) -> float:
        if self.price_range_low and self.price_range_high:
            return (self.price_range_low + self.price_range_high) / 2
        return 0.0

    @property
    def deal_size(self) -> float:
        return self.midpoint_price * self.shares_offered

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "company_name": self.company_name,
            "expected_date": self.expected_date.isoformat(),
            "price_range": f"${self.price_range_low:.2f} - ${self.price_range_high:.2f}",
            "midpoint": self.midpoint_price,
            "shares_offered": self.shares_offered,
            "deal_size": self.deal_size,
            "exchange": self.exchange,
            "status": self.status,
        }


@dataclass
class EventImpact:
    """Historical impact of an economic event on markets."""
    event_name: str
    avg_move_pct: float = 0.0
    avg_absolute_move: float = 0.0
    max_move_up: float = 0.0
    max_move_down: float = 0.0
    volatility_change: float = 0.0
    sample_size: int = 0
    beat_avg_move: float = 0.0
    miss_avg_move: float = 0.0

    def to_dict(self) -> dict:
        return {
            "event_name": self.event_name,
            "avg_move_pct": round(self.avg_move_pct, 4),
            "avg_absolute_move": round(self.avg_absolute_move, 4),
            "max_move_up": round(self.max_move_up, 4),
            "max_move_down": round(self.max_move_down, 4),
            "volatility_change": round(self.volatility_change, 4),
            "sample_size": self.sample_size,
        }


# ─── Economic Surprise Index ────────────────────────────────────────────────

class EconomicSurpriseCalculator:
    """Calculate economic surprise indices."""

    @staticmethod
    def surprise_index(events: list[EconomicEvent], window: int = 30) -> float:
        """Calculate rolling surprise index (weighted by importance)."""
        released = [e for e in events if e.is_released and e.surprise is not None]
        if not released:
            return 0.0

        weights = {
            EventImportance.CRITICAL: 4.0,
            EventImportance.HIGH: 3.0,
            EventImportance.MEDIUM: 2.0,
            EventImportance.LOW: 1.0,
        }

        total_weight = 0.0
        weighted_surprise = 0.0

        for event in released[-window:]:
            w = weights.get(event.importance, 1.0)
            surprise_pct = event.surprise_pct
            if surprise_pct is not None:
                weighted_surprise += w * surprise_pct
                total_weight += w

        return weighted_surprise / total_weight if total_weight > 0 else 0.0

    @staticmethod
    def surprise_by_indicator(events: list[EconomicEvent]) -> dict[str, dict]:
        """Aggregate surprise statistics by indicator."""
        by_indicator: dict[str, list[float]] = {}
        for ev in events:
            if ev.is_released and ev.surprise_pct is not None and ev.indicator:
                key = ev.indicator.value
                by_indicator.setdefault(key, []).append(ev.surprise_pct)

        result = {}
        for ind, surprises in by_indicator.items():
            result[ind] = {
                "count": len(surprises),
                "avg_surprise_pct": float(np.mean(surprises)),
                "std_surprise_pct": float(np.std(surprises)) if len(surprises) > 1 else 0.0,
                "pct_positive": sum(1 for s in surprises if s > 0) / len(surprises) * 100,
                "latest": surprises[-1],
            }
        return result


# ─── Event Impact Analyzer ──────────────────────────────────────────────────

class EventImpactAnalyzer:
    """Analyze historical market impact of economic events."""

    @staticmethod
    def calculate_impact(event_name: str, market_moves: list[float]) -> EventImpact:
        """Calculate average market impact from historical moves."""
        if not market_moves:
            return EventImpact(event_name)

        moves = np.array(market_moves)
        return EventImpact(
            event_name=event_name,
            avg_move_pct=float(np.mean(moves)),
            avg_absolute_move=float(np.mean(np.abs(moves))),
            max_move_up=float(np.max(moves)),
            max_move_down=float(np.min(moves)),
            volatility_change=float(np.std(moves)),
            sample_size=len(moves),
        )

    @staticmethod
    def conditional_impact(event_name: str, surprises: list[float], market_moves: list[float]) -> dict:
        """Market impact conditional on surprise direction."""
        if len(surprises) != len(market_moves) or not surprises:
            return {"beat": 0.0, "miss": 0.0, "inline": 0.0}

        beat_moves = [market_moves[i] for i in range(len(surprises)) if surprises[i] > 0]
        miss_moves = [market_moves[i] for i in range(len(surprises)) if surprises[i] < 0]
        inline_moves = [market_moves[i] for i in range(len(surprises)) if surprises[i] == 0]

        return {
            "event": event_name,
            "beat_avg_move": float(np.mean(beat_moves)) if beat_moves else 0.0,
            "miss_avg_move": float(np.mean(miss_moves)) if miss_moves else 0.0,
            "inline_avg_move": float(np.mean(inline_moves)) if inline_moves else 0.0,
            "beat_count": len(beat_moves),
            "miss_count": len(miss_moves),
        }

    @staticmethod
    def pre_event_volatility(price_history: list[float], event_day: int, lookback: int = 5) -> dict:
        """Analyze volatility behavior before and after event."""
        if event_day < lookback or event_day + lookback >= len(price_history):
            return {"pre_vol": 0.0, "post_vol": 0.0, "ratio": 1.0}

        # Returns
        returns = [price_history[i] / price_history[i - 1] - 1 for i in range(1, len(price_history))]

        pre_returns = returns[event_day - lookback:event_day]
        post_returns = returns[event_day:event_day + lookback]

        pre_vol = float(np.std(pre_returns)) if pre_returns else 0.0
        post_vol = float(np.std(post_returns)) if post_returns else 0.0

        return {
            "pre_event_vol": pre_vol,
            "post_event_vol": post_vol,
            "vol_ratio": post_vol / pre_vol if pre_vol > 0 else 1.0,
        }


# ─── Earnings Analysis ─────────────────────────────────────────────────────

class EarningsAnalyzer:
    """Analyze earnings trends and surprises."""

    @staticmethod
    def sector_earnings_summary(earnings: list[EarningsEvent]) -> dict:
        """Summary of earnings results."""
        reported = [e for e in earnings if e.is_reported]
        if not reported:
            return {
                "total": 0, "reported": 0, "beat_rate": 0.0,
                "meet_rate": 0.0, "miss_rate": 0.0,
            }

        beats = sum(1 for e in reported if e.result == EarningsResult.BEAT)
        meets = sum(1 for e in reported if e.result == EarningsResult.MEET)
        misses = sum(1 for e in reported if e.result == EarningsResult.MISS)
        total = len(reported)

        eps_surprises = [e.eps_surprise_pct for e in reported if e.eps_surprise_pct is not None]
        rev_surprises = [e.revenue_surprise_pct for e in reported if e.revenue_surprise_pct is not None]

        return {
            "total_expected": len(earnings),
            "total_reported": total,
            "beats": beats,
            "meets": meets,
            "misses": misses,
            "beat_rate": beats / total * 100 if total else 0.0,
            "meet_rate": meets / total * 100 if total else 0.0,
            "miss_rate": misses / total * 100 if total else 0.0,
            "avg_eps_surprise_pct": float(np.mean(eps_surprises)) if eps_surprises else 0.0,
            "avg_revenue_surprise_pct": float(np.mean(rev_surprises)) if rev_surprises else 0.0,
        }

    @staticmethod
    def earnings_momentum(earnings: list[EarningsEvent]) -> dict:
        """Track earnings momentum over quarters."""
        reported = sorted(
            [e for e in earnings if e.is_reported],
            key=lambda e: e.report_date
        )
        if len(reported) < 2:
            return {"trend": "insufficient_data", "consecutive_beats": 0}

        consecutive_beats = 0
        for e in reversed(reported):
            if e.result == EarningsResult.BEAT:
                consecutive_beats += 1
            else:
                break

        recent_surprises = [e.eps_surprise_pct for e in reported[-4:] if e.eps_surprise_pct is not None]
        trend = "improving" if len(recent_surprises) >= 2 and recent_surprises[-1] > recent_surprises[0] else "declining"
        if len(recent_surprises) < 2:
            trend = "insufficient_data"

        return {
            "consecutive_beats": consecutive_beats,
            "trend": trend,
            "recent_surprises": recent_surprises,
            "total_reported": len(reported),
        }


# ─── Seasonal Pattern Analysis ──────────────────────────────────────────────

class SeasonalPatternAnalyzer:
    """Analyze seasonal patterns in economic data."""

    @staticmethod
    def monthly_seasonality(monthly_values: list[tuple[int, float]]) -> dict[int, dict]:
        """Analyze monthly seasonality from (month, value) pairs."""
        by_month: dict[int, list[float]] = {}
        for month, value in monthly_values:
            by_month.setdefault(month, []).append(value)

        result = {}
        for month in range(1, 13):
            values = by_month.get(month, [])
            if values:
                result[month] = {
                    "mean": float(np.mean(values)),
                    "std": float(np.std(values)) if len(values) > 1 else 0.0,
                    "min": float(np.min(values)),
                    "max": float(np.max(values)),
                    "count": len(values),
                    "positive_pct": sum(1 for v in values if v > 0) / len(values) * 100,
                }
            else:
                result[month] = {
                    "mean": 0.0, "std": 0.0, "min": 0.0, "max": 0.0,
                    "count": 0, "positive_pct": 0.0,
                }
        return result

    @staticmethod
    def day_of_week_effect(daily_returns: list[tuple[int, float]]) -> dict[int, dict]:
        """Day-of-week effect from (weekday, return) pairs. 0=Mon, 4=Fri."""
        by_day: dict[int, list[float]] = {}
        for day, ret in daily_returns:
            by_day.setdefault(day, []).append(ret)

        day_names = {0: "Monday", 1: "Tuesday", 2: "Wednesday", 3: "Thursday", 4: "Friday"}
        result = {}

        for day in range(5):
            values = by_day.get(day, [])
            if values:
                result[day] = {
                    "name": day_names.get(day, f"Day_{day}"),
                    "mean": float(np.mean(values)),
                    "std": float(np.std(values)) if len(values) > 1 else 0.0,
                    "count": len(values),
                    "positive_pct": sum(1 for v in values if v > 0) / len(values) * 100,
                }
            else:
                result[day] = {
                    "name": day_names.get(day, f"Day_{day}"),
                    "mean": 0.0, "std": 0.0, "count": 0, "positive_pct": 0.0,
                }
        return result

    @staticmethod
    def holiday_effect(returns_before: list[float], returns_after: list[float], normal_returns: list[float]) -> dict:
        """Analyze pre/post holiday effects."""
        result = {
            "pre_holiday_avg": float(np.mean(returns_before)) if returns_before else 0.0,
            "post_holiday_avg": float(np.mean(returns_after)) if returns_after else 0.0,
            "normal_avg": float(np.mean(normal_returns)) if normal_returns else 0.0,
        }
        result["pre_holiday_premium"] = result["pre_holiday_avg"] - result["normal_avg"]
        result["post_holiday_premium"] = result["post_holiday_avg"] - result["normal_avg"]
        return result


# ─── Event Calendar Manager ─────────────────────────────────────────────────

class EventCalendarManager:
    """Manage and query economic calendar events."""

    def __init__(self):
        self.economic_events: list[EconomicEvent] = []
        self.earnings_events: list[EarningsEvent] = []
        self.dividend_events: list[DividendEvent] = []
        self.ipo_events: list[IPOEvent] = []

    def add_economic_event(self, event: EconomicEvent) -> None:
        self.economic_events.append(event)

    def add_earnings_event(self, event: EarningsEvent) -> None:
        self.earnings_events.append(event)

    def add_dividend_event(self, event: DividendEvent) -> None:
        self.dividend_events.append(event)

    def add_ipo_event(self, event: IPOEvent) -> None:
        self.ipo_events.append(event)

    def upcoming_events(self, days: int = 7, from_date: datetime | None = None) -> list[dict]:
        """Get all upcoming events within N days."""
        ref = from_date or datetime.now()
        end = ref + timedelta(days=days)
        events = []

        for ev in self.economic_events:
            if ref <= ev.scheduled_time <= end:
                events.append({"type": "economic", "data": ev.to_dict()})

        for ev in self.earnings_events:
            if ref <= ev.report_date <= end:
                events.append({"type": "earnings", "data": ev.to_dict()})

        for ev in self.dividend_events:
            if ref <= ev.ex_date <= end:
                events.append({"type": "dividend", "data": ev.to_dict()})

        for ev in self.ipo_events:
            if ref <= ev.expected_date <= end:
                events.append({"type": "ipo", "data": ev.to_dict()})

        events.sort(key=lambda e: e["data"].get("scheduled_time", e["data"].get("report_date", e["data"].get("ex_date", ""))))
        return events

    def events_by_importance(self, importance: EventImportance) -> list[EconomicEvent]:
        return [e for e in self.economic_events if e.importance == importance]

    def events_by_country(self, country: Country) -> list[EconomicEvent]:
        return [e for e in self.economic_events if e.country == country]

    def events_by_category(self, category: EventCategory) -> list[EconomicEvent]:
        return [e for e in self.economic_events if e.category == category]

    def earnings_by_date(self, target_date: date) -> list[EarningsEvent]:
        return [e for e in self.earnings_events if e.report_date.date() == target_date]

    def dividends_by_symbol(self, symbol: str) -> list[DividendEvent]:
        return [e for e in self.dividend_events if e.symbol == symbol]

    def event_density(self, from_date: datetime, to_date: datetime) -> dict[str, int]:
        """Count events per day in date range."""
        density: dict[str, int] = {}
        current = from_date
        while current <= to_date:
            key = current.strftime("%Y-%m-%d")
            count = 0
            count += sum(1 for e in self.economic_events if e.scheduled_time.date() == current.date())
            count += sum(1 for e in self.earnings_events if e.report_date.date() == current.date())
            density[key] = count
            current += timedelta(days=1)
        return density

    def high_impact_events(self, from_date: datetime | None = None, days: int = 7) -> list[dict]:
        """Get only HIGH and CRITICAL importance events."""
        ref = from_date or datetime.now()
        end = ref + timedelta(days=days)
        events = []
        for ev in self.economic_events:
            if ref <= ev.scheduled_time <= end and ev.importance in (EventImportance.HIGH, EventImportance.CRITICAL):
                events.append(ev.to_dict())
        return events

    def conflict_detection(self, from_date: datetime, to_date: datetime) -> list[dict]:
        """Detect overlapping high-impact events."""
        high_events = [
            e for e in self.economic_events
            if from_date <= e.scheduled_time <= to_date
            and e.importance in (EventImportance.HIGH, EventImportance.CRITICAL)
        ]

        conflicts = []
        for i in range(len(high_events)):
            for j in range(i + 1, len(high_events)):
                td = abs((high_events[i].scheduled_time - high_events[j].scheduled_time).total_seconds())
                if td < 3600:  # Within 1 hour
                    conflicts.append({
                        "event1": high_events[i].name,
                        "event2": high_events[j].name,
                        "time_diff_minutes": td / 60,
                    })

        return conflicts


# ─── Volatility Forecaster ──────────────────────────────────────────────────

class EventVolatilityForecaster:
    """Forecast volatility around economic events."""

    @staticmethod
    def expected_move(historical_moves: list[float], confidence: float = 0.68) -> dict:
        """Expected move based on historical event reactions."""
        if not historical_moves:
            return {"expected_move": 0.0, "range_low": 0.0, "range_high": 0.0}

        moves = np.array(historical_moves)
        mean_move = float(np.mean(np.abs(moves)))
        std_move = float(np.std(moves)) if len(moves) > 1 else 0.0

        # Z-scores for confidence intervals
        z_scores = {0.68: 1.0, 0.90: 1.645, 0.95: 1.96, 0.99: 2.576}
        z = z_scores.get(confidence, 1.0)

        avg = float(np.mean(moves))
        return {
            "expected_move": mean_move,
            "expected_direction": avg,
            "range_low": avg - z * std_move,
            "range_high": avg + z * std_move,
            "confidence": confidence,
            "sample_size": len(moves),
        }

    @staticmethod
    def implied_vs_realized(implied_vol: float, historical_moves: list[float]) -> dict:
        """Compare implied volatility to realized event moves."""
        if not historical_moves:
            return {"implied": implied_vol, "realized": 0.0, "ratio": 0.0}

        realized = float(np.std(historical_moves)) * math.sqrt(252) if len(historical_moves) > 1 else 0.0
        ratio = implied_vol / realized if realized > 0 else 0.0

        return {
            "implied_vol": implied_vol,
            "realized_event_vol": realized,
            "iv_rv_ratio": ratio,
            "overpriced": ratio > 1.0,
        }


# ─── Orchestrator ────────────────────────────────────────────────────────────

class EconomicCalendarEngine:
    """Top-level orchestrator for economic calendar & events analysis."""

    def __init__(self):
        self.calendar = EventCalendarManager()
        self.surprise_calc = EconomicSurpriseCalculator()
        self.impact_analyzer = EventImpactAnalyzer()
        self.earnings_analyzer = EarningsAnalyzer()
        self.seasonal = SeasonalPatternAnalyzer()
        self.vol_forecaster = EventVolatilityForecaster()

    def add_economic_event(self, **kwargs) -> EconomicEvent:
        event = EconomicEvent(**kwargs)
        self.calendar.add_economic_event(event)
        return event

    def add_earnings_event(self, **kwargs) -> EarningsEvent:
        event = EarningsEvent(**kwargs)
        self.calendar.add_earnings_event(event)
        return event

    def add_dividend_event(self, **kwargs) -> DividendEvent:
        event = DividendEvent(**kwargs)
        self.calendar.add_dividend_event(event)
        return event

    def add_ipo_event(self, **kwargs) -> IPOEvent:
        event = IPOEvent(**kwargs)
        self.calendar.add_ipo_event(event)
        return event

    def upcoming(self, days: int = 7, from_date: datetime | None = None) -> list[dict]:
        return self.calendar.upcoming_events(days, from_date)

    def high_impact(self, days: int = 7) -> list[dict]:
        return self.calendar.high_impact_events(days=days)

    def surprise_index(self, window: int = 30) -> float:
        return self.surprise_calc.surprise_index(self.calendar.economic_events, window)

    def surprise_by_indicator(self) -> dict:
        return self.surprise_calc.surprise_by_indicator(self.calendar.economic_events)

    def event_impact(self, event_name: str, market_moves: list[float]) -> dict:
        return self.impact_analyzer.calculate_impact(event_name, market_moves).to_dict()

    def conditional_impact(self, event_name: str, surprises: list[float], market_moves: list[float]) -> dict:
        return self.impact_analyzer.conditional_impact(event_name, surprises, market_moves)

    def pre_event_volatility(self, prices: list[float], event_day: int) -> dict:
        return self.impact_analyzer.pre_event_volatility(prices, event_day)

    def earnings_summary(self) -> dict:
        return self.earnings_analyzer.sector_earnings_summary(self.calendar.earnings_events)

    def earnings_momentum(self, symbol: str | None = None) -> dict:
        events = self.calendar.earnings_events
        if symbol:
            events = [e for e in events if e.symbol == symbol]
        return self.earnings_analyzer.earnings_momentum(events)

    def monthly_seasonality(self, data: list[tuple[int, float]]) -> dict:
        return self.seasonal.monthly_seasonality(data)

    def day_of_week_effect(self, data: list[tuple[int, float]]) -> dict:
        return self.seasonal.day_of_week_effect(data)

    def expected_event_move(self, historical_moves: list[float], confidence: float = 0.68) -> dict:
        return self.vol_forecaster.expected_move(historical_moves, confidence)

    def event_density(self, from_date: datetime, to_date: datetime) -> dict:
        return self.calendar.event_density(from_date, to_date)

    def conflict_detection(self, from_date: datetime, to_date: datetime) -> list[dict]:
        return self.calendar.conflict_detection(from_date, to_date)

    def capabilities(self) -> dict:
        return {
            "engine": "EconomicCalendarEngine",
            "event_categories": [c.value for c in EventCategory],
            "importance_levels": [i.value for i in EventImportance],
            "economic_indicators": [e.value for e in EconomicIndicator],
            "countries": [c.value for c in Country],
            "features": [
                "economic_event_tracking",
                "earnings_calendar",
                "dividend_calendar",
                "ipo_calendar",
                "surprise_index",
                "event_impact_analysis",
                "conditional_impact",
                "pre_event_volatility",
                "earnings_momentum",
                "monthly_seasonality",
                "day_of_week_effect",
                "holiday_effect",
                "event_density",
                "conflict_detection",
                "volatility_forecasting",
            ],
        }
