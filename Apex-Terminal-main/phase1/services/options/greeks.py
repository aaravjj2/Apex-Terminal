"""
Black-Scholes Greeks Calculator
Production-grade implementation for options analytics
"""

import math
from typing import Tuple, Literal
from dataclasses import dataclass


# Standard normal distribution functions
def _norm_cdf(x: float) -> float:
    """Cumulative distribution function for standard normal distribution"""
    return (1.0 + math.erf(x / math.sqrt(2.0))) / 2.0


def _norm_pdf(x: float) -> float:
    """Probability density function for standard normal distribution"""
    return math.exp(-0.5 * x * x) / math.sqrt(2.0 * math.pi)


@dataclass
class GreeksResult:
    """Container for all Greeks"""
    delta: float
    gamma: float
    theta: float  # Daily
    vega: float   # Per 1% IV change
    rho: float    # Per 1% rate change
    
    # Option pricing
    theoretical_price: float
    intrinsic_value: float
    time_value: float


class BlackScholesCalculator:
    """
    Black-Scholes option pricing and Greeks calculator
    
    All time inputs are in DAYS (converted internally to years)
    IV inputs are as decimals (0.30 = 30%)
    """
    
    DAYS_PER_YEAR = 365.0
    
    @staticmethod
    def _d1(S: float, K: float, T: float, r: float, sigma: float) -> float:
        """Calculate d1 parameter"""
        if T <= 0 or sigma <= 0:
            return 0.0
        sqrt_T = math.sqrt(T)
        return (math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrt_T)
    
    @staticmethod
    def _d2(S: float, K: float, T: float, r: float, sigma: float) -> float:
        """Calculate d2 parameter"""
        if T <= 0 or sigma <= 0:
            return 0.0
        return BlackScholesCalculator._d1(S, K, T, r, sigma) - sigma * math.sqrt(T)
    
    @classmethod
    def call_price(cls, S: float, K: float, T_days: float, r: float, sigma: float) -> float:
        """
        Calculate Black-Scholes call option price
        
        Args:
            S: Current stock price
            K: Strike price
            T_days: Days to expiration
            r: Risk-free interest rate (annual, decimal)
            sigma: Implied volatility (decimal, e.g., 0.30 = 30%)
            
        Returns:
            Theoretical call option price
        """
        T = T_days / cls.DAYS_PER_YEAR
        
        if T <= 0:
            return max(0.0, S - K)  # Intrinsic value at expiration
        
        d1 = cls._d1(S, K, T, r, sigma)
        d2 = cls._d2(S, K, T, r, sigma)
        
        return S * _norm_cdf(d1) - K * math.exp(-r * T) * _norm_cdf(d2)
    
    @classmethod
    def put_price(cls, S: float, K: float, T_days: float, r: float, sigma: float) -> float:
        """
        Calculate Black-Scholes put option price
        
        Args:
            S: Current stock price
            K: Strike price
            T_days: Days to expiration
            r: Risk-free interest rate (annual, decimal)
            sigma: Implied volatility (decimal)
            
        Returns:
            Theoretical put option price
        """
        T = T_days / cls.DAYS_PER_YEAR
        
        if T <= 0:
            return max(0.0, K - S)  # Intrinsic value at expiration
        
        d1 = cls._d1(S, K, T, r, sigma)
        d2 = cls._d2(S, K, T, r, sigma)
        
        return K * math.exp(-r * T) * _norm_cdf(-d2) - S * _norm_cdf(-d1)
    
    @classmethod
    def delta(cls, S: float, K: float, T_days: float, r: float, sigma: float,
              option_type: Literal["call", "put"]) -> float:
        """
        Calculate option Delta
        Rate of change of option price with respect to underlying price
        
        Call delta: 0 to 1
        Put delta: -1 to 0
        """
        T = T_days / cls.DAYS_PER_YEAR
        
        if T <= 0:
            if option_type == "call":
                return 1.0 if S > K else 0.0
            else:
                return -1.0 if S < K else 0.0
        
        d1 = cls._d1(S, K, T, r, sigma)
        
        if option_type == "call":
            return _norm_cdf(d1)
        else:
            return _norm_cdf(d1) - 1.0
    
    @classmethod
    def gamma(cls, S: float, K: float, T_days: float, r: float, sigma: float) -> float:
        """
        Calculate option Gamma
        Rate of change of Delta with respect to underlying price
        Same for calls and puts
        """
        T = T_days / cls.DAYS_PER_YEAR
        
        if T <= 0 or sigma <= 0 or S <= 0:
            return 0.0
        
        d1 = cls._d1(S, K, T, r, sigma)
        return _norm_pdf(d1) / (S * sigma * math.sqrt(T))
    
    @classmethod
    def theta(cls, S: float, K: float, T_days: float, r: float, sigma: float,
              option_type: Literal["call", "put"]) -> float:
        """
        Calculate option Theta (daily)
        Time decay per day
        """
        T = T_days / cls.DAYS_PER_YEAR
        
        if T <= 0:
            return 0.0
        
        d1 = cls._d1(S, K, T, r, sigma)
        d2 = cls._d2(S, K, T, r, sigma)
        
        sqrt_T = math.sqrt(T)
        common = -(S * _norm_pdf(d1) * sigma) / (2 * sqrt_T)
        
        if option_type == "call":
            theta_annual = common - r * K * math.exp(-r * T) * _norm_cdf(d2)
        else:
            theta_annual = common + r * K * math.exp(-r * T) * _norm_cdf(-d2)
        
        return theta_annual / cls.DAYS_PER_YEAR  # Convert to daily
    
    @classmethod
    def vega(cls, S: float, K: float, T_days: float, r: float, sigma: float) -> float:
        """
        Calculate option Vega
        Sensitivity to 1% change in implied volatility
        Same for calls and puts
        """
        T = T_days / cls.DAYS_PER_YEAR
        
        if T <= 0:
            return 0.0
        
        d1 = cls._d1(S, K, T, r, sigma)
        return S * math.sqrt(T) * _norm_pdf(d1) / 100  # Per 1% IV change
    
    @classmethod
    def rho(cls, S: float, K: float, T_days: float, r: float, sigma: float,
            option_type: Literal["call", "put"]) -> float:
        """
        Calculate option Rho
        Sensitivity to 1% change in interest rate
        """
        T = T_days / cls.DAYS_PER_YEAR
        
        if T <= 0:
            return 0.0
        
        d2 = cls._d2(S, K, T, r, sigma)
        
        if option_type == "call":
            return K * T * math.exp(-r * T) * _norm_cdf(d2) / 100
        else:
            return -K * T * math.exp(-r * T) * _norm_cdf(-d2) / 100
    
    @classmethod
    def calculate_all(cls, S: float, K: float, T_days: float, r: float, sigma: float,
                      option_type: Literal["call", "put"]) -> GreeksResult:
        """
        Calculate all Greeks and option price in one call
        
        Args:
            S: Current stock price
            K: Strike price
            T_days: Days to expiration
            r: Risk-free rate (decimal)
            sigma: Implied volatility (decimal)
            option_type: "call" or "put"
            
        Returns:
            GreeksResult with all values
        """
        if option_type == "call":
            price = cls.call_price(S, K, T_days, r, sigma)
            intrinsic = max(0.0, S - K)
        else:
            price = cls.put_price(S, K, T_days, r, sigma)
            intrinsic = max(0.0, K - S)
        
        return GreeksResult(
            delta=cls.delta(S, K, T_days, r, sigma, option_type),
            gamma=cls.gamma(S, K, T_days, r, sigma),
            theta=cls.theta(S, K, T_days, r, sigma, option_type),
            vega=cls.vega(S, K, T_days, r, sigma),
            rho=cls.rho(S, K, T_days, r, sigma, option_type),
            theoretical_price=price,
            intrinsic_value=intrinsic,
            time_value=price - intrinsic,
        )


