"""
Wave 130 — Final proof pack.

The final gate: all health endpoints green, proof directory complete,
determinism diff is empty, version string confirmed, submission bundle
and compliance docs all present.
"""
from __future__ import annotations

import os

import requests

WORKSPACE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
BASE = "http://localhost:8090"


class TestW130FinalProof:
    # ── health endpoints ─────────────────────────────────────────
    def test_health_200(self):
        r = requests.get(f"{BASE}/api/v3/ops/health", timeout=10)
        assert r.status_code == 200

    def test_ws_health_200(self):
        r = requests.get(f"{BASE}/api/v3/ops/ws/health", timeout=10)
        assert r.status_code == 200

    def test_es_health_200(self):
        r = requests.get(f"{BASE}/api/v3/ops/elasticsearch", timeout=10)
        assert r.status_code == 200

    def test_broker_health_200(self):
        r = requests.get(f"{BASE}/api/v3/ops/broker", timeout=10)
        assert r.status_code == 200

    def test_reset_version_200(self):
        r = requests.get(f"{BASE}/api/v3/ops/reset/version", timeout=10)
        assert r.status_code == 200

    # ── proof directory ─────────────────────────────────────────
    def test_proof_dir_exists(self):
        path = os.path.join(WORKSPACE, "proof")
        assert os.path.isdir(path)

    def test_proof_run1_exists(self):
        path = os.path.join(WORKSPACE, "proof", "determinism-run1.json")
        assert os.path.isfile(path)

    def test_proof_run2_exists(self):
        path = os.path.join(WORKSPACE, "proof", "determinism-run2.json")
        assert os.path.isfile(path)

    def test_proof_diff_exists(self):
        path = os.path.join(WORKSPACE, "proof", "determinism-diff.txt")
        assert os.path.isfile(path)

    def test_proof_diff_is_empty(self):
        path = os.path.join(WORKSPACE, "proof", "determinism-diff.txt")
        content = open(path).read().strip()
        assert content == "", f"Determinism diff is NOT empty: {content[:200]}"

    # ── version string ───────────────────────────────────────────
    def test_reset_version_starts_with_w(self):
        r = requests.get(f"{BASE}/api/v3/ops/reset/version", timeout=10)
        data = r.json()
        assert data.get("version", "").startswith("w")

    # ── compliance docs ──────────────────────────────────────────
    def test_readme_exists(self):
        assert os.path.isfile(os.path.join(WORKSPACE, "README.md"))

    def test_onboarding_exists(self):
        assert os.path.isfile(os.path.join(WORKSPACE, "docs", "ONBOARDING.md"))

    def test_terracode_demo_exists(self):
        assert os.path.isfile(os.path.join(WORKSPACE, "docs", "submission", "TERRACODE_DEMO_SCRIPT.md"))

    def test_elastihack_demo_exists(self):
        assert os.path.isfile(os.path.join(WORKSPACE, "docs", "submission", "ELASTIHACK_DEMO_SCRIPT.md"))

    def test_w130_spec_exists(self):
        spec = os.path.join(
            WORKSPACE, "frontend", "tests", "e2e", "hardening", "w130-final-proof.spec.ts"
        )
        assert os.path.isfile(spec)
