"""
Backtest Depth Routes — Param Sweeps, Walk-Forward, Robustness
Pure deterministic demo endpoints for the Core Depth Upgrade.
"""
import hashlib
from typing import List, Dict, Any
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/ui2/backtest-depth")

DEMO_TS = "2026-02-15T14:30:00Z"


def _fnv32(s: str) -> int:
    h = 0x811C9DC5
    for c in s:
        h ^= ord(c)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


# ── Models ───────────────────────────────────────────────────────────────────

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


# ── Helpers ──────────────────────────────────────────────────────────────────

def _generate_sweep(config: SweepConfig) -> SweepResult:
    sweep_id = f"sweep-{_fnv32(f'{config.symbol}:{config.strategy_id}:sweep') & 0xFFFFFFFF:08x}"
    cells: List[SweepCell] = []
    best_sharpe = -999.0
    best_id = ""

    if len(config.params) >= 2:
        p0, p1 = config.params[0], config.params[1]
        v0 = p0.min
        while v0 <= p0.max:
            v1 = p1.min
            while v1 <= p1.max:
                seed = _fnv32(f"{config.symbol}:{config.strategy_id}:{v0}:{v1}")
                sharpe = round(0.2 + ((seed & 0xFF) / 255) * 2.5, 2)
                cell_id = f"cell-{seed & 0xFFFF:04x}"
                cells.append(SweepCell(
                    cell_id=cell_id,
                    param_values={p0.name: v0, p1.name: v1},
                    sharpe=sharpe,
                    total_return=round(-5 + ((seed >> 8 & 0xFF) / 255) * 50, 2),
                    max_drawdown=round(3 + ((seed >> 16 & 0xFF) / 255) * 20, 2),
                    trade_count=10 + (seed % 80),
                ))
                if sharpe > best_sharpe:
                    best_sharpe = sharpe
                    best_id = cell_id
                v1 += p1.step
            v0 += p0.step

    h = hashlib.sha256(f"{sweep_id}:{len(cells)}:{DEMO_TS}".encode()).hexdigest()[:16]
    return SweepResult(sweep_id=sweep_id, config=config, cells=cells, best_cell_id=best_id, hash=h)


def _generate_walk_forward(symbol: str, strategy_id: str) -> WalkForwardResult:
    wf_id = f"wf-{_fnv32(f'{symbol}:{strategy_id}:wf') & 0xFFFFFFFF:08x}"
    windows: List[WalkForwardWindow] = []

    for i in range(6):
        seed = _fnv32(f"{symbol}:{strategy_id}:wf:{i}")
        is_sharpe = round(0.8 + ((seed & 0xFF) / 255) * 2.0, 2)
        oos_sharpe = round(is_sharpe * (0.4 + ((seed >> 8 & 0xFF) / 255) * 0.5), 2)
        is_ret = round(5 + ((seed >> 16 & 0xFF) / 255) * 30, 2)
        oos_ret = round(is_ret * (0.3 + ((seed >> 24 & 0xFF) / 255) * 0.5), 2)
        month = i * 2
        windows.append(WalkForwardWindow(
            window_id=i + 1,
            train_start=f"2025-{1 + month:02d}-01",
            train_end=f"2025-{2 + month:02d}-28",
            test_start=f"2025-{3 + month:02d}-01",
            test_end=f"2025-{3 + month:02d}-28" if 3 + month <= 12 else f"2026-{3 + month - 12:02d}-28",
            in_sample_sharpe=is_sharpe,
            out_of_sample_sharpe=oos_sharpe,
            in_sample_return=is_ret,
            out_of_sample_return=oos_ret,
        ))

    agg_sharpe = round(sum(w.out_of_sample_sharpe for w in windows) / len(windows), 2)
    agg_return = round(sum(w.out_of_sample_return for w in windows) / len(windows), 2)
    avg_is = sum(w.in_sample_sharpe for w in windows) / len(windows)
    degradation = round((1 - agg_sharpe / avg_is) * 100, 1) if avg_is > 0 else 0

    h = hashlib.sha256(f"{wf_id}:{agg_sharpe}:{DEMO_TS}".encode()).hexdigest()[:16]
    return WalkForwardResult(
        wf_id=wf_id, symbol=symbol, strategy_id=strategy_id,
        windows=windows, aggregate_sharpe=agg_sharpe,
        aggregate_return=agg_return, oos_degradation=degradation, hash=h,
    )


def _generate_robustness(symbol: str, strategy_id: str) -> RobustnessResult:
    rob_id = f"rob-{_fnv32(f'{symbol}:{strategy_id}:rob') & 0xFFFFFFFF:08x}"
    labels = [
        ("Base Case", 1, 1, 0),
        ("2× Fees", 2, 1, 0),
        ("3× Fees", 3, 1, 0),
        ("2× Slippage", 1, 2, 0),
        ("3× Slippage", 1, 3, 0),
        ("100ms Delay", 1, 1, 100),
        ("200ms Delay", 1, 1, 200),
        ("Worst Case", 3, 3, 200),
    ]

    scenarios: List[RobustnessScenario] = []
    base_sharpe = 0.0
    for i, (label, fee_m, slip_m, delay) in enumerate(labels):
        seed = _fnv32(f"{symbol}:{strategy_id}:rob:{i}")
        sharpe = round(1.5 - fee_m * 0.15 - slip_m * 0.1 - delay * 0.002 + ((seed & 0xFF) / 255) * 0.5, 2)
        if i == 0:
            base_sharpe = sharpe
        scenarios.append(RobustnessScenario(
            scenario_id=f"rob-s{i}",
            label=label,
            fee_multiplier=float(fee_m),
            slippage_multiplier=float(slip_m),
            delay_ms=delay,
            sharpe=sharpe,
            total_return=round(sharpe * 8, 2),
            max_drawdown=round(5 + (3 - sharpe) * 3, 2),
            delta_sharpe=round(sharpe - base_sharpe, 2),
        ))

    positive = sum(1 for s in scenarios if s.sharpe > 0)
    score = int(positive / len(scenarios) * 100)
    h = hashlib.sha256(f"{rob_id}:{score}:{DEMO_TS}".encode()).hexdigest()[:16]

    return RobustnessResult(
        rob_id=rob_id, symbol=symbol, strategy_id=strategy_id,
        scenarios=scenarios, robustness_score=score, hash=h,
    )


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/sweeps", response_model=SweepResult)
def run_sweep(config: SweepConfig):
    return _generate_sweep(config)


@router.get("/sweeps/{sweep_id}", response_model=SweepResult)
def get_sweep(sweep_id: str, symbol: str = "AAPL", strategy_id: str = "strat-1"):
    config = SweepConfig(
        symbol=symbol, strategy_id=strategy_id,
        params=[SweepParam(name="sma_fast", min=5, max=25, step=5),
                SweepParam(name="sma_slow", min=20, max=60, step=10)],
    )
    return _generate_sweep(config)


@router.post("/walkforward", response_model=WalkForwardResult)
def run_walk_forward(symbol: str = "AAPL", strategy_id: str = "strat-1"):
    return _generate_walk_forward(symbol, strategy_id)


@router.post("/robustness", response_model=RobustnessResult)
def run_robustness(symbol: str = "AAPL", strategy_id: str = "strat-1"):
    return _generate_robustness(symbol, strategy_id)


@router.get("/hash")
def get_hash():
    return {"hash": hashlib.sha256(f"backtest-depth:{DEMO_TS}".encode()).hexdigest()[:16]}
