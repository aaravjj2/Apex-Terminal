"""
Unit tests for E2E Test Harness.

Tests cover:
- Server management
- WebSocket recording
- Visual verification
- Test runner
"""

import pytest
import json
import time
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import sys
sys.path.insert(0, '/home/aarav/Aarav/Tradingview recreation/phase1')

from tests.e2e.harness import (
    ServerConfig,
    E2ETestContext,
    ServerManager,
    WebSocketRecorder,
    VisualVerifier,
    E2ETestResult,
    E2ETestRunner,
)


class TestServerConfig:
    """Tests for ServerConfig."""
    
    def test_defaults(self):
        """Should have sensible defaults."""
        config = ServerConfig()
        
        assert config.host == "127.0.0.1"
        assert config.port == 8765
        assert config.startup_timeout == 10.0
    
    def test_custom_values(self):
        """Should accept custom values."""
        config = ServerConfig(host="0.0.0.0", port=9000)
        
        assert config.host == "0.0.0.0"
        assert config.port == 9000


class TestE2ETestContextClass:
    """Tests for E2ETestContext."""
    
    def test_create(self):
        """Should create context."""
        ctx = E2ETestContext(
            server_url="http://localhost:8765",
            ws_url="ws://localhost:8765/ws",
            page=MagicMock(),
            context=MagicMock(),
        )
        
        assert ctx.server_url == "http://localhost:8765"
        assert ctx.messages == []


class TestServerManager:
    """Tests for ServerManager."""
    
    def test_get_url(self):
        """Should return correct URL."""
        config = ServerConfig(host="localhost", port=8080)
        manager = ServerManager(config)
        
        assert manager.get_url() == "http://localhost:8080"
    
    def test_get_ws_url(self):
        """Should return correct WebSocket URL."""
        config = ServerConfig(host="localhost", port=8080)
        manager = ServerManager(config)
        
        assert manager.get_ws_url() == "ws://localhost:8080/ws"
    
    def test_is_running_false_initially(self):
        """Should not be running initially."""
        manager = ServerManager()
        
        assert not manager.is_running


class TestWebSocketRecorder:
    """Tests for WebSocketRecorder."""
    
    def test_start_clears(self):
        """Start should clear previous messages."""
        recorder = WebSocketRecorder()
        recorder.record('{"type": "test"}')
        
        recorder.start()
        
        assert recorder.message_count == 0
    
    def test_record_json(self):
        """Should record JSON messages."""
        recorder = WebSocketRecorder()
        recorder.start()
        
        recorder.record('{"type": "bar", "data": 123}')
        
        assert recorder.message_count == 1
        messages = recorder.get_messages()
        assert messages[0]["type"] == "bar"
    
    def test_record_invalid_json(self):
        """Should handle invalid JSON."""
        recorder = WebSocketRecorder()
        recorder.start()
        
        recorder.record("not json")
        
        assert recorder.message_count == 1
        messages = recorder.get_messages()
        assert messages[0]["_raw"] == "not json"
    
    def test_filter_by_type(self):
        """Should filter messages by type."""
        recorder = WebSocketRecorder()
        recorder.start()
        
        recorder.record('{"type": "bar"}')
        recorder.record('{"type": "tick"}')
        recorder.record('{"type": "bar"}')
        
        bars = recorder.get_messages(msg_type="bar")
        
        assert len(bars) == 2
    
    def test_get_raw_messages(self):
        """Should return raw messages."""
        recorder = WebSocketRecorder()
        recorder.start()
        
        recorder.record('{"type": "test"}')
        
        raw = recorder.get_raw_messages()
        
        assert raw == ['{"type": "test"}']
    
    def test_compute_hash(self):
        """Should compute hash."""
        recorder = WebSocketRecorder()
        recorder.start()
        
        recorder.record('{"a": 1}')
        recorder.record('{"b": 2}')
        
        hash_value = recorder.compute_hash()
        
        assert isinstance(hash_value, str)
        assert len(hash_value) == 64
    
    def test_same_messages_same_hash(self):
        """Same messages should produce same hash."""
        recorder1 = WebSocketRecorder()
        recorder1.start()
        recorder1.record('{"a": 1}')
        
        recorder2 = WebSocketRecorder()
        recorder2.start()
        recorder2.record('{"a": 1}')
        
        assert recorder1.compute_hash() == recorder2.compute_hash()


