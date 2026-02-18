"""
Replay Service — Deterministic Replay-First Fetch Policy

Guarantees that replay artifacts override live provider fetches.
Replay artifacts are persisted in a LOCAL-only cache/replay folder (gitignored).
"""

import os
import json
import hashlib
import structlog
from typing import Optional, Dict, Any
from pathlib import Path
from datetime import datetime

logger = structlog.get_logger(__name__)

# Replay artifacts directory (gitignored, LOCAL mode only)
REPLAY_DIR = Path(__file__).parent.parent.parent / "cache" / "replay"
REPLAY_DIR.mkdir(parents=True, exist_ok=True)


def _canonical_key(request_type: str, params: Dict[str, Any]) -> str:
    """
    Generate canonical request key for replay lookup.
    
    Args:
        request_type: Type of request ("bars", "quote", "chain")
        params: Request parameters (symbol, start, end, interval, etc.)
        
    Returns:
        Canonical key string (deterministic hash)
    """
    # Sort params for deterministic ordering
    sorted_params = sorted(params.items())
    key_str = f"{request_type}:" + ":".join(f"{k}={v}" for k, v in sorted_params)
    
    # Hash for shorter keys
    key_hash = hashlib.sha256(key_str.encode()).hexdigest()[:16]
    return f"{request_type}_{key_hash}"


def has_replay(request_type: str, params: Dict[str, Any]) -> bool:
    """
    Check if replay artifact exists for the given request.
    
    Args:
        request_type: Type of request ("bars", "quote", "chain")
        params: Request parameters
        
    Returns:
        True if replay artifact exists
    """
    key = _canonical_key(request_type, params)
    replay_file = REPLAY_DIR / f"{key}.json"
    return replay_file.exists()


def get_replay(request_type: str, params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Get replay artifact if it exists.
    
    Args:
        request_type: Type of request
        params: Request parameters
        
    Returns:
        Replay data dict or None if not found
    """
    key = _canonical_key(request_type, params)
    replay_file = REPLAY_DIR / f"{key}.json"
    
    if not replay_file.exists():
        return None
    
    try:
        with open(replay_file, "r") as f:
            data = json.load(f)
        
        logger.info(
            f"Replay HIT: {request_type}",
            key=key,
            symbol=params.get("symbol"),
            file=str(replay_file)
        )
        return data
    except Exception as e:
        logger.error(f"Failed to load replay artifact: {e}", key=key)
        return None


def save_replay(request_type: str, params: Dict[str, Any], data: Dict[str, Any]) -> None:
    """
    Save replay artifact for future replays.
    
    Args:
        request_type: Type of request
        params: Request parameters
        data: Response data to save
    """
    key = _canonical_key(request_type, params)
    replay_file = REPLAY_DIR / f"{key}.json"
    
    try:
        # Add metadata
        replay_data = {
            "meta": {
                "request_type": request_type,
                "params": params,
                "captured_at": datetime.utcnow().isoformat(),
                "canonical_key": key,
            },
            "data": data,
        }
        
        with open(replay_file, "w") as f:
            json.dump(replay_data, f, indent=2)
        
        logger.info(
            f"Replay SAVED: {request_type}",
            key=key,
            symbol=params.get("symbol"),
            file=str(replay_file)
        )
        
        # Register in cache manifest (v1.16)
        try:
            from ..cache_manifest import register_cache_entry
            register_cache_entry(key, request_type, params, data)
        except Exception as e:
            logger.warning(f"Failed to register cache entry in manifest: {e}")
            
    except Exception as e:
        logger.error(f"Failed to save replay artifact: {e}", key=key)


def list_replays() -> list[Dict[str, Any]]:
    """
    List all available replay artifacts with metadata.
    
    Returns:
        List of replay metadata dicts
    """
    replays = []
    
    for replay_file in REPLAY_DIR.glob("*.json"):
        try:
            with open(replay_file, "r") as f:
                data = json.load(f)
            
            meta = data.get("meta", {})
            replays.append({
                "key": meta.get("canonical_key", replay_file.stem),
                "request_type": meta.get("request_type"),
                "params": meta.get("params", {}),
                "captured_at": meta.get("captured_at"),
                "file": str(replay_file),
            })
        except Exception as e:
            logger.warning(f"Failed to load replay metadata from {replay_file}: {e}")
    
    return sorted(replays, key=lambda x: x.get("captured_at", ""), reverse=True)


def clear_replays(request_type: Optional[str] = None) -> int:
    """
    Clear replay artifacts.
    
    Args:
        request_type: If specified, clear only this type; otherwise clear all
        
    Returns:
        Number of files deleted
    """
    count = 0
    pattern = f"{request_type}_*.json" if request_type else "*.json"
    
    for replay_file in REPLAY_DIR.glob(pattern):
        try:
            replay_file.unlink()
            count += 1
        except Exception as e:
            logger.warning(f"Failed to delete replay file {replay_file}: {e}")
    
    logger.info(f"Cleared {count} replay artifacts", request_type=request_type or "all")
    return count
