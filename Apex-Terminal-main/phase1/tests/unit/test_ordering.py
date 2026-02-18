"""
Unit tests for Ordering & Batching.

Tests cover:
- Latency tracking
- Message batching
- Ordered delivery
- Delivery guarantees
"""

import pytest
import asyncio

import sys
sys.path.insert(0, '/home/aarav/Aarav/Tradingview recreation/phase1')

from services.delivery.ordering import (
    LatencyTracker,
    LatencyStats,
    MessageBatcher,
    OrderedDelivery,
    DeliveryGuarantee,
    OrderedMessage,
)


class TestLatencyStats:
    """Tests for LatencyStats."""
    
    def test_record_latency(self):
        """Should record latency measurements."""
        stats = LatencyStats()
        
        stats.record(10.0)
        stats.record(20.0)
        stats.record(30.0)
        
        assert stats.count == 3
        assert stats.avg_ms == 20.0
        assert stats.min_ms == 10.0
        assert stats.max_ms == 30.0
    
    def test_empty_stats(self):
        """Empty stats should handle edge cases."""
        stats = LatencyStats()
        
        assert stats.avg_ms == 0.0
        assert stats.count == 0
    
    def test_to_dict(self):
        """Should convert to dictionary."""
        stats = LatencyStats()
        stats.record(15.0)
        
        d = stats.to_dict()
        
        assert "count" in d
        assert "avg_ms" in d
        assert "min_ms" in d
        assert "max_ms" in d


class TestLatencyTracker:
    """Tests for LatencyTracker."""
    
    @pytest.fixture
    def tracker(self):
        return LatencyTracker(window_size=100)
    
    @pytest.mark.asyncio
    async def test_operation_timing(self, tracker):
        """Should time operations."""
        await tracker.start_operation("op1", "test")
        await asyncio.sleep(0.01)
        latency = await tracker.end_operation("op1", "test")
        
        assert latency is not None
        assert latency >= 10  # At least 10ms
    
    @pytest.mark.asyncio
    async def test_record_direct(self, tracker):
        """Should record latency directly."""
        await tracker.record_latency("direct", 50.0)
        
        stats = tracker.get_stats("direct")
        
        assert "direct" in stats
        assert stats["direct"]["count"] == 1
    
    @pytest.mark.asyncio
    async def test_get_stats_all(self, tracker):
        """Should get all stats."""
        await tracker.record_latency("cat1", 10.0)
        await tracker.record_latency("cat2", 20.0)
        
        stats = tracker.get_stats()
        
        assert "cat1" in stats
        assert "cat2" in stats
    
    @pytest.mark.asyncio
    async def test_percentile(self, tracker):
        """Should calculate percentiles."""
        for i in range(100):
            await tracker.record_latency("pct", float(i + 1))
        
        p50 = tracker.get_percentile("pct", 50)
        p95 = tracker.get_percentile("pct", 95)
        
        assert p50 is not None
        assert p95 is not None
        assert p50 < p95


class TestMessageBatcher:
    """Tests for MessageBatcher."""
    
    @pytest.mark.asyncio
    async def test_batch_on_size(self):
        """Should batch when size reached."""
        batches = []
        
        async def on_batch(batch):
            batches.append(batch)
        
        batcher = MessageBatcher(max_batch_size=5, on_batch=on_batch)
        
        for i in range(5):
            await batcher.add(f"msg{i}")
        
        # Should have flushed
        assert len(batches) == 1
        assert len(batches[0]) == 5
    
    @pytest.mark.asyncio
    async def test_batch_on_time(self):
        """Should batch on time delay."""
        batches = []
        
        async def on_batch(batch):
            batches.append(batch)
        
        batcher = MessageBatcher(
            max_batch_size=100,
            max_delay_ms=50,
            on_batch=on_batch,
        )
        
        await batcher.start()
        await batcher.add("msg1")
        await batcher.add("msg2")
        
        # Wait for flush
        await asyncio.sleep(0.1)
        
        await batcher.stop()
        
        assert len(batches) >= 1
    
    @pytest.mark.asyncio
    async def test_stop_flushes(self):
        """Stop should flush remaining."""
        batches = []
        
        async def on_batch(batch):
            batches.append(batch)
        
        batcher = MessageBatcher(max_batch_size=100, on_batch=on_batch)
        
        await batcher.add("msg1")
        await batcher.add("msg2")
        
        await batcher.stop()
        
        assert len(batches) == 1
        assert len(batches[0]) == 2
    
    @pytest.mark.asyncio
    async def test_stats(self):
        """Should track statistics."""
        batcher = MessageBatcher(max_batch_size=5)
        
        for i in range(10):
            await batcher.add(f"msg{i}")
        
        stats = batcher.get_stats()
        
        assert stats["batches_sent"] == 2
        assert stats["messages_batched"] == 10


