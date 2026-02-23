"""
backend/core/event_bus.py
--------------------------
Lightweight event bus with:
  • correlation_id propagation (per-request context var)
  • async publish API
  • ES persistence hook (indexed into apex-events-YYYY.MM)
  • In-memory subscriber registry

Usage:
    from backend.core.event_bus import publish, set_correlation_id

    set_correlation_id("my-request-id")
    await publish(AuditEvent(
        category=EventCategory.BACKTEST,
        action="run_started",
        entity_type="backtest",
        entity_id=str(run_id),
    ))
"""
from __future__ import annotations

import asyncio
import contextvars
import logging
import time
from typing import Callable, Awaitable, Any
from pathlib import Path
import sys

# Ensure repo root is in path so backend.core.contracts works
_REPO_ROOT = Path(__file__).parent.parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from backend.core.contracts.events import AuditEvent, EventCategory, EventSeverity
from backend.core.contracts.common import new_correlation_id

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Context var – propagates correlation_id across async task boundaries
# ---------------------------------------------------------------------------

_correlation_ctx: contextvars.ContextVar[str] = contextvars.ContextVar(
    "correlation_id", default=""
)


def get_correlation_id() -> str:
    """Return the current request's correlation_id, or generate one."""
    cid = _correlation_ctx.get()
    if not cid:
        cid = new_correlation_id()
        _correlation_ctx.set(cid)
    return cid


def set_correlation_id(cid: str) -> contextvars.Token:
    """Set the current correlation_id. Returns a token to restore prior value."""
    return _correlation_ctx.set(cid)


# ---------------------------------------------------------------------------
# Subscriber registry
# ---------------------------------------------------------------------------

_subscribers: list[Callable[[AuditEvent], Awaitable[None]]] = []


def subscribe(handler: Callable[[AuditEvent], Awaitable[None]]) -> None:
    """Register an async event handler."""
    _subscribers.append(handler)


def unsubscribe(handler: Callable[[AuditEvent], Awaitable[None]]) -> None:
    """Remove a handler."""
    try:
        _subscribers.remove(handler)
    except ValueError:
        pass


# ---------------------------------------------------------------------------
# In-memory ring buffer (survives restart in dev; cleared on restart)
# ---------------------------------------------------------------------------

MAX_MEMORY_EVENTS = 10_000
_memory_store: list[AuditEvent] = []


def get_memory_events() -> list[AuditEvent]:
    """Return all in-memory events (newest first)."""
    return list(reversed(_memory_store))


# ---------------------------------------------------------------------------
# ES indexer (optional – skipped if ES unreachable)
# ---------------------------------------------------------------------------

_ES_INDEX_ENABLED = True  # set to False in tests if needed


def disable_es_indexing() -> None:
    global _ES_INDEX_ENABLED
    _ES_INDEX_ENABLED = False


def enable_es_indexing() -> None:
    global _ES_INDEX_ENABLED
    _ES_INDEX_ENABLED = True


async def _index_to_es(event: AuditEvent) -> None:
    """Index event into ES apex-events-YYYY.MM rollover alias."""
    if not _ES_INDEX_ENABLED:
        return
    try:
        import httpx
        from datetime import datetime
        month_suffix = datetime.utcfromtimestamp(event.timestamp).strftime("%Y.%m")
        index_name = f"apex-events-{month_suffix}"
        async with httpx.AsyncClient(timeout=5.0) as client:
            doc = event.model_dump()
            doc["@timestamp"] = datetime.utcfromtimestamp(event.timestamp).isoformat() + "Z"
            resp = await client.post(
                f"http://localhost:9200/{index_name}/_doc",
                json=doc,
                headers={"Content-Type": "application/json"},
            )
            if resp.status_code not in (200, 201):
                logger.warning(
                    "event_es_index_failed",
                    extra={"status": resp.status_code, "event_id": event.event_id},
                )
    except Exception as exc:
        logger.warning("event_es_index_error", extra={"error": str(exc)})


# ---------------------------------------------------------------------------
# Core publish API
# ---------------------------------------------------------------------------


async def publish(event: AuditEvent) -> None:
    """
    Publish an event to all subscribers + memory store + ES.

    The event's correlation_id is set from the current context if not provided.
    """
    # Inject correlation_id if not set on the event
    if not event.correlation_id:
        # AuditEvent is frozen so we must re-create with correct cid
        event = event.model_copy(update={"correlation_id": get_correlation_id()})

    # Persist to memory ring buffer
    _memory_store.append(event)
    if len(_memory_store) > MAX_MEMORY_EVENTS:
        _memory_store.pop(0)

    # Notify subscribers (fire-and-forget; errors are logged not raised)
    for handler in list(_subscribers):
        try:
            await handler(event)
        except Exception as exc:
            logger.error(
                "event_subscriber_error",
                extra={"handler": getattr(handler, "__name__", str(handler)), "error": str(exc)},
            )

    # Index to ES (fire-and-forget)
    asyncio.create_task(_index_to_es(event))


def publish_sync(event: AuditEvent) -> None:
    """
    Synchronous wrapper for publish().
    Use only outside of an async context (e.g. in sync tests).
    """
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(publish(event))
        else:
            loop.run_until_complete(publish(event))
    except RuntimeError:
        asyncio.run(publish(event))


# ---------------------------------------------------------------------------
# Convenience factories
# ---------------------------------------------------------------------------


def make_event(
    category: EventCategory,
    action: str,
    *,
    entity_type: str | None = None,
    entity_id: str | None = None,
    actor: str | None = None,
    severity: EventSeverity = EventSeverity.INFO,
    payload: dict[str, Any] | None = None,
    correlation_id: str | None = None,
) -> AuditEvent:
    """Create an AuditEvent with the current context's correlation_id."""
    return AuditEvent(
        correlation_id=correlation_id or get_correlation_id(),
        category=category,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        actor=actor,
        severity=severity,
        payload=payload or {},
    )
