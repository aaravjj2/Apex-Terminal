"""
Ordering & Batching - Message ordering, batching, and latency measurement.

Provides:
- Message ordering guarantees
- Batching for efficiency
- Latency tracking
- Delivery guarantees
"""

import asyncio
import time
from typing import List, Dict, Optional, Callable, Awaitable, TypeVar, Generic
from dataclasses import dataclass, field
from collections import deque
from heapq import heappush, heappop
import structlog


logger = structlog.get_logger()


T = TypeVar('T')


@dataclass
class OrderedMessage(Generic[T]):
    """A message with ordering information."""
    sequence: int
    timestamp_ms: int
    data: T
    priority: int = 0  # Higher = more important
    
    def __lt__(self, other: "OrderedMessage") -> bool:
        # Higher priority first, then lower sequence
        if self.priority != other.priority:
            return self.priority > other.priority
        return self.sequence < other.sequence


@dataclass
class LatencyStats:
    """Statistics for latency tracking."""
    count: int = 0
    total_ms: float = 0.0
    min_ms: float = float('inf')
    max_ms: float = 0.0
    
    @property
    def avg_ms(self) -> float:
        return self.total_ms / self.count if self.count > 0 else 0.0
    
    def record(self, latency_ms: float) -> None:
        """Record a latency measurement."""
        self.count += 1
        self.total_ms += latency_ms
        self.min_ms = min(self.min_ms, latency_ms)
        self.max_ms = max(self.max_ms, latency_ms)
    
    def to_dict(self) -> dict:
        return {
            "count": self.count,
            "avg_ms": round(self.avg_ms, 2),
            "min_ms": round(self.min_ms, 2) if self.min_ms != float('inf') else 0.0,
            "max_ms": round(self.max_ms, 2),
        }


class LatencyTracker:
    """
    Tracks latency across different operations.
    
    Tracks:
    - Tick-to-bar latency
    - Bar-to-delivery latency
    - End-to-end latency
    """
    
    def __init__(self, window_size: int = 1000):
        """
        Initialize latency tracker.
        
        Args:
            window_size: Number of samples to keep for rolling stats
        """
        self._window_size = window_size
        self._stats: Dict[str, LatencyStats] = {}
        self._samples: Dict[str, deque] = {}
        self._pending: Dict[str, int] = {}  # operation_id -> start_time_ms
        self._lock = asyncio.Lock()
        
        self.logger = logger.bind(component="latency_tracker")
    
    async def start_operation(self, operation_id: str, category: str = "default") -> None:
        """Start timing an operation."""
        async with self._lock:
            self._pending[f"{category}:{operation_id}"] = int(time.time() * 1000)
    
    async def end_operation(self, operation_id: str, category: str = "default") -> Optional[float]:
        """End timing an operation and return latency."""
        async with self._lock:
            key = f"{category}:{operation_id}"
            start_time = self._pending.pop(key, None)
            
            if start_time is None:
                return None
            
            end_time = int(time.time() * 1000)
            latency_ms = end_time - start_time
            
            # Initialize category if needed
            if category not in self._stats:
                self._stats[category] = LatencyStats()
                self._samples[category] = deque(maxlen=self._window_size)
            
            # Record
            self._stats[category].record(latency_ms)
            self._samples[category].append(latency_ms)
            
            return latency_ms
    
    async def record_latency(self, category: str, latency_ms: float) -> None:
        """Directly record a latency measurement."""
        async with self._lock:
            if category not in self._stats:
                self._stats[category] = LatencyStats()
                self._samples[category] = deque(maxlen=self._window_size)
            
            self._stats[category].record(latency_ms)
            self._samples[category].append(latency_ms)
    
    def get_stats(self, category: Optional[str] = None) -> Dict[str, dict]:
        """Get latency statistics."""
        if category:
            stats = self._stats.get(category)
            return {category: stats.to_dict()} if stats else {}
        return {cat: stats.to_dict() for cat, stats in self._stats.items()}
    
    def get_percentile(self, category: str, percentile: float) -> Optional[float]:
        """Get percentile latency (0-100)."""
        if category not in self._samples or not self._samples[category]:
            return None
        
        samples = sorted(self._samples[category])
        idx = int(len(samples) * percentile / 100)
        idx = min(idx, len(samples) - 1)
        return samples[idx]


