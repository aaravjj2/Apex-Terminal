"""
v1.25 — Multi-Portfolio Valuation tests
Covers: POST /api/v1/portfolios/multi-valuation
"""
import pytest
import httpx

BASE = "http://127.0.0.1:8000"


@pytest.fixture(scope="module")
def client():
    return httpx.Client(base_url=BASE, timeout=10)


def _ensure_demo(client: httpx.Client):
    """Make sure demo portfolios exist."""
    r = client.get("/api/v1/portfolios?sort_by=portfolio_id")
    if r.status_code != 200 or len(r.json().get("portfolios", [])) == 0:
        client.post("/api/v1/portfolios/seed-demo")


# ── Multi-Valuation Endpoint ───────────────────────────────────────

def test_multi_valuation_single(client):
    """Single-portfolio multi-valuation returns correct structure."""
    _ensure_demo(client)
    r = client.post(
        "/api/v1/portfolios/multi-valuation",
        json={"portfolio_ids": ["DEMO-PORT-001"]},
    )
    assert r.status_code == 200
    data = r.json()
    assert "valuations" in data
    assert len(data["valuations"]) == 1
    v = data["valuations"][0]
    assert v["portfolio_id"] == "DEMO-PORT-001"
    assert "net_value" in v
    assert "unrealised_pnl" in v
    assert "positions" in v
    assert data["total_net_value"] == v["net_value"]
    assert data["total_pnl"] == v["unrealised_pnl"]


def test_multi_valuation_multiple(client):
    """Two-portfolio multi-valuation aggregates correctly."""
    _ensure_demo(client)
    r = client.post(
        "/api/v1/portfolios/multi-valuation",
        json={"portfolio_ids": ["DEMO-PORT-001", "DEMO-PORT-002"]},
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["valuations"]) == 2
    # Deterministic order: sorted by portfolio_id
    assert data["valuations"][0]["portfolio_id"] == "DEMO-PORT-001"
    assert data["valuations"][1]["portfolio_id"] == "DEMO-PORT-002"
    # Totals should be sum of individual values
    total_val = sum(v["net_value"] for v in data["valuations"])
    total_pnl = sum(v["unrealised_pnl"] for v in data["valuations"])
    assert abs(data["total_net_value"] - total_val) < 0.01
    assert abs(data["total_pnl"] - total_pnl) < 0.01


def test_multi_valuation_deterministic(client):
    """Same input → same output (determinism gate)."""
    _ensure_demo(client)
    ids = ["DEMO-PORT-002", "DEMO-PORT-001"]  # Intentionally reversed
    r1 = client.post("/api/v1/portfolios/multi-valuation", json={"portfolio_ids": ids})
    r2 = client.post("/api/v1/portfolios/multi-valuation", json={"portfolio_ids": ids})
    assert r1.status_code == 200
    assert r2.status_code == 200
    # Both calls produce identical JSON (deterministic ordering)
    assert r1.json() == r2.json()
    # Order should be normalized regardless of input order
    assert r1.json()["valuations"][0]["portfolio_id"] == "DEMO-PORT-001"


def test_multi_valuation_empty_list(client):
    """Empty portfolio list returns empty results."""
    r = client.post(
        "/api/v1/portfolios/multi-valuation",
        json={"portfolio_ids": []},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["valuations"] == []
    assert data["total_net_value"] == 0
    assert data["total_pnl"] == 0


def test_multi_valuation_nonexistent_portfolio(client):
    """Non-existent portfolio is skipped gracefully."""
    _ensure_demo(client)
    r = client.post(
        "/api/v1/portfolios/multi-valuation",
        json={"portfolio_ids": ["DOES-NOT-EXIST"]},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["valuations"] == []
    assert data["total_net_value"] == 0


def test_multi_valuation_mixed_existing_nonexisting(client):
    """Mix of real + fake IDs returns only real portfolio."""
    _ensure_demo(client)
    r = client.post(
        "/api/v1/portfolios/multi-valuation",
        json={"portfolio_ids": ["DEMO-PORT-001", "FAKE-123"]},
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["valuations"]) == 1
    assert data["valuations"][0]["portfolio_id"] == "DEMO-PORT-001"
