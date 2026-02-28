"""
Wave 104 — Accessibility Audit pytest suite
Tests: /api/v3/a11y/* endpoints
"""

import asyncio
import json
import threading
import time
import httpx
import pytest
import sys
import os

BASE = "http://localhost:8090/api/v3/a11y"

# ─── Helpers ─────────────────────────────────────────────────────────────────

def get(path: str, **params) -> httpx.Response:
    url = f"{BASE}{path}"
    return httpx.get(url, params=params, timeout=15)


def post(path: str, body: dict) -> httpx.Response:
    url = f"{BASE}{path}"
    return httpx.post(url, json=body, timeout=15)


def delete(path: str) -> httpx.Response:
    url = f"{BASE}{path}"
    return httpx.delete(url, timeout=15)


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def clear_data():
    """Clear audit data before every test for isolation."""
    delete("/data")
    yield
    delete("/data")


# ─── W104 Tests ──────────────────────────────────────────────────────────────

class TestW104Version:
    def test_version_returns_200(self):
        r = get("/version")
        assert r.status_code == 200

    def test_version_has_w104_prefix(self):
        r = get("/version")
        data = r.json()
        assert "w104" in data["version"]

    def test_version_has_excluded_rules(self):
        r = get("/version")
        data = r.json()
        assert "excluded_rules" in data
        assert isinstance(data["excluded_rules"], list)


class TestW104PagesUnderTest:
    def test_pages_under_test_returns_200(self):
        r = get("/pages-under-test")
        assert r.status_code == 200

    def test_pages_under_test_has_7_pages(self):
        r = get("/pages-under-test")
        data = r.json()
        assert data["count"] == 7

    def test_pages_under_test_includes_key_pages(self):
        r = get("/pages-under-test")
        data = r.json()
        ids = [p["id"] for p in data["pages"]]
        assert "search" in ids
        assert "backtest" in ids
        assert "auditor" in ids

    def test_pages_under_test_have_url(self):
        r = get("/pages-under-test")
        for p in r.json()["pages"]:
            assert "url" in p
            assert p["url"].startswith("http://localhost:5100")


class TestW104PostRun:
    SAMPLE_VIOLATIONS = [
        {"id": "color-contrast", "impact": "serious", "description": "Color contrast"},
    ]

    def test_post_run_returns_201(self):
        r = post("/runs", {
            "page_id": "search",
            "page_url": "http://localhost:5100/ui2/search",
            "violations": [],
            "passes_count": 42,
            "incomplete_count": 2,
            "axe_version": "4.11.1",
        })
        assert r.status_code == 201

    def test_post_run_returns_run_id(self):
        r = post("/runs", {
            "page_id": "backtest",
            "page_url": "http://localhost:5100/ui2/backtest",
            "violations": [],
            "passes_count": 30,
            "incomplete_count": 0,
            "axe_version": "4.11.1",
        })
        data = r.json()
        assert "id" in data
        assert data["id"].startswith("a11y-backtest-")

    def test_post_run_counts_critical_serious(self):
        violations = [
            {"id": "rule-1", "impact": "critical"},
            {"id": "rule-2", "impact": "serious"},
            {"id": "rule-3", "impact": "moderate"},
        ]
        r = post("/runs", {
            "page_id": "agent",
            "page_url": "http://localhost:5100/ui2/agent",
            "violations": violations,
            "passes_count": 10,
            "incomplete_count": 1,
            "axe_version": "4.11.1",
        })
        data = r.json()
        assert data["violations_critical"] == 1
        assert data["violations_serious"]  == 1
        assert data["violations_moderate"] == 1
        assert data["passed"] is False

    def test_post_run_passed_true_when_no_critical_serious(self):
        violations = [
            {"id": "rule-mod", "impact": "moderate"},
            {"id": "rule-min", "impact": "minor"},
        ]
        r = post("/runs", {
            "page_id": "ops",
            "page_url": "http://localhost:5100/ui2/ops",
            "violations": violations,
            "passes_count": 25,
            "incomplete_count": 0,
            "axe_version": "4.11.1",
        })
        data = r.json()
        assert data["violations_critical"] == 0
        assert data["violations_serious"]  == 0
        assert data["passed"] is True


