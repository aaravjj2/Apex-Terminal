"""
Autopilot API Routes
Provides REST endpoints for the AI Options Autopilot paper trading system.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, date
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query, Request
from pydantic import BaseModel, Field
import structlog

# For websocket/ingestion status
from ...api.websocket import get_manager

from ...autopilot import (
    AutopilotConfig,
    AutopilotMode,
    StrategyTemplate,
    RiskLimits,
    AutopilotRunloop,
    CycleResult,
)
from ...llm import OfflineStubProvider


logger = structlog.get_logger()
router = APIRouter()


# --- Pydantic Models ---

class RiskLimitsUpdate(BaseModel):
    """Risk limits update request"""
    max_risk_per_trade: Optional[float] = Field(None, ge=1, le=500)
    max_total_risk: Optional[float] = Field(None, ge=10, le=5000)
    max_daily_loss: Optional[float] = Field(None, ge=1, le=1000)
    max_open_positions: Optional[int] = Field(None, ge=1, le=50)
    max_positions_per_underlying: Optional[int] = Field(None, ge=1, le=5)
    max_cluster_concentration: Optional[float] = Field(None, ge=0.1, le=1.0)


class ConfigUpdate(BaseModel):
    """Configuration update request"""
    paper_equity: Optional[float] = Field(None, ge=100, le=100000)
    mode: Optional[str] = None  # "paper" or "paused"
    risk_limits: Optional[RiskLimitsUpdate] = None
    allowed_templates: Optional[List[str]] = None
    forecast_influence: Optional[float] = Field(None, ge=0.0, le=1.0)
    llm_enabled: Optional[bool] = None


class RunRequest(BaseModel):
    """Request to trigger an autopilot run"""
    force: bool = False  # Force run even if paused


class KillSwitchRequest(BaseModel):
    """Kill switch request"""
    activate: bool
    close_all: bool = False


from ...autopilot.service import get_autopilot_service

# --- Global State ---
# Replaced by AutopilotService singleton

def get_autopilot() -> AutopilotRunloop:
    """Get the singleton autopilot instance."""
    service = get_autopilot_service()
    if not service.runloop:
        service.initialize()
    return service.runloop


# --- Endpoints ---

@router.get("/autopilot/config")
async def get_config() -> Dict[str, Any]:
    """
    Get current autopilot configuration.
    
    Returns the complete configuration including:
    - Paper equity
    - Risk limits
    - Strategy constraints
    - Forecast settings
    - LLM settings
    """
    autopilot = get_autopilot()
    return {
        "config": autopilot.config.to_dict(),
        "defaults": AutopilotConfig().to_dict(),
    }


@router.post("/autopilot/config")
async def update_config(update: ConfigUpdate) -> Dict[str, Any]:
    """
    Update autopilot configuration.
    
    Allows updating:
    - Paper equity
    - Mode (paper/paused)
    - Risk limits
    - Allowed templates
    - Forecast influence
    - LLM enablement
    """
    autopilot = get_autopilot()
    config = autopilot.config
    
    # Update paper equity
    if update.paper_equity is not None:
        config.paper_equity = update.paper_equity
        autopilot.positions.initial_equity = update.paper_equity
    
    # Update mode
    if update.mode is not None:
        if update.mode == "paper":
            config.mode = AutopilotMode.PAPER
        elif update.mode == "paused":
            config.mode = AutopilotMode.PAUSED
        else:
            raise HTTPException(400, f"Invalid mode: {update.mode}")
    
    # Update risk limits
    if update.risk_limits:
        limits = config.risk_limits
        for field, value in update.risk_limits.model_dump(exclude_none=True).items():
            setattr(limits, field, value)
    
    # Update allowed templates
    if update.allowed_templates is not None:
        try:
            templates = [StrategyTemplate(t) for t in update.allowed_templates]
            config.strategy_constraints.allowed_templates = templates
        except ValueError as e:
            raise HTTPException(400, f"Invalid template: {e}")
    
    # Update forecast influence
    if update.forecast_influence is not None:
        config.forecast_settings.influence_level = update.forecast_influence
    
    # Update LLM settings
    if update.llm_enabled is not None:
        config.llm_settings.enabled = update.llm_enabled
    
    logger.info("autopilot_config_updated", update=update.model_dump(exclude_none=True))
    
    return {
        "status": "updated",
        "config": config.to_dict(),
    }


@router.post("/autopilot/run")
async def trigger_run(
    request: RunRequest,
    background_tasks: BackgroundTasks,
) -> Dict[str, Any]:
    """
    Trigger a single autopilot cycle.
    
    This will:
    1. Scan the market for opportunities
    2. Generate trade candidates
    3. Select and validate candidates
    4. Execute paper trades
    5. Monitor positions
    
    Returns immediately with cycle ID; results available via /status.
    """
    autopilot = get_autopilot()
    
    # Check if paused
    if autopilot.config.mode == AutopilotMode.PAUSED and not request.force:
        raise HTTPException(400, "Autopilot is paused. Use force=true to override.")
    
    # Check if already running
    if autopilot.state.value == "running":
        raise HTTPException(409, "Autopilot cycle already in progress")
    
    # Run cycle synchronously for now (could be async in production)
    try:
        result = autopilot.run_cycle()
        
        return {
            "status": "completed",
            "cycle": result.to_dict(),
        }
    except Exception as e:
        logger.error("autopilot_run_error", error=str(e))
        raise HTTPException(500, f"Autopilot run failed: {str(e)}")


@router.get("/autopilot/status")
async def get_status(request: Request) -> Dict[str, Any]:
    """
    Get current autopilot status.

    Returns:
    - Current state (idle/running/paused/error)
    - Mode (paper/paused)
    - Kill switch status
    - Last cycle result
    - Portfolio summary
    - Websocket and ingestion flags for frontend UI
    """
    autopilot = get_autopilot()

    status = autopilot.get_status()

    # Determine websocket and polling status based on ingestion connector and active WS clients
    ws_connected = False
    polling_fallback = False
    ingestion = getattr(request.app.state, "ingestion", None)

    try:
        manager = get_manager()
        # If any frontend client is connected to our WS manager, consider it connected
        if manager.connection_count > 0:
            ws_connected = True
    except Exception:
        pass

    try:
        if ingestion and getattr(ingestion, "connector", None):
            connector = ingestion.connector
            connector_name = getattr(connector, "name", "").lower()

            # Polling connectors (REST-based) -> polling fallback
            if connector_name in ("alpaca", "mock", "yfinance"):
                polling_fallback = True

            # If the connector is a WS-based connector and is running, mark websocket as connected
            if connector_name in ("alpaca-ws", "finnhub") and getattr(connector, "is_running", False):
                ws_connected = True
    except Exception:
        pass

    status["websocket_connected"] = ws_connected
    status["polling_fallback"] = polling_fallback

    return status


@router.get("/autopilot/proposals")
async def get_proposals(
    limit: int = Query(50, ge=1, le=200),
) -> Dict[str, Any]:
    """
    Get candidates and decisions from the last run.
    
    Returns the full list of generated candidates with their:
    - Selection status (selected/rejected)
    - Scores
    - Rejection reasons (if any)
    """
    autopilot = get_autopilot()
    last_result = autopilot.last_cycle_result
    
    if not last_result:
        return {
            "proposals": [],
            "message": "No autopilot cycle has been run yet",
        }
    
    return {
        "cycle_id": last_result.cycle_id,
        "candidates_generated": last_result.candidates_generated,
        "candidates_by_template": last_result.candidates_by_template,
        "selected_count": last_result.selected_count,
        "selection_method": last_result.selection_method,
        "timestamp": last_result.completed_at.isoformat(),
    }


@router.get("/autopilot/positions")
async def get_positions(
    status: Optional[str] = Query(None, description="Filter by status: open, closed, all"),
) -> Dict[str, Any]:
    """
    Get options position ledger with Greeks exposures.
    
    Returns:
    - All positions (or filtered by status)
    - Portfolio-level Greeks
    - Risk metrics
    """
    autopilot = get_autopilot()
    
    if status == "open":
        positions = autopilot.positions.get_open_positions()
    elif status == "closed":
        positions = [
            p for p in autopilot.positions.get_all_positions()
            if p.status.value != "open"
        ]
    else:
        positions = autopilot.positions.get_all_positions()
    
    portfolio_state = autopilot.positions.get_portfolio_state()
    
    return {
        "positions": [p.to_dict() for p in positions],
        "count": len(positions),
        "portfolio": portfolio_state.to_dict(),
    }


@router.get("/autopilot/logs")
async def get_logs(
    limit: int = Query(100, ge=1, le=500),
    event_type: Optional[str] = None,
    level: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Get structured autopilot activity logs.
    
    Useful for understanding what the autopilot did and why.
    """
    autopilot = get_autopilot()
    
    entries = autopilot.activity_log.get_entries(
        limit=limit,
        event_type=event_type,
        level=level,
    )
    
    return {
        "logs": entries,
        "count": len(entries),
    }


