"""
Portfolio validation engine for Risk Desk Week 1.

Validation rules implemented:
1. Schema correctness (required columns, types)
2. Symbol normalization (BRK.B ↔ BRK-B)
3. Expiry date format validation (YYYY-MM-DD)
4. Contract multiplier sanity checks
5. Leg / side contradictions (quantity sign vs side)
6. Missing strike in snapshot → warning
"""

from __future__ import annotations

import csv
import io
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Optional

from .schemas import (
    Portfolio,
    PortfolioRow,
    Severity,
    Snapshot,
    SnapshotEntry,
    ValidationIssue,
    ValidationResult,
)

# ── constants ───────────────────────────────────────────────────────────────

REQUIRED_COLUMNS = {"symbol", "option_type", "strike", "expiry", "quantity", "side"}
VALID_OPTION_TYPES = {"call", "put"}
VALID_SIDES = {"buy", "sell"}
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# Ticker aliases: CSV may use '.' while snapshot uses '-' (or vice-versa)
_TICKER_ALIAS_MAP: dict[str, str] = {
    "BRK.B": "BRK-B",
    "BRK/B": "BRK-B",
    "BF.B":  "BF-B",
    "BF/B":  "BF-B",
}

FIXTURES_DIR = Path(__file__).parent / "fixtures"


# ── helpers ─────────────────────────────────────────────────────────────────

def normalize_ticker(raw: str) -> tuple[str, bool]:
    """Return (normalized_ticker, was_aliased)."""
    upper = raw.strip().upper()
    if upper in _TICKER_ALIAS_MAP:
        return _TICKER_ALIAS_MAP[upper], True
    return upper, False


def load_default_snapshot() -> Snapshot:
    """Load the committed demo_snapshot.json fixture."""
    path = FIXTURES_DIR / "demo_snapshot.json"
    data = json.loads(path.read_text())
    entries = [SnapshotEntry(**e) for e in data.get("entries", [])]
    return Snapshot(entries=entries, generated_at=data.get("generated_at", ""))


def _snapshot_key(symbol: str, expiry: str, strike: float, option_type: str) -> str:
    return f"{symbol.upper()}|{expiry}|{strike}|{option_type.lower()}"


def _build_snapshot_index(snapshot: Snapshot) -> set[str]:
    return {_snapshot_key(e.symbol, e.expiry, e.strike, e.option_type) for e in snapshot.entries}


# ── core validation ────────────────────────────────────────────────────────

def parse_csv(csv_text: str) -> Portfolio:
    """Parse raw CSV text into a Portfolio object."""
    reader = csv.DictReader(io.StringIO(csv_text.strip()))
    fieldnames = [f.strip().lower() for f in (reader.fieldnames or [])]
    rows: list[PortfolioRow] = []
    for idx, raw_row in enumerate(reader, start=1):
        # Normalize keys
        row = {k.strip().lower(): v.strip() if v else "" for k, v in raw_row.items()}
        rows.append(
            PortfolioRow(
                row_number=idx,
                symbol=row.get("symbol", ""),
                option_type=row.get("option_type", ""),
                strike=_safe_float(row.get("strike")),
                expiry=row.get("expiry", ""),
                quantity=_safe_int(row.get("quantity")),
                side=row.get("side", ""),
                multiplier=_safe_float(row.get("multiplier")),
                raw=row,
            )
        )
    return Portfolio(rows=rows, column_names=fieldnames)


def _safe_float(v: Optional[str]) -> Optional[float]:
    if v is None or v == "":
        return None
    try:
        return float(v)
    except ValueError:
        return None


def _safe_int(v: Optional[str]) -> Optional[int]:
    if v is None or v == "":
        return None
    try:
        return int(v)
    except ValueError:
        return None


