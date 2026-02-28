"""
ta_indicators_v5.py — Advanced Technical Analysis API Routes (v5)
=================================================================
REST API endpoints for the advanced TA engine modules:
- Candlestick pattern detection
- Advanced volatility models (Garman-Klass, Parkinson, Yang-Zhang)
- Ehlers indicators (Super Smoother, Roofing Filter)
- Volume Profile & Market Profile
- Fibonacci tools (retracement, extension, harmonics)
- Order Flow analysis (footprint, delta, VSA, supply/demand)
- Regime detection
- Support/Resistance auto-detection

Endpoints:
    POST /api/v5/ta/candlestick-patterns     → Detect all candlestick patterns
    POST /api/v5/ta/advanced-volatility       → Garman-Klass, Parkinson, Yang-Zhang
    POST /api/v5/ta/ehlers                    → Ehlers indicators
    POST /api/v5/ta/volume-profile            → Volume profile analysis
    POST /api/v5/ta/market-profile            → TPO / Market Profile
    POST /api/v5/ta/fibonacci                 → Fibonacci retracement/extension
    POST /api/v5/ta/harmonic-patterns         → Harmonic pattern detection
    POST /api/v5/ta/order-flow                → Order flow analysis
    POST /api/v5/ta/supply-demand-zones       → Supply/Demand zone detection
    POST /api/v5/ta/support-resistance        → Auto S/R level detection
    POST /api/v5/ta/regime                    → Market regime classification
    POST /api/v5/ta/confluence                → Multi-timeframe confluence score
    POST /api/v5/ta/elliott-waves             → Elliott wave detection
    POST /api/v5/ta/vsa                       → Volume Spread Analysis
    POST /api/v5/ta/institutional-flow        → Institutional flow proxy
    POST /api/v5/ta/anchored-vwap             → Anchored VWAP
    POST /api/v5/ta/gann                      → Gann Fan / Square of Nine
    POST /api/v5/ta/regression-channel        → Regression channels
    GET  /api/v5/ta/capabilities              → List all v5 capabilities
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
import pandas as pd
import numpy as np

router = APIRouter(prefix="/api/v5/ta", tags=["TA Advanced v5"])


# ─── PYDANTIC MODELS ────────────────────────────────────────────────────────

class OHLCVBar(BaseModel):
    timestamp: Optional[str] = None
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0


class TARequest(BaseModel):
    bars: List[OHLCVBar]
    params: Dict[str, Any] = Field(default_factory=dict)


class FibonacciRequest(BaseModel):
    bars: List[OHLCVBar]
    type: str = "retracement"  # retracement, extension, fan, time_zone
    high_price: Optional[float] = None
    low_price: Optional[float] = None
    ratios: Optional[List[float]] = None


class AnchoredVWAPRequest(BaseModel):
    bars: List[OHLCVBar]
    anchor_index: int = 0
    num_std: int = 2


class GannRequest(BaseModel):
    bars: List[OHLCVBar]
    type: str = "fan"  # fan, square_of_nine
    anchor_index: Optional[int] = None
    price: Optional[float] = None


class RegressionRequest(BaseModel):
    bars: List[OHLCVBar]
    type: str = "linear"  # linear, quadratic, logarithmic
    period: int = 100
    deviations: float = 2.0


# ─── HELPERS ─────────────────────────────────────────────────────────────────

def bars_to_df(bars: List[OHLCVBar]) -> pd.DataFrame:
    """Convert OHLCVBar list to DataFrame."""
    data = [{"open": b.open, "high": b.high, "low": b.low,
             "close": b.close, "volume": b.volume} for b in bars]
    df = pd.DataFrame(data)
    if bars and bars[0].timestamp:
        try:
            df.index = pd.to_datetime([b.timestamp for b in bars])
        except Exception:
            pass
    return df


def series_to_list(s) -> list:
    """Convert Series/array to JSON-safe list."""
    if isinstance(s, pd.Series):
        s = s.values
    result = []
    for v in s:
        if v is None or (isinstance(v, float) and (np.isnan(v) or np.isinf(v))):
            result.append(None)
        else:
            try:
                result.append(round(float(v), 6))
            except (TypeError, ValueError):
                result.append(str(v))
    return result


def safe_float(v) -> Optional[float]:
    if v is None or (isinstance(v, float) and (np.isnan(v) or np.isinf(v))):
        return None
    return round(float(v), 6)


# ─── CANDLESTICK PATTERNS ───────────────────────────────────────────────────

@router.post("/candlestick-patterns")
async def detect_candlestick_patterns(request: TARequest):
    """Detect all 26+ candlestick patterns in OHLCV data."""
    from ...ta_engine_advanced import CandlestickPatterns, AdvancedTAEngine
    df = bars_to_df(request.bars)
    cp = CandlestickPatterns(df)
    all_patterns = cp.detect_all()

    # Summary: only return bars where patterns were detected
    active = {}
    for col in all_patterns.columns:
        vals = all_patterns[col]
        non_zero = vals[vals != 0]
        if len(non_zero) > 0:
            active[col] = {
                "count": int(len(non_zero)),
                "values": series_to_list(vals),
                "last_signal": int(non_zero.iloc[-1]) if len(non_zero) > 0 else 0,
                "last_index": int(non_zero.index[-1]) if hasattr(non_zero.index[-1], '__int__') else len(request.bars) - 1,
            }

    return {
        "patterns_detected": len(active),
        "total_patterns_scanned": len(all_patterns.columns),
        "active_patterns": active,
        "bars_count": len(request.bars),
    }


# ─── ADVANCED VOLATILITY ────────────────────────────────────────────────────

@router.post("/advanced-volatility")
async def advanced_volatility(request: TARequest):
    """
    Compute advanced volatility estimators:
    - Garman-Klass
    - Parkinson
    - Yang-Zhang
    - Rogers-Satchell
    """
    from ...ta_engine_advanced import AdvancedTAEngine
    df = bars_to_df(request.bars)
    ta = AdvancedTAEngine(df)
    period = request.params.get("period", 20)

    return {
        "garman_klass": series_to_list(ta.garman_klass_volatility(period)),
        "parkinson": series_to_list(ta.parkinson_volatility(period)),
        "yang_zhang": series_to_list(ta.yang_zhang_volatility(period)),
        "rogers_satchell": series_to_list(ta.rogers_satchell_volatility(period)),
        "period": period,
        "bars_count": len(request.bars),
    }


# ─── EHLERS INDICATORS ──────────────────────────────────────────────────────

@router.post("/ehlers")
async def ehlers_indicators(request: TARequest):
    """
    Compute Ehlers indicators:
    - Super Smoother
    - Roofing Filter
    - Instantaneous Trendline
    - Fisher Transform (enhanced)
    """
    from ...ta_engine_advanced import AdvancedTAEngine
    df = bars_to_df(request.bars)
    ta = AdvancedTAEngine(df)
    period = request.params.get("period", 10)

    fisher, trigger = ta.ehlers_fisher_transform(period)
    return {
        "super_smoother": series_to_list(ta.ehlers_super_smoother(period)),
        "roofing_filter": series_to_list(ta.ehlers_roofing_filter()),
        "instantaneous_trendline": series_to_list(ta.ehlers_instantaneous_trendline(period * 2)),
        "fisher_transform": series_to_list(fisher),
        "fisher_trigger": series_to_list(trigger),
        "bars_count": len(request.bars),
    }


# ─── VOLUME PROFILE ─────────────────────────────────────────────────────────

@router.post("/volume-profile")
async def compute_volume_profile(request: TARequest):
    """
    Compute volume profile for the provided OHLCV data.
    Returns POC, VAH, VAL, and distribution of volume by price level.
    """
    from ...ta_engine_volume_profile import VolumeProfileEngine
    df = bars_to_df(request.bars)
    vp = VolumeProfileEngine(df)

    bins = request.params.get("bins", 50)
    va_pct = request.params.get("value_area_pct", 0.70)
    profile = vp.volume_profile(bins=bins, value_area_pct=va_pct)

    return {
        "poc": safe_float(profile.poc),
        "vah": safe_float(profile.vah),
        "val": safe_float(profile.val),
        "total_volume": safe_float(profile.total_volume),
        "value_area_volume": safe_float(profile.value_area_volume),
        "high_volume_nodes": [safe_float(p) for p in profile.high_volume_nodes],
        "low_volume_nodes": [safe_float(p) for p in profile.low_volume_nodes],
        "levels": [
            {
                "price": safe_float(lv.price),
                "volume": safe_float(lv.volume),
                "buy_volume": safe_float(lv.buy_volume),
                "sell_volume": safe_float(lv.sell_volume),
                "delta": safe_float(lv.delta),
                "pct_of_total": safe_float(lv.pct_of_total),
            }
            for lv in profile.levels
        ],
        "bins": bins,
        "bars_count": len(request.bars),
    }


# ─── MARKET PROFILE (TPO) ───────────────────────────────────────────────────

@router.post("/market-profile")
async def compute_market_profile(request: TARequest):
    """
    Compute Market Profile (TPO) for OHLCV data.
    Returns POC, VAH, VAL, Initial Balance, profile type, single prints.
    """
    from ...ta_engine_volume_profile import VolumeProfileEngine
    df = bars_to_df(request.bars)
    vp = VolumeProfileEngine(df)

    tpo_size = request.params.get("tpo_size", None)
    profile = vp.tpo_profile(tpo_size=tpo_size)

    return {
        "poc": safe_float(profile.poc),
        "vah": safe_float(profile.vah),
        "val": safe_float(profile.val),
        "initial_balance_high": safe_float(profile.initial_balance_high),
        "initial_balance_low": safe_float(profile.initial_balance_low),
        "profile_type": profile.profile_type,
        "single_prints": [safe_float(p) for p in profile.single_prints[:50]],  # limit
        "tpo_levels_count": len(profile.price_levels),
    }


# ─── FIBONACCI ───────────────────────────────────────────────────────────────

@router.post("/fibonacci")
async def compute_fibonacci(request: FibonacciRequest):
    """
    Compute Fibonacci levels: retracement, extension, fan, time zones.
    """
    from ...ta_engine_fibonacci import FibonacciEngine
    df = bars_to_df(request.bars)
    fib = FibonacciEngine(df)

    if request.type == "retracement":
        if request.high_price and request.low_price:
            levels = fib.fibonacci_retracement(request.high_price, request.low_price,
                                                ratios=request.ratios)
            return {
                "type": "retracement",
                "levels": [{"ratio": l.ratio, "price": safe_float(l.price), "label": l.label}
                           for l in levels]
            }
        else:
            result = fib.auto_fibonacci_retracement()
            return {
                "type": "auto_retracement",
                "swing_high": safe_float(result.swing_high),
                "swing_low": safe_float(result.swing_low),
                "direction": result.direction,
                "levels": [{"ratio": l.ratio, "price": safe_float(l.price), "label": l.label}
                           for l in result.levels]
            }

    elif request.type == "extension":
        ext = fib.auto_fibonacci_extension()
        if ext:
            return {
                "type": "extension",
                "point_a": safe_float(ext.point_a),
                "point_b": safe_float(ext.point_b),
                "point_c": safe_float(ext.point_c),
                "levels": [{"ratio": l.ratio, "price": safe_float(l.price), "label": l.label}
                           for l in ext.levels]
            }
        return {"type": "extension", "error": "Not enough pivot points detected"}

    elif request.type == "time_zone":
        zones = fib.fibonacci_time_zones(0)
        return {"type": "time_zone", "zone_indices": zones}

    raise HTTPException(400, f"Unknown fibonacci type: {request.type}")


# ─── HARMONIC PATTERNS ──────────────────────────────────────────────────────

@router.post("/harmonic-patterns")
async def detect_harmonic_patterns(request: TARequest):
    """
    Detect XABCD harmonic patterns: Gartley, Butterfly, Bat, Crab, Shark, Cypher.
    """
    from ...ta_engine_fibonacci import FibonacciEngine
    df = bars_to_df(request.bars)
    fib = FibonacciEngine(df)

    threshold = request.params.get("threshold", 0.03)
    tolerance = request.params.get("tolerance", 0.05)
    patterns = fib.detect_harmonic_patterns(threshold, tolerance)

    return {
        "patterns_found": len(patterns),
        "patterns": [
            {
                "type": p.pattern_type,
                "direction": p.direction,
                "confidence": safe_float(p.confidence),
                "x": {"index": p.x[0], "price": safe_float(p.x[1])},
                "a": {"index": p.a[0], "price": safe_float(p.a[1])},
                "b": {"index": p.b[0], "price": safe_float(p.b[1])},
                "c": {"index": p.c[0], "price": safe_float(p.c[1])},
                "d": {"index": p.d[0], "price": safe_float(p.d[1])},
                "completion_zone": {
                    "low": safe_float(p.completion_zone[0]),
                    "high": safe_float(p.completion_zone[1]),
                },
            }
            for p in patterns
        ],
    }


# ─── ORDER FLOW ──────────────────────────────────────────────────────────────

@router.post("/order-flow")
async def order_flow_analysis(request: TARequest):
    """
    Order flow analysis: delta profile, absorption, exhaustion, aggression.
    """
    from ...ta_engine_order_flow import OrderFlowEngine
    df = bars_to_df(request.bars)
    of = OrderFlowEngine(df)

    period = request.params.get("period", 20)
    delta = of.delta_profile()
    score = of.composite_order_flow_score(period)

    return {
        "delta": series_to_list(delta['delta']),
        "cumulative_delta": series_to_list(delta['cumulative_delta']),
        "delta_ma_fast": series_to_list(delta['delta_ma_fast']),
        "delta_ma_slow": series_to_list(delta['delta_ma_slow']),
        "composite_score": series_to_list(score['smoothed_score']),
        "delta_component": series_to_list(score['delta_component']),
        "absorption_component": series_to_list(score['absorption_component']),
        "aggression_component": series_to_list(score['aggression_component']),
        "bars_count": len(request.bars),
    }


# ─── SUPPLY / DEMAND ZONES ──────────────────────────────────────────────────

@router.post("/supply-demand-zones")
async def detect_supply_demand_zones(request: TARequest):
    """Detect supply and demand zones from price action."""
    from ...ta_engine_order_flow import OrderFlowEngine
    df = bars_to_df(request.bars)
    of = OrderFlowEngine(df)

    lookback = request.params.get("lookback", 100)
    min_strength = request.params.get("min_strength", 0.5)
    zones = of.supply_demand_zones(lookback, min_strength)

    return {
        "zones_found": len(zones),
        "supply_zones": [
            {
                "high": safe_float(z.high),
                "low": safe_float(z.low),
                "start_idx": z.start_idx,
                "strength": safe_float(z.strength),
                "volume": safe_float(z.volume),
                "touches": z.touches,
                "is_fresh": z.is_fresh,
            }
            for z in zones if z.zone_type == "supply"
        ],
        "demand_zones": [
            {
                "high": safe_float(z.high),
                "low": safe_float(z.low),
                "start_idx": z.start_idx,
                "strength": safe_float(z.strength),
                "volume": safe_float(z.volume),
                "touches": z.touches,
                "is_fresh": z.is_fresh,
            }
            for z in zones if z.zone_type == "demand"
        ],
    }


# ─── SUPPORT / RESISTANCE ───────────────────────────────────────────────────

@router.post("/support-resistance")
async def auto_support_resistance(request: TARequest):
    """Auto-detect support and resistance levels."""
    from ...ta_engine_fibonacci import FibonacciEngine
    df = bars_to_df(request.bars)
    fib = FibonacciEngine(df)

    method = request.params.get("method", "cluster")
    sensitivity = request.params.get("sensitivity", 20)
    max_levels = request.params.get("max_levels", 10)
    sr = fib.auto_support_resistance(method, sensitivity, max_levels)

    return {
        "method": method,
        "current_price": safe_float(float(df['close'].iloc[-1])),
        "support": [safe_float(s) for s in sr['support']],
        "resistance": [safe_float(r) for r in sr['resistance']],
    }


# ─── REGIME DETECTION ───────────────────────────────────────────────────────

@router.post("/regime")
async def market_regime(request: TARequest):
    """
    Classify current market regime: strong_bull, bull, bear, strong_bear,
    high_volatility, range.
    """
    from ...ta_engine_advanced import AdvancedTAEngine
    df = bars_to_df(request.bars)
    ta = AdvancedTAEngine(df)

    lookback = request.params.get("lookback", 50)
    regime_df = ta.market_regime_classifier(lookback)
    last = regime_df.iloc[-1] if len(regime_df) > 0 else {}

    return {
        "current_regime": str(last.get('regime', 'unknown')),
        "trend_score": safe_float(last.get('trend_score', 0)),
        "vol_score": safe_float(last.get('vol_score', 0)),
        "momentum_score": safe_float(last.get('momentum_score', 0)),
        "regime_history": series_to_list(regime_df['regime']) if 'regime' in regime_df else [],
        "trend_score_history": series_to_list(regime_df['trend_score']) if 'trend_score' in regime_df else [],
    }


# ─── CONFLUENCE SCORE ───────────────────────────────────────────────────────

@router.post("/confluence")
async def multi_timeframe_confluence(request: TARequest):
    """
    Multi-timeframe confluence score (-100 to +100).
    Combines RSI, MACD, and SMA trend across multiple periods.
    """
    from ...ta_engine_advanced import AdvancedTAEngine
    df = bars_to_df(request.bars)
    ta = AdvancedTAEngine(df)

    periods = request.params.get("periods", [14, 28, 56])
    score = ta.multi_timeframe_confluence(periods)
    last_score = safe_float(float(score.iloc[-1])) if len(score) > 0 else 0

    return {
        "current_score": last_score,
        "interpretation": "strong_bullish" if (last_score or 0) > 60 else
                         "bullish" if (last_score or 0) > 20 else
                         "neutral" if (last_score or 0) > -20 else
                         "bearish" if (last_score or 0) > -60 else "strong_bearish",
        "history": series_to_list(score),
        "periods": periods,
    }


# ─── ELLIOTT WAVES ───────────────────────────────────────────────────────────

@router.post("/elliott-waves")
async def detect_elliott_waves(request: TARequest):
    """Detect Elliott Wave impulse patterns."""
    from ...ta_engine_fibonacci import FibonacciEngine
    df = bars_to_df(request.bars)
    fib = FibonacciEngine(df)

    threshold = request.params.get("threshold", 0.03)
    waves = fib.detect_impulse_waves(threshold)
    labels = fib.wave_count_labels(threshold)

    return {
        "waves_found": len(waves),
        "waves": [
            {
                "type": w.wave_type,
                "degree": w.degree,
                "confidence": safe_float(w.confidence),
                "points": [{"index": idx, "price": safe_float(price)}
                           for idx, price in w.waves],
            }
            for w in waves
        ],
        "labels": labels.to_dict(orient='records') if len(labels) > 0 else [],
    }


# ─── VSA (Volume Spread Analysis) ───────────────────────────────────────────

@router.post("/vsa")
async def volume_spread_analysis(request: TARequest):
    """Volume Spread Analysis — Wyckoff method signals."""
    from ...ta_engine_volume_profile import VolumeProfileEngine
    df = bars_to_df(request.bars)
    vp = VolumeProfileEngine(df)

    lookback = request.params.get("lookback", 20)
    signals = vp.vsa_analysis(lookback)
    signals_df = vp.vsa_signals_series(lookback)

    return {
        "signals_found": len(signals),
        "signals": [
            {
                "bar_index": s.bar_index,
                "type": s.signal_type,
                "direction": s.direction,
                "strength": safe_float(s.strength),
            }
            for s in signals
        ],
        "time_series": {
            "type": series_to_list(signals_df['vsa_type']),
            "direction": series_to_list(signals_df['vsa_direction']),
            "strength": series_to_list(signals_df['vsa_strength']),
        },
    }


# ─── INSTITUTIONAL FLOW ─────────────────────────────────────────────────────

@router.post("/institutional-flow")
async def institutional_flow(request: TARequest):
    """Detect institutional activity patterns."""
    from ...ta_engine_order_flow import OrderFlowEngine
    df = bars_to_df(request.bars)
    of = OrderFlowEngine(df)

    period = request.params.get("period", 20)
    activities = of.institutional_flow(period)
    indicator = of.institutional_flow_indicator(period)

    return {
        "activities_detected": len(activities),
        "activities": [
            {
                "bar_index": a.bar_index,
                "type": a.activity_type,
                "direction": a.direction,
                "confidence": safe_float(a.confidence),
                "volume_ratio": safe_float(a.volume_ratio),
            }
            for a in activities
        ],
        "institutional_pressure": series_to_list(indicator['inst_pressure']),
    }


# ─── ANCHORED VWAP ──────────────────────────────────────────────────────────

@router.post("/anchored-vwap")
async def compute_anchored_vwap(request: AnchoredVWAPRequest):
    """Compute VWAP anchored to a specific bar."""
    from ...ta_engine_volume_profile import VolumeProfileEngine
    df = bars_to_df(request.bars)
    vp = VolumeProfileEngine(df)

    result = vp.anchored_vwap(request.anchor_index, request.num_std)
    return {
        "vwap": series_to_list(result['vwap']),
        "bands": {
            k: series_to_list(v) for k, v in result.items() if k != 'vwap'
        },
        "anchor_index": request.anchor_index,
    }


# ─── GANN ────────────────────────────────────────────────────────────────────

@router.post("/gann")
async def compute_gann(request: GannRequest):
    """Compute Gann Fan or Square of Nine levels."""
    from ...ta_engine_fibonacci import FibonacciEngine
    df = bars_to_df(request.bars)
    fib = FibonacciEngine(df)

    if request.type == "fan":
        anchor = request.anchor_index or 0
        fan = fib.gann_fan(anchor)
        return {
            "type": "fan",
            "lines": {k: series_to_list(v) for k, v in fan.items()},
        }
    elif request.type == "square_of_nine":
        price = request.price or float(df['close'].iloc[-1])
        levels = fib.gann_square_of_nine(price)
        return {
            "type": "square_of_nine",
            "base_price": safe_float(price),
            "support": [safe_float(s) for s in levels['support']],
            "resistance": [safe_float(r) for r in levels['resistance']],
        }

    raise HTTPException(400, f"Unknown gann type: {request.type}")


# ─── REGRESSION CHANNEL ─────────────────────────────────────────────────────

@router.post("/regression-channel")
async def compute_regression_channel(request: RegressionRequest):
    """Compute regression channel: linear, quadratic, or logarithmic."""
    from ...ta_engine_fibonacci import FibonacciEngine
    df = bars_to_df(request.bars)
    fib = FibonacciEngine(df)

    if request.type == "linear":
        result = fib.linear_regression_channel(request.period, request.deviations)
        return {
            "type": "linear",
            "slope": safe_float(result.slope),
            "intercept": safe_float(result.intercept),
            "r_squared": safe_float(result.r_squared),
            "std_dev": safe_float(result.std_dev),
            "upper": series_to_list(result.upper_line),
            "center": series_to_list(result.center_line),
            "lower": series_to_list(result.lower_line),
        }
    elif request.type == "quadratic":
        result = fib.quadratic_regression_channel(request.period, request.deviations)
        return {
            "type": "quadratic",
            "upper": series_to_list(result['upper']),
            "center": series_to_list(result['center']),
            "lower": series_to_list(result['lower']),
        }
    elif request.type == "logarithmic":
        result = fib.logarithmic_regression_channel(request.period, request.deviations)
        return {
            "type": "logarithmic",
            "upper": series_to_list(result['upper']),
            "center": series_to_list(result['center']),
            "lower": series_to_list(result['lower']),
        }

    raise HTTPException(400, f"Unknown regression type: {request.type}")


# ─── CAPABILITIES ───────────────────────────────────────────────────────────

@router.get("/capabilities")
async def list_capabilities():
    """List all v5 TA capabilities."""
    return {
        "version": "v5",
        "total_endpoints": 18,
        "categories": {
            "candlestick_patterns": {
                "endpoint": "/api/v5/ta/candlestick-patterns",
                "patterns": ["doji", "dragonfly_doji", "gravestone_doji", "hammer",
                             "inverted_hammer", "hanging_man", "shooting_star",
                             "spinning_top", "marubozu", "engulfing", "harami",
                             "piercing_line", "dark_cloud_cover", "tweezer_top",
                             "tweezer_bottom", "kicking", "morning_star", "evening_star",
                             "three_white_soldiers", "three_black_crows", "three_inside_up",
                             "three_inside_down", "abandoned_baby", "rising_three_methods",
                             "falling_three_methods", "tasuki_gap"],
            },
            "advanced_volatility": {
                "endpoint": "/api/v5/ta/advanced-volatility",
                "models": ["garman_klass", "parkinson", "yang_zhang", "rogers_satchell"],
            },
            "ehlers_indicators": {
                "endpoint": "/api/v5/ta/ehlers",
                "indicators": ["super_smoother", "roofing_filter",
                              "instantaneous_trendline", "fisher_transform"],
            },
            "volume_profile": {
                "endpoint": "/api/v5/ta/volume-profile",
                "features": ["POC", "VAH", "VAL", "HVN", "LVN", "delta_profile"],
            },
            "market_profile": {
                "endpoint": "/api/v5/ta/market-profile",
                "features": ["TPO", "POC", "Value Area", "Initial Balance",
                            "Profile Type", "Single Prints"],
            },
            "fibonacci": {
                "endpoint": "/api/v5/ta/fibonacci",
                "types": ["retracement", "extension", "fan", "time_zone"],
            },
            "harmonic_patterns": {
                "endpoint": "/api/v5/ta/harmonic-patterns",
                "patterns": ["gartley", "butterfly", "bat", "crab", "shark", "cypher"],
            },
            "order_flow": {
                "endpoint": "/api/v5/ta/order-flow",
                "features": ["delta_profile", "absorption", "exhaustion",
                            "aggression_ratio", "composite_score"],
            },
            "supply_demand": {
                "endpoint": "/api/v5/ta/supply-demand-zones",
                "features": ["supply_zones", "demand_zones", "fresh_detection"],
            },
            "support_resistance": {
                "endpoint": "/api/v5/ta/support-resistance",
                "methods": ["cluster", "volume", "fractal"],
            },
            "regime_detection": {
                "endpoint": "/api/v5/ta/regime",
                "regimes": ["strong_bull", "bull", "bear", "strong_bear",
                           "high_volatility", "range"],
            },
            "confluence": {
                "endpoint": "/api/v5/ta/confluence",
                "score_range": "-100 to +100",
            },
            "elliott_waves": {
                "endpoint": "/api/v5/ta/elliott-waves",
                "types": ["impulse"],
            },
            "vsa": {
                "endpoint": "/api/v5/ta/vsa",
                "signals": ["buying_climax", "selling_climax", "no_demand",
                           "no_supply", "stopping_volume", "upthrust", "test", "shakeout"],
            },
            "institutional_flow": {
                "endpoint": "/api/v5/ta/institutional-flow",
                "types": ["accumulation", "distribution", "absorption", "initiative"],
            },
            "anchored_vwap": {
                "endpoint": "/api/v5/ta/anchored-vwap",
            },
            "gann": {
                "endpoint": "/api/v5/ta/gann",
                "types": ["fan", "square_of_nine"],
            },
            "regression_channels": {
                "endpoint": "/api/v5/ta/regression-channel",
                "types": ["linear", "quadratic", "logarithmic"],
            },
        },
    }
