"""
Ticker API backward compatibility contract tests.
Ensures both 'symbol' and 'ticker' fields are accepted in request bodies.
"""
import pytest
import httpx

BACKEND_URL = "http://localhost:8000"


def _backend_available() -> bool:
    try:
        r = httpx.get(f"{BACKEND_URL}/health", timeout=3)
        return r.status_code == 200
    except Exception:
        return False


@pytest.fixture(scope="module")
def backend():
    if not _backend_available():
        pytest.skip("Backend not available")


class TestTickerResolveCompat:
    """POST /api/v1/ticker/resolve accepts both 'ticker' and 'symbol'."""

    def test_resolve_with_ticker_field(self, backend):
        r = httpx.post(f"{BACKEND_URL}/api/v1/ticker/resolve",
                       json={"ticker": "BRK-B"}, timeout=5)
        assert r.status_code == 200
        body = r.json()
        assert body["ticker"] == "BRK.B"
        assert body["confidence"] == "high"
        assert body["collision"] is False

    def test_resolve_with_symbol_field_backward_compat(self, backend):
        r = httpx.post(f"{BACKEND_URL}/api/v1/ticker/resolve",
                       json={"symbol": "BRK-B"}, timeout=5)
        assert r.status_code == 200
        body = r.json()
        assert body["ticker"] == "BRK.B"
        assert body["confidence"] == "high"

    def test_resolve_collision_ticker(self, backend):
        r = httpx.post(f"{BACKEND_URL}/api/v1/ticker/resolve",
                       json={"ticker": "ON"}, timeout=5)
        assert r.status_code == 200
        body = r.json()
        assert body["collision"] is True
        assert body["confidence"] == "low"


class TestTickerBatchCompat:
    """POST /api/v1/ticker/resolve/batch accepts both 'tickers' and 'symbols'."""

    def test_batch_with_tickers_field(self, backend):
        r = httpx.post(f"{BACKEND_URL}/api/v1/ticker/resolve/batch",
                       json={"tickers": ["AAPL", "SPY"]}, timeout=5)
        assert r.status_code == 200
        body = r.json()
        results = body["results"]
        assert len(results) == 2
        assert results[0]["ticker"] == "AAPL"

    def test_batch_with_symbols_field_backward_compat(self, backend):
        r = httpx.post(f"{BACKEND_URL}/api/v1/ticker/resolve/batch",
                       json={"symbols": ["AAPL", "SPY"]}, timeout=5)
        assert r.status_code == 200
        body = r.json()
        results = body["results"]
        assert len(results) == 2


class TestTickerNormalizeCompat:
    """POST /api/v1/ticker/normalize accepts both 'ticker' and 'symbol'."""

    def test_normalize_with_ticker_field(self, backend):
        r = httpx.post(f"{BACKEND_URL}/api/v1/ticker/normalize",
                       json={"ticker": "brk/b"}, timeout=5)
        assert r.status_code == 200
        assert r.json()["normalized"] == "BRK.B"

    def test_normalize_with_symbol_field_backward_compat(self, backend):
        r = httpx.post(f"{BACKEND_URL}/api/v1/ticker/normalize",
                       json={"symbol": "brk/b"}, timeout=5)
        assert r.status_code == 200
        assert r.json()["normalized"] == "BRK.B"
