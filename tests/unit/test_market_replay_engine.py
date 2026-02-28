"""
Tests for MarketReplayEngine — comprehensive market replay & simulation.
"""

import numpy as np
import pytest
from datetime import datetime, timedelta

from services.market_replay_engine import (
    TickData,
    ReplayBar,
    ReplayOrder,
    ReplayBookmark,
    ReplayStatistics,
    ReplayState,
    ReplaySpeed,
    TimeframeType,
    OrderSide,
    BarAggregator,
    OrderBookSimulator,
    ReplayVolumeProfiler,
    ReplayTradeSimulator,
    ReplaySession,
    MultiTimeframeReplay,
    MarketReplayEngine,
)


# ─── Helpers ────────────────────────────────────────────────────────────────

def _make_bars(n=100, start_price=100.0, volatility=0.02, start_time=None, interval_minutes=1):
    """Generate realistic OHLCV bars."""
    rng = np.random.RandomState(42)
    bars = []
    price = start_price
    base_time = start_time or datetime(2024, 1, 15, 9, 30, 0)

    for i in range(n):
        change = rng.normal(0, volatility)
        o = price
        c = price * (1 + change)
        h = max(o, c) * (1 + abs(rng.normal(0, volatility * 0.5)))
        l = min(o, c) * (1 - abs(rng.normal(0, volatility * 0.5)))
        vol = rng.uniform(1000, 50000)

        bars.append(ReplayBar(
            timestamp=base_time + timedelta(minutes=i * interval_minutes),
            open=round(o, 2),
            high=round(h, 2),
            low=round(l, 2),
            close=round(c, 2),
            volume=round(vol, 0),
            vwap=round((h + l + c) / 3, 2),
        ))
        price = c

    return bars


def _make_ticks(n=200, start_price=100.0):
    rng = np.random.RandomState(42)
    ticks = []
    price = start_price
    base_time = datetime(2024, 1, 15, 9, 30, 0)

    for i in range(n):
        price *= (1 + rng.normal(0, 0.001))
        ticks.append(TickData(
            timestamp=base_time + timedelta(seconds=i * 3),
            price=round(price, 2),
            volume=rng.uniform(10, 500),
            bid=round(price - 0.02, 2),
            ask=round(price + 0.02, 2),
        ))

    return ticks


# ═══════════════════════════════════════════════════════════════════════════
# TickData
# ═══════════════════════════════════════════════════════════════════════════

class TestTickData:
    def test_spread(self):
        t = TickData(datetime.now(), 100.0, bid=99.98, ask=100.02)
        assert t.spread == pytest.approx(0.04)

    def test_mid_price(self):
        t = TickData(datetime.now(), 100.0, bid=99.98, ask=100.02)
        assert t.mid_price == pytest.approx(100.0)

    def test_to_dict(self):
        t = TickData(datetime.now(), 100.0, volume=500)
        d = t.to_dict()
        assert d["price"] == 100.0
        assert d["volume"] == 500


# ═══════════════════════════════════════════════════════════════════════════
# ReplayBar
# ═══════════════════════════════════════════════════════════════════════════

class TestReplayBar:
    def test_bullish(self):
        b = ReplayBar(datetime.now(), 100, 105, 99, 104, 1000)
        assert b.is_bullish is True
        assert b.body_size == 4
        assert b.change_pct == pytest.approx(4.0)

    def test_bearish(self):
        b = ReplayBar(datetime.now(), 100, 101, 95, 96, 1000)
        assert b.is_bullish is False
        assert b.range == 6

    def test_upper_lower_wick(self):
        b = ReplayBar(datetime.now(), 100, 105, 98, 103, 1000)
        assert b.upper_wick == 2  # 105 - 103
        assert b.lower_wick == 2  # 100 - 98

    def test_to_dict(self):
        b = ReplayBar(datetime.now(), 100, 105, 99, 104, 1000)
        d = b.to_dict()
        assert d["is_bullish"] is True
        assert "change_pct" in d


# ═══════════════════════════════════════════════════════════════════════════
# ReplayStatistics
# ═══════════════════════════════════════════════════════════════════════════

class TestReplayStatistics:
    def test_progress(self):
        s = ReplayStatistics(bars_played=50, total_bars=100)
        assert s.progress_pct == 50.0

    def test_session_change(self):
        s = ReplayStatistics(session_open=100.0, current_price=105.0, total_bars=1)
        assert s.session_change_pct == pytest.approx(5.0)

    def test_win_rate(self):
        s = ReplayStatistics(trades_taken=10, winning_trades=6, total_bars=1)
        assert s.win_rate == 60.0

    def test_to_dict(self):
        s = ReplayStatistics(bars_played=10, total_bars=20, total_volume=50000)
        d = s.to_dict()
        assert "progress_pct" in d


