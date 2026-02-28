"""
Comprehensive tests for EventDrivenEngine.
Tests: EarningsEventAnalyzer, MergerArbAnalyzer, IndexRebalancingAnalyzer,
AbnormalReturnDetector, SpecialSituationsAnalyzer, EventCalendar,
EventStudyFramework, and the orchestrator.
"""
import math
import random
import pytest

from phase1.services.event_driven_engine import (
    EventType, EventImpact, MergerStatus, EarningsSurprise,
    CorporateEvent, MergerDeal, EventWindowReturn,
    EarningsEventAnalyzer, MergerArbAnalyzer,
    IndexRebalancingAnalyzer, AbnormalReturnDetector,
    SpecialSituationsAnalyzer, EventCalendar,
    EventStudyFramework, EventDrivenEngine,
)


# ═══════════════════════════════════════════════════════════════════════
# Enums
# ═══════════════════════════════════════════════════════════════════════

class TestEnums:
    def test_event_types(self):
        assert len(EventType) == 18
        assert EventType.EARNINGS.value == "earnings"
        assert EventType.MERGER_ANNOUNCEMENT.value == "merger_announcement"
        assert EventType.STOCK_SPLIT.value == "stock_split"
        assert EventType.SPINOFF.value == "spinoff"

    def test_event_impact(self):
        assert EventImpact.VERY_POSITIVE.value == "very_positive"
        assert EventImpact.POSITIVE.value == "positive"
        assert EventImpact.NEUTRAL.value == "neutral"
        assert EventImpact.NEGATIVE.value == "negative"
        assert EventImpact.VERY_NEGATIVE.value == "very_negative"

    def test_merger_status(self):
        assert MergerStatus.ANNOUNCED.value == "announced"
        assert MergerStatus.COMPLETED.value == "completed"
        assert MergerStatus.TERMINATED.value == "terminated"

    def test_earnings_surprise(self):
        assert EarningsSurprise.BEAT.value == "beat"
        assert EarningsSurprise.MISS.value == "miss"
        assert EarningsSurprise.MEET.value == "meet"
        assert EarningsSurprise.HUGE_BEAT.value == "huge_beat"
        assert EarningsSurprise.HUGE_MISS.value == "huge_miss"


# ═══════════════════════════════════════════════════════════════════════
# CorporateEvent
# ═══════════════════════════════════════════════════════════════════════

class TestCorporateEvent:
    def test_basic(self):
        ev = CorporateEvent(
            symbol="AAPL",
            event_type=EventType.EARNINGS,
            event_date="2024-01-25",
            description="Q1 2024 earnings",
        )
        assert ev.event_type == EventType.EARNINGS
        assert ev.symbol == "AAPL"

    def test_to_dict(self):
        ev = CorporateEvent(
            symbol="MSFT",
            event_type=EventType.DIVIDEND_RAISE,
            event_date="2024-03-15",
            description="Dividend increase",
        )
        d = ev.to_dict()
        assert d["symbol"] == "MSFT"
        assert d["type"] == "dividend_raise"
        assert d["date"] == "2024-03-15"

    def test_confidence(self):
        ev = CorporateEvent(
            symbol="GOOG",
            event_type=EventType.SPINOFF,
            event_date="2024-06-01",
            confidence=0.9,
        )
        assert ev.confidence == 0.9


# ═══════════════════════════════════════════════════════════════════════
# MergerDeal
# ═══════════════════════════════════════════════════════════════════════

class TestMergerDeal:
    def test_basic(self):
        deal = MergerDeal(
            target="VMW",
            acquirer="AVGO",
            offer_price=142.50,
            announced_date="2023-05-01",
            expected_close_date="2024-01-01",
            status=MergerStatus.ANNOUNCED,
        )
        assert deal.acquirer == "AVGO"
        assert deal.offer_price == 142.50

    def test_days_to_close(self):
        deal = MergerDeal(
            target="B",
            acquirer="A",
            offer_price=100,
            status=MergerStatus.ANNOUNCED,
        )
        assert deal.days_to_close > 0

    def test_completed_days_to_close(self):
        deal = MergerDeal(
            target="X",
            acquirer="Y",
            offer_price=50,
            status=MergerStatus.COMPLETED,
        )
        assert deal.days_to_close == 0

    def test_terminated_days_to_close(self):
        deal = MergerDeal(
            target="X",
            acquirer="Y",
            offer_price=50,
            status=MergerStatus.TERMINATED,
        )
        assert deal.days_to_close == -1


