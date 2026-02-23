"""
Workflows v3 — Wave 18
Workflow schema with market-session scheduling, built-in templates,
audit trail, DAG execution engine.
"""

import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional, Any
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class StepType(str, Enum):
    INGEST = "ingest"
    SCORE_SENTIMENT = "score_sentiment"
    GENERATE_SIGNALS = "generate_signals"
    ALLOCATE = "allocate"
    SUBMIT_ORDERS = "submit_orders"
    EVALUATE_PERFORMANCE = "evaluate_performance"
    REBALANCE = "rebalance"
    NOTIFY = "notify"
    CUSTOM = "custom"


class WorkflowStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    DISABLED = "disabled"


class StepStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class ScheduleTrigger(str, Enum):
    PRE_MARKET = "pre_market"     # 04:00-09:30 ET
    MARKET_OPEN = "market_open"   # 09:30 ET
    INTRADAY = "intraday"         # During market hours
    MARKET_CLOSE = "market_close" # 16:00 ET
    AFTER_HOURS = "after_hours"   # 16:00-20:00 ET
    DAILY = "daily"               # Once per trading day
    MANUAL = "manual"             # User-triggered


@dataclass
class WorkflowStep:
    """A single step in a workflow DAG."""
    step_id: str
    name: str
    step_type: StepType
    config: dict = field(default_factory=dict)
    depends_on: list[str] = field(default_factory=list)  # Step IDs
    timeout_seconds: int = 300
    retry_count: int = 0
    max_retries: int = 2

    def to_dict(self) -> dict:
        return {
            "step_id": self.step_id,
            "name": self.name,
            "step_type": self.step_type.value,
            "config": self.config,
            "depends_on": self.depends_on,
            "timeout_seconds": self.timeout_seconds,
            "retry_count": self.retry_count,
            "max_retries": self.max_retries,
        }


@dataclass
class WorkflowSchedule:
    """Workflow scheduling configuration."""
    trigger: ScheduleTrigger
    cron_expression: Optional[str] = None  # For custom schedules
    timezone: str = "America/New_York"
    skip_holidays: bool = True
    skip_weekends: bool = True

    def to_dict(self) -> dict:
        return {
            "trigger": self.trigger.value,
            "cron_expression": self.cron_expression,
            "timezone": self.timezone,
            "skip_holidays": self.skip_holidays,
            "skip_weekends": self.skip_weekends,
        }


@dataclass
class AuditEntry:
    """Immutable audit trail entry."""
    entry_id: str
    workflow_id: str
    step_id: Optional[str]
    action: str
    actor: str
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    details: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "entry_id": self.entry_id,
            "workflow_id": self.workflow_id,
            "step_id": self.step_id,
            "action": self.action,
            "actor": self.actor,
            "timestamp": self.timestamp,
            "details": self.details,
        }


@dataclass
class WorkflowRunState:
    """State of a single workflow run."""
    run_id: str
    workflow_id: str
    status: WorkflowStatus
    started_at: str
    completed_at: Optional[str] = None
    step_states: dict[str, StepStatus] = field(default_factory=dict)
    step_outputs: dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "run_id": self.run_id,
            "workflow_id": self.workflow_id,
            "status": self.status.value,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "step_states": {k: v.value for k, v in self.step_states.items()},
            "step_outputs": self.step_outputs,
            "error": self.error,
        }


@dataclass
class WorkflowV3:
    """Complete workflow definition."""
    workflow_id: str
    name: str
    description: str
    steps: list[WorkflowStep]
    schedule: WorkflowSchedule
    status: WorkflowStatus = WorkflowStatus.DRAFT
    version: int = 1
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "workflow_id": self.workflow_id,
            "name": self.name,
            "description": self.description,
            "steps": [s.to_dict() for s in self.steps],
            "schedule": self.schedule.to_dict(),
            "status": self.status.value,
            "version": self.version,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "metadata": self.metadata,
        }


# Built-in workflow templates
def _daily_swing_workflow() -> WorkflowV3:
    wid = "tmpl-daily-swing"
    return WorkflowV3(
        workflow_id=wid,
        name="Daily Swing Trading",
        description="Full daily swing trading cycle: ingest → signals → allocate → trade → evaluate",
        steps=[
            WorkflowStep("ingest", "Ingest Market Data", StepType.INGEST),
            WorkflowStep("sentiment", "Score News Sentiment", StepType.SCORE_SENTIMENT,
                         depends_on=["ingest"]),
            WorkflowStep("signals", "Generate Trading Signals", StepType.GENERATE_SIGNALS,
                         depends_on=["ingest", "sentiment"]),
            WorkflowStep("allocate", "Portfolio Allocation", StepType.ALLOCATE,
                         depends_on=["signals"]),
            WorkflowStep("orders", "Submit Paper Orders", StepType.SUBMIT_ORDERS,
                         depends_on=["allocate"]),
            WorkflowStep("evaluate", "Evaluate Performance", StepType.EVALUATE_PERFORMANCE,
                         depends_on=["orders"]),
        ],
        schedule=WorkflowSchedule(trigger=ScheduleTrigger.PRE_MARKET),
    )


