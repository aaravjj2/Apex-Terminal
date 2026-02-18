"""
Unit tests for MarketClock.

Tests cover:
- Live mode time retrieval
- Virtual mode time control
- Freeze/resume functionality
- Speed multiplier
- Thread safety
- Callback notifications
"""

import pytest
import asyncio
import time
from unittest.mock import AsyncMock, patch

import sys
sys.path.insert(0, '/home/aarav/Aarav/Tradingview recreation/phase1')

from services.clock.market_clock import (
    MarketClock,
    ClockMode,
    get_clock,
    set_clock,
    reset_clock,
)


class TestMarketClockLiveMode:
    """Tests for live mode operation."""
    
    def test_live_mode_returns_wall_time(self):
        """Live mode should return approximate wall clock time."""
        clock = MarketClock(mode=ClockMode.LIVE)
        
        before = int(time.time() * 1000)
        current = clock.now()
        after = int(time.time() * 1000)
        
        assert before <= current <= after
    
    def test_live_mode_cannot_advance(self):
        """Advancing time in live mode should raise error."""
        clock = MarketClock(mode=ClockMode.LIVE)
        
        with pytest.raises(RuntimeError, match="Cannot advance time in LIVE mode"):
            clock.advance(1000)
    
    def test_live_mode_cannot_seek(self):
        """Seeking time in live mode should raise error."""
        clock = MarketClock(mode=ClockMode.LIVE)
        
        with pytest.raises(RuntimeError, match="Cannot seek time in LIVE mode"):
            clock.seek(1704067200000)
    
    def test_live_mode_freeze_resume(self):
        """Freeze and resume should work in live mode."""
        clock = MarketClock(mode=ClockMode.LIVE)
        
        frozen_time = clock.freeze()
        assert clock.is_frozen
        
        # Time should not advance while frozen
        time.sleep(0.01)
        assert clock.now() == frozen_time
        
        # Resume
        resumed_time = clock.resume()
        assert not clock.is_frozen
        
        # Time should advance again
        time.sleep(0.01)
        assert clock.now() > frozen_time


class TestMarketClockVirtualMode:
    """Tests for virtual mode operation."""
    
    def test_virtual_mode_starts_at_specified_time(self):
        """Virtual mode should start at the specified time."""
        start_time = 1704067200000  # 2024-01-01 00:00:00 UTC
        clock = MarketClock(mode=ClockMode.VIRTUAL, start_time_ms=start_time)
        
        assert clock.now() == start_time
    
    def test_virtual_mode_advance(self):
        """Advancing virtual time should work correctly."""
        start_time = 1704067200000
        clock = MarketClock(mode=ClockMode.VIRTUAL, start_time_ms=start_time)
        
        new_time = clock.advance(5000)
        
        assert new_time == start_time + 5000
        assert clock.now() == start_time + 5000
    
    def test_virtual_mode_advance_negative(self):
        """Advancing by negative delta should work."""
        start_time = 1704067200000
        clock = MarketClock(mode=ClockMode.VIRTUAL, start_time_ms=start_time)
        
        clock.advance(10000)
        new_time = clock.advance(-5000)
        
        assert new_time == start_time + 5000
    
    def test_virtual_mode_seek(self):
        """Seeking to specific time should work."""
        start_time = 1704067200000
        clock = MarketClock(mode=ClockMode.VIRTUAL, start_time_ms=start_time)
        
        target = 1704070800000  # 1 hour later
        new_time = clock.seek(target)
        
        assert new_time == target
        assert clock.now() == target
    
    def test_virtual_mode_freeze_resume(self):
        """Freeze and resume in virtual mode."""
        start_time = 1704067200000
        clock = MarketClock(mode=ClockMode.VIRTUAL, start_time_ms=start_time)
        
        # Advance then freeze
        clock.advance(5000)
        frozen_time = clock.freeze()
        
        assert frozen_time == start_time + 5000
        assert clock.is_frozen
        
        # Cannot advance while frozen
        with pytest.raises(RuntimeError, match="Cannot advance frozen clock"):
            clock.advance(1000)
        
        # Resume
        clock.resume()
        assert not clock.is_frozen
        assert clock.now() == start_time + 5000
    
    def test_virtual_mode_cannot_seek_while_frozen(self):
        """Seeking while frozen should raise error."""
        clock = MarketClock(mode=ClockMode.VIRTUAL, start_time_ms=1704067200000)
        clock.freeze()
        
        with pytest.raises(RuntimeError, match="Cannot seek frozen clock"):
            clock.seek(1704070800000)


