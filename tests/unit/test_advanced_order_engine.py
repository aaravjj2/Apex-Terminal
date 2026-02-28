"""
Comprehensive tests for AdvancedOrderEngine.
Tests: OrderBook, OrderSide, OrderType, OrderStatus, SlippageCalculator,
FillProbabilityEngine, TWAPCalculator, VWAPCalculator, IcebergOrderManager,
TrailingStopManager, SmartOrderRouter, OrderManager, TransactionCostAnalysis,
and the orchestrator.
"""
import math
import random
import pytest

from phase1.services.advanced_order_engine import (
    OrderSide, OrderType, OrderStatus, FillModel, SlippageModel,
    OrderBookLevel, OrderBook, Order, ExecutionReport,
    SlippageCalculator, FillProbabilityEngine, TWAPCalculator,
    VWAPCalculator, IcebergOrderManager, TrailingStopManager,
    SmartOrderRouter, OrderManager, TransactionCostAnalysis,
    AdvancedOrderEngine,
)


# ═══════════════════════════════════════════════════════════════════════
# Enums
# ═══════════════════════════════════════════════════════════════════════

class TestEnums:
    def test_order_side(self):
        assert OrderSide.BUY.value == "buy"
        assert OrderSide.SELL.value == "sell"

    def test_order_type_count(self):
        assert len(OrderType) >= 10

    def test_order_status(self):
        assert OrderStatus.PENDING.value == "pending"
        assert OrderStatus.FILLED.value == "filled"
        assert OrderStatus.CANCELLED.value == "cancelled"

    def test_slippage_model_values(self):
        assert len(SlippageModel) >= 5


# ═══════════════════════════════════════════════════════════════════════
# OrderBook
# ═══════════════════════════════════════════════════════════════════════

class TestOrderBook:
    def test_basic_book(self):
        bids = [OrderBookLevel(100.00, 500), OrderBookLevel(99.95, 300)]
        asks = [OrderBookLevel(100.05, 400), OrderBookLevel(100.10, 200)]
        book = OrderBook(symbol="TEST", bids=bids, asks=asks)
        assert book.best_bid == 100.00
        assert book.best_ask == 100.05
        assert abs(book.mid_price - 100.025) < 0.001

    def test_spread(self):
        bids = [OrderBookLevel(100.00, 500)]
        asks = [OrderBookLevel(100.10, 400)]
        book = OrderBook(symbol="TEST", bids=bids, asks=asks)
        assert abs(book.spread - 0.10) < 0.001
        assert abs(book.spread_bps - 10.0) < 0.5

    def test_empty_book(self):
        book = OrderBook(symbol="TEST", bids=[], asks=[])
        assert book.best_bid == 0.0
        assert book.best_ask == 0.0
        assert book.mid_price == 0.0

    def test_bid_ask_imbalance(self):
        bids = [OrderBookLevel(100.00, 1000)]
        asks = [OrderBookLevel(100.05, 200)]
        book = OrderBook(symbol="TEST", bids=bids, asks=asks)
        assert book.bid_ask_imbalance > 0  # more bid volume


# ═══════════════════════════════════════════════════════════════════════
# Order
# ═══════════════════════════════════════════════════════════════════════

class TestOrder:
    def test_new_order(self):
        o = Order(
            order_id="ORD001",
            side=OrderSide.BUY,
            order_type=OrderType.LIMIT,
            quantity=100,
            price=150.00,
            symbol="AAPL",
        )
        assert o.remaining_qty == 100
        assert o.is_active
        assert o.fill_percent == 0.0

    def test_partial_fill(self):
        o = Order(order_id="ORD002", side=OrderSide.SELL, order_type=OrderType.MARKET,
                   quantity=500, symbol="TSLA")
        o.filled_qty = 200
        o.status = OrderStatus.PARTIALLY_FILLED
        assert o.remaining_qty == 300
        assert o.fill_percent == 40.0
        assert o.is_active

    def test_fully_filled(self):
        o = Order(order_id="ORD003", side=OrderSide.BUY, order_type=OrderType.MARKET,
                   quantity=100, symbol="MSFT")
        o.filled_qty = 100
        o.status = OrderStatus.FILLED
        assert o.remaining_qty == 0
        assert o.fill_percent == 100.0
        assert not o.is_active

    def test_cancelled(self):
        o = Order(order_id="ORD004", side=OrderSide.BUY, order_type=OrderType.LIMIT,
                   quantity=100, symbol="GOOG")
        o.status = OrderStatus.CANCELLED
        assert not o.is_active

    def test_to_dict(self):
        o = Order(order_id="ORD005", side=OrderSide.BUY, order_type=OrderType.STOP_LIMIT,
                   quantity=50, price=200.0, stop_price=195.0, symbol="AMZN")
        d = o.to_dict()
        assert d["order_id"] == "ORD005"
        assert d["side"] == "buy"
        assert d["type"] == "stop_limit"
        assert d["price"] == 200.0