# ═══════════════════════════════════════════════════════════════════════
# EventWindowReturn
# ═══════════════════════════════════════════════════════════════════════

class TestEventWindowReturn:
    def test_cumulative_pre(self):
        ewr = EventWindowReturn(
            pre_event=[0.01, 0.02, -0.005],
            event_day=0.05,
            post_event=[0.01, -0.02],
        )
        assert ewr.cumulative_pre != 0

    def test_cumulative_post(self):
        ewr = EventWindowReturn(
            pre_event=[0.01],
            event_day=0.05,
            post_event=[0.03, -0.01],
        )
        assert ewr.cumulative_post != 0

    def test_total_return(self):
        ewr = EventWindowReturn(
            pre_event=[0.01],
            event_day=0.05,
            post_event=[0.03],
        )
        assert ewr.total_return > 0

    def test_empty(self):
        ewr = EventWindowReturn()
        assert ewr.cumulative_pre == 0
        assert ewr.cumulative_post == 0


# ═══════════════════════════════════════════════════════════════════════
# EarningsEventAnalyzer
# ═══════════════════════════════════════════════════════════════════════

class TestEarningsEventAnalyzer:
    def test_beat(self):
        result = EarningsEventAnalyzer.classify_surprise(1.50, 1.20)
        assert result["category"] in ("beat", "huge_beat")
        assert result["surprise_pct"] > 0

    def test_miss(self):
        result = EarningsEventAnalyzer.classify_surprise(0.80, 1.20)
        assert result["category"] in ("miss", "huge_miss")
        assert result["surprise_pct"] < 0

    def test_meet(self):
        result = EarningsEventAnalyzer.classify_surprise(1.20, 1.20)
        assert result["category"] == "meet"
        assert abs(result["surprise_pct"]) < 2.0

    def test_zero_consensus(self):
        result = EarningsEventAnalyzer.classify_surprise(0.50, 0.0)
        assert "category" in result

    def test_expected_move(self):
        move = EarningsEventAnalyzer.expected_move(0.45, 30)
        assert move > 0

    def test_expected_move_zero_iv(self):
        move = EarningsEventAnalyzer.expected_move(0.0, 30)
        assert move == 0.0

    def test_expected_move_zero_days(self):
        move = EarningsEventAnalyzer.expected_move(0.30, 0)
        assert move == 0.0

    def test_post_earnings_drift(self):
        result = EarningsEventAnalyzer.post_earnings_drift(15.0, [0.001]*20)
        assert "expected_drift" in result
        assert "direction" in result

    def test_negative_surprise_drift(self):
        result = EarningsEventAnalyzer.post_earnings_drift(-10.0, [0.001]*20)
        assert result["direction"] == "down"

    def test_flat_surprise_drift(self):
        result = EarningsEventAnalyzer.post_earnings_drift(0.5, [0.001]*20)
        assert result["direction"] == "flat"

    def test_earnings_quality_score(self):
        result = EarningsEventAnalyzer.earnings_quality_score(
            revenue_surprise_pct=5.0,
            eps_surprise_pct=10.0,
            guidance_vs_consensus=2.0,
            revenue_growth=0.15,
        )
        assert 0 <= result["score"] <= 100
        assert "assessment" in result

    def test_earnings_quality_poor(self):
        result = EarningsEventAnalyzer.earnings_quality_score(
            revenue_surprise_pct=-10.0,
            eps_surprise_pct=-15.0,
            guidance_vs_consensus=-2.0,
        )
        assert result["score"] < 50

    @pytest.mark.parametrize("surprise_pct", [-20, -10, -5, 0, 5, 10, 20])
    def test_drift_various_surprises(self, surprise_pct):
        result = EarningsEventAnalyzer.post_earnings_drift(surprise_pct, [0.001]*20)
        assert isinstance(result, dict)


# ═══════════════════════════════════════════════════════════════════════
# MergerArbAnalyzer
# ═══════════════════════════════════════════════════════════════════════

