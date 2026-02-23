"""
Waves 11-20 — AI Strategy Builder API Routes
StrategySpec DSL, AI generation, guardrails, auto-sweep.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import logging

from ...waves11_20.ai_strategy import (
    get_ai_strategy_builder, IndicatorSpec, IndicatorType,
    SignalRule, SignalType, RiskConstraints,
)

router = APIRouter(prefix="/api/v2/ai-strategy", tags=["ai-strategy-v2"])
logger = logging.getLogger(__name__)


class CreateSpecRequest(BaseModel):
    name: str
    description: str
    indicators: list[dict]
    signals: list[dict]
    universe: Optional[list[str]] = None
    risk: Optional[dict] = None


class AIGenerateRequest(BaseModel):
    objective: str
    constraints: Optional[dict] = None


class LaunchSweepRequest(BaseModel):
    spec_id: str
    param_ranges: list[dict]


@router.post("/specs")
async def create_spec(req: CreateSpecRequest):
    """Create a strategy spec from components."""
    builder = get_ai_strategy_builder()
    try:
        indicators = [
            IndicatorSpec(indicator=IndicatorType(i["indicator"]), params=i.get("params", {}))
            for i in req.indicators
        ]
        signals = [
            SignalRule(
                signal_type=SignalType(s["signal_type"]),
                conditions=s.get("conditions", []),
                priority=s.get("priority", 1),
            )
            for s in req.signals
        ]
        risk = RiskConstraints(**req.risk) if req.risk else None
    except (KeyError, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid spec: {e}")

    spec = builder.create_spec(
        name=req.name,
        description=req.description,
        indicators=indicators,
        signals=signals,
        universe=req.universe,
        risk=risk,
    )
    return spec.to_dict()


@router.get("/specs")
async def list_specs():
    """List all strategy specs."""
    builder = get_ai_strategy_builder()
    specs = builder.list_specs()
    return {"specs": [s.to_dict() for s in specs]}


@router.get("/specs/{spec_id}")
async def get_spec(spec_id: str):
    """Get a specific strategy spec."""
    builder = get_ai_strategy_builder()
    spec = builder.get_spec(spec_id)
    if not spec:
        raise HTTPException(status_code=404, detail=f"Spec {spec_id} not found")
    return spec.to_dict()


@router.post("/specs/{spec_id}/validate")
async def validate_spec(spec_id: str):
    """Validate a strategy spec against guardrails."""
    builder = get_ai_strategy_builder()
    spec = builder.get_spec(spec_id)
    if not spec:
        raise HTTPException(status_code=404, detail=f"Spec {spec_id} not found")

    results = builder.validate_guardrails(spec)
    all_pass = all(r.status.value == "pass" for r in results)
    return {
        "spec_id": spec_id,
        "valid": all_pass,
        "results": [r.to_dict() for r in results],
    }


@router.post("/generate/prompt")
async def generate_prompt(req: AIGenerateRequest):
    """Build an AI prompt for strategy generation."""
    builder = get_ai_strategy_builder()
    prompt = builder.build_ai_prompt(req.objective, req.constraints)
    return {"prompt": prompt, "objective": req.objective}


@router.post("/generate/parse")
async def parse_ai_response(ai_json: str):
    """Parse AI-generated strategy JSON into a spec."""
    builder = get_ai_strategy_builder()
    spec = builder.parse_ai_response(ai_json)
    if not spec:
        raise HTTPException(status_code=400, detail="Failed to parse AI response")
    return spec.to_dict()


@router.post("/sweeps")
async def launch_sweep(req: LaunchSweepRequest):
    """Launch a parameter sweep job."""
    builder = get_ai_strategy_builder()
    spec = builder.get_spec(req.spec_id)
    if not spec:
        raise HTTPException(status_code=404, detail=f"Spec {req.spec_id} not found")

    job = builder.launch_sweep(spec, req.param_ranges)
    return job.to_dict()


@router.get("/sweeps")
async def list_sweeps():
    """List all sweep jobs."""
    builder = get_ai_strategy_builder()
    sweeps = builder.list_sweeps()
    return {"sweeps": [s.to_dict() for s in sweeps]}


@router.get("/sweeps/{job_id}")
async def get_sweep(job_id: str):
    """Get sweep job status."""
    builder = get_ai_strategy_builder()
    job = builder.get_sweep(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Sweep {job_id} not found")
    return job.to_dict()
