"""Triple-check unit tests for 4-node Research Agent."""

from __future__ import annotations

from datetime import date

import pytest

from services.research_agent.osi_parser import OSIParseError, parse_osi, osi_from_occ
from services.research_agent.quant_engine import (
    bs_price,
    corrado_miller_initial_guess,
    implied_volatility_newton,
    jaeckel_rational_seed,
)
from services.research_agent.handshake_bridge import trade_plan_to_manifest
from services.research_agent.quality import compute_research_quality
from services.research_agent.sentiment_engine import finbert_available, run_sentiment_engine, tag_catalyst
from services.research_agent.state_machine import run_research_agent
from services.research_agent.synthesis_engine import (
    conformal_pid_update,
    iv_percentile,
    recommend_strategy,
    run_synthesis_engine,
)


def test_osi_parse_blueprint_example():
    c = parse_osi("SPY   251219C00600000")
    assert c.underlying == "SPY"
    assert c.expiration_date.isoformat() == "2025-12-19"
    assert c.option_type == "Call"
    assert c.strike_price == 600.0


def test_osi_rejects_bad_length():
    with pytest.raises(OSIParseError):
        parse_osi("SPY")


def test_occ_to_osi():
    osi = osi_from_occ("SPY251219C00600000")
    assert len(osi) == 21
    assert parse_osi(osi).strike_price == 600.0


def test_newton_iv_converges():
    S, K, t, r = 542.15, 600.0, 0.5, 0.045
    target_sigma = 0.22
    market = bs_price(S, K, t, r, target_sigma, "Call")
    iv, method, iters, reliable = implied_volatility_newton(market, S, K, t, r, "Call")
    assert iters > 0
    assert reliable
    assert abs(iv - target_sigma) < 0.001
    assert "Corrado" in method or "Jaeckel" in method or "Bisection" in method


def test_corrado_miller_seed_positive():
    sigma, valid = corrado_miller_initial_guess(100, 100, 0.25, 0.05, 5.0, "Call")
    assert valid
    assert 0.05 <= sigma <= 3.0


def test_jaeckel_seed_deep_otm():
    seed = jaeckel_rational_seed(542.15, 600.0, 0.5, 0.045, 2.5, "Call")
    assert 0.05 <= seed <= 3.0


def test_iv_percentile_realized_vol():
    hist = [0.12, 0.14, 0.16, 0.18, 0.20, 0.22, 0.24]
    assert iv_percentile(0.22, hist) == pytest.approx(85.7, abs=0.2)


def test_strategy_earnings_beat_high_iv():
    s = recommend_strategy(
        option_type="Call",
        polarity=0.82,
        iv_pct=82.4,
        catalyst="EARNINGS_BEAT",
        crush_score=0.85,
    )
    assert s == "Bear Put Spread"


def test_sentiment_earnings_beat():
    r = run_sentiment_engine(
        "SPY beats earnings and raises guidance",
        event_type="EARNINGS_BEAT",
        underlying="SPY",
    )
    assert r.finbert_polarity_score > 0
    assert r.deterministic_catalyst_tag == "EARNINGS_BEAT"
    assert r.ticker_mentioned
    assert r.confidence > 0
    assert r.catalyst_strength >= 0.9
    probs = r.softmax_probabilities
    assert abs(sum(probs.values()) - 1.0) < 0.01


def test_ontology_tag_regex():
    assert tag_catalyst("CEO steps down amid probe").value == "CEO_RESIGNATION"
    assert tag_catalyst("Company beats earnings estimates").value == "EARNINGS_BEAT"


def test_conformal_pid_integral():
    q = conformal_pid_update(errors=[0, 0, 1, 0], alpha=0.05, q_hat=0.15)
    assert q != 0.15


def test_finbert_availability_is_bool():
    assert isinstance(finbert_available(), bool)


def test_quality_scoring_flags_expired():
    q = compute_research_quality(
        quant={
            "implied_volatility": {"value": 0},
            "iv_reliable": False,
            "market_data_source": "synthetic_fallback",
            "black_scholes_theoretical_price": 10,
            "market_bid_ask_mid": 12,
            "days_to_expiry": -5,
            "moneyness": 1.1,
        },
        sentiment={"confidence": 0.3, "ticker_mentioned": False},
        synthesis={"implied_volatility_percentile": 50},
        provenance={"iv_percentile_source": "fallback"},
    )
    assert q.score < 50
    assert q.grade in ("D", "F")
    assert any("expired" in w.lower() for w in q.warnings)


def test_trade_plan_manifest_keys():
    payload = run_research_agent(
        osi_symbol="SPY   251219C00600000",
        news_text="SPY beats earnings",
        market_mid=12.60,
        spot_override=542.15,
        as_of=date(2025, 6, 9),
    )
    manifest = trade_plan_to_manifest(payload)
    assert manifest["source"] == "research_agent_4_node"
    assert manifest["underlying"] == "SPY"
    assert "recommended_strategy" in manifest


def test_demo_blueprint_payload():
    payload = run_research_agent(
        osi_symbol="SPY   251219C00600000",
        news_text="SPY beats earnings estimates; guidance raised for next quarter",
        event_type="EARNINGS_BEAT",
        market_mid=12.60,
        spot_override=542.15,
        as_of=date(2025, 6, 9),
        trade_plan_id="REQ-7738-ALPHA",
    )
    assert payload["trade_plan_id"] == "REQ-7738-ALPHA"
    assert payload["synthesis_and_risk"]["recommended_strategy"] == "Bear Put Spread"
    assert payload["research_quality"]["score"] >= 65
    assert payload["news_ingestion"]["source"] == "manual"
    iv = payload["quantitative_engine"]["implied_volatility"]["value"]
    assert 0.15 < iv < 0.30
    assert payload["quantitative_engine"]["iv_reliable"]


def test_full_state_machine_payload():
    payload = run_research_agent(
        osi_symbol="SPY   251219C00600000",
        news_text="SPY beats earnings estimates",
        market_mid=12.60,
        spot_override=542.15,
        as_of=date(2025, 6, 9),
    )
    assert payload["orchestrator_node"]["parsed_components"]["underlying"] == "SPY"
    assert "greeks" in payload["quantitative_engine"]
    assert "research_quality" in payload
    assert "sentiment_quantization" in payload
    assert payload["synthesis_and_risk"]["execution_status"] in ("APPROVED", "REJECTED", "REVIEW")
    assert payload["pipeline_nodes"]["node_4_synthesis"] == payload["synthesis_and_risk"]["execution_status"]


def test_synthesis_uses_residuals_not_hardcoded():
    result = run_synthesis_engine(
        option_type="Call",
        polarity=0.5,
        iv_value=0.22,
        catalyst="EARNINGS_BEAT",
        theoretical_price=12.45,
        market_mid=12.60,
        spot=542.15,
        strike=600.0,
        time_to_expiry=0.5,
        risk_free_rate=0.045,
        realized_vol_history=[0.14, 0.16, 0.18, 0.20, 0.22, 0.19, 0.17],
        iv_reliable=True,
        days_to_expiry=180,
        quality_score=85,
    )
    assert len(result.pricing_residuals) > 0
    assert result.iv_percentile_source == "realized_vol_history"
