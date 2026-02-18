"""
Unit tests for Phase 4 - Fill Simulator.
"""

import pytest
from datetime import datetime

import sys
from pathlib import Path
_project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(_project_root / "phase1"))

from services.execution.order_types import Order, OrderType, OrderSide, OrderStatus
from services.backtest.fill_simulator import (
    FillSimulator, SlippageConfig, CommissionConfig, SlippageModel
)


def create_order(
    order_type: OrderType,
    side: OrderSide,
    quantity: float = 100,
    limit_price: float = None,
    stop_price: float = None,
) -> Order:
    """Helper to create test orders."""
    return Order(
        id="TEST-001",
        symbol="AAPL",
        side=side,
        quantity=quantity,
        order_type=order_type,
        limit_price=limit_price,
        stop_price=stop_price,
        status=OrderStatus.SUBMITTED,
    )


class TestSlippageConfig:
    """Tests for SlippageConfig."""
    
    def test_default_no_slippage(self):
        config = SlippageConfig()
        assert config.model == SlippageModel.NONE
    
    def test_fixed_slippage(self):
        config = SlippageConfig(model=SlippageModel.FIXED, fixed_amount=0.05)
        assert config.fixed_amount == 0.05
    
    def test_percentage_slippage(self):
        config = SlippageConfig(model=SlippageModel.PERCENTAGE, percentage=0.1)
        assert config.percentage == 0.1


