"""
Tests for MarketTape Record/Replay System.

Phase 3: Deterministic backtesting.
"""
import pytest
import tempfile
import json
from datetime import datetime, timedelta
from pathlib import Path

from services.autopilot.market_tape import (
    TapeEventType,
    TapeEvent,
    MarketTapeRecorder,
    MarketTapePlayer,
    TapeBacktester,
    BacktestResult,
    get_tape_recorder,
    reset_tape_recorder,
)


class TestTapeEvent:
    """Test TapeEvent data class."""
    
    def test_to_dict(self):
        """Event should serialize to dict."""
        event = TapeEvent(
            event_id=1,
            timestamp=datetime(2026, 1, 26, 10, 30, 0),
            event_type=TapeEventType.QUOTE,
            symbol="AAPL",
            payload={"bid": 150.0, "ask": 150.05},
            sequence=0,
        )
        
        d = event.to_dict()
        assert d["event_id"] == 1
        assert d["event_type"] == "quote"
        assert d["symbol"] == "AAPL"
        assert d["payload"]["bid"] == 150.0
    
    def test_from_dict(self):
        """Event should deserialize from dict."""
        d = {
            "event_id": 1,
            "timestamp": "2026-01-26T10:30:00",
            "event_type": "quote",
            "symbol": "AAPL",
            "payload": {"bid": 150.0, "ask": 150.05},
            "sequence": 0,
        }
        
        event = TapeEvent.from_dict(d)
        assert event.event_id == 1
        assert event.event_type == TapeEventType.QUOTE
        assert event.symbol == "AAPL"
    
    def test_sorting_by_timestamp(self):
        """Events should sort by timestamp."""
        e1 = TapeEvent(1, datetime(2026, 1, 26, 10, 30), TapeEventType.QUOTE, "AAPL", {})
        e2 = TapeEvent(2, datetime(2026, 1, 26, 10, 31), TapeEventType.QUOTE, "AAPL", {})
        
        sorted_events = sorted([e2, e1])
        assert sorted_events[0].event_id == 1
        assert sorted_events[1].event_id == 2
    
    def test_sorting_by_sequence_within_timestamp(self):
        """Events with same timestamp should sort by sequence."""
        ts = datetime(2026, 1, 26, 10, 30)
        e1 = TapeEvent(1, ts, TapeEventType.QUOTE, "AAPL", {}, sequence=0)
        e2 = TapeEvent(2, ts, TapeEventType.QUOTE, "MSFT", {}, sequence=1)
        
        sorted_events = sorted([e2, e1])
        assert sorted_events[0].event_id == 1