def validate_portfolio(
    csv_text: str,
    snapshot: Optional[Snapshot] = None,
) -> ValidationResult:
    """Run all Week-1 validation rules against CSV text.

    If *snapshot* is ``None`` the built-in demo fixture is loaded.
    """
    issues: list[ValidationIssue] = []

    # Parse
    portfolio = parse_csv(csv_text)

    # 0) Empty portfolio
    if not portfolio.rows:
        issues.append(
            ValidationIssue(
                severity=Severity.ERROR,
                field="portfolio",
                message="Portfolio CSV has no data rows.",
                code="EMPTY_PORTFOLIO",
            )
        )
        return _result(portfolio, issues)

    # 1) Required columns
    missing_cols = REQUIRED_COLUMNS - set(portfolio.column_names)
    for col in sorted(missing_cols):
        issues.append(
            ValidationIssue(
                severity=Severity.ERROR,
                field=col,
                message=f"Required column '{col}' is missing from CSV header.",
                code="MISSING_COLUMN",
            )
        )
    if missing_cols:
        # Can't continue row-level checks without required columns
        return _result(portfolio, issues)

    # Load snapshot
    if snapshot is None:
        snapshot = load_default_snapshot()
    snap_index = _build_snapshot_index(snapshot)

    for row in portfolio.rows:
        _validate_row(row, snap_index, issues)

    return _result(portfolio, issues)


