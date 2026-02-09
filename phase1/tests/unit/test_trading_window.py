"""
Unit tests for Trading Window Gate

Tests the critical safety behavior:
1. Trading window bounds (9:30am - 2:15pm ET)
2. Flatten trigger at/after cutoff
3. Restart safety (immediate flatten if started after cutoff)
4. Early close day handling
"""
import pytest
from datetime import datetime, time, timedelta
from unittest.mock import Mock, patch, MagicMock
from zoneinfo import ZoneInfo

from services.autopilot.trading_window import (
    TradingWindowGate,
    TradingGateState,
    TradingWindowStatus,
    check_trading_window,
    get_trading_gate,
    MARKET_OPEN,
    TRADING_CUTOFF,
    MARKET_CLOSE,
    EARLY_CLOSE,
    ET,
)


class TestTradingWindowBounds:
    """Test trading window time bounds."""
    
    def test_constants_correct(self):
        """Verify trading window constants."""
        assert MARKET_OPEN == time(9, 30)
        assert TRADING_CUTOFF == time(14, 15)  # 2:15pm ET
        assert MARKET_CLOSE == time(16, 0)
        assert EARLY_CLOSE == time(13, 0)
    
    def test_pre_market(self):
        """Test pre-market state (before 9:30am)."""
        gate = TradingWindowGate()
        
        # 8:00am ET on a trading day (Monday)
        now = datetime(2025, 1, 6, 8, 0, 0, tzinfo=ET)
        
        with patch.object(gate, '_is_trading_day', return_value=True):
            status = gate.check(now_override=now)
        
        assert status.state == TradingGateState.PRE_MARKET
        assert status.allow_trading is False
        assert status.trigger_flatten is False
    
    def test_trading_window_open(self):
        """Test trading allowed during window (9:30am - 2:15pm)."""
        gate = TradingWindowGate()
        
        # Various times within trading window
        test_times = [
            datetime(2025, 1, 6, 9, 30, 0, tzinfo=ET),   # Market open
            datetime(2025, 1, 6, 10, 0, 0, tzinfo=ET),   # 10am
            datetime(2025, 1, 6, 12, 0, 0, tzinfo=ET),   # Noon
            datetime(2025, 1, 6, 14, 14, 59, tzinfo=ET), # Just before cutoff
        ]
        
        with patch.object(gate, '_is_trading_day', return_value=True):
            for now in test_times:
                status = gate.check(now_override=now)
                assert status.state == TradingGateState.TRADING_ALLOWED, f"Failed for {now}"
                assert status.allow_trading is True, f"Failed for {now}"
                assert status.trigger_flatten is False, f"Failed for {now}"
    
    def test_flatten_at_cutoff(self):
        """Test flatten triggered at exactly 2:15pm."""
        gate = TradingWindowGate()
        
        # Exactly 2:15pm ET
        now = datetime(2025, 1, 6, 14, 15, 0, tzinfo=ET)
        
        with patch.object(gate, '_is_trading_day', return_value=True):
            status = gate.check(now_override=now)
        
        assert status.state == TradingGateState.FLATTEN_REQUIRED
        assert status.allow_trading is False
        assert status.trigger_flatten is True
        assert "cutoff" in status.reason.lower()
    
    def test_flatten_after_cutoff(self):
        """Test flatten triggered after 2:15pm."""
        gate = TradingWindowGate()
        
        # Various times after cutoff
        test_times = [
            datetime(2025, 1, 6, 14, 30, 0, tzinfo=ET),  # 2:30pm
            datetime(2025, 1, 6, 15, 0, 0, tzinfo=ET),   # 3pm
            datetime(2025, 1, 6, 15, 59, 0, tzinfo=ET),  # Just before close
        ]
        
        with patch.object(gate, '_is_trading_day', return_value=True):
            for now in test_times:
                gate._flatten_triggered_today = None  # Reset
                status = gate.check(now_override=now)
                assert status.state == TradingGateState.FLATTEN_REQUIRED, f"Failed for {now}"
                assert status.allow_trading is False, f"Failed for {now}"
                assert status.trigger_flatten is True, f"Failed for {now}"
    
    def test_flatten_only_triggered_once_per_day(self):
        """Test flatten only triggers once per trading day."""
        gate = TradingWindowGate()
        
        # First check at 2:30pm
        now1 = datetime(2025, 1, 6, 14, 30, 0, tzinfo=ET)
        with patch.object(gate, '_is_trading_day', return_value=True):
            status1 = gate.check(now_override=now1)
        assert status1.trigger_flatten is True
        
        # Second check at 3:00pm same day - should NOT trigger again
        now2 = datetime(2025, 1, 6, 15, 0, 0, tzinfo=ET)
        with patch.object(gate, '_is_trading_day', return_value=True):
            status2 = gate.check(now_override=now2)
        assert status2.state == TradingGateState.FLATTEN_REQUIRED
        assert status2.trigger_flatten is False  # Already triggered
        assert "Already flattened" in status2.reason


