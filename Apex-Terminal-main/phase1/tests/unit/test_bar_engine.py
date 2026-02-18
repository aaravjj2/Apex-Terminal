"""
Unit tests for Bar Engine.
"""

import pytest
import pytest_asyncio
from services.bar_engine import BarIndexCalculator, NYSESessionCalendar, BarEngine
from services.bar_engine.session import AlwaysOpenCalendar
from services.models import CanonicalTick, Bar, BarState, TickSource
from services.config import timeframe_to_ms


class TestBarIndexCalculator:
    """Tests for BarIndex calculations."""
    
    def test_calculate_bar_index_basic(self):
        """Test basic bar index calculation."""
        calc = BarIndexCalculator(
            symbol="AAPL",
            timeframe="1m",
        )
        
        # Set a known epoch
        epoch = 1704067200000  # 2024-01-01 00:00:00 UTC
        calc.set_epoch(epoch)
        
        # Same timestamp as epoch should be index 0
        idx = calc.calculate_bar_index(epoch)
        assert idx == 0
        
        # One minute later should be index 1
        idx = calc.calculate_bar_index(epoch + 60000)
        assert idx == 1
        
        # Five minutes later should be index 5
        idx = calc.calculate_bar_index(epoch + 300000)
        assert idx == 5
    
    def test_calculate_bar_index_5m(self):
        """Test bar index for 5-minute timeframe."""
        calc = BarIndexCalculator(
            symbol="AAPL",
            timeframe="5m",
        )
        
        epoch = 1704067200000
        calc.set_epoch(epoch)
        
        # Same timestamp
        idx = calc.calculate_bar_index(epoch)
        assert idx == 0
        
        # 5 minutes later
        idx = calc.calculate_bar_index(epoch + 300000)
        assert idx == 1
        
        # 10 minutes later
        idx = calc.calculate_bar_index(epoch + 600000)
        assert idx == 2
    
    def test_get_interval_bounds(self):
        """Test interval boundary calculation."""
        # Use AlwaysOpenCalendar to avoid session boundary issues
        calendar = AlwaysOpenCalendar()
        
        calc = BarIndexCalculator(
            symbol="AAPL",
            timeframe="1m",
            calendar=calendar,
        )
        
        ts = 1704067230000  # 30 seconds into a minute
        start, end = calc.get_interval_bounds(ts)
        
        # Should be aligned to minute boundary
        assert start == 1704067200000
        assert end == 1704067260000
    
    def test_bar_index_deterministic(self):
        """Test that bar index is deterministic."""
        calc1 = BarIndexCalculator(symbol="AAPL", timeframe="1m")
        calc2 = BarIndexCalculator(symbol="AAPL", timeframe="1m")
        
        epoch = 1704067200000
        calc1.set_epoch(epoch)
        calc2.set_epoch(epoch)
        
        ts = 1704067500000
        
        assert calc1.calculate_bar_index(ts) == calc2.calculate_bar_index(ts)


