"""Research quality scoring — gates, warnings, and provenance."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

QualityGrade = Literal["A", "B", "C", "D", "F"]


@dataclass
class ResearchQuality:
    score: int
    grade: QualityGrade
    warnings: list[str]
    data_provenance: dict[str, str]


def _grade(score: int) -> QualityGrade:
    if score >= 85:
        return "A"
    if score >= 70:
        return "B"
    if score >= 55:
        return "C"
    if score >= 40:
        return "D"
    return "F"


def compute_research_quality(
    *,
    quant: dict[str, Any],
    sentiment: dict[str, Any],
    synthesis: dict[str, Any],
    provenance: dict[str, str],
) -> ResearchQuality:
    """Aggregate node-level signals into a 0–100 quality score."""
    score = 100
    warnings: list[str] = []

    iv = quant.get("implied_volatility", {})
    iv_val = float(iv.get("value") or 0)
    iv_reliable = bool(quant.get("iv_reliable", iv_val > 0))
    market_src = str(quant.get("market_data_source", "unknown"))
    theo = float(quant.get("black_scholes_theoretical_price") or 0)
    mid = float(quant.get("market_bid_ask_mid") or 0)
    spread_pct = quant.get("bid_ask_spread_pct")
    days_to_expiry = int(quant.get("days_to_expiry") or 0)
    moneyness = float(quant.get("moneyness") or 1.0)

    if days_to_expiry <= 0:
        score -= 40
        warnings.append("Option is expired — pricing and IV are unreliable")
    elif days_to_expiry < 3:
        score -= 15
        warnings.append(f"Very short dated ({days_to_expiry}d) — elevated gamma/theta risk")

    if not iv_reliable or iv_val <= 0:
        score -= 30
        warnings.append("Implied volatility did not converge reliably")
    elif iv_val > 2.0:
        score -= 10
        warnings.append(f"Extreme IV ({iv_val * 100:.1f}%) — verify chain quote")

    if market_src not in ("live_chain", "user_override"):
        score -= 12
        warnings.append(f"Market mid sourced from {market_src}, not live option chain")

    if spread_pct is not None and float(spread_pct) > 12:
        score -= 10
        warnings.append(f"Wide bid-ask spread ({float(spread_pct):.1f}% of mid)")

    if theo > 0 and mid > 0:
        divergence = abs(mid - theo) / theo * 100
        if divergence > 25:
            score -= 18
            warnings.append(f"Market-theo divergence {divergence:.1f}% exceeds 25%")
        elif divergence > 12:
            score -= 8
            warnings.append(f"Market-theo divergence {divergence:.1f}%")

    if moneyness > 1.35 or moneyness < 0.65:
        score -= 8
        warnings.append(f"Deep OTM/ITM moneyness ({moneyness:.2f}) — Greeks less stable")

    confidence = float(sentiment.get("confidence") or 0)
    if confidence < 0.45:
        score -= 12
        warnings.append(f"Low sentiment confidence ({confidence:.2f})")
    if not sentiment.get("ticker_mentioned", True):
        score -= 6
        warnings.append("Headline does not reference the underlying ticker")

    iv_pct = float(synthesis.get("implied_volatility_percentile") or 50)
    vol_src = provenance.get("iv_percentile_source", "")
    if vol_src in ("unavailable", "synthetic_fallback"):
        score -= 8
        warnings.append("IV percentile uses limited realized-vol history")

    news_src = provenance.get("news_source", "")
    news_ok = provenance.get("news_fetch_ok", "true") == "true"
    if news_src in ("synthetic", "no_input", "all_providers_failed"):
        score -= 14
        warnings.append(f"News sourced from {news_src} — live catalyst unavailable")
    elif news_src == "manual":
        score -= 2
    elif news_ok and news_src in ("finnhub", "yfinance", "google_rss"):
        score += 3

    catalyst_strength = float(sentiment.get("catalyst_strength") or 0)
    if catalyst_strength < 0.5:
        score -= 5
        warnings.append("Weak or generic catalyst tag — strategy confidence reduced")

    multi_source = int(provenance.get("news_article_count") or 0) >= 3
    if multi_source:
        score += 2

    score = max(0, min(100, score))
    return ResearchQuality(
        score=score,
        grade=_grade(score),
        warnings=warnings,
        data_provenance=provenance,
    )


def execution_status_from_quality(
    base_status: str,
    quality_score: int,
    *,
    iv_reliable: bool,
    days_to_expiry: int,
) -> str:
    """Downgrade APPROVED when quality gates fail."""
    if days_to_expiry <= 0 or not iv_reliable:
        return "REJECTED"
    if quality_score < 40:
        return "REJECTED"
    if quality_score < 65 and base_status == "APPROVED":
        return "REVIEW"
    if base_status == "REJECTED":
        return "REJECTED"
    return base_status
