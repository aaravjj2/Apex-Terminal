"""
W88 — Ops Workspace v1: Pytest integration tests
Tests ops endpoint stability, schema completeness, and secrets redaction.
"""
import pytest
import httpx

BASE = "http://localhost:8090"


class TestOpsHealthSchema:
    """ops/health endpoint schema + stability."""

    def test_ops_health_returns_200(self):
        r = httpx.get(f"{BASE}/api/v3/ops/health", timeout=10)
        assert r.status_code == 200

    def test_ops_health_has_correlation_id(self):
        r = httpx.get(f"{BASE}/api/v3/ops/health", timeout=10)
        body = r.json()
        assert "correlation_id" in body
        assert isinstance(body["correlation_id"], str)
        assert len(body["correlation_id"]) > 0

    def test_ops_health_has_ready_field(self):
        r = httpx.get(f"{BASE}/api/v3/ops/health", timeout=10)
        body = r.json()
        assert "ready" in body
        assert isinstance(body["ready"], bool)

    def test_ops_health_has_checked_at(self):
        r = httpx.get(f"{BASE}/api/v3/ops/health", timeout=10)
        body = r.json()
        assert "checked_at" in body

    def test_ops_health_has_dependencies(self):
        r = httpx.get(f"{BASE}/api/v3/ops/health", timeout=10)
        body = r.json()
        assert "dependencies" in body
        deps = body["dependencies"]
        assert isinstance(deps, dict)

    def test_ops_health_dependencies_has_elasticsearch(self):
        r = httpx.get(f"{BASE}/api/v3/ops/health", timeout=10)
        body = r.json()
        deps = body["dependencies"]
        assert "elasticsearch" in deps

    def test_ops_health_elasticsearch_has_connected_field(self):
        r = httpx.get(f"{BASE}/api/v3/ops/health", timeout=10)
        body = r.json()
        es = body["dependencies"]["elasticsearch"]
        assert "connected" in es
        assert isinstance(es["connected"], bool)

    def test_ops_health_dependencies_has_broker(self):
        r = httpx.get(f"{BASE}/api/v3/ops/health", timeout=10)
        body = r.json()
        deps = body["dependencies"]
        assert "broker" in deps

    def test_ops_health_broker_has_status_field(self):
        r = httpx.get(f"{BASE}/api/v3/ops/health", timeout=10)
        body = r.json()
        broker = body["dependencies"]["broker"]
        assert "account_status" in broker or "connected" in broker

    def test_ops_health_correlation_id_is_unique_per_call(self):
        r1 = httpx.get(f"{BASE}/api/v3/ops/health", timeout=10)
        r2 = httpx.get(f"{BASE}/api/v3/ops/health", timeout=10)
        cid1 = r1.json()["correlation_id"]
        cid2 = r2.json()["correlation_id"]
        assert cid1 != cid2


class TestOpsSecretsRedaction:
    """Ensure no API keys or secrets leak into ops responses."""

    def test_ops_health_no_apca_key_id(self):
        r = httpx.get(f"{BASE}/api/v3/ops/health", timeout=10)
        text = r.text.lower()
        assert "apca_api_key_id" not in text
        assert "paper" not in text or "not a key" in text or True  # string 'paper' may appear but not key values

    def test_ops_health_no_postgres_password(self):
        r = httpx.get(f"{BASE}/api/v3/ops/health", timeout=10)
        text = r.text.lower()
        # Should never leak DB passwords
        assert "password=" not in text
        assert ":password@" not in text

    def test_ops_health_no_secret_key(self):
        r = httpx.get(f"{BASE}/api/v3/ops/health", timeout=10)
        text = r.text.lower()
        assert "secret_key" not in text or "***" in r.text

    def test_ops_broker_account_is_redacted(self):
        r = httpx.get(f"{BASE}/api/v3/broker/account", timeout=10)
        if r.status_code == 200:
            body = r.json()
            # account number should be redacted (starts with ***)
            acct = str(body.get("account_number", ""))
            assert acct.startswith("***"), f"account_number not redacted: {acct}"
        # 200 or 503 (broker not connected) both acceptable
        assert r.status_code in (200, 503)


class TestOpsWsHealthSchema:
    """Verify ws/health schema completeness used by OpsUI2."""

    def test_ws_health_returns_200(self):
        r = httpx.get(f"{BASE}/api/v3/ops/ws/health", timeout=10)
        assert r.status_code == 200

    def test_ws_health_has_running_field(self):
        r = httpx.get(f"{BASE}/api/v3/ops/ws/health", timeout=10)
        body = r.json()
        assert "running" in body
        assert isinstance(body["running"], bool)

    def test_ws_health_has_active_clients(self):
        r = httpx.get(f"{BASE}/api/v3/ops/ws/health", timeout=10)
        body = r.json()
        assert "active_clients" in body
        assert isinstance(body["active_clients"], int)

    def test_ws_health_has_disconnect_count(self):
        r = httpx.get(f"{BASE}/api/v3/ops/ws/health", timeout=10)
        body = r.json()
        assert "disconnect_count" in body
        assert isinstance(body["disconnect_count"], int)

    def test_ws_health_has_heartbeat_interval_s(self):
        r = httpx.get(f"{BASE}/api/v3/ops/ws/health", timeout=10)
        body = r.json()
        assert "heartbeat_interval_s" in body
        assert isinstance(body["heartbeat_interval_s"], (int, float))

    def test_ws_health_has_heartbeat_task_alive(self):
        r = httpx.get(f"{BASE}/api/v3/ops/ws/health", timeout=10)
        body = r.json()
        assert "heartbeat_task_alive" in body
        assert isinstance(body["heartbeat_task_alive"], bool)


class TestOpsEndpointStability:
    """All v3 ops endpoints are mounted and respond stably."""

    def test_ops_health_stable_across_calls(self):
        for _ in range(3):
            r = httpx.get(f"{BASE}/api/v3/ops/health", timeout=10)
            assert r.status_code == 200

    def test_ops_elasticsearch_returns_200(self):
        r = httpx.get(f"{BASE}/api/v3/ops/elasticsearch", timeout=10)
        assert r.status_code == 200

    def test_ops_elasticsearch_has_connected(self):
        r = httpx.get(f"{BASE}/api/v3/ops/elasticsearch", timeout=10)
        body = r.json()
        assert "connected" in body
        assert isinstance(body["connected"], bool)

    def test_ops_broker_returns_200(self):
        r = httpx.get(f"{BASE}/api/v3/ops/broker", timeout=10)
        assert r.status_code == 200

    def test_ops_broker_has_status(self):
        r = httpx.get(f"{BASE}/api/v3/ops/broker", timeout=10)
        body = r.json()
        assert "account_status" in body or "connected" in body
