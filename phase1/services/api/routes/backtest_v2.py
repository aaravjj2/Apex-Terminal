"""
Backtest API Router v2 — Production-grade backtesting endpoints.

Endpoints:
  POST /api/backtest/run           — Run a backtest
  GET  /api/backtest/runs          — List all runs
  GET  /api/backtest/run/{run_id}  — Get a single run
  GET  /api/backtest/run/{run_id}/artifacts — Download report ZIP
  POST /api/backtest/compare       — Compare two runs
  GET  /api/backtest/strategies    — List available strategies
  GET  /api/backtest/data/health   — Data health for symbol(s)
  POST /api/backtest/data/prime    — Prime data for symbol(s)
"""

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field
from typing import List, Optional
import json
import io
import uuid
import zipfile

from ...backtest_engine.models import (
    BacktestConfig, BacktestRun, CompareResult, BacktestMetrics,
)
from ...backtest_engine.engine_v2 import get_engine_v2, get_builtin_strategies, get_strategy
from ...backtest_engine.storage import get_storage
from ...backtest_engine.data_pipeline import (
    get_symbol_health, prime_symbol, prime_universe, load_bars, DEFAULT_UNIVERSE,
)
from ...market_data.models import SymbolHealth

try:
    from ...backtest_engine.report_generator import generate_html_report, generate_readme_txt
except ImportError:
    generate_html_report = None  # type: ignore
    generate_readme_txt = None  # type: ignore

try:
    from ...strategy_lab.export_bundler import build_strategy_bundle_manifest, build_hash_ledger
except ImportError:
    build_strategy_bundle_manifest = None  # type: ignore
    build_hash_ledger = None  # type: ignore

router = APIRouter(prefix="/api/backtest", tags=["Backtest"])


# ── Run endpoints ────────────────────────────────────────────────────────────

@router.post("/run", response_model=BacktestRun)
async def run_backtest(config: BacktestConfig):
    """Run a backtest with real market data."""
    engine = get_engine_v2()
    storage = get_storage()

    try:
        run = engine.run(config)
        storage.save(run)
        return run
    except ValueError as e:
        raise HTTPException(status_code=400, detail={
            "error": str(e),
            "correlation_id": f"bt-err-{uuid.uuid4().hex[:8]}",
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail={
            "error": f"Backtest failed: {str(e)}",
            "correlation_id": f"bt-err-{uuid.uuid4().hex[:8]}",
        })


@router.get("/runs", response_model=List[BacktestRun])
async def list_runs(strategy_id: Optional[str] = None):
    """List all backtest runs, optionally filtered by strategy."""
    storage = get_storage()
    return storage.list(strategy_id=strategy_id)


@router.get("/run/{run_id}", response_model=BacktestRun)
async def get_run(run_id: str):
    """Get a single backtest run by ID."""
    storage = get_storage()
    run = storage.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run not found: {run_id}")
    return run


@router.get("/run/{run_id}/artifacts")
async def download_artifacts(run_id: str):
    """Download backtest report bundle as ZIP."""
    storage = get_storage()
    run = storage.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run not found: {run_id}")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"{run_id}/run.json", run.model_dump_json(indent=2))

        if run.trades:
            lines = ["trade_id,timestamp,symbol,side,quantity,price,fees,pnl"]
            for t in run.trades:
                pnl = f"{t.pnl:.2f}" if t.pnl is not None else ""
                lines.append(
                    f"{t.trade_id},{t.timestamp.isoformat()},{t.symbol},"
                    f"{t.side},{t.quantity},{t.price},{t.fees},{pnl}"
                )
            zf.writestr(f"{run_id}/trades.csv", "\n".join(lines))

        if run.equity_curve:
            lines = ["timestamp,equity"]
            for pt in run.equity_curve:
                lines.append(f"{pt.timestamp.isoformat()},{pt.equity:.2f}")
            zf.writestr(f"{run_id}/equity_curve.csv", "\n".join(lines))

        if run.drawdown_series:
            lines = ["timestamp,drawdown_pct"]
            for pt in run.drawdown_series:
                lines.append(f"{pt.timestamp.isoformat()},{pt.drawdown_pct:.4f}")
            zf.writestr(f"{run_id}/drawdown.csv", "\n".join(lines))

        if run.metrics:
            zf.writestr(f"{run_id}/metrics.json", run.metrics.model_dump_json(indent=2))

        if generate_html_report:
            try:
                zf.writestr(f"{run_id}/report.html", generate_html_report(run))
            except Exception:
                pass
        if generate_readme_txt:
            try:
                zf.writestr(f"{run_id}/README.txt", generate_readme_txt(run))
            except Exception:
                pass

        # Strategy + bundle manifests
        if build_strategy_bundle_manifest:
            try:
                manifest = build_strategy_bundle_manifest(
                    run_id=run_id, strategy_id=run.config.strategy_id,
                )
                if "strategy_spec" in manifest:
                    zf.writestr(
                        f"{run_id}/strategy/spec.json",
                        json.dumps(manifest["strategy_spec"], indent=2, sort_keys=True),
                    )
                zf.writestr(
                    f"{run_id}/manifest.json",
                    json.dumps(manifest, indent=2, sort_keys=True),
                )
            except Exception:
                pass

        if build_hash_ledger:
            try:
                ledger = build_hash_ledger(
                    run_id=run_id,
                    config_hash=run.config_hash,
                    bars_source_hash=run.provenance.checksum if run.provenance else None,
                    provenance_hash=run.provenance.checksum if run.provenance else None,
                )
                zf.writestr(
                    f"{run_id}/ledger.json",
                    json.dumps(ledger, indent=2, sort_keys=True),
                )
            except Exception:
                pass

    zip_buffer.seek(0)
    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={run_id}_bundle.zip"},
    )


