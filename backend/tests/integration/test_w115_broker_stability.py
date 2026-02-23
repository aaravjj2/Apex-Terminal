"""
Wave 115 — Broker sync monitor pytest tests.

Covers:
  - GET /api/v3/ops/broker → 200, required fields
  - SLO: connected=true, latency_ms < 5000, trading_blocked=false
"""
from __future__ import annotations

import requests

BASE = "http://localhost:8090"


class TestW115BrokerHealth:
    def test_broker_endpoint_200(self):
        r = requests.get(f"{BASE}/api/v3/ops/broker", timeout=10)
        assert r.status_code == 200

    def test_broker_has_connected(self):
        j = requests.get(f"{BASE}/api/v3/ops/broker", timeout=10).json()
        assert "connected" in j

    def test_broker_has_latency_ms(self):
        j = requests.get(f"{BASE}/api/v3/ops/broker", timeout=10).json()
        assert "latency_ms" in j

    def test_broker_has_trading_blocked(self):
        j = requests.get(f"{BASE}/api/v3/ops/broker", timeout=10).json()
        assert "trading_blocked" in j

    def test_slo_connected_true(self):
        j = requests.get(f"{BASE}/api/v3/ops/broker", timeout=10).json()
        assert j["connected"] is True

    def test_slo_latency_ms_under_5000(self):
        j = requests.get(f"{BASE}/api/v3/ops/broker", timeout=10).json()
        assert j["latency_ms"] < 5000

    def test_slo_trading_blocked_false(self):
        j = requests.get(f"{BASE}/api/v3/ops/broker", timeout=10).json()
        assert j["trading_blocked"] is False

    def test_account_number_present(self):
        j = requests.get(f"{BASE}/api/v3/ops/broker", timeout=10).json()
        assert isinstance(j.get("account_number", ""), str)
        assert len(j.get("account_number", "")) > 0

    def test_account_status_present(self):
        j = requests.get(f"{BASE}/api/v3/ops/broker", timeout=10).json()
        assert "account_status" in j

    def test_cash_is_positive(self):
        j = requests.get(f"{BASE}/api/v3/ops/broker", timeout=10).json()
        assert isinstance(j.get("cash", 0), (int, float))
        assert j.get("cash", 0) > 0

    def test_stable_across_two_polls(self):
        j1 = requests.get(f"{BASE}/api/v3/ops/broker", timeout=10).json()
        j2 = requests.get(f"{BASE}/api/v3/ops/broker", timeout=10).json()
        assert j1["connected"] is True
        assert j2["connected"] is True
        assert j2["trading_blocked"] is False
