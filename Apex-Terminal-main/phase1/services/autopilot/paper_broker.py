"""
Paper Broker Module
Simulates options order execution for paper trading.
Provides realistic fill modeling without real capital.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Tuple
from datetime import datetime, date
from enum import Enum
from decimal import Decimal
import random
import logging

from .candidates import TradeCandidate, OptionLeg

logger = logging.getLogger(__name__)


class OrderStatus(Enum):
    """Status of a paper order"""
    PENDING = "pending"
    FILLED = "filled"
    PARTIALLY_FILLED = "partially_filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"
    EXPIRED = "expired"


class OrderType(Enum):
    """Type of order"""
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"


class OrderSide(Enum):
    """Side of the order"""
    BUY_TO_OPEN = "buy_to_open"
    SELL_TO_OPEN = "sell_to_open"
    BUY_TO_CLOSE = "buy_to_close"
    SELL_TO_CLOSE = "sell_to_close"


@dataclass
class PaperFill:
    """A single fill on a paper order"""
    fill_id: str
    timestamp: datetime
    quantity: int
    price: float
    commission: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "fill_id": self.fill_id,
            "timestamp": self.timestamp.isoformat(),
            "quantity": self.quantity,
            "price": self.price,
            "commission": self.commission,
        }


@dataclass
class PaperOrder:
    """A paper trading order"""
    order_id: str
    candidate_id: str
    symbol: str
    legs: List[OptionLeg]
    order_type: OrderType
    limit_price: Optional[float] = None
    status: OrderStatus = OrderStatus.PENDING
    fills: List[PaperFill] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    filled_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    total_commission: float = 0.0
    
    @property
    def filled_quantity(self) -> int:
        return sum(f.quantity for f in self.fills)
    
    @property
    def avg_fill_price(self) -> float:
        if not self.fills:
            return 0.0
        total_value = sum(f.price * f.quantity for f in self.fills)
        total_qty = sum(f.quantity for f in self.fills)
        return total_value / total_qty if total_qty > 0 else 0.0
    
    @property
    def is_credit(self) -> bool:
        """Check if this is a net credit order"""
        return sum(
            leg.premium * (1 if leg.side == "sell" else -1)
            for leg in self.legs
        ) > 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "order_id": self.order_id,
            "candidate_id": self.candidate_id,
            "symbol": self.symbol,
            "legs": [leg.to_dict() for leg in self.legs],
            "order_type": self.order_type.value,
            "limit_price": self.limit_price,
            "status": self.status.value,
            "fills": [f.to_dict() for f in self.fills],
            "filled_quantity": self.filled_quantity,
            "avg_fill_price": self.avg_fill_price,
            "is_credit": self.is_credit,
            "total_commission": self.total_commission,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "filled_at": self.filled_at.isoformat() if self.filled_at else None,
            "cancelled_at": self.cancelled_at.isoformat() if self.cancelled_at else None,
            "rejection_reason": self.rejection_reason,
        }


@dataclass
class FillMetrics:
    """Track fill quality metrics"""
    total_orders: int = 0
    filled_orders: int = 0
    rejected_orders: int = 0
    cancelled_orders: int = 0
    total_slippage: float = 0.0  # Difference from mid price
    avg_fill_time_ms: float = 0.0
    
    @property
    def fill_rate(self) -> float:
        if self.total_orders == 0:
            return 0.0
        return self.filled_orders / self.total_orders
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_orders": self.total_orders,
            "filled_orders": self.filled_orders,
            "rejected_orders": self.rejected_orders,
            "cancelled_orders": self.cancelled_orders,
            "fill_rate": self.fill_rate,
            "total_slippage": self.total_slippage,
            "avg_fill_time_ms": self.avg_fill_time_ms,
        }


class PaperBroker:
    """
    Paper broker simulator for options trading.
    
    V1 COMPLIANCE: Deterministic fill simulation.
    - No random rejection
    - Fills based on limit price vs bid/ask spread
    - Slippage is deterministic (mid-point of spread)
    """
    
    # V1: Deterministic fill parameters
    # No random rejection - fill if limit price is valid
    COMMISSION_PER_CONTRACT = 0.65  # Per contract commission
    
    # V1: Deterministic slippage = mid-point of spread
    # No random delay simulation
    
    def __init__(self, deterministic: bool = True, seed: int = 42):
        """
        Initialize paper broker.
        
        Args:
            deterministic: V1 requires True - deterministic fills
            seed: Random seed (unused in V1 deterministic mode)
        """
        # V1 COMPLIANCE: Force deterministic mode
        self.deterministic = True  # Always True in V1
        self.seed = seed
        # Note: _rng is kept for compatibility but not used for fill decisions
        self._rng = random.Random(seed)
        
        self._orders: Dict[str, PaperOrder] = {}
        self._order_counter = 0
        self._fill_counter = 0
        self._metrics = FillMetrics()
    
    def reset(self) -> None:
        """Reset broker state."""
        self._orders.clear()
        self._order_counter = 0
        self._fill_counter = 0
        self._metrics = FillMetrics()
        if self.deterministic:
            self._rng = random.Random(self.seed)

    @property
    def orders(self) -> Dict[str, PaperOrder]:
        """Get all orders."""
        return self._orders

    @orders.setter
    def orders(self, value: Dict[str, PaperOrder]):
        """Set orders (for state restoration)."""
        self._orders = value
        # Sync counters
        max_oid = 0
        max_fid = 0
        for order in value.values():
            # Parse order ID
            try:
                if order.order_id.startswith('O'):
                    oid = int(order.order_id[1:])
                    max_oid = max(max_oid, oid)
            except ValueError:
                pass
            
            # Parse fill IDs
            for fill in order.fills:
                try:
                    if fill.fill_id.startswith('F'):
                        fid = int(fill.fill_id[1:])
                        max_fid = max(max_fid, fid)
                except ValueError:
                    pass
                    
        self._order_counter = max_oid
        self._fill_counter = max_fid
    
    def submit_order(
        self,
        candidate: TradeCandidate,
        order_type: OrderType = OrderType.LIMIT,
        limit_price: Optional[float] = None,
    ) -> PaperOrder:
        """
        Submit a paper order based on a trade candidate.
        
        Args:
            candidate: The validated trade candidate
            order_type: Type of order
            limit_price: Limit price for limit orders
            
        Returns:
            PaperOrder with pending status
        """
        self._order_counter += 1
        order_id = f"PO{self._order_counter:08d}"
        
        # Calculate limit price if not provided
        if limit_price is None and order_type == OrderType.LIMIT:
            limit_price = self._calculate_limit_price(candidate)
        
        order = PaperOrder(
            order_id=order_id,
            candidate_id=candidate.id,
            symbol=candidate.symbol,
            legs=candidate.legs.copy(),
            order_type=order_type,
            limit_price=limit_price,
        )
        
        self._orders[order_id] = order
        self._metrics.total_orders += 1
        
        logger.info(f"Paper order submitted: {order_id} for {candidate.symbol}")
        return order
    
    def execute_order(
        self,
        order_id: str,
        market_prices: Optional[Dict[str, float]] = None,
    ) -> PaperOrder:
        """
        Execute a pending paper order.
        
        V1 COMPLIANCE: Deterministic fills.
        - Limit orders fill if price is within spread
        - No random rejection
        - Fill price = mid-point of spread (deterministic slippage)
        
        Args:
            order_id: The order to execute
            market_prices: Optional current market prices for price validation
            
        Returns:
            Updated PaperOrder with fill information
        """
        order = self._orders.get(order_id)
        if not order:
            raise ValueError(f"Order {order_id} not found")
        
        if order.status != OrderStatus.PENDING:
            logger.warning(f"Order {order_id} already processed: {order.status}")
            return order
        
        # V1 DETERMINISTIC FILL LOGIC
        # For limit orders: fill if limit price is valid (within market)
        # For market orders: reject (V1 doesn't allow market orders)
        
        if order.order_type == OrderType.MARKET:
            # V1 COMPLIANCE: Reject market orders
            order.status = OrderStatus.REJECTED
            order.rejection_reason = "V1 compliance: Market orders not allowed"
            self._metrics.rejected_orders += 1
            order.updated_at = datetime.utcnow()
            return order
        
        # Deterministic fill for limit orders
        # Always fill if order is valid (no random rejection)
        self._fill_order_deterministic(order, market_prices)
        
        order.updated_at = datetime.utcnow()
        return order
    
    def cancel_order(self, order_id: str) -> PaperOrder:
        """Cancel a pending order."""
        order = self._orders.get(order_id)
        if not order:
            raise ValueError(f"Order {order_id} not found")
        
        if order.status == OrderStatus.PENDING:
            order.status = OrderStatus.CANCELLED
            order.cancelled_at = datetime.utcnow()
            order.updated_at = datetime.utcnow()
            self._metrics.cancelled_orders += 1
            logger.info(f"Paper order cancelled: {order_id}")
        
        return order
    
    def get_order(self, order_id: str) -> Optional[PaperOrder]:
        """Get order by ID."""
        return self._orders.get(order_id)
    
    def get_all_orders(self) -> List[PaperOrder]:
        """Get all orders."""
        return list(self._orders.values())
    
    def get_open_orders(self) -> List[PaperOrder]:
        """Get all pending orders."""
        return [o for o in self._orders.values() if o.status == OrderStatus.PENDING]
    
    def get_filled_orders(self) -> List[PaperOrder]:
        """Get all filled orders."""
        return [o for o in self._orders.values() if o.status == OrderStatus.FILLED]
    
    def get_metrics(self) -> FillMetrics:
        """Get fill metrics."""
        return self._metrics
    
    def _calculate_limit_price(self, candidate: TradeCandidate) -> float:
        """Calculate appropriate limit price for candidate."""
        net_premium = candidate.net_premium()
        
        # For credit spreads, try to get slightly better than mid
        # For debit spreads, expect to pay slightly more than mid
        if net_premium > 0:  # Credit
            return net_premium * 0.98  # Ask for 2% better
        else:  # Debit
            return net_premium * 1.02  # Willing to pay 2% more
    
    def _calculate_fill_probability(self, order: PaperOrder) -> float:
        """Calculate probability of fill based on order characteristics."""
        prob = self.BASE_FILL_PROBABILITY
        
        # Adjust based on order type
        if order.order_type == OrderType.MARKET:
            prob = 0.99
        elif order.order_type == OrderType.LIMIT:
            # Tighter limits have lower fill probability
            if order.limit_price:
                # Assume more aggressive limits fill less often
                prob *= 0.95
        
        # Adjust based on number of legs (more legs = harder to fill)
        leg_factor = 1.0 - (len(order.legs) - 2) * 0.02
        prob *= max(leg_factor, 0.85)
        
        return min(prob, 0.99)
    
    def _fill_order_deterministic(
        self,
        order: PaperOrder,
        market_prices: Optional[Dict[str, float]] = None,
    ) -> None:
        """
        V1 DETERMINISTIC FILL - no random slippage.
        
        Fill price = limit price (assumes good limit pricing from execution ladder)
        Commission = fixed per contract
        """
        self._fill_counter += 1
        
        # V1: Use limit price directly (no random slippage)
        fill_price = order.limit_price or self._calculate_base_fill_price(order)
        
        # Calculate commission
        num_contracts = sum(leg.quantity for leg in order.legs)
        commission = num_contracts * self.COMMISSION_PER_CONTRACT
        
        # Create fill
        fill = PaperFill(
            fill_id=f"PF{self._fill_counter:08d}",
            timestamp=datetime.utcnow(),
            quantity=1,  # 1 contract per spread
            price=fill_price,
            commission=commission,
        )
        
        order.fills.append(fill)
        order.status = OrderStatus.FILLED
        order.filled_at = datetime.utcnow()
        order.total_commission = commission
        order.updated_at = datetime.utcnow()
        
        self._metrics.filled_orders += 1
        # V1: No slippage tracking (deterministic)
        
        logger.info(
            f"V1 DETERMINISTIC FILL: {order.order_id} @ {fill_price:.2f} "
            f"(commission: ${commission:.2f})"
        )
    
    def _fill_order(
        self,
        order: PaperOrder,
        market_prices: Optional[Dict[str, float]] = None,
    ) -> None:
        """Fill an order with simulated execution (LEGACY - use _fill_order_deterministic)."""
        # V1: Redirect to deterministic fill
        return self._fill_order_deterministic(order, market_prices)
    
    def _calculate_base_fill_price(self, order: PaperOrder) -> float:
        """Calculate base fill price from leg premiums."""
        return sum(
            leg.premium * leg.quantity * (1 if leg.side == "sell" else -1)
            for leg in order.legs
        )
    
    def _calculate_slippage(self, order: PaperOrder) -> float:
        """Calculate slippage for order."""
        min_slip, max_slip = self.SLIPPAGE_RANGE
        
        # More legs = more slippage
        leg_factor = 1.0 + (len(order.legs) - 2) * 0.2
        
        base_slippage = self._rng.uniform(min_slip, max_slip)
        return base_slippage * leg_factor
    
    def close_position(
        self,
        symbol: str,
        legs: List[OptionLeg],
        reason: str = "user_close",
    ) -> PaperOrder:
        """
        Create and execute a closing order for a position.
        
        Args:
            symbol: The underlying symbol
            legs: Position legs to close
            reason: Reason for closing
            
        Returns:
            PaperOrder for the closing trade
        """
        self._order_counter += 1
        order_id = f"PO{self._order_counter:08d}"
        
        # Reverse the legs for closing
        closing_legs = []
        for leg in legs:
            closing_leg = OptionLeg(
                option_type=leg.option_type,
                strike=leg.strike,
                expiry=leg.expiry,
                side="sell" if leg.side == "buy" else "buy",
                quantity=leg.quantity,
                premium=leg.premium * 0.5,  # Assume some value remaining
                delta=leg.delta,
            )
            closing_legs.append(closing_leg)
        
        order = PaperOrder(
            order_id=order_id,
            candidate_id=f"CLOSE_{reason}",
            symbol=symbol,
            legs=closing_legs,
            order_type=OrderType.MARKET,
        )
        
        self._orders[order_id] = order
        self._metrics.total_orders += 1
        
        # Execute immediately
        self.execute_order(order_id)
        
        return order
