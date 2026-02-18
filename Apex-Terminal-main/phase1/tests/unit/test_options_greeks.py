"""
Unit tests for Options Greeks Calculator
Tests Black-Scholes pricing and Greeks calculations
"""

import pytest
import math
from services.options.greeks import (
    BlackScholesCalculator,
    calculate_greeks,
    implied_volatility,
    GreeksResult,
)


class TestBlackScholesCalculator:
    """Tests for Black-Scholes calculator"""
    
    # Test parameters
    S = 100.0    # Stock price
    K = 100.0    # Strike (ATM)
    T = 30       # 30 days to expiration
    r = 0.05     # 5% risk-free rate
    sigma = 0.20 # 20% IV
    
    def test_call_price_positive(self):
        """Call price should be positive"""
        price = BlackScholesCalculator.call_price(self.S, self.K, self.T, self.r, self.sigma)
        assert price > 0
    
    def test_put_price_positive(self):
        """Put price should be positive"""
        price = BlackScholesCalculator.put_price(self.S, self.K, self.T, self.r, self.sigma)
        assert price > 0
    
    def test_put_call_parity(self):
        """Put-call parity: C - P = S - K*e^(-rT)"""
        call = BlackScholesCalculator.call_price(self.S, self.K, self.T, self.r, self.sigma)
        put = BlackScholesCalculator.put_price(self.S, self.K, self.T, self.r, self.sigma)
        
        T_years = self.T / 365.0
        parity_rhs = self.S - self.K * math.exp(-self.r * T_years)
        
        assert abs((call - put) - parity_rhs) < 0.01
    
    def test_call_price_itm(self):
        """ITM call should have higher price"""
        atm = BlackScholesCalculator.call_price(100, 100, 30, 0.05, 0.20)
        itm = BlackScholesCalculator.call_price(100, 90, 30, 0.05, 0.20)
        assert itm > atm
    
    def test_call_price_otm(self):
        """OTM call should have lower price"""
        atm = BlackScholesCalculator.call_price(100, 100, 30, 0.05, 0.20)
        otm = BlackScholesCalculator.call_price(100, 110, 30, 0.05, 0.20)
        assert otm < atm
    
    def test_call_price_at_expiration(self):
        """At expiration, call = max(0, S-K)"""
        itm = BlackScholesCalculator.call_price(100, 90, 0, 0.05, 0.20)
        otm = BlackScholesCalculator.call_price(100, 110, 0, 0.05, 0.20)
        
        assert itm == 10.0  # S - K = 100 - 90
        assert otm == 0.0
    
    def test_put_price_at_expiration(self):
        """At expiration, put = max(0, K-S)"""
        itm = BlackScholesCalculator.put_price(100, 110, 0, 0.05, 0.20)
        otm = BlackScholesCalculator.put_price(100, 90, 0, 0.05, 0.20)
        
        assert itm == 10.0  # K - S = 110 - 100
        assert otm == 0.0
    
    def test_higher_iv_higher_price(self):
        """Higher IV should result in higher option price"""
        low_iv = BlackScholesCalculator.call_price(100, 100, 30, 0.05, 0.20)
        high_iv = BlackScholesCalculator.call_price(100, 100, 30, 0.05, 0.40)
        
        assert high_iv > low_iv


