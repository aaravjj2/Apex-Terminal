"""
Unit tests for IV Analytics Calculator
Tests IV Rank, IV Percentile, Skew, and Term Structure
"""

import pytest
from datetime import date, timedelta
from services.options.iv_analytics import (
    IVAnalyticsCalculator,
    VolatilitySkewCalculator,
    TermStructureCalculator,
    calculate_iv_analytics,
)
from services.options.models import IVAnalytics, VolatilitySkew, TermStructure


class TestIVRank:
    """Tests for IV Rank calculation"""
    
    def test_iv_rank_at_low(self):
        """IV at low should give rank 0"""
        rank = IVAnalyticsCalculator.calculate_iv_rank(0.20, 0.40, 0.20)
        assert rank == 0.0
    
    def test_iv_rank_at_high(self):
        """IV at high should give rank 100"""
        rank = IVAnalyticsCalculator.calculate_iv_rank(0.40, 0.40, 0.20)
        assert rank == 100.0
    
    def test_iv_rank_at_midpoint(self):
        """IV at midpoint should give rank 50"""
        rank = IVAnalyticsCalculator.calculate_iv_rank(0.30, 0.40, 0.20)
        assert abs(rank - 50.0) < 0.001  # Allow floating point tolerance
    
    def test_iv_rank_no_range(self):
        """IV rank with no range should default to 50"""
        rank = IVAnalyticsCalculator.calculate_iv_rank(0.30, 0.30, 0.30)
        assert rank == 50.0
    
    def test_iv_rank_clamped_high(self):
        """IV above high should be clamped to 100"""
        rank = IVAnalyticsCalculator.calculate_iv_rank(0.50, 0.40, 0.20)
        assert rank == 100.0
    
    def test_iv_rank_clamped_low(self):
        """IV below low should be clamped to 0"""
        rank = IVAnalyticsCalculator.calculate_iv_rank(0.10, 0.40, 0.20)
        assert rank == 0.0


class TestIVPercentile:
    """Tests for IV Percentile calculation"""
    
    def test_iv_percentile_all_lower(self):
        """All historical lower = 100 percentile"""
        historical = [0.10, 0.15, 0.18, 0.20, 0.22]
        percentile = IVAnalyticsCalculator.calculate_iv_percentile(0.25, historical)
        assert percentile == 100.0
    
    def test_iv_percentile_all_higher(self):
        """All historical higher = 0 percentile"""
        historical = [0.30, 0.35, 0.40, 0.45, 0.50]
        percentile = IVAnalyticsCalculator.calculate_iv_percentile(0.25, historical)
        assert percentile == 0.0
    
    def test_iv_percentile_half(self):
        """Half lower = 50 percentile"""
        historical = [0.20, 0.25, 0.30, 0.35]  # 2 below, 2 above
        percentile = IVAnalyticsCalculator.calculate_iv_percentile(0.27, historical)
        # 0.20 and 0.25 are below 0.27 = 2/4 = 50%
        assert percentile == 50.0
    
    def test_iv_percentile_empty_history(self):
        """Empty history defaults to 50"""
        percentile = IVAnalyticsCalculator.calculate_iv_percentile(0.30, [])
        assert percentile == 50.0


class TestIVAnalyticsCalculator:
    """Tests for full IV analytics"""
    
    def test_calculate_analytics_with_history(self):
        """Full analytics with historical data"""
        historical = [0.20, 0.25, 0.30, 0.35, 0.40]
        
        analytics = IVAnalyticsCalculator.calculate_analytics(
            symbol="AAPL",
            current_iv=0.32,
            historical_ivs=historical,
        )
        
        assert isinstance(analytics, IVAnalytics)
        assert analytics.symbol == "AAPL"
        assert analytics.current_iv == 0.32
        assert analytics.iv_high == 0.40
        assert analytics.iv_low == 0.20
        assert 0 <= analytics.iv_rank <= 100
        assert 0 <= analytics.iv_percentile <= 100
    
    def test_calculate_analytics_no_history(self):
        """Analytics without history returns defaults"""
        analytics = IVAnalyticsCalculator.calculate_analytics(
            symbol="AAPL",
            current_iv=0.30,
            historical_ivs=[],
        )
        
        assert analytics.iv_rank == 50.0  # Unknown
        assert analytics.iv_percentile == 50.0  # Unknown
        assert analytics.iv_high == 0.30  # Current
        assert analytics.iv_low == 0.30  # Current
    
    def test_calculate_analytics_lookback_limit(self):
        """Analytics respects lookback limit"""
        # Create 500 days of history
        historical = [0.20 + i * 0.001 for i in range(500)]
        
        analytics = IVAnalyticsCalculator.calculate_analytics(
            symbol="AAPL",
            current_iv=0.35,
            historical_ivs=historical,
            lookback_days=100,  # Only use last 100
        )
        
        # Should use only last 100 values
        assert analytics.lookback_days == 100


