"""
alert_engine.py — Bloomberg-grade Alert & Notification Engine
==============================================================
Pure computation engine — no FastAPI imports.

Components:
    AlertType          — Enum of 20+ alert types
    AlertPriority      — Enum (low, medium, high, critical)
    AlertStatus        — Enum (active, triggered, expired, disabled)
    AlertCondition     — Single condition with evaluation logic
    Alert              — Full alert with conditions, history, metadata
    PriceAlertEngine   — Price-level, price change, price channel alerts
    VolumeAlertEngine  — Volume spike, dry-up, VWAP cross alerts
    IndicatorAlertEngine — RSI, MACD, Bollinger, SMA cross alerts
    NewsAlertEngine    — Keyword, sentiment, source-based alerts
    PortfolioAlertEngine — P&L, drawdown, exposure, margin alerts
    AlertManager       — CRUD, bulk evaluation, notification dispatch
    AlertScheduler     — Time-based alert scheduling (market hours, etc.)
    AlertAnalytics     — Alert performance, hit rates, statistics
"""

from __future__ import annotations
import time
import uuid
import numpy as np
from typing import Any, Callable, Dict, List, Optional, Set, Tuple
from dataclasses import dataclass, field
from enum import Enum


# ─── Enums ───────────────────────────────────────────────────────────────────

class AlertType(Enum):
    PRICE_ABOVE = "price_above"
    PRICE_BELOW = "price_below"
    PRICE_CROSS_ABOVE = "price_cross_above"
    PRICE_CROSS_BELOW = "price_cross_below"
    PRICE_CHANGE_PCT = "price_change_pct"
    PRICE_CHANNEL_BREAK = "price_channel_break"
    VOLUME_SPIKE = "volume_spike"
    VOLUME_ABOVE = "volume_above"
    VOLUME_DRY_UP = "volume_dry_up"
    VWAP_CROSS = "vwap_cross"
    RSI_OVERBOUGHT = "rsi_overbought"
    RSI_OVERSOLD = "rsi_oversold"
    MACD_CROSS = "macd_cross"
    SMA_CROSS = "sma_cross"
    BOLLINGER_TOUCH = "bollinger_touch"
    PNL_TARGET = "pnl_target"
    PNL_STOP = "pnl_stop"
    DRAWDOWN = "drawdown"
    EXPOSURE_LIMIT = "exposure_limit"
    MARGIN_WARNING = "margin_warning"
    NEWS_KEYWORD = "news_keyword"
    NEWS_SENTIMENT = "news_sentiment"
    CUSTOM = "custom"


class AlertPriority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AlertStatus(Enum):
    ACTIVE = "active"
    TRIGGERED = "triggered"
    EXPIRED = "expired"
    DISABLED = "disabled"
    SNOOZED = "snoozed"


class NotificationChannel(Enum):
    IN_APP = "in_app"
    EMAIL = "email"
    SMS = "sms"
    WEBHOOK = "webhook"
    SOUND = "sound"
    PUSH = "push"


# ─── DataClasses ─────────────────────────────────────────────────────────────

@dataclass
class AlertCondition:
    """Single condition for an alert."""
    field: str
    operator: str  # >, <, >=, <=, ==, crosses_above, crosses_below
    threshold: float
    current_value: float = 0.0
    previous_value: float = 0.0

    def evaluate(self, value: float) -> bool:
        self.previous_value = self.current_value
        self.current_value = value
        op = self.operator
        if op == ">":
            return value > self.threshold
        elif op == "<":
            return value < self.threshold
        elif op == ">=":
            return value >= self.threshold
        elif op == "<=":
            return value <= self.threshold
        elif op == "==":
            return abs(value - self.threshold) < 1e-10
        elif op == "crosses_above":
            return self.previous_value <= self.threshold and value > self.threshold
        elif op == "crosses_below":
            return self.previous_value >= self.threshold and value < self.threshold
        return False


@dataclass
class AlertTriggerEvent:
    """Record of when an alert was triggered."""
    alert_id: str
    timestamp: float
    values: Dict[str, float] = field(default_factory=dict)
    message: str = ""


