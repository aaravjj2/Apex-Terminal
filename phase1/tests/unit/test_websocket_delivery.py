"""
Unit tests for Enhanced WebSocket Delivery.

Tests cover:
- Sequence numbering
- Message buffering
- Subscription management
- Catchup delivery
- Heartbeat functionality
"""

import pytest
import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch
from dataclasses import dataclass

import sys
sys.path.insert(0, '/home/aarav/Aarav/Tradingview recreation/phase1')

from services.api.websocket_delivery import (
    EnhancedConnectionManager,
    MessageBuffer,
    SequencedMessage,
    DeliveryMode,
    ClientState,
    get_enhanced_manager,
    set_enhanced_manager,
)
from services.models import Bar, BarState, BarMessage


class MockWebSocket:
    """Mock WebSocket for testing."""
    
    def __init__(self):
        self.accepted = False
        self.closed = False
        self.sent_messages = []
        self.send_json = AsyncMock(side_effect=self._record_json)
        self.send_text = AsyncMock(side_effect=self._record_text)
        self.close = AsyncMock()
    
    async def accept(self):
        self.accepted = True
    
    async def _record_json(self, data):
        self.sent_messages.append(data)
    
    async def _record_text(self, text):
        self.sent_messages.append(json.loads(text))


def create_test_bar(
    symbol: str = "AAPL",
    timeframe: str = "1m",
    bar_index: int = 28401120,
    state: BarState = BarState.FORMING,
) -> Bar:
    """Helper to create test bar."""
    return Bar(
        symbol=symbol,
        timeframe=timeframe,
        bar_index=bar_index,
        ts_start_ms=1704067200000,
        ts_end_ms=1704067260000,
        open=100.0,
        high=102.0,
        low=99.0,
        close=101.0,
        volume=1000.0,
        state=state,
        tick_count=10,
    )


class TestMessageBuffer:
    """Tests for MessageBuffer."""
    
    def test_add_message(self):
        """Adding message should return sequenced message."""
        buffer = MessageBuffer(max_size=100)
        bar = create_test_bar()
        message = BarMessage.from_bar(bar)
        
        seq_msg = buffer.add(("AAPL", "1m"), message)
        
        assert seq_msg.sequence == 1
        assert seq_msg.message == message
        assert seq_msg.delivery_mode == DeliveryMode.LIVE
    
    def test_sequence_increments(self):
        """Sequence numbers should increment."""
        buffer = MessageBuffer(max_size=100)
        bar = create_test_bar()
        message = BarMessage.from_bar(bar)
        key = ("AAPL", "1m")
        
        msg1 = buffer.add(key, message)
        msg2 = buffer.add(key, message)
        msg3 = buffer.add(key, message)
        
        assert msg1.sequence == 1
        assert msg2.sequence == 2
        assert msg3.sequence == 3
    
    def test_separate_sequences_per_key(self):
        """Different keys should have separate sequences."""
        buffer = MessageBuffer(max_size=100)
        bar_aapl = create_test_bar(symbol="AAPL")
        bar_msft = create_test_bar(symbol="MSFT")
        
        aapl_msg = buffer.add(("AAPL", "1m"), BarMessage.from_bar(bar_aapl))
        msft_msg = buffer.add(("MSFT", "1m"), BarMessage.from_bar(bar_msft))
        
        assert aapl_msg.sequence == 1
        assert msft_msg.sequence == 1
    
    def test_get_since(self):
        """Should return messages after sequence number."""
        buffer = MessageBuffer(max_size=100)
        bar = create_test_bar()
        message = BarMessage.from_bar(bar)
        key = ("AAPL", "1m")
        
        for _ in range(5):
            buffer.add(key, message)
        
        messages = buffer.get_since(key, 2)
        
        assert len(messages) == 3
        assert messages[0].sequence == 3
        assert messages[-1].sequence == 5
    
    def test_get_latest(self):
        """Should return latest N messages."""
        buffer = MessageBuffer(max_size=100)
        bar = create_test_bar()
        message = BarMessage.from_bar(bar)
        key = ("AAPL", "1m")
        
        for _ in range(10):
            buffer.add(key, message)
        
        latest = buffer.get_latest(key, 3)
        
        assert len(latest) == 3
        assert latest[0].sequence == 8
        assert latest[-1].sequence == 10
    
    def test_buffer_max_size(self):
        """Buffer should respect max size."""
        buffer = MessageBuffer(max_size=5)
        bar = create_test_bar()
        message = BarMessage.from_bar(bar)
        key = ("AAPL", "1m")
        
        for _ in range(10):
            buffer.add(key, message)
        
        all_msgs = buffer.get_since(key, 0)
        
        assert len(all_msgs) == 5
        assert all_msgs[0].sequence == 6  # Oldest kept
    
    def test_get_current_sequence(self):
        """Should return current sequence number."""
        buffer = MessageBuffer(max_size=100)
        bar = create_test_bar()
        message = BarMessage.from_bar(bar)
        key = ("AAPL", "1m")
        
        for _ in range(7):
            buffer.add(key, message)
        
        assert buffer.get_current_sequence(key) == 7
        assert buffer.get_current_sequence(("UNKNOWN", "1m")) == 0
    
    def test_clear(self):
        """Should clear buffer."""
        buffer = MessageBuffer(max_size=100)
        bar = create_test_bar()
        message = BarMessage.from_bar(bar)
        
        buffer.add(("AAPL", "1m"), message)
        buffer.add(("MSFT", "1m"), message)
        
        buffer.clear(("AAPL", "1m"))
        
        assert buffer.get_current_sequence(("AAPL", "1m")) == 0
        assert buffer.get_current_sequence(("MSFT", "1m")) == 1


