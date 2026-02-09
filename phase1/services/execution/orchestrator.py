"""
Run Orchestrator - Manages strategy run lifecycle with health monitoring.
State machine: PENDING → RUNNING → PAUSED → STOPPED → ERROR
"""
import asyncio
import uuid
from datetime import datetime, timedelta
from typing import Dict, Optional, List, Callable, Any
from enum import Enum
from dataclasses import dataclass, field
from collections import deque
import logging

logger = logging.getLogger(__name__)


class RunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"
    ERROR = "error"
    COMPLETED = "completed"


@dataclass
class RunState:
    """State for a single run."""
    run_id: str
    strategy_id: str
    run_type: str  # 'backtest', 'paper', 'live'
    status: RunStatus = RunStatus.PENDING
    created_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    stopped_at: Optional[datetime] = None
    last_heartbeat: Optional[datetime] = None
    last_error: Optional[str] = None
    error_count: int = 0
    restart_count: int = 0
    max_restarts: int = 3
    logs: deque = field(default_factory=lambda: deque(maxlen=1000))
    metrics: dict = field(default_factory=dict)
    task: Optional[asyncio.Task] = None


class RunOrchestrator:
    """
    Manages the lifecycle of strategy runs.
    Provides health monitoring, restart policies, and crash recovery.
    """
    
    def __init__(self):
        self.runs: Dict[str, RunState] = {}
        self.run_handlers: Dict[str, Callable] = {}
        self._monitor_task: Optional[asyncio.Task] = None
        self._heartbeat_timeout = timedelta(seconds=60)
        self._running = False
    
    async def start(self):
        """Start the orchestrator monitoring loop."""
        self._running = True
        self._monitor_task = asyncio.create_task(self._monitor_loop())
        logger.info("RunOrchestrator started")
    
    async def stop(self):
        """Stop the orchestrator and all runs."""
        self._running = False
        if self._monitor_task:
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass
        
        # Stop all running tasks
        for run in self.runs.values():
            if run.task and not run.task.done():
                run.task.cancel()
        
        logger.info("RunOrchestrator stopped")
    
    def register_handler(self, run_type: str, handler: Callable):
        """Register a handler function for a run type."""
        self.run_handlers[run_type] = handler
    
    def create_run(
        self, 
        strategy_id: str, 
        run_type: str,
        config: dict = None,
        max_restarts: int = 3
    ) -> str:
        """Create a new run in PENDING state."""
        run_id = str(uuid.uuid4())[:8]
        
        run = RunState(
            run_id=run_id,
            strategy_id=strategy_id,
            run_type=run_type,
            max_restarts=max_restarts
        )
        run.metrics = config or {}
        
        self.runs[run_id] = run
        self._log(run_id, "info", f"Run created: {run_type} for {strategy_id}")
        
        return run_id
    
    async def start_run(self, run_id: str) -> bool:
        """Start a run."""
        run = self.runs.get(run_id)
        if not run:
            return False
        
        if run.status in (RunStatus.RUNNING,):
            return False
        
        handler = self.run_handlers.get(run.run_type)
        if not handler:
            self._log(run_id, "error", f"No handler for run type: {run.run_type}")
            run.status = RunStatus.ERROR
            run.last_error = f"No handler for {run.run_type}"
            return False
        
        run.status = RunStatus.RUNNING
        run.started_at = datetime.utcnow()
        run.last_heartbeat = datetime.utcnow()
        
        # Create async task
        run.task = asyncio.create_task(self._run_wrapper(run_id, handler))
        
        self._log(run_id, "info", "Run started")
        return True
    
    async def pause_run(self, run_id: str) -> bool:
        """Pause a running task."""
        run = self.runs.get(run_id)
        if not run or run.status != RunStatus.RUNNING:
            return False
        
        run.status = RunStatus.PAUSED
        self._log(run_id, "info", "Run paused")
        return True
    
    async def resume_run(self, run_id: str) -> bool:
        """Resume a paused task."""
        run = self.runs.get(run_id)
        if not run or run.status != RunStatus.PAUSED:
            return False
        
        run.status = RunStatus.RUNNING
        run.last_heartbeat = datetime.utcnow()
        self._log(run_id, "info", "Run resumed")
        return True
    
    async def stop_run(self, run_id: str) -> bool:
        """Stop a run."""
        run = self.runs.get(run_id)
        if not run:
            return False
        
        if run.task and not run.task.done():
            run.task.cancel()
            try:
                await run.task
            except asyncio.CancelledError:
                pass
        
        run.status = RunStatus.STOPPED
        run.stopped_at = datetime.utcnow()
        self._log(run_id, "info", "Run stopped")
        return True
    
    def heartbeat(self, run_id: str):
        """Update heartbeat for a run."""
        run = self.runs.get(run_id)
        if run:
            run.last_heartbeat = datetime.utcnow()
    
    def report_error(self, run_id: str, error: str):
        """Report an error for a run."""
        run = self.runs.get(run_id)
        if run:
            run.last_error = error
            run.error_count += 1
            self._log(run_id, "error", error)
    
    def get_run(self, run_id: str) -> Optional[dict]:
        """Get run state as dict."""
        run = self.runs.get(run_id)
        if not run:
            return None
        return self._run_to_dict(run)
    
    def list_runs(self, status: str = None) -> List[dict]:
        """List all runs, optionally filtered by status."""
        runs = list(self.runs.values())
        if status:
            runs = [r for r in runs if r.status.value == status]
        return [self._run_to_dict(r) for r in runs]
    
    def get_logs(self, run_id: str, limit: int = 100) -> List[dict]:
        """Get logs for a run."""
        run = self.runs.get(run_id)
        if not run:
            return []
        return list(run.logs)[-limit:]
    
    async def _run_wrapper(self, run_id: str, handler: Callable):
        """Wrapper that handles run execution and error recovery."""
        run = self.runs.get(run_id)
        if not run:
            return
        
        try:
            await handler(run_id, run.strategy_id, run.metrics, self)
            run.status = RunStatus.COMPLETED
            self._log(run_id, "info", "Run completed successfully")
        except asyncio.CancelledError:
            self._log(run_id, "info", "Run cancelled")
            raise
        except Exception as e:
            error_msg = str(e)
            self.report_error(run_id, error_msg)
            
            # Auto-restart logic
            if run.restart_count < run.max_restarts:
                run.restart_count += 1
                self._log(run_id, "warning", f"Restarting (attempt {run.restart_count}/{run.max_restarts})")
                await asyncio.sleep(2 ** run.restart_count)  # Exponential backoff
                
                handler = self.run_handlers.get(run.run_type)
                if handler:
                    run.task = asyncio.create_task(self._run_wrapper(run_id, handler))
            else:
                run.status = RunStatus.ERROR
                self._log(run_id, "error", "Max restarts exceeded")
    
    async def _monitor_loop(self):
        """Monitor runs for health and heartbeat timeouts."""
        while self._running:
            try:
                now = datetime.utcnow()
                
                for run in list(self.runs.values()):
                    if run.status != RunStatus.RUNNING:
                        continue
                    
                    # Check heartbeat timeout
                    if run.last_heartbeat:
                        elapsed = now - run.last_heartbeat
                        if elapsed > self._heartbeat_timeout:
                            self._log(run.run_id, "warning", f"Heartbeat timeout ({elapsed.seconds}s)")
                            run.status = RunStatus.ERROR
                            run.last_error = "Heartbeat timeout"
                
                await asyncio.sleep(10)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Monitor loop error: {e}")
    
    def _log(self, run_id: str, level: str, message: str):
        """Add a log entry for a run."""
        run = self.runs.get(run_id)
        if run:
            entry = {
                "timestamp": datetime.utcnow().isoformat(),
                "level": level,
                "message": message
            }
            run.logs.append(entry)
            logger.log(
                getattr(logging, level.upper(), logging.INFO),
                f"[Run {run_id}] {message}"
            )
    
    def _run_to_dict(self, run: RunState) -> dict:
        """Convert RunState to dict."""
        return {
            "run_id": run.run_id,
            "strategy_id": run.strategy_id,
            "run_type": run.run_type,
            "status": run.status.value,
            "created_at": run.created_at.isoformat() if run.created_at else None,
            "started_at": run.started_at.isoformat() if run.started_at else None,
            "stopped_at": run.stopped_at.isoformat() if run.stopped_at else None,
            "last_heartbeat": run.last_heartbeat.isoformat() if run.last_heartbeat else None,
            "last_error": run.last_error,
            "error_count": run.error_count,
            "restart_count": run.restart_count,
            "max_restarts": run.max_restarts
        }


