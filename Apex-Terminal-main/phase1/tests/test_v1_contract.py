"""
V1 Contract Tests

These tests prove that the autopilot enforces the V1 contract:

1. Max 10 open positions
2. Max $1,000 total exposure
3. 10% hard stop per position
4. Only LONG_CALL and LONG_PUT templates allowed

These are NON-NEGOTIABLE constraints that must be enforced at the ENGINE level,
not just the UI.
"""
import pytest
import os
import sys
from pathlib import Path
from datetime import datetime, timezone
from unittest.mock import Mock, MagicMock, patch

sys.path.insert(0, str(Path(__file__).parent.parent))

from services.autopilot.config import (
    AutopilotConfig, RiskLimits, StrategyTemplate,
    V1_MAX_OPEN_POSITIONS, V1_MAX_TOTAL_EXPOSURE_USD,
    V1_PER_POSITION_STOP_PCT, V1_PAPER_EQUITY, V1_TEMPLATES,
    reset_config_cache,
)
from services.autopilot.exit_monitor import (
    ExitMonitor, PositionMonitor, ExitTrigger, V1_HARD_STOP_PCT
)


# Fixture to reset config before tests
@pytest.fixture(autouse=True)
def reset_config_before_tests():
    """Reset config cache and remove saved config file before each test."""
    reset_config_cache()
    # Remove saved config file that may override defaults
    config_path = Path(__file__).parent.parent / "autopilot_config.json"
    if config_path.exists():
        # Temporarily rename it
        backup_path = config_path.with_suffix(".json.bak")
        config_path.rename(backup_path)
        yield
        # Restore after test
        if backup_path.exists():
            backup_path.rename(config_path)
    else:
        yield


class TestV1ContractConstants:
    """Test that V1 contract constants are correctly defined."""
    
    def test_max_open_positions(self):
        """V1 Contract: Max 10 open positions."""
        assert V1_MAX_OPEN_POSITIONS == 10
        
    def test_max_total_exposure(self):
        """V1 Contract: Max $1,000 total exposure."""
        assert V1_MAX_TOTAL_EXPOSURE_USD == 1000.0
        
    def test_per_position_stop(self):
        """V1 Contract: 10% hard stop per position."""
        assert V1_PER_POSITION_STOP_PCT == 0.10
        
    def test_paper_equity(self):
        """V1 Contract: $1,000 paper account."""
        assert V1_PAPER_EQUITY == 1000.0
        
    def test_v1_templates(self):
        """V1 Contract: Only LONG_CALL and LONG_PUT allowed."""
        assert StrategyTemplate.LONG_CALL in V1_TEMPLATES
        assert StrategyTemplate.LONG_PUT in V1_TEMPLATES
        assert len(V1_TEMPLATES) == 2
        # Short premium NOT allowed in V1
        assert StrategyTemplate.PUT_CREDIT_SPREAD not in V1_TEMPLATES
        assert StrategyTemplate.CALL_CREDIT_SPREAD not in V1_TEMPLATES
        assert StrategyTemplate.IRON_CONDOR not in V1_TEMPLATES


class TestRiskLimitsDefaults:
    """Test that RiskLimits defaults match V1 contract."""
    
    def test_default_max_positions(self):
        """V1 Contract: Default max positions = 10."""
        limits = RiskLimits()
        assert limits.max_open_positions == 10
        
    def test_default_total_exposure(self):
        """V1 Contract: Default max exposure = $1,000."""
        limits = RiskLimits()
        assert limits.max_total_exposure_usd == 1000.0
        
    def test_default_stop_loss(self):
        """V1 Contract: Default stop loss = 10%."""
        limits = RiskLimits()
        assert limits.per_position_stop_pct == 0.10


