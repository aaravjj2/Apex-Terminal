"""
┌───────────────────────────────────────────────────────────────────────┐
│  APEX TERMINAL — WebSocket Manager Service                           │
│  Real-time data streaming, connection management, pub/sub channels,  │
│  heartbeat monitoring, automatic reconnection, rate limiting         │
└───────────────────────────────────────────────────────────────────────┘
"""

import asyncio
import json
import math
import random
import time
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any, Set, Callable, Tuple
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections import defaultdict, deque

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════
# SECTION 1: TYPES & ENUMS
# ══════════════════════════════════════════════════════════════════════

class ConnectionState(str, Enum):
    CONNECTING = "connecting"
    CONNECTED = "connected"
    AUTHENTICATED = "authenticated"
    DISCONNECTING = "disconnecting"
    DISCONNECTED = "disconnected"
    RECONNECTING = "reconnecting"
    ERROR = "error"


class ChannelType(str, Enum):
    MARKET_DATA = "market_data"
    QUOTES = "quotes"
    TRADES = "trades"
    ORDER_BOOK = "order_book"
    OPTIONS_CHAIN = "options_chain"
    NEWS = "news"
    ALERTS = "alerts"
    ORDER_STATUS = "order_status"
    PORTFOLIO = "portfolio"
    SYSTEM = "system"


