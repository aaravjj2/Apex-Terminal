"""
Wave 105 — Performance budget integration tests.
24 tests across version / budgets / samples / summary / delete.
"""
from __future__ import annotations

import time
import pytest
import requests

BASE = "http://localhost:8090/api/v3/perf"


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _clean():
    requests.delete(f"{BASE}/data")


def _post_sample(**kwargs):
    payload = {
        "page_id": kwargs.get("page_id", "search"),
        "page_url": kwargs.get("page_url", "http://localhost:5100/ui2/search"),
        "fcp_ms": kwargs.get("fcp_ms", 350.0),
        "lcp_ms": kwargs.get("lcp_ms", 800.0),
        "dom_content_loaded_ms": kwargs.get("dom_content_loaded_ms", 420.0),
        "load_time_ms": kwargs.get("load_time_ms", 900.0),
        "user_agent": kwargs.get("user_agent", "playwright/chromium"),
    }
    return requests.post(f"{BASE}/samples", json=payload)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Version (3 tests)
# ─────────────────────────────────────────────────────────────────────────────

class TestVersion:
    def test_version_status_ok(self):
        r = requests.get(f"{BASE}/version")
        assert r.status_code == 200

    def test_version_has_w105_tag(self):
        r = requests.get(f"{BASE}/version")
        data = r.json()
        assert "w105" in data["version"]

    def test_version_has_budgets_and_pages(self):
        r = requests.get(f"{BASE}/version")
        data = r.json()
        assert "budgets" in data
        assert "pages_count" in data
        assert data["pages_count"] == 7


# ─────────────────────────────────────────────────────────────────────────────
# 2. Budgets (4 tests)
# ─────────────────────────────────────────────────────────────────────────────

class TestBudgets:
    def test_budgets_status_ok(self):
        r = requests.get(f"{BASE}/budgets")
        assert r.status_code == 200

    def test_budgets_has_timing_and_bundle(self):
        r = requests.get(f"{BASE}/budgets")
        data = r.json()
        assert "timing_budgets" in data
        assert "bundle_budgets" in data

    def test_budgets_has_lcp_threshold(self):
        r = requests.get(f"{BASE}/budgets")
        data = r.json()
        assert "lcp_ms" in data["timing_budgets"]
        assert data["timing_budgets"]["lcp_ms"] > 0

    def test_budgets_has_7_pages(self):
        r = requests.get(f"{BASE}/budgets")
        data = r.json()
        assert len(data["pages"]) == 7


# ─────────────────────────────────────────────────────────────────────────────
# 3. POST sample (4 tests)
# ─────────────────────────────────────────────────────────────────────────────

class TestPostSample:
    def setup_method(self):
        _clean()

    def test_post_sample_returns_201(self):
        r = _post_sample()
        assert r.status_code == 201

    def test_post_sample_returns_id(self):
        r = _post_sample()
        data = r.json()
        assert "id" in data
        assert len(data["id"]) == 36  # UUID

    def test_post_sample_budget_passed_for_fast_page(self):
        r = _post_sample(fcp_ms=200, lcp_ms=400, dom_content_loaded_ms=300, load_time_ms=500)
        data = r.json()
        assert data["budget_passed"] is True
        assert data["violations"] == []

    def test_post_sample_budget_failed_for_slow_page(self):
        # Exceed every budget threshold
        r = _post_sample(fcp_ms=99000, lcp_ms=99000, dom_content_loaded_ms=99000, load_time_ms=99000)
        data = r.json()
        assert data["budget_passed"] is False
        assert len(data["violations"]) > 0


# ─────────────────────────────────────────────────────────────────────────────
# 4. GET samples (5 tests)
# ─────────────────────────────────────────────────────────────────────────────

class TestGetSamples:
    def setup_method(self):
        _clean()

    def test_get_samples_empty_list(self):
        r = requests.get(f"{BASE}/samples")
        assert r.status_code == 200
        assert r.json() == []

    def test_get_samples_after_post(self):
        _post_sample(page_id="search")
        r = requests.get(f"{BASE}/samples")
        assert len(r.json()) == 1

    def test_get_samples_filter_by_page_id(self):
        _post_sample(page_id="search")
        _post_sample(page_id="backtest")
        r = requests.get(f"{BASE}/samples?page_id=search")
        data = r.json()
        assert len(data) == 1
        assert data[0]["page_id"] == "search"

    def test_get_samples_filter_returns_empty_for_unknown(self):
        _post_sample(page_id="search")
        r = requests.get(f"{BASE}/samples?page_id=nonexistent")
        assert r.json() == []

    def test_get_samples_has_expected_fields(self):
        _post_sample()
        r = requests.get(f"{BASE}/samples")
        s = r.json()[0]
        for field in ("id", "page_id", "page_url", "sampled_at", "fcp_ms", "lcp_ms", "budget_passed"):
            assert field in s, f"Missing field: {field}"


# ─────────────────────────────────────────────────────────────────────────────
# 5. Summary (6 tests)
# ─────────────────────────────────────────────────────────────────────────────

class TestSummary:
    def setup_method(self):
        _clean()

    def test_summary_empty(self):
        r = requests.get(f"{BASE}/summary")
        assert r.status_code == 200
        data = r.json()
        assert data["total_samples"] == 0

    def test_summary_has_budgets_key(self):
        r = requests.get(f"{BASE}/summary")
        data = r.json()
        assert "budgets" in data

    def test_summary_total_samples_increments(self):
        _post_sample()
        _post_sample()
        r = requests.get(f"{BASE}/summary")
        assert r.json()["total_samples"] == 2

    def test_summary_pages_sampled(self):
        _post_sample(page_id="search")
        _post_sample(page_id="backtest")
        r = requests.get(f"{BASE}/summary")
        assert r.json()["pages_sampled"] == 2

    def test_summary_avg_lcp_ms_computed(self):
        _post_sample(lcp_ms=400.0)
        _post_sample(lcp_ms=600.0)
        r = requests.get(f"{BASE}/summary")
        avg = r.json()["avg_lcp_ms"]
        assert avg is not None
        assert abs(avg - 500.0) < 1.0

    def test_summary_pages_passing_fast_samples(self):
        _post_sample(fcp_ms=200, lcp_ms=400, dom_content_loaded_ms=300, load_time_ms=500)
        _post_sample(fcp_ms=250, lcp_ms=350, dom_content_loaded_ms=280, load_time_ms=450)
        r = requests.get(f"{BASE}/summary")
        # Both samples are for "search" (same page_id default) — latest passes → 1 page passing
        assert r.json()["pages_passing"] >= 1


# ─────────────────────────────────────────────────────────────────────────────
# 6. Delete (2 tests)
# ─────────────────────────────────────────────────────────────────────────────

class TestDelete:
    def setup_method(self):
        _clean()

    def test_delete_returns_deleted_count(self):
        _post_sample()
        _post_sample()
        r = requests.delete(f"{BASE}/data")
        assert r.status_code == 200
        assert r.json()["deleted"] == 2

    def test_delete_clears_all_samples(self):
        _post_sample()
        requests.delete(f"{BASE}/data")
        r = requests.get(f"{BASE}/samples")
        assert r.json() == []
