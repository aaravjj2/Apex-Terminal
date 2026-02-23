"""
Wave 125 — ElastiHack demo tour.

Verifies:
  - ELASTIHACK_DEMO_SCRIPT.md covers ES search and perf pages
  - ES-related API endpoints used in demo respond correctly
"""
from __future__ import annotations

import os

import requests

WORKSPACE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
BASE = "http://localhost:8090"


class TestW125ElastiHack:
    def _script(self):
        path = os.path.join(WORKSPACE, "docs", "submission", "ELASTIHACK_DEMO_SCRIPT.md")
        assert os.path.isfile(path), f"Missing: {path}"
        return open(path, encoding="utf-8").read()

    def test_script_exists(self):
        self._script()

    def test_script_has_steps(self):
        content = self._script()
        # Script uses "Scene" headings
        assert "Scene" in content or "scene" in content.lower() or "Navigate" in content

    def test_script_references_elasticsearch(self):
        content = self._script()
        assert "elasticsearch" in content.lower() or "elastic" in content.lower()

    def test_script_references_search(self):
        content = self._script()
        assert "search" in content.lower()

    def test_es_health_endpoint(self):
        r = requests.get(f"{BASE}/api/v3/ops/elasticsearch", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "connected" in data

    def test_es_health_cluster_status(self):
        r = requests.get(f"{BASE}/api/v3/ops/elasticsearch", timeout=10)
        data = r.json()
        assert data.get("cluster_status") in ("green", "yellow", "red"), (
            f"Unexpected cluster_status: {data.get('cluster_status')!r}"
        )

    def test_search_endpoint_responds(self):
        r = requests.get(f"{BASE}/api/v3/tickets/tickets/search?q=test", timeout=10)
        assert r.status_code == 200

    def test_w125_spec_exists(self):
        spec = os.path.join(
            WORKSPACE, "frontend", "tests", "e2e", "hardening", "w125-tour-elastihack.spec.ts"
        )
        assert os.path.isfile(spec)
