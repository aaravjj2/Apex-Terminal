"""
Waves 11-20 — Workflows v3 API Routes
DAG workflows, scheduling, templates, audit trail.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import logging

from ...waves11_20.workflows import (
    get_workflow_engine, WorkflowStep, StepType,
    WorkflowSchedule, ScheduleTrigger,
)

router = APIRouter(prefix="/api/v2/workflows", tags=["workflows-v3"])
logger = logging.getLogger(__name__)


class CreateWorkflowRequest(BaseModel):
    name: str
    description: str
    steps: list[dict]
    schedule: dict
    template_id: Optional[str] = None


class StartRunRequest(BaseModel):
    workflow_id: str


class CompleteStepRequest(BaseModel):
    run_id: str
    step_id: str
    output: Optional[dict] = None
    error: Optional[str] = None


@router.get("/templates")
async def list_templates():
    """List built-in workflow templates."""
    engine = get_workflow_engine()
    return {"templates": engine.get_templates()}


@router.post("/create")
async def create_workflow(req: CreateWorkflowRequest):
    """Create a new workflow."""
    engine = get_workflow_engine()
    try:
        steps = [
            WorkflowStep(
                step_id=s["step_id"],
                name=s["name"],
                step_type=StepType(s["step_type"]),
                config=s.get("config", {}),
                depends_on=s.get("depends_on", []),
                timeout_seconds=s.get("timeout_seconds", 300),
            )
            for s in req.steps
        ]
        schedule = WorkflowSchedule(
            trigger=ScheduleTrigger(req.schedule["trigger"]),
            cron_expression=req.schedule.get("cron_expression"),
            timezone=req.schedule.get("timezone", "America/New_York"),
            skip_holidays=req.schedule.get("skip_holidays", True),
            skip_weekends=req.schedule.get("skip_weekends", True),
        )
    except (KeyError, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid workflow definition: {e}")

    wf = engine.create_workflow(
        name=req.name,
        description=req.description,
        steps=steps,
        schedule=schedule,
        template_id=req.template_id,
    )
    return wf.to_dict()


@router.get("/list")
async def list_workflows():
    """List all workflows."""
    engine = get_workflow_engine()
    workflows = engine.list_workflows()
    return {"workflows": [w.to_dict() for w in workflows]}


@router.get("/{workflow_id}")
async def get_workflow(workflow_id: str):
    """Get a specific workflow."""
    engine = get_workflow_engine()
    wf = engine.get_workflow(workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail=f"Workflow {workflow_id} not found")
    return wf.to_dict()


@router.post("/{workflow_id}/activate")
async def activate_workflow(workflow_id: str):
    """Activate a workflow."""
    engine = get_workflow_engine()
    ok = engine.activate_workflow(workflow_id)
    if not ok:
        raise HTTPException(status_code=404, detail=f"Workflow {workflow_id} not found")
    return {"ok": True, "workflow_id": workflow_id, "status": "active"}


@router.post("/{workflow_id}/pause")
async def pause_workflow(workflow_id: str):
    """Pause a workflow."""
    engine = get_workflow_engine()
    ok = engine.pause_workflow(workflow_id)
    if not ok:
        raise HTTPException(status_code=404, detail=f"Workflow {workflow_id} not found")
    return {"ok": True, "workflow_id": workflow_id, "status": "paused"}


@router.post("/runs/start")
async def start_run(req: StartRunRequest):
    """Start a workflow run."""
    engine = get_workflow_engine()
    run = engine.start_run(req.workflow_id)
    if not run:
        raise HTTPException(status_code=400, detail="Cannot start run (workflow not active)")
    return run.to_dict()


@router.post("/runs/step/complete")
async def complete_step(req: CompleteStepRequest):
    """Mark a workflow step as completed or failed."""
    engine = get_workflow_engine()
    ok = engine.complete_step(req.run_id, req.step_id, req.output, req.error)
    if not ok:
        raise HTTPException(status_code=404, detail=f"Run {req.run_id} not found")
    return {"ok": True}


@router.get("/runs/{run_id}")
async def get_run(run_id: str):
    """Get workflow run state."""
    engine = get_workflow_engine()
    run = engine.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    return run.to_dict()


@router.get("/runs/{run_id}/ready")
async def get_ready_steps(run_id: str):
    """Get steps ready to execute (dependencies met)."""
    engine = get_workflow_engine()
    ready = engine.get_ready_steps(run_id)
    return {"run_id": run_id, "ready_steps": ready}


@router.get("/{workflow_id}/runs")
async def list_workflow_runs(workflow_id: str):
    """List runs for a specific workflow."""
    engine = get_workflow_engine()
    runs = engine.list_runs(workflow_id)
    return {"runs": [r.to_dict() for r in runs]}


@router.get("/{workflow_id}/audit")
async def get_audit_trail(workflow_id: str, limit: int = Query(default=100)):
    """Get audit trail for a workflow."""
    engine = get_workflow_engine()
    entries = engine.get_audit_trail(workflow_id, limit)
    return {"entries": [e.to_dict() for e in entries]}
