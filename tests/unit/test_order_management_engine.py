"""
Tests for order_management_engine.py
======================================
Covers: Order, OrderFill, OrderValidator, FillSimulator, OrderBook,
        PositionTracker, BracketManager, OrderRouter, OrderAnalytics,
        OrderManagementEngine.
"""

import time
import pytest
import numpy as np
from phase1.services.order_management_engine import (
    OrderType, OrderSide, OrderStatus, TimeInForce, OrderRejectReason,
    OrderFill, Order, Position,
    OrderValidator, FillSimulator, OrderBook, PositionTracker,
    BracketManager, OrderRouter, OrderAnalytics, OrderManagementEngine,
)


# ═══════════════════════════════════════════════════════════════════════════════
# OrderFill
# ═══════════════════════════════════════════════════════════════════════════════

class TestOrderFill:
    def test_notional(self):
        f = OrderFill(quantity=100, price=50.0)
        assert f.notional == 5000.0

    def test_to_dict(self):
        f = OrderFill(quantity=50, price=100.0, commission=1.0)
        d = f.to_dict()
        assert d["quantity"] == 50
        assert d["notional"] == 5000.0


# ═══════════════════════════════════════════════════════════════════════════════
# Order
# ═══════════════════════════════════════════════════════════════════════════════

class TestOrder:
    def test_creation(self):
        o = Order(symbol="AAPL", side=OrderSide.BUY,
                  order_type=OrderType.LIMIT, quantity=100,
                  limit_price=150.0)
        assert o.symbol == "AAPL"
        assert o.remaining_quantity == 100
        assert o.status == OrderStatus.PENDING

    def test_submit_accept(self):
        o = Order(symbol="AAPL", quantity=100)
        assert o.submit() is True
        assert o.status == OrderStatus.SUBMITTED
        assert o.accept() is True
        assert o.status == OrderStatus.ACCEPTED
        assert o.is_active is True

    def test_fill(self):
        o = Order(symbol="AAPL", quantity=100)
        o.submit(); o.accept()
        f = OrderFill(quantity=100, price=150.0, commission=1.0)
        o.add_fill(f)
        assert o.status == OrderStatus.FILLED
        assert o.filled_quantity == 100
        assert o.avg_fill_price == 150.0
        assert o.is_terminal is True

    def test_partial_fill(self):
        o = Order(symbol="AAPL", quantity=100)
        o.submit(); o.accept()
        o.add_fill(OrderFill(quantity=30, price=150.0))
        assert o.status == OrderStatus.PARTIALLY_FILLED
        assert o.remaining_quantity == 70
        o.add_fill(OrderFill(quantity=70, price=151.0))
        assert o.status == OrderStatus.FILLED
        expected_avg = (150.0 * 30 + 151.0 * 70) / 100
        assert abs(o.avg_fill_price - expected_avg) < 0.01

    def test_cancel(self):
        o = Order(symbol="AAPL", quantity=100)
        o.submit(); o.accept()
        assert o.cancel() is True
        assert o.status == OrderStatus.CANCELLED
        assert o.is_terminal is True

    def test_reject(self):
        o = Order(symbol="AAPL", quantity=100)
        assert o.reject(OrderRejectReason.INSUFFICIENT_FUNDS) is True
        assert o.status == OrderStatus.REJECTED
        assert o.reject_reason == OrderRejectReason.INSUFFICIENT_FUNDS

    def test_expire(self):
        o = Order(symbol="AAPL", quantity=100)
        o.submit(); o.accept()
        assert o.expire() is True
        assert o.status == OrderStatus.EXPIRED

    def test_fill_ratio(self):
        o = Order(symbol="AAPL", quantity=200)
        o.submit(); o.accept()
        o.add_fill(OrderFill(quantity=100, price=150.0))
        assert o.fill_ratio == 0.5

    def test_notional_value(self):
        o = Order(symbol="AAPL", quantity=100, limit_price=150.0)
        assert o.notional_value == 15000.0

    def test_to_dict(self):
        o = Order(symbol="MSFT", side=OrderSide.SELL, quantity=50,
                  order_type=OrderType.MARKET)
        d = o.to_dict()
        assert d["symbol"] == "MSFT"
        assert d["side"] == "sell"
        assert d["order_type"] == "market"

    def test_cannot_cancel_filled(self):
        o = Order(symbol="X", quantity=10)
        o.submit(); o.accept()
        o.add_fill(OrderFill(quantity=10, price=100.0))
        assert o.cancel() is False

    def test_cannot_submit_twice(self):
        o = Order(symbol="X", quantity=10)
        o.submit()
        assert o.submit() is False