# ═══════════════════════════════════════════════════════════════════════
# SlippageCalculator
# ═══════════════════════════════════════════════════════════════════════

class TestSlippageCalculator:
    def test_none_slippage(self):
        s = SlippageCalculator.calculate(SlippageModel.NONE, 100.0, 100, 1000000)
        assert s == 0.0

    def test_fixed_slippage(self):
        s = SlippageCalculator.calculate(SlippageModel.FIXED, 100.0, 100, 1000000)
        assert isinstance(s, float)
        assert s > 0

    def test_proportional_slippage(self):
        s_small = SlippageCalculator.calculate(SlippageModel.PROPORTIONAL, 100.0, 100, 1000000)
        s_large = SlippageCalculator.calculate(SlippageModel.PROPORTIONAL, 100.0, 50000, 1000000)
        assert s_large > s_small

    def test_sqrt_slippage(self):
        s = SlippageCalculator.calculate(SlippageModel.SQUARE_ROOT, 100.0, 500, 1000000, volatility=0.30)
        assert s > 0

    def test_volume_based(self):
        s = SlippageCalculator.calculate(SlippageModel.VOLUME_BASED, 100.0, 5000, 1000000)
        assert s >= 0

    def test_zero_volume(self):
        s = SlippageCalculator.calculate(SlippageModel.PROPORTIONAL, 100.0, 100, 0)
        assert isinstance(s, float)

    @pytest.mark.parametrize("model", list(SlippageModel))
    def test_all_models_non_negative(self, model):
        s = SlippageCalculator.calculate(model, 100.0, 1000, 1000000, volatility=0.25)
        assert s >= 0


# ═══════════════════════════════════════════════════════════════════════
# FillProbabilityEngine
# ═══════════════════════════════════════════════════════════════════════

class TestFillProbabilityEngine:
    def test_aggressive_buy(self):
        p = FillProbabilityEngine.limit_fill_probability(
            limit_price=100.10, mid_price=100.0, spread=0.10,
            side=OrderSide.BUY
        )
        assert p > 0.5

    def test_passive_buy(self):
        p = FillProbabilityEngine.limit_fill_probability(
            limit_price=99.50, mid_price=100.0, spread=0.10,
            side=OrderSide.BUY
        )
        assert p < 0.9

    def test_aggressive_sell(self):
        p = FillProbabilityEngine.limit_fill_probability(
            limit_price=99.90, mid_price=100.0, spread=0.10,
            side=OrderSide.SELL
        )
        assert p > 0.5

    def test_probability_bounded(self):
        for lp in [90, 95, 100, 105, 110]:
            prob = FillProbabilityEngine.limit_fill_probability(
                lp, 100.0, 0.10, OrderSide.BUY
            )
            assert 0 <= prob <= 1.0


# ═══════════════════════════════════════════════════════════════════════
# TWAPCalculator
# ═══════════════════════════════════════════════════════════════════════

class TestTWAPCalculator:
    def test_equal_split(self):
        slices = TWAPCalculator.split_order(1000, 10, randomize=False)
        assert len(slices) == 10
        assert all(s["quantity"] == 100 for s in slices)
        total = sum(s["quantity"] for s in slices)
        assert total == 1000

    def test_randomized_split(self):
        slices = TWAPCalculator.split_order(1000, 10, randomize=True, seed=42)
        assert len(slices) == 10
        total = sum(s["quantity"] for s in slices)
        assert total == 1000

    def test_single_slice(self):
        slices = TWAPCalculator.split_order(500, 1)
        assert len(slices) == 1
        assert slices[0]["quantity"] == 500

    def test_zero_quantity(self):
        slices = TWAPCalculator.split_order(0, 5)
        # Engine returns empty for 0 qty
        assert isinstance(slices, list)


