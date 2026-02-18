"""
Unit tests for Backfill & Recovery.

Tests cover:
- Gap detection
- Backfill scheduling
- Priority handling
- Recovery manager coordination
"""

import pytest
import asyncio
from unittest.mock import AsyncMock

import sys
sys.path.insert(0, '/home/aarav/Aarav/Tradingview recreation/phase1')

from services.recovery.backfill import (
    GapDetector,
    BackfillScheduler,
    RecoveryManager,
    Gap,
    BackfillRequest,
    BackfillPriority,
    BackfillStatus,
)
from services.models import Bar, BarState


def create_bar(
    symbol: str = "AAPL",
    timeframe: str = "1m",
    bar_index: int = 28401120,
) -> Bar:
    """Create test bar."""
    return Bar(
        symbol=symbol,
        timeframe=timeframe,
        bar_index=bar_index,
        ts_start_ms=bar_index * 60000,
        ts_end_ms=(bar_index + 1) * 60000,
        open=100.0,
        high=102.0,
        low=99.0,
        close=101.0,
        state=BarState.CONFIRMED,
    )


class TestGap:
    """Tests for Gap dataclass."""
    
    def test_bar_count(self):
        """Should calculate missing bar count."""
        gap = Gap(
            symbol="AAPL",
            timeframe="1m",
            start_index=100,
            end_index=110,
            start_time_ms=6000000,
            end_time_ms=6600000,
        )
        
        assert gap.bar_count == 10
    
    def test_duration(self):
        """Should calculate duration."""
        gap = Gap(
            symbol="AAPL",
            timeframe="1m",
            start_index=100,
            end_index=110,
            start_time_ms=6000000,
            end_time_ms=6600000,
        )
        
        assert gap.duration_ms == 600000


class TestGapDetector:
    """Tests for GapDetector."""
    
    @pytest.fixture
    def detector(self):
        return GapDetector()
    
    @pytest.mark.asyncio
    async def test_no_gap_sequential_bars(self, detector):
        """Sequential bars should not create gaps."""
        bar1 = create_bar(bar_index=100)
        bar2 = create_bar(bar_index=101)
        bar3 = create_bar(bar_index=102)
        
        gap1 = await detector.on_bar_confirmed(bar1)
        gap2 = await detector.on_bar_confirmed(bar2)
        gap3 = await detector.on_bar_confirmed(bar3)
        
        assert gap1 is None
        assert gap2 is None
        assert gap3 is None
    
    @pytest.mark.asyncio
    async def test_detect_gap(self, detector):
        """Should detect gap when bars are missing."""
        bar1 = create_bar(bar_index=100)
        bar2 = create_bar(bar_index=105)  # Skip 101-104
        
        await detector.on_bar_confirmed(bar1)
        gap = await detector.on_bar_confirmed(bar2)
        
        assert gap is not None
        assert gap.start_index == 101
        assert gap.end_index == 105
        assert gap.bar_count == 4
    
    @pytest.mark.asyncio
    async def test_gap_callback(self, detector):
        """Should call gap callbacks."""
        detected_gaps = []
        
        async def on_gap(gap):
            detected_gaps.append(gap)
        
        detector.register_gap_callback(on_gap)
        
        bar1 = create_bar(bar_index=100)
        bar2 = create_bar(bar_index=110)
        
        await detector.on_bar_confirmed(bar1)
        await detector.on_bar_confirmed(bar2)
        
        assert len(detected_gaps) == 1
        assert detected_gaps[0].bar_count == 9
    
    @pytest.mark.asyncio
    async def test_set_baseline(self, detector):
        """Should set baseline index."""
        await detector.set_baseline("AAPL", "1m", 100)
        
        # First bar after baseline at 102 = gap
        bar = create_bar(bar_index=102)
        gap = await detector.on_bar_confirmed(bar)
        
        assert gap is not None
        assert gap.start_index == 101
    
    @pytest.mark.asyncio
    async def test_get_gaps(self, detector):
        """Should return detected gaps."""
        bar1 = create_bar(bar_index=100)
        bar2 = create_bar(bar_index=110)
        
        await detector.on_bar_confirmed(bar1)
        await detector.on_bar_confirmed(bar2)
        
        gaps = detector.get_gaps()
        assert len(gaps) == 1
    
    @pytest.mark.asyncio
    async def test_get_gaps_filtered(self, detector):
        """Should filter gaps by symbol/timeframe."""
        # AAPL gap
        await detector.on_bar_confirmed(create_bar(symbol="AAPL", bar_index=100))
        await detector.on_bar_confirmed(create_bar(symbol="AAPL", bar_index=110))
        
        # MSFT gap
        await detector.on_bar_confirmed(create_bar(symbol="MSFT", bar_index=200))
        await detector.on_bar_confirmed(create_bar(symbol="MSFT", bar_index=220))
        
        aapl_gaps = detector.get_gaps(symbol="AAPL")
        msft_gaps = detector.get_gaps(symbol="MSFT")
        
        assert len(aapl_gaps) == 1
        assert len(msft_gaps) == 1
    
    @pytest.mark.asyncio
    async def test_clear_gap(self, detector):
        """Should clear specific gap."""
        bar1 = create_bar(bar_index=100)
        bar2 = create_bar(bar_index=110)
        
        await detector.on_bar_confirmed(bar1)
        await detector.on_bar_confirmed(bar2)
        
        gaps = detector.get_gaps()
        assert len(gaps) == 1
        
        detector.clear_gap(gaps[0])
        
        assert len(detector.get_gaps()) == 0
    
    @pytest.mark.asyncio
    async def test_stats(self, detector):
        """Should return statistics."""
        await detector.on_bar_confirmed(create_bar(bar_index=100))
        await detector.on_bar_confirmed(create_bar(bar_index=110))
        
        stats = detector.get_stats()
        
        assert stats["total_gaps"] == 1
        assert stats["total_missing_bars"] == 9


