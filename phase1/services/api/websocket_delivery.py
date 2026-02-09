"""
Enhanced WebSocket Delivery - Reliable bar delivery with sequencing.

Provides:
- Sequence numbers for gap detection
- Message buffering for late joiners
- Heartbeat for connection health
- Replay support integration
"""

import asyncio
import json
import time
from typing import Dict, Set, Optional, List, Deque
from collections import deque
from dataclasses import dataclass, field
from enum import Enum
import structlog

from fastapi import WebSocket
from ..models import Bar, BarMessage, BarState


logger = structlog.get_logger()


class DeliveryMode(str, Enum):
    """WebSocket delivery modes."""
    LIVE = "live"         # Real-time streaming
    REPLAY = "replay"     # Historical replay
    BACKFILL = "backfill" # Gap filling


@dataclass
class SequencedMessage:
    """Message with sequence number for ordering."""
    sequence: int
    timestamp_ms: int
    message: BarMessage
    delivery_mode: DeliveryMode = DeliveryMode.LIVE


@dataclass
class ClientState:
    """State tracking for a WebSocket client."""
    websocket: WebSocket
    subscriptions: Set[tuple] = field(default_factory=set)
    last_sequence: Dict[tuple, int] = field(default_factory=dict)  # per subscription
    last_heartbeat: int = 0
    connected_at: int = 0
    delivery_mode: DeliveryMode = DeliveryMode.LIVE
    replay_position: Optional[int] = None  # Current replay timestamp


class MessageBuffer:
    """
    Circular buffer for recent messages.
    Allows late joiners to catch up.
    """
    
    def __init__(self, max_size: int = 1000):
        self._buffer: Dict[tuple, Deque[SequencedMessage]] = {}
        self._max_size = max_size
        self._sequence_counters: Dict[tuple, int] = {}
    
    def add(self, key: tuple, message: BarMessage, mode: DeliveryMode = DeliveryMode.LIVE) -> SequencedMessage:
        """Add message to buffer with sequence number."""
        if key not in self._buffer:
            self._buffer[key] = deque(maxlen=self._max_size)
            self._sequence_counters[key] = 0
        
        self._sequence_counters[key] += 1
        
        seq_msg = SequencedMessage(
            sequence=self._sequence_counters[key],
            timestamp_ms=int(time.time() * 1000),
            message=message,
            delivery_mode=mode,
        )
        
        self._buffer[key].append(seq_msg)
        return seq_msg
    
    def get_since(self, key: tuple, since_sequence: int) -> List[SequencedMessage]:
        """Get all messages since a sequence number."""
        if key not in self._buffer:
            return []
        
        return [
            msg for msg in self._buffer[key]
            if msg.sequence > since_sequence
        ]
    
    def get_latest(self, key: tuple, count: int = 10) -> List[SequencedMessage]:
        """Get latest N messages for a key."""
        if key not in self._buffer:
            return []
        
        return list(self._buffer[key])[-count:]
    
    def get_current_sequence(self, key: tuple) -> int:
        """Get current sequence number for a key."""
        return self._sequence_counters.get(key, 0)
    
    def clear(self, key: Optional[tuple] = None) -> None:
        """Clear buffer for key or all."""
        if key:
            self._buffer.pop(key, None)
            self._sequence_counters.pop(key, None)
        else:
            self._buffer.clear()
            self._sequence_counters.clear()


