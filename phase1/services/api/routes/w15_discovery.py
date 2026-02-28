"""
Waves 11-20 — Strategy Discovery API Routes
Candidate generation, walk-forward, robustness, portfolio selection.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import logging

from ...waves11_20.discovery import (
    get_discovery_engine, StrategyTemplate
)

router = APIRouter(prefix="/api/v2/discovery", tags=["discovery-v2"])
logger = logging.getLogger(__name__)


class GenerateCandidatesRequest(BaseModel):
    template: str  # StrategyTemplate value
    max_candidates: int = 20


class WalkForwardRequest(BaseModel):
    candidate_id: str
    sharpe_values: list[list[float]]  # [[in_sample, out_sample], ...]
    min_degradation: float = 0.5


class RobustnessRequest(BaseModel):
    candidate_id: str
    neighbor_sharpes: list[float]
    regime_sharpes: list[float]
    base_sharpe: float


@router.get("/templates")
async def list_templates():
    """List available strategy templates."""
    return {
        "templates": [
            {"id": t.value, "name": t.name}
            for t in StrategyTemplate
        ]
    }


@router.post("/candidates/generate")
async def generate_candidates(req: GenerateCandidatesRequest):
    """Generate strategy candidates from a template."""
    engine = get_discovery_engine()
    try:
        template = StrategyTemplate(req.template)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown template: {req.template}")

    candidates = engine.generate_candidates(template, req.max_candidates)
    return {
        "template": req.template,
        "candidates": [c.to_dict() for c in candidates],
        "count": len(candidates),
    }


@router.post("/evaluate/walk-forward")
async def evaluate_walk_forward(req: WalkForwardRequest):
    """Evaluate walk-forward stability for a candidate."""
    engine = get_discovery_engine()
    candidate = next(
        (c for c in engine._candidates if c.candidate_id == req.candidate_id),
        None,
    )
    if not candidate:
        raise HTTPException(status_code=404, detail=f"Candidate {req.candidate_id} not found")

    sharpe_tuples = [(s[0], s[1]) for s in req.sharpe_values]
    result = engine.evaluate_walk_forward(candidate, sharpe_tuples, req.min_degradation)
    return result.to_dict()


@router.post("/evaluate/robustness")
async def evaluate_robustness(req: RobustnessRequest):
    """Evaluate robustness for a candidate."""
    engine = get_discovery_engine()
    candidate = next(
        (c for c in engine._candidates if c.candidate_id == req.candidate_id),
        None,
    )
    if not candidate:
        raise HTTPException(status_code=404, detail=f"Candidate {req.candidate_id} not found")

    result = engine.evaluate_robustness(
        candidate, req.neighbor_sharpes, req.regime_sharpes, req.base_sharpe,
    )
    return result.to_dict()


@router.post("/portfolio/select")
async def select_portfolio(
    max_strategies: int = Query(default=3),
    min_robustness: float = Query(default=0.5),
):
    """Select a low-correlation portfolio of strategies."""
    engine = get_discovery_engine()
    selected = engine.select_portfolio(
        engine._candidates, max_strategies, min_robustness,
    )
    return {"selected": selected, "count": len(selected)}


@router.post("/report")
async def generate_report():
    """Generate a comprehensive discovery report."""
    engine = get_discovery_engine()
    report = engine.generate_report()
    return report.to_dict()


@router.get("/reports")
async def list_reports():
    """List all discovery reports."""
    engine = get_discovery_engine()
    reports = engine.get_reports()
    return {"reports": [r.to_dict() for r in reports]}
