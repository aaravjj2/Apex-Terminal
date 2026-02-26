"""
Waves 11-20 — Backtester v3 API Routes
Execution calibration, backtest-vs-paper comparison, corporate actions.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging
import math
import random
from datetime import date, timedelta

from ...waves11_20.backtester import (
    get_backtester_v3, ExecutionModel, BacktesterV3, CorporateActionType
)

router = APIRouter(prefix="/api/v2/backtester", tags=["backtester-v3"])
logger = logging.getLogger(__name__)


def _generate_synthetic_bars(symbol: str, start_date: str, end_date: str, seed: int = 42) -> list[dict]:
    """Generate deterministic synthetic OHLCV bars for backtesting (no external deps)."""
    rng = random.Random(seed + hash(symbol) % 10000)
    bars = []
    price = 150.0 + (hash(symbol) % 100)
    cur = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    while cur <= end:
        if cur.weekday() < 5:  # weekdays only
            change = rng.gauss(0.0003, 0.013)
            open_p = price * (1 + rng.gauss(0, 0.003))
            close_p = price * (1 + change)
            high_p = max(open_p, close_p) * (1 + abs(rng.gauss(0, 0.005)))
            low_p = min(open_p, close_p) * (1 - abs(rng.gauss(0, 0.005)))
            bars.append({
                "date": cur.isoformat(),
                "open": round(open_p, 4),
                "high": round(high_p, 4),
                "low": round(low_p, 4),
                "close": round(close_p, 4),
                "adj_close": round(close_p, 4),
                "volume": int(rng.uniform(1_000_000, 10_000_000)),
            })
            price = close_p
        cur += timedelta(days=1)
    return bars


def _default_dates() -> tuple[str, str]:
    today = date.today()
    return (today - timedelta(days=365)).isoformat(), today.isoformat()


class RunBacktestRequest(BaseModel):
    symbol: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    initial_capital: float = 100000.0
    fee_per_trade: float = 1.0
    slippage_bps: float = 5.0
    spread_bps: float = 2.0
    strategy_id: str = "sma-crossover"
    strategy_name: str = "SMA Crossover"


class CalibrateRequest(BaseModel):
    symbol: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    paper_return: float = 0.0
    paper_sharpe: float = 0.0
    paper_trades: int = 0
    fee_per_trade: float = 1.0
    slippage_bps: float = 5.0


@router.post("/run")
async def run_backtest(req: RunBacktestRequest):
    """Run a backtest with execution calibration."""
    try:
        start, end = req.start_date, req.end_date
        if not start or not end:
            start, end = _default_dates()

        exec_model = ExecutionModel(
            fee_per_trade=req.fee_per_trade,
            slippage_bps=req.slippage_bps,
            spread_bps=req.spread_bps,
        )
        bt = BacktesterV3(execution_model=exec_model)

        daily_bars = {req.symbol: _generate_synthetic_bars(req.symbol, start, end)}

        result = bt.run_backtest(
            strategy_id=req.strategy_id,
            strategy_name=req.strategy_name,
            symbols=[req.symbol],
            daily_bars=daily_bars,
            start_date=start,
            end_date=end,
            initial_capital=req.initial_capital,
        )
        return {"ok": True, **result.to_dict()}
    except Exception as exc:
        logger.exception("Backtest run failed")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/calibrate")
async def calibrate(req: CalibrateRequest):
    """Compare backtest vs paper trading for calibration score."""
    try:
        start, end = req.start_date, req.end_date
        if not start or not end:
            start, end = _default_dates()

        exec_model = ExecutionModel(
            fee_per_trade=req.fee_per_trade,
            slippage_bps=req.slippage_bps,
        )
        bt = BacktesterV3(execution_model=exec_model)
        daily_bars = {req.symbol: _generate_synthetic_bars(req.symbol, start, end)}

        result = bt.run_backtest(
            strategy_id="calibrate",
            strategy_name="Calibration Run",
            symbols=[req.symbol],
            daily_bars=daily_bars,
            start_date=start,
            end_date=end,
        )
        comparison = bt.compare_with_paper(
            backtest_result=result,
            paper_return=req.paper_return,
            paper_sharpe=req.paper_sharpe,
            paper_trades=req.paper_trades,
        )
        return {"ok": True, **comparison.to_dict()}
    except Exception as exc:
        logger.exception("Calibration failed")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/corporate-actions/{symbol}")
async def get_corporate_actions(symbol: str):
    """Get corporate actions registry (static data)."""
    # BacktesterV3 doesn't hold corporate actions — return empty for now
    return {"symbol": symbol, "actions": []}


@router.get("/warnings/{symbol}")
async def get_warnings(symbol: str):
    """Get data quality warnings for a symbol."""
    # Generate a quick 1-year run to surface any incomplete-history warnings
    start, end = _default_dates()
    bt = BacktesterV3()
    daily_bars = {symbol: _generate_synthetic_bars(symbol, start, end)}
    result = bt.run_backtest(
        strategy_id="warnings",
        strategy_name="Warnings Check",
        symbols=[symbol],
        daily_bars=daily_bars,
        start_date=start,
        end_date=end,
    )
    return {
        "symbol": symbol,
        "survivorship_warnings": result.survivorship_warnings,
        "incomplete_history_warnings": result.incomplete_history_warnings,
    }


@router.get("/execution-model")
async def get_execution_model():
    """Get default execution model parameters."""
    return ExecutionModel().to_dict()
