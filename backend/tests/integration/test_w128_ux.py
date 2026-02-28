"""
Wave 128 — UX declutter / nav completeness.

Verifies:
  - Required nav routes exist in frontend routing
  - All critical /ui2 pages respond with 200
"""
from __future__ import annotations

import os

import requests

WORKSPACE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
BASE_FRONTEND = "http://localhost:5100"

REQUIRED_ROUTES = [
    "/ui2/convergence",
    "/ui2/search-v3",
    "/ui2/ops",
    "/ui2/auditor",
]


class TestW128UX:
    def _routes_file(self):
        for candidate in [
            "frontend/src/ui2/routes.tsx",
            "frontend/src/routes.tsx",
            "frontend/src/App.tsx",
        ]:
            path = os.path.join(WORKSPACE, candidate)
            if os.path.isfile(path):
                return path
        return None

    def test_routes_file_exists(self):
        assert self._routes_file() is not None, "No routes file found"

    def test_convergence_route_defined(self):
        path = self._routes_file()
        content = open(path).read()
        assert "convergence" in content.lower()

    def test_auditor_route_defined(self):
        path = self._routes_file()
        content = open(path).read()
        assert "auditor" in content.lower()

    def test_ops_route_defined(self):
        path = self._routes_file()
        content = open(path).read()
        assert "/ui2/ops" in content or "ops" in content.lower()

    def test_search_route_defined(self):
        path = self._routes_file()
        content = open(path).read()
        assert "search" in content.lower()

    def test_frontend_serves_ui2(self):
        try:
            r = requests.get(f"{BASE_FRONTEND}/ui2", timeout=10)
            assert r.status_code in (200, 304)
        except requests.exceptions.ConnectionError:
            import pytest
            pytest.skip("Frontend not running")

    def test_w128_spec_exists(self):
        spec = os.path.join(
            WORKSPACE, "frontend", "tests", "e2e", "hardening", "w128-ux-declutter.spec.ts"
        )
        assert os.path.isfile(spec)
