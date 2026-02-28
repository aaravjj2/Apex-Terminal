"""
ta_indicators_v4.py — Technical Analysis API Routes (v4)
=========================================================
REST API endpoints powered by ta_engine.py

Endpoints:
    GET  /api/v4/indicators/                    → List all 80+ available indicators
    POST /api/v4/indicators/compute             → Compute one or more indicators on OHLCV data
    POST /api/v4/indicators/compute/{symbol}    → Compute indicators for a symbol (fetches data from DB)
    GET  /api/v4/indicators/signals/{symbol}    → Get all signals (bullish/bearish) for a symbol
    POST /api/v4/indicators/divergences         → Detect indicator divergences
    GET  /api/v4/indicators/pivots/{symbol}     → Get pivot points (standard, fibonacci, camarilla)
    POST /api/v4/indicators/multi_tf             → Multi-timeframe RSI/MACD for a symbol
    GET  /api/v4/indicators/ichimoku/{symbol}   → Ichimoku cloud values
"""

from __future__ import annotations
import io
import sys
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
import pandas as pd
import numpy as np

# Import our TA engine
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

try:
    from ...ta_engine import (
        TAEngine,
        compute_indicator,
        AVAILABLE_INDICATORS,
    )
    _TA_AVAILABLE = True
except ImportError:
    _TA_AVAILABLE = False
    AVAILABLE_INDICATORS = []

router = APIRouter(prefix="/api/v4/indicators", tags=["TA Indicators v4"])


# ─── PYDANTIC MODELS ──────────────────────────────────────────────────────────

class OHLCVBar(BaseModel):
    timestamp: Optional[str] = None
    open:      float
    high:      float
    low:       float
    close:     float
    volume:    float = 0.0


class IndicatorRequest(BaseModel):
    bars:       List[OHLCVBar]
    indicators: List[str] = Field(default=["rsi", "macd", "bbands"])
    params:     Dict[str, Any] = Field(default_factory=dict)
    include_raw: bool = False  # If True, include full OHLCV in response


class IndicatorResult(BaseModel):
    indicator:  str
    values:     List[Optional[float]]
    params_used: Dict[str, Any] = {}
    meta:       Dict[str, Any] = {}


class IndicatorResponse(BaseModel):
    results:     List[Dict[str, Any]]
    bars_count:  int
    indicators_computed: int


class SignalItem(BaseModel):
    name:       str
    signal:     str   # "bullish", "bearish", "neutral"
    value:      Optional[float]
    description: str


class SignalResponse(BaseModel):
    symbol:     str
    signals:    List[SignalItem]
    overall_bias:  str   # "bullish", "bearish", "neutral"
    bull_count: int
    bear_count: int


# ─── HELPERS ──────────────────────────────────────────────────────────────────

def bars_to_dataframe(bars: List[OHLCVBar]) -> pd.DataFrame:
    """Convert list of OHLCVBar to DataFrame."""
    data = [{
        "open":   b.open,
        "high":   b.high,
        "low":    b.low,
        "close":  b.close,
        "volume": b.volume,
    } for b in bars]
    df = pd.DataFrame(data)
    if bars and bars[0].timestamp:
        try:
            df.index = pd.to_datetime([b.timestamp for b in bars])
        except Exception:
            pass
    return df


def series_to_list(s: pd.Series) -> List[Optional[float]]:
    """Convert pandas Series to JSON-safe list."""
    result = []
    for v in s:
        if pd.isna(v) or (isinstance(v, float) and (np.isinf(v))):
            result.append(None)
        else:
            result.append(round(float(v), 6))
    return result


def value_to_safe(v) -> Optional[float]:
    """Make a single value JSON-safe."""
    if v is None or (isinstance(v, float) and (np.isnan(v) or np.isinf(v))):
        return None
    return round(float(v), 6)


# ─── ROUTES ───────────────────────────────────────────────────────────────────

@router.get("/")
async def list_indicators():
    """List all available technical indicators with metadata."""
    from ...ta_engine import AVAILABLE_INDICATORS as AI
    categories = {
        "moving_averages": [
            "sma", "ema", "wma", "smma", "dema", "tema", "vwma", "hma",
            "kama", "zlema", "alma", "mcginley", "ribbon_ema"
        ],
        "oscillators": [
            "rsi", "stoch_rsi", "macd", "cci", "williams_r", "momentum", "roc",
            "awesome_oscillator", "trix", "dpo", "ultimate_oscillator", "cmo",
            "ppo", "rvi", "kdj", "stochastic", "tsi", "connors_rsi",
            "fisher_transform", "schaff_trend_cycle", "coppock_curve", "kst",
            "laguerre_rsi", "wave_trend", "qqe_mod"
        ],
        "volatility": [
            "atr", "true_range", "bollinger_bands", "bb_percent_b", "bb_width",
            "keltner_channel", "donchian_channel", "historical_volatility",
            "volatility_stop", "squeeze_momentum"
        ],
        "trend": [
            "adx", "parabolic_sar", "aroon", "supertrend", "ichimoku",
            "williams_alligator", "williams_fractals", "ssl_channel", "hull_suite"
        ],
        "volume": [
            "vwap", "vwap_bands", "obv", "mfi", "cmf", "volume_rsi",
            "ease_of_movement", "force_index", "elder_ray", "mass_index",
            "klinger_oscillator", "chaikin_ad", "pvt", "nvi", "pvi",
            "balance_of_power"
        ],
        "pivot_points": [
            "pivot_points_standard", "pivot_points_fibonacci",
            "pivot_points_camarilla", "woodie_pivots"
        ],
        "statistical": [
            "standard_deviation", "linear_regression", "zscore",
            "hurst_exponent", "correlation_coefficient"
        ],
        "pattern": [
            "zigzag"
        ],
    }
    return {
        "total": len(AI),
        "categories": categories,
        "all": sorted(AI),
    }


