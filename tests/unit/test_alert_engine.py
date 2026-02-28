"""
test_alert_engine.py — Comprehensive tests for alert_engine.py
================================================================
Tests: PriceAlertEngine, VolumeAlertEngine, IndicatorAlertEngine,
       PortfolioAlertEngine, NewsAlertEngine, AlertScheduler,
       AlertManager, AlertAnalytics
"""

import time
import pytest
import numpy as np
from services.alert_engine import (
    AlertType, AlertPriority, AlertStatus, NotificationChannel,
    AlertCondition, Alert, AlertTriggerEvent,
    PriceAlertEngine, VolumeAlertEngine, IndicatorAlertEngine,
    PortfolioAlertEngine, NewsAlertEngine, AlertScheduler,
    AlertManager, AlertAnalytics,
)


# ═══════════════════════════════════════════════════════════════════════════════
# AlertCondition
# ═══════════════════════════════════════════════════════════════════════════════

class TestAlertCondition:
    def test_greater_than(self):
        c = AlertCondition("price", ">", 100.0)
        assert c.evaluate(101.0) is True
        assert c.evaluate(99.0) is False
        assert c.evaluate(100.0) is False

    def test_less_than(self):
        c = AlertCondition("price", "<", 50.0)
        assert c.evaluate(49.0) is True
        assert c.evaluate(51.0) is False

    def test_greater_equal(self):
        c = AlertCondition("price", ">=", 100.0)
        assert c.evaluate(100.0) is True
        assert c.evaluate(100.01) is True
        assert c.evaluate(99.99) is False

    def test_less_equal(self):
        c = AlertCondition("price", "<=", 100.0)
        assert c.evaluate(100.0) is True
        assert c.evaluate(99.0) is True
        assert c.evaluate(101.0) is False

    def test_equals(self):
        c = AlertCondition("price", "==", 100.0)
        assert c.evaluate(100.0) is True
        assert c.evaluate(100.01) is False

    def test_crosses_above(self):
        c = AlertCondition("price", "crosses_above", 100.0)
        # First call: prev=0 (default), curr=99 → not crossing
        assert c.evaluate(99.0) is False
        # Second call: prev=99, curr=101 → crossing above
        assert c.evaluate(101.0) is True
        # Third call: prev=101, curr=102 → already above, no cross
        assert c.evaluate(102.0) is False

    def test_crosses_below(self):
        c = AlertCondition("price", "crosses_below", 100.0)
        # First: prev=0, curr=101 → not crossing below
        assert c.evaluate(101.0) is False
        # Second: prev=101, curr=99 → crossing below
        assert c.evaluate(99.0) is True
        # Third: prev=99, curr=98 → already below
        assert c.evaluate(98.0) is False

    def test_unknown_operator(self):
        c = AlertCondition("price", "invalid", 100.0)
        assert c.evaluate(100.0) is False

    def test_tracks_values(self):
        c = AlertCondition("x", ">", 0)
        c.evaluate(10.0)
        assert c.current_value == 10.0
        c.evaluate(20.0)
        assert c.previous_value == 10.0
        assert c.current_value == 20.0


# ═══════════════════════════════════════════════════════════════════════════════
# Alert
# ═══════════════════════════════════════════════════════════════════════════════

