"""
Pydantic domain schemas for Risk Desk Week 1.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class Severity(str, Enum):
    ERROR = "error"
    WARNING = "warning"


class PortfolioRow(BaseModel):
    """A single row parsed from the uploaded CSV."""

    row_number: int = Field(..., description="1-based row index from original CSV")
    symbol: str = Field("", description="Underlying ticker, e.g. AAPL")
    option_type: str = Field("", description="'call' or 'put'")
    strike: Optional[float] = Field(None, description="Strike price")
    expiry: str = Field("", description="Expiration date string")
    quantity: Optional[int] = Field(None, description="Signed quantity (+ long, - short)")
    side: str = Field("", description="'buy' or 'sell'")
    multiplier: Optional[float] = Field(None, description="Contract multiplier, typically 100")
    raw: dict = Field(default_factory=dict, description="Original CSV row as dict for debugging")


class Portfolio(BaseModel):
    """Parsed portfolio from CSV upload."""

    rows: list[PortfolioRow] = Field(default_factory=list)
    column_names: list[str] = Field(default_factory=list)


class SnapshotEntry(BaseModel):
    """A single synthetic options snapshot entry."""

    symbol: str
    expiry: str
    strike: float
    option_type: str
    bid: float = 0.0
    ask: float = 0.0
    mid: float = 0.0
    iv: float = 0.0
    delta: float = 0.0


class Snapshot(BaseModel):
    """Container for the entire snapshot fixture."""

    entries: list[SnapshotEntry] = Field(default_factory=list)
    generated_at: str = ""


class ValidationIssue(BaseModel):
    """A single validation issue (error or warning)."""

    severity: Severity
    row: Optional[int] = Field(None, description="1-based row number, None for portfolio-level issues")
    field: str = Field("", description="Column/field name that caused the issue")
    message: str = Field("", description="Human-readable explanation")
    code: str = Field("", description="Machine-readable issue code, e.g. MISSING_STRIKE")


class ValidationResult(BaseModel):
    """Top-level validation response."""

    valid: bool = Field(..., description="True if zero errors (warnings are okay)")
    total_rows: int = 0
    error_count: int = 0
    warning_count: int = 0
    issues: list[ValidationIssue] = Field(default_factory=list)