@router.post("/compute", response_model=None)
async def compute_indicators(request: IndicatorRequest):
    """
    Compute one or more technical indicators on provided OHLCV bars.
    
    Returns per-indicator arrays aligned to the input bars.
    NaN values (warm-up period) are returned as null.
    """
    if not _TA_AVAILABLE:
        raise HTTPException(503, "TA engine not available")

    if len(request.bars) < 2:
        raise HTTPException(400, "At least 2 bars required")

    df = bars_to_dataframe(request.bars)
    ta = TAEngine(df)
    results = []

    for indicator_name in request.indicators:
        params = request.params.get(indicator_name, {})
        try:
            out = compute_indicator(df, indicator_name, **params)

            if isinstance(out, pd.DataFrame):
                # Multi-column indicator (e.g. MACD returns macd+signal+hist)
                col_results = {}
                for col in out.columns:
                    col_results[col] = series_to_list(out[col])
                results.append({
                    "indicator": indicator_name,
                    "type":      "multi",
                    "columns":   col_results,
                    "params":    params,
                })
            elif isinstance(out, pd.Series):
                results.append({
                    "indicator": indicator_name,
                    "type":      "single",
                    "values":    series_to_list(out),
                    "params":    params,
                })
            elif isinstance(out, dict):
                # Dict with named sub-series
                col_results = {}
                for k, v in out.items():
                    if isinstance(v, pd.Series):
                        col_results[k] = series_to_list(v)
                    elif isinstance(v, (int, float)):
                        col_results[k] = value_to_safe(v)
                results.append({
                    "indicator": indicator_name,
                    "type":      "dict",
                    "data":      col_results,
                    "params":    params,
                })
            else:
                results.append({
                    "indicator": indicator_name,
                    "type":      "scalar",
                    "value":     value_to_safe(out),
                    "params":    params,
                })

        except Exception as e:
            results.append({
                "indicator": indicator_name,
                "error":     str(e),
                "params":    params,
            })

    response = {
        "bars_count":           len(request.bars),
        "indicators_computed":  len(results),
        "results":              results,
    }

    if request.include_raw:
        response["ohlcv"] = [
            {"o": b.open, "h": b.high, "l": b.low, "c": b.close, "v": b.volume}
            for b in request.bars
        ]

    return response


@router.post("/signals", response_model=None)
async def get_signals(request: IndicatorRequest):
    """
    Get bullish/bearish signal summary for provided OHLCV data.
    Uses the all_signals() method to scan 20+ simultaneous indicators.
    """
    if not _TA_AVAILABLE:
        raise HTTPException(503, "TA engine not available")

    df  = bars_to_dataframe(request.bars)
    ta  = TAEngine(df)
    raw = ta.all_signals()

    # Convert to structured response
    signals = []
    bull_count = 0
    bear_count = 0

    for name, sig_dict in raw.items():
        if isinstance(sig_dict, dict):
            signal = sig_dict.get("signal", "neutral")
            value  = value_to_safe(sig_dict.get("value"))
            desc   = sig_dict.get("description", "")
        else:
            signal = "neutral"
            value  = None
            desc   = str(sig_dict)

        if signal == "bullish":
            bull_count += 1
        elif signal == "bearish":
            bear_count += 1

        signals.append({"name": name, "signal": signal, "value": value, "description": desc})

    if bull_count > bear_count * 1.5:
        bias = "bullish"
    elif bear_count > bull_count * 1.5:
        bias = "bearish"
    else:
        bias = "neutral"

    return {
        "signals":      signals,
        "overall_bias": bias,
        "bull_count":   bull_count,
        "bear_count":   bear_count,
        "total_signals": len(signals),
    }


@router.post("/divergences", response_model=None)
async def find_divergences(
    request: IndicatorRequest,
    indicator: str = Query("rsi", description="Indicator to check for divergence"),
):
    """
    Detect bullish/bearish divergences between price and an indicator.
    Returns list of divergence events with timestamps and types.
    """
    if not _TA_AVAILABLE:
        raise HTTPException(503, "TA engine not available")

    df  = bars_to_dataframe(request.bars)
    ta  = TAEngine(df)

    try:
        divs = ta.find_divergences(indicator)
        return {
            "indicator":   indicator,
            "divergences": divs if isinstance(divs, list) else [],
        }
    except Exception as e:
        raise HTTPException(400, f"Divergence detection failed: {e}")