class MessageBatcher(Generic[T]):
    """
    Batches messages for efficient delivery.
    
    Features:
    - Size-based batching
    - Time-based flushing
    - Priority handling
    """
    
    def __init__(
        self,
        max_batch_size: int = 100,
        max_delay_ms: int = 50,
        on_batch: Optional[Callable[[List[T]], Awaitable[None]]] = None,
    ):
        """
        Initialize message batcher.
        
        Args:
            max_batch_size: Maximum messages per batch
            max_delay_ms: Maximum delay before flushing
            on_batch: Callback for batch delivery
        """
        self._max_batch_size = max_batch_size
        self._max_delay_ms = max_delay_ms
        self._on_batch = on_batch
        
        self._buffer: List[T] = []
        self._last_flush_time = int(time.time() * 1000)
        self._lock = asyncio.Lock()
        self._flush_task: Optional[asyncio.Task] = None
        self._running = False
        
        # Stats
        self._batches_sent = 0
        self._messages_batched = 0
        
        self.logger = logger.bind(component="message_batcher")
    
    async def start(self) -> None:
        """Start the batcher."""
        if self._running:
            return
        
        self._running = True
        self._flush_task = asyncio.create_task(self._flush_loop())
        self.logger.info("batcher_started")
    
    async def stop(self) -> None:
        """Stop the batcher and flush remaining messages."""
        self._running = False
        
        if self._flush_task:
            self._flush_task.cancel()
            try:
                await self._flush_task
            except asyncio.CancelledError:
                pass
        
        # Final flush
        await self._flush()
        
        self.logger.info("batcher_stopped")
    
    async def add(self, message: T) -> None:
        """Add a message to the batch."""
        async with self._lock:
            self._buffer.append(message)
            self._messages_batched += 1
            
            # Flush if batch full
            if len(self._buffer) >= self._max_batch_size:
                await self._flush_locked()
    
    async def add_many(self, messages: List[T]) -> None:
        """Add multiple messages."""
        for msg in messages:
            await self.add(msg)
    
    async def _flush_loop(self) -> None:
        """Periodic flush loop."""
        while self._running:
            try:
                await asyncio.sleep(self._max_delay_ms / 1000)
                await self._flush()
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error("flush_error", error=str(e))
    
    async def _flush(self) -> None:
        """Flush current batch."""
        async with self._lock:
            await self._flush_locked()
    
    async def _flush_locked(self) -> None:
        """Flush (must hold lock)."""
        if not self._buffer:
            return
        
        batch = self._buffer
        self._buffer = []
        self._last_flush_time = int(time.time() * 1000)
        self._batches_sent += 1
        
        if self._on_batch:
            try:
                await self._on_batch(batch)
            except Exception as e:
                self.logger.error("batch_callback_error", error=str(e))
    
    def get_stats(self) -> dict:
        """Get batcher statistics."""
        return {
            "batches_sent": self._batches_sent,
            "messages_batched": self._messages_batched,
            "pending": len(self._buffer),
            "running": self._running,
        }


class OrderedDelivery(Generic[T]):
    """
    Ensures ordered delivery of messages.
    
    Handles:
    - Out-of-order messages
    - Gap detection
    - Reordering buffer
    """
    
    def __init__(
        self,
        on_deliver: Callable[[T], Awaitable[None]],
        max_buffer_size: int = 1000,
        max_wait_ms: int = 5000,
    ):
        """
        Initialize ordered delivery.
        
        Args:
            on_deliver: Callback for delivering messages
            max_buffer_size: Maximum buffer size
            max_wait_ms: Maximum wait for out-of-order messages
        """
        self._on_deliver = on_deliver
        self._max_buffer_size = max_buffer_size
        self._max_wait_ms = max_wait_ms
        
        # Expected next sequence
        self._next_sequence: Dict[str, int] = {}
        
        # Reorder buffer: {channel: [(seq, msg), ...]}
        self._buffer: Dict[str, List[OrderedMessage[T]]] = {}
        
        # Lock
        self._lock = asyncio.Lock()
        
        # Stats
        self._delivered = 0
        self._reordered = 0
        self._dropped = 0
        
        self.logger = logger.bind(component="ordered_delivery")
    
    async def receive(
        self,
        channel: str,
        sequence: int,
        message: T,
        timestamp_ms: Optional[int] = None,
    ) -> None:
        """
        Receive a message for ordered delivery.
        
        Args:
            channel: Channel/stream identifier
            sequence: Sequence number
            message: Message data
            timestamp_ms: Message timestamp
        """
        async with self._lock:
            # Initialize channel
            if channel not in self._next_sequence:
                self._next_sequence[channel] = sequence
                self._buffer[channel] = []
            
            expected = self._next_sequence[channel]
            
            if sequence < expected:
                # Old/duplicate message - drop
                self._dropped += 1
                self.logger.debug("dropped_old_message", channel=channel, seq=sequence)
                return
            
            if sequence == expected:
                # In order - deliver immediately
                await self._deliver(channel, message)
                
                # Check buffer for next messages
                await self._drain_buffer(channel)
            else:
                # Out of order - buffer
                if len(self._buffer[channel]) >= self._max_buffer_size:
                    # Buffer full - drop oldest
                    self._buffer[channel].pop(0)
                    self._dropped += 1
                
                heappush(
                    self._buffer[channel],
                    OrderedMessage(
                        sequence=sequence,
                        timestamp_ms=timestamp_ms or int(time.time() * 1000),
                        data=message,
                    )
                )
                self._reordered += 1
    
    async def _deliver(self, channel: str, message: T) -> None:
        """Deliver a message."""
        try:
            await self._on_deliver(message)
            self._delivered += 1
            self._next_sequence[channel] += 1
        except Exception as e:
            self.logger.error("delivery_error", error=str(e))
    
    async def _drain_buffer(self, channel: str) -> None:
        """Drain buffer of consecutive messages."""
        buffer = self._buffer[channel]
        
        while buffer:
            # Peek at smallest sequence
            if buffer[0].sequence == self._next_sequence[channel]:
                msg = heappop(buffer)
                await self._deliver(channel, msg.data)
            else:
                break
    
    async def force_flush(self, channel: str) -> None:
        """Force flush buffer (deliver all buffered messages)."""
        async with self._lock:
            if channel not in self._buffer:
                return
            
            buffer = self._buffer[channel]
            while buffer:
                msg = heappop(buffer)
                try:
                    await self._on_deliver(msg.data)
                    self._delivered += 1
                except Exception as e:
                    self.logger.error("forced_delivery_error", error=str(e))
            
            # Update sequence to highest
            if buffer:
                self._next_sequence[channel] = max(m.sequence for m in buffer) + 1
    
    def get_stats(self) -> dict:
        """Get delivery statistics."""
        total_buffered = sum(len(b) for b in self._buffer.values())
        return {
            "delivered": self._delivered,
            "reordered": self._reordered,
            "dropped": self._dropped,
            "buffered": total_buffered,
            "channels": len(self._next_sequence),
        }


