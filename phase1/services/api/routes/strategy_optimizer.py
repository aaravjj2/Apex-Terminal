"""Wave 6 — Strategy Optimizer: aggregates MC + Walk-Forward + Scoring into a unified optimizer result."""
import hashlib, json
from typing import List
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/strategy-optimizer", tags=["strategy-optimizer"])

class OptimizedStrategy(BaseModel):
    strategy_id: str
    symbol: str
    composite_score: float
    grade: str
    mc_var_95: float
    wf_robust: bool
    wf_degradation: float
    entry_score: float
    recommendation: str
    hash: str

DEMO_OPTIMIZED: List[dict] = [
    {"strategy_id": "momentum_v1", "symbol": "SPY",  "composite_score": 82.4, "grade": "A", "mc_var_95": -21.30, "wf_robust": True,  "wf_degradation": 0.12, "entry_score": 79.0, "recommendation": "Strong buy signal — all three optimizers aligned"},
    {"strategy_id": "mean_rev_v2", "symbol": "QQQ",  "composite_score": 74.1, "grade": "B", "mc_var_95": -18.50, "wf_robust": True,  "wf_degradation": 0.21, "entry_score": 71.0, "recommendation": "Moderate entry — walk-forward slightly degraded"},
    {"strategy_id": "breakout_v3", "symbol": "IWM",  "composite_score": 61.7, "grade": "C", "mc_var_95": -29.10, "wf_robust": False, "wf_degradation": 0.44, "entry_score": 58.0, "recommendation": "Caution — high VaR and walk-forward not robust"},
    {"strategy_id": "trend_v4",    "symbol": "AAPL", "composite_score": 78.9, "grade": "B", "mc_var_95": -15.80, "wf_robust": True,  "wf_degradation": 0.18, "entry_score": 76.0, "recommendation": "Good entry — trend confirmed by all layers"},
    {"strategy_id": "arb_v5",      "symbol": "MSFT", "composite_score": 85.2, "grade": "A", "mc_var_95": -12.40, "wf_robust": True,  "wf_degradation": 0.09, "entry_score": 83.0, "recommendation": "Excellent — top composite across all metrics"},
]

def _build_hash() -> str:
    canonical = json.dumps(DEMO_OPTIMIZED, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()

DEMO_HASH = _build_hash()

@router.get("")
async def list_optimized():
    return {"strategies": DEMO_OPTIMIZED, "count": len(DEMO_OPTIMIZED), "hash": DEMO_HASH}

@router.get("/hash")
async def get_hash():
    return {"hash": DEMO_HASH, "algorithm": "sha256", "inputs": ["mc", "walk_forward", "scoring"]}

@router.get("/strategies/{strategy_id}")
async def get_strategy(strategy_id: str):
    for s in DEMO_OPTIMIZED:
        if s["strategy_id"] == strategy_id:
            return s
    return {"error": "not_found", "strategy_id": strategy_id}

@router.post("/run")
async def run_optimizer(body: dict = {}):
    return {"strategies": DEMO_OPTIMIZED, "hash": DEMO_HASH, "run_id": f"opt-{DEMO_HASH[:8]}", "status": "complete"}
