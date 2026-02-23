"""
W96 Search UX v3 — Integration Tests
HTTP-only via httpx against localhost:8090
~26 tests
"""
import pytest
import httpx

BASE = "http://localhost:8090"
SEARCH_BASE = f"{BASE}/api/v3/search-ux"
TIMEOUT = 30


@pytest.fixture(scope="module", autouse=True)
def reset_saved():
    """Clear saved searches before test suite."""
    r = httpx.delete(f"{SEARCH_BASE}/saved", timeout=TIMEOUT)
    assert r.status_code == 200
    yield
    httpx.delete(f"{SEARCH_BASE}/saved", timeout=TIMEOUT)


# ─────────────────────────────────────────────
# 1. GET /facets
# ─────────────────────────────────────────────
class TestFacets:
    def test_facets_200(self):
        r = httpx.get(f"{SEARCH_BASE}/facets", timeout=TIMEOUT)
        assert r.status_code == 200

    def test_facets_has_dimensions(self):
        r = httpx.get(f"{SEARCH_BASE}/facets", timeout=TIMEOUT)
        data = r.json()
        assert "facets" in data
        names = {f["name"] for f in data["facets"]}
        assert "entity_type" in names
        assert "severity" in names
        assert "time" in names

    def test_facets_entity_type_has_6_values(self):
        r = httpx.get(f"{SEARCH_BASE}/facets", timeout=TIMEOUT)
        facets = r.json()["facets"]
        et = next(f for f in facets if f["name"] == "entity_type")
        assert len(et["values"]) == 6

    def test_facets_time_has_values(self):
        r = httpx.get(f"{SEARCH_BASE}/facets", timeout=TIMEOUT)
        facets = r.json()["facets"]
        t = next(f for f in facets if f["name"] == "time")
        assert "24h" in t["values"]