# ═══════════════════════════════════════════════════════════════════════════
# BarAggregator
# ═══════════════════════════════════════════════════════════════════════════

class TestBarAggregator:
    def test_ticks_to_bars(self):
        ticks = _make_ticks(200)
        bars = BarAggregator.ticks_to_bars(ticks, 60)
        assert len(bars) > 0
        # Each bar should have valid OHLCV
        for b in bars:
            assert b.high >= b.low
            assert b.high >= b.open
            assert b.high >= b.close

    def test_ticks_to_bars_empty(self):
        assert BarAggregator.ticks_to_bars([]) == []

    def test_resample_bars(self):
        bars = _make_bars(100)
        resampled = BarAggregator.resample_bars(bars, 5)
        assert len(resampled) == 20
        # Volume should sum
        first_five_vol = sum(b.volume for b in bars[:5])
        assert resampled[0].volume == pytest.approx(first_five_vol)

    def test_resample_preserves_ohlc(self):
        bars = _make_bars(10)
        resampled = BarAggregator.resample_bars(bars, 5)
        # Open of resampled[0] = open of bars[0]
        assert resampled[0].open == bars[0].open
        # Close of resampled[0] = close of bars[4]
        assert resampled[0].close == bars[4].close


# ═══════════════════════════════════════════════════════════════════════════
# OrderBookSimulator
# ═══════════════════════════════════════════════════════════════════════════

class TestOrderBookSimulator:
    def test_generate_snapshot(self):
        book = OrderBookSimulator.generate_book_snapshot(100.0, depth=5, seed=42)
        assert len(book["bids"]) == 5
        assert len(book["asks"]) == 5
        assert book["bids"][0]["price"] < 100.0
        assert book["asks"][0]["price"] > 100.0

    def test_imbalance(self):
        book = OrderBookSimulator.generate_book_snapshot(100.0, depth=10, seed=42)
        assert -1.0 <= book["imbalance"] <= 1.0

    def test_book_evolution(self):
        prices = [100 + i * 0.1 for i in range(20)]
        books = OrderBookSimulator.simulate_book_evolution(prices, 3)
        assert len(books) == 20


# ═══════════════════════════════════════════════════════════════════════════
# ReplayVolumeProfiler
# ═══════════════════════════════════════════════════════════════════════════

class TestReplayVolumeProfiler:
    def test_empty_profile(self):
        p = ReplayVolumeProfiler()
        profile = p.profile()
        assert profile["poc"] == 0.0
        assert profile["levels"] == []

    def test_add_bars(self):
        p = ReplayVolumeProfiler()
        bars = _make_bars(50)
        for b in bars:
            p.add_bar(b)
        profile = p.profile()
        assert profile["poc"] > 0
        assert profile["total_volume"] > 0
        assert profile["vah"] >= profile["val"]

    def test_reset(self):
        p = ReplayVolumeProfiler()
        bars = _make_bars(10)
        for b in bars:
            p.add_bar(b)
        p.reset()
        assert p.profile()["poc"] == 0.0


# ═══════════════════════════════════════════════════════════════════════════
# ReplayTradeSimulator
# ═══════════════════════════════════════════════════════════════════════════

class TestReplayTradeSimulator:
    def test_buy_and_sell(self):
        sim = ReplayTradeSimulator(100000, 0.01)
        now = datetime.now()
        buy = sim.place_order(OrderSide.BUY, 100, 50.0, now)
        assert buy.is_filled
        assert sim.position == 100

        sell = sim.place_order(OrderSide.SELL, 100, 55.0, now)
        assert sell.is_filled
        assert sim.position == 0
        assert sell.pnl > 0  # Profit

    def test_insufficient_capital(self):
        sim = ReplayTradeSimulator(100, 0.01)
        order = sim.place_order(OrderSide.BUY, 1000, 100.0, datetime.now())
        assert not order.is_filled

    def test_sell_more_than_position(self):
        sim = ReplayTradeSimulator(100000, 0.01)
        sim.place_order(OrderSide.BUY, 10, 50.0, datetime.now())
        order = sim.place_order(OrderSide.SELL, 20, 55.0, datetime.now())
        assert not order.is_filled

    def test_trade_summary(self):
        sim = ReplayTradeSimulator(100000, 0.005)
        now = datetime.now()
        sim.place_order(OrderSide.BUY, 100, 50.0, now)
        sim.place_order(OrderSide.SELL, 100, 55.0, now)
        sim.place_order(OrderSide.BUY, 100, 55.0, now)
        sim.place_order(OrderSide.SELL, 100, 53.0, now)
        summary = sim.trade_summary()
        assert summary["total_trades"] == 2
        assert summary["winning"] == 1
        assert summary["losing"] == 1

    def test_reset(self):
        sim = ReplayTradeSimulator(100000, 0.01)
        sim.place_order(OrderSide.BUY, 10, 50.0, datetime.now())
        sim.reset()
        assert sim.position == 0
        assert sim.capital == 100000


