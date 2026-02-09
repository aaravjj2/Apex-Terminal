"""
Parity Hashing for Realtime/Replay Verification.

Provides cryptographic verification that replay produces
identical results to live data processing.
"""

import hashlib
import hmac
import json
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional
from collections import OrderedDict
import struct
from datetime import datetime


@dataclass
class HashConfig:
    """Configuration for parity hashing."""
    
    algorithm: str = "sha256"
    include_timestamps: bool = True
    include_metadata: bool = False
    precision: int = 6  # Decimal precision for floats
    chunk_size: int = 1000  # Messages per rolling hash


@dataclass
class HashCheckpoint:
    """Checkpoint for incremental hashing."""
    
    sequence: int
    hash_value: str
    timestamp_ms: int
    message_count: int
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "sequence": self.sequence,
            "hash_value": self.hash_value,
            "timestamp_ms": self.timestamp_ms,
            "message_count": self.message_count,
            "metadata": self.metadata,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "HashCheckpoint":
        """Create from dictionary."""
        return cls(
            sequence=data["sequence"],
            hash_value=data["hash_value"],
            timestamp_ms=data["timestamp_ms"],
            message_count=data["message_count"],
            metadata=data.get("metadata", {}),
        )


@dataclass
class ParityResult:
    """Result of parity comparison."""
    
    match: bool
    live_hash: str
    replay_hash: str
    divergence_point: Optional[int] = None  # Message index where mismatch occurred
    details: Dict[str, Any] = field(default_factory=dict)
    
    def __bool__(self) -> bool:
        return self.match


class Normalizer:
    """Normalizes data for consistent hashing across runs."""
    
    def __init__(self, precision: int = 6):
        self.precision = precision
    
    def normalize(self, value: Any) -> Any:
        """Normalize a value for hashing."""
        if isinstance(value, float):
            return round(value, self.precision)
        elif isinstance(value, dict):
            return self._normalize_dict(value)
        elif isinstance(value, (list, tuple)):
            return [self.normalize(v) for v in value]
        elif hasattr(value, '__dict__'):
            return self._normalize_dict(value.__dict__)
        return value
    
    def _normalize_dict(self, d: Dict[str, Any]) -> OrderedDict:
        """Normalize dictionary with sorted keys."""
        result = OrderedDict()
        for key in sorted(d.keys()):
            if not key.startswith('_'):
                result[key] = self.normalize(d[key])
        return result
    
    def to_bytes(self, value: Any) -> bytes:
        """Convert normalized value to bytes."""
        normalized = self.normalize(value)
        return json.dumps(normalized, sort_keys=True, separators=(',', ':')).encode()


class StreamHasher:
    """Incremental hasher for streaming data."""
    
    def __init__(self, config: Optional[HashConfig] = None):
        self.config = config or HashConfig()
        self._normalizer = Normalizer(precision=self.config.precision)
        self._hasher = hashlib.new(self.config.algorithm)
        self._count = 0
        self._checkpoints: List[HashCheckpoint] = []
        self._last_checkpoint_count = 0
    
    def update(self, message: Any, timestamp_ms: Optional[int] = None) -> None:
        """Add a message to the hash stream."""
        data = self._normalizer.to_bytes(message)
        
        if self.config.include_timestamps and timestamp_ms is not None:
            data = struct.pack('>Q', timestamp_ms) + data
        
        self._hasher.update(data)
        self._count += 1
        
        # Create checkpoint if needed
        if self._count - self._last_checkpoint_count >= self.config.chunk_size:
            self._create_checkpoint(timestamp_ms or 0)
    
    def _create_checkpoint(self, timestamp_ms: int) -> None:
        """Create a checkpoint."""
        checkpoint = HashCheckpoint(
            sequence=len(self._checkpoints),
            hash_value=self._hasher.hexdigest(),
            timestamp_ms=timestamp_ms,
            message_count=self._count,
        )
        self._checkpoints.append(checkpoint)
        self._last_checkpoint_count = self._count
    
    def digest(self) -> str:
        """Get final hash digest."""
        return self._hasher.hexdigest()
    
    def reset(self) -> None:
        """Reset the hasher."""
        self._hasher = hashlib.new(self.config.algorithm)
        self._count = 0
        self._checkpoints = []
        self._last_checkpoint_count = 0
    
    @property
    def message_count(self) -> int:
        """Get message count."""
        return self._count
    
    @property
    def checkpoints(self) -> List[HashCheckpoint]:
        """Get checkpoints."""
        return self._checkpoints.copy()


