"""
Tests for EconomicCalendarEngine — comprehensive economic event tracking & analysis.
"""

import math
import numpy as np
import pytest
from datetime import datetime, timedelta, date

from services.economic_calendar_engine import (
    EconomicEvent,
    EarningsEvent,
    DividendEvent,
    IPOEvent,
    EventImportance,
    EventCategory,
    EconomicIndicator,
    Country,
    EarningsResult,
    EconomicSurpriseCalculator,
    EventImpactAnalyzer,
    EventImpact,
    EarningsAnalyzer,
    SeasonalPatternAnalyzer,
    EventCalendarManager,
    EventVolatilityForecaster,
    EconomicCalendarEngine,
)


NOW = datetime(2024, 6, 15, 9, 0, 0)
TOMORROW = NOW + timedelta(days=1)
YESTERDAY = NOW - timedelta(days=1)


# ═══════════════════════════════════════════════════════════════════════════
# EconomicEvent
# ═══════════════════════════════════════════════════════════════════════════

class TestEconomicEvent:
    def test_surprise_calculation(self):
        ev = EconomicEvent("E1", "NFP", EventCategory.ECONOMIC, EventImportance.CRITICAL,
                           NOW, consensus=200.0, actual=250.0, is_released=True)
        assert ev.surprise == 50.0
        assert ev.surprise_pct == 25.0

    def test_surprise_none_when_not_released(self):
        ev = EconomicEvent("E2", "CPI", EventCategory.ECONOMIC, EventImportance.HIGH,
                           TOMORROW, consensus=3.0)
        assert ev.surprise is None
        assert ev.surprise_pct is None

    def test_change_from_previous(self):
        ev = EconomicEvent("E3", "GDP", EventCategory.ECONOMIC, EventImportance.HIGH,
                           NOW, previous=2.5, actual=2.8, is_released=True)
        assert ev.change_from_previous == pytest.approx(0.3)

    def test_to_dict(self):
        ev = EconomicEvent("E4", "PMI", EventCategory.ECONOMIC, EventImportance.MEDIUM,
                           NOW, country=Country.US, indicator=EconomicIndicator.PMI_MANUFACTURING,
                           consensus=52.0, actual=54.0, is_released=True)
        d = ev.to_dict()
        assert d["event_id"] == "E4"
        assert d["importance"] == "medium"
        assert d["indicator"] == "pmi_manufacturing"
        assert d["surprise"] == 2.0

    def test_surprise_zero_consensus(self):
        ev = EconomicEvent("E5", "Test", EventCategory.ECONOMIC, EventImportance.LOW,
                           NOW, consensus=0.0, actual=1.0, is_released=True)
        assert ev.surprise_pct is None  # Division by zero guard

    def test_indicator_none(self):
        ev = EconomicEvent("E6", "Custom", EventCategory.POLITICAL, EventImportance.LOW, NOW)
        d = ev.to_dict()
        assert d["indicator"] is None


# ═══════════════════════════════════════════════════════════════════════════
# EarningsEvent
# ═══════════════════════════════════════════════════════════════════════════

class TestEarningsEvent:
    def test_eps_beat(self):
        e = EarningsEvent("AAPL", "Apple", NOW, eps_estimate=1.50, eps_actual=1.65, is_reported=True)
        assert e.result == EarningsResult.BEAT
        assert e.eps_surprise == pytest.approx(0.15)
        assert e.eps_surprise_pct == pytest.approx(10.0)

    def test_eps_miss(self):
        e = EarningsEvent("MSFT", "Microsoft", NOW, eps_estimate=2.00, eps_actual=1.80, is_reported=True)
        assert e.result == EarningsResult.MISS
        assert e.eps_surprise == pytest.approx(-0.20)

    def test_eps_meet(self):
        e = EarningsEvent("GOOG", "Alphabet", NOW, eps_estimate=1.50, eps_actual=1.505, is_reported=True)
        assert e.result == EarningsResult.MEET

    def test_not_reported(self):
        e = EarningsEvent("TSLA", "Tesla", TOMORROW, eps_estimate=0.80)
        assert e.result == EarningsResult.NOT_REPORTED

    def test_revenue_surprise(self):
        e = EarningsEvent("AMZN", "Amazon", NOW, revenue_estimate=120.0, revenue_actual=125.0, is_reported=True)
        assert e.revenue_surprise == pytest.approx(5.0)
        assert e.revenue_surprise_pct == pytest.approx(4.1667, abs=0.01)

    def test_to_dict(self):
        e = EarningsEvent("AAPL", "Apple", NOW, eps_estimate=1.50, eps_actual=1.65,
                          revenue_estimate=90.0, revenue_actual=92.0, is_reported=True,
                          fiscal_quarter="Q1", fiscal_year=2024)
        d = e.to_dict()
        assert d["symbol"] == "AAPL"
        assert d["result"] == "beat"
        assert d["eps_surprise_pct"] == pytest.approx(10.0)

    def test_zero_estimate(self):
        e = EarningsEvent("X", "Test", NOW, eps_estimate=0.0, eps_actual=0.5, is_reported=True)
        assert e.eps_surprise_pct is None


