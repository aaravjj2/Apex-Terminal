"""
Earnings Analysis Engine — Comprehensive earnings analytics including EPS/revenue
surprise analysis, guidance tracking, estimate revision momentum, reaction analysis,
whisper numbers, and post-earnings drift patterns.
Pure computation — no FastAPI dependencies.
"""

from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


# ── Enums ───────────────────────────────────────────────────────────────

class EarningsSurprise(str, Enum):
    MASSIVE_BEAT = "massive_beat"
    BEAT = "beat"
    IN_LINE = "in_line"
    MISS = "miss"
    MASSIVE_MISS = "massive_miss"


class GuidanceDirection(str, Enum):
    RAISED = "raised"
    MAINTAINED = "maintained"
    LOWERED = "lowered"
    WITHDRAWN = "withdrawn"
    NOT_PROVIDED = "not_provided"


class ReactionPattern(str, Enum):
    BUY_THE_NEWS = "buy_the_news"
    SELL_THE_NEWS = "sell_the_news"
    GAP_AND_RUN = "gap_and_run"
    GAP_AND_FILL = "gap_and_fill"
    MUTED = "muted"
    REVERSAL = "reversal"


class EstimateRevisionTrend(str, Enum):
    STRONG_UPGRADE = "strong_upgrade"
    UPGRADE = "upgrade"
    STABLE = "stable"
    DOWNGRADE = "downgrade"
    STRONG_DOWNGRADE = "strong_downgrade"


# ── Data Classes ────────────────────────────────────────────────────────

@dataclass
class EarningsReport:
    """A single quarterly earnings report."""
    symbol: str
    quarter: str           # e.g., "Q3 2025"
    report_date: str
    eps_actual: float
    eps_estimate: float
    revenue_actual: float  # in millions
    revenue_estimate: float
    guidance_eps_low: Optional[float] = None
    guidance_eps_high: Optional[float] = None
    prev_guidance_eps: Optional[float] = None
    price_before: float = 0.0
    price_after: float = 0.0      # Next day open or after-hours
    price_day_after: float = 0.0  # Next day close

    @property
    def eps_surprise_pct(self) -> float:
        if self.eps_estimate == 0:
            return 0.0
        return (self.eps_actual - self.eps_estimate) / abs(self.eps_estimate) * 100

    @property
    def revenue_surprise_pct(self) -> float:
        if self.revenue_estimate == 0:
            return 0.0
        return (self.revenue_actual - self.revenue_estimate) / abs(self.revenue_estimate) * 100

    @property
    def eps_surprise_class(self) -> EarningsSurprise:
        s = self.eps_surprise_pct
        if s > 10:
            return EarningsSurprise.MASSIVE_BEAT
        elif s > 2:
            return EarningsSurprise.BEAT
        elif s > -2:
            return EarningsSurprise.IN_LINE
        elif s > -10:
            return EarningsSurprise.MISS
        else:
            return EarningsSurprise.MASSIVE_MISS

    @property
    def initial_reaction_pct(self) -> float:
        if self.price_before == 0:
            return 0.0
        return (self.price_after - self.price_before) / self.price_before * 100

    @property
    def next_day_close_return_pct(self) -> float:
        if self.price_before == 0:
            return 0.0
        return (self.price_day_after - self.price_before) / self.price_before * 100

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "quarter": self.quarter,
            "date": self.report_date,
            "eps_actual": self.eps_actual,
            "eps_estimate": self.eps_estimate,
            "eps_surprise_pct": round(self.eps_surprise_pct, 2),
            "eps_surprise_class": self.eps_surprise_class.value,
            "revenue_actual_m": self.revenue_actual,
            "revenue_estimate_m": self.revenue_estimate,
            "revenue_surprise_pct": round(self.revenue_surprise_pct, 2),
            "initial_reaction_pct": round(self.initial_reaction_pct, 2),
        }


