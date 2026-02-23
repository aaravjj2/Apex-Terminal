"""
W99 — Strategy Studio v3: integration tests
  ~30 HTTP-only tests (httpx)
"""
import pytest
import httpx

BASE = "http://localhost:8090/api/v3/strategy-studio"
VALID_SPEC = {
    "name": "Test Strategy",
    "strategy_type": "ma_cross",
    "symbols": ["AAPL"],
    "start_date": "2024-01-01",
    "end_date": "2024-12-31",
    "params": {"fast": 5, "slow": 20},
}


@pytest.fixture(scope="module", autouse=True)
def reset_data():
    with httpx.Client(timeout=20) as c:
        c.delete(f"{BASE}/strategies")
    yield
    with httpx.Client(timeout=20) as c:
        c.delete(f"{BASE}/strategies")


# ─── Templates ────────────────────────────────────────────────────────────────

class TestTemplates:
    def test_templates_returns_200(self):
        r = httpx.get(f"{BASE}/templates")
        assert r.status_code == 200

    def test_templates_count_is_three(self):
        r = httpx.get(f"{BASE}/templates")
        assert r.json()["count"] == 3

    def test_templates_have_required_fields(self):
        for t in httpx.get(f"{BASE}/templates").json()["templates"]:
            for field in ("id", "name", "strategy_type", "params", "symbols"):
                assert field in t

    def test_template_ids_include_sma_cross(self):
        ids = {t["id"] for t in httpx.get(f"{BASE}/templates").json()["templates"]}
        assert "tpl-sma-cross" in ids

    def test_template_ids_include_rsi(self):
        ids = {t["id"] for t in httpx.get(f"{BASE}/templates").json()["templates"]}
        assert "tpl-rsi-revert" in ids


# ─── Lint ─────────────────────────────────────────────────────────────────────

class TestLint:
    def test_lint_valid_spec(self):
        r = httpx.post(f"{BASE}/lint", json=VALID_SPEC)
        assert r.status_code == 200
        assert r.json()["valid"] is True
        assert r.json()["error_count"] == 0

    def test_lint_missing_name_fails(self):
        spec = {**VALID_SPEC, "name": ""}
        r = httpx.post(f"{BASE}/lint", json=spec)
        data = r.json()
        assert data["valid"] is False
        assert any(e["field"] == "name" for e in data["errors"])

    def test_lint_missing_symbol_fails(self):
        spec = {**VALID_SPEC, "symbols": []}
        r = httpx.post(f"{BASE}/lint", json=spec)
        assert r.json()["valid"] is False

    def test_lint_unknown_strategy_type_fails(self):
        spec = {**VALID_SPEC, "strategy_type": "alien_strat"}
        r = httpx.post(f"{BASE}/lint", json=spec)
        assert r.json()["valid"] is False
        assert any(e["field"] == "strategy_type" for e in r.json()["errors"])

    def test_lint_bad_date_format_fails(self):
        spec = {**VALID_SPEC, "start_date": "01/01/2024"}
        r = httpx.post(f"{BASE}/lint", json=spec)
        assert r.json()["valid"] is False

    def test_lint_end_before_start_fails(self):
        spec = {**VALID_SPEC, "start_date": "2024-12-01", "end_date": "2024-01-01"}
        r = httpx.post(f"{BASE}/lint", json=spec)
        assert r.json()["valid"] is False


# ─── CRUD ─────────────────────────────────────────────────────────────────────

class TestStrategyCRUD:
    def test_create_returns_201(self):
        r = httpx.post(f"{BASE}/strategies", json=VALID_SPEC, timeout=15)
        assert r.status_code == 201

    def test_create_returns_id(self):
        r = httpx.post(f"{BASE}/strategies", json=VALID_SPEC, timeout=15)
        assert "id" in r.json()

    def test_create_returns_version_1(self):
        r = httpx.post(f"{BASE}/strategies", json=VALID_SPEC, timeout=15)
        assert r.json()["version"] == 1

    def test_create_invalid_spec_returns_422(self):
        r = httpx.post(f"{BASE}/strategies", json={**VALID_SPEC, "name": ""}, timeout=15)
        assert r.status_code == 422

    def test_get_strategy(self):
        r = httpx.post(f"{BASE}/strategies", json=VALID_SPEC, timeout=15)
        sid = r.json()["id"]
        r2 = httpx.get(f"{BASE}/strategies/{sid}")
        assert r2.status_code == 200
        assert r2.json()["id"] == sid

    def test_get_unknown_strategy_404(self):
        r = httpx.get(f"{BASE}/strategies/DOES_NOT_EXIST")
        assert r.status_code == 404

    def test_list_strategies_returns_200(self):
        httpx.post(f"{BASE}/strategies", json=VALID_SPEC, timeout=15)
        r = httpx.get(f"{BASE}/strategies")
        assert r.status_code == 200
        assert r.json()["count"] >= 1


# ─── Search ───────────────────────────────────────────────────────────────────

class TestStrategySearch:
    def test_search_by_name_returns_results(self):
        spec = {**VALID_SPEC, "name": "Alpha Search Test"}
        httpx.post(f"{BASE}/strategies", json=spec, timeout=15)
        r = httpx.get(f"{BASE}/strategies?q=Alpha Search Test")
        assert r.json()["count"] >= 1

    def test_search_no_match_returns_empty(self):
        r = httpx.get(f"{BASE}/strategies?q=xyzzy_unique_not_found")
        assert r.json()["count"] == 0


# ─── Update & version history ─────────────────────────────────────────────────

class TestVersionHistory:
    def test_update_increments_version(self):
        r = httpx.post(f"{BASE}/strategies", json=VALID_SPEC, timeout=15)
        sid = r.json()["id"]
        r2 = httpx.patch(f"{BASE}/strategies/{sid}", json={"name": "Updated Name"}, timeout=15)
        assert r2.json()["version"] == 2

    def test_history_grows_after_update(self):
        r = httpx.post(f"{BASE}/strategies", json=VALID_SPEC, timeout=15)
        sid = r.json()["id"]
        httpx.patch(f"{BASE}/strategies/{sid}", json={"name": "Updated v2"}, timeout=15)
        h = httpx.get(f"{BASE}/strategies/{sid}/history").json()
        assert h["count"] >= 2


# ─── Archive & delete ─────────────────────────────────────────────────────────

class TestArchiveDelete:
    def test_archive_strategy(self):
        r = httpx.post(f"{BASE}/strategies", json=VALID_SPEC, timeout=15)
        sid = r.json()["id"]
        ar = httpx.post(f"{BASE}/strategies/{sid}/archive")
        assert ar.json()["archived"] is True

    def test_archived_not_in_default_list(self):
        r = httpx.post(f"{BASE}/strategies", json=VALID_SPEC, timeout=15)
        sid = r.json()["id"]
        httpx.post(f"{BASE}/strategies/{sid}/archive")
        ids = [s["id"] for s in httpx.get(f"{BASE}/strategies").json()["strategies"]]
        assert sid not in ids

    def test_delete_strategy(self):
        r = httpx.post(f"{BASE}/strategies", json=VALID_SPEC, timeout=15)
        sid = r.json()["id"]
        dr = httpx.delete(f"{BASE}/strategies/{sid}")
        assert dr.json()["ok"] is True
        assert httpx.get(f"{BASE}/strategies/{sid}").status_code == 404

    def test_delete_all_clears(self):
        httpx.delete(f"{BASE}/strategies")
        r = httpx.get(f"{BASE}/strategies")
        assert r.json()["count"] == 0