class TestAlert:
    def test_basic_creation(self):
        a = Alert(name="Test", symbol="AAPL")
        assert a.name == "Test"
        assert a.symbol == "AAPL"
        assert a.status == AlertStatus.ACTIVE
        assert a.trigger_count == 0
        assert len(a.id) == 12

    def test_is_active(self):
        a = Alert()
        assert a.is_active() is True

    def test_is_active_disabled(self):
        a = Alert(status=AlertStatus.DISABLED)
        assert a.is_active() is False

    def test_is_active_expired(self):
        a = Alert(expires_at=time.time() - 100)
        assert a.is_active() is False
        assert a.status == AlertStatus.EXPIRED

    def test_max_triggers(self):
        a = Alert(max_triggers=2)
        a.trigger()
        assert a.is_active() is True
        a.trigger()
        assert a.is_active() is False
        assert a.status == AlertStatus.TRIGGERED

    def test_can_trigger_cooldown(self):
        a = Alert(cooldown_seconds=999)
        a.trigger()
        assert a.can_trigger() is False  # within cooldown

    def test_trigger_event(self):
        a = Alert(name="T1", message_template="Price: {price}")
        event = a.trigger({"price": 150.5})
        assert event.alert_id == a.id
        assert "150.5" in event.message
        assert len(a.trigger_history) == 1
        assert a.trigger_count == 1

    def test_to_dict(self):
        a = Alert(name="Test", symbol="AAPL", alert_type=AlertType.PRICE_ABOVE,
                  conditions=[AlertCondition("price", ">", 100)])
        d = a.to_dict()
        assert d["name"] == "Test"
        assert d["symbol"] == "AAPL"
        assert d["type"] == "price_above"
        assert len(d["conditions"]) == 1


# ═══════════════════════════════════════════════════════════════════════════════
# PriceAlertEngine
# ═══════════════════════════════════════════════════════════════════════════════

class TestPriceAlertEngine:
    def test_price_above_triggers(self):
        alert = PriceAlertEngine.create_price_above("AAPL", 150.0)
        event = PriceAlertEngine.evaluate(alert, 151.0)
        assert event is not None
        assert alert.trigger_count == 1

    def test_price_above_no_trigger(self):
        alert = PriceAlertEngine.create_price_above("AAPL", 150.0)
        event = PriceAlertEngine.evaluate(alert, 149.0)
        assert event is None

    def test_price_below_triggers(self):
        alert = PriceAlertEngine.create_price_below("TSLA", 200.0)
        event = PriceAlertEngine.evaluate(alert, 195.0)
        assert event is not None

    def test_price_cross_above(self):
        alert = PriceAlertEngine.create_price_cross_above("MSFT", 300.0)
        # First eval: set previous
        event1 = PriceAlertEngine.evaluate(alert, 299.0)
        assert event1 is None
        # Allow cooldown to expire
        alert.last_triggered = 0
        alert.cooldown_seconds = 0
        # Second eval: cross above
        event2 = PriceAlertEngine.evaluate(alert, 301.0)
        assert event2 is not None

    def test_price_cross_below(self):
        alert = PriceAlertEngine.create_price_cross_below("GOOGL", 100.0)
        event1 = PriceAlertEngine.evaluate(alert, 101.0)
        assert event1 is None
        alert.cooldown_seconds = 0
        event2 = PriceAlertEngine.evaluate(alert, 99.0)
        assert event2 is not None

    def test_price_change_pct_up(self):
        alert = PriceAlertEngine.create_price_change_pct("SPY", 5.0, direction="up")
        event = PriceAlertEngine.evaluate(alert, 110.0, prev_close=100.0)
        assert event is not None

    def test_price_change_pct_no_trigger(self):
        alert = PriceAlertEngine.create_price_change_pct("SPY", 5.0, direction="up")
        event = PriceAlertEngine.evaluate(alert, 103.0, prev_close=100.0)
        assert event is None

    def test_price_channel_break_above(self):
        alert = PriceAlertEngine.create_price_channel("NVDA", upper=500.0, lower=400.0)
        event = PriceAlertEngine.evaluate(alert, 510.0)
        assert event is not None

    def test_price_channel_break_below(self):
        alert = PriceAlertEngine.create_price_channel("NVDA", upper=500.0, lower=400.0)
        event = PriceAlertEngine.evaluate(alert, 390.0)
        assert event is not None

    def test_price_channel_no_break(self):
        alert = PriceAlertEngine.create_price_channel("NVDA", upper=500.0, lower=400.0)
        event = PriceAlertEngine.evaluate(alert, 450.0)
        assert event is None

    def test_disabled_alert_no_trigger(self):
        alert = PriceAlertEngine.create_price_above("X", 10.0)
        alert.status = AlertStatus.DISABLED
        event = PriceAlertEngine.evaluate(alert, 20.0)
        assert event is None


