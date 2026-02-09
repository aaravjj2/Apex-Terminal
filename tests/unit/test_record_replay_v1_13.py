"""
Tests for v1.13 Record/Replay Substrate (Objective L)
All tests run offline - no network calls.
"""

import pytest
import json
import tempfile
from pathlib import Path
from phase1.services.market_data.record_replay import (
    RecordReplayCache,
    ReplayArtifact,
    MarketDataSource,
    reset_cache,
    get_cache
)


@pytest.fixture
def temp_cache_dir(tmp_path):
    """Temporary cache directory for testing."""
    return tmp_path / "test_cache"


@pytest.fixture
def cache(temp_cache_dir):
    """RecordReplayCache instance with temporary directory."""
    return RecordReplayCache(cache_dir=temp_cache_dir)


def test_compute_cache_key_deterministic(cache):
    """Cache key should be deterministic for identical requests."""
    request1 = {"symbol": "AAPL", "start": "2023-01-01", "end": "2023-01-31"}
    request2 = {"end": "2023-01-31", "symbol": "AAPL", "start": "2023-01-01"}  # Different order
    
    key1 = cache.compute_cache_key("yahoo", request1)
    key2 = cache.compute_cache_key("yahoo", request2)
    
    assert key1 == key2, "Cache keys should be identical for reordered params"
    assert len(key1) == 64, "Cache key should be SHA256 (64 hex chars)"


def test_compute_cache_key_different_provider(cache):
    """Different providers should produce different cache keys."""
    request = {"symbol": "AAPL"}
    
    key_yahoo = cache.compute_cache_key("yahoo", request)
    key_alpaca = cache.compute_cache_key("alpaca", request)
    
    assert key_yahoo != key_alpaca


def test_compute_cache_key_different_request(cache):
    """Different requests should produce different cache keys."""
    key1 = cache.compute_cache_key("yahoo", {"symbol": "AAPL"})
    key2 = cache.compute_cache_key("yahoo", {"symbol": "TSLA"})
    
    assert key1 != key2


def test_save_and_load_replay(cache, temp_cache_dir):
    """Should save and load replay artifacts."""
    provider = "yahoo"
    request = {"symbol": "AAPL", "date": "2023-01-01"}
    response = {"bars": [{"time": "2023-01-01T09:30:00Z", "close": 130.0}]}
    
    # Save
    artifact = cache.save_replay(provider, request, response)
    
    assert artifact.provider == provider
    assert artifact.request == request
    assert artifact.response == response
    assert len(artifact.cache_key) == 64
    assert len(artifact.checksum) == 64
    assert "T" in artifact.fetched_at  # ISO timestamp
    
    # Verify file exists
    replay_path = cache.get_replay_path(artifact.cache_key)
    assert replay_path.exists()
    
    # Load from disk
    loaded = cache.load_replay(artifact.cache_key)
    assert loaded is not None
    assert loaded.provider == provider
    assert loaded.request == request
    assert loaded.response == response
    assert loaded.cache_key == artifact.cache_key


def test_load_replay_not_found(cache):
    """Should return None for non-existent replay."""
    result = cache.load_replay("nonexistent_key_1234567890abcdef" * 2)
    assert result is None


def test_get_or_fetch_replay_hit(cache):
    """Should return replay data without calling fetch_fn."""
    provider = "yahoo"
    request = {"symbol": "AAPL"}
    response = {"close": 130.0}
    
    # Pre-save replay
    cache.save_replay(provider, request, response)
    
    # get_or_fetch should NOT call fetch_fn
    fetch_called = False
    
    def fetch_fn():
        nonlocal fetch_called
        fetch_called = True
        return {"should_not_see_this": True}
    
    data, source, cache_key = cache.get_or_fetch(provider, request, fetch_fn)
    
    assert not fetch_called, "fetch_fn should NOT be called when replay exists"
    assert source == MarketDataSource.LOCAL_REPLAY
    assert data == response
    assert len(cache_key) == 64


