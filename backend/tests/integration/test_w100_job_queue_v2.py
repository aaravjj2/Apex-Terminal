"""
W100 — Job Queue v2 + WS progress
Pytest integration tests (HTTP-only; WS tested in Playwright)
≥ 24 test cases covering state machine, idempotency, ES indexing, validation.
"""
from __future__ import annotations

import asyncio
import os
import pytest
import httpx

BASE = "http://localhost:8090/api/v3/jobs"
TIMEOUT = 60.0


# ─── Helpers ─────────────────────────────────────────────────────────────────

def client() -> httpx.Client:
    return httpx.Client(base_url=BASE, timeout=TIMEOUT)


def create_job(c: httpx.Client, name: str = "Test Job", job_type: str = "backtest", auto_run: bool = False) -> dict:
    r = c.post("/jobs", json={"name": name, "job_type": job_type, "auto_run": auto_run})
    assert r.status_code == 201, r.text
    return r.json()


# ─── Clear jobs before each test ─────────────────────────────────────────────

@pytest.fixture(autouse=True)
def clear(request):
    with client() as c:
        c.delete("/jobs")
    yield
    with client() as c:
        c.delete("/jobs")


# ─── Types endpoint ──────────────────────────────────────────────────────────

def test_types_returns_list():
    with client() as c:
        r = c.get("/types")
    assert r.status_code == 200
    data = r.json()
    assert "job_types" in data
    assert len(data["job_types"]) >= 5


def test_types_contains_backtest():
    with client() as c:
        r = c.get("/types")
    assert "backtest" in r.json()["job_types"]


# ─── Submit / Create ─────────────────────────────────────────────────────────

def test_submit_job_returns_201():
    with client() as c:
        r = c.post("/jobs", json={"name": "My Job", "job_type": "backtest", "auto_run": False})
    assert r.status_code == 201


def test_submit_job_default_status_queued():
    with client() as c:
        job = create_job(c)
    assert job["status"] == "queued"


def test_submit_job_has_id():
    with client() as c:
        job = create_job(c)
    assert "id" in job and len(job["id"]) == 36  # UUID


def test_submit_job_has_created_at():
    with client() as c:
        job = create_job(c)
    assert job.get("created_at") is not None


def test_submit_job_progress_zero():
    with client() as c:
        job = create_job(c)
    assert job["progress"] == 0.0


def test_submit_invalid_job_type():
    with client() as c:
        r = c.post("/jobs", json={"name": "Bad", "job_type": "nonexistent"})
    assert r.status_code == 422


def test_submit_empty_name_rejected():
    with client() as c:
        r = c.post("/jobs", json={"name": "", "job_type": "backtest"})
    assert r.status_code == 422


def test_submit_all_valid_types():
    types = ["backtest", "search_index", "data_export", "report_gen", "model_train"]
    with client() as c:
        for jt in types:
            r = c.post("/jobs", json={"name": f"Job {jt}", "job_type": jt, "auto_run": False})
            assert r.status_code == 201, f"Failed for type: {jt}"
        r2 = c.get("/jobs")
        assert r2.json()["total"] == len(types)


# ─── Get single job ──────────────────────────────────────────────────────────

def test_get_job_returns_detail():
    with client() as c:
        job = create_job(c, name="Detail Test")
        r = c.get(f"/jobs/{job['id']}")
    assert r.status_code == 200
    assert r.json()["name"] == "Detail Test"


