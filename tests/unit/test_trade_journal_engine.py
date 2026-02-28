"""Tests for trade_journal_engine.py — comprehensive coverage."""

import math
import statistics
from datetime import datetime, timedelta

import pytest

from services.trade_journal_engine import (
    CalendarHeatmapBuilder,
    CostAnalyzer,
    DisciplineScorer,
    EmotionalState,
    EquityCurveBuilder,
    HoldingPeriodAnalyzer,
    JournalTrade,
    MistakeType,
    PerformanceAnalyzer,
    RMultipleAnalyzer,
    SetupType,
    StreakAnalyzer,
    TimeSession,
    TradeComparator,
    TradeDirection,
    TradeJournal,
    TradeJournalEngine,
    TradeStatus,
)


# ── Helpers ─────────────────────────────────────────────────────────────

def _make_trade(
    trade_id: str = "T001",
    symbol: str = "AAPL",
    direction: TradeDirection = TradeDirection.LONG,
    entry_price: float = 100.0,
    exit_price: float | None = 110.0,
    quantity: float = 10,
    entry_time: datetime | None = None,
    exit_time: datetime | None = None,
    status: TradeStatus = TradeStatus.CLOSED,
    setup_type: SetupType = SetupType.BREAKOUT,
    commission: float = 1.0,
    slippage: float = 0.5,
    planned_risk: float | None = 50.0,
    confidence_level: int = 7,
    followed_plan: bool = True,
    tags: list[str] | None = None,
    mistakes: list[MistakeType] | None = None,
    emotional_state_entry: EmotionalState = EmotionalState.CALM,
    emotional_state_exit: EmotionalState | None = EmotionalState.CALM,
) -> JournalTrade:
    if entry_time is None:
        entry_time = datetime(2024, 6, 10, 10, 30)
    if exit_time is None and status == TradeStatus.CLOSED:
        exit_time = datetime(2024, 6, 10, 14, 30)
    return JournalTrade(
        trade_id=trade_id,
        symbol=symbol,
        direction=direction,
        entry_price=entry_price,
        exit_price=exit_price,
        quantity=quantity,
        entry_time=entry_time,
        exit_time=exit_time,
        status=status,
        setup_type=setup_type,
        commission=commission,
        slippage=slippage,
        planned_risk=planned_risk,
        confidence_level=confidence_level,
        followed_plan=followed_plan,
        tags=tags or ["momentum", "breakout"],
        mistakes=mistakes or [],
        emotional_state_entry=emotional_state_entry,
        emotional_state_exit=emotional_state_exit,
    )


def _make_sample_trades(n: int = 10) -> list[JournalTrade]:
    """Generate n sample trades with alternating wins/losses."""
    trades = []
    base = datetime(2024, 6, 3, 10, 0)
    setups = list(SetupType)
    for i in range(n):
        is_win = i % 3 != 0  # ~66% win rate
        entry_price = 100.0 + i
        exit_price = entry_price + (5 if is_win else -3)
        t = _make_trade(
            trade_id=f"T{i:03d}",
            symbol="AAPL" if i % 2 == 0 else "MSFT",
            entry_price=entry_price,
            exit_price=exit_price,
            entry_time=base + timedelta(days=i, hours=i % 6),
            exit_time=base + timedelta(days=i, hours=i % 6 + 4),
            setup_type=setups[i % len(setups)],
            planned_risk=30.0,
            confidence_level=5 + (i % 5),
            followed_plan=i % 4 != 0,
            tags=["tag_a"] if i % 2 == 0 else ["tag_b"],
            mistakes=[MistakeType.EARLY_ENTRY] if i % 5 == 0 else [],
        )
        trades.append(t)
    return trades


# ── JournalTrade Properties ────────────────────────────────────────────

