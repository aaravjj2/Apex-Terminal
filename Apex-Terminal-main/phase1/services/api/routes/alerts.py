"""
Alerts API - REST endpoints for alert management.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from ...alerts import (
    AlertsEngine, Alert, AlertCondition,
    AlertConditionType, AlertStatus, DeliveryMethod
)


router = APIRouter(tags=["Alerts"])

# Shared alerts engine
_alerts_engine = AlertsEngine()


class CreateAlertRequest(BaseModel):
    name: str
    condition_type: str
    symbol: str
    value: float
    delivery_methods: List[str] = ["websocket"]
    cooldown_seconds: int = 300
    max_triggers: Optional[int] = None
    webhook_url: Optional[str] = None
    email_to: Optional[str] = None


class AlertResponse(BaseModel):
    id: str
    name: str
    condition_type: str
    symbol: str
    value: float
    status: str
    delivery_methods: List[str]
    cooldown_seconds: int
    trigger_count: int
    created_at: str
    last_triggered_at: Optional[str] = None


class TriggerResponse(BaseModel):
    id: str
    alert_id: str
    timestamp: str
    condition_value: float
    current_value: float
    message: str


@router.post("", response_model=AlertResponse)
async def create_alert(request: CreateAlertRequest):
    """Create a new alert."""
    try:
        condition_type = AlertConditionType(request.condition_type)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid condition type: {request.condition_type}"
        )
    
    delivery_methods = []
    for dm in request.delivery_methods:
        try:
            delivery_methods.append(DeliveryMethod(dm))
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid delivery method: {dm}"
            )
    
    condition = AlertCondition(
        condition_type=condition_type,
        symbol=request.symbol,
        value=request.value,
    )
    
    alert = _alerts_engine.create_alert(
        name=request.name,
        condition=condition,
        delivery_methods=delivery_methods,
        cooldown_seconds=request.cooldown_seconds,
        max_triggers=request.max_triggers,
        webhook_url=request.webhook_url,
        email_to=request.email_to,
    )
    
    return _convert_alert(alert)


@router.get("", response_model=List[AlertResponse])
async def list_alerts():
    """List all alerts."""
    return [_convert_alert(a) for a in _alerts_engine.get_all_alerts()]


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(alert_id: str):
    """Get a specific alert."""
    alert = _alerts_engine.get_alert(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return _convert_alert(alert)


@router.put("/{alert_id}")
async def update_alert(alert_id: str, name: Optional[str] = None, status: Optional[str] = None):
    """Update an alert."""
    new_status = AlertStatus(status) if status else None
    
    alert = _alerts_engine.update_alert(
        alert_id=alert_id,
        name=name,
        status=new_status,
    )
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return _convert_alert(alert)


@router.delete("/{alert_id}")
async def delete_alert(alert_id: str):
    """Delete an alert."""
    if not _alerts_engine.delete_alert(alert_id):
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"status": "deleted", "alert_id": alert_id}


@router.get("/{alert_id}/triggers", response_model=List[TriggerResponse])
async def get_alert_triggers(alert_id: str, limit: int = 100):
    """Get trigger history for an alert."""
    triggers = _alerts_engine.get_trigger_history(alert_id=alert_id, limit=limit)
    return [
        TriggerResponse(
            id=t.id,
            alert_id=t.alert_id,
            timestamp=t.timestamp.isoformat(),
            condition_value=t.condition_value,
            current_value=t.current_value,
            message=t.message,
        )
        for t in triggers
    ]


@router.post("/{alert_id}/test")
async def test_alert(alert_id: str, price: float):
    """Test an alert by simulating a price update."""
    alert = _alerts_engine.get_alert(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    import asyncio
    triggers = asyncio.get_event_loop().run_until_complete(
        _alerts_engine.process_price_update(alert.condition.symbol, price)
    )
    
    return {
        "tested": True,
        "alert_id": alert_id,
        "price": price,
        "triggered": len(triggers) > 0,
        "triggers": [t.to_dict() for t in triggers],
    }


def _convert_alert(alert: Alert) -> AlertResponse:
    """Convert Alert to response model."""
    return AlertResponse(
        id=alert.id,
        name=alert.name,
        condition_type=alert.condition.condition_type.value,
        symbol=alert.condition.symbol,
        value=alert.condition.value,
        status=alert.status.value,
        delivery_methods=[m.value for m in alert.delivery_methods],
        cooldown_seconds=alert.cooldown_seconds,
        trigger_count=alert.trigger_count,
        created_at=alert.created_at.isoformat(),
        last_triggered_at=alert.last_triggered_at.isoformat() if alert.last_triggered_at else None,
    )


def get_alerts_engine() -> AlertsEngine:
    """Get the shared alerts engine instance."""
    return _alerts_engine
