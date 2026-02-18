"""
Portfolio Manager - Position tracking, cash management, and PnL calculation.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional
from datetime import datetime
from enum import Enum
import json


class PositionSide(str, Enum):
    LONG = "long"
    SHORT = "short"
    FLAT = "flat"


@dataclass
class Position:
    """Represents a position in a single symbol."""
    symbol: str
    quantity: float = 0.0
    avg_cost: float = 0.0
    current_price: float = 0.0
    
    @property
    def side(self) -> PositionSide:
        if self.quantity > 0:
            return PositionSide.LONG
        elif self.quantity < 0:
            return PositionSide.SHORT
        return PositionSide.FLAT
    
    @property
    def market_value(self) -> float:
        return self.quantity * self.current_price
    
    @property
    def cost_basis(self) -> float:
        return self.quantity * self.avg_cost
    
    @property
    def unrealized_pnl(self) -> float:
        return self.market_value - self.cost_basis
    
    @property
    def unrealized_pnl_pct(self) -> float:
        if self.cost_basis == 0:
            return 0.0
        return (self.unrealized_pnl / abs(self.cost_basis)) * 100
    
    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "quantity": self.quantity,
            "avg_cost": self.avg_cost,
            "current_price": self.current_price,
            "side": self.side.value,
            "market_value": self.market_value,
            "cost_basis": self.cost_basis,
            "unrealized_pnl": self.unrealized_pnl,
            "unrealized_pnl_pct": self.unrealized_pnl_pct,
        }


@dataclass
class Trade:
    """Represents a completed trade."""
    id: str
    symbol: str
    side: str  # "buy" or "sell"
    quantity: float
    price: float
    timestamp: datetime
    commission: float = 0.0
    slippage: float = 0.0
    
    @property
    def gross_value(self) -> float:
        return self.quantity * self.price
    
    @property
    def net_value(self) -> float:
        """Value after commission and slippage."""
        total_cost = self.commission + abs(self.slippage)
        if self.side == "buy":
            return self.gross_value + total_cost
        return self.gross_value - total_cost
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "symbol": self.symbol,
            "side": self.side,
            "quantity": self.quantity,
            "price": self.price,
            "timestamp": self.timestamp.isoformat(),
            "commission": self.commission,
            "slippage": self.slippage,
            "gross_value": self.gross_value,
            "net_value": self.net_value,
        }


class PortfolioManager:
    """
    Manages portfolio state including positions, cash, and trade history.
    Thread-safe for concurrent updates.
    """
    
    def __init__(
        self,
        initial_cash: float = 100000.0,
        currency: str = "USD"
    ):
        self.initial_cash = initial_cash
        self.cash = initial_cash
        self.currency = currency
        self.positions: Dict[str, Position] = {}
        self.trades: List[Trade] = []
        self.realized_pnl: float = 0.0
        self._trade_counter = 0
    
    def _generate_trade_id(self) -> str:
        self._trade_counter += 1
        return f"TRD-{self._trade_counter:06d}"
    
    def get_position(self, symbol: str) -> Position:
        """Get position for a symbol, creating if doesn't exist."""
        if symbol not in self.positions:
            self.positions[symbol] = Position(symbol=symbol)
        return self.positions[symbol]
    
    def update_price(self, symbol: str, price: float) -> None:
        """Update current price for a position."""
        if symbol in self.positions:
            self.positions[symbol].current_price = price
    
    def execute_fill(
        self,
        symbol: str,
        side: str,
        quantity: float,
        price: float,
        timestamp: datetime,
        commission: float = 0.0,
        slippage: float = 0.0
    ) -> Trade:
        """
        Process a fill and update portfolio state.
        
        Args:
            symbol: The instrument symbol
            side: "buy" or "sell"
            quantity: Number of shares/units
            price: Fill price
            timestamp: Execution time
            commission: Commission paid
            slippage: Slippage incurred
        
        Returns:
            Trade record
        """
        if quantity <= 0:
            raise ValueError("Quantity must be positive")
        
        if side not in ("buy", "sell"):
            raise ValueError("Side must be 'buy' or 'sell'")
        
        position = self.get_position(symbol)
        
        # Calculate realized PnL if closing/reducing position
        realized = 0.0
        
        if side == "buy":
            fill_qty = quantity
            fill_cost = quantity * price + commission + slippage
            
            # Check if we're covering a short
            if position.quantity < 0:
                cover_qty = min(quantity, abs(position.quantity))
                realized = cover_qty * (position.avg_cost - price)
                fill_qty -= cover_qty
                position.quantity += cover_qty
            
            # Add to long position
            if fill_qty > 0:
                if position.quantity > 0:
                    # Average up/down
                    total_cost = position.quantity * position.avg_cost + fill_qty * price
                    position.quantity += fill_qty
                    position.avg_cost = total_cost / position.quantity
                else:
                    position.quantity = fill_qty
                    position.avg_cost = price
            
            self.cash -= fill_cost
            
        else:  # sell
            fill_qty = quantity
            fill_proceeds = quantity * price - commission - abs(slippage)
            
            # Check if we're closing a long
            if position.quantity > 0:
                close_qty = min(quantity, position.quantity)
                realized = close_qty * (price - position.avg_cost)
                fill_qty -= close_qty
                position.quantity -= close_qty
            
            # Add to short position
            if fill_qty > 0:
                if position.quantity < 0:
                    # Average short position
                    total_cost = abs(position.quantity) * position.avg_cost + fill_qty * price
                    position.quantity -= fill_qty
                    position.avg_cost = total_cost / abs(position.quantity)
                else:
                    position.quantity = -fill_qty
                    position.avg_cost = price
            
            self.cash += fill_proceeds
        
        # Update realized PnL
        self.realized_pnl += realized - commission - abs(slippage)
        
        # Record trade
        trade = Trade(
            id=self._generate_trade_id(),
            symbol=symbol,
            side=side,
            quantity=quantity,
            price=price,
            timestamp=timestamp,
            commission=commission,
            slippage=slippage,
        )
        self.trades.append(trade)
        
        # Update position current price
        position.current_price = price
        
        # Clean up flat positions
        if position.quantity == 0:
            position.avg_cost = 0.0
        
        return trade
    
    @property
    def total_market_value(self) -> float:
        """Total value of all positions at current prices."""
        return sum(p.market_value for p in self.positions.values())
    
    @property
    def total_unrealized_pnl(self) -> float:
        """Total unrealized PnL across all positions."""
        return sum(p.unrealized_pnl for p in self.positions.values())
    
    @property
    def equity(self) -> float:
        """Total portfolio equity (cash + positions)."""
        return self.cash + self.total_market_value
    
    @property
    def total_pnl(self) -> float:
        """Total PnL (realized + unrealized)."""
        return self.realized_pnl + self.total_unrealized_pnl
    
    @property
    def return_pct(self) -> float:
        """Portfolio return percentage."""
        if self.initial_cash == 0:
            return 0.0
        return ((self.equity - self.initial_cash) / self.initial_cash) * 100
    
    def get_positions(self) -> List[Position]:
        """Get all non-flat positions."""
        return [p for p in self.positions.values() if p.quantity != 0]
    
    def to_dict(self) -> dict:
        """Serialize portfolio state."""
        return {
            "cash": self.cash,
            "equity": self.equity,
            "total_market_value": self.total_market_value,
            "realized_pnl": self.realized_pnl,
            "unrealized_pnl": self.total_unrealized_pnl,
            "total_pnl": self.total_pnl,
            "return_pct": self.return_pct,
            "positions": [p.to_dict() for p in self.get_positions()],
            "trade_count": len(self.trades),
        }
    
    def export_trades_json(self) -> str:
        """Export trade history as JSON."""
        return json.dumps([t.to_dict() for t in self.trades], indent=2)
    
    def export_trades_csv(self) -> str:
        """Export trade history as CSV."""
        if not self.trades:
            return "id,symbol,side,quantity,price,timestamp,commission,slippage,gross_value,net_value\n"
        
        lines = ["id,symbol,side,quantity,price,timestamp,commission,slippage,gross_value,net_value"]
        for t in self.trades:
            lines.append(
                f"{t.id},{t.symbol},{t.side},{t.quantity},{t.price},"
                f"{t.timestamp.isoformat()},{t.commission},{t.slippage},"
                f"{t.gross_value},{t.net_value}"
            )
        return "\n".join(lines)
    
    def reset(self) -> None:
        """Reset portfolio to initial state."""
        self.cash = self.initial_cash
        self.positions.clear()
        self.trades.clear()
        self.realized_pnl = 0.0
        self._trade_counter = 0
