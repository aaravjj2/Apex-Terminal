"""
Workflow Depth Routes — Templates, RBAC, Scheduling, Audit Export
Pure deterministic demo endpoints for the Core Depth Upgrade.
"""
import hashlib, json
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/ui2/workflow-depth")

# Anchor timestamp from data/recordings/core-default/manifest.json → date_range.start
from datetime import datetime, timezone
DEMO_TS = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _fnv32(s: str) -> int:
    h = 0x811C9DC5
    for c in s:
        h ^= ord(c)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


# ── Models ───────────────────────────────────────────────────────────────────

class WorkflowTemplate(BaseModel):
    template_id: str
    name: str
    description: str
    tags: List[str]
    trigger_type: str
    actions: List[str]
    created_by: str
    created_at: str
    use_count: int


class ScheduledJob(BaseModel):
    job_id: str
    workflow_id: str
    workflow_name: str
    schedule_cron: str
    next_run: str
    status: str
    created_by: str
    created_at: str


class WorkflowRun(BaseModel):
    run_id: str
    workflow_id: str
    workflow_name: str
    job_id: Optional[str]
    status: str
    started_at: str
    completed_at: str
    duration_ms: int
    triggered_by: str
    steps_completed: int
    steps_total: int
    output_hash: str


class AuditExport(BaseModel):
    export_id: str
    workflow_id: str
    run_records: List[WorkflowRun]
    hash: str
    exported_at: str


class CreateScheduleReq(BaseModel):
    workflow_id: str
    workflow_name: str
    cron: str


class CreateTemplateReq(BaseModel):
    name: str
    description: str
    tags: List[str]
    trigger_type: str
    actions: List[str]


# ── Demo Data ────────────────────────────────────────────────────────────────

_TEMPLATES: List[WorkflowTemplate] = [
    WorkflowTemplate(template_id="tmpl-001", name="Daily Portfolio Export",
                     description="Automated daily export at close", tags=["export", "portfolio", "daily"],
                     trigger_type="schedule", actions=["snapshot", "export_csv", "notify"],
                     created_by="admin", created_at="2026-01-10T09:00:00Z", use_count=12),
    WorkflowTemplate(template_id="tmpl-002", name="Stop Loss Guardian",
                     description="Monitor and trigger stops", tags=["risk", "stop-loss"],
                     trigger_type="event", actions=["check_positions", "evaluate_stops", "place_orders"],
                     created_by="admin", created_at="2026-01-15T10:00:00Z", use_count=8),
    WorkflowTemplate(template_id="tmpl-003", name="Earnings Alert Pipeline",
                     description="Pre-earnings alert with review", tags=["earnings", "alert"],
                     trigger_type="schedule", actions=["scan_calendar", "check_positions", "alert"],
                     created_by="trader", created_at="2026-02-01T08:30:00Z", use_count=5),
    WorkflowTemplate(template_id="tmpl-004", name="Rebalance Workflow",
                     description="Periodic portfolio rebalancing", tags=["rebalance", "portfolio"],
                     trigger_type="schedule", actions=["get_weights", "compute_rebalance", "generate_orders"],
                     created_by="admin", created_at="2026-02-05T11:00:00Z", use_count=3),
]

_JOBS: List[ScheduledJob] = [
    ScheduledJob(job_id="job-001", workflow_id="wf-daily-export", workflow_name="Daily Portfolio Export",
                 schedule_cron="0 16 * * 1-5", next_run="2026-02-16T16:00:00Z",
                 status="active", created_by="admin", created_at="2026-01-10T09:00:00Z"),
    ScheduledJob(job_id="job-002", workflow_id="wf-stop-loss", workflow_name="Stop Loss Guardian",
                 schedule_cron="*/5 9-16 * * 1-5", next_run="2026-02-16T09:00:00Z",
                 status="active", created_by="trader", created_at="2026-01-15T10:00:00Z"),
    ScheduledJob(job_id="job-003", workflow_id="wf-rebalance", workflow_name="Monthly Rebalance",
                 schedule_cron="0 9 1 * *", next_run="2026-03-01T09:00:00Z",
                 status="paused", created_by="admin", created_at="2026-02-01T08:00:00Z"),
]


def _gen_runs() -> List[WorkflowRun]:
    runs = []
    wfs = [
        ("wf-daily-export", "Daily Portfolio Export", "job-001"),
        ("wf-stop-loss", "Stop Loss Guardian", "job-002"),
    ]
    for i in range(8):
        wf_id, wf_name, job = wfs[i % 2]
        seed = _fnv32(f"{wf_id}:run:{i}:{DEMO_TS}")
        runs.append(WorkflowRun(
            run_id=f"run-{seed & 0xFFFFFFFF:08x}",
            workflow_id=wf_id, workflow_name=wf_name, job_id=job,
            status="failed" if i == 5 else "success",
            started_at=f"2026-02-{10 + i:02d}T{9 + (i % 8):02d}:00:00Z",
            completed_at=f"2026-02-{10 + i:02d}T{9 + (i % 8):02d}:00:{2 + (seed % 8):02d}Z",
            duration_ms=2000 + (seed % 6000),
            triggered_by="manual" if i % 3 == 0 else "scheduler",
            steps_completed=2 if i == 5 else 3, steps_total=3,
            output_hash=f"{seed & 0xFFFFFFFF:08x}",
        ))
    return sorted(runs, key=lambda r: r.started_at, reverse=True)