@dataclass
class Alert:
    """Full alert definition with conditions and metadata."""
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:12])
    name: str = ""
    symbol: str = ""
    alert_type: AlertType = AlertType.CUSTOM
    priority: AlertPriority = AlertPriority.MEDIUM
    status: AlertStatus = AlertStatus.ACTIVE
    conditions: List[AlertCondition] = field(default_factory=list)
    channels: List[NotificationChannel] = field(default_factory=lambda: [NotificationChannel.IN_APP])
    message_template: str = ""
    created_at: float = field(default_factory=time.time)
    expires_at: Optional[float] = None
    trigger_count: int = 0
    max_triggers: int = 0  # 0 = unlimited
    cooldown_seconds: float = 60.0
    last_triggered: float = 0.0
    trigger_history: List[AlertTriggerEvent] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def is_active(self) -> bool:
        if self.status != AlertStatus.ACTIVE:
            return False
        if self.expires_at and time.time() > self.expires_at:
            self.status = AlertStatus.EXPIRED
            return False
        if self.max_triggers > 0 and self.trigger_count >= self.max_triggers:
            self.status = AlertStatus.TRIGGERED
            return False
        return True

    def can_trigger(self) -> bool:
        if not self.is_active():
            return False
        if self.last_triggered > 0:
            elapsed = time.time() - self.last_triggered
            if elapsed < self.cooldown_seconds:
                return False
        return True

    def trigger(self, values: Optional[Dict[str, float]] = None) -> AlertTriggerEvent:
        now = time.time()
        self.trigger_count += 1
        self.last_triggered = now
        msg = self.message_template
        if values:
            for k, v in values.items():
                msg = msg.replace(f"{{{k}}}", f"{v:.4f}")
        event = AlertTriggerEvent(
            alert_id=self.id, timestamp=now,
            values=values or {}, message=msg or f"Alert {self.name} triggered",
        )
        self.trigger_history.append(event)
        if self.max_triggers > 0 and self.trigger_count >= self.max_triggers:
            self.status = AlertStatus.TRIGGERED
        return event

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id, "name": self.name, "symbol": self.symbol,
            "type": self.alert_type.value, "priority": self.priority.value,
            "status": self.status.value, "trigger_count": self.trigger_count,
            "max_triggers": self.max_triggers, "cooldown": self.cooldown_seconds,
            "channels": [c.value for c in self.channels],
            "tags": self.tags, "created_at": self.created_at,
            "conditions": [{"field": c.field, "operator": c.operator,
                            "threshold": c.threshold} for c in self.conditions],
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 1. PriceAlertEngine — Price-level alerts
# ═══════════════════════════════════════════════════════════════════════════════

