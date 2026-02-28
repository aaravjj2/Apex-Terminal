"""
screener_v4.py — Stock Screener API Routes (v4)
=================================================
REST API powered by screener_engine.py

Endpoints:
    POST /api/v4/screener/screen        → Screen universe with custom criteria
    POST /api/v4/screener/quick         → Quick screen with preset (momentum/value/growth/etc.)
    POST /api/v4/screener/score         → Compute composite scores for universe
    POST /api/v4/screener/rank          → Multi-factor ranking
    GET  /api/v4/screener/presets       → List available preset screeners
    POST /api/v4/screener/alerts/add    → Add a price/indicator alert
    POST /api/v4/screener/alerts/check  → Check alerts against snapshot
    POST /api/v4/screener/piotroski     → Compute Piotroski F-Score
    POST /api/v4/screener/altman_z      → Compute Altman Z-Score
    POST /api/v4/screener/technical     → Compute all technical columns for OHLCV data
"""

from __future__ import annotations
import math
from typing import Any, Dict, List, Literal, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
import numpy as np
import pandas as pd

try:
    from ...screener_engine import (
        ScreenerEngine,
        Criterion,
        CriterionType,
        compute_technical_columns,
        compute_rs_ranks,
        compute_technical_score,
        compute_momentum_score,
        compute_fundamental_score,
        compute_composite_score,
        rank_universe,
        piotroski_f_score,
        altman_z_score,
        screener_to_dict,
        momentum_screener,
        value_screener,
        growth_screener,
        mean_reversion_screener,
        quality_screener,
        rsi_filter,
        adx_filter,
        volume_filter,
        above_200sma_filter,
        golden_cross_filter,
        sector_filter,
        AlertEngine,
        Alert,
        build_screening_result_summary,
    )
    _SCREENER_AVAILABLE = True
except ImportError:
    _SCREENER_AVAILABLE = False


router = APIRouter(prefix="/api/v4/screener", tags=["Screener v4"])


# ─── GLOBAL ALERT ENGINE ──────────────────────────────────────────────────────

_alert_engine = AlertEngine()


# ─── PYDANTIC MODELS ──────────────────────────────────────────────────────────

class OHLCVBar(BaseModel):
    timestamp: Optional[str] = None
    open:      float
    high:      float
    low:       float
    close:     float
    volume:    float = 0.0


class SymbolData(BaseModel):
    symbol: str
    bars:   List[OHLCVBar]
    fundamentals: Optional[Dict[str, float]] = None  # pe_ratio, roe, etc.


class ScreenRequest(BaseModel):
    universe: List[SymbolData]
    criteria: List[Dict[str, Any]] = []
    sort_by:  str = "composite_score"
    ascending: bool = False
    max_results: int = Field(100, ge=1, le=500)


class QuickScreenRequest(BaseModel):
    universe: List[SymbolData]
    preset:   Literal["momentum", "value", "growth", "mean_reversion", "quality"] = "momentum"
    max_results: int = Field(50, ge=1, le=500)


class ScoreRequest(BaseModel):
    universe: List[SymbolData]


class RankRequest(BaseModel):
    universe: List[SymbolData]
    factors: Optional[Dict[str, Dict]] = None  # {column: {weight, ascending}}


class AlertAddRequest(BaseModel):
    symbol:    str
    name:      str
    column:    str   # e.g., "close", "rsi_14", "relative_volume"
    condition: Literal["above", "below", "crosses_above", "crosses_below"]
    threshold: float
    notify_once: bool = True


class AlertCheckRequest(BaseModel):
    universe: List[SymbolData]


class PiotroskiRequest(BaseModel):
    data: Dict[str, Any]  # {roa: float, roa_change: float, ...} per symbol or universe


class TechnicalRequest(BaseModel):
    bars: List[OHLCVBar]


# ─── HELPERS ──────────────────────────────────────────────────────────────────

def safe(v) -> Optional[float]:
    if v is None:
        return None
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 6)
    except Exception:
        return None


def symbol_data_to_df(sd: SymbolData) -> pd.DataFrame:
    """Convert SymbolData to OHLCV DataFrame, attaching fundamental columns."""
    rows = []
    for bar in sd.bars:
        rows.append({
            "open":   bar.open,
            "high":   bar.high,
            "low":    bar.low,
            "close":  bar.close,
            "volume": bar.volume,
        })
    df = pd.DataFrame(rows)
    if sd.bars and sd.bars[0].timestamp:
        try:
            df.index = pd.to_datetime([b.timestamp for b in sd.bars])
        except Exception:
            pass

    # Attach fundamentals as scalar columns (same value for all rows — snapshot)
    if sd.fundamentals:
        for k, v in sd.fundamentals.items():
            df[k] = v

    return df


