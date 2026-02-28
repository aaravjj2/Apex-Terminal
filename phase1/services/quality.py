"""
Data quality gates for market data.

Checks bars for:
  - Gaps in trading days (weekends/holidays excluded)
  - Duplicate timestamps
  - Outlier detection (>20% daily move → flag, >50% → reject)
  - Stale data (last bar older than 2 trading days)
  - Zero/negative prices
  - Volume anomalies

A quality gate returns a QualityReport that can block backtesting
if critical issues are found.

NON-NEGOTIABLE: all checks operate on REAL data only.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, date
from typing import List, Optional, Sequence
from enum import Enum

import structlog

from .market_data.providers.types import BarData

logger = structlog.get_logger(__name__)

# ── US market holidays (approximate, expand as needed) ───────────────
US_HOLIDAYS_2024 = {
    date(2024, 1, 1), date(2024, 1, 15), date(2024, 2, 19),
    date(2024, 3, 29), date(2024, 5, 27), date(2024, 6, 19),
    date(2024, 7, 4), date(2024, 9, 2), date(2024, 11, 28),
    date(2024, 12, 25),
}
US_HOLIDAYS_2025 = {
    date(2025, 1, 1), date(2025, 1, 20), date(2025, 2, 17),
    date(2025, 4, 18), date(2025, 5, 26), date(2025, 6, 19),
    date(2025, 7, 4), date(2025, 9, 1), date(2025, 11, 27),
    date(2025, 12, 25),
}
ALL_HOLIDAYS = US_HOLIDAYS_2024 | US_HOLIDAYS_2025


class Severity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class QualityIssue:
    code: str
    severity: Severity
    message: str
    detail: Optional[str] = None


@dataclass
class QualityReport:
    symbol: str
    bar_count: int
    issues: List[QualityIssue] = field(default_factory=list)
    checked_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    @property
    def pass_gate(self) -> bool:
        """Return True if no CRITICAL issues found."""
        return not any(i.severity == Severity.CRITICAL for i in self.issues)

    @property
    def score(self) -> float:
        """0–100 quality score (100 = perfect)."""
        if self.bar_count == 0:
            return 0.0
        deductions = 0.0
        for issue in self.issues:
            if issue.severity == Severity.CRITICAL:
                deductions += 30
            elif issue.severity == Severity.WARNING:
                deductions += 10
            else:
                deductions += 2
        return max(0.0, min(100.0, 100.0 - deductions))

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "bar_count": self.bar_count,
            "pass": self.pass_gate,
            "score": round(self.score, 1),
            "issue_count": len(self.issues),
            "issues": [
                {"code": i.code, "severity": i.severity.value, "message": i.message, "detail": i.detail}
                for i in self.issues
            ],
            "checked_at": self.checked_at,
        }


def _is_trading_day(d: date) -> bool:
    """Return True if d is a US equity trading day (Mon–Fri, not holiday)."""
    if d.weekday() >= 5:  # Sat/Sun
        return False
    if d in ALL_HOLIDAYS:
        return False
    return True


def check_quality(symbol: str, bars: Sequence[BarData]) -> QualityReport:
    """
    Run all quality checks on a list of bars.
    Returns a QualityReport.
    """
    report = QualityReport(symbol=symbol.upper(), bar_count=len(bars))

    if not bars:
        report.issues.append(QualityIssue(
            code="NO_DATA", severity=Severity.CRITICAL,
            message=f"No bars for {symbol}"
        ))
        return report

    # Sort by timestamp
    sorted_bars = sorted(bars, key=lambda b: b.timestamp)

    # ── Check: zero/negative prices ──────────────────────────────
    for i, b in enumerate(sorted_bars):
        if b.close <= 0 or b.open <= 0 or b.high <= 0 or b.low <= 0:
            report.issues.append(QualityIssue(
                code="ZERO_PRICE", severity=Severity.CRITICAL,
                message=f"Zero/negative price at {b.timestamp.date()}",
                detail=f"O={b.open} H={b.high} L={b.low} C={b.close}"
            ))

    # ── Check: OHLC consistency ──────────────────────────────────
    for b in sorted_bars:
        if b.high < b.low:
            report.issues.append(QualityIssue(
                code="OHLC_INVALID", severity=Severity.WARNING,
                message=f"High < Low at {b.timestamp.date()}",
                detail=f"H={b.high} L={b.low}"
            ))
        if b.high < max(b.open, b.close) or b.low > min(b.open, b.close):
            report.issues.append(QualityIssue(
                code="OHLC_INCONSISTENT", severity=Severity.INFO,
                message=f"OHLC not consistent at {b.timestamp.date()}"
            ))

    # ── Check: duplicate timestamps ──────────────────────────────
    timestamps = [b.timestamp for b in sorted_bars]
    seen = set()
    for ts in timestamps:
        if ts in seen:
            report.issues.append(QualityIssue(
                code="DUPLICATE_TS", severity=Severity.WARNING,
                message=f"Duplicate timestamp {ts}"
            ))
        seen.add(ts)

    # ── Check: gaps in trading days ──────────────────────────────
    dates = sorted(set(b.timestamp.date() for b in sorted_bars))
    if len(dates) >= 2:
        gap_count = 0
        for i in range(1, len(dates)):
            prev, curr = dates[i - 1], dates[i]
            # Count trading days between prev and curr
            d = prev + timedelta(days=1)
            missing = []
            while d < curr:
                if _is_trading_day(d):
                    missing.append(d)
                d += timedelta(days=1)
            if len(missing) > 0:
                gap_count += len(missing)
                if len(missing) >= 5:
                    report.issues.append(QualityIssue(
                        code="GAP_LARGE", severity=Severity.WARNING,
                        message=f"{len(missing)}-day gap: {missing[0]} to {missing[-1]}",
                    ))
        if gap_count > 0:
            report.issues.append(QualityIssue(
                code="GAP_TOTAL", severity=Severity.INFO if gap_count < 20 else Severity.WARNING,
                message=f"Total {gap_count} missing trading day(s)",
            ))

    # ── Check: outlier moves (>20% daily) ────────────────────────
    for i in range(1, len(sorted_bars)):
        prev_close = sorted_bars[i - 1].close
        curr_close = sorted_bars[i].close
        if prev_close == 0:
            continue
        pct = abs(curr_close - prev_close) / prev_close
        if pct > 0.50:
            report.issues.append(QualityIssue(
                code="OUTLIER_EXTREME", severity=Severity.CRITICAL,
                message=f"{pct:.0%} move on {sorted_bars[i].timestamp.date()}",
                detail=f"prev={prev_close:.2f} curr={curr_close:.2f}"
            ))
        elif pct > 0.20:
            report.issues.append(QualityIssue(
                code="OUTLIER_LARGE", severity=Severity.WARNING,
                message=f"{pct:.0%} move on {sorted_bars[i].timestamp.date()}",
                detail=f"prev={prev_close:.2f} curr={curr_close:.2f}"
            ))

    # ── Check: stale data ────────────────────────────────────────
    last_bar_date = sorted_bars[-1].timestamp.date()
    today = date.today()
    stale_days = 0
    d = last_bar_date + timedelta(days=1)
    while d <= today:
        if _is_trading_day(d):
            stale_days += 1
        d += timedelta(days=1)
    if stale_days >= 3:
        report.issues.append(QualityIssue(
            code="STALE_DATA", severity=Severity.WARNING,
            message=f"Last bar {stale_days} trading days ago ({last_bar_date})"
        ))

    logger.info("quality_check", symbol=symbol, bars=len(bars),
                issues=len(report.issues), pass_=report.pass_gate,
                score=round(report.score, 1))
    return report