class PriceAlertEngine:
    """Price-based alert evaluation."""

    @staticmethod
    def create_price_above(symbol: str, price: float, name: str = "",
                           priority: AlertPriority = AlertPriority.MEDIUM) -> Alert:
        return Alert(
            name=name or f"{symbol} above {price}",
            symbol=symbol, alert_type=AlertType.PRICE_ABOVE, priority=priority,
            conditions=[AlertCondition("price", ">", price)],
            message_template=f"{symbol} price crossed above {price}: {{price}}",
        )

    @staticmethod
    def create_price_below(symbol: str, price: float, name: str = "",
                           priority: AlertPriority = AlertPriority.MEDIUM) -> Alert:
        return Alert(
            name=name or f"{symbol} below {price}",
            symbol=symbol, alert_type=AlertType.PRICE_BELOW, priority=priority,
            conditions=[AlertCondition("price", "<", price)],
            message_template=f"{symbol} price dropped below {price}: {{price}}",
        )

    @staticmethod
    def create_price_cross_above(symbol: str, price: float) -> Alert:
        return Alert(
            name=f"{symbol} crosses above {price}",
            symbol=symbol, alert_type=AlertType.PRICE_CROSS_ABOVE,
            conditions=[AlertCondition("price", "crosses_above", price)],
            message_template=f"{symbol} crossed above {price}: {{price}}",
        )

    @staticmethod
    def create_price_cross_below(symbol: str, price: float) -> Alert:
        return Alert(
            name=f"{symbol} crosses below {price}",
            symbol=symbol, alert_type=AlertType.PRICE_CROSS_BELOW,
            conditions=[AlertCondition("price", "crosses_below", price)],
            message_template=f"{symbol} crossed below {price}: {{price}}",
        )

    @staticmethod
    def create_price_change_pct(symbol: str, pct_threshold: float,
                                direction: str = "any") -> Alert:
        if direction == "up":
            cond = AlertCondition("change_pct", ">", pct_threshold)
        elif direction == "down":
            cond = AlertCondition("change_pct", "<", -abs(pct_threshold))
        else:
            # Will check absolute value manually
            cond = AlertCondition("abs_change_pct", ">", abs(pct_threshold))
        return Alert(
            name=f"{symbol} moves {pct_threshold}%",
            symbol=symbol, alert_type=AlertType.PRICE_CHANGE_PCT,
            conditions=[cond],
            message_template=f"{symbol} moved {{change_pct}}%",
        )

    @staticmethod
    def create_price_channel(symbol: str, upper: float, lower: float) -> Alert:
        return Alert(
            name=f"{symbol} channel [{lower}, {upper}]",
            symbol=symbol, alert_type=AlertType.PRICE_CHANNEL_BREAK,
            conditions=[
                AlertCondition("price", ">", upper),
                AlertCondition("price", "<", lower),
            ],
            message_template=f"{symbol} broke channel [{lower}, {upper}]: {{price}}",
            metadata={"upper": upper, "lower": lower, "logic": "or"},
        )

    @staticmethod
    def evaluate(alert: Alert, price: float, prev_close: float = 0.0) -> Optional[AlertTriggerEvent]:
        """Evaluate a price alert with current market data."""
        if not alert.can_trigger():
            return None

        values: Dict[str, float] = {"price": price}
        if prev_close > 0:
            change_pct = (price - prev_close) / prev_close * 100
            values["change_pct"] = change_pct
            values["abs_change_pct"] = abs(change_pct)

        logic = alert.metadata.get("logic", "all")
        if logic == "or":
            triggered = any(c.evaluate(values.get(c.field, 0)) for c in alert.conditions)
        else:
            triggered = all(c.evaluate(values.get(c.field, 0)) for c in alert.conditions)

        if triggered:
            return alert.trigger(values)
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# 2. VolumeAlertEngine — Volume-based alerts
# ═══════════════════════════════════════════════════════════════════════════════

class VolumeAlertEngine:
    """Volume-based alert evaluation."""

    @staticmethod
    def create_volume_spike(symbol: str, multiplier: float = 2.0) -> Alert:
        return Alert(
            name=f"{symbol} volume spike >{multiplier}x",
            symbol=symbol, alert_type=AlertType.VOLUME_SPIKE,
            conditions=[AlertCondition("volume_ratio", ">", multiplier)],
            message_template=f"{symbol} volume spike: {{volume_ratio}}x average",
        )

    @staticmethod
    def create_volume_above(symbol: str, threshold: float) -> Alert:
        return Alert(
            name=f"{symbol} volume above {threshold:,.0f}",
            symbol=symbol, alert_type=AlertType.VOLUME_ABOVE,
            conditions=[AlertCondition("volume", ">", threshold)],
            message_template=f"{symbol} volume: {{volume}}",
        )

    @staticmethod
    def create_volume_dry_up(symbol: str, threshold_ratio: float = 0.3) -> Alert:
        return Alert(
            name=f"{symbol} volume dry-up <{threshold_ratio}x",
            symbol=symbol, alert_type=AlertType.VOLUME_DRY_UP,
            conditions=[AlertCondition("volume_ratio", "<", threshold_ratio)],
            message_template=f"{symbol} volume dry-up: {{volume_ratio}}x average",
        )

    @staticmethod
    def evaluate(alert: Alert, volume: float, avg_volume: float) -> Optional[AlertTriggerEvent]:
        if not alert.can_trigger():
            return None
        volume_ratio = volume / avg_volume if avg_volume > 0 else 0
        values = {"volume": volume, "avg_volume": avg_volume, "volume_ratio": volume_ratio}
        triggered = all(c.evaluate(values.get(c.field, 0)) for c in alert.conditions)
        if triggered:
            return alert.trigger(values)
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# 3. IndicatorAlertEngine — Technical indicator alerts
# ═══════════════════════════════════════════════════════════════════════════════

