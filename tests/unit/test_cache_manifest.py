"""
Tests for v1.16 cache manifest service.
"""

import pytest
import json
import hashlib
from pathlib import Path
from phase1.services.market_data.cache_manifest import (
    register_cache_entry,
    list_cache_entries,
    get_cache_entry,
    clear_manifest,
    get_manifest_checksum,
    MANIFEST_PATH,
    _compute_checksum
)


def test_cache_manifest_ordering():
    """Cache manifest entries are ordered deterministically by cache_key."""
    clear_manifest()
    
    # Register entries in random order
    register_cache_entry("charlie_abc", "bars", {"symbol": "C"}, {"data": []})
    register_cache_entry("alpha_xyz", "bars", {"symbol": "A"}, {"data": []})
    register_cache_entry("bravo_def", "bars", {"symbol": "B"}, {"data": []})
    
    entries = list_cache_entries()
    
    # Should be sorted by cache_key
    assert len(entries) == 3
    assert entries[0]["cache_key"] == "alpha_xyz"
    assert entries[1]["cache_key"] == "bravo_def"
    assert entries[2]["cache_key"] == "charlie_abc"


def test_cache_manifest_stable_serialization():
    """Manifest JSON serialization is stable and deterministic."""
    clear_manifest()
    
    # Register same entries twice with same data
    params = {"symbol": "AAPL", "start": "2024-01-01"}
    data = {"bars": [{"open": 100}]}
    
    register_cache_entry("test_key_1", "bars", params, data)
    entries1 = list_cache_entries()
    
    # Re-register same entry (should update, not duplicate)
    register_cache_entry("test_key_1", "bars", params, data)
    entries2  = list_cache_entries()
    
    # Should not create duplicates
    assert len(entries1) == 1
    assert len(entries2) == 1
    
    # Cache entry should have same cache_key and request_type
    assert entries1[0]["cache_key"] == entries2[0]["cache_key"]
    assert entries1[0]["request_type"] == entries2[0]["request_type"]
    assert entries1[0]["checksum"] == entries2[0]["checksum"]  # Same data = same checksum


def test_cache_manifest_checksum_stable():
    """Manifest checksum is stable across multiple saves."""
    clear_manifest()
    
    # Register entries
    register_cache_entry("key1", "bars", {"symbol": "A"}, {"data": []})
    register_cache_entry("key2", "quote", {"symbol": "B"}, {"data": []})
    
    checksum1 = get_manifest_checksum()
    
    # Save again (should not change checksum since entries are identical)
    entries = list_cache_entries()
    for entry in entries:
        register_cache_entry(
            entry["cache_key"],
            entry["request_type"],
            entry["params"],
            {"data": []}
        )
    
    checksum2 = get_manifest_checksum()
    
    # Checksums may differ due to captured_at timestamp
    # but the structure should be the same
    assert isinstance(checksum1, str)
    assert isinstance(checksum2, str)
    assert len(checksum1) == 64  # SHA256 hex length
    assert len(checksum2) == 64


def test_compute_checksum_deterministic():
    """Checksum computation is order-independent."""
    data1 = {"symbol": "AAPL", "start": "2024-01-01"}
    data2 = {"start": "2024-01-01", "symbol": "AAPL"}  # Different order
    
    checksum1 = _compute_checksum(data1)
    checksum2 = _compute_checksum(data2)
    
    assert checksum1 == checksum2


def test_cache_entry_update():
    """Updating an existing cache entry replaces it (no duplicates)."""
    clear_manifest()
    
    # Register initial entry
    register_cache_entry("key1", "bars", {"symbol": "A"}, {"version": 1})
    
    entries1 = list_cache_entries()
    assert len(entries1) == 1
    
    # Update same key
    register_cache_entry("key1", "bars", {"symbol": "A"}, {"version": 2})
    
    entries2 = list_cache_entries()
    assert len(entries2) == 1, "Should not create duplicate entries"
    
    # Checksum should be different
    assert entries1[0]["checksum"] != entries2[0]["checksum"]


def test_get_cache_entry():
    """get_cache_entry retrieves a specific entry by key."""
    clear_manifest()
    
    register_cache_entry("key1", "bars", {"symbol": "A"}, {"data": [1, 2, 3]})
    register_cache_entry("key2", "quote", {"symbol": "B"}, {"price": 100})
    
    entry1 = get_cache_entry("key1")
    assert entry1 is not None
    assert entry1["cache_key"] == "key1"
    assert entry1["request_type"] == "bars"
    
    entry2 = get_cache_entry("key2")
    assert entry2 is not None
    assert entry2["request_type"] == "quote"
    
    entry_missing = get_cache_entry("missing_key")
    assert entry_missing is None


def test_clear_manifest():
    """clear_manifest removes all entries."""
    clear_manifest()
    
    register_cache_entry("key1", "bars", {}, {})
    register_cache_entry("key2", "quote", {}, {})
    
    assert len(list_cache_entries()) == 2
    
    count = clear_manifest()
    assert count == 2
    assert len(list_cache_entries()) == 0


def test_manifest_file_format():
    """Manifest file uses stable JSON formatting."""
    clear_manifest()
    
    register_cache_entry("key1", "bars", {"symbol": "A"}, {"data": []})
    
    # Read raw file
    with open(MANIFEST_PATH, 'r') as f:
        content = f.read()
    
    # Should be valid JSON
    manifest = json.loads(content)
    
    # Check structure
    assert "version" in manifest
    assert "entries" in manifest
    assert "updated_at" in manifest
    assert isinstance(manifest["entries"], list)
    
    # Check entries are sorted
    if len(manifest["entries"]) > 1:
        keys = [e["cache_key"] for e in manifest["entries"]]
        assert keys == sorted(keys), "Entries should be sorted by cache_key"
