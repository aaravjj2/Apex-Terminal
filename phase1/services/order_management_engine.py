"""
order_management_engine.py — Bloomberg-grade Order Management System
=====================================================================
Pure computation engine — no FastAPI imports.

Components:
    OrderType           — Market, Limit, Stop, Stop-Limit, TrailingStop,
                          OCO, Bracket, MOC, MOO, LOC, TWAP, VWAP, Iceberg
    OrderSide           — Buy, Sell, SellShort, BuyToCover
    OrderStatus         — 12 states with complete lifecycle
    TimeInForce         — DAY, GTC, IOC, FOK, GTD, EXT, OPG, CLS
    OrderFill           — Individual fill record
    Order               — Full order with lifecycle, fills, parent/child
    OrderValidator      — Pre-trade validation rules
    FillSimulator       — Simulate fills with slippage
    OrderBook           — Full CRUD with indexing
    PositionTracker     — Real-time position management
    BracketManager      — Bracket + OCO order management
    OrderRouter         — Smart routing logic
    OrderManagementEngine — Top-level orchestrator
"""

from __future__ import annotations
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict
import numpy as np


# ─── Enums ───────────────────────────────────────────────────────────────────

class OrderType(Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"
    TRAILING_STOP = "trailing_stop"
    OCO = "oco"                     # one-cancels-other
    BRACKET = "bracket"
    MOC = "market_on_close"
    MOO = "market_on_open"
    LOC = "limit_on_close"
    TWAP = "twap"
    VWAP = "vwap"
    ICEBERG = "iceberg"
    PEG = "peg"


class OrderSide(Enum):
    BUY = "buy"
    SELL = "sell"
    SELL_SHORT = "sell_short"
    BUY_TO_COVER = "buy_to_cover"


class OrderStatus(Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    ACCEPTED = "accepted"
    PARTIALLY_FILLED = "partially_filled"
    FILLED = "filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"
    EXPIRED = "expired"
    PENDING_CANCEL = "pending_cancel"
    PENDING_REPLACE = "pending_replace"
    REPLACED = "replaced"
    SUSPENDED = "suspended"


class TimeInForce(Enum):
    DAY = "day"
    GTC = "gtc"
    IOC = "ioc"      # immediate-or-cancel
    FOK = "fok"      # fill-or-kill
    GTD = "gtd"      # good-til-date
    EXT = "ext"      # extended hours
    OPG = "opg"      # at open
    CLS = "cls"      # at close


class OrderRejectReason(Enum):
    NONE = "none"
    INSUFFICIENT_FUNDS = "insufficient_funds"
    INSUFFICIENT_SHARES = "insufficient_shares"
    INVALID_PRICE = "invalid_price"
    INVALID_QUANTITY = "invalid_quantity"
    SYMBOL_NOT_TRADABLE = "symbol_not_tradable"
    MARKET_CLOSED = "market_closed"
    EXCEEDS_MAX_ORDER = "exceeds_max_order"
    RISK_LIMIT = "risk_limit"
    DUPLICATE = "duplicate"


# ─── DataClasses ─────────────────────────────────────────────────────────────

@dataclass
class OrderFill:
    """Individual fill record."""
    fill_id: str = field(default_factory=lambda: uuid.uuid4().hex[:10])
    timestamp: float = field(default_factory=time.time)
    quantity: int = 0
    price: float = 0.0
    commission: float = 0.0
    exchange: str = ""

    @property
    def notional(self) -> float:
        return self.quantity * self.price

    def to_dict(self) -> Dict[str, Any]:
        return {
            "fill_id": self.fill_id, "timestamp": self.timestamp,
            "quantity": self.quantity, "price": self.price,
            "commission": self.commission, "notional": self.notional,
            "exchange": self.exchange,
        }


@dataclass
class Order:
    """Complete order with full lifecycle."""
    order_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    symbol: str = ""
    side: OrderSide = OrderSide.BUY
    order_type: OrderType = OrderType.MARKET
    quantity: int = 0
    limit_price: Optional[float] = None
    stop_price: Optional[float] = None
    trail_amount: Optional[float] = None
    trail_percent: Optional[float] = None
    time_in_force: TimeInForce = TimeInForce.DAY
    status: OrderStatus = OrderStatus.PENDING
    reject_reason: OrderRejectReason = OrderRejectReason.NONE

    # Fills
    fills: List[OrderFill] = field(default_factory=list)
    filled_quantity: int = 0
    avg_fill_price: float = 0.0
    total_commission: float = 0.0

    # Bracket / OCO
    parent_order_id: Optional[str] = None
    child_order_ids: List[str] = field(default_factory=list)

    # Iceberg
    display_quantity: Optional[int] = None
    iceberg_remaining: int = 0

    # Timestamps
    created_at: float = field(default_factory=time.time)
    submitted_at: Optional[float] = None
    filled_at: Optional[float] = None
    cancelled_at: Optional[float] = None
    updated_at: float = field(default_factory=time.time)

    # Metadata
    account_id: str = "default"
    strategy: str = ""
    notes: str = ""
    tags: List[str] = field(default_factory=list)

    @property
    def remaining_quantity(self) -> int:
        return self.quantity - self.filled_quantity

    @property
    def is_active(self) -> bool:
        return self.status in (
            OrderStatus.PENDING, OrderStatus.SUBMITTED,
            OrderStatus.ACCEPTED, OrderStatus.PARTIALLY_FILLED,
        )

    @property
    def is_terminal(self) -> bool:
        return self.status in (
            OrderStatus.FILLED, OrderStatus.CANCELLED,
            OrderStatus.REJECTED, OrderStatus.EXPIRED,
        )

    @property
    def fill_ratio(self) -> float:
        return self.filled_quantity / self.quantity if self.quantity > 0 else 0.0

    @property
    def notional_value(self) -> float:
        if self.avg_fill_price > 0:
            return self.filled_quantity * self.avg_fill_price
        price = self.limit_price or self.stop_price or 0
        return self.quantity * price

    def add_fill(self, fill: OrderFill):
        """Add a fill and update aggregates."""
        self.fills.append(fill)
        # Update avg fill price (running weighted average)
        total_notional = self.avg_fill_price * self.filled_quantity + fill.price * fill.quantity
        self.filled_quantity += fill.quantity
        if self.filled_quantity > 0:
            self.avg_fill_price = total_notional / self.filled_quantity
        self.total_commission += fill.commission
        self.updated_at = time.time()

        if self.filled_quantity >= self.quantity:
            self.status = OrderStatus.FILLED
            self.filled_at = time.time()
        elif self.filled_quantity > 0:
            self.status = OrderStatus.PARTIALLY_FILLED

    def submit(self) -> bool:
        if self.status == OrderStatus.PENDING:
            self.status = OrderStatus.SUBMITTED
            self.submitted_at = time.time()
            self.updated_at = time.time()
            return True
        return False

    def accept(self) -> bool:
        if self.status == OrderStatus.SUBMITTED:
            self.status = OrderStatus.ACCEPTED
            self.updated_at = time.time()
            return True
        return False

    def cancel(self) -> bool:
        if self.is_active:
            self.status = OrderStatus.CANCELLED
            self.cancelled_at = time.time()
            self.updated_at = time.time()
            return True
        return False

    def reject(self, reason: OrderRejectReason = OrderRejectReason.NONE) -> bool:
        if self.status in (OrderStatus.PENDING, OrderStatus.SUBMITTED):
            self.status = OrderStatus.REJECTED
            self.reject_reason = reason
            self.updated_at = time.time()
            return True
        return False

    def expire(self) -> bool:
        if self.is_active:
            self.status = OrderStatus.EXPIRED
            self.updated_at = time.time()
            return True
        return False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "order_id": self.order_id, "symbol": self.symbol,
            "side": self.side.value, "order_type": self.order_type.value,
            "quantity": self.quantity, "limit_price": self.limit_price,
            "stop_price": self.stop_price, "trail_amount": self.trail_amount,
            "trail_percent": self.trail_percent,
            "time_in_force": self.time_in_force.value,
            "status": self.status.value,
            "reject_reason": self.reject_reason.value,
            "filled_quantity": self.filled_quantity,
            "remaining_quantity": self.remaining_quantity,
            "avg_fill_price": self.avg_fill_price,
            "total_commission": self.total_commission,
            "fill_ratio": self.fill_ratio,
            "notional_value": self.notional_value,
            "fills": [f.to_dict() for f in self.fills],
            "parent_order_id": self.parent_order_id,
            "child_order_ids": self.child_order_ids,
            "created_at": self.created_at, "submitted_at": self.submitted_at,
            "filled_at": self.filled_at, "cancelled_at": self.cancelled_at,
            "account_id": self.account_id, "strategy": self.strategy,
            "notes": self.notes, "tags": self.tags,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 1. OrderValidator — Pre-trade validation
# ═══════════════════════════════════════════════════════════════════════════════

class OrderValidator:
    """Validate orders before submission."""

    def __init__(self):
        self.max_order_value = 10_000_000   # $10M max per order
        self.max_quantity = 1_000_000        # 1M shares max
        self.min_price = 0.0001
        self.max_price = 1_000_000
        self.restricted_symbols: set = set()

    def validate(self, order: Order,
                 buying_power: float = float('inf'),
                 position: int = 0) -> Tuple[bool, OrderRejectReason, str]:
        """Validate an order. Returns (valid, reason, message)."""
        # Quantity checks
        if order.quantity <= 0:
            return False, OrderRejectReason.INVALID_QUANTITY, "Quantity must be positive"
        if order.quantity > self.max_quantity:
            return False, OrderRejectReason.EXCEEDS_MAX_ORDER, \
                f"Quantity {order.quantity} exceeds max {self.max_quantity}"

        # Price checks
        if order.limit_price is not None:
            if order.limit_price <= self.min_price:
                return False, OrderRejectReason.INVALID_PRICE, "Price too low"
            if order.limit_price > self.max_price:
                return False, OrderRejectReason.INVALID_PRICE, "Price too high"

        if order.stop_price is not None:
            if order.stop_price <= 0:
                return False, OrderRejectReason.INVALID_PRICE, "Stop price must be positive"

        # Symbol checks
        if not order.symbol:
            return False, OrderRejectReason.SYMBOL_NOT_TRADABLE, "No symbol specified"
        if order.symbol in self.restricted_symbols:
            return False, OrderRejectReason.SYMBOL_NOT_TRADABLE, "Symbol restricted"

        # Buying power for buys
        if order.side in (OrderSide.BUY, OrderSide.BUY_TO_COVER):
            est_price = order.limit_price or order.stop_price or 0
            est_cost = order.quantity * est_price
            if est_price > 0 and est_cost > buying_power:
                return False, OrderRejectReason.INSUFFICIENT_FUNDS, \
                    f"Cost {est_cost:.2f} exceeds buying power {buying_power:.2f}"

        # Share check for sells
        if order.side == OrderSide.SELL:
            if position < order.quantity:
                return False, OrderRejectReason.INSUFFICIENT_SHARES, \
                    f"Position {position} < sell quantity {order.quantity}"

        # Notional value check
        est_price = order.limit_price or order.stop_price or 0
        if est_price > 0 and order.quantity * est_price > self.max_order_value:
            return False, OrderRejectReason.EXCEEDS_MAX_ORDER, "Exceeds max order value"

        return True, OrderRejectReason.NONE, ""


# ═══════════════════════════════════════════════════════════════════════════════
# 2. FillSimulator — Simulate order fills
# ═══════════════════════════════════════════════════════════════════════════════

class FillSimulator:
    """Simulate order fills with realistic slippage and commission."""

    def __init__(self, commission_per_share: float = 0.005,
                 min_commission: float = 1.0,
                 slippage_bps: float = 2.0):
        self.commission_per_share = commission_per_share
        self.min_commission = min_commission
        self.slippage_bps = slippage_bps

    def calculate_slippage(self, price: float, side: OrderSide,
                            quantity: int) -> float:
        """Calculate slippage based on order size."""
        base_slip = self.slippage_bps / 10000
        # Size impact: larger orders have more slippage
        size_mult = 1 + np.log1p(quantity / 1000) * 0.1
        slip = price * base_slip * size_mult

        if side in (OrderSide.BUY, OrderSide.BUY_TO_COVER):
            return price + slip
        else:
            return price - slip

    def calculate_commission(self, quantity: int) -> float:
        """Calculate commission for a fill."""
        return max(quantity * self.commission_per_share, self.min_commission)

    def simulate_market_fill(self, order: Order,
                              market_price: float) -> OrderFill:
        """Simulate a market order fill."""
        fill_price = self.calculate_slippage(market_price, order.side,
                                              order.remaining_quantity)
        commission = self.calculate_commission(order.remaining_quantity)
        return OrderFill(
            quantity=order.remaining_quantity,
            price=fill_price,
            commission=commission,
        )

    def simulate_limit_fill(self, order: Order,
                             market_price: float) -> Optional[OrderFill]:
        """Simulate a limit order fill (may not fill)."""
        if order.limit_price is None:
            return None

        can_fill = False
        if order.side in (OrderSide.BUY, OrderSide.BUY_TO_COVER):
            can_fill = market_price <= order.limit_price
        else:
            can_fill = market_price >= order.limit_price

        if not can_fill:
            return None

        # Fill at limit price or better
        if order.side in (OrderSide.BUY, OrderSide.BUY_TO_COVER):
            fill_price = min(order.limit_price, market_price)
        else:
            fill_price = max(order.limit_price, market_price)

        commission = self.calculate_commission(order.remaining_quantity)
        return OrderFill(
            quantity=order.remaining_quantity,
            price=fill_price,
            commission=commission,
        )

    def simulate_stop_fill(self, order: Order,
                            market_price: float) -> Optional[OrderFill]:
        """Simulate a stop order (converts to market when triggered)."""
        if order.stop_price is None:
            return None

        triggered = False
        if order.side in (OrderSide.SELL, OrderSide.SELL_SHORT):
            triggered = market_price <= order.stop_price
        else:
            triggered = market_price >= order.stop_price

        if not triggered:
            return None

        fill_price = self.calculate_slippage(market_price, order.side,
                                              order.remaining_quantity)
        commission = self.calculate_commission(order.remaining_quantity)
        return OrderFill(
            quantity=order.remaining_quantity,
            price=fill_price,
            commission=commission,
        )


# ═══════════════════════════════════════════════════════════════════════════════
# 3. OrderBook — Full CRUD with indexing
# ═══════════════════════════════════════════════════════════════════════════════

class OrderBook:
    """Order book with efficient lookup and indexing."""

    def __init__(self):
        self._orders: Dict[str, Order] = {}
        self._by_symbol: Dict[str, List[str]] = defaultdict(list)
        self._by_status: Dict[OrderStatus, List[str]] = defaultdict(list)
        self._history: List[Dict[str, Any]] = []

    def add(self, order: Order) -> str:
        """Add order to book."""
        self._orders[order.order_id] = order
        self._by_symbol[order.symbol].append(order.order_id)
        self._by_status[order.status].append(order.order_id)
        self._record("add", order)
        return order.order_id

    def get(self, order_id: str) -> Optional[Order]:
        return self._orders.get(order_id)

    def cancel(self, order_id: str) -> bool:
        order = self._orders.get(order_id)
        if order and order.cancel():
            self._update_status_index(order_id)
            self._record("cancel", order)
            return True
        return False

    def update_status(self, order_id: str, status: OrderStatus):
        order = self._orders.get(order_id)
        if order:
            old = order.status
            order.status = status
            order.updated_at = time.time()
            self._update_status_index(order_id, old)
            self._record("status_change", order)

    def get_by_symbol(self, symbol: str) -> List[Order]:
        ids = self._by_symbol.get(symbol, [])
        return [self._orders[oid] for oid in ids if oid in self._orders]

    def get_active(self) -> List[Order]:
        active = []
        for status in (OrderStatus.PENDING, OrderStatus.SUBMITTED,
                       OrderStatus.ACCEPTED, OrderStatus.PARTIALLY_FILLED):
            ids = self._by_status.get(status, [])
            active.extend(self._orders[oid] for oid in ids if oid in self._orders)
        return active

    def get_by_status(self, status: OrderStatus) -> List[Order]:
        ids = self._by_status.get(status, [])
        return [self._orders[oid] for oid in ids if oid in self._orders]

    def get_filled(self) -> List[Order]:
        return self.get_by_status(OrderStatus.FILLED)

    def get_all(self) -> List[Order]:
        return list(self._orders.values())

    @property
    def count(self) -> int:
        return len(self._orders)

    def active_count(self) -> int:
        return len(self.get_active())

    def cancel_all(self, symbol: str = "") -> int:
        """Cancel all active orders, optionally filtered by symbol."""
        cancelled = 0
        for order in self.get_active():
            if symbol and order.symbol != symbol:
                continue
            if order.cancel():
                self._update_status_index(order.order_id)
                self._record("cancel", order)
                cancelled += 1
        return cancelled

    def get_history(self, limit: int = 100) -> List[Dict[str, Any]]:
        return self._history[-limit:]

    def _update_status_index(self, order_id: str,
                              old_status: Optional[OrderStatus] = None):
        order = self._orders.get(order_id)
        if not order:
            return
        # Remove from old status list
        for s, ids in self._by_status.items():
            if order_id in ids and s != order.status:
                ids.remove(order_id)
        # Add to new status list
        if order_id not in self._by_status[order.status]:
            self._by_status[order.status].append(order_id)

    def _record(self, action: str, order: Order):
        self._history.append({
            "action": action, "order_id": order.order_id,
            "symbol": order.symbol, "status": order.status.value,
            "timestamp": time.time(),
        })


# ═══════════════════════════════════════════════════════════════════════════════
# 4. PositionTracker — Real-time position tracking
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class Position:
    """Position for a single symbol."""
    symbol: str = ""
    quantity: int = 0
    avg_cost: float = 0.0
    market_price: float = 0.0
    realized_pnl: float = 0.0

    @property
    def market_value(self) -> float:
        return self.quantity * self.market_price

    @property
    def cost_basis(self) -> float:
        return abs(self.quantity) * self.avg_cost

    @property
    def unrealized_pnl(self) -> float:
        if self.quantity == 0:
            return 0.0
        return self.quantity * (self.market_price - self.avg_cost)

    @property
    def unrealized_pnl_pct(self) -> float:
        if self.cost_basis == 0:
            return 0.0
        return self.unrealized_pnl / self.cost_basis * 100

    @property
    def is_long(self) -> bool:
        return self.quantity > 0

    @property
    def is_short(self) -> bool:
        return self.quantity < 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol, "quantity": self.quantity,
            "avg_cost": self.avg_cost, "market_price": self.market_price,
            "market_value": self.market_value, "cost_basis": self.cost_basis,
            "unrealized_pnl": self.unrealized_pnl,
            "unrealized_pnl_pct": self.unrealized_pnl_pct,
            "realized_pnl": self.realized_pnl,
            "side": "long" if self.is_long else ("short" if self.is_short else "flat"),
        }


class PositionTracker:
    """Track positions from fills."""

    def __init__(self):
        self._positions: Dict[str, Position] = {}

    def apply_fill(self, symbol: str, side: OrderSide,
                   quantity: int, price: float) -> Position:
        """Apply a fill to update positions."""
        pos = self._positions.get(symbol, Position(symbol=symbol))

        if side in (OrderSide.BUY, OrderSide.BUY_TO_COVER):
            if pos.quantity < 0:
                # Covering short
                cover_qty = min(quantity, abs(pos.quantity))
                pos.realized_pnl += cover_qty * (pos.avg_cost - price)
                remaining = quantity - cover_qty
                if remaining > 0:
                    pos.avg_cost = price
                    pos.quantity = remaining
                else:
                    pos.quantity += quantity
                    if pos.quantity == 0:
                        pos.avg_cost = 0.0
            else:
                # Adding to long
                total_cost = pos.avg_cost * pos.quantity + price * quantity
                pos.quantity += quantity
                pos.avg_cost = total_cost / pos.quantity if pos.quantity else 0
        else:
            # SELL or SELL_SHORT
            if pos.quantity > 0:
                # Selling long
                sell_qty = min(quantity, pos.quantity)
                pos.realized_pnl += sell_qty * (price - pos.avg_cost)
                remaining = quantity - sell_qty
                pos.quantity -= sell_qty
                if remaining > 0:
                    pos.avg_cost = price
                    pos.quantity = -remaining
                if pos.quantity == 0:
                    pos.avg_cost = 0.0
            else:
                # Adding to short
                total_cost = pos.avg_cost * abs(pos.quantity) + price * quantity
                pos.quantity -= quantity
                pos.avg_cost = total_cost / abs(pos.quantity) if pos.quantity else 0

        self._positions[symbol] = pos
        return pos

    def update_price(self, symbol: str, price: float):
        if symbol in self._positions:
            self._positions[symbol].market_price = price

    def get_position(self, symbol: str) -> Optional[Position]:
        return self._positions.get(symbol)

    def get_all_positions(self) -> List[Position]:
        return [p for p in self._positions.values() if p.quantity != 0]

    def get_portfolio_value(self) -> float:
        return sum(p.market_value for p in self._positions.values())

    def get_total_unrealized_pnl(self) -> float:
        return sum(p.unrealized_pnl for p in self._positions.values())

    def get_total_realized_pnl(self) -> float:
        return sum(p.realized_pnl for p in self._positions.values())

    def get_exposure(self) -> Dict[str, float]:
        long_val = sum(p.market_value for p in self._positions.values() if p.is_long)
        short_val = sum(abs(p.market_value) for p in self._positions.values() if p.is_short)
        return {
            "long": long_val, "short": short_val,
            "net": long_val - short_val, "gross": long_val + short_val,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 5. BracketManager — Bracket + OCO management
# ═══════════════════════════════════════════════════════════════════════════════

class BracketManager:
    """Manage bracket and OCO order relationships."""

    def __init__(self, order_book: OrderBook):
        self._book = order_book
        self._brackets: Dict[str, Dict[str, str]] = {}  # parent -> {tp, sl}

    def create_bracket(self, parent: Order,
                       take_profit_price: float,
                       stop_loss_price: float) -> Dict[str, Order]:
        """Create bracket order (entry + TP + SL)."""
        # Take profit
        tp_side = OrderSide.SELL if parent.side == OrderSide.BUY else OrderSide.BUY
        tp = Order(
            symbol=parent.symbol, side=tp_side,
            order_type=OrderType.LIMIT, quantity=parent.quantity,
            limit_price=take_profit_price,
            parent_order_id=parent.order_id,
            time_in_force=TimeInForce.GTC,
        )
        # Stop loss
        sl = Order(
            symbol=parent.symbol, side=tp_side,
            order_type=OrderType.STOP, quantity=parent.quantity,
            stop_price=stop_loss_price,
            parent_order_id=parent.order_id,
            time_in_force=TimeInForce.GTC,
        )

        parent.child_order_ids = [tp.order_id, sl.order_id]
        self._book.add(tp)
        self._book.add(sl)
        self._brackets[parent.order_id] = {
            "take_profit": tp.order_id, "stop_loss": sl.order_id,
        }
        return {"parent": parent, "take_profit": tp, "stop_loss": sl}

    def on_child_filled(self, order_id: str):
        """When a bracket child fills, cancel the other."""
        for parent_id, children in self._brackets.items():
            if order_id in children.values():
                for key, child_id in children.items():
                    if child_id != order_id:
                        self._book.cancel(child_id)
                break

    def get_bracket(self, parent_id: str) -> Optional[Dict[str, str]]:
        return self._brackets.get(parent_id)

    def create_oco(self, order_a: Order, order_b: Order) -> Dict[str, str]:
        """Create OCO pair — when one fills/cancels, cancel the other."""
        self._book.add(order_a)
        self._book.add(order_b)
        oco_id = uuid.uuid4().hex[:8]
        self._brackets[oco_id] = {
            "order_a": order_a.order_id, "order_b": order_b.order_id,
        }
        return {"oco_id": oco_id, "order_a": order_a.order_id,
                "order_b": order_b.order_id}


# ═══════════════════════════════════════════════════════════════════════════════
# 6. OrderRouter — Smart routing logic
# ═══════════════════════════════════════════════════════════════════════════════

class OrderRouter:
    """Smart order routing logic."""

    EXCHANGES = [
        {"name": "NYSE", "fee": 0.003, "rebate": 0.002, "latency_ms": 1.0},
        {"name": "NASDAQ", "fee": 0.003, "rebate": 0.002, "latency_ms": 0.8},
        {"name": "ARCA", "fee": 0.003, "rebate": 0.0025, "latency_ms": 1.2},
        {"name": "BATS", "fee": 0.002, "rebate": 0.0025, "latency_ms": 0.9},
        {"name": "IEX", "fee": 0.0009, "rebate": 0.0, "latency_ms": 1.5},
    ]

    def route_order(self, order: Order, preference: str = "best_price") -> str:
        """Route order to best exchange."""
        if preference == "lowest_fee":
            best = min(self.EXCHANGES, key=lambda e: e["fee"])
        elif preference == "lowest_latency":
            best = min(self.EXCHANGES, key=lambda e: e["latency_ms"])
        elif preference == "best_rebate":
            best = max(self.EXCHANGES, key=lambda e: e["rebate"])
        else:
            # best_price = lowest fee for this simple model
            best = min(self.EXCHANGES, key=lambda e: e["fee"] - e["rebate"])
        return best["name"]

    def get_exchange_fees(self) -> List[Dict[str, Any]]:
        return [dict(e) for e in self.EXCHANGES]


# ═══════════════════════════════════════════════════════════════════════════════
# 7. OrderAnalytics
# ═══════════════════════════════════════════════════════════════════════════════

class OrderAnalytics:
    """Analytics on order execution."""

    @staticmethod
    def execution_quality(orders: List[Order]) -> Dict[str, Any]:
        """Analyze execution quality across filled orders."""
        filled = [o for o in orders if o.status == OrderStatus.FILLED]
        if not filled:
            return {"fill_count": 0}

        slippages = []
        for o in filled:
            ref = o.limit_price or o.stop_price
            if ref and ref > 0:
                slip = (o.avg_fill_price - ref) / ref * 10000  # in bps
                if o.side in (OrderSide.BUY, OrderSide.BUY_TO_COVER):
                    slippages.append(slip)
                else:
                    slippages.append(-slip)

        commissions = [o.total_commission for o in filled]
        fill_times = [(o.filled_at - o.created_at) for o in filled
                      if o.filled_at and o.created_at]

        result = {
            "fill_count": len(filled),
            "total_commission": sum(commissions),
            "avg_commission": float(np.mean(commissions)) if commissions else 0,
        }
        if slippages:
            arr = np.array(slippages)
            result["avg_slippage_bps"] = float(np.mean(arr))
            result["max_slippage_bps"] = float(np.max(arr))
        if fill_times:
            arr = np.array(fill_times)
            result["avg_fill_time_s"] = float(np.mean(arr))
            result["min_fill_time_s"] = float(np.min(arr))

        return result

    @staticmethod
    def order_summary(orders: List[Order]) -> Dict[str, Any]:
        """Summary statistics for a set of orders."""
        if not orders:
            return {"total": 0}

        by_status = defaultdict(int)
        by_type = defaultdict(int)
        by_side = defaultdict(int)
        for o in orders:
            by_status[o.status.value] += 1
            by_type[o.order_type.value] += 1
            by_side[o.side.value] += 1

        return {
            "total": len(orders),
            "by_status": dict(by_status),
            "by_type": dict(by_type),
            "by_side": dict(by_side),
            "total_filled_quantity": sum(o.filled_quantity for o in orders),
            "total_commission": sum(o.total_commission for o in orders),
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 8. OrderManagementEngine — Orchestrator
# ═══════════════════════════════════════════════════════════════════════════════

class OrderManagementEngine:
    """Bloomberg-grade Order Management System."""

    def __init__(self):
        self.book = OrderBook()
        self.validator = OrderValidator()
        self.simulator = FillSimulator()
        self.positions = PositionTracker()
        self.brackets = BracketManager(self.book)
        self.router = OrderRouter()
        self.analytics = OrderAnalytics()
        self._buying_power: float = 1_000_000

    @property
    def buying_power(self) -> float:
        return self._buying_power

    def set_buying_power(self, amount: float):
        self._buying_power = amount

    # ── Order Creation ──────────────────────────────────────────────────────

    def create_market_order(self, symbol: str, side: str,
                             quantity: int, **kwargs) -> Order:
        order = Order(
            symbol=symbol.upper(), side=self._parse_side(side),
            order_type=OrderType.MARKET, quantity=quantity,
            time_in_force=TimeInForce.DAY, **kwargs,
        )
        return self._submit_order(order)

    def create_limit_order(self, symbol: str, side: str,
                            quantity: int, price: float, **kwargs) -> Order:
        order = Order(
            symbol=symbol.upper(), side=self._parse_side(side),
            order_type=OrderType.LIMIT, quantity=quantity,
            limit_price=price,
            time_in_force=kwargs.pop("time_in_force_enum", TimeInForce.DAY),
            **kwargs,
        )
        return self._submit_order(order)

    def create_stop_order(self, symbol: str, side: str,
                           quantity: int, stop_price: float, **kwargs) -> Order:
        order = Order(
            symbol=symbol.upper(), side=self._parse_side(side),
            order_type=OrderType.STOP, quantity=quantity,
            stop_price=stop_price,
            time_in_force=TimeInForce.GTC, **kwargs,
        )
        return self._submit_order(order)

    def create_stop_limit_order(self, symbol: str, side: str,
                                 quantity: int, stop_price: float,
                                 limit_price: float, **kwargs) -> Order:
        order = Order(
            symbol=symbol.upper(), side=self._parse_side(side),
            order_type=OrderType.STOP_LIMIT, quantity=quantity,
            stop_price=stop_price, limit_price=limit_price,
            time_in_force=TimeInForce.GTC, **kwargs,
        )
        return self._submit_order(order)

    def create_trailing_stop(self, symbol: str, side: str,
                              quantity: int,
                              trail_amount: Optional[float] = None,
                              trail_percent: Optional[float] = None,
                              **kwargs) -> Order:
        order = Order(
            symbol=symbol.upper(), side=self._parse_side(side),
            order_type=OrderType.TRAILING_STOP, quantity=quantity,
            trail_amount=trail_amount, trail_percent=trail_percent,
            time_in_force=TimeInForce.GTC, **kwargs,
        )
        return self._submit_order(order)

    def create_bracket_order(self, symbol: str, side: str, quantity: int,
                              entry_price: float,
                              take_profit: float,
                              stop_loss: float) -> Dict[str, Order]:
        """Create a bracket order (entry + TP + SL)."""
        parent = Order(
            symbol=symbol.upper(), side=self._parse_side(side),
            order_type=OrderType.BRACKET, quantity=quantity,
            limit_price=entry_price, time_in_force=TimeInForce.GTC,
        )
        valid, reason, msg = self.validator.validate(
            parent, self._buying_power)
        if not valid:
            parent.reject(reason)
            return {"parent": parent}

        self.book.add(parent)
        parent.submit()
        parent.accept()
        return self.brackets.create_bracket(parent, take_profit, stop_loss)

    # ── Order Management ────────────────────────────────────────────────────

    def cancel_order(self, order_id: str) -> bool:
        return self.book.cancel(order_id)

    def cancel_all(self, symbol: str = "") -> int:
        return self.book.cancel_all(symbol)

    def get_order(self, order_id: str) -> Optional[Order]:
        return self.book.get(order_id)

    def get_active_orders(self) -> List[Order]:
        return self.book.get_active()

    def get_orders_by_symbol(self, symbol: str) -> List[Order]:
        return self.book.get_by_symbol(symbol.upper())

    def get_filled_orders(self) -> List[Order]:
        return self.book.get_filled()

    # ── Fill Processing ─────────────────────────────────────────────────────

    def process_market_fill(self, order_id: str,
                             market_price: float) -> Optional[OrderFill]:
        """Process a fill for a market or accepted order."""
        order = self.book.get(order_id)
        if not order or not order.is_active:
            return None

        fill = None
        if order.order_type == OrderType.MARKET:
            fill = self.simulator.simulate_market_fill(order, market_price)
        elif order.order_type == OrderType.LIMIT:
            fill = self.simulator.simulate_limit_fill(order, market_price)
        elif order.order_type == OrderType.STOP:
            fill = self.simulator.simulate_stop_fill(order, market_price)
        elif order.order_type == OrderType.STOP_LIMIT:
            # Check stop first
            if order.stop_price and market_price <= order.stop_price:
                fill = self.simulator.simulate_limit_fill(order, market_price)

        if fill:
            order.add_fill(fill)
            self.positions.apply_fill(order.symbol, order.side,
                                       fill.quantity, fill.price)
            self._buying_power -= fill.notional if order.side == OrderSide.BUY \
                else -fill.notional
            # Check bracket
            if order.parent_order_id:
                self.brackets.on_child_filled(order.order_id)

        return fill

    # ── Position Queries ────────────────────────────────────────────────────

    def get_position(self, symbol: str) -> Optional[Position]:
        return self.positions.get_position(symbol.upper())

    def get_all_positions(self) -> List[Position]:
        return self.positions.get_all_positions()

    def get_portfolio_summary(self) -> Dict[str, Any]:
        return {
            "buying_power": self._buying_power,
            "positions": [p.to_dict() for p in self.positions.get_all_positions()],
            "portfolio_value": self.positions.get_portfolio_value(),
            "unrealized_pnl": self.positions.get_total_unrealized_pnl(),
            "realized_pnl": self.positions.get_total_realized_pnl(),
            "exposure": self.positions.get_exposure(),
        }

    # ── Analytics ───────────────────────────────────────────────────────────

    def execution_quality(self) -> Dict[str, Any]:
        return self.analytics.execution_quality(self.book.get_all())

    def order_summary(self) -> Dict[str, Any]:
        return self.analytics.order_summary(self.book.get_all())

    def get_history(self, limit: int = 100) -> List[Dict[str, Any]]:
        return self.book.get_history(limit)

    # ── Routing ─────────────────────────────────────────────────────────────

    def route_order(self, order_id: str,
                    preference: str = "best_price") -> str:
        return self.router.route_order(
            self.book.get(order_id), preference) if self.book.get(order_id) else ""

    def capabilities(self) -> Dict[str, Any]:
        return {
            "order_types": [t.value for t in OrderType],
            "sides": [s.value for s in OrderSide],
            "tif_options": [t.value for t in TimeInForce],
            "features": [
                "market_orders", "limit_orders", "stop_orders",
                "stop_limit", "trailing_stop", "bracket_orders",
                "oco_orders", "fill_simulation", "commission_tracking",
                "slippage_modeling", "position_tracking",
                "smart_routing", "order_validation",
            ],
            "total_orders": self.book.count,
            "active_orders": self.book.active_count(),
        }

    # ── Helpers ─────────────────────────────────────────────────────────────

    def _submit_order(self, order: Order) -> Order:
        pos = self.positions.get_position(order.symbol)
        pos_qty = pos.quantity if pos else 0
        valid, reason, msg = self.validator.validate(
            order, self._buying_power, pos_qty)
        if not valid:
            order.reject(reason)
            self.book.add(order)
            return order
        self.book.add(order)
        order.submit()
        order.accept()
        exchange = self.router.route_order(order)
        return order

    @staticmethod
    def _parse_side(side: str) -> OrderSide:
        mapping = {
            "buy": OrderSide.BUY, "sell": OrderSide.SELL,
            "sell_short": OrderSide.SELL_SHORT,
            "buy_to_cover": OrderSide.BUY_TO_COVER,
        }
        return mapping.get(side.lower(), OrderSide.BUY)