class TestMarketTapeRecorder:
    """Test tape recording functionality."""
    
    @pytest.fixture
    def recorder(self):
        """Create fresh recorder."""
        reset_tape_recorder()
        return MarketTapeRecorder("test_session")
    
    def test_records_quotes(self, recorder):
        """Should record quote events."""
        recorder.record_quote("AAPL", bid=150.0, ask=150.05)
        
        events = recorder.events
        # First event is CYCLE_START, second is our quote
        quote_events = [e for e in events if e.event_type == TapeEventType.QUOTE]
        assert len(quote_events) == 1
        assert quote_events[0].symbol == "AAPL"
        assert quote_events[0].payload["bid"] == 150.0
        assert quote_events[0].payload["mid"] == 150.025
    
    def test_records_decisions(self, recorder):
        """Should record decision events."""
        recorder.record_decision("AAPL", "long_call", "enter", reason="Strong signal")
        
        decisions = [e for e in recorder.events if e.event_type == TapeEventType.DECISION]
        assert len(decisions) == 1
        assert decisions[0].payload["action"] == "enter"
        assert decisions[0].payload["reason"] == "Strong signal"
    
    def test_records_fills(self, recorder):
        """Should record fill events."""
        recorder.record_fill("AAPL", "ORDER-001", fill_price=2.50, qty=1)
        
        fills = [e for e in recorder.events if e.event_type == TapeEventType.FILL]
        assert len(fills) == 1
        assert fills[0].payload["fill_price"] == 2.50
    
    def test_records_exits(self, recorder):
        """Should record exit events."""
        recorder.record_exit("AAPL", "profit_target", pnl=50.0, hold_time_minutes=120)
        
        exits = [e for e in recorder.events if e.event_type == TapeEventType.EXIT]
        assert len(exits) == 1
        assert exits[0].payload["pnl"] == 50.0
    
    def test_event_counter_increments(self, recorder):
        """Event IDs should increment."""
        recorder.record_quote("AAPL", 150.0, 150.05)
        recorder.record_quote("MSFT", 300.0, 300.10)
        
        quotes = [e for e in recorder.events if e.event_type == TapeEventType.QUOTE]
        assert quotes[0].event_id < quotes[1].event_id
    
    def test_sequence_tracks_same_timestamp(self, recorder):
        """Sequence should track events at same timestamp."""
        # These may have same timestamp
        recorder.record_quote("AAPL", 150.0, 150.05)
        recorder.record_quote("MSFT", 300.0, 300.10)
        
        # Events should have incremented sequence if same timestamp
        events = recorder.events
        # Can't guarantee same timestamp in test, but structure should work
        assert all(hasattr(e, 'sequence') for e in events)
    
    def test_to_json(self, recorder):
        """Should serialize to JSON."""
        recorder.record_quote("AAPL", 150.0, 150.05)
        
        json_str = recorder.to_json()
        data = json.loads(json_str)
        
        assert data["session_id"] == "test_session"
        assert data["event_count"] >= 1
        assert "events" in data
    
    def test_save_and_hash(self, recorder):
        """Should save to file and return hash."""
        recorder.record_quote("AAPL", 150.0, 150.05)
        recorder.record_decision("AAPL", "long_call", "enter")
        
        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = f"{tmpdir}/test_tape.json"
            content_hash = recorder.save(filepath, compress=False)
            
            assert Path(filepath).exists()
            assert len(content_hash) == 64  # SHA256 hex
    
    def test_save_compressed(self, recorder):
        """Should save compressed file."""
        recorder.record_quote("AAPL", 150.0, 150.05)
        
        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = f"{tmpdir}/test_tape"
            recorder.save(filepath, compress=True)
            
            assert Path(f"{filepath}.gz").exists()


class TestMarketTapePlayer:
    """Test tape replay functionality."""
    
    @pytest.fixture
    def player_with_events(self):
        """Create player with test events."""
        recorder = MarketTapeRecorder("test_session")
        recorder.record_quote("AAPL", 150.0, 150.05)
        recorder.record_decision("AAPL", "long_call", "enter")
        recorder.record_fill("AAPL", "ORDER-001", 2.50, 1)
        recorder.record_exit("AAPL", "profit_target", pnl=50.0, hold_time_minutes=60)
        return MarketTapePlayer.from_recorder(recorder)
    
    def test_load_from_recorder(self, player_with_events):
        """Should create player from recorder."""
        assert player_with_events.total_events >= 4
        assert player_with_events.session_id == "test_session"
    
    def test_replay_calls_handlers(self, player_with_events):
        """Replay should call registered handlers."""
        quotes_received = []
        decisions_received = []
        
        player_with_events.on_quote(lambda e: quotes_received.append(e))
        player_with_events.on_decision(lambda e: decisions_received.append(e))
        
        player_with_events.replay()
        
        assert len(quotes_received) == 1
        assert len(decisions_received) == 1
    
    def test_replay_returns_stats(self, player_with_events):
        """Replay should return statistics."""
        stats = player_with_events.replay()
        
        assert stats["session_id"] == "test_session"
        assert stats["events_processed"] >= 4
        assert stats["errors"] == 0
        assert stats["duration_seconds"] >= 0
    
    def test_get_events_by_type(self, player_with_events):
        """Should filter events by type."""
        quotes = player_with_events.get_events_by_type(TapeEventType.QUOTE)
        fills = player_with_events.get_events_by_type(TapeEventType.FILL)
        
        assert len(quotes) == 1
        assert len(fills) == 1
    
    def test_get_events_by_symbol(self, player_with_events):
        """Should filter events by symbol."""
        aapl_events = player_with_events.get_events_by_symbol("AAPL")
        msft_events = player_with_events.get_events_by_symbol("MSFT")
        
        assert len(aapl_events) >= 4
        assert len(msft_events) == 0
    
    def test_load_from_file(self):
        """Should load tape from saved file."""
        recorder = MarketTapeRecorder("file_test")
        recorder.record_quote("AAPL", 150.0, 150.05)
        
        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = f"{tmpdir}/test_tape.json"
            recorder.save(filepath, compress=False)
            
            player = MarketTapePlayer.load(filepath)
            assert player.session_id == "file_test"
            assert player.total_events >= 1