def _validate_row(
    row: PortfolioRow,
    snap_index: set[str],
    issues: list[ValidationIssue],
) -> None:
    """Run per-row validations and append issues in-place."""

    # ── 1) symbol presence ─────────────────────────────
    if not row.symbol:
        issues.append(
            ValidationIssue(
                severity=Severity.ERROR,
                row=row.row_number,
                field="symbol",
                message="Symbol is empty.",
                code="EMPTY_SYMBOL",
            )
        )
        return  # can't do much without symbol

    # ── 2) symbol normalization ────────────────────────
    norm_symbol, was_aliased = normalize_ticker(row.symbol)
    if was_aliased:
        issues.append(
            ValidationIssue(
                severity=Severity.WARNING,
                row=row.row_number,
                field="symbol",
                message=f"Ticker '{row.symbol}' normalized to '{norm_symbol}'.",
                code="TICKER_NORMALIZED",
            )
        )
    # Use normalized symbol for remaining checks
    symbol = norm_symbol

    # ── 3) option_type ────────────────────────────────
    otype = row.option_type.strip().lower()
    if otype not in VALID_OPTION_TYPES:
        issues.append(
            ValidationIssue(
                severity=Severity.ERROR,
                row=row.row_number,
                field="option_type",
                message=f"Invalid option_type '{row.option_type}'. Expected 'call' or 'put'.",
                code="INVALID_OPTION_TYPE",
            )
        )

    # ── 4) strike ──────────────────────────────────────
    if row.strike is None:
        issues.append(
            ValidationIssue(
                severity=Severity.ERROR,
                row=row.row_number,
                field="strike",
                message="Strike price is missing or non-numeric.",
                code="MISSING_STRIKE",
            )
        )
    elif row.strike <= 0:
        issues.append(
            ValidationIssue(
                severity=Severity.ERROR,
                row=row.row_number,
                field="strike",
                message=f"Strike price must be positive, got {row.strike}.",
                code="INVALID_STRIKE",
            )
        )

    # ── 5) expiry date format ─────────────────────────
    if not row.expiry:
        issues.append(
            ValidationIssue(
                severity=Severity.ERROR,
                row=row.row_number,
                field="expiry",
                message="Expiry date is empty.",
                code="EMPTY_EXPIRY",
            )
        )
    elif not DATE_RE.match(row.expiry):
        issues.append(
            ValidationIssue(
                severity=Severity.ERROR,
                row=row.row_number,
                field="expiry",
                message=f"Expiry '{row.expiry}' is not in YYYY-MM-DD format.",
                code="INVALID_EXPIRY_FORMAT",
            )
        )
    else:
        # Check it's a real date
        try:
            datetime.strptime(row.expiry, "%Y-%m-%d")
        except ValueError:
            issues.append(
                ValidationIssue(
                    severity=Severity.ERROR,
                    row=row.row_number,
                    field="expiry",
                    message=f"Expiry '{row.expiry}' is not a valid calendar date.",
                    code="INVALID_EXPIRY_DATE",
                )
            )

    # ── 6) quantity ────────────────────────────────────
    if row.quantity is None:
        issues.append(
            ValidationIssue(
                severity=Severity.ERROR,
                row=row.row_number,
                field="quantity",
                message="Quantity is missing or non-numeric.",
                code="MISSING_QUANTITY",
            )
        )
    elif row.quantity == 0:
        issues.append(
            ValidationIssue(
                severity=Severity.WARNING,
                row=row.row_number,
                field="quantity",
                message="Quantity is zero — this leg has no effect.",
                code="ZERO_QUANTITY",
            )
        )

    # ── 7) side ────────────────────────────────────────
    side_lower = row.side.strip().lower()
    if side_lower not in VALID_SIDES:
        issues.append(
            ValidationIssue(
                severity=Severity.ERROR,
                row=row.row_number,
                field="side",
                message=f"Invalid side '{row.side}'. Expected 'buy' or 'sell'.",
                code="INVALID_SIDE",
            )
        )

    # ── 8) leg / side contradiction ───────────────────
    if row.quantity is not None and side_lower in VALID_SIDES:
        if side_lower == "buy" and row.quantity < 0:
            issues.append(
                ValidationIssue(
                    severity=Severity.ERROR,
                    row=row.row_number,
                    field="quantity",
                    message=f"Side is 'buy' but quantity is negative ({row.quantity}). Contradictory leg.",
                    code="SIDE_QTY_CONTRADICTION",
                )
            )
        elif side_lower == "sell" and row.quantity > 0:
            issues.append(
                ValidationIssue(
                    severity=Severity.ERROR,
                    row=row.row_number,
                    field="quantity",
                    message=f"Side is 'sell' but quantity is positive ({row.quantity}). Contradictory leg.",
                    code="SIDE_QTY_CONTRADICTION",
                )
            )

    # ── 9) multiplier sanity ──────────────────────────
    if row.multiplier is not None:
        if row.multiplier <= 0:
            issues.append(
                ValidationIssue(
                    severity=Severity.ERROR,
                    row=row.row_number,
                    field="multiplier",
                    message=f"Multiplier must be positive, got {row.multiplier}.",
                    code="INVALID_MULTIPLIER",
                )
            )
        elif row.multiplier != 100:
            issues.append(
                ValidationIssue(
                    severity=Severity.WARNING,
                    row=row.row_number,
                    field="multiplier",
                    message=f"Non-standard multiplier {row.multiplier} (expected 100).",
                    code="NONSTANDARD_MULTIPLIER",
                )
            )

    # ── 10) missing strike in snapshot ────────────────
    if row.strike is not None and otype in VALID_OPTION_TYPES and row.expiry and DATE_RE.match(row.expiry):
        key = _snapshot_key(symbol, row.expiry, row.strike, otype)
        if key not in snap_index:
            issues.append(
                ValidationIssue(
                    severity=Severity.WARNING,
                    row=row.row_number,
                    field="strike",
                    message=f"Strike {row.strike} for {symbol} {otype} {row.expiry} not found in snapshot.",
                    code="STRIKE_NOT_IN_SNAPSHOT",
                )
            )


# ── result builder ──────────────────────────────────────────────────────────

def _result(portfolio: Portfolio, issues: list[ValidationIssue]) -> ValidationResult:
    errors = [i for i in issues if i.severity == Severity.ERROR]
    warnings = [i for i in issues if i.severity == Severity.WARNING]
    return ValidationResult(
        valid=len(errors) == 0,
        total_rows=len(portfolio.rows),
        error_count=len(errors),
        warning_count=len(warnings),
        issues=issues,
    )