def _weekly_rebalance_workflow() -> WorkflowV3:
    wid = "tmpl-weekly-rebalance"
    return WorkflowV3(
        workflow_id=wid,
        name="Weekly Portfolio Rebalance",
        description="Weekly review and rebalance of portfolio allocations",
        steps=[
            WorkflowStep("ingest", "Ingest Weekly Data", StepType.INGEST),
            WorkflowStep("evaluate", "Evaluate Week Performance", StepType.EVALUATE_PERFORMANCE,
                         depends_on=["ingest"]),
            WorkflowStep("rebalance", "Rebalance Portfolio", StepType.REBALANCE,
                         depends_on=["evaluate"]),
            WorkflowStep("notify", "Send Report", StepType.NOTIFY,
                         depends_on=["rebalance"]),
        ],
        schedule=WorkflowSchedule(trigger=ScheduleTrigger.AFTER_HOURS,
                                  cron_expression="0 17 * * 5"),  # Friday 5pm
    )


def _discovery_sweep_workflow() -> WorkflowV3:
    wid = "tmpl-discovery-sweep"
    return WorkflowV3(
        workflow_id=wid,
        name="Strategy Discovery Sweep",
        description="Run full strategy discovery pipeline with walk-forward evaluation",
        steps=[
            WorkflowStep("ingest", "Ingest Historical Data", StepType.INGEST),
            WorkflowStep("generate", "Generate Candidates", StepType.CUSTOM,
                         config={"action": "generate_candidates"},
                         depends_on=["ingest"]),
            WorkflowStep("walk_forward", "Walk-Forward Evaluation", StepType.CUSTOM,
                         config={"action": "walk_forward"},
                         depends_on=["generate"]),
            WorkflowStep("robustness", "Robustness Testing", StepType.CUSTOM,
                         config={"action": "robustness_test"},
                         depends_on=["walk_forward"]),
            WorkflowStep("report", "Generate Report", StepType.NOTIFY,
                         depends_on=["robustness"]),
        ],
        schedule=WorkflowSchedule(trigger=ScheduleTrigger.AFTER_HOURS),
    )


BUILTIN_TEMPLATES: dict[str, WorkflowV3] = {
    "daily-swing": _daily_swing_workflow(),
    "weekly-rebalance": _weekly_rebalance_workflow(),
    "discovery-sweep": _discovery_sweep_workflow(),
}


