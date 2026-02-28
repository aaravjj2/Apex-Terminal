"""
backend/domains/audit/models.py
---------------------------------
Audit domain models.

All events received from the event bus are:
  1. Persisted to DB (append-only table)
  2. Indexed to ES apex-events-<YYYY.MM> (monthly rollover)
"""
from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, Field

from backend.core.contracts.events import AuditEvent, EventCategory, EventSeverity
from backend.core.contracts.common import new_correlation_id, utc_now_ms


class AuditEventRecord(BaseModel):
    """
    DB-persisted version of AuditEvent.
    Stored in the audit_events append-only table.
    """
    id: Optional[int] = None            # auto-increment PK
    event_id: str
    correlation_id: str
    category: EventCategory
    action: str
    actor: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    severity: EventSeverity
    payload: dict[str, Any]
    timestamp: float
    indexed_at: Optional[float] = None  # set after ES indexing

    @classmethod
    def from_event(cls, event: AuditEvent) -> "AuditEventRecord":
        return cls(**event.model_dump())


class AuditSearchResult(BaseModel):
    """Response envelope for /api/v3/events/search."""
    events: list[AuditEvent]
    total: int
    correlation_id: str = Field(default_factory=new_correlation_id)
    searched_at: float = Field(default_factory=utc_now_ms)
