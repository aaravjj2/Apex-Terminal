"""
Provider Router — deterministic priority routing for market data.

Priority for daily bars:  yfinance (primary) → Tiingo → Polygon
Priority for quotes:      first(Finnhub, Polygon, Tiingo) by key presence → yfinance
Fallback order is deterministic: no random selection, no demo data.

NON-NEGOTIABLE: NEVER returns demo/mock/dummy/fake data.
"""
from __future__ import annotations

import asyncio
import time
from datetime import datetime
from typing import Dict, List, Optional, Sequence

import structlog

from .providers.base import MarketDataProvider
from .providers.types import (
    BarsRequest, BarsResponse, QuoteRequest, QuoteResponse,
    ProviderName, ProviderInfo,
)
from .models import MarketDataError

logger = structlog.get_logger(__name__)

# ── Priority chains (highest first) ──────────────────────────────────
BARS_PRIORITY: Sequence[ProviderName] = (
    ProviderName.YAHOO,
    ProviderName.TIINGO,
    ProviderName.POLYGON,
)

QUOTE_PRIORITY: Sequence[ProviderName] = (
    ProviderName.FINNHUB,
    ProviderName.POLYGON,
    ProviderName.TIINGO,
    ProviderName.YAHOO,
)


class ProviderRouter:
    """
    Deterministic provider routing with automatic failover.

    1. Selects the highest-priority provider that has a key/is available.
    2. On fetch failure, cascades to the next provider.
    3. NEVER falls back to demo.
    """

    def __init__(self):
        self._providers: Dict[ProviderName, MarketDataProvider] = {}
        self._health_ts: Dict[ProviderName, float] = {}     # last health-check epoch
        self._health_ok: Dict[ProviderName, bool] = {}

    # ── Registration ─────────────────────────────────────────────────
    def register(self, name: ProviderName, provider: MarketDataProvider) -> None:
        if name == ProviderName.DEMO:
            logger.warning("provider_router_reject_demo",
                           msg="DEMO provider NOT allowed in router")
            return
        self._providers[name] = provider
        logger.info("provider_router_registered", provider=name.value)

    @property
    def available(self) -> List[ProviderName]:
        return list(self._providers.keys())

    def get(self, name: ProviderName) -> Optional[MarketDataProvider]:
        return self._providers.get(name)

    # ── Bars (history) ───────────────────────────────────────────────
    async def get_bars(self, request: BarsRequest) -> BarsResponse:
        """Fetch bars using priority chain. Raises on total failure."""
        errors: List[str] = []
        for pname in BARS_PRIORITY:
            prov = self._providers.get(pname)
            if prov is None:
                continue
            try:
                t0 = time.monotonic()
                resp = await prov.get_bars(request)
                elapsed = (time.monotonic() - t0) * 1000
                logger.info("router_bars_ok", provider=pname.value,
                            symbol=request.symbol, bars=len(resp.bars),
                            ms=round(elapsed, 1))
                return resp
            except Exception as e:
                errors.append(f"{pname.value}: {e}")
                logger.warning("router_bars_fail", provider=pname.value,
                               symbol=request.symbol, error=str(e))
        raise MarketDataError(
            "ALL_PROVIDERS_FAILED",
            f"No provider could fetch bars for {request.symbol}: {'; '.join(errors)}",
            "router",
            request.symbol,
        )

    # ── Quote (real-time) ────────────────────────────────────────────
    async def get_quote(self, request: QuoteRequest) -> QuoteResponse:
        """Fetch quote using priority chain. Raises on total failure."""
        errors: List[str] = []
        for pname in QUOTE_PRIORITY:
            prov = self._providers.get(pname)
            if prov is None:
                continue
            try:
                t0 = time.monotonic()
                resp = await prov.get_quote(request)
                elapsed = (time.monotonic() - t0) * 1000
                logger.info("router_quote_ok", provider=pname.value,
                            symbol=request.symbol, ms=round(elapsed, 1))
                return resp
            except Exception as e:
                errors.append(f"{pname.value}: {e}")
                logger.warning("router_quote_fail", provider=pname.value,
                               symbol=request.symbol, error=str(e))
        raise MarketDataError(
            "ALL_PROVIDERS_FAILED",
            f"No provider could fetch quote for {request.symbol}: {'; '.join(errors)}",
            "router",
            request.symbol,
        )

    # ── Health ───────────────────────────────────────────────────────
    async def health_check_all(self) -> Dict[str, bool]:
        """Parallel health check of all registered providers."""
        results: Dict[str, bool] = {}
        if not self._providers:
            return results

        async def _check(name: ProviderName, prov: MarketDataProvider):
            try:
                ok = await asyncio.wait_for(prov.health_check(), timeout=10.0)
            except Exception:
                ok = False
            self._health_ok[name] = ok
            self._health_ts[name] = time.time()
            results[name.value] = ok

        await asyncio.gather(*[
            _check(n, p) for n, p in self._providers.items()
        ])
        return results

    # ── Info ─────────────────────────────────────────────────────────
    def list_providers(self) -> List[ProviderInfo]:
        """List all registered providers with their status."""
        infos: List[ProviderInfo] = []
        for name, _prov in self._providers.items():
            healthy = self._health_ok.get(name)
            infos.append(ProviderInfo(
                name=name,
                enabled=True,
                description=f"{name.value} provider",
                requires_auth=(name != ProviderName.YAHOO),
                supports_realtime=(name != ProviderName.YAHOO),
                replay_available=False,
                replay_enabled=False,
                mode="LIVE",
            ))
        return infos


# ── Module-level singleton ───────────────────────────────────────────
_router: Optional[ProviderRouter] = None


def get_router() -> ProviderRouter:
    """Return the singleton ProviderRouter, initialising if needed."""
    global _router
    if _router is None:
        _router = _build_router()
    return _router


def _build_router() -> ProviderRouter:
    """Build a ProviderRouter wired to all providers that have keys."""
    from ..config import get_settings
    settings = get_settings()

    router = ProviderRouter()

    # Yahoo (always available — no key needed)
    try:
        from .providers.yahoo_provider import YahooProvider
        router.register(ProviderName.YAHOO, YahooProvider())
    except Exception as e:
        logger.warning("yahoo_init_fail", error=str(e))

    # Finnhub
    key = settings.finnhub_api_key
    if key:
        try:
            from .providers.finnhub_provider import FinnhubProvider
            router.register(ProviderName.FINNHUB, FinnhubProvider(api_key=key))
        except Exception as e:
            logger.warning("finnhub_init_fail", error=str(e))
    else:
        logger.info("finnhub_no_key")

    # Polygon
    key = settings.polygon_api_key
    if key:
        try:
            from .providers.polygon_provider import PolygonProvider
            router.register(ProviderName.POLYGON, PolygonProvider(api_key=key))
        except Exception as e:
            logger.warning("polygon_init_fail", error=str(e))
    else:
        logger.info("polygon_no_key")

    # Tiingo
    key = settings.tiingo_api_key
    if key:
        try:
            from .providers.tiingo_provider import TiingoProvider
            router.register(ProviderName.TIINGO, TiingoProvider(api_key=key))
        except Exception as e:
            logger.warning("tiingo_init_fail", error=str(e))
    else:
        logger.info("tiingo_no_key")

    logger.info("provider_router_ready", providers=[p.value for p in router.available])
    return router


def reset_router() -> None:
    """Reset the singleton (for testing)."""
    global _router
    _router = None
