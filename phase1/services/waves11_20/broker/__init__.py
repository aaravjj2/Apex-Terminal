"""
Paper-Only Broker — Wave 11
Idempotent order placement, reconciliation, kill switch, daily loss stop-out.
HARD REFUSAL if live trading mode is requested.
"""

import os
import logging
import hashlib
from datetime import datetime, date, timezone
from typing import Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class BrokerMode(str, Enum):
    PAPER = "paper"
    LIVE = "live"  # Never allowed


class OrderSide(str, Enum):
    BUY = "buy"
    SELL = "sell"


class OrderType(str, Enum):
    MARKET = "market"
    LIMIT = "limit"


class OrderStatus(str, Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    FILLED = "filled"
    PARTIALLY_FILLED = "partially_filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"
    FAILED = "failed"


@dataclass
class BrokerOrder:
    order_id: str
    idempotency_key: str
    symbol: str
    side: OrderSide
    qty: float
    order_type: OrderType = OrderType.MARKET
    limit_price: Optional[float] = None
    status: OrderStatus = OrderStatus.PENDING
    submitted_at: Optional[str] = None
    filled_at: Optional[str] = None
    fill_price: Optional[float] = None
    fill_qty: float = 0.0
    commission: float = 0.0
    source: str = "autopilot"
    retry_count: int = 0
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "order_id": self.order_id,
            "idempotency_key": self.idempotency_key,
            "symbol": self.symbol,
            "side": self.side.value,
            "qty": self.qty,
            "order_type": self.order_type.value,
            "limit_price": self.limit_price,
            "status": self.status.value,
            "submitted_at": self.submitted_at,
            "filled_at": self.filled_at,
            "fill_price": self.fill_price,
            "fill_qty": self.fill_qty,
            "commission": self.commission,
            "source": self.source,
            "retry_count": self.retry_count,
            "error": self.error,
        }


@dataclass
class Position:
    symbol: str
    qty: float
    avg_entry: float
    current_price: float = 0.0
    unrealized_pnl: float = 0.0
    market_value: float = 0.0

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "qty": self.qty,
            "avg_entry": self.avg_entry,
            "current_price": self.current_price,
            "unrealized_pnl": self.unrealized_pnl,
            "market_value": self.market_value,
        }


@dataclass
class DailyPnL:
    date: str
    realized_pnl: float = 0.0
    unrealized_pnl: float = 0.0
    total_pnl: float = 0.0
    equity: float = 0.0
    positions_count: int = 0

    def to_dict(self) -> dict:
        return {
            "date": self.date,
            "realized_pnl": self.realized_pnl,
            "unrealized_pnl": self.unrealized_pnl,
            "total_pnl": self.total_pnl,
            "equity": self.equity,
            "positions_count": self.positions_count,
        }


@dataclass
class KillSwitchState:
    active: bool = False
    triggered_at: Optional[str] = None
    reason: Optional[str] = None
    daily_loss_limit: float = -500.0  # Max daily loss allowed
    max_drawdown_pct: float = 5.0  # Max drawdown % from peak

    def to_dict(self) -> dict:
        return {
            "active": self.active,
            "triggered_at": self.triggered_at,
            "reason": self.reason,
            "daily_loss_limit": self.daily_loss_limit,
            "max_drawdown_pct": self.max_drawdown_pct,
        }


class LiveTradingRefusedError(Exception):
    """Raised when live trading is attempted. HARD REFUSAL."""
    pass


class KillSwitchActiveError(Exception):
    """Raised when kill switch is engaged."""
    pass