# ═══════════════════════════════════════════════════════════════════════════════
# OrderValidator
# ═══════════════════════════════════════════════════════════════════════════════

class TestOrderValidator:
    def setup_method(self):
        self.validator = OrderValidator()

    def test_valid_order(self):
        o = Order(symbol="AAPL", side=OrderSide.BUY, quantity=100,
                  limit_price=150.0)
        valid, reason, msg = self.validator.validate(o)
        assert valid is True

    def test_zero_quantity(self):
        o = Order(symbol="AAPL", quantity=0)
        valid, reason, msg = self.validator.validate(o)
        assert valid is False
        assert reason == OrderRejectReason.INVALID_QUANTITY

    def test_exceeds_max_quantity(self):
        o = Order(symbol="AAPL", quantity=2_000_000)
        valid, reason, msg = self.validator.validate(o)
        assert valid is False
        assert reason == OrderRejectReason.EXCEEDS_MAX_ORDER

    def test_invalid_price(self):
        o = Order(symbol="AAPL", quantity=100, limit_price=-5)
        valid, reason, msg = self.validator.validate(o)
        assert valid is False
        assert reason == OrderRejectReason.INVALID_PRICE

    def test_insufficient_funds(self):
        o = Order(symbol="AAPL", side=OrderSide.BUY, quantity=1000,
                  limit_price=200.0)
        valid, reason, msg = self.validator.validate(o, buying_power=10000)
        assert valid is False
        assert reason == OrderRejectReason.INSUFFICIENT_FUNDS

    def test_insufficient_shares(self):
        o = Order(symbol="AAPL", side=OrderSide.SELL, quantity=100)
        valid, reason, msg = self.validator.validate(o, position=50)
        assert valid is False
        assert reason == OrderRejectReason.INSUFFICIENT_SHARES

    def test_restricted_symbol(self):
        self.validator.restricted_symbols.add("HALT")
        o = Order(symbol="HALT", quantity=100)
        valid, reason, msg = self.validator.validate(o)
        assert valid is False

    def test_no_symbol(self):
        o = Order(symbol="", quantity=100)
        valid, reason, msg = self.validator.validate(o)
        assert valid is False

    def test_stop_price_zero(self):
        o = Order(symbol="AAPL", quantity=100, stop_price=-1)
        valid, reason, msg = self.validator.validate(o)
        assert valid is False


# ═══════════════════════════════════════════════════════════════════════════════
# FillSimulator
# ═══════════════════════════════════════════════════════════════════════════════

class TestFillSimulator:
    def setup_method(self):
        self.sim = FillSimulator()

    def test_market_fill_buy(self):
        o = Order(symbol="AAPL", side=OrderSide.BUY, quantity=100,
                  order_type=OrderType.MARKET)
        o.submit(); o.accept()
        fill = self.sim.simulate_market_fill(o, 150.0)
        assert fill.quantity == 100
        assert fill.price > 150.0  # slippage for buy

    def test_market_fill_sell(self):
        o = Order(symbol="AAPL", side=OrderSide.SELL, quantity=100,
                  order_type=OrderType.MARKET)
        o.submit(); o.accept()
        fill = self.sim.simulate_market_fill(o, 150.0)
        assert fill.price < 150.0  # slippage for sell

    def test_limit_fill_triggers(self):
        o = Order(symbol="AAPL", side=OrderSide.BUY, quantity=100,
                  order_type=OrderType.LIMIT, limit_price=152.0)
        o.submit(); o.accept()
        fill = self.sim.simulate_limit_fill(o, 150.0)
        assert fill is not None
        assert fill.price <= 152.0

    def test_limit_fill_no_trigger(self):
        o = Order(symbol="AAPL", side=OrderSide.BUY, quantity=100,
                  order_type=OrderType.LIMIT, limit_price=148.0)
        o.submit(); o.accept()
        fill = self.sim.simulate_limit_fill(o, 150.0)
        assert fill is None

    def test_stop_triggers(self):
        o = Order(symbol="AAPL", side=OrderSide.SELL, quantity=100,
                  order_type=OrderType.STOP, stop_price=145.0)
        o.submit(); o.accept()
        fill = self.sim.simulate_stop_fill(o, 143.0)
        assert fill is not None

    def test_stop_no_trigger(self):
        o = Order(symbol="AAPL", side=OrderSide.SELL, quantity=100,
                  order_type=OrderType.STOP, stop_price=145.0)
        fill = self.sim.simulate_stop_fill(o, 150.0)
        assert fill is None

    def test_commission(self):
        comm = self.sim.calculate_commission(100)
        assert comm >= self.sim.min_commission

    def test_no_limit_price(self):
        o = Order(symbol="AAPL", quantity=100)
        fill = self.sim.simulate_limit_fill(o, 150.0)
        assert fill is None

    def test_no_stop_price(self):
        o = Order(symbol="AAPL", quantity=100)
        fill = self.sim.simulate_stop_fill(o, 150.0)
        assert fill is None


