"""
Wave 26 — Data Quality Scoring & Refusal Rules
Score data quality and refuse to run backtests on poor data.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from .canonical_schema import CanonicalBar, BarSeries


class QualityGrade:
    A = "A"  # >= 0.95
    B = "B"  # >= 0.85
    C = "C"  # >= 0.70
    D = "D"  # >= 0.50
    F = "F"  # < 0.50


@dataclass
class QualityReport:
    symbol: str
    score: float
    grade: str
    bar_count: int
    valid_bars: int
    invalid_bars: int
    gaps: int
    completeness: float
    ohlc_integrity: float
    volume_integrity: float
    warnings: List[str] = field(default_factory=list)
    passed: bool = True
    refusal_reason: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "score": round(self.score, 4),
            "grade": self.grade,
            "bar_count": self.bar_count,
            "valid_bars": self.valid_bars,
            "invalid_bars": self.invalid_bars,
            "gaps": self.gaps,
            "completeness": round(self.completeness, 4),
            "ohlc_integrity": round(self.ohlc_integrity, 4),
            "volume_integrity": round(self.volume_integrity, 4),
            "warnings": self.warnings,
            "passed": self.passed,
            "refusal_reason": self.refusal_reason,
        }


# Default quality thresholds
DEFAULT_MIN_BARS = 50
DEFAULT_MIN_SCORE = 0.50
DEFAULT_MIN_COMPLETENESS = 0.70


def score_quality(series: BarSeries,
                  expected_bars: int = 0,
                  min_bars: int = DEFAULT_MIN_BARS,
                  min_score: float = DEFAULT_MIN_SCORE,
                  min_completeness: float = DEFAULT_MIN_COMPLETENESS) -> QualityReport:
    """Score data quality for a bar series."""

    bars = series.bars
    bar_count = len(bars)
    warnings: List[str] = []

    # OHLC integrity
    ohlc_errors = 0
    volume_errors = 0
    for b in bars:
        errs = b.validate()
        if errs:
            ohlc_errors += 1
        if b.volume <= 0:
            volume_errors += 1

    valid_bars = bar_count - ohlc_errors
    ohlc_integrity = valid_bars / bar_count if bar_count > 0 else 0.0
    volume_integrity = (bar_count - volume_errors) / bar_count if bar_count > 0 else 0.0

    # Completeness
    gaps = series.gaps()
    gap_count = len(gaps)
    if expected_bars > 0:
        completeness = series.completeness(expected_bars)
    else:
        completeness = 1.0 - (gap_count / max(bar_count, 1)) if bar_count > 0 else 0.0
    completeness = max(0.0, min(1.0, completeness))

    # Combined score: 40% OHLC, 20% volume, 40% completeness
    score = 0.4 * ohlc_integrity + 0.2 * volume_integrity + 0.4 * completeness
    score = round(score, 4)

    # Grade
    if score >= 0.95:
        grade = QualityGrade.A
    elif score >= 0.85:
        grade = QualityGrade.B
    elif score >= 0.70:
        grade = QualityGrade.C
    elif score >= 0.50:
        grade = QualityGrade.D
    else:
        grade = QualityGrade.F

    # Warnings
    if bar_count < min_bars:
        warnings.append(f"Only {bar_count} bars (minimum: {min_bars})")
    if gap_count > 0:
        warnings.append(f"{gap_count} date gaps detected")
    if ohlc_errors > 0:
        warnings.append(f"{ohlc_errors} bars with OHLC integrity violations")
    if volume_errors > bar_count * 0.1:
        warnings.append(f"{volume_errors} bars with zero/negative volume")

    # Refusal check
    passed = True
    refusal_reason = None
    if score < min_score:
        passed = False
        refusal_reason = f"Quality score {score:.2f} below minimum {min_score:.2f}"
    elif bar_count < min_bars:
        passed = False
        refusal_reason = f"Only {bar_count} bars (minimum {min_bars})"
    elif completeness < min_completeness:
        passed = False
        refusal_reason = f"Completeness {completeness:.2f} below minimum {min_completeness:.2f}"

    return QualityReport(
        symbol=series.symbol,
        score=score,
        grade=grade,
        bar_count=bar_count,
        valid_bars=valid_bars,
        invalid_bars=ohlc_errors,
        gaps=gap_count,
        completeness=completeness,
        ohlc_integrity=ohlc_integrity,
        volume_integrity=volume_integrity,
        warnings=warnings,
        passed=passed,
        refusal_reason=refusal_reason,
    )
