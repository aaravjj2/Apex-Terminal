"""
Unit tests for Replay Controller.

Tests cover:
- Tick loading
- Play/pause/stop controls
- Seek functionality
- Speed control
- Progress tracking
- State transitions
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock

import sys
sys.path.insert(0, '/home/aarav/Aarav/Tradingview recreation/phase1')

from services.replay.replay_controller import (
    ReplayController,
    ReplaySession,
    ReplayState,
    ReplayConfig,
    ReplayProgress,
)
from services.clock.market_clock import MarketClock, ClockMode
from services.models import CanonicalTick, TickSource


def create_ticks(
    count: int = 100,
    start_ms: int = 1704067200000,
    interval_ms: int = 100,
    symbol: str = "AAPL",
) -> list:
    """Create test ticks."""
    return [
        CanonicalTick(
            source=TickSource.MOCK,
            symbol=symbol,
            ts_ms=start_ms + i * interval_ms,
            price=100.0 + (i % 10) * 0.1,
            size=10.0,
        )
        for i in range(count)
    ]


@pytest.fixture
def virtual_clock():
    """Create virtual clock."""
    return MarketClock(
        mode=ClockMode.VIRTUAL,
        start_time_ms=1704067200000,
    )


@pytest.fixture
def controller(virtual_clock):
    """Create replay controller."""
    config = ReplayConfig(speed_multiplier=10.0)  # Fast for testing
    return ReplayController(clock=virtual_clock, config=config)


class TestReplayControllerInit:
    """Tests for controller initialization."""
    
    def test_init_with_virtual_clock(self, virtual_clock):
        """Should initialize with virtual clock."""
        controller = ReplayController(clock=virtual_clock)
        
        assert controller.state == ReplayState.IDLE
        assert controller.clock is virtual_clock
    
    def test_init_fails_with_live_clock(self):
        """Should fail with live clock."""
        live_clock = MarketClock(mode=ClockMode.LIVE)
        
        with pytest.raises(ValueError, match="VIRTUAL mode"):
            ReplayController(clock=live_clock)
    
    def test_init_with_config(self, virtual_clock):
        """Should accept configuration."""
        config = ReplayConfig(speed_multiplier=2.0)
        controller = ReplayController(clock=virtual_clock, config=config)
        
        assert controller.config.speed_multiplier == 2.0


class TestTickLoading:
    """Tests for tick loading."""
    
    @pytest.mark.asyncio
    async def test_load_ticks(self, controller):
        """Should load ticks."""
        ticks = create_ticks(50)
        
        await controller.load_ticks(ticks)
        
        assert len(controller._ticks) == 50
        assert controller.progress.start_time_ms == ticks[0].ts_ms
        assert controller.progress.end_time_ms == ticks[-1].ts_ms
    
    @pytest.mark.asyncio
    async def test_load_ticks_sorts(self, controller):
        """Should sort ticks by timestamp."""
        ticks = create_ticks(10)
        # Shuffle
        shuffled = [ticks[5], ticks[2], ticks[8], ticks[0], ticks[9],
                    ticks[1], ticks[6], ticks[3], ticks[7], ticks[4]]
        
        await controller.load_ticks(shuffled)
        
        # Verify sorted
        for i in range(len(controller._ticks) - 1):
            assert controller._ticks[i].ts_ms <= controller._ticks[i+1].ts_ms
    
    @pytest.mark.asyncio
    async def test_load_ticks_with_time_range(self, controller):
        """Should accept custom time range."""
        ticks = create_ticks(10)
        
        await controller.load_ticks(
            ticks,
            start_time_ms=1704067100000,
            end_time_ms=1704067500000,
        )
        
        assert controller.progress.start_time_ms == 1704067100000
        assert controller.progress.end_time_ms == 1704067500000
    
    @pytest.mark.asyncio
    async def test_load_empty_ticks(self, controller):
        """Should handle empty tick list."""
        await controller.load_ticks([])
        
        assert len(controller._ticks) == 0


class TestPlaybackControls:
    """Tests for play/pause/stop."""
    
    @pytest.mark.asyncio
    async def test_play(self, controller):
        """Should start playback."""
        ticks = create_ticks(10)
        await controller.load_ticks(ticks)
        
        await controller.play()
        
        assert controller.state == ReplayState.PLAYING
        
        # Cleanup
        await controller.stop()
    
    @pytest.mark.asyncio
    async def test_pause(self, controller):
        """Should pause playback."""
        ticks = create_ticks(100)
        await controller.load_ticks(ticks)
        await controller.play()
        
        await asyncio.sleep(0.01)
        await controller.pause()
        
        assert controller.state == ReplayState.PAUSED
    
    @pytest.mark.asyncio
    async def test_stop_resets(self, controller):
        """Stop should reset to idle."""
        ticks = create_ticks(10)
        await controller.load_ticks(ticks)
        await controller.play()
        
        await asyncio.sleep(0.01)
        await controller.stop()
        
        assert controller.state == ReplayState.IDLE
        assert controller._tick_index == 0
    
    @pytest.mark.asyncio
    async def test_play_after_completion(self, controller):
        """Play after completion should restart."""
        ticks = create_ticks(5)
        await controller.load_ticks(ticks)
        
        # Play to completion (fast)
        controller._config.speed_multiplier = 1000.0
        await controller.play()
        
        # Wait for completion
        for _ in range(50):
            if controller.state == ReplayState.COMPLETED:
                break
            await asyncio.sleep(0.01)
        
        # Play again should reset
        await controller.play()
        
        assert controller.state == ReplayState.PLAYING
        
        await controller.stop()


class TestSeek:
    """Tests for seek functionality."""
    
    @pytest.mark.asyncio
    async def test_seek(self, controller):
        """Should seek to specific time."""
        ticks = create_ticks(100)
        await controller.load_ticks(ticks)
        
        target = ticks[50].ts_ms
        await controller.seek(target)
        
        assert controller.progress.current_time_ms == target
        assert controller._tick_index == 50
    
    @pytest.mark.asyncio
    async def test_seek_updates_clock(self, controller, virtual_clock):
        """Seek should update clock."""
        ticks = create_ticks(100)
        await controller.load_ticks(ticks)
        
        target = ticks[75].ts_ms
        await controller.seek(target)
        
        assert virtual_clock.now() == target
    
    @pytest.mark.asyncio
    async def test_seek_while_playing_resumes(self, controller):
        """Seek while playing should resume after."""
        ticks = create_ticks(100)
        await controller.load_ticks(ticks)
        await controller.play()
        
        await asyncio.sleep(0.01)
        await controller.seek(ticks[50].ts_ms)
        
        # Should resume playing
        assert controller.state == ReplayState.PLAYING
        
        await controller.stop()


class TestStepForward:
    """Tests for step forward."""
    
    @pytest.mark.asyncio
    async def test_step_forward(self, controller):
        """Should advance by specified ticks."""
        ticks = create_ticks(100)
        await controller.load_ticks(ticks)
        
        await controller.step_forward(5)
        
        assert controller.progress.ticks_processed == 5
        assert controller._tick_index == 5
    
    @pytest.mark.asyncio
    async def test_step_forward_at_end(self, controller):
        """Step at end should not exceed bounds."""
        ticks = create_ticks(5)
        await controller.load_ticks(ticks)
        
        await controller.step_forward(10)  # More than available
        
        assert controller._tick_index == 5


class TestSpeedControl:
    """Tests for speed control."""
    
    @pytest.mark.asyncio
    async def test_set_speed(self, controller, virtual_clock):
        """Should set playback speed."""
        await controller.set_speed(5.0)
        
        assert controller.config.speed_multiplier == 5.0
        assert virtual_clock.speed_multiplier == 5.0


class TestProgress:
    """Tests for progress tracking."""
    
    @pytest.mark.asyncio
    async def test_progress_percentage(self, controller):
        """Should calculate progress percentage."""
        ticks = create_ticks(100)
        await controller.load_ticks(ticks)
        
        # At start
        assert controller.progress.progress_pct == 0.0
        
        # Seek to middle
        await controller.seek(ticks[50].ts_ms)
        
        assert controller.progress.progress_pct > 40.0
        assert controller.progress.progress_pct < 60.0
    
    @pytest.mark.asyncio
    async def test_progress_callback(self, controller):
        """Should call progress callbacks."""
        progress_updates = []
        
        async def on_progress(progress):
            progress_updates.append(progress.ticks_processed)
        
        controller.register_progress_callback(on_progress)
        
        ticks = create_ticks(10)
        await controller.load_ticks(ticks)
        
        await controller.step_forward(5)
        
        assert len(progress_updates) > 0


class TestStateCallbacks:
    """Tests for state change callbacks."""
    
    @pytest.mark.asyncio
    async def test_state_callback_on_play(self, controller):
        """Should call callback on play."""
        states = []
        
        async def on_state(state):
            states.append(state)
        
        controller.register_state_callback(on_state)
        
        ticks = create_ticks(10)
        await controller.load_ticks(ticks)
        await controller.play()
        
        assert ReplayState.PLAYING in states
        
        await controller.stop()
    
    @pytest.mark.asyncio
    async def test_state_callback_on_pause(self, controller):
        """Should call callback on pause."""
        states = []
        
        async def on_state(state):
            states.append(state)
        
        controller.register_state_callback(on_state)
        
        ticks = create_ticks(100)
        await controller.load_ticks(ticks)
        await controller.play()
        await asyncio.sleep(0.01)
        await controller.pause()
        
        assert ReplayState.PAUSED in states


class TestGetStatus:
    """Tests for status reporting."""
    
    @pytest.mark.asyncio
    async def test_get_status(self, controller):
        """Should return complete status."""
        ticks = create_ticks(50)
        await controller.load_ticks(ticks)
        
        status = controller.get_status()
        
        assert status["state"] == "idle"
        assert status["ticks_loaded"] == 50
        assert "progress" in status
        assert "config" in status


class TestReplaySession:
    """Tests for ReplaySession."""
    
    @pytest.mark.asyncio
    async def test_session_creation(self):
        """Should create session with all components."""
        session = ReplaySession(
            start_time_ms=1704067200000,
            timeframes=["1m"],
        )
        
        assert session.clock.mode == ClockMode.VIRTUAL
        assert session.controller is not None
        assert session.lifecycle_manager is not None
    
    @pytest.mark.asyncio
    async def test_load_and_play(self):
        """Should load ticks and start playback."""
        session = ReplaySession(
            start_time_ms=1704067200000,
            speed_multiplier=100.0,
        )
        
        ticks = create_ticks(10)
        await session.load_and_play(ticks)
        
        assert session.controller.state == ReplayState.PLAYING
        
        await session.stop()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
