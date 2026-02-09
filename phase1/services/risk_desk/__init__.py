"""
Risk Desk module — Week 1: Portfolio validation engine.

Provides CSV-based portfolio ingestion, schema validation,
symbol normalization, expiry format checks, and contract
multiplier sanity checks against a synthetic options snapshot.
"""

from .schemas import (
    PortfolioRow,
    Portfolio,
    SnapshotEntry,
    Snapshot,
    ValidationIssue,
    ValidationResult,
    Severity,
)
from .validator import validate_portfolio

__all__ = [
    "PortfolioRow",
    "Portfolio",
    "SnapshotEntry",
    "Snapshot",
    "ValidationIssue",
    "ValidationResult",
    "Severity",
    "validate_portfolio",
]
