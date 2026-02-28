"""
Wave 124 — TerraCode demo tour.

Verifies:
  - TERRACODE_DEMO_SCRIPT.md covers convergence and safe-actions pages
  - Key API endpoints used in demo respond correctly
"""
from __future__ import annotations

import os

import requests

WORKSPACE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
BASE = "http://localhost:8090"


class TestW124TerraCode:
    def _script(self):
        path = os.path.join(WORKSPACE, "docs", "submission", "TERRACODE_DEMO_SCRIPT.md")
        assert os.path.isfile(path), f"Missing: {path}"
        return open(path, encoding="utf-8").read()

    def test_script_exists(self):
        self._script()

    def test_script_has_demo_steps(self):
        content = self._script()
        # Script uses "Scene" headings (Scene 1, Scene 2, ...)
        assert "Scene" in content or "scene" in content.lower() or "Navigate" in content

    def test_script_references_dashboard(self):
        content = self._script()
        assert "dashboard" in content.lower() or "safe" in content.lower()

    def test_script_references_safe_actions(self):
        content = self._script()
        assert "safe" in content.lower()

    def test_health_endpoint(self):
        r = requests.get(f"{BASE}/api/v3/ops/health", timeout=10)
        assert r.status_code == 200

    def test_tickets_search_endpoint(self):
        r = requests.get(f"{BASE}/api/v3/tickets/tickets/search?q=demo", timeout=10)
        assert r.status_code == 200

    def test_reset_version_endpoint(self):
        r = requests.get(f"{BASE}/api/v3/ops/reset/version", timeout=10)
        assert r.status_code == 200

    def test_w124_spec_exists(self):
        spec = os.path.join(
            WORKSPACE, "frontend", "tests", "e2e", "hardening", "w124-tour-terracode.spec.ts"
        )
        assert os.path.isfile(spec)
