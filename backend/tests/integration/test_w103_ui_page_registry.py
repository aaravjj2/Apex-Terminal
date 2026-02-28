"""W103 — UI Page Registry integration tests (≥24 tests)."""
import pytest
import httpx

BASE = "http://localhost:8090/api/v3/pages"


@pytest.fixture(autouse=True)
def clear_data():
    """Clear heartbeats/snapshots before each test."""
    yield
    httpx.delete(f"{BASE}/data", timeout=15)


# ─── Registry endpoint ───────────────────────────────────────────────────────

def test_get_registry_returns_200():
    r = httpx.get(f"{BASE}/registry", timeout=10)
    assert r.status_code == 200


def test_get_registry_has_seven_pages():
    r = httpx.get(f"{BASE}/registry", timeout=10)
    data = r.json()
    assert data["page_count"] == 7
    assert len(data["pages"]) == 7


def test_get_registry_version():
    r = httpx.get(f"{BASE}/registry", timeout=10)
    assert r.json()["version"] == "w103-v1.0"


def test_get_registry_has_hash():
    r = httpx.get(f"{BASE}/registry", timeout=10)
    assert len(r.json()["hash"]) == 64  # SHA-256 hex


def test_get_registry_has_two_components():
    r = httpx.get(f"{BASE}/registry", timeout=10)
    assert len(r.json()["components"]) == 2


def test_get_registry_hash_deterministic():
    h1 = httpx.get(f"{BASE}/registry", timeout=10).json()["hash"]
    h2 = httpx.get(f"{BASE}/registry", timeout=10).json()["hash"]
    assert h1 == h2


# ─── Pages list endpoint ─────────────────────────────────────────────────────

def test_list_pages_returns_200():
    r = httpx.get(f"{BASE}/pages", timeout=10)
    assert r.status_code == 200


def test_list_pages_count():
    r = httpx.get(f"{BASE}/pages", timeout=10)
    data = r.json()
    assert data["count"] == 7
    assert len(data["pages"]) == 7


def test_list_pages_all_core_ids_present():
    r = httpx.get(f"{BASE}/pages", timeout=10)
    ids = {p["id"] for p in r.json()["pages"]}
    expected = {"search", "backtest", "strategy-optimizer", "job-queue", "agent", "ops", "auditor"}
    assert ids == expected


def test_list_pages_group_filter():
    r = httpx.get(f"{BASE}/pages?group=core", timeout=10)
    data = r.json()
    assert data["count"] == 7
    for p in data["pages"]:
        assert p["group"] == "core"


def test_list_pages_all_have_shell_version_w103():
    r = httpx.get(f"{BASE}/pages", timeout=10)
    for p in r.json()["pages"]:
        assert p["shell_version"] == "w103"


# ─── Single page endpoint ─────────────────────────────────────────────────────

def test_get_page_by_id_returns_200():
    r = httpx.get(f"{BASE}/pages/search", timeout=10)
    assert r.status_code == 200


def test_get_page_by_id_correct_path():
    r = httpx.get(f"{BASE}/pages/auditor", timeout=10)
    assert r.json()["path"] == "/ui2/auditor"


def test_get_page_by_id_unknown_returns_404():
    r = httpx.get(f"{BASE}/pages/nonexistent-page", timeout=10)
    assert r.status_code == 404


# ─── Components endpoint ─────────────────────────────────────────────────────

def test_list_components_returns_200():
    r = httpx.get(f"{BASE}/components", timeout=10)
    assert r.status_code == 200


def test_list_components_has_page_shell_and_data_table():
    r = httpx.get(f"{BASE}/components", timeout=10)
    ids = {c["id"] for c in r.json()["components"]}
    assert "PageShellUI2" in ids
    assert "DataTableUI2" in ids


def test_get_component_page_shell():
    r = httpx.get(f"{BASE}/components/PageShellUI2", timeout=10)
    assert r.status_code == 200
    assert r.json()["type"] == "wrapper"


def test_get_component_data_table_features():
    r = httpx.get(f"{BASE}/components/DataTableUI2", timeout=10)
    features = r.json()["features"]
    for feat in ["toolbar", "search", "export", "virtualization"]:
        assert feat in features


def test_get_component_unknown_returns_404():
    r = httpx.get(f"{BASE}/components/NonexistentComponent", timeout=10)
    assert r.status_code == 404


# ─── Shell states endpoint ────────────────────────────────────────────────────

def test_get_shell_states():
    r = httpx.get(f"{BASE}/shell-states", timeout=10)
    assert r.status_code == 200
    states = r.json()["states"]
    for s in ["loading", "ready", "empty", "error"]:
        assert s in states


# ─── Heartbeat endpoint ───────────────────────────────────────────────────────

def test_post_heartbeat_returns_201():
    r = httpx.post(f"{BASE}/heartbeat", json={"page_id": "search", "status": "ready"}, timeout=10)
    assert r.status_code == 201


def test_post_heartbeat_has_heartbeat_id():
    r = httpx.post(f"{BASE}/heartbeat", json={"page_id": "ops", "status": "loading"}, timeout=10)
    assert "heartbeat_id" in r.json()


def test_post_heartbeat_invalid_status_422():
    r = httpx.post(f"{BASE}/heartbeat", json={"page_id": "search", "status": "invalid-state"}, timeout=10)
    assert r.status_code == 422


def test_post_heartbeat_unknown_page_404():
    r = httpx.post(f"{BASE}/heartbeat", json={"page_id": "nonexistent", "status": "ready"}, timeout=10)
    assert r.status_code == 404


def test_get_heartbeats_accumulates():
    httpx.post(f"{BASE}/heartbeat", json={"page_id": "search", "status": "loading"}, timeout=10)
    httpx.post(f"{BASE}/heartbeat", json={"page_id": "search", "status": "ready"}, timeout=10)
    r = httpx.get(f"{BASE}/heartbeats?page_id=search", timeout=10)
    assert r.json()["count"] >= 2


def test_delete_data_clears_heartbeats():
    httpx.post(f"{BASE}/heartbeat", json={"page_id": "backtest", "status": "ready"}, timeout=10)
    httpx.delete(f"{BASE}/data", timeout=10)
    r = httpx.get(f"{BASE}/heartbeats", timeout=10)
    assert r.json()["count"] == 0


# ─── Snapshots endpoint ───────────────────────────────────────────────────────

def test_post_snapshot_returns_201():
    r = httpx.post(f"{BASE}/snapshots", timeout=15)
    assert r.status_code == 201


def test_post_snapshot_has_snapshot_id():
    r = httpx.post(f"{BASE}/snapshots", timeout=15)
    assert "snapshot_id" in r.json()


def test_post_snapshot_page_count_7():
    r = httpx.post(f"{BASE}/snapshots", timeout=15)
    assert r.json()["page_count"] == 7
