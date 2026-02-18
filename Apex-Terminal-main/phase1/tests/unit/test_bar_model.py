"""
Unit tests for Bar model and bar lifecycle.
"""

import pytest
from services.models import Bar, BarState, CanonicalTick, TickSource


class TestBarModel:
    """Tests for Bar model."""
    
    def test_bar_creation(self):
        """Test creating a new bar."""
        bar = Bar(
            symbol="AAPL",
            timeframe="1m",
            bar_index=0,
            ts_start_ms=1704067200000,
            ts_end_ms=1704067260000,
        )
        
        assert bar.symbol == "AAPL"
        assert bar.timeframe == "1m"
        assert bar.bar_index == 0
        assert bar.state == BarState.FORMING
        assert bar.open is None
        assert bar.is_empty()
    
    def test_bar_update_first_tick(self):
        """Test updating bar with first tick."""
        bar = Bar(
            symbol="AAPL",
            timeframe="1m",
            bar_index=0,
            ts_start_ms=1704067200000,
            ts_end_ms=1704067260000,
        )
        
        tick = CanonicalTick(
            source=TickSource.MOCK,
            symbol="AAPL",
            ts_ms=1704067200000,
            price=185.50,
            size=100,
        )
        
        bar.update_with_tick(tick)
        
        assert bar.open == 185.50
        assert bar.high == 185.50
        assert bar.low == 185.50
        assert bar.close == 185.50
        assert bar.volume == 100
        assert bar.tick_count == 1
        assert not bar.is_empty()
    
    def test_bar_update_multiple_ticks(self):
        """Test updating bar with multiple ticks."""
        bar = Bar(
            symbol="AAPL",
            timeframe="1m",
            bar_index=0,
            ts_start_ms=1704067200000,
            ts_end_ms=1704067260000,
        )
        
        ticks = [
            CanonicalTick(source=TickSource.MOCK, symbol="AAPL", ts_ms=1704067200000, price=185.50, size=100),
            CanonicalTick(source=TickSource.MOCK, symbol="AAPL", ts_ms=1704067210000, price=185.75, size=150),  # New high
            CanonicalTick(source=TickSource.MOCK, symbol="AAPL", ts_ms=1704067220000, price=185.30, size=200),  # New low
            CanonicalTick(source=TickSource.MOCK, symbol="AAPL", ts_ms=1704067230000, price=185.60, size=100),  # Close
        ]
        
        for tick in ticks:
            bar.update_with_tick(tick)
        
        assert bar.open == 185.50
        assert bar.high == 185.75
        assert bar.low == 185.30
        assert bar.close == 185.60
        assert bar.volume == 550
        assert bar.tick_count == 4
    
    def test_bar_confirm(self):
        """Test bar confirmation."""
        bar = Bar(
            symbol="AAPL",
            timeframe="1m",
            bar_index=0,
            ts_start_ms=1704067200000,
            ts_end_ms=1704067260000,
            open=185.50,
            high=185.75,
            low=185.30,
            close=185.60,
            volume=550,
        )
        
        assert bar.state == BarState.FORMING
        
        bar.confirm()
        
        assert bar.state == BarState.CONFIRMED
    
    def test_bar_cannot_update_after_confirm(self):
        """Test that confirmed bars cannot be updated."""
        bar = Bar(
            symbol="AAPL",
            timeframe="1m",
            bar_index=0,
            ts_start_ms=1704067200000,
            ts_end_ms=1704067260000,
            open=185.50,
            high=185.75,
            low=185.30,
            close=185.60,
            volume=550,
        )
        
        bar.confirm()
        
        tick = CanonicalTick(
            source=TickSource.MOCK,
            symbol="AAPL",
            ts_ms=1704067240000,
            price=186.00,
            size=100,
        )
        
        with pytest.raises(ValueError, match="Cannot update bar"):
            bar.update_with_tick(tick)
    
    def test_bar_cannot_confirm_twice(self):
        """Test that bars cannot be confirmed twice."""
        bar = Bar(
            symbol="AAPL",
            timeframe="1m",
            bar_index=0,
            ts_start_ms=1704067200000,
            ts_end_ms=1704067260000,
            open=185.50,
            high=185.75,
            low=185.30,
            close=185.60,
            volume=550,
        )
        
        bar.confirm()
        
        with pytest.raises(ValueError, match="Cannot confirm bar"):
            bar.confirm()
    
    def test_bar_hash_deterministic(self):
        """Test that bar hash is deterministic."""
        bar1 = Bar(
            symbol="AAPL",
            timeframe="1m",
            bar_index=0,
            ts_start_ms=1704067200000,
            ts_end_ms=1704067260000,
            open=185.50,
            high=185.75,
            low=185.30,
            close=185.60,
            volume=550,
        )
        
        bar2 = Bar(
            symbol="AAPL",
            timeframe="1m",
            bar_index=0,
            ts_start_ms=1704067200000,
            ts_end_ms=1704067260000,
            open=185.50,
            high=185.75,
            low=185.30,
            close=185.60,
            volume=550,
        )
        
        assert bar1.bar_hash == bar2.bar_hash
    
    def test_bar_hash_different_for_different_data(self):
        """Test that different bars have different hashes."""
        bar1 = Bar(
            symbol="AAPL",
            timeframe="1m",
            bar_index=0,
            ts_start_ms=1704067200000,
            ts_end_ms=1704067260000,
            open=185.50,
            high=185.75,
            low=185.30,
            close=185.60,
            volume=550,
        )
        
        bar2 = Bar(
            symbol="AAPL",
            timeframe="1m",
            bar_index=0,
            ts_start_ms=1704067200000,
            ts_end_ms=1704067260000,
            open=185.50,
            high=185.75,
            low=185.30,
            close=185.65,  # Different close
            volume=550,
        )
        
        assert bar1.bar_hash != bar2.bar_hash
    
    def test_bar_canonical_dict(self):
        """Test canonical dict export."""
        bar = Bar(
            symbol="AAPL",
            timeframe="1m",
            bar_index=0,
            ts_start_ms=1704067200000,
            ts_end_ms=1704067260000,
            open=185.50,
            high=185.75,
            low=185.30,
            close=185.60,
            volume=550,
        )
        
        canonical = bar.to_canonical_dict()
        
        # Keys should be alphabetically ordered in JSON
        keys = list(canonical.keys())
        assert keys == sorted(keys)
        
        assert canonical["symbol"] == "AAPL"
        assert canonical["open"] == 185.50


