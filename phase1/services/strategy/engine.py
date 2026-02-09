"""
Strategy Engine - Orchestrates strategy execution in backtest, paper, and live modes.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Type, Any, Callable
from datetime import datetime
from enum import Enum
import logging
import threading
import queue
import time

from .base_strategy import BaseStrategy, Bar, Tick, StrategyContext, StrategyState
from ..portfolio.manager import PortfolioManager
from ..portfolio.risk_manager import RiskManager, RiskLimits
from ..execution.order_types import Order, OrderType, OrderSide, OrderStatus, TimeInForce
from ..execution.alpaca_adapter import AlpacaAdapter
from ..backtest.fill_simulator import FillSimulator


logger = logging.getLogger(__name__)


class ExecutionMode(str, Enum):
    BACKTEST = "backtest"
    PAPER = "paper"
    LIVE = "live"  # Disabled for safety


@dataclass
class EngineConfig:
    """Configuration for the strategy engine."""
    mode: ExecutionMode = ExecutionMode.PAPER
    initial_capital: float = 100000.0
    risk_limits: Optional[RiskLimits] = None
    symbols: List[str] = field(default_factory=list)
    
    # Paper trading
    use_alpaca: bool = True
    
    # Backtest
    fill_at_bar_open: bool = True
    
    def to_dict(self) -> dict:
        return {
            "mode": self.mode.value,
            "initial_capital": self.initial_capital,
            "symbols": self.symbols,
            "use_alpaca": self.use_alpaca,
        }


class StrategyEngine:
    """
    Main strategy execution engine.
    
    Supports:
    - Backtest mode: historical replay with simulated fills
    - Paper mode: live data with paper trading (Alpaca)
    - Live mode: disabled for safety
    """
    
    def __init__(self, config: EngineConfig):
        self.config = config
        
        if config.mode == ExecutionMode.LIVE:
            raise ValueError("LIVE mode is disabled for safety. Use PAPER mode.")
        
        # Initialize components
        self.portfolio = PortfolioManager(initial_cash=config.initial_capital)
        self.risk_manager = RiskManager(self.portfolio, config.risk_limits)
        self.fill_simulator = FillSimulator(fill_at_bar_open=config.fill_at_bar_open)
        
        # Alpaca adapter (for paper trading)
        self.alpaca: Optional[AlpacaAdapter] = None
        if config.mode == ExecutionMode.PAPER and config.use_alpaca:
            try:
                self.alpaca = AlpacaAdapter()
                logger.info("Alpaca adapter initialized")
            except Exception as e:
                logger.warning(f"Alpaca not available: {e}")
        
        # Order management
        self.orders: Dict[str, Order] = {}
        self._order_counter = 0
        
        # Strategy management
        self.strategies: Dict[str, BaseStrategy] = {}
        
        # Event queues
        self._bar_queue: queue.Queue = queue.Queue()
        self._tick_queue: queue.Queue = queue.Queue()
        self._order_queue: queue.Queue = queue.Queue()
        
        # State
        self.running = False
        self.current_time: Optional[datetime] = None
        self.bar_index = 0
        
        # Callbacks
        self._on_fill_callbacks: List[Callable] = []
        self._on_bar_callbacks: List[Callable] = []
    
    def _generate_order_id(self) -> str:
        self._order_counter += 1
        return f"ENG-{datetime.now().strftime('%Y%m%d')}-{self._order_counter:06d}"
    
    def register_strategy(self, strategy: BaseStrategy, strategy_id: Optional[str] = None) -> str:
        """Register a strategy with the engine."""
        sid = strategy_id or f"STR-{len(self.strategies) + 1:03d}"
        
        # Create context for strategy
        context = StrategyContext(
            portfolio=self.portfolio,
            current_time=datetime.now(),
            bar_index=0,
            _place_order=self._place_order,
            _cancel_order=self._cancel_order,
            _get_orders=self._get_orders,
        )
        
        strategy.set_context(context)
        self.strategies[sid] = strategy
        
        logger.info(f"Strategy registered: {sid} - {strategy.name}")
        return sid
    
    def start_strategy(self, strategy_id: str) -> bool:
        """Start a registered strategy."""
        if strategy_id not in self.strategies:
            return False
        
        strategy = self.strategies[strategy_id]
        strategy.on_init()
        strategy.on_start()
        
        logger.info(f"Strategy started: {strategy_id}")
        return True
    
    def stop_strategy(self, strategy_id: str) -> bool:
        """Stop a running strategy."""
        if strategy_id not in self.strategies:
            return False
        
        strategy = self.strategies[strategy_id]
        strategy.on_stop()
        
        logger.info(f"Strategy stopped: {strategy_id}")
        return True
    
    def _place_order(
        self,
        symbol: str,
        side: OrderSide,
        quantity: float,
        order_type: OrderType,
        limit_price: Optional[float] = None,
        stop_price: Optional[float] = None,
        time_in_force: TimeInForce = TimeInForce.DAY,
    ) -> Optional[Order]:
        """Place an order (called by strategy context)."""
        # Get current price estimate
        price = limit_price or stop_price or 0
        
        # Risk check
        check = self.risk_manager.check_order(
            symbol=symbol,
            side=side.value,
            quantity=quantity,
            price=price,
        )
        
        if not check.passed:
            logger.warning(f"Order rejected: {check.rejection_reasons}")
            return None
        
        order = Order(
            id=self._generate_order_id(),
            symbol=symbol,
            side=side,
            quantity=quantity,
            order_type=order_type,
            limit_price=limit_price,
            stop_price=stop_price,
            time_in_force=time_in_force,
            status=OrderStatus.SUBMITTED,
            submitted_at=self.current_time or datetime.now(),
        )
        
        # Submit to Alpaca if in paper mode
        if self.config.mode == ExecutionMode.PAPER and self.alpaca:
            try:
                alpaca_id = self.alpaca.place_order(order)
                logger.info(f"Order submitted to Alpaca: {order.id} -> {alpaca_id}")
            except Exception as e:
                logger.error(f"Alpaca order failed: {e}")
                order.status = OrderStatus.REJECTED
                return order
        
        self.orders[order.id] = order
        return order
    
    def _cancel_order(self, order_id: str) -> bool:
        """Cancel an order."""
        if order_id not in self.orders:
            return False
        
        order = self.orders[order_id]
        
        if self.config.mode == ExecutionMode.PAPER and self.alpaca:
            try:
                self.alpaca.cancel_order(order_id)
            except Exception as e:
                logger.error(f"Alpaca cancel failed: {e}")
        
        if order.is_active:
            order.status = OrderStatus.CANCELLED
            return True
        
        return False
    
    def _get_orders(self, symbol: Optional[str] = None) -> List[Order]:
        """Get open orders."""
        orders = [o for o in self.orders.values() if o.is_active]
        if symbol:
            orders = [o for o in orders if o.symbol == symbol]
        return orders
    
    def process_bar(self, bar: Bar) -> None:
        """Process a bar through all strategies."""
        self.current_time = bar.timestamp
        self.bar_index = bar.bar_index
        
        # Update context
        for strategy in self.strategies.values():
            if strategy.context:
                strategy.context.current_time = bar.timestamp
                strategy.context.bar_index = bar.bar_index
        
        # Update portfolio price
        self.portfolio.update_price(bar.symbol, bar.close)
        
        # Process pending orders in backtest mode
        if self.config.mode == ExecutionMode.BACKTEST:
            prev_bar = getattr(self, '_prev_bars', {}).get(bar.symbol)
            prev_close = prev_bar.close if prev_bar else bar.open
            
            for order in list(self.orders.values()):
                if not order.is_active or order.symbol != bar.symbol:
                    continue
                
                fill = self.fill_simulator.process_order(
                    order=order,
                    bar_open=bar.open,
                    bar_high=bar.high,
                    bar_low=bar.low,
                    bar_close=bar.close,
                    prev_close=prev_close,
                    timestamp=bar.timestamp,
                )
                
                if fill:
                    self.fill_simulator.apply_fill(order, fill)
                    self.portfolio.execute_fill(
                        symbol=fill.symbol,
                        side=fill.side.value,
                        quantity=fill.quantity,
                        price=fill.price,
                        timestamp=fill.timestamp,
                        commission=fill.commission,
                    )
                    
                    # Notify strategies
                    for strategy in self.strategies.values():
                        strategy.on_order_fill(order)
                    
                    # Notify callbacks
                    for callback in self._on_fill_callbacks:
                        callback(order, fill)
        
        # Store for next iteration
        if not hasattr(self, '_prev_bars'):
            self._prev_bars = {}
        self._prev_bars[bar.symbol] = bar
        
        # Call strategies
        for strategy in self.strategies.values():
            if strategy.state == StrategyState.RUNNING:
                try:
                    strategy.on_bar(bar)
                except Exception as e:
                    logger.error(f"Strategy error: {e}")
                    strategy.on_error(e)
        
        # Notify callbacks
        for callback in self._on_bar_callbacks:
            callback(bar)
    
    def process_tick(self, tick: Tick) -> None:
        """Process a tick through all strategies."""
        self.current_time = tick.timestamp
        
        for strategy in self.strategies.values():
            if strategy.state == StrategyState.RUNNING:
                try:
                    strategy.on_tick(tick)
                except Exception as e:
                    logger.error(f"Strategy error on tick: {e}")
    
    def on_fill(self, callback: Callable) -> None:
        """Register a callback for order fills."""
        self._on_fill_callbacks.append(callback)
    
    def on_bar(self, callback: Callable) -> None:
        """Register a callback for bar processing."""
        self._on_bar_callbacks.append(callback)
    
    def get_status(self) -> dict:
        """Get current engine status."""
        return {
            "mode": self.config.mode.value,
            "running": self.running,
            "current_time": self.current_time.isoformat() if self.current_time else None,
            "bar_index": self.bar_index,
            "strategies": {
                sid: {
                    "name": s.name,
                    "state": s.state.value,
                }
                for sid, s in self.strategies.items()
            },
            "portfolio": self.portfolio.to_dict(),
            "risk": self.risk_manager.get_status(),
            "open_orders": len(self._get_orders()),
        }
    
    def start(self) -> None:
        """Start the engine."""
        self.running = True
        logger.info(f"Engine started in {self.config.mode.value} mode")
    
    def stop(self) -> None:
        """Stop the engine."""
        self.running = False
        
        # Stop all strategies
        for sid in list(self.strategies.keys()):
            self.stop_strategy(sid)
        
        logger.info("Engine stopped")
    
    def reset(self) -> None:
        """Reset engine state."""
        self.portfolio.reset()
        self.orders.clear()
        self._order_counter = 0
        self.bar_index = 0
        self._prev_bars = {}
        self.risk_manager.reset_daily_limits()
