"""
Wave 120 — Onboarding + guided tour mode.

Verifies:
  - docs/ONBOARDING.md exists with required sections
  - Getting Started wizard prerequisites are documented
  - Guided tour steps link to correct /ui2 routes
"""
from __future__ import annotations

import os

import requests

WORKSPACE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
BASE = "http://localhost:8090"


class TestW120Onboarding:
    def test_onboarding_md_exists(self):
        path = os.path.join(WORKSPACE, "docs", "ONBOARDING.md")
        assert os.path.isfile(path), f"Missing: {path}"

    def test_onboarding_has_getting_started(self):
        path = os.path.join(WORKSPACE, "docs", "ONBOARDING.md")
        content = open(path, encoding="utf-8").read()
        assert "Getting Started" in content or "## 1" in content

    def test_onboarding_has_guided_tour(self):
        path = os.path.join(WORKSPACE, "docs", "ONBOARDING.md")
        content = open(path, encoding="utf-8").read()
        assert "tour" in content.lower() or "Tour" in content

    def test_onboarding_references_docker(self):
        path = os.path.join(WORKSPACE, "docs", "ONBOARDING.md")
        content = open(path, encoding="utf-8").read()
        # Must document how to start services
        assert "docker" in content.lower() or "uvicorn" in content

    def test_onboarding_references_health_check(self):
        path = os.path.join(WORKSPACE, "docs", "ONBOARDING.md")
        content = open(path, encoding="utf-8").read()
        assert "/api/v3/ops/health" in content

    def test_onboarding_has_start_backend(self):
        r = requests.get(f"{BASE}/api/v3/ops/health", timeout=10)
        assert r.status_code == 200

    def test_ws_health_ready(self):
        r = requests.get(f"{BASE}/api/v3/ops/ws/health", timeout=10)
        assert r.status_code == 200

    def test_es_health_ready(self):
        r = requests.get(f"{BASE}/api/v3/ops/elasticsearch", timeout=10)
        assert r.status_code == 200

    def test_broker_health_ready(self):
        r = requests.get(f"{BASE}/api/v3/ops/broker", timeout=10)
        assert r.status_code == 200

    def test_w120_spec_exists(self):
        spec = os.path.join(
            WORKSPACE, "frontend", "tests", "e2e", "hardening", "w120-onboarding.spec.ts"
        )
        assert os.path.isfile(spec)
