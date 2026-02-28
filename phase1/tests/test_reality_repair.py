"""
Reality Repair — Endpoint Schema Tests.

Tests the new ops endpoints: version, market_session, broker health,
and the JSON error middleware. All tests are unit-style (FastAPI TestClient).
"""
import sys
from pathlib import Path

import pytest

_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_root))

from fastapi.testclient import TestClient
from services.api.main import app

client = TestClient(app)


# ═════════════════════════════════════════════════════════════════════
# 1. Version Endpoint
# ═════════════════════════════════════════════════════════════════════

class TestVersionEndpoint:
    """GET /api/ops/version returns build metadata."""

    def test_version_returns_200(self):
        r = client.get("/api/ops/version")
        assert r.status_code == 200

    def test_version_schema(self):
        r = client.get("/api/ops/version")
        body = r.json()
        assert "git_sha" in body
        assert "build_time" in body
        assert "api_version" in body
        assert "active_port" in body
        assert isinstance(body["git_sha"], str)
        assert isinstance(body["api_version"], str)

    def test_version_git_sha_not_empty(self):
        r = client.get("/api/ops/version")
        body = r.json()
        # Should be a real sha or "unknown"
        assert len(body["git_sha"]) > 0


# ═════════════════════════════════════════════════════════════════════
# 2. Market Session Endpoint
# ═════════════════════════════════════════════════════════════════════

class TestMarketSessionEndpoint:
    """GET /api/ops/market_session returns NYSE session info."""

    def test_market_session_returns_200(self):
        r = client.get("/api/ops/market_session")
        assert r.status_code == 200

    def test_market_session_schema(self):
        r = client.get("/api/ops/market_session")
        body = r.json()
        assert "is_open_now" in body
        assert "session" in body
        assert "next_open" in body
        assert "next_close" in body
        assert "timezone" in body
        assert "computed_at" in body

    def test_market_session_valid_values(self):
        r = client.get("/api/ops/market_session")
        body = r.json()
        assert isinstance(body["is_open_now"], bool)
        assert body["session"] in ("closed", "pre", "regular", "post")
        assert body["timezone"] == "America/New_York"

    def test_market_session_computed_at_is_iso(self):
        r = client.get("/api/ops/market_session")
        body = r.json()
        from datetime import datetime
        # Should parse as ISO datetime
        dt = datetime.fromisoformat(body["computed_at"])
        assert dt.year >= 2025


# ═════════════════════════════════════════════════════════════════════
# 3. Broker Health
# ═════════════════════════════════════════════════════════════════════

class TestBrokerHealth:
    """GET /api/broker/health returns Alpaca connectivity status."""

    def test_broker_health_returns_json(self):
        r = client.get("/api/broker/health")
        ct = r.headers.get("content-type", "")
        assert "application/json" in ct

    def test_broker_health_schema(self):
        r = client.get("/api/broker/health")
        body = r.json()
        assert "ok" in body
        if r.status_code == 200:
            assert body["ok"] is True


# ═════════════════════════════════════════════════════════════════════
# 4. JSON Error Middleware
# ═════════════════════════════════════════════════════════════════════

class TestJsonErrorMiddleware:
    """All error responses must be valid JSON with standard schema."""

    def test_404_returns_json(self):
        r = client.get("/api/this-does-not-exist-xyz")
        assert r.status_code == 404
        ct = r.headers.get("content-type", "")
        assert "application/json" in ct

    def test_404_has_error_schema(self):
        r = client.get("/api/this-does-not-exist-xyz")
        body = r.json()
        # FastAPI default 404 returns {"detail": "Not Found"}
        assert "detail" in body or body.get("ok") is False

    def test_correlation_id_in_header(self):
        r = client.get("/api/this-does-not-exist-xyz")
        cid = r.headers.get("x-correlation-id")
        assert cid is not None
        assert len(cid) > 0

    def test_correlation_ids_are_unique(self):
        r1 = client.get("/api/this-does-not-exist-1")
        r2 = client.get("/api/this-does-not-exist-2")
        cid1 = r1.headers.get("x-correlation-id")
        cid2 = r2.headers.get("x-correlation-id")
        assert cid1 != cid2

    def test_health_has_correlation_id(self):
        r = client.get("/health")
        cid = r.headers.get("x-correlation-id")
        assert cid is not None


# ═════════════════════════════════════════════════════════════════════
# 5. No Demo/Mock in API Responses
# ═════════════════════════════════════════════════════════════════════

class TestNoDemo:
    """Ensure no demo/mock markers leak through API."""

    def test_version_no_demo(self):
        r = client.get("/api/ops/version")
        text = r.text.lower()
        assert "demo" not in text

    def test_market_session_no_demo(self):
        r = client.get("/api/ops/market_session")
        text = r.text.lower()
        assert "demo" not in text
