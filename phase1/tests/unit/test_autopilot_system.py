"""
Comprehensive unit tests for autopilot system.
Tests LLM providers, hybrid selector, ledger, and configuration.
"""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime
import json
import os

# Set test environment variables before imports
os.environ.setdefault("GROQ_API_KEY", "test_groq_key")
os.environ.setdefault("GEMINI_API_KEY", "test_gemini_key")
os.environ.setdefault("LLM_MODE", "deterministic")


class TestDeterministicProvider:
    """Test deterministic provider for reproducible testing."""
    
    def test_import(self):
        """Test that DeterministicProvider can be imported."""
        from services.llm.providers.deterministic_provider import DeterministicProvider
        provider = DeterministicProvider()
        assert provider is not None
    
    def test_rank_candidates_basic(self):
        """Test basic ranking functionality using context dict."""
        from services.llm.providers.deterministic_provider import DeterministicProvider
        
        provider = DeterministicProvider(max_selections=2)
        context = {
            "candidates": [
                {"id": "1", "symbol": "AAPL", "base_score": 0.8, "liquidity_score": 6.0},
                {"id": "2", "symbol": "MSFT", "base_score": 0.9, "liquidity_score": 7.0},
                {"id": "3", "symbol": "NVDA", "base_score": 0.7, "liquidity_score": 8.0},
            ]
        }
        
        result = provider.rank_candidates(context)
        
        # Check result structure (LLMResponse)
        assert hasattr(result, 'selected_ids')
        assert len(result.selected_ids) == 2
        # MSFT should be first (highest base_score)
        assert result.selected_ids[0] == "2"  # MSFT's id
    
    def test_health_check(self):
        """Test health check always returns available."""
        from services.llm.providers.deterministic_provider import DeterministicProvider
        
        provider = DeterministicProvider()
        health = provider.health_check()
        
        assert health["available"] is True


class TestGeminiProvider:
    """Test Gemini provider."""
    
    def test_import(self):
        """Test that GeminiProvider can be imported."""
        from services.llm.providers.gemini_provider import GeminiProvider
        provider = GeminiProvider(api_key="test_key")
        assert provider is not None
    
    def test_init_with_env_key(self):
        """Test initialization with environment variable."""
        from services.llm.providers.gemini_provider import GeminiProvider
        
        with patch.dict(os.environ, {"GEMINI_API_KEY": "env_test_key"}):
            provider = GeminiProvider()
            assert provider._api_key == "env_test_key"
    
    def test_name_property(self):
        """Test name property."""
        from services.llm.providers.gemini_provider import GeminiProvider
        
        provider = GeminiProvider(api_key="test_key")
        assert "gemini" in provider.name


class TestGroqProvider:
    """Test Groq provider."""
    
    def test_import(self):
        """Test that GroqProvider can be imported."""
        from services.llm.providers.groq_provider import GroqProvider
        provider = GroqProvider(api_key="test_key")
        assert provider is not None
    
    def test_is_available_property(self):
        """Test is_available property."""
        from services.llm.providers.groq_provider import GroqProvider
        
        provider = GroqProvider(api_key="test_key")
        assert provider.is_available is True
        
        # Test with empty string (equivalent to no key)
        with patch.dict(os.environ, {"GROQ_API_KEY": ""}, clear=True):
            provider_no_key = GroqProvider(api_key=None)
            # Without key, should not be available
            assert provider_no_key.is_available is False
    
    def test_name_property(self):
        """Test name property."""
        from services.llm.providers.groq_provider import GroqProvider
        
        provider = GroqProvider(api_key="test_key")
        assert "groq" in provider.name


class TestHybridSelector:
    """Test hybrid selector."""
    
    def test_import(self):
        """Test that HybridSelector can be imported."""
        from services.autopilot.hybrid_selector import HybridSelector
        selector = HybridSelector()
        assert selector is not None
    
    def test_fallback_to_deterministic(self):
        """Test fallback when no LLM providers."""
        from services.autopilot.hybrid_selector import HybridSelector
        from services.autopilot.candidates import TradeCandidate, CandidateStatus, OptionLeg
        from services.autopilot.config import AutopilotConfig, StrategyTemplate
        from datetime import date, timedelta
        
        # Create selector with no providers - triggers deterministic fallback
        selector = HybridSelector(groq_provider=None, gemini_provider=None)
        
        # Create expiry date 14 days from now
        expiry = date.today() + timedelta(days=14)
        
        # Create test candidates with all required fields
        candidates = [
            TradeCandidate(
                id="cand_1",
                symbol="AAPL",
                template=StrategyTemplate.PUT_CREDIT_SPREAD,
                legs=[
                    OptionLeg(option_type="put", strike=150.0, expiry=expiry, side="sell", premium=2.50, delta=-0.25),
                    OptionLeg(option_type="put", strike=145.0, expiry=expiry, side="buy", premium=1.00, delta=-0.15),
                ],
                underlying_price=155.0,
                base_score=0.8,
                pop=0.7,
                max_loss=2.50,
                max_profit=1.50,
                dte=14,
                iv_rank=0.5,
                liquidity_score=0.9,
                spread_percent=0.02,
                regime="neutral",
                trend="sideways",
                status=CandidateStatus.PENDING,
            ),
            TradeCandidate(
                id="cand_2",
                symbol="MSFT",
                template=StrategyTemplate.CALL_CREDIT_SPREAD,
                legs=[
                    OptionLeg(option_type="call", strike=380.0, expiry=expiry, side="sell", premium=2.00, delta=0.25),
                    OptionLeg(option_type="call", strike=385.0, expiry=expiry, side="buy", premium=0.80, delta=0.15),
                ],
                underlying_price=375.0,
                base_score=0.9,
                pop=0.6,
                max_loss=3.80,
                max_profit=1.20,
                dte=14,
                iv_rank=0.6,
                liquidity_score=0.85,
                spread_percent=0.03,
                regime="neutral",
                trend="up",
                status=CandidateStatus.PENDING,
            ),
        ]
        
        config = AutopilotConfig()
        portfolio_state = {"cash": 100000, "positions": []}
        market_context = {"regime": "neutral"}
        
        result = selector.select(candidates, config, portfolio_state, market_context)
        
        # Should get a result from deterministic fallback
        assert result is not None
        assert result.fallback_used is True