class ParityTracker:
    """Tracks parity between live and replay streams."""
    
    def __init__(self, config: Optional[HashConfig] = None):
        self.config = config or HashConfig()
        self._live_hasher = StreamHasher(self.config)
        self._replay_hasher = StreamHasher(self.config)
        self._live_messages: List[bytes] = []
        self._replay_messages: List[bytes] = []
        self._store_messages = False
    
    def enable_message_storage(self, enabled: bool = True) -> None:
        """Enable/disable storing messages for debugging."""
        self._store_messages = enabled
    
    def add_live(self, message: Any, timestamp_ms: Optional[int] = None) -> None:
        """Add a message from live stream."""
        self._live_hasher.update(message, timestamp_ms)
        
        if self._store_messages:
            normalizer = Normalizer(self.config.precision)
            self._live_messages.append(normalizer.to_bytes(message))
    
    def add_replay(self, message: Any, timestamp_ms: Optional[int] = None) -> None:
        """Add a message from replay stream."""
        self._replay_hasher.update(message, timestamp_ms)
        
        if self._store_messages:
            normalizer = Normalizer(self.config.precision)
            self._replay_messages.append(normalizer.to_bytes(message))
    
    def verify(self) -> ParityResult:
        """Verify parity between streams."""
        live_hash = self._live_hasher.digest()
        replay_hash = self._replay_hasher.digest()
        
        result = ParityResult(
            match=live_hash == replay_hash,
            live_hash=live_hash,
            replay_hash=replay_hash,
        )
        
        if not result.match and self._store_messages:
            result.divergence_point = self._find_divergence()
        
        result.details = {
            "live_count": self._live_hasher.message_count,
            "replay_count": self._replay_hasher.message_count,
            "live_checkpoints": len(self._live_hasher.checkpoints),
            "replay_checkpoints": len(self._replay_hasher.checkpoints),
        }
        
        return result
    
    def _find_divergence(self) -> Optional[int]:
        """Find first message where streams diverge."""
        for i, (live, replay) in enumerate(zip(self._live_messages, self._replay_messages)):
            if live != replay:
                return i
        
        # Different lengths
        if len(self._live_messages) != len(self._replay_messages):
            return min(len(self._live_messages), len(self._replay_messages))
        
        return None
    
    def reset(self) -> None:
        """Reset both hashers."""
        self._live_hasher.reset()
        self._replay_hasher.reset()
        self._live_messages = []
        self._replay_messages = []


class BarParity:
    """Specialized parity checker for OHLCV bars."""
    
    def __init__(self, config: Optional[HashConfig] = None):
        self.config = config or HashConfig()
        self._normalizer = Normalizer(precision=self.config.precision)
    
    def hash_bar(self, bar: Any) -> str:
        """Hash a single bar."""
        # Extract OHLCV fields in canonical order
        bar_data = self._extract_bar_data(bar)
        data = self._normalizer.to_bytes(bar_data)
        return hashlib.sha256(data).hexdigest()
    
    def _extract_bar_data(self, bar: Any) -> OrderedDict:
        """Extract bar data in canonical order."""
        result = OrderedDict()
        
        if hasattr(bar, '__dict__'):
            d = bar.__dict__
        elif isinstance(bar, dict):
            d = bar
        else:
            raise ValueError(f"Cannot extract bar data from {type(bar)}")
        
        # Canonical field order
        for field in ['symbol', 'timeframe', 'ts_open', 'open', 'high', 'low', 'close', 'volume']:
            if field in d:
                result[field] = self._normalizer.normalize(d[field])
        
        return result
    
    def compare_bars(self, live: Any, replay: Any) -> bool:
        """Compare two bars for parity."""
        return self.hash_bar(live) == self.hash_bar(replay)
    
    def batch_hash(self, bars: List[Any]) -> str:
        """Hash a batch of bars."""
        hasher = hashlib.sha256()
        
        for bar in bars:
            bar_data = self._extract_bar_data(bar)
            data = self._normalizer.to_bytes(bar_data)
            hasher.update(data)
        
        return hasher.hexdigest()