class TestW104GetRuns:
    def test_get_runs_returns_200(self):
        r = get("/runs")
        assert r.status_code == 200

    def test_get_runs_empty_initially(self):
        r = get("/runs")
        data = r.json()
        assert data["count"] == 0
        assert data["runs"] == []

    def test_get_runs_returns_saved_runs(self):
        post("/runs", {"page_id": "search", "page_url": "http://localhost:5100/ui2/search", "violations": [], "passes_count": 10, "incomplete_count": 0, "axe_version": "4.11.1"})
        post("/runs", {"page_id": "backtest", "page_url": "http://localhost:5100/ui2/backtest", "violations": [], "passes_count": 8, "incomplete_count": 0, "axe_version": "4.11.1"})
        r = get("/runs")
        data = r.json()
        assert data["count"] == 2

    def test_get_runs_filters_by_page_id(self):
        post("/runs", {"page_id": "search",   "page_url": "http://localhost:5100/ui2/search",   "violations": [], "passes_count": 10, "incomplete_count": 0, "axe_version": "4.11.1"})
        post("/runs", {"page_id": "backtest", "page_url": "http://localhost:5100/ui2/backtest", "violations": [], "passes_count": 8,  "incomplete_count": 0, "axe_version": "4.11.1"})
        r = get("/runs", page_id="search")
        data = r.json()
        assert data["count"] == 1
        assert data["runs"][0]["page_id"] == "search"

    def test_get_runs_has_required_fields(self):
        post("/runs", {"page_id": "agent", "page_url": "http://localhost:5100/ui2/agent", "violations": [], "passes_count": 5, "incomplete_count": 0, "axe_version": "4.11.1"})
        run = get("/runs").json()["runs"][0]
        for field in ["id", "page_id", "page_url", "timestamp", "violations_critical", "violations_serious", "passes_count", "passed"]:
            assert field in run, f"Missing field: {field}"


class TestW104Summary:
    def test_summary_returns_200(self):
        r = get("/summary")
        assert r.status_code == 200

    def test_summary_has_version(self):
        r = get("/summary")
        data = r.json()
        assert "version" in data
        assert "w104" in data["version"]

    def test_summary_overall_pass_true_when_empty(self):
        r = get("/summary")
        data = r.json()
        assert data["overall_pass"] is True

    def test_summary_overall_pass_false_with_critical(self):
        post("/runs", {
            "page_id": "search",
            "page_url": "http://localhost:5100/ui2/search",
            "violations": [{"id": "r1", "impact": "critical"}],
            "passes_count": 5,
            "incomplete_count": 0,
            "axe_version": "4.11.1",
        })
        r = get("/summary")
        data = r.json()
        assert data["total_critical"] >= 1
        assert data["overall_pass"] is False

    def test_summary_excluded_rules_present(self):
        r = get("/summary")
        data = r.json()
        assert "excluded_rules" in data
        assert "color-contrast" in data["excluded_rules"]

    def test_summary_pages_under_test_present(self):
        r = get("/summary")
        data = r.json()
        assert "pages_under_test" in data
        assert len(data["pages_under_test"]) == 7


class TestW104DeleteData:
    def test_delete_clears_runs(self):
        post("/runs", {"page_id": "search", "page_url": "http://localhost:5100/ui2/search", "violations": [], "passes_count": 5, "incomplete_count": 0, "axe_version": "4.11.1"})
        assert get("/runs").json()["count"] == 1
        r = delete("/data")
        assert r.status_code == 200
        assert get("/runs").json()["count"] == 0

    def test_delete_returns_deleted_true(self):
        r = delete("/data")
        assert r.json()["deleted"] is True