class TestJournalTrade:
    def test_pnl_long_winner(self):
        t = _make_trade(entry_price=100, exit_price=110, quantity=10, commission=1, slippage=0.5)
        assert t.pnl == pytest.approx(98.5)  # (110-100)*10 - 1 - 0.5

    def test_pnl_long_loser(self):
        t = _make_trade(entry_price=100, exit_price=90, quantity=10, commission=1, slippage=0.5)
        assert t.pnl == pytest.approx(-101.5)

    def test_pnl_short_winner(self):
        t = _make_trade(direction=TradeDirection.SHORT, entry_price=110, exit_price=100, quantity=10, commission=1, slippage=0.5)
        assert t.pnl == pytest.approx(98.5)

    def test_pnl_short_loser(self):
        t = _make_trade(direction=TradeDirection.SHORT, entry_price=100, exit_price=110, quantity=10, commission=1, slippage=0.5)
        assert t.pnl == pytest.approx(-101.5)

    def test_pnl_open_trade(self):
        t = _make_trade(exit_price=None, status=TradeStatus.OPEN)
        assert t.pnl == 0.0

    def test_pnl_pct(self):
        t = _make_trade(entry_price=100, exit_price=110, quantity=10)
        expected_pct = (t.pnl / (100 * 10)) * 100
        assert t.pnl_pct == pytest.approx(expected_pct)

    def test_r_multiple(self):
        t = _make_trade(planned_risk=50.0)
        assert t.r_multiple == pytest.approx(t.pnl / 50.0)

    def test_r_multiple_none(self):
        t = _make_trade(planned_risk=None)
        assert t.r_multiple is None

    def test_holding_period(self):
        t = _make_trade(
            entry_time=datetime(2024, 6, 10, 10, 0),
            exit_time=datetime(2024, 6, 10, 14, 0),
        )
        assert t.holding_hours == pytest.approx(4.0)

    def test_holding_period_open(self):
        t = _make_trade(exit_price=None, status=TradeStatus.OPEN, exit_time=None)
        # Need to explicitly set exit_time=None
        t.exit_time = None
        assert t.holding_period is None
        assert t.holding_hours is None

    def test_is_winner(self):
        assert _make_trade(exit_price=110).is_winner is True
        assert _make_trade(exit_price=90).is_winner is False

    def test_session_morning(self):
        t = _make_trade(entry_time=datetime(2024, 6, 10, 10, 30))
        assert t.session == TimeSession.MORNING

    def test_session_afternoon(self):
        t = _make_trade(entry_time=datetime(2024, 6, 10, 15, 0))
        assert t.session == TimeSession.AFTERNOON

    def test_session_pre_market(self):
        t = _make_trade(entry_time=datetime(2024, 6, 10, 7, 0))
        assert t.session == TimeSession.PRE_MARKET

    def test_session_after_hours(self):
        t = _make_trade(entry_time=datetime(2024, 6, 10, 17, 0))
        assert t.session == TimeSession.AFTER_HOURS

    def test_session_midday(self):
        t = _make_trade(entry_time=datetime(2024, 6, 10, 12, 30))
        assert t.session == TimeSession.MIDDAY

    def test_to_dict(self):
        t = _make_trade()
        d = t.to_dict()
        assert d["trade_id"] == "T001"
        assert d["symbol"] == "AAPL"
        assert d["direction"] == "long"
        assert d["pnl"] == round(t.pnl, 2)
        assert d["session"] in ["morning", "afternoon", "midday", "pre_market", "after_hours"]


# ── TradeJournal CRUD ──────────────────────────────────────────────────

class TestTradeJournal:
    def test_add_trade(self):
        journal = TradeJournal()
        t = _make_trade(status=TradeStatus.OPEN, exit_price=None)
        tid = journal.add_trade(t)
        assert tid == "T001"
        assert len(journal.get_all_trades()) == 1

    def test_close_trade(self):
        journal = TradeJournal()
        t = _make_trade(trade_id="T100", status=TradeStatus.OPEN, exit_price=None)
        journal.add_trade(t)
        closed = journal.close_trade("T100", exit_price=120.0, exit_time=datetime(2024, 6, 11, 10, 0))
        assert closed is not None
        assert closed.status == TradeStatus.CLOSED
        assert closed.exit_price == 120.0

    def test_close_nonexistent(self):
        journal = TradeJournal()
        assert journal.close_trade("NOPE", 100.0, datetime.now()) is None

    def test_get_open_closed(self):
        journal = TradeJournal()
        journal.add_trade(_make_trade(trade_id="T1", status=TradeStatus.CLOSED))
        journal.add_trade(_make_trade(trade_id="T2", status=TradeStatus.OPEN, exit_price=None))
        assert len(journal.get_closed_trades()) == 1
        assert len(journal.get_open_trades()) == 1

    def test_summary_empty(self):
        journal = TradeJournal()
        s = journal.summary()
        assert s["total_trades"] == 0

    def test_summary_with_trades(self):
        journal = TradeJournal()
        for t in _make_sample_trades(10):
            journal.add_trade(t)
        s = journal.summary()
        assert s["total_trades"] == 10
        assert "win_rate" in s
        assert "profit_factor" in s
        assert "max_drawdown" in s
        assert s["total_pnl"] != 0