# ═══════════════════════════════════════════════════════════════════════
# VWAPCalculator
# ═══════════════════════════════════════════════════════════════════════

class TestVWAPCalculator:
    def test_basic_vwap(self):
        trades = [
            {"price": 100.0, "volume": 1000},
            {"price": 100.5, "volume": 2000},
            {"price": 101.0, "volume": 500},
        ]
        vwap = VWAPCalculator.calculate_vwap(trades)
        expected = (100*1000 + 100.5*2000 + 101*500) / 3500
        assert abs(vwap - expected) < 0.001

    def test_empty_trades(self):
        assert VWAPCalculator.calculate_vwap([]) == 0.0

    def test_volume_profile_split(self):
        profile = [0.08, 0.12, 0.15, 0.10, 0.10, 0.10, 0.10, 0.10, 0.08, 0.07]
        slices = VWAPCalculator.volume_profile_split(10000, profile)
        assert len(slices) == 10
        total = sum(s["quantity"] for s in slices)
        assert abs(total - 10000) < 5  # rounding tolerance


# ═══════════════════════════════════════════════════════════════════════
# IcebergOrderManager
# ═══════════════════════════════════════════════════════════════════════

class TestIcebergOrderManager:
    def test_create_iceberg(self):
        ice = IcebergOrderManager.create_iceberg(10000, 500)
        assert ice["total"] == 10000
        assert ice["display"] == 500
        assert ice["n_slices"] == 20

    def test_small_iceberg(self):
        ice = IcebergOrderManager.create_iceberg(100, 100)
        assert ice["n_slices"] == 1

    def test_uneven_split(self):
        ice = IcebergOrderManager.create_iceberg(1050, 500)
        assert ice["n_slices"] == 3  # 500+500+50


# ═══════════════════════════════════════════════════════════════════════
# TrailingStopManager
# ═══════════════════════════════════════════════════════════════════════

class TestTrailingStopManager:
    def test_buy_trailing_stop(self):
        # BUY side = short position, trail above price
        result = TrailingStopManager.update_trailing_stop(
            side=OrderSide.BUY,
            current_price=105.0,
            trail_amount=2.0,
        )
        assert result["trigger_price"] == 107.0
        assert result["triggered"] is False

    def test_sell_trailing_stop(self):
        # SELL side = long position, trail below price
        result = TrailingStopManager.update_trailing_stop(
            side=OrderSide.SELL,
            current_price=95.0,
            trail_amount=3.0,
        )
        assert result["trigger_price"] == 92.0
        assert result["triggered"] is False

    def test_sell_triggered(self):
        # Long position, price dropped below trigger based on highest
        result = TrailingStopManager.update_trailing_stop(
            side=OrderSide.SELL,
            current_price=93.0,
            trail_amount=2.0,
            highest_price=105.0,
        )
        assert result["trigger_price"] == 103.0
        assert result["triggered"] is True

    @pytest.mark.parametrize("trail", [0.5, 1.0, 2.0, 5.0, 10.0])
    def test_various_trail_amounts(self, trail):
        result = TrailingStopManager.update_trailing_stop(
            OrderSide.BUY, 100.0, trail
        )
        assert result["trigger_price"] == 100.0 + trail


# ═══════════════════════════════════════════════════════════════════════
# SmartOrderRouter
# ═══════════════════════════════════════════════════════════════════════

