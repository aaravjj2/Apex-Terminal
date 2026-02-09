"""
Alpaca Adapter - Integration with Alpaca paper trading API.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Any
from datetime import datetime
from enum import Enum
import logging
import os
import asyncio

from ..execution.order_types import Order, OrderType, OrderSide, OrderStatus, TimeInForce, Fill


logger = logging.getLogger(__name__)


class AlpacaError(Exception):
    """Alpaca API error."""
    pass


@dataclass
class AlpacaConfig:
    """Alpaca API configuration."""
    api_key: str
    api_secret: str
    base_url: str = "https://paper-api.alpaca.markets"
    data_url: str = "https://data.alpaca.markets"
    
    @classmethod
    def from_env(cls) -> "AlpacaConfig":
        """Load config from environment variables.

        Priority order:
          1. ALPACA3_KEY / ALPACA3_SECRET / ALPACA3_ENDPOINT (preferred)
          2. APCA_API_KEY_ID / APCA_API_SECRET_KEY / APCA_ENDPOINT (fallback)
        """
        # Prefer ALPACA3 variables (Strategy Lab / Alpaca3)
        api_key = os.environ.get("ALPACA3_KEY") or os.environ.get("APCA_API_KEY_ID")
        api_secret = os.environ.get("ALPACA3_SECRET") or os.environ.get("APCA_API_SECRET_KEY")
        endpoint = os.environ.get("ALPACA3_ENDPOINT") or os.environ.get("APCA_ENDPOINT") or "https://paper-api.alpaca.markets"

        if not api_key:
            raise ValueError("Alpaca API key not set (expected ALPACA3_KEY or APCA_API_KEY_ID)")
        if not api_secret:
            raise ValueError("Alpaca API secret not set (expected ALPACA3_SECRET or APCA_API_SECRET_KEY)")

        return cls(
            api_key=api_key,
            api_secret=api_secret,
            base_url=endpoint,
        )


class AlpacaAdapter:
    """
    Adapter for Alpaca Trading API.
    
    Features:
    - Paper trading support
    - Order placement and management
    - Position tracking
    - Account info
    """
    
    def __init__(self, config: Optional[AlpacaConfig] = None):
        self.config = config or AlpacaConfig.from_env()
        self._client = None
        self._trading_client = None
        self._order_map: Dict[str, str] = {}  # local_id -> alpaca_id
    
    def _ensure_client(self):
        """Initialize Alpaca client if not already done."""
        if self._trading_client is None:
            try:
                from alpaca.trading.client import TradingClient
                self._trading_client = TradingClient(
                    self.config.api_key,
                    self.config.api_secret,
                    paper=True if "paper" in self.config.base_url else False,
                )
            except ImportError:
                raise ImportError("alpaca-py not installed. Run: pip install alpaca-py")
    
    def verify_connection(self) -> dict:
        """Verify API connection and return account info."""
        self._ensure_client()
        
        try:
            account = self._trading_client.get_account()
            
            # Verify this is a paper account for safety
            if "paper" not in self.config.base_url.lower():
                logger.warning("Connected to production Alpaca account - be careful!")
            
            return {
                "account_number": account.account_number,
                "status": account.status.value if hasattr(account.status, 'value') else str(account.status),
                "cash": float(account.cash),
                "portfolio_value": float(account.portfolio_value),
                "buying_power": float(account.buying_power),
                "equity": float(account.equity),
                "is_paper": "paper" in self.config.base_url.lower(),
            }
        except Exception as e:
            raise AlpacaError(f"Failed to verify connection: {e}")
    
    def get_account(self) -> dict:
        """Get current account information."""
        return self.verify_connection()
    
    def get_positions(self) -> List[dict]:
        """Get all open positions."""
        self._ensure_client()
        
        try:
            positions = self._trading_client.get_all_positions()
            return [
                {
                    "symbol": p.symbol,
                    "qty": float(p.qty),
                    "side": "long" if float(p.qty) > 0 else "short",
                    "avg_entry_price": float(p.avg_entry_price),
                    "current_price": float(p.current_price),
                    "market_value": float(p.market_value),
                    "unrealized_pl": float(p.unrealized_pl),
                    "unrealized_plpc": float(p.unrealized_plpc),
                }
                for p in positions
            ]
        except Exception as e:
            raise AlpacaError(f"Failed to get positions: {e}")
    
    def get_position(self, symbol: str) -> Optional[dict]:
        """Get position for a specific symbol."""
        self._ensure_client()
        
        try:
            position = self._trading_client.get_open_position(symbol)
            return {
                "symbol": position.symbol,
                "qty": float(position.qty),
                "avg_entry_price": float(position.avg_entry_price),
                "current_price": float(position.current_price),
                "market_value": float(position.market_value),
                "unrealized_pl": float(position.unrealized_pl),
            }
        except Exception as e:
            if "position does not exist" in str(e).lower():
                return None
            raise AlpacaError(f"Failed to get position: {e}")
    
    def place_order(self, order: Order) -> str:
        """
        Place an order via Alpaca.
        
        Args:
            order: Order to place
        
        Returns:
            Alpaca order ID
        """
        self._ensure_client()
        
        try:
            from alpaca.trading.requests import (
                MarketOrderRequest, LimitOrderRequest,
                StopOrderRequest, StopLimitOrderRequest,
                TrailingStopOrderRequest
            )
            from alpaca.trading.enums import OrderSide as AlpacaSide, TimeInForce as AlpacaTIF
        except ImportError:
            raise ImportError("alpaca-py not installed")
        
        # Map order side
        side = AlpacaSide.BUY if order.side == OrderSide.BUY else AlpacaSide.SELL
        
        # Map time in force
        tif_map = {
            TimeInForce.DAY: AlpacaTIF.DAY,
            TimeInForce.GTC: AlpacaTIF.GTC,
            TimeInForce.IOC: AlpacaTIF.IOC,
            TimeInForce.FOK: AlpacaTIF.FOK,
        }
        tif = tif_map.get(order.time_in_force, AlpacaTIF.DAY)
        
        # Create appropriate request
        if order.order_type == OrderType.MARKET:
            request = MarketOrderRequest(
                symbol=order.symbol,
                qty=order.quantity,
                side=side,
                time_in_force=tif,
            )
        elif order.order_type == OrderType.LIMIT:
            request = LimitOrderRequest(
                symbol=order.symbol,
                qty=order.quantity,
                side=side,
                time_in_force=tif,
                limit_price=order.limit_price,
            )
        elif order.order_type == OrderType.STOP:
            request = StopOrderRequest(
                symbol=order.symbol,
                qty=order.quantity,
                side=side,
                time_in_force=tif,
                stop_price=order.stop_price,
            )
        elif order.order_type == OrderType.STOP_LIMIT:
            request = StopLimitOrderRequest(
                symbol=order.symbol,
                qty=order.quantity,
                side=side,
                time_in_force=tif,
                limit_price=order.limit_price,
                stop_price=order.stop_price,
            )
        elif order.order_type == OrderType.TRAILING_STOP:
            request = TrailingStopOrderRequest(
                symbol=order.symbol,
                qty=order.quantity,
                side=side,
                time_in_force=tif,
                trail_percent=order.trail_percent,
            )
        else:
            raise ValueError(f"Unsupported order type: {order.order_type}")
        
        try:
            alpaca_order = self._trading_client.submit_order(request)
            
            # Store mapping
            self._order_map[order.id] = alpaca_order.id
            
            logger.info(f"Order placed: {order.id} -> Alpaca {alpaca_order.id}")
            
            return alpaca_order.id
            
        except Exception as e:
            raise AlpacaError(f"Failed to place order: {e}")
    
    def get_order(self, order_id: str) -> dict:
        """Get order by ID (local or Alpaca ID)."""
        self._ensure_client()
        
        # Check if this is a local ID
        alpaca_id = self._order_map.get(order_id, order_id)
        
        try:
            order = self._trading_client.get_order_by_id(alpaca_id)
            return self._convert_order(order)
        except Exception as e:
            raise AlpacaError(f"Failed to get order: {e}")
    
    def get_orders(self, status: Optional[str] = None) -> List[dict]:
        """Get orders, optionally filtered by status."""
        self._ensure_client()
        
        try:
            from alpaca.trading.requests import GetOrdersRequest
            from alpaca.trading.enums import QueryOrderStatus
            
            status_map = {
                "open": QueryOrderStatus.OPEN,
                "closed": QueryOrderStatus.CLOSED,
                "all": QueryOrderStatus.ALL,
            }
            
            request = GetOrdersRequest(
                status=status_map.get(status, QueryOrderStatus.ALL),
            )
            
            orders = self._trading_client.get_orders(request)
            return [self._convert_order(o) for o in orders]
            
        except Exception as e:
            raise AlpacaError(f"Failed to get orders: {e}")
    
    def cancel_order(self, order_id: str) -> bool:
        """Cancel an order."""
        self._ensure_client()
        
        alpaca_id = self._order_map.get(order_id, order_id)
        
        try:
            self._trading_client.cancel_order_by_id(alpaca_id)
            logger.info(f"Order cancelled: {alpaca_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to cancel order: {e}")
            return False
    
    def cancel_all_orders(self) -> int:
        """Cancel all open orders."""
        self._ensure_client()
        
        try:
            cancelled = self._trading_client.cancel_orders()
            count = len(cancelled) if cancelled else 0
            logger.info(f"Cancelled {count} orders")
            return count
        except Exception as e:
            raise AlpacaError(f"Failed to cancel orders: {e}")
    
    def close_position(self, symbol: str) -> dict:
        """Close a position."""
        self._ensure_client()
        
        try:
            result = self._trading_client.close_position(symbol)
            return self._convert_order(result)
        except Exception as e:
            raise AlpacaError(f"Failed to close position: {e}")
    
    def close_all_positions(self) -> List[dict]:
        """Close all positions."""
        self._ensure_client()
        
        try:
            results = self._trading_client.close_all_positions()
            return [self._convert_order(r) for r in results if r]
        except Exception as e:
            raise AlpacaError(f"Failed to close positions: {e}")
    
    def _convert_order(self, alpaca_order) -> dict:
        """Convert Alpaca order to dict."""
        return {
            "id": str(alpaca_order.id),
            "client_order_id": alpaca_order.client_order_id,
            "symbol": alpaca_order.symbol,
            "side": alpaca_order.side.value if hasattr(alpaca_order.side, 'value') else str(alpaca_order.side),
            "qty": float(alpaca_order.qty) if alpaca_order.qty else 0,
            "filled_qty": float(alpaca_order.filled_qty) if alpaca_order.filled_qty else 0,
            "type": alpaca_order.order_type.value if hasattr(alpaca_order.order_type, 'value') else str(alpaca_order.order_type),
            "status": alpaca_order.status.value if hasattr(alpaca_order.status, 'value') else str(alpaca_order.status),
            "limit_price": float(alpaca_order.limit_price) if alpaca_order.limit_price else None,
            "stop_price": float(alpaca_order.stop_price) if alpaca_order.stop_price else None,
            "filled_avg_price": float(alpaca_order.filled_avg_price) if alpaca_order.filled_avg_price else None,
            "created_at": str(alpaca_order.created_at),
            "filled_at": str(alpaca_order.filled_at) if alpaca_order.filled_at else None,
        }
    
    def export_trades_csv(self, start_date: Optional[datetime] = None) -> str:
        """Export trade history as CSV for reconciliation."""
        orders = self.get_orders(status="closed")
        
        lines = ["id,symbol,side,qty,filled_qty,avg_price,status,created_at,filled_at"]
        for o in orders:
            if start_date and o.get("created_at"):
                # Filter by date if specified
                pass
            lines.append(
                f"{o['id']},{o['symbol']},{o['side']},{o['qty']},"
                f"{o['filled_qty']},{o.get('filled_avg_price', '')},{o['status']},"
                f"{o['created_at']},{o.get('filled_at', '')}"
            )
        
        return "\n".join(lines)