class IndicatorAlertEngine:
    """Technical indicator-based alerts."""

    @staticmethod
    def create_rsi_overbought(symbol: str, threshold: float = 70.0) -> Alert:
        return Alert(
            name=f"{symbol} RSI overbought >{threshold}",
            symbol=symbol, alert_type=AlertType.RSI_OVERBOUGHT,
            conditions=[AlertCondition("rsi", "crosses_above", threshold)],
            message_template=f"{symbol} RSI overbought: {{rsi}}",
        )

    @staticmethod
    def create_rsi_oversold(symbol: str, threshold: float = 30.0) -> Alert:
        return Alert(
            name=f"{symbol} RSI oversold <{threshold}",
            symbol=symbol, alert_type=AlertType.RSI_OVERSOLD,
            conditions=[AlertCondition("rsi", "crosses_below", threshold)],
            message_template=f"{symbol} RSI oversold: {{rsi}}",
        )

    @staticmethod
    def create_macd_cross(symbol: str, direction: str = "bullish") -> Alert:
        if direction == "bullish":
            cond = AlertCondition("macd_histogram", "crosses_above", 0)
        else:
            cond = AlertCondition("macd_histogram", "crosses_below", 0)
        return Alert(
            name=f"{symbol} MACD {direction} cross",
            symbol=symbol, alert_type=AlertType.MACD_CROSS,
            conditions=[cond],
            message_template=f"{symbol} MACD {direction} cross: {{macd_histogram}}",
        )

    @staticmethod
    def create_sma_cross(symbol: str, fast: int = 50, slow: int = 200,
                         direction: str = "golden") -> Alert:
        if direction == "golden":
            cond = AlertCondition("sma_diff", "crosses_above", 0)
        else:
            cond = AlertCondition("sma_diff", "crosses_below", 0)
        return Alert(
            name=f"{symbol} SMA {fast}/{slow} {direction} cross",
            symbol=symbol, alert_type=AlertType.SMA_CROSS,
            conditions=[cond],
            message_template=f"{symbol} SMA {direction} cross",
            metadata={"fast_period": fast, "slow_period": slow},
        )

    @staticmethod
    def create_bollinger_touch(symbol: str, band: str = "upper") -> Alert:
        if band == "upper":
            cond = AlertCondition("bb_position", ">", 1.0)
        else:
            cond = AlertCondition("bb_position", "<", 0.0)
        return Alert(
            name=f"{symbol} Bollinger {band} touch",
            symbol=symbol, alert_type=AlertType.BOLLINGER_TOUCH,
            conditions=[cond],
            message_template=f"{symbol} touched Bollinger {band} band",
        )

    @staticmethod
    def evaluate(alert: Alert, indicator_values: Dict[str, float]) -> Optional[AlertTriggerEvent]:
        if not alert.can_trigger():
            return None
        triggered = all(c.evaluate(indicator_values.get(c.field, 0))
                        for c in alert.conditions)
        if triggered:
            return alert.trigger(indicator_values)
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# 4. PortfolioAlertEngine — P&L and risk alerts
# ═══════════════════════════════════════════════════════════════════════════════