class TestBarLifecycle:
    """Tests for bar lifecycle transitions."""
    
    def test_lifecycle_forming_to_confirmed(self):
        """Test FORMING → CONFIRMED transition."""
        bar = Bar(
            symbol="AAPL",
            timeframe="1m",
            bar_index=0,
            ts_start_ms=1704067200000,
            ts_end_ms=1704067260000,
        )
        
        assert bar.state == BarState.FORMING
        
        tick = CanonicalTick(
            source=TickSource.MOCK,
            symbol="AAPL",
            ts_ms=1704067200000,
            price=185.50,
            size=100,
        )
        bar.update_with_tick(tick)
        
        bar.confirm()
        assert bar.state == BarState.CONFIRMED
    
    def test_lifecycle_confirmed_to_historical(self):
        """Test CONFIRMED → HISTORICAL transition."""
        bar = Bar(
            symbol="AAPL",
            timeframe="1m",
            bar_index=0,
            ts_start_ms=1704067200000,
            ts_end_ms=1704067260000,
            open=185.50,
            high=185.75,
            low=185.30,
            close=185.60,
            volume=550,
        )
        
        bar.confirm()
        bar.to_historical()
        
        assert bar.state == BarState.HISTORICAL
    
    def test_empty_bar_detection(self):
        """Test detection of empty bars (no ticks)."""
        bar = Bar(
            symbol="AAPL",
            timeframe="1m",
            bar_index=0,
            ts_start_ms=1704067200000,
            ts_end_ms=1704067260000,
        )
        
        assert bar.is_empty()
        
        tick = CanonicalTick(
            source=TickSource.MOCK,
            symbol="AAPL",
            ts_ms=1704067200000,
            price=185.50,
            size=100,
        )
        bar.update_with_tick(tick)
        
        assert not bar.is_empty()
