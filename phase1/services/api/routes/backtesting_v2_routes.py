"""
backtesting_routes.py — Backtesting Engine REST API
=====================================================
Strategy signals, position sizing, commissions, slippage, backtest execution,
performance analytics, benchmark comparison, walk-forward, Monte Carlo, multi-strategy.

Endpoints:
    POST /api/v2/backtest/run                → Run full backtest
    POST /api/v2/backtest/signals            → Generate strategy signals
    POST /api/v2/backtest/walk-forward       → Walk-forward analysis
    POST /api/v2/backtest/monte-carlo        → Monte Carlo simulation
    POST /api/v2/backtest/multi-strategy     → Multi-strategy comparison
    POST /api/v2/backtest/benchmark          → Benchmark comparison
    GET  /api/v2/backtest/capabilities       → Engine capabilities
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from phase1.services.backtesting_engine import (
    BacktestEngine, StrategySignalGenerator, PerformanceAnalytics,
    BenchmarkComparison, WalkForwardAnalyzer, MonteCarloSimulator,
    MultiStrategyBacktester,
)

router = APIRouter(prefix="/api/v2/backtest", tags=["Backtesting v2"])


# ─── Pydantic Models ────────────────────────────────────────────────────────

class BarData(BaseModel):
    open: float
    high: float
    low: float
    close: float
    volume: float = 0

class BacktestRequest(BaseModel):
    bars: List[BarData]
    strategy: str = "sma_crossover"
    strategy_params: Dict[str, Any] = Field(default_factory=dict)
    initial_capital: float = 100000
    commission_per_share: float = 0.005
    slippage_pct: float = 0.001
    risk_per_trade: float = 0.02

class SignalRequest(BaseModel):
    closes: List[float]
    strategy: str = "sma_crossover"
    params: Dict[str, Any] = Field(default_factory=dict)

class WalkForwardRequest(BaseModel):
    bars: List[BarData]
    strategy: str = "sma_crossover"
    n_splits: int = 5
    train_pct: float = 0.7

class MonteCarloRequest(BaseModel):
    trade_returns: List[float]
    n_simulations: int = 1000
    n_trades: int = 100

class MultiStrategyRequest(BaseModel):
    bars: List[BarData]
    strategies: List[str] = Field(default_factory=lambda: ["sma_crossover", "rsi_reversal"])
    initial_capital: float = 100000

class BenchmarkRequest(BaseModel):
    strategy_returns: List[float]
    benchmark_returns: List[float]


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/run")
def run_backtest(req: BacktestRequest):
    bars = [(b.open, b.high, b.low, b.close, b.volume) for b in req.bars]
    engine = BacktestEngine(
        initial_capital=req.initial_capital,
        commission_per_share=req.commission_per_share,
        slippage_pct=req.slippage_pct,
        risk_per_trade=req.risk_per_trade,
    )
    closes = [b.close for b in req.bars]
    gen = StrategySignalGenerator()
    signals = gen.generate(closes, req.strategy, req.strategy_params)
    result = engine.run(bars, signals)
    return {"ok": True, "result": result}


@router.post("/signals")
def generate_signals(req: SignalRequest):
    gen = StrategySignalGenerator()
    signals = gen.generate(req.closes, req.strategy, req.params)
    return {"ok": True, "signals": signals}


@router.post("/walk-forward")
def walk_forward(req: WalkForwardRequest):
    bars = [(b.open, b.high, b.low, b.close, b.volume) for b in req.bars]
    wf = WalkForwardAnalyzer()
    result = wf.analyze(bars, req.strategy, req.n_splits, req.train_pct)
    return {"ok": True, "result": result}


@router.post("/monte-carlo")
def monte_carlo(req: MonteCarloRequest):
    mc = MonteCarloSimulator()
    result = mc.simulate(req.trade_returns, req.n_simulations, req.n_trades)
    return {"ok": True, "result": result}


@router.post("/multi-strategy")
def multi_strategy(req: MultiStrategyRequest):
    bars = [(b.open, b.high, b.low, b.close, b.volume) for b in req.bars]
    ms = MultiStrategyBacktester()
    result = ms.compare(bars, req.strategies, req.initial_capital)
    return {"ok": True, "result": result}


@router.post("/benchmark")
def benchmark_compare(req: BenchmarkRequest):
    bc = BenchmarkComparison()
    result = bc.compare(req.strategy_returns, req.benchmark_returns)
    return {"ok": True, "result": result}


@router.get("/capabilities")
def capabilities():
    return {
        "ok": True,
        "engine": "BacktestEngine",
        "version": "2.0.0",
        "strategies": [
            "sma_crossover", "ema_crossover", "rsi_reversal", "macd_crossover",
            "bollinger_breakout", "mean_reversion", "momentum", "channel_breakout",
        ],
        "features": [
            "Full backtest engine with commissions/slippage",
            "8 built-in strategies",
            "Walk-forward analysis",
            "Monte Carlo simulation",
            "Multi-strategy comparison",
            "Benchmark comparison",
            "Performance analytics (Sharpe, Sortino, max DD, etc.)",
        ],
    }