class TestBarEngine:
    """Tests for Bar Engine."""
    
    @pytest.mark.asyncio
    async def test_process_single_tick(self):
        """Test processing a single tick."""
        engine = BarEngine(timeframes=["1m"])
        
        tick = CanonicalTick(
            source=TickSource.MOCK,
            symbol="AAPL",
            ts_ms=1704067200000,
            price=185.50,
            size=100,
        )
        
        bars = await engine.process_tick(tick)
        
        assert len(bars) == 1
        bar = bars[0]
        assert bar.symbol == "AAPL"
        assert bar.timeframe == "1m"
        assert bar.open == 185.50
        assert bar.close == 185.50
        assert bar.volume == 100
        assert bar.state == BarState.FORMING
    
    @pytest.mark.asyncio
    async def test_process_multiple_ticks_same_bar(self):
        """Test multiple ticks aggregating to same bar."""
        engine = BarEngine(timeframes=["1m"])
        
        base_ts = 1704067200000
        ticks = [
            CanonicalTick(source=TickSource.MOCK, symbol="AAPL", ts_ms=base_ts, price=185.50, size=100),
            CanonicalTick(source=TickSource.MOCK, symbol="AAPL", ts_ms=base_ts + 10000, price=185.75, size=150),
            CanonicalTick(source=TickSource.MOCK, symbol="AAPL", ts_ms=base_ts + 20000, price=185.30, size=200),
            CanonicalTick(source=TickSource.MOCK, symbol="AAPL", ts_ms=base_ts + 30000, price=185.60, size=100),
        ]
        
        for tick in ticks:
            await engine.process_tick(tick)
        
        bar = engine.get_forming_bar("AAPL", "1m")
        
        assert bar is not None
        assert bar.open == 185.50
        assert bar.high == 185.75
        assert bar.low == 185.30
        assert bar.close == 185.60
        assert bar.volume == 550
        assert bar.tick_count == 4
    
    @pytest.mark.asyncio
    async def test_process_ticks_new_bar(self):
        """Test ticks spanning multiple bars."""
        engine = BarEngine(timeframes=["1m"])
        confirmed_bars = []
        
        async def on_confirm(bar):
            confirmed_bars.append(bar)
        
        engine.register_confirmed_callback(on_confirm)
        
        base_ts = 1704067200000
        ticks = [
            # First bar
            CanonicalTick(source=TickSource.MOCK, symbol="AAPL", ts_ms=base_ts, price=185.50, size=100),
            CanonicalTick(source=TickSource.MOCK, symbol="AAPL", ts_ms=base_ts + 30000, price=185.60, size=150),
            # Second bar (new minute)
            CanonicalTick(source=TickSource.MOCK, symbol="AAPL", ts_ms=base_ts + 60000, price=185.70, size=200),
        ]
        
        for tick in ticks:
            await engine.process_tick(tick)
        
        # First bar should be confirmed when second bar starts
        assert len(confirmed_bars) == 1
        assert confirmed_bars[0].close == 185.60
        
        # Current forming bar should be the second one
        bar = engine.get_forming_bar("AAPL", "1m")
        assert bar.open == 185.70
    
    @pytest.mark.asyncio
    async def test_multi_timeframe_aggregation(self):
        """Test aggregation across multiple timeframes."""
        engine = BarEngine(timeframes=["1m", "5m"])
        
        tick = CanonicalTick(
            source=TickSource.MOCK,
            symbol="AAPL",
            ts_ms=1704067200000,
            price=185.50,
            size=100,
        )
        
        bars = await engine.process_tick(tick)
        
        # Should create bars for both timeframes
        assert len(bars) == 2
        
        bar_1m = engine.get_forming_bar("AAPL", "1m")
        bar_5m = engine.get_forming_bar("AAPL", "5m")
        
        assert bar_1m is not None
        assert bar_5m is not None
        assert bar_1m.timeframe == "1m"
        assert bar_5m.timeframe == "5m"
    
    @pytest.mark.asyncio
    async def test_force_confirm_all(self):
        """Test force confirming all forming bars."""
        engine = BarEngine(timeframes=["1m", "5m"])
        
        tick = CanonicalTick(
            source=TickSource.MOCK,
            symbol="AAPL",
            ts_ms=1704067200000,
            price=185.50,
            size=100,
        )
        
        await engine.process_tick(tick)
        
        confirmed = await engine.force_confirm_all()
        
        assert len(confirmed) == 2
        for bar in confirmed:
            assert bar.state == BarState.CONFIRMED
    
    @pytest.mark.asyncio
    async def test_no_bar_for_no_ticks(self):
        """Test that gaps in data don't create fabricated bars."""
        engine = BarEngine(timeframes=["1m"])
        confirmed_bars = []
        
        async def on_confirm(bar):
            confirmed_bars.append(bar)
        
        engine.register_confirmed_callback(on_confirm)
        
        base_ts = 1704067200000
        
        # Tick at minute 0
        await engine.process_tick(CanonicalTick(
            source=TickSource.MOCK, symbol="AAPL", ts_ms=base_ts, price=185.50, size=100
        ))
        
        # Tick at minute 5 (gap of 4 minutes)
        await engine.process_tick(CanonicalTick(
            source=TickSource.MOCK, symbol="AAPL", ts_ms=base_ts + 300000, price=186.00, size=100
        ))
        
        # Only first bar should be confirmed (gap bars not created)
        assert len(confirmed_bars) == 1
        assert confirmed_bars[0].ts_start_ms == base_ts


class TestGapHandling:
    """Tests for gap handling behavior."""
    
    @pytest.mark.asyncio
    async def test_gap_does_not_fabricate_bars(self):
        """Test that gaps in tick data don't create fabricated bars."""
        engine = BarEngine(timeframes=["1m"])
        all_bars = []
        
        async def collect_bar(bar):
            all_bars.append(bar)
        
        engine.register_confirmed_callback(collect_bar)
        
        base_ts = 1704067200000
        
        # First tick
        await engine.process_tick(CanonicalTick(
            source=TickSource.MOCK, symbol="AAPL", ts_ms=base_ts, price=185.50, size=100
        ))
        
        # Gap of 10 minutes
        await engine.process_tick(CanonicalTick(
            source=TickSource.MOCK, symbol="AAPL", ts_ms=base_ts + 600000, price=186.00, size=100
        ))
        
        await engine.force_confirm_all()
        
        # Should have exactly 2 bars, not 11
        assert len(all_bars) == 2
        
        # Verify no fabricated bars in between
        bar_indices = {bar.bar_index for bar in all_bars}
        # There should be a gap in indices
        assert len(bar_indices) == 2


class TestNaNPropagation:
    """Tests for NaN/None value handling."""
    
    def test_empty_bar_has_none_values(self):
        """Test that bars with no ticks have None OHLC values."""
        bar = Bar(
            symbol="AAPL",
            timeframe="1m",
            bar_index=0,
            ts_start_ms=1704067200000,
            ts_end_ms=1704067260000,
        )
        
        assert bar.open is None
        assert bar.high is None
        assert bar.low is None
        assert bar.close is None
        assert bar.volume == 0.0
        assert bar.is_empty()
    
    def test_canonical_dict_preserves_none(self):
        """Test that canonical dict preserves None values."""
        bar = Bar(
            symbol="AAPL",
            timeframe="1m",
            bar_index=0,
            ts_start_ms=1704067200000,
            ts_end_ms=1704067260000,
        )
        
        canonical = bar.to_canonical_dict()
        
        assert canonical["open"] is None
        assert canonical["high"] is None
        assert canonical["low"] is None
        assert canonical["close"] is None