# ═══════════════════════════════════════════════════════════════════════════
# DividendEvent
# ═══════════════════════════════════════════════════════════════════════════

class TestDividendEvent:
    def test_basic(self):
        d = DividendEvent("AAPL", NOW, amount=0.82, yield_pct=0.55)
        assert d.amount == 0.82
        assert d.yield_pct == 0.55

    def test_to_dict(self):
        d = DividendEvent("MSFT", NOW, pay_date=TOMORROW, amount=0.68, frequency="quarterly")
        dd = d.to_dict()
        assert dd["symbol"] == "MSFT"
        assert dd["amount"] == 0.68
        assert dd["frequency"] == "quarterly"

    def test_special_dividend(self):
        d = DividendEvent("COST", NOW, amount=15.0, is_special=True)
        assert d.is_special is True


# ═══════════════════════════════════════════════════════════════════════════
# IPOEvent
# ═══════════════════════════════════════════════════════════════════════════

class TestIPOEvent:
    def test_midpoint_price(self):
        ipo = IPOEvent("NEW", "NewCo", TOMORROW, price_range_low=18.0, price_range_high=22.0)
        assert ipo.midpoint_price == 20.0

    def test_deal_size(self):
        ipo = IPOEvent("NEW", "NewCo", TOMORROW, price_range_low=18.0, price_range_high=22.0,
                       shares_offered=10_000_000)
        assert ipo.deal_size == 200_000_000

    def test_to_dict(self):
        ipo = IPOEvent("IPO1", "TestCo", TOMORROW, price_range_low=10, price_range_high=12,
                       exchange="NASDAQ", status="expected")
        d = ipo.to_dict()
        assert d["symbol"] == "IPO1"
        assert d["status"] == "expected"
        assert d["exchange"] == "NASDAQ"


# ═══════════════════════════════════════════════════════════════════════════
# EconomicSurpriseCalculator
# ═══════════════════════════════════════════════════════════════════════════

class TestEconomicSurpriseCalculator:
    def test_surprise_index_positive(self):
        events = [
            EconomicEvent(f"E{i}", f"Evt{i}", EventCategory.ECONOMIC, EventImportance.HIGH,
                          NOW - timedelta(days=i), consensus=100.0, actual=110.0, is_released=True)
            for i in range(5)
        ]
        idx = EconomicSurpriseCalculator.surprise_index(events)
        assert idx > 0  # Positive surprises

    def test_surprise_index_negative(self):
        events = [
            EconomicEvent(f"E{i}", f"Evt{i}", EventCategory.ECONOMIC, EventImportance.MEDIUM,
                          NOW - timedelta(days=i), consensus=100.0, actual=90.0, is_released=True)
            for i in range(5)
        ]
        idx = EconomicSurpriseCalculator.surprise_index(events)
        assert idx < 0

    def test_surprise_index_empty(self):
        assert EconomicSurpriseCalculator.surprise_index([]) == 0.0

    def test_surprise_by_indicator(self):
        events = [
            EconomicEvent("E1", "NFP", EventCategory.ECONOMIC, EventImportance.CRITICAL,
                          NOW, indicator=EconomicIndicator.NFP, consensus=200, actual=250, is_released=True),
            EconomicEvent("E2", "NFP", EventCategory.ECONOMIC, EventImportance.CRITICAL,
                          NOW, indicator=EconomicIndicator.NFP, consensus=180, actual=200, is_released=True),
            EconomicEvent("E3", "CPI", EventCategory.ECONOMIC, EventImportance.HIGH,
                          NOW, indicator=EconomicIndicator.CPI, consensus=3.0, actual=3.2, is_released=True),
        ]
        result = EconomicSurpriseCalculator.surprise_by_indicator(events)
        assert "nfp" in result
        assert "cpi" in result
        assert result["nfp"]["count"] == 2
        assert result["nfp"]["avg_surprise_pct"] > 0
        assert result["cpi"]["pct_positive"] == 100.0