class TestVisualVerifier:
    """Tests for VisualVerifier."""
    
    @pytest.mark.asyncio
    async def test_element_exists(self):
        """Should check element existence."""
        page = AsyncMock()
        page.query_selector.return_value = MagicMock()
        
        verifier = VisualVerifier(page)
        
        result = await verifier.element_exists("#test")
        
        assert result is True
        page.query_selector.assert_called_with("#test")
    
    @pytest.mark.asyncio
    async def test_element_not_exists(self):
        """Should return False for missing element."""
        page = AsyncMock()
        page.query_selector.return_value = None
        
        verifier = VisualVerifier(page)
        
        result = await verifier.element_exists("#missing")
        
        assert result is False
    
    @pytest.mark.asyncio
    async def test_element_visible(self):
        """Should check element visibility."""
        element = AsyncMock()
        element.is_visible.return_value = True
        
        page = AsyncMock()
        page.query_selector.return_value = element
        
        verifier = VisualVerifier(page)
        
        result = await verifier.element_visible("#test")
        
        assert result is True
    
    @pytest.mark.asyncio
    async def test_element_text(self):
        """Should get element text."""
        element = AsyncMock()
        element.text_content.return_value = "Hello World"
        
        page = AsyncMock()
        page.query_selector.return_value = element
        
        verifier = VisualVerifier(page)
        
        result = await verifier.element_text("#test")
        
        assert result == "Hello World"


class TestE2ETestResult:
    """Tests for E2ETestResult."""
    
    def test_to_dict(self):
        """Should convert to dictionary."""
        result = E2ETestResult(
            name="test_example",
            passed=True,
            duration_ms=100.5,
        )
        
        d = result.to_dict()
        
        assert d["name"] == "test_example"
        assert d["passed"] is True
        assert d["duration_ms"] == 100.5
    
    def test_with_error(self):
        """Should include error in dict."""
        result = E2ETestResult(
            name="test_fail",
            passed=False,
            duration_ms=50.0,
            error="AssertionError: expected True",
        )
        
        d = result.to_dict()
        
        assert d["error"] == "AssertionError: expected True"


class TestE2ETestRunner:
    """Tests for E2ETestRunner."""
    
    @pytest.mark.asyncio
    async def test_run_passing_test(self):
        """Should run passing test."""
        runner = E2ETestRunner()
        
        async def passing_test(ctx):
            assert True
        
        ctx = E2ETestContext(
            server_url="http://localhost",
            ws_url="ws://localhost/ws",
            page=AsyncMock(),
            context=AsyncMock(),
        )
        
        result = await runner.run_test("test_pass", passing_test, ctx)
        
        assert result.passed is True
        assert result.error is None
    
    @pytest.mark.asyncio
    async def test_run_failing_test(self):
        """Should capture failing test."""
        runner = E2ETestRunner()
        
        async def failing_test(ctx):
            raise AssertionError("Test failed")
        
        page = AsyncMock()
        ctx = E2ETestContext(
            server_url="http://localhost",
            ws_url="ws://localhost/ws",
            page=page,
            context=AsyncMock(),
        )
        
        result = await runner.run_test("test_fail", failing_test, ctx)
        
        assert result.passed is False
        assert "Test failed" in result.error
    
    def test_get_summary(self):
        """Should compute summary."""
        runner = E2ETestRunner()
        
        runner._results = [
            E2ETestResult("t1", True, 100),
            E2ETestResult("t2", True, 150),
            E2ETestResult("t3", False, 50, "error"),
        ]
        
        summary = runner.get_summary()
        
        assert summary["total"] == 3
        assert summary["passed"] == 2
        assert summary["failed"] == 1
        assert summary["pass_rate"] == pytest.approx(2/3)
    
    def test_write_report(self, tmp_path):
        """Should write JSON report."""
        runner = E2ETestRunner(output_dir=tmp_path)
        
        runner._results = [
            E2ETestResult("test1", True, 100),
        ]
        
        runner.write_report()
        
        report_path = tmp_path / "report.json"
        assert report_path.exists()
        
        with open(report_path) as f:
            report = json.load(f)
        
        assert report["summary"]["total"] == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
