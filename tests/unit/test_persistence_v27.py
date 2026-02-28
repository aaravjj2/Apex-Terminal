"""
v1.27 — Portfolio Persistence Hardening + Session-State Audit
Uses shared FastAPI TestClient from conftest.
"""
import pytest


@pytest.fixture(scope="module")
def client(test_client):
    """Re-use session-scoped test_client to avoid async teardown errors."""
    return test_client


def _reset(client):
    """Reset store to fixtures."""
    r = client.post("/api/v1/portfolios/reset")
    assert r.status_code == 200


# ── Fixture Integrity ───────────────────────────────────────────────

def test_reset_restores_fixture_state(client):
    """After reset, demo fixtures are intact."""
    _reset(client)
    r = client.get("/api/v1/portfolios?sort_by=portfolio_id")
    assert r.status_code == 200
    portfolios = r.json()["portfolios"]
    ids = [p["portfolio_id"] for p in portfolios]
    assert "DEMO-PORT-001" in ids
    assert "DEMO-PORT-002" in ids


def test_reset_idempotent(client):
    """Two resets produce identical state."""
    _reset(client)
    r1 = client.get("/api/v1/portfolios?sort_by=portfolio_id")
    _reset(client)
    r2 = client.get("/api/v1/portfolios?sort_by=portfolio_id")
    assert r1.json() == r2.json()


# ── CRUD Persistence ───────────────────────────────────────────────

def test_create_persists_across_reads(client):
    """Created portfolio appears on subsequent reads."""
    _reset(client)
    create_r = client.post("/api/v1/portfolios", json={
        "name": "Persistence Test",
        "currency": "USD",
        "cash_balance": "1000.00",
    })
    assert create_r.status_code in (200, 201)
    new_id = create_r.json()["portfolio_id"]

    list_r = client.get("/api/v1/portfolios?sort_by=portfolio_id")
    ids = [p["portfolio_id"] for p in list_r.json()["portfolios"]]
    assert new_id in ids

    get_r = client.get(f"/api/v1/portfolios/{new_id}")
    assert get_r.status_code == 200
    assert get_r.json()["name"] == "Persistence Test"


def test_update_persists(client):
    """Updated name persists on next read."""
    _reset(client)
    client.put("/api/v1/portfolios/DEMO-PORT-001", json={
        "name": "Updated Name",
    })
    r = client.get("/api/v1/portfolios/DEMO-PORT-001")
    assert r.status_code == 200
    assert r.json()["name"] == "Updated Name"


def test_delete_persists(client):
    """Deleted portfolio is gone on next read."""
    _reset(client)
    del_r = client.delete("/api/v1/portfolios/DEMO-PORT-001")
    assert del_r.status_code in (200, 204)

    list_r = client.get("/api/v1/portfolios?sort_by=portfolio_id")
    ids = [p["portfolio_id"] for p in list_r.json()["portfolios"]]
    assert "DEMO-PORT-001" not in ids


def test_position_add_persists(client):
    """Added position appears on re-read."""
    _reset(client)
    client.post("/api/v1/portfolios/DEMO-PORT-002/positions", json={
        "symbol": "TSLA",
        "quantity": "10",
        "cost_basis_per_unit": "200.00",
    })
    r = client.get("/api/v1/portfolios/DEMO-PORT-002")
    symbols = [p["symbol"] for p in r.json()["positions"]]
    assert "TSLA" in symbols


# ── Content Hash Stability ──────────────────────────────────────────

def test_content_hash_stable_after_valuation(client):
    """Valuation does not alter the portfolio's content_hash."""
    _reset(client)
    r1 = client.get("/api/v1/portfolios/DEMO-PORT-001")
    hash_before = r1.json().get("content_hash")

    client.get("/api/v1/portfolios/DEMO-PORT-001/valuation")

    r2 = client.get("/api/v1/portfolios/DEMO-PORT-001")
    hash_after = r2.json().get("content_hash")
    assert hash_before == hash_after


def test_export_does_not_mutate_store(client):
    """Export operation is read-only (no store mutation)."""
    _reset(client)
    r_before = client.get("/api/v1/portfolios?sort_by=portfolio_id")

    client.get("/api/v1/portfolios/DEMO-PORT-001/export")
    client.get("/api/v1/portfolios/DEMO-PORT-002/export")

    r_after = client.get("/api/v1/portfolios?sort_by=portfolio_id")
    assert r_before.json() == r_after.json()


# ── Multi-Valuation State Isolation ─────────────────────────────────

def test_multi_valuation_does_not_mutate_store(client):
    """Multi-valuation is read-only."""
    _reset(client)
    r_before = client.get("/api/v1/portfolios?sort_by=portfolio_id")

    client.post("/api/v1/portfolios/multi-valuation", json={
        "portfolio_ids": ["DEMO-PORT-001", "DEMO-PORT-002"],
    })

    r_after = client.get("/api/v1/portfolios?sort_by=portfolio_id")
    assert r_before.json() == r_after.json()
