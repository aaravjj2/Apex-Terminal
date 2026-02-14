"""
Autopilot Kill Switch Tests

Tests the kill switch functionality to prevent regression.
Root cause: Kill switch stuck active blocked all trades (0 orders placed).
"""

import pytest
from phase1.services.autopilot.unified_engine import UnifiedAutopilotEngine, get_unified_engine


class TestKillSwitch:
    """Test kill switch functionality."""
    
    def test_kill_switch_defaults_to_inactive(self):
        """Ensure kill switch defaults to inactive (allows trades)."""
        engine = UnifiedAutopilotEngine()
        assert engine.kill_switch_active is False, "Kill switch should default to inactive"
    
    def test_activate_kill_switch(self):
        """Test activating the kill switch."""
        engine = UnifiedAutopilotEngine()
        assert engine.kill_switch_active is False
        
        # Activate
        engine._kill_switch = True
        assert engine.kill_switch_active is True
    
    def test_deactivate_kill_switch(self):
        """Test deactivating the kill switch."""
        engine = UnifiedAutopilotEngine()
        engine._kill_switch = True
        assert engine.kill_switch_active is True
        
        # Deactivate
        engine.deactivate_kill_switch()
        assert engine.kill_switch_active is False
    
    @pytest.mark.asyncio
    async def test_run_cycle_blocked_by_kill_switch(self):
        """Test that kill switch blocks trade execution."""
        engine = UnifiedAutopilotEngine()
        engine._kill_switch = True
        
        # Run cycle (should be blocked)
        artifact = await engine.run_cycle(dry_run=False, force=False)
        
        # Verify blocked
        assert artifact.success is False or any("Kill switch" in r for r in artifact.no_action_reasons)
        assert artifact.orders_filled == 0
        assert artifact.candidates_generated == 0  # Early abort before candidate generation
    
    @pytest.mark.asyncio
    async def test_run_cycle_allowed_when_inactive(self):
        """Test that trades can proceed when kill switch is inactive."""
        engine = UnifiedAutopilotEngine()
        assert engine.kill_switch_active is False
        
        # Run cycle (should NOT be blocked by kill switch)
        artifact = await engine.run_cycle(dry_run=True, force=False)  # dry_run=True to avoid real orders
        
        # Verify not blocked by kill switch
        assert not any("Kill switch" in r for r in artifact.no_action_reasons)
        # Note: artifact.success may still be False due to other reasons (no candidates, validation, etc.)
        # but it should not be blocked by kill switch


class TestKillSwitchAPI:
    """Test kill switch API endpoints via httpx."""
    
    def test_kill_switch_toggle_activate(self):
        """Test POST /autopilot/kill-switch to activate."""
        import httpx
        BASE = "http://127.0.0.1:8000"
        response = httpx.post(f"{BASE}/api/v1/autopilot/kill-switch", json={"active": True, "close_all": False}, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "kill_switch_active" in data
        assert data["kill_switch_active"] is True
    
    def test_kill_switch_toggle_deactivate(self):
        """Test POST /autopilot/kill-switch to deactivate."""
        import httpx
        BASE = "http://127.0.0.1:8000"
        response = httpx.post(f"{BASE}/api/v1/autopilot/kill-switch", json={"active": False, "close_all": False}, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "kill_switch_active" in data
        assert data["kill_switch_active"] is False
    
    def test_kill_switch_status_endpoint(self):
        """Test GET /autopilot/kill-switch to read status."""
        import httpx
        BASE = "http://127.0.0.1:8000"
        # Ensure deactivated first
        httpx.post(f"{BASE}/api/v1/autopilot/kill-switch", json={"active": False, "close_all": False}, timeout=10)
        response = httpx.get(f"{BASE}/api/v1/autopilot/kill-switch", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "active" in data
        assert isinstance(data["active"], bool)


class TestValidationRejectionReasons:
    """Test that validation rejection reasons are properly captured."""
    
    def test_kill_switch_rejection_reason_captured(self):
        """Verify kill switch rejection generates proper reason code."""
        from phase1.services.autopilot.validator import TradeValidator, RejectionCode
        from phase1.services.autopilot.config import get_autopilot_config
        from phase1.services.autopilot.universe import UniverseManager
        from phase1.services.autopilot.candidates import TradeCandidate, StrategyTemplate, OptionLeg
        from datetime import date, timedelta
        
        config = get_autopilot_config()
        universe = UniverseManager(config.universe)
        validator = TradeValidator(config, universe)
        
        # Activate kill switch
        validator.activate_kill_switch()
        
        # Create a dummy candidate
        candidate = TradeCandidate(
            id="test-001",
            symbol="SPY",
            template=StrategyTemplate.LONG_CALL,
            legs=[OptionLeg(
                side="buy",
                option_type="call",
                strike=450.0,
                quantity=1,
                expiry=date.today() + timedelta(days=7)
            )],
            underlying_price=450.0,
            max_profit=100.0,
            max_loss=100.0,
            pop=0.65,
            dte=7,
            iv_rank=50,
            liquidity_score=0.9,
            spread_percent=0.02,
            regime="neutral",
            trend="neutral"
        )
        
        # Validate (should be rejected)
        result = validator.validate_candidate(candidate, portfolio_state={})
        
        # Verify rejection
        assert result.is_valid is False
        assert RejectionCode.KILL_SWITCH_ACTIVE in result.rejection_codes
        assert len(result.rejection_details) > 0
        assert "kill switch" in result.rejection_details[0].lower()
