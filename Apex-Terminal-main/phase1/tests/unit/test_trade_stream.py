"""
Unit tests for Trade Stream WebSocket

Tests:
- TradeUpdateType enum
- TradeUpdate dataclass
- AlpacaTradeStream
- TradeUpdateHandler
"""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from services.autopilot.trade_stream import (
    TradeUpdateType,
    TradeUpdate,
    AlpacaTradeStream,
    TradeUpdateHandler,
    get_trade_handler,
)


class TestTradeUpdateType:
    """Test TradeUpdateType enum."""
    
    def test_update_types(self):
        """Verify all update types exist."""
        assert TradeUpdateType.NEW.value == "new"
        assert TradeUpdateType.FILL.value == "fill"
        assert TradeUpdateType.PARTIAL_FILL.value == "partial_fill"
        assert TradeUpdateType.CANCELED.value == "canceled"
        assert TradeUpdateType.REJECTED.value == "rejected"
        assert TradeUpdateType.EXPIRED.value == "expired"
        assert TradeUpdateType.PENDING_NEW.value == "pending_new"
        assert TradeUpdateType.ACCEPTED.value == "accepted"


class TestTradeUpdate:
    """Test TradeUpdate dataclass."""
    
    def test_trade_update_creation(self):
        """Create trade update."""
        update = TradeUpdate(
            event_type=TradeUpdateType.FILL,
            timestamp=datetime.utcnow(),
            order_id="order123",
            client_order_id="AP-2025-001",
            symbol="AAPL",
            side="buy",
            qty=100.0,
            filled_qty=100.0,
            avg_fill_price=185.50,
            order_type="market",
            time_in_force="day",
            status="filled",
        )
        
        assert update.event_type == TradeUpdateType.FILL
        assert update.symbol == "AAPL"
        assert update.filled_qty == 100.0
        assert update.avg_fill_price == 185.50
    
    def test_trade_update_to_dict(self):
        """Test serialization."""
        now = datetime.utcnow()
        update = TradeUpdate(
            event_type=TradeUpdateType.CANCELED,
            timestamp=now,
            order_id="order456",
            client_order_id="AP-2025-002",
            symbol="TSLA",
            side="sell",
            qty=50.0,
            filled_qty=0.0,
            avg_fill_price=None,
            order_type="limit",
            time_in_force="gtc",
            status="canceled",
        )
        
        data = update.to_dict()
        assert data["event_type"] == "canceled"
        assert data["symbol"] == "TSLA"
        assert data["filled_qty"] == 0.0
        assert data["avg_fill_price"] is None


class TestAlpacaTradeStream:
    """Test AlpacaTradeStream class."""
    
    def test_stream_initialization(self):
        """Initialize trade stream."""
        stream = AlpacaTradeStream(
            api_key="test_key",
            api_secret="test_secret",
        )
        
        assert stream._api_key == "test_key"
        assert stream._api_secret == "test_secret"
        assert stream._connected is False
        assert stream._authenticated is False
    
    def test_stream_not_connected_initially(self):
        """Stream not connected on init."""
        stream = AlpacaTradeStream()
        assert stream.is_connected is False
    
    def test_stream_last_update_none_initially(self):
        """No last update initially."""
        stream = AlpacaTradeStream()
        assert stream.last_update is None
    
    def test_get_recent_updates_empty(self):
        """Empty updates list initially."""
        stream = AlpacaTradeStream()
        updates = stream.get_recent_updates()
        assert updates == []
    
    def test_get_updates_for_order_empty(self):
        """No updates for non-existent order."""
        stream = AlpacaTradeStream()
        updates = stream.get_updates_for_order("nonexistent")
        assert updates == []
    
    def test_get_updates_for_symbol_empty(self):
        """No updates for symbol initially."""
        stream = AlpacaTradeStream()
        updates = stream.get_updates_for_symbol("AAPL")
        assert updates == []