# ═══════════════════════════════════════════════════════════════════════════════
# OrderBook
# ═══════════════════════════════════════════════════════════════════════════════

class TestOrderBook:
    def setup_method(self):
        self.book = OrderBook()

    def _make_order(self, symbol="AAPL", side=OrderSide.BUY, qty=100):
        o = Order(symbol=symbol, side=side, quantity=qty,
                  order_type=OrderType.LIMIT, limit_price=150.0)
        return o

    def test_add_and_get(self):
        o = self._make_order()
        self.book.add(o)
        assert self.book.get(o.order_id) is not None

    def test_cancel(self):
        o = self._make_order()
        self.book.add(o)
        o.submit(); o.accept()
        assert self.book.cancel(o.order_id) is True

    def test_get_by_symbol(self):
        self.book.add(self._make_order("AAPL"))
        self.book.add(self._make_order("MSFT"))
        self.book.add(self._make_order("AAPL"))
        assert len(self.book.get_by_symbol("AAPL")) == 2

    def test_get_active(self):
        o1 = self._make_order()
        o2 = self._make_order()
        self.book.add(o1)
        self.book.add(o2)
        o1.submit(); o1.accept()
        self.book._update_status_index(o1.order_id)
        active = self.book.get_active()
        assert len(active) >= 1

    def test_count(self):
        self.book.add(self._make_order())
        self.book.add(self._make_order())
        assert self.book.count == 2

    def test_cancel_all(self):
        o1 = self._make_order("AAPL")
        o2 = self._make_order("MSFT")
        self.book.add(o1); o1.submit(); o1.accept()
        self.book.add(o2); o2.submit(); o2.accept()
        self.book._update_status_index(o1.order_id)
        self.book._update_status_index(o2.order_id)
        cancelled = self.book.cancel_all()
        assert cancelled == 2

    def test_cancel_all_by_symbol(self):
        o1 = self._make_order("AAPL")
        o2 = self._make_order("MSFT")
        self.book.add(o1); o1.submit(); o1.accept()
        self.book.add(o2); o2.submit(); o2.accept()
        self.book._update_status_index(o1.order_id)
        self.book._update_status_index(o2.order_id)
        cancelled = self.book.cancel_all("AAPL")
        assert cancelled == 1

    def test_history(self):
        o = self._make_order()
        self.book.add(o)
        h = self.book.get_history()
        assert len(h) >= 1
        assert h[0]["action"] == "add"

    def test_get_filled(self):
        o = self._make_order()
        self.book.add(o)
        o.submit(); o.accept()
        o.add_fill(OrderFill(quantity=100, price=150.0))
        self.book._update_status_index(o.order_id)
        assert len(self.book.get_filled()) == 1


# ═══════════════════════════════════════════════════════════════════════════════
# Position & PositionTracker
# ═══════════════════════════════════════════════════════════════════════════════

class TestPosition:
    def test_long_position(self):
        p = Position(symbol="AAPL", quantity=100, avg_cost=150.0, market_price=160.0)
        assert p.is_long is True
        assert p.unrealized_pnl == 1000.0
        assert p.market_value == 16000.0

    def test_short_position(self):
        p = Position(symbol="AAPL", quantity=-100, avg_cost=150.0, market_price=140.0)
        assert p.is_short is True
        assert p.unrealized_pnl == 1000.0  # short profit

    def test_flat_position(self):
        p = Position(symbol="AAPL", quantity=0)
        assert p.unrealized_pnl == 0.0
        assert p.is_long is False
        assert p.is_short is False

    def test_pnl_pct(self):
        p = Position(symbol="AAPL", quantity=100, avg_cost=100.0, market_price=110.0)
        assert abs(p.unrealized_pnl_pct - 10.0) < 0.01

    def test_to_dict(self):
        p = Position(symbol="AAPL", quantity=50, avg_cost=100.0, market_price=105.0)
        d = p.to_dict()
        assert d["side"] == "long"


