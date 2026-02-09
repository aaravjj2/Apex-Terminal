import pytest
import asyncio
from unittest.mock import MagicMock, patch
from datetime import datetime

from services.autopilot.unified_engine import (
    UnifiedAutopilotEngine,
    SentimentSnapshot,
    ValidationGate
)
from services.autopilot.config import AntiThrashControls

# Mock the config object structure
class MockConfig:
    def __init__(self):
        self.strategy_constraints = MagicMock()
        self.risk_limits = MagicMock()
        self.focus_symbol = None
        self.max_symbols_per_cycle = 5
        self.weekly_expiry_only = True
        self.paper_equity = 1000.0  # V1 COMPLIANCE: Paper equity for risk calcs
        self.anti_thrash = AntiThrashControls()  # V1: Anti-thrash controls

@pytest.mark.asyncio
async def test_sentiment_gating_bearish():
    """Test that validation rejects candidates with bearish sentiment."""
    engine = UnifiedAutopilotEngine()
    
    # Mock sentiment
    sentiment = SentimentSnapshot(
        timestamp=datetime.utcnow(),
        sentiment_scores={"AAPL": -0.5, "GOOGL": 0.2},
        provider="mock"
    )
    
    # Candidate with bearish sentiment - needs template to trigger gate
    bad_candidate = {
        "symbol": "AAPL",
        "dte": 30,
        "score": 10.0, # High technical score
        "template": "put_credit_spread",  # This is a bullish strategy
    }
    
    # Candidate with neutral/positive sentiment
    good_candidate = {
        "symbol": "GOOGL",
        "dte": 30,
        "score": 5.0, # Lower technical score but safe
        "template": "put_credit_spread",
    }
    
    # Mock positions (empty)
    positions = []
    
    # Mock the lazy import of get_autopilot_config used inside _validate_candidate
    # We patch where it is DEFINED, so the local import picks it up? 
    # Actually, local imports are hard to patch unless we patch the module 'services.autopilot.config'
    
    mock_conf = MockConfig()
    mock_conf.strategy_constraints.min_dte = 1
    mock_conf.strategy_constraints.max_dte = 60
    mock_conf.risk_limits.max_positions_per_underlying = 5
    mock_conf.risk_limits.max_open_positions = 10
    mock_conf.risk_limits.max_risk_per_trade = 20.0      # V1: Dollar value for $1000 equity @ 2%
    mock_conf.risk_limits.max_risk_per_trade_pct = 0.02  # V1: 2% per-trade
    mock_conf.risk_limits.max_buying_power_pct = 0.50    # V1: 50% buying power
    
    with patch("services.autopilot.config.get_autopilot_config", return_value=mock_conf):
        # Validate AAPL (Should Fail)
        valid, gates, errors = engine._validate_candidate(bad_candidate, positions, sentiment)
        assert not valid
        assert ValidationGate.NEWS_SENTIMENT in gates
        assert any("bearish" in e for e in errors)
        
        # Validate GOOGL (Should Pass)
        valid, gates, errors = engine._validate_candidate(good_candidate, positions, sentiment)
        assert valid
        assert len(gates) == 0

@pytest.mark.asyncio
async def test_explain_decision():
    """Test that explanation generation produces a string."""
    engine = UnifiedAutopilotEngine()
    
    candidate = {
        "symbol": "MSFT",
        "template": "put_credit_spread",
        "score": 8.5
    }
    
    explanation = await engine._explain_decision(candidate)
    
    assert isinstance(explanation, str)
    assert "MSFT" in explanation
    assert "put_credit_spread" in explanation
    assert "8.50" in explanation
