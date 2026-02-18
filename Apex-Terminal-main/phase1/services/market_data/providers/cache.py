"""
Disk cache for market data providers.

Provides deterministic caching with hash-based keys.
Cache location: .cache/market_data/
"""

import hashlib
import json
import os
from pathlib import Path
from typing import Optional, Any
from datetime import datetime
import structlog

logger = structlog.get_logger(__name__)


class DiskCache:
    """Simple disk-based cache with hash keys."""
    
    def __init__(self, cache_dir: str = ".cache/market_data"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"DiskCache initialized at {self.cache_dir.absolute()}")
    
    def _get_cache_key(self, **kwargs) -> str:
        """
        Generate deterministic cache key from kwargs.
        
        Args:
            **kwargs: Any hashable parameters (symbol, start, end, interval, provider)
            
        Returns:
            Hex hash string
        """
        # Sort keys for determinism
        sorted_items = sorted(kwargs.items())
        
        # Convert datetime objects to ISO strings
        normalized = []
        for k, v in sorted_items:
            if isinstance(v, datetime):
                normalized.append((k, v.isoformat()))
            else:
                normalized.append((k, str(v)))
        
        # Hash the normalized string
        cache_str = json.dumps(normalized, sort_keys=True)
        hash_obj = hashlib.sha256(cache_str.encode('utf-8'))
        return hash_obj.hexdigest()[:16]  # First 16 chars for readability
    
    def get(self, **kwargs) -> Optional[Any]:
        """
        Retrieve cached value.
        
        Returns:
            Cached value if exists, None otherwise
        """
        cache_key = self._get_cache_key(**kwargs)
        cache_file = self.cache_dir / f"{cache_key}.json"
        
        if not cache_file.exists():
            logger.debug(f"Cache miss: {cache_key}")
            return None
        
        try:
            with open(cache_file, 'r') as f:
                data = json.load(f)
            logger.debug(f"Cache hit: {cache_key}")
            return data
        except Exception as e:
            logger.warning(f"Cache read error: {e}")
            return None
    
    def set(self, value: Any, **kwargs) -> None:
        """
        Store value in cache.
        
        Args:
            value: Data to cache (must be JSON-serializable)
            **kwargs: Cache key parameters
        """
        cache_key = self._get_cache_key(**kwargs)
        cache_file = self.cache_dir / f"{cache_key}.json"
        
        try:
            with open(cache_file, 'w') as f:
                json.dump(value, f, indent=2, default=str)
            logger.debug(f"Cached: {cache_key}")
        except Exception as e:
            logger.warning(f"Cache write error: {e}")
    
    def clear(self) -> int:
        """
        Clear all cached data.
        
        Returns:
            Number of files deleted
        """
        count = 0
        for cache_file in self.cache_dir.glob("*.json"):
            try:
                cache_file.unlink()
                count += 1
            except Exception as e:
                logger.warning(f"Failed to delete {cache_file}: {e}")
        logger.info(f"Cleared {count} cache files")
        return count


# Global cache instance
_cache_instance: Optional[DiskCache] = None


def get_cache() -> DiskCache:
    """Get or create global cache instance."""
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = DiskCache()
    return _cache_instance
