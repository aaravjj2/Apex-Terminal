"""
Unit tests for Deterministic Tick Replayer.

Tests cover:
- Tick source loading
- Deterministic replay
- Speed control
- Callbacks
- Tick generation
"""

import pytest
import asyncio
from pathlib import Path
import tempfile

import sys
sys.path.insert(0, '/home/aarav/Aarav/Tradingview recreation/phase1')

from services.replay.tick_replayer import (
    DeterministicTickReplayer,
    TickReplayConfig,
    CSVTickSource,
    MemoryTickSource,
    TickGenerator,
    create_test_ticks,
)
from services.clock.market_clock import MarketClock, ClockMode
from services.models import CanonicalTick, TickSource


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


@pytest.fixture
def virtual_clock():
    """Create virtual clock."""
    return MarketClock(
        mode=ClockMode.VIRTUAL,
        start_time_ms=1704067200000,
    )


@pytest.fixture
def replayer(virtual_clock):
    """Create tick replayer."""
    config = TickReplayConfig(speed_multiplier=100.0)  # Fast for testing
    return DeterministicTickReplayer(clock=virtual_clock, config=config)


class TestMemoryTickSource:
    """Tests for MemoryTickSource."""
    
    @pytest.mark.asyncio
    async def test_iteration(self):
        """Should iterate over ticks."""
        ticks = [
            create_tick(ts_ms=1000),
            create_tick(ts_ms=2000),
            create_tick(ts_ms=3000),
        ]
        
        source = MemoryTickSource(ticks)
        
        result = []
        async for tick in source:
            result.append(tick)
        
        assert len(result) == 3
    
    @pytest.mark.asyncio
    async def test_sorts_by_timestamp(self):
        """Should sort ticks by timestamp."""
        ticks = [
            create_tick(ts_ms=3000),
            create_tick(ts_ms=1000),
            create_tick(ts_ms=2000),
        ]
        
        source = MemoryTickSource(ticks)
        
        result = []
        async for tick in source:
            result.append(tick.ts_ms)
        
        assert result == [1000, 2000, 3000]
    
    def test_tick_count(self):
        """Should return tick count."""
        ticks = [create_tick() for _ in range(5)]
        source = MemoryTickSource(ticks)
        
        assert source.tick_count == 5


