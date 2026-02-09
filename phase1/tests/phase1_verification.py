"""
Phase 1 Verification Script
Tests the 4-layer Hallucination Prevention Architecture.
"""

import sys
import os
import asyncio
import logging
from datetime import datetime
from unittest.mock import MagicMock

# Add project root to path
# Script is in phase1/tests/, we need phase1/ in path to import services.*
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))

from services.autopilot.data.validation import validate_market_data, DataValidationError
from services.autopilot.decision.models import LLMResponse, CandidateSelection, DecisionAction, TradeJustification
from services.autopilot.decision.consensus import ConsensusEngine
from services.autopilot.config import AutopilotConfig

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Phase1Verifier")

def test_layer_1_input_validation():
    logger.info("--- Testing Layer 1: Input Validation ---")
    
    # Happy Path
    from datetime import timezone
    valid_quote = {
        "price": 100.0,
        "bid": 99.0,
        "ask": 101.0,
        "timestamp": datetime.now(timezone.utc).timestamp()
    }
    assert validate_market_data(valid_quote), "Valid quote rejected"
    logger.info("✅ Valid quote passed")
    
    # Stale Data
    stale_quote = valid_quote.copy()
    stale_quote["timestamp"] = datetime.now(timezone.utc).timestamp() - 10.0 # 10s old
    try:
        validate_market_data(stale_quote, max_age_seconds=5.0)
        logger.error("❌ Stale quote NOT rejected")
    except DataValidationError:
        logger.info("✅ Stale quote correctly rejected")

def test_layer_2_output_models():
    logger.info("--- Testing Layer 2: Output Constraints ---")
    
    # Happy Path Pydantic
    valid_selection = {
        "candidate_id": "test-123",
        "action": "accept",
        "confidence": 0.95,
        "justification": {
            "technical_analysis": "Uptrend",
            "risk_assessment": "Low risk",
            "market_context": "Bullish",
            "final_verdict": "Buy"
        }
    }
    
    try:
        sel = CandidateSelection(**valid_selection)
        logger.info(f"✅ Pydantic model parsed: {sel.action}")
    except Exception as e:
        logger.error(f"❌ Valid model failed parse: {e}")

    # Invalid Action
    invalid_selection = valid_selection.copy()
    invalid_selection["action"] = "yolo" 
    try:
        CandidateSelection(**invalid_selection)
        logger.error("❌ Invalid action accepted")
    except Exception:
        logger.info("✅ Invalid action correctly rejected")

async def test_layer_3_consensus():
    logger.info("--- Testing Layer 3: Consensus Engine ---")
    
    # Mock Config
    config = AutopilotConfig()
    config.llm_settings.groq_api_key = "mock"
    config.llm_settings.gemini_api_key = "mock"
    
    engine = ConsensusEngine(config)
    
    # Mock Clients
    engine.groq.get_decision = MagicMock()
    engine.gemini.get_decision = MagicMock()
    
    # Case 1: Unanimous Accept
    valid_resp = LLMResponse(
        model_used="mock",
        selections=[
            CandidateSelection(
                candidate_id="c1",
                action=DecisionAction.ACCEPT,
                confidence=0.9,
                justification=TradeJustification(
                    technical_analysis="ok", risk_assessment="ok", 
                    market_context="ok", final_verdict="ok"
                )
            )
        ]
    )
    
    engine.groq.get_decision.return_value = valid_resp
    engine.gemini.get_decision.return_value = valid_resp
    
    candidates = [MagicMock(id="c1")]
    context = {}
    
    results = await engine.decide_with_consensus(candidates, context)
    
    if results[0].consensus_action == DecisionAction.ACCEPT:
        logger.info("✅ Unanimous ACCEPT logged correctly")
    else:
        logger.error(f"❌ Failed Unanimous Accept: {results[0]}")
        
    # Case 2: Disagreement
    reject_resp = LLMResponse(
        model_used="mock",
        selections=[
            CandidateSelection(
                candidate_id="c1",
                action=DecisionAction.REJECT,
                confidence=0.9,
                justification=TradeJustification(
                    technical_analysis="bad", risk_assessment="bad", 
                    market_context="bad", final_verdict="bad"
                )
            )
        ]
    )
    engine.gemini.get_decision.return_value = reject_resp
    
    results_split = await engine.decide_with_consensus(candidates, context)
    if results_split[0].consensus_action == DecisionAction.REJECT:
        logger.info("✅ Split Decision correctly rejected")
    else:
        logger.error(f"❌ Failed Split Decision logic: {results_split[0]}")

if __name__ == "__main__":
    test_layer_1_input_validation()
    test_layer_2_output_models()
    asyncio.run(test_layer_3_consensus())
