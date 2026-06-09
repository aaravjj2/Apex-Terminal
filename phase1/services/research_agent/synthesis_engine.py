"""Node 4 — Conformal PID + SPCI synthesis and trade plan risk envelope."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .quant_engine import bs_price

ExecutionStatus = Literal["APPROVED", "REJECTED", "REVIEW"]

_VOL_CATALYSTS = frozenset(
    {
        "EARNINGS_BEAT",
        "EARNINGS_MISS",
        "GUIDANCE_REVISION_UPWARD",
        "GUIDANCE_REVISION_DOWNWARD",
        "MACRO_RATE_CUT",
        "MACRO_RATE_HIKE",
    }
)


def conformal_pid_update(
    *,
    errors: list[int],
    alpha: float = 0.05,
    q_hat: float = 0.15,
    r_t: float = 1.96,
) -> float:
    """q_{t+1} = q_hat + r_t * sum(err_i - alpha) per blueprint."""
    integral = sum(e - alpha for e in errors)
    return q_hat + r_t * integral


def spci_conditional_quantile(residuals: list[float], p: float = 0.95) -> float:
    """SPCI: empirical conditional quantile of trailing pricing residuals."""
    if not residuals:
        return 0.15
    sorted_r = sorted(abs(x) for x in residuals)
    idx = min(len(sorted_r) - 1, max(0, int(p * len(sorted_r)) - 1))
    return sorted_r[idx]


def iv_percentile(current_iv: float, historical: list[float]) -> float:
    if not historical:
        return 50.0
    below = sum(1 for h in historical if h <= current_iv)
    return round(100.0 * below / len(historical), 1)


def build_pricing_residuals(
    *,
    spot: float,
    strike: float,
    t: float,
    r: float,
    option_type: str,
    market_mid: float,
    realized_vol_history: list[float],
    window: int = 14,
) -> list[float]:
    """SPCI residual series: market_mid minus BSM price at each historical realized vol."""
    if not realized_vol_history:
        return [market_mid * 0.01 * i for i in (-2, -1, 0, 1, 2, 1, 0)]

    series: list[float] = []
    for rv in realized_vol_history[-window:]:
        theo = bs_price(spot, strike, t, r, rv, option_type)  # type: ignore[arg-type]
        series.append(round(market_mid - theo, 4))
    return series


def build_coverage_errors(residuals: list[float], q_hat: float, alpha: float = 0.05) -> list[int]:
    """Conformal coverage: 1 if |residual| exceeded q_hat band."""
    return [1 if abs(r) > q_hat else 0 for r in residuals]


def iv_crush_probability(*, iv_pct: float, polarity: float, catalyst: str) -> float:
    """Elevated when IV percentile is high and a vol-sensitive catalyst is present."""
    event_boost = 1.0 if catalyst in _VOL_CATALYSTS else 0.55
    polarity_factor = 0.55 + min(0.45, abs(polarity) * 0.45)
    raw = (iv_pct / 100.0) * polarity_factor * event_boost
    return round(min(0.99, max(0.0, raw)), 2)


@dataclass
class SynthesisResult:
    recommended_strategy: str
    implied_volatility_percentile: float
    iv_crush_probability_score: float
    conformal_pid_control: dict
    spci_residual_lag_w: int
    execution_status: ExecutionStatus
    pricing_residuals: list[float]
    iv_percentile_source: str


def recommend_strategy(
    *,
    option_type: str,
    polarity: float,
    iv_pct: float,
    catalyst: str,
    crush_score: float,
) -> str:
    """Blueprint-aligned strategy matrix — vol crush + polarity + catalyst."""
    earnings = "EARNINGS" in catalyst

    # Blueprint demo path: earnings beat + high IV → Bear Put Spread (vol crush hedge)
    if iv_pct >= 70 and earnings and polarity > 0.4:
        return "Bear Put Spread"
    if iv_pct >= 75 and crush_score >= 0.7 and polarity > 0.3:
        return "Bear Put Spread"
    if iv_pct >= 75 and polarity < -0.3:
        return "Bear Put Spread"
    if iv_pct >= 80 and catalyst in _VOL_CATALYSTS:
        return "Iron Condor (credit)" if option_type == "Call" else "Bear Put Spread"
    if iv_pct < 25 and polarity > 0.6:
        return "Long Call" if option_type == "Call" else "Long Put"
    if iv_pct < 35 and polarity > 0.45:
        return "Bull Call Spread"
    if polarity < -0.5:
        return "Bear Put Spread"
    if abs(polarity) < 0.15 and iv_pct > 60:
        return "Hold / No Trade"
    return "Bull Call Spread" if polarity > 0.2 else "Hold / No Trade"


def run_synthesis_engine(
    *,
    option_type: str,
    polarity: float,
    iv_value: float,
    catalyst: str,
    theoretical_price: float,
    market_mid: float,
    spot: float,
    strike: float,
    time_to_expiry: float,
    risk_free_rate: float,
    realized_vol_history: list[float] | None = None,
    residual_history: list[float] | None = None,
    coverage_errors: list[int] | None = None,
    iv_reliable: bool = True,
    days_to_expiry: int = 30,
    quality_score: int = 100,
) -> SynthesisResult:
    w = 14
    vol_hist = realized_vol_history or []
    iv_src = "realized_vol_history" if vol_hist else "fallback"

    iv_pct = iv_percentile(iv_value, vol_hist if vol_hist else [iv_value * f for f in (0.7, 0.8, 0.9, 1.0, 1.1)])
    if not vol_hist:
        iv_src = "synthetic_fallback"

    residuals = residual_history or build_pricing_residuals(
        spot=spot,
        strike=strike,
        t=time_to_expiry,
        r=risk_free_rate,
        option_type=option_type,
        market_mid=market_mid,
        realized_vol_history=vol_hist,
        window=w,
    )
    q_hat = spci_conditional_quantile(residuals[-w:], p=0.95)
    errors = coverage_errors or build_coverage_errors(residuals[-w:], q_hat)
    q_next = conformal_pid_update(errors=errors, q_hat=q_hat)

    crush_score = iv_crush_probability(iv_pct=iv_pct, polarity=polarity, catalyst=catalyst)

    spread = abs(market_mid - theoretical_price)
    band = max(q_next * 0.08, spread * 0.5, 0.05)
    lower = round(max(0.01, theoretical_price - band), 2)
    upper = round(theoretical_price + band, 2)

    strategy = recommend_strategy(
        option_type=option_type,
        polarity=polarity,
        iv_pct=iv_pct,
        catalyst=catalyst,
        crush_score=crush_score,
    )

    status: ExecutionStatus = "APPROVED"
    if strategy == "Hold / No Trade":
        status = "REJECTED"
    elif not iv_reliable or days_to_expiry <= 0:
        status = "REJECTED"
    elif quality_score < 40:
        status = "REJECTED"
    elif spread > max(theoretical_price * 0.2, 2.0) or quality_score < 65:
        status = "REVIEW"
    elif crush_score >= 0.75 and iv_pct >= 70 and polarity > 0.35 and strategy != "Hold / No Trade":
        status = "APPROVED"

    return SynthesisResult(
        recommended_strategy=strategy,
        implied_volatility_percentile=iv_pct,
        iv_crush_probability_score=crush_score,
        conformal_pid_control={
            "target_alpha": 0.05,
            "error_integrator_r_t": 1.96,
            "scorecaster_prediction_q_hat": round(q_hat, 4),
            "dynamic_stop_loss_boundary": [lower, upper],
            "updated_quantile_q": round(q_next, 4),
            "coverage_errors": errors[-7:],
        },
        spci_residual_lag_w=w,
        execution_status=status,
        pricing_residuals=residuals[-w:],
        iv_percentile_source=iv_src,
    )
