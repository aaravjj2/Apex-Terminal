"""
backend/core/contracts/common.py
----------------------------------
Shared base types and primitive contracts used across all domains.
"""
from __future__ import annotations

import time
import uuid
from typing import Any, Optional

from pydantic import BaseModel, Field


def new_correlation_id() -> str:
    """Generate a UUID4 correlation ID."""
    return str(uuid.uuid4())


def utc_now_ms() -> float:
    """Current UTC time as Unix timestamp (float seconds)."""
    return time.time()


class PaginationParams(BaseModel):
    """Shared pagination parameters."""
    page: int = Field(default=1, ge=1, description="1-based page number")
    page_size: int = Field(default=50, ge=1, le=500)


class PaginatedResponse(BaseModel):
    """Generic paginated response envelope."""
    items: list[Any]
    total: int
    page: int
    page_size: int
    has_next: bool


class ErrorResponse(BaseModel):
    """Standard error response."""
    error: str
    detail: Optional[str] = None
    correlation_id: str = Field(default_factory=new_correlation_id)
    timestamp: float = Field(default_factory=utc_now_ms)


class HealthStatus(BaseModel):
    """Canonical health status for any sub-system."""
    connected: bool
    latency_ms: float
    error: Optional[str] = None
    checked_at: float = Field(default_factory=utc_now_ms)
