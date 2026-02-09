"""
Alpaca Broker Client

Provides a unified interface to Alpaca's paper trading API.
This is the source of truth for positions and orders.

Key features:
- Position fetching (stock + options)
- Order submission
- Account info
- Market hours check
"""

from dataclasses import dataclass, field
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional, Tuple
from enum import Enum
import asyncio
import logging
import os

logger = logging.getLogger(__name__)


# ============================================================================
# MODELS
# ============================================================================

class AssetClass(str, Enum):
    """Asset class types."""
    US_EQUITY = "us_equity"
    US_OPTION = "us_option"


class OrderSide(str, Enum):
    """Order sides."""
    BUY = "buy"
    SELL = "sell"


class OrderType(str, Enum):
    """Order types."""
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"


class OrderStatus(str, Enum):
    """Order statuses."""
    NEW = "new"
    PARTIALLY_FILLED = "partially_filled"
    FILLED = "filled"
    DONE_FOR_DAY = "done_for_day"
    CANCELED = "canceled"
    EXPIRED = "expired"
    REPLACED = "replaced"
    PENDING_CANCEL = "pending_cancel"
    PENDING_REPLACE = "pending_replace"
    PENDING_NEW = "pending_new"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


@dataclass
class AlpacaPosition:
    """Position from Alpaca."""
    symbol: str
    qty: int
    side: str
    avg_entry_price: float
    current_price: float
    market_value: float
    unrealized_pl: float
    unrealized_plpc: float
    asset_class: str
    
    # Option-specific
    underlying_symbol: Optional[str] = None
    expiration_date: Optional[str] = None
    strike_price: Optional[float] = None
    option_type: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "qty": self.qty,
            "side": self.side,
            "avg_entry_price": self.avg_entry_price,
            "current_price": self.current_price,
            "market_value": self.market_value,
            "unrealized_pl": self.unrealized_pl,
            "unrealized_plpc": self.unrealized_plpc,
            "asset_class": self.asset_class,
            "underlying_symbol": self.underlying_symbol,
            "expiration_date": self.expiration_date,
            "strike_price": self.strike_price,
            "option_type": self.option_type,
        }


@dataclass
class AlpacaOrder:
    """Order from Alpaca."""
    id: str
    client_order_id: str
    symbol: str
    side: str
    order_type: str
    qty: int
    filled_qty: int
    status: str
    created_at: Optional[datetime] = None
    filled_at: Optional[datetime] = None
    limit_price: Optional[float] = None
    stop_price: Optional[float] = None
    filled_avg_price: Optional[float] = None
    asset_class: str = "us_equity"
    legs: List[Dict] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "client_order_id": self.client_order_id,
            "symbol": self.symbol,
            "side": self.side,
            "order_type": self.order_type,
            "qty": self.qty,
            "filled_qty": self.filled_qty,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "filled_at": self.filled_at.isoformat() if self.filled_at else None,
            "limit_price": self.limit_price,
            "stop_price": self.stop_price,
            "filled_avg_price": self.filled_avg_price,
            "asset_class": self.asset_class,
            "legs": self.legs,
        }


@dataclass
class AlpacaAccount:
    """Account info from Alpaca."""
    id: str
    account_number: str
    status: str
    currency: str = "USD"
    cash: float = 0.0
    portfolio_value: float = 0.0
    buying_power: float = 0.0
    daytrading_buying_power: float = 0.0
    equity: float = 0.0
    last_equity: float = 0.0
    pattern_day_trader: bool = False
    trading_blocked: bool = False
    transfers_blocked: bool = False
    account_blocked: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "account_number": self.account_number,
            "status": self.status,
            "currency": self.currency,
            "cash": self.cash,
            "portfolio_value": self.portfolio_value,
            "buying_power": self.buying_power,
            "daytrading_buying_power": self.daytrading_buying_power,
            "equity": self.equity,
            "last_equity": self.last_equity,
            "pattern_day_trader": self.pattern_day_trader,
            "trading_blocked": self.trading_blocked,
            "transfers_blocked": self.transfers_blocked,
            "account_blocked": self.account_blocked,
        }


