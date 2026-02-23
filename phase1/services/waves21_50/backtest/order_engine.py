"""
Wave 29 — Order Types & Deterministic Fill Rules
Extended order types with deterministic fill logic for backtesting.
"""
from __future__ import annotations
import hashlib
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Dict, Any, List
from .canonical_schema import CanonicalBar


class OrderType(str, Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"
    MOC = "market_on_close"    # Market-on-close
    LOC = "limit_on_close"     # Limit-on-close
    TRAILING_STOP = "trailing_stop"


class OrderSide(str, Enum):
    BUY = "buy"
    SELL = "sell"


class OrderStatus(str, Enum):
    PENDING = "pending"
    FILLED = "filled"
    PARTIALLY_FILLED = "partially_filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"
    EXPIRED = "expired"


class TimeInForce(str, Enum):
    DAY = "day"
    GTC = "gtc"      # Good-til-cancelled
    IOC = "ioc"      # Immediate-or-cancel
    FOK = "fok"      # Fill-or-kill
    GTD = "gtd"      # Good-til-date


@dataclass
class Order:
    order_id: str
    symbol: str
    side: OrderSide
    order_type: OrderType
    qty: float
    limit_price: Optional[float] = None
    stop_price: Optional[float] = None
    trail_pct: Optional[float] = None
    time_in_force: TimeInForce = TimeInForce.DAY
    status: OrderStatus = OrderStatus.PENDING
    filled_qty: float = 0.0
    avg_fill_price: float = 0.0
    created_at: str = ""
    filled_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "order_id": self.order_id,
            "symbol": self.symbol,
            "side": self.side.value,
            "order_type": self.order_type.value,
            "qty": self.qty,
            "limit_price": self.limit_price,
            "stop_price": self.stop_price,
            "trail_pct": self.trail_pct,
            "time_in_force": self.time_in_force.value,
            "status": self.status.value,
            "filled_qty": self.filled_qty,
            "avg_fill_price": round(self.avg_fill_price, 4),
        }


class DeterministicFillEngine:
    """Deterministic fill rules for backtest order execution."""

    def __init__(self, slippage_bps: float = 1.0, fill_ratio: float = 1.0) -> None:
        self.slippage_bps = slippage_bps  # Slippage in basis points
        self.fill_ratio = fill_ratio       # Max fill ratio per bar (volume participation)
        self._order_counter = 0

    def create_order(self, symbol: str, side: OrderSide, order_type: OrderType,
                     qty: float, **kwargs) -> Order:
        self._order_counter += 1
        oid = f"bt-ord-{self._order_counter:06d}"
        return Order(
            order_id=oid,
            symbol=symbol,
            side=side,
            order_type=order_type,
            qty=qty,
            limit_price=kwargs.get("limit_price"),
            stop_price=kwargs.get("stop_price"),
            trail_pct=kwargs.get("trail_pct"),
            time_in_force=kwargs.get("time_in_force", TimeInForce.DAY),
        )

    def try_fill(self, order: Order, bar: CanonicalBar) -> bool:
        """Attempt to fill order against a bar. Returns True if filled."""
        if order.status not in (OrderStatus.PENDING, OrderStatus.PARTIALLY_FILLED):
            return False

        fill_price: Optional[float] = None

        if order.order_type == OrderType.MARKET:
            fill_price = bar.open
        elif order.order_type == OrderType.LIMIT:
            if order.side == OrderSide.BUY and order.limit_price and bar.low <= order.limit_price:
                fill_price = min(order.limit_price, bar.open)
            elif order.side == OrderSide.SELL and order.limit_price and bar.high >= order.limit_price:
                fill_price = max(order.limit_price, bar.open)
        elif order.order_type == OrderType.STOP:
            if order.side == OrderSide.BUY and order.stop_price and bar.high >= order.stop_price:
                fill_price = max(order.stop_price, bar.open)
            elif order.side == OrderSide.SELL and order.stop_price and bar.low <= order.stop_price:
                fill_price = min(order.stop_price, bar.open)
        elif order.order_type == OrderType.STOP_LIMIT:
            triggered = False
            if order.side == OrderSide.BUY and order.stop_price and bar.high >= order.stop_price:
                triggered = True
            elif order.side == OrderSide.SELL and order.stop_price and bar.low <= order.stop_price:
                triggered = True
            if triggered and order.limit_price:
                if order.side == OrderSide.BUY and bar.low <= order.limit_price:
                    fill_price = min(order.limit_price, bar.open)
                elif order.side == OrderSide.SELL and bar.high >= order.limit_price:
                    fill_price = max(order.limit_price, bar.open)
        elif order.order_type == OrderType.MOC:
            fill_price = bar.close
        elif order.order_type == OrderType.LOC:
            if order.side == OrderSide.BUY and order.limit_price and bar.close <= order.limit_price:
                fill_price = bar.close
            elif order.side == OrderSide.SELL and order.limit_price and bar.close >= order.limit_price:
                fill_price = bar.close
        elif order.order_type == OrderType.TRAILING_STOP:
            # Simplified trailing stop
            if order.trail_pct and order.stop_price:
                if order.side == OrderSide.SELL and bar.low <= order.stop_price:
                    fill_price = order.stop_price

        if fill_price is None:
            return False

        # Apply slippage (adverse direction)
        slippage = fill_price * (self.slippage_bps / 10000)
        if order.side == OrderSide.BUY:
            fill_price += slippage
        else:
            fill_price -= slippage

        # Volume participation check
        max_fill = bar.volume * self.fill_ratio
        actual_fill = min(order.qty - order.filled_qty, max_fill) if max_fill > 0 else order.qty

        order.filled_qty += actual_fill
        order.avg_fill_price = fill_price
        order.filled_at = bar.timestamp

        if order.filled_qty >= order.qty:
            order.status = OrderStatus.FILLED
        else:
            order.status = OrderStatus.PARTIALLY_FILLED

        return True

    def expire_order(self, order: Order) -> None:
        if order.status == OrderStatus.PENDING:
            order.status = OrderStatus.EXPIRED
