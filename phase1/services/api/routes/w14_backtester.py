"""
Waves 11-20 — Backtester v3 API Routes
Execution calibration, backtest-vs-paper comparison, corporate actions.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import logging

from ...waves11_20.backtester import get_backtester_v3, ExecutionModel

router = APIRouter(prefix="/api/v2/backtester", tags=["backtester-v3"])
logger = logging.getLogger(__name__)


class RunBacktestRequest(BaseModel):
    symbol: str
    fast_period: int = 10
    slow_period: int = 50
    initial_capital: float = 100000
    fee_per_trade: float = 1.0
    slippage_bps: float = 5.0
    spread_bps: float = 2.0


class CalibrateRequest(BaseModel):
    symbol: str
    paper_trades: list[dict]  # [{entry_price, exit_price, quantity, pnl}]


@router.post("/run")
async def run_backtest(req: RunBacktestRequest):
    """Run a backtest with execution calibration."""
    bt = get_backtester_v3()
    exec_model = ExecutionModel(
        fee_per_trade=req.fee_per_trade,
        slippage_bps=req.slippage_bps,
        spread_bps=req.spread_bps,
    )
    result = bt.run_backtest(
        symbol=req.symbol,
        fast_period=req.fast_period,
        slow_period=req.slow_period,
        initial_capital=req.initial_capital,
        exec_model=exec_model,
    )
    return result.to_dict()


@router.post("/calibrate")
async def calibrate(req: CalibrateRequest):
    """Compare backtest vs paper trades for calibration score."""
    bt = get_backtester_v3()
    # Run backtest first
    result = bt.run_backtest(symbol=req.symbol)
    # Then compare
    comparison = bt.compare_backtest_vs_paper(result, req.paper_trades)
    return comparison.to_dict()


@router.get("/corporate-actions/{symbol}")
async def get_corporate_actions(symbol: str):
    """Get corporate actions that affect backtesting."""
    bt = get_backtester_v3()
    actions = bt.get_corporate_actions(symbol)
    return {"symbol": symbol, "actions": [a.to_dict() for a in actions]}


@router.get("/warnings/{symbol}")
async def get_warnings(symbol: str):
    """Get data quality warnings for backtesting a symbol."""
    bt = get_backtester_v3()
    return bt.get_data_warnings(symbol)


@router.get("/execution-model")
async def get_execution_model():
    """Get default execution model parameters."""
    return ExecutionModel().to_dict()
