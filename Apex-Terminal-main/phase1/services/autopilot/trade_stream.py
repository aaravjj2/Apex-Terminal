"""
Alpaca Trade Updates WebSocket

Real-time order fill, cancel, and rejection notifications.
Triggers position updates and monitoring cycles.
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Optional, Callable, Dict, Any, List
from enum import Enum
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

try:
    import websockets
    WEBSOCKETS_AVAILABLE = True
except ImportError:
    WEBSOCKETS_AVAILABLE = False


class TradeUpdateType(str, Enum):
    """Types of trade updates from Alpaca."""
    NEW = "new"
    FILL = "fill"
    PARTIAL_FILL = "partial_fill"
    CANCELED = "canceled"
    EXPIRED = "expired"
    DONE_FOR_DAY = "done_for_day"
    REPLACED = "replaced"
    PENDING_CANCEL = "pending_cancel"
    STOPPED = "stopped"
    REJECTED = "rejected"
    SUSPENDED = "suspended"
    PENDING_NEW = "pending_new"
    CALCULATED = "calculated"
    ACCEPTED = "accepted"
    ACCEPTED_FOR_BIDDING = "accepted_for_bidding"
    PENDING_REPLACE = "pending_replace"


@dataclass
class TradeUpdate:
    """A single trade update event."""
    event_type: TradeUpdateType
    timestamp: datetime
    order_id: str
    client_order_id: Optional[str]
    symbol: str
    side: str
    qty: float
    filled_qty: float
    avg_fill_price: Optional[float]
    order_type: str
    time_in_force: str
    status: str
    raw_data: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_type": self.event_type.value,
            "timestamp": self.timestamp.isoformat(),
            "order_id": self.order_id,
            "client_order_id": self.client_order_id,
            "symbol": self.symbol,
            "side": self.side,
            "qty": self.qty,
            "filled_qty": self.filled_qty,
            "avg_fill_price": self.avg_fill_price,
            "order_type": self.order_type,
            "time_in_force": self.time_in_force,
            "status": self.status,
        }


class AlpacaTradeStream:
    """
    WebSocket client for Alpaca trade updates.
    
    Handles:
    - Connection management with auto-reconnect
    - Authentication
    - Message parsing
    - Event dispatch to callbacks
    """
    
    STREAM_URL = "wss://paper-api.alpaca.markets/stream"
    STREAM_URL_V2 = "wss://stream.data.alpaca.markets/v2/trades"
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        api_secret: Optional[str] = None,
        on_trade_update: Optional[Callable[[TradeUpdate], None]] = None,
        on_connect: Optional[Callable[[], None]] = None,
        on_disconnect: Optional[Callable[[str], None]] = None,
        reconnect_delay: float = 5.0,
        max_reconnect_attempts: int = 10,
    ):
        self._api_key = api_key or os.environ.get("APCA_API_KEY_ID", "")
        self._api_secret = api_secret or os.environ.get("APCA_API_SECRET_KEY", "")
        
        # Callbacks
        self._on_trade_update = on_trade_update
        self._on_connect = on_connect
        self._on_disconnect = on_disconnect
        
        # Connection state
        self._ws = None
        self._connected = False
        self._authenticated = False
        self._running = False
        self._reconnect_delay = reconnect_delay
        self._max_reconnect_attempts = max_reconnect_attempts
        self._reconnect_count = 0
        
        # Message tracking
        self._updates: List[TradeUpdate] = []
        self._last_update: Optional[datetime] = None
    
    @property
    def is_connected(self) -> bool:
        return self._connected and self._authenticated
    
    @property
    def last_update(self) -> Optional[datetime]:
        return self._last_update
    
    async def connect(self):
        """Establish WebSocket connection."""
        if not WEBSOCKETS_AVAILABLE:
            logger.error("websockets library not available")
            return
        
        if not self._api_key or not self._api_secret:
            logger.error("Alpaca credentials not configured")
            return
        
        self._running = True
        
        while self._running and self._reconnect_count < self._max_reconnect_attempts:
            try:
                logger.info("Connecting to Alpaca trade stream...")
                
                # Use the trading stream endpoint
                url = f"wss://paper-api.alpaca.markets/stream"
                
                async with websockets.connect(url) as ws:
                    self._ws = ws
                    self._connected = True
                    self._reconnect_count = 0
                    
                    # Authenticate
                    await self._authenticate()
                    
                    if self._on_connect:
                        self._on_connect()
                    
                    # Listen for messages
                    await self._listen()
                    
            except websockets.exceptions.ConnectionClosed as e:
                logger.warning(f"WebSocket connection closed: {e}")
                self._connected = False
                self._authenticated = False
                
                if self._on_disconnect:
                    self._on_disconnect(str(e))
                
            except Exception as e:
                logger.error(f"WebSocket error: {e}")
                self._connected = False
                self._authenticated = False
            
            if self._running:
                self._reconnect_count += 1
                logger.info(
                    f"Reconnecting in {self._reconnect_delay}s "
                    f"(attempt {self._reconnect_count}/{self._max_reconnect_attempts})"
                )
                await asyncio.sleep(self._reconnect_delay)
        
        if self._reconnect_count >= self._max_reconnect_attempts:
            logger.error("Max reconnection attempts reached")
    
    async def _authenticate(self):
        """Send authentication message."""
        auth_msg = {
            "action": "auth",
            "key": self._api_key,
            "secret": self._api_secret,
        }
        
        await self._ws.send(json.dumps(auth_msg))
        
        # Wait for auth response
        response = await self._ws.recv()
        data = json.loads(response)
        
        if isinstance(data, list) and len(data) > 0:
            msg = data[0]
            if msg.get("T") == "success" and msg.get("msg") == "authenticated":
                self._authenticated = True
                logger.info("Authenticated with Alpaca")
                
                # Subscribe to trade updates
                await self._subscribe()
            else:
                logger.error(f"Authentication failed: {data}")
        elif isinstance(data, dict):
            if data.get("stream") == "authorization" and data.get("data", {}).get("status") == "authorized":
                self._authenticated = True
                logger.info("Authenticated with Alpaca (legacy format)")
                await self._subscribe()
            else:
                logger.error(f"Authentication failed: {data}")
    
    async def _subscribe(self):
        """Subscribe to trade updates channel."""
        # Subscribe to trade updates
        sub_msg = {
            "action": "listen",
            "data": {
                "streams": ["trade_updates"]
            }
        }
        
        await self._ws.send(json.dumps(sub_msg))
        logger.info("Subscribed to trade_updates stream")
    
    async def _listen(self):
        """Listen for incoming messages."""
        async for message in self._ws:
            try:
                data = json.loads(message)
                await self._handle_message(data)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse message: {e}")
            except Exception as e:
                logger.error(f"Error handling message: {e}")
    
    async def _handle_message(self, data: Any):
        """Handle incoming WebSocket message."""
        # Handle list format (newer API)
        if isinstance(data, list):
            for msg in data:
                if msg.get("T") == "trade_updates" or msg.get("stream") == "trade_updates":
                    await self._process_trade_update(msg)
        
        # Handle dict format (legacy)
        elif isinstance(data, dict):
            stream = data.get("stream")
            if stream == "trade_updates":
                await self._process_trade_update(data.get("data", {}))
            elif stream == "listening":
                logger.info(f"Now listening to: {data.get('data', {}).get('streams', [])}")
    
    async def _process_trade_update(self, data: Dict[str, Any]):
        """Process a trade update event."""
        try:
            # Parse event type
            event_str = data.get("event") or data.get("T", "unknown")
            try:
                event_type = TradeUpdateType(event_str)
            except ValueError:
                event_type = TradeUpdateType.NEW
            
            # Parse order data
            order = data.get("order", data)
            
            update = TradeUpdate(
                event_type=event_type,
                timestamp=datetime.utcnow(),
                order_id=order.get("id", ""),
                client_order_id=order.get("client_order_id"),
                symbol=order.get("symbol", ""),
                side=order.get("side", ""),
                qty=float(order.get("qty", 0)),
                filled_qty=float(order.get("filled_qty", 0)),
                avg_fill_price=float(order.get("filled_avg_price", 0)) if order.get("filled_avg_price") else None,
                order_type=order.get("type", ""),
                time_in_force=order.get("time_in_force", ""),
                status=order.get("status", ""),
                raw_data=data,
            )
            
            self._updates.append(update)
            self._last_update = update.timestamp
            
            logger.info(
                f"Trade update: {event_type.value} - {update.symbol} "
                f"({update.filled_qty}/{update.qty} @ {update.avg_fill_price})"
            )
            
            # Dispatch to callback
            if self._on_trade_update:
                self._on_trade_update(update)
                
        except Exception as e:
            logger.error(f"Error processing trade update: {e}")
    
    async def disconnect(self):
        """Disconnect from WebSocket."""
        self._running = False
        
        if self._ws:
            await self._ws.close()
            self._ws = None
        
        self._connected = False
        self._authenticated = False
        logger.info("Disconnected from Alpaca trade stream")
    
    def get_recent_updates(self, limit: int = 50) -> List[TradeUpdate]:
        """Get recent trade updates."""
        return self._updates[-limit:]
    
    def get_updates_for_order(self, order_id: str) -> List[TradeUpdate]:
        """Get all updates for a specific order."""
        return [u for u in self._updates if u.order_id == order_id]
    
    def get_updates_for_symbol(self, symbol: str) -> List[TradeUpdate]:
        """Get all updates for a specific symbol."""
        return [u for u in self._updates if u.symbol == symbol]


class TradeUpdateHandler:
    """
    Handles trade updates and triggers appropriate actions.
    
    Integrates with:
    - Position monitoring (trigger on fill/cancel)
    - Portfolio state updates
    - UI refresh events
    """
    
    def __init__(self):
        self._stream: Optional[AlpacaTradeStream] = None
        self._on_fill: Optional[Callable[[TradeUpdate], None]] = None
        self._on_cancel: Optional[Callable[[TradeUpdate], None]] = None
        self._on_reject: Optional[Callable[[TradeUpdate], None]] = None
        self._on_any: Optional[Callable[[TradeUpdate], None]] = None
        
        # Polling fallback
        self._polling_enabled = False
        self._polling_interval = 30.0
        self._polling_task: Optional[asyncio.Task] = None
    
    async def start(self):
        """Start the trade update handler."""
        # Create stream with callbacks
        self._stream = AlpacaTradeStream(
            on_trade_update=self._handle_update,
            on_connect=self._on_connected,
            on_disconnect=self._on_disconnected,
        )
        
        # Start connection in background
        asyncio.create_task(self._stream.connect())
        
        # Enable polling fallback
        self._polling_enabled = True
        self._polling_task = asyncio.create_task(self._polling_loop())
    
    async def stop(self):
        """Stop the trade update handler."""
        if self._stream:
            await self._stream.disconnect()
        
        self._polling_enabled = False
        if self._polling_task:
            self._polling_task.cancel()
    
    def _on_connected(self):
        """Called when WebSocket connects."""
        logger.info("Trade update stream connected")
        # Disable polling when websocket is connected
        # (but keep polling task running as fallback)
    
    def _on_disconnected(self, reason: str):
        """Called when WebSocket disconnects."""
        logger.warning(f"Trade update stream disconnected: {reason}")
    
    def _handle_update(self, update: TradeUpdate):
        """Handle a trade update event."""
        # Dispatch based on event type
        if update.event_type in [TradeUpdateType.FILL, TradeUpdateType.PARTIAL_FILL]:
            if self._on_fill:
                self._on_fill(update)
        
        elif update.event_type in [TradeUpdateType.CANCELED, TradeUpdateType.EXPIRED]:
            if self._on_cancel:
                self._on_cancel(update)
        
        elif update.event_type == TradeUpdateType.REJECTED:
            if self._on_reject:
                self._on_reject(update)
        
        # Always call generic handler
        if self._on_any:
            self._on_any(update)
    
    async def _polling_loop(self):
        """Fallback polling loop when websocket is disconnected."""
        while self._polling_enabled:
            try:
                # Only poll if websocket is not connected
                if not self._stream or not self._stream.is_connected:
                    logger.debug("Polling for order updates (websocket disconnected)")
                    # TODO: Implement REST API polling
                    
                await asyncio.sleep(self._polling_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Polling error: {e}")
                await asyncio.sleep(self._polling_interval)
    
    def set_callbacks(
        self,
        on_fill: Optional[Callable[[TradeUpdate], None]] = None,
        on_cancel: Optional[Callable[[TradeUpdate], None]] = None,
        on_reject: Optional[Callable[[TradeUpdate], None]] = None,
        on_any: Optional[Callable[[TradeUpdate], None]] = None,
    ):
        """Set callback functions for different update types."""
        self._on_fill = on_fill
        self._on_cancel = on_cancel
        self._on_reject = on_reject
        self._on_any = on_any
    
    @property
    def is_connected(self) -> bool:
        """Check if websocket is connected."""
        return self._stream.is_connected if self._stream else False
    
    @property
    def last_update(self) -> Optional[datetime]:
        """Get timestamp of last update."""
        return self._stream.last_update if self._stream else None


# Global instance
_trade_handler: Optional[TradeUpdateHandler] = None


def get_trade_handler() -> TradeUpdateHandler:
    """Get or create the global trade update handler."""
    global _trade_handler
    if _trade_handler is None:
        _trade_handler = TradeUpdateHandler()
    return _trade_handler
