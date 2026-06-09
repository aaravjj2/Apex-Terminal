"""4-node Research Agent state machine — orchestrator through synthesis."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any

from .market_data import build_market_context
from .news_engine import resolve_news_input
from .osi_parser import OSIComponents, parse_osi, osi_from_occ
from .quality import compute_research_quality, execution_status_from_quality
from .quant_engine import run_quant_engine
from .sentiment_engine import run_sentiment_engine
from .synthesis_engine import run_synthesis_engine


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def run_research_agent(
    *,
    osi_symbol: str | None = None,
    occ_symbol: str | None = None,
    news_text: str = "",
    event_type: str | None = None,
    market_mid: float | None = None,
    spot_override: float | None = None,
    as_of: date | None = None,
    trade_plan_id: str | None = None,
    fetch_news: bool = True,
) -> dict[str, Any]:
    """
    Execute Nodes 1→4 and return the blueprint JSON trade plan payload.
    """
    # Node 1 — Orchestrator / OSI parse
    if osi_symbol:
        components: OSIComponents = parse_osi(osi_symbol)
    elif occ_symbol:
        components = parse_osi(osi_from_occ(occ_symbol))
    else:
        raise ValueError("osi_symbol or occ_symbol is required")

    # Shared market context (single yfinance round-trip)
    use_live = spot_override is None and market_mid is None
    ctx = build_market_context(components.underlying) if use_live else None

    # Node 2 — Quantitative engine
    quant = run_quant_engine(
        underlying=components.underlying,
        strike=components.strike_price,
        expiration=components.expiration_date,
        option_type=components.option_type,  # type: ignore[arg-type]
        market_mid=market_mid,
        spot_override=spot_override,
        as_of=as_of,
        use_live_market=use_live,
        market_context=ctx,
    )

    # News engine — Finnhub → yfinance → Google RSS (or manual override)
    news = resolve_news_input(
        underlying=components.underlying,
        news_text=news_text,
        event_type=event_type,
        fetch_news=fetch_news,
    )

    # Node 3 — Sentiment
    sentiment = run_sentiment_engine(
        news.text,
        event_type=news.event_type or event_type,
        underlying=components.underlying,
    )

    # Node 4 — Synthesis + conformal risk
    iv_value = float(quant.implied_volatility["value"] or 0)
    realized_vols = ctx.realized_vol_history if ctx else []
    synthesis = run_synthesis_engine(
        option_type=components.option_type,
        polarity=sentiment.finbert_polarity_score,
        iv_value=iv_value,
        catalyst=sentiment.deterministic_catalyst_tag,
        theoretical_price=quant.black_scholes_theoretical_price,
        market_mid=quant.market_bid_ask_mid,
        spot=quant.spot_price,
        strike=components.strike_price,
        time_to_expiry=quant.time_to_expiry_years,
        risk_free_rate=quant.risk_free_rate,
        realized_vol_history=realized_vols,
        iv_reliable=quant.iv_reliable,
        days_to_expiry=quant.days_to_expiry,
    )

    provenance = {
        **quant.data_provenance,
        "realized_vol": ctx.vol_source if ctx else "override_or_manual",
        "iv_percentile_source": synthesis.iv_percentile_source,
        "sentiment_engine": sentiment.engine,
        "news_source": news.source,
        "news_provider": news.provider_detail,
        "news_fetch_ok": str(news.fetch_ok).lower(),
        "news_article_count": str(news.article_count),
    }

    quality = compute_research_quality(
        quant={
            "implied_volatility": quant.implied_volatility,
            "iv_reliable": quant.iv_reliable,
            "market_data_source": quant.market_data_source,
            "black_scholes_theoretical_price": quant.black_scholes_theoretical_price,
            "market_bid_ask_mid": quant.market_bid_ask_mid,
            "bid_ask_spread_pct": quant.bid_ask_spread_pct,
            "days_to_expiry": quant.days_to_expiry,
            "moneyness": quant.moneyness,
        },
        sentiment={
            "confidence": sentiment.confidence,
            "ticker_mentioned": sentiment.ticker_mentioned,
            "catalyst_strength": sentiment.catalyst_strength,
        },
        synthesis={
            "implied_volatility_percentile": synthesis.implied_volatility_percentile,
        },
        provenance=provenance,
    )

    final_status = execution_status_from_quality(
        synthesis.execution_status,
        quality.score,
        iv_reliable=quant.iv_reliable,
        days_to_expiry=quant.days_to_expiry,
    )

    plan_id = trade_plan_id or f"REQ-{uuid.uuid4().hex[:8].upper()}"

    news_block: dict[str, Any] = {
        "headline": news.headline,
        "summary": news.summary,
        "source": news.source,
        "provider_detail": news.provider_detail,
        "fetch_ok": news.fetch_ok,
        "article_count": news.article_count,
        "inferred_event_type": news.event_type,
    }
    if news.selected_article:
        news_block["selected"] = {
            "headline": news.selected_article.headline,
            "source": news.selected_article.source,
            "url": news.selected_article.url,
            "published_at": news.selected_article.published_at.isoformat(),
            "relevance_score": news.selected_article.relevance_score,
        }

    return {
        "trade_plan_id": plan_id,
        "timestamp": _utc_now(),
        "research_quality": {
            "score": quality.score,
            "grade": quality.grade,
            "warnings": quality.warnings,
            "data_provenance": quality.data_provenance,
        },
        "orchestrator_node": {
            "osi_symbol": components.osi_symbol,
            "parsed_components": {
                "underlying": components.underlying,
                "expiration_date": components.expiration_date.isoformat(),
                "option_type": components.option_type,
                "strike_price": components.strike_price,
            },
        },
        "news_ingestion": news_block,
        "quantitative_engine": {
            "spot_price": quant.spot_price,
            "black_scholes_theoretical_price": quant.black_scholes_theoretical_price,
            "market_bid_ask_mid": quant.market_bid_ask_mid,
            "market_bid": quant.market_bid,
            "market_ask": quant.market_ask,
            "bid_ask_spread_pct": quant.bid_ask_spread_pct,
            "moneyness": quant.moneyness,
            "days_to_expiry": quant.days_to_expiry,
            "intrinsic_value": quant.intrinsic_value,
            "iv_reliable": quant.iv_reliable,
            "market_data_source": quant.market_data_source,
            "risk_free_rate": quant.risk_free_rate,
            "implied_volatility": quant.implied_volatility,
            "greeks": quant.greeks,
        },
        "sentiment_quantization": {
            "finbert_polarity_score": sentiment.finbert_polarity_score,
            "softmax_probabilities": sentiment.softmax_probabilities,
            "deterministic_catalyst_tag": sentiment.deterministic_catalyst_tag,
            "confidence": sentiment.confidence,
            "catalyst_strength": sentiment.catalyst_strength,
            "ticker_mentioned": sentiment.ticker_mentioned,
            "engine": sentiment.engine,
        },
        "synthesis_and_risk": {
            "recommended_strategy": synthesis.recommended_strategy,
            "implied_volatility_percentile": synthesis.implied_volatility_percentile,
            "iv_crush_probability_score": synthesis.iv_crush_probability_score,
            "conformal_pid_control": synthesis.conformal_pid_control,
            "spci_residual_lag_w": synthesis.spci_residual_lag_w,
            "pricing_residuals": synthesis.pricing_residuals,
            "execution_status": final_status,
        },
        "pipeline_nodes": {
            "node_1_orchestrator": "COMPLETE",
            "node_2_quantitative": "COMPLETE",
            "node_3_sentiment": "COMPLETE",
            "node_4_synthesis": final_status,
        },
    }