class TestVolatilitySkewCalculator:
    """Tests for Volatility Skew calculation"""
    
    def test_calculate_skew_basic(self):
        """Basic skew calculation"""
        strikes = [90.0, 95.0, 100.0, 105.0, 110.0]
        ivs = [0.30, 0.27, 0.25, 0.26, 0.28]  # Smile pattern
        
        skew = VolatilitySkewCalculator.calculate_skew(
            symbol="AAPL",
            expiration=date.today() + timedelta(days=30),
            strikes=strikes,
            ivs=ivs,
            underlying_price=100.0,
        )
        
        assert isinstance(skew, VolatilitySkew)
        assert skew.atm_strike == 100.0
        assert skew.atm_iv == 0.25
        assert skew.skew_slope != 0  # Should have some slope
    
    def test_calculate_skew_finds_atm(self):
        """Skew correctly identifies ATM strike"""
        strikes = [95.0, 100.0, 105.0]
        ivs = [0.30, 0.25, 0.28]
        
        skew = VolatilitySkewCalculator.calculate_skew(
            symbol="AAPL",
            expiration=date.today() + timedelta(days=30),
            strikes=strikes,
            ivs=ivs,
            underlying_price=102.0,  # Closer to 100 than 105
        )
        
        assert skew.atm_strike == 100.0
    
    def test_calculate_skew_negative_slope(self):
        """Downward sloping skew (typical equity)"""
        strikes = [90.0, 100.0, 110.0]
        ivs = [0.35, 0.25, 0.22]  # OTM puts higher IV
        
        skew = VolatilitySkewCalculator.calculate_skew(
            symbol="AAPL",
            expiration=date.today() + timedelta(days=30),
            strikes=strikes,
            ivs=ivs,
            underlying_price=100.0,
        )
        
        # Negative slope = IV decreases as strike increases
        assert skew.skew_slope < 0
    
    def test_calculate_skew_with_deltas(self):
        """Skew with delta data for 25Δ calculation"""
        strikes = [90.0, 95.0, 100.0, 105.0, 110.0]
        ivs = [0.35, 0.30, 0.25, 0.26, 0.28]
        deltas = [-0.25, -0.10, 0.50, 0.75, 0.90]  # Approximate deltas
        
        skew = VolatilitySkewCalculator.calculate_skew(
            symbol="AAPL",
            expiration=date.today() + timedelta(days=30),
            strikes=strikes,
            ivs=ivs,
            underlying_price=100.0,
            deltas=deltas,
        )
        
        # Should find 25Δ put (first strike)
        assert skew.delta25_put_iv == 0.35
    
    def test_calculate_skew_invalid_data(self):
        """Skew raises on invalid data"""
        with pytest.raises(ValueError):
            VolatilitySkewCalculator.calculate_skew(
                symbol="AAPL",
                expiration=date.today(),
                strikes=[100.0],
                ivs=[0.25, 0.30],  # Mismatched lengths
                underlying_price=100.0,
            )


