"""
Market data providers package.

Provides unified interface to multiple market data sources (demo, yahoo).
"""

import os
import structlog
from typing import Dict

from .base import MarketDataProvider
from .types import (
    BarsRequest, BarsResponse, QuoteRequest, QuoteResponse,
    ProviderName, ProviderInfo
)
from .demo_provider import DemoProvider
from .yahoo_provider import YahooProvider

logger = structlog.get_logger(__name__)


# Global provider registry
_providers: Dict[ProviderName, MarketDataProvider] = {}


def _init_providers():
    """Initialize all providers based on environment."""
    global _providers
    
    # Determine mode
    demo_mode = os.getenv("DEMO_MODE", "0") == "1"
    enable_replay_save = not demo_mode  # LOCAL mode can save replays
    
    # Demo provider always available (checks replay, optionally saves in LOCAL)
    _providers[ProviderName.DEMO] = DemoProvider(enable_replay_save=enable_replay_save)
    logger.info(
        "Demo provider initialized",mode=("DEMO" if demo_mode else "LOCAL"),
        enable_replay_save=enable_replay_save
    )
    
    # Yahoo provider only in LOCAL mode
    if not demo_mode:
        try:
            _providers[ProviderName.YAHOO] = YahooProvider()
            logger.info("Yahoo provider enabled (LOCAL mode)")
        except Exception as e:
            logger.warning(f"Yahoo provider initialization failed: {e}")
    else:
        logger.info("Yahoo provider disabled (DEMO mode)")


def get_provider(provider_name: ProviderName) -> MarketDataProvider:
    """
    Get provider instance by name.
    
    Args:
        provider_name: Provider to retrieve
        
    Returns:
        MarketDataProvider instance
        
    Raises:
        ValueError: If provider not available
    """
    if not _providers:
        _init_providers()
    
    if provider_name not in _providers:
        raise ValueError(f"Provider {provider_name} not available")
    
    return _providers[provider_name]


async def get_market_data(provider_name: ProviderName, request) -> any:
    """
    Unified entry point for market data requests.
    
    Args:
        provider_name: Provider to use (demo, yahoo)
        request: BarsRequest or QuoteRequest
        
    Returns:
        BarsResponse or QuoteResponse depending on request type
        
    Raises:
        ValueError: If invalid provider or request
    """
    provider = get_provider(provider_name)
    
    if isinstance(request, BarsRequest):
        return await provider.get_bars(request)
    elif isinstance(request, QuoteRequest):
        return await provider.get_quote(request)
    else:
        raise ValueError(f"Invalid request type: {type(request)}")


def list_providers() -> list[ProviderInfo]:
    """
    List all available providers with replay status.
    
    Returns:
        List of ProviderInfo
    """
    if not _providers:
        _init_providers()
    
    # Get replay metadata
    from ..replay import list_replays
    replay_count = len(list_replays())
    replay_available = replay_count > 0
    
    # Determine mode
    demo_mode = os.getenv("DEMO_MODE", "0") == "1"
    mode = "DEMO" if demo_mode else "LOCAL"
    replay_enabled = not demo_mode  # Can save replays in LOCAL
    
    providers_info = []
    
    # Demo provider
    if ProviderName.DEMO in _providers:
        providers_info.append(ProviderInfo(
            name=ProviderName.DEMO,
            enabled=True,
            description="Demo provider using CSV fixtures (replay-first)",
            requires_auth=False,
            supports_realtime=False,
            replay_available=replay_available,
            replay_enabled=replay_enabled,
            mode=mode
        ))
    
    # Yahoo provider
    if ProviderName.YAHOO in _providers:
        providers_info.append(ProviderInfo(
            name=ProviderName.YAHOO,
            enabled=True,
            description="Yahoo Finance provider with caching",
            requires_auth=False,
            supports_realtime=True,
            replay_available=False,  # Yahoo doesn't use replay cache
            replay_enabled=False,
            mode=mode
        ))
    
    return providers_info


__all__ = [
    "MarketDataProvider",
    "ProviderName",
    "BarsRequest",
    "BarsResponse",
    "QuoteRequest",
    "QuoteResponse",
    "ProviderInfo",
    "get_provider",
    "get_market_data",
    "list_providers"
]
