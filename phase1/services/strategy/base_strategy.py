"""
Base Strategy - Abstract base class for user strategies.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime
from enum import Enum

from ..execution.order_types import Order, OrderType, OrderSide, TimeInForce
from ..portfolio.manager import PortfolioManager, Position


class StrategyState(str, Enum):
    INITIALIZED = "initialized"
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"
    ERROR = "error"


@dataclass
class Bar:
    """OHLCV bar data passed to strategy."""
    symbol: str
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    bar_index: int
    
    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "timestamp": self.timestamp.isoformat(),
            "open": self.open,
            "high": self.high,
            "low": self.low,
            "close": self.close,
            "volume": self.volume,
            "bar_index": self.bar_index,
        }


@dataclass
class Tick:
    """Tick data passed to strategy."""
    symbol: str
    timestamp: datetime
    price: float
    size: float
    
    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "timestamp": self.timestamp.isoformat(),
            "price": self.price,
            "size": self.size,
        }


@dataclass
class StrategyContext:
    """Context object providing strategy with access to account state."""
    portfolio: PortfolioManager
    current_time: datetime
    bar_index: int
    
    # Order management callbacks (set by engine)
    _place_order: Optional[Any] = None
    _cancel_order: Optional[Any] = None
    _get_orders: Optional[Any] = None
    
    def get_position(self, symbol: str) -> Position:
        """Get current position for a symbol."""
        return self.portfolio.get_position(symbol)
    
    def get_cash(self) -> float:
        """Get available cash."""
        return self.portfolio.cash
    
    def get_equity(self) -> float:
        """Get total equity."""
        return self.portfolio.equity
    
    def get_positions(self) -> List[Position]:
        """Get all positions."""
        return self.portfolio.get_positions()
    
    def place_market_order(
        self,
        symbol: str,
        side: str,
        quantity: float,
        time_in_force: str = "day"
    ) -> Optional[Order]:
        """Place a market order."""
        if self._place_order is None:
            raise RuntimeError("Order placement not available")
        
        return self._place_order(
            symbol=symbol,
            side=OrderSide(side),
            quantity=quantity,
            order_type=OrderType.MARKET,
            time_in_force=TimeInForce(time_in_force),
        )
    
    def place_limit_order(
        self,
        symbol: str,
        side: str,
        quantity: float,
        limit_price: float,
        time_in_force: str = "day"
    ) -> Optional[Order]:
        """Place a limit order."""
        if self._place_order is None:
            raise RuntimeError("Order placement not available")
        
        return self._place_order(
            symbol=symbol,
            side=OrderSide(side),
            quantity=quantity,
            order_type=OrderType.LIMIT,
            limit_price=limit_price,
            time_in_force=TimeInForce(time_in_force),
        )
    
    def place_stop_order(
        self,
        symbol: str,
        side: str,
        quantity: float,
        stop_price: float,
        time_in_force: str = "day"
    ) -> Optional[Order]:
        """Place a stop order."""
        if self._place_order is None:
            raise RuntimeError("Order placement not available")
        
        return self._place_order(
            symbol=symbol,
            side=OrderSide(side),
            quantity=quantity,
            order_type=OrderType.STOP,
            stop_price=stop_price,
            time_in_force=TimeInForce(time_in_force),
        )
    
    def cancel_order(self, order_id: str) -> bool:
        """Cancel an order."""
        if self._cancel_order is None:
            raise RuntimeError("Order cancellation not available")
        return self._cancel_order(order_id)
    
    def get_open_orders(self, symbol: Optional[str] = None) -> List[Order]:
        """Get open orders."""
        if self._get_orders is None:
            return []
        return self._get_orders(symbol)


class BaseStrategy(ABC):
    """
    Abstract base class for trading strategies.
    
    Subclass this and implement on_bar() and/or on_tick() methods.
    """
    
    def __init__(self, name: str = "Unnamed Strategy"):
        self.name = name
        self.state = StrategyState.INITIALIZED
        self.context: Optional[StrategyContext] = None
        self.params: Dict[str, Any] = {}
        self._bars_processed = 0
        self._ticks_processed = 0
    
    def set_context(self, context: StrategyContext) -> None:
        """Set the strategy context (called by engine)."""
        self.context = context
    
    def set_params(self, **kwargs) -> None:
        """Set strategy parameters."""
        self.params.update(kwargs)
    
    def get_param(self, key: str, default: Any = None) -> Any:
        """Get a strategy parameter."""
        return self.params.get(key, default)
    
    @abstractmethod
    def on_init(self) -> None:
        """
        Called once when strategy is initialized.
        Override to set up indicators, state, etc.
        """
        pass
    
    def on_start(self) -> None:
        """Called when strategy starts running."""
        self.state = StrategyState.RUNNING
    
    def on_stop(self) -> None:
        """Called when strategy stops."""
        self.state = StrategyState.STOPPED
    
    @abstractmethod
    def on_bar(self, bar: Bar) -> None:
        """
        Called on each new bar.
        
        Args:
            bar: The new OHLCV bar
        """
        pass
    
    def on_tick(self, tick: Tick) -> None:
        """
        Called on each new tick (optional).
        
        Args:
            tick: The new tick data
        """
        pass
    
    def on_order_fill(self, order: Order) -> None:
        """
        Called when an order is filled.
        
        Args:
            order: The filled order
        """
        pass
    
    def on_order_rejected(self, order: Order, reason: str) -> None:
        """
        Called when an order is rejected.
        
        Args:
            order: The rejected order
            reason: Rejection reason
        """
        pass
    
    def on_error(self, error: Exception) -> None:
        """Called when an error occurs."""
        self.state = StrategyState.ERROR
    
    # Helper methods for strategy development
    
    def buy(self, symbol: str, quantity: float) -> Optional[Order]:
        """Convenience method to place a market buy order."""
        if self.context is None:
            return None
        return self.context.place_market_order(symbol, "buy", quantity)
    
    def sell(self, symbol: str, quantity: float) -> Optional[Order]:
        """Convenience method to place a market sell order."""
        if self.context is None:
            return None
        return self.context.place_market_order(symbol, "sell", quantity)
    
    def close_position(self, symbol: str) -> Optional[Order]:
        """Close entire position in a symbol."""
        if self.context is None:
            return None
        
        position = self.context.get_position(symbol)
        if position.quantity > 0:
            return self.sell(symbol, position.quantity)
        elif position.quantity < 0:
            return self.buy(symbol, abs(position.quantity))
        return None
    
    def get_position_qty(self, symbol: str) -> float:
        """Get position quantity for a symbol."""
        if self.context is None:
            return 0.0
        return self.context.get_position(symbol).quantity
    
    def is_long(self, symbol: str) -> bool:
        """Check if we have a long position."""
        return self.get_position_qty(symbol) > 0
    
    def is_short(self, symbol: str) -> bool:
        """Check if we have a short position."""
        return self.get_position_qty(symbol) < 0
    
    def is_flat(self, symbol: str) -> bool:
        """Check if we have no position."""
        return self.get_position_qty(symbol) == 0


# Simple indicator helpers (for strategies)
def sma(prices: List[float], period: int) -> float:
    """Calculate Simple Moving Average."""
    if len(prices) < period:
        return float('nan')
    return sum(prices[-period:]) / period


def ema(prices: List[float], period: int, prev_ema: Optional[float] = None) -> float:
    """Calculate Exponential Moving Average."""
    if len(prices) < 1:
        return float('nan')
    
    k = 2 / (period + 1)
    
    if prev_ema is None:
        if len(prices) < period:
            return float('nan')
        return sum(prices[-period:]) / period
    
    return prices[-1] * k + prev_ema * (1 - k)


def rsi(prices: List[float], period: int = 14) -> float:
    """Calculate Relative Strength Index."""
    if len(prices) < period + 1:
        return float('nan')
    
    changes = [prices[i] - prices[i-1] for i in range(1, len(prices))]
    gains = [c if c > 0 else 0 for c in changes[-period:]]
    losses = [-c if c < 0 else 0 for c in changes[-period:]]
    
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    
    if avg_loss == 0:
        return 100.0
    
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))
