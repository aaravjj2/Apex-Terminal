"""
RSI Breakout Strategy - RSI overbought/oversold strategy.

Buy when RSI falls below oversold level (mean reversion).
Sell when RSI rises above overbought level.
"""

from typing import List
from ..services.strategy.base_strategy import BaseStrategy, Bar, rsi


class RSIBreakoutStrategy(BaseStrategy):
    """
    RSI Breakout / Mean Reversion Strategy.
    
    Parameters:
        symbol: Trading symbol (default: AAPL)
        period: RSI period (default: 14)
        oversold: Oversold threshold (default: 30)
        overbought: Overbought threshold (default: 70)
        position_size: Number of shares per trade (default: 100)
    """
    
    def __init__(self):
        super().__init__(name="RSI Breakout")
        self.prices: List[float] = []
    
    def on_init(self) -> None:
        """Initialize strategy parameters."""
        self.symbol = self.get_param("symbol", "AAPL")
        self.period = self.get_param("period", 14)
        self.oversold = self.get_param("oversold", 30)
        self.overbought = self.get_param("overbought", 70)
        self.position_size = self.get_param("position_size", 100)
    
    def on_bar(self, bar: Bar) -> None:
        """Process each bar and generate signals."""
        if bar.symbol != self.symbol:
            return
        
        # Collect prices
        self.prices.append(bar.close)
        
        # Need enough data
        if len(self.prices) < self.period + 1:
            return
        
        # Calculate RSI
        current_rsi = rsi(self.prices, self.period)
        
        if current_rsi != current_rsi:  # NaN check
            return
        
        # Generate signals
        if current_rsi < self.oversold:
            # Oversold - buy opportunity
            if self.is_flat(self.symbol):
                self.buy(self.symbol, self.position_size)
        
        elif current_rsi > self.overbought:
            # Overbought - sell opportunity
            if self.is_long(self.symbol):
                self.close_position(self.symbol)
        
        # Trim price history
        if len(self.prices) > self.period * 3:
            self.prices = self.prices[-self.period * 3:]


# For dynamic loading
strategy_class = RSIBreakoutStrategy