class DeliveryGuarantee:
    """
    Provides delivery guarantees with acknowledgments.
    
    Features:
    - At-least-once delivery
    - Acknowledgment tracking
    - Automatic retry
    """
    
    def __init__(
        self,
        on_deliver: Callable[[T], Awaitable[bool]],
        max_retries: int = 3,
        retry_delay_ms: int = 1000,
        ack_timeout_ms: int = 5000,
    ):
        """
        Initialize delivery guarantee.
        
        Args:
            on_deliver: Delivery callback (returns True if acknowledged)
            max_retries: Maximum delivery attempts
            retry_delay_ms: Delay between retries
            ack_timeout_ms: Timeout for acknowledgment
        """
        self._on_deliver = on_deliver
        self._max_retries = max_retries
        self._retry_delay_ms = retry_delay_ms
        self._ack_timeout_ms = ack_timeout_ms
        
        # Pending deliveries
        self._pending: Dict[str, Dict] = {}
        
        # Lock
        self._lock = asyncio.Lock()
        
        # Stats
        self._delivered = 0
        self._retries = 0
        self._failed = 0
        
        self.logger = logger.bind(component="delivery_guarantee")
    
    async def deliver(
        self,
        message_id: str,
        message: T,
    ) -> bool:
        """
        Deliver a message with guarantee.
        
        Args:
            message_id: Unique message identifier
            message: Message to deliver
            
        Returns:
            True if delivered successfully
        """
        async with self._lock:
            self._pending[message_id] = {
                "message": message,
                "attempts": 0,
                "created_at": int(time.time() * 1000),
            }
        
        for attempt in range(self._max_retries + 1):
            try:
                success = await asyncio.wait_for(
                    self._on_deliver(message),
                    timeout=self._ack_timeout_ms / 1000,
                )
                
                if success:
                    async with self._lock:
                        self._pending.pop(message_id, None)
                        self._delivered += 1
                    return True
                
            except asyncio.TimeoutError:
                self.logger.warning(
                    "delivery_timeout",
                    message_id=message_id,
                    attempt=attempt,
                )
            except Exception as e:
                self.logger.error(
                    "delivery_error",
                    message_id=message_id,
                    error=str(e),
                )
            
            if attempt < self._max_retries:
                self._retries += 1
                await asyncio.sleep(self._retry_delay_ms / 1000)
        
        # All retries failed
        async with self._lock:
            self._pending.pop(message_id, None)
            self._failed += 1
        
        self.logger.error("delivery_failed", message_id=message_id)
        return False
    
    def get_stats(self) -> dict:
        """Get delivery statistics."""
        return {
            "delivered": self._delivered,
            "retries": self._retries,
            "failed": self._failed,
            "pending": len(self._pending),
        }
