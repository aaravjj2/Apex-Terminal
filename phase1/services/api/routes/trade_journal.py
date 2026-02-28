"""
trade_journal_routes.py — Trade Journal Engine REST API
=========================================================
Trade logging, performance analysis, streaks, R-multiples, discipline scoring,
equity curves, holding period analysis, calendar heatmaps, cost analysis.

Endpoints:
    POST /api/v2/journal/trade              → Add a trade
    POST /api/v2/journal/trade/close        → Close a trade
    GET  /api/v2/journal/summary            → Portfolio summary
    POST /api/v2/journal/performance        → Performance by dimension
    GET  /api/v2/journal/streaks            → Win/loss streaks
    POST /api/v2/journal/r-analysis         → R-multiple analysis
    GET  /api/v2/journal/discipline         → Discipline score
    POST /api/v2/journal/equity-curve       → Equity curve
    POST /api/v2/journal/holding-analysis   → Holding period analysis
    GET  /api/v2/journal/heatmap            → Calendar heatmap
    GET  /api/v2/journal/costs              → Cost analysis
    POST /api/v2/journal/similar            → Find similar trades
    GET  /api/v2/journal/capabilities       → Engine capabilities
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from phase1.services.trade_journal_engine import (
    TradeJournalEngine, TradeDirection, TradeStatus,
    EmotionalState, SetupType, MistakeType,
)

router = APIRouter(prefix="/api/v2/journal", tags=["Trade Journal"])

# ── Shared engine instance ──────────────────────────────────────────────
_engine = TradeJournalEngine()


# ── Pydantic Models ─────────────────────────────────────────────────────

class AddTradeRequest(BaseModel):
    symbol: str
    direction: str = "long"
    entry_price: float
    entry_time: Optional[str] = None
    quantity: float = 1.0
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    setup_type: Optional[str] = None
    emotional_state_entry: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    notes: str = ""
    planned_risk: Optional[float] = None
    timeframe: str = ""
    confidence_level: Optional[float] = None
    followed_plan: bool = True
    commission: float = 0.0
    slippage: float = 0.0


class CloseTradeRequest(BaseModel):
    trade_id: str
    exit_price: float
    exit_time: Optional[str] = None
    emotional_state_exit: Optional[str] = None
    mistakes: List[str] = Field(default_factory=list)
    lesson_learned: str = ""


class PerformanceDimensionRequest(BaseModel):
    dimension: str = "setup_type"


class EquityCurveRequest(BaseModel):
    initial_capital: float = 10000.0


class FindSimilarRequest(BaseModel):
    trade_id: str
    top_n: int = 5


# ── Endpoints ───────────────────────────────────────────────────────────

@router.post("/trade")
async def add_trade(req: AddTradeRequest) -> Dict[str, Any]:
    """Add a new trade to the journal."""
    try:
        direction = TradeDirection(req.direction)
    except ValueError:
        direction = TradeDirection.LONG

    setup = None
    if req.setup_type:
        try:
            setup = SetupType(req.setup_type)
        except ValueError:
            setup = None

    emo_entry = None
    if req.emotional_state_entry:
        try:
            emo_entry = EmotionalState(req.emotional_state_entry)
        except ValueError:
            emo_entry = None

    entry_time = datetime.fromisoformat(req.entry_time) if req.entry_time else datetime.now()

    trade_id = _engine.add_trade(
        symbol=req.symbol,
        direction=direction,
        entry_price=req.entry_price,
        entry_time=entry_time,
        quantity=req.quantity,
        stop_loss=req.stop_loss,
        take_profit=req.take_profit,
        setup_type=setup,
        emotional_state_entry=emo_entry,
        tags=req.tags,
        notes=req.notes,
        planned_risk=req.planned_risk,
        timeframe=req.timeframe,
        confidence_level=req.confidence_level,
        followed_plan=req.followed_plan,
        commission=req.commission,
        slippage=req.slippage,
    )
    return {"trade_id": trade_id, "status": "added"}


@router.post("/trade/close")
async def close_trade(req: CloseTradeRequest) -> Dict[str, Any]:
    """Close an open trade."""
    emo_exit = None
    if req.emotional_state_exit:
        try:
            emo_exit = EmotionalState(req.emotional_state_exit)
        except ValueError:
            emo_exit = None

    mistakes = []
    for m in req.mistakes:
        try:
            mistakes.append(MistakeType(m))
        except ValueError:
            pass

    exit_time = datetime.fromisoformat(req.exit_time) if req.exit_time else datetime.now()

    result = _engine.close_trade(
        trade_id=req.trade_id,
        exit_price=req.exit_price,
        exit_time=exit_time,
        emotional_state_exit=emo_exit,
        mistakes=mistakes,
        lesson_learned=req.lesson_learned,
    )
    return result


@router.get("/summary")
async def get_summary() -> Dict[str, Any]:
    """Get portfolio summary statistics."""
    return _engine.get_summary()


@router.post("/performance")
async def get_performance(req: PerformanceDimensionRequest) -> Dict[str, Any]:
    """Get performance breakdown by dimension."""
    return _engine.get_performance_by(req.dimension)


@router.get("/streaks")
async def get_streaks() -> Dict[str, Any]:
    """Get win/loss streak analysis."""
    return _engine.get_streaks()


@router.post("/r-analysis")
async def get_r_analysis() -> Dict[str, Any]:
    """Get R-multiple analysis."""
    return _engine.get_r_analysis()


@router.get("/discipline")
async def get_discipline() -> Dict[str, Any]:
    """Get discipline score."""
    return _engine.get_discipline_score()


@router.post("/equity-curve")
async def get_equity_curve(req: EquityCurveRequest) -> Dict[str, Any]:
    """Get equity curve data."""
    return _engine.get_equity_curve(req.initial_capital)


@router.post("/holding-analysis")
async def get_holding_analysis() -> Dict[str, Any]:
    """Get holding period analysis."""
    return _engine.get_holding_analysis()


@router.get("/heatmap")
async def get_heatmap() -> Dict[str, Any]:
    """Get calendar heatmap data."""
    return _engine.get_calendar_heatmap()


@router.get("/costs")
async def get_costs() -> Dict[str, Any]:
    """Get cost analysis."""
    return _engine.get_cost_analysis()


@router.post("/similar")
async def find_similar(req: FindSimilarRequest) -> Dict[str, Any]:
    """Find similar trades."""
    return {"similar_trades": _engine.find_similar_trades(req.trade_id, req.top_n)}


@router.get("/capabilities")
async def capabilities() -> Dict[str, Any]:
    """Get engine capabilities."""
    return _engine.capabilities()
