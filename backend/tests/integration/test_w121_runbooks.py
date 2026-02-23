"""
Wave 121 â€” Runbooks + ops docs.

Verifies:
  - docs/ops/TROUBLESHOOTING.md + RESET.md + SLO.md + JUDGE_MODE.md exist
  - Each file has minimum expected content
  - Ops API endpoints respond
"""
from __future__ import annotations

import os

import requests

WORKSPACE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
BASE = "http://localhost:8090"


class TestW121Runbooks:
    def _check(self, rel: str, keyword: str):
        path = os.path.join(WORKSPACE, rel)
        assert os.path.isfile(path), f"Missing: {path}"
        content = open(path, encoding='utf-8').read()
        assert keyword.lower() in content.lower(), f"{keyword!r} not found in {rel}"

    def test_troubleshooting_exists(self):
        self._check("docs/ops/TROUBLESHOOTING.md", "troubleshoot")

    def test_troubleshooting_has_es_section(self):
        self._check("docs/ops/TROUBLESHOOTING.md", "elasticsearch")

    def test_reset_md_exists(self):
        self._check("docs/ops/RESET.md", "reset")

    def test_reset_md_has_endpoint(self):
        self._check("docs/ops/RESET.md", "/api/v3/ops/reset-all")

    def test_slo_md_exists(self):
        self._check("docs/ops/SLO.md", "SLO")

    def test_slo_md_has_ws(self):
        self._check("docs/ops/SLO.md", "websocket")

    def test_judge_mode_exists(self):
        self._check("docs/ops/JUDGE_MODE.md", "judge")

    def test_reset_version_endpoint(self):
        r = requests.get(f"{BASE}/api/v3/ops/reset/version", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "version" in data

    def test_reset_all_endpoint(self):
        r = requests.post(f"{BASE}/api/v3/ops/reset-all", timeout=30)
        assert r.status_code == 200

    def test_w121_spec_exists(self):
        spec = os.path.join(
            WORKSPACE, "frontend", "tests", "e2e", "hardening", "w121-runbooks.spec.ts"
        )
        assert os.path.isfile(spec)