class TestMarketClockSpeedMultiplier:
    """Tests for speed multiplier functionality."""
    
    def test_speed_multiplier_initialization(self):
        """Speed multiplier should be settable at init."""
        clock = MarketClock(
            mode=ClockMode.VIRTUAL,
            start_time_ms=1704067200000,
            speed_multiplier=2.0,
        )
        
        assert clock.speed_multiplier == 2.0
    
    def test_set_speed_multiplier(self):
        """Speed multiplier can be changed."""
        clock = MarketClock(mode=ClockMode.VIRTUAL, start_time_ms=1704067200000)
        
        clock.set_speed(2.5)
        
        assert clock.speed_multiplier == 2.5
    
    def test_speed_multiplier_ignored_in_live_mode(self):
        """Setting speed in live mode should be ignored (with warning)."""
        clock = MarketClock(mode=ClockMode.LIVE)
        
        clock.set_speed(2.0)
        
        # Default speed should remain
        assert clock.speed_multiplier == 1.0


class TestMarketClockRunning:
    """Tests for running virtual clock with wall time."""
    
    def test_start_running_advances_with_wall_time(self):
        """Virtual clock running should advance with wall time."""
        start_time = 1704067200000
        clock = MarketClock(mode=ClockMode.VIRTUAL, start_time_ms=start_time)
        
        clock.start_running()
        
        time.sleep(0.05)  # 50ms
        
        elapsed = clock.now() - start_time
        assert elapsed >= 40  # At least 40ms (allowing for timing variance)
        assert elapsed <= 100  # But not more than 100ms
    
    def test_start_running_with_speed_multiplier(self):
        """Running clock should respect speed multiplier."""
        start_time = 1704067200000
        clock = MarketClock(
            mode=ClockMode.VIRTUAL,
            start_time_ms=start_time,
            speed_multiplier=2.0,
        )
        
        clock.start_running()
        
        time.sleep(0.05)  # 50ms wall time
        
        elapsed = clock.now() - start_time
        # At 2x speed, 50ms wall time = ~100ms virtual time
        assert elapsed >= 80  # At least 80ms
        assert elapsed <= 150  # But not more than 150ms
    
    def test_stop_running_captures_current_time(self):
        """Stopping running clock should capture current position."""
        start_time = 1704067200000
        clock = MarketClock(mode=ClockMode.VIRTUAL, start_time_ms=start_time)
        
        clock.start_running()
        time.sleep(0.05)
        
        stopped_time = clock.stop_running()
        
        # Time should be frozen at stopped position
        time.sleep(0.02)
        assert clock.now() == stopped_time
    
    def test_cannot_start_running_while_frozen(self):
        """Starting running while frozen should raise error."""
        clock = MarketClock(mode=ClockMode.VIRTUAL, start_time_ms=1704067200000)
        clock.freeze()
        
        with pytest.raises(RuntimeError, match="Cannot start running a frozen clock"):
            clock.start_running()


class TestMarketClockModeSwitch:
    """Tests for switching clock modes."""
    
    def test_switch_to_virtual_mode(self):
        """Switching from live to virtual should work."""
        clock = MarketClock(mode=ClockMode.LIVE)
        
        clock.set_mode(ClockMode.VIRTUAL, start_time_ms=1704067200000)
        
        assert clock.mode == ClockMode.VIRTUAL
        assert clock.now() == 1704067200000
    
    def test_switch_to_live_mode(self):
        """Switching from virtual to live should work."""
        clock = MarketClock(mode=ClockMode.VIRTUAL, start_time_ms=1704067200000)
        
        clock.set_mode(ClockMode.LIVE)
        
        assert clock.mode == ClockMode.LIVE
        # Should return wall time now
        assert abs(clock.now() - int(time.time() * 1000)) < 100


