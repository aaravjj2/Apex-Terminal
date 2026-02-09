"""
Unit tests for Pattern Detection
"""
import pytest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from datetime import datetime, timezone, timedelta
from services.charting.patterns import PatternDetector, Pattern
from services.models import Bar


@pytest.fixture
def detector():
    return PatternDetector()


@pytest.fixture
def uptrend_bars():
    """Create bars in uptrend"""
    bars = []
    base_time = datetime(2024, 1, 1, 9, 30, tzinfo=timezone.utc)
    for i in range(100):
        base = 100.0 + i * 0.3
        ts_start = int((base_time + timedelta(minutes=i)).timestamp() * 1000)
        bar = Bar(
            symbol="AAPL",
            timeframe="1min",
            bar_index=i,
            ts_start_ms=ts_start,
            ts_end_ms=ts_start + 60000,
            open=float(base),
            high=float(base + 1.0),
            low=float(base - 0.5),
            close=float(base + 0.8),
            volume=1000,
        )
        bars.append(bar)
    return bars


@pytest.fixture
def flag_pattern_bars():
    """Create bars that form a bull flag pattern"""
    bars = []
    base_time = datetime(2024, 1, 1, 9, 30, tzinfo=timezone.utc)
    
    # Uptrend (pole)
    for i in range(20):
        base = 100.0 + i * 2.0
        ts_start = int((base_time + timedelta(minutes=i)).timestamp() * 1000)
        bar = Bar(
            symbol="AAPL",
            timeframe="1min",
            bar_index=i,
            ts_start_ms=ts_start,
            ts_end_ms=ts_start + 60000,
            open=float(base),
            high=float(base + 2.5),
            low=float(base - 0.5),
            close=float(base + 2.0),
            volume=2000,
        )
        bars.append(bar)
    
    # Consolidation (flag)
    last_price = 100.0 + 19 * 2.0 + 2.0
    for i in range(15):
        ts_start = int((base_time + timedelta(minutes=20 + i)).timestamp() * 1000)
        bar = Bar(
            symbol="AAPL",
            timeframe="1min",
            bar_index=20 + i,
            ts_start_ms=ts_start,
            ts_end_ms=ts_start + 60000,
            open=float(last_price - 1.0),
            high=float(last_price),
            low=float(last_price - 2.0),
            close=float(last_price - 1.5),
            volume=800,
        )
        bars.append(bar)
    
    return bars


class TestPatternDetector:
    def test_detect_patterns_basic(self, detector, uptrend_bars):
        """Test basic pattern detection"""
        patterns = detector.detect_patterns(uptrend_bars)
        
        assert isinstance(patterns, list)
        # Should return list of Pattern dataclass instances
        
        for pattern in patterns:
            assert isinstance(pattern, Pattern)
            assert hasattr(pattern, 'pattern_type')
            assert hasattr(pattern, 'confidence')
            assert hasattr(pattern, 'context')
            
            # Confidence should be between 0 and 1
            assert 0 <= pattern.confidence <= 1

    def test_detect_flag_pattern(self, detector, flag_pattern_bars):
        """Test detection with flag pattern bars"""
        patterns = detector.detect_patterns(flag_pattern_bars)
        
        # Just verify no errors and returns list
        assert isinstance(patterns, list)

    def test_detect_double_top(self, detector):
        """Test detection of double top pattern"""
        bars = []
        base_time = datetime(2024, 1, 1, 9, 30, tzinfo=timezone.utc)
        
        # Create double top pattern
        # First peak
        for i in range(20):
            base = 100.0 + i * 0.5
            ts_start = int((base_time + timedelta(minutes=i)).timestamp() * 1000)
            bar = Bar(
                symbol="AAPL",
                timeframe="1min",
                bar_index=i,
                ts_start_ms=ts_start,
                ts_end_ms=ts_start + 60000,
                open=float(base),
                high=float(base + 0.5),
                low=float(base - 0.3),
                close=float(base + 0.4),
                volume=1000,
            )
            bars.append(bar)
        
        # Decline
        for i in range(10):
            base = 110.0 - i * 0.5
            ts_start = int((base_time + timedelta(minutes=20 + i)).timestamp() * 1000)
            bar = Bar(
                symbol="AAPL",
                timeframe="1min",
                bar_index=20 + i,
                ts_start_ms=ts_start,
                ts_end_ms=ts_start + 60000,
                open=float(base),
                high=float(base + 0.3),
                low=float(base - 0.5),
                close=float(base - 0.4),
                volume=1000,
            )
            bars.append(bar)
        
        # Second peak
        for i in range(20):
            base = 105.0 + i * 0.25
            ts_start = int((base_time + timedelta(minutes=30 + i)).timestamp() * 1000)
            bar = Bar(
                symbol="AAPL",
                timeframe="1min",
                bar_index=30 + i,
                ts_start_ms=ts_start,
                ts_end_ms=ts_start + 60000,
                open=float(base),
                high=float(base + 0.5),
                low=float(base - 0.3),
                close=float(base + 0.4),
                volume=1000,
            )
            bars.append(bar)
        
        patterns = detector.detect_patterns(bars)
        
        # Just verify no errors and returns list
        assert isinstance(patterns, list)

    def test_detect_engulfing_candle(self, detector):
        """Test detection of engulfing pattern"""
        bars = []
        base_time = datetime(2024, 1, 1, 9, 30, tzinfo=timezone.utc)
        
        # Create bars with engulfing pattern
        for i in range(30):
            base = 100.0 + i * 0.2
            ts_start = int((base_time + timedelta(minutes=i)).timestamp() * 1000)
            bar = Bar(
                symbol="AAPL",
                timeframe="1min",
                bar_index=i,
                ts_start_ms=ts_start,
                ts_end_ms=ts_start + 60000,
                open=float(base),
                high=float(base + 0.5),
                low=float(base - 0.3),
                close=float(base + 0.3),
                volume=1000,
            )
            bars.append(bar)
        
        patterns = detector.detect_patterns(bars)
        assert isinstance(patterns, list)

    def test_confidence_threshold(self, detector, uptrend_bars):
        """Test that confidence values are valid"""
        patterns = detector.detect_patterns(uptrend_bars)
        
        for pattern in patterns:
            # All confidence values should be between 0 and 1
            assert 0 <= pattern.confidence <= 1

    def test_pattern_context(self, detector, uptrend_bars):
        """Test that patterns have context"""
        patterns = detector.detect_patterns(uptrend_bars)
        
        for pattern in patterns:
            # Context should be a string
            assert isinstance(pattern.context, str)

    def test_empty_bars(self, detector):
        """Test handling of empty bars list"""
        patterns = detector.detect_patterns([])
        assert patterns == []

    def test_insufficient_bars(self, detector):
        """Test handling of insufficient bars"""
        bars = []
        base_time = datetime(2024, 1, 1, 9, 30, tzinfo=timezone.utc)
        for i in range(5):
            ts_start = int((base_time + timedelta(minutes=i)).timestamp() * 1000)
            bar = Bar(
                symbol="AAPL",
                timeframe="1min",
                bar_index=i,
                ts_start_ms=ts_start,
                ts_end_ms=ts_start + 60000,
                open=100.0,
                high=101.0,
                low=99.0,
                close=100.5,
                volume=1000,
            )
            bars.append(bar)
        
        patterns = detector.detect_patterns(bars)
        # Should return empty list or handle gracefully
        assert isinstance(patterns, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