# ═══════════════════════════════════════════════════════════════════════════
# ReplaySession
# ═══════════════════════════════════════════════════════════════════════════

class TestReplaySession:
    @pytest.fixture
    def session(self):
        bars = _make_bars(100)
        return ReplaySession("AAPL", bars)

    def test_initial_state(self, session):
        assert session.state == ReplayState.STOPPED
        assert session.current_index == 0

    def test_step_forward(self, session):
        new = session.step_forward(5)
        assert len(new) == 5
        assert session.current_index == 5
        assert len(session.visible_bars) == 5

    def test_step_backward(self, session):
        session.step_forward(10)
        session.step_backward(3)
        assert session.current_index == 7
        assert len(session.visible_bars) == 7

    def test_play_pause(self, session):
        session.play()
        assert session.state == ReplayState.PLAYING
        session.pause()
        assert session.state == ReplayState.PAUSED

    def test_stop_resets(self, session):
        session.step_forward(20)
        session.stop()
        assert session.current_index == 0
        assert len(session.visible_bars) == 0

    def test_jump_to(self, session):
        session.jump_to(50)
        assert session.current_index == 51  # 0-50 inclusive = 51 bars
        assert len(session.visible_bars) == 51

    def test_jump_to_time(self, session):
        target = session.bars[30].timestamp
        idx = session.jump_to_time(target)
        assert idx == 30

    def test_bookmark(self, session):
        session.step_forward(25)
        bm = session.add_bookmark("Support level", "Testing support")
        assert bm.bar_index == 25
        assert len(session.bookmarks) == 1

    def test_goto_bookmark(self, session):
        session.step_forward(25)
        bm = session.add_bookmark("Mark1")
        session.step_forward(50)
        assert session.goto_bookmark(bm.bookmark_id)
        assert session.current_index == 26  # jump_to(25) → visible bars 0..25, index=26

    def test_stats_update(self, session):
        session.step_forward(10)
        stats = session.stats
        assert stats.bars_played == 10
        assert stats.total_volume > 0
        assert stats.high_of_session > 0

    def test_volume_profile(self, session):
        session.step_forward(50)
        profile = session.volume_profiler.profile()
        assert profile["poc"] > 0

    def test_place_trade(self, session):
        session.step_forward(5)
        order = session.place_trade(OrderSide.BUY, 100)
        assert order is not None
        assert order.is_filled
        assert session.stats.trades_taken == 1

    def test_session_info(self, session):
        session.step_forward(10)
        info = session.session_info()
        assert info["symbol"] == "AAPL"
        assert info["state"] == "stopped"
        assert "statistics" in info
        assert "volume_profile" in info

    def test_event_overlay(self, session):
        t = session.bars[10].timestamp
        session.add_event_overlay(t, "earnings", "AAPL Q1")
        events = session.get_events_in_range(5, 15)
        assert len(events) == 1

    def test_is_at_end(self, session):
        assert not session.is_at_end
        session.jump_to(99)
        assert session.is_at_end

    def test_set_speed(self, session):
        session.set_speed(ReplaySpeed.FAST_10X)
        assert session.speed == ReplaySpeed.FAST_10X


# ═══════════════════════════════════════════════════════════════════════════
# MultiTimeframeReplay
# ═══════════════════════════════════════════════════════════════════════════

class TestMultiTimeframeReplay:
    def test_creation(self):
        bars = _make_bars(100)
        mtf = MultiTimeframeReplay(bars, "SPY")
        assert "1m" in mtf.sessions
        assert "5m" in mtf.sessions

    def test_step_forward(self):
        bars = _make_bars(100)
        mtf = MultiTimeframeReplay(bars, "SPY")
        result = mtf.step_forward(5)
        assert "1m" in result
        assert len(result["1m"]) == 5

    def test_info(self):
        bars = _make_bars(100)
        mtf = MultiTimeframeReplay(bars, "QQQ")
        info = mtf.info()
        assert info["symbol"] == "QQQ"
        assert "1m" in info["timeframes"]