class TestMarketClockCallbacks:
    """Tests for callback notifications."""
    
    @pytest.mark.asyncio
    async def test_register_callback(self):
        """Callbacks should be registered and called."""
        clock = MarketClock(mode=ClockMode.VIRTUAL, start_time_ms=1704067200000)
        
        received_times = []
        
        async def callback(new_time: int):
            received_times.append(new_time)
        
        clock.register_callback(callback)
        
        await clock.notify_time_change(1704067205000)
        
        assert len(received_times) == 1
        assert received_times[0] == 1704067205000
    
    @pytest.mark.asyncio
    async def test_unregister_callback(self):
        """Unregistered callbacks should not be called."""
        clock = MarketClock(mode=ClockMode.VIRTUAL, start_time_ms=1704067200000)
        
        received_times = []
        
        async def callback(new_time: int):
            received_times.append(new_time)
        
        clock.register_callback(callback)
        clock.unregister_callback(callback)
        
        await clock.notify_time_change(1704067205000)
        
        assert len(received_times) == 0
    
    @pytest.mark.asyncio
    async def test_callback_error_handling(self):
        """Callback errors should be caught and logged."""
        clock = MarketClock(mode=ClockMode.VIRTUAL, start_time_ms=1704067200000)
        
        async def failing_callback(new_time: int):
            raise ValueError("Test error")
        
        clock.register_callback(failing_callback)
        
        # Should not raise
        await clock.notify_time_change(1704067205000)


class TestMarketClockState:
    """Tests for clock state inspection."""
    
    def test_get_state(self):
        """State should return all relevant info."""
        clock = MarketClock(
            mode=ClockMode.VIRTUAL,
            start_time_ms=1704067200000,
            speed_multiplier=1.5,
        )
        
        state = clock.get_state()
        
        assert state["mode"] == "virtual"
        assert state["current_time_ms"] == 1704067200000
        assert state["frozen"] is False
        assert state["speed_multiplier"] == 1.5
        assert state["running"] is False
    
    def test_repr(self):
        """Repr should show mode, time, and frozen state."""
        clock = MarketClock(mode=ClockMode.VIRTUAL, start_time_ms=1704067200000)
        
        repr_str = repr(clock)
        
        assert "virtual" in repr_str
        assert "1704067200000" in repr_str
        assert "frozen=False" in repr_str


class TestGlobalClock:
    """Tests for global clock management."""
    
    def setup_method(self):
        """Reset global clock before each test."""
        reset_clock()
    
    def teardown_method(self):
        """Reset global clock after each test."""
        reset_clock()
    
    def test_get_clock_creates_default(self):
        """get_clock should create a default live clock."""
        clock = get_clock()
        
        assert clock.mode == ClockMode.LIVE
    
    def test_set_clock(self):
        """set_clock should replace global clock."""
        custom_clock = MarketClock(mode=ClockMode.VIRTUAL, start_time_ms=1704067200000)
        
        set_clock(custom_clock)
        
        retrieved = get_clock()
        assert retrieved is custom_clock
        assert retrieved.mode == ClockMode.VIRTUAL
    
    def test_reset_clock(self):
        """reset_clock should clear the global clock."""
        custom_clock = MarketClock(mode=ClockMode.VIRTUAL, start_time_ms=1704067200000)
        set_clock(custom_clock)
        
        reset_clock()
        
        # Getting clock should create new default
        new_clock = get_clock()
        assert new_clock is not custom_clock
        assert new_clock.mode == ClockMode.LIVE


class TestMarketClockThreadSafety:
    """Tests for thread safety."""
    
    def test_concurrent_now_calls(self):
        """Multiple threads calling now() should not cause issues."""
        import threading
        
        clock = MarketClock(mode=ClockMode.VIRTUAL, start_time_ms=1704067200000)
        results = []
        errors = []
        
        def read_time():
            try:
                for _ in range(100):
                    results.append(clock.now())
            except Exception as e:
                errors.append(e)
        
        threads = [threading.Thread(target=read_time) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        
        assert len(errors) == 0
        assert len(results) == 1000
    
    def test_concurrent_advance_calls(self):
        """Multiple threads advancing should not corrupt state."""
        import threading
        
        clock = MarketClock(mode=ClockMode.VIRTUAL, start_time_ms=0)
        errors = []
        
        def advance_time():
            try:
                for _ in range(100):
                    clock.advance(1)
            except Exception as e:
                errors.append(e)
        
        threads = [threading.Thread(target=advance_time) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        
        assert len(errors) == 0
        # Should have advanced by 1000 total (10 threads * 100 advances * 1ms)
        assert clock.now() == 1000


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
