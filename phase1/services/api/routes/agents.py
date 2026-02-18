"""
v1.40 — Agent Runner (DEMO-first multi-step)
Deterministic multi-step agent that uses internal search + citations.
Each step has: step_id, tool name, inputs, outputs, citations.
"""
import hashlib
import json
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/agents", tags=["agents"])


class AgentStep(BaseModel):
    step_id: str
    tool: str
    inputs: dict
    outputs: dict
    citations: List[str] = []
    duration_ms: int = 0


class AgentRun(BaseModel):
    run_id: str
    status: str  # "completed" | "running" | "failed"
    query: str
    steps: List[dict]
    final_output: str
    total_duration_ms: int


# Deterministic demo agent run
DEMO_STEPS: List[dict] = [
    {
        "step_id": "step-1",
        "tool": "search",
        "inputs": {"query": "SMA crossover strategy", "type": "strategy"},
        "outputs": {
            "results": [
                {"id": "idx-001", "title": "SMA Crossover 20/50", "score": 1.0},
            ],
            "count": 1,
        },
        "citations": ["cit-004"],
        "duration_ms": 45,
    },
    {
        "step_id": "step-2",
        "tool": "backtest",
        "inputs": {"strategy_id": "demo-sma", "period": "1Y"},
        "outputs": {
            "win_rate": 0.623,
            "sharpe": 1.45,
            "max_drawdown": -0.082,
            "total_trades": 47,
            "status": "completed",
        },
        "citations": ["cit-002"],
        "duration_ms": 320,
    },
    {
        "step_id": "step-3",
        "tool": "risk_analysis",
        "inputs": {"underlying": "AAPL", "strike": 170, "option_type": "call"},
        "outputs": {
            "delta": 0.65,
            "gamma": 0.04,
            "vega": 0.28,
            "theta": -0.05,
            "iv": 0.325,
        },
        "citations": ["cit-001"],
        "duration_ms": 180,
    },
    {
        "step_id": "step-4",
        "tool": "citations",
        "inputs": {"source_type": "validation"},
        "outputs": {
            "citations_found": 1,
            "validation_status": "pass",
        },
        "citations": ["cit-003"],
        "duration_ms": 25,
    },
    {
        "step_id": "step-5",
        "tool": "synthesize",
        "inputs": {"mode": "summary"},
        "outputs": {
            "recommendation": "MODERATE BUY",
            "confidence": 0.78,
            "reasoning": "Strategy backtests positively (Sharpe 1.45), options pricing favorable (Delta 0.65, IV 32.5%). Schema validation passed.",
        },
        "citations": ["cit-001", "cit-002", "cit-003", "cit-004"],
        "duration_ms": 60,
    },
]

DEMO_RUN: dict = {
    "run_id": "agent-run-demo-001",
    "status": "completed",
    "query": "Analyze SMA crossover strategy with AAPL options",
    "steps": DEMO_STEPS,
    "final_output": "Analysis complete. SMA Crossover 20/50 strategy shows a 62.3% win rate with Sharpe ratio of 1.45 over 1 year. AAPL 170C options have favorable Greeks (Delta=0.65, IV=32.5%). Recommendation: MODERATE BUY with confidence 78%.",
    "total_duration_ms": 630,
}


@router.post("/run")
async def run_agent(query: Optional[str] = None):
    """Execute a DEMO agent run. Returns deterministic fixture steps."""
    run = dict(DEMO_RUN)
    if query:
        run["query"] = query
    return run


@router.get("/runs")
async def list_runs():
    """Return list of completed agent runs."""
    return [DEMO_RUN]


@router.get("/runs/hash")
async def runs_hash():
    """Determinism hash of the demo run."""
    canonical = json.dumps(DEMO_RUN, sort_keys=True, separators=(",", ":"))
    h = hashlib.sha256(canonical.encode()).hexdigest()
    return {"hash": h}


@router.get("/runs/{run_id}")
async def get_run(run_id: str):
    """Return a specific agent run."""
    if run_id == DEMO_RUN["run_id"]:
        return DEMO_RUN
    return {"error": "Run not found"}


@router.get("/tools")
async def list_tools():
    """Return available agent tools."""
    return [
        {"name": "search", "description": "Search internal index for strategies, backtests, etc."},
        {"name": "backtest", "description": "Run backtest on a strategy"},
        {"name": "risk_analysis", "description": "Compute Greeks and risk metrics"},
        {"name": "citations", "description": "Fetch citations/evidence for findings"},
        {"name": "synthesize", "description": "Synthesize findings into recommendation"},
    ]
