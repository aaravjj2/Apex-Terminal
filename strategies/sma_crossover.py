"""
SMA Crossover Strategy - Simple Moving Average crossover strategy.

Buy when fast SMA crosses above slow SMA.
Sell when fast SMA crosses below slow SMA.
"""

from typing import List
from ..services.strategy.base_strategy import BaseStrategy, Bar, sma


class SMACrossoverStrategy(BaseStrategy):
    """
    Simple Moving Average Crossover Strategy.
    
    Parameters:
        symbol: Trading symbol (default: AAPL)
        fast_period: Fast SMA period (default: 10)
        slow_period: Slow SMA period (default: 50)
        position_size: Number of shares per trade (default: 100)
    """
    
    def __init__(self):
        super().__init__(name="SMA Crossover")
        self.prices: List[float] = []
        self.prev_fast_sma = None
        self.prev_slow_sma = None
    
    def on_init(self) -> None:
        """Initialize strategy parameters."""
        self.symbol = self.get_param("symbol", "AAPL")
        self.fast_period = self.get_param("fast_period", 10)
        self.slow_period = self.get_param("slow_period", 50)
        self.position_size = self.get_param("position_size", 100)
    
    def on_bar(self, bar: Bar) -> None:
        """Process each bar and generate signals."""
        if bar.symbol != self.symbol:
            return
        
        # Collect prices
        self.prices.append(bar.close)
        
        # Need enough data
        if len(self.prices) < self.slow_period:
            return
        
        # Calculate SMAs
        fast_sma = sma(self.prices, self.fast_period)
        slow_sma = sma(self.prices, self.slow_period)
        
        # Check for crossover
        if self.prev_fast_sma is not None and self.prev_slow_sma is not None:
            # Bullish crossover: fast crosses above slow
            if self.prev_fast_sma <= self.prev_slow_sma and fast_sma > slow_sma:
                if self.is_flat(self.symbol):
                    self.buy(self.symbol, self.position_size)
                elif self.is_short(self.symbol):
                    # Close short and go long
                    self.close_position(self.symbol)
                    self.buy(self.symbol, self.position_size)
            
            # Bearish crossover: fast crosses below slow
            elif self.prev_fast_sma >= self.prev_slow_sma and fast_sma < slow_sma:
                if self.is_long(self.symbol):
                    self.close_position(self.symbol)
                    # Optionally go short
                    # self.sell(self.symbol, self.position_size)
        
        # Store for next bar
        self.prev_fast_sma = fast_sma
        self.prev_slow_sma = slow_sma
        
        # Trim price history to save memory
        if len(self.prices) > self.slow_period * 2:
            self.prices = self.prices[-self.slow_period * 2:]


# For dynamic loading
strategy_class = SMACrossoverStrategy
