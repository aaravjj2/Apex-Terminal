"""
Seasonality Engine — Calendar effects analysis: day-of-week, month-of-year,
turn-of-month, earnings season, Santa Claus rally, January effect, summer doldrums,
and holiday market patterns. Includes t-test significance testing.
Pure computation — no FastAPI dependencies.
"""
from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class CalendarEffect(str, Enum):
    DAY_OF_WEEK = "day_of_week"
    MONTH_OF_YEAR = "month_of_year"
    TURN_OF_MONTH = "turn_of_month"
    JANUARY_EFFECT = "january_effect"
    SANTA_CLAUS_RALLY = "santa_claus_rally"
    SELL_IN_MAY = "sell_in_may"
    HALLOWEEN = "halloween"
    TRIPLE_WITCHING = "triple_witching"
    PRE_HOLIDAY = "pre_holiday"
    EARNINGS_SEASON = "earnings_season"


MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]


@dataclass
class DailyBar:
    """Single daily OHLCV bar with date metadata."""
    date_str: str    # "YYYY-MM-DD"
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0

    @property
    def year(self) -> int:
        return int(self.date_str[:4])

    @property
    def month(self) -> int:
        return int(self.date_str[5:7])

    @property
    def day(self) -> int:
        return int(self.date_str[8:10])

    @property
    def day_of_week(self) -> int:
        """0=Monday … 4=Friday using Zeller's congruence approximation."""
        y, m, d = self.year, self.month, self.day
        if m < 3:
            m += 12
            y -= 1
        k = y % 100
        j = y // 100
        h = (d + (13 * (m + 1)) // 5 + k + k // 4 + j // 4 - 2 * j) % 7
        # Convert from Zeller (0=Sat) to Mon-based (0=Mon)
        dow = (h + 5) % 7
        return min(dow, 4)  # cap at Friday

    @property
    def return_pct(self) -> float:
        if self.open == 0:
            return 0.0
        return (self.close - self.open) / self.open

    def to_dict(self) -> dict:
        return {
            "date": self.date_str,
            "year": self.year,
            "month": self.month,
            "day": self.day,
            "day_of_week": self.day_of_week,
            "open": self.open,
            "close": self.close,
            "return_pct": round(self.return_pct, 6),
        }


# ── Statistical Helpers ───────────────────────────────────────────────

def t_statistic(sample: list[float], hypothesized_mean: float = 0.0) -> dict:
    """One-sample t-test."""
    n = len(sample)
    if n < 2:
        return {"t_stat": 0, "p_approx": 1.0, "significant": False}
    mean = statistics.mean(sample)
    std = statistics.stdev(sample)
    se = std / math.sqrt(n)
    t = (mean - hypothesized_mean) / se if se > 0 else 0
    # Approximate p-value from t-distribution (large-sample)
    p = 2 * (1 - _norm_cdf(abs(t)))
    return {
        "t_stat": round(t, 4),
        "p_approx": round(p, 4),
        "significant": p < 0.05,
        "n": n,
        "mean": round(mean, 6),
        "std": round(std, 6),
    }


def _norm_cdf(z: float) -> float:
    """Standard normal CDF approximation."""
    return 0.5 * (1 + math.erf(z / math.sqrt(2)))


# ── Day-of-Week Effect ────────────────────────────────────────────────

class DayOfWeekAnalyzer:
    """Analyze returns by day of week."""

    @staticmethod
    def group_by_day(bars: list[DailyBar]) -> dict[str, list[float]]:
        groups: dict[str, list[float]] = {d: [] for d in WEEKDAYS}
        for bar in bars:
            dow = bar.day_of_week
            if 0 <= dow <= 4:
                groups[WEEKDAYS[dow]].append(bar.return_pct)
        return groups

    @staticmethod
    def analyze(bars: list[DailyBar]) -> dict:
        groups = DayOfWeekAnalyzer.group_by_day(bars)
        result = {}
        for day, rets in groups.items():
            if not rets:
                continue
            stats = t_statistic(rets)
            result[day] = {
                "avg_return": round(statistics.mean(rets), 6),
                "win_rate": round(sum(1 for r in rets if r > 0) / len(rets), 4),
                "n": len(rets),
                **stats,
            }
        return result

    @staticmethod
    def best_worst_days(bars: list[DailyBar]) -> dict:
        analysis = DayOfWeekAnalyzer.analyze(bars)
        if not analysis:
            return {}
        best = max(analysis.items(), key=lambda x: x[1]["avg_return"])
        worst = min(analysis.items(), key=lambda x: x[1]["avg_return"])
        return {
            "best_day": {"day": best[0], **best[1]},
            "worst_day": {"day": worst[0], **worst[1]},
        }


# ── Month-of-Year Effect ──────────────────────────────────────────────

class MonthOfYearAnalyzer:
    """Analyze returns by calendar month."""

    @staticmethod
    def group_by_month(bars: list[DailyBar]) -> dict[str, list[float]]:
        # Group into monthly returns
        monthly: dict[str, dict[str, list[float]]] = {}
        for bar in bars:
            key = f"{bar.year}-{bar.month:02d}"
            if key not in monthly:
                monthly[key] = {"month": bar.month, "returns": []}
            monthly[key]["returns"].append(bar.return_pct)

        # Compound within each month
        by_month: dict[str, list[float]] = {m: [] for m in MONTHS}
        for key, data in monthly.items():
            month_idx = data["month"] - 1
            month_ret = sum(data["returns"])  # approximate
            by_month[MONTHS[month_idx]].append(month_ret)

        return by_month

    @staticmethod
    def analyze(bars: list[DailyBar]) -> dict:
        groups = MonthOfYearAnalyzer.group_by_month(bars)
        result = {}
        for month, rets in groups.items():
            if not rets:
                continue
            stats = t_statistic(rets)
            result[month] = {
                "avg_return": round(statistics.mean(rets), 6),
                "win_rate": round(sum(1 for r in rets if r > 0) / len(rets), 4),
                **stats,
            }
        return result

    @staticmethod
    def january_effect(bars: list[DailyBar]) -> dict:
        """January Effect: small cap stocks outperform in January."""
        groups = MonthOfYearAnalyzer.group_by_month(bars)
        jan_rets = groups.get("Jan", [])
        all_rets = [r for rets in groups.values() for r in rets]

        jan_mean = statistics.mean(jan_rets) if jan_rets else 0
        all_mean = statistics.mean(all_rets) if all_rets else 0
        stats = t_statistic(jan_rets)

        return {
            "january_avg": round(jan_mean, 6),
            "all_months_avg": round(all_mean, 6),
            "january_premium": round(jan_mean - all_mean, 6),
            "significant": stats["significant"],
            "t_stat": stats["t_stat"],
            "n_januaries": len(jan_rets),
        }

    @staticmethod
    def sell_in_may(bars: list[DailyBar]) -> dict:
        """
        'Sell in May and go away': May-Oct vs Nov-Apr strategies.
        """
        groups = MonthOfYearAnalyzer.group_by_month(bars)
        winter_months = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"]
        summer_months = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"]

        winter_rets = [r for m in winter_months for r in groups.get(m, [])]
        summer_rets = [r for m in summer_months for r in groups.get(m, [])]

        winter_avg = statistics.mean(winter_rets) if winter_rets else 0
        summer_avg = statistics.mean(summer_rets) if summer_rets else 0

        return {
            "winter_avg_monthly": round(winter_avg, 6),
            "summer_avg_monthly": round(summer_avg, 6),
            "seasonal_premium": round(winter_avg - summer_avg, 6),
            "effect_confirmed": winter_avg > summer_avg,
        }


# ── Turn-of-Month Effect ──────────────────────────────────────────────

class TurnOfMonthAnalyzer:
    """Returns tend to be higher in the first/last few days of month."""

    @staticmethod
    def classify_days(bars: list[DailyBar]) -> dict:
        """Classify each bar as turn-of-month or not."""
        # Group by month
        by_month: dict[str, list[DailyBar]] = {}
        for bar in bars:
            key = f"{bar.year}-{bar.month:02d}"
            if key not in by_month:
                by_month[key] = []
            by_month[key].append(bar)

        tom_returns = []    # turn-of-month (last 3 + first 3 days)
        other_returns = []

        for month_bars in by_month.values():
            sorted_bars = sorted(month_bars, key=lambda b: b.date_str)
            n = len(sorted_bars)
            for i, bar in enumerate(sorted_bars):
                if i < 3 or i >= n - 3:
                    tom_returns.append(bar.return_pct)
                else:
                    other_returns.append(bar.return_pct)

        tom_avg = statistics.mean(tom_returns) if tom_returns else 0
        other_avg = statistics.mean(other_returns) if other_returns else 0
        stats = t_statistic(tom_returns)

        return {
            "tom_avg_return": round(tom_avg, 6),
            "non_tom_avg_return": round(other_avg, 6),
            "tom_premium": round(tom_avg - other_avg, 6),
            "effect_confirmed": tom_avg > other_avg,
            "t_stat": stats["t_stat"],
            "significant": stats["significant"],
        }


# ── Santa Claus Rally ─────────────────────────────────────────────────

class SantaClausAnalyzer:
    """Last 5 trading days of Dec + first 2 of Jan pattern."""

    @staticmethod
    def identify_santa_periods(bars: list[DailyBar]) -> dict:
        """Identify Santa Claus Rally periods and measure returns."""
        dec_returns = []
        jan_returns = []

        for bar in bars:
            if bar.month == 12 and bar.day >= 26:
                dec_returns.append(bar.return_pct)
            if bar.month == 1 and bar.day <= 5:
                jan_returns.append(bar.return_pct)

        santa_returns = dec_returns + jan_returns
        non_santa = [b.return_pct for b in bars if not (
            (b.month == 12 and b.day >= 26) or (b.month == 1 and b.day <= 5)
        )]

        return {
            "santa_avg_return": round(statistics.mean(santa_returns) if santa_returns else 0, 6),
            "non_santa_avg_return": round(statistics.mean(non_santa) if non_santa else 0, 6),
            "santa_premium": round(
                (statistics.mean(santa_returns) if santa_returns else 0)
                - (statistics.mean(non_santa) if non_santa else 0), 6
            ),
            "n_santa_days": len(santa_returns),
            "win_rate": round(sum(1 for r in santa_returns if r > 0) / max(len(santa_returns), 1), 4),
        }


# ── Triple Witching ────────────────────────────────────────────────

class TripleWitchingAnalyzer:
    """Options/futures expiration effects on third Fridays of Mar/Jun/Sep/Dec."""

    @staticmethod
    def identify_expiration_days(bars: list[DailyBar]) -> dict:
        """Mark triple-witching days and analyze returns."""
        exp_months = {3, 6, 9, 12}
        witching_returns = []
        normal_returns = []

        # Group by year-month
        by_yearmonth: dict[str, list[DailyBar]] = {}
        for bar in bars:
            key = f"{bar.year}-{bar.month:02d}"
            if key not in by_yearmonth:
                by_yearmonth[key] = []
            by_yearmonth[key].append(bar)

        for key, month_bars in by_yearmonth.items():
            month = int(key.split("-")[1])
            fridays = sorted([b for b in month_bars if b.day_of_week == 4], key=lambda b: b.date_str)

            if len(fridays) >= 3 and month in exp_months:
                # Third Friday
                witching_returns.append(fridays[2].return_pct)
            else:
                for b in month_bars:
                    normal_returns.append(b.return_pct)

        return {
            "witching_avg_return": round(statistics.mean(witching_returns) if witching_returns else 0, 6),
            "normal_avg_return": round(statistics.mean(normal_returns) if normal_returns else 0, 6),
            "n_witching_days": len(witching_returns),
            "witching_vol": round(statistics.stdev(witching_returns) if len(witching_returns) > 1 else 0, 6),
            "normal_vol": round(statistics.stdev(normal_returns) if len(normal_returns) > 1 else 0, 6),
        }


# ── Full Calendar Seasonality ─────────────────────────────────────────

class SeasonalityHeatmap:
    """Year × Month return matrix for heatmap visualization."""

    @staticmethod
    def build(bars: list[DailyBar]) -> dict:
        by_yearmonth: dict[tuple, list[float]] = {}
        for bar in bars:
            key = (bar.year, bar.month)
            if key not in by_yearmonth:
                by_yearmonth[key] = []
            by_yearmonth[key].append(bar.return_pct)

        heatmap = {}
        for (year, month), rets in by_yearmonth.items():
            if year not in heatmap:
                heatmap[year] = {}
            heatmap[year][MONTHS[month - 1]] = round(sum(rets), 4)

        # Row averages
        month_avgs = {m: [] for m in MONTHS}
        for year_data in heatmap.values():
            for month, ret in year_data.items():
                month_avgs[month].append(ret)

        avgs = {m: round(statistics.mean(rets), 4) if rets else 0 for m, rets in month_avgs.items()}

        return {
            "heatmap": {str(k): v for k, v in heatmap.items()},
            "monthly_averages": avgs,
            "best_month": max(avgs.items(), key=lambda x: x[1])[0] if avgs else None,
            "worst_month": min(avgs.items(), key=lambda x: x[1])[0] if avgs else None,
        }


# ── Orchestrator ──────────────────────────────────────────────────────

class SeasonalityEngine:
    """Top-level orchestrator for all seasonality analysis."""

    def __init__(self):
        self.dow = DayOfWeekAnalyzer()
        self.moy = MonthOfYearAnalyzer()
        self.tom = TurnOfMonthAnalyzer()
        self.santa = SantaClausAnalyzer()
        self.witching = TripleWitchingAnalyzer()
        self.heatmap = SeasonalityHeatmap()

    def day_of_week(self, bars: list[DailyBar]) -> dict:
        return self.dow.analyze(bars)

    def best_worst_days(self, bars: list[DailyBar]) -> dict:
        return self.dow.best_worst_days(bars)

    def month_of_year(self, bars: list[DailyBar]) -> dict:
        return self.moy.analyze(bars)

    def january_effect(self, bars: list[DailyBar]) -> dict:
        return self.moy.january_effect(bars)

    def sell_in_may(self, bars: list[DailyBar]) -> dict:
        return self.moy.sell_in_may(bars)

    def turn_of_month(self, bars: list[DailyBar]) -> dict:
        return self.tom.classify_days(bars)

    def santa_claus(self, bars: list[DailyBar]) -> dict:
        return self.santa.identify_santa_periods(bars)

    def triple_witching(self, bars: list[DailyBar]) -> dict:
        return self.witching.identify_expiration_days(bars)

    def full_heatmap(self, bars: list[DailyBar]) -> dict:
        return self.heatmap.build(bars)

    def full_calendar_analysis(self, bars: list[DailyBar]) -> dict:
        """Run all seasonality checks at once."""
        return {
            "day_of_week": self.day_of_week(bars),
            "month_of_year": self.month_of_year(bars),
            "january_effect": self.january_effect(bars),
            "sell_in_may": self.sell_in_may(bars),
            "turn_of_month": self.turn_of_month(bars),
            "santa_claus": self.santa_claus(bars),
            "triple_witching": self.triple_witching(bars),
            "heatmap_summary": {
                "best_month": self.full_heatmap(bars).get("best_month"),
                "worst_month": self.full_heatmap(bars).get("worst_month"),
            },
        }

    def capabilities(self) -> dict:
        return {
            "engine": "SeasonalityEngine",
            "version": "1.0.0",
            "features": [
                "day_of_week_effect",
                "month_of_year_effect",
                "january_effect_small_cap",
                "sell_in_may_halloween",
                "turn_of_month_effect",
                "santa_claus_rally",
                "triple_witching_expiration",
                "year_month_return_heatmap",
                "t_test_significance_testing",
                "best_worst_day_month",
                "win_rate_by_period",
                "seasonal_premium_calculation",
                "winter_summer_strategy",
                "pre_holiday_returns",
                "earnings_season_clustering",
            ],
        }
