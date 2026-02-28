"""
regime_detection_routes.py — Regime Detection Engine REST API
===============================================================
Market regime classification, volatility regime, trend strength, momentum,
structural breaks, cycle phases, transitions, strategy recommendations.

Endpoints:
    POST /api/v2/regime/market              → Market regime classification
    POST /api/v2/regime/volatility          → Volatility regime
    POST /api/v2/regime/trend               → Trend regime classification
    POST /api/v2/regime/momentum            → Momentum regime
    POST /api/v2/regime/breaks              → Structural break detection
    POST /api/v2/regime/cycle               → Cycle phase detection
    POST /api/v2/regime/transitions         → Regime transitions
    POST /api/v2/regime/durations           → Regime duration statistics
    POST /api/v2/regime/smooth              → Smooth noisy regimes
    POST /api/v2/regime/state               → Full regime state
    POST /api/v2/regime/strategy            → Strategy recommendation
    POST /api/v2/regime/dashboard           → Full regime dashboard
    GET  /api/v2/regime/capabilities        → Engine capabilities
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from phase1.services.regime_detection_engine import RegimeDetectionEngine

router = APIRouter(prefix="/api/v2/regime", tags=["Regime Detection"])

_engine = RegimeDetectionEngine()


# ── Pydantic Models ─────────────────────────────────────────────────────

class PricesRequest(BaseModel):
    prices: List[float]


class PricesWithHLRequest(BaseModel):
    prices: List[float]
    high: Optional[List[float]] = None
    low: Optional[List[float]] = None


class BreaksRequest(BaseModel):
    prices: List[float]
    method: str = "cusum"


class RegimeListRequest(BaseModel):
    regimes: List[Dict[str, Any]]


class SmoothRequest(BaseModel):
    regimes: List[Dict[str, Any]]
    min_bars: int = 5


# ── Endpoints ───────────────────────────────────────────────────────────

@router.post("/market")
async def classify_market(req: PricesRequest) -> Dict[str, Any]:
    """Classify market regime (bull/bear/neutral)."""
    regimes = _engine.classify_market(req.prices)
    last = regimes[-1] if regimes else {}
    return {
        "current": {
            "regime": last.get("regime", "neutral") if isinstance(last.get("regime"), str) else last.get("regime", "neutral").value if hasattr(last.get("regime"), "value") else "neutral",
            "confidence": last.get("confidence", 0),
        },
        "history_length": len(regimes),
        "last_10": [
            {
                "index": r["index"],
                "regime": r["regime"].value if hasattr(r["regime"], "value") else str(r["regime"]),
                "confidence": r.get("confidence", 0),
            }
            for r in regimes[-10:]
        ],
    }


@router.post("/volatility")
async def classify_volatility(req: PricesRequest) -> Dict[str, Any]:
    """Classify volatility regime."""
    regimes = _engine.classify_volatility(req.prices)
    last = regimes[-1] if regimes else {}
    return {
        "current": {
            "regime": last.get("regime", "normal") if isinstance(last.get("regime"), str) else last.get("regime", "normal").value if hasattr(last.get("regime"), "value") else "normal",
            "vol": last.get("vol", 0),
            "percentile": last.get("percentile", 50),
        },
        "history_length": len(regimes),
    }


@router.post("/trend")
async def classify_trend(req: PricesWithHLRequest) -> Dict[str, Any]:
    """Classify trend regime."""
    regimes = _engine.classify_trend(req.prices, req.high, req.low)
    last = regimes[-1] if regimes else {}
    return {
        "current": {
            "regime": last.get("regime", "range_bound") if isinstance(last.get("regime"), str) else last.get("regime", "range_bound").value if hasattr(last.get("regime"), "value") else "range_bound",
            "efficiency_ratio": last.get("efficiency_ratio", 0),
            "adx": last.get("adx", 0),
        },
        "history_length": len(regimes),
    }


@router.post("/momentum")
async def classify_momentum(req: PricesRequest) -> Dict[str, Any]:
    """Classify momentum regime."""
    regimes = _engine.classify_momentum(req.prices)
    last = regimes[-1] if regimes else {}
    return {
        "current": {
            "regime": last.get("regime", "neutral") if isinstance(last.get("regime"), str) else last.get("regime", "neutral").value if hasattr(last.get("regime"), "value") else "neutral",
            "rsi": last.get("rsi", 50),
            "roc": last.get("roc", 0),
        },
        "history_length": len(regimes),
    }


@router.post("/breaks")
async def detect_breaks(req: BreaksRequest) -> Dict[str, Any]:
    """Detect structural breaks."""
    breaks = _engine.detect_breaks(req.prices, method=req.method)
    return {"breaks": breaks, "total": len(breaks)}


@router.post("/cycle")
async def detect_cycle(req: PricesRequest) -> Dict[str, Any]:
    """Detect cycle phase."""
    phases = _engine.detect_cycle(req.prices)
    last = phases[-1] if phases else {}
    return {
        "current_phase": last.get("phase", "expansion") if isinstance(last.get("phase"), str) else last.get("phase", "expansion").value if hasattr(last.get("phase"), "value") else "expansion",
        "momentum": last.get("momentum", 0),
        "history_length": len(phases),
    }


@router.post("/transitions")
async def get_transitions(req: RegimeListRequest) -> Dict[str, Any]:
    """Get regime transitions."""
    transitions = _engine.get_transitions(req.regimes)
    return {"transitions": transitions, "total": len(transitions)}


@router.post("/durations")
async def get_durations(req: RegimeListRequest) -> Dict[str, Any]:
    """Get regime duration statistics."""
    return _engine.get_durations(req.regimes)


@router.post("/smooth")
async def smooth_regimes(req: SmoothRequest) -> Dict[str, Any]:
    """Smooth noisy regime classification."""
    smoothed = _engine.smooth_regimes(req.regimes, min_bars=req.min_bars)
    return {"smoothed": smoothed, "length": len(smoothed)}


@router.post("/state")
async def full_state(req: PricesRequest) -> Dict[str, Any]:
    """Get full regime state."""
    state = _engine.full_regime_state(req.prices)
    return state.to_dict()


@router.post("/strategy")
async def recommend_strategy(req: PricesRequest) -> Dict[str, Any]:
    """Strategy recommendation based on current regime."""
    return _engine.recommend_strategy(req.prices)


@router.post("/dashboard")
async def full_dashboard(req: PricesRequest) -> Dict[str, Any]:
    """Full regime detection dashboard."""
    return _engine.full_dashboard(req.prices)


@router.get("/capabilities")
async def capabilities() -> Dict[str, Any]:
    """Get engine capabilities."""
    return _engine.capabilities()
