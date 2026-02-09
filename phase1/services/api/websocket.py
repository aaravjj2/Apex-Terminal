"""
WebSocket handler for real-time bar streaming.
"""

import asyncio
import json
import time
from typing import Dict, Set, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import structlog

from ..models import Bar, BarMessage, BarState


logger = structlog.get_logger()
router = APIRouter()


class ConnectionManager:
    """
    Manages WebSocket connections and subscriptions.
    
    Handles:
    - Connection lifecycle
    - Symbol/timeframe subscriptions
    - Broadcasting bar updates
    """
    
    def __init__(self):
        # Active connections: {websocket: {(symbol, timeframe), ...}}
        self._connections: Dict[WebSocket, Set[tuple]] = {}
        
        # Subscription index: {(symbol, timeframe): {websocket, ...}}
        self._subscriptions: Dict[tuple, Set[WebSocket]] = {}

        # Heartbeat tracking
        self._last_heartbeat: Dict[WebSocket, int] = {}
        self._heartbeat_interval: float = 30.0
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._running: bool = False
        
        self._lock = asyncio.Lock()
        self.logger = logger.bind(component="ws_manager")
    
    async def connect(self, websocket: WebSocket) -> None:
        """Accept a new WebSocket connection."""
        await websocket.accept()
        async with self._lock:
            self._connections[websocket] = set()
            self._last_heartbeat[websocket] = int(time.time() * 1000)
        self.logger.info("ws_connected", client=id(websocket))

    async def start(self) -> None:
        """Start heartbeat loop for connections."""
        if self._running:
            return
        self._running = True
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        self.logger.info("ws_heartbeat_started")

    async def stop(self) -> None:
        """Stop heartbeat loop and close all connections."""
        self._running = False
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass

        # Close all active connections
        async with self._lock:
            for ws in list(self._connections.keys()):
                try:
                    await ws.close()
                except Exception:
                    pass
            self._connections.clear()
            self._subscriptions.clear()
            self._last_heartbeat.clear()

        self.logger.info("ws_heartbeat_stopped")
    
    async def disconnect(self, websocket: WebSocket) -> None:
        """Handle WebSocket disconnection."""
        async with self._lock:
            # Remove from subscriptions
            if websocket in self._connections:
                for key in self._connections[websocket]:
                    if key in self._subscriptions:
                        self._subscriptions[key].discard(websocket)
                        if not self._subscriptions[key]:
                            del self._subscriptions[key]
                del self._connections[websocket]
            # Remove heartbeat tracking
            self._last_heartbeat.pop(websocket, None)
        self.logger.info("ws_disconnected", client=id(websocket))
    
    async def subscribe(
        self,
        websocket: WebSocket,
        symbol: str,
        timeframe: str,
    ) -> None:
        """Subscribe a connection to a symbol/timeframe."""
        key = (symbol.upper(), timeframe)
        async with self._lock:
            if websocket not in self._connections:
                return
            
            self._connections[websocket].add(key)
            
            if key not in self._subscriptions:
                self._subscriptions[key] = set()
            self._subscriptions[key].add(websocket)
        
        self.logger.info("ws_subscribed", symbol=symbol, timeframe=timeframe)
    
    async def unsubscribe(
        self,
        websocket: WebSocket,
        symbol: str,
        timeframe: str,
    ) -> None:
        """Unsubscribe a connection from a symbol/timeframe."""
        key = (symbol.upper(), timeframe)
        async with self._lock:
            if websocket in self._connections:
                self._connections[websocket].discard(key)
            
            if key in self._subscriptions:
                self._subscriptions[key].discard(websocket)
                if not self._subscriptions[key]:
                    del self._subscriptions[key]
        
        self.logger.info("ws_unsubscribed", symbol=symbol, timeframe=timeframe)
    
    async def broadcast_bar(self, bar: Bar) -> None:
        """Broadcast bar update to all subscribed connections."""
        key = (bar.symbol, bar.timeframe)
        
        async with self._lock:
            subscribers = self._subscriptions.get(key, set()).copy()
        
        if not subscribers:
            return
        
        # Create message
        message = BarMessage.from_bar(bar)
        json_data = message.model_dump_json()
        
        # Send to all subscribers
        disconnected = []
        for websocket in subscribers:
            try:
                await websocket.send_text(json_data)
            except Exception as e:
                self.logger.warning("ws_send_error", error=str(e))
                disconnected.append(websocket)
        
        # Clean up disconnected
        for ws in disconnected:
            await self.disconnect(ws)
    
    async def send_personal(
        self,
        websocket: WebSocket,
        message: dict,
    ) -> None:
        """Send a message to a specific connection."""
        try:
            await websocket.send_json(message)
        except Exception as e:
            err = str(e)
            if 'Cannot call "send" once a close message has been sent' in err:
                self.logger.debug("ws_send_error_closed", error=err)
            else:
                self.logger.warning("ws_send_error", error=err)
            # Best-effort disconnect
            try:
                await self.disconnect(websocket)
            except Exception:
                pass
    
    @property
    def connection_count(self) -> int:
        """Get number of active connections."""
        return len(self._connections)

    async def _heartbeat_loop(self) -> None:
        """Periodically send heartbeats and prune stale connections."""
        while self._running:
            try:
                await asyncio.sleep(self._heartbeat_interval)
                await self._send_heartbeats()
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error("heartbeat_error", error=str(e))

    async def _send_heartbeats(self) -> None:
        """Send heartbeat to all connected clients and drop stale ones."""
        now = int(time.time() * 1000)
        timeout_ms = int(self._heartbeat_interval * 2000)  # 2x interval
        to_disconnect = []

        async with self._lock:
            clients = list(self._connections.keys())

        for websocket in clients:
            try:
                await self.send_personal(websocket, {"type": "HEARTBEAT", "timestamp": now})
                # If client hasn't updated heartbeat in a while, mark for disconnect
                last = self._last_heartbeat.get(websocket, 0)
                if last and (now - last) > timeout_ms:
                    self.logger.warning("ws_heartbeat_timeout", client=id(websocket))
                    to_disconnect.append(websocket)
            except Exception:
                to_disconnect.append(websocket)

        for ws in to_disconnect:
            await self.disconnect(ws)
    
    @property
    def subscription_count(self) -> int:
        """Get number of active subscriptions."""
        return sum(len(subs) for subs in self._subscriptions.values())