class ParitySignature:
    """Generates and verifies signed parity proofs."""
    
    def __init__(self, secret_key: bytes):
        self._secret = secret_key
    
    def sign(self, hash_value: str, metadata: Dict[str, Any]) -> str:
        """Sign a hash with metadata."""
        message = f"{hash_value}:{json.dumps(metadata, sort_keys=True)}".encode()
        return hmac.new(self._secret, message, hashlib.sha256).hexdigest()
    
    def verify(self, hash_value: str, metadata: Dict[str, Any], signature: str) -> bool:
        """Verify a signature."""
        expected = self.sign(hash_value, metadata)
        return hmac.compare_digest(expected, signature)
    
    def create_proof(
        self,
        live_hash: str,
        replay_hash: str,
        timestamp_ms: int,
        message_count: int,
    ) -> Dict[str, Any]:
        """Create a signed parity proof."""
        metadata = {
            "live_hash": live_hash,
            "replay_hash": replay_hash,
            "timestamp_ms": timestamp_ms,
            "message_count": message_count,
            "match": live_hash == replay_hash,
        }
        
        combined_hash = hashlib.sha256(
            f"{live_hash}:{replay_hash}".encode()
        ).hexdigest()
        
        signature = self.sign(combined_hash, metadata)
        
        return {
            "proof_hash": combined_hash,
            "metadata": metadata,
            "signature": signature,
        }
    
    def verify_proof(self, proof: Dict[str, Any]) -> bool:
        """Verify a parity proof."""
        return self.verify(
            proof["proof_hash"],
            proof["metadata"],
            proof["signature"],
        )


class IncrementalParity:
    """Incremental parity verification with checkpoints."""
    
    def __init__(self, config: Optional[HashConfig] = None):
        self.config = config or HashConfig()
        self._tracker = ParityTracker(config)
        self._verified_checkpoints: List[HashCheckpoint] = []
    
    def add_live(self, message: Any, timestamp_ms: Optional[int] = None) -> None:
        """Add live message."""
        self._tracker.add_live(message, timestamp_ms)
    
    def add_replay(self, message: Any, timestamp_ms: Optional[int] = None) -> None:
        """Add replay message."""
        self._tracker.add_replay(message, timestamp_ms)
    
    def verify_incremental(self) -> Optional[ParityResult]:
        """Verify at next checkpoint if available."""
        live_checkpoints = self._tracker._live_hasher.checkpoints
        replay_checkpoints = self._tracker._replay_hasher.checkpoints
        
        # Check if we have new matching checkpoints
        verified_count = len(self._verified_checkpoints)
        
        if len(live_checkpoints) > verified_count and len(replay_checkpoints) > verified_count:
            live_cp = live_checkpoints[verified_count]
            replay_cp = replay_checkpoints[verified_count]
            
            match = live_cp.hash_value == replay_cp.hash_value
            
            if match:
                self._verified_checkpoints.append(live_cp)
            
            return ParityResult(
                match=match,
                live_hash=live_cp.hash_value,
                replay_hash=replay_cp.hash_value,
                details={
                    "checkpoint_sequence": verified_count,
                    "message_count": live_cp.message_count,
                },
            )
        
        return None
    
    def final_verify(self) -> ParityResult:
        """Final verification."""
        return self._tracker.verify()
    
    @property
    def verified_message_count(self) -> int:
        """Get count of verified messages."""
        if self._verified_checkpoints:
            return self._verified_checkpoints[-1].message_count
        return 0
