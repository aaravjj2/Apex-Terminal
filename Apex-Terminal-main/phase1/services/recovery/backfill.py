"""
Backfill & Recovery - Gap detection and historical data filling.

Provides:
- Gap detection in bar sequences
- Backfill scheduling and execution
- Recovery from disconnections
- Missing bar reconstruction
"""

import asyncio
from typing import Optional, List, Dict, Set, Callable, Awaitable, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import structlog

from ..models import Bar, BarState
from ..config import get_settings, timeframe_to_ms


logger = structlog.get_logger()


class BackfillPriority(str, Enum):
    """Priority levels for backfill requests."""
    CRITICAL = "critical"   # Recent gaps, user visible
    HIGH = "high"           # Important gaps
    NORMAL = "normal"       # Standard backfill
    LOW = "low"             # Historical data


class BackfillStatus(str, Enum):
    """Status of a backfill request."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class Gap:
    """Represents a gap in bar sequence."""
    symbol: str
    timeframe: str
    start_index: int
    end_index: int  # Exclusive
    start_time_ms: int
    end_time_ms: int
    
    @property
    def bar_count(self) -> int:
        """Number of missing bars."""
        return self.end_index - self.start_index
    
    @property
    def duration_ms(self) -> int:
        """Gap duration in milliseconds."""
        return self.end_time_ms - self.start_time_ms


@dataclass
class BackfillRequest:
    """A request to backfill missing data."""
    id: str
    symbol: str
    timeframe: str
    start_time_ms: int
    end_time_ms: int
    priority: BackfillPriority = BackfillPriority.NORMAL
    status: BackfillStatus = BackfillStatus.PENDING
    created_at: int = 0
    started_at: Optional[int] = None
    completed_at: Optional[int] = None
    bars_filled: int = 0
    error_message: Optional[str] = None
    
    def __post_init__(self):
        import time
        if self.created_at == 0:
            self.created_at = int(time.time() * 1000)


class GapDetector:
    """
    Detects gaps in bar sequences.
    
    Monitors bar confirmations and detects when expected bars are missing.
    """
    
    def __init__(self):
        # Track last confirmed bar index per symbol/timeframe
        self._last_confirmed: Dict[tuple, int] = {}
        
        # Detected gaps
        self._gaps: Dict[tuple, List[Gap]] = {}
        
        # Lock
        self._lock = asyncio.Lock()
        
        # Callbacks
        self._gap_callbacks: List[Callable[[Gap], Awaitable[None]]] = []
        
        self.logger = logger.bind(component="gap_detector")
    
    def register_gap_callback(
        self,
        callback: Callable[[Gap], Awaitable[None]]
    ) -> None:
        """Register callback for gap detection."""
        self._gap_callbacks.append(callback)
    
    async def on_bar_confirmed(self, bar: Bar) -> Optional[Gap]:
        """
        Process a confirmed bar and detect gaps.
        
        Args:
            bar: Confirmed bar
            
        Returns:
            Gap if one was detected, None otherwise
        """
        key = (bar.symbol, bar.timeframe)
        
        async with self._lock:
            last_index = self._last_confirmed.get(key)
            
            gap = None
            if last_index is not None:
                expected_index = last_index + 1
                
                if bar.bar_index > expected_index:
                    # Gap detected!
                    tf_ms = timeframe_to_ms(bar.timeframe)
                    gap = Gap(
                        symbol=bar.symbol,
                        timeframe=bar.timeframe,
                        start_index=expected_index,
                        end_index=bar.bar_index,
                        start_time_ms=expected_index * tf_ms,
                        end_time_ms=bar.bar_index * tf_ms,
                    )
                    
                    if key not in self._gaps:
                        self._gaps[key] = []
                    self._gaps[key].append(gap)
                    
                    self.logger.warning(
                        "gap_detected",
                        symbol=bar.symbol,
                        timeframe=bar.timeframe,
                        missing_bars=gap.bar_count,
                        duration_ms=gap.duration_ms,
                    )
            
            # Update last confirmed
            self._last_confirmed[key] = bar.bar_index
        
        # Notify callbacks
        if gap:
            for callback in self._gap_callbacks:
                try:
                    await callback(gap)
                except Exception as e:
                    self.logger.error("gap_callback_error", error=str(e))
        
        return gap
    
    async def set_baseline(
        self,
        symbol: str,
        timeframe: str,
        bar_index: int,
    ) -> None:
        """Set baseline bar index (e.g., on startup)."""
        key = (symbol, timeframe)
        async with self._lock:
            self._last_confirmed[key] = bar_index
    
    def get_gaps(
        self,
        symbol: Optional[str] = None,
        timeframe: Optional[str] = None,
    ) -> List[Gap]:
        """Get detected gaps, optionally filtered."""
        gaps = []
        for key, key_gaps in self._gaps.items():
            if symbol and key[0] != symbol:
                continue
            if timeframe and key[1] != timeframe:
                continue
            gaps.extend(key_gaps)
        return gaps
    
    def clear_gap(self, gap: Gap) -> None:
        """Remove a gap (e.g., after backfill)."""
        key = (gap.symbol, gap.timeframe)
        if key in self._gaps:
            self._gaps[key] = [g for g in self._gaps[key] 
                              if g.start_index != gap.start_index]
    
    def get_stats(self) -> dict:
        """Get detector statistics."""
        total_gaps = sum(len(g) for g in self._gaps.values())
        total_missing = sum(
            sum(gap.bar_count for gap in gaps)
            for gaps in self._gaps.values()
        )
        return {
            "total_gaps": total_gaps,
            "total_missing_bars": total_missing,
            "tracked_symbols": len(self._last_confirmed),
        }


class BackfillScheduler:
    """
    Schedules and manages backfill requests.
    
    Features:
    - Priority queue for backfill requests
    - Rate limiting
    - Retry logic
    - Progress tracking
    """
    
    def __init__(
        self,
        max_concurrent: int = 3,
        max_retries: int = 3,
        rate_limit_ms: int = 1000,
    ):
        """
        Initialize backfill scheduler.
        
        Args:
            max_concurrent: Maximum concurrent backfill requests
            max_retries: Maximum retry attempts
            rate_limit_ms: Minimum time between requests
        """
        self._max_concurrent = max_concurrent
        self._max_retries = max_retries
        self._rate_limit_ms = rate_limit_ms
        
        # Request queue (priority ordered)
        self._pending: List[BackfillRequest] = []
        self._in_progress: Dict[str, BackfillRequest] = {}
        self._completed: List[BackfillRequest] = []
        
        # Backfill handler
        self._backfill_handler: Optional[Callable[[BackfillRequest], Awaitable[List[Bar]]]] = None
        
        # State
        self._running = False
        self._worker_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()
        self._last_request_time = 0
        
        # Callbacks
        self._completion_callbacks: List[Callable[[BackfillRequest], Awaitable[None]]] = []
        
        self.logger = logger.bind(component="backfill_scheduler")
    
    def set_backfill_handler(
        self,
        handler: Callable[[BackfillRequest], Awaitable[List[Bar]]]
    ) -> None:
        """Set the handler that performs actual backfill."""
        self._backfill_handler = handler
    
    def register_completion_callback(
        self,
        callback: Callable[[BackfillRequest], Awaitable[None]]
    ) -> None:
        """Register callback for backfill completion."""
        self._completion_callbacks.append(callback)
    
    async def start(self) -> None:
        """Start the scheduler worker."""
        if self._running:
            return
        
        self._running = True
        self._worker_task = asyncio.create_task(self._worker_loop())
        self.logger.info("scheduler_started")
    
    async def stop(self) -> None:
        """Stop the scheduler."""
        self._running = False
        
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
        
        self.logger.info("scheduler_stopped")
    
    async def schedule(self, request: BackfillRequest) -> str:
        """
        Schedule a backfill request.
        
        Args:
            request: Backfill request
            
        Returns:
            Request ID
        """
        async with self._lock:
            # Insert by priority
            inserted = False
            for i, existing in enumerate(self._pending):
                if self._priority_value(request.priority) > self._priority_value(existing.priority):
                    self._pending.insert(i, request)
                    inserted = True
                    break
            
            if not inserted:
                self._pending.append(request)
        
        self.logger.info(
            "backfill_scheduled",
            id=request.id,
            symbol=request.symbol,
            timeframe=request.timeframe,
            priority=request.priority.value,
        )
        
        return request.id
    
    async def schedule_from_gap(
        self,
        gap: Gap,
        priority: BackfillPriority = BackfillPriority.NORMAL,
    ) -> str:
        """
        Create and schedule backfill from a detected gap.
        
        Args:
            gap: Detected gap
            priority: Request priority
            
        Returns:
            Request ID
        """
        import uuid
        
        request = BackfillRequest(
            id=str(uuid.uuid4())[:8],
            symbol=gap.symbol,
            timeframe=gap.timeframe,
            start_time_ms=gap.start_time_ms,
            end_time_ms=gap.end_time_ms,
            priority=priority,
        )
        
        return await self.schedule(request)
    
    async def cancel(self, request_id: str) -> bool:
        """Cancel a pending request."""
        async with self._lock:
            for i, req in enumerate(self._pending):
                if req.id == request_id:
                    req.status = BackfillStatus.CANCELLED
                    self._pending.pop(i)
                    self._completed.append(req)
                    return True
        return False
    
    async def _worker_loop(self) -> None:
        """Main worker loop."""
        while self._running:
            try:
                await self._process_pending()
                await asyncio.sleep(0.1)
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error("worker_error", error=str(e))
    
    async def _process_pending(self) -> None:
        """Process pending requests."""
        async with self._lock:
            # Check if we can start more requests
            available_slots = self._max_concurrent - len(self._in_progress)
            if available_slots <= 0 or not self._pending:
                return
            
            # Rate limiting
            import time
            now = int(time.time() * 1000)
            if now - self._last_request_time < self._rate_limit_ms:
                return
            
            # Get next request
            request = self._pending.pop(0)
            self._in_progress[request.id] = request
            self._last_request_time = now
        
        # Process request (outside lock)
        asyncio.create_task(self._execute_backfill(request))
    
    async def _execute_backfill(self, request: BackfillRequest) -> None:
        """Execute a backfill request."""
        import time
        
        request.status = BackfillStatus.IN_PROGRESS
        request.started_at = int(time.time() * 1000)
        
        try:
            if not self._backfill_handler:
                raise RuntimeError("No backfill handler configured")
            
            bars = await self._backfill_handler(request)
            
            request.status = BackfillStatus.COMPLETED
            request.bars_filled = len(bars)
            request.completed_at = int(time.time() * 1000)
            
            self.logger.info(
                "backfill_completed",
                id=request.id,
                bars_filled=request.bars_filled,
            )
            
        except Exception as e:
            request.status = BackfillStatus.FAILED
            request.error_message = str(e)
            request.completed_at = int(time.time() * 1000)
            
            self.logger.error(
                "backfill_failed",
                id=request.id,
                error=str(e),
            )
        
        # Move to completed
        async with self._lock:
            self._in_progress.pop(request.id, None)
            self._completed.append(request)
        
        # Notify callbacks
        for callback in self._completion_callbacks:
            try:
                await callback(request)
            except Exception as e:
                self.logger.error("completion_callback_error", error=str(e))
    
    def _priority_value(self, priority: BackfillPriority) -> int:
        """Get numeric priority value."""
        return {
            BackfillPriority.CRITICAL: 4,
            BackfillPriority.HIGH: 3,
            BackfillPriority.NORMAL: 2,
            BackfillPriority.LOW: 1,
        }[priority]
    
    def get_request(self, request_id: str) -> Optional[BackfillRequest]:
        """Get request by ID."""
        for req in self._pending:
            if req.id == request_id:
                return req
        if request_id in self._in_progress:
            return self._in_progress[request_id]
        for req in self._completed:
            if req.id == request_id:
                return req
        return None
    
    def get_stats(self) -> dict:
        """Get scheduler statistics."""
        return {
            "pending": len(self._pending),
            "in_progress": len(self._in_progress),
            "completed": len(self._completed),
            "running": self._running,
        }


class RecoveryManager:
    """
    Manages recovery from disconnections and errors.
    
    Coordinates:
    - Gap detection
    - Backfill scheduling
    - Data consistency checks
    """
    
    def __init__(
        self,
        gap_detector: Optional[GapDetector] = None,
        backfill_scheduler: Optional[BackfillScheduler] = None,
    ):
        """
        Initialize recovery manager.
        
        Args:
            gap_detector: Gap detector instance
            backfill_scheduler: Backfill scheduler instance
        """
        self._gap_detector = gap_detector or GapDetector()
        self._backfill_scheduler = backfill_scheduler or BackfillScheduler()
        
        # Wire up gap detection to backfill
        self._gap_detector.register_gap_callback(self._on_gap_detected)
        
        self.logger = logger.bind(component="recovery_manager")
    
    @property
    def gap_detector(self) -> GapDetector:
        """Get gap detector."""
        return self._gap_detector
    
    @property
    def backfill_scheduler(self) -> BackfillScheduler:
        """Get backfill scheduler."""
        return self._backfill_scheduler
    
    async def start(self) -> None:
        """Start the recovery manager."""
        await self._backfill_scheduler.start()
        self.logger.info("recovery_manager_started")
    
    async def stop(self) -> None:
        """Stop the recovery manager."""
        await self._backfill_scheduler.stop()
        self.logger.info("recovery_manager_stopped")
    
    async def on_bar_confirmed(self, bar: Bar) -> None:
        """Process confirmed bar for gap detection."""
        await self._gap_detector.on_bar_confirmed(bar)
    
    async def _on_gap_detected(self, gap: Gap) -> None:
        """Handle detected gap."""
        # Determine priority based on gap recency and size
        import time
        now = int(time.time() * 1000)
        age_ms = now - gap.end_time_ms
        
        if age_ms < 60000:  # Less than 1 minute old
            priority = BackfillPriority.CRITICAL
        elif age_ms < 300000:  # Less than 5 minutes
            priority = BackfillPriority.HIGH
        elif gap.bar_count > 10:
            priority = BackfillPriority.HIGH
        else:
            priority = BackfillPriority.NORMAL
        
        await self._backfill_scheduler.schedule_from_gap(gap, priority)
    
    async def check_and_recover(
        self,
        symbol: str,
        timeframe: str,
        expected_bars: List[int],  # Expected bar indices
        actual_bars: List[int],    # Actual bar indices
    ) -> List[str]:
        """
        Check for missing bars and schedule recovery.
        
        Args:
            symbol: Symbol
            timeframe: Timeframe
            expected_bars: List of expected bar indices
            actual_bars: List of actual bar indices
            
        Returns:
            List of scheduled backfill request IDs
        """
        expected_set = set(expected_bars)
        actual_set = set(actual_bars)
        missing = expected_set - actual_set
        
        if not missing:
            return []
        
        # Group missing into contiguous gaps
        missing_sorted = sorted(missing)
        gaps = []
        start_idx = missing_sorted[0]
        end_idx = start_idx + 1
        
        for idx in missing_sorted[1:]:
            if idx == end_idx:
                end_idx += 1
            else:
                tf_ms = timeframe_to_ms(timeframe)
                gaps.append(Gap(
                    symbol=symbol,
                    timeframe=timeframe,
                    start_index=start_idx,
                    end_index=end_idx,
                    start_time_ms=start_idx * tf_ms,
                    end_time_ms=end_idx * tf_ms,
                ))
                start_idx = idx
                end_idx = idx + 1
        
        # Don't forget last gap
        tf_ms = timeframe_to_ms(timeframe)
        gaps.append(Gap(
            symbol=symbol,
            timeframe=timeframe,
            start_index=start_idx,
            end_index=end_idx,
            start_time_ms=start_idx * tf_ms,
            end_time_ms=end_idx * tf_ms,
        ))
        
        # Schedule backfills
        request_ids = []
        for gap in gaps:
            req_id = await self._backfill_scheduler.schedule_from_gap(gap)
            request_ids.append(req_id)
        
        return request_ids
    
    def get_stats(self) -> dict:
        """Get recovery manager statistics."""
        return {
            "gaps": self._gap_detector.get_stats(),
            "backfill": self._backfill_scheduler.get_stats(),
        }
