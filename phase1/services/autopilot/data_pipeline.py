"""
Autopilot Data Pipeline — Phase 1A: Data Plane Orchestrator

Coordinates all data plane components:
  - QuoteGateway (live quotes, 1-2s cache per symbol)
  - OptionsChainGateway (live chain, 30s cache)
  - MarketSession truth (server-side ET via Alpaca clock)
  - Data Freshness SLA enforcement (rejects stale inputs)

Design:
  - Singleton, long-lived. Start once at app startup.
  - All data fetches are async with explicit SLA timeouts.
  - Stale data triggers QuoteUnavailableError or ChainUnavailableError.
  - No demo/mock/seed data in any code path.

Freshness SLAs (configurable via env):
  QUOTE_MAX_AGE_S     = 30  (quote older than 30s is stale)
  CHAIN_MAX_AGE_S     = 90  (chain older than 90s is stale)
  QUOTE_FETCH_TIMEOUT = 5   (max 5s to get a quote, else fail)
  CHAIN_FETCH_TIMEOUT = 15  (max 15s to get chain, else fail)

Usage:
  from .data_pipeline import get_data_pipeline, DataPipelineError

  dp = get_data_pipeline()
  await dp.start()

  result = await dp.get_symbol_snapshot("AAPL")
  # raises DataPipelineError if stale or unavailable
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ── SLA config ────────────────────────────────────────────────────────────────

QUOTE_MAX_AGE_S      = float(os.environ.get("QUOTE_MAX_AGE_S",     "30"))
CHAIN_MAX_AGE_S      = float(os.environ.get("CHAIN_MAX_AGE_S",     "90"))
QUOTE_FETCH_TIMEOUT  = float(os.environ.get("QUOTE_FETCH_TIMEOUT",  "5"))
CHAIN_FETCH_TIMEOUT  = float(os.environ.get("CHAIN_FETCH_TIMEOUT", "15"))
BARS_MAX_AGE_HOURS   = float(os.environ.get("BARS_MAX_AGE_HOURS",   "4"))


# ── Errors ────────────────────────────────────────────────────────────────────

class DataPipelineError(Exception):
    """Base class for all data pipeline errors."""
    def __init__(self, msg: str, symbol: str = "", correlation_id: str = "", code: str = "PIPELINE_ERROR"):
        super().__init__(msg)
        self.symbol = symbol
        self.correlation_id = correlation_id or f"dp-{uuid.uuid4().hex[:8]}"
        self.code = code

    def to_dict(self) -> Dict[str, Any]:
        return {
            "error": str(self),
            "code": self.code,
            "symbol": self.symbol,
            "correlation_id": self.correlation_id,
        }


class StaleQuoteError(DataPipelineError):
    """Quote exists but is older than SLA."""
    def __init__(self, symbol: str, age_s: float, cid: str = ""):
        super().__init__(
            f"Quote for {symbol} is {age_s:.1f}s old (SLA={QUOTE_MAX_AGE_S}s)",
            symbol=symbol, correlation_id=cid, code="STALE_QUOTE"
        )
        self.age_s = age_s


class ChainUnavailableError(DataPipelineError):
    """Options chain cannot be fetched or is stale."""
    def __init__(self, symbol: str, reason: str, cid: str = ""):
        super().__init__(
            f"Options chain for {symbol} unavailable: {reason}",
            symbol=symbol, correlation_id=cid, code="CHAIN_UNAVAILABLE"
        )


class QuoteFetchError(DataPipelineError):
    """Quote could not be fetched within timeout."""
    def __init__(self, symbol: str, reason: str, cid: str = ""):
        super().__init__(
            f"Quote fetch failed for {symbol}: {reason}",
            symbol=symbol, correlation_id=cid, code="QUOTE_FETCH_FAILED"
        )


# ── Data containers ───────────────────────────────────────────────────────────

@dataclass
class SymbolSnapshot:
    """Complete data snapshot for a symbol required by the brain."""
    symbol: str
    correlation_id: str

    # Quote data
    bid: float
    ask: float
    last: float
    mid: float
    spread_pct: float
    quote_age_s: float
    quote_source: str

    # Options chain summary
    contracts_count: int
    chain_age_s: float
    chain_source: str

    # Bars / regime data
    has_bars: bool
    bars_period: str  # "1D", "1H", etc.

    # Timestamps
    fetched_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    # Raw data (optional — for downstream)
    chain: Optional[List[Dict]] = field(default=None, repr=False)

    def is_tradeable(self) -> Tuple[bool, str]:
        """Check if this snapshot meets all SLA requirements for trading."""
        if self.quote_age_s > QUOTE_MAX_AGE_S:
            return False, f"quote_stale:{self.quote_age_s:.0f}s"
        if self.chain_age_s > CHAIN_MAX_AGE_S:
            return False, f"chain_stale:{self.chain_age_s:.0f}s"
        if self.contracts_count == 0:
            return False, "chain_empty"
        if self.bid <= 0 or self.ask <= 0:
            return False, "invalid_quote"
        if self.spread_pct > 50.0:
            return False, f"spread_too_wide:{self.spread_pct:.1f}%"
        return True, "ok"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "correlation_id": self.correlation_id,
            "bid": self.bid,
            "ask": self.ask,
            "last": self.last,
            "mid": self.mid,
            "spread_pct": round(self.spread_pct, 4),
            "quote_age_s": round(self.quote_age_s, 2),
            "quote_source": self.quote_source,
            "contracts_count": self.contracts_count,
            "chain_age_s": round(self.chain_age_s, 2),
            "chain_source": self.chain_source,
            "has_bars": self.has_bars,
            "bars_period": self.bars_period,
            "fetched_at": self.fetched_at.isoformat(),
            "tradeable": self.is_tradeable()[0],
            "tradeable_reason": self.is_tradeable()[1],
        }


@dataclass
class DataPlaneHealth:
    """Health snapshot of the entire data plane."""
    timestamp: datetime
    correlation_id: str

    # Quote provider
    quote_provider_ok: bool
    last_quote_ts: Optional[datetime]
    quote_latency_ms: float
    quote_source: str

    # Options chain
    chain_provider_ok: bool
    last_chain_ts: Optional[datetime]
    chain_latency_ms: float
    contracts_last_fetch: int

    # Bars / history
    bars_ok: bool
    bars_source: str

    # Market session
    market_open: bool
    session_state: str
    next_event_ts: Optional[datetime]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "correlation_id": self.correlation_id,
            "quote_provider": {
                "ok": self.quote_provider_ok,
                "last_quote_ts": self.last_quote_ts.isoformat() if self.last_quote_ts else None,
                "latency_ms": round(self.quote_latency_ms, 2),
                "source": self.quote_source,
            },
            "options_chain": {
                "ok": self.chain_provider_ok,
                "last_chain_ts": self.last_chain_ts.isoformat() if self.last_chain_ts else None,
                "latency_ms": round(self.chain_latency_ms, 2),
                "contracts_last_fetch": self.contracts_last_fetch,
            },
            "bars": {
                "ok": self.bars_ok,
                "source": self.bars_source,
            },
            "market_session": {
                "open": self.market_open,
                "state": self.session_state,
                "next_event_ts": self.next_event_ts.isoformat() if self.next_event_ts else None,
            },
        }


# ── Data Pipeline ─────────────────────────────────────────────────────────────

class DataPipeline:
    """
    Central data plane coordinator.

    Responsibilities:
    1. Manage lifecycle of QuoteGateway and OptionsGateway singletons
    2. Enforce SLA freshness before returning data to brain
    3. Provide health snapshot for observability
    4. Fail fast with structured errors — no silent fallback to stale data
    """

    def __init__(self):
        self._started = False
        self._chain_cache: Dict[str, Tuple[List[Dict], datetime]] = {}  # symbol → (chain, ts)
        self._health: Optional[DataPlaneHealth] = None
        self._last_health_ts: Optional[float] = None
        self._HEALTH_CACHE_S = 10.0

    async def start(self) -> None:
        """Start the data plane (idempotent)."""
        if self._started:
            return
        logger.info("DataPipeline: starting...")

        # Start QuoteGateway
        try:
            from .quote_gateway import get_quote_gateway
            gw = get_quote_gateway()
            await gw.start()
            logger.info("DataPipeline: QuoteGateway started")
        except Exception as exc:
            logger.warning(f"DataPipeline: QuoteGateway start failed (non-fatal): {exc}")

        self._started = True
        logger.info("DataPipeline: ready")

    async def stop(self) -> None:
        """Graceful shutdown."""
        try:
            from .quote_gateway import get_quote_gateway
            gw = get_quote_gateway()
            await gw.stop()
        except Exception:
            pass
        self._started = False

    # ── Quote ─────────────────────────────────────────────────────────────────

    async def get_quote(self, symbol: str, cid: str = "") -> Dict[str, Any]:
        """
        Get a fresh live quote for symbol.

        Raises:
            QuoteFetchError if quote cannot be obtained
            StaleQuoteError if quote exists but violates SLA
        """
        cid = cid or f"dp-{uuid.uuid4().hex[:8]}"
        start = time.monotonic()

        try:
            from .quote_gateway import get_quote_gateway, QuoteUnavailableError
            gw = get_quote_gateway()

            try:
                quote = await asyncio.wait_for(
                    gw.get_quote(symbol),
                    timeout=QUOTE_FETCH_TIMEOUT
                )
            except asyncio.TimeoutError:
                raise QuoteFetchError(symbol, f"timeout_{QUOTE_FETCH_TIMEOUT}s", cid)
            except QuoteUnavailableError as exc:
                raise QuoteFetchError(symbol, str(exc), cid)

            # SLA check
            age_s = quote.age_seconds
            if age_s > QUOTE_MAX_AGE_S:
                raise StaleQuoteError(symbol, age_s, cid)

            latency_ms = (time.monotonic() - start) * 1000
            return {
                "symbol": symbol,
                "bid": quote.bid,
                "ask": quote.ask,
                "last": quote.last,
                "mid": quote.mid,
                "spread_pct": round(quote.spread_pct, 4),
                "volume": quote.volume,
                "vwap": quote.vwap,
                "age_s": round(age_s, 2),
                "source": quote.source,
                "timestamp": quote.timestamp.isoformat(),
                "latency_ms": round(latency_ms, 2),
                "correlation_id": cid,
            }

        except (QuoteFetchError, StaleQuoteError):
            raise
        except Exception as exc:
            raise QuoteFetchError(symbol, f"unexpected: {exc}", cid)

    async def get_quotes_bulk(self, symbols: List[str], cid: str = "") -> Dict[str, Dict[str, Any]]:
        """
        Fetch quotes for multiple symbols concurrently.
        Returns dict of symbol → quote_dict.
        Symbols that fail are excluded (errors logged).
        """
        cid = cid or f"dp-{uuid.uuid4().hex[:8]}"
        tasks = {sym: self.get_quote(sym, cid) for sym in symbols}
        results = await asyncio.gather(*tasks.values(), return_exceptions=True)

        out: Dict[str, Dict[str, Any]] = {}
        for sym, res in zip(tasks.keys(), results):
            if isinstance(res, Exception):
                logger.warning(f"DataPipeline.get_quotes_bulk: {sym} failed: {res}")
            else:
                out[sym] = res
        return out

    # ── Options Chain ─────────────────────────────────────────────────────────

    async def get_options_chain(
        self,
        symbol: str,
        dte_min: int = 7,
        dte_max: int = 45,
        force_refresh: bool = False,
        cid: str = "",
    ) -> List[Dict[str, Any]]:
        """
        Fetch live options chain for symbol.

        Returns list of contract dicts with greeks.
        Raises ChainUnavailableError if chain cannot be obtained or is stale.
        """
        cid = cid or f"dp-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc)

        # Check cache
        if not force_refresh and symbol in self._chain_cache:
            cached_chain, cached_ts = self._chain_cache[symbol]
            age_s = (now - cached_ts).total_seconds()
            if age_s <= CHAIN_MAX_AGE_S and len(cached_chain) > 0:
                logger.debug(f"DataPipeline: chain cache hit for {symbol} (age={age_s:.0f}s)")
                return cached_chain

        # Fetch live chain
        start = time.monotonic()
        try:
            from .options_gateway import get_options_gateway
            gw = get_options_gateway()

            chain = await asyncio.wait_for(
                gw.get_options_chain(symbol, dte_min=dte_min, dte_max=dte_max),
                timeout=CHAIN_FETCH_TIMEOUT
            )
            latency_ms = (time.monotonic() - start) * 1000
            logger.info(f"DataPipeline: chain fetched for {symbol}: {len(chain)} contracts ({latency_ms:.0f}ms)")

            # Convert to dicts
            chain_dicts = [c.to_dict() for c in chain] if hasattr(chain[0], "to_dict") else chain
            self._chain_cache[symbol] = (chain_dicts, now)
            return chain_dicts

        except asyncio.TimeoutError:
            raise ChainUnavailableError(symbol, f"timeout_{CHAIN_FETCH_TIMEOUT}s", cid)
        except Exception as exc:
            raise ChainUnavailableError(symbol, str(exc)[:100], cid)

    # ── Full Symbol Snapshot ───────────────────────────────────────────────────

    async def get_symbol_snapshot(
        self,
        symbol: str,
        dte_min: int = 7,
        dte_max: int = 45,
        cid: str = "",
    ) -> SymbolSnapshot:
        """
        Get complete snapshot: quote + chain + bars check.
        This is what the brain calls once per symbol per cycle.

        Raises DataPipelineError if snapshot cannot be built.
        """
        cid = cid or f"dp-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc)

        # Fetch quote and chain concurrently
        quote_task = self.get_quote(symbol, cid)
        chain_task = self.get_options_chain(symbol, dte_min=dte_min, dte_max=dte_max, cid=cid)

        quote_result, chain_result = await asyncio.gather(
            quote_task, chain_task, return_exceptions=True
        )

        # Handle quote error
        if isinstance(quote_result, DataPipelineError):
            raise quote_result
        if isinstance(quote_result, Exception):
            raise QuoteFetchError(symbol, str(quote_result), cid)

        # Handle chain error (non-fatal if chain unavailable)
        chain: List[Dict] = []
        chain_age_s = 0.0
        chain_source = "unavailable"
        chain_error: Optional[str] = None

        if isinstance(chain_result, Exception):
            chain_error = str(chain_result)[:100]
            logger.warning(f"DataPipeline: chain unavailable for {symbol}: {chain_error}")
        else:
            chain = chain_result
            cached_ts = self._chain_cache.get(symbol, (None, now))[1]
            chain_age_s = (now - cached_ts).total_seconds()
            chain_source = "alpaca_options"

        # Bars check
        bars_ok, bars_period = await self._check_bars(symbol)

        q = quote_result
        return SymbolSnapshot(
            symbol=symbol,
            correlation_id=cid,
            bid=q["bid"],
            ask=q["ask"],
            last=q["last"],
            mid=q["mid"],
            spread_pct=q["spread_pct"],
            quote_age_s=q["age_s"],
            quote_source=q["source"],
            contracts_count=len(chain),
            chain_age_s=chain_age_s,
            chain_source=chain_source if not chain_error else "error",
            has_bars=bars_ok,
            bars_period=bars_period,
            fetched_at=now,
            chain=chain,
        )

    async def get_snapshots_bulk(
        self, symbols: List[str], dte_min: int = 7, dte_max: int = 45, cid: str = ""
    ) -> Dict[str, SymbolSnapshot]:
        """Fetch snapshots for all symbols concurrently."""
        cid = cid or f"dp-{uuid.uuid4().hex[:8]}"
        tasks = [self.get_symbol_snapshot(s, dte_min=dte_min, dte_max=dte_max, cid=cid) for s in symbols]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        out: Dict[str, SymbolSnapshot] = {}
        for sym, res in zip(symbols, results):
            if isinstance(res, Exception):
                logger.warning(f"DataPipeline.get_snapshots_bulk: {sym} failed: {res}")
            else:
                out[sym] = res
        return out

    # ── Bars ──────────────────────────────────────────────────────────────────

    async def _check_bars(self, symbol: str) -> Tuple[bool, str]:
        """Check if historical bars are available for symbol."""
        try:
            from ..bar_engine import get_bar_engine
            engine = get_bar_engine()
            bars = await asyncio.get_event_loop().run_in_executor(
                None, lambda: engine.get_recent_bars(symbol, period="1D", limit=20)
            )
            if bars and len(bars) >= 5:
                return True, "1D"
            return False, "no_bars"
        except Exception:
            # Bars unavailable — non-fatal, brain can work without them
            return False, "unavailable"

    # ── Health ────────────────────────────────────────────────────────────────

    async def get_health(self, force: bool = False) -> DataPlaneHealth:
        """Get health snapshot (cached for 10s)."""
        now_mono = time.monotonic()
        if (
            not force
            and self._health is not None
            and self._last_health_ts is not None
            and (now_mono - self._last_health_ts) < self._HEALTH_CACHE_S
        ):
            return self._health

        cid = f"dph-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc)

        # Check quote provider
        quote_ok = False
        quote_latency_ms = 0.0
        last_quote_ts: Optional[datetime] = None
        quote_source = "unknown"
        try:
            q = await asyncio.wait_for(self.get_quote("SPY", cid), timeout=5.0)
            quote_ok = True
            quote_latency_ms = q.get("latency_ms", 0.0)
            last_quote_ts = datetime.fromisoformat(q["timestamp"])
            quote_source = q.get("source", "unknown")
        except Exception as e:
            logger.debug(f"DataPipeline health quote check: {e}")

        # Check chain provider
        chain_ok = False
        chain_latency_ms = 0.0
        last_chain_ts: Optional[datetime] = None
        contracts_count = 0
        try:
            start = time.monotonic()
            chain = await asyncio.wait_for(self.get_options_chain("SPY"), timeout=15.0)
            chain_latency_ms = (time.monotonic() - start) * 1000
            chain_ok = len(chain) > 0
            contracts_count = len(chain)
            last_chain_ts = now
        except Exception as e:
            logger.debug(f"DataPipeline health chain check: {e}")

        # Check bars
        bars_ok, bars_source = await self._check_bars("SPY")

        # Market session
        market_open = False
        session_state = "unknown"
        next_event_ts: Optional[datetime] = None
        try:
            from .trading_window import check_trading_window, get_trading_gate
            status = check_trading_window(None)
            market_open = status.allow_trading
            session_state = status.state.value
        except Exception as e:
            logger.debug(f"DataPipeline health market session: {e}")

        health = DataPlaneHealth(
            timestamp=now,
            correlation_id=cid,
            quote_provider_ok=quote_ok,
            last_quote_ts=last_quote_ts,
            quote_latency_ms=quote_latency_ms,
            quote_source=quote_source,
            chain_provider_ok=chain_ok,
            last_chain_ts=last_chain_ts,
            chain_latency_ms=chain_latency_ms,
            contracts_last_fetch=contracts_count,
            bars_ok=bars_ok,
            bars_source=bars_source,
            market_open=market_open,
            session_state=session_state,
            next_event_ts=next_event_ts,
        )

        self._health = health
        self._last_health_ts = now_mono
        return health

    # ── Market session ────────────────────────────────────────────────────────

    async def is_market_open(self) -> bool:
        """Quick market session check."""
        try:
            from .trading_window import check_trading_window
            status = check_trading_window(None)
            return status.allow_trading
        except Exception:
            return False

    def invalidate_chain_cache(self, symbol: Optional[str] = None) -> None:
        """Force-expire chain cache for a symbol or all symbols."""
        if symbol:
            self._chain_cache.pop(symbol, None)
        else:
            self._chain_cache.clear()


# ── Singleton ─────────────────────────────────────────────────────────────────

_PIPELINE: Optional[DataPipeline] = None


def get_data_pipeline() -> DataPipeline:
    """Get the singleton DataPipeline instance."""
    global _PIPELINE
    if _PIPELINE is None:
        _PIPELINE = DataPipeline()
    return _PIPELINE


async def start_data_pipeline() -> DataPipeline:
    """Start and return the data pipeline. Call once at app startup."""
    dp = get_data_pipeline()
    await dp.start()
    return dp
