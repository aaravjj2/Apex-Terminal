"""
Forecasting Service Module.

Provides price forecasting and uncertainty cone calculations based on:
- Historical volatility
- Brownian motion / random walk projection
- Configurable confidence intervals
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import math
import structlog

logger = structlog.get_logger()


@dataclass
class UncertaintyCone:
    """Uncertainty cone data for price forecasting."""
    symbol: str
    current_price: float
    forecast_days: int
    generated_at: datetime
    
    # Cone data: dict of confidence level -> (upper_bounds, lower_bounds)
    cones: Dict[str, Dict[str, List[float]]] = field(default_factory=dict)
    
    # Metadata
    historical_volatility: float = 0.0  # Annualized
    daily_volatility: float = 0.0


def calculate_historical_volatility(
    prices: List[float],
    period: int = 20,
    annualize: bool = True
) -> float:
    """
    Calculate historical volatility from price series.
    
    Args:
        prices: List of closing prices (most recent last)
        period: Lookback period for volatility calculation
        annualize: If True, annualize the volatility (default: True)
    
    Returns:
        Historical volatility as a decimal (e.g., 0.25 for 25%)
    """
    if len(prices) < period + 1:
        logger.warning("insufficient_price_data", 
                      available=len(prices), 
                      required=period + 1)
        return 0.20  # Default 20% annualized vol
    
    # Calculate log returns
    returns = []
    for i in range(1, min(len(prices), period + 1)):
        if prices[-(i+1)] > 0:
            log_return = math.log(prices[-i] / prices[-(i+1)])
            returns.append(log_return)
    
    if len(returns) < 2:
        return 0.20
    
    # Calculate standard deviation of returns
    mean_return = sum(returns) / len(returns)
    squared_diffs = [(r - mean_return) ** 2 for r in returns]
    variance = sum(squared_diffs) / (len(squared_diffs) - 1)
    daily_vol = math.sqrt(variance)
    
    if annualize:
        return daily_vol * math.sqrt(252)  # Trading days per year
    return daily_vol


def calculate_uncertainty_cone(
    current_price: float,
    historical_volatility: float,
    days_forward: int = 30,
    confidence_levels: List[float] = None
) -> Dict[str, Dict[str, List[float]]]:
    """
    Calculate uncertainty cone based on lognormal random walk model.
    
    Args:
        current_price: Current price of the asset
        historical_volatility: Annualized historical volatility (decimal)
        days_forward: Number of days to forecast
        confidence_levels: List of confidence levels (default: [0.68, 0.95, 0.99])
    
    Returns:
        Dictionary mapping confidence level names to upper/lower bound arrays
    """
    if confidence_levels is None:
        confidence_levels = [0.68, 0.95, 0.99]
    
    # Convert annual volatility to daily
    daily_vol = historical_volatility / math.sqrt(252)
    
    cones = {}
    
    for conf in confidence_levels:
        # Z-score for two-tailed confidence interval
        # For 68%: z ≈ 1.0, for 95%: z ≈ 1.96, for 99%: z ≈ 2.58
        z = _norm_ppf((1 + conf) / 2)
        
        upper_bounds = []
        lower_bounds = []
        median_line = []
        
        for day in range(1, days_forward + 1):
            # Standard deviation grows with sqrt(time)
            vol_spread = z * daily_vol * math.sqrt(day)
            
            # Using lognormal model: price = S0 * exp(drift + vol_adjustment)
            # For GBM with no drift assumption
            upper_factor = math.exp(vol_spread)
            lower_factor = math.exp(-vol_spread)
            
            upper_bounds.append(round(current_price * upper_factor, 2))
            lower_bounds.append(round(current_price * lower_factor, 2))
            median_line.append(round(current_price, 2))  # Assuming no drift
        
        conf_key = f"{int(conf * 100)}%"
        cones[conf_key] = {
            "upper": upper_bounds,
            "lower": lower_bounds,
            "median": median_line
        }
    
    return cones


def _norm_ppf(p: float) -> float:
    """
    Approximation of the inverse normal CDF (percent point function).
    
    Uses Abramowitz and Stegun approximation formula 26.2.23.
    """
    if p <= 0:
        return -10.0
    if p >= 1:
        return 10.0
    
    # Coefficients for approximation
    if p < 0.5:
        t = math.sqrt(-2 * math.log(p))
        sign = -1
    else:
        t = math.sqrt(-2 * math.log(1 - p))
        sign = 1
    
    c0 = 2.515517
    c1 = 0.802853
    c2 = 0.010328
    d1 = 1.432788
    d2 = 0.189269
    d3 = 0.001308
    
    numerator = c0 + c1 * t + c2 * t * t
    denominator = 1 + d1 * t + d2 * t * t + d3 * t * t * t
    
    return sign * (t - numerator / denominator)


def generate_forecast(
    symbol: str,
    current_price: float,
    historical_prices: List[float],
    days_forward: int = 30,
    volatility_period: int = 20,
    confidence_levels: List[float] = None
) -> UncertaintyCone:
    """
    Generate a complete uncertainty cone forecast.
    
    Args:
        symbol: Ticker symbol
        current_price: Current price
        historical_prices: Historical closing prices (most recent last)
        days_forward: Number of days to forecast
        volatility_period: Period for volatility calculation
        confidence_levels: Confidence levels for cone
    
    Returns:
        UncertaintyCone object with forecast data
    """
    # Calculate historical volatility
    hist_vol = calculate_historical_volatility(
        historical_prices, 
        period=volatility_period
    )
    
    # Calculate uncertainty cones
    cones = calculate_uncertainty_cone(
        current_price=current_price,
        historical_volatility=hist_vol,
        days_forward=days_forward,
        confidence_levels=confidence_levels
    )
    
    logger.info(
        "forecast_generated",
        symbol=symbol,
        current_price=current_price,
        hist_vol=hist_vol,
        days_forward=days_forward
    )
    
    return UncertaintyCone(
        symbol=symbol,
        current_price=current_price,
        forecast_days=days_forward,
        generated_at=datetime.utcnow(),
        cones=cones,
        historical_volatility=hist_vol,
        daily_volatility=hist_vol / math.sqrt(252)
    )