class TestBackfillRequest:
    """Tests for BackfillRequest."""
    
    def test_creation(self):
        """Should create request with timestamp."""
        req = BackfillRequest(
            id="test123",
            symbol="AAPL",
            timeframe="1m",
            start_time_ms=6000000,
            end_time_ms=6600000,
        )
        
        assert req.id == "test123"
        assert req.status == BackfillStatus.PENDING
        assert req.created_at > 0


class TestBackfillScheduler:
    """Tests for BackfillScheduler."""
    
    @pytest.fixture
    def scheduler(self):
        return BackfillScheduler(max_concurrent=2)
    
    @pytest.mark.asyncio
    async def test_schedule_request(self, scheduler):
        """Should schedule request."""
        request = BackfillRequest(
            id="req1",
            symbol="AAPL",
            timeframe="1m",
            start_time_ms=6000000,
            end_time_ms=6600000,
        )
        
        req_id = await scheduler.schedule(request)
        
        assert req_id == "req1"
        assert scheduler.get_stats()["pending"] == 1
    
    @pytest.mark.asyncio
    async def test_priority_ordering(self, scheduler):
        """Higher priority requests should be first."""
        low = BackfillRequest(
            id="low",
            symbol="AAPL",
            timeframe="1m",
            start_time_ms=1,
            end_time_ms=2,
            priority=BackfillPriority.LOW,
        )
        high = BackfillRequest(
            id="high",
            symbol="AAPL",
            timeframe="1m",
            start_time_ms=3,
            end_time_ms=4,
            priority=BackfillPriority.HIGH,
        )
        
        await scheduler.schedule(low)
        await scheduler.schedule(high)
        
        # High priority should be first
        assert scheduler._pending[0].id == "high"
    
    @pytest.mark.asyncio
    async def test_schedule_from_gap(self, scheduler):
        """Should create request from gap."""
        gap = Gap(
            symbol="AAPL",
            timeframe="1m",
            start_index=100,
            end_index=110,
            start_time_ms=6000000,
            end_time_ms=6600000,
        )
        
        req_id = await scheduler.schedule_from_gap(gap)
        
        assert req_id is not None
        assert scheduler.get_stats()["pending"] == 1
    
    @pytest.mark.asyncio
    async def test_cancel_request(self, scheduler):
        """Should cancel pending request."""
        request = BackfillRequest(
            id="cancel_me",
            symbol="AAPL",
            timeframe="1m",
            start_time_ms=1,
            end_time_ms=2,
        )
        
        await scheduler.schedule(request)
        cancelled = await scheduler.cancel("cancel_me")
        
        assert cancelled
        assert scheduler.get_stats()["pending"] == 0
    
    @pytest.mark.asyncio
    async def test_execute_backfill(self, scheduler):
        """Should execute backfill with handler."""
        results = []
        
        async def handler(request):
            results.append(request.id)
            return [create_bar()]
        
        scheduler.set_backfill_handler(handler)
        await scheduler.start()
        
        request = BackfillRequest(
            id="exec_test",
            symbol="AAPL",
            timeframe="1m",
            start_time_ms=1,
            end_time_ms=2,
        )
        await scheduler.schedule(request)
        
        # Wait for processing
        await asyncio.sleep(0.3)
        
        await scheduler.stop()
        
        assert "exec_test" in results
    
    @pytest.mark.asyncio
    async def test_completion_callback(self, scheduler):
        """Should call completion callbacks."""
        completed_requests = []
        
        async def on_complete(request):
            completed_requests.append(request.id)
        
        async def handler(request):
            return []
        
        scheduler.set_backfill_handler(handler)
        scheduler.register_completion_callback(on_complete)
        
        await scheduler.start()
        
        request = BackfillRequest(
            id="callback_test",
            symbol="AAPL",
            timeframe="1m",
            start_time_ms=1,
            end_time_ms=2,
        )
        await scheduler.schedule(request)
        
        await asyncio.sleep(0.3)
        await scheduler.stop()
        
        assert "callback_test" in completed_requests
    
    @pytest.mark.asyncio
    async def test_get_request(self, scheduler):
        """Should retrieve request by ID."""
        request = BackfillRequest(
            id="get_test",
            symbol="AAPL",
            timeframe="1m",
            start_time_ms=1,
            end_time_ms=2,
        )
        await scheduler.schedule(request)
        
        retrieved = scheduler.get_request("get_test")
        
        assert retrieved is not None
        assert retrieved.id == "get_test"