class TestTermStructureCalculator:
    """Tests for Term Structure calculation"""
    
    def test_contango_structure(self):
        """Contango: IV increases with time"""
        today = date.today()
        expirations = [
            today + timedelta(days=7),
            today + timedelta(days=30),
            today + timedelta(days=60),
            today + timedelta(days=90),
        ]
        atm_ivs = [0.20, 0.22, 0.24, 0.26]  # Increasing
        
        ts = TermStructureCalculator.calculate_term_structure(
            symbol="AAPL",
            expirations=expirations,
            atm_ivs=atm_ivs,
            reference_date=today,
        )
        
        assert ts.structure_type == "contango"
    
    def test_backwardation_structure(self):
        """Backwardation: IV decreases with time"""
        today = date.today()
        expirations = [
            today + timedelta(days=7),
            today + timedelta(days=30),
            today + timedelta(days=60),
        ]
        # Gradual decrease, front not >20% above back average
        atm_ivs = [0.30, 0.28, 0.26]  # Decreasing but not inverted
        
        ts = TermStructureCalculator.calculate_term_structure(
            symbol="AAPL",
            expirations=expirations,
            atm_ivs=atm_ivs,
            reference_date=today,
        )
        
        assert ts.structure_type == "backwardation"
    
    def test_inverted_structure(self):
        """Inverted: Front month significantly elevated (event)"""
        today = date.today()
        expirations = [
            today + timedelta(days=7),
            today + timedelta(days=30),
            today + timedelta(days=60),
        ]
        # Front month 50% higher than back
        atm_ivs = [0.45, 0.25, 0.25]
        
        ts = TermStructureCalculator.calculate_term_structure(
            symbol="AAPL",
            expirations=expirations,
            atm_ivs=atm_ivs,
            reference_date=today,
        )
        
        assert ts.structure_type == "inverted"
    
    def test_flat_structure(self):
        """Flat: No significant slope"""
        today = date.today()
        expirations = [
            today + timedelta(days=7),
            today + timedelta(days=30),
            today + timedelta(days=60),
        ]
        atm_ivs = [0.25, 0.25, 0.25]  # Same IV
        
        ts = TermStructureCalculator.calculate_term_structure(
            symbol="AAPL",
            expirations=expirations,
            atm_ivs=atm_ivs,
            reference_date=today,
        )
        
        assert ts.structure_type == "flat"
    
    def test_term_structure_days_calculation(self):
        """DTE calculated correctly"""
        today = date.today()
        expirations = [
            today + timedelta(days=7),
            today + timedelta(days=30),
        ]
        atm_ivs = [0.25, 0.27]
        
        ts = TermStructureCalculator.calculate_term_structure(
            symbol="AAPL",
            expirations=expirations,
            atm_ivs=atm_ivs,
            reference_date=today,
        )
        
        assert ts.days_to_expiration == [7, 30]
    
    def test_term_structure_filters_expired(self):
        """Expired dates filtered out"""
        today = date.today()
        expirations = [
            today - timedelta(days=7),  # Expired
            today,  # Today (0 DTE)
            today + timedelta(days=30),
        ]
        atm_ivs = [0.25, 0.25, 0.27]
        
        ts = TermStructureCalculator.calculate_term_structure(
            symbol="AAPL",
            expirations=expirations,
            atm_ivs=atm_ivs,
            reference_date=today,
        )
        
        # Only future expiration should remain
        assert len(ts.expirations) == 1
        assert ts.days_to_expiration == [30]


class TestConvenienceFunction:
    """Tests for calculate_iv_analytics convenience function"""
    
    def test_returns_dict(self):
        """Returns dictionary with all fields"""
        result = calculate_iv_analytics(
            symbol="AAPL",
            current_iv=0.30,
            historical_ivs=[0.25, 0.30, 0.35],
        )
        
        assert isinstance(result, dict)
        assert "symbol" in result
        assert "current_iv" in result
        assert "iv_rank" in result
        assert "iv_percentile" in result


class TestToDict:
    """Tests for to_dict serialization"""
    
    def test_iv_analytics_to_dict(self):
        """IVAnalytics serializes correctly"""
        analytics = IVAnalytics(
            symbol="AAPL",
            current_iv=0.2567,
            iv_rank=45.678,
            iv_percentile=52.345,
            iv_high=0.40,
            iv_low=0.20,
        )
        
        result = analytics.to_dict()
        
        # Values should be rounded
        assert result["current_iv"] == 0.2567
        assert result["iv_rank"] == 45.68
        assert result["iv_percentile"] == 52.34  # rounds down
    
    def test_volatility_skew_to_dict(self):
        """VolatilitySkew serializes correctly"""
        skew = VolatilitySkew(
            symbol="AAPL",
            expiration=date(2024, 3, 15),
            strikes=[95.0, 100.0, 105.0],
            ivs=[0.30123, 0.25456, 0.28789],
            atm_strike=100.0,
            atm_iv=0.25456,
            skew_slope=-0.00123456,
        )
        
        result = skew.to_dict()
        
        assert result["expiration"] == "2024-03-15"
        assert len(result["ivs"]) == 3
        # IVs should be rounded to 4 decimals
        assert result["ivs"][0] == 0.3012
    
    def test_term_structure_to_dict(self):
        """TermStructure serializes correctly"""
        ts = TermStructure(
            symbol="AAPL",
            expirations=[date(2024, 3, 15), date(2024, 4, 19)],
            days_to_expiration=[30, 65],
            ivs=[0.25678, 0.28123],
            structure_type="contango",
        )
        
        result = ts.to_dict()
        
        assert result["expirations"] == ["2024-03-15", "2024-04-19"]
        assert result["structure_type"] == "contango"
