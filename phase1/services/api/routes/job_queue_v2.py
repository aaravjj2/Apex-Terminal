"""
W100 — Job Queue v2 Route

Prefix: /api/v3/jobs
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from backend.core.job_queue_v2 import (
    cancel_job,
    clear_jobs,
    complete_job,
    create_job,
    fail_job,
    get_job,
    get_job_type_list,
    list_jobs,
    simulate_job_run,
    start_job,
    update_progress,
)

router = APIRouter()


# ─── Pydantic models ──────────────────────────────────────────────────────────

class CreateJobRequest(BaseModel):
    name: str = Field(..., min_length=1, description="Human-readable job name")
    job_type: str = Field(..., description="Job type key")
    params: dict = Field(default_factory=dict)
    auto_run: bool = Field(True, description="Immediately simulate job in background")


# ─── REST endpoints ───────────────────────────────────────────────────────────

@router.get("/types")
async def list_job_types():
    return {"job_types": get_job_type_list()}


@router.post("/jobs", status_code=201)
async def submit_job(req: CreateJobRequest):
    try:
        job = await create_job(req.name, req.job_type, req.params)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if req.auto_run:
        asyncio.create_task(simulate_job_run(job["id"]))

    return job


@router.get("/jobs")
async def get_jobs(status: Optional[str] = None):
    if status and status not in {"queued", "running", "succeeded", "failed", "canceled"}:
        raise HTTPException(status_code=422, detail=f"Invalid status filter: {status}")
    jobs = await list_jobs(status_filter=status)
    return {"jobs": jobs, "total": len(jobs)}


@router.get("/jobs/{job_id}")
async def get_job_detail(job_id: str):
    job = await get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/jobs/{job_id}/cancel")
async def cancel_job_endpoint(job_id: str):
    job = await get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    result = await cancel_job(job_id)
    return result


@router.post("/jobs/{job_id}/start")
async def start_job_endpoint(job_id: str):
    job = await get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    try:
        result = await start_job(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return result


@router.post("/jobs/{job_id}/complete")
async def complete_job_endpoint(job_id: str, result: str = "ok"):
    job = await get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    try:
        updated = await complete_job(job_id, result)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return updated


@router.post("/jobs/{job_id}/fail")
async def fail_job_endpoint(job_id: str, error: str = "error"):
    job = await get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    try:
        updated = await fail_job(job_id, error)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return updated


@router.delete("/jobs")
async def clear_all_jobs():
    return await clear_jobs()


# ─── WebSocket ────────────────────────────────────────────────────────────────

@router.websocket("/ws/jobs/{job_id}")
async def ws_job_progress(websocket: WebSocket, job_id: str):
    """Stream job progress until terminal state (succeeded | failed | canceled)."""
    await websocket.accept()
    try:
        terminal = {"succeeded", "failed", "canceled"}
        while True:
            job = await get_job(job_id)
            if job is None:
                await websocket.send_json({"error": "job_not_found", "job_id": job_id})
                break

            payload = {
                "job_id": job_id,
                "status": job["status"],
                "progress": job["progress"],
                "timestamp": datetime.now(tz=timezone.utc).isoformat(),
            }
            await websocket.send_json(payload)

            if job["status"] in terminal:
                break

            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
