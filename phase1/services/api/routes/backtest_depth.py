"""
Backtest Depth Routes — Param Sweeps, Walk-Forward, Robustness

STATUS: NOT IMPLEMENTED — requires real backtesting engine (Phase 5).
Endpoints return 501 until real backtest engine is wired.
"""
import logging
from typing import List, Dict
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/ui2/backtest-depth")
logger = logging.getLogger(__name__)

_NOT_IMPL = "Backtest depth analysis requires real backtesting engine (Phase 5). No fabricated data."


# ── Models (kept for API schema documentation) ──────────────────────────────

class SweepParam(BaseModel):
    name: str
    min: float
    max: float
    step: float


class SweepConfig(BaseModel):
    symbol: str
    strategy_id: str
    params: List[SweepParam]
    metric: str = "sharpe"


class SweepCell(BaseModel):
    cell_id: str
    param_values: Dict[str, float]
    sharpe: float
    total_return: float
    max_drawdown: float
    trade_count: int


class SweepResult(BaseModel):
    sweep_id: str
    config: SweepConfig
    cells: List[SweepCell]
    best_cell_id: str
    hash: str


class WalkForwardWindow(BaseModel):
    window_id: int
    train_start: str
    train_end: str
    test_start: str
    test_end: str
    in_sample_sharpe: float
    out_of_sample_sharpe: float
    in_sample_return: float
    out_of_sample_return: float


class WalkForwardResult(BaseModel):
    wf_id: str
    symbol: str
    strategy_id: str
    windows: List[WalkForwardWindow]
    aggregate_sharpe: float
    aggregate_return: float
    oos_degradation: float
    hash: str


class RobustnessScenario(BaseModel):
    scenario_id: str
    label: str
    fee_multiplier: float
    slippage_multiplier: float
    delay_ms: int
    sharpe: float
    total_return: float
    max_drawdown: float
    delta_sharpe: float


class RobustnessResult(BaseModel):
    rob_id: str
    symbol: str
    strategy_id: str
    scenarios: List[RobustnessScenario]
    robustness_score: int
    hash: str


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/sweeps", response_model=SweepResult)
def run_sweep(config: SweepConfig):
    raise HTTPException(status_code=501, detail=_NOT_IMPL)


@router.get("/sweeps/{sweep_id}", response_model=SweepResult)
def get_sweep(sweep_id: str, symbol: str = "AAPL", strategy_id: str = "strat-1"):
    raise HTTPException(status_code=501, detail=_NOT_IMPL)


@router.post("/walkforward", response_model=WalkForwardResult)
def run_walk_forward(symbol: str = "AAPL", strategy_id: str = "strat-1"):
    raise HTTPException(status_code=501, detail=_NOT_IMPL)


@router.post("/robustness", response_model=RobustnessResult)
def run_robustness(symbol: str = "AAPL", strategy_id: str = "strat-1"):
    raise HTTPException(status_code=501, detail=_NOT_IMPL)


@router.get("/hash")
def get_hash():
    raise HTTPException(status_code=501, detail=_NOT_IMPL)