# ── PerformanceAnalyzer ────────────────────────────────────────────────

class TestPerformanceAnalyzer:
    def test_by_setup_type(self):
        trades = _make_sample_trades(10)
        pa = PerformanceAnalyzer(trades)
        result = pa.by_setup_type()
        assert len(result) > 0
        for k, v in result.items():
            assert "trades" in v
            assert "win_rate" in v
            assert "total_pnl" in v

    def test_by_symbol(self):
        trades = _make_sample_trades(10)
        pa = PerformanceAnalyzer(trades)
        result = pa.by_symbol()
        assert "AAPL" in result
        assert "MSFT" in result

    def test_by_session(self):
        trades = _make_sample_trades(10)
        pa = PerformanceAnalyzer(trades)
        result = pa.by_session()
        assert len(result) > 0

    def test_by_day_of_week(self):
        trades = _make_sample_trades(10)
        pa = PerformanceAnalyzer(trades)
        result = pa.by_day_of_week()
        assert len(result) > 0

    def test_by_direction(self):
        trades = _make_sample_trades(5)
        pa = PerformanceAnalyzer(trades)
        result = pa.by_direction()
        assert "long" in result  # all default to long

    def test_by_tag(self):
        trades = _make_sample_trades(10)
        pa = PerformanceAnalyzer(trades)
        result = pa.by_tag()
        assert "tag_a" in result or "tag_b" in result

    def test_by_confidence(self):
        trades = _make_sample_trades(10)
        pa = PerformanceAnalyzer(trades)
        result = pa.by_confidence()
        assert len(result) > 0

    def test_by_month(self):
        trades = _make_sample_trades(10)
        pa = PerformanceAnalyzer(trades)
        result = pa.by_month()
        assert "2024-06" in result

    def test_by_week(self):
        trades = _make_sample_trades(10)
        pa = PerformanceAnalyzer(trades)
        result = pa.by_week()
        assert len(result) > 0


# ── StreakAnalyzer ─────────────────────────────────────────────────────

class TestStreakAnalyzer:
    def test_empty(self):
        sa = StreakAnalyzer([])
        assert sa.current_streak() == {"type": "none", "length": 0}
        assert sa.max_win_streak() == 0
        assert sa.max_loss_streak() == 0

    def test_all_winners(self):
        trades = [_make_trade(trade_id=f"T{i}", exit_price=110) for i in range(5)]
        sa = StreakAnalyzer(trades)
        assert sa.max_win_streak() == 5
        assert sa.max_loss_streak() == 0
        assert sa.current_streak()["type"] == "win"

    def test_all_losers(self):
        trades = [_make_trade(trade_id=f"T{i}", exit_price=90) for i in range(4)]
        sa = StreakAnalyzer(trades)
        assert sa.max_loss_streak() == 4
        assert sa.current_streak()["type"] == "loss"

    def test_mixed_streaks(self):
        results = [110, 110, 90, 90, 90, 110, 110, 110, 110, 90]  # W2 L3 W4 L1
        trades = [
            _make_trade(trade_id=f"T{i}", exit_price=r, entry_time=datetime(2024, 1, 1 + i, 10, 0))
            for i, r in enumerate(results)
        ]
        sa = StreakAnalyzer(trades)
        assert sa.max_win_streak() == 4
        assert sa.max_loss_streak() == 3

    def test_streak_stats(self):
        trades = _make_sample_trades(20)
        sa = StreakAnalyzer(trades)
        stats = sa.streak_stats()
        assert "current" in stats
        assert "max_win_streak" in stats
        assert "max_loss_streak" in stats
        assert "total_streaks" in stats

    def test_all_streaks(self):
        results = [110, 90, 110, 110]
        trades = [
            _make_trade(trade_id=f"T{i}", exit_price=r, entry_time=datetime(2024, 1, 1 + i, 10, 0))
            for i, r in enumerate(results)
        ]
        sa = StreakAnalyzer(trades)
        streaks = sa.all_streaks()
        assert len(streaks) == 3  # W1 L1 W2