def test_get_nonexistent_job_404():
    with client() as c:
        r = c.get("/jobs/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


# ─── List jobs ───────────────────────────────────────────────────────────────

def test_list_jobs_returns_total():
    with client() as c:
        create_job(c, "A")
        create_job(c, "B")
        r = c.get("/jobs")
    data = r.json()
    assert "jobs" in data
    assert data["total"] == 2


def test_list_jobs_status_filter_queued():
    with client() as c:
        create_job(c, "Q1")
        create_job(c, "Q2")
        r = c.get("/jobs?status=queued")
    assert r.json()["total"] == 2


def test_list_jobs_invalid_status_filter():
    with client() as c:
        r = c.get("/jobs?status=gibberish")
    assert r.status_code == 422


# ─── Cancel (idempotent) ─────────────────────────────────────────────────────

def test_cancel_queued_job():
    with client() as c:
        job = create_job(c)
        r = c.post(f"/jobs/{job['id']}/cancel")
    assert r.status_code == 200
    assert r.json()["status"] == "canceled"


def test_cancel_already_canceled_is_idempotent():
    with client() as c:
        job = create_job(c)
        c.post(f"/jobs/{job['id']}/cancel")
        r = c.post(f"/jobs/{job['id']}/cancel")
    assert r.status_code == 200
    assert r.json()["status"] == "canceled"


def test_cancel_nonexistent_job_404():
    with client() as c:
        r = c.post("/jobs/00000000-0000-0000-0000-000000000000/cancel")
    assert r.status_code == 404


def test_cancel_queued_visible_in_filter():
    with client() as c:
        job = create_job(c)
        c.post(f"/jobs/{job['id']}/cancel")
        r = c.get("/jobs?status=canceled")
    assert r.json()["total"] >= 1


# ─── State machine transitions ────────────────────────────────────────────────

def test_start_job_queued_to_running():
    with client() as c:
        job = create_job(c)
        r = c.post(f"/jobs/{job['id']}/start")
    assert r.status_code == 200
    assert r.json()["status"] == "running"


def test_complete_job_running_to_succeeded():
    with client() as c:
        job = create_job(c)
        c.post(f"/jobs/{job['id']}/start")
        r = c.post(f"/jobs/{job['id']}/complete")
    assert r.status_code == 200
    assert r.json()["status"] == "succeeded"


def test_complete_job_progress_100():
    with client() as c:
        job = create_job(c)
        c.post(f"/jobs/{job['id']}/start")
        r = c.post(f"/jobs/{job['id']}/complete")
    assert r.json()["progress"] == 100.0


def test_fail_job_running_to_failed():
    with client() as c:
        job = create_job(c)
        c.post(f"/jobs/{job['id']}/start")
        r = c.post(f"/jobs/{job['id']}/fail")
    assert r.status_code == 200
    assert r.json()["status"] == "failed"


def test_invalid_transition_complete_from_queued():
    with client() as c:
        job = create_job(c)
        r = c.post(f"/jobs/{job['id']}/complete")
    assert r.status_code == 422


def test_cancel_succeeded_is_idempotent():
    """Cancel a succeeded job → returns the succeeded job (no error)."""
    with client() as c:
        job = create_job(c)
        c.post(f"/jobs/{job['id']}/start")
        c.post(f"/jobs/{job['id']}/complete")
        r = c.post(f"/jobs/{job['id']}/cancel")
    assert r.status_code == 200
    assert r.json()["status"] == "succeeded"  # idempotent, no change


# ─── Auto-run simulation ──────────────────────────────────────────────────────

def test_auto_run_job_eventually_succeeds():
    """Submit with auto_run=True and poll until terminal."""
    with client() as c:
        r = c.post("/jobs", json={"name": "Auto", "job_type": "backtest", "auto_run": True})
        assert r.status_code == 201
        job_id = r.json()["id"]
        for _ in range(30):
            import time
            time.sleep(0.5)
            detail = c.get(f"/jobs/{job_id}").json()
            if detail["status"] in ("succeeded", "failed", "canceled"):
                break
        assert detail["status"] == "succeeded"


# ─── Clear jobs ───────────────────────────────────────────────────────────────

def test_clear_jobs_removes_all():
    with client() as c:
        create_job(c, "X1")
        create_job(c, "X2")
        r = c.delete("/jobs")
        assert r.json()["ok"] is True
        r2 = c.get("/jobs")
    assert r2.json()["total"] == 0


def test_clear_jobs_idempotent():
    """Clearing empty table is fine."""
    with client() as c:
        r1 = c.delete("/jobs")
        r2 = c.delete("/jobs")
    assert r1.status_code == 200
    assert r2.status_code == 200


# ─── Invariants ──────────────────────────────────────────────────────────────

def test_invariant_completed_at_set_on_success():
    with client() as c:
        job = create_job(c)
        c.post(f"/jobs/{job['id']}/start")
        result = c.post(f"/jobs/{job['id']}/complete").json()
    assert result.get("completed_at") is not None


def test_invariant_canceled_at_set_on_cancel():
    with client() as c:
        job = create_job(c)
        result = c.post(f"/jobs/{job['id']}/cancel").json()
    assert result.get("canceled_at") is not None


def test_invariant_started_at_set_on_start():
    with client() as c:
        job = create_job(c)
        result = c.post(f"/jobs/{job['id']}/start").json()
    assert result.get("started_at") is not None


def test_invariant_terminal_states_no_regression():
    """Succeeded job cannot transition to running."""
    with client() as c:
        job = create_job(c)
        c.post(f"/jobs/{job['id']}/start")
        c.post(f"/jobs/{job['id']}/complete")
        r = c.post(f"/jobs/{job['id']}/start")
    assert r.status_code == 422


def test_invariant_failed_job_has_error():
    with client() as c:
        job = create_job(c)
        c.post(f"/jobs/{job['id']}/start")
        r = c.post(f"/jobs/{job['id']}/fail?error=disk_full")
    result = r.json()
    assert result["error_msg"] == "disk_full"


def test_list_jobs_filter_running():
    with client() as c:
        j1 = create_job(c, "R1")
        j2 = create_job(c, "R2")
        c.post(f"/jobs/{j1['id']}/start")
        r = c.get("/jobs?status=running")
    assert r.json()["total"] == 1