class TestCSVTickSource:
    """Tests for CSVTickSource."""
    
    @pytest.mark.asyncio
    async def test_load_csv(self):
        """Should load ticks from CSV."""
        csv_content = """source,symbol,ts_ms,price,size
mock,AAPL,1000,100.0,10.0
mock,AAPL,2000,101.0,20.0
mock,AAPL,3000,102.0,30.0
"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            temp_path = Path(f.name)
        
        try:
            source = CSVTickSource(temp_path)
            source.load()
            
            result = []
            async for tick in source:
                result.append(tick)
            
            assert len(result) == 3
            assert result[0].price == 100.0
            assert result[2].price == 102.0
        finally:
            temp_path.unlink()


class TestDeterministicTickReplayer:
    """Tests for DeterministicTickReplayer."""
    
    def test_requires_virtual_clock(self):
        """Should require virtual clock."""
        live_clock = MarketClock(mode=ClockMode.LIVE)
        
        with pytest.raises(ValueError, match="VIRTUAL"):
            DeterministicTickReplayer(clock=live_clock)
    
    @pytest.mark.asyncio
    async def test_replay_ticks(self, replayer):
        """Should replay ticks."""
        ticks = [
            create_tick(ts_ms=1704067200000),
            create_tick(ts_ms=1704067200100),
            create_tick(ts_ms=1704067200200),
        ]
        
        received = []
        
        async def on_tick(tick):
            received.append(tick)
        
        replayer.set_source(MemoryTickSource(ticks))
        replayer.register_tick_callback(on_tick)
        
        await replayer.start()
        
        # Wait for completion
        await asyncio.sleep(0.1)
        
        await replayer.stop()
        
        assert len(received) == 3
    
    @pytest.mark.asyncio
    async def test_batch_callback(self, replayer):
        """Should call batch callbacks."""
        ticks = [create_tick(ts_ms=1704067200000 + i * 10) for i in range(10)]
        
        batches = []
        
        async def on_batch(batch):
            batches.append(batch)
        
        config = TickReplayConfig(speed_multiplier=100.0, batch_size=5)
        replayer._config = config
        
        replayer.set_source(MemoryTickSource(ticks))
        replayer.register_batch_callback(on_batch)
        
        await replayer.start()
        await asyncio.sleep(0.1)
        await replayer.stop()
        
        assert len(batches) >= 2
    
    @pytest.mark.asyncio
    async def test_pause_resume(self, replayer, virtual_clock):
        """Should pause and resume."""
        ticks = [create_tick(ts_ms=1704067200000 + i * 100) for i in range(100)]
        
        replayer.set_source(MemoryTickSource(ticks))
        
        await replayer.start()
        await asyncio.sleep(0.01)
        
        await replayer.pause()
        assert replayer._paused
        assert virtual_clock.is_frozen
        
        await replayer.resume()
        assert not replayer._paused
        assert not virtual_clock.is_frozen
        
        await replayer.stop()
    
    @pytest.mark.asyncio
    async def test_set_speed(self, replayer, virtual_clock):
        """Should set replay speed."""
        await replayer.set_speed(5.0)
        
        assert replayer._config.speed_multiplier == 5.0
        assert virtual_clock.speed_multiplier == 5.0
    
    @pytest.mark.asyncio
    async def test_stats(self, replayer):
        """Should return statistics."""
        ticks = [create_tick() for _ in range(5)]
        replayer.set_source(MemoryTickSource(ticks))
        
        stats = replayer.get_stats()
        
        assert stats["source_ticks"] == 5
        assert stats["running"] is False


class TestTickGenerator:
    """Tests for TickGenerator."""
    
    def test_generate_ticks(self):
        """Should generate ticks."""
        generator = TickGenerator(
            symbol="AAPL",
            base_price=100.0,
            seed=42,
        )
        
        ticks = generator.generate(10, start_ms=1000, interval_ms=100)
        
        assert len(ticks) == 10
        assert all(t.symbol == "AAPL" for t in ticks)
    
    def test_deterministic_generation(self):
        """Same seed should produce same ticks."""
        gen1 = TickGenerator(symbol="AAPL", seed=42)
        gen2 = TickGenerator(symbol="AAPL", seed=42)
        
        ticks1 = gen1.generate(10, start_ms=1000)
        ticks2 = gen2.generate(10, start_ms=1000)
        
        for t1, t2 in zip(ticks1, ticks2):
            assert t1.price == t2.price
            assert t1.size == t2.size
    
    def test_timestamps_correct(self):
        """Timestamps should be correctly spaced."""
        generator = TickGenerator(symbol="AAPL", seed=42)
        
        ticks = generator.generate(5, start_ms=1000, interval_ms=100)
        
        assert ticks[0].ts_ms == 1000
        assert ticks[1].ts_ms == 1100
        assert ticks[4].ts_ms == 1400
    
    def test_reset(self):
        """Reset should restore base price."""
        generator = TickGenerator(
            symbol="AAPL",
            base_price=100.0,
            seed=42,
        )
        
        generator.generate(100, start_ms=1000)
        generator.reset()
        
        assert generator._current_price == 100.0


class TestCreateTestTicks:
    """Tests for create_test_ticks helper."""
    
    def test_creates_ticks(self):
        """Should create test ticks."""
        ticks = create_test_ticks(count=50)
        
        assert len(ticks) == 50
    
    def test_reproducible(self):
        """Same parameters should produce same ticks."""
        ticks1 = create_test_ticks(seed=123)
        ticks2 = create_test_ticks(seed=123)
        
        for t1, t2 in zip(ticks1, ticks2):
            assert t1.price == t2.price


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
