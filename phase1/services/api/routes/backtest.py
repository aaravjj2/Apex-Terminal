"""
Backtest API Router
"""

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
from typing import List, Optional
import json
import io
import zipfile

from ...backtest_engine.models import (
    BacktestConfig, BacktestRun, CompareResult, BacktestMetrics
)
from ...backtest_engine.engine import get_engine
from ...backtest_engine.storage import get_storage
from ...backtest_engine.report_generator import generate_html_report, generate_readme_txt

router = APIRouter(prefix="/api/backtest", tags=["Backtest"])


@router.post("/run", response_model=BacktestRun)
async def run_backtest(config: BacktestConfig):
    """
    Run a backtest with given configuration.
    Returns complete backtest results.
    """
    engine = get_engine()
    storage = get_storage()
    
    try:
        # Run backtest
        run = engine.run_backtest(config)
        
        # Save run
        storage.save(run)
        
        return run
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backtest failed: {str(e)}")


@router.get("/runs", response_model=List[BacktestRun])
async def list_runs(strategy_id: Optional[str] = None):
    """
    List all backtest runs.
    Optionally filter by strategy_id.
    """
    storage = get_storage()
    runs = storage.list(strategy_id=strategy_id)
    return runs


@router.get("/run/{run_id}", response_model=BacktestRun)
async def get_run(run_id: str):
    """Get a single backtest run by ID"""
    storage = get_storage()
    run = storage.get(run_id)
    
    if not run:
        raise HTTPException(status_code=404, detail=f"Run not found: {run_id}")
    
    return run


@router.get("/run/{run_id}/artifacts")
async def download_artifacts(run_id: str):
    """
    Download complete backtest report bundle as a ZIP.
    Includes: run.json, trades.csv, equity_curve.csv, metrics.json, report.html, README.txt
    """
    storage = get_storage()
    run = storage.get(run_id)
    
    if not run:
        raise HTTPException(status_code=404, detail=f"Run not found: {run_id}")
    
    # Create ZIP in memory
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # run.json
        run_json = run.model_dump_json(indent=2)
        zipf.writestr(f"{run_id}/run.json", run_json)
        
        # trades.csv
        if run.trades:
            csv_lines = ["trade_id,timestamp,symbol,side,quantity,price,fees,pnl"]
            for trade in run.trades:
                pnl_str = f"{trade.pnl:.2f}" if trade.pnl is not None else ""
                csv_lines.append(
                    f"{trade.trade_id},{trade.timestamp.isoformat()},"
                    f"{trade.symbol},{trade.side},{trade.quantity},"
                    f"{trade.price},{trade.fees},{pnl_str}"
                )
            zipf.writestr(f"{run_id}/trades.csv", "\n".join(csv_lines))
        
        # equity_curve.csv
        if run.equity_curve:
            csv_lines = ["timestamp,equity"]
            for point in run.equity_curve:
                csv_lines.append(f"{point.timestamp.isoformat()},{point.equity:.2f}")
            zipf.writestr(f"{run_id}/equity_curve.csv", "\n".join(csv_lines))
        
        # metrics.json
        if run.metrics:
            metrics_json = run.metrics.model_dump_json(indent=2)
            zipf.writestr(f"{run_id}/metrics.json", metrics_json)
        
        # report.html (NEW)
        try:
            report_html = generate_html_report(run)
            zipf.writestr(f"{run_id}/report.html", report_html)
        except Exception as e:
            # Add error placeholder if report generation fails
            zipf.writestr(f"{run_id}/report.html", f"<html><body><h1>Error generating report</h1><p>{str(e)}</p></body></html>")
        
        # README.txt (NEW)
        try:
            readme = generate_readme_txt(run)
            zipf.writestr(f"{run_id}/README.txt", readme)
        except Exception as e:
            zipf.writestr(f"{run_id}/README.txt", f"Error generating README: {str(e)}")
    
    # Return ZIP as downloadable file
    zip_buffer.seek(0)
    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename={run_id}_report_bundle.zip"
        }
    )


class CompareRequest(BaseModel):
    """Request to compare two runs"""
    run_id_a: str
    run_id_b: str


@router.post("/compare", response_model=CompareResult)
async def compare_runs(request: CompareRequest):
    """
    Compare two backtest runs.
    Returns metrics for both runs and delta.
    """
    storage = get_storage()
    
    run_a = storage.get(request.run_id_a)
    run_b = storage.get(request.run_id_b)
    
    if not run_a:
        raise HTTPException(status_code=404, detail=f"Run not found: {request.run_id_a}")
    if not run_b:
        raise HTTPException(status_code=404, detail=f"Run not found: {request.run_id_b}")
    
    if not run_a.metrics or not run_b.metrics:
        raise HTTPException(status_code=400, detail="Both runs must have metrics")
    
    # Calculate deltas
    metrics_a = run_a.metrics
    metrics_b = run_b.metrics
    
    delta = {
        "total_return_pct": metrics_b.total_return_pct - metrics_a.total_return_pct,
        "cagr_pct": metrics_b.cagr_pct - metrics_a.cagr_pct,
        "max_drawdown_pct": metrics_b.max_drawdown_pct - metrics_a.max_drawdown_pct,
        "sharpe_ratio": metrics_b.sharpe_ratio - metrics_a.sharpe_ratio,
        "win_rate_pct": metrics_b.win_rate_pct - metrics_a.win_rate_pct,
        "total_trades": metrics_b.total_trades - metrics_a.total_trades,
        "profit_factor": metrics_b.profit_factor - metrics_a.profit_factor,
    }
    
    return CompareResult(
        run_id_a=request.run_id_a,
        run_id_b=request.run_id_b,
        metrics_a=metrics_a,
        metrics_b=metrics_b,
        delta=delta
    )