class TestMergerArbAnalyzer:
    def test_calculate_spread(self):
        result = MergerArbAnalyzer.calculate_spread(
            target_price=130.0,
            offer_price=142.50,
        )
        assert result["spread"] > 0
        assert result["spread_pct"] > 0

    def test_no_spread(self):
        result = MergerArbAnalyzer.calculate_spread(142.50, 142.50)
        assert abs(result["spread"]) < 0.01

    def test_negative_spread(self):
        result = MergerArbAnalyzer.calculate_spread(145.0, 142.50)
        assert result["spread"] < 0

    def test_stock_deal_spread(self):
        result = MergerArbAnalyzer.calculate_spread(
            target_price=50.0,
            offer_price=0,
            acquirer_price=100.0,
            exchange_ratio=0.6,
        )
        assert "effective_offer" in result

    def test_annualized_return(self):
        ret = MergerArbAnalyzer.annualized_return(5.0, 90)
        assert ret > 5.0

    def test_annualized_return_full_year(self):
        ret = MergerArbAnalyzer.annualized_return(10.0, 365)
        assert abs(ret - 10.0) < 0.1

    def test_annualized_return_zero_days(self):
        ret = MergerArbAnalyzer.annualized_return(5.0, 0)
        assert ret == 0.0

    def test_risk_adjusted_return(self):
        result = MergerArbAnalyzer.risk_adjusted_return(
            spread_pct=5.0,
            days_to_close=90,
            completion_probability=0.85,
            downside_if_fail=-20.0,
        )
        assert "expected_return" in result
        assert "profitable" in result
        assert "raw_ann_return" in result

    def test_deal_break_cost(self):
        cost = MergerArbAnalyzer.deal_break_cost(130.0, 100.0)
        assert cost > 0

    @pytest.mark.parametrize("comp_prob", [0.5, 0.7, 0.85, 0.95, 1.0])
    def test_various_completion_probs(self, comp_prob):
        result = MergerArbAnalyzer.risk_adjusted_return(
            5.0, 90, comp_prob, -20.0
        )
        assert isinstance(result["expected_return"], float)


# ═══════════════════════════════════════════════════════════════════════
# IndexRebalancingAnalyzer
# ═══════════════════════════════════════════════════════════════════════

class TestIndexRebalancingAnalyzer:
    @pytest.mark.parametrize("index_name", ["SP500", "NASDAQ100", "RUSSELL2000", "DJIA"])
    def test_addition_impact(self, index_name):
        result = IndexRebalancingAnalyzer.expected_impact(
            index_name=index_name,
            is_addition=True,
            market_cap=50_000_000_000,
        )
        assert result["total_expected"] > 0

    @pytest.mark.parametrize("index_name", ["SP500", "NASDAQ100", "RUSSELL2000"])
    def test_deletion_impact(self, index_name):
        result = IndexRebalancingAnalyzer.expected_impact(
            index_name=index_name,
            is_addition=False,
            market_cap=50_000_000_000,
        )
        assert result["total_expected"] < 0

    def test_unknown_index(self):
        result = IndexRebalancingAnalyzer.expected_impact("UNKNOWN", True, 1e10)
        assert isinstance(result, dict)
        assert "total_expected" in result

    def test_small_cap_larger_impact(self):
        r_small = IndexRebalancingAnalyzer.expected_impact("SP500", True, 2_000_000_000)
        r_large = IndexRebalancingAnalyzer.expected_impact("SP500", True, 500_000_000_000)
        assert abs(r_small["total_expected"]) >= abs(r_large["total_expected"])


# ═══════════════════════════════════════════════════════════════════════
# AbnormalReturnDetector
# ═══════════════════════════════════════════════════════════════════════

class TestAbnormalReturnDetector:
    def _generate_returns(self, n=250, seed=42):
        rng = random.Random(seed)
        return [rng.gauss(0.001, 0.02) for _ in range(n)]

    def test_basic_car(self):
        stock = self._generate_returns(250, seed=42)
        market = self._generate_returns(250, seed=99)
        # Inject big positive event at index 160
        stock[160] = 0.10
        result = AbnormalReturnDetector.calculate_car(
            stock, market, event_index=160, pre_window=10, post_window=5, estimation_window=120
        )
        assert "car" in result
        assert result["car"] != 0

    def test_negative_event(self):
        stock = self._generate_returns(250, seed=42)
        market = self._generate_returns(250, seed=99)
        stock[160] = -0.08
        result = AbnormalReturnDetector.calculate_car(
            stock, market, event_index=160, pre_window=10, post_window=5, estimation_window=120
        )
        assert "car" in result

    def test_no_event_impact(self):
        stock = [0.001] * 250
        market = [0.001] * 250
        result = AbnormalReturnDetector.calculate_car(
            stock, market, event_index=160, pre_window=10, post_window=5, estimation_window=120
        )
        assert abs(result["car"]) < 0.01

    def test_significance(self):
        stock = self._generate_returns(250, seed=42)
        market = self._generate_returns(250, seed=99)
        stock[160] = 0.15
        result = AbnormalReturnDetector.calculate_car(
            stock, market, event_index=160, pre_window=10, post_window=10, estimation_window=120
        )
        assert "t_stat" in result
        assert "significant" in result

    def test_classify_impact_positive(self):
        impact = AbnormalReturnDetector.classify_impact(0.06)
        assert impact == EventImpact.VERY_POSITIVE

    def test_classify_impact_negative(self):
        impact = AbnormalReturnDetector.classify_impact(-0.06)
        assert impact == EventImpact.VERY_NEGATIVE

    def test_classify_impact_neutral(self):
        impact = AbnormalReturnDetector.classify_impact(0.005)
        assert impact == EventImpact.NEUTRAL


