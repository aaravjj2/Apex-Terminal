"""
Cache Index Manifest Service

Provides deterministic cache manifest generation with stable ordering and checksums.
Tracks all replay/cache entries with metadata and provenance information.
"""

import os
import json
import hashlib
import structlog
from typing import Dict, Any, List, Optional
from pathlib import Path
from datetime import datetime

logger = structlog.get_logger(__name__)

# Cache manifest file (gitignored, LOCAL mode only)
CACHE_DIR = Path(__file__).parent.parent.parent / "cache"
MANIFEST_PATH = CACHE_DIR / "cache_manifest.json"


def _compute_checksum(data: Dict[str, Any]) -> str:
    """
    Compute deterministic checksum of data.
    
    Args:
        data: Data to hash
        
    Returns:
        SHA256 checksum (hex)
    """
    # Stable JSON serialization
    json_str = json.dumps(data, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(json_str.encode()).hexdigest()


def _load_manifest() -> Dict[str, Any]:
    """
    Load existing cache manifest or return empty structure.
    
    Returns:
        Manifest dict with 'version', 'entries', 'updated_at'
    """
    if not MANIFEST_PATH.exists():
        return {
            "version": "1.0",
            "entries": [],
            "updated_at": None
        }
    
    try:
        with open(MANIFEST_PATH, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load cache manifest: {e}")
        return {
            "version": "1.0",
            "entries": [],
            "updated_at": None
        }


def _save_manifest(manifest: Dict[str, Any]) -> None:
    """
    Save manifest with stable ordering and formatting.
    
    Args:
        manifest: Manifest dict to save
    """
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        
        # Update timestamp
        manifest["updated_at"] = datetime.utcnow().isoformat()
        
        # Stable serialization
        with open(MANIFEST_PATH, 'w') as f:
            json.dump(manifest, f, indent=2, sort_keys=True)
        
        logger.info(
            "Cache manifest saved",
            entries=len(manifest.get("entries", [])),
            path=str(MANIFEST_PATH)
        )
    except Exception as e:
        logger.error(f"Failed to save cache manifest: {e}")


def register_cache_entry(
    cache_key: str,
    request_type: str,
    params: Dict[str, Any],
    data: Dict[str, Any]
) -> None:
    """
    Register a cache entry in the manifest.
    
    Args:
        cache_key: Canonical cache key
        request_type: Type of request ("bars", "quote", etc.)
        params: Request parameters
        data: Cached data
    """
    manifest = _load_manifest()
    
    # Check if entry already exists
    existing_idx = None
    for idx, entry in enumerate(manifest.get("entries", [])):
        if entry.get("cache_key") == cache_key:
            existing_idx = idx
            break
    
    # Compute checksum
    checksum = _compute_checksum(data)
    
    # Create/update entry
    entry = {
        "cache_key": cache_key,
        "request_type": request_type,
        "params": params,
        "checksum": checksum,
        "captured_at": datetime.utcnow().isoformat(),
    }
    
    if existing_idx is not None:
        # Update existing
        manifest["entries"][existing_idx] = entry
    else:
        # Add new
        manifest["entries"].append(entry)
    
    # Sort entries by cache_key for stability
    manifest["entries"] = sorted(
        manifest["entries"],
        key=lambda x: x.get("cache_key", "")
    )
    
    _save_manifest(manifest)
    
    logger.info(
        f"Cache entry registered: {request_type}",
        cache_key=cache_key,
        checksum=checksum[:12]
    )


def list_cache_entries() -> List[Dict[str, Any]]:
    """
    List all cache entries from manifest.
    
    Returns:
        List of cache entry metadata (sorted by cache_key)
    """
    manifest = _load_manifest()
    entries = manifest.get("entries", [])
    
    # Already sorted by cache_key in register_cache_entry
    return entries


def get_cache_entry(cache_key: str) -> Optional[Dict[str, Any]]:
    """
    Get a specific cache entry by key.
    
    Args:
        cache_key: Cache key to lookup
        
    Returns:
        Entry metadata or None if not found
    """
    manifest = _load_manifest()
    
    for entry in manifest.get("entries", []):
        if entry.get("cache_key") == cache_key:
            return entry
    
    return None


def clear_manifest() -> int:
    """
    Clear all manifest entries.
    
    Returns:
        Number of entries cleared
    """
    manifest = _load_manifest()
    count = len(manifest.get("entries", []))
    
    manifest["entries"] = []
    _save_manifest(manifest)
    
    logger.info(f"Cache manifest cleared ({count} entries)")
    return count


def get_manifest_checksum() -> str:
    """
    Get deterministic checksum of the entire manifest.
    
    Returns:
        SHA256 hex checksum
    """
    manifest = _load_manifest()
    
    # Remove timestamp for deterministic comparison
    manifest_copy = manifest.copy()
    manifest_copy.pop("updated_at", None)
    
    return _compute_checksum(manifest_copy)