_RUNS = _gen_runs()

# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/templates", response_model=List[WorkflowTemplate])
def list_templates(q: Optional[str] = None):
    if q:
        ql = q.lower()
        return [t for t in _TEMPLATES if ql in t.name.lower() or any(ql in tag for tag in t.tags)]
    return _TEMPLATES


@router.get("/templates/{template_id}", response_model=WorkflowTemplate)
def get_template(template_id: str):
    tmpl = next((t for t in _TEMPLATES if t.template_id == template_id), None)
    if not tmpl:
        raise HTTPException(404, "Template not found")
    return tmpl


@router.post("/templates", response_model=WorkflowTemplate)
def create_template(req: CreateTemplateReq):
    tid = f"tmpl-{_fnv32(f'{req.name}:{DEMO_TS}') & 0xFFFFFF:06x}"
    tmpl = WorkflowTemplate(
        template_id=tid, name=req.name, description=req.description,
        tags=req.tags, trigger_type=req.trigger_type, actions=req.actions,
        created_by="admin", created_at=DEMO_TS, use_count=0,
    )
    _TEMPLATES.append(tmpl)
    return tmpl


@router.post("/templates/{template_id}/clone", response_model=WorkflowTemplate)
def clone_template(template_id: str):
    src = next((t for t in _TEMPLATES if t.template_id == template_id), None)
    if not src:
        raise HTTPException(404, "Template not found")
    clone_id = f"tmpl-{_fnv32(f'clone:{template_id}:{DEMO_TS}') & 0xFFFFFF:06x}"
    cloned = WorkflowTemplate(
        template_id=clone_id, name=f"{src.name} (Copy)", description=src.description,
        tags=src.tags, trigger_type=src.trigger_type, actions=src.actions,
        created_by="admin", created_at=DEMO_TS, use_count=0,
    )
    _TEMPLATES.append(cloned)
    return cloned


@router.get("/schedules", response_model=List[ScheduledJob])
def list_schedules():
    return _JOBS


@router.post("/schedules", response_model=ScheduledJob)
def create_schedule(req: CreateScheduleReq):
    jid = f"job-{_fnv32(f'{req.workflow_id}:{req.cron}:{DEMO_TS}') & 0xFFFFFF:06x}"
    job = ScheduledJob(
        job_id=jid, workflow_id=req.workflow_id, workflow_name=req.workflow_name,
        schedule_cron=req.cron, next_run="2026-02-16T09:00:00Z",
        status="active", created_by="admin", created_at=DEMO_TS,
    )
    _JOBS.append(job)
    return job


@router.post("/schedules/{job_id}/toggle")
def toggle_schedule(job_id: str):
    job = next((j for j in _JOBS if j.job_id == job_id), None)
    if not job:
        raise HTTPException(404, "Job not found")
    job.status = "paused" if job.status == "active" else "active"
    return {"job_id": job_id, "status": job.status}


@router.get("/runs", response_model=List[WorkflowRun])
def list_runs():
    return _RUNS


@router.post("/runs/{workflow_id}/trigger", response_model=WorkflowRun)
def trigger_run(workflow_id: str):
    seed = _fnv32(f"{workflow_id}:trigger:{len(_RUNS)}:{DEMO_TS}")
    run = WorkflowRun(
        run_id=f"run-{seed & 0xFFFFFFFF:08x}",
        workflow_id=workflow_id, workflow_name=workflow_id,
        job_id=None, status="success", started_at=DEMO_TS,
        completed_at=DEMO_TS, duration_ms=2000 + (seed % 5000),
        triggered_by="manual", steps_completed=3, steps_total=3,
        output_hash=f"{seed & 0xFFFFFFFF:08x}",
    )
    _RUNS.insert(0, run)
    return run


@router.get("/audit/{workflow_id}", response_model=AuditExport)
def export_audit(workflow_id: str):
    runs = [r for r in _RUNS if r.workflow_id == workflow_id]
    h = hashlib.sha256(json.dumps([r.model_dump() for r in runs], default=str).encode()).hexdigest()[:16]
    return AuditExport(
        export_id=f"export-{_fnv32(f'{workflow_id}:export:{DEMO_TS}') & 0xFFFFFFFF:08x}",
        workflow_id=workflow_id, run_records=runs,
        hash=h, exported_at=DEMO_TS,
    )


@router.get("/hash")
def get_hash():
    return {"hash": hashlib.sha256(f"workflow-depth:{DEMO_TS}".encode()).hexdigest()[:16]}