# ═══════════════════════════════════════════════════════════════════════════════
# VolumeAlertEngine
# ═══════════════════════════════════════════════════════════════════════════════

class TestVolumeAlertEngine:
    def test_volume_spike(self):
        alert = VolumeAlertEngine.create_volume_spike("AAPL", 2.0)
        event = VolumeAlertEngine.evaluate(alert, 3_000_000, 1_000_000)
        assert event is not None

    def test_volume_spike_no_trigger(self):
        alert = VolumeAlertEngine.create_volume_spike("AAPL", 2.0)
        event = VolumeAlertEngine.evaluate(alert, 1_500_000, 1_000_000)
        assert event is None

    def test_volume_above(self):
        alert = VolumeAlertEngine.create_volume_above("TSLA", 5_000_000)
        event = VolumeAlertEngine.evaluate(alert, 6_000_000, 3_000_000)
        assert event is not None

    def test_volume_dry_up(self):
        alert = VolumeAlertEngine.create_volume_dry_up("SPY", 0.3)
        event = VolumeAlertEngine.evaluate(alert, 200_000, 1_000_000)
        assert event is not None

    def test_volume_dry_up_no_trigger(self):
        alert = VolumeAlertEngine.create_volume_dry_up("SPY", 0.3)
        event = VolumeAlertEngine.evaluate(alert, 500_000, 1_000_000)
        assert event is None

    def test_zero_avg_volume(self):
        alert = VolumeAlertEngine.create_volume_spike("X", 2.0)
        event = VolumeAlertEngine.evaluate(alert, 100, 0)
        assert event is None  # ratio = 0, not > 2


# ═══════════════════════════════════════════════════════════════════════════════
# IndicatorAlertEngine
# ═══════════════════════════════════════════════════════════════════════════════

class TestIndicatorAlertEngine:
    def test_rsi_overbought(self):
        alert = IndicatorAlertEngine.create_rsi_overbought("AAPL", 70)
        # First eval: set previous
        IndicatorAlertEngine.evaluate(alert, {"rsi": 69.0})
        alert.cooldown_seconds = 0
        # Cross above
        event = IndicatorAlertEngine.evaluate(alert, {"rsi": 72.0})
        assert event is not None

    def test_rsi_oversold(self):
        alert = IndicatorAlertEngine.create_rsi_oversold("AAPL", 30)
        IndicatorAlertEngine.evaluate(alert, {"rsi": 31.0})
        alert.cooldown_seconds = 0
        event = IndicatorAlertEngine.evaluate(alert, {"rsi": 28.0})
        assert event is not None

    def test_macd_bullish_cross(self):
        alert = IndicatorAlertEngine.create_macd_cross("SPY", "bullish")
        IndicatorAlertEngine.evaluate(alert, {"macd_histogram": -0.5})
        alert.cooldown_seconds = 0
        event = IndicatorAlertEngine.evaluate(alert, {"macd_histogram": 0.5})
        assert event is not None

    def test_macd_bearish_cross(self):
        alert = IndicatorAlertEngine.create_macd_cross("SPY", "bearish")
        IndicatorAlertEngine.evaluate(alert, {"macd_histogram": 0.5})
        alert.cooldown_seconds = 0
        event = IndicatorAlertEngine.evaluate(alert, {"macd_histogram": -0.5})
        assert event is not None

    def test_sma_golden_cross(self):
        alert = IndicatorAlertEngine.create_sma_cross("QQQ", 50, 200, "golden")
        IndicatorAlertEngine.evaluate(alert, {"sma_diff": -1.0})
        alert.cooldown_seconds = 0
        event = IndicatorAlertEngine.evaluate(alert, {"sma_diff": 1.0})
        assert event is not None

    def test_bollinger_upper_touch(self):
        alert = IndicatorAlertEngine.create_bollinger_touch("AAPL", "upper")
        event = IndicatorAlertEngine.evaluate(alert, {"bb_position": 1.1})
        assert event is not None

    def test_bollinger_lower_touch(self):
        alert = IndicatorAlertEngine.create_bollinger_touch("AAPL", "lower")
        event = IndicatorAlertEngine.evaluate(alert, {"bb_position": -0.1})
        assert event is not None


