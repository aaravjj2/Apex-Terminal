"""
Wave 116 — E2E coverage gate pytest tests.

Covers:
  - Hardening spec directory has >= 35 files
  - w116 spec file exists
  - Backend-state verification patterns: create ticket → id, create control → id
  - Reset confirms data was written (rowcount >= 1)
"""
from __future__ import annotations

import os

import requests

BASE = "http://localhost:8090"
WORKSPACE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
HARDENING_DIR = os.path.join(WORKSPACE, "frontend", "tests", "e2e", "hardening")


class TestW116CoverageGate:
    def test_hardening_dir_exists(self):
        assert os.path.isdir(HARDENING_DIR), f"Missing: {HARDENING_DIR}"

    def test_spec_file_count_at_least_35(self):
        files = [f for f in os.listdir(HARDENING_DIR) if f.endswith(".spec.ts")]
        assert len(files) >= 35, f"Only {len(files)} spec files found, need >= 35"

    def test_w116_spec_file_exists(self):
        assert os.path.isfile(
            os.path.join(HARDENING_DIR, "w116-e2e-coverage-gate.spec.ts")
        )

    def test_w113_spec_file_exists(self):
        assert os.path.isfile(os.path.join(HARDENING_DIR, "w113-ws-stability.spec.ts"))

    def test_w114_spec_file_exists(self):
        assert os.path.isfile(os.path.join(HARDENING_DIR, "w114-es-stability.spec.ts"))

    def test_w115_spec_file_exists(self):
        assert os.path.isfile(
            os.path.join(HARDENING_DIR, "w115-broker-stability.spec.ts")
        )

    def test_slo_md_exists(self):
        slo_path = os.path.join(WORKSPACE, "docs", "ops", "SLO.md")
        assert os.path.exists(slo_path)


class TestW116BackendState:
    def test_create_ticket_returns_id(self):
        r = requests.post(
            f"{BASE}/api/v3/tickets/tickets",
            json={"title": "W116 gate ticket", "created_by": "w116", "role": "auditor"},
            timeout=10,
        )
        assert r.status_code in (200, 201)
        body = r.json()
        assert "id" in body
        assert isinstance(body["id"], str)
        assert len(body["id"]) > 0

    def test_create_control_returns_id(self):
        r = requests.post(
            f"{BASE}/api/v3/controls/controls",
            json={"doc_type": "ap-ar", "doc_id": "w116-gate-001", "data": {"owner": "w116"}},
            timeout=10,
        )
        assert r.status_code in (200, 201)
        body = r.json()
        assert "id" in body

    def test_reset_all_confirms_ticket_was_stored(self):
        requests.post(
            f"{BASE}/api/v3/tickets/tickets",
            json={"title": "W116 rowcount", "created_by": "w116", "role": "auditor"},
            timeout=10,
        )
        r = requests.post(f"{BASE}/api/v3/ops/reset-all", timeout=15)
        j = r.json()
        assert j["status"] == "ok"
        assert isinstance(j["sqlite"].get("tickets"), int)
        assert j["sqlite"]["tickets"] >= 1

    def test_ticket_search_returns_structured_response(self):
        r = requests.get(
            f"{BASE}/api/v3/tickets/tickets/search?q=W116", timeout=10
        )
        assert r.status_code == 200
        body = r.json()
        assert body is not None
        # Must be object with hits field OR array
        assert isinstance(body, (dict, list))

    def test_ops_health_endpoints_all_respond_200(self):
        import time
        start = time.time()
        ws  = requests.get(f"{BASE}/api/v3/ops/ws/health", timeout=10)
        es  = requests.get(f"{BASE}/api/v3/ops/elasticsearch", timeout=10)
        brk = requests.get(f"{BASE}/api/v3/ops/broker", timeout=10)
        elapsed = time.time() - start
        assert ws.status_code == 200
        assert es.status_code == 200
        assert brk.status_code == 200
        # All 3 health checks combined must be < 15s
        assert elapsed < 15
