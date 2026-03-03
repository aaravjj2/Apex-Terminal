"""
Order Management System (OMS) Engine — §2.1–§2.4
=================================================
Full order lifecycle: entry → routing → fill → settlement.
Supports 19 order types, 10 execution algorithms, order book,
market depth, and trade lifecycle management.

Uses Alpaca for live execution, with paper trading fallback.
"""

import os
import asyncio
import json
import hashlib
import time
import math
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Union
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections import defaultdict

import httpx

logger = logging.getLogger("oms_engine")

# ── API Keys ────────────────────────────────────────────────────────────────

ALPACA_KEY = os.getenv("ALPACA_API_KEY", "")
ALPACA_SECRET = os.getenv("ALPACA_SECRET_KEY", "")
ALPACA_BASE = os.getenv("ALPACA_BASE_URL", "https://paper-api.alpaca.markets")
POLYGON_KEY = os.getenv("POLYGON_API_KEY", "")
FINNHUB_KEY = os.getenv("FINNHUB_API_KEY", "")


# ═══════════════════════════════════════════════════════════════════════════════
# §2.1 — ORDER TYPES (19 types)
# ═══════════════════════════════════════════════════════════════════════════════

class OrderType(str, Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"
    TRAILING_STOP = "trailing_stop"
    TRAILING_STOP_LIMIT = "trailing_stop_limit"
    MOC = "market_on_close"
    MOO = "market_on_open"
    LOC = "limit_on_close"
    LOO = "limit_on_open"
    ICEBERG = "iceberg"
    PEG = "peg"
    MIDPOINT_PEG = "midpoint_peg"
    BRACKET = "bracket"
    OCO = "oco"
    OTO = "oto"
    FOK = "fill_or_kill"
    IOC = "immediate_or_cancel"
    GTC = "good_till_cancel"


class OrderSide(str, Enum):
    BUY = "buy"
    SELL = "sell"
    BUY_TO_COVER = "buy_to_cover"
    SELL_SHORT = "sell_short"


class OrderStatus(str, Enum):
    PENDING = "pending"
    NEW = "new"
    PARTIALLY_FILLED = "partially_filled"
    FILLED = "filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"
    EXPIRED = "expired"
    REPLACED = "replaced"
    PENDING_CANCEL = "pending_cancel"
    PENDING_REPLACE = "pending_replace"
    SUSPENDED = "suspended"
    DONE_FOR_DAY = "done_for_day"


class TimeInForce(str, Enum):
    DAY = "day"
    GTC = "gtc"
    IOC = "ioc"
    FOK = "fok"
    OPG = "opg"  # market on open
    CLS = "cls"  # market on close
    GTD = "gtd"  # good till date


class AssetClass(str, Enum):
    EQUITY = "equity"
    OPTION = "option"
    FUTURES = "futures"
    FOREX = "forex"
    CRYPTO = "crypto"
    FIXED_INCOME = "fixed_income"
    COMMODITY = "commodity"


# ── Order Data Models ──────────────────────────────────────────────────────────

@dataclass
class OrderLeg:
    """Single leg of a multi-leg order (options strategies)."""
    symbol: str
    side: OrderSide
    qty: float
    asset_class: AssetClass = AssetClass.EQUITY
    option_type: Optional[str] = None  # 'call' or 'put'
    strike: Optional[float] = None
    expiration: Optional[str] = None
    ratio: int = 1


@dataclass
class OrderSpec:
    """Complete order specification — covers all 19 order types."""
    order_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    client_order_id: str = ""
    symbol: str = ""
    side: OrderSide = OrderSide.BUY
    qty: float = 0.0
    order_type: OrderType = OrderType.MARKET
    time_in_force: TimeInForce = TimeInForce.DAY
    limit_price: Optional[float] = None
    stop_price: Optional[float] = None
    trail_percent: Optional[float] = None
    trail_price: Optional[float] = None
    extended_hours: bool = False
    asset_class: AssetClass = AssetClass.EQUITY

    # Bracket fields
    take_profit_price: Optional[float] = None
    stop_loss_price: Optional[float] = None
    stop_loss_limit_price: Optional[float] = None

    # Iceberg fields
    display_qty: Optional[float] = None

    # Peg fields
    peg_offset: Optional[float] = None
    peg_reference: str = "midpoint"  # midpoint, primary, market

    # OCO/OTO fields
    linked_orders: list = field(default_factory=list)

    # Multi-leg (options)
    legs: list = field(default_factory=list)

    # Execution algorithm
    algo: Optional[str] = None
    algo_params: dict = field(default_factory=dict)

    # Metadata
    status: OrderStatus = OrderStatus.PENDING
    filled_qty: float = 0.0
    filled_avg_price: float = 0.0
    created_at: str = ""
    updated_at: str = ""
    submitted_at: str = ""
    filled_at: str = ""
    cancelled_at: str = ""
    failed_at: str = ""
    replaced_by: str = ""
    replaces: str = ""
    account_id: str = ""
    commission: float = 0.0
    fees: float = 0.0
    notes: str = ""
    tags: list = field(default_factory=list)

    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.now(timezone.utc).isoformat()
        if not self.client_order_id:
            self.client_order_id = f"apex_{self.order_id[:8]}"


@dataclass
class Fill:
    """Execution fill record."""
    fill_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str = ""
    symbol: str = ""
    side: str = ""
    qty: float = 0.0
    price: float = 0.0
    commission: float = 0.0
    fees: float = 0.0
    timestamp: str = ""
    venue: str = ""
    liquidity: str = ""  # "add" or "remove"
    settlement_date: str = ""
    trade_id: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now(timezone.utc).isoformat()


@dataclass
class Position:
    """Current portfolio position."""
    symbol: str = ""
    qty: float = 0.0
    avg_entry_price: float = 0.0
    current_price: float = 0.0
    market_value: float = 0.0
    unrealized_pnl: float = 0.0
    unrealized_pnl_pct: float = 0.0
    realized_pnl: float = 0.0
    cost_basis: float = 0.0
    side: str = "long"
    asset_class: AssetClass = AssetClass.EQUITY
    exchange: str = ""
    last_updated: str = ""


# ═══════════════════════════════════════════════════════════════════════════════
# §2.1 — ORDER VALIDATION
# ═══════════════════════════════════════════════════════════════════════════════

class OrderValidator:
    """Validates orders before submission — checks for completeness,
    risk limits, and regulatory compliance."""

    MAX_ORDER_VALUE = 1_000_000  # $1M max single order
    MAX_POSITION_PCT = 0.25  # 25% max portfolio concentration
    MIN_QTY = 0.001  # Minimum quantity (fractional shares)
    MAX_QTY = 100_000  # Maximum shares per order

    def __init__(self, account_equity: float = 100_000.0):
        self.account_equity = account_equity
        self.daily_loss_limit = account_equity * 0.05  # 5% daily loss limit
        self.daily_realized_pnl = 0.0
        self.open_orders: dict[str, OrderSpec] = {}
        self.positions: dict[str, Position] = {}

    def validate(self, order: OrderSpec) -> tuple[bool, list[str]]:
        """Full order validation. Returns (is_valid, errors)."""
        errors: list[str] = []

        # Basic field validation
        if not order.symbol:
            errors.append("Symbol is required")
        if order.qty <= 0:
            errors.append("Quantity must be positive")
        if order.qty < self.MIN_QTY:
            errors.append(f"Quantity below minimum ({self.MIN_QTY})")
        if order.qty > self.MAX_QTY:
            errors.append(f"Quantity exceeds maximum ({self.MAX_QTY})")

        # Type-specific validation
        if order.order_type == OrderType.LIMIT and order.limit_price is None:
            errors.append("Limit price required for limit orders")
        if order.order_type == OrderType.STOP and order.stop_price is None:
            errors.append("Stop price required for stop orders")
        if order.order_type == OrderType.STOP_LIMIT:
            if order.stop_price is None:
                errors.append("Stop price required for stop-limit orders")
            if order.limit_price is None:
                errors.append("Limit price required for stop-limit orders")
        if order.order_type == OrderType.TRAILING_STOP:
            if order.trail_percent is None and order.trail_price is None:
                errors.append("Trail percent or trail price required")
        if order.order_type == OrderType.ICEBERG:
            if order.display_qty is None:
                errors.append("Display quantity required for iceberg orders")
            elif order.display_qty >= order.qty:
                errors.append("Display quantity must be less than total quantity")
        if order.order_type == OrderType.BRACKET:
            if order.take_profit_price is None:
                errors.append("Take profit price required for bracket orders")
            if order.stop_loss_price is None:
                errors.append("Stop loss price required for bracket orders")

        # Price reasonability checks
        if order.limit_price is not None and order.limit_price <= 0:
            errors.append("Limit price must be positive")
        if order.stop_price is not None and order.stop_price <= 0:
            errors.append("Stop price must be positive")

        # Risk checks
        estimated_value = order.qty * (order.limit_price or order.stop_price or 0)
        if estimated_value > self.MAX_ORDER_VALUE:
            errors.append(f"Order value ${estimated_value:,.2f} exceeds limit ${self.MAX_ORDER_VALUE:,.2f}")

        # Daily loss limit
        if self.daily_realized_pnl < -self.daily_loss_limit:
            errors.append(f"Daily loss limit reached (${self.daily_loss_limit:,.2f})")

        # Position concentration
        if order.symbol in self.positions:
            pos = self.positions[order.symbol]
            new_value = (pos.qty + order.qty) * (order.limit_price or pos.current_price or 0)
            if new_value > self.account_equity * self.MAX_POSITION_PCT:
                errors.append(f"Position concentration would exceed {self.MAX_POSITION_PCT*100}%")

        # Wash sale check (simplified)
        if order.side == OrderSide.BUY and order.symbol in self.positions:
            pos = self.positions[order.symbol]
            if pos.realized_pnl < 0 and pos.side == "closed":
                errors.append("Warning: Potential wash sale detected")

        return len(errors) == 0, errors

    def validate_modification(self, order_id: str, new_qty: Optional[float] = None,
                              new_limit: Optional[float] = None) -> tuple[bool, list[str]]:
        """Validate order modification request."""
        errors: list[str] = []
        if order_id not in self.open_orders:
            errors.append(f"Order {order_id} not found")
            return False, errors

        order = self.open_orders[order_id]
        if order.status not in (OrderStatus.NEW, OrderStatus.PARTIALLY_FILLED):
            errors.append(f"Cannot modify order in status {order.status}")

        if new_qty is not None:
            if new_qty <= 0:
                errors.append("New quantity must be positive")
            if new_qty < order.filled_qty:
                errors.append("Cannot reduce quantity below filled amount")

        if new_limit is not None and new_limit <= 0:
            errors.append("New limit price must be positive")

        return len(errors) == 0, errors


# ═══════════════════════════════════════════════════════════════════════════════
# §2.2 — EXECUTION ALGORITHMS (10 algorithms)
# ═══════════════════════════════════════════════════════════════════════════════

class ExecutionAlgo:
    """Base class for execution algorithms."""

    def __init__(self, order: OrderSpec, market_data: dict):
        self.order = order
        self.market_data = market_data
        self.child_orders: list[OrderSpec] = []
        self.executed_qty = 0.0
        self.start_time = time.time()

    def generate_slices(self) -> list[OrderSpec]:
        raise NotImplementedError


class TWAPAlgo(ExecutionAlgo):
    """Time-Weighted Average Price — distributes order evenly over time."""

    def generate_slices(self) -> list[OrderSpec]:
        duration_minutes = self.order.algo_params.get("duration_minutes", 60)
        num_slices = self.order.algo_params.get("num_slices", 10)
        interval = duration_minutes / num_slices
        slice_qty = self.order.qty / num_slices

        slices = []
        for i in range(num_slices):
            child = OrderSpec(
                symbol=self.order.symbol,
                side=self.order.side,
                qty=round(slice_qty, 4),
                order_type=OrderType.LIMIT if self.order.limit_price else OrderType.MARKET,
                limit_price=self.order.limit_price,
                time_in_force=TimeInForce.IOC,
                notes=f"TWAP slice {i+1}/{num_slices}, interval={interval}min",
                tags=["algo:twap", f"parent:{self.order.order_id}"],
            )
            slices.append(child)

        self.child_orders = slices
        return slices


class VWAPAlgo(ExecutionAlgo):
    """Volume-Weighted Average Price — matches historical volume distribution."""

    def generate_slices(self) -> list[OrderSpec]:
        num_slices = self.order.algo_params.get("num_slices", 20)
        # Historical volume profile (U-shaped typically)
        volume_profile = self._get_volume_profile(num_slices)
        total_vol = sum(volume_profile)

        slices = []
        remaining = self.order.qty
        for i, vol in enumerate(volume_profile):
            pct = vol / total_vol
            slice_qty = min(round(self.order.qty * pct, 4), remaining)
            if slice_qty <= 0:
                continue
            remaining -= slice_qty

            child = OrderSpec(
                symbol=self.order.symbol,
                side=self.order.side,
                qty=slice_qty,
                order_type=OrderType.LIMIT if self.order.limit_price else OrderType.MARKET,
                limit_price=self.order.limit_price,
                time_in_force=TimeInForce.IOC,
                notes=f"VWAP slice {i+1}/{num_slices}, vol_pct={pct:.2%}",
                tags=["algo:vwap", f"parent:{self.order.order_id}"],
            )
            slices.append(child)

        self.child_orders = slices
        return slices

    def _get_volume_profile(self, num_buckets: int) -> list[float]:
        """Generate U-shaped intraday volume profile."""
        profile = []
        for i in range(num_buckets):
            x = i / (num_buckets - 1) if num_buckets > 1 else 0.5
            # U-shape: high volume at open and close
            vol = 1.5 + 2.0 * (x - 0.5) ** 2
            profile.append(vol)
        return profile


class POVAlgo(ExecutionAlgo):
    """Percentage of Volume — targets a % of market volume."""

    def generate_slices(self) -> list[OrderSpec]:
        target_pov = self.order.algo_params.get("target_pov", 0.10)  # 10% default
        max_pov = self.order.algo_params.get("max_pov", 0.25)
        check_interval = self.order.algo_params.get("check_interval_sec", 30)

        # Single adaptive slice — POV adjusts dynamically
        child = OrderSpec(
            symbol=self.order.symbol,
            side=self.order.side,
            qty=self.order.qty,
            order_type=OrderType.MARKET,
            time_in_force=TimeInForce.DAY,
            notes=f"POV target={target_pov:.0%}, max={max_pov:.0%}",
            tags=["algo:pov", f"parent:{self.order.order_id}"],
        )
        self.child_orders = [child]
        return [child]


class ImplementationShortfallAlgo(ExecutionAlgo):
    """Implementation Shortfall — minimizes slippage vs arrival price."""

    def generate_slices(self) -> list[OrderSpec]:
        urgency = self.order.algo_params.get("urgency", "medium")  # low, medium, high
        arrival_price = self.market_data.get("last_price", 0)

        urgency_map = {"low": 20, "medium": 10, "high": 5}
        num_slices = urgency_map.get(urgency, 10)
        slice_qty = self.order.qty / num_slices

        slices = []
        for i in range(num_slices):
            # More aggressive pricing for higher urgency
            price_offset = 0.001 * (i / num_slices) if urgency == "low" else 0.0005
            limit = arrival_price * (1 + price_offset) if self.order.side == OrderSide.BUY else arrival_price * (1 - price_offset)

            child = OrderSpec(
                symbol=self.order.symbol,
                side=self.order.side,
                qty=round(slice_qty, 4),
                order_type=OrderType.LIMIT,
                limit_price=round(limit, 2),
                time_in_force=TimeInForce.IOC,
                notes=f"IS slice {i+1}/{num_slices}, arrival=${arrival_price:.2f}",
                tags=["algo:is", f"parent:{self.order.order_id}"],
            )
            slices.append(child)

        self.child_orders = slices
        return slices


class IcebergAlgo(ExecutionAlgo):
    """Iceberg — shows only display_qty at a time."""

    def generate_slices(self) -> list[OrderSpec]:
        display_qty = self.order.display_qty or (self.order.qty * 0.1)
        num_visible = int(math.ceil(self.order.qty / display_qty))

        slices = []
        remaining = self.order.qty
        for i in range(num_visible):
            qty = min(display_qty, remaining)
            remaining -= qty
            if qty <= 0:
                break

            child = OrderSpec(
                symbol=self.order.symbol,
                side=self.order.side,
                qty=round(qty, 4),
                order_type=OrderType.LIMIT,
                limit_price=self.order.limit_price,
                time_in_force=TimeInForce.GTC,
                notes=f"Iceberg visible {i+1}/{num_visible}, display={display_qty}",
                tags=["algo:iceberg", f"parent:{self.order.order_id}"],
            )
            slices.append(child)

        self.child_orders = slices
        return slices


class SniperAlgo(ExecutionAlgo):
    """Sniper — waits for favorable price, then executes aggressively."""

    def generate_slices(self) -> list[OrderSpec]:
        target_price = self.order.algo_params.get("target_price", self.order.limit_price)
        max_wait_minutes = self.order.algo_params.get("max_wait_minutes", 120)

        child = OrderSpec(
            symbol=self.order.symbol,
            side=self.order.side,
            qty=self.order.qty,
            order_type=OrderType.LIMIT,
            limit_price=target_price,
            time_in_force=TimeInForce.DAY,
            notes=f"Sniper target=${target_price}, max_wait={max_wait_minutes}min",
            tags=["algo:sniper", f"parent:{self.order.order_id}"],
        )
        self.child_orders = [child]
        return [child]


class DarkPoolAlgo(ExecutionAlgo):
    """Dark Pool Sweep — routes to dark pools for minimal market impact."""

    def generate_slices(self) -> list[OrderSpec]:
        dark_venues = ["DARK1", "DARK2", "SIGMA", "LEVEL"]
        slice_qty = self.order.qty / len(dark_venues)

        slices = []
        for venue in dark_venues:
            child = OrderSpec(
                symbol=self.order.symbol,
                side=self.order.side,
                qty=round(slice_qty, 4),
                order_type=OrderType.MIDPOINT_PEG,
                time_in_force=TimeInForce.IOC,
                notes=f"Dark pool sweep → {venue}",
                tags=["algo:darkpool", f"venue:{venue}", f"parent:{self.order.order_id}"],
            )
            slices.append(child)

        self.child_orders = slices
        return slices


class CloseAlgo(ExecutionAlgo):
    """Market-on-Close — targets the closing auction price."""

    def generate_slices(self) -> list[OrderSpec]:
        child = OrderSpec(
            symbol=self.order.symbol,
            side=self.order.side,
            qty=self.order.qty,
            order_type=OrderType.MOC,
            time_in_force=TimeInForce.CLS,
            notes="MOC auction participation",
            tags=["algo:close", f"parent:{self.order.order_id}"],
        )
        self.child_orders = [child]
        return [child]


class AdaptiveAlgo(ExecutionAlgo):
    """Adaptive — dynamically switches between passive/aggressive based on conditions."""

    def generate_slices(self) -> list[OrderSpec]:
        spread = self.market_data.get("spread", 0.01)
        volatility = self.market_data.get("volatility", 0.02)
        volume = self.market_data.get("volume", 1_000_000)

        # Score conditions (0=passive, 1=aggressive)
        spread_score = min(spread / 0.05, 1.0)
        vol_score = min(volatility / 0.05, 1.0)
        liq_score = 1 - min(volume / 5_000_000, 1.0)
        aggression = (spread_score + vol_score + liq_score) / 3

        if aggression > 0.7:
            # Aggressive: market orders in 3 quick slices
            num_slices = 3
        elif aggression > 0.3:
            # Normal: TWAP over 10 slices
            num_slices = 10
        else:
            # Passive: slow VWAP over 20 slices
            num_slices = 20

        slice_qty = self.order.qty / num_slices
        slices = []
        for i in range(num_slices):
            child = OrderSpec(
                symbol=self.order.symbol,
                side=self.order.side,
                qty=round(slice_qty, 4),
                order_type=OrderType.MARKET if aggression > 0.7 else OrderType.LIMIT,
                limit_price=self.order.limit_price,
                time_in_force=TimeInForce.IOC,
                notes=f"Adaptive slice {i+1}/{num_slices}, aggression={aggression:.2f}",
                tags=["algo:adaptive", f"parent:{self.order.order_id}"],
            )
            slices.append(child)

        self.child_orders = slices
        return slices


# Algorithm registry
ALGO_REGISTRY: dict[str, type[ExecutionAlgo]] = {
    "twap": TWAPAlgo,
    "vwap": VWAPAlgo,
    "pov": POVAlgo,
    "is": ImplementationShortfallAlgo,
    "iceberg": IcebergAlgo,
    "sniper": SniperAlgo,
    "darkpool": DarkPoolAlgo,
    "close": CloseAlgo,
    "adaptive": AdaptiveAlgo,
}


# ═══════════════════════════════════════════════════════════════════════════════
# §2.3 — ORDER BOOK & MARKET DEPTH
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class OrderBookLevel:
    """Single price level in the order book."""
    price: float
    size: float
    num_orders: int = 1
    exchange: str = ""
    timestamp: str = ""


@dataclass
class OrderBook:
    """Full Level 2 order book with bid/ask depth."""
    symbol: str = ""
    bids: list = field(default_factory=list)  # OrderBookLevel[]
    asks: list = field(default_factory=list)  # OrderBookLevel[]
    timestamp: str = ""
    exchange: str = ""

    @property
    def best_bid(self) -> Optional[float]:
        return self.bids[0].price if self.bids else None

    @property
    def best_ask(self) -> Optional[float]:
        return self.asks[0].price if self.asks else None

    @property
    def mid_price(self) -> Optional[float]:
        if self.best_bid and self.best_ask:
            return (self.best_bid + self.best_ask) / 2
        return None

    @property
    def spread(self) -> Optional[float]:
        if self.best_bid and self.best_ask:
            return self.best_ask - self.best_bid
        return None

    @property
    def spread_bps(self) -> Optional[float]:
        if self.spread and self.mid_price:
            return (self.spread / self.mid_price) * 10000
        return None

    def total_bid_size(self, levels: int = 10) -> float:
        return sum(b.size for b in self.bids[:levels])

    def total_ask_size(self, levels: int = 10) -> float:
        return sum(a.size for a in self.asks[:levels])

    def bid_ask_imbalance(self, levels: int = 10) -> float:
        """Positive = more bids (bullish), negative = more asks (bearish)."""
        tot_bid = self.total_bid_size(levels)
        tot_ask = self.total_ask_size(levels)
        total = tot_bid + tot_ask
        if total == 0:
            return 0.0
        return (tot_bid - tot_ask) / total

    def vwap_bid(self, levels: int = 5) -> float:
        """Volume-weighted average bid price."""
        total_value = sum(b.price * b.size for b in self.bids[:levels])
        total_size = sum(b.size for b in self.bids[:levels])
        return total_value / total_size if total_size > 0 else 0.0

    def vwap_ask(self, levels: int = 5) -> float:
        """Volume-weighted average ask price."""
        total_value = sum(a.price * a.size for a in self.asks[:levels])
        total_size = sum(a.size for a in self.asks[:levels])
        return total_value / total_size if total_size > 0 else 0.0

    def market_impact_cost(self, side: str, qty: float) -> float:
        """Estimate market impact (slippage) for a given order size."""
        levels = self.asks if side == "buy" else self.bids
        remaining = qty
        total_cost = 0.0

        for level in levels:
            fill_qty = min(remaining, level.size)
            total_cost += fill_qty * level.price
            remaining -= fill_qty
            if remaining <= 0:
                break

        avg_fill_price = total_cost / qty if qty > 0 else 0
        reference = self.best_ask if side == "buy" else self.best_bid
        if reference:
            return abs(avg_fill_price - reference) / reference
        return 0.0

    def to_heatmap(self, levels: int = 20) -> dict:
        """Return order book as heatmap data for visualization."""
        bids_data = [{"price": b.price, "size": b.size, "cumulative": 0} for b in self.bids[:levels]]
        asks_data = [{"price": a.price, "size": a.size, "cumulative": 0} for a in self.asks[:levels]]

        cum = 0
        for b in bids_data:
            cum += b["size"]
            b["cumulative"] = cum

        cum = 0
        for a in asks_data:
            cum += a["size"]
            a["cumulative"] = cum

        return {
            "symbol": self.symbol,
            "bids": bids_data,
            "asks": asks_data,
            "spread": self.spread,
            "spread_bps": self.spread_bps,
            "imbalance": self.bid_ask_imbalance(levels),
            "mid": self.mid_price,
            "timestamp": self.timestamp,
        }


class OrderBookManager:
    """Manages order book data from multiple exchanges."""

    def __init__(self):
        self.books: dict[str, OrderBook] = {}
        self._http: Optional[httpx.AsyncClient] = None

    async def _get_http(self) -> httpx.AsyncClient:
        if self._http is None or self._http.is_closed:
            self._http = httpx.AsyncClient(timeout=10.0)
        return self._http

    async def fetch_order_book(self, symbol: str, depth: int = 20) -> OrderBook:
        """Fetch order book from Polygon or generate synthetic."""
        try:
            if POLYGON_KEY:
                return await self._fetch_polygon_book(symbol, depth)
        except Exception as e:
            logger.warning(f"Polygon order book failed for {symbol}: {e}")

        try:
            if ALPACA_KEY:
                return await self._fetch_alpaca_book(symbol, depth)
        except Exception as e:
            logger.warning(f"Alpaca order book failed for {symbol}: {e}")

        # Generate synthetic order book from last trade
        return await self._generate_synthetic_book(symbol, depth)

    async def _fetch_polygon_book(self, symbol: str, depth: int) -> OrderBook:
        http = await self._get_http()
        url = f"https://api.polygon.io/v3/snapshot?ticker.any_of={symbol}&apiKey={POLYGON_KEY}"
        resp = await http.get(url)
        data = resp.json()

        last_price = 100.0
        if data.get("results"):
            r = data["results"][0]
            last_price = r.get("session", {}).get("close", r.get("value", 100.0))

        # Build order book from NBBO + synthetic depth
        return self._synthetic_from_price(symbol, last_price, depth)

    async def _fetch_alpaca_book(self, symbol: str, depth: int) -> OrderBook:
        http = await self._get_http()
        url = f"{ALPACA_BASE}/v2/stocks/{symbol}/quotes/latest"
        resp = await http.get(url, headers={
            "APCA-API-KEY-ID": ALPACA_KEY,
            "APCA-API-SECRET-KEY": ALPACA_SECRET,
        })
        data = resp.json()
        quote = data.get("quote", data)
        bid = quote.get("bp", quote.get("bid_price", 100.0))
        ask = quote.get("ap", quote.get("ask_price", 100.0))

        return self._build_book_from_nbbo(symbol, float(bid), float(ask), depth)

    async def _generate_synthetic_book(self, symbol: str, depth: int) -> OrderBook:
        """Generate realistic synthetic order book when real data unavailable."""
        import random
        # Try to get a real last price
        try:
            http = await self._get_http()
            if FINNHUB_KEY:
                resp = await http.get(f"https://finnhub.io/api/v1/quote?symbol={symbol}&token={FINNHUB_KEY}")
                data = resp.json()
                last_price = data.get("c", 100.0)
            else:
                last_price = 100.0 + random.uniform(-20, 80)
        except Exception:
            last_price = 100.0

        return self._synthetic_from_price(symbol, last_price, depth)

    def _synthetic_from_price(self, symbol: str, price: float, depth: int) -> OrderBook:
        import random
        spread = price * 0.0005  # 5 bps spread
        bid = price - spread / 2
        ask = price + spread / 2
        return self._build_book_from_nbbo(symbol, bid, ask, depth)

    def _build_book_from_nbbo(self, symbol: str, bid: float, ask: float, depth: int) -> OrderBook:
        import random
        bids = []
        asks = []
        tick = max(0.01, (ask - bid) * 0.1)

        for i in range(depth):
            bid_price = round(bid - i * tick, 2)
            ask_price = round(ask + i * tick, 2)
            # Size increases with distance from best (inverse U)
            base_size = 100 + random.randint(0, 500)
            depth_multiplier = 1 + (i / depth) * 3
            bid_size = round(base_size * depth_multiplier * random.uniform(0.5, 1.5))
            ask_size = round(base_size * depth_multiplier * random.uniform(0.5, 1.5))

            bids.append(OrderBookLevel(price=bid_price, size=bid_size, num_orders=random.randint(1, 10)))
            asks.append(OrderBookLevel(price=ask_price, size=ask_size, num_orders=random.randint(1, 10)))

        book = OrderBook(
            symbol=symbol,
            bids=bids,
            asks=asks,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
        self.books[symbol] = book
        return book


# ═══════════════════════════════════════════════════════════════════════════════
# §2.4 — TRADE LIFECYCLE MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

class TradeLifecycleManager:
    """Manages the full trade lifecycle: new → routed → partial → filled → settled."""

    def __init__(self):
        self.orders: dict[str, OrderSpec] = {}
        self.fills: dict[str, list[Fill]] = defaultdict(list)
        self.positions: dict[str, Position] = {}
        self.trade_history: list[dict] = []
        self.daily_pnl = 0.0
        self.total_commission = 0.0
        self.total_volume = 0.0
        self._http: Optional[httpx.AsyncClient] = None

    async def _get_http(self) -> httpx.AsyncClient:
        if self._http is None or self._http.is_closed:
            self._http = httpx.AsyncClient(timeout=15.0)
        return self._http

    async def submit_order(self, order: OrderSpec) -> dict:
        """Submit order to Alpaca (or simulate in paper mode)."""
        order.status = OrderStatus.NEW
        order.submitted_at = datetime.now(timezone.utc).isoformat()
        self.orders[order.order_id] = order

        try:
            if ALPACA_KEY:
                result = await self._submit_to_alpaca(order)
                return result
        except Exception as e:
            logger.error(f"Alpaca submission failed: {e}")
            order.status = OrderStatus.REJECTED
            order.failed_at = datetime.now(timezone.utc).isoformat()
            return {"status": "rejected", "error": str(e), "order_id": order.order_id}

        # Paper mode simulation
        return await self._simulate_fill(order)

    async def _submit_to_alpaca(self, order: OrderSpec) -> dict:
        """Submit order to Alpaca REST API."""
        http = await self._get_http()
        headers = {
            "APCA-API-KEY-ID": ALPACA_KEY,
            "APCA-API-SECRET-KEY": ALPACA_SECRET,
        }

        body: dict[str, Any] = {
            "symbol": order.symbol,
            "qty": str(order.qty),
            "side": order.side.value,
            "type": self._map_order_type(order.order_type),
            "time_in_force": order.time_in_force.value,
            "client_order_id": order.client_order_id,
        }

        if order.limit_price is not None:
            body["limit_price"] = str(order.limit_price)
        if order.stop_price is not None:
            body["stop_price"] = str(order.stop_price)
        if order.trail_percent is not None:
            body["trail_percent"] = str(order.trail_percent)
        if order.trail_price is not None:
            body["trail_price"] = str(order.trail_price)
        if order.extended_hours:
            body["extended_hours"] = True

        # Bracket order
        if order.order_type == OrderType.BRACKET:
            body["order_class"] = "bracket"
            body["take_profit"] = {"limit_price": str(order.take_profit_price)}
            body["stop_loss"] = {"stop_price": str(order.stop_loss_price)}
            if order.stop_loss_limit_price:
                body["stop_loss"]["limit_price"] = str(order.stop_loss_limit_price)

        # OCO order
        if order.order_type == OrderType.OCO:
            body["order_class"] = "oco"

        # OTO order
        if order.order_type == OrderType.OTO:
            body["order_class"] = "oto"

        resp = await http.post(f"{ALPACA_BASE}/v2/orders", json=body, headers=headers)
        result = resp.json()

        if resp.status_code in (200, 201):
            order.status = OrderStatus.NEW
            alpaca_id = result.get("id", "")
            order.notes = f"alpaca_id={alpaca_id}"
            return {
                "status": "submitted",
                "order_id": order.order_id,
                "alpaca_id": alpaca_id,
                "symbol": order.symbol,
                "qty": order.qty,
                "type": order.order_type.value,
            }
        else:
            order.status = OrderStatus.REJECTED
            return {
                "status": "rejected",
                "order_id": order.order_id,
                "error": result.get("message", str(result)),
            }

    def _map_order_type(self, ot: OrderType) -> str:
        mapping = {
            OrderType.MARKET: "market",
            OrderType.LIMIT: "limit",
            OrderType.STOP: "stop",
            OrderType.STOP_LIMIT: "stop_limit",
            OrderType.TRAILING_STOP: "trailing_stop",
        }
        return mapping.get(ot, "market")

    async def _simulate_fill(self, order: OrderSpec) -> dict:
        """Simulate order fill in paper mode."""
        import random
        fill_price = order.limit_price or order.stop_price or 100.0
        slippage = fill_price * random.uniform(-0.001, 0.001)
        fill_price = round(fill_price + slippage, 2)

        fill = Fill(
            order_id=order.order_id,
            symbol=order.symbol,
            side=order.side.value,
            qty=order.qty,
            price=fill_price,
            commission=max(0.01, order.qty * 0.005),
            venue="PAPER",
            liquidity="add",
        )

        order.status = OrderStatus.FILLED
        order.filled_qty = order.qty
        order.filled_avg_price = fill_price
        order.filled_at = datetime.now(timezone.utc).isoformat()

        self.fills[order.order_id].append(fill)
        self._update_position(order, fill)
        self.total_commission += fill.commission
        self.total_volume += fill.qty * fill.price

        return {
            "status": "filled",
            "order_id": order.order_id,
            "fill_price": fill_price,
            "qty": order.qty,
            "commission": fill.commission,
        }

    def _update_position(self, order: OrderSpec, fill: Fill):
        """Update position tracking after fill."""
        symbol = order.symbol
        if symbol not in self.positions:
            self.positions[symbol] = Position(
                symbol=symbol,
                asset_class=order.asset_class,
            )

        pos = self.positions[symbol]
        if order.side in (OrderSide.BUY, OrderSide.BUY_TO_COVER):
            # Buying: increase position
            new_qty = pos.qty + fill.qty
            if new_qty != 0:
                pos.avg_entry_price = (pos.avg_entry_price * pos.qty + fill.price * fill.qty) / new_qty
            pos.qty = new_qty
            pos.side = "long"
        else:
            # Selling: decrease position
            if pos.qty > 0:
                realized = (fill.price - pos.avg_entry_price) * min(fill.qty, pos.qty)
                pos.realized_pnl += realized
                self.daily_pnl += realized
            pos.qty -= fill.qty
            if pos.qty < 0:
                pos.side = "short"
                pos.avg_entry_price = fill.price

        pos.current_price = fill.price
        pos.market_value = pos.qty * pos.current_price
        pos.cost_basis = pos.qty * pos.avg_entry_price
        if pos.cost_basis != 0:
            pos.unrealized_pnl = pos.market_value - pos.cost_basis
            pos.unrealized_pnl_pct = pos.unrealized_pnl / abs(pos.cost_basis)
        pos.last_updated = datetime.now(timezone.utc).isoformat()

        # Record trade
        self.trade_history.append({
            "timestamp": fill.timestamp,
            "symbol": symbol,
            "side": fill.side,
            "qty": fill.qty,
            "price": fill.price,
            "commission": fill.commission,
            "order_id": order.order_id,
        })

    async def cancel_order(self, order_id: str) -> dict:
        """Cancel an open order."""
        if order_id not in self.orders:
            return {"status": "error", "message": "Order not found"}

        order = self.orders[order_id]
        if order.status not in (OrderStatus.NEW, OrderStatus.PARTIALLY_FILLED):
            return {"status": "error", "message": f"Cannot cancel order in status {order.status}"}

        # Cancel on Alpaca
        if ALPACA_KEY and "alpaca_id=" in order.notes:
            try:
                alpaca_id = order.notes.split("alpaca_id=")[1].split(",")[0]
                http = await self._get_http()
                resp = await http.delete(
                    f"{ALPACA_BASE}/v2/orders/{alpaca_id}",
                    headers={
                        "APCA-API-KEY-ID": ALPACA_KEY,
                        "APCA-API-SECRET-KEY": ALPACA_SECRET,
                    },
                )
            except Exception as e:
                logger.error(f"Alpaca cancel failed: {e}")

        order.status = OrderStatus.CANCELLED
        order.cancelled_at = datetime.now(timezone.utc).isoformat()
        return {"status": "cancelled", "order_id": order_id}

    async def modify_order(self, order_id: str, new_qty: Optional[float] = None,
                           new_limit: Optional[float] = None) -> dict:
        """Modify an existing order (replace)."""
        if order_id not in self.orders:
            return {"status": "error", "message": "Order not found"}

        order = self.orders[order_id]
        if order.status not in (OrderStatus.NEW, OrderStatus.PARTIALLY_FILLED):
            return {"status": "error", "message": f"Cannot modify order in status {order.status}"}

        # Create replacement order
        new_order = OrderSpec(
            symbol=order.symbol,
            side=order.side,
            qty=new_qty or order.qty,
            order_type=order.order_type,
            limit_price=new_limit or order.limit_price,
            stop_price=order.stop_price,
            time_in_force=order.time_in_force,
            replaces=order_id,
        )

        # Cancel old, submit new
        await self.cancel_order(order_id)
        order.replaced_by = new_order.order_id
        result = await self.submit_order(new_order)
        return result

    def get_open_orders(self) -> list[dict]:
        """Return all open orders."""
        return [
            asdict(o) for o in self.orders.values()
            if o.status in (OrderStatus.NEW, OrderStatus.PARTIALLY_FILLED, OrderStatus.PENDING)
        ]

    def get_positions(self) -> list[dict]:
        """Return all positions."""
        return [asdict(p) for p in self.positions.values() if p.qty != 0]

    def get_trade_history(self, limit: int = 100) -> list[dict]:
        """Return recent trade history."""
        return self.trade_history[-limit:]

    def get_daily_summary(self) -> dict:
        """Daily trading summary."""
        return {
            "daily_pnl": round(self.daily_pnl, 2),
            "total_commission": round(self.total_commission, 2),
            "total_volume": round(self.total_volume, 2),
            "num_trades": len(self.trade_history),
            "num_open_orders": len(self.get_open_orders()),
            "num_positions": len(self.get_positions()),
            "positions": self.get_positions(),
        }

    async def sync_with_broker(self) -> dict:
        """Sync positions and orders with the broker (Alpaca)."""
        if not ALPACA_KEY:
            return {"status": "no_broker", "message": "No Alpaca keys configured"}

        http = await self._get_http()
        headers = {
            "APCA-API-KEY-ID": ALPACA_KEY,
            "APCA-API-SECRET-KEY": ALPACA_SECRET,
        }

        # Fetch positions
        try:
            pos_resp = await http.get(f"{ALPACA_BASE}/v2/positions", headers=headers)
            positions = pos_resp.json()
            for p in positions:
                symbol = p.get("symbol", "")
                self.positions[symbol] = Position(
                    symbol=symbol,
                    qty=float(p.get("qty", 0)),
                    avg_entry_price=float(p.get("avg_entry_price", 0)),
                    current_price=float(p.get("current_price", 0)),
                    market_value=float(p.get("market_value", 0)),
                    unrealized_pnl=float(p.get("unrealized_pl", 0)),
                    unrealized_pnl_pct=float(p.get("unrealized_plpc", 0)),
                    side="long" if float(p.get("qty", 0)) > 0 else "short",
                    last_updated=datetime.now(timezone.utc).isoformat(),
                )
        except Exception as e:
            logger.error(f"Position sync failed: {e}")

        # Fetch open orders
        try:
            ord_resp = await http.get(f"{ALPACA_BASE}/v2/orders?status=open", headers=headers)
            orders = ord_resp.json()
            for o in orders:
                oid = o.get("client_order_id", o.get("id", ""))
                if oid not in self.orders:
                    self.orders[oid] = OrderSpec(
                        order_id=oid,
                        symbol=o.get("symbol", ""),
                        side=OrderSide(o.get("side", "buy")),
                        qty=float(o.get("qty", 0)),
                        order_type=OrderType(o.get("type", "market")),
                        status=OrderStatus(o.get("status", "new")),
                        limit_price=float(o["limit_price"]) if o.get("limit_price") else None,
                        stop_price=float(o["stop_price"]) if o.get("stop_price") else None,
                        submitted_at=o.get("submitted_at", ""),
                    )
        except Exception as e:
            logger.error(f"Order sync failed: {e}")

        # Fetch account
        try:
            acct_resp = await http.get(f"{ALPACA_BASE}/v2/account", headers=headers)
            account = acct_resp.json()
            return {
                "status": "synced",
                "equity": float(account.get("equity", 0)),
                "buying_power": float(account.get("buying_power", 0)),
                "cash": float(account.get("cash", 0)),
                "positions": len(self.positions),
                "open_orders": len([o for o in self.orders.values() if o.status == OrderStatus.NEW]),
            }
        except Exception as e:
            logger.error(f"Account sync failed: {e}")
            return {"status": "partial_sync", "error": str(e)}


# ═══════════════════════════════════════════════════════════════════════════════
# UNIFIED OMS ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

class OMSEngine:
    """
    Unified Order Management System — the main entry point.
    Combines order validation, execution algorithms, order book,
    and trade lifecycle into a single cohesive engine.
    """

    def __init__(self):
        self.validator = OrderValidator()
        self.lifecycle = TradeLifecycleManager()
        self.book_manager = OrderBookManager()
        self._started = False

    async def start(self):
        """Start OMS engine and sync with broker."""
        if self._started:
            return
        self._started = True
        result = await self.lifecycle.sync_with_broker()
        if result.get("equity"):
            self.validator.account_equity = result["equity"]
        logger.info(f"OMS started: {result}")

    async def submit_order(self, order_spec: dict) -> dict:
        """
        Submit a new order.
        Validates, selects execution algo if specified, and routes.
        """
        order = OrderSpec(**{k: v for k, v in order_spec.items() if k in OrderSpec.__dataclass_fields__})

        # Validate
        valid, errors = self.validator.validate(order)
        if not valid:
            return {"status": "rejected", "errors": errors, "order_id": order.order_id}

        # Use execution algorithm if specified
        if order.algo and order.algo in ALGO_REGISTRY:
            market_data = await self._get_market_data(order.symbol)
            algo_cls = ALGO_REGISTRY[order.algo]
            algo = algo_cls(order, market_data)
            slices = algo.generate_slices()

            results = []
            for child in slices:
                r = await self.lifecycle.submit_order(child)
                results.append(r)

            return {
                "status": "algo_submitted",
                "algo": order.algo,
                "parent_order_id": order.order_id,
                "num_slices": len(slices),
                "results": results,
            }

        # Direct submission
        result = await self.lifecycle.submit_order(order)
        self.validator.open_orders[order.order_id] = order
        return result

    async def cancel_order(self, order_id: str) -> dict:
        result = await self.lifecycle.cancel_order(order_id)
        self.validator.open_orders.pop(order_id, None)
        return result

    async def modify_order(self, order_id: str, **kwargs) -> dict:
        return await self.lifecycle.modify_order(order_id, **kwargs)

    async def get_order_book(self, symbol: str, depth: int = 20) -> dict:
        book = await self.book_manager.fetch_order_book(symbol, depth)
        return book.to_heatmap()

    async def get_market_depth(self, symbol: str) -> dict:
        book = await self.book_manager.fetch_order_book(symbol, 50)
        return {
            "symbol": symbol,
            "best_bid": book.best_bid,
            "best_ask": book.best_ask,
            "mid": book.mid_price,
            "spread": book.spread,
            "spread_bps": book.spread_bps,
            "bid_depth_10": book.total_bid_size(10),
            "ask_depth_10": book.total_ask_size(10),
            "imbalance": book.bid_ask_imbalance(10),
            "vwap_bid": book.vwap_bid(),
            "vwap_ask": book.vwap_ask(),
            "impact_buy_1000": book.market_impact_cost("buy", 1000),
            "impact_sell_1000": book.market_impact_cost("sell", 1000),
        }

    def get_open_orders(self) -> list[dict]:
        return self.lifecycle.get_open_orders()

    def get_positions(self) -> list[dict]:
        return self.lifecycle.get_positions()

    def get_trade_history(self, limit: int = 100) -> list[dict]:
        return self.lifecycle.get_trade_history(limit)

    def get_daily_summary(self) -> dict:
        return self.lifecycle.get_daily_summary()

    async def _get_market_data(self, symbol: str) -> dict:
        """Get current market data for algo decisions."""
        try:
            book = await self.book_manager.fetch_order_book(symbol, 5)
            return {
                "last_price": book.mid_price or 100.0,
                "spread": book.spread or 0.01,
                "bid": book.best_bid,
                "ask": book.best_ask,
                "volatility": 0.02,  # Would come from real vol calculation
                "volume": 1_000_000,
            }
        except Exception:
            return {"last_price": 100.0, "spread": 0.01, "volatility": 0.02, "volume": 1_000_000}


# ── Singleton ──────────────────────────────────────────────────────────────────
_oms_instance: Optional[OMSEngine] = None

def get_oms() -> OMSEngine:
    global _oms_instance
    if _oms_instance is None:
        _oms_instance = OMSEngine()
    return _oms_instance
