"""
Unit tests for Phase 4 - Risk Manager.
"""

import pytest
from datetime import datetime

import sys
from pathlib import Path
_project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(_project_root / "phase1"))

from services.portfolio.manager import PortfolioManager
from services.portfolio.risk_manager import RiskManager, RiskLimits, RiskCheckResult


class TestRiskLimits:
    """Tests for RiskLimits configuration."""
    
    def test_default_limits(self):
        limits = RiskLimits()
        
        assert limits.max_position_size == 10000.0
        assert limits.max_position_pct == 20.0
        assert limits.max_total_exposure == 100000.0
        assert limits.max_daily_loss == 5000.0
    
    def test_custom_limits(self):
        limits = RiskLimits(
            max_position_size=5000.0,
            max_shares_per_order=500,
        )
        
        assert limits.max_position_size == 5000.0
        assert limits.max_shares_per_order == 500


class TestRiskManager:
    """Tests for RiskManager class."""
    
    @pytest.fixture
    def portfolio(self):
        return PortfolioManager(initial_cash=100000.0)
    
    @pytest.fixture
    def risk_manager(self, portfolio):
        limits = RiskLimits(
            max_position_size=20000.0,
            max_shares_per_order=500,
            max_order_value=25000.0,
            max_total_exposure=80000.0,
        )
        return RiskManager(portfolio, limits)
    
    def test_order_passes_all_checks(self, risk_manager):
        result = risk_manager.check_order(
            symbol="AAPL",
            side="buy",
            quantity=100,
            price=150.0,
        )
        
        assert result.passed
        assert result.result == RiskCheckResult.PASSED
    
    def test_order_exceeds_max_shares(self, risk_manager):
        result = risk_manager.check_order(
            symbol="AAPL",
            side="buy",
            quantity=600,  # Over 500 limit
            price=150.0,
        )
        
        assert not result.passed
        assert "max_shares" in result.checks
        assert not result.checks["max_shares"][0]
    
    def test_order_exceeds_max_value(self, risk_manager):
        result = risk_manager.check_order(
            symbol="AAPL",
            side="buy",
            quantity=200,
            price=150.0,  # 30000 > 25000 limit
        )
        
        assert not result.passed
        assert "max_order_value" in result.checks
    
    def test_order_exceeds_position_size(self, risk_manager, portfolio):
        # Create existing position
        portfolio.execute_fill("AAPL", "buy", 100, 150.0, datetime.now())
        
        result = risk_manager.check_order(
            symbol="AAPL",
            side="buy",
            quantity=50,
            price=150.0,  # Would make position 22500 > 20000
        )
        
        assert not result.passed
        assert "max_position_size" in result.checks
    
    def test_blocked_symbol(self, portfolio):
        limits = RiskLimits(blocked_symbols=["TSLA"])
        rm = RiskManager(portfolio, limits)
        
        result = rm.check_order(
            symbol="TSLA",
            side="buy",
            quantity=10,
            price=200.0,
        )
        
        assert not result.passed
        assert "symbol_blocked" in result.checks
    
    def test_allowed_symbols_only(self, portfolio):
        limits = RiskLimits(allowed_symbols=["AAPL", "MSFT"])
        rm = RiskManager(portfolio, limits)
        
        # AAPL allowed
        result = rm.check_order("AAPL", "buy", 10, 150.0)
        assert result.passed
        
        # TSLA not allowed
        result = rm.check_order("TSLA", "buy", 10, 200.0)
        assert not result.passed
    
    def test_insufficient_cash(self, risk_manager, portfolio):
        # Use most of the cash
        portfolio.execute_fill("AAPL", "buy", 500, 150.0, datetime.now())
        
        result = risk_manager.check_order(
            symbol="MSFT",
            side="buy",
            quantity=200,
            price=300.0,  # 60000 but only ~25000 cash left
        )
        
        assert not result.passed
        assert "cash_available" in result.checks
    
    def test_trading_halted(self, risk_manager):
        risk_manager.halt_trading("Test halt")
        
        result = risk_manager.check_order("AAPL", "buy", 10, 150.0)
        
        assert not result.passed
        assert "trading_halt" in result.checks
    
    def test_resume_trading(self, risk_manager):
        risk_manager.halt_trading("Test halt")
        risk_manager.resume_trading()
        
        result = risk_manager.check_order("AAPL", "buy", 10, 150.0)
        
        assert result.passed
    
    def test_daily_pnl_tracking(self, risk_manager):
        risk_manager.update_daily_pnl(-1000)
        risk_manager.update_daily_pnl(-2000)
        
        assert risk_manager.daily_realized_pnl == -3000
    
    def test_daily_loss_limit_halts_trading(self, portfolio):
        limits = RiskLimits(max_daily_loss=2000.0)
        rm = RiskManager(portfolio, limits)
        
        rm.update_daily_pnl(-2500)  # Exceeds limit
        
        assert rm.trading_halted
        assert "Daily loss" in rm.halt_reason
    
    def test_reset_daily_limits(self, portfolio):
        limits = RiskLimits(max_daily_loss=2000.0)
        rm = RiskManager(portfolio, limits)
        
        rm.update_daily_pnl(-2500)
        assert rm.trading_halted
        
        rm.reset_daily_limits()
        
        assert rm.daily_realized_pnl == 0
        assert not rm.trading_halted
    
    def test_get_status(self, risk_manager, portfolio):
        status = risk_manager.get_status()
        
        assert "trading_halted" in status
        assert "daily_realized_pnl" in status
        assert "limits" in status
        assert status["trading_halted"] == False
