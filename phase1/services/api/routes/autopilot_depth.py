"""
Autopilot Depth Routes — Risk Controls, Execution Model, Evaluation Attribution
Pure deterministic demo endpoints for the Core Depth Upgrade.
"""
import hashlib
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/ui2/autopilot-depth")

DEMO_TS = "2026-02-15T14:30:00Z"


def _fnv32(s: str) -> int:
    h = 0x811C9DC5
    for c in s:
        h ^= ord(c)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


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


@router.get("/runs/{run_id}/evaluation", response_model=RunEvaluation)
def get_evaluation(run_id: str):
    seed = _fnv32(f"{run_id}:eval:{DEMO_TS}")
    symbols = ["AAPL", "NVDA", "SPY", "MSFT"]
    strategies = ["momentum", "mean-rev", "breakout", "pairs"]

    attribution = []
    total_fees = 0.0
    total_slippage = 0.0
    for i, sym in enumerate(symbols):
        s = _fnv32(f"{seed}:attr:{i}")
        gross = round(((s % 200) - 80) * 10, 2)
        fee = round(_exec.fee_per_order + (abs(gross) * _exec.bps_fee / 10000), 2)
        slip = round(abs(gross) * _exec.slippage_base_bps / 10000, 2)
        attribution.append(EvalAttribution(
            leg_id=f"leg-{s & 0xFFFF:04x}",
            symbol=sym,
            strategy=strategies[i % len(strategies)],
            gross_pnl=gross,
            fees=fee,
            slippage=slip,
            net_pnl=round(gross - fee - slip, 2),
        ))
        total_fees += fee
        total_slippage += slip

    fills = []
    for i in range(6):
        s = _fnv32(f"{seed}:fill:{i}")
        fills.append(FillRecord(
            fill_id=f"fill-{s & 0xFFFF:04x}",
            symbol=symbols[i % len(symbols)],
            side="buy" if s % 2 == 0 else "sell",
            qty=10 + (s % 90),
            price=round(100 + (s % 400), 2),
            fee=round(_exec.fee_per_order, 2),
            slippage_bps=round(_exec.slippage_base_bps + (s % 3) * 0.5, 1),
            ts=DEMO_TS,
        ))

    expected = round(sum(a.gross_pnl for a in attribution), 2)
    realized = round(expected - total_fees - total_slippage, 2)

    budget = [
        RiskBudget(label="Position", limit=_risk.max_position_notional,
                   used=round(_risk.max_position_notional * 0.6, 2),
                   remaining=round(_risk.max_position_notional * 0.4, 2)),
        RiskBudget(label="Gross Exposure", limit=_risk.max_gross_exposure,
                   used=round(_risk.max_gross_exposure * 0.45, 2),
                   remaining=round(_risk.max_gross_exposure * 0.55, 2)),
        RiskBudget(label="Daily Loss", limit=_risk.max_daily_loss,
                   used=round(abs(min(realized, 0)), 2),
                   remaining=round(_risk.max_daily_loss - abs(min(realized, 0)), 2)),
        RiskBudget(label="Trades", limit=float(_risk.max_trades_per_run),
                   used=float(len(fills)),
                   remaining=float(_risk.max_trades_per_run - len(fills))),
    ]

    breaches = []
    if abs(realized) > _risk.max_daily_loss * 0.8:
        breaches.append(RiskBreach(
            ts=DEMO_TS, rule="daily_loss_warning",
            value=round(abs(realized), 2), limit=_risk.max_daily_loss,
        ))

    hash_str = hashlib.sha256(f"{run_id}:{expected}:{realized}:{DEMO_TS}".encode()).hexdigest()[:16]

    return RunEvaluation(
        run_id=run_id,
        expected_pnl=expected,
        realized_pnl=realized,
        total_fees=round(total_fees, 2),
        total_slippage=round(total_slippage, 2),
        attribution=attribution,
        fills=fills,
        risk_budget_remaining=budget,
        breaches=breaches,
        hash=hash_str,
    )


@router.get("/hash")
def get_hash():
    return {"hash": hashlib.sha256(f"autopilot-depth:{DEMO_TS}".encode()).hexdigest()[:16]}
