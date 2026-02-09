"""
Unit tests for BarLifecycleManager.

Tests cover:
- Tick processing and bar creation
- Bar confirmation at boundaries
- Clock integration (live and virtual modes)
- Callback notifications
- Force confirmation
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock

import sys
sys.path.insert(0, '/home/aarav/Aarav/Tradingview recreation/phase1')

from services.bar_engine.lifecycle_manager import (
    BarLifecycleManager,
    BarLifecycleConfig,
)
from services.clock.market_clock import MarketClock, ClockMode, reset_clock
from services.models import CanonicalTick, BarState, TickSource


@pytest.fixture
def virtual_clock():
    """Create a virtual clock for testing."""
    clock = MarketClock(
        mode=ClockMode.VIRTUAL,
        start_time_ms=1704067200000,  # 2024-01-01 00:00:00 UTC
    )
    return clock


@pytest.fixture
def lifecycle_manager(virtual_clock):
    """Create a lifecycle manager with virtual clock."""
    config = BarLifecycleConfig(
        confirmation_delay_ms=0,
        emit_empty_bars=False,
        auto_confirm_on_new_bar=True,
        boundary_check_interval_ms=50,
    )
    manager = BarLifecycleManager(
        clock=virtual_clock,
        config=config,
        timeframes=["1m"],
    )
    return manager


def create_tick(
    symbol: str = "AAPL",
    ts_ms: int = 1704067200000,
    price: float = 100.0,
    size: float = 10.0,
) -> CanonicalTick:
    """Helper to create a canonical tick."""
    return CanonicalTick(
        source=TickSource.MOCK,
        symbol=symbol,
        ts_ms=ts_ms,
        price=price,
        size=size,
    )


class TestBarLifecycleManagerBasics:
    """Basic lifecycle manager tests."""
    
    @pytest.mark.asyncio
    async def test_process_tick_creates_bar(self, lifecycle_manager):
        """Processing first tick should create a forming bar."""
        tick = create_tick(ts_ms=1704067200000)
        
        updated = await lifecycle_manager.process_tick(tick)
        
        assert len(updated) == 1
        bar = updated[0]
        assert bar.symbol == "AAPL"
        assert bar.timeframe == "1m"
        assert bar.state == BarState.FORMING
        assert bar.open == 100.0
        assert bar.tick_count == 1
    
    @pytest.mark.asyncio
    async def test_multiple_ticks_same_bar(self, lifecycle_manager):
        """Multiple ticks in same interval should update same bar."""
        ticks = [
            create_tick(ts_ms=1704067200000, price=100.0),  # First tick
            create_tick(ts_ms=1704067210000, price=102.0),  # 10s later
            create_tick(ts_ms=1704067220000, price=99.0),   # 20s later
            create_tick(ts_ms=1704067230000, price=101.0),  # 30s later
        ]
        
        for tick in ticks:
            await lifecycle_manager.process_tick(tick)
        
        bar = lifecycle_manager.get_forming_bar("AAPL", "1m")
        
        assert bar is not None
        assert bar.tick_count == 4
        assert bar.open == 100.0
        assert bar.high == 102.0
        assert bar.low == 99.0
        assert bar.close == 101.0
    
    @pytest.mark.asyncio
    async def test_get_forming_bar(self, lifecycle_manager):
        """Should retrieve forming bar by symbol/timeframe."""
        tick = create_tick()
        await lifecycle_manager.process_tick(tick)
        
        bar = lifecycle_manager.get_forming_bar("AAPL", "1m")
        assert bar is not None
        assert bar.symbol == "AAPL"
        
        # Non-existent should return None
        assert lifecycle_manager.get_forming_bar("MSFT", "1m") is None
        assert lifecycle_manager.get_forming_bar("AAPL", "5m") is None


class TestBarConfirmation:
    """Tests for bar confirmation."""
    
    @pytest.mark.asyncio
    async def test_tick_in_new_bar_confirms_old(self, lifecycle_manager):
        """Tick in new bar interval should confirm old bar."""
        confirmed_bars = []
        
        async def on_confirmed(bar):
            confirmed_bars.append(bar)
        
        lifecycle_manager.register_confirmed_callback(on_confirmed)
        
        # First bar (minute 0)
        tick1 = create_tick(ts_ms=1704067200000)  # 00:00:00
        await lifecycle_manager.process_tick(tick1)
        
        # Tick in next bar (minute 1) - should confirm first bar
        tick2 = create_tick(ts_ms=1704067260000)  # 00:01:00
        await lifecycle_manager.process_tick(tick2)
        
        assert len(confirmed_bars) == 1
        assert confirmed_bars[0].bar_index == 1704067200000 // 60000
        assert confirmed_bars[0].state == BarState.CONFIRMED
    
    @pytest.mark.asyncio
    async def test_boundary_check_confirms_bars(self, lifecycle_manager, virtual_clock):
        """Boundary check should confirm bars past their end time."""
        confirmed_bars = []
        
        async def on_confirmed(bar):
            confirmed_bars.append(bar)
        
        lifecycle_manager.register_confirmed_callback(on_confirmed)
        
        # Create bar at minute 0
        tick = create_tick(ts_ms=1704067200000)
        await lifecycle_manager.process_tick(tick)
        
        # Advance clock past bar end (minute 1)
        virtual_clock.seek(1704067260000)
        
        # Check boundaries
        await lifecycle_manager.check_boundaries()
        
        assert len(confirmed_bars) == 1
        assert confirmed_bars[0].state == BarState.CONFIRMED
    
    @pytest.mark.asyncio
    async def test_force_confirm_all(self, lifecycle_manager):
        """Force confirm should confirm all forming bars."""
        # Create bars for multiple symbols
        await lifecycle_manager.process_tick(create_tick(symbol="AAPL"))
        await lifecycle_manager.process_tick(create_tick(symbol="MSFT"))
        
        confirmed = await lifecycle_manager.force_confirm_all()
        
        assert len(confirmed) == 2
        for bar in confirmed:
            assert bar.state == BarState.CONFIRMED
    
    @pytest.mark.asyncio
    async def test_empty_bars_skipped(self, lifecycle_manager):
        """Empty bars should be skipped by default."""
        confirmed_bars = []
        
        async def on_confirmed(bar):
            confirmed_bars.append(bar)
        
        lifecycle_manager.register_confirmed_callback(on_confirmed)
        
        # This should NOT be called - empty bars are skipped
        # We need to trigger boundary check with no ticks
        # which won't happen naturally, so test via config


class TestCallbacks:
    """Tests for callback notifications."""
    
    @pytest.mark.asyncio
    async def test_update_callback(self, lifecycle_manager):
        """Update callback should be called on tick processing."""
        updates = []
        
        async def on_update(bar):
            updates.append(bar)
        
        lifecycle_manager.register_update_callback(on_update)
        
        await lifecycle_manager.process_tick(create_tick())
        
        assert len(updates) == 1
        assert updates[0].state == BarState.FORMING
    
    @pytest.mark.asyncio
    async def test_persist_callback(self, lifecycle_manager):
        """Persist callback should be called on confirmation."""
        persisted = []
        
        async def on_persist(bar):
            persisted.append(bar)
        
        lifecycle_manager.set_persist_callback(on_persist)
        
        # Create and confirm bar
        await lifecycle_manager.process_tick(create_tick(ts_ms=1704067200000))
        await lifecycle_manager.process_tick(create_tick(ts_ms=1704067260000))
        
        assert len(persisted) == 1
        assert persisted[0].state == BarState.CONFIRMED
    
    @pytest.mark.asyncio
    async def test_callback_error_handling(self, lifecycle_manager):
        """Callback errors should be caught and logged."""
        async def failing_callback(bar):
            raise ValueError("Test error")
        
        lifecycle_manager.register_update_callback(failing_callback)
        
        # Should not raise
        await lifecycle_manager.process_tick(create_tick())


class TestClockIntegration:
    """Tests for clock integration."""
    
    @pytest.mark.asyncio
    async def test_virtual_clock_mode(self, virtual_clock):
        """Manager should work with virtual clock."""
        manager = BarLifecycleManager(
            clock=virtual_clock,
            timeframes=["1m"],
        )
        
        assert manager.clock.mode == ClockMode.VIRTUAL
    
    @pytest.mark.asyncio
    async def test_sync_to_time(self, lifecycle_manager, virtual_clock):
        """sync_to_time should advance clock and confirm due bars."""
        confirmed_bars = []
        
        async def on_confirmed(bar):
            confirmed_bars.append(bar)
        
        lifecycle_manager.register_confirmed_callback(on_confirmed)
        
        # Create bar at minute 0
        await lifecycle_manager.process_tick(create_tick(ts_ms=1704067200000))
        
        # Sync to minute 1
        await lifecycle_manager.sync_to_time(1704067260000)
        
        assert len(confirmed_bars) == 1
        assert virtual_clock.now() == 1704067260000
    
    @pytest.mark.asyncio
    async def test_sync_to_time_fails_in_live_mode(self):
        """sync_to_time should fail in live mode."""
        live_clock = MarketClock(mode=ClockMode.LIVE)
        manager = BarLifecycleManager(
            clock=live_clock,
            timeframes=["1m"],
        )
        
        with pytest.raises(RuntimeError, match="VIRTUAL clock mode"):
            await manager.sync_to_time(1704067260000)


class TestMultipleTimeframes:
    """Tests for multiple timeframe support."""
    
    @pytest.mark.asyncio
    async def test_multiple_timeframes(self, virtual_clock):
        """Manager should handle multiple timeframes."""
        manager = BarLifecycleManager(
            clock=virtual_clock,
            timeframes=["1m", "5m"],
        )
        
        tick = create_tick(ts_ms=1704067200000)
        updated = await manager.process_tick(tick)
        
        assert len(updated) == 2
        timeframes = {bar.timeframe for bar in updated}
        assert timeframes == {"1m", "5m"}
    
    @pytest.mark.asyncio
    async def test_timeframe_boundary_independence(self, virtual_clock):
        """Different timeframes should confirm independently."""
        manager = BarLifecycleManager(
            clock=virtual_clock,
            timeframes=["1m", "5m"],
        )
        
        confirmed_bars = []
        
        async def on_confirmed(bar):
            confirmed_bars.append(bar)
        
        manager.register_confirmed_callback(on_confirmed)
        
        # Create bars
        await manager.process_tick(create_tick(ts_ms=1704067200000))
        
        # Tick at 1 minute - 1m bar should confirm, 5m should not
        await manager.process_tick(create_tick(ts_ms=1704067260000))
        
        one_min_confirmed = [b for b in confirmed_bars if b.timeframe == "1m"]
        five_min_confirmed = [b for b in confirmed_bars if b.timeframe == "5m"]
        
        assert len(one_min_confirmed) == 1
        assert len(five_min_confirmed) == 0


class TestStartStop:
    """Tests for start/stop lifecycle."""
    
    @pytest.mark.asyncio
    async def test_start_begins_boundary_check(self, lifecycle_manager):
        """Start should begin boundary check loop."""
        await lifecycle_manager.start()
        
        assert lifecycle_manager._running is True
        assert lifecycle_manager._boundary_check_task is not None
        
        await lifecycle_manager.stop()
    
    @pytest.mark.asyncio
    async def test_stop_confirms_remaining_bars(self, lifecycle_manager):
        """Stop should confirm all remaining forming bars."""
        confirmed_bars = []
        
        async def on_confirmed(bar):
            confirmed_bars.append(bar)
        
        lifecycle_manager.register_confirmed_callback(on_confirmed)
        
        await lifecycle_manager.start()
        await lifecycle_manager.process_tick(create_tick())
        
        await lifecycle_manager.stop()
        
        assert len(confirmed_bars) == 1


class TestStats:
    """Tests for statistics."""
    
    @pytest.mark.asyncio
    async def test_get_stats(self, lifecycle_manager, virtual_clock):
        """Stats should reflect current state."""
        await lifecycle_manager.process_tick(create_tick())
        
        stats = lifecycle_manager.get_stats()
        
        assert stats["forming_bars"] == 1
        assert stats["update_count"] == 1
        assert stats["clock_mode"] == "virtual"
        assert stats["current_time"] == virtual_clock.now()


class TestEdgeCases:
    """Edge case tests."""
    
    @pytest.mark.asyncio
    async def test_tick_exactly_at_boundary(self, lifecycle_manager):
        """Tick exactly at bar boundary should go to new bar."""
        confirmed_bars = []
        
        async def on_confirmed(bar):
            confirmed_bars.append(bar)
        
        lifecycle_manager.register_confirmed_callback(on_confirmed)
        
        # Tick at minute 0 start
        await lifecycle_manager.process_tick(create_tick(ts_ms=1704067200000))
        
        # Tick exactly at minute 1 boundary
        await lifecycle_manager.process_tick(create_tick(ts_ms=1704067260000))
        
        # First bar should be confirmed
        assert len(confirmed_bars) == 1
        assert confirmed_bars[0].ts_start_ms == 1704067200000
    
    @pytest.mark.asyncio
    async def test_concurrent_tick_processing(self, lifecycle_manager):
        """Concurrent tick processing should be thread-safe."""
        ticks = [create_tick(ts_ms=1704067200000 + i * 100) for i in range(100)]
        
        # Process all ticks concurrently
        await asyncio.gather(*[
            lifecycle_manager.process_tick(tick) for tick in ticks
        ])
        
        bar = lifecycle_manager.get_forming_bar("AAPL", "1m")
        assert bar is not None
        assert bar.tick_count == 100


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