class TestEnhancedConnectionManager:
    """Tests for EnhancedConnectionManager."""
    
    @pytest.fixture
    def manager(self):
        """Create manager for testing."""
        return EnhancedConnectionManager(
            buffer_size=100,
            heartbeat_interval_sec=30.0,
        )
    
    @pytest.mark.asyncio
    async def test_connect(self, manager):
        """Should accept connection and track client."""
        ws = MockWebSocket()
        
        await manager.connect(ws)
        
        assert ws.accepted
        assert manager.connection_count == 1
        assert ws in manager._clients
    
    @pytest.mark.asyncio
    async def test_disconnect(self, manager):
        """Should remove client on disconnect."""
        ws = MockWebSocket()
        await manager.connect(ws)
        
        await manager.disconnect(ws)
        
        assert manager.connection_count == 0
        assert ws not in manager._clients
    
    @pytest.mark.asyncio
    async def test_subscribe(self, manager):
        """Should subscribe client to symbol/timeframe."""
        ws = MockWebSocket()
        await manager.connect(ws)
        
        seq = await manager.subscribe(ws, "AAPL", "1m", catchup=False)
        
        assert seq == 0
        assert ("AAPL", "1m") in manager._clients[ws].subscriptions
        assert ws in manager._subscriptions[("AAPL", "1m")]
    
    @pytest.mark.asyncio
    async def test_unsubscribe(self, manager):
        """Should unsubscribe client."""
        ws = MockWebSocket()
        await manager.connect(ws)
        await manager.subscribe(ws, "AAPL", "1m", catchup=False)
        
        await manager.unsubscribe(ws, "AAPL", "1m")
        
        assert ("AAPL", "1m") not in manager._clients[ws].subscriptions
    
    @pytest.mark.asyncio
    async def test_broadcast_bar(self, manager):
        """Should broadcast bar to subscribed clients."""
        ws1 = MockWebSocket()
        ws2 = MockWebSocket()
        ws3 = MockWebSocket()
        
        await manager.connect(ws1)
        await manager.connect(ws2)
        await manager.connect(ws3)
        
        await manager.subscribe(ws1, "AAPL", "1m", catchup=False)
        await manager.subscribe(ws2, "AAPL", "1m", catchup=False)
        # ws3 not subscribed
        
        bar = create_test_bar()
        sent_count = await manager.broadcast_bar(bar)
        
        assert sent_count == 2
        assert len(ws1.sent_messages) == 1
        assert len(ws2.sent_messages) == 1
        assert len(ws3.sent_messages) == 0
    
    @pytest.mark.asyncio
    async def test_broadcast_includes_sequence(self, manager):
        """Broadcast should include sequence number."""
        ws = MockWebSocket()
        await manager.connect(ws)
        await manager.subscribe(ws, "AAPL", "1m", catchup=False)
        
        bar = create_test_bar()
        await manager.broadcast_bar(bar)
        
        message = ws.sent_messages[0]
        assert "sequence" in message
        assert message["sequence"] == 1
        assert "timestamp" in message
        assert message["mode"] == "live"
    
    @pytest.mark.asyncio
    async def test_sequence_tracking_per_client(self, manager):
        """Client should track last received sequence."""
        ws = MockWebSocket()
        await manager.connect(ws)
        await manager.subscribe(ws, "AAPL", "1m", catchup=False)
        
        bar = create_test_bar()
        await manager.broadcast_bar(bar)
        await manager.broadcast_bar(bar)
        
        state = manager.get_client_state(ws)
        assert state.last_sequence[("AAPL", "1m")] == 2
    
    @pytest.mark.asyncio
    async def test_catchup_on_subscribe(self, manager):
        """Subscribe with catchup should send buffered messages."""
        # First, broadcast some messages
        bar = create_test_bar()
        manager._buffer.add(("AAPL", "1m"), BarMessage.from_bar(bar))
        manager._buffer.add(("AAPL", "1m"), BarMessage.from_bar(bar))
        
        ws = MockWebSocket()
        await manager.connect(ws)
        await manager.subscribe(ws, "AAPL", "1m", catchup=True)
        
        # Should have received 2 catchup messages
        catchup_msgs = [m for m in ws.sent_messages if m.get("type") == "CATCHUP"]
        assert len(catchup_msgs) == 2
    
    @pytest.mark.asyncio
    async def test_request_catchup(self, manager):
        """Client can request catchup from specific sequence."""
        ws = MockWebSocket()
        await manager.connect(ws)
        await manager.subscribe(ws, "AAPL", "1m", catchup=False)
        
        # Add messages to buffer
        bar = create_test_bar()
        for _ in range(5):
            manager._buffer.add(("AAPL", "1m"), BarMessage.from_bar(bar))
        
        # Request catchup from sequence 2
        await manager.request_catchup(ws, "AAPL", "1m", 2)
        
        catchup_msgs = [m for m in ws.sent_messages if m.get("type") == "CATCHUP"]
        assert len(catchup_msgs) == 3  # sequences 3, 4, 5
    
    @pytest.mark.asyncio
    async def test_send_personal(self, manager):
        """Should send message to specific client."""
        ws = MockWebSocket()
        await manager.connect(ws)
        
        await manager.send_personal(ws, {"type": "TEST", "data": "hello"})
        
        assert len(ws.sent_messages) == 1
        assert ws.sent_messages[0]["type"] == "TEST"
    
    @pytest.mark.asyncio
    async def test_set_delivery_mode(self, manager):
        """Should update client delivery mode."""
        ws = MockWebSocket()
        await manager.connect(ws)
        
        await manager.set_delivery_mode(ws, DeliveryMode.REPLAY, replay_position=1704067200000)
        
        state = manager.get_client_state(ws)
        assert state.delivery_mode == DeliveryMode.REPLAY
        assert state.replay_position == 1704067200000
        
        # Should have sent mode change notification
        mode_msgs = [m for m in ws.sent_messages if m.get("type") == "MODE_CHANGED"]
        assert len(mode_msgs) == 1
    
    @pytest.mark.asyncio
    async def test_start_stop(self, manager):
        """Should start and stop manager."""
        await manager.start()
        assert manager._running
        
        await manager.stop()
        assert not manager._running
    
    @pytest.mark.asyncio
    async def test_get_stats(self, manager):
        """Should return statistics."""
        ws = MockWebSocket()
        await manager.connect(ws)
        await manager.subscribe(ws, "AAPL", "1m", catchup=False)
        await manager.subscribe(ws, "MSFT", "1m", catchup=False)
        
        stats = manager.get_stats()
        
        assert stats["connections"] == 1
        assert stats["subscriptions"] == 2
    
    @pytest.mark.asyncio
    async def test_disconnect_cleans_subscriptions(self, manager):
        """Disconnect should clean up subscriptions."""
        ws = MockWebSocket()
        await manager.connect(ws)
        await manager.subscribe(ws, "AAPL", "1m", catchup=False)
        
        await manager.disconnect(ws)
        
        assert ("AAPL", "1m") not in manager._subscriptions or \
               ws not in manager._subscriptions[("AAPL", "1m")]