class TestPositionTracker:
    def setup_method(self):
        self.tracker = PositionTracker()

    def test_buy_creates_long(self):
        p = self.tracker.apply_fill("AAPL", OrderSide.BUY, 100, 150.0)
        assert p.quantity == 100
        assert p.avg_cost == 150.0

    def test_sell_reduces_long(self):
        self.tracker.apply_fill("AAPL", OrderSide.BUY, 100, 150.0)
        p = self.tracker.apply_fill("AAPL", OrderSide.SELL, 50, 160.0)
        assert p.quantity == 50
        assert p.realized_pnl == 50 * 10  # $500

    def test_sell_closes_long(self):
        self.tracker.apply_fill("AAPL", OrderSide.BUY, 100, 150.0)
        p = self.tracker.apply_fill("AAPL", OrderSide.SELL, 100, 160.0)
        assert p.quantity == 0
        assert p.realized_pnl == 1000.0

    def test_short_sell(self):
        p = self.tracker.apply_fill("AAPL", OrderSide.SELL_SHORT, 100, 150.0)
        assert p.quantity == -100

    def test_cover_short(self):
        self.tracker.apply_fill("AAPL", OrderSide.SELL_SHORT, 100, 150.0)
        p = self.tracker.apply_fill("AAPL", OrderSide.BUY_TO_COVER, 100, 140.0)
        assert p.quantity == 0
        assert p.realized_pnl == 1000.0  # profit on short

    def test_multiple_buys_avg_cost(self):
        self.tracker.apply_fill("AAPL", OrderSide.BUY, 100, 100.0)
        p = self.tracker.apply_fill("AAPL", OrderSide.BUY, 100, 120.0)
        assert p.quantity == 200
        assert abs(p.avg_cost - 110.0) < 0.01

    def test_update_price(self):
        self.tracker.apply_fill("AAPL", OrderSide.BUY, 100, 150.0)
        self.tracker.update_price("AAPL", 160.0)
        assert self.tracker.get_position("AAPL").market_price == 160.0

    def test_exposure(self):
        self.tracker.apply_fill("AAPL", OrderSide.BUY, 100, 150.0)
        self.tracker.update_price("AAPL", 150.0)
        exp = self.tracker.get_exposure()
        assert exp["long"] == 15000.0
        assert exp["net"] == 15000.0

    def test_get_all_positions(self):
        self.tracker.apply_fill("AAPL", OrderSide.BUY, 100, 150.0)
        self.tracker.apply_fill("MSFT", OrderSide.BUY, 50, 300.0)
        assert len(self.tracker.get_all_positions()) == 2

    def test_portfolio_value(self):
        self.tracker.apply_fill("AAPL", OrderSide.BUY, 100, 150.0)
        self.tracker.update_price("AAPL", 160.0)
        assert self.tracker.get_portfolio_value() == 16000.0


# ═══════════════════════════════════════════════════════════════════════════════
# BracketManager
# ═══════════════════════════════════════════════════════════════════════════════

class TestBracketManager:
    def setup_method(self):
        self.book = OrderBook()
        self.mgr = BracketManager(self.book)

    def test_create_bracket(self):
        parent = Order(symbol="AAPL", side=OrderSide.BUY, quantity=100,
                       limit_price=150.0)
        self.book.add(parent)
        result = self.mgr.create_bracket(parent, 170.0, 140.0)
        assert "take_profit" in result
        assert "stop_loss" in result
        assert result["take_profit"].limit_price == 170.0
        assert result["stop_loss"].stop_price == 140.0

    def test_on_child_filled_cancels_other(self):
        parent = Order(symbol="AAPL", side=OrderSide.BUY, quantity=100)
        self.book.add(parent)
        result = self.mgr.create_bracket(parent, 170.0, 140.0)
        tp = result["take_profit"]
        sl = result["stop_loss"]
        tp.submit(); tp.accept()
        sl.submit(); sl.accept()
        tp.add_fill(OrderFill(quantity=100, price=170.0))
        self.mgr.on_child_filled(tp.order_id)
        assert sl.status == OrderStatus.CANCELLED

    def test_create_oco(self):
        a = Order(symbol="AAPL", side=OrderSide.BUY, quantity=100,
                  limit_price=148.0)
        b = Order(symbol="AAPL", side=OrderSide.BUY, quantity=100,
                  limit_price=145.0)
        result = self.mgr.create_oco(a, b)
        assert "oco_id" in result

    def test_get_bracket(self):
        parent = Order(symbol="AAPL", side=OrderSide.BUY, quantity=100)
        self.book.add(parent)
        self.mgr.create_bracket(parent, 170.0, 140.0)
        br = self.mgr.get_bracket(parent.order_id)
        assert br is not None


