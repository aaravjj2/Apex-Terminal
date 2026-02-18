"""
Fill Simulator - Simulates order fills for backtesting.
"""

from dataclasses import dataclass
from typing import Optional, Tuple
from datetime import datetime
from enum import Enum
import random

from ..execution.order_types import Order, Fill, OrderType, OrderSide, OrderStatus


class SlippageModel(str, Enum):
    NONE = "none"
    FIXED = "fixed"
    PERCENTAGE = "percentage"
    RANDOM = "random"


@dataclass
class SlippageConfig:
    """Slippage model configuration."""
    model: SlippageModel = SlippageModel.NONE
    fixed_amount: float = 0.01  # Fixed $ per share
    percentage: float = 0.1  # Percentage of price
    random_min: float = 0.0
    random_max: float = 0.05
    seed: Optional[int] = None


@dataclass
class CommissionConfig:
    """Commission model configuration."""
    per_share: float = 0.0  # $ per share
    per_trade: float = 0.0  # Fixed $ per trade
    percentage: float = 0.0  # % of trade value
    min_commission: float = 0.0  # Minimum commission


class FillSimulator:
    """
    Simulates order fills for backtesting.
    
    Supports:
    - Market orders: fill at next bar open (or specified price)
    - Limit orders: fill if price crosses limit level
    - Stop orders: trigger when price crosses stop level
    - Slippage and commission models
    """
    
    def __init__(
        self,
        slippage: Optional[SlippageConfig] = None,
        commission: Optional[CommissionConfig] = None,
        fill_at_bar_open: bool = True,  # Default: execute at next bar open
    ):
        self.slippage_config = slippage or SlippageConfig()
        self.commission_config = commission or CommissionConfig()
        self.fill_at_bar_open = fill_at_bar_open
        
        # Set random seed for reproducibility
        if self.slippage_config.seed is not None:
            self._rng = random.Random(self.slippage_config.seed)
        else:
            self._rng = random.Random()
    
    def calculate_slippage(self, price: float, side: OrderSide) -> float:
        """Calculate slippage based on configured model."""
        config = self.slippage_config
        
        if config.model == SlippageModel.NONE:
            return 0.0
        
        if config.model == SlippageModel.FIXED:
            slip = config.fixed_amount
        elif config.model == SlippageModel.PERCENTAGE:
            slip = price * (config.percentage / 100)
        elif config.model == SlippageModel.RANDOM:
            slip = self._rng.uniform(config.random_min, config.random_max) * price / 100
        else:
            slip = 0.0
        
        # Slippage is always adverse: buys pay more, sells receive less
        if side == OrderSide.BUY:
            return slip
        return -slip
    
    def calculate_commission(self, quantity: float, price: float) -> float:
        """Calculate commission for a trade."""
        config = self.commission_config
        
        per_share = quantity * config.per_share
        per_trade = config.per_trade
        percentage = quantity * price * (config.percentage / 100)
        
        total = per_share + per_trade + percentage
        return max(total, config.min_commission)
    
    def check_market_order(
        self,
        order: Order,
        bar_open: float,
        bar_high: float,
        bar_low: float,
        bar_close: float,
        timestamp: datetime,
    ) -> Optional[Fill]:
        """Check if a market order can be filled."""
        if order.order_type != OrderType.MARKET:
            return None
        
        if not order.is_active:
            return None
        
        # Market orders fill at open (default) or current close
        fill_price = bar_open if self.fill_at_bar_open else bar_close
        
        # Apply slippage
        slippage = self.calculate_slippage(fill_price, order.side)
        fill_price += slippage
        
        # Calculate commission
        commission = self.calculate_commission(order.remaining_qty, fill_price)
        
        return Fill(
            order_id=order.id,
            symbol=order.symbol,
            side=order.side,
            quantity=order.remaining_qty,
            price=fill_price,
            timestamp=timestamp,
            commission=commission,
            liquidity="taker",
        )
    
    def check_limit_order(
        self,
        order: Order,
        bar_open: float,
        bar_high: float,
        bar_low: float,
        bar_close: float,
        timestamp: datetime,
    ) -> Optional[Fill]:
        """Check if a limit order can be filled."""
        if order.order_type != OrderType.LIMIT:
            return None
        
        if not order.is_active or order.limit_price is None:
            return None
        
        limit = order.limit_price
        
        # Buy limit: fills if price <= limit
        # Sell limit: fills if price >= limit
        can_fill = False
        fill_price = limit
        
        if order.side == OrderSide.BUY:
            if bar_low <= limit:
                can_fill = True
                # Price improvement: fill at limit or better
                fill_price = min(limit, bar_open) if bar_open <= limit else limit
        else:  # SELL
            if bar_high >= limit:
                can_fill = True
                fill_price = max(limit, bar_open) if bar_open >= limit else limit
        
        if not can_fill:
            return None
        
        # Minimal slippage for limit orders (maker)
        commission = self.calculate_commission(order.remaining_qty, fill_price)
        
        return Fill(
            order_id=order.id,
            symbol=order.symbol,
            side=order.side,
            quantity=order.remaining_qty,
            price=fill_price,
            timestamp=timestamp,
            commission=commission,
            liquidity="maker",
        )
    
    def check_stop_order(
        self,
        order: Order,
        bar_open: float,
        bar_high: float,
        bar_low: float,
        bar_close: float,
        prev_close: float,
        timestamp: datetime,
    ) -> Optional[Fill]:
        """Check if a stop order triggers and fills."""
        if order.order_type != OrderType.STOP:
            return None
        
        if not order.is_active or order.stop_price is None:
            return None
        
        stop = order.stop_price
        triggered = False
        
        # Buy stop: trigger when price rises to stop
        # Sell stop: trigger when price falls to stop
        if order.side == OrderSide.BUY:
            # Gap up through stop -> fill at open
            if prev_close < stop <= bar_open:
                triggered = True
            elif bar_high >= stop:
                triggered = True
        else:  # SELL
            # Gap down through stop -> fill at open
            if prev_close > stop >= bar_open:
                triggered = True
            elif bar_low <= stop:
                triggered = True
        
        if not triggered:
            return None
        
        # Stop orders become market orders, fill at stop or worse
        if order.side == OrderSide.BUY:
            fill_price = max(stop, bar_open)
        else:
            fill_price = min(stop, bar_open)
        
        # Apply slippage
        slippage = self.calculate_slippage(fill_price, order.side)
        fill_price += slippage
        
        commission = self.calculate_commission(order.remaining_qty, fill_price)
        
        return Fill(
            order_id=order.id,
            symbol=order.symbol,
            side=order.side,
            quantity=order.remaining_qty,
            price=fill_price,
            timestamp=timestamp,
            commission=commission,
            liquidity="taker",
        )
    
    def check_stop_limit_order(
        self,
        order: Order,
        bar_open: float,
        bar_high: float,
        bar_low: float,
        bar_close: float,
        prev_close: float,
        timestamp: datetime,
    ) -> Optional[Fill]:
        """Check if a stop-limit order triggers and fills."""
        if order.order_type != OrderType.STOP_LIMIT:
            return None
        
        if not order.is_active or order.stop_price is None or order.limit_price is None:
            return None
        
        stop = order.stop_price
        limit = order.limit_price
        
        # Check if stop is triggered
        triggered = False
        if order.side == OrderSide.BUY:
            if bar_high >= stop:
                triggered = True
        else:
            if bar_low <= stop:
                triggered = True
        
        if not triggered:
            return None
        
        # Stop triggered, now check if limit can fill
        can_fill = False
        fill_price = limit
        
        if order.side == OrderSide.BUY:
            if bar_low <= limit:
                can_fill = True
        else:
            if bar_high >= limit:
                can_fill = True
        
        if not can_fill:
            # Stop triggered but limit not reached - order remains active
            return None
        
        commission = self.calculate_commission(order.remaining_qty, fill_price)
        
        return Fill(
            order_id=order.id,
            symbol=order.symbol,
            side=order.side,
            quantity=order.remaining_qty,
            price=fill_price,
            timestamp=timestamp,
            commission=commission,
            liquidity="maker",
        )
    
    def process_order(
        self,
        order: Order,
        bar_open: float,
        bar_high: float,
        bar_low: float,
        bar_close: float,
        prev_close: Optional[float],
        timestamp: datetime,
    ) -> Optional[Fill]:
        """
        Process an order against a bar and return fill if executed.
        
        Args:
            order: The order to process
            bar_open, bar_high, bar_low, bar_close: OHLC prices
            prev_close: Previous bar's close (for stop orders)
            timestamp: Current bar timestamp
        
        Returns:
            Fill object if order executed, None otherwise
        """
        if not order.is_active:
            return None
        
        prev = prev_close if prev_close is not None else bar_open
        
        if order.order_type == OrderType.MARKET:
            return self.check_market_order(order, bar_open, bar_high, bar_low, bar_close, timestamp)
        
        if order.order_type == OrderType.LIMIT:
            return self.check_limit_order(order, bar_open, bar_high, bar_low, bar_close, timestamp)
        
        if order.order_type == OrderType.STOP:
            return self.check_stop_order(order, bar_open, bar_high, bar_low, bar_close, prev, timestamp)
        
        if order.order_type == OrderType.STOP_LIMIT:
            return self.check_stop_limit_order(order, bar_open, bar_high, bar_low, bar_close, prev, timestamp)
        
        # Trailing stop - simplified implementation
        # Full implementation would track price movements
        return None
    
    def apply_fill(self, order: Order, fill: Fill) -> None:
        """Apply a fill to an order, updating its state."""
        order.filled_qty += fill.quantity
        
        # Update average fill price
        if order.filled_avg_price == 0:
            order.filled_avg_price = fill.price
        else:
            total_qty = order.filled_qty
            prev_qty = total_qty - fill.quantity
            order.filled_avg_price = (
                order.filled_avg_price * prev_qty + fill.price * fill.quantity
            ) / total_qty
        
        order.commission += fill.commission
        order.filled_at = fill.timestamp
        
        # Update status
        if order.filled_qty >= order.quantity:
            order.status = OrderStatus.FILLED
        else:
            order.status = OrderStatus.PARTIAL
