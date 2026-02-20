"""
Wave 6 — Monte Carlo Simulation
Deterministic MC paths for portfolio stress-testing.
"""
import hashlib
import json
import math
import random
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/monte-carlo", tags=["monte-carlo"])


class MCConfig(BaseModel):
    symbol: str = "SPY"
    initial_price: float = 450.0
    days: int = 30
    num_paths: int = 100
    annual_vol: float = 0.20
    annual_drift: float = 0.08
    seed: int = 42


class MCPath(BaseModel):
    path_id: int
    prices: List[float]
    final_price: float
    return_pct: float


class MCResult(BaseModel):
    config_hash: str
    symbol: str
    paths: List[MCPath]
    percentile_5: float
    percentile_50: float
    percentile_95: float
    expected_return: float
    max_drawdown_avg: float
    var_95: float


def _run_mc(cfg: MCConfig) -> MCResult:
    rng = random.Random(cfg.seed)
    dt = 1.0 / 252.0
    drift = (cfg.annual_drift - 0.5 * cfg.annual_vol ** 2) * dt
    vol = cfg.annual_vol * math.sqrt(dt)
    paths: List[MCPath] = []
    finals: List[float] = []
    drawdowns: List[float] = []
    for i in range(cfg.num_paths):
        prices = [cfg.initial_price]
        peak = cfg.initial_price
        max_dd = 0.0
        for _ in range(cfg.days):
            z = rng.gauss(0, 1)
            p = prices[-1] * math.exp(drift + vol * z)
            prices.append(round(p, 4))
            if p > peak:
                peak = p
            dd = (peak - p) / peak
            if dd > max_dd:
                max_dd = dd
        final = prices[-1]
        finals.append(final)
        drawdowns.append(max_dd)
        paths.append(MCPath(
            path_id=i,
            prices=[round(p, 2) for p in prices],
            final_price=round(final, 2),
            return_pct=round((final / cfg.initial_price - 1) * 100, 4),
        ))
    finals_sorted = sorted(finals)
    p5 = finals_sorted[int(0.05 * len(finals_sorted))]
    p50 = finals_sorted[int(0.50 * len(finals_sorted))]
    p95 = finals_sorted[int(0.95 * len(finals_sorted))]
    expected_ret = sum(f / cfg.initial_price - 1 for f in finals) / len(finals)
    avg_dd = sum(drawdowns) / len(drawdowns)
    var_95 = cfg.initial_price - p5
    config_json = json.dumps(cfg.model_dump(), sort_keys=True, separators=(",", ":"))
    config_hash = hashlib.sha256(config_json.encode()).hexdigest()
    return MCResult(
        config_hash=config_hash,
        symbol=cfg.symbol,
        paths=paths,
        percentile_5=round(p5, 2),
        percentile_50=round(p50, 2),
        percentile_95=round(p95, 2),
        expected_return=round(expected_ret * 100, 4),
        max_drawdown_avg=round(avg_dd * 100, 4),
        var_95=round(var_95, 2),
    )


@router.post("/run")
async def run_monte_carlo(config: MCConfig):
    return _run_mc(config)


@router.post("/run/summary")
async def run_monte_carlo_summary(config: MCConfig):
    result = _run_mc(config)
    return {
        "config_hash": result.config_hash,
        "symbol": result.symbol,
        "num_paths": len(result.paths),
        "percentile_5": result.percentile_5,
        "percentile_50": result.percentile_50,
        "percentile_95": result.percentile_95,
        "expected_return": result.expected_return,
        "max_drawdown_avg": result.max_drawdown_avg,
        "var_95": result.var_95,
    }


@router.get("/hash")
async def monte_carlo_hash():
    """Determinism gate: default config always produces same hash."""
    result = _run_mc(MCConfig())
    return {"hash": result.config_hash, "result_hash": hashlib.sha256(
        json.dumps({"p5": result.percentile_5, "p50": result.percentile_50, "p95": result.percentile_95},
                   sort_keys=True).encode()
    ).hexdigest()}