# Global connection manager
manager = ConnectionManager()


def get_manager() -> ConnectionManager:
    """Get the global connection manager."""
    return manager


@router.websocket("/bars/{symbol}/{timeframe}")
async def websocket_bars(
    websocket: WebSocket,
    symbol: str,
    timeframe: str,
):
    """
    WebSocket endpoint for bar streaming.

    Connects and automatically subscribes to the specified symbol/timeframe.
    
    Messages sent:
    - BAR_FORMING: On each tick update
    - BAR_CONFIRMED: When bar is locked

    Messages received:
    - {"action": "subscribe", "symbol": "...", "timeframe": "..."}
    - {"action": "unsubscribe", "symbol": "...", "timeframe": "..."}
    - {"action": "ping"}
    """
    try:
        await manager.connect(websocket)
    except Exception as e:
        logger.error("ws_connect_failed", error=str(e), symbol=symbol, timeframe=timeframe)
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
        return

    logger.info("ws_client_connected", symbol=symbol, timeframe=timeframe, client=id(websocket))

    try:
        # Auto-subscribe to requested symbol/timeframe
        try:
            await manager.subscribe(websocket, symbol, timeframe)
        except Exception as e:
            logger.error("ws_subscribe_failed", error=str(e), symbol=symbol, timeframe=timeframe)
            await manager.send_personal(websocket, {"type": "ERROR", "message": "subscription failed"})
            return
        
        # Send confirmation
        try:
            await manager.send_personal(websocket, {
                "type": "SUBSCRIBED",
                "symbol": symbol.upper(),
                "timeframe": timeframe,
            })
        except Exception as e:
            logger.error("ws_send_subscribed_failed", error=str(e), symbol=symbol, timeframe=timeframe)
            # If we can't send initial confirmation, disconnect
            await manager.disconnect(websocket)
            return

        # Send recent history (Backfill) - defensive and logged
        async def _send_history_task():
            logger.info("ws_history_task_start", symbol=symbol, timeframe=timeframe)
            try:
                # Get bar storage - try bar_engine.state first, then fallback
                try:
                    from ..persistence.repository import BarRepository
                    repo = BarRepository()
                    recent = await repo.get_recent_bars(symbol.upper(), timeframe, limit=100)
                except Exception as exc:
                    recent = []
                    logger.warning("ws_history_error", symbol=symbol, reason=str(exc))

                # Send history in chronological order (oldest -> newest)
                if recent:
                    for bar in recent:
                        try:
                            msg = BarMessage.from_bar(bar)
                            await manager.send_personal(websocket, msg.model_dump())
                        except Exception as e:
                            logger.warning("ws_send_history_item_failed", error=str(e))
                            # Stop sending if sends start failing
                            break

                logger.info("ws_sent_history", symbol=symbol, count=len(recent) if recent else 0)
            except Exception as e:
                logger.exception("ws_history_send_error", error=str(e))
            finally:
                logger.info("ws_history_task_end", symbol=symbol, timeframe=timeframe)

        # Send history immediately after connection (don't wait)
        asyncio.create_task(_send_history_task())

        # Listen for messages
        while True:
            try:
                data = await websocket.receive_text()
                await handle_client_message(websocket, data)
            except WebSocketDisconnect:
                logger.info("ws_client_disconnected", symbol=symbol, timeframe=timeframe, client=id(websocket))
                break
            except Exception as e:
                logger.exception("ws_receive_error", error=str(e), symbol=symbol, timeframe=timeframe)
                break
    finally:
        await manager.disconnect(websocket)
        logger.info("ws_cleanup_complete", symbol=symbol, timeframe=timeframe, client=id(websocket))


