"""
Order Types - Dataclasses for order definitions and validation.
"""

from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime
from enum import Enum


class OrderType(str, Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"
    TRAILING_STOP = "trailing_stop"


class OrderSide(str, Enum):
    BUY = "buy"
    SELL = "sell"


class OrderStatus(str, Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    ACCEPTED = "accepted"
    PARTIAL = "partial"
    FILLED = "filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"
    EXPIRED = "expired"


class TimeInForce(str, Enum):
    DAY = "day"
    GTC = "gtc"  # Good till cancelled
    IOC = "ioc"  # Immediate or cancel
    FOK = "fok"  # Fill or kill


@dataclass
class Order:
    """Represents a trading order."""
    id: str
    symbol: str
    side: OrderSide
    quantity: float
    order_type: OrderType
    
    # Optional price fields
    limit_price: Optional[float] = None
    stop_price: Optional[float] = None
    trail_amount: Optional[float] = None
    trail_percent: Optional[float] = None
    
    # Order parameters
    time_in_force: TimeInForce = TimeInForce.DAY
    extended_hours: bool = False
    
    # State
    status: OrderStatus = OrderStatus.PENDING
    filled_qty: float = 0.0
    filled_avg_price: float = 0.0
    
    # Timestamps
    created_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    filled_at: Optional[datetime] = None
    
    # Execution info
    commission: float = 0.0
    slippage: float = 0.0
    
    # Linked orders (for bracket orders)
    parent_id: Optional[str] = None
    take_profit_price: Optional[float] = None
    stop_loss_price: Optional[float] = None
    
    def __post_init__(self):
        self.created_at = self.created_at or datetime.utcnow()
        self.validate()
    
    def validate(self) -> None:
        """Validate order parameters."""
        if self.quantity <= 0:
            raise ValueError("Quantity must be positive")
        
        if self.order_type == OrderType.LIMIT and self.limit_price is None:
            raise ValueError("Limit orders require limit_price")
        
        if self.order_type == OrderType.STOP and self.stop_price is None:
            raise ValueError("Stop orders require stop_price")
        
        if self.order_type == OrderType.STOP_LIMIT:
            if self.stop_price is None or self.limit_price is None:
                raise ValueError("Stop-limit orders require both stop_price and limit_price")
        
        if self.order_type == OrderType.TRAILING_STOP:
            if self.trail_amount is None and self.trail_percent is None:
                raise ValueError("Trailing stop orders require trail_amount or trail_percent")
    
    @property
    def is_active(self) -> bool:
        """Check if order is still active."""
        return self.status in (
            OrderStatus.PENDING,
            OrderStatus.SUBMITTED,
            OrderStatus.ACCEPTED,
            OrderStatus.PARTIAL
        )
    
    @property
    def is_filled(self) -> bool:
        return self.status == OrderStatus.FILLED
    
    @property
    def remaining_qty(self) -> float:
        return self.quantity - self.filled_qty
    
    @property
    def notional_value(self) -> float:
        """Estimated notional value."""
        price = self.limit_price or self.stop_price or self.filled_avg_price or 0
        return self.quantity * price
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "symbol": self.symbol,
            "side": self.side.value,
            "quantity": self.quantity,
            "order_type": self.order_type.value,
            "limit_price": self.limit_price,
            "stop_price": self.stop_price,
            "time_in_force": self.time_in_force.value,
            "status": self.status.value,
            "filled_qty": self.filled_qty,
            "filled_avg_price": self.filled_avg_price,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "filled_at": self.filled_at.isoformat() if self.filled_at else None,
            "commission": self.commission,
            "slippage": self.slippage,
        }


@dataclass
class Fill:
    """Represents a fill (partial or complete order execution)."""
    order_id: str
    symbol: str
    side: OrderSide
    quantity: float
    price: float
    timestamp: datetime
    commission: float = 0.0
    liquidity: str = "unknown"  # "maker" or "taker"
    
    def to_dict(self) -> dict:
        return {
            "order_id": self.order_id,
            "symbol": self.symbol,
            "side": self.side.value,
            "quantity": self.quantity,
            "price": self.price,
            "timestamp": self.timestamp.isoformat(),
            "commission": self.commission,
            "liquidity": self.liquidity,
        }
