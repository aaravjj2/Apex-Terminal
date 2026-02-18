import os
import types
import sys
import pytest


@pytest.fixture
def fake_api_modules():
    """Create fake api modules and restore them after the test."""
    # Save original modules
    original_api = sys.modules.get('services.api')
    original_api_main = sys.modules.get('services.api.main')
    original_api_ws = sys.modules.get('services.api.websocket')
    
    # Create fakes
    sys.modules['services.api'] = types.ModuleType('services.api')
    sys.modules['services.api.main'] = types.ModuleType('services.api.main')
    fake_ws = types.ModuleType('services.api.websocket')
    fake_ws.on_bar_update = lambda *a, **k: None
    fake_ws.on_bar_confirmed = lambda *a, **k: None
    sys.modules['services.api.websocket'] = fake_ws
    
    yield
    
    # Restore original modules
    if original_api is not None:
        sys.modules['services.api'] = original_api
    else:
        sys.modules.pop('services.api', None)
    if original_api_main is not None:
        sys.modules['services.api.main'] = original_api_main
    else:
        sys.modules.pop('services.api.main', None)
    if original_api_ws is not None:
        sys.modules['services.api.websocket'] = original_api_ws
    else:
        sys.modules.pop('services.api.websocket', None)


def test_ingestion_auto_switch(monkeypatch, fake_api_modules):
    # Ensure environment clears any existing keys
    for v in ('ALPACA3_KEY','ALPACA3_SECRET','APCA_API_KEY_ID','APCA_API_SECRET_KEY'):
        monkeypatch.delenv(v, raising=False)

    # Patch get_settings to return no Alpaca keys initially
    import services.config as cfg
    monkeypatch.setattr(cfg, 'get_settings', lambda: __import__('types').SimpleNamespace(apca_api_key_id=None, apca_api_secret_key=None, symbols_list=['AAPL','MSFT']))

    # Also patch any local imports in ingestion module (in case module was already imported)
    import services.ingestion.main as ing_main
    monkeypatch.setattr(ing_main, 'get_settings', lambda: __import__('types').SimpleNamespace(apca_api_key_id=None, apca_api_secret_key=None, symbols_list=['AAPL','MSFT']))

    # Import after stubbing to avoid circular import
    from services.ingestion.main import IngestionService

    # If no keys present, mock mode stays
    svc = IngestionService(mode='mock')
    assert svc.mode == 'mock'

    # Now set Alpaca key and ensure auto-switch
    monkeypatch.setenv('ALPACA3_KEY', 'fakekey')
    monkeypatch.setenv('ALPACA3_SECRET', 'fakesecret')

    # Patch get_settings to reflect presence of Alpaca keys
    monkeypatch.setattr(cfg, 'get_settings', lambda: __import__('types').SimpleNamespace(apca_api_key_id='fakekey', apca_api_secret_key='fakesecret', symbols_list=['AAPL','MSFT']))

    svc2 = IngestionService(mode='mock')
    assert svc2.mode == 'live'
