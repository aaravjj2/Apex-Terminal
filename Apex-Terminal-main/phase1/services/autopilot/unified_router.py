"""
Unified Autopilot API Router

This is the ONLY autopilot API. Legacy routers are retired.

Endpoints:
- GET /status          - Engine status
- POST /cycle          - Run a cycle
- POST /kill-switch    - Activate/deactivate kill switch
- GET /positions       - Get all positions (from Alpaca)
- GET /run/{run_id}    - Get run artifact
- GET /runs            - List recent runs
- GET /health          - Health check
- GET /sentiment/{sym} - Get sentiment for symbol
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel
import logging

from .unified_engine import get_unified_engine, RunArtifact, CyclePhase
from .broker_position_manager import get_broker_position_manager, EnrichedBrokerPosition
from .news_provider import get_news_provider

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/autopilot", tags=["autopilot"])


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class CycleRequest(BaseModel):
    """Request to run a cycle."""
    dry_run: bool = False
    force: bool = False


class CycleResponse(BaseModel):
    """Response from running a cycle."""
    run_id: str
    success: bool
    duration_ms: float
    candidates_generated: int
    candidates_selected: int
    exits_triggered: int
    exits_executed: int
    orders_filled: int
    no_action_reasons: List[str]
    error: Optional[str] = None


class KillSwitchRequest(BaseModel):
    """Request to toggle kill switch."""
    active: bool
    close_all: bool = False





class StatusResponse(BaseModel):
    """Engine status response."""
    is_running: bool
    automation_enabled: bool
    kill_switch_active: bool
    current_phase: str
    last_run_id: Optional[str] = None
    last_run_timestamp: Optional[str] = None
    last_run_success: Optional[bool] = None
    cycle_count: int = 0
    # Session stats for dashboard
    state: str = "idle"
    kill_switch: bool = False
    cycles_completed: int = 0
    trades_executed: int = 0
    win_rate: float = 0.0
    avg_win: float = 0.0
    avg_loss: float = 0.0
    sharpe_ratio: Optional[float] = None
    last_cycle_at: Optional[str] = None
    sentiment: Optional[Dict[str, Any]] = None


class ConfigUpdate(BaseModel):
    """Configuration update request."""
    paper_equity: Optional[float] = None
    mode: Optional[str] = None
    risk_limits: Optional[Dict[str, Any]] = None
    allowed_templates: Optional[List[str]] = None
    forecast_influence: Optional[float] = None
    llm_enabled: Optional[bool] = None
    focus_symbol: Optional[str] = None
    max_symbols_per_cycle: Optional[int] = None
    contracts_per_trade: Optional[int] = None
    continuous_run: Optional[bool] = None
    weekly_expiry_only: Optional[bool] = None
    universe: Optional[List[str]] = None


class PositionResponse(BaseModel):
    """Position data response."""
    symbol: str
    qty: int
    side: str
    avg_entry_price: float
    current_price: float
    market_value: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    asset_class: str
    underlying: Optional[str] = None
    expiration: Optional[str] = None
    strike: Optional[float] = None
    option_type: Optional[str] = None
    dte: Optional[int] = None
    managed: bool = False
    run_id: Optional[str] = None
    strategy_template: Optional[str] = None
    current_profit_pct: float = 0.0
    exit_signals: List[Dict[str, Any]] = []


class RunSummary(BaseModel):
    """Summary of a run."""
    run_id: str
    timestamp: str
    success: bool
    duration_ms: float
    candidates_generated: int
    orders_filled: int
    exits_executed: int


class SentimentResponse(BaseModel):
    """Sentiment data response."""
    symbol: str
    overall_score: float
    overall_level: str
    news_count_24h: int
    is_blackout: bool
    earnings_within: Optional[int] = None
    recent_headlines: List[str] = []


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    timestamp: str
    alpaca_connected: bool
    websocket_connected: bool
    news_provider: str
    engine_running: bool
    kill_switch_active: bool


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/status", response_model=StatusResponse)
async def get_status():
    """Get engine status with session stats."""
    engine = get_unified_engine()
    last = engine.last_run
    from .config import get_autopilot_config
    config = get_autopilot_config()
    from .service import get_autopilot_service
    service = get_autopilot_service()
    
    # Calculate session stats from run history
    cycles_completed = len(engine._run_history)
    trades_executed = sum(a.orders_filled for a in engine._run_history)
    exits_executed = sum(a.exits_executed for a in engine._run_history)
    
    # Win rate calculation (placeholder - would need P&L tracking)
    win_count = sum(1 for a in engine._run_history if a.orders_filled > 0)
    win_rate = win_count / max(1, cycles_completed)
    
    return StatusResponse(
        is_running=service.is_running,
        automation_enabled=config.continuous_run,
        kill_switch_active=engine.kill_switch_active,
        current_phase=engine.current_phase.value,
        last_run_id=last.run_id if last else None,
        last_run_timestamp=last.timestamp.isoformat() if last else None,
        last_run_success=last.success if last else None,
        cycle_count=engine._cycle_counter,
        # Session stats
        state="running" if service.is_running else "paused" if config.continuous_run else "idle",
        kill_switch=engine.kill_switch_active,
        cycles_completed=cycles_completed,
        trades_executed=trades_executed,
        win_rate=win_rate,
        avg_win=0.0,  # Would need trade tracking
        avg_loss=0.0,  # Would need trade tracking
        sharpe_ratio=None,
        last_cycle_at=last.timestamp.isoformat() if last else None,
        sentiment=last.sentiment.to_dict() if last and last.sentiment else None,
    )


@router.post("/start")
async def start_autopilot():
    """Start the autopilot engine."""
    from .config import get_autopilot_config, save_autopilot_config
    from .service import get_autopilot_service
    config = get_autopilot_config()
    service = get_autopilot_service()
    if service.is_running:
        raise HTTPException(status_code=400, detail="Autopilot is already running")
    
    try:
        await service.start_background_loop(interval_seconds=60)
        config.continuous_run = True
        save_autopilot_config(config)
        return {"status": "started", "timestamp": datetime.now().isoformat()}
    except Exception as e:
        logger.exception("Failed to start autopilot")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stop")
async def stop_autopilot():
    """Stop the autopilot engine."""
    from .config import get_autopilot_config, save_autopilot_config
    from .service import get_autopilot_service
    config = get_autopilot_config()
    service = get_autopilot_service()
    if not service.is_running:
        raise HTTPException(status_code=400, detail="Autopilot is not running")
    
    try:
        await service.stop_background_loop()
        config.continuous_run = False
        save_autopilot_config(config)
        return {"status": "stopped", "timestamp": datetime.now().isoformat()}
    except Exception as e:
        logger.exception("Failed to stop autopilot")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pause")
async def pause_autopilot():
    """Pause the autopilot engine (alias for stop)."""
    return await stop_autopilot()


@router.post("/resume")
async def resume_autopilot():
    """Resume the autopilot engine (alias for start)."""
    return await start_autopilot()


@router.post("/cycle", response_model=CycleResponse)
async def run_cycle(request: CycleRequest):
    """Run an autopilot cycle."""
    engine = get_unified_engine()
    
    try:
        artifact = await engine.run_cycle(
            dry_run=request.dry_run,
            force=request.force,
        )
        
        return CycleResponse(
            run_id=artifact.run_id,
            success=artifact.success,
            duration_ms=artifact.duration_ms,
            candidates_generated=artifact.candidates_generated,
            candidates_selected=artifact.candidates_selected,
            exits_triggered=artifact.exits_triggered,
            exits_executed=artifact.exits_executed,
            orders_filled=artifact.orders_filled,
            no_action_reasons=artifact.no_action_reasons,
            error=artifact.error,
        )
    except Exception as e:
        logger.error(f"Cycle error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/run", response_model=CycleResponse)
async def run_cycle_legacy(request: CycleRequest):
    """Legacy alias for /cycle (compatibility with older UI)."""
    return await run_cycle(request)


@router.post("/kill-switch")
async def toggle_kill_switch(request: KillSwitchRequest):
    """Activate or deactivate kill switch."""
    engine = get_unified_engine()
    
    if request.active:
        result = await engine.activate_kill_switch(close_all=request.close_all)
    else:
        result = engine.deactivate_kill_switch()
    
    return result


@router.get("/kill-switch")
async def get_kill_switch_status():
    """Get kill switch status."""
    engine = get_unified_engine()
    return {
        "active": engine.kill_switch_active,
        "timestamp": datetime.now().isoformat(),
    }


@router.get("/agents")
async def get_active_agents():
    """Get status of all active PositionAgents."""
    from .service import get_autopilot_service
    service = get_autopilot_service()
    
    agents = []
    for symbol, agent in service.active_agents.items():
        agents.append({
            "symbol": symbol,
            "running": agent._is_running,
            "interval": agent.interval,
            "last_check": datetime.now().isoformat(), # Placeholder, agent should track this
            "status": "watching" if agent._is_running else "stopped"
        })
    
    return {
        "agents": agents,
        "count": len(agents),
        "monitoring_active": service._monitoring_task is not None and not service._monitoring_task.done()
    }


@router.get("/positions")
async def get_positions():
    """Get all positions from Alpaca (real positions) enriched with metadata."""
    from .alpaca_client import get_alpaca_client
    from datetime import date
    
    manager = get_broker_position_manager()
    client = get_alpaca_client()
    
    try:
        # Fetch REAL positions from Alpaca
        alpaca_positions = []
        try:
            positions = await client.list_positions()
            logger.info(f"Fetched {len(positions)} positions from Alpaca")
            
            for pos in positions:
                symbol = pos.symbol
                
                # Parse OCC option symbol (e.g., SMH260123P00392500)
                underlying = None
                expiration = None
                strike = None
                option_type = None
                dte = None
                
                if pos.asset_class == "us_option" or len(symbol) > 10:
                    # Parse OCC symbol
                    try:
                        # Find where digits start (underlying ends)
                        for i, c in enumerate(symbol):
                            if c.isdigit():
                                underlying = symbol[:i].strip()
                                break
                        
                        if underlying:
                            rest = symbol[len(underlying):]
                            # Date is YYMMDD (6 chars), then C/P, then strike
                            if len(rest) >= 7:
                                date_str = rest[:6]
                                option_type = "call" if rest[6] == "C" else "put"
                                strike = float(rest[7:]) / 1000 if len(rest) > 7 else None
                                
                                expiration = f"20{date_str[:2]}-{date_str[2:4]}-{date_str[4:6]}"
                                try:
                                    exp_date = date.fromisoformat(expiration)
                                    dte = (exp_date - date.today()).days
                                except:
                                    dte = None
                    except Exception as e:
                        logger.debug(f"Could not parse OCC symbol {symbol}: {e}")
                
                # Get metadata enrichment if available
                meta = manager._store.get(underlying or symbol)
                
                alpaca_positions.append({
                    "symbol": symbol,
                    "qty": pos.qty,
                    "side": pos.side,
                    "avg_entry_price": pos.avg_entry_price,
                    "current_price": pos.current_price,
                    "market_value": pos.market_value,
                    "unrealized_pnl": pos.unrealized_pl,
                    "unrealized_pnl_pct": pos.unrealized_plpc * 100,
                    "asset_class": pos.asset_class,
                    "underlying": underlying or symbol,
                    "expiration": expiration,
                    "strike": strike,
                    "option_type": option_type,
                    "dte": dte,
                    "managed": meta.managed if meta else False,
                    "run_id": meta.run_id if meta else None,
                    "strategy_template": meta.strategy_template if meta else None,
                    "entry_credit": meta.entry_credit if meta else None,
                    "max_loss": meta.max_loss if meta else None,
                    "exit_rules": meta.exit_rules.to_dict() if meta else None,
                    "opened_at": meta.opened_at.isoformat() if meta else None,
                })
        except Exception as e:
            logger.error(f"Error fetching Alpaca positions: {e}", exc_info=True)
        
        # Get metadata-only positions (paper positions not reflected in Alpaca)
        paper_only = []
        alpaca_underlyings = {p.get("underlying") for p in alpaca_positions}
        for meta in manager._store.all():
            if meta.symbol not in alpaca_underlyings:
                paper_only.append({
                    "symbol": meta.symbol,
                    "qty": 1,
                    "side": "short",
                    "avg_entry_price": meta.entry_credit,
                    "current_price": meta.entry_credit * 0.5,
                    "market_value": meta.entry_credit * 50,
                    "unrealized_pnl": meta.entry_credit * 50,
                    "unrealized_pnl_pct": 50.0,
                    "asset_class": "us_option",
                    "underlying": meta.symbol,
                    "expiration": None,
                    "strike": None,
                    "option_type": "put" if "put" in meta.strategy_template.lower() else "call",
                    "dte": 7,
                    "managed": meta.managed,
                    "run_id": meta.run_id,
                    "strategy_template": meta.strategy_template,
                    "entry_credit": meta.entry_credit,
                    "max_loss": meta.max_loss,
                    "exit_rules": meta.exit_rules.to_dict(),
                    "opened_at": meta.opened_at.isoformat(),
                    "source": "paper_only",
                })
        
        all_positions = alpaca_positions + paper_only
        
        # Calculate portfolio summary stats
        total_unrealized_pnl = sum(p.get("unrealized_pnl", 0) for p in all_positions)
        total_market_value = sum(p.get("market_value", 0) for p in all_positions)
        total_risk = sum(p.get("max_loss", 0) or 0 for p in all_positions)
        
        # Get session stats from engine
        engine = get_unified_engine()
        total_trades = sum(len(a.orders_placed) for a in engine._run_history)
        total_filled = sum(a.orders_filled for a in engine._run_history)
        total_exits = sum(a.exits_executed for a in engine._run_history)
        
        # Calculate realized P&L from closed positions (estimate from exits)
        realized_pnl = 0  # Would come from closed positions tracking
        
        portfolio = {
            "total_pnl": total_unrealized_pnl + realized_pnl,
            "unrealized_pnl": total_unrealized_pnl,
            "realized_pnl": realized_pnl,
            "total_market_value": total_market_value,
            "total_risk": total_risk,
            "open_positions": len(all_positions),
            # Greeks (placeholder - would need real option Greeks calculation)
            "net_delta": len([p for p in all_positions if p.get("side") == "short"]) * -0.15,
            "net_gamma": len(all_positions) * 0.01,
            "net_theta": len(all_positions) * 2.5,  # Positive theta for credit spreads
            "net_vega": len(all_positions) * -0.5,
        }
        
        return {
            "positions": all_positions,
            "portfolio": portfolio,
            "count": len(all_positions),
            "alpaca_count": len(alpaca_positions),
            "paper_only_count": len(paper_only),
        }
    except Exception as e:
        logger.error(f"Failed to get positions: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/positions/{symbol}/close")
async def close_position(symbol: str, reason: str = "manual_panic"):
    """
    Force close a position immediately (Panic Sell).
    
    Args:
        symbol: The symbol to close (e.g. AAPL or detailed option symbol)
        reason: Reason for closure
    """
    from .alpaca_client import get_alpaca_client
    
    logger.warning(f"🚨 PANIC CLOSE TRIGGERED for {symbol} (reason={reason})")
    
    try:
        client = get_alpaca_client()
        # Alpaca close_position works for both equity and option symbols
        order = await client.close_position(symbol)
        
        if order:
            logger.info(f"Panic close order submitted: {order.id}")
            return {
                "status": "submitted",
                "order_id": order.id,
                "symbol": symbol,
                "message": "Panic close order submitted successfully"
            }
        else:
            raise HTTPException(status_code=400, detail="Failed to close position (no order returned)")
            
    except Exception as e:
        logger.error(f"Panic close failed for {symbol}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Panic close failed: {str(e)}")


@router.get("/run/{run_id}")
async def get_run(run_id: str):
    """Get a specific run artifact."""
    engine = get_unified_engine()
    
    for artifact in engine._run_history:
        if artifact.run_id == run_id:
            return artifact.to_dict()
    
    raise HTTPException(status_code=404, detail=f"Run {run_id} not found")


@router.get("/runs", response_model=List[RunSummary])
async def list_runs(
    limit: int = Query(default=20, le=100),
    success_only: bool = Query(default=False),
):
    """List recent runs."""
    engine = get_unified_engine()
    
    runs = engine._run_history[-limit:]
    if success_only:
        runs = [r for r in runs if r.success]
    
    return [
        RunSummary(
            run_id=r.run_id,
            timestamp=r.timestamp.isoformat(),
            success=r.success,
            duration_ms=r.duration_ms,
            candidates_generated=r.candidates_generated,
            orders_filled=r.orders_filled,
            exits_executed=r.exits_executed,
        )
        for r in reversed(runs)
    ]


@router.get("/sentiment/{symbol}", response_model=SentimentResponse)
async def get_sentiment(symbol: str):
    """Get sentiment for a symbol."""
    provider = get_news_provider()
    
    try:
        snapshot = await provider.get_sentiment(symbol.upper())
        return SentimentResponse(
            symbol=symbol.upper(),
            overall_score=snapshot.overall_score,
            overall_level=snapshot.overall_level.value,
            news_count_24h=snapshot.news_count_24h,
            is_blackout=snapshot.is_blackout,
            earnings_within=snapshot.earnings_within,
            recent_headlines=snapshot.recent_headlines,
        )
    except Exception as e:
        logger.error(f"Sentiment error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    engine = get_unified_engine()
    provider = get_news_provider()
    
    return HealthResponse(
        status="ok",
        timestamp=datetime.now().isoformat(),
        alpaca_connected=True,  # TODO: Real check
        websocket_connected=True,  # TODO: Real check
        news_provider=provider.provider_name,
        engine_running=engine.is_running,
        kill_switch_active=engine.kill_switch_active,
    )


@router.get("/logs")
async def get_logs(
    limit: int = Query(default=50, ge=1, le=500),
    level: Optional[str] = Query(default=None)
):
    """Get autopilot activity logs from run history."""
    engine = get_unified_engine()
    
    activities = []
    
    # Get activities from run history
    for artifact in reversed(engine._run_history[-limit:]):
        # Cycle completion entry
        activities.append({
            "timestamp": artifact.timestamp.isoformat(),
            "level": "info",
            "event_type": "cycle_complete",
            "message": f"Cycle {artifact.run_id}: {artifact.candidates_generated} candidates, {artifact.orders_filled} filled",
            "run_id": artifact.run_id,
            "success": artifact.success,
        })
        
        # Order entries
        for order in artifact.orders_placed:
            order_dict = order.to_dict() if hasattr(order, 'to_dict') else order.__dict__
            activities.append({
                "timestamp": order_dict.get("submitted_at", artifact.timestamp.isoformat()),
                "level": "info",
                "event_type": "order_placed",
                "message": f"Order {order_dict.get('symbol', 'UNKNOWN')}: {order_dict.get('status', 'unknown')} @ ${order_dict.get('limit_price', 0):.2f}",
                "symbol": order_dict.get("symbol"),
                "status": order_dict.get("status"),
                "run_id": artifact.run_id,
            })
        
        # Exit entries
        for action in artifact.monitoring_actions:
            action_dict = action.to_dict() if hasattr(action, 'to_dict') else action.__dict__
            activities.append({
                "timestamp": artifact.timestamp.isoformat(),
                "level": "warning" if action_dict.get("action") == "exit" else "info",
                "event_type": "exit_trigger",
                "message": f"Exit {action_dict.get('symbol', 'UNKNOWN')}: {action_dict.get('reason', 'unknown')}",
                "symbol": action_dict.get("symbol"),
                "trigger": action_dict.get("reason"),
                "run_id": artifact.run_id,
            })
    
    # Filter by level if specified
    if level:
        activities = [a for a in activities if a.get("level") == level]
    
    return {
        "logs": activities[:limit],
        "total": len(activities),
    }


@router.get("/broker/sync")
async def sync_broker_state():
    """
    Force a full sync with Alpaca and return a normalized portfolio snapshot.
    This is the definitive Source of Truth for the UI.
    """
    from .broker_sync import get_broker_sync
    service = get_broker_sync()
    result = await service.sync()
    return result


@router.get("/activity")
async def get_activity(
    limit: int = Query(default=20, ge=1, le=100)
):
    """Get recent trading activity (orders placed and filled)."""
    engine = get_unified_engine()
    
    orders = []
    for artifact in reversed(engine._run_history[-20:]):
        for order in artifact.orders_placed:
            order_dict = order.to_dict() if hasattr(order, 'to_dict') else order.__dict__
            orders.append({
                "run_id": artifact.run_id,
                "timestamp": artifact.timestamp.isoformat(),
                "symbol": order_dict.get("symbol"),
                "side": order_dict.get("side"),
                "qty": order_dict.get("qty"),
                "limit_price": order_dict.get("limit_price"),
                "status": order_dict.get("status"),
                "filled_qty": order_dict.get("filled_qty", 0),
                "filled_avg_price": order_dict.get("filled_avg_price"),
                "order_id": order_dict.get("alpaca_order_id") or order_dict.get("client_order_id"),
            })
    
    return {
        "activity": orders[:limit],
        "total": len(orders),
    }


@router.get("/think-log")
async def get_think_log(
    run_id: Optional[str] = Query(default=None, description="Specific run ID, or latest if not provided"),
    limit: int = Query(default=100, ge=1, le=500, description="Max number of entries"),
):
    """
    Get the Think Engine log - shows the autopilot's decision-making process.
    
    This provides visibility into what the autopilot is thinking:
    - Observations about market conditions
    - Decisions and their rationale
    - Which symbols were selected/rejected and why
    - Execution actions and results
    """
    engine = get_unified_engine()
    
    # Find the artifact
    artifact = None
    if run_id:
        for a in reversed(engine._run_history):
            if a.run_id == run_id:
                artifact = a
                break
        if not artifact:
            raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    else:
        artifact = engine.last_run
        if not artifact:
            return {
                "run_id": None,
                "think_log": [],
                "count": 0,
                "message": "No cycles have run yet",
            }
    
    think_log = artifact.think_log or []
    
    # Format for readability
    formatted = []
    for entry in think_log[:limit]:
        formatted.append({
            "timestamp": entry.get("timestamp"),
            "elapsed": entry.get("elapsed"),
            "emoji": entry.get("emoji", "💭"),
            "phase": entry.get("phase"),
            "thought": entry.get("thought"),
            "details": entry.get("details"),
        })
    
    return {
        "run_id": artifact.run_id,
        "timestamp": artifact.timestamp.isoformat(),
        "success": artifact.success,
        "duration_ms": artifact.duration_ms,
        "think_log": formatted,
        "count": len(formatted),
        "summary": {
            "orders_filled": artifact.orders_filled,
            "exits_triggered": artifact.exits_triggered,
            "candidates_generated": artifact.candidates_generated,
        }
    }


@router.get("/think-log/readable")
async def get_think_log_readable(
    run_id: Optional[str] = Query(default=None),
):
    """Get think log as human-readable text."""
    engine = get_unified_engine()
    
    artifact = None
    if run_id:
        for a in reversed(engine._run_history):
            if a.run_id == run_id:
                artifact = a
                break
    else:
        artifact = engine.last_run
    
    if not artifact:
        return {"text": "No cycles have run yet."}
    
    lines = [
        f"=== Think Log: {artifact.run_id} ===",
        f"Time: {artifact.timestamp.isoformat()}",
        f"Duration: {artifact.duration_ms:.0f}ms",
        f"Success: {artifact.success}",
        "",
        "--- Decision Trace ---",
        ""
    ]
    
    for entry in artifact.think_log or []:
        emoji = entry.get("emoji", "💭")
        phase = entry.get("phase", "")
        thought = entry.get("thought", "")
        lines.append(f"{emoji} [{phase}] {thought}")
        
        details = entry.get("details")
        if details:
            for k, v in details.items():
                lines.append(f"    └─ {k}: {v}")
    
    lines.extend([
        "",
        "--- Summary ---",
        f"Candidates Generated: {artifact.candidates_generated}",
        f"Candidates Selected: {artifact.candidates_selected}",
        f"Orders Filled: {artifact.orders_filled}",
        f"Exits Triggered: {artifact.exits_triggered}",
    ])
    
    return {"text": "\n".join(lines)}


@router.post('/reconnect')
async def reconnect_websockets() -> Dict[str, Any]:
    """Trigger a restart of the WebSocket manager to force client reconnections.

    Returns basic status and counts before the restart.
    """
    try:
        from ..api.websocket import get_manager as get_ws_manager
        manager = get_ws_manager()

        connections_before = manager.connection_count
        subscriptions_before = manager.subscription_count

        await manager.stop()
        await manager.start()

        return {
            "status": "reconnecting",
            "connections_before": connections_before,
            "subscriptions_before": subscriptions_before,
            "message": "WebSocket manager restarted. Clients should reconnect automatically.",
        }
    except Exception as e:
        logger.exception("reconnect_failed", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/ws_status')
async def websocket_status() -> Dict[str, Any]:
    """Return the current WebSocket manager status for diagnostics."""
    try:
        from ..api.websocket import get_manager as get_ws_manager
        manager = get_ws_manager()
        return {
            "connections": manager.connection_count,
            "subscriptions": manager.subscription_count,
            "heartbeat_running": bool(getattr(manager, '_running', False)),
        }
    except Exception as e:
        logger.exception("ws_status_failed", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/config")
async def update_config(update: ConfigUpdate):
    """Update autopilot configuration."""
    from .config import get_autopilot_config, save_autopilot_config, StrategyTemplate

    config = get_autopilot_config()

    if update.paper_equity is not None:
        config.paper_equity = float(update.paper_equity)
    if update.mode is not None:
        try:
            from .config import AutopilotMode
            config.mode = AutopilotMode(update.mode)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid mode")
    if update.risk_limits is not None:
        for k, v in update.risk_limits.items():
            if hasattr(config.risk_limits, k):
                setattr(config.risk_limits, k, v)
    if update.allowed_templates is not None:
        try:
            config.allowed_strategies = [StrategyTemplate(t) for t in update.allowed_templates]
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid strategy template")
    if update.forecast_influence is not None:
        config.forecast_settings.influence_weight = float(update.forecast_influence)
    if update.llm_enabled is not None:
        config.llm_settings.enabled = bool(update.llm_enabled)
    if update.focus_symbol is not None:
        config.focus_symbol = update.focus_symbol.upper() if update.focus_symbol else None
    if update.max_symbols_per_cycle is not None:
        config.max_symbols_per_cycle = int(update.max_symbols_per_cycle)
    if update.contracts_per_trade is not None:
        config.contracts_per_trade = int(update.contracts_per_trade)
    if update.continuous_run is not None:
        config.continuous_run = bool(update.continuous_run)
    if update.weekly_expiry_only is not None:
        config.weekly_expiry_only = bool(update.weekly_expiry_only)
    if update.universe is not None:
        config.universe = update.universe

    save_autopilot_config(config)
    return {"status": "updated", "config": (await get_config())["config"]}


@router.get("/config")
async def get_config():
    """Get current autopilot configuration."""
    from .config import get_autopilot_config, AutopilotConfig

    config = get_autopilot_config()
    defaults = AutopilotConfig()

    def to_frontend_dict(cfg: AutopilotConfig) -> Dict[str, Any]:
        return {
            "paper_equity": cfg.paper_equity,
            "mode": cfg.mode.value if hasattr(cfg.mode, "value") else cfg.mode,
            "auto_execute": cfg.auto_execute,
            "llm_enabled": cfg.llm_settings.enabled,
            "forecast_influence": cfg.forecast_settings.influence_weight,
            "allowed_templates": [s.value for s in cfg.allowed_strategies],
            "risk_limits": {
                "max_risk_per_trade": cfg.risk_limits.max_risk_per_trade,
                "max_total_risk": cfg.risk_limits.max_total_risk,
                "max_daily_loss": cfg.risk_limits.max_daily_loss,
                "max_open_positions": cfg.risk_limits.max_open_positions,
                "max_positions_per_underlying": cfg.risk_limits.max_positions_per_underlying,
                "max_positions_per_cluster": cfg.risk_limits.max_positions_per_cluster,
                "max_cluster_risk_pct": cfg.risk_limits.max_cluster_risk_pct,
                "max_cluster_concentration": cfg.risk_limits.max_cluster_risk_pct,
                "max_symbol_concentration": cfg.risk_limits.max_positions_per_underlying,
            },
            "strategy_constraints": {
                "min_dte": cfg.strategy_constraints.min_dte,
                "max_dte": cfg.strategy_constraints.max_dte,
                "min_short_delta": cfg.strategy_constraints.min_short_delta,
                "max_short_delta": cfg.strategy_constraints.max_short_delta,
                "min_spread_width": cfg.strategy_constraints.min_spread_width,
                "max_spread_width": cfg.strategy_constraints.max_spread_width,
            },
            "universe": cfg.universe,
            "forecast_settings": {
                "enabled": cfg.forecast_settings.enabled,
                "influence_level": cfg.forecast_settings.influence_weight,
            },
            "llm_settings": {
                "enabled": cfg.llm_settings.enabled,
            },
            "focus_symbol": cfg.focus_symbol,
            "max_symbols_per_cycle": cfg.max_symbols_per_cycle,
            "contracts_per_trade": cfg.contracts_per_trade,
            "continuous_run": cfg.continuous_run,
            "weekly_expiry_only": cfg.weekly_expiry_only,
        }

    return {
        "config": to_frontend_dict(config),
        "defaults": to_frontend_dict(defaults),
    }


@router.get("/proposals")
async def get_proposals():
    """Get current trade proposals (candidates awaiting approval)."""
    # For now, return empty list - proposals would come from engine cycle
    return {
        "proposals": [],
        "total": 0
    }


@router.get("/report")
async def get_report():
    """Get daily performance report."""
    engine = get_unified_engine()
    from .config import get_autopilot_config
    config = get_autopilot_config()
    
    # Calculate daily stats from run history (today)
    today = datetime.now().date()
    todays_runs = [r for r in engine._run_history if r.timestamp.date() == today]
    
    trades_opened = sum(r.orders_filled for r in todays_runs)
    trades_closed = sum(r.exits_executed for r in todays_runs)
    
    # Get P&L estimates (approximate for V1)
    realized_pnl = 0.0
    unrealized_pnl = 0.0
    
    try:
        from .alpaca_client import get_alpaca_client
        client = get_alpaca_client()
        account = await client.get_account()
        if account:
            # Approx P&L for the day
            day_pnl = float(account.equity) - float(account.last_equity)
            unrealized_pnl = day_pnl # Grouping it all here for now
    except Exception:
        pass
        
    report = {
        "realized_pnl": realized_pnl,
        "unrealized_pnl": unrealized_pnl,
        "daily_loss_used": abs(min(0, realized_pnl)),
        "daily_loss_remaining": config.risk_limits.max_daily_loss - abs(min(0, realized_pnl)),
        "total_open_risk": 0.0, # TODO: Sum max_loss from positions
        "max_open_risk": config.risk_limits.max_total_risk,
        "trades_opened": trades_opened,
        "trades_closed": trades_closed,
        "monitoring_passes": len(todays_runs)
    }
    
    # Get basic stats from last run if available
    last_run_data = None
    if engine.last_run:
        last_run_data = {
            "run_id": engine.last_run.run_id,
            "timestamp": engine.last_run.timestamp.isoformat(),
            "success": engine.last_run.success,
            "duration_ms": engine.last_run.duration_ms,
            "candidates_generated": engine.last_run.candidates_generated,
            "orders_filled": engine.last_run.orders_filled,
        }
        
    return {
        "report": report,
        "last_run": last_run_data,
        "summary": {
            "total_runs": len(engine._run_history),
            "successful_runs": sum(1 for r in engine._run_history if r.success),
            "total_orders": sum(r.orders_filled for r in engine._run_history),
        }
    }


@router.get("/broker/metrics")
async def get_broker_metrics():
    """Get broker metrics (account balance, positions summary)."""
    from .alpaca_client import get_alpaca_client
    
    try:
        client = get_alpaca_client()
        account = await client.get_account()
        positions = await client.list_positions()
        
        return {
            "equity": float(account.equity) if account else 0.0,
            "buying_power": float(account.buying_power) if account else 0.0,
            "cash": float(account.cash) if account else 0.0,
            "portfolio_value": float(account.portfolio_value) if account else 0.0,
            "positions_count": len(positions),
        }
    except Exception as e:
        logger.error(f"Error fetching broker metrics: {e}")
        return {
            "equity": 0.0,
            "buying_power": 0.0,
            "cash": 0.0,
            "portfolio_value": 0.0,
            "positions_count": 0,
            "error": str(e)
        }


# ============================================================================
# WEBSOCKET EVENTS (for frontend)
# ============================================================================

@router.get("/ws-events")
async def get_ws_events():
    """
    Get list of WebSocket event types this API emits.
    Frontend should subscribe to these.
    """
    return {
        "events": [
            {
                "name": "autopilot.cycle.started",
                "description": "Emitted when a cycle starts",
                "payload": {"run_id": "string", "timestamp": "string"},
            },
            {
                "name": "autopilot.cycle.phase",
                "description": "Emitted when phase changes",
                "payload": {"run_id": "string", "phase": "string"},
            },
            {
                "name": "autopilot.cycle.complete",
                "description": "Emitted when a cycle completes",
                "payload": {"run_id": "string", "success": "boolean", "duration_ms": "number"},
            },
            {
                "name": "autopilot.exit.triggered",
                "description": "Emitted when an exit is triggered",
                "payload": {"symbol": "string", "trigger": "string", "urgency": "string"},
            },
            {
                "name": "autopilot.order.placed",
                "description": "Emitted when an order is placed",
                "payload": {"client_order_id": "string", "symbol": "string", "side": "string"},
            },
            {
                "name": "autopilot.order.filled",
                "description": "Emitted when an order is filled",
                "payload": {"client_order_id": "string", "filled_qty": "number"},
            },
            {
                "name": "autopilot.kill_switch",
                "description": "Emitted when kill switch state changes",
                "payload": {"active": "boolean"},
            },
        ]
    }
