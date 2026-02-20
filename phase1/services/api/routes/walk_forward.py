"""
Wave 6 — Walk-Forward Backtesting
Out-of-sample walk-forward analysis with deterministic demo data.
"""
import hashlib
import json
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/walk-forward", tags=["walk-forward"])


class WFConfig(BaseModel):
    strategy_id: str = "demo-sma-crossover"
    symbol: str = "SPY"
    total_bars: int = 252
    in_sample_pct: float = 0.7
    num_folds: int = 5
    seed: int = 42


class WFFold(BaseModel):
    fold_id: int
    in_sample_start: int
    in_sample_end: int
    out_sample_start: int
    out_sample_end: int
    in_sample_sharpe: float
    out_sample_sharpe: float
    in_sample_return_pct: float
    out_sample_return_pct: float
    total_trades: int
    win_rate_pct: float


class WFResult(BaseModel):
    config_hash: str
    strategy_id: str
    symbol: str
    folds: List[WFFold]
    avg_is_sharpe: float
    avg_oos_sharpe: float
    avg_is_return: float
    avg_oos_return: float
    degradation_ratio: float
    robust: bool


DEMO_FOLDS = [
    WFFold(fold_id=0, in_sample_start=0, in_sample_end=35, out_sample_start=35, out_sample_end=50,
           in_sample_sharpe=1.42, out_sample_sharpe=0.91, in_sample_return_pct=8.3,
           out_sample_return_pct=4.1, total_trades=12, win_rate_pct=58.3),
    WFFold(fold_id=1, in_sample_start=50, in_sample_end=85, out_sample_start=85, out_sample_end=100,
           in_sample_sharpe=1.55, out_sample_sharpe=1.02, in_sample_return_pct=9.1,
           out_sample_return_pct=5.3, total_trades=14, win_rate_pct=57.1),
    WFFold(fold_id=2, in_sample_start=100, in_sample_end=135, out_sample_start=135, out_sample_end=150,
           in_sample_sharpe=1.38, out_sample_sharpe=0.85, in_sample_return_pct=7.6,
           out_sample_return_pct=3.8, total_trades=11, win_rate_pct=54.5),
    WFFold(fold_id=3, in_sample_start=150, in_sample_end=185, out_sample_start=185, out_sample_end=200,
           in_sample_sharpe=1.61, out_sample_sharpe=1.15, in_sample_return_pct=10.2,
           out_sample_return_pct=6.1, total_trades=15, win_rate_pct=60.0),
    WFFold(fold_id=4, in_sample_start=200, in_sample_end=235, out_sample_start=235, out_sample_end=252,
           in_sample_sharpe=1.29, out_sample_sharpe=0.78, in_sample_return_pct=6.9,
           out_sample_return_pct=3.2, total_trades=10, win_rate_pct=50.0),
]


def _build_result(cfg: WFConfig) -> WFResult:
    config_json = json.dumps(cfg.model_dump(), sort_keys=True, separators=(",", ":"))
    config_hash = hashlib.sha256(config_json.encode()).hexdigest()
    avg_is = sum(f.in_sample_sharpe for f in DEMO_FOLDS) / len(DEMO_FOLDS)
    avg_oos = sum(f.out_sample_sharpe for f in DEMO_FOLDS) / len(DEMO_FOLDS)
    avg_is_r = sum(f.in_sample_return_pct for f in DEMO_FOLDS) / len(DEMO_FOLDS)
    avg_oos_r = sum(f.out_sample_return_pct for f in DEMO_FOLDS) / len(DEMO_FOLDS)
    degradation = avg_oos / avg_is if avg_is != 0 else 0
    return WFResult(
        config_hash=config_hash,
        strategy_id=cfg.strategy_id,
        symbol=cfg.symbol,
        folds=DEMO_FOLDS,
        avg_is_sharpe=round(avg_is, 4),
        avg_oos_sharpe=round(avg_oos, 4),
        avg_is_return=round(avg_is_r, 4),
        avg_oos_return=round(avg_oos_r, 4),
        degradation_ratio=round(degradation, 4),
        robust=degradation >= 0.6,
    )


@router.post("/run")
async def run_walk_forward(config: WFConfig):
    return _build_result(config)


@router.get("/hash")
async def walk_forward_hash():
    result = _build_result(WFConfig())
    return {"hash": result.config_hash}


@router.get("/folds")
async def list_folds():
    return [f.model_dump() for f in DEMO_FOLDS]
