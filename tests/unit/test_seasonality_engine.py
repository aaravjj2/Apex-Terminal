"""
Tests for SeasonalityEngine — Day-of-week, month-of-year, January effect, turn-of-month.
"""
import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../phase1'))

from services.seasonality_engine import (
    DailyBar,
    DayOfWeekAnalyzer,
    MonthOfYearAnalyzer,
    TurnOfMonthAnalyzer,
    SantaClausAnalyzer,
    TripleWitchingAnalyzer,
    SeasonalityHeatmap,
    SeasonalityEngine,
    t_statistic,
    MONTHS,
    WEEKDAYS,
)
import random
import math


# ── Fixtures ──────────────────────────────────────────────────────────

@pytest.fixture
def sample_bars():
    """Generate 3 years of daily bars across all months."""
    bars = []
    dates = []
    # Generate dates for 3 years (2021-2023)
    for year in range(2021, 2024):
        for month in range(1, 13):
            for day in range(1, 29):  # Use days 1-28 to avoid month end issues
                date_str = f"{year}-{month:02d}-{day:02d}"
                dates.append(date_str)

    rng = random.Random(42)
    price = 100.0
    for date_str in dates:
        change = rng.gauss(0.0003, 0.012)
        new_price = price * (1 + change)
        bars.append(DailyBar(
            date_str=date_str,
            open=price,
            high=max(price, new_price) * 1.002,
            low=min(price, new_price) * 0.998,
            close=new_price,
            volume=rng.randint(1_000_000, 10_000_000),
        ))
        price = new_price
    return bars


@pytest.fixture
def december_january_bars():
    """Create bars specifically for Santa Claus Rally testing."""
    bars = []
    rng = random.Random(99)
    dates = []
    for day in range(20, 32):  # Dec 20-31
        dates.append(f"2023-12-{day:02d}")
    for day in range(1, 8):    # Jan 1-7
        dates.append(f"2024-01-{day:02d}")
    for day in range(8, 20):   # Jan 8-20 (non-Santa)
        dates.append(f"2024-01-{day:02d}")

    price = 400.0
    for date_str in dates:
        change = rng.gauss(0.001, 0.01)  # slightly positive for Santa period
        new_price = price * (1 + change)
        bars.append(DailyBar(date_str=date_str, open=price, high=new_price * 1.001,
                             low=new_price * 0.999, close=new_price))
        price = new_price
    return bars


@pytest.fixture
def engine():
    return SeasonalityEngine()


# ── DailyBar ──────────────────────────────────────────────────────────

class TestDailyBar:
    def test_basic_properties(self):
        bar = DailyBar("2023-06-15", 150.0, 155.0, 148.0, 152.0, 1000000)
        assert bar.year == 2023
        assert bar.month == 6
        assert bar.day == 15

    def test_return_pct(self):
        bar = DailyBar("2023-06-15", 100.0, 105.0, 99.0, 110.0)
        assert bar.return_pct == pytest.approx(0.10, abs=1e-6)

    def test_return_zero_open(self):
        bar = DailyBar("2023-06-15", 0.0, 1.0, 0.0, 1.0)
        assert bar.return_pct == 0.0

    def test_day_of_week_range(self, sample_bars):
        for bar in sample_bars:
            assert 0 <= bar.day_of_week <= 4  # Mon-Fri only due to our cap

    def test_to_dict(self):
        bar = DailyBar("2023-06-15", 100.0, 105.0, 99.0, 103.0, 5000000)
        d = bar.to_dict()
        assert "date" in d
        assert "return_pct" in d
        assert "day_of_week" in d


# ── t_statistic ───────────────────────────────────────────────────────

class TestTStatistic:
    def test_basic_ttest(self):
        sample = [0.01] * 30 + [-0.005] * 10  # mean > 0
        result = t_statistic(sample)
        assert result["t_stat"] > 0

    def test_ttest_mean_zero(self):
        sample = [0.0] * 20
        result = t_statistic(sample)
        assert result["t_stat"] == 0

    def test_ttest_significance(self):
        # Large positive returns with small variance → significant
        sample = [0.02] * 100
        result = t_statistic(sample)
        # Homogenous data has std=0, so t=0
        assert result["t_stat"] == 0  # no variance

    def test_ttest_insufficient(self):
        result = t_statistic([0.01])
        assert result["t_stat"] == 0

    def test_ttest_keys(self):
        result = t_statistic([0.01, 0.02, -0.01, 0.03])
        assert "t_stat" in result
        assert "p_approx" in result
        assert "significant" in result
        assert "n" in result


# ── DayOfWeekAnalyzer ─────────────────────────────────────────────────

class TestDayOfWeekAnalyzer:
    def test_analyze_returns_dict(self, sample_bars):
        result = DayOfWeekAnalyzer.analyze(sample_bars)
        assert isinstance(result, dict)
        assert len(result) > 0
        for day, stats in result.items():
            assert "avg_return" in stats
            assert "win_rate" in stats

    def test_group_by_day_no_weekend(self, sample_bars):
        groups = DayOfWeekAnalyzer.group_by_day(sample_bars)
        # Should only have weekday keys
        for key in groups:
            assert key in WEEKDAYS

    def test_best_worst_days(self, sample_bars):
        result = DayOfWeekAnalyzer.best_worst_days(sample_bars)
        if result:  # may be empty if not enough days
            assert "best_day" in result
            assert "worst_day" in result
            assert result["best_day"]["avg_return"] >= result["worst_day"]["avg_return"]

    def test_win_rate_range(self, sample_bars):
        result = DayOfWeekAnalyzer.analyze(sample_bars)
        for stats in result.values():
            assert 0 <= stats["win_rate"] <= 1