class PortfolioAlertEngine:
    """Portfolio-level alerts for P&L, drawdown, exposure."""

    @staticmethod
    def create_pnl_target(name: str, target_pct: float) -> Alert:
        return Alert(
            name=name or f"P&L target {target_pct}%",
            alert_type=AlertType.PNL_TARGET, priority=AlertPriority.HIGH,
            conditions=[AlertCondition("total_pnl_pct", ">", target_pct)],
            message_template=f"P&L target hit: {{total_pnl_pct}}%",
        )

    @staticmethod
    def create_pnl_stop(name: str, stop_pct: float) -> Alert:
        return Alert(
            name=name or f"P&L stop {stop_pct}%",
            alert_type=AlertType.PNL_STOP, priority=AlertPriority.CRITICAL,
            conditions=[AlertCondition("total_pnl_pct", "<", -abs(stop_pct))],
            message_template=f"P&L stop triggered: {{total_pnl_pct}}%",
        )

    @staticmethod
    def create_drawdown_alert(threshold_pct: float = 10.0) -> Alert:
        return Alert(
            name=f"Drawdown >{threshold_pct}%",
            alert_type=AlertType.DRAWDOWN, priority=AlertPriority.HIGH,
            conditions=[AlertCondition("drawdown_pct", ">", threshold_pct)],
            message_template=f"Drawdown alert: {{drawdown_pct}}%",
        )

    @staticmethod
    def create_exposure_alert(max_exposure_pct: float = 100.0) -> Alert:
        return Alert(
            name=f"Exposure >{max_exposure_pct}%",
            alert_type=AlertType.EXPOSURE_LIMIT, priority=AlertPriority.HIGH,
            conditions=[AlertCondition("gross_exposure_pct", ">", max_exposure_pct)],
            message_template=f"Exposure limit: {{gross_exposure_pct}}%",
        )

    @staticmethod
    def create_margin_warning(threshold_pct: float = 80.0) -> Alert:
        return Alert(
            name=f"Margin usage >{threshold_pct}%",
            alert_type=AlertType.MARGIN_WARNING, priority=AlertPriority.CRITICAL,
            conditions=[AlertCondition("margin_usage_pct", ">", threshold_pct)],
            message_template=f"Margin warning: {{margin_usage_pct}}% utilized",
        )

    @staticmethod
    def evaluate(alert: Alert, portfolio_data: Dict[str, float]) -> Optional[AlertTriggerEvent]:
        if not alert.can_trigger():
            return None
        triggered = all(c.evaluate(portfolio_data.get(c.field, 0))
                        for c in alert.conditions)
        if triggered:
            return alert.trigger(portfolio_data)
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# 5. NewsAlertEngine — News-based alerts
# ═══════════════════════════════════════════════════════════════════════════════

class NewsAlertEngine:
    """News and sentiment-based alerts."""

    @staticmethod
    def create_keyword_alert(symbol: str, keywords: List[str]) -> Alert:
        return Alert(
            name=f"{symbol} news: {', '.join(keywords[:3])}",
            symbol=symbol, alert_type=AlertType.NEWS_KEYWORD,
            message_template=f"{symbol} news matched keywords",
            metadata={"keywords": keywords},
        )

    @staticmethod
    def create_sentiment_alert(symbol: str, sentiment_threshold: float = -0.5) -> Alert:
        return Alert(
            name=f"{symbol} negative sentiment",
            symbol=symbol, alert_type=AlertType.NEWS_SENTIMENT,
            conditions=[AlertCondition("sentiment_score", "<", sentiment_threshold)],
            message_template=f"{symbol} sentiment alert: {{sentiment_score}}",
        )

    @staticmethod
    def evaluate_keywords(alert: Alert, headline: str) -> Optional[AlertTriggerEvent]:
        if not alert.can_trigger():
            return None
        keywords = alert.metadata.get("keywords", [])
        headline_lower = headline.lower()
        matched = [kw for kw in keywords if kw.lower() in headline_lower]
        if matched:
            return alert.trigger({"matched_keywords": len(matched),
                                   "headline_length": len(headline)})
        return None

    @staticmethod
    def evaluate_sentiment(alert: Alert, sentiment_score: float) -> Optional[AlertTriggerEvent]:
        if not alert.can_trigger():
            return None
        triggered = all(c.evaluate(sentiment_score) for c in alert.conditions)
        if triggered:
            return alert.trigger({"sentiment_score": sentiment_score})
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# 6. AlertScheduler — Time-based scheduling
# ═══════════════════════════════════════════════════════════════════════════════