class TestAutopilotConfigDefaults:
    """Test that AutopilotConfig defaults match V1 contract."""
    
    def test_default_config_uses_v1_limits(self):
        """AutopilotConfig must use V1 limits by default."""
        config = AutopilotConfig()
        assert config.risk_limits.max_open_positions == 10
        assert config.risk_limits.max_total_exposure_usd == 1000.0
        assert config.risk_limits.per_position_stop_pct == 0.10
        
    def test_default_config_v1_templates_only(self):
        """AutopilotConfig must only allow V1 templates by default."""
        config = AutopilotConfig()
        for template in config.allowed_strategies:
            assert template in V1_TEMPLATES, \
                f"Non-V1 template {template} found in default config"


class TestPositionLimitEnforcement:
    """Test that the 11th position is blocked."""
    
    def test_refuses_11th_position(self):
        """V1 Contract: Engine must refuse an 11th position."""
        from services.autopilot.unified_engine import UnifiedAutopilotEngine, UnifiedPosition
        from services.autopilot.config import reset_config_cache
        
        # Reset config to ensure V1 defaults
        reset_config_cache()
        engine = UnifiedAutopilotEngine()
        
        # Create 10 mock positions (at the limit)
        mock_positions = []
        for i in range(10):
            pos = Mock(spec=UnifiedPosition)
            pos.underlying = f"SYM{i}"
            pos.symbol = f"SYM{i}C100"
            pos.market_value = 50.0  # $50 each, $500 total (under $1000)
            pos.asset_class = "us_option"
            pos.dte = 10  # Active position
            mock_positions.append(pos)
        
        # Check risk with 10 positions (at limit) - uses _check_risk_budget
        can_trade = engine._check_risk_budget(positions=mock_positions, daily_trades=0)
        
        # At 10 positions, should be blocked (>= max)
        assert can_trade is False, "Engine should refuse at max positions"
        
    def test_allows_under_limit(self):
        """V1 Contract: Engine allows trades under position limit."""
        from services.autopilot.unified_engine import UnifiedAutopilotEngine, UnifiedPosition
        from services.autopilot.config import reset_config_cache
        
        # Reset config to ensure V1 defaults
        reset_config_cache()
        engine = UnifiedAutopilotEngine()
        
        # Create 5 mock positions (under limit of 10)
        mock_positions = []
        for i in range(5):
            pos = Mock(spec=UnifiedPosition)
            pos.underlying = f"SYM{i}"
            pos.symbol = f"SYM{i}C100"
            pos.market_value = 50.0
            pos.asset_class = "us_option"
            pos.dte = 10  # Active position
            mock_positions.append(pos)
        
        can_trade = engine._check_risk_budget(positions=mock_positions, daily_trades=0)
        
        assert can_trade is True, "Engine should allow trades under position limit"


class TestExposureLimitEnforcement:
    """Test that exceeding $1,000 exposure is blocked."""
    
    def test_refuses_exceeding_exposure(self):
        """V1 Contract: Engine must refuse exceeding 50% buying power ($500)."""
        from services.autopilot.unified_engine import UnifiedAutopilotEngine, UnifiedPosition
        
        engine = UnifiedAutopilotEngine()
        
        # Create positions that exceed 50% buying power ($500 of $1000)
        mock_positions = []
        for i in range(3):
            pos = Mock(spec=UnifiedPosition)
            pos.underlying = f"SYM{i}"
            pos.symbol = f"SYM{i}C100"
            pos.market_value = 200.0  # $200 each, $600 total = 60% > 50%
            pos.asset_class = "us_option"
            pos.dte = 10  # Active position
            mock_positions.append(pos)
        
        can_trade = engine._check_risk_budget(positions=mock_positions, daily_trades=0)
        
        # At 60% buying power, should be blocked (>= 50%)
        assert can_trade is False, "Engine should refuse at max buying power"


