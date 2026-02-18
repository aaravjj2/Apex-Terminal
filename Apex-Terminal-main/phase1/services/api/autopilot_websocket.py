"""
WebSocket handler for Autopilot real-time events.
"""

import asyncio
import json
import time
from typing import Dict, Set, Optional, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import structlog
from datetime import datetime

logger = structlog.get_logger()
router = APIRouter()


class AutopilotConnectionManager:
    """
    Manages WebSocket connections for Autopilot updates.
    
    Broadcasts:
    - THINK_LOG: Real-time decision trace
    - STATUS_UPDATE: Phase/State changes
    - CYCLE_COMPLETE: Run result summary
    - POSITIONS_UPDATE: Position changes
    """
    
    def __init__(self):
        # Active connections with metadata
        self._connections: Set[WebSocket] = set()
        self._connection_times: Dict[int, float] = {}  # Track when each connected
        self._lock = asyncio.Lock()
        self.logger = logger.bind(component="autopilot_ws_manager")
        self._running = False
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._stale_check_task: Optional[asyncio.Task] = None
        self._max_connection_age = 3600  # Refresh connections after 1 hour
    
    async def connect(self, websocket: WebSocket) -> None:
        """Accept a new WebSocket connection."""
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)
            self._connection_times[id(websocket)] = time.time()
        self.logger.info("autopilot_ws_connected", client=id(websocket), total=len(self._connections))

    async def disconnect(self, websocket: WebSocket) -> None:
        """Handle WebSocket disconnection."""
        async with self._lock:
            self._connections.discard(websocket)
            self._connection_times.pop(id(websocket), None)
        self.logger.info("autopilot_ws_disconnected", client=id(websocket))

    async def broadcast(self, message_type: str, data: Dict[str, Any]) -> None:
        """Broadcast a message to all connected clients."""
        if not self._connections:
            return

        payload = {
            "type": message_type,
            "timestamp": datetime.utcnow().isoformat(),
            "data": data
        }
        json_data = json.dumps(payload)

        to_remove = []
        
        # Snapshot connections to avoid modification during iteration
        # (Though we iterate a copy or locked set usually)
        async with self._lock:
            connections = list(self._connections)

        for websocket in connections:
            try:
                await websocket.send_text(json_data)
            except Exception as e:
                self.logger.warning("autopilot_ws_send_failed", error=str(e), client=id(websocket))
                to_remove.append(websocket)

        for ws in to_remove:
            await self.disconnect(ws)

    async def start(self) -> None:
        """Start heartbeat and stale connection check loops."""
        if self._running:
            return
        self._running = True
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        self._stale_check_task = asyncio.create_task(self._stale_connection_check())
        self.logger.info("autopilot_ws_manager_started")

    async def stop(self) -> None:
        """Stop heartbeat loop and close connections."""
        self._running = False
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
        if self._stale_check_task:
            self._stale_check_task.cancel()
        
        async with self._lock:
            for ws in list(self._connections):
                try:
                    await ws.close()
                except:
                    pass
            self._connections.clear()
            self._connection_times.clear()
        self.logger.info("autopilot_ws_manager_stopped")

    async def _heartbeat_loop(self) -> None:
        """Send periodic heartbeats every 15s for more reliable connection."""
        while self._running:
            try:
                await asyncio.sleep(15)  # More frequent heartbeat
                await self.broadcast("HEARTBEAT", {
                    "time": time.time(),
                    "connections": len(self._connections)
                })
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error("autopilot_ws_heartbeat_error", error=str(e))

    async def _stale_connection_check(self) -> None:
        """Check for stale connections and clean them up."""
        while self._running:
            try:
                await asyncio.sleep(300)  # Every 5 minutes
                now = time.time()
                stale = []
                
                async with self._lock:
                    for ws in self._connections:
                        conn_time = self._connection_times.get(id(ws), now)
                        if now - conn_time > self._max_connection_age:
                            stale.append(ws)
                
                for ws in stale:
                    try:
                        # Send refresh hint before closing
                        await ws.send_json({
                            "type": "REFRESH_REQUIRED",
                            "reason": "connection_age",
                            "timestamp": datetime.utcnow().isoformat()
                        })
                        await asyncio.sleep(0.5)
                        await ws.close()
                    except:
                        pass
                    await self.disconnect(ws)
                    
                if stale:
                    self.logger.info("autopilot_ws_stale_cleanup", count=len(stale))
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error("autopilot_ws_stale_check_error", error=str(e))

# Global manager instance
manager = AutopilotConnectionManager()

def get_autopilot_ws_manager() -> AutopilotConnectionManager:
    return manager


@router.websocket("/autopilot")
async def websocket_autopilot(websocket: WebSocket):
    """
    WebSocket endpoint for Autopilot events.
    """
    await manager.connect(websocket)
    try:
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "CONNECTED",
            "timestamp": datetime.utcnow().isoformat(),
            "message": "Connected to Autopilot Stream"
        })
        
        # Listen for client messages (e.g. ping)
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                if message.get("action") == "ping":
                    await websocket.send_json({"type": "PONG", "timestamp": time.time()})
            except:
                pass
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception as e:
        logger.error("autopilot_ws_error", error=str(e))
        await manager.disconnect(websocket)