class TestFillSimulator:
    """Tests for FillSimulator class."""
    
    @pytest.fixture
    def simulator(self):
        return FillSimulator()
    
    @pytest.fixture
    def simulator_with_slippage(self):
        return FillSimulator(
            slippage=SlippageConfig(model=SlippageModel.FIXED, fixed_amount=0.05),
            commission=CommissionConfig(per_share=0.01),
        )
    
    def test_market_order_fill_at_open(self, simulator):
        order = create_order(OrderType.MARKET, OrderSide.BUY)
        
        fill = simulator.check_market_order(
            order=order,
            bar_open=150.0,
            bar_high=155.0,
            bar_low=148.0,
            bar_close=152.0,
            timestamp=datetime.now(),
        )
        
        assert fill is not None
        assert fill.price == 150.0  # Filled at open
        assert fill.quantity == 100
    
    def test_market_order_with_slippage(self, simulator_with_slippage):
        order = create_order(OrderType.MARKET, OrderSide.BUY)
        
        fill = simulator_with_slippage.check_market_order(
            order=order,
            bar_open=150.0,
            bar_high=155.0,
            bar_low=148.0,
            bar_close=152.0,
            timestamp=datetime.now(),
        )
        
        assert fill is not None
        assert fill.price == 150.05  # Open + slippage
        assert fill.commission == 1.0  # 100 shares * 0.01
    
    def test_limit_buy_fills_when_price_low_enough(self, simulator):
        order = create_order(OrderType.LIMIT, OrderSide.BUY, limit_price=149.0)
        
        fill = simulator.check_limit_order(
            order=order,
            bar_open=150.0,
            bar_high=155.0,
            bar_low=148.0,  # Low touches limit
            bar_close=152.0,
            timestamp=datetime.now(),
        )
        
        assert fill is not None
        assert fill.price == 149.0
    
    def test_limit_buy_no_fill_when_price_high(self, simulator):
        order = create_order(OrderType.LIMIT, OrderSide.BUY, limit_price=145.0)
        
        fill = simulator.check_limit_order(
            order=order,
            bar_open=150.0,
            bar_high=155.0,
            bar_low=148.0,  # Low doesn't reach 145
            bar_close=152.0,
            timestamp=datetime.now(),
        )
        
        assert fill is None
    
    def test_limit_sell_fills_when_price_high_enough(self, simulator):
        order = create_order(OrderType.LIMIT, OrderSide.SELL, limit_price=154.0)
        
        fill = simulator.check_limit_order(
            order=order,
            bar_open=150.0,
            bar_high=155.0,  # High exceeds limit
            bar_low=148.0,
            bar_close=152.0,
            timestamp=datetime.now(),
        )
        
        assert fill is not None
        assert fill.price == 154.0
    
    def test_stop_buy_triggers(self, simulator):
        order = create_order(OrderType.STOP, OrderSide.BUY, stop_price=152.0)
        
        fill = simulator.check_stop_order(
            order=order,
            bar_open=150.0,
            bar_high=155.0,
            bar_low=148.0,
            bar_close=153.0,
            prev_close=149.0,
            timestamp=datetime.now(),
        )
        
        assert fill is not None
        assert fill.price >= 152.0  # Filled at or above stop
    
    def test_stop_sell_triggers(self, simulator):
        order = create_order(OrderType.STOP, OrderSide.SELL, stop_price=149.0)
        
        fill = simulator.check_stop_order(
            order=order,
            bar_open=150.0,
            bar_high=155.0,
            bar_low=148.0,  # Goes below stop
            bar_close=152.0,
            prev_close=151.0,
            timestamp=datetime.now(),
        )
        
        assert fill is not None
        assert fill.price <= 149.0
    
    def test_stop_limit_triggers_and_fills(self, simulator):
        order = create_order(
            OrderType.STOP_LIMIT,
            OrderSide.BUY,
            stop_price=152.0,
            limit_price=153.0,
        )
        
        fill = simulator.check_stop_limit_order(
            order=order,
            bar_open=150.0,
            bar_high=155.0,
            bar_low=148.0,
            bar_close=154.0,
            prev_close=149.0,
            timestamp=datetime.now(),
        )
        
        assert fill is not None
        assert fill.price == 153.0
    
    def test_inactive_order_not_filled(self, simulator):
        order = create_order(OrderType.MARKET, OrderSide.BUY)
        order.status = OrderStatus.CANCELLED
        
        fill = simulator.process_order(
            order=order,
            bar_open=150.0,
            bar_high=155.0,
            bar_low=148.0,
            bar_close=152.0,
            prev_close=149.0,
            timestamp=datetime.now(),
        )
        
        assert fill is None
    
    def test_apply_fill_updates_order(self, simulator):
        order = create_order(OrderType.MARKET, OrderSide.BUY)
        
        fill = simulator.check_market_order(
            order=order,
            bar_open=150.0,
            bar_high=155.0,
            bar_low=148.0,
            bar_close=152.0,
            timestamp=datetime.now(),
        )
        
        simulator.apply_fill(order, fill)
        
        assert order.status == OrderStatus.FILLED
        assert order.filled_qty == 100
        assert order.filled_avg_price == 150.0
    
    def test_partial_fill(self, simulator):
        order = create_order(OrderType.MARKET, OrderSide.BUY, quantity=200)
        order.filled_qty = 50  # Already partially filled
        order.filled_avg_price = 149.0
        
        fill = simulator.check_market_order(
            order=order,
            bar_open=151.0,
            bar_high=155.0,
            bar_low=148.0,
            bar_close=152.0,
            timestamp=datetime.now(),
        )
        
        # Fill only remaining qty
        assert fill.quantity == 150
    
    def test_commission_calculation(self, simulator_with_slippage):
        commission = simulator_with_slippage.calculate_commission(100, 150.0)
        assert commission == 1.0  # 100 * 0.01


class TestRandomSlippage:
    """Tests for random slippage model."""
    
    def test_seeded_slippage_reproducible(self):
        config = SlippageConfig(
            model=SlippageModel.RANDOM,
            random_min=0.0,
            random_max=0.1,
            seed=42,
        )
        sim1 = FillSimulator(slippage=config)
        
        config2 = SlippageConfig(
            model=SlippageModel.RANDOM,
            random_min=0.0,
            random_max=0.1,
            seed=42,
        )
        sim2 = FillSimulator(slippage=config2)
        
        slip1 = sim1.calculate_slippage(100.0, OrderSide.BUY)
        slip2 = sim2.calculate_slippage(100.0, OrderSide.BUY)
        
        assert slip1 == slip2  # Same seed = same result
