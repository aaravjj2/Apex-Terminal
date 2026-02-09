"""
Market Data Record/Replay Layer (v1.13 - Objective L)
Provides deterministic record/replay for LOCAL mode market data fetches.
DEMO mode remains zero-network. Tests remain fully offline.
"""

import hashlib
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, Literal
from pydantic import BaseModel, Field


class ReplayArtifact(BaseModel):
    """Structure of a replay artifact stored in .cache/market_data/replay/"""
    provider: str = Field(..., description="Provider name (yahoo, alpaca, etc.)")
    request: Dict[str, Any] = Field(..., description="Canonical request")
    response: Dict[str, Any] = Field(..., description="Response data")
    cache_key: str = Field(..., description="SHA256 cache key")
    checksum: str = Field(..., description="SHA256 checksum of response")
    fetched_at: str = Field(..., description="ISO timestamp when fetched")
    schema_version: str = Field(default="v1", description="Artifact schema version")


class MarketDataSource(str):
    """Source of market data for provenance tracking"""
    DEMO = "DEMO"
    LOCAL_CACHE = "LOCAL_CACHE"
    LOCAL_REPLAY = "LOCAL_REPLAY"
    LOCAL_FETCH = "LOCAL_FETCH"


class RecordReplayCache:
    """
    Record/Replay cache for LOCAL mode market data.
    
    Policy:
    - DEMO mode: zero network, fixture-driven, bypasses this layer
    - LOCAL mode: 
      1. Check memory cache
      2. Check replay artifact
      3. Fetch from provider (only if no replay)
      4. Record new fetch as replay artifact
    
    Tests: Always use DEMO mode or mock, never trigger real fetches.
    """
    
    def __init__(self, cache_dir: Optional[Path] = None):
        if cache_dir is None:
            # Default to repo root .cache/ (gitignored)
            cache_dir = Path(__file__).parent.parent.parent.parent / ".cache" / "market_data" / "replay"
        
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # In-memory cache for current session
        self._memory_cache: Dict[str, Any] = {}
    
    def compute_cache_key(self, provider: str, request: Dict[str, Any]) -> str:
        """
        Compute canonical cache key from request.
        
        Rules:
        - Sort dict keys
        - Normalize provider name (lowercase)
        - SHA256 hash of canonical JSON
        """
        canonical_request = {
            "provider": provider.lower(),
            **{k: request[k] for k in sorted(request.keys())}
        }
        canonical_json = json.dumps(canonical_request, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(canonical_json.encode('utf-8')).hexdigest()
    
    def compute_checksum(self, response: Dict[str, Any]) -> str:
        """Compute SHA256 checksum of response data."""
        canonical_json = json.dumps(response, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(canonical_json.encode('utf-8')).hexdigest()
    
    def get_replay_path(self, cache_key: str) -> Path:
        """Get file path for replay artifact."""
        # Shard by first 2 chars of hash for filesystem efficiency
        shard = cache_key[:2]
        return self.cache_dir / shard / f"{cache_key}.json"
    
    def save_replay(
        self,
        provider: str,
        request: Dict[str, Any],
        response: Dict[str, Any],
        cache_key: Optional[str] = None
    ) -> ReplayArtifact:
        """
        Save a replay artifact to disk.
        Used when LOCAL mode makes a real provider fetch.
        """
        if cache_key is None:
            cache_key = self.compute_cache_key(provider, request)
        
        artifact = ReplayArtifact(
            provider=provider,
            request=request,
            response=response,
            cache_key=cache_key,
            checksum=self.compute_checksum(response),
            fetched_at=datetime.utcnow().isoformat() + "Z"
        )
        
        replay_path = self.get_replay_path(cache_key)
        replay_path.parent.mkdir(parents=True, exist_ok=True)
        
        replay_path.write_text(json.dumps(artifact.dict(), indent=2))
        
        # Also update memory cache
        self._memory_cache[cache_key] = artifact
        
        return artifact
    
    def load_replay(self, cache_key: str) -> Optional[ReplayArtifact]:
        """
        Load replay artifact from memory or disk.
        Returns None if not found.
        """
        # Check memory first
        if cache_key in self._memory_cache:
            return self._memory_cache[cache_key]
        
        # Check disk
        replay_path = self.get_replay_path(cache_key)
        if not replay_path.exists():
            return None
        
        try:
            artifact_data = json.loads(replay_path.read_text())
            artifact = ReplayArtifact(**artifact_data)
            
            # Cache in memory
            self._memory_cache[cache_key] = artifact
            
            return artifact
        except Exception as e:
            print(f"Warning: Failed to load replay {cache_key}: {e}")
            return None
    
    def get_or_fetch(
        self,
        provider: str,
        request: Dict[str, Any],
        fetch_fn: callable
    ) -> tuple[Dict[str, Any], MarketDataSource, str]:
        """
        Get data using replay-first policy.
        
        Returns: (response_data, source, cache_key)
        
        Policy:
        1. Compute cache key
        2. Check replay artifact
        3. If replay exists: return replay data (NEVER call fetch_fn)
        4. If no replay: call fetch_fn, save as replay, return data
        
        Args:
            provider: Provider name
            request: Request params
            fetch_fn: Callable that returns response Dict (only called if no replay)
        """
        cache_key = self.compute_cache_key(provider, request)
        
        # Replay-first: check existing artifact
        artifact = self.load_replay(cache_key)
        if artifact is not None:
            return (artifact.response, MarketDataSource.LOCAL_REPLAY, cache_key)
        
        # No replay: must fetch
        response = fetch_fn()
        
        # Save as replay for future runs
        self.save_replay(provider, request, response, cache_key)
        
        return (response, MarketDataSource.LOCAL_FETCH, cache_key)
    
    def list_replays(self) -> list[Dict[str, Any]]:
        """
        List all replay artifacts with metadata.
        Used for provenance export/audit.
        """
        replays = []
        
        for shard_dir in self.cache_dir.iterdir():
            if not shard_dir.is_dir():
                continue
            
            for replay_file in shard_dir.glob("*.json"):
                try:
                    artifact_data = json.loads(replay_file.read_text())
                    replays.append({
                        "cache_key": artifact_data["cache_key"],
                        "provider": artifact_data["provider"],
                        "fetched_at": artifact_data["fetched_at"],
                        "checksum": artifact_data["checksum"],
                        "path": str(replay_file.relative_to(self.cache_dir))
                    })
                except Exception as e:
                    print(f"Warning: Failed to list replay {replay_file}: {e}")
        
        return sorted(replays, key=lambda x: x["fetched_at"], reverse=True)


# Global singleton instance
_cache_instance: Optional[RecordReplayCache] = None


def get_cache() -> RecordReplayCache:
    """Get or create global cache instance."""
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = RecordReplayCache()
    return _cache_instance


def reset_cache():
    """Reset cache instance (for testing)."""
    global _cache_instance
    _cache_instance = None