class TestOrderedDelivery:
    """Tests for OrderedDelivery."""
    
    @pytest.mark.asyncio
    async def test_in_order_delivery(self):
        """Should deliver in-order messages immediately."""
        delivered = []
        
        async def on_deliver(msg):
            delivered.append(msg)
        
        delivery = OrderedDelivery(on_deliver)
        
        await delivery.receive("ch1", 0, "msg0")
        await delivery.receive("ch1", 1, "msg1")
        await delivery.receive("ch1", 2, "msg2")
        
        assert delivered == ["msg0", "msg1", "msg2"]
    
    @pytest.mark.asyncio
    async def test_reorder_out_of_sequence(self):
        """Should reorder out-of-sequence messages."""
        delivered = []
        
        async def on_deliver(msg):
            delivered.append(msg)
        
        delivery = OrderedDelivery(on_deliver)
        
        await delivery.receive("ch1", 0, "msg0")  # Delivered
        await delivery.receive("ch1", 2, "msg2")  # Buffered
        await delivery.receive("ch1", 1, "msg1")  # Delivered, triggers msg2
        
        assert delivered == ["msg0", "msg1", "msg2"]
    
    @pytest.mark.asyncio
    async def test_drop_old_messages(self):
        """Should drop old/duplicate messages."""
        delivered = []
        
        async def on_deliver(msg):
            delivered.append(msg)
        
        delivery = OrderedDelivery(on_deliver)
        
        await delivery.receive("ch1", 0, "msg0")
        await delivery.receive("ch1", 1, "msg1")
        await delivery.receive("ch1", 0, "msg0_dup")  # Old - should drop
        
        assert delivered == ["msg0", "msg1"]
    
    @pytest.mark.asyncio
    async def test_multiple_channels(self):
        """Should handle multiple channels independently."""
        delivered = []
        
        async def on_deliver(msg):
            delivered.append(msg)
        
        delivery = OrderedDelivery(on_deliver)
        
        await delivery.receive("ch1", 0, "ch1_msg0")
        await delivery.receive("ch2", 0, "ch2_msg0")
        await delivery.receive("ch1", 1, "ch1_msg1")
        
        assert "ch1_msg0" in delivered
        assert "ch2_msg0" in delivered
        assert "ch1_msg1" in delivered
    
    @pytest.mark.asyncio
    async def test_stats(self):
        """Should track statistics."""
        async def on_deliver(msg):
            pass
        
        delivery = OrderedDelivery(on_deliver)
        
        await delivery.receive("ch1", 0, "msg0")
        await delivery.receive("ch1", 2, "msg2")  # Out of order
        await delivery.receive("ch1", 1, "msg1")
        
        stats = delivery.get_stats()
        
        assert stats["delivered"] == 3
        assert stats["reordered"] >= 1


class TestDeliveryGuarantee:
    """Tests for DeliveryGuarantee."""
    
    @pytest.mark.asyncio
    async def test_successful_delivery(self):
        """Should deliver successfully."""
        async def on_deliver(msg):
            return True
        
        guarantee = DeliveryGuarantee(on_deliver)
        
        success = await guarantee.deliver("msg1", "hello")
        
        assert success
        assert guarantee.get_stats()["delivered"] == 1
    
    @pytest.mark.asyncio
    async def test_retry_on_failure(self):
        """Should retry on failure."""
        attempts = []
        
        async def on_deliver(msg):
            attempts.append(1)
            if len(attempts) < 2:
                return False
            return True
        
        guarantee = DeliveryGuarantee(
            on_deliver,
            max_retries=3,
            retry_delay_ms=10,
        )
        
        success = await guarantee.deliver("msg1", "hello")
        
        assert success
        assert len(attempts) == 2
        assert guarantee.get_stats()["retries"] == 1
    
    @pytest.mark.asyncio
    async def test_fail_after_retries(self):
        """Should fail after max retries."""
        async def on_deliver(msg):
            return False
        
        guarantee = DeliveryGuarantee(
            on_deliver,
            max_retries=2,
            retry_delay_ms=10,
        )
        
        success = await guarantee.deliver("msg1", "hello")
        
        assert not success
        assert guarantee.get_stats()["failed"] == 1


class TestOrderedMessage:
    """Tests for OrderedMessage."""
    
    def test_priority_ordering(self):
        """Higher priority should come first."""
        low = OrderedMessage(sequence=1, timestamp_ms=100, data="low", priority=1)
        high = OrderedMessage(sequence=2, timestamp_ms=200, data="high", priority=2)
        
        # high < low because higher priority comes first
        assert high < low
    
    def test_sequence_ordering_same_priority(self):
        """Same priority should order by sequence."""
        first = OrderedMessage(sequence=1, timestamp_ms=100, data="first", priority=1)
        second = OrderedMessage(sequence=2, timestamp_ms=200, data="second", priority=1)
        
        assert first < second


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