class EnhancedConnectionManager:
    """
    Enhanced WebSocket connection manager with delivery guarantees.
    
    Features:
    - Sequence numbers for gap detection
    - Message buffering for catchup
    - Heartbeat monitoring
    - Replay mode support
    """
    
    def __init__(
        self,
        buffer_size: int = 1000,
        heartbeat_interval_sec: float = 30.0,
    ):
        # Client state
        self._clients: Dict[WebSocket, ClientState] = {}
        
        # Subscription index: {(symbol, timeframe): {websocket, ...}}
        self._subscriptions: Dict[tuple, Set[WebSocket]] = {}
        
        # Message buffer
        self._buffer = MessageBuffer(max_size=buffer_size)
        
        # Heartbeat
        self._heartbeat_interval = heartbeat_interval_sec
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._running = False
        
        # Lock
        self._lock = asyncio.Lock()
        
        self.logger = logger.bind(component="enhanced_ws_manager")
    
    async def start(self) -> None:
        """Start the connection manager (heartbeat loop)."""
        if self._running:
            return
        
        self._running = True
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        self.logger.info("ws_manager_started")
    
    async def stop(self) -> None:
        """Stop the connection manager."""
        self._running = False
        
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass
        
        # Close all connections
        async with self._lock:
            for ws in list(self._clients.keys()):
                try:
                    await ws.close()
                except Exception:
                    pass
            self._clients.clear()
            self._subscriptions.clear()
        
        self.logger.info("ws_manager_stopped")
    
    async def connect(self, websocket: WebSocket) -> None:
        """Accept a new WebSocket connection."""
        await websocket.accept()
        
        async with self._lock:
            self._clients[websocket] = ClientState(
                websocket=websocket,
                connected_at=int(time.time() * 1000),
                last_heartbeat=int(time.time() * 1000),
            )
        
        self.logger.info("ws_connected", client=id(websocket))
    
    async def disconnect(self, websocket: WebSocket) -> None:
        """Handle WebSocket disconnection."""
        async with self._lock:
            if websocket in self._clients:
                state = self._clients[websocket]
                
                # Remove from subscriptions
                for key in state.subscriptions:
                    if key in self._subscriptions:
                        self._subscriptions[key].discard(websocket)
                        if not self._subscriptions[key]:
                            del self._subscriptions[key]
                
                del self._clients[websocket]
        
        self.logger.info("ws_disconnected", client=id(websocket))
    
    async def subscribe(
        self,
        websocket: WebSocket,
        symbol: str,
        timeframe: str,
        catchup: bool = True,
    ) -> int:
        """
        Subscribe a connection to a symbol/timeframe.
        
        Args:
            websocket: Client connection
            symbol: Symbol to subscribe
            timeframe: Timeframe to subscribe
            catchup: Whether to send buffered messages
            
        Returns:
            Current sequence number for this subscription
        """
        key = (symbol.upper(), timeframe)
        
        async with self._lock:
            if websocket not in self._clients:
                return 0
            
            state = self._clients[websocket]
            state.subscriptions.add(key)
            
            if key not in self._subscriptions:
                self._subscriptions[key] = set()
            self._subscriptions[key].add(websocket)
            
            current_seq = self._buffer.get_current_sequence(key)
            state.last_sequence[key] = current_seq
        
        self.logger.info(
            "ws_subscribed",
            symbol=symbol,
            timeframe=timeframe,
            sequence=current_seq,
        )
        
        # Send catchup messages if requested
        if catchup:
            await self._send_catchup(websocket, key, 0)
        
        return current_seq
    
    async def unsubscribe(
        self,
        websocket: WebSocket,
        symbol: str,
        timeframe: str,
    ) -> None:
        """Unsubscribe a connection from a symbol/timeframe."""
        key = (symbol.upper(), timeframe)
        
        async with self._lock:
            if websocket in self._clients:
                self._clients[websocket].subscriptions.discard(key)
                self._clients[websocket].last_sequence.pop(key, None)
            
            if key in self._subscriptions:
                self._subscriptions[key].discard(websocket)
                if not self._subscriptions[key]:
                    del self._subscriptions[key]
        
        self.logger.info("ws_unsubscribed", symbol=symbol, timeframe=timeframe)
    
    async def broadcast_bar(
        self,
        bar: Bar,
        mode: DeliveryMode = DeliveryMode.LIVE,
    ) -> int:
        """
        Broadcast bar update to all subscribed connections.
        
        Args:
            bar: Bar to broadcast
            mode: Delivery mode
            
        Returns:
            Number of clients message was sent to
        """
        key = (bar.symbol, bar.timeframe)
        
        # Create sequenced message
        message = BarMessage.from_bar(bar)
        
        async with self._lock:
            seq_msg = self._buffer.add(key, message, mode)
            subscribers = self._subscriptions.get(key, set()).copy()
        
        if not subscribers:
            return 0
        
        # Build wire format
        wire_message = {
            "type": message.type,
            "sequence": seq_msg.sequence,
            "timestamp": seq_msg.timestamp_ms,
            "mode": mode.value,
            "data": message.model_dump(),
        }
        json_data = json.dumps(wire_message)
        
        # Send to all subscribers
        sent_count = 0
        disconnected = []
        
        for websocket in subscribers:
            try:
                await websocket.send_text(json_data)
                
                # Update client's last sequence
                async with self._lock:
                    if websocket in self._clients:
                        self._clients[websocket].last_sequence[key] = seq_msg.sequence
                
                sent_count += 1
            except Exception as e:
                self.logger.warning("ws_send_error", error=str(e))
                disconnected.append(websocket)
        
        # Clean up disconnected
        for ws in disconnected:
            await self.disconnect(ws)
        
        return sent_count
    
    async def _send_catchup(
        self,
        websocket: WebSocket,
        key: tuple,
        since_sequence: int,
    ) -> None:
        """Send buffered messages to a client."""
        messages = self._buffer.get_since(key, since_sequence)
        
        if not messages:
            return
        
        for seq_msg in messages:
            try:
                wire_message = {
                    "type": "CATCHUP",
                    "sequence": seq_msg.sequence,
                    "timestamp": seq_msg.timestamp_ms,
                    "data": seq_msg.message.model_dump(),
                }
                await websocket.send_json(wire_message)
            except Exception as e:
                self.logger.warning("catchup_send_error", error=str(e))
                break
        
        self.logger.info(
            "catchup_sent",
            symbol=key[0],
            timeframe=key[1],
            count=len(messages),
        )
    
    async def request_catchup(
        self,
        websocket: WebSocket,
        symbol: str,
        timeframe: str,
        since_sequence: int,
    ) -> None:
        """Client requests catchup from a sequence number."""
        key = (symbol.upper(), timeframe)
        
        async with self._lock:
            if websocket not in self._clients:
                return
            if key not in self._clients[websocket].subscriptions:
                return
        
        await self._send_catchup(websocket, key, since_sequence)
    
    async def send_personal(
        self,
        websocket: WebSocket,
        message: dict,
    ) -> None:
        """Send a message to a specific connection."""
        try:
            await websocket.send_json(message)
        except Exception as e:
            self.logger.warning("ws_send_error", error=str(e))
    
    async def _heartbeat_loop(self) -> None:
        """Send periodic heartbeats to all clients."""
        while self._running:
            try:
                await asyncio.sleep(self._heartbeat_interval)
                await self._send_heartbeats()
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error("heartbeat_error", error=str(e))
    
    async def _send_heartbeats(self) -> None:
        """Send heartbeat to all connected clients."""
        async with self._lock:
            clients = list(self._clients.keys())
        
        now = int(time.time() * 1000)
        heartbeat_msg = {
            "type": "HEARTBEAT",
            "timestamp": now,
        }
        
        disconnected = []
        for websocket in clients:
            try:
                await websocket.send_json(heartbeat_msg)
                async with self._lock:
                    if websocket in self._clients:
                        self._clients[websocket].last_heartbeat = now
            except Exception:
                disconnected.append(websocket)
        
        for ws in disconnected:
            await self.disconnect(ws)
    
    async def set_delivery_mode(
        self,
        websocket: WebSocket,
        mode: DeliveryMode,
        replay_position: Optional[int] = None,
    ) -> None:
        """Set delivery mode for a client."""
        async with self._lock:
            if websocket in self._clients:
                self._clients[websocket].delivery_mode = mode
                self._clients[websocket].replay_position = replay_position
        
        await self.send_personal(websocket, {
            "type": "MODE_CHANGED",
            "mode": mode.value,
            "replay_position": replay_position,
        })
    
    def get_client_state(self, websocket: WebSocket) -> Optional[ClientState]:
        """Get state for a specific client."""
        return self._clients.get(websocket)
    
    @property
    def connection_count(self) -> int:
        """Get number of active connections."""
        return len(self._clients)
    
    @property
    def subscription_count(self) -> int:
        """Get total number of subscriptions."""
        return sum(len(state.subscriptions) for state in self._clients.values())
    
    def get_stats(self) -> dict:
        """Get manager statistics."""
        return {
            "connections": self.connection_count,
            "subscriptions": self.subscription_count,
            "running": self._running,
        }


# Global enhanced manager
_enhanced_manager: Optional[EnhancedConnectionManager] = None


def get_enhanced_manager() -> EnhancedConnectionManager:
    """Get the global enhanced connection manager."""
    global _enhanced_manager
    if _enhanced_manager is None:
        _enhanced_manager = EnhancedConnectionManager()
    return _enhanced_manager


def set_enhanced_manager(manager: EnhancedConnectionManager) -> None:
    """Set the global enhanced connection manager (for testing)."""
    global _enhanced_manager
    _enhanced_manager = manager


# Callback functions to integrate with bar lifecycle manager
async def on_bar_update_enhanced(bar: Bar) -> None:
    """Callback for bar updates (forming state)."""
    manager = get_enhanced_manager()
    await manager.broadcast_bar(bar, DeliveryMode.LIVE)


async def on_bar_confirmed_enhanced(bar: Bar) -> None:
    """Callback for bar confirmations."""
    manager = get_enhanced_manager()
    await manager.broadcast_bar(bar, DeliveryMode.LIVE)
