"""
LLM Service Module

Provides a pluggable interface for LLM-based candidate ranking.
Supports deterministic stub for testing and HTTP endpoint for production.
"""

from .provider import LLMProvider, LLMResponse
from .providers.offline_stub import OfflineStubProvider
from .providers.http_endpoint import HTTPEndpointProvider

__all__ = [
    'LLMProvider',
    'LLMResponse',
    'OfflineStubProvider',
    'HTTPEndpointProvider',
]