# ═══════════════════════════════════════════════════════════════════════════════
# PortfolioAlertEngine
# ═══════════════════════════════════════════════════════════════════════════════

class TestPortfolioAlertEngine:
    def test_pnl_target(self):
        alert = PortfolioAlertEngine.create_pnl_target("Target 10%", 10.0)
        event = PortfolioAlertEngine.evaluate(alert, {"total_pnl_pct": 12.0})
        assert event is not None

    def test_pnl_stop(self):
        alert = PortfolioAlertEngine.create_pnl_stop("Stop -5%", 5.0)
        event = PortfolioAlertEngine.evaluate(alert, {"total_pnl_pct": -6.0})
        assert event is not None

    def test_pnl_stop_no_trigger(self):
        alert = PortfolioAlertEngine.create_pnl_stop("Stop -5%", 5.0)
        event = PortfolioAlertEngine.evaluate(alert, {"total_pnl_pct": -3.0})
        assert event is None

    def test_drawdown_alert(self):
        alert = PortfolioAlertEngine.create_drawdown_alert(10.0)
        event = PortfolioAlertEngine.evaluate(alert, {"drawdown_pct": 12.0})
        assert event is not None

    def test_exposure_alert(self):
        alert = PortfolioAlertEngine.create_exposure_alert(100.0)
        event = PortfolioAlertEngine.evaluate(alert, {"gross_exposure_pct": 120.0})
        assert event is not None

    def test_margin_warning(self):
        alert = PortfolioAlertEngine.create_margin_warning(80.0)
        event = PortfolioAlertEngine.evaluate(alert, {"margin_usage_pct": 85.0})
        assert event is not None

    def test_margin_ok(self):
        alert = PortfolioAlertEngine.create_margin_warning(80.0)
        event = PortfolioAlertEngine.evaluate(alert, {"margin_usage_pct": 70.0})
        assert event is None


# ═══════════════════════════════════════════════════════════════════════════════
# NewsAlertEngine
# ═══════════════════════════════════════════════════════════════════════════════

class TestNewsAlertEngine:
    def test_keyword_match(self):
        alert = NewsAlertEngine.create_keyword_alert("TSLA", ["earnings", "recall"])
        event = NewsAlertEngine.evaluate_keywords(alert, "Tesla announces record earnings beat")
        assert event is not None

    def test_keyword_no_match(self):
        alert = NewsAlertEngine.create_keyword_alert("TSLA", ["bankruptcy", "fraud"])
        event = NewsAlertEngine.evaluate_keywords(alert, "Tesla stock rises 5%")
        assert event is None

    def test_sentiment_negative(self):
        alert = NewsAlertEngine.create_sentiment_alert("AAPL", -0.5)
        event = NewsAlertEngine.evaluate_sentiment(alert, -0.7)
        assert event is not None

    def test_sentiment_ok(self):
        alert = NewsAlertEngine.create_sentiment_alert("AAPL", -0.5)
        event = NewsAlertEngine.evaluate_sentiment(alert, 0.3)
        assert event is None


# ═══════════════════════════════════════════════════════════════════════════════
# AlertScheduler
# ═══════════════════════════════════════════════════════════════════════════════

