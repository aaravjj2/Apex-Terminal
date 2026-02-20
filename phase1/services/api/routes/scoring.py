"""
Wave 6 — Entry Scoring (0-100)
Deterministic multi-factor entry scoring for trade candidates.
"""
import hashlib
import json
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/scoring", tags=["scoring"])


class ScoringRequest(BaseModel):
    symbol: str
    strategy: str = "long_call"
    iv_rank: float = 50.0
    trend_score: float = 0.6
    liquidity_score: float = 0.85
    pop: float = 0.65
    regime: str = "neutral"
    dte: int = 30
    spread_pct: float = 0.02


class ScoreBreakdown(BaseModel):
    iv_component: float
    trend_component: float
    liquidity_component: float
    pop_component: float
    regime_component: float
    dte_component: float
    spread_component: float


class ScoringResult(BaseModel):
    symbol: str
    strategy: str
    total_score: int
    grade: str
    breakdown: ScoreBreakdown
    recommendation: str
    config_hash: str


def _compute_score(req: ScoringRequest) -> ScoringResult:
    # Deterministic scoring
    iv_comp = min(req.iv_rank / 100.0, 1.0) * 15
    trend_comp = req.trend_score * 20
    liq_comp = req.liquidity_score * 15
    pop_comp = req.pop * 20
    regime_map = {"bullish": 15, "neutral": 10, "bearish": 5, "volatile": 8}
    regime_comp = regime_map.get(req.regime, 10)
    dte_comp = max(0, min(10, 10 - abs(req.dte - 30) / 3.0))
    spread_comp = max(0, 5 - req.spread_pct * 100)
    total = iv_comp + trend_comp + liq_comp + pop_comp + regime_comp + dte_comp + spread_comp
    total = int(min(100, max(0, total)))

    if total >= 80:
        grade, rec = "A", "Strong entry — execute"
    elif total >= 65:
        grade, rec = "B", "Good entry — consider position size"
    elif total >= 50:
        grade, rec = "C", "Marginal — reduce size or wait"
    elif total >= 35:
        grade, rec = "D", "Weak — skip or hedge"
    else:
        grade, rec = "F", "Avoid — conditions unfavorable"

    config_json = json.dumps(req.model_dump(), sort_keys=True, separators=(",", ":"))
    config_hash = hashlib.sha256(config_json.encode()).hexdigest()

    return ScoringResult(
        symbol=req.symbol,
        strategy=req.strategy,
        total_score=total,
        grade=grade,
        breakdown=ScoreBreakdown(
            iv_component=round(iv_comp, 2),
            trend_component=round(trend_comp, 2),
            liquidity_component=round(liq_comp, 2),
            pop_component=round(pop_comp, 2),
            regime_component=round(regime_comp, 2),
            dte_component=round(dte_comp, 2),
            spread_component=round(spread_comp, 2),
        ),
        recommendation=rec,
        config_hash=config_hash,
    )


DEMO_SCORES = [
    ScoringRequest(symbol="AAPL", strategy="long_call", iv_rank=45, trend_score=0.72, liquidity_score=0.95, pop=0.70, regime="bullish", dte=28, spread_pct=0.01),
    ScoringRequest(symbol="MSFT", strategy="iron_condor", iv_rank=62, trend_score=0.50, liquidity_score=0.90, pop=0.75, regime="neutral", dte=35, spread_pct=0.015),
    ScoringRequest(symbol="TSLA", strategy="put_credit_spread", iv_rank=78, trend_score=0.35, liquidity_score=0.80, pop=0.55, regime="volatile", dte=21, spread_pct=0.03),
    ScoringRequest(symbol="SPY", strategy="call_debit_spread", iv_rank=30, trend_score=0.65, liquidity_score=0.98, pop=0.68, regime="bullish", dte=30, spread_pct=0.005),
]


@router.post("/score")
async def score_entry(req: ScoringRequest):
    return _compute_score(req)


@router.post("/score/batch")
async def score_batch(entries: List[ScoringRequest]):
    results = [_compute_score(e) for e in entries]
    results.sort(key=lambda r: r.total_score, reverse=True)
    return {"scores": [r.model_dump() for r in results], "count": len(results)}


@router.get("/demo")
async def demo_scores():
    return {"scores": [_compute_score(d).model_dump() for d in DEMO_SCORES]}


@router.get("/hash")
async def scoring_hash():
    results = [_compute_score(d) for d in DEMO_SCORES]
    canonical = json.dumps([r.model_dump() for r in results], sort_keys=True, separators=(",", ":"))
    return {"hash": hashlib.sha256(canonical.encode()).hexdigest()}