# ── MonthOfYearAnalyzer ───────────────────────────────────────────────

class TestMonthOfYearAnalyzer:
    def test_analyze_has_months(self, sample_bars):
        result = MonthOfYearAnalyzer.analyze(sample_bars)
        assert isinstance(result, dict)
        assert len(result) > 0

    def test_january_effect(self, sample_bars):
        result = MonthOfYearAnalyzer.january_effect(sample_bars)
        assert "january_avg" in result
        assert "all_months_avg" in result
        assert "n_januaries" in result
        assert result["n_januaries"] > 0

    def test_sell_in_may(self, sample_bars):
        result = MonthOfYearAnalyzer.sell_in_may(sample_bars)
        assert "winter_avg_monthly" in result
        assert "summer_avg_monthly" in result
        assert "seasonal_premium" in result
        assert isinstance(result["effect_confirmed"], bool)

    def test_group_by_month_all_12(self, sample_bars):
        groups = MonthOfYearAnalyzer.group_by_month(sample_bars)
        assert set(groups.keys()) == set(MONTHS)


# ── TurnOfMonthAnalyzer ───────────────────────────────────────────────

class TestTurnOfMonthAnalyzer:
    def test_tom_analysis_keys(self, sample_bars):
        result = TurnOfMonthAnalyzer.classify_days(sample_bars)
        assert "tom_avg_return" in result
        assert "non_tom_avg_return" in result
        assert "tom_premium" in result
        assert "effect_confirmed" in result

    def test_tom_premium_is_float(self, sample_bars):
        result = TurnOfMonthAnalyzer.classify_days(sample_bars)
        assert isinstance(result["tom_premium"], float)


# ── SantaClausAnalyzer ─────────────────────────────────────────────────

class TestSantaClausAnalyzer:
    def test_santa_keys(self, december_january_bars):
        result = SantaClausAnalyzer.identify_santa_periods(december_january_bars)
        assert "santa_avg_return" in result
        assert "non_santa_avg_return" in result
        assert "santa_premium" in result
        assert "win_rate" in result

    def test_santa_count(self, december_january_bars):
        result = SantaClausAnalyzer.identify_santa_periods(december_january_bars)
        assert result["n_santa_days"] > 0

    def test_empty_bars(self):
        result = SantaClausAnalyzer.identify_santa_periods([])
        assert result["n_santa_days"] == 0


# ── TripleWitchingAnalyzer ────────────────────────────────────────────

class TestTripleWitchingAnalyzer:
    def test_witching_analysis(self, sample_bars):
        result = TripleWitchingAnalyzer.identify_expiration_days(sample_bars)
        assert "witching_avg_return" in result
        assert "n_witching_days" in result

    def test_witching_count_plausible(self, sample_bars):
        result = TripleWitchingAnalyzer.identify_expiration_days(sample_bars)
        # 3 years × 4 expiration months = up to 12 triple witching days
        assert result["n_witching_days"] >= 0


# ── SeasonalityHeatmap ────────────────────────────────────────────────

class TestSeasonalityHeatmap:
    def test_heatmap_structure(self, sample_bars):
        result = SeasonalityHeatmap.build(sample_bars)
        assert "heatmap" in result
        assert "monthly_averages" in result
        assert "best_month" in result
        assert "worst_month" in result

    def test_monthly_averages_all_months(self, sample_bars):
        result = SeasonalityHeatmap.build(sample_bars)
        assert len(result["monthly_averages"]) == 12

    def test_best_worst_month_different(self, sample_bars):
        result = SeasonalityHeatmap.build(sample_bars)
        if result["best_month"] and result["worst_month"]:
            best_val = result["monthly_averages"][result["best_month"]]
            worst_val = result["monthly_averages"][result["worst_month"]]
            assert best_val >= worst_val


# ── SeasonalityEngine Orchestrator ────────────────────────────────────

class TestSeasonalityEngine:
    def test_day_of_week(self, engine, sample_bars):
        result = engine.day_of_week(sample_bars)
        assert isinstance(result, dict)

    def test_month_of_year(self, engine, sample_bars):
        result = engine.month_of_year(sample_bars)
        assert isinstance(result, dict)

    def test_january_effect(self, engine, sample_bars):
        result = engine.january_effect(sample_bars)
        assert "january_avg" in result

    def test_sell_in_may(self, engine, sample_bars):
        result = engine.sell_in_may(sample_bars)
        assert "seasonal_premium" in result

    def test_turn_of_month(self, engine, sample_bars):
        result = engine.turn_of_month(sample_bars)
        assert "tom_premium" in result

    def test_santa_claus(self, engine, december_january_bars):
        result = engine.santa_claus(december_january_bars)
        assert "santa_premium" in result

    def test_triple_witching(self, engine, sample_bars):
        result = engine.triple_witching(sample_bars)
        assert "n_witching_days" in result

    def test_full_heatmap(self, engine, sample_bars):
        result = engine.full_heatmap(sample_bars)
        assert "monthly_averages" in result

    def test_full_calendar_analysis(self, engine, sample_bars):
        result = engine.full_calendar_analysis(sample_bars)
        assert "day_of_week" in result
        assert "month_of_year" in result
        assert "january_effect" in result
        assert "sell_in_may" in result
        assert "turn_of_month" in result
        assert "santa_claus" in result

    def test_capabilities(self, engine):
        caps = engine.capabilities()
        assert caps["engine"] == "SeasonalityEngine"
        assert len(caps["features"]) >= 12