async def handle_client_message(websocket: WebSocket, data: str) -> None:
    """Handle incoming client message."""
    try:
        message = json.loads(data)
        action = message.get("action", "").lower()
        
        if action == "subscribe":
            symbol = message.get("symbol", "")
            timeframe = message.get("timeframe", "")
            if symbol and timeframe:
                await manager.subscribe(websocket, symbol, timeframe)
                await manager.send_personal(websocket, {
                    "type": "SUBSCRIBED",
                    "symbol": symbol.upper(),
                    "timeframe": timeframe,
                })
        
        elif action == "unsubscribe":
            symbol = message.get("symbol", "")
            timeframe = message.get("timeframe", "")
            if symbol and timeframe:
                await manager.unsubscribe(websocket, symbol, timeframe)
                await manager.send_personal(websocket, {
                    "type": "UNSUBSCRIBED",
                    "symbol": symbol.upper(),
                    "timeframe": timeframe,
                })
        
        elif action == "ping":
            # Update heartbeat timestamp for this connection
            try:
                manager._last_heartbeat[websocket] = int(time.time() * 1000)
            except Exception:
                pass
            await manager.send_personal(websocket, {"type": "PONG"})
        
        else:
            await manager.send_personal(websocket, {
                "type": "ERROR",
                "message": f"Unknown action: {action}",
            })
    
    except json.JSONDecodeError:
        await manager.send_personal(websocket, {
            "type": "ERROR",
            "message": "Invalid JSON",
        })


# Callback functions to integrate with bar engine
async def on_bar_update(bar: Bar) -> None:
    """Callback for bar updates (forming state)."""
    await manager.broadcast_bar(bar)


async def on_bar_confirmed(bar: Bar) -> None:
    """Callback for bar confirmations."""
    await manager.broadcast_bar(bar)