class PaperBrokerService:
    """
    Paper-only broker with idempotent orders, reconciliation, kill switch, and daily stop-out.
    REFUSES live trading mode server-side.
    """

    def __init__(self):
        self._mode = BrokerMode.PAPER
        self._orders: dict[str, BrokerOrder] = {}  # order_id -> order
        self._idempotency_cache: dict[str, str] = {}  # idempotency_key -> order_id
        self._positions: dict[str, Position] = {}  # symbol -> position
        self._daily_pnl: dict[str, DailyPnL] = {}  # date -> pnl
        self._kill_switch = KillSwitchState()
        self._peak_equity: float = 100000.0
        self._current_equity: float = 100000.0
        self._incidents: list[dict] = []

    def ensure_paper_only(self, requested_mode: Optional[str] = None) -> None:
        """
        HARD REFUSAL: Server-side enforcement that only paper trading is allowed.
        Raises LiveTradingRefusedError if live mode is requested.
        """
        if requested_mode and requested_mode.lower() in ("live", "production", "real"):
            raise LiveTradingRefusedError(
                "LIVE TRADING IS NOT ALLOWED. This system is paper-only. "
                "No live trading mode will ever be enabled."
            )

    def is_kill_switch_active(self) -> bool:
        return self._kill_switch.active

    def activate_kill_switch(self, reason: str) -> None:
        """Activate kill switch — stops all trading."""
        self._kill_switch.active = True
        self._kill_switch.triggered_at = datetime.now(timezone.utc).isoformat()
        self._kill_switch.reason = reason
        self._incidents.append({
            "type": "kill_switch_activated",
            "reason": reason,
            "timestamp": self._kill_switch.triggered_at,
        })
        logger.warning(f"KILL SWITCH ACTIVATED: {reason}")

    def deactivate_kill_switch(self) -> None:
        """Deactivate kill switch — resume trading."""
        self._kill_switch.active = False
        self._kill_switch.triggered_at = None
        self._kill_switch.reason = None
        logger.info("Kill switch deactivated")

    def _check_daily_stop_out(self) -> bool:
        """Check if daily loss limit has been breached."""
        today = date.today().isoformat()
        daily = self._daily_pnl.get(today)
        if daily and daily.total_pnl <= self._kill_switch.daily_loss_limit:
            self.activate_kill_switch(
                f"Daily loss stop-out: ${daily.total_pnl:.2f} <= ${self._kill_switch.daily_loss_limit:.2f}"
            )
            return True
        return False

    def _check_drawdown(self) -> bool:
        """Check if max drawdown has been breached."""
        if self._current_equity < self._peak_equity:
            drawdown_pct = (self._peak_equity - self._current_equity) / self._peak_equity * 100
            if drawdown_pct >= self._kill_switch.max_drawdown_pct:
                self.activate_kill_switch(
                    f"Max drawdown breached: {drawdown_pct:.1f}% >= {self._kill_switch.max_drawdown_pct}%"
                )
                return True
        return False

    def _generate_idempotency_key(self, symbol: str, side: OrderSide, qty: float, source: str) -> str:
        """Generate idempotency key to prevent double-ordering."""
        today = date.today().isoformat()
        data = f"{today}:{symbol}:{side.value}:{qty}:{source}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]

    async def submit_order(
        self,
        symbol: str,
        side: OrderSide,
        qty: float,
        order_type: OrderType = OrderType.MARKET,
        limit_price: Optional[float] = None,
        source: str = "autopilot",
        idempotency_key: Optional[str] = None,
    ) -> BrokerOrder:
        """
        Submit an order with idempotency. If the same idempotency key has already
        been used, returns the existing order instead of creating a new one.
        """
        # HARD REFUSAL for live
        self.ensure_paper_only()

        # Kill switch check
        if self.is_kill_switch_active():
            raise KillSwitchActiveError(f"Kill switch active: {self._kill_switch.reason}")

        # Daily stop-out check
        self._check_daily_stop_out()
        if self.is_kill_switch_active():
            raise KillSwitchActiveError(f"Kill switch active: {self._kill_switch.reason}")

        # Idempotency check
        if not idempotency_key:
            idempotency_key = self._generate_idempotency_key(symbol, side, qty, source)

        if idempotency_key in self._idempotency_cache:
            existing_id = self._idempotency_cache[idempotency_key]
            logger.info(f"Idempotent order returned: {existing_id}")
            return self._orders[existing_id]

        # Create order
        order_id = f"order-{hashlib.md5(f'{idempotency_key}{datetime.now(timezone.utc).isoformat()}'.encode()).hexdigest()[:12]}"
        order = BrokerOrder(
            order_id=order_id,
            idempotency_key=idempotency_key,
            symbol=symbol,
            side=side,
            qty=qty,
            order_type=order_type,
            limit_price=limit_price,
            source=source,
            status=OrderStatus.SUBMITTED,
            submitted_at=datetime.now(timezone.utc).isoformat(),
        )

        self._orders[order_id] = order
        self._idempotency_cache[idempotency_key] = order_id
        logger.info(f"Order submitted: {order_id} {side.value} {qty} {symbol}")

        return order

    async def fill_order(self, order_id: str, fill_price: float) -> BrokerOrder:
        """Simulate filling an order at given price."""
        order = self._orders.get(order_id)
        if not order:
            raise ValueError(f"Order {order_id} not found")

        if order.status in (OrderStatus.FILLED, OrderStatus.CANCELLED):
            return order

        order.fill_price = fill_price
        order.fill_qty = order.qty
        order.filled_at = datetime.now(timezone.utc).isoformat()
        order.status = OrderStatus.FILLED

        # Update positions
        self._reconcile_fill(order)

        # Check stop-out after fill
        self._check_daily_stop_out()
        self._check_drawdown()

        return order

    def _reconcile_fill(self, order: BrokerOrder) -> None:
        """Reconcile a filled order into positions and PnL."""
        symbol = order.symbol
        pos = self._positions.get(symbol)

        if order.side == OrderSide.BUY:
            if pos:
                # Add to existing position
                total_cost = pos.avg_entry * pos.qty + order.fill_price * order.fill_qty
                pos.qty += order.fill_qty
                pos.avg_entry = total_cost / pos.qty if pos.qty > 0 else 0
            else:
                pos = Position(
                    symbol=symbol,
                    qty=order.fill_qty,
                    avg_entry=order.fill_price,
                )
                self._positions[symbol] = pos
        elif order.side == OrderSide.SELL:
            if pos:
                realized = (order.fill_price - pos.avg_entry) * min(order.fill_qty, pos.qty)
                pos.qty -= order.fill_qty
                if pos.qty <= 0:
                    del self._positions[symbol]

                # Update daily PnL
                today = date.today().isoformat()
                daily = self._daily_pnl.get(today, DailyPnL(date=today))
                daily.realized_pnl += realized
                daily.total_pnl = daily.realized_pnl + daily.unrealized_pnl
                self._daily_pnl[today] = daily

    def get_orders(self, status: Optional[OrderStatus] = None) -> list[BrokerOrder]:
        """Get all orders, optionally filtered by status."""
        orders = list(self._orders.values())
        if status:
            orders = [o for o in orders if o.status == status]
        return orders

    def get_positions(self) -> list[Position]:
        """Get all current positions."""
        return list(self._positions.values())

    def get_position(self, symbol: str) -> Optional[Position]:
        """Get position for a specific symbol."""
        return self._positions.get(symbol)

    def get_daily_pnl(self, d: Optional[str] = None) -> Optional[DailyPnL]:
        """Get daily PnL for a specific date."""
        d = d or date.today().isoformat()
        return self._daily_pnl.get(d)

    def get_kill_switch_state(self) -> KillSwitchState:
        return self._kill_switch

    def get_incidents(self) -> list[dict]:
        return self._incidents.copy()

    def get_trading_readiness(self) -> dict:
        """Trading readiness check for UI2 widget."""
        from ..market_session import get_market_session_engine
        session = get_market_session_engine().get_state()

        return {
            "broker_mode": self._mode.value,
            "kill_switch_active": self._kill_switch.active,
            "kill_switch_reason": self._kill_switch.reason,
            "session": session.to_dict(),
            "trading_allowed": session.is_trading_allowed and not self._kill_switch.active,
            "positions_count": len(self._positions),
            "open_orders": len([o for o in self._orders.values() if o.status == OrderStatus.SUBMITTED]),
            "daily_pnl": self.get_daily_pnl().to_dict() if self.get_daily_pnl() else None,
            "peak_equity": self._peak_equity,
            "current_equity": self._current_equity,
        }


_broker: Optional[PaperBrokerService] = None


def get_paper_broker() -> PaperBrokerService:
    global _broker
    if _broker is None:
        _broker = PaperBrokerService()
    return _broker
