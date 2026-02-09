"""
Automation (Autopilot) API Routes.

Provides endpoints for:
- Autopilot status (armed/disarmed, mode, budget)
- Arm/Disarm autopilot
- Emergency kill switch
- Job queue management
"""

from datetime import datetime
from typing import Dict, List, Optional, Any
from enum import Enum
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
import structlog

from ...automation import (
    get_job_queue,
    submit_job,
    get_job_status,
    JobSpec,
    JobType,
    JobStatus,
    MLJobTemplates,
)


logger = structlog.get_logger()
router = APIRouter()


# ============================================================================
# Pydantic Models
# ============================================================================

class BudgetConfig(BaseModel):
    """Budget and risk controls for autopilot."""
    max_total_notional: float = Field(default=10000.0, description="Max total position notional")
    max_daily_spend: float = Field(default=1000.0, description="Max $ to spend per day")
    max_per_trade: float = Field(default=500.0, description="Max $ per single trade")
    max_concurrent_positions: int = Field(default=5, description="Max concurrent open positions")
    max_leverage: float = Field(default=1.0, description="Max leverage multiplier")
    hard_drawdown_stop: float = Field(default=0.1, description="Hard stop at X% drawdown")


class AutopilotMode(str, Enum):
    """Trading mode for autopilot."""
    PAPER = "paper"
    LIVE = "live"


class ForecastConfigModel(BaseModel):
    """Forecast integration configuration."""
    enabled: bool = Field(default=True, description="Enable forecast-aware trading")
    confidence_level: float = Field(default=0.68, description="Confidence level (0.68, 0.95, 0.99)")
    use_for_filtering: bool = Field(default=True, description="Filter trades based on forecast")
    use_for_sizing: bool = Field(default=True, description="Size positions based on volatility")
    max_volatility_threshold: float = Field(default=0.50, description="Max volatility to trade")


class ForecastStatusModel(BaseModel):
    """Current forecast status for active symbol."""
    symbol: Optional[str] = None
    bias: Optional[str] = None  # bullish, bearish, neutral
    historical_volatility: Optional[float] = None
    upper_bound_30d: Optional[float] = None
    lower_bound_30d: Optional[float] = None
    size_multiplier: Optional[float] = None


class AutopilotStatusResponse(BaseModel):
    """Current autopilot status."""
    armed: bool = False
    mode: AutopilotMode = AutopilotMode.PAPER
    budget: BudgetConfig = Field(default_factory=BudgetConfig)
    current_spent_today: float = 0.0
    active_strategies: List[str] = Field(default_factory=list)
    kill_switch_triggered: bool = False
    # Forecast integration
    forecast_config: ForecastConfigModel = Field(default_factory=ForecastConfigModel)
    forecast_status: Optional[ForecastStatusModel] = None


class ArmRequest(BaseModel):
    """Request to arm autopilot."""
    mode: AutopilotMode = AutopilotMode.PAPER
    confirm_live: bool = False  # Must be True for live mode


class JobSubmitRequest(BaseModel):
    """Request to submit a job."""
    name: str
    job_type: str = "local"
    entrypoint: str
    parameters: Dict[str, Any] = Field(default_factory=dict)
    timeout_seconds: int = 3600
    priority: int = 0


class JobResponse(BaseModel):
    """Job information."""
    id: str
    name: str
    type: str
    status: str
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


# ============================================================================
# In-Memory State (for demo; production would use DB)
# ============================================================================

_autopilot_state = AutopilotStatusResponse()


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/automation/status", response_model=AutopilotStatusResponse)
async def get_automation_status():
    """Get current autopilot status."""
    logger.info("automation_status_requested")
    return _autopilot_state


@router.post("/automation/arm", response_model=AutopilotStatusResponse)
async def arm_automation(request: ArmRequest):
    """
    Arm the autopilot.
    
    For live mode, `confirm_live` must be set to True.
    """
    global _autopilot_state
    
    if _autopilot_state.kill_switch_triggered:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot arm: kill switch was previously triggered. Reset required."
        )
    
    if request.mode == AutopilotMode.LIVE and not request.confirm_live:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Live mode requires confirm_live=true for safety."
        )
    
    _autopilot_state.armed = True
    _autopilot_state.mode = request.mode
    
    # Simulate activating a strategy for demonstration
    if not _autopilot_state.active_strategies:
        _autopilot_state.active_strategies = ["Simple-MA-v1"]
    
    logger.info("automation_armed", mode=request.mode.value)
    return _autopilot_state


@router.post("/automation/disarm", response_model=AutopilotStatusResponse)
async def disarm_automation():
    """Disarm the autopilot."""
    global _autopilot_state
    
    _autopilot_state.armed = False
    _autopilot_state.active_strategies = []
    
    # Also reset unified autopilot engine kill switch
    try:
        from ...autopilot.unified_engine import get_unified_engine
        engine = get_unified_engine()
        engine.deactivate_kill_switch()
    except Exception:
        pass
    
    logger.info("automation_disarmed")
    return _autopilot_state


@router.post("/automation/kill", response_model=AutopilotStatusResponse)
async def kill_automation():
    """
    Emergency kill switch.
    
    Immediately disarms autopilot and sets kill_switch_triggered flag.
    Manual reset required to re-arm.
    """
    global _autopilot_state
    
    _autopilot_state.armed = False
    _autopilot_state.active_strategies = []
    _autopilot_state.kill_switch_triggered = True
    
    logger.warning("automation_kill_switch_triggered")
    return _autopilot_state


