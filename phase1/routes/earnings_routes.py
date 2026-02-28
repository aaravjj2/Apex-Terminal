"""
earnings_routes.py
FastAPI routes for earnings calendar, EPS results, revision tracking,
PEAD analysis, whisper numbers, and sector earnings aggregation.
"""

from __future__ import annotations
import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/earnings", tags=["Earnings"])

# ─── Engine Setup ─────────────────────────────────────────────────────────────

try:
    from services.earnings_engine import EarningsEngine, TICKERS_BY_SECTOR
    _engine = EarningsEngine()
    _engine_ready = True
except Exception as e:
    logger.warning(f"Earnings engine import failed: {e}")
    _engine_ready = False

def _check():
    if not _engine_ready:
        raise HTTPException(status_code=503, detail="Earnings engine unavailable")

# ─── Pydantic Models ──────────────────────────────────────────────────────────

class TickerListRequest(BaseModel):
    tickers: List[str] = Field(default_factory=list)

# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/calendar")
async def get_earnings_calendar(
    days_ahead: int = Query(14, ge=1, le=90, description="Number of days to look ahead"),
    sector: Optional[str] = Query(None),
    importance: Optional[str] = Query(None, description="critical|high|medium|low"),
):
    """Get upcoming earnings calendar with expected moves and consensus estimates."""
    _check()
    try:
        entries = _engine.get_upcoming_calendar(days_ahead)
        if sector:
            entries = [e for e in entries if e.sector.lower() == sector.lower()]
        if importance:
            entries = [e for e in entries if e.importance == importance]
        return {
            "count": len(entries),
            "days_ahead": days_ahead,
            "entries": [
                {
                    "ticker": e.ticker,
                    "company": e.company_name,
                    "sector": e.sector,
                    "report_date": e.report_date.isoformat(),
                    "timing": e.report_timing.value,
                    "eps_consensus": e.eps_consensus,
                    "rev_consensus_m": e.rev_consensus,
                    "eps_growth_est_pct": e.eps_growth_est,
                    "rev_growth_est_pct": e.rev_growth_est,
                    "eps_year_ago": e.eps_year_ago,
                    "expected_move_pct": e.expected_move_pct,
                    "hist_avg_move_pct": e.historical_avg_move_pct,
                    "iv_crush_pct": e.options_iv_crush,
                    "avg_beat_rate_pct": e.avg_beat_rate,
                    "market_cap_b": e.market_cap,
                    "importance": e.importance,
                }
                for e in entries
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/results/{ticker}")
async def get_earnings_results(
    ticker: str,
    num_quarters: int = Query(8, ge=1, le=20),
):
    """Get historical earnings results for a ticker."""
    _check()
    try:
        results = _engine.get_historical_results(ticker.upper(), num_quarters)
        return {
            "ticker": ticker.upper(),
            "num_quarters": len(results),
            "results": [
                {
                    "quarter": r.fiscal_quarter,
                    "report_date": r.report_date.isoformat(),
                    "timing": r.report_timing.value,
                    "eps_actual": r.eps_actual,
                    "eps_consensus": r.eps_consensus,
                    "eps_surprise": r.eps_surprise,
                    "eps_surprise_pct": r.eps_surprise_pct,
                    "eps_direction": r.eps_direction.value,
                    "eps_whisper": r.eps_whisper,
                    "eps_vs_whisper_pct": r.eps_vs_whisper_pct,
                    "rev_actual_m": r.rev_actual,
                    "rev_consensus_m": r.rev_consensus,
                    "rev_surprise_pct": r.rev_surprise_pct,
                    "rev_direction": r.rev_direction.value,
                    "guidance": r.guidance_direction.value,
                    "beat_both": r.beat_both,
                    "gap_pct": r.gap_pct,
                    "next_day_return": r.next_day_return,
                    "one_week_return": r.one_week_return,
                    "one_month_return": r.one_month_return,
                    "management_tone": r.management_tone_score,
                }
                for r in results
            ],
            "summary": {
                "beat_rate": round(sum(1 for r in results if r.eps_direction.value == "BEAT") / len(results), 3),
                "avg_eps_surprise_pct": round(sum(r.eps_surprise_pct for r in results) / len(results), 2),
                "avg_gap_pct": round(sum(r.gap_pct for r in results) / len(results), 2),
                "avg_one_month_return": round(sum(r.one_month_return for r in results) / len(results), 2),
                "guidance_raised_count": sum(1 for r in results if r.guidance_direction.value == "RAISED"),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/revisions/{ticker}")
async def get_eps_revisions(
    ticker: str,
    num_revisions: int = Query(12, ge=1, le=50),
):
    """Get recent analyst EPS revisions for a ticker."""
    _check()
    try:
        revisions = _engine.get_eps_revisions(ticker.upper(), num_revisions)
        score = _engine.get_revision_score(revisions)
        return {
            "ticker": ticker.upper(),
            "revisions": [
                {
                    "firm": r.analyst_firm,
                    "date": r.revision_date.isoformat(),
                    "old_eps": r.old_eps_est,
                    "new_eps": r.new_eps_est,
                    "eps_change": r.eps_change,
                    "eps_change_pct": r.eps_change_pct,
                    "rev_change_pct": r.rev_change_pct,
                    "direction": r.direction,
                }
                for r in revisions
            ],
            "revision_score": score,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pead/{ticker}")
async def get_pead(
    ticker: str,
    num_quarters: int = Query(8, ge=2, le=20),
):
    """Get Post-Earnings Announcement Drift analysis."""
    _check()
    try:
        pead = _engine.get_pead_analysis(ticker.upper(), num_quarters)
        persistent_count = sum(1 for p in pead if p.drift_persistent)
        beat_drift = [p for p in pead if p.beat_miss.value == "BEAT"]
        miss_drift = [p for p in pead if p.beat_miss.value == "MISS"]
        return {
            "ticker": ticker.upper(),
            "pead": [
                {
                    "quarter_date": p.report_date.isoformat(),
                    "eps_surprise_pct": p.eps_surprise_pct,
                    "beat_miss": p.beat_miss.value,
                    "day0_return": p.day0_return,
                    "day1_return": p.day1_return,
                    "day5_return": p.day5_return,
                    "day21_return": p.day21_return,
                    "day63_return": p.day63_return,
                    "drift_persistent": p.drift_persistent,
                    "explanation": p.drift_explanation,
                }
                for p in pead
            ],
            "analytics": {
                "pead_persistence_rate": round(persistent_count / len(pead), 3),
                "avg_beat_1m_return": round(sum(p.day21_return for p in beat_drift) / max(1, len(beat_drift)), 2),
                "avg_miss_1m_return": round(sum(p.day21_return for p in miss_drift) / max(1, len(miss_drift)), 2),
                "avg_beat_day0": round(sum(p.day0_return for p in beat_drift) / max(1, len(beat_drift)), 2),
                "avg_miss_day0": round(sum(p.day0_return for p in miss_drift) / max(1, len(miss_drift)), 2),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/season")
async def get_earnings_season():
    """Get current earnings season summary with sector breakdowns."""
    _check()
    try:
        season = _engine.get_earnings_season()
        return {
            "name": season.season_name,
            "period": {"start": season.start_date.isoformat(), "end": season.end_date.isoformat()},
            "progress": {
                "total": season.total_companies,
                "reported": season.reported_count,
                "pct_complete": round(season.reported_count / max(1, season.total_companies) * 100, 1),
            },
            "results": {
                "beat_count": season.beat_count,
                "miss_count": season.miss_count,
                "inline_count": season.inline_count,
                "beat_rate": round(season.beat_rate * 100, 1),
                "avg_eps_surprise": season.avg_eps_surprise,
                "avg_rev_surprise": season.avg_rev_surprise,
                "guidance_raised_pct": season.guidance_raised_pct,
            },
            "themes": season.key_themes,
            "sectors": [
                {
                    "sector": s.sector,
                    "reported": s.num_reported,
                    "beat_rate_pct": round(s.beat_rate * 100, 1),
                    "avg_eps_surprise_pct": s.avg_eps_surprise_pct,
                    "blended_eps_growth": s.blended_eps_growth,
                    "blended_rev_growth": s.blended_rev_growth,
                    "guidance_score": s.net_guidance_score,
                }
                for s in season.sector_aggregates
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/whisper/{ticker}")
async def get_whisper_accuracy(
    ticker: str,
    num_quarters: int = Query(8, ge=2, le=20),
):
    """Evaluate whisper number accuracy vs actual EPS."""
    _check()
    try:
        return _engine.calc_whisper_accuracy(ticker.upper(), num_quarters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sectors")
async def get_sector_list():
    """List available sectors for earnings filtering."""
    return {"sectors": list(TICKERS_BY_SECTOR.keys())}

@router.get("/health")
async def health_check():
    return {"status": "operational", "engine_ready": _engine_ready}