class TestRestartSafety:
    """Test restart-safety behavior."""
    
    def test_restart_after_cutoff_triggers_flatten(self):
        """If dyno restarts at 2:40pm, should flatten immediately."""
        gate = TradingWindowGate()
        
        # Simulating restart at 2:40pm
        now = datetime(2025, 1, 6, 14, 40, 0, tzinfo=ET)
        
        with patch.object(gate, '_is_trading_day', return_value=True):
            should_flatten, reason = gate.check_restart_safety()
            
            # Need to override time for the internal check
            status = gate.check(now_override=now)
        
        # Reset and test restart safety
        gate._flatten_triggered_today = None
        
        with patch.object(gate, 'check') as mock_check:
            mock_status = TradingWindowStatus(
                state=TradingGateState.FLATTEN_REQUIRED,
                allow_trading=False,
                trigger_flatten=True,
                reason="After trading cutoff"
            )
            mock_check.return_value = mock_status
            
            should_flatten, reason = gate.check_restart_safety()
        
        assert should_flatten is True
        assert "cutoff" in reason.lower() or "restart" in reason.lower()
    
    def test_restart_during_trading_window_no_flatten(self):
        """If dyno restarts at 11:00am, should NOT flatten."""
        gate = TradingWindowGate()
        
        with patch.object(gate, 'check') as mock_check:
            mock_status = TradingWindowStatus(
                state=TradingGateState.TRADING_ALLOWED,
                allow_trading=True,
                trigger_flatten=False,
                reason="Trading window open"
            )
            mock_check.return_value = mock_status
            
            should_flatten, reason = gate.check_restart_safety()
        
        assert should_flatten is False
    
    def test_restart_pre_market_no_flatten(self):
        """If dyno restarts at 8:00am, should NOT flatten."""
        gate = TradingWindowGate()
        
        with patch.object(gate, 'check') as mock_check:
            mock_status = TradingWindowStatus(
                state=TradingGateState.PRE_MARKET,
                allow_trading=False,
                trigger_flatten=False,
                reason="Pre-market"
            )
            mock_check.return_value = mock_status
            
            should_flatten, reason = gate.check_restart_safety()
        
        assert should_flatten is False


class TestWeekendAndHolidays:
    """Test weekend and holiday handling."""
    
    def test_weekend_no_trading(self):
        """Test Saturday/Sunday returns closed state."""
        gate = TradingWindowGate()
        
        # Saturday
        saturday = datetime(2025, 1, 4, 12, 0, 0, tzinfo=ET)
        status = gate.check(now_override=saturday)
        assert status.state == TradingGateState.CLOSED
        assert status.allow_trading is False
        assert status.trigger_flatten is False
    
    def test_holiday_no_trading(self):
        """Test NYSE holiday returns closed state."""
        gate = TradingWindowGate()
        
        # MLK Day 2025 - Jan 20
        holiday = datetime(2025, 1, 20, 12, 0, 0, tzinfo=ET)
        status = gate.check(now_override=holiday)
        
        # Should be closed (depending on calendar implementation)
        assert status.state == TradingGateState.CLOSED


class TestEarlyClose:
    """Test early close day handling."""
    
    def test_early_close_earlier_cutoff(self):
        """On early close days (1pm close), cutoff should be earlier."""
        gate = TradingWindowGate()
        
        # Black Friday 2025 (1pm close) - day after Thanksgiving (Nov 28, 2025)
        black_friday = datetime(2025, 11, 28).date()
        
        # The gate should check calendar and use earlier cutoff for early close days
        # We'll test with an Alpaca clock that reports 1pm close instead
        mock_clock = Mock()
        mock_clock.timestamp = datetime(2025, 11, 28, 10, 0, 0, tzinfo=ET)
        mock_clock.is_open = True
        mock_clock.next_close = datetime(2025, 11, 28, 13, 0, 0, tzinfo=ET)  # 1pm close
        
        cutoff = gate._get_cutoff_time(black_friday, mock_clock)
        
        # Cutoff should be 12:45pm (1:00pm - 15 min buffer)
        expected_cutoff = time(12, 45)
        assert cutoff == expected_cutoff


class TestAlpacaClockIntegration:
    """Test integration with Alpaca's market clock."""
    
    def test_uses_alpaca_clock_timestamp(self):
        """Test that Alpaca clock timestamp is preferred."""
        gate = TradingWindowGate()
        
        mock_clock = Mock()
        mock_clock.timestamp = datetime(2025, 1, 6, 11, 0, 0, tzinfo=ET)
        mock_clock.is_open = True
        
        with patch.object(gate, '_is_trading_day', return_value=True):
            status = gate.check(alpaca_clock=mock_clock)
        
        assert status.current_time_et.hour == 11
    
    def test_alpaca_clock_early_close(self):
        """Test that Alpaca clock's next_close is respected."""
        gate = TradingWindowGate()
        
        # Alpaca says market closes at 1pm today
        mock_clock = Mock()
        mock_clock.timestamp = datetime(2025, 1, 6, 10, 0, 0, tzinfo=ET)
        mock_clock.is_open = True
        mock_clock.next_close = datetime(2025, 1, 6, 13, 0, 0, tzinfo=ET)  # 1pm close
        
        today = datetime(2025, 1, 6).date()
        
        # With Alpaca clock reporting 1pm close, cutoff should be 12:45pm
        cutoff = gate._get_cutoff_time(today, mock_clock)
        
        # Should use Alpaca's 1pm close with buffer: 12:45pm
        expected_cutoff = time(12, 45)
        assert cutoff == expected_cutoff


class TestModuleLevelFunctions:
    """Test module-level convenience functions."""
    
    def test_get_trading_gate_singleton(self):
        """Test singleton accessor."""
        gate1 = get_trading_gate()
        gate2 = get_trading_gate()
        assert gate1 is gate2
    
    def test_check_trading_window_function(self):
        """Test convenience function."""
        status = check_trading_window()
        assert isinstance(status, TradingWindowStatus)
        assert hasattr(status, 'state')
        assert hasattr(status, 'allow_trading')
        assert hasattr(status, 'trigger_flatten')
