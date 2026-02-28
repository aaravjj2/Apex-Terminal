"""
FastAPI routes for SectorAnalysisEngine — rotation, correlation, breadth, valuation.
"""
from __future__ import annotations

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.sector_analysis_engine import (
    SectorAnalysisEngine,
    SectorData,
    GICSSector,
    BusinessCyclePhase,
)

router = APIRouter(prefix="/api/sector-analysis", tags=["Sector Analysis"])
_engine = SectorAnalysisEngine()


# ─── Request / Response Models ────────────────────────────────────────────────

class SectorDataInput(BaseModel):
    sector: str = Field(..., description="GICS sector name (e.g. information_technology)")
    returns_history: List[float] = Field(default_factory=list, description="Daily return series")
    market_cap_b: float = Field(0.0, description="Sector market cap in billions")
    num_stocks: int = Field(0, description="Number of stocks in sector")
    pe_ratio: float = Field(0.0, description="Blended P/E ratio")
    revenue_growth: float = Field(0.0, description="YoY revenue growth")
    earnings_growth: float = Field(0.0, description="YoY earnings growth")
    dividend_yield: float = Field(0.0, description="Dividend yield decimal")


class RankSectorsRequest(BaseModel):
    sectors: List[SectorDataInput]
    period: str = Field("mtd", description="Ranking period: mtd|ytd|momentum_3m|momentum_6m|momentum_12m")


class CorrelationRequest(BaseModel):
    sectors: List[SectorDataInput]


class BreadthRequest(BaseModel):
    sector: str
    individual_stock_returns: List[float] = Field(..., description="Return per stock (positive = advancing)")


class ValuationRequest(BaseModel):
    sectors: List[SectorDataInput]
    risk_free_rate: float = Field(0.045, description="Risk-free rate for yield-spread analysis")


class CycleAllocationRequest(BaseModel):
    phase: str = Field(..., description="Business cycle phase: early_cycle|late_cycle|mid_cycle|recession")


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _parse_sector(inp: SectorDataInput) -> SectorData:
    try:
        sector_enum = GICSSector(inp.sector.upper())
    except ValueError:
        # Try matching by name
        sector_map = {s.value.replace(" ", "_").lower(): s for s in GICSSector}
        matched = sector_map.get(inp.sector.lower().replace(" ", "_"))
        if matched is None:
            raise ValueError(f"Unknown sector: {inp.sector}")
        sector_enum = matched
    return SectorData(
        sector=sector_enum,
        returns_history=inp.returns_history,
        market_cap_b=inp.market_cap_b,
        num_stocks=inp.num_stocks,
        pe_ratio=inp.pe_ratio,
        revenue_growth=inp.revenue_growth,
        earnings_growth=inp.earnings_growth,
        dividend_yield=inp.dividend_yield,
    )


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/capabilities")
def get_capabilities():
    """Return engine capabilities and supported sectors."""
    return _engine.capabilities()


@router.post("/rank")
def rank_sectors(body: RankSectorsRequest):
    """Rank sectors by performance over a specified period."""
    try:
        sector_objects = [_parse_sector(s) for s in body.sectors]
        results = _engine.rank_sectors(sector_objects, body.period)
        return {"period": body.period, "count": len(results), "rankings": results}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/rotation")
def detect_rotation(body: RankSectorsRequest):
    """Detect current sector rotation — leaders, laggards, accelerating, decelerating."""
    try:
        sector_objects = [_parse_sector(s) for s in body.sectors]
        result = _engine.detect_rotation(sector_objects)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/cycle-allocation")
def cycle_allocation(body: CycleAllocationRequest):
    """Get sector allocation weights recommended for a given business cycle phase."""
    try:
        phase_map = {p.value: p for p in BusinessCyclePhase}
        if body.phase not in phase_map:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown phase '{body.phase}'. Valid: {list(phase_map.keys())}"
            )
        result = _engine.cycle_allocation(phase_map[body.phase])
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/correlation-matrix")
def correlation_matrix(body: CorrelationRequest):
    """Compute pairwise return correlations across sectors."""
    try:
        sector_objects = [_parse_sector(s) for s in body.sectors]
        matrix = _engine.correlation_matrix(sector_objects)
        diversification = 1.0  # default
        if len(sector_objects) >= 2:
            from services.sector_analysis_engine import SectorCorrelationAnalyzer
            diversification = SectorCorrelationAnalyzer.diversification_score(matrix)
        return {"correlation_matrix": matrix, "diversification_score": diversification}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/breadth")
def sector_breadth(body: BreadthRequest):
    """Compute sector market breadth (advancing/declining counts)."""
    try:
        sector_map = {s.value.lower(): s for s in GICSSector}
        sector_enum = sector_map.get(body.sector.lower())
        if sector_enum is None:
            raise HTTPException(status_code=400, detail=f"Unknown sector: {body.sector}")
        result = _engine.sector_breadth(sector_enum, body.individual_stock_returns)
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/market-breadth")
def market_breadth(sector_breadths: List[Dict[str, Any]]):
    """Aggregate breadth data across all sectors into a market breadth summary."""
    try:
        result = _engine.market_breadth(sector_breadths)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/valuation")
def valuation_snapshot(body: ValuationRequest):
    """Analyze sector valuations vs historical medians."""
    try:
        sector_objects = [_parse_sector(s) for s in body.sectors]
        results = _engine.valuation_snapshot(sector_objects)
        yield_spreads = _engine.sectors_yield_spread(sector_objects, body.risk_free_rate)
        return {"pe_analysis": results, "yield_spread_analysis": yield_spreads}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/jdj-ranking")
def jdj_ranking(body: RankSectorsRequest):
    """Rank sectors using the Dudack JDJ composite score (momentum + earnings + revenue)."""
    try:
        sector_objects = [_parse_sector(s) for s in body.sectors]
        results = _engine.jdj_ranking(sector_objects)
        return {"count": len(results), "rankings": results}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/dispersion")
def dispersion(body: RankSectorsRequest):
    """Compute return dispersion across the sector universe."""
    try:
        sector_objects = [_parse_sector(s) for s in body.sectors]
        result = _engine.dispersion(sector_objects)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
