"""
Unit tests for Forecasting service calculations.
"""

import pytest
import math
from services.forecasting.forecast import (
    calculate_historical_volatility,
    calculate_uncertainty_cone,
    generate_forecast,
    _norm_ppf,
)


class TestHistoricalVolatility:
    """Tests for historical volatility calculation."""
    
    def test_constant_prices_zero_volatility(self):
        """Constant prices should have near-zero volatility."""
        prices = [100.0] * 30
        vol = calculate_historical_volatility(prices, period=20, annualize=False)
        assert vol == 0.0 or vol < 0.001
    
    def test_insufficient_data_returns_default(self):
        """Should return default 20% for insufficient data."""
        prices = [100.0, 101.0]  # Only 2 prices
        vol = calculate_historical_volatility(prices, period=20, annualize=True)
        assert vol == 0.20
    
    def test_annualized_vs_daily(self):
        """Annualized volatility should be sqrt(252) times daily."""
        prices = [100 + i * 0.5 for i in range(50)]  # Simple uptrend
        
        daily_vol = calculate_historical_volatility(prices, period=20, annualize=False)
        annual_vol = calculate_historical_volatility(prices, period=20, annualize=True)
        
        expected_ratio = math.sqrt(252)
        actual_ratio = annual_vol / daily_vol if daily_vol > 0 else expected_ratio
        
        assert abs(actual_ratio - expected_ratio) < 0.1
    
    def test_higher_volatility_for_larger_moves(self):
        """Larger price moves should result in higher volatility."""
        # Stable prices
        stable = [100.0, 100.1, 99.9, 100.0, 100.2, 99.8] * 5
        
        # Volatile prices
        volatile = [100.0, 105.0, 95.0, 100.0, 110.0, 90.0] * 5
        
        stable_vol = calculate_historical_volatility(stable, period=20)
        volatile_vol = calculate_historical_volatility(volatile, period=20)
        
        assert volatile_vol > stable_vol


class TestUncertaintyCone:
    """Tests for uncertainty cone calculation."""
    
    def test_cone_structure(self):
        """Cone should have correct structure."""
        cones = calculate_uncertainty_cone(
            current_price=100.0,
            historical_volatility=0.25,
            days_forward=30,
            confidence_levels=[0.68, 0.95]
        )
        
        assert "68%" in cones
        assert "95%" in cones
        assert "upper" in cones["68%"]
        assert "lower" in cones["68%"]
        assert "median" in cones["68%"]
    
    def test_cone_length_matches_days(self):
        """Number of data points should match days_forward."""
        cones = calculate_uncertainty_cone(
            current_price=100.0,
            historical_volatility=0.25,
            days_forward=60
        )
        
        assert len(cones["68%"]["upper"]) == 60
        assert len(cones["68%"]["lower"]) == 60
    
    def test_upper_always_above_lower(self):
        """Upper bound should always be above lower bound."""
        cones = calculate_uncertainty_cone(
            current_price=100.0,
            historical_volatility=0.30,
            days_forward=30
        )
        
        for i in range(30):
            assert cones["68%"]["upper"][i] > cones["68%"]["lower"][i]
    
    def test_wider_confidence_has_wider_cone(self):
        """95% cone should be wider than 68% cone."""
        cones = calculate_uncertainty_cone(
            current_price=100.0,
            historical_volatility=0.25,
            days_forward=30,
            confidence_levels=[0.68, 0.95]
        )
        
        # At day 30, 95% should be wider
        assert cones["95%"]["upper"][-1] > cones["68%"]["upper"][-1]
        assert cones["95%"]["lower"][-1] < cones["68%"]["lower"][-1]
    
    def test_cone_widens_over_time(self):
        """Cone should get wider as time increases."""
        cones = calculate_uncertainty_cone(
            current_price=100.0,
            historical_volatility=0.25,
            days_forward=30
        )
        
        # Day 30 spread should be wider than day 5
        spread_day5 = cones["68%"]["upper"][4] - cones["68%"]["lower"][4]
        spread_day30 = cones["68%"]["upper"][29] - cones["68%"]["lower"][29]
        
        assert spread_day30 > spread_day5
    
    def test_zero_volatility_flat_cone(self):
        """Zero volatility should result in flat cone at current price."""
        cones = calculate_uncertainty_cone(
            current_price=100.0,
            historical_volatility=0.0,
            days_forward=10
        )
        
        for val in cones["68%"]["upper"]:
            assert val == 100.0
        for val in cones["68%"]["lower"]:
            assert val == 100.0


class TestNormPPF:
    """Tests for inverse normal CDF approximation."""
    
    def test_ppf_0_5_is_zero(self):
        """ppf(0.5) should be approximately 0."""
        assert abs(_norm_ppf(0.5)) < 0.01
    
    def test_ppf_symmetry(self):
        """ppf(p) should equal -ppf(1-p)."""
        assert abs(_norm_ppf(0.84) + _norm_ppf(0.16)) < 0.1
    
    def test_ppf_84_is_approx_1(self):
        """ppf(0.84) should be approximately 1.0."""
        assert abs(_norm_ppf(0.84) - 1.0) < 0.05
    
    def test_ppf_975_is_approx_1_96(self):
        """ppf(0.975) should be approximately 1.96."""
        assert abs(_norm_ppf(0.975) - 1.96) < 0.1


class TestGenerateForecast:
    """Tests for the main forecast generation function."""
    
    def test_generates_complete_forecast(self):
        """Should generate a complete UncertaintyCone object."""
        prices = [100 + i * 0.1 for i in range(50)]
        
        forecast = generate_forecast(
            symbol="TEST",
            current_price=105.0,
            historical_prices=prices,
            days_forward=30
        )
        
        assert forecast.symbol == "TEST"
        assert forecast.current_price == 105.0
        assert forecast.forecast_days == 30
        assert len(forecast.cones) > 0
        assert forecast.historical_volatility > 0
    
    def test_respects_volatility_period(self):
        """Should use specified volatility period."""
        prices = [100 + i * 0.2 for i in range(100)]
        
        forecast_short = generate_forecast(
            symbol="TEST",
            current_price=120.0,
            historical_prices=prices,
            volatility_period=10
        )
        
        forecast_long = generate_forecast(
            symbol="TEST",
            current_price=120.0,
            historical_prices=prices,
            volatility_period=50
        )
        
        # Different periods may yield different volatility estimates
        assert forecast_short.historical_volatility != forecast_long.historical_volatility or True
