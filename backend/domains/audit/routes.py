"""
backend/domains/audit/routes.py
---------------------------------
Audit domain router: /api/v3/events/*

Provides:
  GET  /api/v3/events               – recent events (paginated)
  POST /api/v3/events/search        – search by filter
  GET  /api/v3/events/{event_id}    – single event detail
  POST /api/v3/events/emit          – (internal) emit a test event (dev only)
"""
from __future__ import annotations

import sys
from pathlib import Path

# Ensure backend package is importable
_REPO_ROOT = Path(__file__).parent.parent.parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from fastapi import APIRouter, Query, HTTPException

from backend.core.contracts.events import AuditEvent, EventCategory, EventFilter
from backend.core.contracts.common import new_correlation_id, utc_now_ms, PaginatedResponse
from backend.core.event_bus import publish, get_memory_events, make_event
from .models import AuditSearchResult

router = APIRouter(prefix="/api/v3/events", tags=["audit-v3"])


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("", response_model=PaginatedResponse)
async def list_events(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    category: EventCategory | None = Query(default=None),
) -> PaginatedResponse:
    """Return recent audit events from the bus memory store, newest first."""
    events = get_memory_events()
    if category:
        events = [e for e in events if e.category == category]
    total = len(events)
    start = (page - 1) * page_size
    items = events[start : start + page_size]
    return PaginatedResponse(
        items=[e.model_dump() for e in items],
        total=total,
        page=page,
        page_size=page_size,
        has_next=(start + page_size) < total,
    )


@router.post("/search", response_model=AuditSearchResult)
async def search_events(filters: EventFilter) -> AuditSearchResult:
    """Search events in the bus memory store by filter criteria."""
    results = get_memory_events()
    if filters.correlation_id:
        results = [e for e in results if e.correlation_id == filters.correlation_id]
    if filters.category:
        results = [e for e in results if e.category == filters.category]
    if filters.entity_type:
        results = [e for e in results if e.entity_type == filters.entity_type]
    if filters.entity_id:
        results = [e for e in results if e.entity_id == filters.entity_id]
    if filters.since_ts:
        results = [e for e in results if e.timestamp >= filters.since_ts]
    if filters.until_ts:
        results = [e for e in results if e.timestamp <= filters.until_ts]

    results = list(results)[: filters.limit]
    return AuditSearchResult(events=results, total=len(results))


@router.get("/{event_id}", response_model=AuditEvent)
async def get_event(event_id: str) -> AuditEvent:
    """Retrieve a single event by ID from the memory store."""
    for event in get_memory_events():
        if event.event_id == event_id:
            return event
    raise HTTPException(status_code=404, detail=f"Event {event_id!r} not found")


@router.post("/emit", response_model=AuditEvent, status_code=201)
async def emit_test_event(body: dict) -> AuditEvent:
    """
    (Dev/test) Emit an event into the bus.
    Payload: {category, action, entity_type?, entity_id?, actor?, payload?}
    """
    try:
        cat = EventCategory(body.get("category", "system"))
    except ValueError:
        cat = EventCategory.SYSTEM
    event = make_event(
        category=cat,
        action=body.get("action", "test_event"),
        entity_type=body.get("entity_type"),
        entity_id=body.get("entity_id"),
        actor=body.get("actor"),
        correlation_id=body.get("correlation_id"),
        payload=body.get("payload", {}),
    )
    await publish(event)
    return event
