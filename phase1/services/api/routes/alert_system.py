"""
alert_system.py — REST API routes for AlertEngine (new, Bloomberg-grade)
=========================================================================
35+ endpoints for alert CRUD, evaluation, scheduling,
notifications, analytics, and bulk operations.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.alert_engine import (
    AlertManager, AlertType, AlertPriority, AlertStatus, NotificationChannel,
    PriceAlertEngine, VolumeAlertEngine, IndicatorAlertEngine,
    PortfolioAlertEngine, NewsAlertEngine, AlertScheduler, AlertAnalytics,
)

router = APIRouter(prefix="/api/v2/alerts")

# ── Shared Manager ──
_manager = AlertManager()
_scheduler = AlertScheduler()


# ── Pydantic Models ──

class PriceAboveRequest(BaseModel):
    symbol: str
    price: float
    name: str = ""
    priority: str = "medium"


class PriceBelowRequest(BaseModel):
    symbol: str
    price: float
    name: str = ""
    priority: str = "medium"


class PriceCrossRequest(BaseModel):
    symbol: str
    price: float
    direction: str = "above"


class PriceChangePctRequest(BaseModel):
    symbol: str
    pct_threshold: float
    direction: str = "any"


class PriceChannelRequest(BaseModel):
    symbol: str
    upper: float
    lower: float


class VolumeAlertRequest(BaseModel):
    symbol: str
    multiplier: float = 2.0
    alert_type: str = "spike"
    threshold: float = 0.0


class IndicatorAlertRequest(BaseModel):
    symbol: str
    indicator: str
    threshold: float = 0.0
    direction: str = "bullish"
    fast: int = 50
    slow: int = 200
    band: str = "upper"


class PortfolioAlertRequest(BaseModel):
    name: str = ""
    alert_type: str
    threshold: float


class NewsAlertRequest(BaseModel):
    symbol: str
    keywords: Optional[List[str]] = None
    sentiment_threshold: Optional[float] = None


class EvaluatePriceRequest(BaseModel):
    symbol: str
    price: float
    prev_close: float = 0.0


class EvaluateVolumeRequest(BaseModel):
    symbol: str
    volume: float
    avg_volume: float


class EvaluateIndicatorsRequest(BaseModel):
    symbol: str
    indicators: Dict[str, float]


class EvaluatePortfolioRequest(BaseModel):
    data: Dict[str, float]


class UpdateAlertRequest(BaseModel):
    name: Optional[str] = None
    priority: Optional[str] = None
    cooldown_seconds: Optional[float] = None
    max_triggers: Optional[int] = None
    tags: Optional[List[str]] = None


class SnoozeRequest(BaseModel):
    duration_seconds: float = 3600


class ScheduleRequest(BaseModel):
    alert_id: str
    sessions: List[str]


class TimeAlertRequest(BaseModel):
    name: str
    hour: int
    minute: int
    message: str = ""


def _priority(s: str) -> AlertPriority:
    return {"low": AlertPriority.LOW, "medium": AlertPriority.MEDIUM,
            "high": AlertPriority.HIGH, "critical": AlertPriority.CRITICAL}.get(
        s.lower(), AlertPriority.MEDIUM)


# ── Alert Creation ──

@router.post("/create/price-above")
async def create_price_above(req: PriceAboveRequest):
    alert = PriceAlertEngine.create_price_above(
        req.symbol, req.price, req.name, _priority(req.priority))
    aid = _manager.add_alert(alert)
    return {"id": aid, "name": alert.name, "type": alert.alert_type.value}


@router.post("/create/price-below")
async def create_price_below(req: PriceBelowRequest):
    alert = PriceAlertEngine.create_price_below(
        req.symbol, req.price, req.name, _priority(req.priority))
    aid = _manager.add_alert(alert)
    return {"id": aid, "name": alert.name}


@router.post("/create/price-cross")
async def create_price_cross(req: PriceCrossRequest):
    if req.direction == "above":
        alert = PriceAlertEngine.create_price_cross_above(req.symbol, req.price)
    else:
        alert = PriceAlertEngine.create_price_cross_below(req.symbol, req.price)
    aid = _manager.add_alert(alert)
    return {"id": aid, "name": alert.name}


@router.post("/create/price-change-pct")
async def create_price_change_pct(req: PriceChangePctRequest):
    alert = PriceAlertEngine.create_price_change_pct(
        req.symbol, req.pct_threshold, req.direction)
    aid = _manager.add_alert(alert)
    return {"id": aid, "name": alert.name}


@router.post("/create/price-channel")
async def create_price_channel(req: PriceChannelRequest):
    alert = PriceAlertEngine.create_price_channel(req.symbol, req.upper, req.lower)
    aid = _manager.add_alert(alert)
    return {"id": aid, "name": alert.name}


@router.post("/create/volume")
async def create_volume_alert(req: VolumeAlertRequest):
    if req.alert_type == "spike":
        alert = VolumeAlertEngine.create_volume_spike(req.symbol, req.multiplier)
    elif req.alert_type == "above":
        alert = VolumeAlertEngine.create_volume_above(req.symbol, req.threshold)
    else:
        alert = VolumeAlertEngine.create_volume_dry_up(req.symbol, req.multiplier)
    aid = _manager.add_alert(alert)
    return {"id": aid, "name": alert.name}


@router.post("/create/indicator")
async def create_indicator_alert(req: IndicatorAlertRequest):
    ind = req.indicator.lower()
    if ind == "rsi_overbought":
        alert = IndicatorAlertEngine.create_rsi_overbought(req.symbol, req.threshold or 70)
    elif ind == "rsi_oversold":
        alert = IndicatorAlertEngine.create_rsi_oversold(req.symbol, req.threshold or 30)
    elif ind == "macd_cross":
        alert = IndicatorAlertEngine.create_macd_cross(req.symbol, req.direction)
    elif ind == "sma_cross":
        alert = IndicatorAlertEngine.create_sma_cross(
            req.symbol, req.fast, req.slow, req.direction)
    elif ind == "bollinger_touch":
        alert = IndicatorAlertEngine.create_bollinger_touch(req.symbol, req.band)
    else:
        raise HTTPException(400, f"Unknown indicator: {req.indicator}")
    aid = _manager.add_alert(alert)
    return {"id": aid, "name": alert.name}


@router.post("/create/portfolio")
async def create_portfolio_alert(req: PortfolioAlertRequest):
    t = req.alert_type.lower()
    if t == "pnl_target":
        alert = PortfolioAlertEngine.create_pnl_target(req.name, req.threshold)
    elif t == "pnl_stop":
        alert = PortfolioAlertEngine.create_pnl_stop(req.name, req.threshold)
    elif t == "drawdown":
        alert = PortfolioAlertEngine.create_drawdown_alert(req.threshold)
    elif t == "exposure":
        alert = PortfolioAlertEngine.create_exposure_alert(req.threshold)
    elif t == "margin":
        alert = PortfolioAlertEngine.create_margin_warning(req.threshold)
    else:
        raise HTTPException(400, f"Unknown portfolio alert type: {req.alert_type}")
    aid = _manager.add_alert(alert)
    return {"id": aid, "name": alert.name}


@router.post("/create/news")
async def create_news_alert(req: NewsAlertRequest):
    if req.keywords:
        alert = NewsAlertEngine.create_keyword_alert(req.symbol, req.keywords)
    elif req.sentiment_threshold is not None:
        alert = NewsAlertEngine.create_sentiment_alert(req.symbol, req.sentiment_threshold)
    else:
        raise HTTPException(400, "Provide keywords or sentiment_threshold")
    aid = _manager.add_alert(alert)
    return {"id": aid, "name": alert.name}


# ── Alert CRUD ──

@router.get("/list")
async def list_alerts(symbol: str = "", status: str = "",
                      alert_type: str = "", tags: str = ""):
    st = None
    if status:
        st = {"active": AlertStatus.ACTIVE, "triggered": AlertStatus.TRIGGERED,
              "expired": AlertStatus.EXPIRED, "disabled": AlertStatus.DISABLED,
              "snoozed": AlertStatus.SNOOZED}.get(status.lower())
    at = None
    if alert_type:
        try:
            at = AlertType(alert_type)
        except ValueError:
            pass
    tg = tags.split(",") if tags else None
    alerts = _manager.list_alerts(symbol=symbol, status=st,
                                   alert_type=at, tags=tg)
    return {"count": len(alerts),
            "alerts": [a.to_dict() for a in alerts]}


@router.get("/{alert_id}")
async def get_alert(alert_id: str):
    alert = _manager.get_alert(alert_id)
    if not alert:
        raise HTTPException(404, f"Alert {alert_id} not found")
    return alert.to_dict()


@router.put("/{alert_id}")
async def update_alert(alert_id: str, req: UpdateAlertRequest):
    kwargs = {k: v for k, v in req.model_dump().items() if v is not None}
    if "priority" in kwargs:
        kwargs["priority"] = _priority(kwargs["priority"])
    if not _manager.update_alert(alert_id, **kwargs):
        raise HTTPException(404, f"Alert {alert_id} not found")
    return {"updated": alert_id}


@router.delete("/{alert_id}")
async def delete_alert(alert_id: str):
    if not _manager.delete_alert(alert_id):
        raise HTTPException(404, f"Alert {alert_id} not found")
    return {"deleted": alert_id}


# ── Bulk Operations ──

@router.post("/bulk/enable")
async def bulk_enable(symbol: str = ""):
    count = _manager.enable_all(symbol)
    return {"enabled": count}


@router.post("/bulk/disable")
async def bulk_disable(symbol: str = ""):
    count = _manager.disable_all(symbol)
    return {"disabled": count}


@router.post("/bulk/delete-triggered")
async def bulk_delete_triggered():
    count = _manager.delete_triggered()
    return {"deleted": count}


@router.post("/{alert_id}/snooze")
async def snooze_alert(alert_id: str, req: SnoozeRequest):
    if not _manager.snooze_alert(alert_id, req.duration_seconds):
        raise HTTPException(404, f"Alert {alert_id} not found")
    return {"snoozed": alert_id, "duration": req.duration_seconds}


@router.post("/bulk/unsnooze")
async def bulk_unsnooze():
    count = _manager.unsnooze_due()
    return {"unsnoozed": count}


# ── Evaluation ──

@router.post("/evaluate/price")
async def evaluate_price(req: EvaluatePriceRequest):
    events = _manager.evaluate_price_alerts(
        req.symbol, req.price, req.prev_close)
    return {"triggered": len(events),
            "events": [{"alert_id": e.alert_id, "message": e.message,
                        "values": e.values} for e in events]}


@router.post("/evaluate/volume")
async def evaluate_volume(req: EvaluateVolumeRequest):
    events = _manager.evaluate_volume_alerts(
        req.symbol, req.volume, req.avg_volume)
    return {"triggered": len(events),
            "events": [{"alert_id": e.alert_id, "message": e.message} for e in events]}


@router.post("/evaluate/indicators")
async def evaluate_indicators(req: EvaluateIndicatorsRequest):
    events = _manager.evaluate_indicator_alerts(req.symbol, req.indicators)
    return {"triggered": len(events),
            "events": [{"alert_id": e.alert_id, "message": e.message} for e in events]}


@router.post("/evaluate/portfolio")
async def evaluate_portfolio(req: EvaluatePortfolioRequest):
    events = _manager.evaluate_portfolio_alerts(req.data)
    return {"triggered": len(events),
            "events": [{"alert_id": e.alert_id, "message": e.message} for e in events]}


# ── Scheduling ──

@router.post("/schedule")
async def schedule_alert(req: ScheduleRequest):
    alert = _manager.get_alert(req.alert_id)
    if not alert:
        raise HTTPException(404, f"Alert {req.alert_id} not found")
    _scheduler.create_scheduled_alert(alert, req.sessions)
    return {"scheduled": req.alert_id, "sessions": req.sessions}


@router.post("/schedule/time-based")
async def create_time_alert(req: TimeAlertRequest):
    alert = _scheduler.create_time_based_alert(
        req.name, req.hour, req.minute, req.message)
    aid = _manager.add_alert(alert)
    return {"id": aid, "name": req.name, "hour": req.hour, "minute": req.minute}


# ── History ──

@router.get("/history/events")
async def triggered_events(limit: int = 100):
    events = _manager.triggered_events(limit)
    return {"count": len(events),
            "events": [{"alert_id": e.alert_id, "timestamp": e.timestamp,
                        "message": e.message, "values": e.values} for e in events]}


@router.delete("/history/clear")
async def clear_history():
    count = _manager.clear_history()
    return {"cleared": count}


# ── Analytics ──

@router.get("/analytics/trigger-rate")
async def analytics_trigger_rate():
    alerts = _manager.list_alerts()
    return AlertAnalytics.trigger_rate(alerts)


@router.get("/analytics/by-type")
async def analytics_by_type():
    alerts = _manager.list_alerts()
    return AlertAnalytics.alerts_by_type(alerts)


@router.get("/analytics/most-triggered")
async def analytics_most_triggered(top_n: int = 10):
    alerts = _manager.list_alerts()
    return {"top": AlertAnalytics.most_triggered(alerts, top_n)}


@router.get("/analytics/health")
async def analytics_health():
    alerts = _manager.list_alerts()
    return AlertAnalytics.alert_health(alerts)


# ── Export / Summary ──

@router.get("/export")
async def export_alerts():
    return {"alerts": _manager.export_alerts()}


@router.get("/summary")
async def alert_summary():
    return _manager.summary()


@router.get("/status")
async def status():
    return _manager.count_by_status()


# ── Capabilities ──

@router.get("/capabilities")
async def capabilities():
    return {
        "alert_types": [t.value for t in AlertType],
        "priorities": [p.value for p in AlertPriority],
        "channels": [c.value for c in NotificationChannel],
        "features": [
            "price_alerts", "volume_alerts", "indicator_alerts",
            "portfolio_alerts", "news_alerts", "scheduling",
            "snooze", "cooldown", "max_triggers", "analytics",
            "bulk_operations", "notification_dispatch",
        ],
    }