class TestTradeUpdateHandler:
    """Test TradeUpdateHandler class."""
    
    def test_handler_initialization(self):
        """Initialize handler."""
        handler = TradeUpdateHandler()
        
        assert handler._stream is None
        assert handler._on_fill is None
        assert handler._on_cancel is None
        assert handler._on_reject is None
    
    def test_handler_not_connected_initially(self):
        """Handler not connected on init."""
        handler = TradeUpdateHandler()
        assert handler.is_connected is False
    
    def test_handler_no_last_update_initially(self):
        """No last update on init."""
        handler = TradeUpdateHandler()
        assert handler.last_update is None
    
    def test_set_callbacks(self):
        """Set callback functions."""
        handler = TradeUpdateHandler()
        
        on_fill = MagicMock()
        on_cancel = MagicMock()
        on_reject = MagicMock()
        on_any = MagicMock()
        
        handler.set_callbacks(
            on_fill=on_fill,
            on_cancel=on_cancel,
            on_reject=on_reject,
            on_any=on_any,
        )
        
        assert handler._on_fill is on_fill
        assert handler._on_cancel is on_cancel
        assert handler._on_reject is on_reject
        assert handler._on_any is on_any
    
    def test_handle_fill_update(self):
        """Test fill update dispatches to callback."""
        handler = TradeUpdateHandler()
        
        on_fill = MagicMock()
        handler.set_callbacks(on_fill=on_fill)
        
        update = TradeUpdate(
            event_type=TradeUpdateType.FILL,
            timestamp=datetime.utcnow(),
            order_id="order123",
            client_order_id=None,
            symbol="AAPL",
            side="buy",
            qty=100.0,
            filled_qty=100.0,
            avg_fill_price=185.00,
            order_type="market",
            time_in_force="day",
            status="filled",
        )
        
        handler._handle_update(update)
        on_fill.assert_called_once_with(update)
    
    def test_handle_cancel_update(self):
        """Test cancel update dispatches to callback."""
        handler = TradeUpdateHandler()
        
        on_cancel = MagicMock()
        handler.set_callbacks(on_cancel=on_cancel)
        
        update = TradeUpdate(
            event_type=TradeUpdateType.CANCELED,
            timestamp=datetime.utcnow(),
            order_id="order456",
            client_order_id=None,
            symbol="TSLA",
            side="sell",
            qty=50.0,
            filled_qty=0.0,
            avg_fill_price=None,
            order_type="limit",
            time_in_force="gtc",
            status="canceled",
        )
        
        handler._handle_update(update)
        on_cancel.assert_called_once_with(update)
    
    def test_handle_reject_update(self):
        """Test reject update dispatches to callback."""
        handler = TradeUpdateHandler()
        
        on_reject = MagicMock()
        handler.set_callbacks(on_reject=on_reject)
        
        update = TradeUpdate(
            event_type=TradeUpdateType.REJECTED,
            timestamp=datetime.utcnow(),
            order_id="order789",
            client_order_id=None,
            symbol="NVDA",
            side="buy",
            qty=100.0,
            filled_qty=0.0,
            avg_fill_price=None,
            order_type="market",
            time_in_force="day",
            status="rejected",
        )
        
        handler._handle_update(update)
        on_reject.assert_called_once_with(update)
    
    def test_handle_any_update(self):
        """Test any update calls on_any callback."""
        handler = TradeUpdateHandler()
        
        on_any = MagicMock()
        handler.set_callbacks(on_any=on_any)
        
        update = TradeUpdate(
            event_type=TradeUpdateType.NEW,
            timestamp=datetime.utcnow(),
            order_id="order000",
            client_order_id=None,
            symbol="SPY",
            side="buy",
            qty=200.0,
            filled_qty=0.0,
            avg_fill_price=None,
            order_type="limit",
            time_in_force="day",
            status="new",
        )
        
        handler._handle_update(update)
        on_any.assert_called_once_with(update)


class TestGetTradeHandler:
    """Test global trade handler getter."""
    
    def test_get_trade_handler_creates_instance(self):
        """Getter creates handler instance."""
        # Reset global for test
        import services.autopilot.trade_stream as ts
        ts._trade_handler = None
        
        handler = get_trade_handler()
        assert handler is not None
        assert isinstance(handler, TradeUpdateHandler)
    
    def test_get_trade_handler_returns_same_instance(self):
        """Getter returns same instance."""
        handler1 = get_trade_handler()
        handler2 = get_trade_handler()
        assert handler1 is handler2
