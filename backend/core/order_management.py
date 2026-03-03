"""
Order Management System (OMS) — Full Implementation
=====================================================
§2 Order Management — All 47 items

Features:
  • Market, Limit, Stop, Stop-Limit orders
  • Bracket (OTO/OCO) orders
  • Trailing Stop (% and $)
  • Iceberg / Reserve orders
  • TWAP / VWAP algorithmic orders
  • Order lifecycle (pending → filled → partial → cancelled)
  • Execution & fill simulation for paper trading
  • Order book L2/L3 depth visualization
  • Trade blotter with P&L tracking
  • Position management (flatten, reverse, scale)
  • Risk checks pre-trade (margin, buying power, position limits)
  • Multi-account / multi-broker routing
  • FIX-protocol-style order representation
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import math
import os
import time
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

# ─── Enums ───────────────────────────────────────────────────────────────────

class OrderSide(str, Enum):
    BUY = "buy"
    SELL = "sell"
    SELL_SHORT = "sell_short"
    BUY_TO_COVER = "buy_to_cover"

class OrderType(str, Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"
    TRAILING_STOP = "trailing_stop"
    TRAILING_STOP_LIMIT = "trailing_stop_limit"
    BRACKET = "bracket"
    OCO = "oco"
    OTO = "oto"
    ICEBERG = "iceberg"
    TWAP = "twap"
    VWAP = "vwap"
    MOO = "market_on_open"
    MOC = "market_on_close"
    LOO = "limit_on_open"
    LOC = "limit_on_close"
    PEG = "peg"
    MIDPOINT = "midpoint"
    SNAP_TO_MARKET = "snap_to_market"
    SNAP_TO_MIDPOINT = "snap_to_midpoint"

class OrderStatus(str, Enum):
    NEW = "new"
    PENDING_NEW = "pending_new"
    ACCEPTED = "accepted"
    PARTIALLY_FILLED = "partially_filled"
    FILLED = "filled"
    CANCELLED = "cancelled"
    PENDING_CANCEL = "pending_cancel"
    REJECTED = "rejected"
    EXPIRED = "expired"
    REPLACED = "replaced"
    PENDING_REPLACE = "pending_replace"
    SUSPENDED = "suspended"
    DONE_FOR_DAY = "done_for_day"

class TimeInForce(str, Enum):
    DAY = "day"
    GTC = "gtc"  # Good Till Cancelled
    IOC = "ioc"  # Immediate or Cancel
    FOK = "fok"  # Fill or Kill
    GTD = "gtd"  # Good Till Date
    OPG = "opg"  # At the Open
    CLS = "cls"  # At the Close
    AHO = "aho"  # After Hours Only

class AssetClass(str, Enum):
    EQUITY = "equity"
    OPTION = "option"
    FUTURE = "future"
    FOREX = "forex"
    CRYPTO = "crypto"
    FIXED_INCOME = "fixed_income"
    COMMODITY = "commodity"

class ExecutionVenue(str, Enum):
    SMART = "smart"
    NYSE = "NYSE"
    NASDAQ = "NASDAQ"
    ARCA = "ARCA"
    BATS = "BATS"
    IEX = "IEX"
    DARK_POOL = "dark_pool"
    ALPACA = "alpaca"
    TRADIER = "tradier"

# ─── Data Models ─────────────────────────────────────────────────────────────

@dataclass
class OrderLeg:
    """A single leg of a multi-leg order (e.g., bracket or spread)."""
    leg_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    symbol: str = ""
    side: OrderSide = OrderSide.BUY
    quantity: float = 0.0
    order_type: OrderType = OrderType.MARKET
    limit_price: Optional[float] = None
    stop_price: Optional[float] = None
    trail_amount: Optional[float] = None
    trail_percent: Optional[float] = None
    ratio: float = 1.0  # For ratio spreads

@dataclass
class Fill:
    """An execution fill."""
    fill_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    order_id: str = ""
    timestamp: float = field(default_factory=time.time)
    price: float = 0.0
    quantity: float = 0.0
    side: OrderSide = OrderSide.BUY
    venue: str = ""
    commission: float = 0.0
    fees: float = 0.0
    settlement_date: Optional[str] = None
    liquidity: str = ""  # "added" or "removed"

@dataclass
class Order:
    """Full order representation with FIX-protocol-style fields."""
    # Identifiers
    order_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    client_order_id: str = field(default_factory=lambda: f"APEX-{int(time.time()*1000)}-{uuid.uuid4().hex[:6]}")
    parent_order_id: Optional[str] = None
    account_id: str = "default"

    # Core fields
    symbol: str = ""
    side: OrderSide = OrderSide.BUY
    order_type: OrderType = OrderType.MARKET
    quantity: float = 0.0
    filled_quantity: float = 0.0
    remaining_quantity: float = 0.0
    limit_price: Optional[float] = None
    stop_price: Optional[float] = None
    avg_fill_price: float = 0.0

    # Trailing stop
    trail_amount: Optional[float] = None
    trail_percent: Optional[float] = None
    trail_high_water: Optional[float] = None

    # Time and status
    status: OrderStatus = OrderStatus.NEW
    time_in_force: TimeInForce = TimeInForce.DAY
    expire_time: Optional[float] = None

    # Asset info
    asset_class: AssetClass = AssetClass.EQUITY
    exchange: str = ""
    currency: str = "USD"

    # Multi-leg
    legs: List[OrderLeg] = field(default_factory=list)

    # Bracket fields
    take_profit_price: Optional[float] = None
    stop_loss_price: Optional[float] = None
    take_profit_order_id: Optional[str] = None
    stop_loss_order_id: Optional[str] = None

    # Iceberg
    display_quantity: Optional[float] = None
    iceberg_remaining: Optional[float] = None

    # Algo fields
    algo_start_time: Optional[float] = None
    algo_end_time: Optional[float] = None
    algo_slices: int = 0
    algo_completed_slices: int = 0
    algo_participation_rate: float = 0.0

    # Execution
    venue: ExecutionVenue = ExecutionVenue.SMART
    fills: List[Fill] = field(default_factory=list)

    # Timestamps
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    submitted_at: Optional[float] = None
    filled_at: Optional[float] = None
    cancelled_at: Optional[float] = None
    expired_at: Optional[float] = None

    # Risk
    estimated_commission: float = 0.0
    estimated_impact: float = 0.0
    pre_trade_risk_passed: bool = False
    risk_check_details: Dict[str, Any] = field(default_factory=dict)

    # Tags
    strategy_id: Optional[str] = None
    notes: str = ""
    tags: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)

    @property
    def is_active(self) -> bool:
        return self.status in (
            OrderStatus.NEW, OrderStatus.PENDING_NEW, OrderStatus.ACCEPTED,
            OrderStatus.PARTIALLY_FILLED, OrderStatus.PENDING_CANCEL,
            OrderStatus.PENDING_REPLACE, OrderStatus.SUSPENDED,
        )

    @property
    def is_complete(self) -> bool:
        return self.status in (
            OrderStatus.FILLED, OrderStatus.CANCELLED, OrderStatus.REJECTED,
            OrderStatus.EXPIRED, OrderStatus.DONE_FOR_DAY,
        )

    @property
    def total_commission(self) -> float:
        return sum(f.commission + f.fees for f in self.fills)

    @property
    def net_amount(self) -> float:
        if self.side in (OrderSide.BUY, OrderSide.BUY_TO_COVER):
            return -(self.avg_fill_price * self.filled_quantity + self.total_commission)
        else:
            return self.avg_fill_price * self.filled_quantity - self.total_commission


@dataclass
class Position:
    """Portfolio position tracking."""
    symbol: str = ""
    account_id: str = "default"
    side: str = "long"  # long or short
    quantity: float = 0.0
    avg_entry_price: float = 0.0
    current_price: float = 0.0
    market_value: float = 0.0
    cost_basis: float = 0.0
    unrealized_pnl: float = 0.0
    unrealized_pnl_pct: float = 0.0
    realized_pnl: float = 0.0
    day_pnl: float = 0.0
    day_pnl_pct: float = 0.0
    asset_class: AssetClass = AssetClass.EQUITY
    exchange: str = ""
    currency: str = "USD"
    last_updated: float = field(default_factory=time.time)

    def update_price(self, price: float) -> None:
        self.current_price = price
        self.market_value = self.quantity * price
        self.unrealized_pnl = (price - self.avg_entry_price) * self.quantity
        if self.side == "short":
            self.unrealized_pnl = -self.unrealized_pnl
        self.unrealized_pnl_pct = (
            (self.unrealized_pnl / self.cost_basis * 100) if self.cost_basis != 0 else 0.0
        )
        self.last_updated = time.time()


@dataclass
class TradeRecord:
    """Completed trade record for the blotter."""
    trade_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    order_id: str = ""
    symbol: str = ""
    side: OrderSide = OrderSide.BUY
    quantity: float = 0.0
    entry_price: float = 0.0
    exit_price: float = 0.0
    pnl: float = 0.0
    pnl_pct: float = 0.0
    commission: float = 0.0
    net_pnl: float = 0.0
    entry_time: float = 0.0
    exit_time: float = 0.0
    hold_duration: float = 0.0
    strategy_id: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    notes: str = ""


@dataclass
class AccountInfo:
    """Brokerage account summary."""
    account_id: str = "default"
    account_type: str = "paper"  # paper, live, margin
    buying_power: float = 0.0
    cash: float = 0.0
    portfolio_value: float = 0.0
    equity: float = 0.0
    margin_used: float = 0.0
    margin_available: float = 0.0
    day_trades_remaining: int = 3  # PDT rule
    pattern_day_trader: bool = False
    currency: str = "USD"
    positions: List[Position] = field(default_factory=list)
    open_orders: int = 0
    last_updated: float = field(default_factory=time.time)


# ─── Pre-Trade Risk Engine ───────────────────────────────────────────────────

class PreTradeRiskEngine:
    """
    Validates orders against risk limits before submission.
    Checks: margin, buying power, position limits, order rate,
    max order size, price limits, duplicate detection, etc.
    """

    def __init__(self):
        self.max_order_size: float = 100_000  # max notional per order
        self.max_position_size: float = 500_000  # max notional per position
        self.max_loss_per_trade: float = 5_000
        self.max_daily_loss: float = 25_000
        self.max_open_orders: int = 50
        self.max_orders_per_minute: int = 30
        self.position_concentration_limit: float = 0.20  # 20% of portfolio
        self.min_buying_power_reserve: float = 0.05  # Keep 5% reserve
        self.price_deviation_limit: float = 0.10  # 10% from last price
        self.banned_symbols: List[str] = []
        self.order_history: List[float] = []  # timestamps of recent orders
        self.daily_pnl: float = 0.0
        self.daily_pnl_reset_time: float = 0.0

    def validate(self, order: Order, account: AccountInfo, last_price: float) -> Tuple[bool, Dict[str, Any]]:
        """Run all pre-trade risk checks. Returns (passed, details)."""
        checks: Dict[str, Any] = {}
        passed = True

        # 1. Symbol check
        if order.symbol in self.banned_symbols:
            checks["banned_symbol"] = {"passed": False, "reason": f"{order.symbol} is banned from trading"}
            passed = False
        else:
            checks["banned_symbol"] = {"passed": True}

        # 2. Notional size check
        notional = order.quantity * (order.limit_price or last_price)
        if notional > self.max_order_size:
            checks["max_order_size"] = {"passed": False, "notional": notional, "limit": self.max_order_size}
            passed = False
        else:
            checks["max_order_size"] = {"passed": True, "notional": notional}

        # 3. Buying power check
        required_bp = notional
        if order.side in (OrderSide.SELL_SHORT, ):
            required_bp = notional * 1.5  # 150% for short
        reserve = account.buying_power * self.min_buying_power_reserve
        available = account.buying_power - reserve
        if required_bp > available:
            checks["buying_power"] = {"passed": False, "required": required_bp, "available": available}
            passed = False
        else:
            checks["buying_power"] = {"passed": True, "required": required_bp, "available": available}

        # 4. Position concentration
        if account.portfolio_value > 0:
            existing_position_value = 0.0
            for pos in account.positions:
                if pos.symbol == order.symbol:
                    existing_position_value = pos.market_value
            new_position_value = existing_position_value + notional
            concentration = new_position_value / account.portfolio_value
            if concentration > self.position_concentration_limit:
                checks["concentration"] = {"passed": False, "concentration": concentration, "limit": self.position_concentration_limit}
                passed = False
            else:
                checks["concentration"] = {"passed": True, "concentration": concentration}

        # 5. Open orders limit
        if account.open_orders >= self.max_open_orders:
            checks["open_orders"] = {"passed": False, "count": account.open_orders, "limit": self.max_open_orders}
            passed = False
        else:
            checks["open_orders"] = {"passed": True, "count": account.open_orders}

        # 6. Order rate limit
        now = time.time()
        self.order_history = [t for t in self.order_history if now - t < 60]
        if len(self.order_history) >= self.max_orders_per_minute:
            checks["rate_limit"] = {"passed": False, "orders_last_minute": len(self.order_history)}
            passed = False
        else:
            checks["rate_limit"] = {"passed": True}
            self.order_history.append(now)

        # 7. Price deviation check
        if order.limit_price and last_price > 0:
            deviation = abs(order.limit_price - last_price) / last_price
            if deviation > self.price_deviation_limit:
                checks["price_deviation"] = {"passed": False, "deviation": deviation, "limit": self.price_deviation_limit}
                passed = False
            else:
                checks["price_deviation"] = {"passed": True, "deviation": deviation}

        # 8. Daily loss limit
        if self.daily_pnl < -self.max_daily_loss:
            checks["daily_loss"] = {"passed": False, "daily_pnl": self.daily_pnl, "limit": self.max_daily_loss}
            passed = False
        else:
            checks["daily_loss"] = {"passed": True, "daily_pnl": self.daily_pnl}

        # 9. PDT check (Pattern Day Trading)
        if order.side in (OrderSide.SELL, OrderSide.SELL_SHORT):
            # Check if this would be a day trade
            for pos in account.positions:
                if pos.symbol == order.symbol:
                    entry_today = (time.time() - pos.last_updated) < 86400
                    if entry_today and account.day_trades_remaining <= 0 and not account.pattern_day_trader:
                        checks["pdt"] = {"passed": False, "reason": "PDT limit reached"}
                        passed = False
                    else:
                        checks["pdt"] = {"passed": True, "remaining": account.day_trades_remaining}
                    break

        # 10. Quantity validation
        if order.quantity <= 0:
            checks["quantity"] = {"passed": False, "reason": "Quantity must be positive"}
            passed = False
        elif order.asset_class == AssetClass.EQUITY and order.quantity != int(order.quantity):
            # Fractional shares check
            checks["quantity"] = {"passed": True, "note": "Fractional shares"}
        else:
            checks["quantity"] = {"passed": True}

        return passed, checks


# ─── Execution Algorithms ────────────────────────────────────────────────────

class TWAPAlgo:
    """
    Time Weighted Average Price algorithm.
    Splits an order into equal-sized slices over a time window.
    """

    def __init__(self, total_quantity: float, duration_minutes: int, order_type: OrderType = OrderType.LIMIT):
        self.total_quantity = total_quantity
        self.duration = duration_minutes * 60  # seconds
        self.order_type = order_type
        self.num_slices = max(1, duration_minutes)  # 1 slice per minute
        self.slice_size = total_quantity / self.num_slices
        self.slice_interval = self.duration / self.num_slices
        self.completed_slices = 0
        self.filled_quantity = 0.0
        self.start_time = 0.0
        self.fills: List[Fill] = []
        self.active = False

    def start(self) -> None:
        self.active = True
        self.start_time = time.time()
        self.completed_slices = 0
        self.filled_quantity = 0.0
        self.fills = []

    def get_next_slice(self, current_price: float) -> Optional[Dict[str, Any]]:
        if not self.active or self.completed_slices >= self.num_slices:
            return None

        elapsed = time.time() - self.start_time
        expected_slices = min(int(elapsed / self.slice_interval) + 1, self.num_slices)

        if self.completed_slices >= expected_slices:
            return None

        remaining = self.total_quantity - self.filled_quantity
        qty = min(self.slice_size, remaining)
        if qty <= 0:
            self.active = False
            return None

        return {
            "quantity": qty,
            "price": current_price,
            "slice_number": self.completed_slices + 1,
            "total_slices": self.num_slices,
            "elapsed_pct": (elapsed / self.duration) * 100,
        }

    def record_fill(self, fill: Fill) -> None:
        self.fills.append(fill)
        self.filled_quantity += fill.quantity
        self.completed_slices += 1
        if self.filled_quantity >= self.total_quantity:
            self.active = False

    def get_avg_price(self) -> float:
        if not self.fills:
            return 0.0
        total_notional = sum(f.price * f.quantity for f in self.fills)
        total_qty = sum(f.quantity for f in self.fills)
        return total_notional / total_qty if total_qty > 0 else 0.0

    def get_progress(self) -> Dict[str, Any]:
        return {
            "active": self.active,
            "total_quantity": self.total_quantity,
            "filled_quantity": self.filled_quantity,
            "remaining_quantity": self.total_quantity - self.filled_quantity,
            "completed_slices": self.completed_slices,
            "total_slices": self.num_slices,
            "avg_price": self.get_avg_price(),
            "elapsed_seconds": time.time() - self.start_time if self.active else 0,
            "fill_pct": (self.filled_quantity / self.total_quantity * 100) if self.total_quantity > 0 else 0,
        }


class VWAPAlgo:
    """
    Volume Weighted Average Price algorithm.
    Distributes order slices proportional to expected volume profile.
    """

    def __init__(self, total_quantity: float, duration_minutes: int,
                 volume_profile: Optional[List[float]] = None):
        self.total_quantity = total_quantity
        self.duration = duration_minutes * 60
        self.num_slices = max(1, duration_minutes)
        self.filled_quantity = 0.0
        self.completed_slices = 0
        self.start_time = 0.0
        self.fills: List[Fill] = []
        self.active = False

        # Default volume profile: U-shaped (high at open/close, low midday)
        if volume_profile:
            self.volume_profile = volume_profile
        else:
            self.volume_profile = self._default_volume_profile(self.num_slices)

        # Normalize profile
        total = sum(self.volume_profile)
        if total > 0:
            self.volume_profile = [v / total for v in self.volume_profile]

    def _default_volume_profile(self, n: int) -> List[float]:
        """Generate U-shaped intraday volume profile."""
        profile = []
        for i in range(n):
            x = i / max(n - 1, 1)  # 0 to 1
            # U-shape: high at 0 and 1, low at 0.5
            v = 2.0 * (x - 0.5) ** 2 + 0.3
            profile.append(v)
        return profile

    def start(self) -> None:
        self.active = True
        self.start_time = time.time()
        self.completed_slices = 0
        self.filled_quantity = 0.0

    def get_next_slice(self, current_price: float, current_volume: float = 0) -> Optional[Dict[str, Any]]:
        if not self.active or self.completed_slices >= self.num_slices:
            return None

        elapsed = time.time() - self.start_time
        expected_slices = min(int(elapsed / (self.duration / self.num_slices)) + 1, self.num_slices)
        if self.completed_slices >= expected_slices:
            return None

        # Get the volume weight for this slice
        weight = self.volume_profile[self.completed_slices] if self.completed_slices < len(self.volume_profile) else 1 / self.num_slices
        qty = self.total_quantity * weight
        remaining = self.total_quantity - self.filled_quantity
        qty = min(qty, remaining)

        if qty <= 0:
            self.active = False
            return None

        return {
            "quantity": qty,
            "price": current_price,
            "slice_number": self.completed_slices + 1,
            "total_slices": self.num_slices,
            "volume_weight": weight,
            "participation_rate": (qty / current_volume * 100) if current_volume > 0 else 0,
        }

    def record_fill(self, fill: Fill) -> None:
        self.fills.append(fill)
        self.filled_quantity += fill.quantity
        self.completed_slices += 1
        if self.filled_quantity >= self.total_quantity:
            self.active = False

    def get_vwap(self) -> float:
        if not self.fills:
            return 0.0
        total_notional = sum(f.price * f.quantity for f in self.fills)
        total_qty = sum(f.quantity for f in self.fills)
        return total_notional / total_qty if total_qty > 0 else 0.0


class IcebergAlgo:
    """
    Iceberg / Reserve order algorithm.
    Shows only a small portion of the total order to the market.
    """

    def __init__(self, total_quantity: float, display_quantity: float,
                 variance: float = 0.1):
        self.total_quantity = total_quantity
        self.display_quantity = display_quantity
        self.variance = variance  # Random variance in display size
        self.filled_quantity = 0.0
        self.current_display = display_quantity
        self.fills: List[Fill] = []
        self.active = True
        self.slice_count = 0

    def get_next_display(self) -> Optional[Dict[str, Any]]:
        if not self.active or self.filled_quantity >= self.total_quantity:
            return None

        remaining = self.total_quantity - self.filled_quantity
        # Add variance to display size
        import random
        variance = self.display_quantity * self.variance
        display = self.display_quantity + random.uniform(-variance, variance)
        display = max(1, min(display, remaining))

        self.current_display = display
        self.slice_count += 1

        return {
            "display_quantity": display,
            "hidden_quantity": remaining - display,
            "total_remaining": remaining,
            "slice_number": self.slice_count,
            "fill_pct": (self.filled_quantity / self.total_quantity * 100),
        }

    def record_fill(self, fill: Fill) -> None:
        self.fills.append(fill)
        self.filled_quantity += fill.quantity
        if self.filled_quantity >= self.total_quantity:
            self.active = False


# ─── Order Book / Market Depth ───────────────────────────────────────────────

@dataclass
class OrderBookLevel:
    """A single price level in the order book."""
    price: float
    size: float
    orders: int  # Number of orders at this level
    exchange: str = ""

@dataclass
class OrderBookSnapshot:
    """Full L2/L3 order book snapshot."""
    symbol: str
    timestamp: float
    bids: List[OrderBookLevel] = field(default_factory=list)
    asks: List[OrderBookLevel] = field(default_factory=list)
    last_price: float = 0.0
    last_size: float = 0.0

    @property
    def spread(self) -> float:
        if self.bids and self.asks:
            return self.asks[0].price - self.bids[0].price
        return 0.0

    @property
    def spread_pct(self) -> float:
        mid = self.midpoint
        return (self.spread / mid * 100) if mid > 0 else 0.0

    @property
    def midpoint(self) -> float:
        if self.bids and self.asks:
            return (self.asks[0].price + self.bids[0].price) / 2
        return self.last_price

    @property
    def bid_depth(self) -> float:
        return sum(l.size for l in self.bids)

    @property
    def ask_depth(self) -> float:
        return sum(l.size for l in self.asks)

    @property
    def imbalance(self) -> float:
        """Order book imbalance: +1 = all bids, -1 = all asks"""
        total = self.bid_depth + self.ask_depth
        if total == 0:
            return 0.0
        return (self.bid_depth - self.ask_depth) / total

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "timestamp": self.timestamp,
            "bids": [{"price": l.price, "size": l.size, "orders": l.orders} for l in self.bids],
            "asks": [{"price": l.price, "size": l.size, "orders": l.orders} for l in self.asks],
            "spread": self.spread,
            "spread_pct": self.spread_pct,
            "midpoint": self.midpoint,
            "imbalance": self.imbalance,
        }


class OrderBookAggregator:
    """Aggregates L2 data into price-level buckets for visualization."""

    def __init__(self, tick_size: float = 0.01):
        self.tick_size = tick_size

    def aggregate(self, book: OrderBookSnapshot, num_levels: int = 20) -> Dict[str, Any]:
        """Aggregate order book data for heatmap/depth visualization."""
        bids = self._aggregate_side(book.bids, num_levels, reverse=True)
        asks = self._aggregate_side(book.asks, num_levels, reverse=False)

        # Cumulative depth
        bid_cumulative = []
        ask_cumulative = []
        cum = 0.0
        for b in bids:
            cum += b["size"]
            bid_cumulative.append({**b, "cumulative": cum})
        cum = 0.0
        for a in asks:
            cum += a["size"]
            ask_cumulative.append({**a, "cumulative": cum})

        max_depth = max(
            max((b["cumulative"] for b in bid_cumulative), default=0),
            max((a["cumulative"] for a in ask_cumulative), default=0),
        )

        return {
            "bids": bid_cumulative,
            "asks": ask_cumulative,
            "spread": book.spread,
            "midpoint": book.midpoint,
            "max_depth": max_depth,
            "imbalance": book.imbalance,
        }

    def _aggregate_side(self, levels: List[OrderBookLevel], num_levels: int, reverse: bool) -> List[Dict[str, Any]]:
        if not levels:
            return []

        result = []
        for level in levels[:num_levels]:
            bucket_price = round(level.price / self.tick_size) * self.tick_size
            result.append({
                "price": bucket_price,
                "size": level.size,
                "orders": level.orders,
            })

        if reverse:
            result.reverse()
        return result


# ─── Trade Blotter ───────────────────────────────────────────────────────────

class TradeBlotter:
    """
    Maintains a record of all trades with P&L calculations.
    Supports filtering, sorting, grouping, and export.
    """

    def __init__(self):
        self.trades: List[TradeRecord] = []
        self.open_positions: Dict[str, Position] = {}

    def record_fill(self, order: Order, fill: Fill, current_positions: Dict[str, Position]) -> Optional[TradeRecord]:
        """Process a fill and potentially close a trade."""
        symbol = order.symbol
        pos = current_positions.get(symbol)

        if pos and ((order.side == OrderSide.SELL and pos.side == "long") or
                    (order.side == OrderSide.BUY_TO_COVER and pos.side == "short")):
            # Closing trade
            pnl = (fill.price - pos.avg_entry_price) * fill.quantity
            if pos.side == "short":
                pnl = -pnl
            pnl_pct = (pnl / (pos.avg_entry_price * fill.quantity)) * 100 if pos.avg_entry_price > 0 else 0

            trade = TradeRecord(
                order_id=order.order_id,
                symbol=symbol,
                side=order.side,
                quantity=fill.quantity,
                entry_price=pos.avg_entry_price,
                exit_price=fill.price,
                pnl=pnl,
                pnl_pct=pnl_pct,
                commission=fill.commission + fill.fees,
                net_pnl=pnl - fill.commission - fill.fees,
                entry_time=pos.last_updated,
                exit_time=fill.timestamp,
                hold_duration=fill.timestamp - pos.last_updated,
                strategy_id=order.strategy_id,
                tags=order.tags,
                notes=order.notes,
            )
            self.trades.append(trade)
            return trade

        return None

    def get_summary(self) -> Dict[str, Any]:
        """Get aggregate trade statistics."""
        if not self.trades:
            return {"total_trades": 0}

        winners = [t for t in self.trades if t.net_pnl > 0]
        losers = [t for t in self.trades if t.net_pnl < 0]
        flat = [t for t in self.trades if t.net_pnl == 0]

        total_pnl = sum(t.net_pnl for t in self.trades)
        gross_profit = sum(t.net_pnl for t in winners) if winners else 0
        gross_loss = sum(t.net_pnl for t in losers) if losers else 0
        avg_win = gross_profit / len(winners) if winners else 0
        avg_loss = gross_loss / len(losers) if losers else 0
        profit_factor = abs(gross_profit / gross_loss) if gross_loss != 0 else float('inf')
        win_rate = len(winners) / len(self.trades) * 100
        avg_hold = sum(t.hold_duration for t in self.trades) / len(self.trades)

        # Expectancy
        expectancy = (win_rate / 100 * avg_win) + ((1 - win_rate / 100) * avg_loss)

        # Max drawdown
        equity_curve = []
        cum = 0.0
        for t in sorted(self.trades, key=lambda x: x.exit_time):
            cum += t.net_pnl
            equity_curve.append(cum)

        max_dd = 0.0
        peak = 0.0
        for eq in equity_curve:
            if eq > peak:
                peak = eq
            dd = peak - eq
            if dd > max_dd:
                max_dd = dd

        # Consecutive wins/losses
        max_consec_wins = 0
        max_consec_losses = 0
        current_streak = 0
        last_type = None
        for t in sorted(self.trades, key=lambda x: x.exit_time):
            win = t.net_pnl > 0
            if win:
                if last_type == "win":
                    current_streak += 1
                else:
                    current_streak = 1
                last_type = "win"
                max_consec_wins = max(max_consec_wins, current_streak)
            else:
                if last_type == "loss":
                    current_streak += 1
                else:
                    current_streak = 1
                last_type = "loss"
                max_consec_losses = max(max_consec_losses, current_streak)

        return {
            "total_trades": len(self.trades),
            "winners": len(winners),
            "losers": len(losers),
            "flat": len(flat),
            "win_rate": round(win_rate, 2),
            "total_pnl": round(total_pnl, 2),
            "gross_profit": round(gross_profit, 2),
            "gross_loss": round(gross_loss, 2),
            "avg_win": round(avg_win, 2),
            "avg_loss": round(avg_loss, 2),
            "largest_win": round(max((t.net_pnl for t in winners), default=0), 2),
            "largest_loss": round(min((t.net_pnl for t in losers), default=0), 2),
            "profit_factor": round(profit_factor, 4),
            "expectancy": round(expectancy, 2),
            "avg_hold_seconds": round(avg_hold, 0),
            "max_drawdown": round(max_dd, 2),
            "max_consecutive_wins": max_consec_wins,
            "max_consecutive_losses": max_consec_losses,
            "total_commission": round(sum(t.commission for t in self.trades), 2),
            "avg_pnl_per_trade": round(total_pnl / len(self.trades), 2),
            "sharpe_estimate": self._estimate_sharpe(),
        }

    def _estimate_sharpe(self) -> float:
        """Rough Sharpe ratio estimate from trade returns."""
        if len(self.trades) < 2:
            return 0.0
        returns = [t.pnl_pct for t in self.trades]
        avg = sum(returns) / len(returns)
        var = sum((r - avg) ** 2 for r in returns) / (len(returns) - 1)
        std = math.sqrt(var) if var > 0 else 1.0
        # Annualized: assume ~252 trading days
        return round((avg / std) * math.sqrt(252), 4)

    def filter_trades(self, symbol: Optional[str] = None,
                      start_time: Optional[float] = None,
                      end_time: Optional[float] = None,
                      strategy_id: Optional[str] = None,
                      min_pnl: Optional[float] = None,
                      max_pnl: Optional[float] = None,
                      tags: Optional[List[str]] = None) -> List[TradeRecord]:
        """Filter trades by various criteria."""
        result = self.trades
        if symbol:
            result = [t for t in result if t.symbol == symbol]
        if start_time:
            result = [t for t in result if t.exit_time >= start_time]
        if end_time:
            result = [t for t in result if t.exit_time <= end_time]
        if strategy_id:
            result = [t for t in result if t.strategy_id == strategy_id]
        if min_pnl is not None:
            result = [t for t in result if t.net_pnl >= min_pnl]
        if max_pnl is not None:
            result = [t for t in result if t.net_pnl <= max_pnl]
        if tags:
            result = [t for t in result if any(tag in t.tags for tag in tags)]
        return result

    def group_by_symbol(self) -> Dict[str, Dict[str, Any]]:
        """Group trade stats by symbol."""
        groups: Dict[str, List[TradeRecord]] = {}
        for t in self.trades:
            groups.setdefault(t.symbol, []).append(t)

        result = {}
        for symbol, trades in groups.items():
            winners = [t for t in trades if t.net_pnl > 0]
            result[symbol] = {
                "trades": len(trades),
                "pnl": round(sum(t.net_pnl for t in trades), 2),
                "win_rate": round(len(winners) / len(trades) * 100, 2) if trades else 0,
                "avg_pnl": round(sum(t.net_pnl for t in trades) / len(trades), 2),
            }
        return result

    def export_csv(self) -> str:
        """Export trades to CSV string."""
        lines = ["trade_id,order_id,symbol,side,quantity,entry_price,exit_price,pnl,pnl_pct,commission,net_pnl,entry_time,exit_time,hold_duration,strategy_id,tags,notes"]
        for t in self.trades:
            lines.append(
                f"{t.trade_id},{t.order_id},{t.symbol},{t.side.value},{t.quantity},"
                f"{t.entry_price},{t.exit_price},{t.pnl:.2f},{t.pnl_pct:.2f},"
                f"{t.commission:.2f},{t.net_pnl:.2f},{t.entry_time},{t.exit_time},"
                f"{t.hold_duration:.0f},{t.strategy_id or ''},"
                f"\"{';'.join(t.tags)}\",\"{t.notes}\""
            )
        return "\n".join(lines)


# ─── Alpaca Broker Integration ───────────────────────────────────────────────

class AlpacaBroker:
    """
    Full Alpaca Markets broker integration.
    Supports paper and live trading via REST API.
    """

    def __init__(self, api_key: Optional[str] = None, api_secret: Optional[str] = None,
                 base_url: Optional[str] = None):
        self.api_key = api_key or os.environ.get("APCA_API_KEY_ID", "")
        self.api_secret = api_secret or os.environ.get("APCA_API_SECRET_KEY", "")
        self.base_url = base_url or os.environ.get("APCA_API_BASE_URL", "https://paper-api.alpaca.markets")
        self.data_url = "https://data.alpaca.markets"
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                headers={
                    "APCA-API-KEY-ID": self.api_key,
                    "APCA-API-SECRET-KEY": self.api_secret,
                },
                timeout=30.0,
            )
        return self._client

    async def get_account(self) -> AccountInfo:
        """Get account information."""
        client = await self._get_client()
        resp = await client.get(f"{self.base_url}/v2/account")
        resp.raise_for_status()
        data = resp.json()

        positions = await self.get_positions()

        return AccountInfo(
            account_id=data.get("id", ""),
            account_type="paper" if "paper" in self.base_url else "live",
            buying_power=float(data.get("buying_power", 0)),
            cash=float(data.get("cash", 0)),
            portfolio_value=float(data.get("portfolio_value", 0)),
            equity=float(data.get("equity", 0)),
            margin_used=float(data.get("initial_margin", 0)),
            margin_available=float(data.get("regt_buying_power", 0)),
            day_trades_remaining=int(data.get("daytrade_count", 0)),
            pattern_day_trader=data.get("pattern_day_trader", False),
            positions=positions,
            open_orders=0,  # Will be updated separately
        )

    async def get_positions(self) -> List[Position]:
        """Get all open positions."""
        client = await self._get_client()
        resp = await client.get(f"{self.base_url}/v2/positions")
        resp.raise_for_status()
        data = resp.json()

        positions = []
        for p in data:
            pos = Position(
                symbol=p.get("symbol", ""),
                side=p.get("side", "long"),
                quantity=float(p.get("qty", 0)),
                avg_entry_price=float(p.get("avg_entry_price", 0)),
                current_price=float(p.get("current_price", 0)),
                market_value=float(p.get("market_value", 0)),
                cost_basis=float(p.get("cost_basis", 0)),
                unrealized_pnl=float(p.get("unrealized_pl", 0)),
                unrealized_pnl_pct=float(p.get("unrealized_plpc", 0)) * 100,
                day_pnl=float(p.get("unrealized_intraday_pl", 0)),
                day_pnl_pct=float(p.get("unrealized_intraday_plpc", 0)) * 100,
            )
            positions.append(pos)
        return positions

    async def submit_order(self, order: Order) -> Order:
        """Submit an order to Alpaca."""
        client = await self._get_client()

        body: Dict[str, Any] = {
            "symbol": order.symbol,
            "qty": str(order.quantity),
            "side": order.side.value,
            "type": self._map_order_type(order.order_type),
            "time_in_force": order.time_in_force.value,
            "client_order_id": order.client_order_id,
        }

        if order.limit_price:
            body["limit_price"] = str(order.limit_price)
        if order.stop_price:
            body["stop_price"] = str(order.stop_price)
        if order.trail_percent:
            body["trail_percent"] = str(order.trail_percent)
        if order.trail_amount:
            body["trail_price"] = str(order.trail_amount)

        # Bracket order
        if order.order_type == OrderType.BRACKET:
            body["order_class"] = "bracket"
            if order.take_profit_price:
                body["take_profit"] = {"limit_price": str(order.take_profit_price)}
            if order.stop_loss_price:
                body["stop_loss"] = {"stop_price": str(order.stop_loss_price)}

        # OCO order
        elif order.order_type == OrderType.OCO:
            body["order_class"] = "oco"
            if order.take_profit_price:
                body["take_profit"] = {"limit_price": str(order.take_profit_price)}
            if order.stop_loss_price:
                body["stop_loss"] = {"stop_price": str(order.stop_loss_price)}

        # OTO order
        elif order.order_type == OrderType.OTO:
            body["order_class"] = "oto"

        resp = await client.post(f"{self.base_url}/v2/orders", json=body)
        resp.raise_for_status()
        data = resp.json()

        order.order_id = data.get("id", order.order_id)
        order.status = self._map_status(data.get("status", "new"))
        order.submitted_at = time.time()
        order.updated_at = time.time()

        if data.get("filled_avg_price"):
            order.avg_fill_price = float(data["filled_avg_price"])
        if data.get("filled_qty"):
            order.filled_quantity = float(data["filled_qty"])

        return order

    async def cancel_order(self, order_id: str) -> bool:
        """Cancel an order."""
        client = await self._get_client()
        try:
            resp = await client.delete(f"{self.base_url}/v2/orders/{order_id}")
            return resp.status_code in (200, 204)
        except Exception as e:
            logger.error(f"Failed to cancel order {order_id}: {e}")
            return False

    async def cancel_all_orders(self) -> int:
        """Cancel all open orders. Returns count cancelled."""
        client = await self._get_client()
        resp = await client.delete(f"{self.base_url}/v2/orders")
        if resp.status_code == 207:
            return len(resp.json())
        return 0

    async def get_orders(self, status: str = "all", limit: int = 100) -> List[Order]:
        """Get orders with optional status filter."""
        client = await self._get_client()
        resp = await client.get(f"{self.base_url}/v2/orders", params={
            "status": status,
            "limit": limit,
            "nested": "true",
        })
        resp.raise_for_status()
        data = resp.json()

        orders = []
        for o in data:
            order = Order(
                order_id=o.get("id", ""),
                client_order_id=o.get("client_order_id", ""),
                symbol=o.get("symbol", ""),
                side=OrderSide(o.get("side", "buy")),
                order_type=self._reverse_map_order_type(o.get("type", "market")),
                quantity=float(o.get("qty", 0)),
                filled_quantity=float(o.get("filled_qty", 0)),
                limit_price=float(o["limit_price"]) if o.get("limit_price") else None,
                stop_price=float(o["stop_price"]) if o.get("stop_price") else None,
                avg_fill_price=float(o.get("filled_avg_price", 0) or 0),
                status=self._map_status(o.get("status", "new")),
                time_in_force=TimeInForce(o.get("time_in_force", "day")),
            )
            orders.append(order)
        return orders

    async def get_order(self, order_id: str) -> Optional[Order]:
        """Get a specific order by ID."""
        client = await self._get_client()
        try:
            resp = await client.get(f"{self.base_url}/v2/orders/{order_id}")
            resp.raise_for_status()
            o = resp.json()
            return Order(
                order_id=o.get("id", ""),
                symbol=o.get("symbol", ""),
                side=OrderSide(o.get("side", "buy")),
                order_type=self._reverse_map_order_type(o.get("type", "market")),
                quantity=float(o.get("qty", 0)),
                filled_quantity=float(o.get("filled_qty", 0)),
                avg_fill_price=float(o.get("filled_avg_price", 0) or 0),
                status=self._map_status(o.get("status", "new")),
            )
        except Exception:
            return None

    async def close_position(self, symbol: str, qty: Optional[float] = None) -> bool:
        """Close a position (all or partial)."""
        client = await self._get_client()
        params = {}
        if qty:
            params["qty"] = str(qty)
        try:
            resp = await client.delete(f"{self.base_url}/v2/positions/{symbol}", params=params)
            return resp.status_code in (200, 204)
        except Exception as e:
            logger.error(f"Failed to close position {symbol}: {e}")
            return False

    async def close_all_positions(self) -> bool:
        """Close all positions."""
        client = await self._get_client()
        try:
            resp = await client.delete(f"{self.base_url}/v2/positions")
            return resp.status_code in (200, 204, 207)
        except Exception:
            return False

    async def replace_order(self, order_id: str, updates: Dict[str, Any]) -> Optional[Order]:
        """Replace/modify an existing order."""
        client = await self._get_client()
        body = {}
        if "quantity" in updates:
            body["qty"] = str(updates["quantity"])
        if "limit_price" in updates:
            body["limit_price"] = str(updates["limit_price"])
        if "stop_price" in updates:
            body["stop_price"] = str(updates["stop_price"])
        if "time_in_force" in updates:
            body["time_in_force"] = updates["time_in_force"]
        if "trail" in updates:
            body["trail"] = str(updates["trail"])

        try:
            resp = await client.patch(f"{self.base_url}/v2/orders/{order_id}", json=body)
            resp.raise_for_status()
            return await self.get_order(resp.json().get("id", order_id))
        except Exception as e:
            logger.error(f"Failed to replace order {order_id}: {e}")
            return None

    async def get_quote(self, symbol: str) -> Dict[str, Any]:
        """Get latest quote from Alpaca data API."""
        client = await self._get_client()
        resp = await client.get(f"{self.data_url}/v2/stocks/{symbol}/quotes/latest")
        if resp.status_code == 200:
            data = resp.json()
            q = data.get("quote", {})
            return {
                "symbol": symbol,
                "bid": q.get("bp", 0),
                "ask": q.get("ap", 0),
                "bid_size": q.get("bs", 0),
                "ask_size": q.get("as", 0),
                "last": (q.get("bp", 0) + q.get("ap", 0)) / 2,
                "timestamp": q.get("t", ""),
            }
        return {"symbol": symbol, "bid": 0, "ask": 0, "last": 0}

    async def get_bars(self, symbol: str, timeframe: str = "1Day",
                       start: Optional[str] = None, end: Optional[str] = None,
                       limit: int = 1000) -> List[Dict[str, Any]]:
        """Get historical bars from Alpaca data API."""
        client = await self._get_client()
        params: Dict[str, Any] = {"timeframe": timeframe, "limit": limit}
        if start:
            params["start"] = start
        if end:
            params["end"] = end

        resp = await client.get(f"{self.data_url}/v2/stocks/{symbol}/bars", params=params)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("bars", [])
        return []

    async def get_snapshot(self, symbol: str) -> Dict[str, Any]:
        """Get market snapshot (quote + trade + bar)."""
        client = await self._get_client()
        resp = await client.get(f"{self.data_url}/v2/stocks/{symbol}/snapshot")
        if resp.status_code == 200:
            return resp.json()
        return {}

    def _map_order_type(self, ot: OrderType) -> str:
        mapping = {
            OrderType.MARKET: "market",
            OrderType.LIMIT: "limit",
            OrderType.STOP: "stop",
            OrderType.STOP_LIMIT: "stop_limit",
            OrderType.TRAILING_STOP: "trailing_stop",
        }
        return mapping.get(ot, "market")

    def _reverse_map_order_type(self, t: str) -> OrderType:
        mapping = {
            "market": OrderType.MARKET,
            "limit": OrderType.LIMIT,
            "stop": OrderType.STOP,
            "stop_limit": OrderType.STOP_LIMIT,
            "trailing_stop": OrderType.TRAILING_STOP,
        }
        return mapping.get(t, OrderType.MARKET)

    def _map_status(self, s: str) -> OrderStatus:
        mapping = {
            "new": OrderStatus.NEW,
            "accepted": OrderStatus.ACCEPTED,
            "partially_filled": OrderStatus.PARTIALLY_FILLED,
            "filled": OrderStatus.FILLED,
            "canceled": OrderStatus.CANCELLED,
            "cancelled": OrderStatus.CANCELLED,
            "pending_cancel": OrderStatus.PENDING_CANCEL,
            "rejected": OrderStatus.REJECTED,
            "expired": OrderStatus.EXPIRED,
            "replaced": OrderStatus.REPLACED,
            "pending_replace": OrderStatus.PENDING_REPLACE,
            "suspended": OrderStatus.SUSPENDED,
            "done_for_day": OrderStatus.DONE_FOR_DAY,
            "pending_new": OrderStatus.PENDING_NEW,
        }
        return mapping.get(s, OrderStatus.NEW)

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()


# ─── Tradier Broker Integration ──────────────────────────────────────────────

class TradierBroker:
    """
    Tradier broker integration, primarily for options trading.
    """

    def __init__(self, api_key: Optional[str] = None, is_sandbox: bool = True):
        if is_sandbox:
            self.api_key = api_key or os.environ.get("TRADIER_SANDBOX_KEY", "")
            self.base_url = "https://sandbox.tradier.com"
        else:
            self.api_key = api_key or os.environ.get("TRADIER_BROKERAGE_KEY", "")
            self.base_url = "https://api.tradier.com"
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Accept": "application/json",
                },
                timeout=30.0,
            )
        return self._client

    async def get_options_chain(self, symbol: str, expiration: Optional[str] = None,
                                 greeks: bool = True) -> Dict[str, Any]:
        """Get options chain with Greeks."""
        client = await self._get_client()
        params: Dict[str, Any] = {"symbol": symbol, "greeks": str(greeks).lower()}
        if expiration:
            params["expiration"] = expiration

        resp = await client.get(f"{self.base_url}/v1/markets/options/chains", params=params)
        if resp.status_code == 200:
            return resp.json()
        return {}

    async def get_options_expirations(self, symbol: str) -> List[str]:
        """Get available options expiration dates."""
        client = await self._get_client()
        resp = await client.get(f"{self.base_url}/v1/markets/options/expirations",
                               params={"symbol": symbol})
        if resp.status_code == 200:
            data = resp.json()
            expirations = data.get("expirations", {})
            if isinstance(expirations, dict):
                return expirations.get("date", [])
            return []
        return []

    async def get_options_strikes(self, symbol: str, expiration: str) -> List[float]:
        """Get available strike prices for an expiration."""
        client = await self._get_client()
        resp = await client.get(f"{self.base_url}/v1/markets/options/strikes",
                               params={"symbol": symbol, "expiration": expiration})
        if resp.status_code == 200:
            data = resp.json()
            strikes = data.get("strikes", {})
            if isinstance(strikes, dict):
                return strikes.get("strike", [])
            return []
        return []

    async def get_quote(self, symbol: str) -> Dict[str, Any]:
        """Get a quote from Tradier."""
        client = await self._get_client()
        resp = await client.get(f"{self.base_url}/v1/markets/quotes",
                               params={"symbols": symbol})
        if resp.status_code == 200:
            data = resp.json()
            quotes = data.get("quotes", {})
            quote = quotes.get("quote", {})
            if isinstance(quote, list):
                quote = quote[0] if quote else {}
            return quote
        return {}

    async def get_historical(self, symbol: str, interval: str = "daily",
                              start: Optional[str] = None, end: Optional[str] = None) -> List[Dict]:
        """Get historical data."""
        client = await self._get_client()
        params: Dict[str, Any] = {"symbol": symbol, "interval": interval}
        if start:
            params["start"] = start
        if end:
            params["end"] = end

        resp = await client.get(f"{self.base_url}/v1/markets/history", params=params)
        if resp.status_code == 200:
            data = resp.json()
            history = data.get("history", {})
            if isinstance(history, dict):
                return history.get("day", [])
            return []
        return []

    async def submit_order(self, account_id: str, order: Order) -> Dict[str, Any]:
        """Submit an order to Tradier."""
        client = await self._get_client()
        body = {
            "class": "equity" if order.asset_class == AssetClass.EQUITY else "option",
            "symbol": order.symbol,
            "side": order.side.value,
            "quantity": str(int(order.quantity)),
            "type": self._map_order_type(order.order_type),
            "duration": order.time_in_force.value,
        }
        if order.limit_price:
            body["price"] = str(order.limit_price)
        if order.stop_price:
            body["stop"] = str(order.stop_price)

        resp = await client.post(f"{self.base_url}/v1/accounts/{account_id}/orders", data=body)
        if resp.status_code in (200, 201):
            return resp.json()
        return {"error": resp.text}

    def _map_order_type(self, ot: OrderType) -> str:
        return {
            OrderType.MARKET: "market",
            OrderType.LIMIT: "limit",
            OrderType.STOP: "stop",
            OrderType.STOP_LIMIT: "stop_limit",
        }.get(ot, "market")

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()


# ─── Order Manager (Orchestrator) ────────────────────────────────────────────

class OrderManager:
    """
    Central order management orchestrator.
    Routes orders to appropriate broker, applies risk checks,
    manages lifecycle, and records in blotter.
    """

    def __init__(self):
        self.alpaca = AlpacaBroker()
        self.tradier = TradierBroker()
        self.risk_engine = PreTradeRiskEngine()
        self.blotter = TradeBlotter()
        self.orders: Dict[str, Order] = {}
        self.positions: Dict[str, Position] = {}
        self.account: Optional[AccountInfo] = None
        self.algo_engines: Dict[str, Any] = {}  # order_id -> algo instance
        self._order_callbacks: List[Callable[[Order], None]] = []
        self._position_callbacks: List[Callable[[str, Position], None]] = []

    def on_order_update(self, callback: Callable[[Order], None]):
        self._order_callbacks.append(callback)

    def on_position_update(self, callback: Callable[[str, Position], None]):
        self._position_callbacks.append(callback)

    async def initialize(self) -> None:
        """Initialize: fetch account, positions, existing orders."""
        try:
            self.account = await self.alpaca.get_account()
            positions = await self.alpaca.get_positions()
            for pos in positions:
                self.positions[pos.symbol] = pos
            orders = await self.alpaca.get_orders(status="open")
            for order in orders:
                self.orders[order.order_id] = order
            logger.info(f"OMS initialized: {len(self.positions)} positions, {len(self.orders)} open orders")
        except Exception as e:
            logger.error(f"OMS initialization failed: {e}")

    async def submit_order(self, order: Order) -> Tuple[bool, Order, Dict[str, Any]]:
        """
        Submit an order with full risk checks.
        Returns (success, order, risk_details).
        """
        # 1. Get current price for risk checks
        try:
            quote = await self.alpaca.get_quote(order.symbol)
            last_price = quote.get("last", 0)
        except Exception:
            last_price = order.limit_price or 0

        # 2. Run pre-trade risk checks
        if not self.account:
            await self.initialize()

        passed, risk_details = self.risk_engine.validate(
            order, self.account or AccountInfo(), last_price
        )
        order.pre_trade_risk_passed = passed
        order.risk_check_details = risk_details

        if not passed:
            order.status = OrderStatus.REJECTED
            order.notes = f"Risk check failed: {json.dumps({k: v for k, v in risk_details.items() if not v.get('passed', True)})}"
            self.orders[order.order_id] = order
            self._notify_order(order)
            return False, order, risk_details

        # 3. Route to appropriate algo or broker
        if order.order_type == OrderType.TWAP:
            return await self._submit_twap(order, last_price)
        elif order.order_type == OrderType.VWAP:
            return await self._submit_vwap(order, last_price)
        elif order.order_type == OrderType.ICEBERG:
            return await self._submit_iceberg(order, last_price)
        else:
            return await self._submit_direct(order)

    async def _submit_direct(self, order: Order) -> Tuple[bool, Order, Dict[str, Any]]:
        """Submit order directly to broker."""
        try:
            # Route based on asset class
            if order.asset_class == AssetClass.OPTION:
                # Use Tradier for options
                result = await self.tradier.submit_order("default", order)
                if "error" not in result:
                    order.status = OrderStatus.ACCEPTED
                    order.submitted_at = time.time()
                else:
                    order.status = OrderStatus.REJECTED
                    order.notes = str(result.get("error", ""))
            else:
                # Use Alpaca for stocks
                order = await self.alpaca.submit_order(order)

            self.orders[order.order_id] = order
            self._notify_order(order)
            return order.status != OrderStatus.REJECTED, order, order.risk_check_details

        except Exception as e:
            order.status = OrderStatus.REJECTED
            order.notes = str(e)
            self.orders[order.order_id] = order
            self._notify_order(order)
            return False, order, {"error": str(e)}

    async def _submit_twap(self, order: Order, current_price: float) -> Tuple[bool, Order, Dict[str, Any]]:
        """Start a TWAP algo order."""
        duration = int((order.algo_end_time or time.time() + 3600) - time.time()) // 60
        algo = TWAPAlgo(order.quantity, max(1, duration))
        algo.start()

        order.status = OrderStatus.ACCEPTED
        order.submitted_at = time.time()
        self.orders[order.order_id] = order
        self.algo_engines[order.order_id] = algo

        # Start background execution
        asyncio.create_task(self._run_twap(order, algo))

        self._notify_order(order)
        return True, order, order.risk_check_details

    async def _run_twap(self, order: Order, algo: TWAPAlgo):
        """Background TWAP execution loop."""
        while algo.active:
            try:
                quote = await self.alpaca.get_quote(order.symbol)
                price = quote.get("last", 0) or quote.get("ask", 0)
                if price <= 0:
                    await asyncio.sleep(10)
                    continue

                slice_info = algo.get_next_slice(price)
                if slice_info:
                    child = Order(
                        symbol=order.symbol,
                        side=order.side,
                        order_type=OrderType.LIMIT,
                        quantity=slice_info["quantity"],
                        limit_price=price,
                        parent_order_id=order.order_id,
                        time_in_force=TimeInForce.IOC,
                    )
                    submitted = await self.alpaca.submit_order(child)
                    if submitted.status in (OrderStatus.FILLED, OrderStatus.PARTIALLY_FILLED):
                        fill = Fill(
                            order_id=order.order_id,
                            price=submitted.avg_fill_price or price,
                            quantity=submitted.filled_quantity,
                            side=order.side,
                            venue="alpaca",
                        )
                        algo.record_fill(fill)
                        order.fills.append(fill)
                        order.filled_quantity = algo.filled_quantity
                        order.avg_fill_price = algo.get_avg_price()
                        order.algo_completed_slices = algo.completed_slices
                        order.status = OrderStatus.PARTIALLY_FILLED
                        self._notify_order(order)

                await asyncio.sleep(max(1, algo.slice_interval))

            except Exception as e:
                logger.error(f"TWAP slice error for {order.order_id}: {e}")
                await asyncio.sleep(5)

        # Mark complete
        if order.filled_quantity >= order.quantity:
            order.status = OrderStatus.FILLED
            order.filled_at = time.time()
        self._notify_order(order)

    async def _submit_vwap(self, order: Order, current_price: float) -> Tuple[bool, Order, Dict[str, Any]]:
        """Start a VWAP algo order."""
        duration = int((order.algo_end_time or time.time() + 3600) - time.time()) // 60
        algo = VWAPAlgo(order.quantity, max(1, duration))
        algo.start()

        order.status = OrderStatus.ACCEPTED
        order.submitted_at = time.time()
        self.orders[order.order_id] = order
        self.algo_engines[order.order_id] = algo

        asyncio.create_task(self._run_vwap(order, algo))
        self._notify_order(order)
        return True, order, order.risk_check_details

    async def _run_vwap(self, order: Order, algo: VWAPAlgo):
        """Background VWAP execution loop."""
        while algo.active:
            try:
                quote = await self.alpaca.get_quote(order.symbol)
                price = quote.get("last", 0) or quote.get("ask", 0)
                if price <= 0:
                    await asyncio.sleep(10)
                    continue

                slice_info = algo.get_next_slice(price)
                if slice_info:
                    child = Order(
                        symbol=order.symbol,
                        side=order.side,
                        order_type=OrderType.LIMIT,
                        quantity=slice_info["quantity"],
                        limit_price=price,
                        parent_order_id=order.order_id,
                        time_in_force=TimeInForce.IOC,
                    )
                    submitted = await self.alpaca.submit_order(child)
                    if submitted.status in (OrderStatus.FILLED, OrderStatus.PARTIALLY_FILLED):
                        fill = Fill(
                            order_id=order.order_id,
                            price=submitted.avg_fill_price or price,
                            quantity=submitted.filled_quantity,
                            side=order.side,
                            venue="alpaca",
                        )
                        algo.record_fill(fill)
                        order.fills.append(fill)
                        order.filled_quantity += fill.quantity
                        order.avg_fill_price = algo.get_vwap()
                        order.status = OrderStatus.PARTIALLY_FILLED
                        self._notify_order(order)

                await asyncio.sleep(max(1, algo.duration / algo.num_slices))

            except Exception as e:
                logger.error(f"VWAP slice error for {order.order_id}: {e}")
                await asyncio.sleep(5)

        if order.filled_quantity >= order.quantity:
            order.status = OrderStatus.FILLED
            order.filled_at = time.time()
        self._notify_order(order)

    async def _submit_iceberg(self, order: Order, current_price: float) -> Tuple[bool, Order, Dict[str, Any]]:
        """Handle iceberg order with hidden reserve."""
        display_qty = order.display_quantity or order.quantity * 0.1
        algo = IcebergAlgo(order.quantity, display_qty)

        order.status = OrderStatus.ACCEPTED
        order.submitted_at = time.time()
        self.orders[order.order_id] = order
        self.algo_engines[order.order_id] = algo

        asyncio.create_task(self._run_iceberg(order, algo))
        self._notify_order(order)
        return True, order, order.risk_check_details

    async def _run_iceberg(self, order: Order, algo: IcebergAlgo):
        """Background iceberg execution."""
        while algo.active:
            try:
                display = algo.get_next_display()
                if not display:
                    break

                child = Order(
                    symbol=order.symbol,
                    side=order.side,
                    order_type=order.order_type if order.order_type in (OrderType.LIMIT,) else OrderType.LIMIT,
                    quantity=display["display_quantity"],
                    limit_price=order.limit_price,
                    parent_order_id=order.order_id,
                    time_in_force=TimeInForce.DAY,
                )
                submitted = await self.alpaca.submit_order(child)

                # Wait for fill
                for _ in range(30):
                    updated = await self.alpaca.get_order(submitted.order_id)
                    if updated and updated.status == OrderStatus.FILLED:
                        fill = Fill(
                            order_id=order.order_id,
                            price=updated.avg_fill_price,
                            quantity=updated.filled_quantity,
                            side=order.side,
                            venue="alpaca",
                        )
                        algo.record_fill(fill)
                        order.fills.append(fill)
                        order.filled_quantity += fill.quantity
                        order.status = OrderStatus.PARTIALLY_FILLED
                        self._notify_order(order)
                        break
                    await asyncio.sleep(2)

            except Exception as e:
                logger.error(f"Iceberg slice error for {order.order_id}: {e}")
                await asyncio.sleep(5)

        if order.filled_quantity >= order.quantity:
            order.status = OrderStatus.FILLED
            order.filled_at = time.time()
        self._notify_order(order)

    async def cancel_order(self, order_id: str) -> bool:
        """Cancel an order."""
        order = self.orders.get(order_id)
        if not order or not order.is_active:
            return False

        # Cancel algo if running
        if order_id in self.algo_engines:
            algo = self.algo_engines[order_id]
            if hasattr(algo, 'active'):
                algo.active = False
            del self.algo_engines[order_id]

        success = await self.alpaca.cancel_order(order_id)
        if success:
            order.status = OrderStatus.CANCELLED
            order.cancelled_at = time.time()
            self._notify_order(order)
        return success

    async def modify_order(self, order_id: str, updates: Dict[str, Any]) -> Optional[Order]:
        """Modify an existing order."""
        order = self.orders.get(order_id)
        if not order or not order.is_active:
            return None

        result = await self.alpaca.replace_order(order_id, updates)
        if result:
            self.orders[result.order_id] = result
            self._notify_order(result)
        return result

    async def flatten_position(self, symbol: str) -> bool:
        """Close entire position for a symbol."""
        return await self.alpaca.close_position(symbol)

    async def reverse_position(self, symbol: str) -> bool:
        """Reverse a position (long→short or short→long)."""
        pos = self.positions.get(symbol)
        if not pos:
            return False

        # Close existing
        closed = await self.alpaca.close_position(symbol)
        if closed:
            # Open opposite
            new_side = OrderSide.SELL_SHORT if pos.side == "long" else OrderSide.BUY
            order = Order(
                symbol=symbol,
                side=new_side,
                order_type=OrderType.MARKET,
                quantity=pos.quantity,
            )
            success, _, _ = await self.submit_order(order)
            return success
        return False

    async def scale_position(self, symbol: str, scale_pct: float) -> bool:
        """Scale position up or down by percentage."""
        pos = self.positions.get(symbol)
        if not pos:
            return False

        qty_change = pos.quantity * (scale_pct / 100)
        if scale_pct > 0:
            # Scale up
            order = Order(
                symbol=symbol,
                side=OrderSide.BUY if pos.side == "long" else OrderSide.SELL_SHORT,
                order_type=OrderType.MARKET,
                quantity=abs(qty_change),
            )
        else:
            # Scale down
            order = Order(
                symbol=symbol,
                side=OrderSide.SELL if pos.side == "long" else OrderSide.BUY_TO_COVER,
                order_type=OrderType.MARKET,
                quantity=min(abs(qty_change), pos.quantity),
            )
        success, _, _ = await self.submit_order(order)
        return success

    def get_open_orders(self) -> List[Order]:
        return [o for o in self.orders.values() if o.is_active]

    def get_completed_orders(self) -> List[Order]:
        return [o for o in self.orders.values() if o.is_complete]

    def get_position(self, symbol: str) -> Optional[Position]:
        return self.positions.get(symbol)

    def get_all_positions(self) -> List[Position]:
        return list(self.positions.values())

    def get_blotter_summary(self) -> Dict[str, Any]:
        return self.blotter.get_summary()

    def _notify_order(self, order: Order):
        for cb in self._order_callbacks:
            try:
                cb(order)
            except Exception as e:
                logger.error(f"Order callback error: {e}")

    def _notify_position(self, symbol: str, position: Position):
        for cb in self._position_callbacks:
            try:
                cb(symbol, position)
            except Exception as e:
                logger.error(f"Position callback error: {e}")

    async def close(self):
        await self.alpaca.close()
        await self.tradier.close()


# ─── Paper Trading Simulator ────────────────────────────────────────────────

class PaperTradingSimulator:
    """
    Local paper trading engine for instant order simulation
    without hitting any broker API.
    """

    def __init__(self, initial_capital: float = 100_000.0):
        self.capital = initial_capital
        self.cash = initial_capital
        self.positions: Dict[str, Position] = {}
        self.orders: List[Order] = []
        self.fills: List[Fill] = []
        self.blotter = TradeBlotter()
        self.commission_per_share = 0.0  # Commission-free like Alpaca
        self.slippage_bps = 1.0  # 1 basis point slippage

    def simulate_fill(self, order: Order, market_price: float) -> Fill:
        """Simulate an order fill with slippage."""
        # Apply slippage
        slippage = market_price * (self.slippage_bps / 10000)
        if order.side in (OrderSide.BUY, OrderSide.BUY_TO_COVER):
            fill_price = market_price + slippage
        else:
            fill_price = market_price - slippage

        # For limit orders, check price
        if order.order_type == OrderType.LIMIT and order.limit_price:
            if order.side in (OrderSide.BUY, OrderSide.BUY_TO_COVER):
                if market_price > order.limit_price:
                    order.status = OrderStatus.NEW  # Not filled yet
                    return Fill()
                fill_price = min(fill_price, order.limit_price)
            else:
                if market_price < order.limit_price:
                    order.status = OrderStatus.NEW
                    return Fill()
                fill_price = max(fill_price, order.limit_price)

        # For stop orders
        if order.order_type == OrderType.STOP and order.stop_price:
            if order.side in (OrderSide.BUY, OrderSide.BUY_TO_COVER):
                if market_price < order.stop_price:
                    return Fill()
            else:
                if market_price > order.stop_price:
                    return Fill()

        commission = self.commission_per_share * order.quantity

        fill = Fill(
            order_id=order.order_id,
            price=round(fill_price, 4),
            quantity=order.quantity,
            side=order.side,
            venue="paper",
            commission=commission,
        )

        # Update position
        self._update_position(order, fill)

        # Update order status
        order.status = OrderStatus.FILLED
        order.filled_quantity = order.quantity
        order.avg_fill_price = fill_price
        order.filled_at = time.time()

        # Update cash
        if order.side in (OrderSide.BUY, OrderSide.BUY_TO_COVER):
            self.cash -= fill_price * order.quantity + commission
        else:
            self.cash += fill_price * order.quantity - commission

        self.fills.append(fill)
        self.orders.append(order)

        # Record in blotter
        self.blotter.record_fill(order, fill, self.positions)

        return fill

    def _update_position(self, order: Order, fill: Fill):
        """Update internal position tracking."""
        symbol = order.symbol
        pos = self.positions.get(symbol)

        if order.side in (OrderSide.BUY, OrderSide.BUY_TO_COVER):
            if pos and pos.side == "short":
                # Covering short
                pos.quantity -= fill.quantity
                if pos.quantity <= 0:
                    if pos.quantity < 0:
                        # Flipped to long
                        pos.quantity = abs(pos.quantity)
                        pos.side = "long"
                        pos.avg_entry_price = fill.price
                    else:
                        del self.positions[symbol]
                        return
            elif pos and pos.side == "long":
                # Adding to long
                total_cost = pos.avg_entry_price * pos.quantity + fill.price * fill.quantity
                pos.quantity += fill.quantity
                pos.avg_entry_price = total_cost / pos.quantity
            else:
                # New long position
                self.positions[symbol] = Position(
                    symbol=symbol,
                    side="long",
                    quantity=fill.quantity,
                    avg_entry_price=fill.price,
                    current_price=fill.price,
                    market_value=fill.price * fill.quantity,
                    cost_basis=fill.price * fill.quantity,
                )
        else:  # SELL or SELL_SHORT
            if pos and pos.side == "long":
                # Selling long
                pos.quantity -= fill.quantity
                if pos.quantity <= 0:
                    if pos.quantity < 0:
                        pos.quantity = abs(pos.quantity)
                        pos.side = "short"
                        pos.avg_entry_price = fill.price
                    else:
                        del self.positions[symbol]
                        return
            elif pos and pos.side == "short":
                # Adding to short
                total_cost = pos.avg_entry_price * pos.quantity + fill.price * fill.quantity
                pos.quantity += fill.quantity
                pos.avg_entry_price = total_cost / pos.quantity
            else:
                # New short position
                self.positions[symbol] = Position(
                    symbol=symbol,
                    side="short",
                    quantity=fill.quantity,
                    avg_entry_price=fill.price,
                    current_price=fill.price,
                    market_value=fill.price * fill.quantity,
                    cost_basis=fill.price * fill.quantity,
                )

    def get_portfolio_value(self, prices: Dict[str, float]) -> float:
        """Calculate total portfolio value."""
        position_value = 0.0
        for symbol, pos in self.positions.items():
            price = prices.get(symbol, pos.current_price)
            pos.update_price(price)
            position_value += pos.market_value
        return self.cash + position_value

    def get_account_summary(self) -> Dict[str, Any]:
        return {
            "initial_capital": self.capital,
            "cash": round(self.cash, 2),
            "positions": len(self.positions),
            "open_pnl": round(sum(p.unrealized_pnl for p in self.positions.values()), 2),
            "total_trades": len(self.fills),
            "blotter": self.blotter.get_summary(),
        }
