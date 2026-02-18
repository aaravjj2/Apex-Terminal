"""
Alerts Engine - Rule-based alert system with delivery via WebSocket/webhook.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Callable, Any
from datetime import datetime, timedelta
from enum import Enum
import logging
import json
import uuid
import asyncio
import aiohttp


logger = logging.getLogger(__name__)


class AlertConditionType(str, Enum):
    PRICE_ABOVE = "price_above"
    PRICE_BELOW = "price_below"
    PRICE_CROSS_ABOVE = "price_cross_above"
    PRICE_CROSS_BELOW = "price_cross_below"
    RSI_ABOVE = "rsi_above"
    RSI_BELOW = "rsi_below"
    VOLUME_ABOVE = "volume_above"
    CUSTOM = "custom"


class AlertStatus(str, Enum):
    ACTIVE = "active"
    TRIGGERED = "triggered"
    PAUSED = "paused"
    EXPIRED = "expired"


class DeliveryMethod(str, Enum):
    WEBSOCKET = "websocket"
    WEBHOOK = "webhook"
    EMAIL = "email"


@dataclass
class AlertCondition:
    """Defines a condition for triggering an alert."""
    condition_type: AlertConditionType
    symbol: str
    value: float  # Threshold value
    custom_expression: Optional[str] = None  # For custom conditions
    
    def to_dict(self) -> dict:
        return {
            "condition_type": self.condition_type.value,
            "symbol": self.symbol,
            "value": self.value,
            "custom_expression": self.custom_expression,
        }


@dataclass
class Alert:
    """Represents an alert rule."""
    id: str
    name: str
    condition: AlertCondition
    delivery_methods: List[DeliveryMethod]
    
    # Configuration
    cooldown_seconds: int = 300  # 5 minutes default
    max_triggers: Optional[int] = None  # Max times to trigger (None = unlimited)
    expires_at: Optional[datetime] = None
    
    # State
    status: AlertStatus = AlertStatus.ACTIVE
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_triggered_at: Optional[datetime] = None
    trigger_count: int = 0
    
    # Delivery config
    webhook_url: Optional[str] = None
    email_to: Optional[str] = None
    
    # Previous values for cross detection
    _prev_value: Optional[float] = None
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "condition": self.condition.to_dict(),
            "delivery_methods": [m.value for m in self.delivery_methods],
            "cooldown_seconds": self.cooldown_seconds,
            "max_triggers": self.max_triggers,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "last_triggered_at": self.last_triggered_at.isoformat() if self.last_triggered_at else None,
            "trigger_count": self.trigger_count,
        }


@dataclass
class AlertTrigger:
    """Record of an alert trigger event."""
    id: str
    alert_id: str
    timestamp: datetime
    condition_value: float
    current_value: float
    message: str
    delivered: Dict[str, bool] = field(default_factory=dict)
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "alert_id": self.alert_id,
            "timestamp": self.timestamp.isoformat(),
            "condition_value": self.condition_value,
            "current_value": self.current_value,
            "message": self.message,
            "delivered": self.delivered,
        }


class AlertsEngine:
    """
    Rule-based alerts engine.
    
    Features:
    - Multiple condition types (price, RSI, volume, custom)
    - Multiple delivery methods (WebSocket, webhook, email)
    - Cooldown and throttling
    - Trigger history
    """
    
    def __init__(self):
        self.alerts: Dict[str, Alert] = {}
        self.triggers: List[AlertTrigger] = []
        self._ws_callbacks: List[Callable[[dict], None]] = []
        self._indicator_cache: Dict[str, Dict[str, float]] = {}  # symbol -> {rsi, etc.}
    
    def create_alert(
        self,
        name: str,
        condition: AlertCondition,
        delivery_methods: List[DeliveryMethod],
        cooldown_seconds: int = 300,
        max_triggers: Optional[int] = None,
        expires_at: Optional[datetime] = None,
        webhook_url: Optional[str] = None,
        email_to: Optional[str] = None,
    ) -> Alert:
        """Create a new alert rule."""
        alert = Alert(
            id=str(uuid.uuid4()),
            name=name,
            condition=condition,
            delivery_methods=delivery_methods,
            cooldown_seconds=cooldown_seconds,
            max_triggers=max_triggers,
            expires_at=expires_at,
            webhook_url=webhook_url,
            email_to=email_to,
        )
        
        self.alerts[alert.id] = alert
        logger.info(f"Alert created: {alert.id} - {name}")
        
        return alert
    
    def get_alert(self, alert_id: str) -> Optional[Alert]:
        """Get an alert by ID."""
        return self.alerts.get(alert_id)
    
    def update_alert(
        self,
        alert_id: str,
        name: Optional[str] = None,
        status: Optional[AlertStatus] = None,
        cooldown_seconds: Optional[int] = None,
    ) -> Optional[Alert]:
        """Update an existing alert."""
        alert = self.alerts.get(alert_id)
        if not alert:
            return None
        
        if name is not None:
            alert.name = name
        if status is not None:
            alert.status = status
        if cooldown_seconds is not None:
            alert.cooldown_seconds = cooldown_seconds
        
        return alert
    
    def delete_alert(self, alert_id: str) -> bool:
        """Delete an alert."""
        if alert_id in self.alerts:
            del self.alerts[alert_id]
            return True
        return False
    
    def get_all_alerts(self) -> List[Alert]:
        """Get all alerts."""
        return list(self.alerts.values())
    
    def get_trigger_history(self, alert_id: Optional[str] = None, limit: int = 100) -> List[AlertTrigger]:
        """Get trigger history, optionally filtered by alert ID."""
        triggers = self.triggers
        if alert_id:
            triggers = [t for t in triggers if t.alert_id == alert_id]
        return triggers[-limit:]
    
    def register_ws_callback(self, callback: Callable[[dict], None]) -> None:
        """Register a WebSocket callback for alert delivery."""
        self._ws_callbacks.append(callback)
    
    def update_indicator(self, symbol: str, indicator: str, value: float) -> None:
        """Update cached indicator value for a symbol."""
        if symbol not in self._indicator_cache:
            self._indicator_cache[symbol] = {}
        self._indicator_cache[symbol][indicator] = value
    
    def check_condition(self, alert: Alert, current_price: float, volume: float = 0) -> bool:
        """Check if an alert condition is met."""
        cond = alert.condition
        
        if cond.condition_type == AlertConditionType.PRICE_ABOVE:
            return current_price > cond.value
        
        elif cond.condition_type == AlertConditionType.PRICE_BELOW:
            return current_price < cond.value
        
        elif cond.condition_type == AlertConditionType.PRICE_CROSS_ABOVE:
            if alert._prev_value is not None:
                crossed = alert._prev_value <= cond.value < current_price
                alert._prev_value = current_price
                return crossed
            alert._prev_value = current_price
            return False
        
        elif cond.condition_type == AlertConditionType.PRICE_CROSS_BELOW:
            if alert._prev_value is not None:
                crossed = alert._prev_value >= cond.value > current_price
                alert._prev_value = current_price
                return crossed
            alert._prev_value = current_price
            return False
        
        elif cond.condition_type == AlertConditionType.RSI_ABOVE:
            rsi = self._indicator_cache.get(cond.symbol, {}).get("rsi")
            return rsi is not None and rsi > cond.value
        
        elif cond.condition_type == AlertConditionType.RSI_BELOW:
            rsi = self._indicator_cache.get(cond.symbol, {}).get("rsi")
            return rsi is not None and rsi < cond.value
        
        elif cond.condition_type == AlertConditionType.VOLUME_ABOVE:
            return volume > cond.value
        
        elif cond.condition_type == AlertConditionType.CUSTOM:
            # Safe evaluation of custom expression
            if cond.custom_expression:
                try:
                    # Limited eval with only safe variables
                    safe_vars = {
                        "price": current_price,
                        "volume": volume,
                        "threshold": cond.value,
                    }
                    # Add cached indicators
                    indicators = self._indicator_cache.get(cond.symbol, {})
                    safe_vars.update(indicators)
                    
                    return bool(eval(cond.custom_expression, {"__builtins__": {}}, safe_vars))
                except Exception as e:
                    logger.warning(f"Custom expression eval failed: {e}")
                    return False
        
        return False
    
    def can_trigger(self, alert: Alert) -> bool:
        """Check if an alert can trigger based on cooldown and limits."""
        if alert.status != AlertStatus.ACTIVE:
            return False
        
        # Check expiration
        if alert.expires_at and datetime.utcnow() > alert.expires_at:
            alert.status = AlertStatus.EXPIRED
            return False
        
        # Check max triggers
        if alert.max_triggers and alert.trigger_count >= alert.max_triggers:
            return False
        
        # Check cooldown
        if alert.last_triggered_at:
            cooldown_end = alert.last_triggered_at + timedelta(seconds=alert.cooldown_seconds)
            if datetime.utcnow() < cooldown_end:
                return False
        
        return True
    
    async def process_price_update(
        self,
        symbol: str,
        price: float,
        volume: float = 0,
    ) -> List[AlertTrigger]:
        """Process a price update and check all relevant alerts."""
        triggered = []
        
        for alert in self.alerts.values():
            if alert.condition.symbol != symbol:
                continue
            
            if not self.can_trigger(alert):
                continue
            
            if self.check_condition(alert, price, volume):
                trigger = await self._trigger_alert(alert, price)
                triggered.append(trigger)
        
        return triggered
    
    async def _trigger_alert(self, alert: Alert, current_value: float) -> AlertTrigger:
        """Trigger an alert and deliver notifications."""
        trigger = AlertTrigger(
            id=str(uuid.uuid4()),
            alert_id=alert.id,
            timestamp=datetime.utcnow(),
            condition_value=alert.condition.value,
            current_value=current_value,
            message=f"Alert '{alert.name}' triggered: {alert.condition.condition_type.value} at {current_value}",
        )
        
        # Update alert state
        alert.last_triggered_at = trigger.timestamp
        alert.trigger_count += 1
        
        # Store trigger
        self.triggers.append(trigger)
        
        logger.info(f"Alert triggered: {alert.id} - {alert.name}")
        
        # Deliver via configured methods
        for method in alert.delivery_methods:
            if method == DeliveryMethod.WEBSOCKET:
                trigger.delivered["websocket"] = self._deliver_websocket(trigger)
            elif method == DeliveryMethod.WEBHOOK:
                trigger.delivered["webhook"] = await self._deliver_webhook(alert, trigger)
            elif method == DeliveryMethod.EMAIL:
                trigger.delivered["email"] = self._deliver_email(alert, trigger)
        
        return trigger
    
    def _deliver_websocket(self, trigger: AlertTrigger) -> bool:
        """Deliver alert via WebSocket."""
        payload = {
            "type": "ALERT_TRIGGERED",
            "data": trigger.to_dict(),
        }
        
        for callback in self._ws_callbacks:
            try:
                callback(payload)
            except Exception as e:
                logger.error(f"WebSocket delivery failed: {e}")
                return False
        
        return True
    
    async def _deliver_webhook(self, alert: Alert, trigger: AlertTrigger) -> bool:
        """Deliver alert via webhook."""
        if not alert.webhook_url:
            return False
        
        payload = {
            "alert": alert.to_dict(),
            "trigger": trigger.to_dict(),
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    alert.webhook_url,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as response:
                    return response.status == 200
        except Exception as e:
            logger.error(f"Webhook delivery failed: {e}")
            return False
    
    def _deliver_email(self, alert: Alert, trigger: AlertTrigger) -> bool:
        """Deliver alert via email (placeholder)."""
        if not alert.email_to:
            return False
        
        # Email delivery would use SMTP
        logger.info(f"Email alert would be sent to {alert.email_to}: {trigger.message}")
        return True  # Placeholder
    
    def to_dict(self) -> dict:
        """Serialize engine state."""
        return {
            "alerts": [a.to_dict() for a in self.alerts.values()],
            "trigger_count": len(self.triggers),
        }