@dataclass
class AnalystEstimate:
    """Single analyst estimate."""
    analyst_firm: str
    eps_estimate: float
    revenue_estimate: float  # millions
    price_target: float
    rating: str  # "buy", "hold", "sell"
    date: str


# ── EPS Surprise Analyzer ─────────────────────────────────────────────

class EarningsSurpriseAnalyzer:
    """Analyze earnings surprises, patterns, and streaks."""

    @staticmethod
    def surprise_streak(reports: list[EarningsReport]) -> dict:
        """Calculate current beat/miss streak."""
        if not reports:
            return {"streak": 0, "direction": "none"}

        current_direction = "beat" if reports[-1].eps_surprise_pct > 0 else "miss"
        streak = 0

        for report in reversed(reports):
            direction = "beat" if report.eps_surprise_pct > 0 else "miss"
            if direction == current_direction:
                streak += 1
            else:
                break

        return {
            "streak": streak,
            "direction": current_direction,
            "current_surprise_pct": round(reports[-1].eps_surprise_pct, 2),
        }

    @staticmethod
    def beat_rate(reports: list[EarningsReport], lookback: int = 8) -> dict:
        """Calculate beat rate over recent quarters."""
        if not reports:
            return {"beat_rate": 0, "quarters": 0}

        recent = reports[-lookback:]
        beats = sum(1 for r in recent if r.eps_surprise_pct > 0)
        return {
            "beat_rate": round(beats / len(recent) * 100, 1),
            "quarters_analyzed": len(recent),
            "beats": beats,
            "misses": len(recent) - beats,
        }

    @staticmethod
    def average_surprise(reports: list[EarningsReport], lookback: int = 8) -> dict:
        """Average EPS and revenue surprise over lookback."""
        if not reports:
            return {"avg_eps_surprise": 0, "avg_rev_surprise": 0}
        recent = reports[-lookback:]
        return {
            "avg_eps_surprise_pct": round(statistics.mean(r.eps_surprise_pct for r in recent), 2),
            "avg_rev_surprise_pct": round(statistics.mean(r.revenue_surprise_pct for r in recent), 2),
            "median_eps_surprise": round(statistics.median(r.eps_surprise_pct for r in recent), 2),
        }

    @staticmethod
    def surprise_trend(reports: list[EarningsReport]) -> str:
        """Is the company beating by more or less each quarter?"""
        if len(reports) < 3:
            return "insufficient_data"
        surprises = [r.eps_surprise_pct for r in reports[-6:]]
        slope = sum((i - len(surprises) / 2) * s for i, s in enumerate(surprises)) / len(surprises)
        if slope > 1:
            return "improving"
        elif slope < -1:
            return "deteriorating"
        return "stable"


# ── Post-Earnings Drift ───────────────────────────────────────────────