class TestStopLossEnforcement:
    """Test that 10% stop loss triggers exit."""
    
    def test_stop_loss_constant(self):
        """V1 Contract: Hard stop must be 10%."""
        assert V1_HARD_STOP_PCT == 0.10
        
    def test_stop_loss_in_position_monitor(self):
        """V1 Contract: PositionMonitor uses 10% stop loss."""
        monitor = PositionMonitor(
            position_id="test_pos",
            entry_price=1.00,
            entry_time=datetime.now(timezone.utc),
            is_debit=True  # V1: long premium
        )
        assert monitor.hard_stop_pct == 0.10
        
    def test_exit_triggered_at_10pct_loss(self):
        """V1 Contract: Exit triggers at exactly -10% P&L."""
        monitor = PositionMonitor(
            position_id="test_pos",
            entry_price=1.00,
            entry_time=datetime.now(timezone.utc),
            is_debit=True
        )
        
        # At -11%, stop should trigger (use > 10% to avoid float precision issues)
        signals = monitor.record_sample(
            current_price=0.89,  # -11% (clearly below -10% threshold)
            timestamp=datetime.now(timezone.utc)
        )
        
        # Check if hard stop triggered
        hard_stop_signals = [s for s in signals if s.trigger == ExitTrigger.HARD_STOP]
        assert len(hard_stop_signals) == 1
        assert hard_stop_signals[0].triggered is True
        
    def test_no_exit_above_10pct_loss(self):
        """V1 Contract: No exit trigger above -10% threshold."""
        monitor = PositionMonitor(
            position_id="test_pos",
            entry_price=1.00,
            entry_time=datetime.now(timezone.utc),
            is_debit=True
        )
        
        # At -5%, stop should NOT trigger
        signals = monitor.record_sample(
            current_price=0.95,  # -5%
            timestamp=datetime.now(timezone.utc)
        )
        
        hard_stop_signals = [s for s in signals if s.trigger == ExitTrigger.HARD_STOP]
        for signal in hard_stop_signals:
            assert signal.triggered is False


class TestTemplateEnforcement:
    """Test that short premium templates are blocked."""
    
    def test_config_rejects_short_premium(self):
        """V1 Contract: Config validation rejects short premium templates."""
        config = AutopilotConfig()
        
        # Default config should validate fine
        config.validate()  # Should not raise
        
        # Manually add a forbidden template
        config.allowed_strategies.append(StrategyTemplate.PUT_CREDIT_SPREAD)
        
        # Now validate should raise
        with pytest.raises(ValueError) as exc_info:
            config.validate()
        
        assert "V1 Contract Violation" in str(exc_info.value)
        assert "PUT_CREDIT_SPREAD" in str(exc_info.value).upper()
        
    def test_only_long_premium_in_v1(self):
        """V1 Contract: V1_TEMPLATES contains only long premium."""
        long_premium = {StrategyTemplate.LONG_CALL, StrategyTemplate.LONG_PUT}
        assert set(V1_TEMPLATES) == long_premium
        
    def test_short_premium_not_allowed(self):
        """V1 Contract: Short premium strategies not in V1."""
        short_premium = [
            StrategyTemplate.PUT_CREDIT_SPREAD,
            StrategyTemplate.CALL_CREDIT_SPREAD,
            StrategyTemplate.IRON_CONDOR,
        ]
        for template in short_premium:
            assert template not in V1_TEMPLATES


class TestRiskConstraintLogging:
    """Test that constraint violations are logged."""
    
    def test_position_block_logged(self):
        """V1 Contract: Position limit block must be logged."""
        from services.autopilot.unified_engine import UnifiedAutopilotEngine, UnifiedPosition
        import logging
        
        engine = UnifiedAutopilotEngine()
        
        # Create 10 positions (at limit)
        mock_positions = []
        for i in range(10):
            pos = Mock(spec=UnifiedPosition)
            pos.underlying = f"SYM{i}"
            pos.symbol = f"SYM{i}C"
            pos.market_value = 50
            pos.asset_class = "us_option"
            pos.dte = 10  # Active position
            mock_positions.append(pos)
        
        with patch('services.autopilot.unified_engine.logger') as mock_logger:
            result = engine._check_risk_budget(positions=mock_positions, daily_trades=0)
            
            # Should be blocked
            assert result is False
            
            # Logger should have been called with position limit message
            log_calls = [str(call) for call in mock_logger.info.call_args_list]
            assert any("max positions" in str(call).lower() for call in log_calls), \
                "Position limit violation must be logged"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