# ── Compare ──────────────────────────────────────────────────────────────────

class CompareRequest(BaseModel):
    run_id_a: str
    run_id_b: str


@router.post("/compare", response_model=CompareResult)
async def compare_runs(req: CompareRequest):
    """Compare two backtest runs side-by-side."""
    storage = get_storage()
    a = storage.get(req.run_id_a)
    b = storage.get(req.run_id_b)
    if not a:
        raise HTTPException(404, f"Run not found: {req.run_id_a}")
    if not b:
        raise HTTPException(404, f"Run not found: {req.run_id_b}")
    if not a.metrics or not b.metrics:
        raise HTTPException(400, "Both runs must be completed with metrics")

    delta = {
        "total_return_pct": b.metrics.total_return_pct - a.metrics.total_return_pct,
        "cagr_pct": b.metrics.cagr_pct - a.metrics.cagr_pct,
        "max_drawdown_pct": b.metrics.max_drawdown_pct - a.metrics.max_drawdown_pct,
        "sharpe_ratio": b.metrics.sharpe_ratio - a.metrics.sharpe_ratio,
        "sortino_ratio": b.metrics.sortino_ratio - a.metrics.sortino_ratio,
        "win_rate_pct": b.metrics.win_rate_pct - a.metrics.win_rate_pct,
        "total_trades": b.metrics.total_trades - a.metrics.total_trades,
        "profit_factor": b.metrics.profit_factor - a.metrics.profit_factor,
    }

    return CompareResult(
        run_id_a=req.run_id_a,
        run_id_b=req.run_id_b,
        metrics_a=a.metrics,
        metrics_b=b.metrics,
        delta=delta,
    )


# ── Strategies ───────────────────────────────────────────────────────────────

class StrategyInfo(BaseModel):
    id: str
    name: str
    description: str = ""
    strategy_type: str
    tags: List[str] = Field(default_factory=list)


@router.get("/strategies", response_model=List[StrategyInfo])
async def list_strategies():
    """List all available backtesting strategies."""
    strats = get_builtin_strategies()
    return [
        StrategyInfo(
            id=s.id or k,
            name=s.name,
            description=s.description or "",
            strategy_type=s.strategy_type,
            tags=s.tags,
        )
        for k, s in strats.items()
    ]


# ── Data Health ──────────────────────────────────────────────────────────────

@router.get("/data/health", response_model=List[SymbolHealth])
async def data_health(symbol: Optional[str] = None):
    """
    Get data coverage health.
    If symbol is given, return health for that symbol.
    Otherwise return health for all symbols in the universe.
    """
    if symbol:
        return [get_symbol_health(symbol)]
    return [get_symbol_health(s) for s in DEFAULT_UNIVERSE]


class PrimeRequest(BaseModel):
    symbols: Optional[List[str]] = None
    years: int = 7


@router.post("/data/prime")
async def prime_data(req: PrimeRequest):
    """
    Prime (download + persist) market data for backtesting.
    Returns per-symbol status.
    """
    try:
        results = prime_universe(req.symbols, req.years)
        return {"status": "ok", "results": results}
    except Exception as e:
        raise HTTPException(500, {
            "error": str(e),
            "correlation_id": f"prime-err-{uuid.uuid4().hex[:8]}",
        })