# ═══════════════════════════════════════════════════════════════════════
# SpecialSituationsAnalyzer
# ═══════════════════════════════════════════════════════════════════════

class TestSpecialSituationsAnalyzer:
    def test_spinoff_value(self):
        result = SpecialSituationsAnalyzer.spinoff_value(
            parent_market_cap=50_000_000_000,
            spinoff_revenue=5_000_000_000,
            parent_revenue=20_000_000_000,
            sector_ev_revenue_multiple=3.0,
        )
        assert result["spinoff_value"] > 0
        assert result["pct_of_parent"] > 0

    def test_buyback_impact(self):
        result = SpecialSituationsAnalyzer.buyback_impact(
            shares_outstanding=1_000_000_000,
            buyback_amount=5_000_000_000,
            current_price=150.0,
        )
        assert result["shares_retired"] > 0
        assert result["eps_accretion_pct"] > 0

    def test_rights_offering_dilution(self):
        result = SpecialSituationsAnalyzer.rights_offering_dilution(
            shares_outstanding=100_000_000,
            new_shares=20_000_000,
            subscription_price=40.0,
            market_price=50.0,
        )
        assert result["dilution_pct"] > 0
        assert result["terp"] < 50.0

    def test_buyback_zero_amount(self):
        result = SpecialSituationsAnalyzer.buyback_impact(
            shares_outstanding=1_000_000,
            buyback_amount=0,
            current_price=100.0,
        )
        assert result["shares_retired"] == 0


# ═══════════════════════════════════════════════════════════════════════
# EventCalendar
# ═══════════════════════════════════════════════════════════════════════

class TestEventCalendar:
    @pytest.fixture
    def calendar(self):
        cal = EventCalendar()
        cal.add_event(CorporateEvent("AAPL", EventType.EARNINGS, "2024-01-25"))
        cal.add_event(CorporateEvent("AAPL", EventType.DIVIDEND_RAISE, "2024-02-15"))
        cal.add_event(CorporateEvent("MSFT", EventType.EARNINGS, "2024-01-23"))
        cal.add_event(CorporateEvent("VMW", EventType.MERGER_ANNOUNCEMENT, "2024-03-01"))
        cal.add_event(CorporateEvent("NVDA", EventType.STOCK_SPLIT, "2024-06-10"))
        return cal

    def test_add_events(self, calendar):
        assert calendar.count == 5

    def test_filter_by_type(self, calendar):
        earnings = calendar.filter_by_type(EventType.EARNINGS)
        assert len(earnings) == 2

    def test_filter_by_symbol(self, calendar):
        aapl = calendar.filter_by_symbol("AAPL")
        assert len(aapl) == 2

    def test_upcoming(self, calendar):
        upcoming = calendar.upcoming(3)
        assert len(upcoming) == 3

    def test_summary(self, calendar):
        summary = calendar.summary()
        assert summary["total_events"] == 5
        assert "by_type" in summary

    def test_empty_calendar(self):
        cal = EventCalendar()
        assert cal.summary()["total_events"] == 0

    def test_filter_empty_result(self, calendar):
        result = calendar.filter_by_type(EventType.FDA_DECISION)
        assert len(result) == 0

    def test_filter_by_date_range(self, calendar):
        result = calendar.filter_by_date_range("2024-01-01", "2024-02-28")
        assert len(result) >= 2

    def test_add_events_batch(self):
        cal = EventCalendar()
        events = [
            CorporateEvent("A", EventType.EARNINGS, "2024-01-01"),
            CorporateEvent("B", EventType.EARNINGS, "2024-02-01"),
        ]
        cal.add_events(events)
        assert cal.count == 2


# ═══════════════════════════════════════════════════════════════════════
# EventStudyFramework
# ═══════════════════════════════════════════════════════════════════════