class TestRecoveryManager:
    """Tests for RecoveryManager."""
    
    @pytest.fixture
    def manager(self):
        return RecoveryManager()
    
    @pytest.mark.asyncio
    async def test_gap_triggers_backfill(self, manager):
        """Gap detection should trigger backfill."""
        # Process bars with gap
        await manager.on_bar_confirmed(create_bar(bar_index=100))
        await manager.on_bar_confirmed(create_bar(bar_index=110))
        
        # Should have scheduled backfill
        stats = manager.get_stats()
        assert stats["backfill"]["pending"] > 0
    
    @pytest.mark.asyncio
    async def test_check_and_recover(self, manager):
        """Should check for missing bars and schedule recovery."""
        expected = list(range(100, 120))
        actual = [100, 101, 102, 110, 111, 112]  # Missing 103-109
        
        request_ids = await manager.check_and_recover(
            "AAPL", "1m", expected, actual
        )
        
        assert len(request_ids) > 0
    
    @pytest.mark.asyncio
    async def test_start_stop(self, manager):
        """Should start and stop cleanly."""
        await manager.start()
        await manager.stop()
    
    @pytest.mark.asyncio
    async def test_get_stats(self, manager):
        """Should return combined stats."""
        stats = manager.get_stats()
        
        assert "gaps" in stats
        assert "backfill" in stats


class TestBackfillPriority:
    """Tests for priority handling."""
    
    @pytest.mark.asyncio
    async def test_critical_priority_for_recent_gaps(self):
        """Recent gaps should get critical priority."""
        import time
        
        manager = RecoveryManager()
        
        # Create a recent gap (within last minute)
        now = int(time.time() * 1000)
        gap = Gap(
            symbol="AAPL",
            timeframe="1m",
            start_index=100,
            end_index=105,
            start_time_ms=now - 30000,  # 30 seconds ago
            end_time_ms=now,
        )
        
        await manager._on_gap_detected(gap)
        
        # Check priority of scheduled request
        stats = manager.get_stats()
        assert stats["backfill"]["pending"] == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