class WorkflowEngine:
    """
    Workflow v3 engine with DAG execution, scheduling,
    and audit trail.
    """

    def __init__(self):
        self._workflows: dict[str, WorkflowV3] = {}
        self._runs: dict[str, WorkflowRunState] = {}
        self._audit: list[AuditEntry] = []

    def create_workflow(
        self,
        name: str,
        description: str,
        steps: list[WorkflowStep],
        schedule: WorkflowSchedule,
        template_id: Optional[str] = None,
    ) -> WorkflowV3:
        """Create a new workflow, optionally from a template."""
        if template_id and template_id in BUILTIN_TEMPLATES:
            tmpl = BUILTIN_TEMPLATES[template_id]
            wf = WorkflowV3(
                workflow_id=f"wf-{hashlib.md5(f'{name}{datetime.now(timezone.utc).isoformat()}'.encode()).hexdigest()[:10]}",
                name=name or tmpl.name,
                description=description or tmpl.description,
                steps=tmpl.steps.copy(),
                schedule=schedule or tmpl.schedule,
            )
        else:
            wf = WorkflowV3(
                workflow_id=f"wf-{hashlib.md5(f'{name}{datetime.now(timezone.utc).isoformat()}'.encode()).hexdigest()[:10]}",
                name=name,
                description=description,
                steps=steps,
                schedule=schedule,
            )

        self._workflows[wf.workflow_id] = wf
        self._add_audit(wf.workflow_id, None, "workflow_created", "system")
        return wf

    def activate_workflow(self, workflow_id: str) -> bool:
        wf = self._workflows.get(workflow_id)
        if not wf:
            return False
        wf.status = WorkflowStatus.ACTIVE
        wf.updated_at = datetime.now(timezone.utc).isoformat()
        self._add_audit(workflow_id, None, "workflow_activated", "system")
        return True

    def pause_workflow(self, workflow_id: str) -> bool:
        wf = self._workflows.get(workflow_id)
        if not wf:
            return False
        wf.status = WorkflowStatus.PAUSED
        wf.updated_at = datetime.now(timezone.utc).isoformat()
        self._add_audit(workflow_id, None, "workflow_paused", "system")
        return True

    def start_run(self, workflow_id: str) -> Optional[WorkflowRunState]:
        """Start a workflow run."""
        wf = self._workflows.get(workflow_id)
        if not wf or wf.status not in (WorkflowStatus.ACTIVE, WorkflowStatus.DRAFT):
            return None

        run_id = f"run-{hashlib.md5(f'{workflow_id}{datetime.now(timezone.utc).isoformat()}'.encode()).hexdigest()[:10]}"
        run = WorkflowRunState(
            run_id=run_id,
            workflow_id=workflow_id,
            status=WorkflowStatus.ACTIVE,
            started_at=datetime.now(timezone.utc).isoformat(),
            step_states={s.step_id: StepStatus.PENDING for s in wf.steps},
        )
        self._runs[run_id] = run
        self._add_audit(workflow_id, None, "run_started", "system", {"run_id": run_id})
        return run

    def complete_step(self, run_id: str, step_id: str, output: Any = None, error: Optional[str] = None) -> bool:
        """Mark a step as completed or failed."""
        run = self._runs.get(run_id)
        if not run:
            return False

        if error:
            run.step_states[step_id] = StepStatus.FAILED
            run.error = error
        else:
            run.step_states[step_id] = StepStatus.COMPLETED
            if output is not None:
                run.step_outputs[step_id] = output

        # Check if all steps completed
        all_done = all(s in (StepStatus.COMPLETED, StepStatus.SKIPPED, StepStatus.FAILED)
                       for s in run.step_states.values())
        if all_done:
            has_failure = any(s == StepStatus.FAILED for s in run.step_states.values())
            run.status = WorkflowStatus.FAILED if has_failure else WorkflowStatus.COMPLETED
            run.completed_at = datetime.now(timezone.utc).isoformat()

        self._add_audit(run.workflow_id, step_id,
                        f"step_{'failed' if error else 'completed'}",
                        "system", {"run_id": run_id})
        return True

    def get_ready_steps(self, run_id: str) -> list[str]:
        """Get steps whose dependencies are met and can run."""
        run = self._runs.get(run_id)
        if not run:
            return []

        wf = self._workflows.get(run.workflow_id)
        if not wf:
            return []

        ready = []
        for step in wf.steps:
            if run.step_states.get(step.step_id) != StepStatus.PENDING:
                continue
            deps_met = all(
                run.step_states.get(dep) in (StepStatus.COMPLETED, StepStatus.SKIPPED)
                for dep in step.depends_on
            )
            if deps_met:
                ready.append(step.step_id)
        return ready

    def get_workflow(self, workflow_id: str) -> Optional[WorkflowV3]:
        return self._workflows.get(workflow_id)

    def list_workflows(self) -> list[WorkflowV3]:
        return list(self._workflows.values())

    def get_run(self, run_id: str) -> Optional[WorkflowRunState]:
        return self._runs.get(run_id)

    def list_runs(self, workflow_id: Optional[str] = None) -> list[WorkflowRunState]:
        runs = list(self._runs.values())
        if workflow_id:
            runs = [r for r in runs if r.workflow_id == workflow_id]
        return runs

    def get_audit_trail(self, workflow_id: Optional[str] = None, limit: int = 100) -> list[AuditEntry]:
        entries = self._audit
        if workflow_id:
            entries = [e for e in entries if e.workflow_id == workflow_id]
        return entries[-limit:]

    def get_templates(self) -> dict[str, dict]:
        return {k: v.to_dict() for k, v in BUILTIN_TEMPLATES.items()}

    def _add_audit(self, workflow_id: str, step_id: Optional[str], action: str, actor: str,
                   details: Optional[dict] = None):
        entry = AuditEntry(
            entry_id=f"audit-{len(self._audit) + 1:06d}",
            workflow_id=workflow_id,
            step_id=step_id,
            action=action,
            actor=actor,
            details=details or {},
        )
        self._audit.append(entry)


_engine: Optional[WorkflowEngine] = None


def get_workflow_engine() -> WorkflowEngine:
    global _engine
    if _engine is None:
        _engine = WorkflowEngine()
    return _engine