@router.post("/autopilot/kill_switch")
async def handle_kill_switch(request: KillSwitchRequest) -> Dict[str, Any]:
    """
    Activate or deactivate the kill switch.
    
    When activated:
    - No new trades will be placed
    - Optionally close all open positions
    
    This is the emergency stop for runaway behavior.
    """
    autopilot = get_autopilot()
    
    if request.activate:
        autopilot.activate_kill_switch(close_all=request.close_all)
        logger.warning("kill_switch_activated", close_all=request.close_all)
        return {
            "status": "kill_switch_activated",
            "close_all": request.close_all,
        }
    else:
        autopilot.deactivate_kill_switch()
        logger.info("kill_switch_deactivated")
        return {
            "status": "kill_switch_deactivated",
        }


@router.get("/autopilot/report")
async def get_daily_report(
    report_date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
) -> Dict[str, Any]:
    """
    Get daily autopilot report.
    
    Returns:
    - P&L summary
    - Trading activity
    - Attribution by strategy/symbol
    - Risk metrics
    """
    autopilot = get_autopilot()
    
    target_date = None
    if report_date:
        try:
            target_date = date.fromisoformat(report_date)
        except ValueError:
            raise HTTPException(400, f"Invalid date format: {report_date}")
    
    report = autopilot.reporter.generate_daily_report(
        report_date=target_date,
        no_trade_reasons=autopilot._no_trade_reasons,
        alerts=[a.message for a in autopilot.monitor.get_active_alerts()],
    )
    
    return {
        "report": report.to_dict(),
        "markdown": report.to_markdown(),
    }


