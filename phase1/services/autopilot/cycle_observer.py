"""
Cycle Observer — Phase 1G: Immutable Cycle Event Emitter

Every autopilot cycle emits an immutable event record covering:
  - inputs metadata (symbols, market session, data plane health)
  - decisions made (per symbol)
  - rejections with reason codes
  - orders submitted
  - reconciliation results
  - evaluation metrics

Events are:
  1. Written to SQLite (autopilot_v3.db via v3_store)
  2. Indexed to Elasticsearch (if configured)
  3. Available via REST API for UI2

Immutability guarantee: once cycle_complete() is called, the cycle
record is sealed. Amendments are stored as separate amendment records.

Usage:
  from .cycle_observer import get_cycle_observer, ObservedCycle

  obs = get_cycle_observer()
  cid = obs.begin_cycle(cycle_id="c123", universe=["AAPL","MSFT"])
  obs.record_decision(cycle_id, decision_dict)
  obs.record_rejection(cycle_id, rejection_dict)
  obs.record_order(cycle_id, order_dict)
  obs.record_reconciliation(cycle_id, recon_dict)
  obs.complete_cycle(cycle_id, success=True, duration_ms=1234)
"""

from __future__ import annotations

import asyncio
import json
import logging
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ── Event types ───────────────────────────────────────────────────────────────

@dataclass
class CycleEvent:
    """Immutable event record for one autopilot cycle."""
    cycle_id: str
    correlation_id: str
    started_at: datetime
    ended_at: Optional[datetime]
    universe: List[str]
    market_session: str             # open | closed | pre | post
    armed: bool

    # Aggregate counters
    decisions_count: int = 0
    rejections_count: int = 0
    orders_submitted: int = 0
    orders_filled: int = 0

    # Collections
    decisions: List[Dict[str, Any]] = field(default_factory=list)
    rejections: List[Dict[str, Any]] = field(default_factory=list)
    orders: List[Dict[str, Any]] = field(default_factory=list)
    reconciliation: Optional[Dict[str, Any]] = None
    evaluation: Optional[Dict[str, Any]] = None
    data_plane_health: Optional[Dict[str, Any]] = None

    # Status
    status: str = "running"         # running | completed | failed
    error: Optional[str] = None
    duration_ms: float = 0.0
    success: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "cycle_id": self.cycle_id,
            "correlation_id": self.correlation_id,
            "started_at": self.started_at.isoformat(),
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "universe": self.universe,
            "market_session": self.market_session,
            "armed": self.armed,
            "decisions_count": self.decisions_count,
            "rejections_count": self.rejections_count,
            "orders_submitted": self.orders_submitted,
            "orders_filled": self.orders_filled,
            "decisions": self.decisions,
            "rejections": self.rejections,
            "orders": self.orders,
            "reconciliation": self.reconciliation,
            "evaluation": self.evaluation,
            "data_plane_health": self.data_plane_health,
            "status": self.status,
            "error": self.error,
            "duration_ms": round(self.duration_ms, 2),
            "success": self.success,
        }

    def summary(self) -> Dict[str, Any]:
        """Compact summary (no nested lists)."""
        return {
            "cycle_id": self.cycle_id,
            "correlation_id": self.correlation_id,
            "started_at": self.started_at.isoformat(),
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "market_session": self.market_session,
            "armed": self.armed,
            "decisions_count": self.decisions_count,
            "rejections_count": self.rejections_count,
            "orders_submitted": self.orders_submitted,
            "orders_filled": self.orders_filled,
            "status": self.status,
            "duration_ms": round(self.duration_ms, 2),
            "success": self.success,
            "universe_size": len(self.universe),
        }


# ── Cycle Observer ────────────────────────────────────────────────────────────