# ═══════════════════════════════════════════════════════════════════════════
# MarketReplayEngine (Orchestrator)
# ═══════════════════════════════════════════════════════════════════════════

class TestMarketReplayEngine:
    @pytest.fixture
    def engine(self):
        return MarketReplayEngine()

    @pytest.fixture
    def bars(self):
        return _make_bars(200)

    def test_create_session(self, engine, bars):
        info = engine.create_session("S1", "AAPL", bars)
        assert info["symbol"] == "AAPL"
        assert info["state"] == "stopped"

    def test_create_from_ohlcv(self, engine):
        data = [{"open": 100, "high": 105, "low": 99, "close": 104, "volume": 1000,
                 "timestamp": datetime(2024, 1, 1, i, 0).isoformat()} for i in range(10)]
        info = engine.create_session_from_ohlcv("S2", "MSFT", data)
        assert info["symbol"] == "MSFT"

    def test_play_pause_stop(self, engine, bars):
        engine.create_session("S1", "AAPL", bars)
        assert engine.play("S1")["status"] == "playing"
        assert engine.pause("S1")["status"] == "paused"
        assert engine.stop("S1")["status"] == "stopped"

    def test_step(self, engine, bars):
        engine.create_session("S1", "SPY", bars)
        new_bars = engine.step("S1", 10)
        assert len(new_bars) == 10

    def test_step_back(self, engine, bars):
        engine.create_session("S1", "SPY", bars)
        engine.step("S1", 20)
        result = engine.step_back("S1", 5)
        assert result["current_index"] == 15

    def test_jump(self, engine, bars):
        engine.create_session("S1", "SPY", bars)
        info = engine.jump("S1", 50)
        assert info["statistics"]["bars_played"] == 51

    def test_set_speed(self, engine, bars):
        engine.create_session("S1", "SPY", bars)
        result = engine.set_speed("S1", ReplaySpeed.FAST_5X)
        assert result["speed"] == 5.0

    def test_bookmark(self, engine, bars):
        engine.create_session("S1", "SPY", bars)
        engine.step("S1", 30)
        bm = engine.bookmark("S1", "Test BM")
        assert bm["name"] == "Test BM"

    def test_goto_bookmark(self, engine, bars):
        engine.create_session("S1", "SPY", bars)
        engine.step("S1", 30)
        bm = engine.bookmark("S1", "BM1")
        engine.step("S1", 50)
        result = engine.goto_bookmark("S1", bm["bookmark_id"])
        assert result["success"]

    def test_place_trade(self, engine, bars):
        engine.create_session("S1", "SPY", bars)
        engine.step("S1", 5)
        result = engine.place_trade("S1", "buy", 100)
        assert result["is_filled"]

    def test_session_info(self, engine, bars):
        engine.create_session("S1", "SPY", bars)
        engine.step("S1", 10)
        info = engine.session_info("S1")
        assert "statistics" in info

    def test_volume_profile(self, engine, bars):
        engine.create_session("S1", "SPY", bars)
        engine.step("S1", 50)
        vp = engine.volume_profile("S1")
        assert vp["poc"] > 0

    def test_trade_summary(self, engine, bars):
        engine.create_session("S1", "SPY", bars)
        engine.step("S1", 5)
        engine.place_trade("S1", "buy", 100)
        engine.step("S1", 5)
        engine.place_trade("S1", "sell", 100)
        ts = engine.trade_summary("S1")
        assert ts["total_trades"] >= 1

    def test_generate_book(self, engine):
        book = engine.generate_book(150.0, 5)
        assert len(book["bids"]) == 5

    def test_ticks_to_bars(self, engine):
        ticks = _make_ticks(100)
        bars = engine.ticks_to_bars(ticks, 60)
        assert len(bars) > 0

    def test_delete_session(self, engine, bars):
        engine.create_session("S1", "SPY", bars)
        result = engine.delete_session("S1")
        assert result["deleted"] == "S1"
        assert "S1" not in engine.list_sessions()

    def test_list_sessions(self, engine, bars):
        engine.create_session("A", "AAPL", bars)
        engine.create_session("B", "MSFT", bars)
        assert set(engine.list_sessions()) == {"A", "B"}

    def test_session_not_found(self, engine):
        assert "error" in engine.play("nonexistent")
        assert "error" in engine.session_info("nonexistent")

    def test_create_multi_tf(self, engine, bars):
        info = engine.create_multi_tf_session("MTF1", "QQQ", bars)
        assert "1m" in info["timeframes"]

    def test_capabilities(self, engine):
        caps = engine.capabilities()
        assert caps["engine"] == "MarketReplayEngine"
        assert len(caps["features"]) >= 10