class TestAlertScheduler:
    def test_regular_market_hours(self):
        assert AlertScheduler.is_market_hours(10, 0, "regular") is True
        assert AlertScheduler.is_market_hours(15, 59, "regular") is True
        assert AlertScheduler.is_market_hours(16, 0, "regular") is False
        assert AlertScheduler.is_market_hours(9, 29, "regular") is False

    def test_pre_market(self):
        assert AlertScheduler.is_market_hours(5, 0, "pre_market") is True
        assert AlertScheduler.is_market_hours(9, 31, "pre_market") is False

    def test_after_hours(self):
        assert AlertScheduler.is_market_hours(17, 0, "after_hours") is True
        assert AlertScheduler.is_market_hours(20, 0, "after_hours") is False

    def test_unknown_session(self):
        assert AlertScheduler.is_market_hours(12, 0, "lunar") is False

    def test_scheduled_alert_restriction(self):
        alert = Alert(name="test")
        alert = AlertScheduler.create_scheduled_alert(alert, ["regular"])
        assert AlertScheduler.should_evaluate(alert, 10, 0) is True
        assert AlertScheduler.should_evaluate(alert, 3, 0) is False

    def test_no_session_restriction(self):
        alert = Alert(name="test")
        assert AlertScheduler.should_evaluate(alert, 3, 0) is True

    def test_time_based_trigger(self):
        alert = AlertScheduler.create_time_based_alert("Open Bell", 9, 30)
        assert AlertScheduler.check_time_trigger(alert, 9, 30) is True
        assert AlertScheduler.check_time_trigger(alert, 9, 31) is False


# ═══════════════════════════════════════════════════════════════════════════════
# AlertManager
# ═══════════════════════════════════════════════════════════════════════════════