class PostEarningsDriftAnalyzer:
    """
    PEAD (Post-Earnings Announcement Drift) analysis.
    Stocks tend to continue drifting in the direction of the earnings surprise.
    """

    @staticmethod
    def classify_reaction(report: EarningsReport) -> ReactionPattern:
        """Classify the post-earnings price reaction pattern."""
        initial = report.initial_reaction_pct
        next_day = report.next_day_close_return_pct

        if initial > 5 and next_day > 3:
            return ReactionPattern.GAP_AND_RUN
        elif initial > 3 and next_day < -1:
            return ReactionPattern.GAP_AND_FILL
        elif initial > 2 and abs(next_day) < 1:
            return ReactionPattern.MUTED
        elif initial > 2:
            return ReactionPattern.BUY_THE_NEWS
        elif initial < -2 and next_day > 1:
            return ReactionPattern.REVERSAL
        elif initial < -2:
            return ReactionPattern.SELL_THE_NEWS
        return ReactionPattern.MUTED

    @staticmethod
    def drift_analysis(
        reports: list[EarningsReport],
        hold_days: int = 20,
        subsequent_prices: list[list[float]] = None,
    ) -> dict:
        """
        Analyze PEAD: does the stock continue moving post earnings?
        Expected: positive surprise → continued upward drift.
        """
        if not reports:
            return {}

        reaction_patterns = [PostEarningsDriftAnalyzer.classify_reaction(r) for r in reports]
        pattern_counts = {}
        for p in reaction_patterns:
            pattern_counts[p.value] = pattern_counts.get(p.value, 0) + 1

        beats = [r for r in reports if r.eps_surprise_pct > 2]
        misses = [r for r in reports if r.eps_surprise_pct < -2]

        avg_beat_reaction = statistics.mean(r.initial_reaction_pct for r in beats) if beats else 0
        avg_miss_reaction = statistics.mean(r.initial_reaction_pct for r in misses) if misses else 0

        return {
            "total_reports": len(reports),
            "reaction_pattern_distribution": pattern_counts,
            "avg_beat_initial_reaction_pct": round(avg_beat_reaction, 2),
            "avg_miss_initial_reaction_pct": round(avg_miss_reaction, 2),
            "most_common_pattern": max(pattern_counts, key=pattern_counts.get) if pattern_counts else "unknown",
        }

    @staticmethod
    def sell_the_news_risk(
        report: EarningsReport,
        historical_reactions: list[float],
    ) -> dict:
        """Assess risk of sell-the-news reaction."""
        prev_avg = statistics.mean(historical_reactions) if historical_reactions else 0
        beat_size = report.eps_surprise_pct

        # Higher beat + higher expectations = higher sell-the-news risk
        risk_score = 0.0

        if beat_size > 10:
            risk_score += 30  # Massive beat priced in = sell risk

        if prev_avg > 5:
            risk_score += 25  # Stock used to gap big = expectations high

        if report.guidance_eps_high and report.prev_guidance_eps:
            if report.guidance_eps_high < report.prev_guidance_eps * 1.05:
                risk_score += 35  # Guidance didn't raise much

        return {
            "sell_news_risk_score": round(min(risk_score, 100), 2),
            "risk_level": "high" if risk_score > 60 else "medium" if risk_score > 30 else "low",
            "beat_size_pct": round(beat_size, 2),
        }


# ── Guidance Tracker ──────────────────────────────────────────────────

class GuidanceTracker:
    """Track and analyze company guidance revisions."""

    @staticmethod
    def classify_guidance(
        new_eps_midpoint: float,
        prev_eps_midpoint: float,
        consensus_estimate: float,
    ) -> dict:
        """Classify guidance raise/lower vs prior and vs consensus."""
        if new_eps_midpoint == 0:
            return {"direction": GuidanceDirection.NOT_PROVIDED.value}

        vs_prior = (new_eps_midpoint - prev_eps_midpoint) / abs(prev_eps_midpoint) * 100 if prev_eps_midpoint != 0 else 0
        vs_consensus = (new_eps_midpoint - consensus_estimate) / abs(consensus_estimate) * 100 if consensus_estimate != 0 else 0

        if vs_prior > 3:
            direction = GuidanceDirection.RAISED
        elif vs_prior < -3:
            direction = GuidanceDirection.LOWERED
        else:
            direction = GuidanceDirection.MAINTAINED

        return {
            "direction": direction.value,
            "vs_prior_pct": round(vs_prior, 2),
            "vs_consensus_pct": round(vs_consensus, 2),
            "beats_consensus": vs_consensus > 0,
        }

    @staticmethod
    def guidance_trend(historical_guidances: list[dict]) -> str:
        """Track if guidance is consistently being raised or lowered."""
        if len(historical_guidances) < 3:
            return "insufficient_data"

        directions = [g.get("direction") for g in historical_guidances[-6:]]
        raises = sum(1 for d in directions if d == GuidanceDirection.RAISED.value)
        lowers = sum(1 for d in directions if d == GuidanceDirection.LOWERED.value)

        if raises >= 4:
            return "consistently_raising"
        elif lowers >= 4:
            return "consistently_lowering"
        elif raises > lowers:
            return "net_positive"
        else:
            return "net_negative"


