import asyncio
import types
import pytest

from services.options.alpaca_ws_adapter import AlpacaOptionsWSAdapter


class DummyWS:
    open = True
    closed = False

    def __init__(self, recv_messages):
        self._recv = recv_messages

    async def send(self, payload):
        # no-op
        pass

    async def recv(self):
        if not self._recv:
            await asyncio.sleep(0.001)
            raise asyncio.TimeoutError()
        return self._recv.pop(0)

    async def close(self):
        self.open = False
        self.closed = True


class DummyConnect:
    def __init__(self, ws):
        self.ws = ws

    async def __aenter__(self):
        return self.ws

    async def __aexit__(self, exc_type, exc, tb):
        return False


@pytest.mark.asyncio
async def test_ws_adapter_parses_chain(monkeypatch):
    # Build a fake chain message
    msg = {
        "type": "chain",
        "symbol": "AAPL",
        "expirations": ["2026-02-20"],
        "contracts": [{"option_type": "call", "strike": 100, "expiration": "2026-02-20", "bid": 1.0, "ask": 2.0, "last": 1.5, "volume": 1, "open_interest": 0, "contract_symbol": "AAPL260220C00100000"}]
    }
    ws = DummyWS([json := __import__('json').dumps(msg)])

    def fake_connect(url):
        return DummyConnect(ws)

    monkeypatch.setattr('services.options.alpaca_ws_adapter.websockets.connect', lambda url: fake_connect(url))

    adapter = AlpacaOptionsWSAdapter()

    collected = []

    async def cb(chain):
        collected.append(chain)

    adapter.register_callback(cb)

    # Run connect then stop shortly after
    await adapter.connect()
    await asyncio.sleep(0.05)
    await adapter.disconnect()

    assert len(collected) == 1
    assert collected[0].symbol == 'AAPL'
