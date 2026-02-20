"""
Ticker API backward compatibility contract tests.
Ensures both 'symbol' and 'ticker' fields are accepted in request bodies.
Uses FastAPI TestClient.
"""
import pytest


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient
    import os
    os.environ.setdefault("E2E_MODE", "1")
    from services.api.main import app
    with TestClient(app) as c:
        yield c


class TestTickerResolveCompat:
    """POST /api/v1/ticker/resolve accepts both 'ticker' and 'symbol'."""

    def test_resolve_with_ticker_field(self, client):
        r = client.post("/api/v1/ticker/resolve",
                       json={"ticker": "BRK-B"})
        assert r.status_code == 200
        body = r.json()
        assert body["ticker"] == "BRK.B"
        assert body["confidence"] == "high"
        assert body["collision"] is False

    def test_resolve_with_symbol_field_backward_compat(self, client):
        r = client.post("/api/v1/ticker/resolve",
                       json={"symbol": "BRK-B"})
        assert r.status_code == 200
        body = r.json()
        assert body["ticker"] == "BRK.B"
        assert body["confidence"] == "high"

    def test_resolve_collision_ticker(self, client):
        r = client.post("/api/v1/ticker/resolve",
                       json={"ticker": "ON"})
        assert r.status_code == 200
        body = r.json()
        assert body["collision"] is True
        assert body["confidence"] == "low"


class TestTickerBatchCompat:
    """POST /api/v1/ticker/resolve/batch accepts both 'tickers' and 'symbols'."""

    def test_batch_with_tickers_field(self, client):
        r = client.post("/api/v1/ticker/resolve/batch",
                       json={"tickers": ["AAPL", "SPY"]})
        assert r.status_code == 200
        body = r.json()
        results = body["results"]
        assert len(results) == 2
        assert results[0]["ticker"] == "AAPL"

    def test_batch_with_symbols_field_backward_compat(self, client):
        r = client.post("/api/v1/ticker/resolve/batch",
                       json={"symbols": ["AAPL", "SPY"]})
        assert r.status_code == 200
        body = r.json()
        results = body["results"]
        assert len(results) == 2


class TestTickerNormalizeCompat:
    """POST /api/v1/ticker/normalize accepts both 'ticker' and 'symbol'."""

    def test_normalize_with_ticker_field(self, client):
        r = client.post("/api/v1/ticker/normalize",
                       json={"ticker": "brk/b"})
        assert r.status_code == 200
        assert r.json()["normalized"] == "BRK.B"

    def test_normalize_with_symbol_field_backward_compat(self, client):
        r = client.post("/api/v1/ticker/normalize",
                       json={"symbol": "brk/b"})
        assert r.status_code == 200
        assert r.json()["normalized"] == "BRK.B"
