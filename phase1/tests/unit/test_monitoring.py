"""
Unit tests for Autopilot Monitoring Service

Tests:
- Position loading
- Exit rule evaluation
- Exit signal generation
- Monitoring pass
"""

import pytest
from datetime import datetime, timedelta, date
from unittest.mock import AsyncMock, MagicMock, patch

# Import the monitoring module
from services.autopilot.monitoring import (
    ExitReason,
    ExitSignal,
    MonitoringEvent,
    MonitoringReport,
    UnifiedAlpacaPosition,
    PositionMonitor,
)


class TestExitReason:
    """Test ExitReason enum."""
    
    def test_exit_reason_values(self):
        """Verify all exit reasons are defined."""
        assert ExitReason.PROFIT_TARGET.value == "profit_target"
        assert ExitReason.STOP_LOSS.value == "stop_loss"
        assert ExitReason.TIME_STOP.value == "time_stop"
        assert ExitReason.MANUAL.value == "manual"
        assert ExitReason.RISK_LIMIT.value == "risk_limit"


class TestExitSignal:
    """Test ExitSignal dataclass."""
    
    def test_exit_signal_creation(self):
        """Create exit signal with required fields."""
        signal = ExitSignal(
            position_id="pos1",
            symbol="AAPL",
            reason=ExitReason.PROFIT_TARGET,
            urgency="immediate",
            target_quantity=100.0,
            limit_price=195.00,
            rationale="Profit target reached",
        )
        
        assert signal.position_id == "pos1"
        assert signal.symbol == "AAPL"
        assert signal.reason == ExitReason.PROFIT_TARGET
        assert signal.urgency == "immediate"
    
    def test_exit_signal_to_dict(self):
        """Verify serialization."""
        signal = ExitSignal(
            position_id="pos1",
            symbol="AAPL",
            reason=ExitReason.STOP_LOSS,
            urgency="eod",
            target_quantity=50.0,
            rationale="Stop loss triggered",
        )
        
        data = signal.to_dict()
        assert data["position_id"] == "pos1"
        assert data["reason"] == "stop_loss"
        assert data["urgency"] == "eod"


class TestUnifiedAlpacaPosition:
    """Test UnifiedAlpacaPosition dataclass."""
    
    def test_position_creation(self):
        """Create a unified position."""
        pos = UnifiedAlpacaPosition(
            asset_id="abc123",
            symbol="AAPL",
            underlying="AAPL",
            position_type="equity",
            quantity=100,
            avg_entry_price=185.50,
            current_price=190.00,
            market_value=19000.00,
            unrealized_pnl=450.00,
            unrealized_pnl_pct=2.43,
        )
        
        assert pos.symbol == "AAPL"
        assert pos.quantity == 100
        assert pos.unrealized_pnl == 450.00
    
    def test_option_position_creation(self):
        """Test option position with DTE and expiration."""
        pos = UnifiedAlpacaPosition(
            asset_id="opt1",
            symbol="AAPL250117C190",
            underlying="AAPL",
            position_type="option",
            quantity=5,
            avg_entry_price=8.50,
            current_price=10.00,
            market_value=5000.00,
            unrealized_pnl=750.00,
            unrealized_pnl_pct=17.6,
            dte=10,
            expiration=date(2025, 1, 17),
            strike=190.0,
            option_type="call",
            strategy_template="call_debit_spread",
        )
        
        assert pos.position_type == "option"
        assert pos.dte == 10
        assert pos.strike == 190.0
        assert pos.strategy_template == "call_debit_spread"


class TestPositionMonitor:
    """Test PositionMonitor class."""
    
    def test_monitor_initialization(self):
        """Initialize position monitor."""
        monitor = PositionMonitor()
        assert monitor is not None
    
    def test_exit_rules_defined(self):
        """Verify exit rules are properly configured."""
        assert "put_credit_spread" in PositionMonitor.EXIT_RULES
        assert "call_credit_spread" in PositionMonitor.EXIT_RULES
        assert "iron_condor" in PositionMonitor.EXIT_RULES
        
        pcs_rules = PositionMonitor.EXIT_RULES.get("put_credit_spread", {})
        assert pcs_rules.get("profit_target_pct") == 0.50
        assert pcs_rules.get("stop_loss_multiplier") == 2.0
        assert pcs_rules.get("time_stop_dte") == 7


class TestMonitoringEvent:
    """Test MonitoringEvent dataclass."""
    
    def test_event_creation(self):
        """Create monitoring event."""
        event = MonitoringEvent(
            event_id="evt1",
            event_type="position_check",
            position_id="pos1",
            symbol="AAPL",
            timestamp=datetime.utcnow(),
            details={"pnl": 100.0},
        )
        
        assert event.event_type == "position_check"
        assert event.symbol == "AAPL"
    
    def test_event_to_dict(self):
        """Test event serialization."""
        now = datetime.utcnow()
        event = MonitoringEvent(
            event_id="evt2",
            event_type="exit_triggered",
            position_id="pos2",
            symbol="TSLA",
            timestamp=now,
        )
        
        data = event.to_dict()
        assert data["event_type"] == "exit_triggered"
        assert data["symbol"] == "TSLA"


class TestMonitoringReport:
    """Test MonitoringReport dataclass."""
    
    def test_report_creation(self):
        """Create monitoring report."""
        report = MonitoringReport(
            report_id="rpt1",
            timestamp=datetime.utcnow(),
            positions_checked=5,
            exits_triggered=1,
        )
        
        assert report.positions_checked == 5
        assert report.exits_triggered == 1
    
    def test_report_to_dict(self):
        """Verify report serialization."""
        now = datetime.utcnow()
        report = MonitoringReport(
            report_id="rpt2",
            timestamp=now,
            positions_checked=3,
            exits_triggered=0,
            orders_placed=2,
            orders_filled=2,
        )
        
        data = report.to_dict()
        assert data["positions_checked"] == 3
        assert data["exits_triggered"] == 0
        assert data["orders_placed"] == 2
        assert "report_id" in data