def test_get_or_fetch_replay_miss(cache):
    """Should call fetch_fn and save replay when no artifact exists."""
    provider = "yahoo"
    request = {"symbol": "TSLA"}
    response = {"close": 250.0}
    
    fetch_called = False
    
    def fetch_fn():
        nonlocal fetch_called
        fetch_called = True
        return response
    
    data, source, cache_key = cache.get_or_fetch(provider, request, fetch_fn)
    
    assert fetch_called, "fetch_fn should be called when no replay exists"
    assert source == MarketDataSource.LOCAL_FETCH
    assert data == response
    
    # Verify replay was saved
    loaded = cache.load_replay(cache_key)
    assert loaded is not None
    assert loaded.response == response


def test_get_or_fetch_second_call_hits_replay(cache):
    """Second call should hit replay without fetch."""
    provider = "yahoo"
    request = {"symbol": "NVDA"}
    response = {"close": 450.0}
    
    fetch_count = 0
    
    def fetch_fn():
        nonlocal fetch_count
        fetch_count += 1
        return response
    
    # First call: fetch
    data1, source1, key1 = cache.get_or_fetch(provider, request, fetch_fn)
    assert source1 == MarketDataSource.LOCAL_FETCH
    assert fetch_count == 1
    
    # Second call: replay (no fetch)
    data2, source2, key2 = cache.get_or_fetch(provider, request, fetch_fn)
    assert source2 == MarketDataSource.LOCAL_REPLAY
    assert fetch_count == 1, "fetch should not be called again"
    assert key1 == key2
    assert data1 == data2


def test_memory_cache_works(cache):
    """Memory cache should work without disk I/O on repeated access."""
    provider = "yahoo"
    request = {"symbol": "AMZN"}
    response = {"close": 180.0}
    
    # Save once
    artifact = cache.save_replay(provider, request, response)
    
    # Load multiple times (should hit memory cache)
    for _ in range(100):
        loaded = cache.load_replay(artifact.cache_key)
        assert loaded is not None
        assert loaded.response == response


def test_list_replays(cache):
    """Should list all replay artifacts."""
    # Save multiple replays
    cache.save_replay("yahoo", {"symbol": "AAPL"}, {"close": 130.0})
    cache.save_replay("yahoo", {"symbol": "TSLA"}, {"close": 250.0})
    cache.save_replay("alpaca", {"symbol": "SPY"}, {"close": 450.0})
    
    replays = cache.list_replays()
    
    assert len(replays) == 3
    
    # Check structure
    for replay in replays:
        assert "cache_key" in replay
        assert "provider" in replay
        assert "fetched_at" in replay
        assert "checksum" in replay
        assert "path" in replay
        assert len(replay["cache_key"]) == 64


def test_replay_artifact_schema():
    """ReplayArtifact should validate correctly."""
    artifact = ReplayArtifact(
        provider="yahoo",
        request={"symbol": "AAPL"},
        response={"close": 130.0},
        cache_key="a" * 64,
        checksum="b" * 64,
        fetched_at="2023-01-01T00:00:00Z"
    )
    
    assert artifact.provider == "yahoo"
    assert artifact.schema_version == "v1"


def test_get_cache_singleton():
    """get_cache should return singleton instance."""
    reset_cache()
    
    cache1 = get_cache()
    cache2 = get_cache()
    
    assert cache1 is cache2


def test_checksum_stable(cache):
    """Checksum should be stable for identical responses."""
    response = {"bars": [{"close": 130.0}]}
    
    checksum1 = cache.compute_checksum(response)
    checksum2 = cache.compute_checksum(response)
    
    assert checksum1 == checksum2
    assert len(checksum1) == 64


def test_provider_normalization(cache):
    """Provider names should be normalized to lowercase."""
    request = {"symbol": "AAPL"}
    
    key1 = cache.compute_cache_key("Yahoo", request)
    key2 = cache.compute_cache_key("yahoo", request)
    key3 = cache.compute_cache_key("YAHOO", request)
    
    assert key1 == key2 == key3


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
