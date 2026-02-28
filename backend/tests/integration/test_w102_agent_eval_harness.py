"""W102 — Agent Eval Harness integration tests (≥24 tests)."""
import pytest
import httpx
import asyncio

BASE = "http://localhost:8090/api/v3/eval"


@pytest.fixture(autouse=True)
def clear_runs():
    """Clear eval runs before each test for isolation."""
    yield
    httpx.delete(f"{BASE}/runs", timeout=15)


# ─── Dataset endpoint ────────────────────────────────────────────────────────

def test_get_dataset_returns_200():
    r = httpx.get(f"{BASE}/dataset", timeout=10)
    assert r.status_code == 200


def test_get_dataset_has_six_cases():
    r = httpx.get(f"{BASE}/dataset", timeout=10)
    data = r.json()
    assert data["total"] == 6
    assert len(data["cases"]) == 6


def test_get_dataset_version_v1():
    r = httpx.get(f"{BASE}/dataset", timeout=10)
    assert r.json()["version"] == "v1.0"


def test_dataset_case_ids():
    r = httpx.get(f"{BASE}/dataset", timeout=10)
    ids = [c["id"] for c in r.json()["cases"]]
    for i in range(1, 7):
        assert f"eval-00{i}" in ids


def test_dataset_categories_present():
    r = httpx.get(f"{BASE}/dataset", timeout=10)
    cats = {c["category"] for c in r.json()["cases"]}
    assert cats == {"market_analysis", "strategy", "risk", "backtest", "audit", "cockpit"}


def test_dataset_each_case_has_expected_evidence_ids():
    r = httpx.get(f"{BASE}/dataset", timeout=10)
    for case in r.json()["cases"]:
        assert len(case["expected_evidence_ids"]) >= 1


def test_dataset_each_case_has_expected_keywords():
    r = httpx.get(f"{BASE}/dataset", timeout=10)
    for case in r.json()["cases"]:
        assert len(case["expected_keywords"]) == 3


# ─── Run eval ────────────────────────────────────────────────────────────────

def test_post_run_returns_201():
    r = httpx.post(f"{BASE}/run", timeout=20)
    assert r.status_code == 201


def test_post_run_has_run_id():
    r = httpx.post(f"{BASE}/run", timeout=20)
    data = r.json()
    assert "run_id" in data
    assert isinstance(data["run_id"], str)
    assert len(data["run_id"]) > 0


def test_post_run_case_count_six():
    r = httpx.post(f"{BASE}/run", timeout=20)
    assert r.json()["case_count"] == 6


def test_post_run_has_avg_scores():
    r = httpx.post(f"{BASE}/run", timeout=20)
    data = r.json()
    for field in ("avg_recall", "avg_keyword", "avg_total"):
        assert field in data
        val = data[field]
        assert 0.0 <= val <= 1.0, f"{field}={val} out of [0,1]"


def test_post_run_has_scores_list():
    r = httpx.post(f"{BASE}/run", timeout=20)
    data = r.json()
    assert "scores" in data
    assert len(data["scores"]) == 6


def test_post_run_scores_have_required_fields():
    r = httpx.post(f"{BASE}/run", timeout=20)
    for score in r.json()["scores"]:
        for field in ("case_id", "category", "citation_recall", "keyword_score", "total_score"):
            assert field in score


def test_post_run_scores_in_range():
    r = httpx.post(f"{BASE}/run", timeout=20)
    for score in r.json()["scores"]:
        assert 0.0 <= score["citation_recall"] <= 1.0
        assert 0.0 <= score["keyword_score"] <= 1.0
        assert 0.0 <= score["total_score"] <= 1.0


def test_post_run_total_score_is_average():
    r = httpx.post(f"{BASE}/run", timeout=20)
    for score in r.json()["scores"]:
        expected = (score["citation_recall"] + score["keyword_score"]) / 2
        assert abs(score["total_score"] - expected) < 0.001


