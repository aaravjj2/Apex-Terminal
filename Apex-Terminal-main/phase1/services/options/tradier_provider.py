"""
Tradier Brokerage API Options Provider
Real-time options chains and quotes from Tradier brokerage endpoints.
"""

from typing import List, Dict, Optional, Any
from datetime import datetime, date
import logging
import os
import time

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

logger = logging.getLogger(__name__)


class TradierOptionsProvider:
    """
    Options data provider using Tradier Brokerage API.
    
    Provides real-time options chains, expirations, and quotes.
    Includes caching and rate limiting.
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://api.tradier.com/v1",
        cache_ttl_seconds: int = 60,
        rate_limit_calls: int = 120,
        rate_limit_window: int = 60,
    ):
        """
        Initialize Tradier options provider.
        
        Args:
            api_key: Tradier API key (defaults to TRADIER_BROKERAGE_KEY env var)
            base_url: API base URL
            cache_ttl_seconds: Cache TTL for chains/quotes
            rate_limit_calls: Max API calls per window
            rate_limit_window: Rate limit window in seconds
        """
        self._api_key = api_key or os.environ.get("TRADIER_BROKERAGE_KEY") or os.environ.get("Tradier_Brokerage_Key")
        self._base_url = base_url
        self._cache_ttl = cache_ttl_seconds
        self._rate_limit_calls = rate_limit_calls
        self._rate_limit_window = rate_limit_window
        
        # Rate limiting
        self._call_timestamps: List[float] = []
        
        # Simple in-memory cache
        self._cache: Dict[str, tuple[Any, float]] = {}
        
        # Metrics
        self._total_calls = 0
        self._cache_hits = 0
        self._errors = 0
    
    @property
    def is_available(self) -> bool:
        """Check if provider is available."""
        return bool(self._api_key) and REQUESTS_AVAILABLE
    
    def get_expirations(self, symbol: str) -> List[str]:
        """
        Get available option expirations for a symbol.
        
        Args:
            symbol: Underlying symbol
            
        Returns:
            List of expiration dates (YYYY-MM-DD format)
        """
        if not self.is_available:
            raise ValueError("Tradier provider not available (missing API key or requests library)")
        
        cache_key = f"exp_{symbol}"
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached
        
        try:
            self._enforce_rate_limit()
            
            response = requests.get(
                f"{self._base_url}/markets/options/expirations",
                headers=self._get_headers(),
                params={"symbol": symbol, "includeAllRoots": "false"},
                timeout=10,
            )
            
            self._total_calls += 1
            
            if response.status_code != 200:
                self._errors += 1
                logger.error(f"Tradier API error: {response.status_code} - {response.text}")
                return []
            
            data = response.json()
            
            # Handle different response structures
            if "expirations" in data and data["expirations"]:
                if "date" in data["expirations"]:
                    dates = data["expirations"]["date"]
                    # Ensure list
                    if isinstance(dates, str):
                        dates = [dates]
                    expirations = dates
                else:
                    expirations = []
            else:
                expirations = []
            
            self._set_cached(cache_key, expirations)
            return expirations
            
        except Exception as e:
            self._errors += 1
            logger.error(f"Failed to fetch expirations from Tradier: {e}")
            return []
    
    def get_option_chain(
        self,
        symbol: str,
        expiration: Optional[str] = None,
        greeks: bool = True,
    ) -> Dict[str, Any]:
        """
        Get option chain for a symbol.
        
        Args:
            symbol: Underlying symbol
            expiration: Specific expiration (YYYY-MM-DD), or None for all
            greeks: Include greeks in response
            
        Returns:
            Normalized option chain data
        """
        if not self.is_available:
            raise ValueError("Tradier provider not available")
        
        cache_key = f"chain_{symbol}_{expiration}_{greeks}"
        cached = self._get_cached(cache_key)
        if cached is not None:
            self._cache_hits += 1
            return cached
        
        try:
            self._enforce_rate_limit()
            
            params = {
                "symbol": symbol,
                "greeks": "true" if greeks else "false",
            }
            if expiration:
                params["expiration"] = expiration
            
            response = requests.get(
                f"{self._base_url}/markets/options/chains",
                headers=self._get_headers(),
                params=params,
                timeout=15,
            )
            
            self._total_calls += 1
            
            if response.status_code != 200:
                self._errors += 1
                logger.error(f"Tradier API error: {response.status_code} - {response.text}")
                return {"symbol": symbol, "options": []}
            
            data = response.json()
            
            # Normalize the chain data
            normalized = self._normalize_chain(data, symbol)
            
            self._set_cached(cache_key, normalized)
            return normalized
            
        except Exception as e:
            self._errors += 1
            logger.error(f"Failed to fetch option chain from Tradier: {e}")
            return {"symbol": symbol, "options": []}
    
    def get_quotes(self, option_symbols: List[str]) -> Dict[str, Dict[str, Any]]:
        """
        Get quotes for multiple option symbols.
        
        Args:
            option_symbols: List of option symbols (e.g., ["AAPL241220C00150000"])
            
        Returns:
            Dict mapping symbol to quote data
        """
        if not self.is_available:
            raise ValueError("Tradier provider not available")
        
        if not option_symbols:
            return {}
        
        try:
            self._enforce_rate_limit()
            
            # Tradier allows comma-separated symbols
            symbols_str = ",".join(option_symbols[:100])  # Limit to 100
            
            response = requests.get(
                f"{self._base_url}/markets/quotes",
                headers=self._get_headers(),
                params={"symbols": symbols_str, "greeks": "true"},
                timeout=10,
            )
            
            self._total_calls += 1
            
            if response.status_code != 200:
                self._errors += 1
                logger.error(f"Tradier API error: {response.status_code} - {response.text}")
                return {}
            
            data = response.json()
            
            # Normalize quotes
            return self._normalize_quotes(data)
            
        except Exception as e:
            self._errors += 1
            logger.error(f"Failed to fetch quotes from Tradier: {e}")
            return {}
    
    def health_check(self) -> Dict[str, Any]:
        """Check provider health."""
        health = {
            "provider": "tradier",
            "available": self.is_available,
            "api_key_set": bool(self._api_key),
            "total_calls": self._total_calls,
            "cache_hits": self._cache_hits,
            "errors": self._errors,
            "cache_size": len(self._cache),
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        # Quick API test
        if self.is_available:
            try:
                response = requests.get(
                    f"{self._base_url}/markets/clock",
                    headers=self._get_headers(),
                    timeout=5,
                )
                health["api_reachable"] = response.status_code == 200
            except Exception:
                health["api_reachable"] = False
        
        return health
    
    def _get_headers(self) -> Dict[str, str]:
        """Get request headers."""
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Accept": "application/json",
        }
    
    def _enforce_rate_limit(self) -> None:
        """Enforce rate limiting."""
        now = time.time()
        
        # Remove timestamps outside the window
        self._call_timestamps = [
            ts for ts in self._call_timestamps
            if now - ts < self._rate_limit_window
        ]
        
        # Check if we're at the limit
        if len(self._call_timestamps) >= self._rate_limit_calls:
            oldest = self._call_timestamps[0]
            sleep_time = self._rate_limit_window - (now - oldest)
            if sleep_time > 0:
                logger.warning(f"Rate limit reached, sleeping {sleep_time:.1f}s")
                time.sleep(sleep_time)
                now = time.time()
        
        self._call_timestamps.append(now)
    
    def _get_cached(self, key: str) -> Optional[Any]:
        """Get cached value if not expired."""
        if key in self._cache:
            value, timestamp = self._cache[key]
            if time.time() - timestamp < self._cache_ttl:
                return value
            else:
                del self._cache[key]
        return None
    
    def _set_cached(self, key: str, value: Any) -> None:
        """Set cached value."""
        self._cache[key] = (value, time.time())
    
    def _normalize_chain(self, raw_data: Dict[str, Any], symbol: str) -> Dict[str, Any]:
        """Normalize Tradier chain response to internal format."""
        normalized = {
            "symbol": symbol,
            "timestamp": datetime.utcnow().isoformat(),
            "options": [],
        }
        
        if "options" not in raw_data or not raw_data["options"]:
            return normalized
        
        options = raw_data["options"].get("option", [])
        
        # Ensure list
        if isinstance(options, dict):
            options = [options]
        
        for opt in options:
            normalized_opt = {
                "symbol": opt.get("symbol", ""),
                "underlying": opt.get("underlying", symbol),
                "expiration": opt.get("expiration_date", ""),
                "strike": float(opt.get("strike", 0)),
                "option_type": opt.get("option_type", "").lower(),  # call/put
                "bid": float(opt.get("bid", 0)),
                "ask": float(opt.get("ask", 0)),
                "last": float(opt.get("last", 0)),
                "volume": int(opt.get("volume", 0)),
                "open_interest": int(opt.get("open_interest", 0)),
                "iv": float(opt.get("greeks", {}).get("smv_vol", 0)) if opt.get("greeks") else None,
                "delta": float(opt.get("greeks", {}).get("delta", 0)) if opt.get("greeks") else None,
                "gamma": float(opt.get("greeks", {}).get("gamma", 0)) if opt.get("greeks") else None,
                "theta": float(opt.get("greeks", {}).get("theta", 0)) if opt.get("greeks") else None,
                "vega": float(opt.get("greeks", {}).get("vega", 0)) if opt.get("greeks") else None,
            }
            normalized["options"].append(normalized_opt)
        
        return normalized
    
    def _normalize_quotes(self, raw_data: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        """Normalize Tradier quotes response."""
        result = {}
        
        if "quotes" not in raw_data or not raw_data["quotes"]:
            return result
        
        quotes = raw_data["quotes"].get("quote", [])
        
        # Ensure list
        if isinstance(quotes, dict):
            quotes = [quotes]
        
        for quote in quotes:
            symbol = quote.get("symbol", "")
            if not symbol:
                continue
            
            result[symbol] = {
                "symbol": symbol,
                "bid": float(quote.get("bid", 0)),
                "ask": float(quote.get("ask", 0)),
                "last": float(quote.get("last", 0)),
                "volume": int(quote.get("volume", 0)),
                "open_interest": int(quote.get("open_interest", 0)),
                "iv": float(quote.get("greeks", {}).get("smv_vol", 0)) if quote.get("greeks") else None,
                "delta": float(quote.get("greeks", {}).get("delta", 0)) if quote.get("greeks") else None,
            }
        
        return result


def create_tradier_provider() -> TradierOptionsProvider:
    """Factory to create Tradier provider."""
    return TradierOptionsProvider()
