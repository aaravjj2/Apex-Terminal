"""
Unified Autopilot Controller

Merges Forecast and Autopilot systems:
- Fetches forecast before strategy evaluation
- Applies forecast filter (only trade if price in favorable zone)
- Adjusts position sizing based on volatility
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime
from enum import Enum
import structlog

from ..forecasting import generate_forecast, calculate_historical_volatility

logger = structlog.get_logger()


class ForecastBias(str, Enum):
    """Forecast direction bias."""
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"


@dataclass
class ForecastContext:
    """
    Forecast context passed to strategies for informed decision making.
    """
    symbol: str
    current_price: float
    historical_volatility: float  # Annualized
    daily_volatility: float
    
    # Cone bounds at configured confidence level
    confidence_level: float  # e.g., 0.68, 0.95
    upper_bound_30d: float
    lower_bound_30d: float
    
    # Derived bias
    bias: ForecastBias = ForecastBias.NEUTRAL
    
    # Position sizing multiplier (0.0 to 1.0)
    # Low volatility = higher position size
    # High volatility = smaller position size
    size_multiplier: float = 1.0
    
    generated_at: datetime = field(default_factory=datetime.utcnow)
    
    def is_price_in_favorable_zone(self, target_price: float, direction: str) -> bool:
        """
        Check if target price is within the forecast cone for the given direction.
        
        For BUY: favorable if current price is in lower half of cone
        For SELL: favorable if current price is in upper half of cone
        """
        cone_midpoint = (self.upper_bound_30d + self.lower_bound_30d) / 2
        
        if direction.upper() == "BUY":
            return self.current_price <= cone_midpoint
        elif direction.upper() == "SELL":
            return self.current_price >= cone_midpoint
        return True  # Neutral, allow


@dataclass
class ForecastConfig:
    """Configuration for forecast-aware trading."""
    enabled: bool = True
    confidence_level: float = 0.68  # 68%, 95%, or 99%
    use_for_filtering: bool = True  # Filter trades based on forecast
    use_for_sizing: bool = True     # Scale position size by volatility
    max_volatility_threshold: float = 0.50  # 50% annual vol = stop trading
    min_volatility_threshold: float = 0.10  # 10% annual vol = minimum
    

class UnifiedAutopilotController:
    """
    Central controller that combines forecast and strategy execution.
    """
    
    def __init__(self, config: Optional[ForecastConfig] = None):
        self.config = config or ForecastConfig()
        self._forecast_cache: Dict[str, ForecastContext] = {}
        self._cache_ttl_seconds = 300  # 5 minutes
        
    async def get_forecast_context(
        self, 
        symbol: str, 
        historical_prices: List[float],
        current_price: float
    ) -> ForecastContext:
        """
        Get or generate forecast context for a symbol.
        """
        # Check cache
        cache_key = symbol.upper()
        if cache_key in self._forecast_cache:
            cached = self._forecast_cache[cache_key]
            age = (datetime.utcnow() - cached.generated_at).total_seconds()
            if age < self._cache_ttl_seconds:
                return cached
        
        # Generate new forecast
        try:
            forecast = generate_forecast(
                symbol=symbol,
                current_price=current_price,
                historical_prices=historical_prices,
                days_forward=30,
                confidence_levels=[self.config.confidence_level]
            )
            
            conf_key = f"{int(self.config.confidence_level * 100)}%"
            cone_data = forecast.cones.get(conf_key, {})
            
            # Determine bias based on recent price action
            if len(historical_prices) >= 5:
                recent_return = (current_price - historical_prices[-5]) / historical_prices[-5]
                if recent_return > 0.02:
                    bias = ForecastBias.BULLISH
                elif recent_return < -0.02:
                    bias = ForecastBias.BEARISH
                else:
                    bias = ForecastBias.NEUTRAL
            else:
                bias = ForecastBias.NEUTRAL
            
            # Calculate size multiplier (inverse of volatility, normalized)
            # Higher volatility = smaller positions
            base_vol = 0.20  # 20% as baseline
            if forecast.historical_volatility > 0:
                size_mult = min(1.0, base_vol / forecast.historical_volatility)
            else:
                size_mult = 1.0
            
            context = ForecastContext(
                symbol=symbol.upper(),
                current_price=current_price,
                historical_volatility=forecast.historical_volatility,
                daily_volatility=forecast.daily_volatility,
                confidence_level=self.config.confidence_level,
                upper_bound_30d=cone_data.get("upper", [current_price])[-1] if cone_data.get("upper") else current_price * 1.2,
                lower_bound_30d=cone_data.get("lower", [current_price])[-1] if cone_data.get("lower") else current_price * 0.8,
                bias=bias,
                size_multiplier=size_mult,
                generated_at=datetime.utcnow()
            )
            
            self._forecast_cache[cache_key] = context
            logger.info("forecast_context_generated", symbol=symbol, bias=bias.value, vol=forecast.historical_volatility)
            return context
            
        except Exception as e:
            logger.error("forecast_context_error", symbol=symbol, error=str(e))
            # Return default context
            return ForecastContext(
                symbol=symbol.upper(),
                current_price=current_price,
                historical_volatility=0.25,
                daily_volatility=0.016,
                confidence_level=self.config.confidence_level,
                upper_bound_30d=current_price * 1.2,
                lower_bound_30d=current_price * 0.8,
                bias=ForecastBias.NEUTRAL,
                size_multiplier=1.0
            )
    
    def should_allow_trade(
        self, 
        signal_direction: str, 
        forecast: ForecastContext
    ) -> tuple[bool, str]:
        """
        Determine if a trade should be allowed based on forecast.
        
        Returns: (allowed: bool, reason: str)
        """
        if not self.config.enabled or not self.config.use_for_filtering:
            return True, "Forecast filtering disabled"
        
        # Check volatility threshold
        if forecast.historical_volatility > self.config.max_volatility_threshold:
            return False, f"Volatility {forecast.historical_volatility:.1%} exceeds max {self.config.max_volatility_threshold:.1%}"
        
        # Check if price is in favorable zone
        if not forecast.is_price_in_favorable_zone(forecast.current_price, signal_direction):
            return False, f"Price ${forecast.current_price:.2f} not in favorable zone for {signal_direction}"
        
        # Check bias alignment
        if signal_direction.upper() == "BUY" and forecast.bias == ForecastBias.BEARISH:
            return False, "BUY signal conflicts with BEARISH forecast"
        if signal_direction.upper() == "SELL" and forecast.bias == ForecastBias.BULLISH:
            return False, "SELL signal conflicts with BULLISH forecast"
        
        return True, "Forecast conditions favorable"
    
    def calculate_position_size(
        self, 
        base_size: float, 
        forecast: ForecastContext
    ) -> float:
        """
        Adjust position size based on forecast volatility.
        """
        if not self.config.enabled or not self.config.use_for_sizing:
            return base_size
        
        adjusted = base_size * forecast.size_multiplier
        logger.debug("position_size_adjusted", base=base_size, adjusted=adjusted, multiplier=forecast.size_multiplier)
        return adjusted
    
    def clear_cache(self, symbol: Optional[str] = None):
        """Clear forecast cache."""
        if symbol:
            self._forecast_cache.pop(symbol.upper(), None)
        else:
            self._forecast_cache.clear()


# Singleton instance
_controller: Optional[UnifiedAutopilotController] = None


def get_unified_controller() -> UnifiedAutopilotController:
    """Get or create the unified controller."""
    global _controller
    if _controller is None:
        _controller = UnifiedAutopilotController()
    return _controller


def update_controller_config(config: ForecastConfig) -> UnifiedAutopilotController:
    """Update controller configuration."""
    global _controller
    _controller = UnifiedAutopilotController(config)
    return _controller