class TestSmartOrderRouter:
    def test_evaluate_venues(self):
        venues = [
            {"name": "NYSE", "best_price": 100.05, "available_qty": 5000, "fee_bps": 3, "latency_ms": 2},
            {"name": "ARCA", "best_price": 100.03, "available_qty": 3000, "fee_bps": 2, "latency_ms": 1},
            {"name": "BATS", "best_price": 100.08, "available_qty": 8000, "fee_bps": 1, "latency_ms": 3},
        ]
        ranked = SmartOrderRouter.evaluate_venues(venues, 500, OrderSide.BUY)
        assert len(ranked) == 3

    def test_sell_routing(self):
        venues = [
            {"name": "V1", "best_price": 100.0, "available_qty": 5000, "fee_bps": 3, "latency_ms": 2},
            {"name": "V2", "best_price": 100.5, "available_qty": 3000, "fee_bps": 2, "latency_ms": 1},
        ]
        ranked = SmartOrderRouter.evaluate_venues(venues, 500, OrderSide.SELL)
        # For sell, higher price is better
        assert ranked[0]["name"] == "V2"

    def test_empty_venues(self):
        ranked = SmartOrderRouter.evaluate_venues([], 500, OrderSide.BUY)
        assert ranked == []


# ═══════════════════════════════════════════════════════════════════════
# OrderManager
# ═══════════════════════════════════════════════════════════════════════

class TestOrderManager:
    @pytest.fixture
    def mgr(self):
        return OrderManager()

    def test_create_order(self, mgr):
        o = mgr.create_order("AAPL", OrderSide.BUY, OrderType.MARKET, 100)
        assert o.status == OrderStatus.PENDING
        assert o.symbol == "AAPL"

    def test_create_limit_order(self, mgr):
        o = mgr.create_order("MSFT", OrderSide.SELL, OrderType.LIMIT, 50, price=350.0)
        assert o.price == 350.0

    def test_fill_order(self, mgr):
        o = mgr.create_order("GOOG", OrderSide.BUY, OrderType.MARKET, 200)
        filled = mgr.fill_order(o.order_id, 140.0, 200)
        assert filled.status == OrderStatus.FILLED
        assert filled.filled_qty == 200

    def test_partial_fill(self, mgr):
        o = mgr.create_order("AAPL", OrderSide.BUY, OrderType.MARKET, 500)
        partial = mgr.fill_order(o.order_id, 150.0, 200)
        assert partial.status == OrderStatus.PARTIALLY_FILLED
        assert partial.remaining_qty == 300

    def test_cancel_order(self, mgr):
        o = mgr.create_order("META", OrderSide.SELL, OrderType.LIMIT, 100, price=300.0)
        cancelled = mgr.cancel_order(o.order_id)
        assert cancelled.status == OrderStatus.CANCELLED

    def test_cannot_fill_cancelled(self, mgr):
        o = mgr.create_order("X", OrderSide.BUY, OrderType.MARKET, 50)
        mgr.cancel_order(o.order_id)
        result = mgr.fill_order(o.order_id, 10.0, 50)
        assert result is None

    def test_overfill_blocked(self, mgr):
        o = mgr.create_order("Y", OrderSide.BUY, OrderType.MARKET, 100)
        mgr.fill_order(o.order_id, 10.0, 100)
        result = mgr.fill_order(o.order_id, 10.0, 50)
        assert result is None

    def test_multiple_orders(self, mgr):
        for i in range(10):
            mgr.create_order(f"SYM{i}", OrderSide.BUY, OrderType.MARKET, 100)
        assert len(mgr.all_orders) == 10

    def test_get_order(self, mgr):
        o = mgr.create_order("Z", OrderSide.BUY, OrderType.LIMIT, 100, price=50)
        fetched = mgr.get_order(o.order_id)
        assert fetched.order_id == o.order_id

    def test_open_orders(self, mgr):
        o1 = mgr.create_order("A", OrderSide.BUY, OrderType.MARKET, 100)
        o2 = mgr.create_order("B", OrderSide.BUY, OrderType.MARKET, 100)
        mgr.fill_order(o1.order_id, 10.0, 100)
        assert len(mgr.open_orders) == 1
        assert mgr.open_orders[0].order_id == o2.order_id


# ═══════════════════════════════════════════════════════════════════════
# TransactionCostAnalysis
# ═══════════════════════════════════════════════════════════════════════

