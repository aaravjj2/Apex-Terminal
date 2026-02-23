"""
Waves 21-50 — Backtest Engine v4 & Data Quality API Routes
Covers: canonical data, pipeline, corporate actions, symbol lifecycle, timeframe, quality,
        portfolio accounting, cost models, order engine, risk controls, event-driven engine,
        evaluation suite, strategy system, and Elasticsearch architecture.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v3/backtest", tags=["backtest-v4"])


# ── Pydantic Request / Response Models ──

class IngestRequest(BaseModel):
    symbol: str
    source: str = "yfinance"
    resolution: str = "1d"
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class QualityResponse(BaseModel):
    symbol: str
    score: float
    grade: str
    bar_count: int
    gaps: int
    completeness: float
    passed: bool

class BacktestRunRequest(BaseModel):
    symbols: List[str] = Field(default_factory=lambda: ["AAPL"])
    strategy_id: Optional[str] = None
    initial_capital: float = 100_000.0
    cost_model: str = "realistic"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    seed: int = 42

class SweepRequest(BaseModel):
    symbols: List[str] = Field(default_factory=lambda: ["AAPL"])
    params: List[Dict[str, Any]] = Field(default_factory=list)
    initial_capital: float = 100_000.0
    cost_model: str = "realistic"
    seed: int = 42

class WalkForwardRequest(BaseModel):
    symbols: List[str] = Field(default_factory=lambda: ["AAPL"])
    n_folds: int = 5
    initial_capital: float = 100_000.0
    cost_model: str = "realistic"
    seed: int = 42

class MonteCarloRequest(BaseModel):
    symbols: List[str] = Field(default_factory=lambda: ["AAPL"])
    n_paths: int = 1000
    initial_capital: float = 100_000.0
    cost_model: str = "realistic"
    seed: int = 42

class RobustnessRequest(BaseModel):
    symbols: List[str] = Field(default_factory=lambda: ["AAPL"])
    initial_capital: float = 100_000.0
    cost_model: str = "realistic"
    seed: int = 42

class CorporateActionRequest(BaseModel):
    symbol: str
    action_type: str  # split, dividend, etc.
    ex_date: str
    ratio: float = 1.0
    amount: float = 0.0

class StrategySpec(BaseModel):
    name: str = "Untitled"
    description: str = ""
    universe: List[str] = Field(default_factory=lambda: ["AAPL"])
    indicators: List[Dict[str, Any]] = Field(default_factory=list)
    signal_type: str = "crossover"
    position_size_pct: float = 0.10
    stop_loss_pct: Optional[float] = None
    take_profit_pct: Optional[float] = None

class AIAssistRequest(BaseModel):
    prompt: str
    max_tokens: int = 200

class CandidateRequest(BaseModel):
    base_spec: StrategySpec
    n_candidates: int = 5
    seed: int = 42

class JobSubmitRequest(BaseModel):
    symbols: List[str] = Field(default_factory=lambda: ["AAPL"])
    strategy_spec: Optional[StrategySpec] = None
    initial_capital: float = 100_000.0
    cost_model: str = "realistic"
    seed: int = 42


# ═══════════════════════════════════════════════════
# Wave 21-22: Canonical Data & Pipeline
# ═══════════════════════════════════════════════════

@router.post("/data/ingest")
async def ingest_data(req: IngestRequest):
    """Ingest market data for a symbol into the canonical pipeline."""
    from ...waves21_50.backtest.data_pipeline import get_pipeline, IngestionRequest as IR
    from ...waves21_50.backtest.canonical_schema import DataSource, BarResolution
    from datetime import date, timedelta

    pipeline = get_pipeline()
    try:
        source = DataSource(req.source)
    except ValueError:
        source = DataSource.YFINANCE

    try:
        resolution = BarResolution(req.resolution)
    except ValueError:
        resolution = BarResolution.DAILY

    # Default: 7-year depth
    end_date = req.end_date or date.today().isoformat()
    start_date = req.start_date or (date.fromisoformat(end_date) - timedelta(days=7 * 365)).isoformat()

    result = pipeline.ingest(IR(
        symbol=req.symbol.upper(),
        source=source,
        resolution=resolution,
        start_date=start_date,
        end_date=end_date,
    ))
    return result.to_dict()


@router.get("/data/health")
async def data_health():
    """Get data pipeline health status."""
    from ...waves21_50.backtest.data_pipeline import get_pipeline
    pipeline = get_pipeline()
    return pipeline.get_health()


@router.get("/data/symbols")
async def list_data_symbols():
    """List symbols in the data pipeline."""
    from ...waves21_50.backtest.data_pipeline import get_pipeline
    pipeline = get_pipeline()
    return {"symbols": pipeline.list_symbols()}


# ═══════════════════════════════════════════════════
# Wave 23: Corporate Actions
# ═══════════════════════════════════════════════════

@router.post("/corporate-actions")
async def add_corporate_action(req: CorporateActionRequest):
    """Register a corporate action."""
    from ...waves21_50.backtest.corporate_actions import get_corporate_actions, CorporateAction, ActionType
    registry = get_corporate_actions()
    try:
        action_type = ActionType(req.action_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown action type: {req.action_type}")

    action = CorporateAction(
        symbol=req.symbol.upper(),
        action_type=action_type,
        ex_date=req.ex_date,
        ratio=req.ratio,
        amount=req.amount,
    )
    registry.add_action(action)
    return {"status": "registered", "action": {"symbol": action.symbol, "type": action.action_type.value, "ex_date": action.ex_date}}


@router.get("/corporate-actions/{symbol}")
async def get_corp_actions(symbol: str):
    """Get corporate actions for a symbol."""
    from ...waves21_50.backtest.corporate_actions import get_corporate_actions
    registry = get_corporate_actions()
    actions = registry.get_actions(symbol.upper())
    return {"symbol": symbol.upper(), "actions": [{"type": a.action_type.value, "ex_date": a.ex_date, "ratio": a.ratio, "amount": a.amount} for a in actions]}


# ═══════════════════════════════════════════════════
# Wave 24: Symbol Lifecycle
# ═══════════════════════════════════════════════════

@router.get("/symbols/{symbol}/lifecycle")
async def symbol_lifecycle(symbol: str):
    """Check symbol lifecycle and tradability."""
    from ...waves21_50.backtest.symbol_lifecycle import get_symbol_registry
    registry = get_symbol_registry()
    meta = registry.get(symbol.upper())
    if not meta:
        return {"symbol": symbol.upper(), "registered": False, "tradable": False, "status": "unknown"}
    return {
        "symbol": meta.symbol,
        "registered": True,
        "tradable": registry.is_tradable(symbol.upper()),
        "status": meta.status.value,
        "ipo_date": meta.ipo_date,
        "delist_date": meta.delist_date,
        "sector": meta.sector,
        "exchange": meta.exchange,
    }


@router.get("/symbols/{symbol}/survivorship")
async def survivorship_check(symbol: str, start_date: str = "2020-01-01", end_date: str = "2024-12-31"):
    """Check for survivorship bias at a given date range."""
    from ...waves21_50.backtest.symbol_lifecycle import get_symbol_registry
    registry = get_symbol_registry()
    result = registry.survivorship_check([symbol.upper()], start_date, end_date)
    return result


# ═══════════════════════════════════════════════════
# Wave 26: Data Quality
# ═══════════════════════════════════════════════════

@router.get("/data/quality/{symbol}")
async def data_quality(symbol: str):
    """Get data quality report for a symbol."""
    from ...waves21_50.backtest.data_pipeline import get_pipeline
    from ...waves21_50.backtest.data_quality import score_quality
    pipeline = get_pipeline()
    series = pipeline._store.get(symbol.upper())
    if not series:
        return QualityResponse(symbol=symbol.upper(), score=0.0, grade="F", bar_count=0, gaps=0, completeness=0.0, passed=False).model_dump()

    report = score_quality(series)
    return QualityResponse(
        symbol=symbol.upper(),
        score=report.score,
        grade=report.grade,
        bar_count=report.bar_count,
        gaps=report.gap_count,
        completeness=report.completeness,
        passed=report.passed,
    ).model_dump()


# ═══════════════════════════════════════════════════
# Wave 27-28: Portfolio Accounting & Cost Models
# ═══════════════════════════════════════════════════

@router.get("/cost-models")
async def list_cost_models():
    """List available cost model presets."""
    from ...waves21_50.backtest.cost_models import list_cost_models
    return {"models": list_cost_models()}


@router.get("/cost-models/{name}")
async def get_cost_model(name: str):
    """Get a specific cost model config."""
    from ...waves21_50.backtest.cost_models import get_cost_model
    model = get_cost_model(name)
    if not model:
        raise HTTPException(status_code=404, detail=f"Cost model not found: {name}")
    return {
        "name": name,
        "commission_per_share": model.commission_per_share,
        "min_commission": model.min_commission,
        "max_commission_pct": model.max_commission_pct,
        "spread_bps": model.spread_bps,
        "sec_fee_per_dollar": model.sec_fee_per_dollar,
        "taf_fee_per_share": model.taf_fee_per_share,
    }


# ═══════════════════════════════════════════════════
# Wave 29: Order Engine
# ═══════════════════════════════════════════════════

@router.get("/order-types")
async def list_order_types():
    """List supported order types."""
    from ...waves21_50.backtest.order_engine import OrderType
    return {"order_types": [ot.value for ot in OrderType]}


# ═══════════════════════════════════════════════════
# Wave 30: Risk Controls
# ═══════════════════════════════════════════════════

@router.get("/risk-limits")
async def get_risk_limits():
    """Get current risk limit configuration."""
    from ...waves21_50.backtest.risk_controls import RiskLimits
    limits = RiskLimits()
    return {
        "max_position_pct": limits.max_position_pct,
        "max_portfolio_positions": limits.max_portfolio_positions,
        "max_drawdown_pct": limits.max_drawdown_pct,
        "max_daily_loss_pct": limits.max_daily_loss_pct,
        "max_order_size_shares": limits.max_order_size_shares,
        "min_cash_reserve_pct": limits.min_cash_reserve_pct,
    }


# ═══════════════════════════════════════════════════
# Waves 31-33: Event-Driven Engine
# ═══════════════════════════════════════════════════

@router.post("/run")
async def run_backtest_v4(req: BacktestRunRequest):
    """Run event-driven backtest v4."""
    from ...waves21_50.backtest.engine import get_engine, BacktestConfig
    from ...waves21_50.backtest.cost_models import get_cost_model

    # Validate cost model name exists
    cost_model = get_cost_model(req.cost_model)
    if not cost_model:
        raise HTTPException(status_code=400, detail=f"Unknown cost model: {req.cost_model}")

    engine = get_engine()
    config = BacktestConfig(
        symbols=req.symbols,
        initial_capital=req.initial_capital,
        cost_model=req.cost_model,   # pass the string name, engine resolves internally
        start_date=req.start_date,
        end_date=req.end_date,
        seed=req.seed,
    )
    result = engine.run(config)
    return result.to_dict()


@router.get("/runs")
async def list_backtest_runs():
    """List all backtest v4 runs."""
    from ...waves21_50.backtest.engine import get_engine
    engine = get_engine()
    return {"runs": engine.list_runs()}


@router.get("/runs/{run_id}")
async def get_backtest_run(run_id: str):
    """Get a specific backtest run."""
    from ...waves21_50.backtest.engine import get_engine
    engine = get_engine()
    result = engine.get_run(run_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Run not found: {run_id}")
    return result.to_dict()


@router.get("/runs/{run_id}/trace")
async def get_run_trace(run_id: str):
    """Get trace event DAG for a run."""
    from ...waves21_50.backtest.engine import get_engine
    engine = get_engine()
    trace = engine.get_trace(run_id)
    if trace is None:
        raise HTTPException(status_code=404, detail=f"Run not found: {run_id}")
    return {"run_id": run_id, "events": trace}


@router.get("/runs/{run_id}/explain")
async def explain_run(run_id: str):
    """Get explain view (decision chain) for a run."""
    from ...waves21_50.backtest.engine import get_engine
    engine = get_engine()
    explain = engine.get_explain(run_id)
    if explain is None:
        raise HTTPException(status_code=404, detail=f"Run not found: {run_id}")
    return {"run_id": run_id, "explain": explain}


# ═══════════════════════════════════════════════════
# Wave 34: Parameter Sweep
# ═══════════════════════════════════════════════════

@router.post("/sweep")
async def run_sweep(req: SweepRequest):
    """Run parameter sweep grid search."""
    from ...waves21_50.backtest.evaluation import run_sweep, SweepParam

    sweep_params = [SweepParam(name=p.get("name", ""), values=p.get("values", [])) for p in req.params]
    if not sweep_params:
        sweep_params = [
            SweepParam(name="fast_period", values=[5, 10, 15, 20]),
            SweepParam(name="slow_period", values=[30, 40, 50]),
        ]

    result = run_sweep(
        symbols=req.symbols,
        params=sweep_params,
        initial_capital=req.initial_capital,
        cost_model_name=req.cost_model,
        seed=req.seed,
    )
    return result.to_dict()


# ═══════════════════════════════════════════════════
# Wave 35: Walk-Forward Analysis
# ═══════════════════════════════════════════════════

@router.post("/walk-forward")
async def run_walk_forward(req: WalkForwardRequest):
    """Run walk-forward analysis."""
    from ...waves21_50.backtest.evaluation import run_walk_forward
    result = run_walk_forward(
        symbols=req.symbols,
        n_folds=req.n_folds,
        initial_capital=req.initial_capital,
        cost_model_name=req.cost_model,
        seed=req.seed,
    )
    return result.to_dict()


# ═══════════════════════════════════════════════════
# Wave 36: Robustness / Stress Testing
# ═══════════════════════════════════════════════════

@router.post("/robustness")
async def run_robustness(req: RobustnessRequest):
    """Run robustness stress tests."""
    from ...waves21_50.backtest.evaluation import run_robustness
    result = run_robustness(
        symbols=req.symbols,
        initial_capital=req.initial_capital,
        cost_model_name=req.cost_model,
        seed=req.seed,
    )
    return result.to_dict()


# ═══════════════════════════════════════════════════
# Wave 37: Overfit Detection
# ═══════════════════════════════════════════════════

@router.post("/overfit")
async def check_overfit(req: SweepRequest):
    """Calculate overfit penalty metrics."""
    from ...waves21_50.backtest.evaluation import run_sweep, calculate_overfit_penalty, SweepParam
    sweep_params = [SweepParam(name=p.get("name", ""), values=p.get("values", [])) for p in req.params]
    if not sweep_params:
        sweep_params = [
            SweepParam(name="fast_period", values=[5, 10, 15, 20]),
            SweepParam(name="slow_period", values=[30, 40, 50]),
        ]
    sweep = run_sweep(symbols=req.symbols, params=sweep_params, initial_capital=req.initial_capital, cost_model_name=req.cost_model, seed=req.seed)
    result = calculate_overfit_penalty(sweep)
    return result.to_dict()


# ═══════════════════════════════════════════════════
# Wave 38: Benchmark Comparison
# ═══════════════════════════════════════════════════

@router.post("/benchmark")
async def calculate_benchmark(req: BacktestRunRequest):
    """Calculate benchmark comparison metrics (alpha, beta, IR)."""
    from ...waves21_50.backtest.evaluation import calculate_benchmark
    from ...waves21_50.backtest.engine import get_engine, BacktestConfig
    from ...waves21_50.backtest.cost_models import get_cost_model

    engine = get_engine()
    cost_model = get_cost_model(req.cost_model)
    if not cost_model:
        raise HTTPException(status_code=400, detail=f"Unknown cost model: {req.cost_model}")
    config = BacktestConfig(symbols=req.symbols, initial_capital=req.initial_capital, cost_model=cost_model, seed=req.seed)
    result = engine.run(config)

    bm = calculate_benchmark(result)
    return bm.to_dict()


# ═══════════════════════════════════════════════════
# Wave 39: Monte Carlo
# ═══════════════════════════════════════════════════

@router.post("/monte-carlo-v2")
async def run_monte_carlo_v2(req: MonteCarloRequest):
    """Run Monte Carlo simulation on backtest results."""
    from ...waves21_50.backtest.evaluation import run_monte_carlo
    from ...waves21_50.backtest.engine import get_engine, BacktestConfig
    from ...waves21_50.backtest.cost_models import get_cost_model

    engine = get_engine()
    cost_model = get_cost_model(req.cost_model)
    if not cost_model:
        raise HTTPException(status_code=400, detail=f"Unknown cost model: {req.cost_model}")
    config = BacktestConfig(symbols=req.symbols, initial_capital=req.initial_capital, cost_model=cost_model, seed=req.seed)
    result = engine.run(config)

    mc = run_monte_carlo(result, n_paths=req.n_paths, seed=req.seed)
    return mc.to_dict()


# ═══════════════════════════════════════════════════
# Wave 40: Portfolio Selection
# ═══════════════════════════════════════════════════

@router.post("/portfolio-select")
async def portfolio_select(req: BacktestRunRequest):
    """Run portfolio selection across symbols."""
    from ...waves21_50.backtest.evaluation import select_portfolio
    from ...waves21_50.backtest.engine import get_engine, BacktestConfig, BacktestResult
    from ...waves21_50.backtest.cost_models import get_cost_model

    engine = get_engine()
    cost_model = get_cost_model(req.cost_model)
    if not cost_model:
        raise HTTPException(status_code=400, detail=f"Unknown cost model: {req.cost_model}")

    results = []
    for symbol in req.symbols:
        config = BacktestConfig(symbols=[symbol], initial_capital=req.initial_capital, cost_model=cost_model, seed=req.seed)
        result = engine.run(config)
        results.append(result)

    selection = select_portfolio(results)
    return selection.to_dict()


# ═══════════════════════════════════════════════════
# Waves 41-43: Strategy System
# ═══════════════════════════════════════════════════

@router.post("/strategy/validate")
async def validate_strategy(spec: StrategySpec):
    """Validate a strategy specification."""
    from ...waves21_50.strategy.strategy_system import StrategySpecV2
    s = StrategySpecV2(
        name=spec.name,
        description=spec.description,
        universe=spec.universe,
        indicators=[],
        signal_type=spec.signal_type,
        position_size_pct=spec.position_size_pct,
        stop_loss_pct=spec.stop_loss_pct,
        take_profit_pct=spec.take_profit_pct,
    )
    errors = s.validate()
    warnings = s.lint()
    return {"valid": len(errors) == 0, "errors": errors, "warnings": warnings, "spec_hash": s.spec_hash}


@router.post("/strategy/ai-assist")
async def ai_assist(req: AIAssistRequest):
    """Parse natural language into a strategy spec."""
    from ...waves21_50.strategy.strategy_system import ai_assist_parse
    result = ai_assist_parse(req.prompt)
    return result


@router.post("/strategy/candidates")
async def generate_candidates(req: CandidateRequest):
    """Generate mutated strategy candidates."""
    from ...waves21_50.strategy.strategy_system import StrategySpecV2, generate_candidates

    base = StrategySpecV2(
        name=req.base_spec.name,
        description=req.base_spec.description,
        universe=req.base_spec.universe,
        indicators=[],
        signal_type=req.base_spec.signal_type,
        position_size_pct=req.base_spec.position_size_pct,
        stop_loss_pct=req.base_spec.stop_loss_pct,
        take_profit_pct=req.base_spec.take_profit_pct,
    )
    candidates = generate_candidates(base, n=req.n_candidates, seed=req.seed)
    return {"candidates": [c.to_dict() for c in candidates]}


# ═══════════════════════════════════════════════════
# Waves 44-45: Job Queue
# ═══════════════════════════════════════════════════

@router.post("/jobs/submit")
async def submit_job(req: JobSubmitRequest):
    """Submit a backtest job to the queue."""
    from ...waves21_50.strategy.strategy_system import get_job_queue
    queue = get_job_queue()
    job = queue.submit(config={"symbols": req.symbols, "initial_capital": req.initial_capital, "cost_model": req.cost_model, "seed": req.seed})
    return {"job_id": job.job_id, "status": job.status.value}


@router.get("/jobs")
async def list_jobs():
    """List all jobs."""
    from ...waves21_50.strategy.strategy_system import get_job_queue
    queue = get_job_queue()
    return {"jobs": [j.to_dict() for j in queue.list_jobs()]}


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    """Get job status."""
    from ...waves21_50.strategy.strategy_system import get_job_queue
    queue = get_job_queue()
    job = queue.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
    return job.to_dict()


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str):
    """Cancel a pending job."""
    from ...waves21_50.strategy.strategy_system import get_job_queue
    queue = get_job_queue()
    ok = queue.cancel(job_id)
    if not ok:
        raise HTTPException(status_code=404, detail=f"Job not found or not cancellable: {job_id}")
    return {"status": "cancelled", "job_id": job_id}