class MessagePriority(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"
    BACKGROUND = "background"


@dataclass
class WebSocketConfig:
    url: str = "ws://localhost:8000/ws"
    reconnect_enabled: bool = True
    reconnect_delay: float = 1.0
    reconnect_max_delay: float = 60.0
    reconnect_backoff_factor: float = 2.0
    reconnect_max_attempts: int = 50
    heartbeat_interval: float = 30.0
    heartbeat_timeout: float = 10.0
    ping_interval: float = 20.0
    max_message_rate: int = 1000  # per second
    max_message_size: int = 1_048_576  # 1 MB
    buffer_size: int = 10_000
    compression: bool = True
    auth_token: Optional[str] = None


@dataclass
class ConnectionInfo:
    connection_id: str
    state: ConnectionState
    connected_at: Optional[str] = None
    last_heartbeat: Optional[str] = None
    last_message: Optional[str] = None
    messages_sent: int = 0
    messages_received: int = 0
    bytes_sent: int = 0
    bytes_received: int = 0
    reconnect_count: int = 0
    latency_ms: float = 0.0
    subscriptions: List[str] = field(default_factory=list)
    error_count: int = 0
    last_error: Optional[str] = None


@dataclass
class Channel:
    name: str
    channel_type: ChannelType
    subscribers: Set[str] = field(default_factory=set)
    created_at: str = ""
    message_count: int = 0
    last_message_at: Optional[str] = None
    throttle_ms: int = 0  # 0 = no throttle
    last_throttle_send: float = 0


@dataclass
class QueuedMessage:
    channel: str
    data: Dict[str, Any]
    priority: MessagePriority
    timestamp: float
    ttl_seconds: float = 30.0
    retry_count: int = 0
    max_retries: int = 3


@dataclass
class RateLimitState:
    connection_id: str
    window_start: float = 0.0
    message_count: int = 0
    burst_count: int = 0
    throttled: bool = False
    throttle_until: float = 0.0


@dataclass
class SubscriptionFilter:
    symbols: List[str] = field(default_factory=list)
    fields: List[str] = field(default_factory=list)
    min_interval_ms: int = 0
    only_changes: bool = False
    aggregate_window_ms: int = 0


@dataclass
class StreamMetrics:
    channel: str
    messages_per_second: float = 0.0
    avg_latency_ms: float = 0.0
    p95_latency_ms: float = 0.0
    p99_latency_ms: float = 0.0
    avg_message_size: int = 0
    dropped_messages: int = 0
    total_messages: int = 0
    uptime_seconds: float = 0.0
    error_rate: float = 0.0


# ══════════════════════════════════════════════════════════════════════
# SECTION 2: MESSAGE SERIALIZER
# ══════════════════════════════════════════════════════════════════════

class MessageSerializer:
    """Efficient message serialization/deserialization with delta compression"""

    def __init__(self):
        self._last_values: Dict[str, Dict[str, Any]] = {}
        self._field_map: Dict[str, int] = {}
        self._reverse_map: Dict[int, str] = {}
        self._next_field_id = 1

    def register_fields(self, fields: List[str]) -> None:
        for f in fields:
            if f not in self._field_map:
                self._field_map[f] = self._next_field_id
                self._reverse_map[self._next_field_id] = f
                self._next_field_id += 1

    def serialize(self, channel: str, data: Dict[str, Any], delta: bool = False) -> bytes:
        """Serialize message with optional delta compression"""
        if delta and channel in self._last_values:
            diff = {}
            last = self._last_values[channel]
            for k, v in data.items():
                if k not in last or last[k] != v:
                    diff[k] = v
            payload = {"t": "d", "c": channel, "d": diff, "ts": time.time()}
        else:
            payload = {"t": "f", "c": channel, "d": data, "ts": time.time()}

        self._last_values[channel] = data.copy()
        return json.dumps(payload, separators=(',', ':')).encode('utf-8')

    def deserialize(self, raw: bytes) -> Tuple[str, Dict[str, Any], float]:
        """Deserialize message, applying delta if needed"""
        payload = json.loads(raw.decode('utf-8'))
        channel = payload.get("c", "")
        data = payload.get("d", {})
        ts = payload.get("ts", time.time())

        if payload.get("t") == "d" and channel in self._last_values:
            self._last_values[channel].update(data)
            data = self._last_values[channel].copy()
        else:
            self._last_values[channel] = data.copy()

        return channel, data, ts

    def compute_delta_ratio(self, channel: str) -> float:
        """How much data was saved by delta compression (0-1)"""
        if channel not in self._last_values:
            return 0.0
        return 0.0  # Would need to track actual vs delta sizes


# ══════════════════════════════════════════════════════════════════════
# SECTION 3: RATE LIMITER
# ══════════════════════════════════════════════════════════════════════

class TokenBucketRateLimiter:
    """Token bucket rate limiter for WebSocket messages"""

    def __init__(self, rate: int = 1000, burst: int = 2000):
        self.rate = rate  # tokens per second
        self.burst = burst
        self._buckets: Dict[str, Dict[str, float]] = {}

    def _get_bucket(self, key: str) -> Dict[str, float]:
        now = time.time()
        if key not in self._buckets:
            self._buckets[key] = {"tokens": float(self.burst), "last_refill": now}
        bucket = self._buckets[key]
        elapsed = now - bucket["last_refill"]
        bucket["tokens"] = min(self.burst, bucket["tokens"] + elapsed * self.rate)
        bucket["last_refill"] = now
        return bucket

    def try_acquire(self, key: str, tokens: int = 1) -> bool:
        bucket = self._get_bucket(key)
        if bucket["tokens"] >= tokens:
            bucket["tokens"] -= tokens
            return True
        return False

    def get_wait_time(self, key: str, tokens: int = 1) -> float:
        bucket = self._get_bucket(key)
        if bucket["tokens"] >= tokens:
            return 0.0
        return (tokens - bucket["tokens"]) / self.rate

    def get_state(self, key: str) -> Dict[str, Any]:
        bucket = self._get_bucket(key)
        return {
            "available_tokens": round(bucket["tokens"], 2),
            "max_tokens": self.burst,
            "refill_rate": self.rate,
            "utilization": round(1 - bucket["tokens"] / self.burst, 4),
        }


# ══════════════════════════════════════════════════════════════════════
# SECTION 4: CHANNEL MANAGER (Pub/Sub)
# ══════════════════════════════════════════════════════════════════════

class ChannelManager:
    """Manages pub/sub channels with filtering and throttling"""

    def __init__(self):
        self.channels: Dict[str, Channel] = {}
        self._filters: Dict[str, Dict[str, SubscriptionFilter]] = {}  # channel -> {conn_id -> filter}
        self._message_history: Dict[str, deque] = {}
        self._max_history = 100

    def create_channel(self, name: str, channel_type: ChannelType, throttle_ms: int = 0) -> Channel:
        if name not in self.channels:
            ch = Channel(
                name=name,
                channel_type=channel_type,
                created_at=datetime.utcnow().isoformat(),
                throttle_ms=throttle_ms,
            )
            self.channels[name] = ch
            self._message_history[name] = deque(maxlen=self._max_history)
            logger.info(f"Channel created: {name} ({channel_type.value})")
        return self.channels[name]

    def subscribe(self, channel_name: str, connection_id: str, filter_config: Optional[SubscriptionFilter] = None) -> bool:
        if channel_name not in self.channels:
            return False
        self.channels[channel_name].subscribers.add(connection_id)
        if filter_config:
            if channel_name not in self._filters:
                self._filters[channel_name] = {}
            self._filters[channel_name][connection_id] = filter_config
        logger.info(f"Connection {connection_id} subscribed to {channel_name}")
        return True

    def unsubscribe(self, channel_name: str, connection_id: str) -> bool:
        if channel_name not in self.channels:
            return False
        self.channels[channel_name].subscribers.discard(connection_id)
        if channel_name in self._filters:
            self._filters[channel_name].pop(connection_id, None)
        return True

    def unsubscribe_all(self, connection_id: str) -> int:
        count = 0
        for ch in self.channels.values():
            if connection_id in ch.subscribers:
                ch.subscribers.discard(connection_id)
                count += 1
        return count

    def publish(self, channel_name: str, data: Dict[str, Any]) -> List[str]:
        """Publish to channel. Returns list of connection_ids that should receive."""
        ch = self.channels.get(channel_name)
        if not ch:
            return []

        now = time.time()
        # Throttle check
        if ch.throttle_ms > 0:
            if (now - ch.last_throttle_send) * 1000 < ch.throttle_ms:
                return []
            ch.last_throttle_send = now

        ch.message_count += 1
        ch.last_message_at = datetime.utcnow().isoformat()
        self._message_history[channel_name].append({"data": data, "timestamp": now})

        recipients = []
        for conn_id in ch.subscribers:
            if self._passes_filter(channel_name, conn_id, data):
                recipients.append(conn_id)

        return recipients

    def _passes_filter(self, channel: str, conn_id: str, data: Dict[str, Any]) -> bool:
        filters = self._filters.get(channel, {})
        f = filters.get(conn_id)
        if not f:
            return True

        # Symbol filter
        if f.symbols and data.get("symbol") not in f.symbols:
            return False

        # Field filter (only send specified fields)
        if f.fields:
            for key in list(data.keys()):
                if key not in f.fields and key != "symbol":
                    pass  # Don't modify source data, filtering happens at serialization

        return True

    def get_history(self, channel_name: str, limit: int = 50) -> List[Dict[str, Any]]:
        history = self._message_history.get(channel_name, deque())
        return list(history)[-limit:]

    def get_stats(self) -> Dict[str, Any]:
        return {
            "total_channels": len(self.channels),
            "total_subscriptions": sum(len(ch.subscribers) for ch in self.channels.values()),
            "channels": {
                name: {
                    "type": ch.channel_type.value,
                    "subscribers": len(ch.subscribers),
                    "messages": ch.message_count,
                    "last_message": ch.last_message_at,
                }
                for name, ch in self.channels.items()
            },
        }


# ══════════════════════════════════════════════════════════════════════
# SECTION 5: CONNECTION HEALTH MONITOR
# ══════════════════════════════════════════════════════════════════════

class ConnectionHealthMonitor:
    """Monitors connection health, latency, and manages heartbeats"""

    def __init__(self, heartbeat_interval: float = 30.0, heartbeat_timeout: float = 10.0):
        self.heartbeat_interval = heartbeat_interval
        self.heartbeat_timeout = heartbeat_timeout
        self._connections: Dict[str, ConnectionInfo] = {}
        self._latency_history: Dict[str, deque] = {}
        self._heartbeat_pending: Dict[str, float] = {}
        self._max_latency_history = 100

    def register_connection(self, conn_id: str) -> ConnectionInfo:
        info = ConnectionInfo(
            connection_id=conn_id,
            state=ConnectionState.CONNECTING,
            connected_at=datetime.utcnow().isoformat(),
        )
        self._connections[conn_id] = info
        self._latency_history[conn_id] = deque(maxlen=self._max_latency_history)
        return info

    def set_state(self, conn_id: str, state: ConnectionState) -> None:
        if conn_id in self._connections:
            self._connections[conn_id].state = state

    def record_heartbeat(self, conn_id: str) -> None:
        if conn_id in self._connections:
            self._connections[conn_id].last_heartbeat = datetime.utcnow().isoformat()
            if conn_id in self._heartbeat_pending:
                latency = (time.time() - self._heartbeat_pending[conn_id]) * 1000
                self._latency_history[conn_id].append(latency)
                self._connections[conn_id].latency_ms = round(latency, 2)
                del self._heartbeat_pending[conn_id]

    def send_heartbeat(self, conn_id: str) -> bool:
        """Returns True if heartbeat should be sent"""
        if conn_id not in self._connections:
            return False
        info = self._connections[conn_id]
        if info.state != ConnectionState.AUTHENTICATED and info.state != ConnectionState.CONNECTED:
            return False
        self._heartbeat_pending[conn_id] = time.time()
        return True

    def check_timeout(self, conn_id: str) -> bool:
        """Returns True if connection has timed out"""
        if conn_id in self._heartbeat_pending:
            elapsed = time.time() - self._heartbeat_pending[conn_id]
            return elapsed > self.heartbeat_timeout
        return False

    def record_message(self, conn_id: str, direction: str, size: int) -> None:
        if conn_id not in self._connections:
            return
        info = self._connections[conn_id]
        if direction == "sent":
            info.messages_sent += 1
            info.bytes_sent += size
        else:
            info.messages_received += 1
            info.bytes_received += size
        info.last_message = datetime.utcnow().isoformat()

    def record_error(self, conn_id: str, error: str) -> None:
        if conn_id in self._connections:
            self._connections[conn_id].error_count += 1
            self._connections[conn_id].last_error = error

    def get_latency_stats(self, conn_id: str) -> Dict[str, float]:
        history = list(self._latency_history.get(conn_id, []))
        if not history:
            return {"avg": 0, "min": 0, "max": 0, "p95": 0, "p99": 0, "jitter": 0}
        avg = sum(history) / len(history)
        sorted_h = sorted(history)
        p95_idx = int(len(sorted_h) * 0.95)
        p99_idx = int(len(sorted_h) * 0.99)
        return {
            "avg": round(avg, 2),
            "min": round(sorted_h[0], 2),
            "max": round(sorted_h[-1], 2),
            "p95": round(sorted_h[min(p95_idx, len(sorted_h)-1)], 2),
            "p99": round(sorted_h[min(p99_idx, len(sorted_h)-1)], 2),
            "jitter": round(max(0, (sum((x - avg)**2 for x in history) / len(history)) ** 0.5), 2),
        }

    def get_connection_info(self, conn_id: str) -> Optional[ConnectionInfo]:
        return self._connections.get(conn_id)

    def remove_connection(self, conn_id: str) -> None:
        self._connections.pop(conn_id, None)
        self._latency_history.pop(conn_id, None)
        self._heartbeat_pending.pop(conn_id, None)

    def get_all_connections(self) -> List[ConnectionInfo]:
        return list(self._connections.values())

    def get_health_summary(self) -> Dict[str, Any]:
        conns = list(self._connections.values())
        states = defaultdict(int)
        for c in conns:
            states[c.state.value] += 1

        total_msgs = sum(c.messages_sent + c.messages_received for c in conns)
        total_bytes = sum(c.bytes_sent + c.bytes_received for c in conns)
        avg_latency = (
            sum(c.latency_ms for c in conns) / len(conns) if conns else 0.0
        )

        return {
            "total_connections": len(conns),
            "by_state": dict(states),
            "total_messages": total_msgs,
            "total_bytes": total_bytes,
            "avg_latency_ms": round(avg_latency, 2),
            "total_errors": sum(c.error_count for c in conns),
            "total_reconnects": sum(c.reconnect_count for c in conns),
        }


# ══════════════════════════════════════════════════════════════════════
# SECTION 6: RECONNECTION MANAGER
# ══════════════════════════════════════════════════════════════════════

class ReconnectionManager:
    """Handles automatic reconnection with exponential backoff"""

    def __init__(self, config: WebSocketConfig):
        self.config = config
        self._attempts: Dict[str, int] = {}
        self._next_delay: Dict[str, float] = {}
        self._reconnect_history: Dict[str, List[Dict[str, Any]]] = {}

    def should_reconnect(self, conn_id: str) -> bool:
        if not self.config.reconnect_enabled:
            return False
        attempts = self._attempts.get(conn_id, 0)
        return attempts < self.config.reconnect_max_attempts

    def get_delay(self, conn_id: str) -> float:
        attempts = self._attempts.get(conn_id, 0)
        base = self.config.reconnect_delay
        delay = min(
            base * (self.config.reconnect_backoff_factor ** attempts),
            self.config.reconnect_max_delay,
        )
        # Add jitter (±20%)
        jitter = delay * 0.2 * (random.random() * 2 - 1)
        return max(0.1, delay + jitter)

    def record_attempt(self, conn_id: str, success: bool) -> None:
        if conn_id not in self._reconnect_history:
            self._reconnect_history[conn_id] = []

        if success:
            self._attempts[conn_id] = 0
            self._reconnect_history[conn_id].append({
                "at": datetime.utcnow().isoformat(),
                "attempt": self._attempts.get(conn_id, 0),
                "success": True,
            })
        else:
            self._attempts[conn_id] = self._attempts.get(conn_id, 0) + 1
            self._reconnect_history[conn_id].append({
                "at": datetime.utcnow().isoformat(),
                "attempt": self._attempts[conn_id],
                "success": False,
            })

    def reset(self, conn_id: str) -> None:
        self._attempts.pop(conn_id, None)
        self._next_delay.pop(conn_id, None)

    def get_stats(self, conn_id: str) -> Dict[str, Any]:
        return {
            "attempts": self._attempts.get(conn_id, 0),
            "max_attempts": self.config.reconnect_max_attempts,
            "current_delay": round(self.get_delay(conn_id), 2),
            "history_count": len(self._reconnect_history.get(conn_id, [])),
        }


# ══════════════════════════════════════════════════════════════════════
# SECTION 7: MESSAGE QUEUE
# ══════════════════════════════════════════════════════════════════════

class PriorityMessageQueue:
    """Priority-based message queue with TTL and retry support"""

    PRIORITY_WEIGHTS = {
        MessagePriority.CRITICAL: 0,
        MessagePriority.HIGH: 1,
        MessagePriority.NORMAL: 2,
        MessagePriority.LOW: 3,
        MessagePriority.BACKGROUND: 4,
    }

    def __init__(self, max_size: int = 10_000):
        self.max_size = max_size
        self._queue: List[QueuedMessage] = []
        self._total_enqueued = 0
        self._total_dequeued = 0
        self._total_dropped = 0
        self._total_expired = 0

    def enqueue(self, message: QueuedMessage) -> bool:
        if len(self._queue) >= self.max_size:
            # Drop lowest priority
            if self._queue:
                lowest = max(range(len(self._queue)),
                            key=lambda i: self.PRIORITY_WEIGHTS.get(self._queue[i].priority, 99))
                if self.PRIORITY_WEIGHTS.get(message.priority, 99) < self.PRIORITY_WEIGHTS.get(self._queue[lowest].priority, 99):
                    self._queue.pop(lowest)
                    self._total_dropped += 1
                else:
                    self._total_dropped += 1
                    return False

        # Insert in priority order
        idx = 0
        msg_weight = self.PRIORITY_WEIGHTS.get(message.priority, 2)
        for i, m in enumerate(self._queue):
            if self.PRIORITY_WEIGHTS.get(m.priority, 2) > msg_weight:
                idx = i
                break
            idx = i + 1
        self._queue.insert(idx, message)
        self._total_enqueued += 1
        return True

    def dequeue(self, max_count: int = 1) -> List[QueuedMessage]:
        now = time.time()
        # Remove expired
        self._queue = [m for m in self._queue if (now - m.timestamp) < m.ttl_seconds]
        expired = self._total_enqueued - self._total_dequeued - self._total_dropped - len(self._queue)
        self._total_expired += max(0, expired)

        result = self._queue[:max_count]
        self._queue = self._queue[max_count:]
        self._total_dequeued += len(result)
        return result

    def peek(self) -> Optional[QueuedMessage]:
        return self._queue[0] if self._queue else None

    def size(self) -> int:
        return len(self._queue)

    def clear(self) -> int:
        count = len(self._queue)
        self._queue.clear()
        return count

    def get_stats(self) -> Dict[str, Any]:
        priority_counts = defaultdict(int)
        for m in self._queue:
            priority_counts[m.priority.value] += 1
        return {
            "current_size": len(self._queue),
            "max_size": self.max_size,
            "total_enqueued": self._total_enqueued,
            "total_dequeued": self._total_dequeued,
            "total_dropped": self._total_dropped,
            "total_expired": self._total_expired,
            "by_priority": dict(priority_counts),
        }


# ══════════════════════════════════════════════════════════════════════
# SECTION 8: MARKET DATA STREAM SIMULATOR
# ══════════════════════════════════════════════════════════════════════

class MarketDataStreamSimulator:
    """Generates realistic simulated market data streams for demo mode"""

    def __init__(self, symbols: Optional[List[str]] = None, seed: int = 42):
        self.symbols = symbols or [
            "AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "META", "NVDA", "JPM",
            "V", "WMT", "JNJ", "PG", "UNH", "HD", "MA", "DIS", "BAC", "XOM",
            "NFLX", "CRM", "AMD", "INTC", "PYPL", "COST", "AVGO", "PEP",
            "TMO", "ABT", "CSCO", "ADBE", "ACN", "QCOM", "TXN", "LLY",
        ]
        self.rng = random.Random(seed)
        self._prices: Dict[str, float] = {}
        self._volumes: Dict[str, int] = {}
        self._bids: Dict[str, float] = {}
        self._asks: Dict[str, float] = {}
        self._init_prices()

    def _init_prices(self) -> None:
        base_prices = {
            "AAPL": 178.50, "GOOGL": 141.80, "MSFT": 378.90, "AMZN": 178.25,
            "TSLA": 248.50, "META": 505.75, "NVDA": 878.35, "JPM": 196.40,
            "V": 280.60, "WMT": 165.30, "JNJ": 156.20, "PG": 164.80,
            "UNH": 527.40, "HD": 365.90, "MA": 458.70, "DIS": 111.35,
            "BAC": 34.80, "XOM": 104.25, "NFLX": 628.40, "CRM": 298.50,
            "AMD": 175.80, "INTC": 43.20, "PYPL": 63.40, "COST": 732.50,
            "AVGO": 1325.00, "PEP": 171.80, "TMO": 575.60, "ABT": 113.40,
            "CSCO": 50.80, "ADBE": 578.90, "ACN": 375.40, "QCOM": 168.70,
            "TXN": 170.30, "LLY": 780.50,
        }
        for sym in self.symbols:
            self._prices[sym] = base_prices.get(sym, 100 + self.rng.random() * 400)
            self._volumes[sym] = int(1e6 + self.rng.random() * 5e6)
            spread = self._prices[sym] * 0.001
            self._bids[sym] = round(self._prices[sym] - spread / 2, 2)
            self._asks[sym] = round(self._prices[sym] + spread / 2, 2)

    def next_tick(self, symbol: Optional[str] = None) -> Dict[str, Any]:
        """Generate next market data tick"""
        sym = symbol or self.rng.choice(self.symbols)
        price = self._prices[sym]

        # Random walk
        change = self.rng.gauss(0, 0.0005) * price
        new_price = max(0.01, price + change)
        self._prices[sym] = new_price

        # Update bid/ask
        spread = new_price * (0.0005 + self.rng.random() * 0.001)
        self._bids[sym] = round(new_price - spread / 2, 2)
        self._asks[sym] = round(new_price + spread / 2, 2)

        # Volume
        tick_vol = int(100 + self.rng.random() * 5000)
        self._volumes[sym] += tick_vol

        return {
            "symbol": sym,
            "price": round(new_price, 2),
            "change": round(change, 4),
            "change_pct": round(change / price * 100, 4),
            "bid": self._bids[sym],
            "ask": self._asks[sym],
            "bid_size": int(100 + self.rng.random() * 5000),
            "ask_size": int(100 + self.rng.random() * 5000),
            "volume": tick_vol,
            "cumulative_volume": self._volumes[sym],
            "last_trade_time": datetime.utcnow().isoformat(),
            "vwap": round(new_price * (1 + self.rng.gauss(0, 0.001)), 2),
        }

    def next_quote(self, symbol: Optional[str] = None) -> Dict[str, Any]:
        """Generate a full quote update"""
        sym = symbol or self.rng.choice(self.symbols)
        tick = self.next_tick(sym)

        return {
            **tick,
            "open": round(self._prices[sym] * (1 - self.rng.gauss(0, 0.01)), 2),
            "high": round(max(self._prices[sym] * 1.01, self._prices[sym] + abs(self.rng.gauss(0, 2))), 2),
            "low": round(min(self._prices[sym] * 0.99, self._prices[sym] - abs(self.rng.gauss(0, 2))), 2),
            "prev_close": round(self._prices[sym] * (1 - self.rng.gauss(0, 0.005)), 2),
            "market_cap": int(self._prices[sym] * 1e9 * (5 + self.rng.random() * 15)),
            "pe_ratio": round(15 + self.rng.random() * 35, 2),
            "dividend_yield": round(self.rng.random() * 4, 2),
            "fifty_two_week_high": round(self._prices[sym] * (1.1 + self.rng.random() * 0.3), 2),
            "fifty_two_week_low": round(self._prices[sym] * (0.5 + self.rng.random() * 0.3), 2),
        }

    def next_order_book(self, symbol: Optional[str] = None, depth: int = 10) -> Dict[str, Any]:
        """Generate order book snapshot"""
        sym = symbol or self.rng.choice(self.symbols)
        price = self._prices[sym]
        tick_size = 0.01

        bids = []
        asks = []
        for level in range(depth):
            bid_price = round(price - (level + 1) * tick_size * (1 + self.rng.random()), 2)
            ask_price = round(price + (level + 1) * tick_size * (1 + self.rng.random()), 2)
            bid_size = int(100 + self.rng.random() * 10000 / (level + 1))
            ask_size = int(100 + self.rng.random() * 10000 / (level + 1))
            bids.append({"price": bid_price, "size": bid_size, "orders": int(1 + self.rng.random() * 5)})
            asks.append({"price": ask_price, "size": ask_size, "orders": int(1 + self.rng.random() * 5)})

        return {
            "symbol": sym,
            "timestamp": datetime.utcnow().isoformat(),
            "bids": bids,
            "asks": asks,
            "spread": round(asks[0]["price"] - bids[0]["price"], 4),
            "mid_price": round((bids[0]["price"] + asks[0]["price"]) / 2, 4),
            "imbalance": round((bids[0]["size"] - asks[0]["size"]) / (bids[0]["size"] + asks[0]["size"]), 4),
        }

    def next_trade(self, symbol: Optional[str] = None) -> Dict[str, Any]:
        """Generate a trade event"""
        sym = symbol or self.rng.choice(self.symbols)
        price = self._prices[sym]
        side = "buy" if self.rng.random() > 0.5 else "sell"
        size = int(10 + self.rng.expovariate(0.01))

        return {
            "symbol": sym,
            "price": round(price + self.rng.gauss(0, price * 0.0002), 2),
            "size": size,
            "side": side,
            "timestamp": datetime.utcnow().isoformat(),
            "trade_id": f"T{int(time.time() * 1e6)}{self.rng.randint(0, 999):03d}",
            "exchange": self.rng.choice(["NYSE", "NASDAQ", "ARCA", "BATS", "IEX", "EDGX"]),
            "conditions": [],
        }


# ══════════════════════════════════════════════════════════════════════
# SECTION 9: WEBSOCKET MANAGER SERVICE
# ══════════════════════════════════════════════════════════════════════

class WebSocketManager:
    """
    Central WebSocket management service for Apex Terminal.
    Handles connections, channels, rate limiting, message routing,
    and health monitoring.
    """

    def __init__(self, config: Optional[WebSocketConfig] = None):
        self.config = config or WebSocketConfig()
        self.channel_manager = ChannelManager()
        self.health_monitor = ConnectionHealthMonitor(
            heartbeat_interval=self.config.heartbeat_interval,
            heartbeat_timeout=self.config.heartbeat_timeout,
        )
        self.rate_limiter = TokenBucketRateLimiter(
            rate=self.config.max_message_rate,
        )
        self.reconnection_manager = ReconnectionManager(self.config)
        self.message_queue = PriorityMessageQueue(max_size=self.config.buffer_size)
        self.serializer = MessageSerializer()
        self.market_sim = MarketDataStreamSimulator()

        self._connection_counter = 0
        self._started_at = time.time()

        # Create default channels
        self._setup_default_channels()
        logger.info("WebSocketManager initialized")

    def _setup_default_channels(self) -> None:
        """Create standard market data channels"""
        self.channel_manager.create_channel("market:quotes", ChannelType.QUOTES, throttle_ms=100)
        self.channel_manager.create_channel("market:trades", ChannelType.TRADES, throttle_ms=0)
        self.channel_manager.create_channel("market:orderbook", ChannelType.ORDER_BOOK, throttle_ms=250)
        self.channel_manager.create_channel("market:options", ChannelType.OPTIONS_CHAIN, throttle_ms=500)
        self.channel_manager.create_channel("alerts", ChannelType.ALERTS, throttle_ms=0)
        self.channel_manager.create_channel("orders", ChannelType.ORDER_STATUS, throttle_ms=0)
        self.channel_manager.create_channel("portfolio", ChannelType.PORTFOLIO, throttle_ms=1000)
        self.channel_manager.create_channel("news", ChannelType.NEWS, throttle_ms=0)
        self.channel_manager.create_channel("system", ChannelType.SYSTEM, throttle_ms=0)

    def connect(self, client_info: Optional[Dict[str, Any]] = None) -> str:
        """Register a new connection"""
        self._connection_counter += 1
        conn_id = f"conn_{self._connection_counter}_{int(time.time() * 1000)}"
        info = self.health_monitor.register_connection(conn_id)
        info.state = ConnectionState.CONNECTED
        logger.info(f"New connection: {conn_id}")

        # Auto-subscribe to system channel
        self.channel_manager.subscribe("system", conn_id)

        # Publish join event
        self.channel_manager.publish("system", {
            "event": "client_connected",
            "connection_id": conn_id,
            "timestamp": datetime.utcnow().isoformat(),
        })

        return conn_id

    def disconnect(self, conn_id: str) -> None:
        """Clean up a disconnected connection"""
        unsub_count = self.channel_manager.unsubscribe_all(conn_id)
        self.health_monitor.remove_connection(conn_id)
        self.reconnection_manager.reset(conn_id)
        logger.info(f"Connection disconnected: {conn_id} (unsubscribed from {unsub_count} channels)")

    def subscribe(self, conn_id: str, channels: List[str],
                 symbols: Optional[List[str]] = None) -> Dict[str, bool]:
        """Subscribe to channels with optional symbol filters"""
        results = {}
        filter_config = SubscriptionFilter(symbols=symbols or []) if symbols else None

        for channel in channels:
            success = self.channel_manager.subscribe(channel, conn_id, filter_config)
            results[channel] = success

        # Update connection info
        info = self.health_monitor.get_connection_info(conn_id)
        if info:
            info.subscriptions = [ch for ch, ok in results.items() if ok]

        return results

    def unsubscribe(self, conn_id: str, channels: List[str]) -> Dict[str, bool]:
        return {ch: self.channel_manager.unsubscribe(ch, conn_id) for ch in channels}

    def broadcast(self, channel: str, data: Dict[str, Any],
                 priority: MessagePriority = MessagePriority.NORMAL) -> int:
        """Broadcast message to channel subscribers"""
        recipients = self.channel_manager.publish(channel, data)

        for conn_id in recipients:
            if not self.rate_limiter.try_acquire(conn_id):
                # Queue for later
                self.message_queue.enqueue(QueuedMessage(
                    channel=channel,
                    data=data,
                    priority=priority,
                    timestamp=time.time(),
                ))
                continue

            msg_bytes = self.serializer.serialize(channel, data, delta=True)
            self.health_monitor.record_message(conn_id, "sent", len(msg_bytes))

        return len(recipients)

    def send_to(self, conn_id: str, channel: str, data: Dict[str, Any]) -> bool:
        """Send message to specific connection"""
        if not self.rate_limiter.try_acquire(conn_id):
            return False
        msg_bytes = self.serializer.serialize(channel, data)
        self.health_monitor.record_message(conn_id, "sent", len(msg_bytes))
        return True

    def process_incoming(self, conn_id: str, raw_message: bytes) -> Optional[Dict[str, Any]]:
        """Process an incoming message from a client"""
        self.health_monitor.record_message(conn_id, "received", len(raw_message))

        try:
            channel, data, ts = self.serializer.deserialize(raw_message)
        except Exception as e:
            self.health_monitor.record_error(conn_id, str(e))
            return {"error": str(e)}

        # Handle heartbeat
        if channel == "heartbeat":
            self.health_monitor.record_heartbeat(conn_id)
            return {"type": "heartbeat_ack", "timestamp": time.time()}

        # Handle subscription requests
        if channel == "subscribe":
            channels = data.get("channels", [])
            symbols = data.get("symbols")
            results = self.subscribe(conn_id, channels, symbols)
            return {"type": "subscribe_ack", "results": results}

        if channel == "unsubscribe":
            channels = data.get("channels", [])
            results = self.unsubscribe(conn_id, channels)
            return {"type": "unsubscribe_ack", "results": results}

        return {"type": "message", "channel": channel, "data": data}

    def generate_demo_tick(self) -> Dict[str, Any]:
        """Generate a demo market data tick and broadcast it"""
        tick = self.market_sim.next_tick()
        self.broadcast("market:quotes", tick, MessagePriority.HIGH)
        return tick

    def generate_demo_trade(self) -> Dict[str, Any]:
        """Generate a demo trade event"""
        trade = self.market_sim.next_trade()
        self.broadcast("market:trades", trade, MessagePriority.HIGH)
        return trade

    def generate_demo_orderbook(self, symbol: Optional[str] = None) -> Dict[str, Any]:
        """Generate a demo order book"""
        book = self.market_sim.next_order_book(symbol)
        self.broadcast("market:orderbook", book, MessagePriority.NORMAL)
        return book

    def get_dashboard(self) -> Dict[str, Any]:
        """Get full system dashboard"""
        health = self.health_monitor.get_health_summary()
        channels = self.channel_manager.get_stats()
        queue = self.message_queue.get_stats()

        return {
            "uptime_seconds": round(time.time() - self._started_at, 2),
            "connections": health,
            "channels": channels,
            "message_queue": queue,
            "rate_limiter": {
                "max_rate": self.config.max_message_rate,
            },
            "config": {
                "heartbeat_interval": self.config.heartbeat_interval,
                "reconnect_enabled": self.config.reconnect_enabled,
                "compression": self.config.compression,
                "max_message_size": self.config.max_message_size,
            },
        }

    def run_demo_simulation(self, n_ticks: int = 100) -> Dict[str, Any]:
        """Run a demo simulation generating market data"""
        conn_id = self.connect({"type": "demo"})
        self.subscribe(conn_id, ["market:quotes", "market:trades", "market:orderbook"])

        ticks = []
        trades = []
        for i in range(n_ticks):
            tick = self.generate_demo_tick()
            ticks.append(tick)
            if i % 3 == 0:
                trade = self.generate_demo_trade()
                trades.append(trade)
            if i % 10 == 0:
                self.generate_demo_orderbook()

        dashboard = self.get_dashboard()
        self.disconnect(conn_id)

        return {
            "ticks_generated": len(ticks),
            "trades_generated": len(trades),
            "sample_ticks": ticks[:5],
            "sample_trades": trades[:3],
            "dashboard": dashboard,
        }
