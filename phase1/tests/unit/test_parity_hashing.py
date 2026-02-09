"""
Unit tests for Parity Hashing.

Tests cover:
- Data normalization
- Stream hashing
- Parity tracking
- Bar-specific parity
- Signed proofs
- Incremental verification
"""

import pytest
from collections import OrderedDict

import sys
sys.path.insert(0, '/home/aarav/Aarav/Tradingview recreation/phase1')

from services.parity.hashing import (
    HashConfig,
    HashCheckpoint,
    ParityResult,
    Normalizer,
    StreamHasher,
    ParityTracker,
    BarParity,
    ParitySignature,
    IncrementalParity,
)


@pytest.fixture
def config():
    """Default hash config."""
    return HashConfig()


@pytest.fixture
def normalizer():
    """Default normalizer."""
    return Normalizer()


@pytest.fixture
def tracker():
    """Default parity tracker."""
    return ParityTracker()


class TestHashCheckpoint:
    """Tests for HashCheckpoint."""
    
    def test_to_dict(self):
        """Should convert to dictionary."""
        checkpoint = HashCheckpoint(
            sequence=5,
            hash_value="abc123",
            timestamp_ms=1000,
            message_count=500,
            metadata={"key": "value"},
        )
        
        d = checkpoint.to_dict()
        
        assert d["sequence"] == 5
        assert d["hash_value"] == "abc123"
        assert d["metadata"]["key"] == "value"
    
    def test_from_dict(self):
        """Should create from dictionary."""
        data = {
            "sequence": 3,
            "hash_value": "xyz789",
            "timestamp_ms": 2000,
            "message_count": 300,
        }
        
        checkpoint = HashCheckpoint.from_dict(data)
        
        assert checkpoint.sequence == 3
        assert checkpoint.hash_value == "xyz789"


class TestParityResult:
    """Tests for ParityResult."""
    
    def test_bool_match(self):
        """Should be truthy when match."""
        result = ParityResult(match=True, live_hash="a", replay_hash="a")
        assert result
    
    def test_bool_no_match(self):
        """Should be falsy when no match."""
        result = ParityResult(match=False, live_hash="a", replay_hash="b")
        assert not result


class TestNormalizer:
    """Tests for Normalizer."""
    
    def test_normalize_float(self, normalizer):
        """Should round floats to precision."""
        result = normalizer.normalize(3.14159265359)
        assert result == 3.141593  # Default precision is 6
    
    def test_normalize_dict(self, normalizer):
        """Should sort dict keys."""
        result = normalizer.normalize({"z": 1, "a": 2})
        assert list(result.keys()) == ["a", "z"]
    
    def test_normalize_nested(self, normalizer):
        """Should handle nested structures."""
        data = {"b": [3.111111, 2.222222], "a": {"y": 1.0, "x": 2.0}}
        result = normalizer.normalize(data)
        
        assert list(result.keys()) == ["a", "b"]
        assert list(result["a"].keys()) == ["x", "y"]
    
    def test_skip_private_fields(self, normalizer):
        """Should skip private fields."""
        result = normalizer.normalize({"public": 1, "_private": 2})
        assert "_private" not in result
    
    def test_to_bytes_deterministic(self, normalizer):
        """Same data should produce same bytes."""
        data1 = {"b": 1, "a": 2}
        data2 = {"a": 2, "b": 1}  # Different order
        
        assert normalizer.to_bytes(data1) == normalizer.to_bytes(data2)


class TestStreamHasher:
    """Tests for StreamHasher."""
    
    def test_update_increments_count(self, config):
        """Should increment message count."""
        hasher = StreamHasher(config)
        
        hasher.update({"msg": 1})
        hasher.update({"msg": 2})
        
        assert hasher.message_count == 2
    
    def test_digest_returns_hash(self, config):
        """Should return hex digest."""
        hasher = StreamHasher(config)
        hasher.update({"test": "data"})
        
        digest = hasher.digest()
        
        assert isinstance(digest, str)
        assert len(digest) == 64  # SHA256
    
    def test_same_data_same_hash(self, config):
        """Same data should produce same hash."""
        hasher1 = StreamHasher(config)
        hasher2 = StreamHasher(config)
        
        for h in [hasher1, hasher2]:
            h.update({"a": 1})
            h.update({"b": 2})
        
        assert hasher1.digest() == hasher2.digest()
    
    def test_different_data_different_hash(self, config):
        """Different data should produce different hash."""
        hasher1 = StreamHasher(config)
        hasher2 = StreamHasher(config)
        
        hasher1.update({"a": 1})
        hasher2.update({"a": 2})
        
        assert hasher1.digest() != hasher2.digest()
    
    def test_creates_checkpoints(self):
        """Should create checkpoints at intervals."""
        config = HashConfig(chunk_size=10)
        hasher = StreamHasher(config)
        
        for i in range(25):
            hasher.update({"i": i})
        
        assert len(hasher.checkpoints) == 2
    
    def test_reset(self, config):
        """Should reset state."""
        hasher = StreamHasher(config)
        hasher.update({"test": 1})
        
        hasher.reset()
        
        assert hasher.message_count == 0
        assert len(hasher.checkpoints) == 0