class TestAlertManager:
    def setup_method(self):
        self.mgr = AlertManager()

    def test_add_and_get(self):
        alert = Alert(name="test")
        aid = self.mgr.add_alert(alert)
        fetched = self.mgr.get_alert(aid)
        assert fetched is not None
        assert fetched.name == "test"

    def test_update(self):
        alert = Alert(name="old")
        aid = self.mgr.add_alert(alert)
        assert self.mgr.update_alert(aid, name="new") is True
        assert self.mgr.get_alert(aid).name == "new"

    def test_update_nonexistent(self):
        assert self.mgr.update_alert("nonexistent", name="x") is False

    def test_delete(self):
        alert = Alert(name="del")
        aid = self.mgr.add_alert(alert)
        assert self.mgr.delete_alert(aid) is True
        assert self.mgr.get_alert(aid) is None

    def test_delete_nonexistent(self):
        assert self.mgr.delete_alert("nope") is False

    def test_list_all(self):
        self.mgr.add_alert(Alert(name="a", symbol="AAPL"))
        self.mgr.add_alert(Alert(name="b", symbol="TSLA"))
        assert len(self.mgr.list_alerts()) == 2

    def test_list_by_symbol(self):
        self.mgr.add_alert(Alert(name="a", symbol="AAPL"))
        self.mgr.add_alert(Alert(name="b", symbol="TSLA"))
        self.mgr.add_alert(Alert(name="c", symbol="AAPL"))
        result = self.mgr.list_alerts(symbol="AAPL")
        assert len(result) == 2

    def test_list_by_status(self):
        a1 = Alert(name="active")
        a2 = Alert(name="disabled", status=AlertStatus.DISABLED)
        self.mgr.add_alert(a1)
        self.mgr.add_alert(a2)
        result = self.mgr.list_alerts(status=AlertStatus.ACTIVE)
        assert len(result) == 1

    def test_list_by_type(self):
        a1 = PriceAlertEngine.create_price_above("X", 10)
        a2 = VolumeAlertEngine.create_volume_spike("X", 2)
        self.mgr.add_alert(a1)
        self.mgr.add_alert(a2)
        result = self.mgr.list_alerts(alert_type=AlertType.PRICE_ABOVE)
        assert len(result) == 1

    def test_list_by_tags(self):
        a1 = Alert(name="a", tags=["tech", "earnings"])
        a2 = Alert(name="b", tags=["energy"])
        self.mgr.add_alert(a1)
        self.mgr.add_alert(a2)
        result = self.mgr.list_alerts(tags=["tech"])
        assert len(result) == 1

    def test_count_by_status(self):
        self.mgr.add_alert(Alert(status=AlertStatus.ACTIVE))
        self.mgr.add_alert(Alert(status=AlertStatus.ACTIVE))
        self.mgr.add_alert(Alert(status=AlertStatus.DISABLED))
        counts = self.mgr.count_by_status()
        assert counts["active"] == 2
        assert counts["disabled"] == 1

    def test_enable_disable_all(self):
        a1 = Alert(name="a", symbol="X", status=AlertStatus.DISABLED)
        a2 = Alert(name="b", symbol="X", status=AlertStatus.DISABLED)
        a3 = Alert(name="c", symbol="Y", status=AlertStatus.DISABLED)
        self.mgr.add_alert(a1)
        self.mgr.add_alert(a2)
        self.mgr.add_alert(a3)
        enabled = self.mgr.enable_all(symbol="X")
        assert enabled == 2
        disabled = self.mgr.disable_all(symbol="X")
        assert disabled == 2

    def test_delete_triggered(self):
        a1 = Alert(status=AlertStatus.TRIGGERED)
        a2 = Alert(status=AlertStatus.ACTIVE)
        self.mgr.add_alert(a1)
        self.mgr.add_alert(a2)
        deleted = self.mgr.delete_triggered()
        assert deleted == 1
        assert len(self.mgr.list_alerts()) == 1

    def test_snooze_and_unsnooze(self):
        alert = Alert(name="snooze me")
        aid = self.mgr.add_alert(alert)
        self.mgr.snooze_alert(aid, 0.01)  # 10ms snooze
        assert self.mgr.get_alert(aid).status == AlertStatus.SNOOZED
        time.sleep(0.02)  # wait for snooze to expire
        count = self.mgr.unsnooze_due()
        assert count == 1
        assert self.mgr.get_alert(aid).status == AlertStatus.ACTIVE

    def test_snooze_nonexistent(self):
        assert self.mgr.snooze_alert("nope") is False

    # ── Evaluate ──

    def test_evaluate_price_alerts(self):
        a1 = PriceAlertEngine.create_price_above("AAPL", 150.0)
        a2 = PriceAlertEngine.create_price_above("AAPL", 200.0)
        self.mgr.add_alert(a1)
        self.mgr.add_alert(a2)
        events = self.mgr.evaluate_price_alerts("AAPL", 160.0)
        assert len(events) == 1  # only 150 triggered

    def test_evaluate_volume_alerts(self):
        a = VolumeAlertEngine.create_volume_spike("SPY", 2.0)
        self.mgr.add_alert(a)
        events = self.mgr.evaluate_volume_alerts("SPY", 3_000_000, 1_000_000)
        assert len(events) == 1

    def test_evaluate_indicator_alerts(self):
        a = IndicatorAlertEngine.create_bollinger_touch("AAPL", "upper")
        self.mgr.add_alert(a)
        events = self.mgr.evaluate_indicator_alerts("AAPL", {"bb_position": 1.2})
        assert len(events) == 1

    def test_evaluate_portfolio_alerts(self):
        a = PortfolioAlertEngine.create_drawdown_alert(10.0)
        self.mgr.add_alert(a)
        events = self.mgr.evaluate_portfolio_alerts({"drawdown_pct": 15.0})
        assert len(events) == 1

    def test_evaluate_wrong_symbol(self):
        a = PriceAlertEngine.create_price_above("AAPL", 100.0)
        self.mgr.add_alert(a)
        events = self.mgr.evaluate_price_alerts("TSLA", 200.0)
        assert len(events) == 0

    # ── Notifications ──

    def test_register_and_dispatch(self):
        dispatched = []
        self.mgr.register_handler(NotificationChannel.IN_APP,
                                   lambda e: dispatched.append(e))
        alert = PriceAlertEngine.create_price_above("X", 10.0)
        self.mgr.add_alert(alert)
        events = self.mgr.evaluate_price_alerts("X", 20.0)
        assert len(events) == 1
        channels = self.mgr.dispatch_notification(events[0])
        assert "in_app" in channels
        assert len(dispatched) == 1

    # ── History ──

    def test_triggered_events(self):
        alert = PriceAlertEngine.create_price_above("X", 5.0)
        self.mgr.add_alert(alert)
        self.mgr.evaluate_price_alerts("X", 10.0)
        events = self.mgr.triggered_events()
        assert len(events) == 1

    def test_clear_history(self):
        alert = PriceAlertEngine.create_price_above("X", 5.0)
        self.mgr.add_alert(alert)
        self.mgr.evaluate_price_alerts("X", 10.0)
        cleared = self.mgr.clear_history()
        assert cleared == 1
        assert len(self.mgr.triggered_events()) == 0

    # ── Export / Summary ──

    def test_export_alerts(self):
        self.mgr.add_alert(Alert(name="a"))
        self.mgr.add_alert(Alert(name="b"))
        exported = self.mgr.export_alerts()
        assert len(exported) == 2
        assert "name" in exported[0]

    def test_summary(self):
        self.mgr.add_alert(Alert(name="a", symbol="AAPL"))
        self.mgr.add_alert(Alert(name="b", symbol="TSLA"))
        s = self.mgr.summary()
        assert s["total_alerts"] == 2
        assert s["symbols_monitored"] == 2


