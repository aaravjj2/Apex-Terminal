"""
Unit tests for v1.14 replay service.

Tests canonical key generation, replay save/retrieve, and replay-first policy enforcement.
"""

import pytest
import json
import hashlib
from pathlib import Path
from datetime import datetime
from phase1.services.market_data.replay import (
    _canonical_key,
    has_replay,
    get_replay,
    save_replay,
    list_replays,
    clear_replays,
    REPLAY_DIR
)


def test_canonical_key_deterministic():
    """Canonical keys must be stable for same params regardless of key order."""
    params1 = {"symbol": "AAPL", "start": "2024-01-01", "end": "2024-01-31"}
    params2 = {"end": "2024-01-31", "symbol": "AAPL", "start": "2024-01-01"}  # Different order
    
    key1 = _canonical_key("bars", params1)
    key2 = _canonical_key("bars", params2)
    
    assert key1 == key2, "Keys must be order-independent"
    assert key1.startswith("bars_"), "Keys must be prefixed with request type"
    assert len(key1) == 21, "Keys should be bars_ + 16 hex chars"


def test_canonical_key_differs_by_params():
    """Different params must produce different keys."""
    params1 = {"symbol": "AAPL", "start": "2024-01-01", "end": "2024-01-31"}
    params2 = {"symbol": "TSLA", "start": "2024-01-01", "end": "2024-01-31"}
    
    key1 = _canonical_key("bars", params1)
    key2 = _canonical_key("bars", params2)
    
    assert key1 != key2, "Different symbols must produce different keys"


def test_canonical_key_differs_by_request_type():
    """Same params but different request types must produce different keys."""
    params = {"symbol": "AAPL", "start": "2024-01-01", "end": "2024-01-31"}
    
    key1 = _canonical_key("bars", params)
    key2 = _canonical_key("quote", params)
    
    assert key1.startswith("bars_"), "First key should start with bars_"
    assert key2.startswith("quote_"), "Second key should start with quote_"
    assert key1 != key2, "Different request types must produce different keys"


def test_replay_save_and_retrieve():
    """Replay artifacts can be saved and retrieved."""
    clear_replays()  # Clean slate
    
    params = {"symbol": "TEST", "start": "2024-01-01", "end": "2024-01-31"}
    data = {"bars": [{"open": 100, "close": 101}]}
    
    # Initially no replay
    assert not has_replay("bars", params), "Should not have replay initially"
    
    # Save replay
    save_replay("bars", params, data)
    assert has_replay("bars", params), "Should have replay after save"
    
    # Retrieve replay
    retrieved = get_replay("bars", params)
    assert retrieved is not None, "Should retrieve saved replay"
    assert "meta" in retrieved, "Should have meta field"
    assert "data" in retrieved, "Should have data field"
    assert retrieved["data"] == data, "Retrieved data should match saved data"
    assert retrieved["meta"]["request_type"] == "bars", "Request type should match"
    assert retrieved["meta"]["params"] == params, "Params should match"
    assert "captured_at" in retrieved["meta"], "Should have captured_at timestamp"


def test_replay_missing_returns_none():
    """get_replay returns None when replay doesn't exist."""
    clear_replays()
    
    params = {"symbol": "MISSING", "start": "2024-01-01", "end": "2024-01-31"}
    
    assert not has_replay("bars", params), "Should not have replay"
    assert get_replay("bars", params) is None, "Should return None for missing replay"


def test_list_replays():
    """list_replays returns all replay artifacts."""
    clear_replays()
    
    # Save multiple replays
    save_replay("bars", {"symbol": "AAPL"}, {"bars": []})
    save_replay("bars", {"symbol": "TSLA"}, {"bars": []})
    save_replay("quote", {"symbol": "AAPL"}, {"quote": {}})
    
    replays = list_replays()
    assert len(replays) >= 3, f"Should have at least 3 replays, got {len(replays)}"
    
    # Check structure (uses 'key' not 'canonical_key')
    for replay in replays:
        assert "key" in replay, "Should have 'key' field"
        assert "request_type" in replay
        assert "params" in replay
        assert "captured_at" in replay


def test_clear_replays():
    """clear_replays deletes replay artifacts."""
    clear_replays()
    
    # Save bars replay
    save_replay("bars", {"symbol": "AAPL"}, {"bars": []})
    save_replay("quote", {"symbol": "AAPL"}, {"quote": {}})
    
    assert has_replay("bars", {"symbol": "AAPL"}), "Should have bars replay"
    assert has_replay("quote", {"symbol": "AAPL"}), "Should have quote replay"
    
    # Clear only bars
    count = clear_replays("bars")
    assert count >= 1, "Should have cleared at least 1 bars replay"
    assert not has_replay("bars", {"symbol": "AAPL"}), "Should not have bars replay after clear"
    assert has_replay("quote", {"symbol": "AAPL"}), "Quote replay should still exist"


def test_replay_blocks_provider_fetch(mocker):
    """When replay exists, provider CSV file should NOT be accessed."""
    from phase1.services.market_data.providers import DemoProvider
    from phase1.services.market_data.providers.types import BarsRequest
    from datetime import datetime
    import asyncio
    
    clear_replays()
    
    # Save a replay
    params = {"symbol": "AAPL", "start": "2024-01-01T00:00:00", "end": "2024-01-31T23:59:59", "interval": "1d"}
    data = {
        "bars": [
            {
                "timestamp": "2024-01-15T00:00:00",
                "open": 150.0,
                "high": 151.0,
                "low": 149.0,
                "close": 150.5,
                "volume": 1000000
            }
        ]
    }
    save_replay("bars", params, data)
    
    # Create provider (replay save disabled)
    provider = DemoProvider(enable_replay_save=False)
    
    # Request bars
    request = BarsRequest(
        symbol="AAPL",
        start=datetime(2024, 1, 1),
        end=datetime(2024, 1, 31, 23, 59, 59),
        interval="1d"
    )
    
    response = asyncio.run(provider.get_bars(request))
    
    # Response should use replay (cached=True)
    assert response.cached is True, "Response should be marked as cached (replay hit)"
    assert len(response.bars) > 0, "Should have bars from replay"
    assert response.bars[0].open == 150.0, "Should have correct data from replay"


def test_replay_deterministic_json():
    """Replay JSON serialization is deterministic."""
    clear_replays()
    
    params1 = {"symbol": "AAPL", "start": "2024-01-01", "end": "2024-01-31"}
    params2 = {"end": "2024-01-31", "symbol": "AAPL", "start": "2024-01-01"}  # Different order
    data = {"bars": [{"open": 100}]}
    
    save_replay("bars", params1, data)
    key1 = _canonical_key("bars", params1)
    file1 = REPLAY_DIR / f"{key1}.json"
    
    clear_replays()
    
    save_replay("bars", params2, data)
    key2 = _canonical_key("bars", params2)
    file2 = REPLAY_DIR / f"{key2}.json"
    
    # Keys should be identical
    assert key1 == key2
    
    # File contents should be identical (excluding captured_at timestamp)
    with open(file1, 'r') as f:
        content1 = json.load(f)
    with open(file2, 'r') as f:
        content2 = json.load(f)
    
    # Normalize timestamps
    if 'meta' in content1:
        content1['meta'].pop('captured_at', None)
    if 'meta' in content2:
        content2['meta'].pop('captured_at', None)
    
    # Should be identical
    assert content1 == content2, "Replay JSON should be deterministic"
