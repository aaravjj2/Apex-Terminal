"""
Autopilot Depth Routes — Risk Controls, Execution Model, Evaluation Attribution

Risk controls and execution params are real configurable state.
Evaluation endpoint requires real autopilot run data (Phase 7).
"""
import logging
from typing import List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/ui2/autopilot-depth")
logger = logging.getLogger(__name__)

_NOT_IMPL = "Run evaluation requires real autopilot execution data (Phase 7). No fabricated data."


# ── Models ───────────────────────────────────────────────────────────────────

class RiskControls(BaseModel):
    max_position_notional: float = 50000
    max_gross_exposure: float = 200000
    max_daily_loss: float = 5000
    max_trades_per_run: int = 20


class ExecutionParams(BaseModel):
    fee_per_order: float = 1.25
    bps_fee: float = 2.5
    slippage_base_bps: float = 1.0
    slippage_vol_multiplier: float = 0.5


class EvalAttribution(BaseModel):
    leg_id: str
    symbol: str
    strategy: str
    gross_pnl: float
    fees: float
    slippage: float
    net_pnl: float


class FillRecord(BaseModel):
    fill_id: str
    symbol: str
    side: str
    qty: int
    price: float
    fee: float
    slippage_bps: float
    ts: str


class RiskBudget(BaseModel):
    label: str
    limit: float
    used: float
    remaining: float


class RiskBreach(BaseModel):
    ts: str
    rule: str
    value: float
    limit: float


class RunEvaluation(BaseModel):
    run_id: str
    expected_pnl: float
    realized_pnl: float
    total_fees: float
    total_slippage: float
    attribution: List[EvalAttribution]
    fills: List[FillRecord]
    risk_budget_remaining: List[RiskBudget]
    breaches: List[RiskBreach]
    hash: str


# ── State ────────────────────────────────────────────────────────────────────
_risk = RiskControls()
_exec = ExecutionParams()


@router.get("/risk-controls", response_model=RiskControls)
def get_risk_controls():
    return _risk


@router.put("/risk-controls", response_model=RiskControls)
def update_risk_controls(body: RiskControls):
    global _risk
    _risk = body
    return _risk


@router.get("/execution-params", response_model=ExecutionParams)
def get_execution_params():
    return _exec


@router.put("/execution-params", response_model=ExecutionParams)
def update_execution_params(body: ExecutionParams):
    global _exec
    _exec = body
    return _exec


@router.get("/runs/{run_id}/evaluation")
def get_evaluation(run_id: str):
    raise HTTPException(status_code=501, detail=_NOT_IMPL)


@router.get("/hash")
def get_hash():
    raise HTTPException(status_code=501, detail=_NOT_IMPL)