@router.post("/pivots", response_model=None)
async def compute_pivots(
    request: IndicatorRequest,
    method: str = Query("standard", description="Pivot method: standard|fibonacci|camarilla|woodie"),
):
    """
    Compute pivot points for the most recent bar's OHLCV.
    Returns PP, S1-S4, R1-R4 levels.
    """
    if not _TA_AVAILABLE:
        raise HTTPException(503, "TA engine not available")

    df = bars_to_dataframe(request.bars)
    ta = TAEngine(df)

    try:
        method_map = {
            "standard":   ta.pivot_points_standard,
            "fibonacci":  ta.pivot_points_fibonacci,
            "camarilla":  ta.pivot_points_camarilla,
            "woodie":     ta.woodie_pivots,
        }
        fn = method_map.get(method, ta.pivot_points_standard)
        result = fn()

        if isinstance(result, dict):
            safe = {k: value_to_safe(v) for k, v in result.items()}
        elif isinstance(result, pd.DataFrame):
            safe = result.iloc[-1].to_dict()
            safe = {k: value_to_safe(v) for k, v in safe.items()}
        else:
            safe = {}

        return {"method": method, "levels": safe}
    except Exception as e:
        raise HTTPException(400, f"Pivot computation failed: {e}")


@router.post("/ichimoku", response_model=None)
async def compute_ichimoku(request: IndicatorRequest):
    """
    Compute full Ichimoku Cloud for provided OHLCV data.
    Returns: tenkan_sen, kijun_sen, senkou_a, senkou_b, chikou_span.
    Also returns cloud color (bullish/bearish) and price position.
    """
    if not _TA_AVAILABLE:
        raise HTTPException(503, "TA engine not available")

    df = bars_to_dataframe(request.bars)
    ta = TAEngine(df)

    try:
        ichi = ta.ichimoku()
        result = {}
        for k, v in ichi.items():
            if isinstance(v, pd.Series):
                result[k] = series_to_list(v)
            else:
                result[k] = value_to_safe(v)

        # Cloud color: bullish when senkou_a > senkou_b
        if "senkou_a" in ichi and "senkou_b" in ichi:
            sa = ichi["senkou_a"]
            sb = ichi["senkou_b"]
            if isinstance(sa, pd.Series) and isinstance(sb, pd.Series):
                cloud_colors = []
                for a, b in zip(sa, sb):
                    if pd.isna(a) or pd.isna(b):
                        cloud_colors.append(None)
                    elif a > b:
                        cloud_colors.append("bullish")
                    else:
                        cloud_colors.append("bearish")
                result["cloud_color"] = cloud_colors

        return result
    except Exception as e:
        raise HTTPException(400, f"Ichimoku computation failed: {e}")


@router.post("/supertrend", response_model=None)
async def compute_supertrend(
    request: IndicatorRequest,
    period: int = Query(10, ge=2, le=200),
    multiplier: float = Query(3.0, ge=0.5, le=10.0),
):
    """
    Compute SuperTrend indicator.
    Returns: supertrend line, direction (1=bullish, -1=bearish), flip points.
    """
    if not _TA_AVAILABLE:
        raise HTTPException(503, "TA engine not available")

    df = bars_to_dataframe(request.bars)
    ta = TAEngine(df)

    try:
        result = ta.supertrend(period=period, multiplier=multiplier)
        if isinstance(result, pd.DataFrame):
            return {k: series_to_list(result[k]) for k in result.columns}
        elif isinstance(result, dict):
            return {k: series_to_list(v) if isinstance(v, pd.Series) else value_to_safe(v)
                    for k, v in result.items()}
        return {}
    except Exception as e:
        raise HTTPException(400, f"SuperTrend failed: {e}")


@router.post("/vwap", response_model=None)
async def compute_vwap(request: IndicatorRequest, bands: bool = Query(True)):
    """
    Compute VWAP with optional standard deviation bands.
    """
    if not _TA_AVAILABLE:
        raise HTTPException(503, "TA engine not available")

    df = bars_to_dataframe(request.bars)
    ta = TAEngine(df)

    try:
        if bands:
            result = ta.vwap_bands()
        else:
            result = ta.vwap()

        if isinstance(result, pd.Series):
            return {"vwap": series_to_list(result)}
        elif isinstance(result, dict):
            return {k: series_to_list(v) if isinstance(v, pd.Series) else value_to_safe(v)
                    for k, v in result.items()}
        return {}
    except Exception as e:
        raise HTTPException(400, f"VWAP failed: {e}")


@router.get("/available")
async def available_indicators():
    """
    Return flat list of all available indicator names.
    """
    try:
        from ...ta_engine import AVAILABLE_INDICATORS as AI
        return {"indicators": sorted(AI), "count": len(AI)}
    except Exception:
        return {"indicators": [], "count": 0}