class AlertScheduler:
    """Schedule alerts for specific times or market conditions."""

    MARKET_HOURS = {
        "pre_market": (4, 0, 9, 30),    # 4:00 - 9:30 ET
        "regular": (9, 30, 16, 0),        # 9:30 - 16:00 ET
        "after_hours": (16, 0, 20, 0),    # 16:00 - 20:00 ET
    }

    @staticmethod
    def is_market_hours(hour: int, minute: int, session: str = "regular") -> bool:
        hours = AlertScheduler.MARKET_HOURS.get(session)
        if not hours:
            return False
        start_h, start_m, end_h, end_m = hours
        current = hour * 60 + minute
        start = start_h * 60 + start_m
        end = end_h * 60 + end_m
        return start <= current < end

    @staticmethod
    def create_scheduled_alert(alert: Alert, active_sessions: List[str]) -> Alert:
        """Add session restrictions to an alert."""
        alert.metadata["active_sessions"] = active_sessions
        return alert

    @staticmethod
    def should_evaluate(alert: Alert, hour: int, minute: int) -> bool:
        sessions = alert.metadata.get("active_sessions")
        if not sessions:
            return True  # no restriction
        return any(AlertScheduler.is_market_hours(hour, minute, s) for s in sessions)

    @staticmethod
    def create_time_based_alert(name: str, hour: int, minute: int,
                                 message: str = "") -> Alert:
        """Alert that triggers at a specific time."""
        return Alert(
            name=name, alert_type=AlertType.CUSTOM,
            message_template=message or f"Scheduled alert: {name}",
            metadata={"trigger_hour": hour, "trigger_minute": minute},
        )

    @staticmethod
    def check_time_trigger(alert: Alert, hour: int, minute: int) -> bool:
        th = alert.metadata.get("trigger_hour")
        tm = alert.metadata.get("trigger_minute")
        if th is not None and tm is not None:
            return hour == th and minute == tm
        return False


# ═══════════════════════════════════════════════════════════════════════════════
# 7. AlertManager — CRUD and orchestration
# ═══════════════════════════════════════════════════════════════════════════════

