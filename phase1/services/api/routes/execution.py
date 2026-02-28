"""
Execution Engine API Routes
============================
25 endpoints for algo scheduling, execution simulation, cost analysis,
and post-trade analytics.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from phase1.services.execution_engine import ExecutionEngine

router = APIRouter(prefix="/api/v1/execution", tags=["execution"])
engine = ExecutionEngine()


# ─── Pydantic Models ────────────────────────────────────────────────────────

class TWAPRequest(BaseModel):
    quantity: int
    num_slices: int = 10
    duration_seconds: float = 3600


class VWAPRequest(BaseModel):
    quantity: int
    num_slices: int = 10
    volume_profile: Optional[List[float]] = None


class IcebergRequest(BaseModel):
    quantity: int
    display_size: int = 100


class POVRequest(BaseModel):
    quantity: int
    market_volumes: List[int]
    participation_rate: float = 0.10


class AdaptiveRequest(BaseModel):
    quantity: int
    num_slices: int = 10
    urgency: float = 0.5


class SimulateTWAPRequest(BaseModel):
    symbol: str
    side: str = "buy"
    quantity: int
    price: float
    adv: float = 1_000_000
    volatility: float = 0.02
    num_slices: int = 10
    duration_seconds: float = 3600


class SimulateVWAPRequest(BaseModel):
    symbol: str
    side: str = "buy"
    quantity: int
    price: float
    adv: float = 1_000_000
    volatility: float = 0.02
    num_slices: int = 10


class SimulateIcebergRequest(BaseModel):
    symbol: str
    side: str = "buy"
    quantity: int
    price: float
    display_size: int = 100
    adv: float = 1_000_000


class SlippageRequest(BaseModel):
    price: float
    quantity: int
    adv: float
    spread: float = 0.01
    volatility: float = 0.02


class CostRequest(BaseModel):
    quantity: int
    price: float
    side: str = "buy"
    bid: float = 0
    ask: float = 0


class AlmgrenChrissRequest(BaseModel):
    quantity: int
    adv: float
    volatility: float = 0.02
    eta: float = 0.01
    gamma: float = 0.5
    num_periods: int = 10


class CompareVWAPRequest(BaseModel):
    market_vwap: float


# ─── Schedule Generation ────────────────────────────────────────────────────

@router.post("/schedule/twap")
def schedule_twap(req: TWAPRequest):
    sched = engine.generate_twap(req.quantity, req.num_slices, req.duration_seconds)
    return {"schedule": sched, "total_quantity": req.quantity}


@router.post("/schedule/vwap")
def schedule_vwap(req: VWAPRequest):
    sched = engine.generate_vwap(req.quantity, req.num_slices, req.volume_profile)
    return {"schedule": sched, "total_quantity": req.quantity}


@router.post("/schedule/iceberg")
def schedule_iceberg(req: IcebergRequest):
    sched = engine.generate_iceberg(req.quantity, req.display_size)
    return {"schedule": sched, "total_quantity": req.quantity}


@router.post("/schedule/pov")
def schedule_pov(req: POVRequest):
    sched = engine.generate_pov(req.quantity, req.market_volumes,
                                 req.participation_rate)
    return {"schedule": sched, "total_quantity": req.quantity}


@router.post("/schedule/adaptive")
def schedule_adaptive(req: AdaptiveRequest):
    sched = engine.generate_adaptive(req.quantity, req.num_slices, req.urgency)
    return {"schedule": sched, "total_quantity": req.quantity}


# ─── Simulation ─────────────────────────────────────────────────────────────

@router.post("/simulate/twap")
def simulate_twap(req: SimulateTWAPRequest):
    exec_ = engine.simulate_twap(
        req.symbol, req.side, req.quantity, req.price,
        adv=req.adv, volatility=req.volatility,
        num_slices=req.num_slices, duration_seconds=req.duration_seconds)
    return exec_.to_dict()


@router.post("/simulate/vwap")
def simulate_vwap(req: SimulateVWAPRequest):
    exec_ = engine.simulate_vwap(
        req.symbol, req.side, req.quantity, req.price,
        adv=req.adv, volatility=req.volatility,
        num_slices=req.num_slices)
    return exec_.to_dict()


@router.post("/simulate/iceberg")
def simulate_iceberg(req: SimulateIcebergRequest):
    exec_ = engine.simulate_iceberg(
        req.symbol, req.side, req.quantity, req.price,
        display_size=req.display_size, adv=req.adv)
    return exec_.to_dict()


# ─── Analysis ───────────────────────────────────────────────────────────────

@router.get("/analysis/{execution_id}")
def analyze_execution(execution_id: str):
    result = engine.analyze_execution(execution_id)
    if "error" in result:
        raise HTTPException(404, result["error"])
    return result


@router.post("/analysis/{execution_id}/vwap-compare")
def compare_vwap(execution_id: str, req: CompareVWAPRequest):
    result = engine.compare_vwap(execution_id, req.market_vwap)
    if "error" in result:
        raise HTTPException(404, result["error"])
    return result


# ─── Cost Estimation ────────────────────────────────────────────────────────

@router.post("/cost/slippage")
def estimate_slippage(req: SlippageRequest):
    return engine.estimate_slippage(
        req.price, req.quantity, req.adv, req.spread, req.volatility)


@router.post("/cost/transaction")
def estimate_cost(req: CostRequest):
    return engine.estimate_cost(req.quantity, req.price, req.side, req.bid, req.ask)


@router.post("/cost/almgren-chriss")
def almgren_chriss(req: AlmgrenChrissRequest):
    from phase1.services.execution_engine import SlippageModel
    return SlippageModel.almgren_chriss(
        req.quantity, req.adv, req.volatility, req.eta, req.gamma, req.num_periods)


# ─── Queries ────────────────────────────────────────────────────────────────

@router.get("/executions")
def all_executions():
    execs = engine.get_all_executions()
    return {"executions": [e.to_dict() for e in execs], "count": len(execs)}


@router.get("/executions/active")
def active_executions():
    execs = engine.get_active_executions()
    return {"executions": [e.to_dict() for e in execs], "count": len(execs)}


@router.get("/executions/{execution_id}")
def get_execution(execution_id: str):
    e = engine.get_execution(execution_id)
    if not e:
        raise HTTPException(404, "Execution not found")
    return e.to_dict()


@router.get("/executions/{execution_id}/slices")
def get_slices(execution_id: str):
    e = engine.get_execution(execution_id)
    if not e:
        raise HTTPException(404, "Execution not found")
    return {"slices": [s.to_dict() for s in e.slices], "count": len(e.slices)}


# ─── Meta ───────────────────────────────────────────────────────────────────

@router.get("/capabilities")
def capabilities():
    return engine.capabilities()
