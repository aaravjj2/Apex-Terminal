"""
Wave 129 — Incident drills / resilience.

Verifies:
  - Monitoring endpoints exist and return structured data
  - WS disconnect_count is accessible (for simulated incident detection)
  - ES connected flag is accessible
  - Reset-all produces a structured response
"""
from __future__ import annotations

import os

import requests

WORKSPACE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
BASE = "http://localhost:8090"


class TestW129Incident:
    def test_ws_health_disconnect_count(self):
        r = requests.get(f"{BASE}/api/v3/ops/ws/health", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "disconnect_count" in data

    def test_ws_health_running_flag(self):
        r = requests.get(f"{BASE}/api/v3/ops/ws/health", timeout=10)
        data = r.json()
        assert "running" in data

    def test_es_health_connected_flag(self):
        r = requests.get(f"{BASE}/api/v3/ops/elasticsearch", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "connected" in data

    def test_es_health_latency_present(self):
        r = requests.get(f"{BASE}/api/v3/ops/elasticsearch", timeout=10)
        data = r.json()
        assert "latency_ms" in data

    def test_broker_health_connected_flag(self):
        r = requests.get(f"{BASE}/api/v3/ops/broker", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "connected" in data

    def test_broker_health_trading_blocked(self):
        r = requests.get(f"{BASE}/api/v3/ops/broker", timeout=10)
        data = r.json()
        assert "trading_blocked" in data

    def test_reset_produces_structured_response(self):
        r = requests.post(f"{BASE}/api/v3/ops/reset-all", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "status" in data
        assert data["status"] == "ok"

    def test_reset_version_format(self):
        r = requests.get(f"{BASE}/api/v3/ops/reset/version", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data.get("version", "").startswith("w")

    def test_w129_spec_exists(self):
        spec = os.path.join(
            WORKSPACE, "frontend", "tests", "e2e", "hardening", "w129-incident-drills.spec.ts"
        )
        assert os.path.isfile(spec)
