"""
Unit tests for Autopilot Module
"""
import pytest
from datetime import datetime, timezone

from services.autopilot import (
    AutopilotConfig, 
    AutopilotMode,
    RiskLimits, 
    StrategyTemplate,
    StrategyConstraints,
    UniverseManager,
    UniverseSymbol,
    TradeValidator,
    ValidationResult,
    RejectionCode,
    PaperBroker,
    PaperOrder,
    OrderType,
    PositionManager,
    OptionsPosition,
    PositionMonitor,
    ExitReason,
    ReportGenerator,
    ActivityLogger,
    # Note: AutopilotRunloop retired - use UnifiedAutopilotEngine
)


class TestAutopilotConfig:
    """Tests for AutopilotConfig"""
    
    def test_default_config(self):
        """Test default configuration values - V1 Compliant"""
        config = AutopilotConfig()
        
        # V1 COMPLIANCE: paper_equity is now configurable (default $1000 for paper)
        assert config.paper_equity >= 1000.0  # Minimum paper equity
        assert config.mode == AutopilotMode.PAPER
        # V1 COMPLIANCE: Only LONG_CALL and LONG_PUT allowed in V1
        assert len(config.allowed_strategies) == 2  # V1: 2 single-leg only
        
    def test_risk_limits_defaults(self):
        """Test V1 percentage-based risk limits (OPTIMIZED for high win rate)"""
        limits = RiskLimits()
        
        # V1 OPTIMIZED: Percentage-based limits for $1000 micro-account
        assert limits.max_risk_per_trade_pct == 0.10  # 10% per-trade (optimized)
        assert limits.max_buying_power_pct == 0.50    # 50% buying power
        assert limits.max_daily_loss_pct == 0.10      # 10% daily loss (tighter)
        # V1 CONTRACT: Max 10 positions
        assert limits.max_open_positions == 10        # V1: Max 10 positions
        # V1 CONTRACT: Max $1,000 exposure
        assert limits.max_total_exposure_usd == 1000.0
        # V1 CONTRACT: 10% hard stop (V1 contract specifies 10%)
        assert limits.per_position_stop_pct == 0.10
        # V1 NEW: Hard dollar limits
        assert limits.max_single_position_usd == 150.0  # Max $150 per position
        assert limits.max_total_cost_usd == 500.0       # Max $500 deployed
        
    def test_config_universe(self):
        """Test universe configuration"""
        config = AutopilotConfig()
        
        assert "AAPL" in config.universe
        assert "SPY" in config.universe
        # SLV removed - default universe: AAPL, SPY, GLD, GOOGL, NVDA
        assert len(config.universe) == 5


class TestUniverseManager:
    """Tests for UniverseManager"""
    
    def test_initialize_universe(self):
        """Test universe initialization"""
        allowed = ["AAPL", "MSFT", "GOOGL"]
        manager = UniverseManager(allowed_symbols=allowed)
        manager.initialize(["AAPL", "MSFT", "GOOGL", "UNKNOWN"])
        
        # Only allowed symbols should be in universe
        assert "AAPL" in manager.symbols
        assert "MSFT" in manager.symbols
        assert "GOOGL" in manager.symbols
        assert "UNKNOWN" not in manager.symbols
        
    def test_get_all_symbols(self):
        """Test getting all symbols"""
        allowed = ["AAPL", "MSFT"]
        manager = UniverseManager(allowed_symbols=allowed)
        manager.initialize(["AAPL", "MSFT"])
        
        symbols = manager.get_all_symbols()
        assert len(symbols) == 2


class TestActivityLogger:
    """Tests for ActivityLogger"""
    
    def test_log_entry(self):
        """Test logging an entry"""
        logger = ActivityLogger()
        
        logger.log(
            event_type="test_event",
            message="Test message",
            level="info",
        )
        
        entries = logger.get_entries(limit=10)
        assert len(entries) > 0
        assert entries[-1]["event_type"] == "test_event"
        
    def test_log_with_details(self):
        """Test logging with details"""
        logger = ActivityLogger()
        
        logger.log(
            event_type="trade",
            message="Trade executed",
            level="info",
            details={"price": 150.0, "quantity": 1},
        )
        
        entries = logger.get_entries(limit=10)
        assert entries[-1]["details"]["price"] == 150.0


# Note: TestAutopilotRunloop removed - runloop is retired
# Use UnifiedAutopilotEngine tests instead (see test_unified_engine.py)


class TestStrategyTemplates:
    """Tests for strategy template definitions"""
    
    def test_all_templates_defined(self):
        """Test all strategy templates are defined"""
        templates = list(StrategyTemplate)
        
        assert StrategyTemplate.PUT_CREDIT_SPREAD in templates
        assert StrategyTemplate.CALL_CREDIT_SPREAD in templates
        assert StrategyTemplate.IRON_CONDOR in templates
        assert StrategyTemplate.CALL_DEBIT_SPREAD in templates
        assert StrategyTemplate.PUT_DEBIT_SPREAD in templates


class TestStrategyConstraints:
    """Tests for strategy constraints"""
    
    def test_default_constraints(self):
        """Test default strategy constraints have valid values"""
        constraints = StrategyConstraints()
        
        # Verify constraints have reasonable defaults (not checking exact values)
        assert constraints.min_dte >= 1
        assert constraints.max_dte >= constraints.min_dte
        assert 0.0 < constraints.min_short_delta < 1.0
        assert 0.0 < constraints.max_short_delta < 1.0
        assert constraints.take_profit_pct == 0.5


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
