"""
API endpoints for controlling the MarketClock (Replay functionality).
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
import structlog

from ...clock.market_clock import get_clock, ClockMode

logger = structlog.get_logger()
router = APIRouter()


class ClockStateResponse(BaseModel):
    mode: str
    current_time_ms: int
    frozen: bool
    speed_multiplier: float
    running: bool


class SetModeRequest(BaseModel):
    mode: str
    start_time_ms: Optional[int] = None


class AdvanceRequest(BaseModel):
    delta_ms: int


class SpeedRequest(BaseModel):
    multiplier: float


class ControlRequest(BaseModel):
    action: str  # freeze, resume, start, stop


@router.get("/", response_model=ClockStateResponse)
async def get_clock_state():
    """Get current clock state."""
    clock = get_clock()
    return clock.get_state()


@router.post("/mode")
async def set_clock_mode(req: SetModeRequest):
    """Set clock mode (LIVE or VIRTUAL)."""
    clock = get_clock()
    try:
        mode = ClockMode(req.mode.lower())
        clock.set_mode(mode, req.start_time_ms)
        return {"status": "ok", "mode": mode.value}
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid mode")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/control")
async def control_clock(req: ControlRequest):
    """Control clock execution (freeze, resume, start, stop)."""
    clock = get_clock()
    action = req.action.lower()
    
    try:
        if action == "freeze":
            ts = clock.freeze()
            return {"status": "ok", "action": "freeze", "time": ts}
        elif action == "resume":
            ts = clock.resume()
            return {"status": "ok", "action": "resume", "time": ts}
        elif action == "start":
            clock.start_running()
            return {"status": "ok", "action": "start"}
        elif action == "stop":
            ts = clock.stop_running()
            return {"status": "ok", "action": "stop", "time": ts}
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/advance")
async def advance_clock(req: AdvanceRequest):
    """Advance virtual clock by delta_ms."""
    clock = get_clock()
    try:
        new_time = clock.advance(req.delta_ms)
        return {"status": "ok", "new_time": new_time}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/speed")
async def set_clock_speed(req: SpeedRequest):
    """Set virtual clock speed multiplier."""
    clock = get_clock()
    try:
        clock.set_speed(req.multiplier)
        return {"status": "ok", "multiplier": req.multiplier}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