class TestDeliveryMode:
    """Tests for delivery modes."""
    
    @pytest.mark.asyncio
    async def test_live_mode_delivery(self):
        """Live mode should use LIVE delivery."""
        manager = EnhancedConnectionManager()
        ws = MockWebSocket()
        await manager.connect(ws)
        await manager.subscribe(ws, "AAPL", "1m", catchup=False)
        
        bar = create_test_bar()
        await manager.broadcast_bar(bar, DeliveryMode.LIVE)
        
        assert ws.sent_messages[0]["mode"] == "live"
    
    @pytest.mark.asyncio
    async def test_replay_mode_delivery(self):
        """Replay mode should use REPLAY delivery."""
        manager = EnhancedConnectionManager()
        ws = MockWebSocket()
        await manager.connect(ws)
        await manager.subscribe(ws, "AAPL", "1m", catchup=False)
        
        bar = create_test_bar()
        await manager.broadcast_bar(bar, DeliveryMode.REPLAY)
        
        assert ws.sent_messages[0]["mode"] == "replay"


class TestGlobalManager:
    """Tests for global manager functions."""
    
    def test_get_enhanced_manager(self):
        """Should return global manager."""
        manager = get_enhanced_manager()
        assert manager is not None
        assert isinstance(manager, EnhancedConnectionManager)
    
    def test_set_enhanced_manager(self):
        """Should set global manager."""
        custom = EnhancedConnectionManager(buffer_size=50)
        set_enhanced_manager(custom)
        
        retrieved = get_enhanced_manager()
        assert retrieved is custom


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