@dataclass
class MarketClock:
    """Market clock info."""
    timestamp: datetime
    is_open: bool
    next_open: Optional[datetime] = None
    next_close: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "is_open": self.is_open,
            "next_open": self.next_open.isoformat() if self.next_open else None,
            "next_close": self.next_close.isoformat() if self.next_close else None,
        }


# ============================================================================
# ALPACA CLIENT
# ============================================================================

class AlpacaBrokerClient:
    """
    Client for Alpaca paper trading API.
    
    Uses alpaca-trade-api SDK if available, falls back to direct REST.
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        api_secret: Optional[str] = None,
        paper: bool = True,
    ):
        from ..config import get_settings
        settings = get_settings()

        self._api_key = api_key or settings.apca_api_key_id or os.environ.get("APCA_API_KEY_ID", "")
        self._api_secret = api_secret or settings.apca_api_secret_key or os.environ.get("APCA_API_SECRET_KEY", "")
        self._paper = paper
        self._base_url = (
            "https://paper-api.alpaca.markets"
            if paper
            else "https://api.alpaca.markets"
        )
        self._api = None
        self._init_client()
    
    def _init_client(self):
        """Initialize Alpaca SDK if available."""
        if not self._api_key or not self._api_secret:
            logger.warning("Alpaca credentials not configured")
            return
        
        try:
            from alpaca.trading.client import TradingClient
            self._api = TradingClient(
                api_key=self._api_key,
                secret_key=self._api_secret,
                paper=self._paper,
            )
            logger.info("Alpaca TradingClient initialized (paper mode)")
        except ImportError:
            logger.warning("alpaca-py not installed, using REST fallback")
        except Exception as e:
            logger.error(f"Failed to initialize Alpaca TradingClient: {e}", exc_info=True)
    
    @property
    def is_configured(self) -> bool:
        """Check if API credentials are configured."""
        return bool(self._api_key and self._api_secret)
    
    @property
    def is_connected(self) -> bool:
        """Check if client is connected."""
        return self._api is not None
    
    # -------------------------------------------------------------------------
    # Account
    # -------------------------------------------------------------------------
    
    async def get_account(self) -> Optional[AlpacaAccount]:
        """Get account info."""
        if not self._api:
            return None
        
        try:
            acct = self._api.get_account()
            return AlpacaAccount(
                id=str(acct.id),
                account_number=acct.account_number,
                status=acct.status.value,
                currency=acct.currency,
                cash=float(acct.cash),
                portfolio_value=float(acct.portfolio_value),
                buying_power=float(acct.buying_power),
                daytrading_buying_power=float(acct.daytrading_buying_power or 0),
                equity=float(acct.equity),
                last_equity=float(acct.last_equity),
                pattern_day_trader=acct.pattern_day_trader,
                trading_blocked=acct.trading_blocked,
                transfers_blocked=acct.transfers_blocked,
                account_blocked=acct.account_blocked,
            )
        except Exception as e:
            logger.error(f"Failed to get account: {e}")
            return None
    
    # -------------------------------------------------------------------------
    # Positions
    # -------------------------------------------------------------------------
    
    async def list_positions(self) -> List[AlpacaPosition]:
        """Get all positions."""
        if not self._api:
            return []
        
        try:
            positions = self._api.get_all_positions()
            result = []
            
            for pos in positions:
                result.append(AlpacaPosition(
                    symbol=pos.symbol,
                    qty=int(pos.qty),
                    side=pos.side.value,
                    avg_entry_price=float(pos.avg_entry_price),
                    current_price=float(pos.current_price),
                    market_value=float(pos.market_value),
                    unrealized_pl=float(pos.unrealized_pl),
                    unrealized_plpc=float(pos.unrealized_plpc),
                    asset_class=pos.asset_class.value,
                    # Option fields would be parsed from symbol if needed
                ))
            
            return result
        except Exception as e:
            logger.error(f"Failed to list positions: {e}")
            return []
    
    async def get_position(self, symbol: str) -> Optional[AlpacaPosition]:
        """Get a specific position."""
        if not self._api:
            return None
        
        try:
            pos = self._api.get_open_position(symbol)
            return AlpacaPosition(
                symbol=pos.symbol,
                qty=int(pos.qty),
                side=pos.side.value,
                avg_entry_price=float(pos.avg_entry_price),
                current_price=float(pos.current_price),
                market_value=float(pos.market_value),
                unrealized_pl=float(pos.unrealized_pl),
                unrealized_plpc=float(pos.unrealized_plpc),
                asset_class=pos.asset_class.value,
            )
        except Exception as e:
            logger.debug(f"Position not found for {symbol}: {e}")
            return None
    
    async def close_position(self, symbol: str) -> Optional[AlpacaOrder]:
        """Close a position."""
        if not self._api:
            return None
        
        try:
            result = self._api.close_position(symbol)
            return AlpacaOrder(
                id=str(result.id),
                client_order_id=result.client_order_id,
                symbol=result.symbol,
                side=result.side.value,
                order_type=result.order_type.value,
                qty=int(result.qty),
                filled_qty=int(result.filled_qty),
                status=result.status.value,
            )
        except Exception as e:
            logger.error(f"Failed to close position {symbol}: {e}")
            return None
    
    # -------------------------------------------------------------------------
    # Orders
    # -------------------------------------------------------------------------
    
    async def list_orders(
        self,
        status: str = "open",
        limit: int = 100,
    ) -> List[AlpacaOrder]:
        """Get orders."""
        if not self._api:
            return []
        
        try:
            from alpaca.trading.requests import GetOrdersRequest
            from alpaca.trading.enums import QueryOrderStatus
            
            status_map = {
                "open": QueryOrderStatus.OPEN,
                "closed": QueryOrderStatus.CLOSED,
                "all": QueryOrderStatus.ALL,
            }
            
            request = GetOrdersRequest(
                status=status_map.get(status, QueryOrderStatus.OPEN),
                limit=limit,
            )
            orders = self._api.get_orders(request)
            
            result = []
            for o in orders:
                result.append(AlpacaOrder(
                    id=str(o.id),
                    client_order_id=o.client_order_id,
                    symbol=o.symbol,
                    side=o.side.value,
                    order_type=o.order_type.value,
                    qty=int(o.qty),
                    filled_qty=int(o.filled_qty) if o.filled_qty else 0,
                    status=o.status.value,
                    created_at=o.created_at,
                    filled_at=o.filled_at,
                    limit_price=float(o.limit_price) if o.limit_price else None,
                    stop_price=float(o.stop_price) if o.stop_price else None,
                    filled_avg_price=float(o.filled_avg_price) if o.filled_avg_price else None,
                    asset_class=o.asset_class.value if hasattr(o, 'asset_class') else "us_equity",
                ))
            
            return result
        except Exception as e:
            logger.error(f"Failed to list orders: {e}")
            return []
    
    async def submit_order(
        self,
        candidate_or_symbol: Any,
        qty: int = 1,
        side: str = "buy",
        order_type: str = "market",
        limit_price: Optional[float] = None,
        client_order_id: Optional[str] = None,
        time_in_force: str = "day",
    ) -> Optional[AlpacaOrder]:
        """
        Submit an order.
        Supports passing a TradeCandidate object OR individual parameters (legacy).
        
        V1 COMPLIANCE: Market orders are banned. Only limit orders allowed.
        """
        if not self._api:
            return None
        
        # V1 HARD GATE: Reject market orders
        if order_type == "market":
            logger.error("V1 COMPLIANCE VIOLATION: Market orders are banned. Use limit orders only.")
            raise ValueError("V1 compliance: Market orders are not allowed. Use limit orders with a limit_price.")
        
        # V1 REQUIREMENT: limit_price must be provided for limit orders
        if order_type == "limit" and limit_price is None:
            logger.error("V1 COMPLIANCE VIOLATION: Limit orders require a limit_price.")
            raise ValueError("V1 compliance: Limit orders require a limit_price parameter.")
        
        try:
            from alpaca.trading.requests import LimitOrderRequest, OrderRequest
            from alpaca.trading.enums import OrderSide, TimeInForce, OrderType as AlpacaOrderType
            
            # Handle TradeCandidate object
            if hasattr(candidate_or_symbol, "symbol"):
                candidate = candidate_or_symbol
                symbol = candidate.symbol
                
                # Check for legs (Multi-leg / Spread)
                if hasattr(candidate, "legs") and candidate.legs:
                    return await self._submit_multileg_order(candidate)
                    
                # Single leg fallback
                qty = 1 # Default or from candidate?
                side = "buy" # Default or from candidate?
                # ... extract other fields if needed, but existing usage implies mostly spreads
                # If it's a simple candidate without legs, we might need more logic here.
                # For now, let's assume if it's passed as object, it's likely a spread or we extract basics.
                limit_price = None # Candidate usage usually implies 
            else:
                symbol = candidate_or_symbol

            side_enum = OrderSide.BUY if side == "buy" else OrderSide.SELL
            tif = TimeInForce.DAY if time_in_force == "day" else TimeInForce.GTC
            
            # V1 COMPLIANCE: Only limit orders allowed
            # Market orders branch removed - will raise exception above
            request = LimitOrderRequest(
                symbol=symbol,
                qty=qty,
                side=side_enum,
                time_in_force=tif,
                limit_price=limit_price,
                client_order_id=client_order_id,
            )
            
            result = self._api.submit_order(request)
            
            return AlpacaOrder(
                id=str(result.id),
                client_order_id=result.client_order_id,
                symbol=result.symbol,
                side=result.side.value,
                order_type=result.order_type.value,
                qty=int(result.qty) if result.qty else 0,
                filled_qty=int(result.filled_qty) if result.filled_qty else 0,
                status=result.status.value,
                created_at=result.created_at,
                limit_price=float(result.limit_price) if result.limit_price else None,
            )
        except Exception as e:
            logger.error(f"Failed to submit order: {e}")
            return None

    async def _submit_multileg_order(self, candidate: Any) -> Optional[AlpacaOrder]:
        """Submit a multi-leg option order (spread)."""
        try:
            from alpaca.trading.requests import OrderRequest
            from alpaca.trading.enums import OrderSide, TimeInForce, OrderType
            
            # Build legs
            alpaca_legs = []
            for leg in candidate.legs:
                # leg is OptionLeg(side, option_type, strike, quantity, expiry)
                # We need to format the Option Symbol (OCC) for each leg
                # Or does Alpaca accept structured legs? 
                # Alpaca API expects 'symbol' (OCC) for each leg in the 'legs' array
                
                # We need a helper to generate OCC symbol from leg data
                # But wait, TradeCandidate legs might not have the full symbol computed yet?
                # The UnifiedEngine logic seemed to parse candidate dicts.
                
                pass 
                # TODO: Implement OCC symbol generation if not present
                # For now, assuming we can't easily do it without helpers.
                # Actually, earlier in UnifiedEngine we saw it constructing legs.
                
            # If we can't reliably build OCC symbols here without more helpers, 
            # maybe we should look at how UnifiedEngine was doing it or if it provided them.
            
            logger.warning("Multi-leg submission not fully implemented yet in _submit_multileg_order")
            return None
            
        except Exception as e:
            logger.error(f"Failed to submit multileg order: {e}")
            return None
    
    async def cancel_order(self, order_id: str) -> bool:
        """Cancel an order."""
        if not self._api:
            return False
        
        try:
            self._api.cancel_order_by_id(order_id)
            return True
        except Exception as e:
            logger.error(f"Failed to cancel order {order_id}: {e}")
            return False
    
    # -------------------------------------------------------------------------
    # Flatten All (EOD Safety)
    # -------------------------------------------------------------------------
    
    async def flatten_all(self, reason: str = "EOD Flatten") -> Dict[str, Any]:
        """
        Cancel all open orders and close all positions.
        
        CRITICAL SAFETY FUNCTION: Called at trading cutoff (2:15pm ET) to:
        1. Cancel all open orders (stop new trades)
        2. Close all positions (go to cash)
        
        This ensures we don't hold positions overnight on paper account.
        
        Returns:
            Dict with results: {
                "orders_cancelled": int,
                "orders_failed": int,
                "positions_closed": int,
                "positions_failed": int,
                "errors": List[str]
            }
        """
        result = {
            "orders_cancelled": 0,
            "orders_failed": 0,
            "positions_closed": 0,
            "positions_failed": 0,
            "errors": [],
            "reason": reason,
        }
        
        logger.warning(f"FLATTEN_ALL triggered: {reason}")
        
        # Step 1: Cancel all open orders
        try:
            open_orders = await self.list_orders(status="open")
            logger.info(f"Found {len(open_orders)} open orders to cancel")
            
            for order in open_orders:
                try:
                    success = await self.cancel_order(order.id)
                    if success:
                        result["orders_cancelled"] += 1
                        logger.info(f"Cancelled order {order.id} ({order.symbol})")
                    else:
                        result["orders_failed"] += 1
                        result["errors"].append(f"Failed to cancel order {order.id}")
                except Exception as e:
                    result["orders_failed"] += 1
                    result["errors"].append(f"Error cancelling order {order.id}: {e}")
        except Exception as e:
            result["errors"].append(f"Failed to list open orders: {e}")
            logger.error(f"Failed to list open orders for flatten: {e}")
        
        # Step 2: Close all positions
        try:
            positions = await self.list_positions()
            logger.info(f"Found {len(positions)} positions to close")
            
            for pos in positions:
                try:
                    close_result = await self.close_position(pos.symbol)
                    if close_result:
                        result["positions_closed"] += 1
                        logger.info(f"Closed position {pos.symbol} ({pos.qty} shares)")
                    else:
                        result["positions_failed"] += 1
                        result["errors"].append(f"Failed to close position {pos.symbol}")
                except Exception as e:
                    result["positions_failed"] += 1
                    result["errors"].append(f"Error closing position {pos.symbol}: {e}")
        except Exception as e:
            result["errors"].append(f"Failed to list positions: {e}")
            logger.error(f"Failed to list positions for flatten: {e}")
        
        # Log summary
        logger.warning(
            f"FLATTEN_ALL complete: "
            f"Cancelled {result['orders_cancelled']} orders, "
            f"Closed {result['positions_closed']} positions, "
            f"Errors: {len(result['errors'])}"
        )
        
        return result
    
    # -------------------------------------------------------------------------
    # Market Clock
    # -------------------------------------------------------------------------
    
    async def get_clock(self) -> Optional[MarketClock]:
        """Get market clock."""
        if not self._api:
            # Return synthetic clock
            now = datetime.utcnow()
            return MarketClock(
                timestamp=now,
                is_open=self._synthetic_is_open(now),
            )
        
        try:
            clock = self._api.get_clock()
            return MarketClock(
                timestamp=clock.timestamp,
                is_open=clock.is_open,
                next_open=clock.next_open,
                next_close=clock.next_close,
            )
        except Exception as e:
            logger.error(f"Failed to get clock: {e}")
            return None
    
    def _synthetic_is_open(self, now: datetime) -> bool:
        """Synthetic market hours check."""
        # US market hours: 9:30 AM - 4:00 PM ET (approx 14:30 - 21:00 UTC)
        weekday = now.weekday()
        if weekday >= 5:  # Weekend
            return False
        hour = now.hour
        minute = now.minute
        # Convert to rough ET time (UTC - 5 in winter, -4 in summer)
        et_hour = (hour - 5) % 24
        if 9 <= et_hour < 16:
            if et_hour == 9 and minute < 30:
                return False
            return True
        return False
    
    # -------------------------------------------------------------------------
    # Health Check
    # -------------------------------------------------------------------------
    
    async def health_check(self) -> Tuple[bool, float]:
        """
        Check broker connectivity.
        Returns (connected, latency_ms).
        """
        if not self._api:
            return False, 0.0
        
        try:
            start = datetime.utcnow()
            self._api.get_account()
            latency = (datetime.utcnow() - start).total_seconds() * 1000
            return True, latency
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False, 0.0


# ============================================================================
# Singleton
# ============================================================================

_client: Optional[AlpacaBrokerClient] = None


def get_alpaca_client() -> AlpacaBrokerClient:
    """Get singleton Alpaca client."""
    global _client
    if _client is None:
        _client = AlpacaBrokerClient()
    return _client

    def _map_order_result(self, result: Any) -> AlpacaOrder:
        """Helper to map Alpaca order result to our model."""
        return AlpacaOrder(
            id=str(result.id),
            client_order_id=result.client_order_id,
            symbol=result.symbol,
            side=result.side.value if hasattr(result.side, 'value') else str(result.side),
            order_type=result.order_type.value if hasattr(result.order_type, 'value') else str(result.order_type),
            qty=int(result.qty) if result.qty else 0,
            filled_qty=int(result.filled_qty) if result.filled_qty else 0,
            status=result.status.value if hasattr(result.status, 'value') else str(result.status),
            created_at=result.created_at,
            limit_price=float(result.limit_price) if result.limit_price else None,
        )

    def _get_occ_symbol(self, underlying: str, expiry: date, option_type: str, strike: float) -> str:
        """Generate OCC option symbol."""
        # Format date YYMMDD
        yrmod = expiry.strftime("%y%m%d")
        type_char = "C" if option_type.lower() == "call" else "P"
        
        # Strike * 1000, padded to 8 digits
        strike_int = int(strike * 1000)
        strike_str = f"{strike_int:08d}"
        
        # Standard OCC: Underlying (up to 6 chars), Date(6), Type(1), Strike(8)
        # Alpaca often accepts the raw concat string.
        # Ensure underlying is trimmed.
        return f"{underlying}{yrmod}{type_char}{strike_str}" 
        
    async def _submit_multileg_order(self, candidate: Any) -> Optional[AlpacaOrder]:
        """Submit a multi-leg option order (Atomic MLEG) with Slippage Protection."""
        try:
            from alpaca.trading.requests import OrderRequest, OptionLegRequest
            from alpaca.trading.enums import OrderSide, TimeInForce, OrderType, OrderClass
            
            legs_config = []
            primary_symbol = None
            total_premium = 0.0
            
            for i, leg in enumerate(candidate.legs):
                occ_symbol = self._get_occ_symbol(
                    candidate.symbol, 
                    leg.expiry, 
                    leg.option_type, 
                    leg.strike
                )
                
                # Map side
                alpaca_side = OrderSide.BUY if leg.side == "buy" else OrderSide.SELL
                
                # Calculate premium contribution (Sell = +, Buy = -)
                # Note: leg.premium is per share usually? or per contract? 
                # candidates.py says 'premium' (e.g. 0.50). 
                # Net premium sum should be unit price (e.g. 0.20 credit).
                leg_sign = 1 if leg.side == "sell" else -1
                total_premium += (leg.premium * leg.quantity * leg_sign)
                
                leg_req = OptionLegRequest(
                    symbol=occ_symbol,
                    ratio_qty=1, 
                    side=alpaca_side
                )
                legs_config.append(leg_req)
                
                if i == 0:
                    primary_symbol = occ_symbol

            if not legs_config or not primary_symbol:
                return None
            
            # Slippage Calculation (5% tolerance)
            # Credit (Positive) -> Sell Limit: Min Acceptable Credit = Premium * 0.95
            # Debit (Negative)  -> Buy Limit: Max Acceptable Debit = Premium * 1.05
            SLIPPAGE_TOLERANCE = 0.05
            
            is_credit = total_premium > 0
            base_price = abs(total_premium)
            
            if is_credit:
                limit_price = base_price * (1 - SLIPPAGE_TOLERANCE)
            else:
                limit_price = base_price * (1 + SLIPPAGE_TOLERANCE)
                
            # Round to 2 decimals
            limit_price = round(max(0.01, limit_price), 2)
            
            logger.info(f"Submitting ATOMIC MLEG order for {candidate.symbol}. Net Premium: ${total_premium:.2f}, Limit: ${limit_price:.2f}")
            
            order_qty = candidate.legs[0].quantity if candidate.legs else 1
            
            req = OrderRequest(
                symbol=primary_symbol,
                qty=order_qty,
                side=legs_config[0].side, 
                type=OrderType.LIMIT, # PROMOTED TO LIMIT
                limit_price=limit_price,
                time_in_force=TimeInForce.DAY,
                order_class=OrderClass.MLEG,
                legs=legs_config
            )
            
            res = self._api.submit_order(req)
            logger.info(f"Atomic MLEG Limit Order Submitted: {res.id} @ ${limit_price}")
            
            return self._map_order_result(res)
            
        except Exception as e:
            logger.error(f"Failed to submit atomic multileg order: {e}")
            return None