# ═══════════════════════════════════════════════════════════════════════════════
# OrderRouter
# ═══════════════════════════════════════════════════════════════════════════════

class TestOrderRouter:
    def setup_method(self):
        self.router = OrderRouter()

    def test_best_price(self):
        o = Order(symbol="AAPL", quantity=100)
        exchange = self.router.route_order(o, "best_price")
        assert exchange in ("NYSE", "NASDAQ", "ARCA", "BATS", "IEX")

    def test_lowest_fee(self):
        o = Order(symbol="AAPL", quantity=100)
        exchange = self.router.route_order(o, "lowest_fee")
        assert exchange == "IEX"  # lowest fee

    def test_lowest_latency(self):
        o = Order(symbol="AAPL", quantity=100)
        exchange = self.router.route_order(o, "lowest_latency")
        assert exchange == "NASDAQ"  # 0.8ms

    def test_get_fees(self):
        fees = self.router.get_exchange_fees()
        assert len(fees) == 5


# ═══════════════════════════════════════════════════════════════════════════════
# OrderAnalytics
# ═══════════════════════════════════════════════════════════════════════════════

class TestOrderAnalytics:
    def test_execution_quality(self):
        orders = []
        for i in range(3):
            o = Order(symbol="AAPL", quantity=100, limit_price=150.0)
            o.submit(); o.accept()
            o.add_fill(OrderFill(quantity=100, price=150.2 + i * 0.1,
                                 commission=1.5))
            orders.append(o)
        result = OrderAnalytics.execution_quality(orders)
        assert result["fill_count"] == 3
        assert result["total_commission"] > 0

    def test_execution_quality_empty(self):
        result = OrderAnalytics.execution_quality([])
        assert result["fill_count"] == 0

    def test_order_summary(self):
        orders = [
            Order(symbol="AAPL", side=OrderSide.BUY, quantity=100,
                  order_type=OrderType.MARKET),
            Order(symbol="MSFT", side=OrderSide.SELL, quantity=50,
                  order_type=OrderType.LIMIT),
        ]
        result = OrderAnalytics.order_summary(orders)
        assert result["total"] == 2
        assert "market" in result["by_type"]

    def test_summary_empty(self):
        result = OrderAnalytics.order_summary([])
        assert result["total"] == 0


# ═══════════════════════════════════════════════════════════════════════════════
# OrderManagementEngine (orchestrator)
# ═══════════════════════════════════════════════════════════════════════════════

