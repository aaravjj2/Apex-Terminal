"""
Wave 114 — ES health + lag monitor pytest tests.

Covers:
  - docs/ops/SLO.md file exists and contains ES thresholds
  - GET /api/v3/ops/elasticsearch → 200, required fields
  - SLO: connected=true, cluster_status != red, latency_ms < 2000, node_count >= 1
"""
from __future__ import annotations

import os

import requests

BASE = "http://localhost:8090"
WORKSPACE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)


class TestW114SLODoc:
    def test_slo_md_exists(self):
        slo_path = os.path.join(WORKSPACE, "docs", "ops", "SLO.md")
        assert os.path.exists(slo_path), f"Missing: {slo_path}"

    def test_slo_md_contains_elasticsearch(self):
        slo_path = os.path.join(WORKSPACE, "docs", "ops", "SLO.md")
        content = open(slo_path).read()
        assert "Elasticsearch" in content or "elasticsearch" in content

    def test_slo_md_contains_latency_threshold(self):
        slo_path = os.path.join(WORKSPACE, "docs", "ops", "SLO.md")
        content = open(slo_path).read()
        assert "2000" in content  # 2000ms ES latency threshold


class TestW114ESHealth:
    def test_elasticsearch_endpoint_200(self):
        r = requests.get(f"{BASE}/api/v3/ops/elasticsearch", timeout=10)
        assert r.status_code == 200

    def test_elasticsearch_has_connected(self):
        j = requests.get(f"{BASE}/api/v3/ops/elasticsearch", timeout=10).json()
        assert "connected" in j

    def test_elasticsearch_has_cluster_status(self):
        j = requests.get(f"{BASE}/api/v3/ops/elasticsearch", timeout=10).json()
        assert "cluster_status" in j

    def test_elasticsearch_has_latency_ms(self):
        j = requests.get(f"{BASE}/api/v3/ops/elasticsearch", timeout=10).json()
        assert "latency_ms" in j

    def test_elasticsearch_has_node_count(self):
        j = requests.get(f"{BASE}/api/v3/ops/elasticsearch", timeout=10).json()
        assert "node_count" in j

    def test_slo_connected_true(self):
        j = requests.get(f"{BASE}/api/v3/ops/elasticsearch", timeout=10).json()
        assert j["connected"] is True

    def test_slo_cluster_status_not_red(self):
        j = requests.get(f"{BASE}/api/v3/ops/elasticsearch", timeout=10).json()
        assert j["cluster_status"] != "red"
        assert j["cluster_status"] in ("yellow", "green")

    def test_slo_latency_ms_under_2000(self):
        j = requests.get(f"{BASE}/api/v3/ops/elasticsearch", timeout=10).json()
        assert j["latency_ms"] < 2000

    def test_slo_node_count_at_least_1(self):
        j = requests.get(f"{BASE}/api/v3/ops/elasticsearch", timeout=10).json()
        assert j["node_count"] >= 1

    def test_cluster_name_is_string(self):
        j = requests.get(f"{BASE}/api/v3/ops/elasticsearch", timeout=10).json()
        assert isinstance(j.get("cluster_name", ""), str)
        assert len(j.get("cluster_name", "")) > 0

    def test_stable_across_two_polls(self):
        j1 = requests.get(f"{BASE}/api/v3/ops/elasticsearch", timeout=10).json()
        j2 = requests.get(f"{BASE}/api/v3/ops/elasticsearch", timeout=10).json()
        assert j1["connected"] is True
        assert j2["connected"] is True
        assert j2["cluster_status"] != "red"