@router.post("/automation/reset", response_model=AutopilotStatusResponse)
async def reset_automation():
    """Reset autopilot after kill switch trigger."""
    global _autopilot_state
    
    _autopilot_state.kill_switch_triggered = False
    
    # Also reset unified autopilot engine kill switch
    try:
        from ...autopilot.unified_engine import get_unified_engine
        engine = get_unified_engine()
        engine.deactivate_kill_switch()
    except Exception:
        pass
    
    logger.info("automation_reset")
    return _autopilot_state


@router.put("/automation/budget", response_model=AutopilotStatusResponse)
async def update_budget(budget: BudgetConfig):
    """Update budget controls."""
    global _autopilot_state
    
    if _autopilot_state.armed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update budget while armed. Disarm first."
        )
    
    _autopilot_state.budget = budget
    
    logger.info("automation_budget_updated", budget=budget.model_dump())
    return _autopilot_state


@router.put("/automation/forecast-config", response_model=AutopilotStatusResponse)
async def update_forecast_config(config: ForecastConfigModel):
    """Update forecast integration configuration."""
    global _autopilot_state
    
    # Validate confidence level
    valid_levels = [0.68, 0.95, 0.99]
    if config.confidence_level not in valid_levels:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"confidence_level must be one of {valid_levels}"
        )
    
    _autopilot_state.forecast_config = config
    
    logger.info("automation_forecast_config_updated", config=config.model_dump())
    return _autopilot_state


@router.get("/automation/forecast-status", response_model=ForecastStatusModel)
async def get_forecast_status(symbol: str = "AAPL"):
    """Get current forecast status for a symbol."""
    from ...automation.unified_controller import get_unified_controller, ForecastBias
    
    controller = get_unified_controller()
    
    # Fetch minimal forecast (would use cached data in production)
    try:
        import yfinance as yf
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="3mo")
        if hist.empty:
            return ForecastStatusModel(symbol=symbol)
        
        prices = hist['Close'].tolist()
        current_price = prices[-1]
        
        context = await controller.get_forecast_context(symbol, prices, current_price)
        
        return ForecastStatusModel(
            symbol=symbol.upper(),
            bias=context.bias.value,
            historical_volatility=round(context.historical_volatility, 4),
            upper_bound_30d=round(context.upper_bound_30d, 2),
            lower_bound_30d=round(context.lower_bound_30d, 2),
            size_multiplier=round(context.size_multiplier, 2)
        )
    except Exception as e:
        logger.error("forecast_status_error", symbol=symbol, error=str(e))
        return ForecastStatusModel(symbol=symbol)


# ============================================================================
# Job Queue Endpoints
# ============================================================================

@router.get("/automation/jobs", response_model=List[JobResponse])
async def list_jobs(status_filter: Optional[str] = None):
    """List all automation jobs."""
    queue = get_job_queue()
    
    status_enum = None
    if status_filter:
        try:
            status_enum = JobStatus(status_filter)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status_filter}"
            )
    
    jobs = queue.list_jobs(status=status_enum)
    
    return [
        JobResponse(
            id=job.id,
            name=job.spec.name,
            type=job.spec.job_type.value,
            status=job.status.value,
            created_at=job.created_at.isoformat(),
            started_at=job.started_at.isoformat() if job.started_at else None,
            completed_at=job.completed_at.isoformat() if job.completed_at else None,
        )
        for job in jobs
    ]


@router.post("/automation/jobs", response_model=Dict[str, str])
async def create_job(request: JobSubmitRequest):
    """Submit a new automation job."""
    try:
        job_type = JobType(request.job_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid job_type: {request.job_type}. Valid: local, colab, cloud_run"
        )
    
    spec = JobSpec(
        name=request.name,
        job_type=job_type,
        entrypoint=request.entrypoint,
        parameters=request.parameters,
        timeout_seconds=request.timeout_seconds,
        priority=request.priority,
    )
    
    job_id = submit_job(spec)
    
    logger.info("automation_job_submitted", job_id=job_id, name=request.name)
    return {"job_id": job_id}


@router.get("/automation/jobs/{job_id}", response_model=Optional[JobResponse])
async def get_job(job_id: str):
    """Get job status by ID."""
    job_dict = get_job_status(job_id)
    
    if not job_dict:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job not found: {job_id}"
        )
    
    return JobResponse(
        id=job_dict["id"],
        name=job_dict["name"],
        type=job_dict["type"],
        status=job_dict["status"],
        created_at=job_dict["created_at"],
        started_at=job_dict.get("started_at"),
        completed_at=job_dict.get("completed_at"),
    )


@router.delete("/automation/jobs/{job_id}")
async def cancel_job(job_id: str):
    """Cancel a pending/queued job."""
    queue = get_job_queue()
    
    success = queue.cancel_job(job_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job {job_id} cannot be cancelled (may not exist or already running)."
        )
    
    logger.info("automation_job_cancelled", job_id=job_id)
    return {"status": "cancelled", "job_id": job_id}


# ============================================================================
# Readiness Score Endpoint (Placeholder)
# ============================================================================

@router.get("/automation/readiness/{strategy_id}")
async def get_strategy_readiness(strategy_id: str):
    """
    Get readiness score for a strategy.
    
    Readiness score indicates how ready a strategy is for live trading,
    based on backtest results, robustness suite, and regime alignment.
    """
    # Placeholder: In production, this would query backtest results,
    # robustness metrics, and current regime classification.
    
    return {
        "strategy_id": strategy_id,
        "readiness_score": 0.75,
        "factors": {
            "backtest_sharpe": 1.2,
            "robustness_passed": True,
            "regime_aligned": True,
            "drawdown_acceptable": True,
        },
        "recommendation": "Paper trading recommended before live deployment."
    }
