"""
Unit tests for Advanced Indicators
"""
import pytest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from datetime import datetime, timezone, timedelta
from decimal import Decimal
from services.charting.advanced_indicators import AdvancedIndicators
from services.models import Bar


@pytest.fixture
def sample_bars():
    """Create sample bars with trending pattern"""
    bars = []
    base_time = datetime(2024, 1, 1, 9, 30, tzinfo=timezone.utc)
    for i in range(200):
        # Create uptrend
        base_price = 100.0 + i * 0.5
        ts_start = int((base_time + timedelta(minutes=i)).timestamp() * 1000)
        bar = Bar(
            symbol="AAPL",
            timeframe="1min",
            bar_index=i,
            ts_start_ms=ts_start,
            ts_end_ms=ts_start + 60000,
            open=base_price,
            high=base_price + 1.0,
            low=base_price - 1.0,
            close=base_price + 0.5,
            volume=1000 + i * 5,
        )
        bars.append(bar)
    return bars


@pytest.fixture
def indicators():
    return AdvancedIndicators()


class TestAdvancedIndicators:
    def test_anchored_vwap(self, indicators, sample_bars):
        """Test anchored VWAP calculation"""
        # Method expects an integer index, not a datetime
        anchor_index = 0  # Anchor at first bar
        result = indicators.calculate_anchored_vwap(sample_bars, anchor_index)
        
        assert result is not None
        # Result is an AnchoredVWAPResult dataclass, not a dict
        assert hasattr(result, 'vwap')
        assert hasattr(result, 'upper_band_1std')
        assert hasattr(result, 'lower_band_1std')
        assert hasattr(result, 'upper_band_2std')
        assert hasattr(result, 'lower_band_2std')
        assert hasattr(result, 'anchor_time')
        
        # VWAP should be within price range
        prices = [float(b.close) for b in sample_bars]
        min_price = min(prices)
        max_price = max(prices)
        # Result is an AnchoredVWAPResult dataclass with lists
        if result.vwap:
            # Get the last VWAP value from the list of tuples
            last_vwap = result.vwap[-1][1]
            assert min_price <= last_vwap <= max_price
            
            # Upper bands should be above VWAP
            last_upper_1std = result.upper_band_1std[-1][1]
            last_upper_2std = result.upper_band_2std[-1][1]
            assert last_upper_1std > last_vwap
            assert last_upper_2std > last_upper_1std
            
            # Lower bands should be below VWAP
            last_lower_1std = result.lower_band_1std[-1][1]
            last_lower_2std = result.lower_band_2std[-1][1]
            assert last_lower_1std < last_vwap
            assert last_lower_2std < last_lower_1std

    def test_atr_bands(self, indicators, sample_bars):
        """Test ATR bands calculation"""
        result = indicators.calculate_atr_bands(
            sample_bars, atr_period=14, multiplier=2.0
        )
        
        assert result is not None
        # Result is ATRBandsResult dataclass
        assert hasattr(result, 'upper_band')
        assert hasattr(result, 'lower_band')
        assert hasattr(result, 'atr_values')
        assert hasattr(result, 'multiplier')
        
        if result.atr_values:
            # ATR should be positive (except first bar which is 0)
            last_atr = result.atr_values[-1][1]
            assert last_atr > 0
            
            # Upper should be above lower
            last_upper = result.upper_band[-1][1]
            last_lower = result.lower_band[-1][1]
            assert last_upper > last_lower

    def test_atr_bands_different_parameters(self, indicators, sample_bars):
        """Test ATR bands with different parameters"""
        # Short period, small multiplier
        result1 = indicators.calculate_atr_bands(
            sample_bars, atr_period=7, multiplier=1.0
        )
        
        # Long period, large multiplier
        result2 = indicators.calculate_atr_bands(
            sample_bars, atr_period=28, multiplier=3.0
        )
        
        # Larger multiplier should create wider bands
        width1 = result1.upper_band[-1][1] - result1.lower_band[-1][1]
        width2 = result2.upper_band[-1][1] - result2.lower_band[-1][1]
        
        assert width2 > width1

    def test_ema_regime(self, indicators, sample_bars):
        """Test EMA regime calculation"""
        result = indicators.calculate_ema_regime(sample_bars)
        
        assert result is not None
        # Result is EMARegime dataclass
        assert hasattr(result, 'ema_20')
        assert hasattr(result, 'ema_50')
        assert hasattr(result, 'ema_200')
        assert hasattr(result, 'slope_20')
        assert hasattr(result, 'slope_50')
        assert hasattr(result, 'slope_200')
        assert hasattr(result, 'regime')
        assert hasattr(result, 'crossover_state')
        
        # EMAs should be in reasonable range
        prices = [float(b.close) for b in sample_bars]
        min_price = min(prices)
        max_price = max(prices)
        
        assert min_price <= result.ema_20 <= max_price
        assert min_price <= result.ema_50 <= max_price
        assert min_price <= result.ema_200 <= max_price
        
        # For uptrend data, slope should be positive
        assert result.slope_20 > 0
        assert result.slope_50 > 0
        
        # Regime should be a valid string
        assert result.regime in ["bullish", "bearish", "neutral"]

    def test_ema_regime_uptrend(self, indicators, sample_bars):
        """Test EMA regime detection in uptrend"""
        result = indicators.calculate_ema_regime(sample_bars)
        
        # With uptrending data, should detect bullish regime
        assert result.regime in ["bullish", "neutral"]
        
        # Shorter EMA should be above longer EMA in uptrend
        # (not always true at every point, but generally for strong uptrend)
        if result.regime == "bullish":
            assert result.ema_20 >= result.ema_50

    def test_ema_crossovers(self, indicators, sample_bars):
        """Test crossover detection"""
        result = indicators.calculate_ema_regime(sample_bars)
        
        # Crossover state should be a valid string
        assert result.crossover_state in ["golden_cross", "death_cross", "none"]

    def test_insufficient_data(self, indicators):
        """Test handling of insufficient data"""
        # Create very few bars
        short_bars = []
        for i in range(5):
            ts_start = int(datetime(2024, 1, 1, 9, 30 + i, tzinfo=timezone.utc).timestamp() * 1000)
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
            short_bars.append(bar)
        
        # Should return None for insufficient data
        result = indicators.calculate_ema_regime(short_bars)
        assert result is None

    def test_anchored_vwap_invalid_anchor(self, indicators, sample_bars):
        """Test anchored VWAP with invalid anchor index"""
        # Using index beyond range should return None
        result = indicators.calculate_anchored_vwap(sample_bars, 999)
        assert result is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
