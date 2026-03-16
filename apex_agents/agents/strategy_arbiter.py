"""
StrategyArbiter Agent — blend_scores()
=======================================
Replaces the ad-hoc weighted sum in unified_engine._generate_candidates().

blend_scores(features, ml_component, regime, **overrides) → float (0–1)

Design:
  - Weights are regime-aware: volatile regime down-weights trend and up-weights
    IV rank; bullish/bearish regimes shift directional sensitivity.
  - Each component is clamped to [0, 1] before blending.
  - Weight keys can be overridden per-call via **overrides for A/B testing.
  - Returns a float in [0, 1].
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


# ── Base weights (regime = neutral) ──────────────────────────────────────────
_BASE_WEIGHTS: Dict[str, float] = {
    "trend":     0.25,
    "liquidity": 0.20,
    "iv_rank":   0.20,
    "spread":    0.10,   # inverted: tighter spread → higher component
    "ml":        0.25,
}

# ── Per-regime weight overrides ───────────────────────────────────────────────
_REGIME_WEIGHTS: Dict[str, Dict[str, float]] = {
    "neutral": _BASE_WEIGHTS,
    "bullish": {
        "trend":     0.35,   # favour pure momentum in bull market
        "liquidity": 0.15,
        "iv_rank":   0.15,
        "spread":    0.10,
        "ml":        0.25,
    },
    "bearish": {
        "trend":     0.20,
        "liquidity": 0.20,
        "iv_rank":   0.30,   # IV rank more important in fear regimes
        "spread":    0.05,
        "ml":        0.25,
    },
    "volatile": {
        "trend":     0.10,   # trend unreliable in vol spikes
        "liquidity": 0.25,
        "iv_rank":   0.35,   # rich premium = priority
        "spread":    0.05,
        "ml":        0.25,
    },
    "high_vol": {            # alias for volatile
        "trend":     0.10,
        "liquidity": 0.25,
        "iv_rank":   0.35,
        "spread":    0.05,
        "ml":        0.25,
    },
}


def _clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, float(v)))


def _resolve_weights(regime: str, overrides: Dict[str, float]) -> Dict[str, float]:
    """Return weight dict for the given regime, applying any caller overrides."""
    base = _REGIME_WEIGHTS.get(regime, _BASE_WEIGHTS)
    merged = {**base, **overrides}
    # Normalise to sum=1 so callers can pass partial overrides safely
    total = sum(merged.values()) or 1.0
    return {k: v / total for k, v in merged.items()}


# ── Public API ────────────────────────────────────────────────────────────────

def blend_scores(
    trend_strength: float,
    liquidity_score: float,
    iv_rank: float,           # raw 0-100 scale; normalised internally
    avg_spread_pct: float,    # as a fraction; e.g. 0.02 = 2%
    ml_component: float,      # already normalised to [0, 1]
    regime: str = "neutral",
    **weight_overrides: float,
) -> float:
    """
    Blend five signal components into a single [0, 1] score.

    Parameters
    ----------
    trend_strength   : 0–1  (e.g. from FeatureEngine.trend_strength)
    liquidity_score  : 0–1  (e.g. from FeatureEngine.liquidity_score)
    iv_rank          : 0–100 (raw; divided by 100 internally)
    avg_spread_pct   : spread as fraction of mid (e.g. 0.03 for 3%)
    ml_component     : 0–1  (ML signal already normalised: (raw_signal+1)/2)
    regime           : market regime string; drives weight profile
    **weight_overrides : override individual weights by name (e.g. trend=0.4)

    Returns
    -------
    float in [0, 1]
    """
    weights = _resolve_weights(regime.lower(), weight_overrides)

    # Normalise each component to [0, 1]
    c_trend     = _clamp(trend_strength)
    c_liquidity = _clamp(liquidity_score)
    c_iv_rank   = _clamp(iv_rank / 100.0)
    c_spread    = _clamp(max(0.0, 1.0 - avg_spread_pct * 10.0))   # same inversion as original
    c_ml        = _clamp(ml_component)

    score = (
        c_trend     * weights["trend"]
        + c_liquidity * weights["liquidity"]
        + c_iv_rank   * weights["iv_rank"]
        + c_spread    * weights["spread"]
        + c_ml        * weights["ml"]
    )

    logger.debug(
        "blend_scores regime=%s components=[trend=%.3f liq=%.3f iv=%.3f spread=%.3f ml=%.3f] → %.4f",
        regime, c_trend, c_liquidity, c_iv_rank, c_spread, c_ml, score,
    )
    return round(_clamp(score), 6)
