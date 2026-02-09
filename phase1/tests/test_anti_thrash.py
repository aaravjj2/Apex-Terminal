"""
Tests for V1 Anti-Thrash Controls.

These tests verify:
1. Ticker cooldown after stop-out (30 min default)
2. Circuit breaker after consecutive stop-outs (3 max)
3. Daily loss limit (5% default)
4. Counter resets on profitable exit
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

from services.autopilot.unified_engine import UnifiedAutopilotEngine
from services.autopilot.config import (
    AntiThrashControls,
    AutopilotConfig,
    get_autopilot_config,
)


class TestAntiThrashControls:
    """Test the AntiThrashControls dataclass defaults."""
    
    def test_default_ticker_cooldown(self):
        """Ticker cooldown should be 1800 seconds (30 min) by default."""
        controls = AntiThrashControls()
        assert controls.ticker_cooldown_seconds == 1800
    
    def test_default_max_consecutive_stopouts(self):
        """Max consecutive stop-outs should be 3 by default."""
        controls = AntiThrashControls()
        assert controls.max_consecutive_stopouts == 3
    
    def test_default_circuit_breaker_duration(self):
        """Circuit breaker duration should be 3600 seconds (1 hour) by default."""
        controls = AntiThrashControls()
        assert controls.circuit_breaker_duration_seconds == 3600
    
    def test_default_daily_loss_limit(self):
        """Daily loss limit should be 5% by default."""
        controls = AntiThrashControls()
        assert controls.daily_loss_limit_pct == 0.05
    
    def test_min_seconds_between_entries_default(self):
        """Minimum seconds between entries should be 60 by default."""
        controls = AntiThrashControls()
        assert controls.min_seconds_between_entries == 60


class TestTickerCooldown:
    """Test ticker-specific cooldown after stop-out."""
    
    @pytest.fixture
    def engine(self):
        """Create engine with mocked paper verification."""
        with patch.object(UnifiedAutopilotEngine, '_verify_paper_only', return_value=True):
            engine = UnifiedAutopilotEngine()
            engine._paper_verified = True
            return engine
    
    def test_ticker_blocked_after_stopout(self, engine):
        """A ticker should be blocked immediately after a stop-out."""
        engine.record_stopout("AAPL", 0.01)  # Small loss to not hit daily limit
        
        allowed, reason = engine._check_anti_thrash_gates("AAPL")
        
        assert allowed is False
        assert "AAPL on cooldown" in reason
    
    def test_different_ticker_not_blocked(self, engine):
        """A different ticker should not be blocked."""
        engine.record_stopout("AAPL", 0.01)  # Small loss to not hit daily limit
        
        allowed, reason = engine._check_anti_thrash_gates("MSFT")
        
        assert allowed is True
        assert reason is None
    
    def test_ticker_allowed_after_cooldown_expires(self, engine):
        """A ticker should be allowed after cooldown expires."""
        # Record stop-out in the past
        engine._ticker_last_stopout["AAPL"] = datetime.now() - timedelta(seconds=1900)  # > 1800s
        
        allowed, reason = engine._check_anti_thrash_gates("AAPL")
        
        assert allowed is True
        assert reason is None


class TestCircuitBreaker:
    """Test circuit breaker after consecutive stop-outs."""
    
    @pytest.fixture
    def engine(self):
        """Create engine with mocked paper verification."""
        with patch.object(UnifiedAutopilotEngine, '_verify_paper_only', return_value=True):
            engine = UnifiedAutopilotEngine()
            engine._paper_verified = True
            return engine
    
    def test_circuit_breaker_activates_after_3_stopouts(self, engine):
        """Circuit breaker should activate after 3 consecutive stop-outs."""
        engine.record_stopout("AAPL", 0.10)
        engine.record_stopout("MSFT", 0.10)
        engine.record_stopout("GOOGL", 0.10)  # Third stop-out triggers circuit breaker
        
        assert engine._circuit_breaker_until is not None
        assert engine._circuit_breaker_until > datetime.now()
    
    def test_circuit_breaker_blocks_all_tickers(self, engine):
        """Circuit breaker should block ALL tickers."""
        engine._circuit_breaker_until = datetime.now() + timedelta(seconds=3600)
        
        allowed, reason = engine._check_anti_thrash_gates("NVDA")
        
        assert allowed is False
        assert "Circuit breaker active" in reason
    
    def test_circuit_breaker_expires(self, engine):
        """Circuit breaker should expire after duration."""
        engine._circuit_breaker_until = datetime.now() - timedelta(seconds=1)  # Already expired
        
        allowed, reason = engine._check_anti_thrash_gates("NVDA")
        
        assert allowed is True


class TestDailyLossLimit:
    """Test daily loss limit enforcement."""
    
    @pytest.fixture
    def engine(self):
        """Create engine with mocked paper verification."""
        with patch.object(UnifiedAutopilotEngine, '_verify_paper_only', return_value=True):
            engine = UnifiedAutopilotEngine()
            engine._paper_verified = True
            return engine
    
    def test_daily_loss_limit_blocks_trading(self, engine):
        """Trading should be blocked when daily loss limit reached."""
        engine._daily_loss_pct = 0.05  # At limit
        
        allowed, reason = engine._check_anti_thrash_gates("AAPL")
        
        assert allowed is False
        assert "Daily loss limit reached" in reason
    
    def test_under_daily_loss_limit_allowed(self, engine):
        """Trading should be allowed under daily loss limit."""
        engine._daily_loss_pct = 0.03  # Under limit
        
        allowed, reason = engine._check_anti_thrash_gates("AAPL")
        
        assert allowed is True
    
    def test_loss_accumulates(self, engine):
        """Daily loss should accumulate across multiple stop-outs."""
        engine.record_stopout("AAPL", 0.02)
        engine.record_stopout("MSFT", 0.02)
        
        assert engine._daily_loss_pct == 0.04


class TestProfitableExitReset:
    """Test that profitable exits reset consecutive stop-out counter."""
    
    @pytest.fixture
    def engine(self):
        """Create engine with mocked paper verification."""
        with patch.object(UnifiedAutopilotEngine, '_verify_paper_only', return_value=True):
            engine = UnifiedAutopilotEngine()
            engine._paper_verified = True
            return engine
    
    def test_profitable_exit_resets_counter(self, engine):
        """Profitable exit should reset consecutive stop-out counter."""
        engine.record_stopout("AAPL", 0.10)
        engine.record_stopout("MSFT", 0.10)
        assert engine._consecutive_stopouts == 2
        
        engine.record_profitable_exit()
        
        assert engine._consecutive_stopouts == 0
    
    def test_profitable_exit_does_not_reset_daily_loss(self, engine):
        """Profitable exit should NOT reset daily loss counter."""
        engine.record_stopout("AAPL", 0.02)
        engine.record_profitable_exit()
        
        assert engine._daily_loss_pct == 0.02


class TestDailyReset:
    """Test daily counter reset functionality."""
    
    @pytest.fixture
    def engine(self):
        """Create engine with mocked paper verification."""
        with patch.object(UnifiedAutopilotEngine, '_verify_paper_only', return_value=True):
            engine = UnifiedAutopilotEngine()
            engine._paper_verified = True
            return engine
    
    def test_reset_daily_counters(self, engine):
        """reset_daily_counters should clear daily loss and consecutive stop-outs."""
        engine._daily_loss_pct = 0.04
        engine._consecutive_stopouts = 2
        
        engine.reset_daily_counters(equity=1000.0)
        
        assert engine._daily_loss_pct == 0.0
        assert engine._consecutive_stopouts == 0
        assert engine._day_start_equity == 1000.0
    
    def test_reset_clears_expired_cooldowns(self, engine):
        """reset_daily_counters should clear expired ticker cooldowns."""
        # Add an expired cooldown
        engine._ticker_last_stopout["AAPL"] = datetime.now() - timedelta(seconds=2000)
        # Add a fresh cooldown
        engine._ticker_last_stopout["MSFT"] = datetime.now() - timedelta(seconds=100)
        
        engine.reset_daily_counters(equity=1000.0)
        
        # AAPL expired, should be cleared
        assert "AAPL" not in engine._ticker_last_stopout
        # MSFT still fresh, should remain
        assert "MSFT" in engine._ticker_last_stopout


class TestAntiThrashInValidateCandidate:
    """Test that anti-thrash gates are checked in _validate_candidate."""
    
    @pytest.fixture
    def engine(self):
        """Create engine with mocked paper verification."""
        with patch.object(UnifiedAutopilotEngine, '_verify_paper_only', return_value=True):
            engine = UnifiedAutopilotEngine()
            engine._paper_verified = True
            return engine
    
    def test_candidate_rejected_on_ticker_cooldown(self, engine):
        """Candidate should be rejected if ticker is on cooldown."""
        engine.record_stopout("AAPL", 0.10)
        
        candidate = {"symbol": "AAPL", "template": "long_call"}
        
        valid, gates, errors = engine._validate_candidate(
            candidate=candidate,
            positions=[],
            sentiment=MagicMock(is_blackout=False, sentiment_scores={}, shock_headlines=[]),
        )
        
        assert valid is False
        assert any("Anti-thrash" in e for e in errors)
    
    def test_candidate_accepted_if_no_cooldown(self, engine):
        """Candidate should pass anti-thrash if no cooldown."""
        candidate = {"symbol": "AAPL", "template": "long_call", "dte": 30, "max_loss": 50}
        
        valid, gates, errors = engine._validate_candidate(
            candidate=candidate,
            positions=[],
            sentiment=MagicMock(is_blackout=False, sentiment_scores={}, shock_headlines=[]),
        )
        
        # May fail other gates, but not anti-thrash
        anti_thrash_errors = [e for e in errors if "Anti-thrash" in e]
        assert len(anti_thrash_errors) == 0