def test_post_run_avg_total_matches_scores():
    r = httpx.post(f"{BASE}/run", timeout=20)
    data = r.json()
    scores = data["scores"]
    computed_avg = sum(s["total_score"] for s in scores) / len(scores)
    assert abs(data["avg_total"] - computed_avg) < 0.001


# ─── Determinism ─────────────────────────────────────────────────────────────

def test_determinism_run_twice_same_scores():
    r1 = httpx.post(f"{BASE}/run", timeout=20)
    r2 = httpx.post(f"{BASE}/run", timeout=20)
    d1 = r1.json()
    d2 = r2.json()
    assert abs(d1["avg_total"] - d2["avg_total"]) < 0.001
    assert abs(d1["avg_recall"] - d2["avg_recall"]) < 0.001
    assert abs(d1["avg_keyword"] - d2["avg_keyword"]) < 0.001


def test_determinism_per_case_scores_stable():
    r1 = httpx.post(f"{BASE}/run", timeout=20)
    r2 = httpx.post(f"{BASE}/run", timeout=20)
    s1 = {s["case_id"]: s for s in r1.json()["scores"]}
    s2 = {s["case_id"]: s for s in r2.json()["scores"]}
    for cid in s1:
        assert abs(s1[cid]["total_score"] - s2[cid]["total_score"]) < 0.001


# ─── GET /runs ────────────────────────────────────────────────────────────────

def test_get_runs_returns_200():
    r = httpx.get(f"{BASE}/runs", timeout=10)
    assert r.status_code == 200


def test_get_runs_empty_before_any_run():
    r = httpx.get(f"{BASE}/runs", timeout=10)
    assert r.json()["runs"] == []


def test_get_runs_accumulates():
    httpx.post(f"{BASE}/run", timeout=20)
    httpx.post(f"{BASE}/run", timeout=20)
    r = httpx.get(f"{BASE}/runs", timeout=10)
    assert len(r.json()["runs"]) == 2


# ─── GET /runs/{run_id} ───────────────────────────────────────────────────────

def test_get_run_by_id_200():
    run_id = httpx.post(f"{BASE}/run", timeout=20).json()["run_id"]
    r = httpx.get(f"{BASE}/runs/{run_id}", timeout=10)
    assert r.status_code == 200


def test_get_run_by_id_has_scores():
    run_id = httpx.post(f"{BASE}/run", timeout=20).json()["run_id"]
    r = httpx.get(f"{BASE}/runs/{run_id}", timeout=10)
    data = r.json()
    assert "scores" in data
    assert len(data["scores"]) == 6


def test_get_run_by_id_unknown_returns_404():
    r = httpx.get(f"{BASE}/runs/nonexistent-run-id", timeout=10)
    assert r.status_code == 404


# ─── DELETE /runs ─────────────────────────────────────────────────────────────

def test_delete_runs_returns_200():
    httpx.post(f"{BASE}/run", timeout=20)
    r = httpx.delete(f"{BASE}/runs", timeout=10)
    assert r.status_code == 200


def test_delete_runs_clears_all():
    httpx.post(f"{BASE}/run", timeout=20)
    httpx.post(f"{BASE}/run", timeout=20)
    httpx.delete(f"{BASE}/runs", timeout=10)
    r = httpx.get(f"{BASE}/runs", timeout=10)
    assert r.json()["runs"] == []


# ─── All 6 case IDs appear in run scores ─────────────────────────────────────

def test_all_six_case_ids_in_run_scores():
    r = httpx.post(f"{BASE}/run", timeout=20)
    case_ids = {s["case_id"] for s in r.json()["scores"]}
    for i in range(1, 7):
        assert f"eval-00{i}" in case_ids


def test_run_scores_include_evidence_returned_and_expected():
    r = httpx.post(f"{BASE}/run", timeout=20)
    for score in r.json()["scores"]:
        assert "evidence_returned" in score
        assert "evidence_expected" in score
        assert isinstance(score["evidence_returned"], list)
        assert isinstance(score["evidence_expected"], list)