# ═══════════════════════════════════════════════════════════════════════════
# EventImpactAnalyzer
# ═══════════════════════════════════════════════════════════════════════════

class TestEventImpactAnalyzer:
    def test_calculate_impact(self):
        moves = [0.5, -0.3, 0.8, -0.2, 1.0]
        impact = EventImpactAnalyzer.calculate_impact("NFP", moves)
        assert impact.event_name == "NFP"
        assert impact.avg_absolute_move > 0
        assert impact.max_move_up == 1.0
        assert impact.max_move_down == -0.3
        assert impact.sample_size == 5

    def test_calculate_impact_empty(self):
        impact = EventImpactAnalyzer.calculate_impact("Empty", [])
        assert impact.avg_move_pct == 0.0

    def test_conditional_impact(self):
        surprises = [1.0, -1.0, 0.5, -0.5, 0.0]
        moves = [0.8, -0.5, 0.3, -0.4, 0.1]
        result = EventImpactAnalyzer.conditional_impact("Test", surprises, moves)
        assert result["beat_avg_move"] > 0
        assert result["miss_avg_move"] < 0
        assert result["beat_count"] == 2

    def test_pre_event_volatility(self):
        prices = [100 + np.random.normal(0, 1) for _ in range(50)]
        result = EventImpactAnalyzer.pre_event_volatility(prices, 25, lookback=5)
        assert "pre_event_vol" in result
        assert "post_event_vol" in result
        assert "vol_ratio" in result

    def test_pre_event_volatility_edge(self):
        result = EventImpactAnalyzer.pre_event_volatility([100, 101], 0)
        assert result["pre_vol"] == 0.0


# ═══════════════════════════════════════════════════════════════════════════
# EarningsAnalyzer
# ═══════════════════════════════════════════════════════════════════════════

class TestEarningsAnalyzer:
    def test_sector_summary(self):
        events = [
            EarningsEvent("A", "A Inc", NOW, eps_estimate=1.0, eps_actual=1.2, is_reported=True),
            EarningsEvent("B", "B Inc", NOW, eps_estimate=2.0, eps_actual=2.5, is_reported=True),
            EarningsEvent("C", "C Inc", NOW, eps_estimate=0.5, eps_actual=0.3, is_reported=True),
            EarningsEvent("D", "D Inc", TOMORROW, eps_estimate=1.5),
        ]
        result = EarningsAnalyzer.sector_earnings_summary(events)
        assert result["total_expected"] == 4
        assert result["total_reported"] == 3
        assert result["beats"] == 2
        assert result["misses"] == 1
        assert result["beat_rate"] == pytest.approx(66.667, abs=0.1)

    def test_empty_summary(self):
        result = EarningsAnalyzer.sector_earnings_summary([])
        assert result["total"] == 0

    def test_earnings_momentum(self):
        events = [
            EarningsEvent("AAPL", "Apple", NOW - timedelta(days=90 * i),
                          eps_estimate=1.0, eps_actual=1.0 + 0.1 * (i + 1),
                          is_reported=True, fiscal_quarter=f"Q{i+1}")
            for i in range(4)
        ]
        result = EarningsAnalyzer.earnings_momentum(events)
        assert result["consecutive_beats"] == 4
        assert result["total_reported"] == 4

    def test_earnings_momentum_insufficient(self):
        result = EarningsAnalyzer.earnings_momentum([])
        assert result["trend"] == "insufficient_data"


# ═══════════════════════════════════════════════════════════════════════════
# SeasonalPatternAnalyzer
# ═══════════════════════════════════════════════════════════════════════════

class TestSeasonalPatternAnalyzer:
    def test_monthly_seasonality(self):
        data = [(m, 0.01 * m) for m in range(1, 13)] * 3
        result = SeasonalPatternAnalyzer.monthly_seasonality(data)
        assert len(result) == 12
        assert result[1]["count"] == 3
        assert result[12]["mean"] == pytest.approx(0.12)

    def test_day_of_week_effect(self):
        data = [(d, 0.001 * d) for d in range(5)] * 10
        result = SeasonalPatternAnalyzer.day_of_week_effect(data)
        assert len(result) == 5
        assert result[0]["name"] == "Monday"
        assert result[4]["name"] == "Friday"

    def test_holiday_effect(self):
        pre = [0.005, 0.003, 0.004]
        post = [-0.001, 0.001, 0.002]
        normal = [0.001, 0.001, 0.001]
        result = SeasonalPatternAnalyzer.holiday_effect(pre, post, normal)
        assert result["pre_holiday_premium"] > 0
        assert result["pre_holiday_avg"] > result["normal_avg"]


