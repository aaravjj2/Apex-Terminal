from .base import BaseStrategy, StrategySignal, SignalType
import random
import logging

logger = logging.getLogger(__name__)

class MockStrategy(BaseStrategy):
    """
    A mock strategy that generates random signals for demonstration purposes.
    Shows the user how the autopilot would behave.
    """
    
    @property
    def id(self) -> str:
        return "mock_strategy_v1"

    @property
    def name(self) -> str:
        return "Random Walk Demo"

    @property
    def description(self) -> str:
        return "Demonstration strategy that generates random buy/sell signals."

    async def calculate_signals(self, market_data) -> list[StrategySignal]:
        """Generate random signals."""
        if random.random() < 0.1: # 10% chance to generate a signal per tick
            signal_type = random.choice([SignalType.BUY, SignalType.SELL])
            price = market_data.get('formatted', {}).get('price', 100.0)
            
            logger.info(f"MockStrategy generated {signal_type} signal at {price}")
            
            return [StrategySignal(
                symbol=market_data.get('symbol', 'AAPL'),
                signal_type=signal_type,
                weight=0.5,
                confidence=random.random(),
                metadata={"reason": "Random walk threshold crossed"}
            )]
        return []
