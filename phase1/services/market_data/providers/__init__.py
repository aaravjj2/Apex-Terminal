"""
Market data providers package.

Provides unified interface to multiple market data sources.
Routes through ProviderRouter — NEVER falls back to demo/mock.
"""

import structlog
from typing import Dict, Optional

from .base import MarketDataProvider
from .types import (
    BarsRequest, BarsResponse, QuoteRequest, QuoteResponse,
    ProviderName, ProviderInfo
)

logger = structlog.get_logger(__name__)

# Legacy provider registry kept for backward-compat; the authoritative
# path is now through ProviderRouter.
_providers: Dict[ProviderName, MarketDataProvider] = {}


def _init_providers():
    """
    Initialize providers via the ProviderRouter.
    Registers every router-managed provider into the legacy dict so
    existing callsites (get_provider / get_market_data) keep working.
    """
    global _providers
    from ..provider_router import get_router
    router = get_router()
    for pname in router.available:
        prov = router.get(pname)
        if prov is not None:
            _providers[pname] = prov
    logger.info("providers_init_via_router", providers=list(_providers.keys()))


def get_provider(provider_name: ProviderName) -> MarketDataProvider:
    """
    Get provider instance by name.

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
        provider_name: Provider to use
        request: BarsRequest or QuoteRequest

    Returns:
        BarsResponse or QuoteResponse
    """
    provider = get_provider(provider_name)

    if isinstance(request, BarsRequest):
        return await provider.get_bars(request)
    elif isinstance(request, QuoteRequest):
        return await provider.get_quote(request)
    else:
        raise ValueError(f"Invalid request type: {type(request)}")


def list_providers() -> list[ProviderInfo]:
    """List all available providers."""
    from ..provider_router import get_router
    return get_router().list_providers()


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