class TestGreeks:
    """Tests for individual Greeks"""
    
    def test_call_delta_range(self):
        """Call delta should be between 0 and 1"""
        delta = BlackScholesCalculator.delta(100, 100, 30, 0.05, 0.20, "call")
        assert 0 < delta < 1
    
    def test_put_delta_range(self):
        """Put delta should be between -1 and 0"""
        delta = BlackScholesCalculator.delta(100, 100, 30, 0.05, 0.20, "put")
        assert -1 < delta < 0
    
    def test_call_delta_put_delta_relationship(self):
        """Call delta - Put delta = 1"""
        call_delta = BlackScholesCalculator.delta(100, 100, 30, 0.05, 0.20, "call")
        put_delta = BlackScholesCalculator.delta(100, 100, 30, 0.05, 0.20, "put")
        
        assert abs((call_delta - put_delta) - 1.0) < 0.01
    
    def test_itm_call_delta_near_one(self):
        """Deep ITM call delta should be near 1"""
        delta = BlackScholesCalculator.delta(100, 80, 30, 0.05, 0.20, "call")
        assert delta > 0.9
    
    def test_otm_call_delta_near_zero(self):
        """Deep OTM call delta should be near 0"""
        delta = BlackScholesCalculator.delta(100, 120, 30, 0.05, 0.20, "call")
        assert delta < 0.1
    
    def test_gamma_positive(self):
        """Gamma should be positive"""
        gamma = BlackScholesCalculator.gamma(100, 100, 30, 0.05, 0.20)
        assert gamma > 0
    
    def test_gamma_same_for_call_put(self):
        """Gamma is the same for calls and puts at same strike"""
        # Gamma doesn't take option_type - it's the same
        gamma = BlackScholesCalculator.gamma(100, 100, 30, 0.05, 0.20)
        assert gamma > 0
    
    def test_gamma_highest_atm(self):
        """Gamma should be highest for ATM options"""
        atm_gamma = BlackScholesCalculator.gamma(100, 100, 30, 0.05, 0.20)
        itm_gamma = BlackScholesCalculator.gamma(100, 90, 30, 0.05, 0.20)
        otm_gamma = BlackScholesCalculator.gamma(100, 110, 30, 0.05, 0.20)
        
        assert atm_gamma > itm_gamma
        assert atm_gamma > otm_gamma
    
    def test_theta_negative_for_long_options(self):
        """Theta should be negative (time decay)"""
        call_theta = BlackScholesCalculator.theta(100, 100, 30, 0.05, 0.20, "call")
        put_theta = BlackScholesCalculator.theta(100, 100, 30, 0.05, 0.20, "put")
        
        # Long options lose value over time
        assert call_theta < 0
        # Put theta can be positive for deep ITM puts due to interest component
        # but for ATM it should be negative
        assert put_theta < 0
    
    def test_vega_positive(self):
        """Vega should be positive"""
        vega = BlackScholesCalculator.vega(100, 100, 30, 0.05, 0.20)
        assert vega > 0
    
    def test_vega_highest_atm(self):
        """Vega should be highest for ATM options"""
        atm_vega = BlackScholesCalculator.vega(100, 100, 30, 0.05, 0.20)
        itm_vega = BlackScholesCalculator.vega(100, 90, 30, 0.05, 0.20)
        otm_vega = BlackScholesCalculator.vega(100, 110, 30, 0.05, 0.20)
        
        assert atm_vega > itm_vega
        assert atm_vega > otm_vega
    
    def test_vega_longer_expiration_higher(self):
        """Vega should be higher for longer expirations"""
        short_vega = BlackScholesCalculator.vega(100, 100, 30, 0.05, 0.20)
        long_vega = BlackScholesCalculator.vega(100, 100, 90, 0.05, 0.20)
        
        assert long_vega > short_vega
    
    def test_call_rho_positive(self):
        """Call rho should be positive (calls benefit from higher rates)"""
        rho = BlackScholesCalculator.rho(100, 100, 30, 0.05, 0.20, "call")
        assert rho > 0
    
    def test_put_rho_negative(self):
        """Put rho should be negative (puts hurt by higher rates)"""
        rho = BlackScholesCalculator.rho(100, 100, 30, 0.05, 0.20, "put")
        assert rho < 0


class TestGreeksMonotonicity:
    """Tests for monotonicity properties of Greeks"""
    
    def test_delta_increases_with_stock_price(self):
        """Call delta increases as stock price increases"""
        delta_90 = BlackScholesCalculator.delta(90, 100, 30, 0.05, 0.20, "call")
        delta_100 = BlackScholesCalculator.delta(100, 100, 30, 0.05, 0.20, "call")
        delta_110 = BlackScholesCalculator.delta(110, 100, 30, 0.05, 0.20, "call")
        
        assert delta_90 < delta_100 < delta_110
    
    def test_call_price_increases_with_stock(self):
        """Call price increases as stock price increases"""
        price_90 = BlackScholesCalculator.call_price(90, 100, 30, 0.05, 0.20)
        price_100 = BlackScholesCalculator.call_price(100, 100, 30, 0.05, 0.20)
        price_110 = BlackScholesCalculator.call_price(110, 100, 30, 0.05, 0.20)
        
        assert price_90 < price_100 < price_110
    
    def test_put_price_decreases_with_stock(self):
        """Put price decreases as stock price increases"""
        price_90 = BlackScholesCalculator.put_price(90, 100, 30, 0.05, 0.20)
        price_100 = BlackScholesCalculator.put_price(100, 100, 30, 0.05, 0.20)
        price_110 = BlackScholesCalculator.put_price(110, 100, 30, 0.05, 0.20)
        
        assert price_90 > price_100 > price_110


class TestCalculateAll:
    """Tests for calculate_all convenience method"""
    
    def test_calculate_all_returns_result(self):
        """calculate_all should return GreeksResult"""
        result = BlackScholesCalculator.calculate_all(100, 100, 30, 0.05, 0.20, "call")
        
        assert isinstance(result, GreeksResult)
        assert result.delta > 0
        assert result.gamma > 0
        assert result.theta < 0
        assert result.vega > 0
        assert result.theoretical_price > 0
    
    def test_time_value_calculation(self):
        """Time value = price - intrinsic"""
        result = BlackScholesCalculator.calculate_all(110, 100, 30, 0.05, 0.20, "call")
        
        assert result.intrinsic_value == 10.0  # 110 - 100
        assert result.time_value == result.theoretical_price - result.intrinsic_value
        assert result.time_value > 0


