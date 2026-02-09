"""
Milestone 4 Integration Test

Tests all Milestone 4 components:
1. Bounded LLM Advisor
2. Trade Logger
3. Training Dataset Builder
4. Simple Ranker
"""

import sys
import os
import asyncio
import logging
from datetime import datetime, timedelta, timezone
import uuid

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))

from services.autopilot.llm_advisor import (
    BoundedLLMAdvisor, AdvisorMode, AdvisorRequest, AdvisorResponse
)
from services.autopilot.ranker_training import (
    TradeLogEntry, TradeLogger, TrainingDatasetBuilder, SimpleRanker
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("M4Test")

def test_advisor_modes():
    logger.info("--- Testing LLM Advisor Modes ---")
    
    advisor = BoundedLLMAdvisor(mode=AdvisorMode.OFF)
    
    # OFF mode
    assert advisor.mode == AdvisorMode.OFF
    assert not advisor.is_enabled
    logger.info("✅ OFF mode: advisor disabled")
    
    # Switch to TIE_BREAK
    advisor.set_mode(AdvisorMode.TIE_BREAK_ONLY)
    assert advisor.is_enabled
    logger.info("✅ TIE_BREAK mode: advisor enabled")
    
    # Switch to FULL
    advisor.set_mode(AdvisorMode.FULL)
    assert advisor.is_enabled
    logger.info("✅ FULL mode: advisor enabled")

async def test_advisor_request():
    logger.info("--- Testing Advisor Request/Response ---")
    
    advisor = BoundedLLMAdvisor(mode=AdvisorMode.OFF)
    
    request = AdvisorRequest(
        request_id=str(uuid.uuid4()),
        timestamp=datetime.now(timezone.utc),
        candidates=[
            {"symbol": "SPY", "template": "debit_spread", "direction": "bullish", "total_score": 75},
            {"symbol": "AAPL", "template": "debit_spread", "direction": "bullish", "total_score": 72},
        ],
        regime="trend_up",
        sentiment_score=0.3,
        shock_flag=False,
    )
    
    # OFF mode returns None
    result = await advisor.advise(request)
    assert result is None
    logger.info("✅ OFF mode returns None")
    
    # Test prompt generation
    prompt = request.to_prompt_context()
    assert "SPY" in prompt
    assert "trend_up" in prompt
    logger.info("✅ Prompt context generated")
    logger.info(f"   Preview: {prompt[:100]}...")

def test_trade_logger():
    logger.info("--- Testing Trade Logger ---")
    
    # Use temp file
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False) as f:
        log_path = f.name
    
    logger_obj = TradeLogger(log_path=log_path)
    
    # Create test entry
    entry = TradeLogEntry(
        trade_id=str(uuid.uuid4()),
        timestamp=datetime.now(timezone.utc),
        symbol="SPY",
        regime="trend_up",
        sentiment_score=0.3,
        shock_flag=False,
        template_type="debit_spread",
        direction="bullish",
        entry_score=75.0,
        entry_price=2.50,
        exit_price=3.00,
        pnl=50.0,
        pnl_pct=0.20,
        mae=0.10,
        mfe=0.25,
        holding_minutes=30.0,
        exit_reason="profit_target",
    )
    
    logger_obj.log(entry)
    
    # Verify logged
    entries = logger_obj.load_from_file()
    assert len(entries) == 1
    assert entries[0]["symbol"] == "SPY"
    logger.info("✅ Trade logged and loaded")
    
    # Test feature extraction
    features = entry.to_feature_vector()
    assert "sentiment_score" in features
    assert features["is_bullish"] == 1.0
    logger.info(f"✅ Features extracted: {len(features)} features")
    
    # Cleanup
    os.unlink(log_path)

def test_dataset_builder():
    logger.info("--- Testing Dataset Builder ---")
    
    builder = TrainingDatasetBuilder()
    
    # Create test entries
    entries = []
    for i in range(50):
        entry = TradeLogEntry(
            trade_id=str(uuid.uuid4()),
            timestamp=datetime.now(timezone.utc),
            symbol="SPY",
            regime="trend_up",
            sentiment_score=0.3 + (i % 10) * 0.05,
            shock_flag=i % 5 == 0,
            template_type="debit_spread" if i % 2 == 0 else "credit_spread",
            direction="bullish" if i % 3 != 0 else "bearish",
            entry_score=60 + i % 30,
            liquidity_score=0.7,
            volatility_score=0.5,
            pnl=20 if i % 3 == 0 else -10,
            pnl_pct=0.1 if i % 3 == 0 else -0.05,
            mae=0.08,
            mfe=0.15,
            holding_minutes=25,
        )
        entries.append(entry)
    
    # Build entry score dataset
    dataset = builder.build_entry_score_dataset(entries)
    
    assert dataset["num_samples"] == 50
    assert len(dataset["feature_names"]) > 0
    logger.info(f"✅ Entry score dataset: {dataset['num_samples']} samples")
    logger.info(f"   Features: {dataset['feature_names']}")
    
    # Build exit urgency dataset
    exit_dataset = builder.build_exit_urgency_dataset(entries)
    assert exit_dataset["num_samples"] > 0
    logger.info(f"✅ Exit urgency dataset: {exit_dataset['num_samples']} samples")

def test_simple_ranker():
    logger.info("--- Testing Simple Ranker ---")
    
    ranker = SimpleRanker()
    
    # Create synthetic training data
    X = [
        {"sentiment_score": 0.5, "entry_score": 80, "liquidity_score": 0.8},
        {"sentiment_score": -0.3, "entry_score": 60, "liquidity_score": 0.5},
        {"sentiment_score": 0.8, "entry_score": 90, "liquidity_score": 0.9},
        {"sentiment_score": -0.5, "entry_score": 40, "liquidity_score": 0.3},
    ] * 25  # Multiply for minimum samples
    
    y = [1, 0, 1, 0] * 25
    
    feature_names = ["sentiment_score", "entry_score", "liquidity_score"]
    
    # Train
    metrics = ranker.train(X, y, feature_names)
    logger.info(f"✅ Ranker trained")
    
    if "fallback" not in metrics:
        logger.info(f"   Accuracy: {metrics['accuracy']:.3f}")
        logger.info(f"   AUC: {metrics['auc']:.3f}")
    
    # Predict
    test_features = {"sentiment_score": 0.6, "entry_score": 85, "liquidity_score": 0.7}
    score = ranker.predict(test_features)
    
    assert 0 <= score <= 100
    logger.info(f"✅ Prediction: {score:.1f}")

if __name__ == "__main__":
    test_advisor_modes()
    asyncio.run(test_advisor_request())
    test_trade_logger()
    test_dataset_builder()
    test_simple_ranker()
    
    logger.info("\n🎉 All Milestone 4 tests passed!")