# ── RMultipleAnalyzer ──────────────────────────────────────────────────

class TestRMultipleAnalyzer:
    def test_distribution(self):
        trades = _make_sample_trades(10)
        ra = RMultipleAnalyzer(trades)
        d = ra.distribution()
        assert d["count"] > 0
        assert "mean_r" in d
        assert "median_r" in d

    def test_empty(self):
        ra = RMultipleAnalyzer([])
        assert ra.distribution()["count"] == 0
        assert ra.expectancy_in_r() == 0.0
        assert ra.sqn() == 0.0

    def test_histogram(self):
        trades = _make_sample_trades(10)
        ra = RMultipleAnalyzer(trades)
        hist = ra.histogram(bins=5)
        assert len(hist) == 5
        total_count = sum(b["count"] for b in hist)
        assert total_count == ra.distribution()["count"]

    def test_sqn(self):
        trades = _make_sample_trades(20)
        ra = RMultipleAnalyzer(trades)
        sqn = ra.sqn()
        assert isinstance(sqn, float)

    def test_expectancy_in_r(self):
        trades = _make_sample_trades(10)
        ra = RMultipleAnalyzer(trades)
        exp = ra.expectancy_in_r()
        assert isinstance(exp, float)


# ── DisciplineScorer ───────────────────────────────────────────────────

class TestDisciplineScorer:
    def test_empty(self):
        ds = DisciplineScorer([])
        assert ds.score()["score"] == 0

    def test_perfect_discipline(self):
        trades = [
            _make_trade(trade_id=f"T{i}", followed_plan=True, mistakes=[],
                        emotional_state_entry=EmotionalState.DISCIPLINED)
            for i in range(10)
        ]
        ds = DisciplineScorer(trades)
        result = ds.score()
        assert result["score"] >= 90
        assert result["grade"] in ("A+", "A")

    def test_poor_discipline(self):
        trades = [
            _make_trade(
                trade_id=f"T{i}",
                followed_plan=False,
                mistakes=[MistakeType.FOMO_ENTRY, MistakeType.NO_STOP_LOSS, MistakeType.OVERSIZED],
                emotional_state_entry=EmotionalState.REVENGE,
            )
            for i in range(10)
        ]
        ds = DisciplineScorer(trades)
        result = ds.score()
        assert result["score"] < 50
        assert result["grade"] in ("D", "F")

    def test_mistake_breakdown(self):
        trades = [
            _make_trade(trade_id="T1", mistakes=[MistakeType.FOMO_ENTRY, MistakeType.NO_STOP_LOSS]),
            _make_trade(trade_id="T2", mistakes=[MistakeType.FOMO_ENTRY]),
        ]
        ds = DisciplineScorer(trades)
        mb = ds.mistake_breakdown()
        assert mb["fomo_entry"] == 2
        assert mb["no_stop_loss"] == 1

    def test_emotional_breakdown(self):
        trades = [
            _make_trade(trade_id="T1", emotional_state_entry=EmotionalState.CALM,
                        emotional_state_exit=EmotionalState.CONFIDENT),
            _make_trade(trade_id="T2", emotional_state_entry=EmotionalState.ANXIOUS,
                        emotional_state_exit=EmotionalState.FRUSTRATED),
        ]
        ds = DisciplineScorer(trades)
        eb = ds.emotional_breakdown()
        assert eb["entry_emotions"]["calm"] == 1
        assert eb["entry_emotions"]["anxious"] == 1


# ── EquityCurveBuilder ─────────────────────────────────────────────────

