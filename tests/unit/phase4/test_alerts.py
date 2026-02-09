"""
Unit tests for Phase 4 - Alerts Engine.
"""

import pytest
import asyncio
from datetime import datetime, timedelta

import sys
from pathlib import Path
_project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(_project_root / "phase1"))

from services.alerts.engine import (
    AlertsEngine, Alert, AlertCondition,
    AlertConditionType, AlertStatus, DeliveryMethod
)


class TestAlertCondition:
    """Tests for AlertCondition."""
    
    def test_create_price_above(self):
        cond = AlertCondition(
            condition_type=AlertConditionType.PRICE_ABOVE,
            symbol="AAPL",
            value=150.0,
        )
        
        assert cond.condition_type == AlertConditionType.PRICE_ABOVE
        assert cond.symbol == "AAPL"
        assert cond.value == 150.0
    
    def test_to_dict(self):
        cond = AlertCondition(
            condition_type=AlertConditionType.RSI_ABOVE,
            symbol="TSLA",
            value=70.0,
        )
        
        d = cond.to_dict()
        assert d["condition_type"] == "rsi_above"
        assert d["value"] == 70.0


class TestAlertsEngine:
    """Tests for AlertsEngine class."""
    
    @pytest.fixture
    def engine(self):
        return AlertsEngine()
    
    def test_create_alert(self, engine):
        condition = AlertCondition(
            condition_type=AlertConditionType.PRICE_ABOVE,
            symbol="AAPL",
            value=200.0,
        )
        
        alert = engine.create_alert(
            name="AAPL Above 200",
            condition=condition,
            delivery_methods=[DeliveryMethod.WEBSOCKET],
        )
        
        assert alert.id is not None
        assert alert.name == "AAPL Above 200"
        assert alert.status == AlertStatus.ACTIVE
    
    def test_get_alert(self, engine):
        condition = AlertCondition(
            condition_type=AlertConditionType.PRICE_BELOW,
            symbol="MSFT",
            value=300.0,
        )
        
        created = engine.create_alert(
            name="MSFT Below 300",
            condition=condition,
            delivery_methods=[DeliveryMethod.WEBSOCKET],
        )
        
        retrieved = engine.get_alert(created.id)
        assert retrieved is not None
        assert retrieved.id == created.id
    
    def test_update_alert(self, engine):
        condition = AlertCondition(
            condition_type=AlertConditionType.PRICE_ABOVE,
            symbol="AAPL",
            value=200.0,
        )
        
        alert = engine.create_alert("Test Alert", condition, [DeliveryMethod.WEBSOCKET])
        
        updated = engine.update_alert(alert.id, name="Updated Name")
        
        assert updated.name == "Updated Name"
    
    def test_delete_alert(self, engine):
        condition = AlertCondition(
            condition_type=AlertConditionType.PRICE_ABOVE,
            symbol="AAPL",
            value=200.0,
        )
        
        alert = engine.create_alert("Delete Me", condition, [DeliveryMethod.WEBSOCKET])
        
        assert engine.delete_alert(alert.id)
        assert engine.get_alert(alert.id) is None
    
    def test_get_all_alerts(self, engine):
        for i in range(3):
            condition = AlertCondition(
                condition_type=AlertConditionType.PRICE_ABOVE,
                symbol="AAPL",
                value=200.0 + i,
            )
            engine.create_alert(f"Alert {i}", condition, [DeliveryMethod.WEBSOCKET])
        
        alerts = engine.get_all_alerts()
        assert len(alerts) == 3
    
    def test_check_condition_price_above(self, engine):
        condition = AlertCondition(
            condition_type=AlertConditionType.PRICE_ABOVE,
            symbol="AAPL",
            value=200.0,
        )
        alert = engine.create_alert("Test", condition, [DeliveryMethod.WEBSOCKET])
        
        assert engine.check_condition(alert, 201.0)
        assert not engine.check_condition(alert, 199.0)
    
    def test_check_condition_price_below(self, engine):
        condition = AlertCondition(
            condition_type=AlertConditionType.PRICE_BELOW,
            symbol="AAPL",
            value=200.0,
        )
        alert = engine.create_alert("Test", condition, [DeliveryMethod.WEBSOCKET])
        
        assert engine.check_condition(alert, 199.0)
        assert not engine.check_condition(alert, 201.0)
    
    def test_check_condition_price_cross_above(self, engine):
        condition = AlertCondition(
            condition_type=AlertConditionType.PRICE_CROSS_ABOVE,
            symbol="AAPL",
            value=200.0,
        )
        alert = engine.create_alert("Test", condition, [DeliveryMethod.WEBSOCKET])
        
        # First call sets prev_value
        assert not engine.check_condition(alert, 199.0)
        
        # Cross above 200
        assert engine.check_condition(alert, 201.0)
        
        # Already above, not a cross
        assert not engine.check_condition(alert, 202.0)
    
    def test_check_condition_rsi(self, engine):
        condition = AlertCondition(
            condition_type=AlertConditionType.RSI_ABOVE,
            symbol="AAPL",
            value=70.0,
        )
        alert = engine.create_alert("Test", condition, [DeliveryMethod.WEBSOCKET])
        
        # No RSI cached
        assert not engine.check_condition(alert, 200.0)
        
        # Add RSI
        engine.update_indicator("AAPL", "rsi", 75.0)
        assert engine.check_condition(alert, 200.0)
    
    def test_check_condition_volume(self, engine):
        condition = AlertCondition(
            condition_type=AlertConditionType.VOLUME_ABOVE,
            symbol="AAPL",
            value=1000000,
        )
        alert = engine.create_alert("Test", condition, [DeliveryMethod.WEBSOCKET])
        
        assert engine.check_condition(alert, 200.0, volume=1500000)
        assert not engine.check_condition(alert, 200.0, volume=500000)
    
    def test_cooldown_prevents_trigger(self, engine):
        condition = AlertCondition(
            condition_type=AlertConditionType.PRICE_ABOVE,
            symbol="AAPL",
            value=200.0,
        )
        alert = engine.create_alert(
            "Test",
            condition,
            [DeliveryMethod.WEBSOCKET],
            cooldown_seconds=60,
        )
        
        # Simulate recent trigger
        alert.last_triggered_at = datetime.utcnow()
        alert.trigger_count = 1
        
        assert not engine.can_trigger(alert)
    
    def test_max_triggers_limit(self, engine):
        condition = AlertCondition(
            condition_type=AlertConditionType.PRICE_ABOVE,
            symbol="AAPL",
            value=200.0,
        )
        alert = engine.create_alert(
            "Test",
            condition,
            [DeliveryMethod.WEBSOCKET],
            max_triggers=3,
        )
        
        alert.trigger_count = 3
        
        assert not engine.can_trigger(alert)
    
    def test_expired_alert(self, engine):
        condition = AlertCondition(
            condition_type=AlertConditionType.PRICE_ABOVE,
            symbol="AAPL",
            value=200.0,
        )
        alert = engine.create_alert(
            "Test",
            condition,
            [DeliveryMethod.WEBSOCKET],
            expires_at=datetime.utcnow() - timedelta(hours=1),
        )
        
        assert not engine.can_trigger(alert)
        assert alert.status == AlertStatus.EXPIRED
    
    def test_paused_alert_does_not_trigger(self, engine):
        condition = AlertCondition(
            condition_type=AlertConditionType.PRICE_ABOVE,
            symbol="AAPL",
            value=200.0,
        )
        alert = engine.create_alert("Test", condition, [DeliveryMethod.WEBSOCKET])
        alert.status = AlertStatus.PAUSED
        
        assert not engine.can_trigger(alert)
    
    @pytest.mark.asyncio
    async def test_process_price_update_triggers_alert(self, engine):
        condition = AlertCondition(
            condition_type=AlertConditionType.PRICE_ABOVE,
            symbol="AAPL",
            value=200.0,
        )
        engine.create_alert("Test", condition, [DeliveryMethod.WEBSOCKET])
        
        triggers = await engine.process_price_update("AAPL", 201.0)
        
        assert len(triggers) == 1
        assert triggers[0].current_value == 201.0
    
    def test_websocket_callback(self, engine):
        messages = []
        
        def callback(msg):
            messages.append(msg)
        
        engine.register_ws_callback(callback)
        
        condition = AlertCondition(
            condition_type=AlertConditionType.PRICE_ABOVE,
            symbol="AAPL",
            value=200.0,
        )
        alert = engine.create_alert("Test", condition, [DeliveryMethod.WEBSOCKET])
        
        # Just verify callback was registered
        assert len(engine._ws_callbacks) == 1
    
    @pytest.mark.asyncio
    async def test_trigger_history(self, engine):
        condition = AlertCondition(
            condition_type=AlertConditionType.PRICE_ABOVE,
            symbol="AAPL",
            value=200.0,
        )
        alert = engine.create_alert("Test", condition, [DeliveryMethod.WEBSOCKET])
        
        # Process to trigger
        await engine.process_price_update("AAPL", 201.0)
        
        history = engine.get_trigger_history(alert.id)
        assert len(history) >= 1