# ═══════════════════════════════════════════════════════════════════════════
# EventCalendarManager
# ═══════════════════════════════════════════════════════════════════════════

class TestEventCalendarManager:
    @pytest.fixture
    def manager(self):
        mgr = EventCalendarManager()
        # Add economic events
        mgr.add_economic_event(EconomicEvent(
            "E1", "NFP", EventCategory.ECONOMIC, EventImportance.CRITICAL,
            NOW + timedelta(days=1), country=Country.US))
        mgr.add_economic_event(EconomicEvent(
            "E2", "CPI", EventCategory.ECONOMIC, EventImportance.HIGH,
            NOW + timedelta(days=3), country=Country.US))
        mgr.add_economic_event(EconomicEvent(
            "E3", "ECB Rate", EventCategory.CENTRAL_BANK, EventImportance.CRITICAL,
            NOW + timedelta(days=2), country=Country.EU))
        # Earnings
        mgr.add_earnings_event(EarningsEvent("AAPL", "Apple", NOW + timedelta(days=2)))
        # Dividend
        mgr.add_dividend_event(DividendEvent("MSFT", NOW + timedelta(days=4), amount=0.75))
        # IPO
        mgr.add_ipo_event(IPOEvent("NEW1", "NewCo", NOW + timedelta(days=5)))
        return mgr

    def test_upcoming_events(self, manager):
        events = manager.upcoming_events(days=7, from_date=NOW)
        assert len(events) >= 4  # At least econ + earnings + div + ipo

    def test_events_by_importance(self, manager):
        critical = manager.events_by_importance(EventImportance.CRITICAL)
        assert len(critical) == 2

    def test_events_by_country(self, manager):
        us = manager.events_by_country(Country.US)
        assert len(us) == 2

    def test_events_by_category(self, manager):
        cb = manager.events_by_category(EventCategory.CENTRAL_BANK)
        assert len(cb) == 1

    def test_dividends_by_symbol(self, manager):
        divs = manager.dividends_by_symbol("MSFT")
        assert len(divs) == 1
        assert divs[0].amount == 0.75

    def test_event_density(self, manager):
        density = manager.event_density(NOW, NOW + timedelta(days=7))
        assert isinstance(density, dict)
        total = sum(density.values())
        assert total >= 3  # At least our 3 economic events

    def test_high_impact_events(self, manager):
        high = manager.high_impact_events(from_date=NOW, days=7)
        # Should include NFP and ECB Rate (both CRITICAL)
        assert len(high) >= 2

    def test_conflict_detection(self, manager):
        # Add conflicting events
        manager.add_economic_event(EconomicEvent(
            "C1", "Evt1", EventCategory.ECONOMIC, EventImportance.CRITICAL,
            NOW + timedelta(hours=1)))
        manager.add_economic_event(EconomicEvent(
            "C2", "Evt2", EventCategory.ECONOMIC, EventImportance.HIGH,
            NOW + timedelta(hours=1, minutes=30)))
        conflicts = manager.conflict_detection(NOW, NOW + timedelta(days=1))
        assert isinstance(conflicts, list)


# ═══════════════════════════════════════════════════════════════════════════
# EventVolatilityForecaster
# ═══════════════════════════════════════════════════════════════════════════

class TestEventVolatilityForecaster:
    def test_expected_move(self):
        moves = [0.5, -0.3, 0.8, -0.2, 0.4, -0.6, 1.0, -0.4]
        result = EventVolatilityForecaster.expected_move(moves)
        assert result["expected_move"] > 0
        assert result["range_low"] < result["range_high"]
        assert result["sample_size"] == 8

    def test_expected_move_empty(self):
        result = EventVolatilityForecaster.expected_move([])
        assert result["expected_move"] == 0.0

    def test_implied_vs_realized(self):
        result = EventVolatilityForecaster.implied_vs_realized(0.30, [0.01, -0.02, 0.015, -0.005])
        assert "iv_rv_ratio" in result
        assert isinstance(result["overpriced"], bool)

    def test_expected_move_confidence(self):
        moves = [0.5, -0.3, 0.8, -0.2]
        r68 = EventVolatilityForecaster.expected_move(moves, 0.68)
        r95 = EventVolatilityForecaster.expected_move(moves, 0.95)
        # 95% range should be wider
        assert (r95["range_high"] - r95["range_low"]) >= (r68["range_high"] - r68["range_low"])


