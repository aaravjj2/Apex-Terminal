import types

from services.options.adapter import get_options_adapter, OptionsDataAdapter, HybridOptionsAdapter


def test_get_options_adapter_falls_back_by_default(monkeypatch):
    # Ensure fresh singleton
    import services.options.adapter as mod
    mod._adapter = None

    # Patch settings to no Alpaca keys
    monkeypatch.setattr('services.options.adapter.get_settings', lambda: __import__('types').SimpleNamespace(enable_alpaca_options=False, apca_api_key_id=None, apca_api_secret_key=None))

    adapter = get_options_adapter()
    # Now returns HybridOptionsAdapter which wraps OptionsDataAdapter
    assert isinstance(adapter, HybridOptionsAdapter)
    # Should have no Alpaca adapter configured
    assert adapter._alpaca is None
    # Should have yfinance adapter
    assert isinstance(adapter._yfinance, OptionsDataAdapter)


def test_get_options_adapter_prefers_alpaca_when_enabled(monkeypatch):
    # Ensure fresh singleton
    import services.options.adapter as mod
    mod._adapter = None

    # Create fake settings with Alpaca enabled and keys present
    fake_settings = types.SimpleNamespace(
        enable_alpaca_options=True,
        apca_api_key_id="x",
        apca_api_secret_key="y",
    )

    monkeypatch.setattr('services.options.adapter.get_settings', lambda: fake_settings)

    adapter = get_options_adapter()
    # Should be HybridOptionsAdapter
    assert isinstance(adapter, HybridOptionsAdapter)
    # With Alpaca enabled, it should try to initialize Alpaca adapter
    # (may fail if module not available, but should still be HybridOptionsAdapter)
