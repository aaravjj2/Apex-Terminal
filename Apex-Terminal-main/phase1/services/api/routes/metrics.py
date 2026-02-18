"""
Metrics API Routes - Observability and performance monitoring.
"""
import time
from datetime import datetime, timedelta
from collections import deque
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(tags=["Metrics"])


# In-memory metrics store (for demo; production would use Redis/Prometheus)
class MetricsStore:
    def __init__(self, max_history: int = 1000):
        self.feed_latencies = deque(maxlen=max_history)
        self.order_latencies = deque(maxlen=max_history)
        self.bar_processing_times = deque(maxlen=max_history)
        self.dropped_messages = 0
        self.ws_messages_received = 0
        self.ws_messages_sent = 0
        self.errors = deque(maxlen=100)
        self.start_time = datetime.utcnow()
    
    def record_feed_latency(self, latency_ms: float):
        self.feed_latencies.append({
            "timestamp": datetime.utcnow().isoformat(),
            "value": latency_ms
        })
    
    def record_order_latency(self, latency_ms: float):
        self.order_latencies.append({
            "timestamp": datetime.utcnow().isoformat(),
            "value": latency_ms
        })
    
    def record_bar_processing(self, duration_ms: float):
        self.bar_processing_times.append({
            "timestamp": datetime.utcnow().isoformat(),
            "value": duration_ms
        })
    
    def record_dropped_message(self):
        self.dropped_messages += 1
    
    def record_ws_in(self):
        self.ws_messages_received += 1
    
    def record_ws_out(self):
        self.ws_messages_sent += 1
    
    def record_error(self, error: str):
        self.errors.append({
            "timestamp": datetime.utcnow().isoformat(),
            "error": error
        })
    
    def get_summary(self) -> dict:
        uptime = (datetime.utcnow() - self.start_time).total_seconds()
        
        def avg(items):
            if not items:
                return 0
            return sum(i["value"] for i in items) / len(items)
        
        return {
            "uptime_seconds": uptime,
            "feed_latency_avg_ms": round(avg(self.feed_latencies), 2),
            "order_latency_avg_ms": round(avg(self.order_latencies), 2),
            "bar_processing_avg_ms": round(avg(self.bar_processing_times), 2),
            "dropped_messages": self.dropped_messages,
            "ws_messages_received": self.ws_messages_received,
            "ws_messages_sent": self.ws_messages_sent,
            "error_count": len(self.errors)
        }


# Singleton
_metrics = MetricsStore()


def get_metrics() -> MetricsStore:
    return _metrics


class MetricsSummary(BaseModel):
    uptime_seconds: float
    feed_latency_avg_ms: float
    order_latency_avg_ms: float
    bar_processing_avg_ms: float
    dropped_messages: int
    ws_messages_received: int
    ws_messages_sent: int
    error_count: int


class LatencyPoint(BaseModel):
    timestamp: str
    value: float


@router.get("/metrics", response_model=MetricsSummary)
async def get_current_metrics():
    """Get current system metrics summary."""
    metrics = get_metrics()
    return metrics.get_summary()


@router.get("/metrics/feed-latency", response_model=List[LatencyPoint])
async def get_feed_latency_history(limit: int = 100):
    """Get feed latency history."""
    metrics = get_metrics()
    return list(metrics.feed_latencies)[-limit:]


@router.get("/metrics/order-latency", response_model=List[LatencyPoint])
async def get_order_latency_history(limit: int = 100):
    """Get order round-trip latency history."""
    metrics = get_metrics()
    return list(metrics.order_latencies)[-limit:]


@router.get("/metrics/bar-processing", response_model=List[LatencyPoint])
async def get_bar_processing_history(limit: int = 100):
    """Get bar processing time history."""
    metrics = get_metrics()
    return list(metrics.bar_processing_times)[-limit:]


@router.get("/metrics/errors")
async def get_recent_errors(limit: int = 50):
    """Get recent errors."""
    metrics = get_metrics()
    return list(metrics.errors)[-limit:]


@router.post("/metrics/record/feed-latency")
async def record_feed_latency(latency_ms: float):
    """Record a feed latency measurement."""
    metrics = get_metrics()
    metrics.record_feed_latency(latency_ms)
    return {"status": "recorded"}


@router.post("/metrics/record/order-latency")
async def record_order_latency(latency_ms: float):
    """Record an order latency measurement."""
    metrics = get_metrics()
    metrics.record_order_latency(latency_ms)
    return {"status": "recorded"}