class TestParityTracker:
    """Tests for ParityTracker."""
    
    def test_matching_streams(self, tracker):
        """Should verify matching streams."""
        for i in range(10):
            tracker.add_live({"msg": i})
            tracker.add_replay({"msg": i})
        
        result = tracker.verify()
        
        assert result.match
        assert result.live_hash == result.replay_hash
    
    def test_different_streams(self, tracker):
        """Should detect different streams."""
        tracker.add_live({"msg": 1})
        tracker.add_replay({"msg": 2})
        
        result = tracker.verify()
        
        assert not result.match
    
    def test_find_divergence(self):
        """Should find divergence point."""
        tracker = ParityTracker()
        tracker.enable_message_storage(True)
        
        for i in range(5):
            tracker.add_live({"msg": i})
            tracker.add_replay({"msg": i})
        
        tracker.add_live({"msg": "live"})
        tracker.add_replay({"msg": "replay"})
        
        result = tracker.verify()
        
        assert not result.match
        assert result.divergence_point == 5
    
    def test_details_include_counts(self, tracker):
        """Should include message counts in details."""
        tracker.add_live({"a": 1})
        tracker.add_live({"a": 2})
        tracker.add_replay({"a": 1})
        tracker.add_replay({"a": 2})
        
        result = tracker.verify()
        
        assert result.details["live_count"] == 2
        assert result.details["replay_count"] == 2
    
    def test_reset(self, tracker):
        """Should reset both hashers."""
        tracker.add_live({"test": 1})
        tracker.add_replay({"test": 1})
        
        tracker.reset()
        
        result = tracker.verify()
        assert result.details["live_count"] == 0


class TestBarParity:
    """Tests for BarParity."""
    
    def test_hash_bar_dict(self):
        """Should hash bar from dict."""
        parity = BarParity()
        
        bar = {
            "symbol": "AAPL",
            "timeframe": "1m",
            "ts_open": 1000,
            "open": 100.0,
            "high": 101.0,
            "low": 99.0,
            "close": 100.5,
            "volume": 1000.0,
        }
        
        hash_value = parity.hash_bar(bar)
        
        assert isinstance(hash_value, str)
        assert len(hash_value) == 64
    
    def test_compare_bars_equal(self):
        """Should return True for equal bars."""
        parity = BarParity()
        
        bar1 = {"symbol": "AAPL", "open": 100.0, "close": 101.0}
        bar2 = {"symbol": "AAPL", "open": 100.0, "close": 101.0}
        
        assert parity.compare_bars(bar1, bar2)
    
    def test_compare_bars_different(self):
        """Should return False for different bars."""
        parity = BarParity()
        
        bar1 = {"symbol": "AAPL", "close": 100.0}
        bar2 = {"symbol": "AAPL", "close": 100.1}
        
        assert not parity.compare_bars(bar1, bar2)
    
    def test_batch_hash(self):
        """Should hash multiple bars."""
        parity = BarParity()
        
        bars = [
            {"symbol": "AAPL", "close": 100.0},
            {"symbol": "AAPL", "close": 101.0},
        ]
        
        hash_value = parity.batch_hash(bars)
        
        assert isinstance(hash_value, str)


class TestParitySignature:
    """Tests for ParitySignature."""
    
    def test_sign_and_verify(self):
        """Should sign and verify."""
        signer = ParitySignature(b"secret_key")
        
        signature = signer.sign("hash123", {"count": 100})
        
        assert signer.verify("hash123", {"count": 100}, signature)
    
    def test_verify_fails_wrong_hash(self):
        """Should fail with wrong hash."""
        signer = ParitySignature(b"secret_key")
        
        signature = signer.sign("hash123", {"count": 100})
        
        assert not signer.verify("wrong", {"count": 100}, signature)
    
    def test_create_proof(self):
        """Should create proof."""
        signer = ParitySignature(b"secret_key")
        
        proof = signer.create_proof(
            live_hash="abc",
            replay_hash="abc",
            timestamp_ms=1000,
            message_count=50,
        )
        
        assert proof["metadata"]["match"]
        assert "signature" in proof
    
    def test_verify_proof(self):
        """Should verify valid proof."""
        signer = ParitySignature(b"secret_key")
        
        proof = signer.create_proof("abc", "abc", 1000, 50)
        
        assert signer.verify_proof(proof)


class TestIncrementalParity:
    """Tests for IncrementalParity."""
    
    def test_add_messages(self):
        """Should add messages."""
        parity = IncrementalParity()
        
        parity.add_live({"msg": 1})
        parity.add_replay({"msg": 1})
        
        # No error means success
    
    def test_verify_incremental_with_checkpoints(self):
        """Should verify at checkpoints."""
        config = HashConfig(chunk_size=5)
        parity = IncrementalParity(config)
        
        for i in range(10):
            parity.add_live({"msg": i})
            parity.add_replay({"msg": i})
        
        result = parity.verify_incremental()
        
        assert result is not None
        assert result.match
    
    def test_final_verify(self):
        """Should perform final verification."""
        parity = IncrementalParity()
        
        for i in range(10):
            parity.add_live({"msg": i})
            parity.add_replay({"msg": i})
        
        result = parity.final_verify()
        
        assert result.match
    
    def test_verified_message_count(self):
        """Should track verified count."""
        config = HashConfig(chunk_size=5)
        parity = IncrementalParity(config)
        
        for i in range(10):
            parity.add_live({"msg": i})
            parity.add_replay({"msg": i})
        
        parity.verify_incremental()
        
        assert parity.verified_message_count == 5


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