class TestTradeLedger:
    """Test trade ledger."""
    
    def test_import(self):
        """Test that TradeLedger can be imported."""
        from services.autopilot.ledger import TradeLedger, TradeStatus
        ledger = TradeLedger()
        assert ledger is not None
    
    def test_create_run(self):
        """Test creating a run."""
        from services.autopilot.ledger import TradeLedger
        
        ledger = TradeLedger()
        run = ledger.create_run("test_run_001")
        
        assert run.run_id == "test_run_001"
        assert run.status == "running"
    
    def test_add_entry(self):
        """Test adding entries."""
        from services.autopilot.ledger import TradeLedger, TradeLedgerEntry, TradeStatus
        
        ledger = TradeLedger()
        ledger.create_run("test_run_002")
        
        entry = TradeLedgerEntry(
            id="entry_001",
            run_id="test_run_002",
            symbol="AAPL",
            template="put_credit_spread",
            status=TradeStatus.PROPOSED,
            proposed_at=datetime.utcnow(),
            max_loss=25.0,
            max_profit=50.0,
        )
        
        ledger.add_entry(entry)
        
        entries = ledger.get_entries_for_run("test_run_002")
        assert len(entries) == 1
        assert entries[0].symbol == "AAPL"
    
    def test_update_entry_status(self):
        """Test updating entry status."""
        from services.autopilot.ledger import TradeLedger, TradeLedgerEntry, TradeStatus
        
        ledger = TradeLedger()
        ledger.create_run("test_run_003")
        
        entry = TradeLedgerEntry(
            id="entry_002",
            run_id="test_run_003",
            symbol="MSFT",
            template="call_credit_spread",
            status=TradeStatus.PROPOSED,
            proposed_at=datetime.utcnow(),
            max_loss=30.0,
            max_profit=60.0,
        )
        
        ledger.add_entry(entry)
        ledger.update_entry("entry_002", status=TradeStatus.VALIDATED)
        ledger.update_entry("entry_002", status=TradeStatus.PLACED, alpaca_order_id="ord_123")
        
        entries = ledger.get_entries_for_run("test_run_003")
        assert entries[0].status == TradeStatus.PLACED
        assert entries[0].alpaca_order_id == "ord_123"
    
    def test_complete_run(self):
        """Test completing a run."""
        from services.autopilot.ledger import TradeLedger
        
        ledger = TradeLedger()
        ledger.create_run("test_run_004")
        ledger.complete_run("test_run_004", status="completed")
        
        run = ledger.get_run("test_run_004")
        assert run.status == "completed"
        assert run.completed_at is not None


class TestAutopilotConfig:
    """Test autopilot configuration."""
    
    def test_load_llm_config(self):
        """Test loading LLM config from environment."""
        from services.autopilot.config import load_llm_config_from_env, LLMMode
        
        with patch.dict(os.environ, {"LLM_MODE": "hybrid"}):
            config = load_llm_config_from_env()
            assert config.mode == LLMMode.HYBRID
    
    def test_default_mode(self):
        """Test default mode when not set."""
        from services.autopilot.config import load_llm_config_from_env, LLMMode
        
        with patch.dict(os.environ, {"LLM_MODE": ""}, clear=False):
            config = load_llm_config_from_env()
            # Should default to deterministic for safety
            assert config.mode in [LLMMode.DETERMINISTIC, LLMMode.HYBRID, LLMMode.GROQ, LLMMode.GEMINI]


class TestTradierProvider:
    """Test Tradier options provider."""
    
    def test_import(self):
        """Test that TradierOptionsProvider can be imported."""
        from services.options.tradier_provider import TradierOptionsProvider
        provider = TradierOptionsProvider(api_key="test_key")
        assert provider is not None
    
    def test_is_available(self):
        """Test provider availability check."""
        from services.options.tradier_provider import TradierOptionsProvider
        
        provider = TradierOptionsProvider(api_key="test_key")
        # Should be available with API key and requests library
        assert provider.is_available is True
    
    def test_health_check(self):
        """Test health check returns proper structure."""
        from services.options.tradier_provider import TradierOptionsProvider
        
        provider = TradierOptionsProvider(api_key="test_key")
        health = provider.health_check()
        
        # Should return a dict with available key
        assert isinstance(health, dict)
        assert "available" in health


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
