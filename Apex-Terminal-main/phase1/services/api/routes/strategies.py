"""
Strategies API - REST endpoints for strategy management.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
from datetime import datetime
from enum import Enum


router = APIRouter(tags=["Strategies"])


class StrategyStatus(str, Enum):
    CREATED = "created"
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"
    ERROR = "error"


# In-memory storage (would be database in production)
_strategies: Dict[str, dict] = {
    "sample-mean-reversion": {
        "id": "sample-mean-reversion",
        "name": "Sample Mean Reversion",
        "strategy_type": "standard",
        "symbol": "AAPL",
        "status": StrategyStatus.STOPPED.value,
        "params": {},
        "risk_limits": {},
        "created_at": datetime.utcnow().isoformat(),
    },
    "sample-breakout": {
        "id": "sample-breakout",
        "name": "Sample Breakout",
        "strategy_type": "standard",
        "symbol": "TSLA",
        "status": StrategyStatus.STOPPED.value,
        "params": {},
        "risk_limits": {},
        "created_at": datetime.utcnow().isoformat(),
    },
    "rsi-oversold-bounce": {
        "id": "rsi-oversold-bounce",
        "name": "RSI Oversold Bounce",
        "strategy_type": "mean_reversion",
        "symbol": "MSFT",
        "status": StrategyStatus.STOPPED.value,
        "params": {"rsi_period": 14, "oversold_threshold": 30},
        "risk_limits": {"max_position_size": 100},
        "created_at": datetime.utcnow().isoformat(),
    },
    "momentum-breakout": {
        "id": "momentum-breakout",
        "name": "Momentum Breakout",
        "strategy_type": "trend_following",
        "symbol": "NVDA",
        "status": StrategyStatus.STOPPED.value,
        "params": {"lookback_period": 20, "breakout_threshold": 1.02},
        "risk_limits": {"max_position_size": 50},
        "created_at": datetime.utcnow().isoformat(),
    },
    "vwap-reversion": {
        "id": "vwap-reversion",
        "name": "VWAP Mean Reversion",
        "strategy_type": "mean_reversion",
        "symbol": "SPY",
        "status": StrategyStatus.STOPPED.value,
        "params": {"vwap_deviation": 0.5},
        "risk_limits": {"max_position_size": 200},
        "created_at": datetime.utcnow().isoformat(),
    },
}
_running_strategies: Dict[str, Any] = {}


class CreateStrategyRequest(BaseModel):
    name: str
    strategy_type: str  # e.g., "sma_crossover", "rsi_breakout", "vwap_reversion"
    symbol: str
    params: Dict[str, Any] = {}
    risk_limits: Dict[str, float] = {}


class StrategyResponse(BaseModel):
    id: str
    name: str
    strategy_type: str
    symbol: str
    status: str
    params: Dict[str, Any]
    created_at: str
    started_at: Optional[str] = None
    metrics: Dict[str, Any] = {}


@router.post("", response_model=StrategyResponse)
async def create_strategy(request: CreateStrategyRequest):
    """Create a new strategy."""
    import uuid
    
    strategy_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    
    strategy = {
        "id": strategy_id,
        "name": request.name,
        "strategy_type": request.strategy_type,
        "symbol": request.symbol,
        "params": request.params,
        "risk_limits": request.risk_limits,
        "status": StrategyStatus.CREATED.value,
        "created_at": now,
        "started_at": None,
        "metrics": {},
    }
    
    _strategies[strategy_id] = strategy
    
    return StrategyResponse(**strategy)


@router.get("", response_model=List[StrategyResponse])
async def list_strategies():
    """List all strategies."""
    return [StrategyResponse(**s) for s in _strategies.values()]


@router.get("/{strategy_id}", response_model=StrategyResponse)
async def get_strategy(strategy_id: str):
    """Get a specific strategy."""
    if strategy_id not in _strategies:
        raise HTTPException(status_code=404, detail="Strategy not found")
    
    return StrategyResponse(**_strategies[strategy_id])


@router.post("/{strategy_id}/start")
async def start_strategy(strategy_id: str, background_tasks: BackgroundTasks):
    """Start a strategy."""
    if strategy_id not in _strategies:
        raise HTTPException(status_code=404, detail="Strategy not found")
    
    strategy = _strategies[strategy_id]
    
    if strategy["status"] == StrategyStatus.RUNNING.value:
        raise HTTPException(status_code=400, detail="Strategy already running")
    
    # Update status
    strategy["status"] = StrategyStatus.RUNNING.value
    strategy["started_at"] = datetime.utcnow().isoformat()
    
    # In a real implementation, this would start the strategy in background
    # background_tasks.add_task(run_strategy, strategy_id)
    
    return {"status": "started", "strategy_id": strategy_id}


@router.post("/{strategy_id}/stop")
async def stop_strategy(strategy_id: str):
    """Stop a running strategy."""
    if strategy_id not in _strategies:
        raise HTTPException(status_code=404, detail="Strategy not found")
    
    strategy = _strategies[strategy_id]
    
    if strategy["status"] != StrategyStatus.RUNNING.value:
        raise HTTPException(status_code=400, detail="Strategy not running")
    
    strategy["status"] = StrategyStatus.STOPPED.value
    
    # Stop the running strategy
    if strategy_id in _running_strategies:
        # Would stop the actual strategy here
        del _running_strategies[strategy_id]
    
    return {"status": "stopped", "strategy_id": strategy_id}


@router.post("/{strategy_id}/pause")
async def pause_strategy(strategy_id: str):
    """Pause a running strategy."""
    if strategy_id not in _strategies:
        raise HTTPException(status_code=404, detail="Strategy not found")
    
    strategy = _strategies[strategy_id]
    
    if strategy["status"] != StrategyStatus.RUNNING.value:
        raise HTTPException(status_code=400, detail="Strategy not running")
    
    strategy["status"] = StrategyStatus.PAUSED.value
    
    return {"status": "paused", "strategy_id": strategy_id}


@router.delete("/{strategy_id}")
async def delete_strategy(strategy_id: str):
    """Delete a strategy."""
    if strategy_id not in _strategies:
        raise HTTPException(status_code=404, detail="Strategy not found")
    
    strategy = _strategies[strategy_id]
    
    if strategy["status"] == StrategyStatus.RUNNING.value:
        raise HTTPException(status_code=400, detail="Cannot delete running strategy")
    
    del _strategies[strategy_id]
    
    return {"status": "deleted", "strategy_id": strategy_id}


@router.get("/{strategy_id}/metrics")
async def get_strategy_metrics(strategy_id: str):
    """Get strategy performance metrics."""
    if strategy_id not in _strategies:
        raise HTTPException(status_code=404, detail="Strategy not found")
    
    strategy = _strategies[strategy_id]
    
    # Return current metrics
    return {
        "strategy_id": strategy_id,
        "status": strategy["status"],
        "metrics": strategy.get("metrics", {}),
    }