class TestEventStudyFramework:
    def test_aggregate_cars(self):
        events = [
            {"car": 0.05, "t_stat": 2.5},
            {"car": 0.03, "t_stat": 1.8},
            {"car": -0.02, "t_stat": -1.2},
            {"car": 0.08, "t_stat": 3.1},
        ]
        result = EventStudyFramework.aggregate_cars(events)
        assert "avg_car" in result
        assert "median_car" in result
        assert "pct_positive" in result
        assert result["n_events"] == 4

    def test_empty_events(self):
        result = EventStudyFramework.aggregate_cars([])
        assert result["n_events"] == 0

    def test_all_positive(self):
        events = [
            {"car": 0.10, "t_stat": 3.0},
            {"car": 0.08, "t_stat": 2.5},
        ]
        result = EventStudyFramework.aggregate_cars(events)
        assert result["pct_positive"] == 100.0


# ═══════════════════════════════════════════════════════════════════════
# EventDrivenEngine Orchestrator
# ═══════════════════════════════════════════════════════════════════════

class TestEventDrivenEngine:
    @pytest.fixture
    def engine(self):
        return EventDrivenEngine()

    def test_analyze_earnings_event(self, engine):
        result = engine.analyze_earnings_event(
            actual_eps=1.50,
            consensus_eps=1.20,
            implied_vol=0.45,
        )
        assert "surprise" in result
        assert "expected_move_pct" in result
        assert "post_earnings_drift" in result

    def test_analyze_merger(self, engine):
        result = engine.analyze_merger(
            target_price=130.0,
            offer_price=142.50,
            days_to_close=90,
        )
        assert "spread" in result
        assert "risk_adjusted" in result

    def test_capabilities(self, engine):
        caps = engine.capabilities()
        assert caps["engine"] == "EventDrivenEngine"
        assert len(caps["features"]) > 5
        assert len(caps["event_types"]) == 18


# ═══════════════════════════════════════════════════════════════════════
# Parametric Tests
# ═══════════════════════════════════════════════════════════════════════

class TestParametric:
    @pytest.mark.parametrize("actual,consensus", [
        (1.50, 1.20), (1.00, 1.00), (0.80, 1.20),
        (2.00, 1.50), (0.50, 0.50), (-0.10, 0.10),
    ])
    def test_earnings_classify(self, actual, consensus):
        result = EarningsEventAnalyzer.classify_surprise(actual, consensus)
        assert "category" in result
        assert result["category"] in ("beat", "miss", "meet", "huge_beat", "huge_miss")

    @pytest.mark.parametrize("iv", [0.10, 0.20, 0.30, 0.50, 0.80, 1.00])
    def test_expected_move_various_iv(self, iv):
        move = EarningsEventAnalyzer.expected_move(iv, 30)
        assert move >= 0

    @pytest.mark.parametrize("spread,days", [
        (2.0, 30), (5.0, 90), (10.0, 180), (15.0, 365),
    ])
    def test_merger_annualized(self, spread, days):
        ret = MergerArbAnalyzer.annualized_return(spread, days)
        assert ret >= spread if days <= 365 else True


# ═══════════════════════════════════════════════════════════════════════
# Stress Tests
# ═══════════════════════════════════════════════════════════════════════

class TestStress:
    def test_many_events(self):
        cal = EventCalendar()
        for i in range(1000):
            cal.add_event(CorporateEvent(
                f"SYM{i}", EventType.EARNINGS, f"2024-{(i%12)+1:02d}-{(i%28)+1:02d}"
            ))
        assert cal.count == 1000
        summary = cal.summary()
        assert summary["total_events"] == 1000

    def test_aggregate_many_cars(self):
        rng = random.Random(42)
        events = [
            {"car": rng.gauss(0.02, 0.05), "t_stat": rng.gauss(1.5, 1.0),
             "significant": rng.random() > 0.5}
            for _ in range(500)
        ]
        result = EventStudyFramework.aggregate_cars(events)
        assert result["n_events"] == 500
        assert abs(result["avg_car"] - 0.02) < 0.01

    def test_large_merger_analysis(self):
        for _ in range(100):
            result = MergerArbAnalyzer.risk_adjusted_return(
                spread_pct=random.uniform(1, 20),
                days_to_close=random.randint(30, 365),
                completion_probability=random.uniform(0.70, 1.0),
                downside_if_fail=-random.uniform(5, 30),
            )
            assert isinstance(result["expected_return"], float)
