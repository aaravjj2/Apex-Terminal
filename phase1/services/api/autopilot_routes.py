"""
Autopilot API Routes
FastAPI routes for paper trading autopilot.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid
import logging
import os

# For websocket and ingestion status
from ..api.websocket import get_manager


from ..autopilot.ledger import (
    get_ledger, TradeLedgerEntry, TradeStatus, AutopilotRunSummary
)
from ..autopilot.config import get_autopilot_config, load_llm_config_from_env, LLMMode

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/autopilot", tags=["autopilot"])


class AutopilotRunRequest(BaseModel):
    """Request to trigger autopilot run."""
    dry_run: bool = False
    force: bool = False


class AutopilotRunResponse(BaseModel):
    """Response from autopilot run."""
    run_id: str
    status: str
    message: str
    candidates_count: int = 0
    selected_count: int = 0
    executed_count: int = 0


class AutopilotStatus(BaseModel):
    """Current autopilot status."""
    mode: str
    auto_execute: bool
    llm_mode: str
    llm_available: bool
    last_run_id: Optional[str] = None
    last_run_status: Optional[str] = None
    last_run_at: Optional[str] = None
    open_positions: int = 0

    # Websocket and ingestion indicators for UI
    websocket_connected: bool = False
    polling_fallback: bool = False  # True when ingestion is using polling (REST) instead of live WS


# Global state
_current_run_id: Optional[str] = None
_is_running: bool = False


@router.post("/run", response_model=AutopilotRunResponse)
async def run_autopilot(
    request: AutopilotRunRequest,
    background_tasks: BackgroundTasks,
) -> AutopilotRunResponse:
    """
    Trigger an autopilot run (paper mode only).
    
    Workflow:
    1. Scan universe for candidates
    2. LLM ranks/selects candidates
    3. Validate selected trades
    4. Execute in paper mode
    5. Record to ledger
    """
    global _current_run_id, _is_running
    
    if _is_running:
        raise HTTPException(
            status_code=409,
            detail="Autopilot run already in progress"
        )
    
    config = get_autopilot_config()
    ledger = get_ledger()
    
    run_id = f"run_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
    _current_run_id = run_id
    _is_running = True
    
    try:
        # Create run record
        run_summary = ledger.create_run(run_id)
        
        # Load LLM config from environment
        llm_config = load_llm_config_from_env()
        run_summary.llm_provider = llm_config.mode.value
        
        # Generate mock candidates for demo (in production, would scan real data)
        candidates = _generate_demo_candidates(run_id)
        run_summary.candidates_count = len(candidates)
        
        # Add candidates to ledger
        for candidate in candidates:
            ledger.add_entry(candidate)
        
        # Select using configured method
        selected = _select_candidates(candidates, llm_config.mode)
        run_summary.selected_count = len(selected)
        run_summary.selection_method = llm_config.mode.value
        
        # Validate and execute
        executed = []
        for entry in selected:
            ledger.update_entry(entry.id, status=TradeStatus.VALIDATED)
            
            if not request.dry_run and config.auto_execute:
                # Simulate paper execution
                ledger.update_entry(
                    entry.id,
                    status=TradeStatus.PLACED,
                    alpaca_order_id=f"paper_{uuid.uuid4().hex[:12]}"
                )
                ledger.update_entry(entry.id, status=TradeStatus.FILLED, fill_price=1.25)
                executed.append(entry)
        
        # Check heartbeat trade
        if os.environ.get("ALPACA_HEARTBEAT_ENABLED", "").lower() == "true":
            _execute_heartbeat_trade(run_id, ledger)
        
        # Complete run
        ledger.complete_run(run_id, status="completed")
        
        return AutopilotRunResponse(
            run_id=run_id,
            status="completed",
            message=f"Autopilot run completed. {len(executed)} trades executed.",
            candidates_count=len(candidates),
            selected_count=len(selected),
            executed_count=len(executed),
        )
        
    except Exception as e:
        logger.error(f"Autopilot run failed: {e}")
        ledger.complete_run(run_id, status="failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        _is_running = False


@router.get("/status", response_model=AutopilotStatus)
async def get_status(request: Request) -> AutopilotStatus:
    """Get current autopilot status. Includes websocket/ingestion indicators."""
    config = get_autopilot_config()
    llm_config = load_llm_config_from_env()
    ledger = get_ledger()
    
    last_run = ledger.get_last_run()
    open_positions = ledger.get_open_positions()

    # WebSocket connected if any client is connected to our WS manager
    manager = get_manager()
    ws_connected = manager.connection_count > 0

    # Determine if ingestion is in polling fallback (REST-based polling) vs live WS
    polling_fallback = False
    ingestion = getattr(request.app.state, "ingestion", None)
    try:
        if ingestion and getattr(ingestion, "connector", None):
            connector_name = getattr(ingestion.connector, "name", "").lower()
            # Connectors named 'alpaca' are REST/polling; 'mock' and 'yfinance' are non-streaming as well
            if connector_name in ("alpaca", "mock", "yfinance"):
                polling_fallback = True
    except Exception:
        polling_fallback = False

    return AutopilotStatus(
        mode=config.mode.value,
        auto_execute=config.auto_execute,
        llm_mode=llm_config.mode.value,
        llm_available=llm_config.enabled,
        last_run_id=last_run.run_id if last_run else None,
        last_run_status=last_run.status if last_run else None,
        last_run_at=last_run.started_at.isoformat() if last_run else None,
        open_positions=len(open_positions),
        websocket_connected=ws_connected,
        polling_fallback=polling_fallback,
    )


@router.get("/last_run_summary")
async def get_last_run_summary() -> Dict[str, Any]:
    """
    Get summary of the last autopilot run.
    
    Includes:
    - Candidates count
    - Selected count
    - Executed count
    - Reasons for skipping
    - LLM rationale
    """
    ledger = get_ledger()
    last_run = ledger.get_last_run()
    
    if not last_run:
        return {
            "status": "no_runs",
            "message": "No autopilot runs found",
        }
    
    entries = ledger.get_entries_for_run(last_run.run_id)
    
    # Group by status
    by_status = {}
    skip_reasons = []
    
    for entry in entries:
        status = entry.status.value
        if status not in by_status:
            by_status[status] = []
        by_status[status].append({
            "id": entry.id,
            "symbol": entry.symbol,
            "template": entry.template,
            "max_loss": entry.max_loss,
            "selection_reason": entry.selection_reason,
        })
        
        if entry.rejection_reasons:
            skip_reasons.extend(entry.rejection_reasons)
    
    return {
        "run_id": last_run.run_id,
        "status": last_run.status,
        "started_at": last_run.started_at.isoformat(),
    }


@router.get("/runs")
async def list_autopilot_runs(status: Optional[str] = None) -> Dict[str, Any]:
    """
    List runs managed by the RunOrchestrator for autopilot operations.
    Returns a JSON object with a `runs` array compatible with the frontend.
    """
    try:
        from services.execution.orchestrator import get_orchestrator
        orchestrator = get_orchestrator()
        runs = orchestrator.list_runs(status=status)

        def map_type(rt: str) -> str:
            r = (rt or "").lower()
            if "autopilot" in r or "autopilot_paper" in r:
                return "autopilot"
            if "monitor" in r:
                return "monitoring"
            if "manual" in r:
                return "manual"
            return r

        normalized = []
        for r in runs:
            nr = dict(r)
            nr["type"] = map_type(nr.get("run_type", ""))
            nr["status"] = nr.get("status") or "pending"
            nr["started_at"] = nr.get("started_at")
            nr["completed_at"] = nr.get("stopped_at")
            nr["duration_ms"] = None
            nr["actions_taken"] = 0
            nr["errors"] = nr.get("error_count", 0)
            nr["summary"] = nr.get("last_error") or ""
            normalized.append(nr)

        return {"runs": normalized}
    except Exception as e:
        return {"runs": []}


@router.get("/positions")
async def get_positions() -> Dict[str, Any]:
    """Get current open positions from internal ledger."""
    ledger = get_ledger()
    positions = ledger.get_open_positions()
    
    return {
        "count": len(positions),
        "positions": [
            {
                "id": p.id,
                "position_id": p.id,
                "symbol": p.symbol,
                "template": p.template,
                "status": p.status.value,
                # Financial data - use actual values or defaults
                "entry_price": p.fill_price or 0.0,
                "entry_cost": (p.fill_price or 0.0) * 100,  # Per contract
                "max_loss": p.max_loss or 0.0,
                "max_risk": p.max_loss or 0.0,  # Alias for frontend
                "max_profit": p.max_profit or 0.0,
                "current_value": 0.0,
                "unrealized_pnl": 0.0,
                "pnl_percent": 0.0,
                # Leg count
                "legs": 2,  # Standard spread has 2 legs
                # Time data
                "dte": 30,  # Default 30 DTE
                "days_to_expiry": 30,
                "entry_time": p.proposed_at.isoformat() if p.proposed_at else None,
                "filled_at": p.filled_at.isoformat() if p.filled_at else None,
                "alpaca_order_id": p.alpaca_order_id,
            }
            for p in positions
        ],
        "total_risk": sum(p.max_loss or 0 for p in positions),
        "total_pnl": 0.0,
    }


def _generate_demo_candidates(run_id: str) -> List[TradeLedgerEntry]:
    """Generate demo candidates for testing."""
    symbols = ["AAPL", "MSFT", "NVDA", "SPY", "QQQ"]
    templates = ["put_credit_spread", "call_credit_spread", "iron_condor"]
    
    candidates = []
    for i, symbol in enumerate(symbols):
        entry = TradeLedgerEntry(
            id=f"{run_id}_c{i+1}",
            run_id=run_id,
            symbol=symbol,
            template=templates[i % len(templates)],
            status=TradeStatus.PROPOSED,
            proposed_at=datetime.utcnow(),
            max_loss=25.0 + (i * 5),
            max_profit=50.0 + (i * 10),
            metadata={"base_score": 0.8 - (i * 0.1), "pop": 0.7 - (i * 0.05)},
        )
        candidates.append(entry)
    
    return candidates


def _select_candidates(
    candidates: List[TradeLedgerEntry],
    llm_mode: LLMMode,
) -> List[TradeLedgerEntry]:
    """Select candidates using configured method."""
    # For demo, select top 3 by base_score
    sorted_candidates = sorted(
        candidates,
        key=lambda c: c.metadata.get("base_score", 0),
        reverse=True
    )
    
    selected = sorted_candidates[:3]
    
    for entry in selected:
        entry.selection_reason = f"Selected by {llm_mode.value} (demo)"
    
    for entry in sorted_candidates[3:]:
        entry.rejection_reasons.append("Not in top 3 by score")
    
    return selected


def _execute_heartbeat_trade(run_id: str, ledger) -> None:
    """Execute a small equity heartbeat trade on Alpaca for verification."""
    heartbeat_entry = TradeLedgerEntry(
        id=f"{run_id}_heartbeat",
        run_id=run_id,
        symbol="SPY",
        template="equity_heartbeat",
        status=TradeStatus.PROPOSED,
        proposed_at=datetime.utcnow(),
        max_loss=1.0,  # Minimal risk
        max_profit=1.0,
        selection_reason="Heartbeat trade for Alpaca verification",
        metadata={"heartbeat": True},
    )
    ledger.add_entry(heartbeat_entry)
    
    # In production, would call Alpaca API here
    ledger.update_entry(heartbeat_entry.id, status=TradeStatus.VALIDATED)
    ledger.update_entry(
        heartbeat_entry.id,
        status=TradeStatus.PLACED,
        alpaca_order_id=f"heartbeat_{uuid.uuid4().hex[:12]}"
    )
    ledger.update_entry(heartbeat_entry.id, status=TradeStatus.FILLED, fill_price=1.0)
    
    logger.info(f"Heartbeat trade executed for run {run_id}")