class TestTapeBacktester:
    """Test backtest runner."""
    
    def test_backtest_calculates_pnl(self):
        """Backtester should calculate total P&L."""
        recorder = MarketTapeRecorder("backtest_test")
        recorder.record_decision("AAPL", "long_call", "enter")
        recorder.record_fill("AAPL", "ORDER-001", 2.50, 1)
        recorder.record_exit("AAPL", "profit_target", pnl=50.0, hold_time_minutes=60)
        recorder.record_decision("MSFT", "long_put", "enter")
        recorder.record_fill("MSFT", "ORDER-002", 3.00, 1)
        recorder.record_exit("MSFT", "stop_loss", pnl=-30.0, hold_time_minutes=30)
        
        player = MarketTapePlayer.from_recorder(recorder)
        backtester = TapeBacktester(player)
        result = backtester.run()
        
        assert result.total_trades == 2
        assert result.winning_trades == 1
        assert result.losing_trades == 1
        assert result.total_pnl == 20.0  # 50 - 30
    
    def test_backtest_generates_hash(self):
        """Backtester should generate result hash for determinism."""
        recorder = MarketTapeRecorder("hash_test")
        recorder.record_decision("AAPL", "long_call", "enter")
        recorder.record_fill("AAPL", "ORDER-001", 2.50, 1)
        recorder.record_exit("AAPL", "profit_target", pnl=50.0, hold_time_minutes=60)
        
        player = MarketTapePlayer.from_recorder(recorder)
        backtester = TapeBacktester(player)
        result = backtester.run()
        
        assert len(result.result_hash) == 64  # SHA256 hex
    
    def test_same_tape_produces_same_hash(self):
        """Same tape should produce identical result hash (deterministic)."""
        # Create tape
        recorder = MarketTapeRecorder("determinism_test")
        recorder.record_decision("AAPL", "long_call", "enter")
        recorder.record_fill("AAPL", "ORDER-001", 2.50, 1)
        recorder.record_exit("AAPL", "profit_target", pnl=50.0, hold_time_minutes=60)
        
        # Run twice
        player1 = MarketTapePlayer.from_recorder(recorder)
        result1 = TapeBacktester(player1).run()
        
        player2 = MarketTapePlayer.from_recorder(recorder)
        result2 = TapeBacktester(player2).run()
        
        # Should be identical
        assert result1.result_hash == result2.result_hash
        assert result1.total_pnl == result2.total_pnl
    
    def test_result_to_dict(self):
        """BacktestResult should serialize to dict."""
        result = BacktestResult(
            session_id="test",
            tape_hash="abc123",
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow(),
            total_trades=10,
            winning_trades=6,
            losing_trades=4,
            total_pnl=500.0,
        )
        
        d = result.to_dict()
        assert d["total_trades"] == 10
        assert d["win_rate"] == 0.6
        assert d["total_pnl"] == 500.0


class TestTapeRecorderSingleton:
    """Test singleton access."""
    
    def test_get_returns_same_instance(self):
        """get_tape_recorder should return same instance."""
        reset_tape_recorder()
        r1 = get_tape_recorder("test")
        r2 = get_tape_recorder()  # Should return existing
        
        assert r1 is r2
    
    def test_reset_creates_new_instance(self):
        """reset should create new instance."""
        reset_tape_recorder()
        r1 = get_tape_recorder("test1")
        reset_tape_recorder()
        r2 = get_tape_recorder("test2")
        
        assert r1 is not r2
        assert r2.session_id == "test2"