def implied_volatility(
    price: float,
    S: float,
    K: float,
    T_days: float,
    r: float,
    option_type: Literal["call", "put"],
    tol: float = 1e-6,
    max_iter: int = 100,
) -> float:
    """
    Calculate implied volatility using Newton-Raphson method
    
    Args:
        price: Market price of the option
        S: Current stock price
        K: Strike price
        T_days: Days to expiration
        r: Risk-free rate
        option_type: "call" or "put"
        tol: Tolerance for convergence
        max_iter: Maximum iterations
        
    Returns:
        Implied volatility as decimal
        
    Raises:
        ValueError: If IV cannot be found
    """
    if T_days <= 0:
        raise ValueError("Option has expired, cannot compute IV")
    
    # Initial guess based on price relationship
    if option_type == "call":
        intrinsic = max(0, S - K)
    else:
        intrinsic = max(0, K - S)
    
    if price < intrinsic:
        raise ValueError("Price below intrinsic value")
    
    # Initial IV guess
    sigma = 0.3  # Start at 30%
    
    calc = BlackScholesCalculator
    
    for _ in range(max_iter):
        if option_type == "call":
            model_price = calc.call_price(S, K, T_days, r, sigma)
        else:
            model_price = calc.put_price(S, K, T_days, r, sigma)
        
        diff = model_price - price
        
        if abs(diff) < tol:
            return sigma
        
        vega = calc.vega(S, K, T_days, r, sigma) * 100  # Convert back from per 1%
        
        if abs(vega) < 1e-10:
            # Vega too small, try bisection fallback
            break
        
        sigma = sigma - diff / vega
        
        # Bound sigma to reasonable range
        sigma = max(0.001, min(5.0, sigma))
    
    # Fallback to bisection if Newton didn't converge
    return _iv_bisection(price, S, K, T_days, r, option_type, tol)


def _iv_bisection(
    price: float,
    S: float,
    K: float,
    T_days: float,
    r: float,
    option_type: Literal["call", "put"],
    tol: float = 1e-6,
) -> float:
    """Bisection method fallback for IV calculation"""
    calc = BlackScholesCalculator
    
    low, high = 0.001, 5.0
    
    for _ in range(100):
        mid = (low + high) / 2
        
        if option_type == "call":
            model_price = calc.call_price(S, K, T_days, r, mid)
        else:
            model_price = calc.put_price(S, K, T_days, r, mid)
        
        if abs(model_price - price) < tol:
            return mid
        
        if model_price < price:
            low = mid
        else:
            high = mid
    
    return (low + high) / 2  # Best estimate


# Convenience function
def calculate_greeks(
    S: float,
    K: float,
    T_days: float,
    r: float,
    sigma: float,
    option_type: Literal["call", "put"],
) -> dict:
    """
    Calculate all Greeks and return as dictionary
    
    This is the main entry point for the API
    """
    result = BlackScholesCalculator.calculate_all(S, K, T_days, r, sigma, option_type)
    
    return {
        "delta": round(result.delta, 4),
        "gamma": round(result.gamma, 6),
        "theta": round(result.theta, 4),
        "vega": round(result.vega, 4),
        "rho": round(result.rho, 4),
        "theoretical_price": round(result.theoretical_price, 2),
        "intrinsic_value": round(result.intrinsic_value, 2),
        "time_value": round(result.time_value, 2),
    }
