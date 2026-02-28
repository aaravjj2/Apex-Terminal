"""
Observability — Wave 19
ES ILM rollover, query performance tracking, system health dashboards,
structured logging, metrics collection.
"""

import time
import logging
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, Any
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict

logger = logging.getLogger(__name__)


class HealthStatus(str, Enum):
    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"


class MetricType(str, Enum):
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"
    TIMER = "timer"


class AlertSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class Metric:
    """A single metric observation."""
    name: str
    metric_type: MetricType
    value: float
    tags: dict = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "type": self.metric_type.value,
            "value": round(self.value, 4),
            "tags": self.tags,
            "timestamp": self.timestamp,
        }


@dataclass
class QueryPerformance:
    """Track ES/DB query performance."""
    query_id: str
    index_or_table: str
    operation: str
    duration_ms: float
    doc_count: int
    success: bool
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "query_id": self.query_id,
            "index_or_table": self.index_or_table,
            "operation": self.operation,
            "duration_ms": round(self.duration_ms, 2),
            "doc_count": self.doc_count,
            "success": self.success,
            "timestamp": self.timestamp,
            "error": self.error,
        }


@dataclass
class SystemHealth:
    """System-wide health snapshot."""
    status: HealthStatus
    services: dict[str, HealthStatus]
    uptime_seconds: float
    es_connected: bool
    broker_connected: bool
    last_ingestion_at: Optional[str] = None
    active_workflows: int = 0
    pending_orders: int = 0
    error_count_1h: int = 0
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        return {
            "status": self.status.value,
            "services": {k: v.value for k, v in self.services.items()},
            "uptime_seconds": round(self.uptime_seconds, 1),
            "es_connected": self.es_connected,
            "broker_connected": self.broker_connected,
            "last_ingestion_at": self.last_ingestion_at,
            "active_workflows": self.active_workflows,
            "pending_orders": self.pending_orders,
            "error_count_1h": self.error_count_1h,
            "timestamp": self.timestamp,
        }


@dataclass
class Alert:
    """Observability alert."""
    alert_id: str
    severity: AlertSeverity
    title: str
    message: str
    source: str
    acknowledged: bool = False
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        return {
            "alert_id": self.alert_id,
            "severity": self.severity.value,
            "title": self.title,
            "message": self.message,
            "source": self.source,
            "acknowledged": self.acknowledged,
            "timestamp": self.timestamp,
        }


@dataclass
class ILMPolicy:
    """Index Lifecycle Management policy."""
    policy_name: str
    hot_max_age: str = "7d"
    hot_max_size: str = "5gb"
    warm_min_age: str = "30d"
    delete_min_age: str = "90d"
    rollover_alias: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "policy_name": self.policy_name,
            "hot_max_age": self.hot_max_age,
            "hot_max_size": self.hot_max_size,
            "warm_min_age": self.warm_min_age,
            "delete_min_age": self.delete_min_age,
            "rollover_alias": self.rollover_alias,
        }