# ── Estimate Revision Momentum ────────────────────────────────────────

class EstimateRevisionMomentum:
    """
    Track analyst estimate revisions — a historically powerful alpha signal.
    Rising estimates → positive earnings revision momentum (ERM).
    """

    @staticmethod
    def revision_score(
        current_estimates: list[float],
        prior_estimates: list[float],
    ) -> dict:
        """
        Calculate estimate revision score.
        Score: (# upgrades - # downgrades) / total as a percentage.
        """
        if len(current_estimates) != len(prior_estimates) or not current_estimates:
            return {"score": 0, "trend": EstimateRevisionTrend.STABLE.value}

        upgrades = sum(1 for c, p in zip(current_estimates, prior_estimates) if c > p * 1.005)
        downgrades = sum(1 for c, p in zip(current_estimates, prior_estimates) if c < p * 0.995)
        total = len(current_estimates)

        score = (upgrades - downgrades) / total * 100

        avg_change = statistics.mean((c - p) / abs(p) * 100 for c, p in zip(current_estimates, prior_estimates) if p != 0)

        if score > 60:
            trend = EstimateRevisionTrend.STRONG_UPGRADE
        elif score > 20:
            trend = EstimateRevisionTrend.UPGRADE
        elif score > -20:
            trend = EstimateRevisionTrend.STABLE
        elif score > -60:
            trend = EstimateRevisionTrend.DOWNGRADE
        else:
            trend = EstimateRevisionTrend.STRONG_DOWNGRADE

        return {
            "score": round(score, 2),
            "trend": trend.value,
            "upgrades": upgrades,
            "downgrades": downgrades,
            "avg_revision_pct": round(avg_change, 4),
        }

    @staticmethod
    def erm_series(
        estimate_snapshots: list[list[float]],
        prior_snapshots: list[list[float]],
    ) -> list[float]:
        """Rolling ERM series."""
        result = []
        for curr, prior in zip(estimate_snapshots, prior_snapshots):
            res = EstimateRevisionMomentum.revision_score(curr, prior)
            result.append(res["score"])
        return result

    @staticmethod
    def whisper_vs_consensus(
        whisper_eps: float,
        consensus_eps: float,
        actual_eps: float,
    ) -> dict:
        """
        Analyze whisper number vs consensus vs actual.
        Whisper numbers often better reflect the market's true expectation.
        """
        vs_whisper = (actual_eps - whisper_eps) / abs(whisper_eps) * 100 if whisper_eps != 0 else 0
        vs_consensus = (actual_eps - consensus_eps) / abs(consensus_eps) * 100 if consensus_eps != 0 else 0
        whisper_vs_cons = (whisper_eps - consensus_eps) / abs(consensus_eps) * 100 if consensus_eps != 0 else 0

        return {
            "vs_whisper_pct": round(vs_whisper, 2),
            "vs_consensus_pct": round(vs_consensus, 2),
            "whisper_premium": round(whisper_vs_cons, 2),
            "beat_whisper": vs_whisper > 0,
            "beat_consensus": vs_consensus > 0,
        }


# ── Valuation Multiple Tracker ────────────────────────────────────────

