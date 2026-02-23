"""
Wave 104 — Accessibility Audit API Route
Prefix: /api/v3/a11y
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

# ── Import the core ──────────────────────────────────────────────────────────
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../../.."))
from backend.core.a11y_audit import (
    save_audit_run,
    list_audit_runs,
    get_audit_summary,
    clear_audit_runs,
    PAGES_UNDER_TEST,
    EXCLUDED_RULES,
    A11Y_AUDIT_VERSION,
)

router = APIRouter()


# ── Pydantic models ──────────────────────────────────────────────────────────

class AuditRunPayload(BaseModel):
    page_id: str
    page_url: str
    violations: list
    passes_count: int = 0
    incomplete_count: int = 0
    axe_version: str = "unknown"


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/version")
async def get_version():
    return {"version": A11Y_AUDIT_VERSION, "excluded_rules": EXCLUDED_RULES}


@router.get("/pages-under-test")
async def get_pages_under_test():
    return {"pages": PAGES_UNDER_TEST, "count": len(PAGES_UNDER_TEST)}


@router.get("/summary")
async def get_summary():
    return await get_audit_summary()


@router.post("/runs", status_code=201)
async def post_audit_run(payload: AuditRunPayload):
    run = await save_audit_run(
        page_id=payload.page_id,
        page_url=payload.page_url,
        violations=payload.violations,
        passes_count=payload.passes_count,
        incomplete_count=payload.incomplete_count,
        axe_version=payload.axe_version,
    )
    return run


@router.get("/runs")
async def get_audit_runs(page_id: Optional[str] = None, limit: int = 200):
    runs = await list_audit_runs(page_id=page_id, limit=limit)
    return {"runs": runs, "count": len(runs)}


@router.delete("/data")
async def delete_data():
    return await clear_audit_runs()