class TestTransactionCostAnalysis:
    def test_implementation_shortfall(self):
        result = TransactionCostAnalysis.implementation_shortfall(
            decision_price=100.0,
            exec_price=100.50,
            side=OrderSide.BUY,
            quantity=1000,
        )
        assert result["shortfall_bps"] > 0  # paid more than decision
        assert result["shortfall"] > 0

    def test_implementation_shortfall_sell(self):
        result = TransactionCostAnalysis.implementation_shortfall(
            decision_price=100.0,
            exec_price=99.50,
            side=OrderSide.SELL,
            quantity=1000,
        )
        assert result["shortfall_bps"] > 0

    def test_zero_shortfall(self):
        result = TransactionCostAnalysis.implementation_shortfall(
            decision_price=100.0,
            exec_price=100.0,
            side=OrderSide.BUY,
            quantity=1000,
        )
        assert result["shortfall_bps"] == 0.0

    def test_market_impact(self):
        result = TransactionCostAnalysis.market_impact(
            pre_trade_price=100.0,
            exec_price=100.30,
            post_trade_price=100.20,
            side=OrderSide.BUY,
        )
        assert "permanent_bps" in result
        assert "temporary_bps" in result
        assert "total_bps" in result


# ═══════════════════════════════════════════════════════════════════════
# AdvancedOrderEngine Orchestrator
# ═══════════════════════════════════════════════════════════════════════

class TestAdvancedOrderEngine:
    @pytest.fixture
    def engine(self):
        return AdvancedOrderEngine()

    def test_submit_market_order(self, engine):
        o = engine.submit_order("AAPL", "buy", "market", 100)
        assert o["order_id"] is not None
        assert o["status"] == "pending"

    def test_submit_limit_order(self, engine):
        o = engine.submit_order("AAPL", "sell", "limit", 50, price=180.0)
        assert o["price"] == 180.0

    def test_cancel(self, engine):
        o = engine.submit_order("SPY", "buy", "limit", 100, price=450)
        c = engine.cancel(o["order_id"])
        assert c["status"] == "cancelled"

    def test_status(self, engine):
        engine.submit_order("A", "buy", "market", 100)
        engine.submit_order("B", "sell", "market", 200)
        s = engine.status()
        assert s["total_orders"] == 2

    def test_capabilities(self, engine):
        caps = engine.capabilities()
        assert caps["engine"] == "AdvancedOrderEngine"
        assert len(caps["features"]) > 5


# ═══════════════════════════════════════════════════════════════════════
# Parametric & Edge Cases
# ═══════════════════════════════════════════════════════════════════════

class TestParametricOrders:
    @pytest.mark.parametrize("otype", list(OrderType))
    def test_order_types_creation(self, otype):
        o = Order(
            order_id=f"TEST_{otype.value}",
            side=OrderSide.BUY,
            order_type=otype,
            quantity=100,
            price=100.0,
            symbol="TEST",
        )
        assert o.order_type == otype
        assert o.is_active

    @pytest.mark.parametrize("qty", [1, 10, 100, 1000, 10000])
    def test_twap_various_sizes(self, qty):
        slices = TWAPCalculator.split_order(qty, 5)
        assert sum(s["quantity"] for s in slices) == qty

    @pytest.mark.parametrize("n_slices", [1, 2, 5, 10, 50])
    def test_twap_various_slices(self, n_slices):
        slices = TWAPCalculator.split_order(1000, n_slices)
        assert len(slices) == n_slices
        assert sum(s["quantity"] for s in slices) == 1000

    @pytest.mark.parametrize("display", [100, 500, 1000, 2500])
    def test_iceberg_various_display(self, display):
        ice = IcebergOrderManager.create_iceberg(10000, display)
        assert ice["display"] == display
        assert ice["total"] == 10000


# ═══════════════════════════════════════════════════════════════════════
# Stress Tests
# ═══════════════════════════════════════════════════════════════════════

class TestStress:
    def test_many_orders(self):
        mgr = OrderManager()
        for i in range(1000):
            mgr.create_order(f"S{i}", OrderSide.BUY, OrderType.MARKET, 100)
        assert len(mgr.all_orders) == 1000

    def test_many_fills(self):
        mgr = OrderManager()
        orders = [mgr.create_order(f"S{i}", OrderSide.BUY, OrderType.MARKET, 10) for i in range(100)]
        for o in orders:
            mgr.fill_order(o.order_id, 50.0, 10)
        assert len(mgr.filled_orders) == 100

    def test_large_iceberg(self):
        ice = IcebergOrderManager.create_iceberg(1000000, 1000)
        assert ice["n_slices"] == 1000