class ValuationMultipleTracker:
    """Track P/E, EV/EBITDA, P/S, and other multiple expansions/contractions."""

    @staticmethod
    def pe_ratio(price: float, eps_ttm: float) -> float:
        if eps_ttm <= 0:
            return float("inf")
        return round(price / eps_ttm, 2)

    @staticmethod
    def forward_pe(price: float, eps_forward: float) -> float:
        if eps_forward <= 0:
            return float("inf")
        return round(price / eps_forward, 2)

    @staticmethod
    def peg_ratio(forward_pe: float, eps_growth_rate: float) -> float:
        """PEG = Forward P/E / EPS growth rate. <1 = undervalued."""
        if eps_growth_rate <= 0:
            return float("inf")
        return round(forward_pe / eps_growth_rate, 2)

    @staticmethod
    def multiple_expansion_analysis(
        current_price: float,
        eps_next_year: float,
        sector_avg_pe: float,
        historical_pe_avg: float,
    ) -> dict:
        """Analyze multiple expansion/contraction potential."""
        current_fwd_pe = current_price / max(eps_next_year, 0.01)
        target_at_sector = eps_next_year * sector_avg_pe
        target_at_historical = eps_next_year * historical_pe_avg

        return {
            "current_forward_pe": round(current_fwd_pe, 2),
            "sector_avg_pe": sector_avg_pe,
            "historical_avg_pe": historical_pe_avg,
            "target_at_sector_pe": round(target_at_sector, 2),
            "target_at_historical_pe": round(target_at_historical, 2),
            "upside_to_sector_pct": round((target_at_sector / current_price - 1) * 100, 2),
            "upside_to_historical_pct": round((target_at_historical / current_price - 1) * 100, 2),
            "multiple_vs_sector": round(current_fwd_pe / max(sector_avg_pe, 0.01), 4),
        }

    @staticmethod
    def earnings_yield(eps: float, price: float) -> float:
        """Earnings yield = EPS / Price. Inverse of P/E."""
        if price == 0:
            return 0.0
        return round(eps / price * 100, 2)


# ── Earnings Calendar ─────────────────────────────────────────────────

class EarningsCalendarAnalyzer:
    """Analyze earnings calendar for seasonal patterns and clustering."""

    @staticmethod
    def season_classification(month: int) -> str:
        """Classify which earnings season (Q1-Q4 reporting seasons)."""
        if month in (1, 2, 3):
            return "Q4_season"    # Companies reporting Q4
        elif month in (4, 5):
            return "Q1_season"
        elif month in (7, 8):
            return "Q2_season"
        elif month in (10, 11):
            return "Q3_season"
        else:
            return "off_season"

    @staticmethod
    def cluster_analysis(
        earnings_dates: list[str],  # format "YYYY-MM-DD"
    ) -> dict:
        """Find clustering of earnings dates (peak reporting weeks)."""
        if not earnings_dates:
            return {}

        # Parse month-day
        date_counts: dict[str, int] = {}
        for d in earnings_dates:
            parts = d.split("-")
            if len(parts) >= 2:
                key = f"{parts[0]}-{parts[1]}"
                date_counts[key] = date_counts.get(key, 0) + 1

        sorted_months = sorted(date_counts.items(), key=lambda x: -x[1])

        return {
            "total_reports": len(earnings_dates),
            "peak_month": sorted_months[0][0] if sorted_months else None,
            "distribution": dict(sorted_months),
        }

    @staticmethod
    def high_impact_earnings(
        reports: list[dict],
        market_cap_threshold: float = 10_000,  # $10B
    ) -> list[dict]:
        """Filter earnings for high market-cap / high-impact names."""
        return [r for r in reports if r.get("market_cap_m", 0) >= market_cap_threshold]


# ── EPS Model ─────────────────────────────────────────────────────────

class EPSGrowthModel:
    """Model EPS growth, sustainability, and forward estimates."""

    @staticmethod
    def eps_cagr(eps_start: float, eps_end: float, years: float) -> float:
        """Compound annual growth rate of EPS."""
        if eps_start <= 0 or years <= 0:
            return 0.0
        return round((eps_end / eps_start) ** (1 / years) - 1, 4)

    @staticmethod
    def sustainable_growth_rate(
        roe: float,         # Return on equity (decimal)
        retention_ratio: float,  # 1 - payout ratio
    ) -> float:
        """Sustainable growth rate = ROE × retention ratio."""
        return round(roe * retention_ratio, 4)

    @staticmethod
    def forward_estimates(
        current_eps: float,
        growth_rate: float,
        years: int = 5,
    ) -> list[dict]:
        """Project forward EPS estimates."""
        result = []
        eps = current_eps
        for y in range(1, years + 1):
            eps *= (1 + growth_rate)
            result.append({"year": f"Y+{y}", "eps": round(eps, 4), "growth_assumed": round(growth_rate * 100, 2)})
        return result

    @staticmethod
    def peg_bands(
        forward_pe: float,
        growth_rates: list[float],
    ) -> list[dict]:
        """Calculate PEG ratio across different growth assumptions."""
        return [
            {
                "growth_pct": round(g * 100, 1),
                "peg": round(forward_pe / (g * 100), 4) if g > 0 else float("inf"),
                "attractive": forward_pe / (g * 100) < 1.5 if g > 0 else False,
            }
            for g in growth_rates
        ]