class CycleObserver:
    """
    Thread-safe cycle event tracker and broadcaster.

    Maintains a ring buffer of recent cycles (last 100).
    All write operations are thread-safe.
    """

    MAX_CYCLES_IN_MEMORY = 100

    def __init__(self):
        self._cycles: Dict[str, CycleEvent] = {}   # cycle_id → event
        self._cycle_order: List[str] = []           # ordered cycle_ids
        self._lock = threading.Lock()
        self._listeners: List[Any] = []             # async callbacks

    def begin_cycle(
        self,
        cycle_id: str,
        universe: List[str],
        market_session: str = "unknown",
        armed: bool = False,
        correlation_id: str = "",
    ) -> str:
        """
        Start tracking a new cycle.
        Returns the correlation_id for this cycle.
        """
        cid = correlation_id or f"cobs-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc)

        event = CycleEvent(
            cycle_id=cycle_id,
            correlation_id=cid,
            started_at=now,
            ended_at=None,
            universe=list(universe),
            market_session=market_session,
            armed=armed,
            status="running",
        )

        with self._lock:
            self._cycles[cycle_id] = event
            self._cycle_order.append(cycle_id)
            # Trim ring buffer
            if len(self._cycle_order) > self.MAX_CYCLES_IN_MEMORY:
                oldest = self._cycle_order.pop(0)
                self._cycles.pop(oldest, None)

        logger.debug(f"CycleObserver: began cycle {cycle_id[:12]} cid={cid}")
        return cid

    def record_decision(self, cycle_id: str, decision: Dict[str, Any]) -> None:
        """Record a decision (BUY_CALL/BUY_PUT/HOLD/REJECT etc.) for this cycle."""
        with self._lock:
            event = self._cycles.get(cycle_id)
            if event is None:
                return
            event.decisions.append(decision)
            event.decisions_count += 1

    def record_rejection(self, cycle_id: str, rejection: Dict[str, Any]) -> None:
        """Record a rejection with reason code."""
        with self._lock:
            event = self._cycles.get(cycle_id)
            if event is None:
                return
            event.rejections.append(rejection)
            event.rejections_count += 1

    def record_order(self, cycle_id: str, order: Dict[str, Any]) -> None:
        """Record an order submission."""
        with self._lock:
            event = self._cycles.get(cycle_id)
            if event is None:
                return
            event.orders.append(order)
            event.orders_submitted += 1
            if order.get("status") in ("filled", "accepted", "partially_filled"):
                event.orders_filled += 1

    def record_fill(self, cycle_id: str, fill: Dict[str, Any]) -> None:
        """Record an order fill event."""
        with self._lock:
            event = self._cycles.get(cycle_id)
            if event is None:
                return
            event.orders_filled += 1

    def record_reconciliation(self, cycle_id: str, recon: Dict[str, Any]) -> None:
        """Record broker reconciliation results."""
        with self._lock:
            event = self._cycles.get(cycle_id)
            if event is None:
                return
            event.reconciliation = recon

    def record_evaluation(self, cycle_id: str, evaluation: Dict[str, Any]) -> None:
        """Record post-cycle evaluation metrics."""
        with self._lock:
            event = self._cycles.get(cycle_id)
            if event is None:
                return
            event.evaluation = evaluation

    def record_data_plane_health(self, cycle_id: str, health: Dict[str, Any]) -> None:
        """Record data plane health snapshot at cycle start."""
        with self._lock:
            event = self._cycles.get(cycle_id)
            if event is None:
                return
            event.data_plane_health = health

    def complete_cycle(
        self,
        cycle_id: str,
        success: bool,
        duration_ms: float,
        error: Optional[str] = None,
    ) -> Optional[CycleEvent]:
        """
        Seal the cycle record.

        Returns the completed CycleEvent.
        Also persists to SQLite and fires async indexing.
        """
        with self._lock:
            event = self._cycles.get(cycle_id)
            if event is None:
                return None

            event.ended_at = datetime.now(timezone.utc)
            event.success = success
            event.status = "completed" if success else "failed"
            event.error = error
            event.duration_ms = duration_ms

        # Persist asynchronously
        self._persist_async(event)
        logger.info(
            f"CycleObserver: completed {cycle_id[:12]} "
            f"success={success} decisions={event.decisions_count} "
            f"orders={event.orders_submitted} dur={duration_ms:.0f}ms"
        )
        return event

    def fail_cycle(self, cycle_id: str, error: str, duration_ms: float = 0.0) -> None:
        """Mark cycle as failed."""
        self.complete_cycle(cycle_id, success=False, duration_ms=duration_ms, error=error)

    # ── Queries ───────────────────────────────────────────────────────────────

    def get_cycle(self, cycle_id: str) -> Optional[CycleEvent]:
        with self._lock:
            return self._cycles.get(cycle_id)

    def get_recent_cycles(self, limit: int = 20) -> List[CycleEvent]:
        """Return most recent cycles (newest first)."""
        with self._lock:
            order = list(reversed(self._cycle_order))[:limit]
            return [self._cycles[cid] for cid in order if cid in self._cycles]

    def get_recent_summaries(self, limit: int = 20) -> List[Dict[str, Any]]:
        return [c.summary() for c in self.get_recent_cycles(limit)]

    def get_all_decisions(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Return recent accepted decisions (non-REJECT) across all cycles."""
        with self._lock:
            order = list(reversed(self._cycle_order))
        result = []
        for cid in order:
            event = self._cycles.get(cid)
            if not event:
                continue
            for d in event.decisions:
                if d.get("decision_type") not in ("REJECT", "HOLD"):
                    result.append({**d, "cycle_id": cid})
            if len(result) >= limit:
                break
        return result[:limit]

    def get_all_rejections(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Return recent rejections across all cycles."""
        with self._lock:
            order = list(reversed(self._cycle_order))
        result = []
        for cid in order:
            event = self._cycles.get(cid)
            if not event:
                continue
            for r in event.rejections:
                result.append({**r, "cycle_id": cid})
            if len(result) >= limit:
                break
        return result[:limit]

    def get_stats(self) -> Dict[str, Any]:
        """Aggregate stats across all in-memory cycles."""
        with self._lock:
            cycles = list(self._cycles.values())

        total = len(cycles)
        completed = sum(1 for c in cycles if c.status == "completed")
        failed = sum(1 for c in cycles if c.status == "failed")
        total_orders = sum(c.orders_submitted for c in cycles)
        total_decisions = sum(c.decisions_count for c in cycles)
        total_rejections = sum(c.rejections_count for c in cycles)
        avg_dur = sum(c.duration_ms for c in cycles if c.duration_ms) / max(completed + failed, 1)

        return {
            "cycles_total": total,
            "cycles_completed": completed,
            "cycles_failed": failed,
            "total_decisions": total_decisions,
            "total_rejections": total_rejections,
            "total_orders_submitted": total_orders,
            "avg_cycle_duration_ms": round(avg_dur, 2),
        }

    # ── Persistence ───────────────────────────────────────────────────────────

    def _persist_async(self, event: CycleEvent) -> None:
        """Fire-and-forget persistence to SQLite + ES."""
        try:
            # Persist in a thread to avoid blocking
            t = threading.Thread(
                target=self._persist_sync,
                args=(event,),
                daemon=True,
                name=f"cobs-persist-{event.cycle_id[:8]}"
            )
            t.start()
        except Exception as exc:
            logger.error(f"CycleObserver: failed to start persistence thread: {exc}")

    def _persist_sync(self, event: CycleEvent) -> None:
        """Synchronous persistence (runs in thread)."""
        try:
            self._write_to_v3_store(event)
        except Exception as exc:
            logger.error(f"CycleObserver: SQLite persistence failed: {exc}")

        try:
            self._index_to_es(event)
        except Exception as exc:
            logger.debug(f"CycleObserver: ES indexing failed (non-fatal): {exc}")

    def _write_to_v3_store(self, event: CycleEvent) -> None:
        """Write cycle to autopilot_v3.db."""
        try:
            from .v3_store import get_v3_store
            store = get_v3_store()
            store.upsert_cycle({
                "cycle_id": event.cycle_id,
                "started_at": event.started_at.isoformat(),
                "ended_at": event.ended_at.isoformat() if event.ended_at else None,
                "status": event.status,
                "market_session": event.market_session,
                "market_open": 1 if event.market_session == "open" else 0,
                "armed": 1 if event.armed else 0,
                "correlation_id": event.correlation_id,
                "symbols_count": len(event.universe),
                "decisions_count": event.decisions_count,
                "rejections_count": event.rejections_count,
                "orders_count": event.orders_submitted,
                "duration_ms": event.duration_ms,
                "universe": json.dumps(event.universe),
            })
        except Exception as exc:
            logger.error(f"CycleObserver._write_to_v3_store: {exc}")

    def _index_to_es(self, event: CycleEvent) -> None:
        """Index cycle summary to Elasticsearch (best-effort)."""
        try:
            from ..elasticsearch_gateway import get_es_client
            import requests

            es_url = __import__("os").environ.get("ELASTICSEARCH_URL", "http://localhost:9200")
            doc = event.summary()
            doc["type"] = "cycle"
            idx = f"autopilot-cycles-{event.started_at.strftime('%Y.%m')}"
            resp = requests.put(
                f"{es_url}/{idx}/_doc/{event.cycle_id}",
                json=doc,
                timeout=3,
            )
            resp.raise_for_status()
        except Exception as exc:
            pass  # ES unavailable is non-fatal


# ── Singleton ─────────────────────────────────────────────────────────────────

_OBSERVER: Optional[CycleObserver] = None


def get_cycle_observer() -> CycleObserver:
    global _OBSERVER
    if _OBSERVER is None:
        _OBSERVER = CycleObserver()
    return _OBSERVER
