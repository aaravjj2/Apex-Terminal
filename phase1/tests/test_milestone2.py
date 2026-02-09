"""
Milestone 2 Integration Test

Tests all Milestone 2 components:
1. Regime Classifier
2. Strategy Templates
3. Sentiment Gate
4. Decision Engine
"""

import sys
import os
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, AsyncMock, patch

# Add path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))

from services.autopilot.regime_classifier import RegimeClassifier, MarketRegime
from services.autopilot.strategy_templates import (
    TemplateSelector, CandidateGenerator, TemplateType, TEMPLATE_A_DEBIT
)
from services.autopilot.sentiment_gate import SentimentGate, SentimentResult, NewsImpact
from services.autopilot.decision_engine import DecisionEngine, DecisionResult
from services.autopilot.state_machine import AgentStateMachine, AgentState, AgentAction

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("M2Test")

def generate_mock_bars(trend: str = "up", count: int = 50) -> list:
    """Generate mock OHLCV bars."""
    bars = []
    base_price = 100.0
    
    for i in range(count):
        if trend == "up":
            close = base_price + i * 0.5
        elif trend == "down":
            close = base_price - i * 0.3
        else:  # range
            close = base_price + (i % 5 - 2) * 0.2
        
        bars.append({
            "open": close - 0.1,
            "high": close + 0.3,
            "low": close - 0.2,
            "close": close,
            "volume": 1000000,
        })
    
    return bars

def test_regime_classifier():
    logger.info("--- Testing Regime Classifier ---")
    
    classifier = RegimeClassifier()
    
    # Test uptrend
    bars = generate_mock_bars(trend="up")
    result = classifier.classify("TEST", bars)
    assert result.regime in [MarketRegime.TREND_UP, MarketRegime.RANGE], f"Expected trend_up or range, got {result.regime}"
    logger.info(f"✅ Uptrend bars → {result.regime.value} (confidence: {result.confidence:.2f})")
    
    # Test downtrend
    bars = generate_mock_bars(trend="down")
    result = classifier.classify("TEST2", bars)
    assert result.regime in [MarketRegime.TREND_DOWN, MarketRegime.RANGE], f"Expected trend_down or range, got {result.regime}"
    logger.info(f"✅ Downtrend bars → {result.regime.value} (confidence: {result.confidence:.2f})")
    
    # Test range 
    bars = generate_mock_bars(trend="range")
    result = classifier.classify("TEST3", bars)
    logger.info(f"✅ Range bars → {result.regime.value} (confidence: {result.confidence:.2f})")
    
    # Test features
    assert result.features.ma_20 > 0
    assert result.features.adx_proxy > 0
    logger.info(f"✅ Features computed: MA20={result.features.ma_20:.2f}, ADX={result.features.adx_proxy:.1f}")

def test_template_selector():
    logger.info("--- Testing Template Selector ---")
    
    selector = TemplateSelector()
    
    # Trend → Debit
    template = selector.select_template(MarketRegime.TREND_UP)
    assert template.template_type == TemplateType.DEBIT_SPREAD
    logger.info(f"✅ TREND_UP → {template.template_type.value}")
    
    # Range → Credit
    template = selector.select_template(MarketRegime.RANGE)
    assert template.template_type == TemplateType.CREDIT_SPREAD
    logger.info(f"✅ RANGE → {template.template_type.value}")
    
    # Chaos → Token
    template = selector.select_template(MarketRegime.CHAOS)
    assert template.template_type == TemplateType.TOKEN_TRADE
    logger.info(f"✅ CHAOS → {template.template_type.value}")
    
    # Shock + Trend → Debit (not credit)
    template = selector.select_template(MarketRegime.RANGE, shock_flag=True)
    assert template.template_type == TemplateType.TOKEN_TRADE
    logger.info(f"✅ RANGE + shock → {template.template_type.value}")

def test_candidate_generator():
    logger.info("--- Testing Candidate Generator ---")
    
    selector = TemplateSelector()
    generator = CandidateGenerator(selector)
    
    template = selector.get_template(TemplateType.DEBIT_SPREAD)
    candidates = generator.generate(
        symbol="SPY",
        template=template,
        current_price=450.0,
        expiry="2026-01-21",
        regime=MarketRegime.TREND_UP,
    )
    
    assert len(candidates) > 0
    candidate = candidates[0]
    assert candidate.symbol == "SPY"
    assert candidate.template == TemplateType.DEBIT_SPREAD
    assert candidate.direction == "bullish"
    logger.info(f"✅ Generated candidate: {candidate.symbol} {candidate.long_strike}/{candidate.short_strike} score={candidate.total_score:.1f}")

async def test_sentiment_gate():
    logger.info("--- Testing Sentiment Gate ---")
    
    gate = SentimentGate()
    
    # Without API key, returns default
    result = await gate.analyze("AAPL")
    assert isinstance(result, SentimentResult)
    logger.info(f"✅ Sentiment result: shock={result.shock_flag}, score={result.sentiment_score:.2f}")
    
    # Test gate checking
    result.sentiment_score = -0.5
    result.confidence = 0.8
    gate_result = gate.check_gate(result, direction="bullish")
    assert not gate_result["passed"]  # Bearish sentiment blocks bullish trade
    logger.info(f"✅ Gate blocks bullish trade with bearish sentiment")

async def test_decision_engine():
    logger.info("--- Testing Decision Engine ---")
    
    engine = DecisionEngine(min_score_threshold=30.0)
    state_machine = AgentStateMachine()
    
    # Generate mock data
    bars = generate_mock_bars(trend="up", count=50)
    
    result = await engine.decide(
        symbol="SPY",
        current_price=450.0,
        bars=bars,
        expiry="2026-01-21",
        state_machine=state_machine,
    )
    
    assert isinstance(result, DecisionResult)
    logger.info(f"✅ Decision: {result.action.value}")
    logger.info(f"   Regime: {result.regime.value}")
    logger.info(f"   Template: {result.template_used.value if result.template_used else 'N/A'}")
    logger.info(f"   Candidates: {result.candidates_evaluated} evaluated, {result.candidates_passed} passed")
    
    if result.selected_candidate:
        logger.info(f"   Selected: {result.selected_candidate.symbol} {result.selected_candidate.direction}")

if __name__ == "__main__":
    test_regime_classifier()
    test_template_selector()
    test_candidate_generator()
    asyncio.run(test_sentiment_gate())
    asyncio.run(test_decision_engine())
    
    logger.info("\n🎉 All Milestone 2 tests passed!")