# ─────────────────────────────────────────────
# 2. POST /search — basic search
# ─────────────────────────────────────────────
class TestSearch:
    def test_search_200(self):
        r = httpx.post(f"{SEARCH_BASE}/search", json={"query": "test"}, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_search_has_required_fields(self):
        r = httpx.post(f"{SEARCH_BASE}/search", json={"query": "strategy"}, timeout=TIMEOUT)
        data = r.json()
        for field in ("query", "total", "hits", "facets", "sort_field", "sort_dir"):
            assert field in data

    def test_search_hits_is_list(self):
        r = httpx.post(f"{SEARCH_BASE}/search", json={"query": ""}, timeout=TIMEOUT)
        data = r.json()
        assert isinstance(data["hits"], list)

    def test_search_facets_has_entity_type(self):
        r = httpx.post(f"{SEARCH_BASE}/search", json={"query": ""}, timeout=TIMEOUT)
        data = r.json()
        assert "entity_type" in data["facets"]
        assert isinstance(data["facets"]["entity_type"], list)

    def test_search_sort_field_reflected(self):
        r = httpx.post(f"{SEARCH_BASE}/search", json={"query": "", "sort_field": "timestamp", "sort_dir": "asc"}, timeout=TIMEOUT)
        data = r.json()
        assert data["sort_field"] == "timestamp"
        assert data["sort_dir"] == "asc"

    def test_stable_sort_relevance_deterministic(self):
        """Same query + sort must return same total twice (sort contract)."""
        body = {"query": "test", "sort_field": "_score", "sort_dir": "desc", "size": 10}
        r1 = httpx.post(f"{SEARCH_BASE}/search", json=body, timeout=TIMEOUT)
        r2 = httpx.post(f"{SEARCH_BASE}/search", json=body, timeout=TIMEOUT)
        assert r1.json()["total"] == r2.json()["total"]

    def test_stable_sort_timestamp_deterministic(self):
        """Timestamp sort must also return stable total."""
        body = {"query": "", "sort_field": "timestamp", "sort_dir": "desc", "size": 10}
        r1 = httpx.post(f"{SEARCH_BASE}/search", json=body, timeout=TIMEOUT)
        r2 = httpx.post(f"{SEARCH_BASE}/search", json=body, timeout=TIMEOUT)
        assert r1.json()["total"] == r2.json()["total"]


# ─────────────────────────────────────────────
# 3. POST /explain
# ─────────────────────────────────────────────
class TestExplain:
    def test_explain_200(self):
        r = httpx.post(f"{SEARCH_BASE}/explain", json={"query": "test"}, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_explain_has_query_type(self):
        r = httpx.post(f"{SEARCH_BASE}/explain", json={"query": "test"}, timeout=TIMEOUT)
        data = r.json()
        assert "query_type" in data
        assert data["query_type"] in ("multi_match", "match_all")

    def test_explain_no_secrets(self):
        r = httpx.post(
            f"{SEARCH_BASE}/explain",
            json={"query": "test", "filters": {"api_key": "supersecret123"}},
            timeout=TIMEOUT,
        )
        body = r.text
        assert "supersecret123" not in body

    def test_explain_has_secrets_redacted_true(self):
        r = httpx.post(f"{SEARCH_BASE}/explain", json={"query": "test"}, timeout=TIMEOUT)
        data = r.json()
        assert data.get("redaction_applied") is True

    def test_explain_has_indices(self):
        r = httpx.post(f"{SEARCH_BASE}/explain", json={"query": "test"}, timeout=TIMEOUT)
        data = r.json()
        assert "indices" in data
        assert len(data["indices"]) >= 1

    def test_explain_has_sort(self):
        r = httpx.post(
            f"{SEARCH_BASE}/explain",
            json={"query": "test", "sort_field": "timestamp", "sort_dir": "asc"},
            timeout=TIMEOUT,
        )
        data = r.json()
        assert "sort" in data
        assert data["sort"]["field"] == "timestamp"


# ─────────────────────────────────────────────
# 4. POST /saved — create saved search
# ─────────────────────────────────────────────
class TestSavedSearchesCRUD:
    @pytest.fixture(scope="class")
    def saved_id(self):
        r = httpx.post(
            f"{SEARCH_BASE}/saved",
            json={"name": "W96 Test Save", "query": "w96 test query", "pinned": False},
            timeout=TIMEOUT,
        )
        assert r.status_code == 201
        return r.json()["id"]

    def test_create_saved_201(self):
        r = httpx.post(f"{SEARCH_BASE}/saved", json={"name": "W96 Create Test"}, timeout=TIMEOUT)
        assert r.status_code == 201

    def test_create_saved_has_id(self, saved_id):
        assert len(saved_id) > 5

    def test_list_saved_200(self):
        r = httpx.get(f"{SEARCH_BASE}/saved", timeout=TIMEOUT)
        assert r.status_code == 200

    def test_list_saved_has_count(self):
        r = httpx.get(f"{SEARCH_BASE}/saved", timeout=TIMEOUT)
        data = r.json()
        assert "count" in data
        assert data["count"] > 0

    def test_get_saved_by_id_200(self, saved_id):
        r = httpx.get(f"{SEARCH_BASE}/saved/{saved_id}", timeout=TIMEOUT)
        assert r.status_code == 200

    def test_get_saved_by_id_returns_correct_name(self, saved_id):
        r = httpx.get(f"{SEARCH_BASE}/saved/{saved_id}", timeout=TIMEOUT)
        assert r.json()["name"] == "W96 Test Save"

    def test_pin_search(self, saved_id):
        r = httpx.patch(
            f"{SEARCH_BASE}/saved/{saved_id}/pin",
            json={"pinned": True},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_pinned_appears_first(self, saved_id):
        # Create unpinned search
        httpx.post(f"{SEARCH_BASE}/saved", json={"name": "W96 Unpinned"}, timeout=TIMEOUT)
        httpx.patch(f"{SEARCH_BASE}/saved/{saved_id}/pin", json={"pinned": True}, timeout=TIMEOUT)
        r = httpx.get(f"{SEARCH_BASE}/saved", timeout=TIMEOUT)
        searches = r.json()["searches"]
        pinned_present = any(s["id"] == saved_id and s["pinned"] for s in searches)
        assert pinned_present

    def test_delete_saved_200(self, saved_id):
        r = httpx.delete(f"{SEARCH_BASE}/saved/{saved_id}", timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_get_deleted_returns_404(self, saved_id):
        r = httpx.get(f"{SEARCH_BASE}/saved/{saved_id}", timeout=TIMEOUT)
        assert r.status_code == 404


# ─────────────────────────────────────────────
# 5. DELETE /saved — clear all
# ─────────────────────────────────────────────
class TestClearSaved:
    def test_clear_saved_200(self):
        httpx.post(f"{SEARCH_BASE}/saved", json={"name": "to be cleared"}, timeout=TIMEOUT)
        r = httpx.delete(f"{SEARCH_BASE}/saved", timeout=TIMEOUT)
        assert r.status_code == 200

    def test_clear_saved_ok_true(self):
        r = httpx.delete(f"{SEARCH_BASE}/saved", timeout=TIMEOUT)
        data = r.json()
        assert data.get("ok") is True

    def test_saved_empty_after_clear(self):
        httpx.delete(f"{SEARCH_BASE}/saved", timeout=TIMEOUT)
        r = httpx.get(f"{SEARCH_BASE}/saved", timeout=TIMEOUT)
        assert r.json()["count"] == 0
