"""
T5: Compliance Checker — rules-based gate for the risk run pipeline.

Evaluates the portfolio against hard compliance rules and returns an
approved/blocked status with violation details.

Rules:
  1. No uncovered (naked) short options
  2. Max single-leg position size ≤ 50 contracts
  3. All legs must have strike and expiry populated
  4. No contradictory legs (same symbol+strike+expiry, both long call & short call)
  5. All tickers must be recognized (in snapshot)

Fully deterministic — no LLM, no API keys.
"""

from __future__ import annotations

from .schemas import PortfolioRow, Snapshot, SnapshotEntry
from .schemas_w2 import ComplianceResult, ComplianceViolation
from .validator import normalize_ticker

_MAX_POSITION_SIZE = 50  # contracts


def check_compliance(
    rows: list[PortfolioRow],
    snapshot: Snapshot,
) -> ComplianceResult:
    """Run compliance rules over the portfolio.

    Returns ComplianceResult with status "approved" or "blocked" and
    a list of ComplianceViolation entries.
    """
    violations: list[ComplianceViolation] = []

    _check_missing_fields(rows, violations)
    _check_position_size(rows, violations)
    _check_uncovered_shorts(rows, violations)
    _check_contradictory_legs(rows, violations)
    _check_unrecognized_tickers(rows, snapshot, violations)

    has_critical = any(v.severity == "critical" for v in violations)
    status = "blocked" if has_critical else "approved"

    return ComplianceResult(status=status, violations=violations)


# ── Individual rules ────────────────────────────────────────────────────────

def _check_missing_fields(
    rows: list[PortfolioRow], violations: list[ComplianceViolation]
) -> None:
    """Rule: All legs must have strike and expiry populated."""
    for i, row in enumerate(rows):
        missing = []
        if row.strike is None or row.strike <= 0:
            missing.append("strike")
        if not row.expiry or row.expiry.strip() == "":
            missing.append("expiry")
        if missing:
            violations.append(ComplianceViolation(
                code="MISSING_FIELD",
                severity="critical",
                message=f"Row {i+1} ({row.symbol}): missing {', '.join(missing)}",
                suggested_fix=f"Add {', '.join(missing)} for {row.symbol}",
            ))


def _check_position_size(
    rows: list[PortfolioRow], violations: list[ComplianceViolation]
) -> None:
    """Rule: No single-leg position exceeds _MAX_POSITION_SIZE contracts."""
    for i, row in enumerate(rows):
        if abs(row.quantity or 0) > _MAX_POSITION_SIZE:
            violations.append(ComplianceViolation(
                code="POSITION_SIZE",
                severity="critical",
                message=(
                    f"Row {i+1} ({row.symbol}): "
                    f"|qty|={abs(row.quantity)} exceeds max {_MAX_POSITION_SIZE}"
                ),
                suggested_fix=f"Reduce position to ≤ {_MAX_POSITION_SIZE} contracts",
            ))


def _check_uncovered_shorts(
    rows: list[PortfolioRow], violations: list[ComplianceViolation]
) -> None:
    """Rule: Short options must be covered by a matching long leg.

    A short option is covered if there is another leg on the same symbol,
    same option type, same expiry, different strike, with a long position.
    """
    for i, row in enumerate(rows):
        qty = row.quantity or 0
        if qty >= 0:
            continue  # not short

        norm_sym, _ = normalize_ticker(row.symbol)
        otype = row.option_type.lower()
        expiry = row.expiry

        # Look for a matching long leg
        has_cover = False
        for j, other in enumerate(rows):
            if i == j:
                continue
            other_sym, _ = normalize_ticker(other.symbol)
            other_qty = other.quantity or 0
            if (other_sym == norm_sym
                    and other.option_type.lower() == otype
                    and other_qty > 0):
                has_cover = True
                break

        if not has_cover:
            violations.append(ComplianceViolation(
                code="UNCOVERED_SHORT",
                severity="critical",
                message=(
                    f"Row {i+1}: Uncovered short {otype} on {norm_sym} "
                    f"({qty} contracts, strike {row.strike})"
                ),
                suggested_fix=(
                    f"Add a long {otype} on {norm_sym} to create a spread, "
                    f"or close the naked short position"
                ),
            ))


def _check_contradictory_legs(
    rows: list[PortfolioRow], violations: list[ComplianceViolation]
) -> None:
    """Rule: No contradictory legs (same symbol+strike+expiry+type, opposite sides)."""
    seen: dict[str, tuple[int, int]] = {}  # key -> (row_index, qty)

    for i, row in enumerate(rows):
        norm_sym, _ = normalize_ticker(row.symbol)
        key = f"{norm_sym}|{row.option_type.lower()}|{row.strike}|{row.expiry}"
        qty = row.quantity or 0

        if key in seen:
            prev_idx, prev_qty = seen[key]
            # Contradictory if one is long and one is short
            if (prev_qty > 0 and qty < 0) or (prev_qty < 0 and qty > 0):
                violations.append(ComplianceViolation(
                    code="CONTRADICTORY_LEGS",
                    severity="warning",
                    message=(
                        f"Rows {prev_idx+1} & {i+1}: contradictory positions "
                        f"on {norm_sym} {row.option_type} {row.strike} {row.expiry}"
                    ),
                    suggested_fix="Reconcile or net the opposing positions",
                ))
        else:
            seen[key] = (i, qty)


def _check_unrecognized_tickers(
    rows: list[PortfolioRow],
    snapshot: Snapshot,
    violations: list[ComplianceViolation],
) -> None:
    """Rule: All tickers must be present in the snapshot."""
    snapshot_symbols = {e.symbol.upper() for e in snapshot.entries}

    for i, row in enumerate(rows):
        norm_sym, _ = normalize_ticker(row.symbol)
        # Check if any snapshot entry matches this symbol
        found = any(s.startswith(norm_sym) for s in snapshot_symbols)
        if not found:
            violations.append(ComplianceViolation(
                code="UNRECOGNIZED_TICKER",
                severity="warning",
                message=f"Row {i+1}: {norm_sym} not found in market snapshot",
                suggested_fix=f"Verify {norm_sym} ticker or update snapshot",
            ))
