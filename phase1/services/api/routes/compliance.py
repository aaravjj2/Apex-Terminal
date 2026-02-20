"""
Wave 10 — Compliance Reporting
Regulatory and audit compliance reports.
"""
import hashlib
import json
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/compliance", tags=["compliance"])


class ComplianceCheck(BaseModel):
    check_id: str
    category: str
    name: str
    status: str  # pass / fail / warning
    details: str
    severity: str  # low / medium / high / critical


class ComplianceReport(BaseModel):
    report_id: str
    generated_at: str
    period_start: str
    period_end: str
    checks: List[ComplianceCheck]
    passed: int
    failed: int
    warnings: int
    overall_status: str
    report_hash: str


DEMO_CHECKS: List[dict] = [
    {"check_id": "cc-001", "category": "risk", "name": "Max position size", "status": "pass", "details": "All positions within 5% single-name limit", "severity": "high"},
    {"check_id": "cc-002", "category": "risk", "name": "Daily loss limit", "status": "pass", "details": "Daily P&L -$85 within -$200 limit", "severity": "critical"},
    {"check_id": "cc-003", "category": "risk", "name": "Concentration limit", "status": "pass", "details": "No sector > 30% of portfolio", "severity": "high"},
    {"check_id": "cc-004", "category": "execution", "name": "Best execution", "status": "pass", "details": "All fills within 1 tick of NBBO", "severity": "medium"},
    {"check_id": "cc-005", "category": "execution", "name": "Order accuracy", "status": "pass", "details": "0 order entry errors", "severity": "high"},
    {"check_id": "cc-006", "category": "audit", "name": "Audit trail completeness", "status": "pass", "details": "All trades have full audit chain", "severity": "critical"},
    {"check_id": "cc-007", "category": "audit", "name": "Kill switch logging", "status": "warning", "details": "3 activations today — review thresholds", "severity": "medium"},
    {"check_id": "cc-008", "category": "data", "name": "Data freshness", "status": "pass", "details": "Market data < 5s stale", "severity": "medium"},
    {"check_id": "cc-009", "category": "data", "name": "Price validation", "status": "pass", "details": "No stale prices in executed trades", "severity": "high"},
    {"check_id": "cc-010", "category": "system", "name": "System availability", "status": "pass", "details": "99.9% uptime in period", "severity": "low"},
    {"check_id": "cc-011", "category": "system", "name": "Backup verification", "status": "warning", "details": "Last backup 26 hours ago", "severity": "medium"},
    {"check_id": "cc-012", "category": "regulatory", "name": "Pattern day trader check", "status": "pass", "details": "Paper mode — PDT not applicable", "severity": "low"},
]


def _build_report() -> ComplianceReport:
    checks = [ComplianceCheck(**c) for c in DEMO_CHECKS]
    passed = sum(1 for c in checks if c.status == "pass")
    failed = sum(1 for c in checks if c.status == "fail")
    warnings = sum(1 for c in checks if c.status == "warning")
    overall = "compliant" if failed == 0 else "non-compliant"
    canonical = json.dumps(DEMO_CHECKS, sort_keys=True, separators=(",", ":"))
    report_hash = hashlib.sha256(canonical.encode()).hexdigest()
    return ComplianceReport(
        report_id="cr-2026-01-16",
        generated_at="2026-01-16T16:05:00Z",
        period_start="2026-01-16T09:30:00Z",
        period_end="2026-01-16T16:00:00Z",
        checks=checks,
        passed=passed,
        failed=failed,
        warnings=warnings,
        overall_status=overall,
        report_hash=report_hash,
    )


@router.get("/report")
async def compliance_report():
    return _build_report().model_dump()


@router.get("/checks")
async def list_checks(category: Optional[str] = None):
    checks = DEMO_CHECKS
    if category:
        checks = [c for c in checks if c["category"] == category]
    return {"checks": checks, "total": len(checks)}


@router.get("/checks/{check_id}")
async def get_check(check_id: str):
    for c in DEMO_CHECKS:
        if c["check_id"] == check_id:
            return c
    return {"check_id": check_id, "status": "unknown"}


@router.get("/categories")
async def list_categories():
    cats = sorted(set(c["category"] for c in DEMO_CHECKS))
    return {"categories": cats}


@router.get("/hash")
async def compliance_hash():
    report = _build_report()
    return {"hash": report.report_hash}
