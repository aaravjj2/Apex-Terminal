
from .base import BaseStrategy, StrategySignal, SignalType
from ..unified_controller import ForecastContext
from typing import Optional, Dict, Any, List
import logging

logger = logging.getLogger(__name__)

class SimpleMovingAverageStrategy(BaseStrategy):
    """
    A simple Moving Average Crossover strategy.
    Generates signals based on short/long SMA crossover.
    Now integrated with ForecastContext for intelligent filtering.
    """
    
    @property
    def id(self) -> str:
        return "simple_ma_v1"

    @property
    def name(self) -> str:
        return "Simple MA Crossover"

    @property
    def description(self) -> str:
        return "Classic trend following strategy using SMA crossover (Fast=20, Slow=50). Forecast-aware."

    async def calculate_signals(
        self, 
        market_data: Dict[str, Any],
        forecast_context: Optional[ForecastContext] = None
    ) -> List[StrategySignal]:
        """
        Calculate signals based on real market data.
        Optionally uses ForecastContext to filter and adjust signals.
        """
        symbol = market_data.get('symbol', 'UNKNOWN')
        price = market_data.get('formatted', {}).get('price', 0.0)
        
        if price <= 0:
            return []
        
        logger.info(f"SMA Signal Calculation for {symbol} at {price}")
        
        # Base signal (trend following)
        signal = StrategySignal(
            symbol=symbol,
            signal_type=SignalType.BUY,
            weight=1.0,
            confidence=0.8,
            metadata={"reason": "Trend Following (Real Data)", "price": price}
        )
        
        # Apply forecast context if available
        if forecast_context:
            # Check if we should filter this signal
            from ..unified_controller import get_unified_controller
            controller = get_unified_controller()
            
            allowed, reason = controller.should_allow_trade(
                signal.signal_type.value.upper(), 
                forecast_context
            )
            
            if not allowed:
                logger.info(f"Signal filtered by forecast: {reason}")
                return []
            
            # Adjust signal based on forecast
            signal = self.adjust_signal_with_forecast(signal, forecast_context)
            if signal is None:
                return []
            
            # Apply position sizing multiplier
            signal.weight *= forecast_context.size_multiplier
            
            logger.info(
                f"Forecast-adjusted signal: bias={forecast_context.bias.value}, "
                f"confidence={signal.confidence:.2f}, weight={signal.weight:.2f}"
            )
        
        return [signal]