class AlertManager:
    """Central alert management — create, evaluate, dispatch."""

    def __init__(self):
        self._alerts: Dict[str, Alert] = {}
        self._triggered_events: List[AlertTriggerEvent] = []
        self._notification_handlers: Dict[NotificationChannel, Callable] = {}

    # ── CRUD ──

    def add_alert(self, alert: Alert) -> str:
        self._alerts[alert.id] = alert
        return alert.id

    def get_alert(self, alert_id: str) -> Optional[Alert]:
        return self._alerts.get(alert_id)

    def update_alert(self, alert_id: str, **kwargs) -> bool:
        alert = self._alerts.get(alert_id)
        if not alert:
            return False
        for key, value in kwargs.items():
            if hasattr(alert, key):
                setattr(alert, key, value)
        return True

    def delete_alert(self, alert_id: str) -> bool:
        return self._alerts.pop(alert_id, None) is not None

    def list_alerts(self, symbol: str = "", status: Optional[AlertStatus] = None,
                    alert_type: Optional[AlertType] = None,
                    tags: Optional[List[str]] = None) -> List[Alert]:
        """List alerts with optional filtering."""
        results = list(self._alerts.values())
        if symbol:
            results = [a for a in results if a.symbol == symbol]
        if status:
            results = [a for a in results if a.status == status]
        if alert_type:
            results = [a for a in results if a.alert_type == alert_type]
        if tags:
            tag_set = set(tags)
            results = [a for a in results if tag_set & set(a.tags)]
        return results

    def count_by_status(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for alert in self._alerts.values():
            key = alert.status.value
            counts[key] = counts.get(key, 0) + 1
        return counts

    # ── Bulk Operations ──

    def enable_all(self, symbol: str = "") -> int:
        count = 0
        for alert in self._alerts.values():
            if symbol and alert.symbol != symbol:
                continue
            if alert.status == AlertStatus.DISABLED:
                alert.status = AlertStatus.ACTIVE
                count += 1
        return count

    def disable_all(self, symbol: str = "") -> int:
        count = 0
        for alert in self._alerts.values():
            if symbol and alert.symbol != symbol:
                continue
            if alert.status == AlertStatus.ACTIVE:
                alert.status = AlertStatus.DISABLED
                count += 1
        return count

    def delete_triggered(self) -> int:
        to_delete = [aid for aid, a in self._alerts.items()
                     if a.status == AlertStatus.TRIGGERED]
        for aid in to_delete:
            del self._alerts[aid]
        return len(to_delete)

    def snooze_alert(self, alert_id: str, duration_seconds: float = 3600) -> bool:
        alert = self._alerts.get(alert_id)
        if not alert:
            return False
        alert.status = AlertStatus.SNOOZED
        alert.metadata["snooze_until"] = time.time() + duration_seconds
        return True

    def unsnooze_due(self) -> int:
        """Unsnooze alerts whose snooze period has expired."""
        count = 0
        now = time.time()
        for alert in self._alerts.values():
            if alert.status == AlertStatus.SNOOZED:
                snooze_until = alert.metadata.get("snooze_until", 0)
                if now >= snooze_until:
                    alert.status = AlertStatus.ACTIVE
                    count += 1
        return count

    # ── Evaluation ──

    def evaluate_price_alerts(self, symbol: str, price: float,
                               prev_close: float = 0.0) -> List[AlertTriggerEvent]:
        """Evaluate all price alerts for a symbol."""
        events = []
        for alert in self._alerts.values():
            if alert.symbol != symbol:
                continue
            if alert.alert_type not in (AlertType.PRICE_ABOVE, AlertType.PRICE_BELOW,
                                         AlertType.PRICE_CROSS_ABOVE, AlertType.PRICE_CROSS_BELOW,
                                         AlertType.PRICE_CHANGE_PCT, AlertType.PRICE_CHANNEL_BREAK):
                continue
            event = PriceAlertEngine.evaluate(alert, price, prev_close)
            if event:
                events.append(event)
                self._triggered_events.append(event)
        return events

    def evaluate_volume_alerts(self, symbol: str, volume: float,
                                avg_volume: float) -> List[AlertTriggerEvent]:
        events = []
        for alert in self._alerts.values():
            if alert.symbol != symbol:
                continue
            if alert.alert_type not in (AlertType.VOLUME_SPIKE, AlertType.VOLUME_ABOVE,
                                         AlertType.VOLUME_DRY_UP):
                continue
            event = VolumeAlertEngine.evaluate(alert, volume, avg_volume)
            if event:
                events.append(event)
                self._triggered_events.append(event)
        return events

    def evaluate_indicator_alerts(self, symbol: str,
                                   indicators: Dict[str, float]) -> List[AlertTriggerEvent]:
        events = []
        for alert in self._alerts.values():
            if alert.symbol != symbol:
                continue
            if alert.alert_type not in (AlertType.RSI_OVERBOUGHT, AlertType.RSI_OVERSOLD,
                                         AlertType.MACD_CROSS, AlertType.SMA_CROSS,
                                         AlertType.BOLLINGER_TOUCH):
                continue
            event = IndicatorAlertEngine.evaluate(alert, indicators)
            if event:
                events.append(event)
                self._triggered_events.append(event)
        return events

    def evaluate_portfolio_alerts(self, portfolio_data: Dict[str, float]) -> List[AlertTriggerEvent]:
        events = []
        for alert in self._alerts.values():
            if alert.alert_type not in (AlertType.PNL_TARGET, AlertType.PNL_STOP,
                                         AlertType.DRAWDOWN, AlertType.EXPOSURE_LIMIT,
                                         AlertType.MARGIN_WARNING):
                continue
            event = PortfolioAlertEngine.evaluate(alert, portfolio_data)
            if event:
                events.append(event)
                self._triggered_events.append(event)
        return events

    # ── Notifications ──

    def register_handler(self, channel: NotificationChannel,
                         handler: Callable[[AlertTriggerEvent], None]) -> None:
        self._notification_handlers[channel] = handler

    def dispatch_notification(self, event: AlertTriggerEvent) -> List[str]:
        """Dispatch event to appropriate notification channels."""
        alert = self._alerts.get(event.alert_id)
        if not alert:
            return []
        dispatched = []
        for channel in alert.channels:
            handler = self._notification_handlers.get(channel)
            if handler:
                handler(event)
                dispatched.append(channel.value)
        return dispatched

    # ── History ──

    def triggered_events(self, limit: int = 100) -> List[AlertTriggerEvent]:
        return self._triggered_events[-limit:]

    def clear_history(self) -> int:
        count = len(self._triggered_events)
        self._triggered_events.clear()
        return count

    # ── Export/Import ──

    def export_alerts(self) -> List[Dict[str, Any]]:
        return [a.to_dict() for a in self._alerts.values()]

    def summary(self) -> Dict[str, Any]:
        return {
            "total_alerts": len(self._alerts),
            "by_status": self.count_by_status(),
            "total_triggered_events": len(self._triggered_events),
            "symbols_monitored": len(set(a.symbol for a in self._alerts.values()
                                          if a.symbol)),
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 8. AlertAnalytics — Alert performance analysis
# ═══════════════════════════════════════════════════════════════════════════════

class AlertAnalytics:
    """Analyze alert effectiveness and performance."""

    @staticmethod
    def trigger_rate(alerts: List[Alert]) -> Dict[str, float]:
        """Calculate trigger rate across alerts."""
        if not alerts:
            return {"trigger_rate": 0.0, "total": 0}
        triggered = sum(1 for a in alerts if a.trigger_count > 0)
        return {
            "trigger_rate": triggered / len(alerts),
            "triggered": triggered,
            "total": len(alerts),
            "avg_triggers": sum(a.trigger_count for a in alerts) / len(alerts),
        }

    @staticmethod
    def alerts_by_type(alerts: List[Alert]) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for a in alerts:
            key = a.alert_type.value
            counts[key] = counts.get(key, 0) + 1
        return counts

    @staticmethod
    def most_triggered(alerts: List[Alert], top_n: int = 10) -> List[Dict[str, Any]]:
        sorted_alerts = sorted(alerts, key=lambda a: a.trigger_count, reverse=True)
        return [{"id": a.id, "name": a.name, "symbol": a.symbol,
                 "trigger_count": a.trigger_count, "type": a.alert_type.value}
                for a in sorted_alerts[:top_n]]

    @staticmethod
    def trigger_frequency(events: List[AlertTriggerEvent],
                          bucket_seconds: float = 3600) -> Dict[str, int]:
        """Count triggers per time bucket."""
        if not events:
            return {}
        buckets: Dict[str, int] = {}
        for e in events:
            bucket = int(e.timestamp / bucket_seconds)
            key = str(bucket)
            buckets[key] = buckets.get(key, 0) + 1
        return buckets

    @staticmethod
    def alert_health(alerts: List[Alert]) -> Dict[str, Any]:
        """Overall alert system health metrics."""
        active = sum(1 for a in alerts if a.status == AlertStatus.ACTIVE)
        disabled = sum(1 for a in alerts if a.status == AlertStatus.DISABLED)
        expired = sum(1 for a in alerts if a.status == AlertStatus.EXPIRED)
        triggered = sum(1 for a in alerts if a.status == AlertStatus.TRIGGERED)
        snoozed = sum(1 for a in alerts if a.status == AlertStatus.SNOOZED)
        return {
            "total": len(alerts),
            "active": active, "disabled": disabled, "expired": expired,
            "triggered": triggered, "snoozed": snoozed,
            "health_score": active / len(alerts) if alerts else 0,
        }
