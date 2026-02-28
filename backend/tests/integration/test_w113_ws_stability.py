"""
Wave 113 — WS stability monitor pytest tests.

Covers:
  - GET /api/v3/ops/ws/health → 200, required fields
  - SLO: running=true, heartbeat_task_alive=true, disconnect_count stable,
         last_heartbeat_age_s < 60
"""
from __future__ import annotations

import requests

BASE = "http://localhost:8090"


class TestW113WSHealth:
    def test_ws_health_200(self):
        r = requests.get(f"{BASE}/api/v3/ops/ws/health", timeout=10)
        assert r.status_code == 200

    def test_ws_health_has_running(self):
        j = requests.get(f"{BASE}/api/v3/ops/ws/health", timeout=10).json()
        assert "running" in j

    def test_ws_health_has_disconnect_count(self):
        j = requests.get(f"{BASE}/api/v3/ops/ws/health", timeout=10).json()
        assert "disconnect_count" in j

    def test_ws_health_has_heartbeat_task_alive(self):
        j = requests.get(f"{BASE}/api/v3/ops/ws/health", timeout=10).json()
        assert "heartbeat_task_alive" in j

    def test_ws_health_has_last_heartbeat_age_s(self):
        j = requests.get(f"{BASE}/api/v3/ops/ws/health", timeout=10).json()
        assert "last_heartbeat_age_s" in j

    def test_slo_running_true(self):
        j = requests.get(f"{BASE}/api/v3/ops/ws/health", timeout=10).json()
        assert j["running"] is True

    def test_slo_heartbeat_task_alive(self):
        j = requests.get(f"{BASE}/api/v3/ops/ws/health", timeout=10).json()
        assert j["heartbeat_task_alive"] is True

    def test_slo_last_heartbeat_age_s_under_60(self):
        j = requests.get(f"{BASE}/api/v3/ops/ws/health", timeout=10).json()
        assert j["last_heartbeat_age_s"] < 60

    def test_slo_disconnect_count_non_negative(self):
        j = requests.get(f"{BASE}/api/v3/ops/ws/health", timeout=10).json()
        assert isinstance(j["disconnect_count"], int)
        assert j["disconnect_count"] >= 0

    def test_slo_disconnect_count_stable_across_polls(self):
        j1 = requests.get(f"{BASE}/api/v3/ops/ws/health", timeout=10).json()
        j2 = requests.get(f"{BASE}/api/v3/ops/ws/health", timeout=10).json()
        assert j2["disconnect_count"] <= j1["disconnect_count"]

    def test_heartbeat_interval_s_positive(self):
        j = requests.get(f"{BASE}/api/v3/ops/ws/health", timeout=10).json()
        assert j.get("heartbeat_interval_s", 0) > 0

    def test_active_clients_non_negative(self):
        j = requests.get(f"{BASE}/api/v3/ops/ws/health", timeout=10).json()
        assert isinstance(j.get("active_clients", 0), int)
        assert j.get("active_clients", 0) >= 0
