"""
HTTP Endpoint Provider
Calls a remote LLM endpoint (e.g., Colab-hosted inference server).
"""

from typing import Dict, Any, Optional
from datetime import datetime
import logging
import json

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

from ..provider import LLMProvider, LLMResponse

logger = logging.getLogger(__name__)


class HTTPEndpointProvider(LLMProvider):
    """
    HTTP-based LLM provider for remote inference.
    
    Calls a REST endpoint that accepts candidate context and
    returns selected IDs with explanation.
    
    Expected endpoint contract:
    - POST /rank_candidates
    - Request body: JSON context object
    - Response: {"selected_ids": [...], "explanation": "...", "confidence": 0.8}
    """
    
    def __init__(
        self,
        endpoint_url: str,
        api_key: Optional[str] = None,
        timeout_seconds: float = 30.0,
        max_retries: int = 2,
    ):
        """
        Initialize HTTP endpoint provider.
        
        Args:
            endpoint_url: Base URL of the LLM endpoint
            api_key: Optional API key for authentication
            timeout_seconds: Request timeout
            max_retries: Number of retries on failure
        """
        self._endpoint_url = endpoint_url.rstrip("/")
        self._api_key = api_key
        self._timeout = timeout_seconds
        self._max_retries = max_retries
        self._last_health_check: Optional[Dict[str, Any]] = None
        self._is_available = False
        self._call_count = 0
        self._error_count = 0
    
    @property
    def name(self) -> str:
        return "http_endpoint"
    
    @property
    def is_available(self) -> bool:
        return self._is_available and REQUESTS_AVAILABLE
    
    def rank_candidates(
        self,
        context: Dict[str, Any],
    ) -> LLMResponse:
        """
        Call remote endpoint to rank candidates.
        """
        if not REQUESTS_AVAILABLE:
            return LLMResponse(
                selected_ids=[],
                explanation="",
                provider=self.name,
                error="requests library not available",
            )
        
        start_time = datetime.utcnow()
        self._call_count += 1
        
        url = f"{self._endpoint_url}/rank_candidates"
        headers = {"Content-Type": "application/json"}
        
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        
        last_error = None
        for attempt in range(self._max_retries + 1):
            try:
                response = requests.post(
                    url,
                    json=context,
                    headers=headers,
                    timeout=self._timeout,
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    end_time = datetime.utcnow()
                    latency_ms = (end_time - start_time).total_seconds() * 1000
                    
                    return LLMResponse(
                        selected_ids=data.get("selected_ids", []),
                        explanation=data.get("explanation", ""),
                        confidence=data.get("confidence", 0.8),
                        metadata=data.get("metadata", {}),
                        latency_ms=latency_ms,
                        provider=self.name,
                    )
                else:
                    last_error = f"HTTP {response.status_code}: {response.text[:200]}"
                    
            except requests.exceptions.Timeout:
                last_error = f"Request timeout after {self._timeout}s"
            except requests.exceptions.ConnectionError as e:
                last_error = f"Connection error: {str(e)[:100]}"
            except json.JSONDecodeError as e:
                last_error = f"Invalid JSON response: {str(e)}"
            except Exception as e:
                last_error = f"Unexpected error: {str(e)[:100]}"
            
            if attempt < self._max_retries:
                logger.warning(f"LLM request attempt {attempt + 1} failed: {last_error}")
        
        # All retries exhausted
        self._error_count += 1
        self._is_available = False
        
        return LLMResponse(
            selected_ids=[],
            explanation="",
            provider=self.name,
            error=last_error,
            latency_ms=(datetime.utcnow() - start_time).total_seconds() * 1000,
        )
    
    def health_check(self) -> Dict[str, Any]:
        """
        Check endpoint health.
        """
        result = {
            "provider": self.name,
            "endpoint": self._endpoint_url,
            "available": False,
            "call_count": self._call_count,
            "error_count": self._error_count,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        if not REQUESTS_AVAILABLE:
            result["error"] = "requests library not available"
            return result
        
        try:
            # Try health endpoint or just check connectivity
            health_url = f"{self._endpoint_url}/health"
            response = requests.get(health_url, timeout=5.0)
            
            if response.status_code == 200:
                result["available"] = True
                result["health_response"] = response.json()
                self._is_available = True
            else:
                result["error"] = f"Health check returned {response.status_code}"
                self._is_available = False
                
        except requests.exceptions.Timeout:
            result["error"] = "Health check timeout"
            self._is_available = False
        except requests.exceptions.ConnectionError:
            result["error"] = "Could not connect to endpoint"
            self._is_available = False
        except Exception as e:
            result["error"] = str(e)
            self._is_available = False
        
        self._last_health_check = result
        return result
    
    def configure(
        self,
        endpoint_url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
    ) -> None:
        """
        Update provider configuration.
        
        Args:
            endpoint_url: New endpoint URL
            api_key: New API key
            timeout_seconds: New timeout
        """
        if endpoint_url is not None:
            self._endpoint_url = endpoint_url.rstrip("/")
        if api_key is not None:
            self._api_key = api_key
        if timeout_seconds is not None:
            self._timeout = timeout_seconds
        
        # Reset availability until health check
        self._is_available = False
        self._last_health_check = None
