from datetime import datetime, date
from fastapi.testclient import TestClient

from services.api.main import app


def test_options_chain_returns_alpaca_provider(monkeypatch):
    # Fake adapter that returns an OptionChain with provider 'alpaca'
    class FakeAdapter:
        def get_chain(self, symbol, exp_date=None):
            from services.options.models import OptionChain

            return OptionChain(
                symbol=symbol,
                underlying_price=123.45,
                expirations=[date.today()],
                contracts=[],
                timestamp=datetime.utcnow(),
                provider="alpaca",
            )

    # Patch the function used by the route module (it imports get_options_adapter)
    monkeypatch.setattr('services.api.routes.options.get_options_adapter', lambda: FakeAdapter())

    client = TestClient(app)
    r = client.get('/api/v1/options/chain/AAPL')
    assert r.status_code == 200
    body = r.json()
    assert body.get('provider') == 'alpaca'