# ── Orchestrator ──────────────────────────────────────────────────────

class EarningsAnalysisEngine:
    """Top-level orchestrator for all earnings analytics."""

    def __init__(self):
        self.surprise_analyzer = EarningsSurpriseAnalyzer()
        self.drift = PostEarningsDriftAnalyzer()
        self.guidance = GuidanceTracker()
        self.revision = EstimateRevisionMomentum()
        self.multiples = ValuationMultipleTracker()
        self.calendar = EarningsCalendarAnalyzer()
        self.eps_model = EPSGrowthModel()

    def analyze_report(
        self,
        report: EarningsReport,
        historical: list[EarningsReport],
    ) -> dict:
        """Comprehensive analysis of a single report in context of history."""
        beat_rate = self.surprise_analyzer.beat_rate(historical + [report])
        avg_surprise = self.surprise_analyzer.average_surprise(historical + [report])
        streak = self.surprise_analyzer.surprise_streak(historical + [report])
        reaction = self.drift.classify_reaction(report).value
        sell_risk = self.drift.sell_the_news_risk(
            report,
            [r.initial_reaction_pct for r in historical[-8:]],
        )
        return {
            "report": report.to_dict(),
            "historical_beat_rate": beat_rate,
            "avg_surprise": avg_surprise,
            "streak": streak,
            "reaction": reaction,
            "sell_news_risk": sell_risk,
        }

    def get_estimate_revision(
        self,
        current: list[float],
        prior: list[float],
    ) -> dict:
        return self.revision.revision_score(current, prior)

    def get_guidance_analysis(
        self,
        new_midpoint: float,
        prev_midpoint: float,
        consensus: float,
    ) -> dict:
        return self.guidance.classify_guidance(new_midpoint, prev_midpoint, consensus)

    def get_valuation(
        self,
        price: float,
        eps_ttm: float,
        eps_forward: float,
        eps_growth: float,
    ) -> dict:
        fwd_pe = self.multiples.forward_pe(price, eps_forward)
        return {
            "ttm_pe": self.multiples.pe_ratio(price, eps_ttm),
            "forward_pe": fwd_pe,
            "peg": self.multiples.peg_ratio(fwd_pe, eps_growth),
            "earnings_yield": self.multiples.earnings_yield(eps_ttm, price),
        }

    def get_forward_eps(self, current_eps: float, growth_rate: float) -> list[dict]:
        return self.eps_model.forward_estimates(current_eps, growth_rate)

    def capabilities(self) -> dict:
        return {
            "engine": "EarningsAnalysisEngine",
            "version": "1.0.0",
            "features": [
                "eps_revenue_surprise_analysis",
                "beat_miss_streak_tracking",
                "historical_beat_rate",
                "post_earnings_drift_pead",
                "sell_the_news_risk_scoring",
                "reaction_pattern_classification",
                "guidance_raise_lower_tracking",
                "guidance_trend_analysis",
                "estimate_revision_momentum_erm",
                "whisper_vs_consensus",
                "pe_forward_pe_peg_ratios",
                "multiple_expansion_analysis",
                "earnings_yield",
                "forward_eps_projection",
                "peg_bands_sensitivity",
                "earnings_calendar_clustering",
                "season_classification",
                "sustainable_growth_rate",
            ],
        }
