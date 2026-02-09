"""
VWAP Reversion Strategy - Mean reversion around VWAP.

Buy when price is significantly below VWAP.
Sell when price is significantly above VWAP.
"""

from typing import List
from ..services.strategy.base_strategy import BaseStrategy, Bar
import math


class VWAPReversionStrategy(BaseStrategy):
    """
    VWAP Mean Reversion Strategy.
    
    Trades mean reversion around the Volume Weighted Average Price.
    Buys when price drops below VWAP by threshold standard deviations.
    Sells when price rises above VWAP by threshold standard deviations.
    
    Parameters:
        symbol: Trading symbol (default: AAPL)
        std_threshold: Standard deviation threshold for entry (default: 2.0)
        position_size: Number of shares per trade (default: 100)
    """
    
    def __init__(self):
        super().__init__(name="VWAP Reversion")
        self.typical_prices: List[float] = []
        self.volumes: List[float] = []
        self.cum_tp_vol: float = 0.0
        self.cum_vol: float = 0.0
    
    def on_init(self) -> None:
        """Initialize strategy parameters."""
        self.symbol = self.get_param("symbol", "AAPL")
        self.std_threshold = self.get_param("std_threshold", 2.0)
        self.position_size = self.get_param("position_size", 100)
    
    def calculate_vwap(self) -> float:
        """Calculate current VWAP."""
        if self.cum_vol == 0:
            return 0.0
        return self.cum_tp_vol / self.cum_vol
    
    def calculate_std_dev(self, vwap: float) -> float:
        """Calculate standard deviation from VWAP."""
        if len(self.typical_prices) < 2:
            return 0.0
        
        squared_diffs = [(tp - vwap) ** 2 for tp in self.typical_prices]
        variance = sum(squared_diffs) / len(squared_diffs)
        return math.sqrt(variance)
    
    def on_bar(self, bar: Bar) -> None:
        """Process each bar and generate signals."""
        if bar.symbol != self.symbol:
            return
        
        # Calculate typical price
        typical_price = (bar.high + bar.low + bar.close) / 3
        
        # Update cumulative values
        self.typical_prices.append(typical_price)
        self.volumes.append(bar.volume)
        self.cum_tp_vol += typical_price * bar.volume
        self.cum_vol += bar.volume
        
        # Need some data
        if len(self.typical_prices) < 10:
            return
        
        # Calculate VWAP and standard deviation
        vwap = self.calculate_vwap()
        std_dev = self.calculate_std_dev(vwap)
        
        if std_dev == 0:
            return
        
        # Calculate z-score (how many std devs from VWAP)
        z_score = (bar.close - vwap) / std_dev
        
        # Generate signals
        if z_score < -self.std_threshold:
            # Price significantly below VWAP - buy opportunity
            if self.is_flat(self.symbol):
                self.buy(self.symbol, self.position_size)
        
        elif z_score > self.std_threshold:
            # Price significantly above VWAP - sell opportunity
            if self.is_long(self.symbol):
                self.close_position(self.symbol)
        
        # Mean reversion: also close when returning to VWAP
        elif abs(z_score) < 0.5:
            if self.is_long(self.symbol):
                # Take profit as price returns to VWAP
                pass  # Could close here for tighter mean reversion


# For dynamic loading
strategy_class = VWAPReversionStrategy
