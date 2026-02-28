"""
Advanced Order Engine — Pure-Python order management and execution simulation.
Order types: market, limit, stop, stop-limit, trailing stop, iceberg, TWAP, VWAP.
Order book simulation, fill probability, slippage models, smart order routing.
No numpy/scipy dependency.
"""
from __future__ import annotations

import math
import random
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, List, Dict, Tuple


# ═══════════════════════════════════════════════════════════════════════
# Enums
# ═══════════════════════════════════════════════════════════════════════

class OrderSide(str, Enum):
    BUY = "buy"
    SELL = "sell"


class OrderType(str, Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"
    TRAILING_STOP = "trailing_stop"
    ICEBERG = "iceberg"
    TWAP = "twap"
    VWAP = "vwap"
    PEG = "peg"
    IOC = "ioc"              # immediate or cancel
    FOK = "fok"              # fill or kill
    GTC = "gtc"              # good til cancel
    MOO = "moo"              # market on open
    MOC = "moc"              # market on close


class OrderStatus(str, Enum):
    PENDING = "pending"
    OPEN = "open"
    PARTIALLY_FILLED = "partially_filled"
    FILLED = "filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"
    EXPIRED = "expired"


class FillModel(str, Enum):
    IMMEDIATE = "immediate"
    PROBABILISTIC = "probabilistic"
    BOOK_BASED = "book_based"


class SlippageModel(str, Enum):
    NONE = "none"
    FIXED = "fixed"
    PROPORTIONAL = "proportional"
    SQUARE_ROOT = "square_root"
    VOLUME_BASED = "volume_based"


# ═══════════════════════════════════════════════════════════════════════
# Data Classes
# ═══════════════════════════════════════════════════════════════════════

@dataclass
class OrderBookLevel:
    price: float
    quantity: int
    num_orders: int = 1

    @property
    def notional(self) -> float:
        return self.price * self.quantity


@dataclass
class OrderBook:
    symbol: str
    bids: list[OrderBookLevel] = field(default_factory=list)
    asks: list[OrderBookLevel] = field(default_factory=list)
    timestamp: float = 0.0

    @property
    def best_bid(self) -> float:
        return self.bids[0].price if self.bids else 0.0

    @property
    def best_ask(self) -> float:
        return self.asks[0].price if self.asks else 0.0

    @property
    def mid_price(self) -> float:
        if self.best_bid and self.best_ask:
            return (self.best_bid + self.best_ask) / 2
        return 0.0

    @property
    def spread(self) -> float:
        if self.best_bid and self.best_ask:
            return self.best_ask - self.best_bid
        return 0.0

    @property
    def spread_bps(self) -> float:
        mid = self.mid_price
        if mid == 0:
            return 0.0
        return round(self.spread / mid * 10000, 2)

    @property
    def total_bid_depth(self) -> int:
        return sum(l.quantity for l in self.bids)

    @property
    def total_ask_depth(self) -> int:
        return sum(l.quantity for l in self.asks)

    @property
    def bid_ask_imbalance(self) -> float:
        total = self.total_bid_depth + self.total_ask_depth
        if total == 0:
            return 0.0
        return round((self.total_bid_depth - self.total_ask_depth) / total, 4)


@dataclass
class Order:
    order_id: str
    symbol: str
    side: OrderSide
    order_type: OrderType
    quantity: int
    price: float = 0.0           # for limit/stop-limit
    stop_price: float = 0.0      # for stop/stop-limit
    trail_amount: float = 0.0    # for trailing stop
    trail_percent: float = 0.0   # for trailing stop
    display_qty: int = 0         # for iceberg (visible portion)
    time_in_force: str = "day"
    status: OrderStatus = OrderStatus.PENDING
    filled_qty: int = 0
    avg_fill_price: float = 0.0
    fills: list[dict] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    updated_at: float = 0.0
    slippage: float = 0.0

    @property
    def remaining_qty(self) -> int:
        return self.quantity - self.filled_qty

    @property
    def is_active(self) -> bool:
        return self.status in (OrderStatus.PENDING, OrderStatus.OPEN, OrderStatus.PARTIALLY_FILLED)

    @property
    def fill_percent(self) -> float:
        if self.quantity == 0:
            return 0.0
        return round(self.filled_qty / self.quantity * 100, 2)

    def to_dict(self) -> dict:
        return {
            "order_id": self.order_id,
            "symbol": self.symbol,
            "side": self.side.value,
            "type": self.order_type.value,
            "quantity": self.quantity,
            "price": self.price,
            "status": self.status.value,
            "filled_qty": self.filled_qty,
            "avg_fill_price": round(self.avg_fill_price, 4),
            "fill_percent": self.fill_percent,
            "slippage": round(self.slippage, 6),
        }


@dataclass
class ExecutionReport:
    order_id: str
    fill_price: float
    fill_qty: int
    slippage: float
    timestamp: float = field(default_factory=time.time)
    venue: str = "primary"


# ═══════════════════════════════════════════════════════════════════════
# Slippage Calculator
# ═══════════════════════════════════════════════════════════════════════

class SlippageCalculator:
    """Calculate execution slippage based on model."""

    @staticmethod
    def calculate(
        model: SlippageModel,
        mid_price: float,
        order_qty: int,
        average_volume: int = 1000000,
        fixed_bps: float = 1.0,
        volatility: float = 0.02,
    ) -> float:
        """Return slippage as a fraction of mid price (e.g. 0.001 = 10 bps)."""
        if model == SlippageModel.NONE:
            return 0.0

        if model == SlippageModel.FIXED:
            return fixed_bps / 10000

        if model == SlippageModel.PROPORTIONAL:
            participation = order_qty / max(average_volume, 1)
            return min(participation * 0.1, 0.05)  # cap at 5%

        if model == SlippageModel.SQUARE_ROOT:
            participation = order_qty / max(average_volume, 1)
            return min(volatility * math.sqrt(participation), 0.05)

        if model == SlippageModel.VOLUME_BASED:
            participation = order_qty / max(average_volume, 1)
            if participation < 0.01:
                return 0.0001
            elif participation < 0.05:
                return 0.0005
            elif participation < 0.10:
                return 0.002
            else:
                return min(0.01 * participation, 0.05)

        return 0.0


# ═══════════════════════════════════════════════════════════════════════
# Fill Probability Engine
# ═══════════════════════════════════════════════════════════════════════

class FillProbabilityEngine:
    """Estimate fill probability for limit orders."""

    @staticmethod
    def limit_fill_probability(
        limit_price: float,
        mid_price: float,
        spread: float,
        side: OrderSide,
        volatility: float = 0.02,
        time_remaining_hours: float = 6.5,
    ) -> float:
        """Probability that a limit order gets filled within the time window."""
        if spread <= 0 or mid_price <= 0:
            return 0.0

        if side == OrderSide.BUY:
            distance = mid_price - limit_price
        else:
            distance = limit_price - mid_price

        if distance <= 0:
            # Price already favorable
            return min(1.0, 0.95 + 0.05 * abs(distance) / mid_price)

        # Model using simplified brownian motion
        distance_sigma = distance / (mid_price * volatility * math.sqrt(time_remaining_hours / 252))
        # Approximate CDF of normal at distance_sigma
        prob = 1.0 / (1.0 + math.exp(-1.7 * (1.0 - distance_sigma)))
        return round(max(0.0, min(1.0, prob)), 4)

    @staticmethod
    def stop_trigger_probability(
        stop_price: float,
        current_price: float,
        volatility: float = 0.02,
        time_hours: float = 6.5,
    ) -> float:
        """Probability a stop order gets triggered."""
        if current_price <= 0:
            return 0.0
        distance = abs(stop_price - current_price) / current_price
        daily_vol = volatility / math.sqrt(252)
        hourly_vol = daily_vol / math.sqrt(6.5)
        distance_sigma = distance / (hourly_vol * math.sqrt(time_hours))

        prob = math.exp(-0.5 * distance_sigma * distance_sigma)
        return round(max(0.0, min(1.0, prob)), 4)


# ═══════════════════════════════════════════════════════════════════════
# TWAP Calculator
# ═══════════════════════════════════════════════════════════════════════

class TWAPCalculator:
    """Time-Weighted Average Price order splitting."""

    @staticmethod
    def split_order(
        total_qty: int,
        n_slices: int = 10,
        randomize: bool = False,
        seed: int = 42,
    ) -> list[dict]:
        """Split order into equal time slices."""
        if n_slices <= 0 or total_qty <= 0:
            return []

        base_qty = total_qty // n_slices
        remainder = total_qty % n_slices

        slices = []
        for i in range(n_slices):
            qty = base_qty + (1 if i < remainder else 0)
            slices.append({
                "slice": i + 1,
                "quantity": qty,
                "time_fraction": round((i + 1) / n_slices, 4),
            })

        if randomize:
            rng = random.Random(seed)
            # Randomize quantities while preserving total
            for i in range(len(slices)):
                j = rng.randint(0, len(slices) - 1)
                slices[i]["quantity"], slices[j]["quantity"] = \
                    slices[j]["quantity"], slices[i]["quantity"]

        return slices

    @staticmethod
    def calculate_twap(executions: list[dict]) -> float:
        """Calculate TWAP from execution reports."""
        if not executions:
            return 0.0
        total_price = sum(e.get("price", 0) for e in executions)
        return round(total_price / len(executions), 4)


# ═══════════════════════════════════════════════════════════════════════
# VWAP Calculator
# ═══════════════════════════════════════════════════════════════════════

class VWAPCalculator:
    """Volume-Weighted Average Price calculation and targeting."""

    @staticmethod
    def calculate_vwap(trades: list[dict]) -> float:
        """VWAP from list of {"price": float, "volume": int}."""
        total_pv = sum(t["price"] * t["volume"] for t in trades)
        total_vol = sum(t["volume"] for t in trades)
        if total_vol == 0:
            return 0.0
        return round(total_pv / total_vol, 4)

    @staticmethod
    def volume_profile_split(
        total_qty: int,
        volume_profile: list[float],
    ) -> list[dict]:
        """Split order according to historical volume profile."""
        if not volume_profile or total_qty <= 0:
            return []

        total_profile = sum(volume_profile)
        if total_profile == 0:
            return []

        slices = []
        remaining = total_qty
        for i, vol_frac in enumerate(volume_profile):
            if i == len(volume_profile) - 1:
                qty = remaining
            else:
                qty = round(total_qty * vol_frac / total_profile)
                qty = min(qty, remaining)
            remaining -= qty
            slices.append({
                "slice": i + 1,
                "quantity": max(qty, 0),
                "volume_weight": round(vol_frac / total_profile, 4),
            })
        return slices

    @staticmethod
    def vwap_benchmark(
        exec_vwap: float,
        market_vwap: float,
    ) -> dict:
        """Compare execution VWAP to market VWAP."""
        if market_vwap == 0:
            return {"slippage_bps": 0, "beat_vwap": False}
        slip = (exec_vwap - market_vwap) / market_vwap * 10000
        return {
            "exec_vwap": round(exec_vwap, 4),
            "market_vwap": round(market_vwap, 4),
            "slippage_bps": round(slip, 2),
            "beat_vwap": slip < 0,
        }


# ═══════════════════════════════════════════════════════════════════════
# Iceberg Order Manager
# ═══════════════════════════════════════════════════════════════════════

class IcebergOrderManager:
    """Manage iceberg orders with hidden quantity."""

    @staticmethod
    def create_iceberg(
        total_qty: int,
        display_qty: int,
    ) -> dict:
        if display_qty <= 0 or total_qty <= 0:
            return {"slices": [], "total": 0, "display": 0}

        n_slices = math.ceil(total_qty / display_qty)
        slices = []
        remaining = total_qty
        for i in range(n_slices):
            qty = min(display_qty, remaining)
            slices.append({
                "slice": i + 1,
                "visible_qty": qty,
                "hidden_remaining": remaining - qty,
            })
            remaining -= qty

        return {
            "slices": slices,
            "total": total_qty,
            "display": display_qty,
            "n_slices": n_slices,
        }


# ═══════════════════════════════════════════════════════════════════════
# Trailing Stop Manager
# ═══════════════════════════════════════════════════════════════════════

class TrailingStopManager:
    """Manage trailing stop orders."""

    @staticmethod
    def update_trailing_stop(
        side: OrderSide,
        current_price: float,
        trail_amount: float = 0.0,
        trail_percent: float = 0.0,
        highest_price: float = 0.0,
        lowest_price: float = float('inf'),
    ) -> dict:
        """Update trailing stop trigger level."""
        if side == OrderSide.SELL:
            # Long position — trail below price
            new_highest = max(highest_price, current_price)
            if trail_percent > 0:
                trigger = new_highest * (1 - trail_percent / 100)
            else:
                trigger = new_highest - trail_amount
            triggered = current_price <= trigger
            return {
                "trigger_price": round(trigger, 4),
                "highest_price": round(new_highest, 4),
                "current_price": round(current_price, 4),
                "triggered": triggered,
                "distance": round(current_price - trigger, 4),
            }
        else:
            # Short position — trail above price
            new_lowest = min(lowest_price, current_price)
            if trail_percent > 0:
                trigger = new_lowest * (1 + trail_percent / 100)
            else:
                trigger = new_lowest + trail_amount
            triggered = current_price >= trigger
            return {
                "trigger_price": round(trigger, 4),
                "lowest_price": round(new_lowest, 4),
                "current_price": round(current_price, 4),
                "triggered": triggered,
                "distance": round(trigger - current_price, 4),
            }


# ═══════════════════════════════════════════════════════════════════════
# Smart Order Router
# ═══════════════════════════════════════════════════════════════════════

class SmartOrderRouter:
    """Route orders across multiple venues for best execution."""

    @staticmethod
    def evaluate_venues(
        venues: list[dict],
        order_qty: int,
        side: OrderSide,
    ) -> list[dict]:
        """
        venues: list of {"name": str, "best_price": float, "available_qty": int,
                         "fee_bps": float, "latency_ms": float}
        Returns ranked venues with allocation.
        """
        if not venues:
            return []

        # Score each venue
        scored = []
        for v in venues:
            price_score = v["best_price"] if side == OrderSide.SELL else -v["best_price"]
            qty_score = min(v["available_qty"] / max(order_qty, 1), 1.0) * 10
            fee_score = -v.get("fee_bps", 0) / 10
            latency_score = -v.get("latency_ms", 0) / 100
            total = price_score + qty_score + fee_score + latency_score
            scored.append({
                **v,
                "score": round(total, 4),
            })

        scored.sort(key=lambda x: x["score"], reverse=True)

        # Allocate quantities
        remaining = order_qty
        for v in scored:
            alloc = min(v["available_qty"], remaining)
            v["allocated_qty"] = alloc
            remaining -= alloc
            if remaining <= 0:
                break

        return scored

    @staticmethod
    def best_execution_report(
        fills: list[dict],
        side: OrderSide,
    ) -> dict:
        """Summarize execution quality across venues."""
        if not fills:
            return {"avg_price": 0, "total_qty": 0, "venues_used": 0}

        total_qty = sum(f.get("qty", 0) for f in fills)
        total_cost = sum(f.get("price", 0) * f.get("qty", 0) for f in fills)
        avg_price = total_cost / total_qty if total_qty > 0 else 0
        venues = len(set(f.get("venue", "") for f in fills))
        total_fees = sum(f.get("fee", 0) for f in fills)

        return {
            "avg_price": round(avg_price, 4),
            "total_qty": total_qty,
            "venues_used": venues,
            "total_fees": round(total_fees, 4),
            "total_cost": round(total_cost, 2),
        }


# ═══════════════════════════════════════════════════════════════════════
# Order Manager
# ═══════════════════════════════════════════════════════════════════════

class OrderManager:
    """Manage order lifecycle."""

    def __init__(self):
        self._orders: dict[str, Order] = {}
        self._next_id = 1

    def create_order(
        self,
        symbol: str,
        side: OrderSide,
        order_type: OrderType,
        quantity: int,
        price: float = 0.0,
        stop_price: float = 0.0,
        trail_amount: float = 0.0,
        trail_percent: float = 0.0,
        display_qty: int = 0,
    ) -> Order:
        order_id = f"ORD-{self._next_id:06d}"
        self._next_id += 1

        order = Order(
            order_id=order_id,
            symbol=symbol,
            side=side,
            order_type=order_type,
            quantity=quantity,
            price=price,
            stop_price=stop_price,
            trail_amount=trail_amount,
            trail_percent=trail_percent,
            display_qty=display_qty,
        )
        self._orders[order_id] = order
        return order

    def fill_order(self, order_id: str, fill_price: float, fill_qty: int) -> Order | None:
        order = self._orders.get(order_id)
        if not order or not order.is_active:
            return None

        actual_fill = min(fill_qty, order.remaining_qty)
        if actual_fill <= 0:
            return order

        # Update average fill price
        total_filled_value = order.avg_fill_price * order.filled_qty + fill_price * actual_fill
        order.filled_qty += actual_fill
        order.avg_fill_price = round(total_filled_value / order.filled_qty, 6)

        order.fills.append({
            "price": fill_price,
            "qty": actual_fill,
            "timestamp": time.time(),
        })

        if order.remaining_qty == 0:
            order.status = OrderStatus.FILLED
        else:
            order.status = OrderStatus.PARTIALLY_FILLED

        order.updated_at = time.time()
        return order

    def cancel_order(self, order_id: str) -> Order | None:
        order = self._orders.get(order_id)
        if not order or not order.is_active:
            return None
        order.status = OrderStatus.CANCELLED
        order.updated_at = time.time()
        return order

    def get_order(self, order_id: str) -> Order | None:
        return self._orders.get(order_id)

    @property
    def open_orders(self) -> list[Order]:
        return [o for o in self._orders.values() if o.is_active]

    @property
    def filled_orders(self) -> list[Order]:
        return [o for o in self._orders.values() if o.status == OrderStatus.FILLED]

    @property
    def all_orders(self) -> list[Order]:
        return list(self._orders.values())

    def summary(self) -> dict:
        return {
            "total_orders": len(self._orders),
            "open": len(self.open_orders),
            "filled": len(self.filled_orders),
            "cancelled": len([o for o in self._orders.values() if o.status == OrderStatus.CANCELLED]),
        }


# ═══════════════════════════════════════════════════════════════════════
# Transaction Cost Analysis
# ═══════════════════════════════════════════════════════════════════════

class TransactionCostAnalysis:
    """TCA — analyze execution quality."""

    @staticmethod
    def implementation_shortfall(
        decision_price: float,
        exec_price: float,
        side: OrderSide,
        quantity: int,
    ) -> dict:
        """Implementation shortfall (arrival price benchmark)."""
        if side == OrderSide.BUY:
            shortfall = (exec_price - decision_price) * quantity
        else:
            shortfall = (decision_price - exec_price) * quantity

        shortfall_bps = 0
        if decision_price > 0:
            shortfall_bps = (exec_price - decision_price) / decision_price * 10000
            if side == OrderSide.SELL:
                shortfall_bps = -shortfall_bps

        return {
            "shortfall": round(shortfall, 2),
            "shortfall_bps": round(shortfall_bps, 2),
            "decision_price": round(decision_price, 4),
            "exec_price": round(exec_price, 4),
        }

    @staticmethod
    def market_impact(
        pre_trade_price: float,
        exec_price: float,
        post_trade_price: float,
        side: OrderSide,
    ) -> dict:
        """Decompose market impact into temporary and permanent."""
        if pre_trade_price == 0:
            return {"temporary": 0, "permanent": 0, "total": 0}

        sign = 1 if side == OrderSide.BUY else -1
        total_impact = sign * (exec_price - pre_trade_price) / pre_trade_price * 10000
        permanent_impact = sign * (post_trade_price - pre_trade_price) / pre_trade_price * 10000
        temporary_impact = total_impact - permanent_impact

        return {
            "temporary_bps": round(temporary_impact, 2),
            "permanent_bps": round(permanent_impact, 2),
            "total_bps": round(total_impact, 2),
        }


# ═══════════════════════════════════════════════════════════════════════
# Orchestrator
# ═══════════════════════════════════════════════════════════════════════

class AdvancedOrderEngine:
    """Top-level order management engine."""

    def __init__(self):
        self.order_manager = OrderManager()
        self.slippage = SlippageCalculator()
        self.fill_prob = FillProbabilityEngine()
        self.twap = TWAPCalculator()
        self.vwap = VWAPCalculator()
        self.iceberg = IcebergOrderManager()
        self.trailing = TrailingStopManager()
        self.router = SmartOrderRouter()
        self.tca = TransactionCostAnalysis()

    def submit_order(
        self,
        symbol: str,
        side: str,
        order_type: str,
        quantity: int,
        **kwargs,
    ) -> dict:
        order = self.order_manager.create_order(
            symbol=symbol,
            side=OrderSide(side),
            order_type=OrderType(order_type),
            quantity=quantity,
            price=kwargs.get("price", 0.0),
            stop_price=kwargs.get("stop_price", 0.0),
            trail_amount=kwargs.get("trail_amount", 0.0),
            trail_percent=kwargs.get("trail_percent", 0.0),
            display_qty=kwargs.get("display_qty", 0),
        )
        return order.to_dict()

    def cancel(self, order_id: str) -> dict:
        order = self.order_manager.cancel_order(order_id)
        if order:
            return order.to_dict()
        return {"error": "order not found or not active"}

    def status(self) -> dict:
        return self.order_manager.summary()

    def capabilities(self) -> dict:
        return {
            "engine": "AdvancedOrderEngine",
            "version": "1.0.0",
            "order_types": [t.value for t in OrderType],
            "features": [
                "market_limit_stop_orders",
                "trailing_stop_management",
                "iceberg_order_splitting",
                "twap_time_slicing",
                "vwap_volume_profiling",
                "smart_order_routing",
                "fill_probability_estimation",
                "slippage_models",
                "transaction_cost_analysis",
                "implementation_shortfall",
                "market_impact_decomposition",
                "order_lifecycle_management",
            ],
        }