class ObservabilityService:
    """
    Centralized observability: metrics, query perf, health,
    alerts, ILM management.
    """

    def __init__(self):
        self._start_time = time.monotonic()
        self._metrics: list[Metric] = []
        self._queries: list[QueryPerformance] = []
        self._alerts: list[Alert] = []
        self._counters: dict[str, float] = defaultdict(float)
        self._gauges: dict[str, float] = {}
        self._ilm_policies: dict[str, ILMPolicy] = {}

    # --- Metrics ---
    def inc_counter(self, name: str, value: float = 1.0, tags: Optional[dict] = None):
        self._counters[name] += value
        self._metrics.append(Metric(name, MetricType.COUNTER, self._counters[name], tags or {}))

    def set_gauge(self, name: str, value: float, tags: Optional[dict] = None):
        self._gauges[name] = value
        self._metrics.append(Metric(name, MetricType.GAUGE, value, tags or {}))

    def record_timer(self, name: str, duration_ms: float, tags: Optional[dict] = None):
        self._metrics.append(Metric(name, MetricType.TIMER, duration_ms, tags or {}))

    def get_counter(self, name: str) -> float:
        return self._counters.get(name, 0)

    def get_gauge(self, name: str) -> Optional[float]:
        return self._gauges.get(name)

    def get_metrics(self, name: Optional[str] = None, limit: int = 100) -> list[Metric]:
        metrics = self._metrics
        if name:
            metrics = [m for m in metrics if m.name == name]
        return metrics[-limit:]

    # --- Query Performance ---
    def track_query(
        self,
        index_or_table: str,
        operation: str,
        duration_ms: float,
        doc_count: int = 0,
        success: bool = True,
        error: Optional[str] = None,
    ) -> QueryPerformance:
        qid = f"q-{len(self._queries) + 1:06d}"
        qp = QueryPerformance(
            query_id=qid,
            index_or_table=index_or_table,
            operation=operation,
            duration_ms=duration_ms,
            doc_count=doc_count,
            success=success,
            error=error,
        )
        self._queries.append(qp)

        # Auto-alert on slow queries
        if duration_ms > 5000:
            self.raise_alert(
                AlertSeverity.WARNING,
                "Slow Query Detected",
                f"Query on {index_or_table} took {duration_ms:.0f}ms",
                "query_tracker",
            )

        return qp

    def get_query_stats(self, lookback_minutes: int = 60) -> dict:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=lookback_minutes)
        recent = [q for q in self._queries
                  if datetime.fromisoformat(q.timestamp) >= cutoff]

        if not recent:
            return {"total": 0, "avg_ms": 0, "p95_ms": 0, "error_rate": 0}

        durations = sorted([q.duration_ms for q in recent])
        errors = sum(1 for q in recent if not q.success)
        p95_idx = int(len(durations) * 0.95)

        return {
            "total": len(recent),
            "avg_ms": round(sum(durations) / len(durations), 2),
            "p95_ms": round(durations[min(p95_idx, len(durations) - 1)], 2),
            "error_rate": round(errors / len(recent), 4),
            "by_index": dict(defaultdict(int,
                {q.index_or_table: sum(1 for r in recent if r.index_or_table == q.index_or_table)
                 for q in recent})),
        }

    # --- Alerts ---
    def raise_alert(self, severity: AlertSeverity, title: str, message: str, source: str) -> Alert:
        alert = Alert(
            alert_id=f"alert-{len(self._alerts) + 1:06d}",
            severity=severity,
            title=title,
            message=message,
            source=source,
        )
        self._alerts.append(alert)
        logger.warning(f"[ALERT:{severity.value}] {title}: {message}")
        return alert

    def ack_alert(self, alert_id: str) -> bool:
        for a in self._alerts:
            if a.alert_id == alert_id:
                a.acknowledged = True
                return True
        return False

    def get_alerts(self, acknowledged: Optional[bool] = None, limit: int = 50) -> list[Alert]:
        alerts = self._alerts
        if acknowledged is not None:
            alerts = [a for a in alerts if a.acknowledged == acknowledged]
        return alerts[-limit:]

    # --- System Health ---
    def get_health(
        self,
        es_connected: bool = False,
        broker_connected: bool = False,
        last_ingestion_at: Optional[str] = None,
        active_workflows: int = 0,
        pending_orders: int = 0,
    ) -> SystemHealth:
        uptime = time.monotonic() - self._start_time
        cutoff_1h = datetime.now(timezone.utc) - timedelta(hours=1)
        error_count = sum(1 for q in self._queries
                         if not q.success and datetime.fromisoformat(q.timestamp) >= cutoff_1h)

        services = {
            "elasticsearch": HealthStatus.GREEN if es_connected else HealthStatus.RED,
            "broker": HealthStatus.GREEN if broker_connected else HealthStatus.RED,
            "api": HealthStatus.GREEN,
        }

        # Determine overall status
        if HealthStatus.RED in services.values():
            overall = HealthStatus.RED
        elif HealthStatus.YELLOW in services.values() or error_count > 10:
            overall = HealthStatus.YELLOW
        else:
            overall = HealthStatus.GREEN

        return SystemHealth(
            status=overall,
            services=services,
            uptime_seconds=uptime,
            es_connected=es_connected,
            broker_connected=broker_connected,
            last_ingestion_at=last_ingestion_at,
            active_workflows=active_workflows,
            pending_orders=pending_orders,
            error_count_1h=error_count,
        )

    # --- ILM ---
    def register_ilm_policy(self, policy: ILMPolicy):
        self._ilm_policies[policy.policy_name] = policy

    def get_ilm_policies(self) -> list[ILMPolicy]:
        return list(self._ilm_policies.values())

    def get_ilm_status(self) -> dict:
        return {
            "policies": [p.to_dict() for p in self._ilm_policies.values()],
            "total_policies": len(self._ilm_policies),
        }


_service: Optional[ObservabilityService] = None


def get_observability_service() -> ObservabilityService:
    global _service
    if _service is None:
        _service = ObservabilityService()
    return _service