# ═══════════════════════════════════════════════════════════════════════════
# EconomicCalendarEngine (Orchestrator)
# ═══════════════════════════════════════════════════════════════════════════

class TestEconomicCalendarEngine:
    @pytest.fixture
    def engine(self):
        eng = EconomicCalendarEngine()
        # Populate with test data
        for i in range(10):
            eng.add_economic_event(
                event_id=f"E{i}",
                name=f"Event_{i}",
                category=EventCategory.ECONOMIC,
                importance=EventImportance.HIGH if i % 2 == 0 else EventImportance.MEDIUM,
                scheduled_time=NOW + timedelta(days=i),
                country=Country.US,
                indicator=EconomicIndicator.GDP if i % 3 == 0 else None,
                consensus=100.0,
                actual=100.0 + (i - 5) * 2 if i < 7 else None,
                is_released=i < 7,
            )
        eng.add_earnings_event(
            symbol="AAPL", company_name="Apple", report_date=NOW + timedelta(days=1),
            eps_estimate=1.50, eps_actual=1.65, is_reported=True)
        eng.add_earnings_event(
            symbol="MSFT", company_name="Microsoft", report_date=NOW + timedelta(days=2),
            eps_estimate=2.00, eps_actual=2.10, is_reported=True)
        eng.add_dividend_event(
            symbol="JNJ", ex_date=NOW + timedelta(days=3), amount=1.19)
        eng.add_ipo_event(
            symbol="NEWCO", company_name="NewCo Inc",
            expected_date=NOW + timedelta(days=5), price_range_low=15, price_range_high=18)
        return eng

    def test_upcoming(self, engine):
        events = engine.upcoming(days=14, from_date=NOW)
        assert len(events) >= 5

    def test_surprise_index(self, engine):
        idx = engine.surprise_index()
        assert isinstance(idx, float)

    def test_surprise_by_indicator(self, engine):
        result = engine.surprise_by_indicator()
        assert isinstance(result, dict)

    def test_event_impact(self, engine):
        moves = [0.5, -0.3, 0.8]
        result = engine.event_impact("NFP", moves)
        assert "avg_move_pct" in result

    def test_conditional_impact(self, engine):
        result = engine.conditional_impact("Test", [1, -1, 0.5], [0.5, -0.3, 0.2])
        assert "beat_avg_move" in result

    def test_pre_event_volatility(self, engine):
        prices = [100 + i * 0.1 + np.random.normal(0, 0.5) for i in range(50)]
        result = engine.pre_event_volatility(prices, 25)
        assert "pre_event_vol" in result

    def test_earnings_summary(self, engine):
        result = engine.earnings_summary()
        assert result["beats"] == 2

    def test_earnings_momentum(self, engine):
        result = engine.earnings_momentum("AAPL")
        assert isinstance(result, dict)

    def test_monthly_seasonality(self, engine):
        data = [(m, 0.01 * m) for m in range(1, 13)]
        result = engine.monthly_seasonality(data)
        assert 1 in result and 12 in result

    def test_day_of_week(self, engine):
        data = [(d, 0.001) for d in range(5)]
        result = engine.day_of_week_effect(data)
        assert 0 in result

    def test_expected_event_move(self, engine):
        result = engine.expected_event_move([0.5, -0.3, 0.8])
        assert result["expected_move"] > 0

    def test_event_density(self, engine):
        density = engine.event_density(NOW, NOW + timedelta(days=14))
        assert isinstance(density, dict)

    def test_conflict_detection(self, engine):
        conflicts = engine.conflict_detection(NOW, NOW + timedelta(days=14))
        assert isinstance(conflicts, list)

    def test_capabilities(self, engine):
        caps = engine.capabilities()
        assert caps["engine"] == "EconomicCalendarEngine"
        assert len(caps["features"]) >= 10
        assert "earnings_calendar" in caps["features"]

    def test_high_impact(self, engine):
        high = engine.high_impact(days=14)
        assert isinstance(high, list)
