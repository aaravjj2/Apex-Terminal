"""
Alpaca Options Broker - Submits options trades to Alpaca's paper trading API.

This broker wraps the PaperBroker but also sends orders to Alpaca
for visibility in the Alpaca dashboard.
"""

import os
import logging
import uuid
from typing import Dict, List, Optional, Any
from datetime import datetime, date
from dataclasses import dataclass

from .paper_broker import PaperBroker, PaperOrder, OrderStatus, OrderType
from .candidates import TradeCandidate, OptionLeg

logger = logging.getLogger(__name__)


@dataclass  
class AlpacaOrderResult:
    """Result of submitting an order to Alpaca."""
    success: bool
    alpaca_order_id: Optional[str] = None
    error: Optional[str] = None
    order_type: str = "options_spread"


class AlpacaOptionsBroker(PaperBroker):
    """
    Broker that submits options trades to Alpaca's paper trading API.
    
    Extends PaperBroker to maintain internal simulation while also
    logging trades to Alpaca for dashboard visibility.
    
    Note: Alpaca options support requires:
    - Options trading enabled on the account
    - Proper OCC symbol format: SYMBOL YYMMDD[C/P]STRIKE
    """
    
    def __init__(self, deterministic: bool = True, seed: int = 42, alpaca_enabled: bool = False):
        super().__init__(deterministic=deterministic, seed=seed)
        
        self._alpaca_client = None
        self._alpaca_enabled = False
        self._order_mappings: Dict[str, str] = {}  # paper_id -> alpaca_id
        
        # Check if Alpaca is configured and enabled
        if alpaca_enabled:
            self._init_alpaca()
    
    def _init_alpaca(self):
        """Initialize Alpaca client if credentials are available."""
        from ..config import get_settings
        settings = get_settings()

        api_key = settings.apca_api_key_id or os.environ.get("APCA_API_KEY_ID")
        api_secret = settings.apca_api_secret_key or os.environ.get("APCA_API_SECRET_KEY")
        
        if not api_key or not api_secret:
            logger.warning("Alpaca credentials not found - running in paper-only mode")
            return
        
        try:
            from alpaca.trading.client import TradingClient
            
            self._alpaca_client = TradingClient(
                api_key,
                api_secret,
                paper=True,
            )
            
            # Verify connection
            account = self._alpaca_client.get_account()
            self._alpaca_enabled = True
            
            logger.info(
                f"Alpaca connected: account={account.account_number}, "
                f"cash=${float(account.cash):,.2f}, status={account.status}"
            )
            
        except ImportError:
            logger.warning("alpaca-py not installed - run: pip install alpaca-py")
        except Exception as e:
            logger.error(f"Failed to connect to Alpaca: {e}")
    
    @property
    def alpaca_enabled(self) -> bool:
        """Check if Alpaca is enabled and connected."""
        return self._alpaca_enabled
    
    def submit_order(
        self,
        candidate: TradeCandidate,
        order_type: OrderType = OrderType.LIMIT,
        limit_price: Optional[float] = None,
    ) -> PaperOrder:
        """
        Submit order to both paper system and Alpaca.
        
        The paper system handles the internal simulation.
        Alpaca submission provides visibility in the dashboard.
        """
        # First, submit to paper broker
        paper_order = super().submit_order(candidate, order_type, limit_price)
        
        print(f"BROKER DEBUG: _alpaca_enabled={self._alpaca_enabled}, paper_order={paper_order.order_id}")
        
        # Then attempt Alpaca submission
        if self._alpaca_enabled:
            print(f"BROKER DEBUG: Attempting Alpaca submission for {paper_order.order_id}")
            try:
                alpaca_result = self._submit_to_alpaca(candidate, paper_order)
                
                print(f"BROKER DEBUG: Alpaca result success={alpaca_result.success}")
                
                if alpaca_result.success:
                    self._order_mappings[paper_order.order_id] = alpaca_result.alpaca_order_id
                    logger.info(
                        f"Order {paper_order.order_id} -> Alpaca {alpaca_result.alpaca_order_id}"
                    )
                    print(f"BROKER DEBUG: SUCCESS - {paper_order.order_id} -> {alpaca_result.alpaca_order_id}")
                else:
                    logger.warning(
                        f"Alpaca submission failed: {alpaca_result.error} "
                        f"(paper order still valid)"
                    )
                    print(f"BROKER DEBUG: FAILED - {alpaca_result.error}")
            except Exception as e:
                logger.error(f"Alpaca submission error: {e}")
                print(f"BROKER DEBUG: EXCEPTION - {e}")
        else:
            print(f"BROKER DEBUG: Alpaca disabled - not submitting")
        
        return paper_order
    
    def _generate_occ_symbol(self, symbol: str, expiry: date, option_type: str, strike: float) -> str:
        """Generate OCC standard option symbol (compact)."""
        # Root symbol: No padding for Alpaca API usually
        root = symbol
        # Date: YYMMDD
        yymmdd = expiry.strftime('%y%m%d')
        # Type: C or P
        type_char = 'C' if option_type.lower() == 'call' else 'P'
        # Strike: 8 digits (x1000)
        strike_int = int(strike * 1000)
        strike_str = f"{strike_int:08d}"
        
        return f"{root}{yymmdd}{type_char}{strike_str}"

    def _submit_to_alpaca(
        self,
        candidate: TradeCandidate,
        paper_order: PaperOrder,
    ) -> AlpacaOrderResult:
        """
        Submit option orders to Alpaca for dashboard visibility.
        Submits individual legs as we are just mirroring the internal paper execution.
        """
        if not self._alpaca_client:
            return AlpacaOrderResult(success=False, error="Client not initialized")
        
        try:
            from alpaca.trading.requests import MarketOrderRequest
            from alpaca.trading.enums import OrderSide, TimeInForce
            
            alpaca_ids = []
            errors = []
            
            # Submit each leg individually
            for leg in candidate.legs:
                try:
                    occ_symbol = self._generate_occ_symbol(
                        candidate.symbol, 
                        leg.expiry, 
                        leg.option_type, 
                        leg.strike
                    )
                    
                    side = OrderSide.BUY if leg.side == 'buy' else OrderSide.SELL
                    
                    # Use client_order_id from candidate if available, otherwise generate one
                    base_client_order_id = candidate.client_order_id if hasattr(candidate, 'client_order_id') and candidate.client_order_id else f"auto_{paper_order.order_id}"
                    leg_client_order_id = f"{base_client_order_id}_{uuid.uuid4().hex[:6]}"

                    request = MarketOrderRequest(
                        symbol=occ_symbol,
                        qty=leg.quantity,
                        side=side,
                        time_in_force=TimeInForce.DAY,
                        client_order_id=leg_client_order_id
                    )
                    
                    alpaca_order = self._alpaca_client.submit_order(request)
                    alpaca_ids.append(str(alpaca_order.id))
                    
                    logger.info(
                        f"Submitted Alpaca option: {occ_symbol} {leg.side} x{leg.quantity}"
                    )
                    
                except Exception as leg_error:
                    error_msg = f"Failed to submit leg {occ_symbol}: {leg_error}"
                    logger.error(error_msg)
                    errors.append(error_msg)
            
            if not alpaca_ids:
                return AlpacaOrderResult(
                    success=False,
                    error=f"No legs submitted. Errors: {'; '.join(errors)}"
                )
                
            return AlpacaOrderResult(
                success=True,
                alpaca_order_id=",".join(alpaca_ids),
                order_type="options_legs",
            )
            
        except Exception as e:
            return AlpacaOrderResult(
                success=False,
                error=str(e),
            )
    
    def get_alpaca_activity(self, limit: int = 10) -> List[dict]:
        """Get recent Alpaca orders for the autopilot."""
        if not self._alpaca_client:
            return []
        
        try:
            from alpaca.trading.requests import GetOrdersRequest
            from alpaca.trading.enums import QueryOrderStatus
            
            request = GetOrdersRequest(
                status=QueryOrderStatus.ALL,
                limit=limit,
            )
            orders = self._alpaca_client.get_orders(request)
            
            return [
                {
                    "id": str(o.id),
                    "client_order_id": o.client_order_id,
                    "symbol": o.symbol,
                    "side": o.side.value if hasattr(o.side, 'value') else str(o.side),
                    "qty": float(o.qty) if o.qty else 0,
                    "status": o.status.value if hasattr(o.status, 'value') else str(o.status),
                    "created_at": str(o.created_at),
                    "is_autopilot": "autopilot_" in (o.client_order_id or ""),
                }
                for o in orders
            ]
        except Exception as e:
            logger.error(f"Failed to get Alpaca activity: {e}")
            return []
    
    def get_alpaca_positions(self) -> List[dict]:
        """Get Alpaca positions."""
        if not self._alpaca_client:
            return []
        
        try:
            positions = self._alpaca_client.get_all_positions()
            return [
                {
                    "symbol": p.symbol,
                    "qty": float(p.qty),
                    "avg_entry_price": float(p.avg_entry_price),
                    "current_price": float(p.current_price),
                    "market_value": float(p.market_value),
                    "unrealized_pl": float(p.unrealized_pl),
                }
                for p in positions
            ]
        except Exception as e:
            logger.error(f"Failed to get Alpaca positions: {e}")
            return []
    
    def close_position(
        self,
        symbol: str,
        legs: List[OptionLeg],
        reason: str = "user_close",
    ) -> PaperOrder:
        """Close position in both paper and Alpaca."""
        # Close in paper system
        paper_order = super().close_position(symbol, legs, reason)
        
        # Note: For Alpaca, we would need to close any marker positions
        # This is handled separately if needed
        
        return paper_order