def build_universe_snapshot(universe: List[SymbolData]) -> pd.DataFrame:
    """
    Build a snapshot DataFrame (one row per symbol) with all indicator + fundamental columns.
    """
    rows = []
    for sd in universe:
        if len(sd.bars) < 5:
            continue
        try:
            df = symbol_data_to_df(sd)
            enriched = compute_technical_columns(df)
            row = enriched.iloc[-1].copy()
            row["symbol"] = sd.symbol
            rows.append(row)
        except Exception:
            pass

    if not rows:
        return pd.DataFrame()

    snap = pd.DataFrame(rows)
    if "symbol" in snap.columns:
        snap = snap.set_index("symbol")
    return snap


def parse_criteria(criteria_list: List[Dict]) -> List[Criterion]:
    """Parse list of criterion dicts into Criterion objects."""
    result = []
    for c in criteria_list:
        try:
            ct_str = c.get("criterion_type", "numeric_range")
            ct = CriterionType(ct_str)

            criterion = Criterion(
                name           = c.get("name", "unnamed"),
                column         = c.get("column", "close"),
                criterion_type = ct,
                min_val        = c.get("min_val"),
                max_val        = c.get("max_val"),
                bool_value     = c.get("bool_value", True),
                str_values     = c.get("str_values"),
                percentile     = c.get("percentile"),
                weight         = c.get("weight", 1.0),
                display_name   = c.get("display_name"),
            )
            result.append(criterion)
        except Exception:
            continue
    return result


# ─── ROUTES ───────────────────────────────────────────────────────────────────

@router.post("/screen")
async def screen_universe(req: ScreenRequest):
    """
    Screen a universe of symbols against custom criteria.
    
    Each criterion must specify: name, column, criterion_type, and threshold values.
    Returns ranked list of symbols passing all criteria.
    """
    if not _SCREENER_AVAILABLE:
        raise HTTPException(503, "Screener engine unavailable")

    snap = build_universe_snapshot(req.universe)
    if snap.empty:
        return {"results": [], "total": 0}

    criteria = parse_criteria(req.criteria) if req.criteria else []
    engine   = ScreenerEngine()

    try:
        result = engine.screen(snap, criteria, req.sort_by, req.ascending, req.max_results)
        records = screener_to_dict(result, max_rows=req.max_results)
        summary = build_screening_result_summary(result)
        return {
            "results": records,
            "total":   len(records),
            "summary": summary,
        }
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/quick")
async def quick_screen(req: QuickScreenRequest):
    """
    Quick screen using a preset strategy filter.
    
    Presets: momentum | value | growth | mean_reversion | quality
    """
    if not _SCREENER_AVAILABLE:
        raise HTTPException(503, "Screener engine unavailable")

    symbol_data_dict = {}
    for sd in req.universe:
        if len(sd.bars) >= 30:
            symbol_data_dict[sd.symbol] = symbol_data_to_df(sd)

    if not symbol_data_dict:
        return {"results": [], "total": 0}

    try:
        from ...screener_engine import quick_screen as qs
        result = qs(symbol_data_dict, req.preset, req.max_results)
        records = screener_to_dict(result) if not result.empty else []
        return {"results": records, "total": len(records), "preset": req.preset}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/score")
async def compute_scores(req: ScoreRequest):
    """
    Compute Technical, Momentum, Fundamental, and Composite scores for all symbols.
    Returns scored DataFrame sorted by composite score.
    """
    if not _SCREENER_AVAILABLE:
        raise HTTPException(503, "Screener engine unavailable")

    snap = build_universe_snapshot(req.universe)
    if snap.empty:
        return {"results": [], "total": 0}

    try:
        snap["tech_score"]         = compute_technical_score(snap)
        snap["momentum_score"]     = compute_momentum_score(snap)
        snap["fundamental_score"]  = compute_fundamental_score(snap)
        snap["composite_score"]    = compute_composite_score(snap)
        snap["rs_rank"]            = compute_rs_ranks(snap, "return_3m")

        snap_sorted = snap.sort_values("composite_score", ascending=False)
        records     = screener_to_dict(snap_sorted[
            ["composite_score", "tech_score", "momentum_score", "fundamental_score", "rs_rank"]
        ])
        return {"results": records, "total": len(records)}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/rank")
async def rank_symbols(req: RankRequest):
    """
    Multi-factor ranking of the universe.
    Default factors: return_3m, return_6m, rsi_14, adx_14, relative_volume, roe, pe_ratio.
    """
    if not _SCREENER_AVAILABLE:
        raise HTTPException(503, "Screener engine unavailable")

    snap = build_universe_snapshot(req.universe)
    if snap.empty:
        return {"results": [], "total": 0}

    try:
        ranked = rank_universe(snap, req.factors)
        records = screener_to_dict(ranked.head(200), max_rows=200)
        return {"results": records, "total": len(records)}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/technical")
async def compute_technicals(req: TechnicalRequest):
    """
    Add all technical indicator columns to a bar series.
    Returns the last snapshot row with all computed columns.
    Useful for getting a complete technical picture of one symbol.
    """
    if not _SCREENER_AVAILABLE:
        raise HTTPException(503, "Screener engine unavailable")

    if len(req.bars) < 5:
        raise HTTPException(400, "Minimum 5 bars required")

    rows = []
    for bar in req.bars:
        rows.append({
            "open": bar.open, "high": bar.high,
            "low": bar.low, "close": bar.close, "volume": bar.volume,
        })
    df = pd.DataFrame(rows)

    try:
        enriched = compute_technical_columns(df)
        last_row = enriched.iloc[-1].to_dict()
        result = {}
        for k, v in last_row.items():
            if isinstance(v, float):
                result[k] = safe(v)
            else:
                result[k] = v
        return {"snapshot": result, "periods": len(df)}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/alerts/add")