# Singleton instance
_orchestrator: Optional[RunOrchestrator] = None

def get_orchestrator() -> RunOrchestrator:
    """Get or create the orchestrator singleton."""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = RunOrchestrator()
        # Register built-in handlers
        _register_builtin_handlers(_orchestrator)
    return _orchestrator


async def _autopilot_paper_handler(
    run_id: str,
    strategy_id: str,
    config: dict,
    orchestrator: RunOrchestrator,
) -> None:
    """
    Handler for autopilot_paper run type.
    
    Runs the autopilot runloop in paper mode, coordinating:
    - Universe scanning
    - Candidate generation
    - Selection (deterministic or LLM-based)
    - Validation
    - Paper execution
    - Position monitoring
    """
    from ..autopilot.config import AutopilotConfig, AutopilotMode
    from ..autopilot.unified_engine import get_unified_engine
    
    logger.info(f"[autopilot_paper] Starting run {run_id} for strategy {strategy_id}")
    
    try:
        # Get the unified engine singleton (already configured)
        engine = get_unified_engine()
        
        # Run a single cycle using the unified engine
        result = engine.run_cycle()
        
        # Report heartbeat
        orchestrator.heartbeat(run_id)
        
        # Log result
        if result.get("success", False):
            logger.info(f"[autopilot_paper] Cycle completed via UnifiedAutopilotEngine")
        else:
            logger.warning(f"[autopilot_paper] Cycle completed with issues: {result}")
        
    except Exception as e:
        logger.error(f"[autopilot_paper] Error in run {run_id}: {e}")
        raise


def _register_builtin_handlers(orchestrator: RunOrchestrator) -> None:
    """Register built-in run type handlers."""
    orchestrator.register_handler("autopilot_paper", _autopilot_paper_handler)
    logger.info("Registered autopilot_paper handler")
