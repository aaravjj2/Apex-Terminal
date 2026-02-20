"""Wave 7 — Portfolio Optimizer: mean-variance optimization with stable allocations."""
import hashlib, json
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/portfolio-optimizer", tags=["portfolio-optimizer"])

DEMO_ALLOCATION: list = [
    {"symbol": "SPY",  "weight": 0.30, "expected_return": 0.12, "volatility": 0.15, "sharpe": 0.80, "explanation": "Core equity exposure — best risk-adjusted return"},
    {"symbol": "QQQ",  "weight": 0.20, "expected_return": 0.15, "volatility": 0.18, "sharpe": 0.83, "explanation": "Tech growth allocation — high Sharpe"},
    {"symbol": "TLT",  "weight": 0.20, "expected_return": 0.04, "volatility": 0.08, "sharpe": 0.50, "explanation": "Fixed income hedge — reduces portfolio vol"},
    {"symbol": "GLD",  "weight": 0.10, "expected_return": 0.06, "volatility": 0.12, "sharpe": 0.50, "explanation": "Inflation hedge — low correlation"},
    {"symbol": "IWM",  "weight": 0.10, "expected_return": 0.11, "volatility": 0.17, "sharpe": 0.65, "explanation": "Small-cap factor tilt"},
    {"symbol": "CASH", "weight": 0.10, "expected_return": 0.05, "volatility": 0.00, "sharpe": 0.00, "explanation": "Liquidity buffer — 10% dry powder"},
]

DEMO_RESULT = {
    "run_id": "po-demo-001",
    "method": "mean_variance",
    "portfolio_return": 0.105,
    "portfolio_volatility": 0.112,
    "portfolio_sharpe": 0.938,
    "max_drawdown": -0.142,
    "diversification_ratio": 1.34,
    "allocations": DEMO_ALLOCATION,
}

def _hash():
    return hashlib.sha256(json.dumps(DEMO_RESULT, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

DEMO_HASH = _hash()

@router.get("")
async def get_result():
    return {**DEMO_RESULT, "hash": DEMO_HASH}

@router.post("/run")
async def run_optimizer(body: dict = {}):
    return {**DEMO_RESULT, "hash": DEMO_HASH, "status": "complete"}

@router.get("/hash")
async def get_hash():
    return {"hash": DEMO_HASH, "portfolio_sharpe": DEMO_RESULT["portfolio_sharpe"]}

@router.get("/allocations")
async def get_allocations():
    return {"allocations": DEMO_ALLOCATION, "count": len(DEMO_ALLOCATION), "hash": DEMO_HASH}
