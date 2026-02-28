"""
backend/core/contracts/events.py
----------------------------------
Canonical event envelopes for the Apex event bus.

Any domain that emits events must use AuditEvent (or a subclass).
The audit domain consumes these; no domain imports from audit directly.
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field

from .common import new_correlation_id, utc_now_ms


class EventCategory(str, Enum):
    STRATEGY   = "strategy"
    BACKTEST   = "backtest"
    WORKFLOW   = "workflow"
    AGENT      = "agent"
    BROKER     = "broker"
    SEARCH     = "search"
    SYSTEM     = "system"
    AUDIT      = "audit"


class EventSeverity(str, Enum):
    DEBUG   = "debug"
    INFO    = "info"
    WARNING = "warning"
    ERROR   = "error"


class AuditEvent(BaseModel):
    """
    Immutable audit event – emitted by every domain action.
    Indexed into ES under apex-events-* aliases.
    """
    event_id: str = Field(default_factory=new_correlation_id)
    correlation_id: str = Field(default_factory=new_correlation_id)
    category: EventCategory
    action: str
    actor: Optional[str] = None          # user / service that triggered the event
    entity_type: Optional[str] = None    # e.g. "strategy", "backtest"
    entity_id: Optional[str] = None
    severity: EventSeverity = EventSeverity.INFO
    payload: dict[str, Any] = Field(default_factory=dict)
    timestamp: float = Field(default_factory=utc_now_ms)

    class Config:
        frozen = True          # immutable after creation


class EventFilter(BaseModel):
    """Query filter for the events search API."""
    correlation_id: Optional[str] = None
    category: Optional[EventCategory] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    since_ts: Optional[float] = None
    until_ts: Optional[float] = None
    limit: int = Field(default=100, ge=1, le=1000)
