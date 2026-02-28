"""
Wave 105 — Performance budget REST routes.
Prefix: /api/v3/perf
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from backend.core.perf_budget import (
    BUDGETS,
    BUNDLE_BUDGETS,
    PAGES_UNDER_TEST,
    PERF_BUDGET_VERSION,
    clear_perf_data,
    get_perf_summary,
    list_perf_samples,
    save_perf_sample,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Version / meta
# ---------------------------------------------------------------------------

@router.get("/version")
async def get_version():
    return {
        "version": PERF_BUDGET_VERSION,
        "budgets": BUDGETS,
        "bundle_budgets": BUNDLE_BUDGETS,
        "pages_count": len(PAGES_UNDER_TEST),
    }


@router.get("/budgets")
async def get_budgets():
    return {
        "timing_budgets": BUDGETS,
        "bundle_budgets": BUNDLE_BUDGETS,
        "pages": PAGES_UNDER_TEST,
    }


# ---------------------------------------------------------------------------
# Samples
# ---------------------------------------------------------------------------

class PerfSampleIn(BaseModel):
    page_id: str
    page_url: str
    fcp_ms: Optional[float] = None
    lcp_ms: Optional[float] = None
    dom_content_loaded_ms: Optional[float] = None
    load_time_ms: Optional[float] = None
    user_agent: Optional[str] = None


@router.post("/samples", status_code=201)
async def post_perf_sample(body: PerfSampleIn):
    sample = save_perf_sample(
        page_id=body.page_id,
        page_url=body.page_url,
        fcp_ms=body.fcp_ms,
        lcp_ms=body.lcp_ms,
        dom_content_loaded_ms=body.dom_content_loaded_ms,
        load_time_ms=body.load_time_ms,
        user_agent=body.user_agent,
    )
    return {
        "id": sample.id,
        "page_id": sample.page_id,
        "budget_passed": sample.budget_passed,
        "violations": sample.violations,
        "sampled_at": sample.sampled_at,
    }


@router.get("/samples")
async def get_perf_samples(page_id: Optional[str] = Query(default=None)):
    return list_perf_samples(page_id=page_id)


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

@router.get("/summary")
async def get_summary():
    return get_perf_summary()


# ---------------------------------------------------------------------------
# Delete (test clean-up)
# ---------------------------------------------------------------------------

@router.delete("/data", status_code=200)
async def delete_perf_data():
    deleted = clear_perf_data()
    return {"deleted": deleted}
