"""
Unified Run Ledger API endpoint (A1).
Merges Risk Desk runs and Backtest runs into a single ledger.
"""
from fastapi import APIRouter, Query
from typing import Optional, List
from datetime import datetime, timedelta
import hashlib

router = APIRouter()


@router.get("/api/unified-runs")
async def get_unified_runs(
    run_type: Optional[str] = Query(None, description="Filter: risk|backtest|all"),
    date_filter: Optional[str] = Query(None, description="Filter: today|7d|30d|all"),
    search: Optional[str] = Query(None, description="Search by run_id or symbol"),
):
    """Return merged list of Risk + Backtest runs for the unified ledger."""
    from ..backtest_engine.engine import BacktestEngine
    
    runs = []
    engine = BacktestEngine()
    
    # --- Backtest Runs ---
    if run_type in (None, "all", "backtest"):
        try:
            bt_runs = engine.list_runs()
            for r in bt_runs:
                strategy_name = r.get("config", {}).get("strategy_id", "unknown")
                metrics = r.get("metrics", {}) or {}
                status = "success" if r.get("status") == "completed" else "error"
                created = r.get("started_at") or r.get("completed_at") or datetime.utcnow().isoformat()
                det_hash = r.get("config_hash", r.get("run_id", "")[:12])
                
                runs.append({
                    "run_type": "backtest",
                    "run_id": r["run_id"],
                    "created_at": created,
                    "scenario_or_strategy": strategy_name,
                    "determinism_hash": det_hash,
                    "key_metrics": {
                        "total_return_pct": metrics.get("total_return_pct"),
                        "max_drawdown_pct": metrics.get("max_drawdown_pct"),
                        "sharpe_ratio": metrics.get("sharpe_ratio"),
                    },
                    "status": status,
                })
        except Exception:
            pass
    
    # --- Risk Desk Runs ---
    if run_type in (None, "all", "risk"):
        try:
            from .risk_desk import _run_store
            for run_id, rr in _run_store.items():
                # rr is a RiskRunResult pydantic model or dict
                rr_dict = rr.dict() if hasattr(rr, 'dict') else (rr.model_dump() if hasattr(rr, 'model_dump') else rr)
                stress = rr_dict.get("stress", {}) or {}
                total_pnl = stress.get("total_pnl") if isinstance(stress, dict) else None
                scenario_label = "unknown"
                if isinstance(stress, dict):
                    scenario = stress.get("scenario", {})
                    if isinstance(scenario, dict):
                        scenario_label = scenario.get("label", "unknown")
                    elif isinstance(scenario, str):
                        scenario_label = scenario
                compliance = rr_dict.get("compliance", {}) or {}
                comp_status = compliance.get("status", "pass") if isinstance(compliance, dict) else "pass"
                ok = rr_dict.get("ok", True)
                status = "blocked" if comp_status == "fail" else ("success" if ok else "error")
                created = rr_dict.get("created_at", datetime.utcnow().isoformat())
                det_hash = hashlib.md5(run_id.encode()).hexdigest()[:12]
                
                runs.append({
                    "run_type": "risk",
                    "run_id": run_id,
                    "created_at": created,
                    "scenario_or_strategy": scenario_label,
                    "determinism_hash": det_hash,
                    "key_metrics": {
                        "worst_case_pnl": total_pnl,
                        "max_loss": total_pnl,
                    },
                    "status": status,
                })
        except Exception:
            pass
    
    # --- Date Filter ---
    if date_filter and date_filter != "all":
        now = datetime.utcnow()
        if date_filter == "today":
            cutoff = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif date_filter == "7d":
            cutoff = now - timedelta(days=7)
        elif date_filter == "30d":
            cutoff = now - timedelta(days=30)
        else:
            cutoff = None
        
        if cutoff:
            filtered = []
            for r in runs:
                try:
                    ts = datetime.fromisoformat(r["created_at"].replace("Z", "+00:00").replace("+00:00", ""))
                    if ts >= cutoff:
                        filtered.append(r)
                except Exception:
                    filtered.append(r)  # keep if can't parse
            runs = filtered
    
    # --- Search Filter ---
    if search:
        s = search.lower()
        runs = [r for r in runs if s in r["run_id"].lower() or s in r.get("scenario_or_strategy", "").lower()]
    
    # Sort by created_at desc
    runs.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    
    return runs