class TestEquityCurveBuilder:
    def test_trade_by_trade(self):
        trades = _make_sample_trades(10)
        ecb = EquityCurveBuilder(trades, starting_capital=100000)
        curve = ecb.trade_by_trade()
        assert len(curve) == 11  # 10 trades + starting point
        assert curve[0]["equity"] == 100000
        assert curve[0]["trade_num"] == 0

    def test_daily_equity(self):
        trades = _make_sample_trades(10)
        ecb = EquityCurveBuilder(trades, starting_capital=100000)
        daily = ecb.daily_equity()
        assert len(daily) > 0
        assert "date" in daily[0]
        assert "equity" in daily[0]

    def test_drawdown_series(self):
        trades = _make_sample_trades(10)
        ecb = EquityCurveBuilder(trades, starting_capital=100000)
        dd = ecb.drawdown_series()
        assert len(dd) == 11
        assert all(d["drawdown_pct"] >= 0 for d in dd)

    def test_underwater_periods(self):
        trades = _make_sample_trades(10)
        ecb = EquityCurveBuilder(trades, starting_capital=100000)
        periods = ecb.underwater_periods()
        # May or may not have underwater periods depending on trade sequence
        assert isinstance(periods, list)


# ── HoldingPeriodAnalyzer ──────────────────────────────────────────────

class TestHoldingPeriodAnalyzer:
    def test_stats(self):
        trades = _make_sample_trades(10)
        hpa = HoldingPeriodAnalyzer(trades)
        s = hpa.stats()
        assert s["count"] == 10
        assert s["avg_hours"] > 0

    def test_pnl_by_bucket(self):
        trades = _make_sample_trades(10)
        hpa = HoldingPeriodAnalyzer(trades)
        buckets = hpa.pnl_by_duration_bucket()
        assert "intraday_1-8h" in buckets

    def test_optimal_holding(self):
        trades = _make_sample_trades(10)
        hpa = HoldingPeriodAnalyzer(trades)
        opt = hpa.optimal_holding_period()
        assert "optimal_bucket" in opt

    def test_empty(self):
        hpa = HoldingPeriodAnalyzer([])
        assert hpa.stats()["count"] == 0


# ── CalendarHeatmapBuilder ─────────────────────────────────────────────

class TestCalendarHeatmapBuilder:
    def test_daily_pnl_map(self):
        trades = _make_sample_trades(10)
        chb = CalendarHeatmapBuilder(trades)
        daily = chb.daily_pnl_map()
        assert len(daily) > 0
        for k, v in daily.items():
            assert isinstance(v, float)

    def test_monthly_summary(self):
        trades = _make_sample_trades(10)
        chb = CalendarHeatmapBuilder(trades)
        monthly = chb.monthly_summary()
        assert "2024-06" in monthly
        assert monthly["2024-06"]["trades"] > 0

    def test_weekly_summary(self):
        trades = _make_sample_trades(10)
        chb = CalendarHeatmapBuilder(trades)
        weekly = chb.weekly_summary()
        assert len(weekly) > 0


# ── TradeComparator ────────────────────────────────────────────────────

class TestTradeComparator:
    def test_similarity_identical(self):
        t1 = _make_trade(trade_id="T1")
        t2 = _make_trade(trade_id="T2")
        tc = TradeComparator()
        score = tc.similarity_score(t1, t2)
        assert score == 1.0  # identical properties

    def test_similarity_different(self):
        t1 = _make_trade(trade_id="T1", symbol="AAPL", direction=TradeDirection.LONG, setup_type=SetupType.BREAKOUT)
        t2 = _make_trade(trade_id="T2", symbol="TSLA", direction=TradeDirection.SHORT, setup_type=SetupType.REVERSAL,
                         tags=["different"], confidence_level=2,
                         entry_time=datetime(2024, 6, 10, 20, 0))
        tc = TradeComparator()
        score = tc.similarity_score(t1, t2)
        assert score < 0.5

    def test_find_similar(self):
        trades = _make_sample_trades(20)
        tc = TradeComparator()
        similar = tc.find_similar(trades[0], trades, top_n=3)
        assert len(similar) <= 3
        assert all("similarity" in s for s in similar)


# ── CostAnalyzer ───────────────────────────────────────────────────────