class TestOrderManagementEngine:
    def setup_method(self):
        self.engine = OrderManagementEngine()
        self.engine.set_buying_power(1_000_000)

    def test_market_order(self):
        o = self.engine.create_market_order("AAPL", "buy", 100)
        assert o.status == OrderStatus.ACCEPTED
        assert o.order_type == OrderType.MARKET

    def test_limit_order(self):
        o = self.engine.create_limit_order("AAPL", "buy", 100, 150.0)
        assert o.status == OrderStatus.ACCEPTED
        assert o.limit_price == 150.0

    def test_stop_order(self):
        # Need a position first to sell
        buy = self.engine.create_market_order("AAPL", "buy", 200)
        self.engine.process_market_fill(buy.order_id, 150.0)
        o = self.engine.create_stop_order("AAPL", "sell", 100, 140.0)
        assert o.status == OrderStatus.ACCEPTED
        assert o.stop_price == 140.0

    def test_stop_limit_order(self):
        o = self.engine.create_stop_limit_order("AAPL", "sell", 100, 145.0, 143.0)
        assert o.stop_price == 145.0
        assert o.limit_price == 143.0

    def test_trailing_stop(self):
        o = self.engine.create_trailing_stop("AAPL", "sell", 100, trail_percent=5.0)
        assert o.trail_percent == 5.0

    def test_bracket_order(self):
        result = self.engine.create_bracket_order("AAPL", "buy", 100, 150.0, 170.0, 140.0)
        assert "parent" in result
        assert "take_profit" in result
        assert "stop_loss" in result

    def test_cancel_order(self):
        o = self.engine.create_limit_order("AAPL", "buy", 100, 150.0)
        assert self.engine.cancel_order(o.order_id) is True

    def test_cancel_all(self):
        self.engine.create_limit_order("AAPL", "buy", 100, 150.0)
        self.engine.create_limit_order("MSFT", "buy", 50, 300.0)
        cancelled = self.engine.cancel_all()
        assert cancelled == 2

    def test_get_active_orders(self):
        self.engine.create_limit_order("AAPL", "buy", 100, 150.0)
        assert len(self.engine.get_active_orders()) == 1

    def test_process_market_fill(self):
        o = self.engine.create_market_order("AAPL", "buy", 100)
        fill = self.engine.process_market_fill(o.order_id, 150.0)
        assert fill is not None
        assert fill.quantity == 100
        pos = self.engine.get_position("AAPL")
        assert pos is not None
        assert pos.quantity == 100

    def test_process_limit_fill(self):
        o = self.engine.create_limit_order("AAPL", "buy", 100, 155.0)
        fill = self.engine.process_market_fill(o.order_id, 150.0)
        assert fill is not None

    def test_process_limit_no_fill(self):
        o = self.engine.create_limit_order("AAPL", "buy", 100, 148.0)
        fill = self.engine.process_market_fill(o.order_id, 150.0)
        assert fill is None

    def test_portfolio_summary(self):
        o = self.engine.create_market_order("AAPL", "buy", 100)
        self.engine.process_market_fill(o.order_id, 150.0)
        summary = self.engine.get_portfolio_summary()
        assert len(summary["positions"]) == 1

    def test_order_rejected_insufficient_funds(self):
        self.engine.set_buying_power(100)
        o = self.engine.create_limit_order("AAPL", "buy", 1000, 200.0)
        assert o.status == OrderStatus.REJECTED

    def test_execution_quality(self):
        o = self.engine.create_market_order("AAPL", "buy", 100)
        self.engine.process_market_fill(o.order_id, 150.0)
        eq = self.engine.execution_quality()
        assert eq["fill_count"] == 1

    def test_order_summary(self):
        self.engine.create_market_order("AAPL", "buy", 100)
        self.engine.create_limit_order("MSFT", "buy", 50, 300.0)
        summary = self.engine.order_summary()
        assert summary["total"] == 2

    def test_capabilities(self):
        caps = self.engine.capabilities()
        assert "market_orders" in caps["features"]
        assert "market" in caps["order_types"]

    def test_route_order(self):
        o = self.engine.create_limit_order("AAPL", "buy", 100, 150.0)
        exchange = self.engine.route_order(o.order_id)
        assert exchange in ("NYSE", "NASDAQ", "ARCA", "BATS", "IEX")

    def test_get_history(self):
        self.engine.create_market_order("AAPL", "buy", 100)
        h = self.engine.get_history()
        assert len(h) >= 1

    def test_multiple_fills_position(self):
        o1 = self.engine.create_market_order("AAPL", "buy", 100)
        self.engine.process_market_fill(o1.order_id, 150.0)
        o2 = self.engine.create_market_order("AAPL", "buy", 100)
        self.engine.process_market_fill(o2.order_id, 160.0)
        pos = self.engine.get_position("AAPL")
        assert pos.quantity == 200

    def test_sell_after_buy(self):
        o1 = self.engine.create_market_order("AAPL", "buy", 100)
        self.engine.process_market_fill(o1.order_id, 150.0)
        # To sell, we need position
        o2 = self.engine.create_market_order("AAPL", "sell", 50)
        self.engine.process_market_fill(o2.order_id, 160.0)
        pos = self.engine.get_position("AAPL")
        assert pos.quantity == 50
        assert pos.realized_pnl > 0

    def test_nonexistent_order_fill(self):
        fill = self.engine.process_market_fill("fake_id", 150.0)
        assert fill is None