class TestImpliedVolatility:
    """Tests for IV calculation"""
    
    def test_iv_recovery(self):
        """Should recover IV from price"""
        # Generate price with known IV
        true_iv = 0.25
        price = BlackScholesCalculator.call_price(100, 100, 30, 0.05, true_iv)
        
        # Calculate IV from price
        calculated_iv = implied_volatility(price, 100, 100, 30, 0.05, "call")
        
        assert abs(calculated_iv - true_iv) < 0.001
    
    def test_iv_put(self):
        """IV calculation works for puts"""
        true_iv = 0.30
        price = BlackScholesCalculator.put_price(100, 100, 30, 0.05, true_iv)
        
        calculated_iv = implied_volatility(price, 100, 100, 30, 0.05, "put")
        
        assert abs(calculated_iv - true_iv) < 0.001
    
    def test_iv_otm_call(self):
        """IV works for OTM calls"""
        true_iv = 0.35
        price = BlackScholesCalculator.call_price(100, 110, 30, 0.05, true_iv)
        
        calculated_iv = implied_volatility(price, 100, 110, 30, 0.05, "call")
        
        assert abs(calculated_iv - true_iv) < 0.01
    
    def test_iv_itm_put(self):
        """IV works for ITM puts"""
        true_iv = 0.28
        price = BlackScholesCalculator.put_price(100, 110, 30, 0.05, true_iv)
        
        calculated_iv = implied_volatility(price, 100, 110, 30, 0.05, "put")
        
        assert abs(calculated_iv - true_iv) < 0.01
    
    def test_iv_below_intrinsic_raises(self):
        """Should raise if price below intrinsic"""
        with pytest.raises(ValueError):
            implied_volatility(5.0, 100, 90, 30, 0.05, "call")  # ITM call, intrinsic = 10
    
    def test_iv_expired_raises(self):
        """Should raise for expired options"""
        with pytest.raises(ValueError):
            implied_volatility(5.0, 100, 100, 0, 0.05, "call")


class TestConvenienceFunction:
    """Tests for calculate_greeks convenience function"""
    
    def test_calculate_greeks_dict(self):
        """calculate_greeks returns dictionary"""
        result = calculate_greeks(100, 100, 30, 0.05, 0.20, "call")
        
        assert isinstance(result, dict)
        assert "delta" in result
        assert "gamma" in result
        assert "theta" in result
        assert "vega" in result
        assert "rho" in result
        assert "theoretical_price" in result
    
    def test_calculate_greeks_rounded(self):
        """Values should be rounded appropriately"""
        result = calculate_greeks(100, 100, 30, 0.05, 0.20, "call")
        
        # Delta rounded to 4 decimals
        assert len(str(result["delta"]).split(".")[-1]) <= 4
        # Price rounded to 2 decimals
        assert len(str(result["theoretical_price"]).split(".")[-1]) <= 2


class TestEdgeCases:
    """Tests for edge cases"""
    
    def test_zero_time_call(self):
        """Call at expiration returns intrinsic"""
        itm = BlackScholesCalculator.call_price(100, 95, 0, 0.05, 0.20)
        otm = BlackScholesCalculator.call_price(100, 105, 0, 0.05, 0.20)
        
        assert itm == 5.0
        assert otm == 0.0
    
    def test_zero_time_greeks(self):
        """Greeks at expiration are well-defined"""
        delta = BlackScholesCalculator.delta(100, 95, 0, 0.05, 0.20, "call")
        gamma = BlackScholesCalculator.gamma(100, 100, 0, 0.05, 0.20)
        theta = BlackScholesCalculator.theta(100, 100, 0, 0.05, 0.20, "call")
        vega = BlackScholesCalculator.vega(100, 100, 0, 0.05, 0.20)
        
        assert delta == 1.0  # ITM call
        assert gamma == 0.0
        assert theta == 0.0
        assert vega == 0.0
    
    def test_high_iv(self):
        """Works with very high IV"""
        price = BlackScholesCalculator.call_price(100, 100, 30, 0.05, 1.5)  # 150% IV
        assert price > 0
    
    def test_low_iv(self):
        """Works with very low IV"""
        price = BlackScholesCalculator.call_price(100, 100, 30, 0.05, 0.05)  # 5% IV
        assert price > 0


# Sanity check test with known values
class TestKnownValues:
    """Tests against known/expected values"""
    
    def test_atm_call_delta_near_half(self):
        """ATM call delta should be close to 0.5"""
        delta = BlackScholesCalculator.delta(100, 100, 30, 0.05, 0.20, "call")
        assert 0.45 < delta < 0.60
    
    def test_atm_put_delta_near_minus_half(self):
        """ATM put delta should be close to -0.5"""
        delta = BlackScholesCalculator.delta(100, 100, 30, 0.05, 0.20, "put")
        assert -0.55 < delta < -0.40
    
    def test_reasonable_atm_price(self):
        """ATM option price should be reasonable"""
        # With S=100, K=100, T=30 days, r=5%, sigma=20%
        # Call should be roughly 2-4% of stock price
        call = BlackScholesCalculator.call_price(100, 100, 30, 0.05, 0.20)
        assert 2.0 < call < 5.0