@router.post("/autopilot/pause")
async def pause_autopilot() -> Dict[str, Any]:
    """Pause the autopilot."""
    autopilot = get_autopilot()
    autopilot.pause()
    return {"status": "paused"}


@router.post("/autopilot/resume")
async def resume_autopilot() -> Dict[str, Any]:
    """Resume the autopilot."""
    autopilot = get_autopilot()
    autopilot.resume()
    return {"status": "resumed"}


@router.get("/autopilot/broker/metrics")
async def get_broker_metrics() -> Dict[str, Any]:
    """Get paper broker fill metrics."""
    autopilot = get_autopilot()
    return autopilot.broker.get_metrics().to_dict()


@router.get("/autopilot/universe")
async def get_universe() -> Dict[str, Any]:
    """Get the current trading universe."""
    autopilot = get_autopilot()
    symbols = autopilot.universe.get_tradeable_symbols()
    return {
        "symbols": [s.to_dict() for s in symbols],
        "count": len(symbols),
    }


@router.post("/autopilot/reconnect")
async def reconnect_websocket() -> Dict[str, Any]:
    """
    Reconnect WebSocket connections.
    
    This endpoint triggers a reconnection attempt for all WebSocket
    connections managed by the ingestion service.
    """
    try:
        manager = get_manager()
        # Get connection stats before
        connections_before = manager.connection_count
        subscriptions_before = manager.subscription_count
        
        # The manager will handle reconnection internally through heartbeat mechanism
        # For immediate reconnection, we can restart the heartbeat loop
        await manager.stop()
        await manager.start()
        
        return {
            "status": "reconnecting",
            "connections_before": connections_before,
            "subscriptions_before": subscriptions_before,
            "message": "WebSocket manager restarted. Clients will reconnect automatically.",
        }
    except Exception as e:
        logger.error("reconnect_failed", error=str(e))
        return {
            "status": "error",
            "message": str(e),
        }
