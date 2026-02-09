import types
import json

import pytest

from services.options.alpaca_adapter import AlpacaOptionsAdapter


class DummyResp:
    def __init__(self, status, data=None):
        self.status_code = status
        self._data = data

    def json(self):
        return self._data


class DummySession:
    def __init__(self, responses):
        self._responses = responses
        self.calls = []
        self.headers = {}

    def get(self, url, params=None, timeout=None):
        self.calls.append(url)
        return self._responses.pop(0)


def test_rest_probe_falls_back_to_alternate_endpoint(monkeypatch):
    # First endpoint returns 404, second returns 200 with data
    good_payload = {"contracts": [{"option_type": "call", "strike": 100, "expiration": "2026-02-20", "bid": 1.0, "ask": 2.0, "last": 1.5, "volume": 1, "open_interest": 0, "contract_symbol": "AAPL"}], "expirations": ["2026-02-20"]}
    s = DummySession([DummyResp(404, {}), DummyResp(200, good_payload)])

    monkeypatch.setattr('services.options.alpaca_adapter.requests.Session', lambda: s)

    adapter = AlpacaOptionsAdapter()
    chain = adapter.get_chain('AAPL')
    assert chain is not None
    assert chain.provider == 'alpaca'
    assert len(chain.contracts) == 1


def test_rest_probe_returns_none_on_all_404(monkeypatch):
    s = DummySession([DummyResp(404, {}), DummyResp(404, {})])
    monkeypatch.setattr('services.options.alpaca_adapter.requests.Session', lambda: s)

    adapter = AlpacaOptionsAdapter()
    chain = adapter.get_chain('AAPL')
    assert chain is None