class TestCostAnalyzer:
    def test_total_costs(self):
        trades = _make_sample_trades(10)
        ca = CostAnalyzer(trades)
        result = ca.total_costs()
        assert result["total_commission"] > 0
        assert result["total_slippage"] > 0
        assert "cost_as_pct_of_gross" in result

    def test_cost_impact(self):
        trades = _make_sample_trades(10)
        ca = CostAnalyzer(trades)
        impact = ca.cost_impact_on_winners()
        assert "total_winners" in impact
        assert "marginal_winners" in impact

    def test_empty(self):
        ca = CostAnalyzer([])
        assert ca.total_costs()["total_cost"] == 0


# ── TradeJournalEngine (Orchestrator) ──────────────────────────────────

class TestTradeJournalEngine:
    def _engine_with_trades(self) -> TradeJournalEngine:
        engine = TradeJournalEngine(starting_capital=100000)
        for t in _make_sample_trades(20):
            engine.add_trade(t)
        return engine

    def test_add_and_close(self):
        engine = TradeJournalEngine()
        t = _make_trade(trade_id="TX1", status=TradeStatus.OPEN, exit_price=None)
        engine.add_trade(t)
        result = engine.close_trade("TX1", exit_price=120.0, exit_time=datetime(2024, 7, 1, 10, 0))
        assert result is not None
        assert result["exit_price"] == 120.0

    def test_close_nonexistent(self):
        engine = TradeJournalEngine()
        assert engine.close_trade("NOPE", 100.0, datetime.now()) is None

    def test_get_summary(self):
        engine = self._engine_with_trades()
        s = engine.get_summary()
        assert s["total_trades"] == 20

    def test_performance_by_setup(self):
        engine = self._engine_with_trades()
        result = engine.get_performance_by("setup")
        assert len(result) > 0

    def test_performance_by_symbol(self):
        engine = self._engine_with_trades()
        result = engine.get_performance_by("symbol")
        assert "AAPL" in result

    def test_performance_by_session(self):
        engine = self._engine_with_trades()
        result = engine.get_performance_by("session")
        assert len(result) > 0

    def test_performance_by_unknown(self):
        engine = self._engine_with_trades()
        result = engine.get_performance_by("unknown_dimension")
        assert "error" in result

    def test_get_streaks(self):
        engine = self._engine_with_trades()
        streaks = engine.get_streaks()
        assert "current" in streaks

    def test_get_r_analysis(self):
        engine = self._engine_with_trades()
        r = engine.get_r_analysis()
        assert "distribution" in r
        assert "sqn" in r

    def test_get_discipline_score(self):
        engine = self._engine_with_trades()
        d = engine.get_discipline_score()
        assert "score" in d
        assert "mistake_breakdown" in d

    def test_get_equity_curve(self):
        engine = self._engine_with_trades()
        curve = engine.get_equity_curve()
        assert len(curve) == 21  # 20 trades + start

    def test_get_daily_equity(self):
        engine = self._engine_with_trades()
        daily = engine.get_daily_equity()
        assert len(daily) > 0

    def test_get_drawdowns(self):
        engine = self._engine_with_trades()
        dd = engine.get_drawdowns()
        assert len(dd) == 21

    def test_get_holding_analysis(self):
        engine = self._engine_with_trades()
        h = engine.get_holding_analysis()
        assert "stats" in h
        assert "by_duration" in h

    def test_get_calendar_heatmap(self):
        engine = self._engine_with_trades()
        hm = engine.get_calendar_heatmap()
        assert "daily" in hm
        assert "monthly" in hm

    def test_get_cost_analysis(self):
        engine = self._engine_with_trades()
        c = engine.get_cost_analysis()
        assert "totals" in c
        assert "impact" in c

    def test_find_similar_trades(self):
        engine = self._engine_with_trades()
        similar = engine.find_similar_trades("T000", top_n=3)
        assert len(similar) <= 3

    def test_find_similar_nonexistent(self):
        engine = self._engine_with_trades()
        assert engine.find_similar_trades("NOPE") == []

    def test_capabilities(self):
        engine = TradeJournalEngine()
        caps = engine.capabilities()
        assert caps["engine"] == "TradeJournalEngine"
        assert len(caps["features"]) >= 15
        assert "dimensions" in caps
