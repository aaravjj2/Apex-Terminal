"""
Position Manager Module
Manages the options position ledger with Greeks tracking.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Tuple
from datetime import datetime, date
from enum import Enum
import logging

from .candidates import TradeCandidate, OptionLeg
from .paper_broker import PaperOrder, OrderStatus

logger = logging.getLogger(__name__)


class PositionStatus(Enum):
    """Status of an options position"""
    OPEN = "open"
    CLOSED = "closed"
    EXPIRED = "expired"
    ASSIGNED = "assigned"  # For short options


@dataclass
class PositionGreeks:
    """Greeks exposure for a position"""
    delta: float = 0.0
    gamma: float = 0.0
    theta: float = 0.0
    vega: float = 0.0
    
    def to_dict(self) -> Dict[str, float]:
        return {
            "delta": round(self.delta, 4),
            "gamma": round(self.gamma, 4),
            "theta": round(self.theta, 4),
            "vega": round(self.vega, 4),
        }
    
    def __add__(self, other: "PositionGreeks") -> "PositionGreeks":
        return PositionGreeks(
            delta=self.delta + other.delta,
            gamma=self.gamma + other.gamma,
            theta=self.theta + other.theta,
            vega=self.vega + other.vega,
        )


@dataclass
class OptionsPosition:
    """A single options position (may be multi-leg)"""
    position_id: str
    symbol: str
    template: str
    legs: List[OptionLeg]
    entry_order_id: str
    entry_price: float  # Net debit/credit at entry
    entry_time: datetime
    quantity: int = 1
    
    # Current state
    status: PositionStatus = PositionStatus.OPEN
    current_value: float = 0.0
    greeks: PositionGreeks = field(default_factory=PositionGreeks)
    
    # Risk metrics
    max_loss: float = 0.0
    max_profit: float = 0.0
    
    # Exit info
    exit_order_id: Optional[str] = None
    exit_price: Optional[float] = None
    exit_time: Optional[datetime] = None
    exit_reason: Optional[str] = None
    
    # P&L
    realized_pnl: float = 0.0
    unrealized_pnl: float = 0.0
    total_commission: float = 0.0
    
    @property
    def dte(self) -> int:
        """Days to expiration."""
        if not self.legs:
            return 0
        # Use first leg's expiry
        expiry = self.legs[0].expiry
        if not expiry:
            return 0
        return max(0, (expiry - date.today()).days)
    
    @property
    def net_pnl(self) -> float:
        """Net P&L including commissions."""
        if self.status == PositionStatus.OPEN:
            return self.unrealized_pnl - self.total_commission
        return self.realized_pnl - self.total_commission
    
    @property
    def pnl_percent(self) -> float:
        """P&L as percentage of max loss."""
        if self.max_loss == 0:
            return 0.0
        return (self.net_pnl / self.max_loss) * 100
    
    def to_dict(self) -> Dict[str, Any]:
        # Handle status whether it's enum or string
        status_value = self.status.value if isinstance(self.status, PositionStatus) else self.status
        # Handle greeks whether it's object with to_dict() or already a dict
        greeks_value = self.greeks.to_dict() if hasattr(self.greeks, 'to_dict') else self.greeks
        # Handle legs - may be objects or dicts
        legs_value = [
            leg.to_dict() if hasattr(leg, 'to_dict') else leg 
            for leg in self.legs
        ]
        return {
            "position_id": self.position_id,
            "symbol": self.symbol,
            "template": self.template,
            "legs": legs_value,
            "entry_order_id": self.entry_order_id,
            "entry_price": self.entry_price,
            "entry_time": self.entry_time.isoformat() if hasattr(self.entry_time, 'isoformat') else self.entry_time,
            "quantity": self.quantity,
            "status": status_value,
            "current_value": self.current_value,
            "greeks": greeks_value,
            "max_loss": self.max_loss,
            "max_profit": self.max_profit,
            "dte": self.dte,
            "exit_order_id": self.exit_order_id,
            "exit_price": self.exit_price,
            "exit_time": self.exit_time.isoformat() if self.exit_time and hasattr(self.exit_time, 'isoformat') else self.exit_time,
            "exit_reason": self.exit_reason,
            "realized_pnl": self.realized_pnl,
            "unrealized_pnl": self.unrealized_pnl,
            "net_pnl": self.net_pnl,
            "pnl_percent": self.pnl_percent,
            "total_commission": self.total_commission,
        }


@dataclass
class PortfolioState:
    """Current portfolio state summary"""
    equity: float
    cash: float
    total_risk: float
    position_count: int
    daily_pnl: float
    realized_pnl_today: float
    unrealized_pnl: float
    total_delta: float
    total_gamma: float
    total_theta: float
    total_vega: float
    symbol_exposure: Dict[str, int]
    cluster_exposure: Dict[str, float]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "equity": self.equity,
            "cash": self.cash,
            "total_risk": self.total_risk,
            "position_count": self.position_count,
            "daily_pnl": self.daily_pnl,
            "realized_pnl_today": self.realized_pnl_today,
            "unrealized_pnl": self.unrealized_pnl,
            "greeks": {
                "delta": self.total_delta,
                "gamma": self.total_gamma,
                "theta": self.total_theta,
                "vega": self.total_vega,
            },
            "symbol_exposure": self.symbol_exposure,
            "cluster_exposure": self.cluster_exposure,
        }


class PositionManager:
    """
    Manages the options position ledger.
    Tracks positions, Greeks exposure, and P&L.
    """
    
    # Cluster definitions
    SYMBOL_CLUSTERS = {
        "mega_tech": ["AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMZN", "AMD"],
        "broad_market": ["SPY", "QQQ", "IWM", "DIA"],
        "sector_tech": ["XLK", "SMH"],
        "sector_fin": ["XLF"],
        "sector_energy": ["XLE"],
        "safe_haven": ["TLT", "GLD"],
    }
    
    def __init__(self, initial_equity: float = 1000.0):
        self.initial_equity = initial_equity
        self._positions: Dict[str, OptionsPosition] = {}
        self._position_counter = 0
        self._daily_realized_pnl = 0.0
        self._total_realized_pnl = 0.0
        self._last_reset_date: Optional[date] = None
    
    def reset(self) -> None:
        """Reset position manager state."""
        self._positions.clear()
        self._position_counter = 0
        self._daily_realized_pnl = 0.0
        self._total_realized_pnl = 0.0
        self._last_reset_date = None

    @property
    def positions(self) -> Dict[str, OptionsPosition]:
        """Get all managed positions."""
        return self._positions

    @positions.setter
    def positions(self, value: Dict[str, OptionsPosition]):
        """Set positions (used for state restoration)."""
        self._positions = value
        # Reset counter based on max existing ID
        max_id = 0
        for pid in value.keys():
            if pid.startswith('P'):
                try:
                    num = int(pid[1:])
                    max_id = max(max_id, num)
                except ValueError:
                    pass
    @positions.setter
    def positions(self, value: Dict[str, OptionsPosition]):
        """Set positions (used for state restoration)."""
        self._positions = value
        # Reset counter based on max existing ID
        max_id = 0
        for pid in value.keys():
            if pid.startswith('P'):
                try:
                    num = int(pid[1:])
                    max_id = max(max_id, num)
                except ValueError:
                    pass
        self._position_counter = max_id

    @property
    def equity(self) -> float:
        """Total account equity."""
        unrealized = sum(p.unrealized_pnl for p in self._positions.values() if p.status == PositionStatus.OPEN)
        return self.initial_equity + self._total_realized_pnl + unrealized

    @property
    def cash(self) -> float:
        """Available cash (simplified as equity for now)."""
        return self.equity
    
    def create_position_from_order(
        self,
        order: PaperOrder,
        candidate: TradeCandidate,
    ) -> OptionsPosition:
        """
        Create a new position from a filled order.
        
        Args:
            order: The filled paper order
            candidate: The original trade candidate
            
        Returns:
            New OptionsPosition
        """
        if order.status != OrderStatus.FILLED:
            raise ValueError(f"Order {order.order_id} not filled")
        
        self._position_counter += 1
        position_id = f"P{self._position_counter:06d}"
        
        # Calculate entry price from fills
        entry_price = order.avg_fill_price
        
        # Calculate initial Greeks
        greeks = self._calculate_position_greeks(candidate.legs)
        
        position = OptionsPosition(
            position_id=position_id,
            symbol=candidate.symbol,
            template=candidate.template.value,
            legs=candidate.legs.copy(),
            entry_order_id=order.order_id,
            entry_price=entry_price,
            entry_time=order.filled_at or datetime.utcnow(),
            quantity=1,
            current_value=entry_price,
            greeks=greeks,
            max_loss=candidate.max_loss,
            max_profit=candidate.max_profit,
            total_commission=order.total_commission,
        )
        
        self._positions[position_id] = position
        
        logger.info(
            f"Position created: {position_id} {candidate.symbol} "
            f"{candidate.template.value} @ {entry_price:.2f}"
        )
        
        return position
    
    def close_position(
        self,
        position_id: str,
        exit_order: PaperOrder,
        reason: str = "manual",
    ) -> OptionsPosition:
        """
        Close a position.
        
        Args:
            position_id: Position to close
            exit_order: The closing order
            reason: Reason for closing
            
        Returns:
            Updated position
        """
        position = self._positions.get(position_id)
        if not position:
            raise ValueError(f"Position {position_id} not found")
        
        if position.status != PositionStatus.OPEN:
            raise ValueError(f"Position {position_id} already closed")
        
        exit_price = exit_order.avg_fill_price
        
        # Calculate realized P&L
        # For credit spreads: profit if we pay less to close
        # For debit spreads: profit if we receive more to close
        if position.entry_price > 0:  # Credit received at entry
            realized_pnl = (position.entry_price - abs(exit_price)) * 100
        else:  # Debit paid at entry
            realized_pnl = (abs(exit_price) - abs(position.entry_price)) * 100
        
        position.exit_order_id = exit_order.order_id
        position.exit_price = exit_price
        position.exit_time = exit_order.filled_at or datetime.utcnow()
        position.exit_reason = reason
        position.realized_pnl = realized_pnl
        position.unrealized_pnl = 0.0
        position.status = PositionStatus.CLOSED
        position.total_commission += exit_order.total_commission
        
        # Update daily P&L tracking
        self._check_daily_reset()
        self._daily_realized_pnl += realized_pnl
        self._total_realized_pnl += realized_pnl
        
        logger.info(
            f"Position closed: {position_id} @ {exit_price:.2f}, "
            f"P&L: ${realized_pnl:.2f} ({reason})"
        )
        
        return position
    
    def expire_position(self, position_id: str) -> OptionsPosition:
        """Mark position as expired (worthless or max profit)."""
        position = self._positions.get(position_id)
        if not position:
            raise ValueError(f"Position {position_id} not found")
        
        # For paper trading, assume expiration at intrinsic value
        # Credit spreads: max profit if OTM
        # Debit spreads: worthless if OTM
        
        if position.entry_price > 0:  # Credit
            realized_pnl = position.entry_price * 100  # Keep full credit
        else:  # Debit
            realized_pnl = position.entry_price * 100  # Lose full debit
        
        position.exit_reason = "expiration"
        position.exit_time = datetime.utcnow()
        position.realized_pnl = realized_pnl
        position.unrealized_pnl = 0.0
        position.status = PositionStatus.EXPIRED
        
        self._check_daily_reset()
        self._daily_realized_pnl += realized_pnl
        self._total_realized_pnl += realized_pnl
        
        logger.info(f"Position expired: {position_id}, P&L: ${realized_pnl:.2f}")
        
        return position
    
    def update_position_values(
        self,
        market_data: Dict[str, Any],
    ) -> None:
        """
        Update current values and Greeks for all open positions.
        
        Args:
            market_data: Current market data with option prices
        """
        for position in self._positions.values():
            if position.status != PositionStatus.OPEN:
                continue
            
            # Update Greeks and value based on market data
            self._update_single_position(position, market_data)
    
    def _update_single_position(
        self,
        position: OptionsPosition,
        market_data: Dict[str, Any],
    ) -> None:
        """Update a single position's values."""
        # Calculate current value from legs
        current_value = 0.0
        new_greeks = PositionGreeks()
        
        for leg in position.legs:
            # Look up current option price
            option_key = f"{position.symbol}_{leg.expiry}_{leg.strike}_{leg.option_type}"
            option_data = market_data.get("options", {}).get(option_key, {})
            
            # Use mid price or fall back to entry premium with decay
            if option_data:
                mid = (option_data.get("bid", 0) + option_data.get("ask", 0)) / 2
                leg_value = mid * leg.quantity
                
                # Update Greeks
                new_greeks.delta += option_data.get("delta", 0) * leg.quantity * (
                    1 if leg.side == "buy" else -1
                )
                new_greeks.gamma += option_data.get("gamma", 0) * leg.quantity
                new_greeks.theta += option_data.get("theta", 0) * leg.quantity * (
                    1 if leg.side == "buy" else -1
                )
                new_greeks.vega += option_data.get("vega", 0) * leg.quantity * (
                    1 if leg.side == "buy" else -1
                )
            else:
                # Estimate decay based on DTE
                decay_factor = max(0, position.dte / 30) if position.dte > 0 else 0
                leg_value = leg.premium * leg.quantity * decay_factor
            
            # Add/subtract based on position side
            if leg.side == "sell":
                current_value += leg_value
            else:
                current_value -= leg_value
        
        position.current_value = current_value
        position.greeks = new_greeks
        
        # Calculate unrealized P&L
        if position.entry_price > 0:  # Credit
            position.unrealized_pnl = (position.entry_price - abs(current_value)) * 100
        else:  # Debit
            position.unrealized_pnl = (current_value - position.entry_price) * 100
    
    def _calculate_position_greeks(self, legs: List[OptionLeg]) -> PositionGreeks:
        """Calculate aggregate Greeks for position legs."""
        greeks = PositionGreeks()
        
        for leg in legs:
            multiplier = 1 if leg.side == "buy" else -1
            greeks.delta += leg.delta * leg.quantity * multiplier
            greeks.gamma += leg.gamma * leg.quantity
            greeks.theta += leg.theta * leg.quantity * multiplier
            greeks.vega += leg.vega * leg.quantity * multiplier
        
        return greeks
    
    def _check_daily_reset(self) -> None:
        """Reset daily P&L if new day."""
        today = date.today()
        if self._last_reset_date != today:
            self._daily_realized_pnl = 0.0
            self._last_reset_date = today
    
    def get_position(self, position_id: str) -> Optional[OptionsPosition]:
        """Get position by ID."""
        return self._positions.get(position_id)
    
    def get_all_positions(self) -> List[OptionsPosition]:
        """Get all positions."""
        return list(self._positions.values())
    
    def get_open_positions(self) -> List[OptionsPosition]:
        """Get all open positions."""
        return [p for p in self._positions.values() if p.status == PositionStatus.OPEN]
    
    def get_positions_by_symbol(self, symbol: str) -> List[OptionsPosition]:
        """Get positions for a specific symbol."""
        return [p for p in self._positions.values() if p.symbol == symbol]
    
    def get_portfolio_state(self) -> PortfolioState:
        """Get current portfolio state summary."""
        self._check_daily_reset()
        
        open_positions = self.get_open_positions()
        
        # Calculate totals
        total_risk = sum(p.max_loss for p in open_positions)
        unrealized = sum(p.unrealized_pnl for p in open_positions)
        
        # Calculate Greeks
        total_greeks = PositionGreeks()
        for p in open_positions:
            total_greeks = total_greeks + p.greeks
        
        # Calculate exposures
        symbol_exposure: Dict[str, int] = {}
        cluster_exposure: Dict[str, float] = {}
        
        for p in open_positions:
            symbol_exposure[p.symbol] = symbol_exposure.get(p.symbol, 0) + 1
            cluster = self._get_cluster(p.symbol)
            cluster_exposure[cluster] = cluster_exposure.get(cluster, 0) + p.max_loss
        
        # Calculate equity
        equity = self.initial_equity + self._total_realized_pnl + unrealized
        
        return PortfolioState(
            equity=equity,
            cash=self.initial_equity - total_risk,
            total_risk=total_risk,
            position_count=len(open_positions),
            daily_pnl=self._daily_realized_pnl + unrealized,
            realized_pnl_today=self._daily_realized_pnl,
            unrealized_pnl=unrealized,
            total_delta=total_greeks.delta,
            total_gamma=total_greeks.gamma,
            total_theta=total_greeks.theta,
            total_vega=total_greeks.vega,
            symbol_exposure=symbol_exposure,
            cluster_exposure=cluster_exposure,
        )
    
    def _get_cluster(self, symbol: str) -> str:
        """Get cluster for a symbol."""
        for cluster, symbols in self.SYMBOL_CLUSTERS.items():
            if symbol in symbols:
                return cluster
        return "other"
    
    def get_expiring_positions(self, days: int = 7) -> List[OptionsPosition]:
        """Get positions expiring within N days."""
        return [
            p for p in self.get_open_positions()
            if 0 < p.dte <= days
        ]
    
    def get_positions_at_profit_target(
        self,
        profit_percent: float = 50.0,
    ) -> List[OptionsPosition]:
        """Get positions at or above profit target."""
        results = []
        for p in self.get_open_positions():
            if p.max_profit > 0:
                pnl_pct = (p.unrealized_pnl / p.max_profit) * 100
                if pnl_pct >= profit_percent:
                    results.append(p)
        return results
    
    def get_positions_at_loss_limit(
        self,
        loss_percent: float = 100.0,
    ) -> List[OptionsPosition]:
        """Get positions at or beyond loss limit."""
        results = []
        for p in self.get_open_positions():
            if p.max_loss > 0:
                loss_pct = abs(min(0, p.unrealized_pnl)) / p.max_loss * 100
                if loss_pct >= loss_percent:
                    results.append(p)
        return results