# ═══════════════════════════════════════════════════════════════════════════════
# AlertAnalytics
# ═══════════════════════════════════════════════════════════════════════════════

class TestAlertAnalytics:
    def _make_alerts(self):
        alerts = []
        for i in range(5):
            a = Alert(name=f"alert_{i}", alert_type=AlertType.PRICE_ABOVE,
                      symbol="AAPL" if i < 3 else "TSLA")
            if i < 3:
                a.trigger()
            alerts.append(a)
        return alerts

    def test_trigger_rate(self):
        alerts = self._make_alerts()
        stats = AlertAnalytics.trigger_rate(alerts)
        assert stats["triggered"] == 3
        assert stats["total"] == 5
        assert abs(stats["trigger_rate"] - 0.6) < 1e-10

    def test_trigger_rate_empty(self):
        stats = AlertAnalytics.trigger_rate([])
        assert stats["trigger_rate"] == 0.0

    def test_alerts_by_type(self):
        alerts = [
            Alert(alert_type=AlertType.PRICE_ABOVE),
            Alert(alert_type=AlertType.PRICE_ABOVE),
            Alert(alert_type=AlertType.VOLUME_SPIKE),
        ]
        counts = AlertAnalytics.alerts_by_type(alerts)
        assert counts["price_above"] == 2
        assert counts["volume_spike"] == 1

    def test_most_triggered(self):
        alerts = self._make_alerts()
        alerts[0].trigger()  # 2 triggers total
        top = AlertAnalytics.most_triggered(alerts, top_n=2)
        assert len(top) == 2
        assert top[0]["trigger_count"] >= top[1]["trigger_count"]

    def test_trigger_frequency(self):
        events = [
            AlertTriggerEvent("a1", 100.0),
            AlertTriggerEvent("a2", 100.5),
            AlertTriggerEvent("a3", 3700.0),
        ]
        freq = AlertAnalytics.trigger_frequency(events, bucket_seconds=3600)
        assert len(freq) == 2  # two buckets

    def test_trigger_frequency_empty(self):
        assert AlertAnalytics.trigger_frequency([]) == {}

    def test_alert_health(self):
        alerts = [
            Alert(status=AlertStatus.ACTIVE),
            Alert(status=AlertStatus.ACTIVE),
            Alert(status=AlertStatus.DISABLED),
            Alert(status=AlertStatus.EXPIRED),
        ]
        health = AlertAnalytics.alert_health(alerts)
        assert health["active"] == 2
        assert health["disabled"] == 1
        assert health["expired"] == 1
        assert health["total"] == 4
        assert abs(health["health_score"] - 0.5) < 1e-10

    def test_alert_health_empty(self):
        health = AlertAnalytics.alert_health([])
        assert health["total"] == 0
        assert health["health_score"] == 0
