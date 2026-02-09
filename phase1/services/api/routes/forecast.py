"""
Forecast API Routes.

Provides endpoints for price forecasting and uncertainty cone visualization.
"""

from typing import List, Optional
from fastapi import APIRouter, Query, HTTPException, status
from pydantic import BaseModel, Field
import structlog

from ...forecasting import generate_forecast, calculate_historical_volatility
from ...persistence import get_database


logger = structlog.get_logger()
router = APIRouter()


# ============================================================================
# Pydantic Models
# ============================================================================

class ConeData(BaseModel):
    """Single confidence level cone data."""
    upper: List[float]
    lower: List[float]
    median: List[float]


class ForecastResponse(BaseModel):
    """Uncertainty cone forecast response."""
    symbol: str
    current_price: float
    forecast_days: int
    historical_volatility: float = Field(description="Annualized volatility as decimal")
    daily_volatility: float
    cones: dict  # Dict[str, ConeData]
    generated_at: str


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/forecast/{symbol}", response_model=ForecastResponse)
async def get_forecast(
    symbol: str,
    days: int = Query(default=30, ge=1, le=365, description="Days to forecast"),
    confidence: str = Query(default="0.68,0.95", description="Comma-separated confidence levels"),
    volatility_period: int = Query(default=20, ge=5, le=100, description="Period for volatility calculation")
):
    """
    Get uncertainty cone forecast for a symbol.
    
    The forecast uses historical volatility to project potential price ranges.
    """
    symbol = symbol.upper()
    
    # Parse confidence levels
    try:
        confidence_levels = [float(c.strip()) for c in confidence.split(",")]
        for level in confidence_levels:
            if not 0 < level < 1:
                raise ValueError(f"Invalid confidence level: {level}")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid confidence parameter: {e}"
        )
    
    # Fetch historical prices from database
    db = get_database()
    try:
        bars = await db.get_bars(
            symbol=symbol,
            timeframe="1D",
            limit=volatility_period + 50  # Extra buffer for calculation
        )
    except Exception as e:
        logger.error("forecast_db_error", symbol=symbol, error=str(e))
        bars = []
    
    if not bars or len(bars) < 5:
        # Fallback to yfinance for real data if DB is empty
        try:
            import yfinance as yf
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="1y") # Get 1 year of data
            if hist.empty:
                raise ValueError("No history found")
            
            prices = hist['Close'].tolist()
            current_price = prices[-1]
            
            # Use real data for generation
            forecast = generate_forecast(
                symbol=symbol,
                current_price=current_price,
                historical_prices=prices,
                days_forward=days,
                volatility_period=volatility_period,
                confidence_levels=confidence_levels
            )
            
            return ForecastResponse(
                symbol=symbol,
                current_price=forecast.current_price,
                forecast_days=forecast.forecast_days,
                historical_volatility=round(forecast.historical_volatility, 4),
                daily_volatility=round(forecast.daily_volatility, 4),
                cones=forecast.cones,
                generated_at=forecast.generated_at.isoformat()
            )
            
        except Exception as e:
            logger.error("forecast_real_data_fetch_failed", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Strict mode: Real forecast data unavailable for {symbol}"
            )
    
    # Extract prices (most recent last)
    prices = [bar.close for bar in sorted(bars, key=lambda b: b.timestamp)]
    current_price = prices[-1] if prices else 100.0
    
    # Generate forecast
    forecast = generate_forecast(
        symbol=symbol,
        current_price=current_price,
        historical_prices=prices,
        days_forward=days,
        volatility_period=volatility_period,
        confidence_levels=confidence_levels
    )
    
    return ForecastResponse(
        symbol=symbol,
        current_price=forecast.current_price,
        forecast_days=forecast.forecast_days,
        historical_volatility=round(forecast.historical_volatility, 4),
        daily_volatility=round(forecast.daily_volatility, 4),
        cones=forecast.cones,
        generated_at=forecast.generated_at.isoformat()
    )


@router.get("/forecast/{symbol}/volatility")
async def get_volatility(
    symbol: str,
    period: int = Query(default=20, ge=5, le=100, description="Lookback period")
):
    """Get historical volatility for a symbol."""
    symbol = symbol.upper()
    
    # Fetch historical prices
    db = get_database()
    try:
        bars = await db.get_bars(
            symbol=symbol,
            timeframe="1D",
            limit=period + 10
        )
    except Exception as e:
        logger.error("volatility_db_error", symbol=symbol, error=str(e))
        return {
            "symbol": symbol,
            "period": period,
            "annualized_volatility": 0.25,
            "daily_volatility": 0.25 / 15.87,  # sqrt(252)
            "data_available": False
        }
    
    if not bars or len(bars) < 5:
        return {
            "symbol": symbol,
            "period": period,
            "annualized_volatility": 0.25,
            "daily_volatility": 0.016,
            "data_available": False
        }
    
    prices = [bar.close for bar in sorted(bars, key=lambda b: b.timestamp)]
    
    ann_vol = calculate_historical_volatility(prices, period=period, annualize=True)
    daily_vol = calculate_historical_volatility(prices, period=period, annualize=False)
    
    return {
        "symbol": symbol,
        "period": period,
        "annualized_volatility": round(ann_vol, 4),
        "daily_volatility": round(daily_vol, 4),
        "data_available": True,
        "price_count": len(prices)
    }
