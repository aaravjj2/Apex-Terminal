"""
Wave 112 — Persistent window / ops-reset integration tests (pytest only, no Playwright).

Covers:
  - ops_reset.py module structure
  - GET  /api/v3/ops/reset/version
  - POST /api/v3/ops/reset-all  (status, keys, idempotency)
  - Data-clearing behaviour (create ticket → reset → sqlite shows deleted count)
"""
from __future__ import annotations

import importlib

import pytest
import requests

BASE = "http://localhost:8090"
RESET_VERSION = "w112-v1.0"


# ── structural / static ───────────────────────────────────────────────────────
class TestW112Structure:
    def test_ops_reset_module_exists(self):
        mod = importlib.import_module("phase1.services.api.routes.ops_reset")
        assert mod is not None

    def test_router_prefix(self):
        from phase1.services.api.routes.ops_reset import router
        assert router.prefix == "/api/v3/ops"

    def test_reset_version_constant(self):
        from phase1.services.api.routes.ops_reset import RESET_VERSION as RV
        assert RV == RESET_VERSION

    def test_reset_tables_contains_tickets(self):
        from phase1.services.api.routes.ops_reset import RESET_TABLES
        assert "tickets" in RESET_TABLES

    def test_reset_tables_contains_controls_documents(self):
        from phase1.services.api.routes.ops_reset import RESET_TABLES
        assert "controls_documents" in RESET_TABLES

    def test_reset_tables_contains_a11y_audit_runs(self):
        from phase1.services.api.routes.ops_reset import RESET_TABLES
        assert "a11y_audit_runs" in RESET_TABLES

    def test_reset_tables_contains_perf_budget_samples(self):
        from phase1.services.api.routes.ops_reset import RESET_TABLES
        assert "perf_budget_samples" in RESET_TABLES

    def test_reset_indices_contains_apex_tickets(self):
        from phase1.services.api.routes.ops_reset import RESET_INDICES
        assert "apex-tickets" in RESET_INDICES

    def test_reset_indices_contains_apex_controls_ap_ar(self):
        from phase1.services.api.routes.ops_reset import RESET_INDICES
        assert "apex-controls-ap-ar" in RESET_INDICES


# ── live HTTP endpoints ───────────────────────────────────────────────────────
class TestW112ResetVersion:
    def test_reset_version_200(self):
        r = requests.get(f"{BASE}/api/v3/ops/reset/version", timeout=10)
        assert r.status_code == 200

    def test_reset_version_version_field(self):
        r = requests.get(f"{BASE}/api/v3/ops/reset/version", timeout=10)
        assert r.json()["version"] == RESET_VERSION

    def test_reset_version_status_ok(self):
        r = requests.get(f"{BASE}/api/v3/ops/reset/version", timeout=10)
        assert r.json()["status"] == "ok"


class TestW112ResetAll:
    def test_reset_all_200(self):
        r = requests.post(f"{BASE}/api/v3/ops/reset-all", timeout=15)
        assert r.status_code == 200

    def test_reset_all_status_ok(self):
        r = requests.post(f"{BASE}/api/v3/ops/reset-all", timeout=15)
        assert r.json()["status"] == "ok"

    def test_reset_all_has_sqlite_key(self):
        r = requests.post(f"{BASE}/api/v3/ops/reset-all", timeout=15)
        assert "sqlite" in r.json()

    def test_reset_all_has_es_key(self):
        r = requests.post(f"{BASE}/api/v3/ops/reset-all", timeout=15)
        assert "es" in r.json()

    def test_reset_all_version_matches(self):
        r = requests.post(f"{BASE}/api/v3/ops/reset-all", timeout=15)
        assert r.json()["version"] == RESET_VERSION

    def test_reset_all_sqlite_is_dict(self):
        r = requests.post(f"{BASE}/api/v3/ops/reset-all", timeout=15)
        assert isinstance(r.json()["sqlite"], dict)

    def test_reset_all_sqlite_reports_all_tables(self):
        r = requests.post(f"{BASE}/api/v3/ops/reset-all", timeout=15)
        sqlite_res = r.json()["sqlite"]
        for tbl in ("tickets", "controls_documents", "a11y_audit_runs", "perf_budget_samples"):
            assert tbl in sqlite_res, f"missing table key: {tbl}"

    def test_reset_all_idempotent_first_call(self):
        r1 = requests.post(f"{BASE}/api/v3/ops/reset-all", timeout=15)
        r2 = requests.post(f"{BASE}/api/v3/ops/reset-all", timeout=15)
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r1.json()["status"] == "ok"
        assert r2.json()["status"] == "ok"

    def test_reset_clears_created_ticket(self):
        """Create a ticket then reset — sqlite must show >= 1 row deleted."""
        c = requests.post(
            f"{BASE}/api/v3/tickets/tickets",
            json={"title": "W112 sentinel ticket", "created_by": "w112-pytest", "role": "auditor"},
            timeout=10,
        )
        assert c.status_code in (200, 201)

        r = requests.post(f"{BASE}/api/v3/ops/reset-all", timeout=15)
        assert r.status_code == 200
        sqlite_res = r.json()["sqlite"]
        # rowcount must be int and >= 1 since we created at least one ticket
        assert isinstance(sqlite_res.get("tickets"), int), f"sqlite tickets: {sqlite_res.get('tickets')}"
        assert sqlite_res["tickets"] >= 1

    def test_multiple_resets_do_not_error(self):
        for _ in range(3):
            r = requests.post(f"{BASE}/api/v3/ops/reset-all", timeout=15)
            assert r.status_code == 200
            assert r.json()["status"] == "ok"