async def add_alert(req: AlertAddRequest):
    """
    Register a price or indicator alert.
    Alert fires when condition (above/below/crosses_above/crosses_below) triggers.
    """
    if not _SCREENER_AVAILABLE:
        raise HTTPException(503, "Screener engine unavailable")

    alert = Alert(
        symbol     = req.symbol,
        name       = req.name,
        column     = req.column,
        condition  = req.condition,
        threshold  = req.threshold,
        notify_once= req.notify_once,
    )
    _alert_engine.add_alert(alert)
    return {"status": "added", "alert": {
        "symbol": req.symbol, "name": req.name,
        "column": req.column, "condition": req.condition, "threshold": req.threshold,
    }}


@router.post("/alerts/check")
async def check_alerts(req: AlertCheckRequest):
    """
    Check all registered alerts against the latest bar snapshot.
    Returns list of triggered alerts.
    """
    if not _SCREENER_AVAILABLE:
        raise HTTPException(503, "Screener engine unavailable")

    snap = build_universe_snapshot(req.universe)
    if snap.empty:
        return {"triggered": [], "count": 0}

    try:
        triggered = _alert_engine.check_universe(snap)
        return {
            "triggered": [
                {"symbol": a.symbol, "name": a.name, "condition": a.condition,
                 "threshold": a.threshold, "column": a.column}
                for a in triggered
            ],
            "count": len(triggered),
        }
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/piotroski")
async def piotroski_score(req: PiotroskiRequest):
    """
    Compute Piotroski F-Score (0-9) from fundamental data.
    Score >=7 = financially strong, <=3 = potentially weak.
    """
    if not _SCREENER_AVAILABLE:
        raise HTTPException(503, "Screener engine unavailable")

    try:
        df    = pd.DataFrame([req.data])
        score = piotroski_f_score(df)
        s     = int(score.iloc[0])
        grade = "strong" if s >= 7 else "average" if s >= 4 else "weak"
        return {"piotroski_f_score": s, "grade": grade, "interpretation": f"{s}/9"}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/altman_z")
async def altman_z(req: dict):
    """
    Compute Altman Z-Score from fundamental balance sheet data.
    Z > 2.99: Safe Zone | 1.81-2.99: Grey Zone | < 1.81: Distress Zone
    """
    if not _SCREENER_AVAILABLE:
        raise HTTPException(503, "Screener engine unavailable")

    try:
        df = pd.DataFrame([req])
        z  = altman_z_score(df)
        z_val = safe(z.iloc[0])

        if z_val is None:
            zone = "unknown"
        elif z_val > 2.99:
            zone = "safe"
        elif z_val > 1.81:
            zone = "grey"
        else:
            zone = "distress"

        return {"altman_z_score": z_val, "zone": zone}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.get("/presets")
async def list_presets():
    """List available preset screeners with their criteria descriptions."""
    return {
        "presets": [
            {
                "name": "momentum",
                "description": "Strong trending stocks with price above key MAs",
                "criteria_count": 8,
            },
            {
                "name": "value",
                "description": "Undervalued stocks using P/E, P/B, ROE, and debt metrics",
                "criteria_count": 7,
            },
            {
                "name": "growth",
                "description": "High-growth companies with strong revenue and EPS growth",
                "criteria_count": 6,
            },
            {
                "name": "mean_reversion",
                "description": "Oversold high-liquidity stocks near Bollinger Band support",
                "criteria_count": 5,
            },
            {
                "name": "quality",
                "description": "High-quality businesses with strong profitability and low leverage",
                "criteria_count": 7,
            },
        ]
    }


@router.get("/filters")
async def list_filters():
    """List available filter builder functions with their parameters."""
    return {
        "filters": [
            {"name": "rsi_filter",       "params": ["low", "high", "period"],      "description": "RSI in range"},
            {"name": "adx_filter",       "params": ["min_adx"],                    "description": "ADX above threshold"},
            {"name": "volume_filter",    "params": ["min_avg_volume"],             "description": "Average volume minimum"},
            {"name": "above_200sma",     "params": [],                             "description": "Price above 200-day SMA"},
            {"name": "golden_cross",     "params": [],                             "description": "50 SMA crossed above 200 SMA"},
            {"name": "sector_filter",    "params": ["sectors"],                    "description": "Filter by sector(s)"},
            {"name": "near_52w_high",    "params": ["min_pct"],                    "description": "Price near 52-week high"},
            {"name": "bb_squeeze",       "params": [],                             "description": "Bollinger Band inside Keltner squeeze"},
            {"name": "relative_volume",  "params": ["min_rvol"],                   "description": "Relative volume spike"},
        ]
    }
