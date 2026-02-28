"""
backend/domains/broker/models.py
----------------------------------
Broker domain models: account, position, order, and health schemas.
"""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field

from backend.core.contracts.common import HealthStatus, new_correlation_id, utc_now_ms


class BrokerAccountStatus(BaseModel):
    """Live account snapshot from the broker."""
    account_number: str
    account_status: str          # "ACTIVE", "INACTIVE", etc.
    cash: float
    portfolio_value: float
    buying_power: float
    trading_blocked: bool
    fetched_at: float = Field(default_factory=utc_now_ms)


class BrokerHealth(HealthStatus):
    """Extended health info for the broker dep, returned by /api/v3/broker/health."""
    account_status: Optional[str] = None
    account_number: Optional[str] = None
    trading_blocked: Optional[bool] = None
    cash: Optional[float] = None


class BrokerHealthResponse(BaseModel):
    """Top-level response for /api/v3/broker/health."""
    correlation_id: str = Field(default_factory=new_correlation_id)
    checked_at: float = Field(default_factory=utc_now_ms)
    broker: BrokerHealth
