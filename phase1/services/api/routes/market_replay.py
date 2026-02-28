"""
market_replay_routes.py — Market Replay REST API
==================================================
Replay sessions, bar aggregation, order book simulation,
volume profiling, trade simulation, multi-timeframe replay.

Endpoints:
    POST /api/v2/replay/session/create   → Create replay session
    POST /api/v2/replay/session/step     → Step forward
    POST /api/v2/replay/session/seek     → Seek to position
    POST /api/v2/replay/session/state    → Get session state
    POST /api/v2/replay/aggregate        → Aggregate bars
    POST /api/v2/replay/orderbook        → Simulate order book
    POST /api/v2/replay/volume-profile   → Volume profile
    POST /api/v2/replay/trade-sim        → Simulate trade execution
    GET  /api/v2/replay/capabilities     → Engine capabilities
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from phase1.services.market_replay_engine import MarketReplayEngine

router = APIRouter(prefix="/api/v2/replay", tags=["Market Replay"])

_engine = MarketReplayEngine()
_sessions: Dict[str, Any] = {}


class TickData(BaseModel):
    price: float
    volume: float = 1.0
    timestamp: float = 0.0

class CreateSessionRequest(BaseModel):
    session_id: str
    ticks: List[TickData]
    speed: float = 1.0

class StepRequest(BaseModel):
    session_id: str
    n_ticks: int = 1

class SeekRequest(BaseModel):
    session_id: str
    position: int

class AggregateRequest(BaseModel):
    ticks: List[TickData]
    bar_seconds: int = 60

class OrderBookRequest(BaseModel):
    mid_price: float
    n_levels: int = 10
    spread: float = 0.01

class TradeSimRequest(BaseModel):
    ticks: List[TickData]
    entry_price: float
    direction: str = "long"
    stop_loss: float = 0
    take_profit: float = 0


@router.post("/session/create")
def create_session(req: CreateSessionRequest):
    ticks = [(t.price, t.volume, t.timestamp) for t in req.ticks]
    session = _engine.create_session(req.session_id, ticks, req.speed)
    _sessions[req.session_id] = session
    return {"ok": True, "session_id": req.session_id, "total_ticks": len(ticks)}


@router.post("/session/step")
def step_session(req: StepRequest):
    session = _sessions.get(req.session_id)
    if not session:
        raise HTTPException(404, f"Session {req.session_id} not found")
    result = _engine.step(session, req.n_ticks)
    return {"ok": True, "result": result}


@router.post("/session/seek")
def seek_session(req: SeekRequest):
    session = _sessions.get(req.session_id)
    if not session:
        raise HTTPException(404, f"Session {req.session_id} not found")
    _engine.seek(session, req.position)
    return {"ok": True, "position": req.position}


@router.post("/session/state")
def session_state(req: StepRequest):
    session = _sessions.get(req.session_id)
    if not session:
        raise HTTPException(404, f"Session {req.session_id} not found")
    return {"ok": True, "state": _engine.state(session)}


@router.post("/aggregate")
def aggregate(req: AggregateRequest):
    ticks = [(t.price, t.volume, t.timestamp) for t in req.ticks]
    result = _engine.aggregate_bars(ticks, req.bar_seconds)
    return {"ok": True, "bars": result}


@router.post("/orderbook")
def orderbook(req: OrderBookRequest):
    result = _engine.simulate_orderbook(req.mid_price, req.n_levels, req.spread)
    return {"ok": True, "orderbook": result}


@router.post("/volume-profile")
def volume_profile(ticks: List[TickData], num_bins: int = 20):
    data = [(t.price, t.volume) for t in ticks]
    result = _engine.volume_profile(data, num_bins)
    return {"ok": True, "profile": result}


@router.post("/trade-sim")
def trade_sim(req: TradeSimRequest):
    ticks = [(t.price, t.volume, t.timestamp) for t in req.ticks]
    result = _engine.simulate_trade(ticks, req.entry_price, req.direction,
                                    req.stop_loss, req.take_profit)
    return {"ok": True, "trade": result}


@router.get("/capabilities")
def capabilities():
    return {"ok": True, **_engine.capabilities()}
