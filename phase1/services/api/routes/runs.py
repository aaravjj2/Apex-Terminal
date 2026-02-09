"""
Runs API Routes - Endpoints for managing strategy runs.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from services.execution.orchestrator import get_orchestrator

router = APIRouter(tags=["Runs"])


class RunCreate(BaseModel):
    strategy_id: str
    run_type: str  # 'backtest', 'paper', 'live'
    config: Optional[dict] = None
    max_restarts: int = 3


class RunResponse(BaseModel):
    run_id: str
    strategy_id: str
    run_type: str
    status: str
    created_at: Optional[str]
    started_at: Optional[str]
    stopped_at: Optional[str]
    last_heartbeat: Optional[str]
    last_error: Optional[str]
    error_count: int
    restart_count: int


class LogEntry(BaseModel):
    timestamp: str
    level: str
    message: str


@router.get("/runs", response_model=List[RunResponse])
async def list_runs(status: Optional[str] = None):
    """List all runs, optionally filtered by status."""
    orchestrator = get_orchestrator()
    runs = orchestrator.list_runs(status=status)
    return runs


@router.get("/runs/{run_id}", response_model=RunResponse)
async def get_run(run_id: str):
    """Get details for a specific run."""
    orchestrator = get_orchestrator()
    run = orchestrator.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.post("/runs", response_model=dict)
async def create_run(data: RunCreate):
    """Create a new run in PENDING state."""
    orchestrator = get_orchestrator()
    run_id = orchestrator.create_run(
        strategy_id=data.strategy_id,
        run_type=data.run_type,
        config=data.config,
        max_restarts=data.max_restarts
    )
    return {"run_id": run_id, "status": "pending"}


@router.post("/runs/{run_id}/start")
async def start_run(run_id: str):
    """Start a pending or stopped run."""
    orchestrator = get_orchestrator()
    success = await orchestrator.start_run(run_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot start run")
    return {"message": "Run started", "run_id": run_id}


@router.post("/runs/{run_id}/pause")
async def pause_run(run_id: str):
    """Pause a running run."""
    orchestrator = get_orchestrator()
    success = await orchestrator.pause_run(run_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot pause run")
    return {"message": "Run paused", "run_id": run_id}


@router.post("/runs/{run_id}/resume")
async def resume_run(run_id: str):
    """Resume a paused run."""
    orchestrator = get_orchestrator()
    success = await orchestrator.resume_run(run_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot resume run")
    return {"message": "Run resumed", "run_id": run_id}


@router.post("/runs/{run_id}/stop")
async def stop_run(run_id: str):
    """Stop a running or paused run."""
    orchestrator = get_orchestrator()
    success = await orchestrator.stop_run(run_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot stop run")
    return {"message": "Run stopped", "run_id": run_id}


@router.get("/runs/{run_id}/logs", response_model=List[LogEntry])
async def get_run_logs(run_id: str, limit: int = Query(100, le=1000)):
    """Get logs for a run."""
    orchestrator = get_orchestrator()
    run = orchestrator.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    logs = orchestrator.get_logs(run_id, limit=limit)
    return logs


@router.post("/runs/{run_id}/heartbeat")
async def heartbeat(run_id: str):
    """Update heartbeat for a run (called by running strategies)."""
    orchestrator = get_orchestrator()
    run = orchestrator.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    orchestrator.heartbeat(run_id)
    return {"status": "ok"}
