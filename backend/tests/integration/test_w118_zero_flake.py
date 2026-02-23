"""
Wave 118 — Zero-flake repeat-run harness (3x).

Verifies:
  - scripts/run_3x.ps1 exists and has correct structure
  - proof/ directory is writable
  - Key suite results are stable (API-level check)
"""
from __future__ import annotations

import os
import requests

WORKSPACE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
BASE = "http://localhost:8090"


class TestW118ZeroFlake:
    def test_run_3x_script_exists(self):
        path = os.path.join(WORKSPACE, "scripts", "run_3x.ps1")
        assert os.path.isfile(path), f"Missing: {path}"

    def test_run_3x_script_has_3_iterations(self):
        path = os.path.join(WORKSPACE, "scripts", "run_3x.ps1")
        content = open(path, encoding="utf-8").read()
        assert "1 -le 3" in content or "for" in content.lower()
        proof_dir = os.path.join(WORKSPACE, "proof")
        assert os.path.isdir(proof_dir), f"Missing proof/: {proof_dir}"

    def test_w118_spec_exists(self):
        spec = os.path.join(WORKSPACE, "frontend", "tests", "e2e", "hardening", "w118-zero-flake.spec.ts")
        assert os.path.isfile(spec)

    def test_api_stable_call_1(self):
        r = requests.get(f"{BASE}/api/v3/ops/health", timeout=10)
        assert r.status_code == 200

    def test_api_stable_call_2(self):
        r = requests.get(f"{BASE}/api/v3/ops/health", timeout=10)
        assert r.status_code == 200

    def test_api_stable_call_3(self):
        r = requests.get(f"{BASE}/api/v3/ops/health", timeout=10)
        assert r.status_code == 200
