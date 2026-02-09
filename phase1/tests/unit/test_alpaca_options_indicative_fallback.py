import types

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


def test_indicative_fallback_parses_quotes(monkeypatch):
    # Simulate no chain endpoints, then indicative quotes endpoint returns data
    indicative_payload = [
        {"contract_symbol": "AAPL260116C00260000", "option_type": "call", "strike": 260, "expiration": "2026-01-16", "bid": 2.5, "ask": 3.0, "last": 2.8, "volume": 10, "open_interest": 5}
    ]

    s = DummySession([DummyResp(404, {}), DummyResp(404, {}), DummyResp(404, {}), DummyResp(404, {}), DummyResp(200, indicative_payload)])
    monkeypatch.setattr('services.options.alpaca_adapter.requests.Session', lambda: s)

    adapter = AlpacaOptionsAdapter()
    chain = adapter.get_chain('AAPL')
    assert chain is not None
    assert chain.provider == 'alpaca-indicative'
    assert len(chain.contracts) == 1
