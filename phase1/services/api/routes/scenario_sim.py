"""Wave 8 — Scenario Simulation: deterministic parameter sweep results."""
import hashlib, json
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/scenario-sim", tags=["scenario-sim"])

DEMO_SCENARIOS: list = [
    {"id": "scn-001", "name": "Base Case",        "ir_shift": 0.00, "vol_mult": 1.0, "recession": False, "portfolio_return": 0.142, "max_drawdown": -0.087, "sharpe": 1.21, "var_95": -0.031},
    {"id": "scn-002", "name": "Rate +100bps",     "ir_shift": 0.01, "vol_mult": 1.2, "recession": False, "portfolio_return": 0.098, "max_drawdown": -0.124, "sharpe": 0.89, "var_95": -0.048},
    {"id": "scn-003", "name": "Rate +200bps",     "ir_shift": 0.02, "vol_mult": 1.5, "recession": False, "portfolio_return": 0.041, "max_drawdown": -0.183, "sharpe": 0.42, "var_95": -0.071},
    {"id": "scn-004", "name": "Mild Recession",   "ir_shift": 0.00, "vol_mult": 1.8, "recession": True,  "portfolio_return": -0.063,"max_drawdown": -0.241, "sharpe": -0.34,"var_95": -0.098},
    {"id": "scn-005", "name": "Severe Recession", "ir_shift": 0.01, "vol_mult": 2.5, "recession": True,  "portfolio_return": -0.198,"max_drawdown": -0.412, "sharpe": -1.21,"var_95": -0.175},
    {"id": "scn-006", "name": "Goldilocks",       "ir_shift": -0.01,"vol_mult": 0.8, "recession": False, "portfolio_return": 0.213, "max_drawdown": -0.054, "sharpe": 1.87, "var_95": -0.018},
]

def _hash():
    return hashlib.sha256(json.dumps(DEMO_SCENARIOS, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

DEMO_HASH = _hash()

@router.get("/scenarios")
async def list_scenarios():
    return {"scenarios": DEMO_SCENARIOS, "count": len(DEMO_SCENARIOS), "hash": DEMO_HASH}

@router.post("/run")
async def run_simulation(body: dict = {}):
    return {"scenarios": DEMO_SCENARIOS, "hash": DEMO_HASH, "status": "complete"}

@router.get("/hash")
async def get_hash():
    return {"hash": DEMO_HASH}

@router.get("/scenarios/{scenario_id}")
async def get_scenario(scenario_id: str):
    sc = next((s for s in DEMO_SCENARIOS if s["id"] == scenario_id), None)
    if sc is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Scenario not found")
    return sc
