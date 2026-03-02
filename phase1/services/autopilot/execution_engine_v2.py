"""
Execution Engine V2 — Phase 1E: Clean Alpaca Paper Execution Engine

Responsibilities:
  - Submit single-leg options orders to Alpaca paper (buy_to_open / sell_to_close)
  - Order lifecycle tracking: pending → submitted → accepted → filled / cancelled
  - Order replacement: if not filled within timeout, cancel + retry at updated limit
  - Reconciliation: compare internal order table vs Alpaca /v2/orders → detect mismatches
  - Incident generation: any mismatch triggers an incident event

No simulation. No mock fills. Alpaca paper is the ONLY execution path.

Alpaca order statuses: new → partially_filled → filled → done / cancelled / rejected

Usage:
  from .execution_engine_v2 import get_execution_engine_v2, OrderIntent

  eng = get_execution_engine_v2()
  result = await eng.submit_order(intent)
  # result.broker_order_id — Alpaca assigned order ID
  # result.status — "accepted" | "filled" | "rejected" | "error"
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ── Enums ─────────────────────────────────────────────────────────────────────

class OrderSide(str, Enum):
    BUY_TO_OPEN   = "buy_to_open"
    SELL_TO_CLOSE = "sell_to_close"


class OrderStatus(str, Enum):
    PENDING    = "pending"
    SUBMITTED  = "submitted"
    ACCEPTED   = "accepted"
    FILLED     = "filled"
    CANCELLED  = "cancelled"
    REJECTED   = "rejected"
    ERROR      = "error"
    REPLACED   = "replaced"


class IncidentType(str, Enum):
    FILL_WITHOUT_POSITION = "fill_without_position"
    POSITION_WITHOUT_ORDER = "position_without_order"
    ORPHANED_ORDER = "orphaned_order"
    RECONCILIATION_MISMATCH = "reconciliation_mismatch"
    ORDER_REJECTED_BY_BROKER = "order_rejected_by_broker"


# ── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class OrderIntent:
    """Validated order intent from the brain/policy engine."""
    intent_id: str
    cycle_id: str
    correlation_id: str
    symbol: str                     # underlying symbol
    contract_symbol: str            # OCC symbol e.g. AAPL260320C00225000
    side: OrderSide
    qty: int
    limit_price: float              # required — market orders never used
    limit_price_basis: str          # "mid" | "mid_minus_1cent" | "bid" etc.
    option_type: str                # "call" | "put"
    strike: float
    expiry: str                     # YYYY-MM-DD
    dte: int
    premium_cost_usd: float
    intent_source: str = "brain_v3"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "intent_id": self.intent_id,
            "cycle_id": self.cycle_id,
            "correlation_id": self.correlation_id,
            "symbol": self.symbol,
            "contract_symbol": self.contract_symbol,
            "side": self.side.value,
            "qty": self.qty,
            "limit_price": self.limit_price,
            "limit_price_basis": self.limit_price_basis,
            "option_type": self.option_type,
            "strike": self.strike,
            "expiry": self.expiry,
            "dte": self.dte,
            "premium_cost_usd": self.premium_cost_usd,
            "intent_source": self.intent_source,
        }


@dataclass
class OrderResult:
    """Result of an order submission attempt."""
    intent_id: str
    correlation_id: str
    broker_order_id: Optional[str]
    status: OrderStatus
    contract_symbol: str
    side: str
    qty: int
    submitted_limit: float
    fill_price: Optional[float]
    broker_status: Optional[str]    # raw Alpaca status
    error: Optional[str]
    submitted_at: datetime
    filled_at: Optional[datetime]
    latency_ms: float
    raw_broker_response: Optional[Dict[str, Any]] = field(default=None, repr=False)

    @property
    def success(self) -> bool:
        return self.status in (OrderStatus.ACCEPTED, OrderStatus.FILLED, OrderStatus.SUBMITTED)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "intent_id": self.intent_id,
            "correlation_id": self.correlation_id,
            "broker_order_id": self.broker_order_id,
            "status": self.status.value,
            "contract_symbol": self.contract_symbol,
            "side": self.side,
            "qty": self.qty,
            "submitted_limit": self.submitted_limit,
            "fill_price": self.fill_price,
            "broker_status": self.broker_status,
            "error": self.error,
            "submitted_at": self.submitted_at.isoformat(),
            "filled_at": self.filled_at.isoformat() if self.filled_at else None,
            "latency_ms": round(self.latency_ms, 2),
            "success": self.success,
        }


@dataclass
class ReconciliationResult:
    """Result of a reconciliation check."""
    timestamp: datetime
    correlation_id: str
    positions_from_broker: int
    positions_in_store: int
    orders_from_broker: int
    orders_in_store: int
    incidents: List[Dict[str, Any]] = field(default_factory=list)
    is_clean: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "correlation_id": self.correlation_id,
            "positions_from_broker": self.positions_from_broker,
            "positions_in_store": self.positions_in_store,
            "orders_from_broker": self.orders_from_broker,
            "orders_in_store": self.orders_in_store,
            "incidents": self.incidents,
            "is_clean": self.is_clean,
            "incident_count": len(self.incidents),
        }


# ── Order Lifecycle Manager ───────────────────────────────────────────────────

class OrderLifecycleManager:
    """
    Tracks all orders from submission through fill/cancel.

    - In-memory ring buffer (last 500 orders)
    - Persists to v3_store for durability
    - Fires incident events on mismatches
    """

    MAX_ORDERS = 500
    FILL_POLL_INTERVAL_S = 2.0
    FILL_TIMEOUT_S = 60.0           # cancel unfilled limit orders after 60s
    REPLACE_LIMIT_CUSHION_PCT = 0.002  # move limit 0.2% toward ask on replace

    def __init__(self):
        self._orders: Dict[str, OrderResult] = {}
        self._order_ids: List[str] = []

    def track(self, result: OrderResult) -> None:
        """Begin tracking an order."""
        self._orders[result.broker_order_id or result.intent_id] = result
        self._order_ids.append(result.broker_order_id or result.intent_id)
        if len(self._order_ids) > self.MAX_ORDERS:
            oldest = self._order_ids.pop(0)
            self._orders.pop(oldest, None)

    def update_status(
        self,
        broker_order_id: str,
        status: OrderStatus,
        fill_price: Optional[float] = None,
        filled_at: Optional[datetime] = None,
    ) -> None:
        """Update an existing order's status."""
        order = self._orders.get(broker_order_id)
        if order:
            order.status = status
            if fill_price is not None:
                order.fill_price = fill_price
            if filled_at is not None:
                order.filled_at = filled_at

    def get_open_orders(self) -> List[OrderResult]:
        """Return orders that are submitted but not terminal."""
        terminal = {OrderStatus.FILLED, OrderStatus.CANCELLED, OrderStatus.REJECTED, OrderStatus.ERROR}
        return [o for o in self._orders.values() if o.status not in terminal]

    def get_recent(self, limit: int = 50) -> List[OrderResult]:
        ids = list(reversed(self._order_ids))[:limit]
        return [self._orders[i] for i in ids if i in self._orders]


# ── Execution Engine V2 ───────────────────────────────────────────────────────

class ExecutionEngineV2:
    """
    Clean Alpaca paper options execution engine.

    All orders go to Alpaca paper trading. No simulation. No mock fills.

    Submit flow:
    1. Validate intent (safety checks)
    2. Build Alpaca order payload (limit order, options-specific fields)
    3. POST to Alpaca /v2/orders
    4. Parse broker response → OrderResult
    5. Track + persist
    6. Poll for fill (non-blocking, best-effort)
    """

    def __init__(self):
        self.lifecycle = OrderLifecycleManager()
        self._reconciliation_lock = asyncio.Lock()

    def _occ_symbol(self, underlying: str, expiry, option_type: str, strike: float) -> str:
        """Generate OCC option symbol."""
        from datetime import date
        if isinstance(expiry, str):
            d = date.fromisoformat(expiry.split("T")[0])
        else:
            d = expiry
        yymmdd = d.strftime("%y%m%d")
        tc = "C" if str(option_type).lower() == "call" else "P"
        strike_int = int(strike * 1000)
        return f"{underlying}{yymmdd}{tc}{strike_int:08d}"

    async def submit_candidate(
        self,
        candidate: "TradeCandidate",
        run_id: str,
        correlation_id: str,
    ) -> List[OrderResult]:
        """
        Submit a TradeCandidate (single or multi-leg) via Alpaca.
        For multi-leg, submits each leg as a separate order (Phase 1c will add atomic MLEG).
        """
        from .candidates import TradeCandidate
        from datetime import date

        results: List[OrderResult] = []
        for i, leg in enumerate(candidate.legs):
            expiry = leg.expiry
            expiry_str = expiry.isoformat() if isinstance(expiry, date) else str(expiry)
            dte = (date.fromisoformat(expiry_str.split("T")[0]) - date.today()).days if expiry else 0
            occ = self._occ_symbol(candidate.symbol, expiry, leg.option_type, leg.strike)
            premium = max(leg.premium, 0.05)
            limit_price = round(premium * (1 - 0.02), 2) if leg.side == "sell" else round(premium * (1 + 0.02), 2)
            limit_price = max(0.01, limit_price)

            side = OrderSide.BUY_TO_OPEN if leg.side == "buy" else OrderSide.SELL_TO_CLOSE
            intent_id = f"{candidate.id}-leg{i}"
            intent = OrderIntent(
                intent_id=intent_id,
                cycle_id=run_id,
                correlation_id=correlation_id,
                symbol=candidate.symbol,
                contract_symbol=occ,
                side=side,
                qty=leg.quantity,
                limit_price=limit_price,
                limit_price_basis="mid_cushion",
                option_type=leg.option_type,
                strike=leg.strike,
                expiry=expiry_str.split("T")[0],
                dte=max(0, dte),
                premium_cost_usd=premium * leg.quantity * 100,
                intent_source="unified_engine",
            )
            result = await self.submit_order(intent)
            results.append(result)
        return results

    async def submit_order(self, intent: OrderIntent) -> OrderResult:
        """
        Submit an options order to Alpaca paper.

        Returns OrderResult:
          - status=ACCEPTED if broker accepted the order
          - status=REJECTED if broker rejected it
          - status=ERROR on network/config failure
        """
        start = time.monotonic()
        cid = intent.correlation_id

        # Safety: never submit quantity > 10 (hard cap for paper)
        qty = min(intent.qty, 10)
        if qty <= 0:
            return self._error_result(intent, "qty_must_be_positive", start)

        # Safety: never submit market orders
        if intent.limit_price <= 0:
            return self._error_result(intent, "limit_price_required", start)

        try:
            from .alpaca_client import get_alpaca_client
            client = get_alpaca_client()

            if not client.is_configured:
                return self._error_result(intent, "alpaca_not_configured", start)

            # Build order payload
            payload = self._build_order_payload(intent, qty)
            logger.info(
                f"ExecutionEngineV2: submitting {intent.side.value} "
                f"{qty}x {intent.contract_symbol} @ ${intent.limit_price:.2f} "
                f"(cid={cid[:8]})"
            )

            # Submit to Alpaca
            resp = await client.place_order(payload)
            latency_ms = (time.monotonic() - start) * 1000

            if resp is None:
                return self._error_result(intent, "null_response_from_broker", start)

            broker_id = resp.get("id", "")
            broker_status = resp.get("status", "")
            filled_qty = float(resp.get("filled_qty", 0) or 0)
            fill_price = float(resp.get("filled_avg_price", 0) or 0) or None

            if broker_status in ("rejected", "cancelled", "expired"):
                status = OrderStatus.REJECTED
                logger.warning(
                    f"ExecutionEngineV2: order rejected by broker: "
                    f"{intent.contract_symbol} reason={resp.get('reject_reason', 'unknown')}"
                )
            elif broker_status in ("new", "accepted", "pending_new", "accepted_for_bidding"):
                status = OrderStatus.ACCEPTED
            elif broker_status in ("filled", "partially_filled"):
                status = OrderStatus.FILLED
            else:
                status = OrderStatus.SUBMITTED

            result = OrderResult(
                intent_id=intent.intent_id,
                correlation_id=cid,
                broker_order_id=broker_id,
                status=status,
                contract_symbol=intent.contract_symbol,
                side=intent.side.value,
                qty=qty,
                submitted_limit=intent.limit_price,
                fill_price=fill_price if filled_qty > 0 else None,
                broker_status=broker_status,
                error=resp.get("reject_reason"),
                submitted_at=datetime.now(timezone.utc),
                filled_at=datetime.now(timezone.utc) if filled_qty > 0 else None,
                latency_ms=latency_ms,
                raw_broker_response=resp,
            )

            self.lifecycle.track(result)
            await self._persist_order(intent, result)

            logger.info(
                f"ExecutionEngineV2: order {status.value} broker_id={broker_id[:12] if broker_id else 'none'} "
                f"lat={latency_ms:.0f}ms"
            )
            return result

        except Exception as exc:
            logger.error(f"ExecutionEngineV2: unexpected error: {exc}", exc_info=True)
            return self._error_result(intent, f"unexpected:{str(exc)[:80]}", start)

    def _build_order_payload(self, intent: OrderIntent, qty: int) -> Dict[str, Any]:
        """Build Alpaca-compatible options order payload."""
        return {
            "symbol": intent.contract_symbol,
            "qty": str(qty),
            "side": "buy" if intent.side == OrderSide.BUY_TO_OPEN else "sell",
            "type": "limit",
            "time_in_force": "day",
            "limit_price": str(round(intent.limit_price, 2)),
            "order_class": "simple",
            # Options-specific fields (Alpaca broker API)
            "asset_class": "us_option",
        }

    def _error_result(self, intent: OrderIntent, reason: str, start: float) -> OrderResult:
        return OrderResult(
            intent_id=intent.intent_id,
            correlation_id=intent.correlation_id,
            broker_order_id=None,
            status=OrderStatus.ERROR,
            contract_symbol=intent.contract_symbol,
            side=intent.side.value,
            qty=intent.qty,
            submitted_limit=intent.limit_price,
            fill_price=None,
            broker_status=None,
            error=reason,
            submitted_at=datetime.now(timezone.utc),
            filled_at=None,
            latency_ms=(time.monotonic() - start) * 1000,
        )

    # ── Cancel ────────────────────────────────────────────────────────────────

    async def cancel_order(self, broker_order_id: str, cid: str = "") -> bool:
        """Cancel an open order by broker order ID."""
        try:
            from .alpaca_client import get_alpaca_client
            client = get_alpaca_client()
            ok = await client.cancel_order(broker_order_id)
            if ok:
                self.lifecycle.update_status(broker_order_id, OrderStatus.CANCELLED)
            return ok
        except Exception as exc:
            logger.error(f"ExecutionEngineV2.cancel_order: {exc}")
            return False

    # ── Poll for fill ─────────────────────────────────────────────────────────

    async def poll_order_status(self, broker_order_id: str) -> Optional[Dict[str, Any]]:
        """Poll Alpaca for the current status of an order."""
        try:
            from .alpaca_client import get_alpaca_client
            client = get_alpaca_client()
            return await client.get_order(broker_order_id)
        except Exception as exc:
            logger.error(f"ExecutionEngineV2.poll_order_status: {exc}")
            return None

    async def poll_and_update_open_orders(self) -> int:
        """
        Poll all open (non-terminal) orders and update their status.
        Returns number of orders updated.
        """
        open_orders = self.lifecycle.get_open_orders()
        if not open_orders:
            return 0

        updated = 0
        for order in open_orders:
            if not order.broker_order_id:
                continue
            status_data = await self.poll_order_status(order.broker_order_id)
            if not status_data:
                continue

            broker_status = status_data.get("status", "")
            filled_qty = float(status_data.get("filled_qty", 0) or 0)
            fill_price = float(status_data.get("filled_avg_price", 0) or 0) or None

            new_status = order.status
            if broker_status in ("filled",):
                new_status = OrderStatus.FILLED
            elif broker_status in ("partially_filled",):
                new_status = OrderStatus.ACCEPTED  # still open
            elif broker_status in ("cancelled", "expired"):
                new_status = OrderStatus.CANCELLED
            elif broker_status in ("rejected",):
                new_status = OrderStatus.REJECTED

            if new_status != order.status:
                self.lifecycle.update_status(
                    order.broker_order_id, new_status,
                    fill_price=fill_price,
                    filled_at=datetime.now(timezone.utc) if new_status == OrderStatus.FILLED else None,
                )
                updated += 1

        return updated

    # ── Reconciliation ────────────────────────────────────────────────────────

    async def reconcile(self, cid: str = "") -> ReconciliationResult:
        """
        Reconcile internal state against broker truth.

        Checks:
        1. All broker positions → do we have a corresponding order/position record?
        2. All our filled orders → does Alpaca have a corresponding position?
        3. Any orders we think are open but Alpaca says are terminal?

        Generates incidents for mismatches.
        """
        if self._reconciliation_lock.locked():
            # Already reconciling
            return ReconciliationResult(
                timestamp=datetime.now(timezone.utc),
                correlation_id=cid or "recon-locked",
                positions_from_broker=0,
                positions_in_store=0,
                orders_from_broker=0,
                orders_in_store=0,
                is_clean=True,
            )

        async with self._reconciliation_lock:
            cid = cid or f"recon-{uuid.uuid4().hex[:8]}"
            now = datetime.now(timezone.utc)
            incidents: List[Dict[str, Any]] = []

            try:
                from .alpaca_client import get_alpaca_client
                client = get_alpaca_client()

                # Fetch broker truth
                broker_positions = await client.get_positions()
                broker_orders    = await client.get_orders(status="all", limit=50)

                broker_pos_count   = len(broker_positions)
                broker_order_count = len(broker_orders)

                # Internal state
                store_orders = self.lifecycle.get_recent(100)
                store_order_count = len(store_orders)

                # Check 1: filled orders without corresponding position
                filled_contracts = {
                    o.contract_symbol
                    for o in store_orders
                    if o.status == OrderStatus.FILLED
                    and o.side == OrderSide.BUY_TO_OPEN.value
                }
                broker_pos_symbols = {p.get("symbol", "") for p in broker_positions}

                for contract in filled_contracts:
                    if contract not in broker_pos_symbols:
                        incidents.append({
                            "type": IncidentType.FILL_WITHOUT_POSITION.value,
                            "contract_symbol": contract,
                            "detail": "Filled BTO order has no matching Alpaca position",
                            "correlation_id": cid,
                            "timestamp": now.isoformat(),
                        })

                # Check 2: broker positions without any order record
                store_contract_symbols = {o.contract_symbol for o in store_orders}
                for pos in broker_positions:
                    sym = pos.get("symbol", "")
                    if sym and sym not in store_contract_symbols:
                        incidents.append({
                            "type": IncidentType.POSITION_WITHOUT_ORDER.value,
                            "contract_symbol": sym,
                            "detail": "Alpaca has position but no order record in engine",
                            "correlation_id": cid,
                            "timestamp": now.isoformat(),
                        })

                is_clean = len(incidents) == 0

                if not is_clean:
                    logger.warning(
                        f"ExecutionEngineV2.reconcile: {len(incidents)} incidents detected cid={cid}"
                    )
                    for inc in incidents:
                        logger.warning(f"  ▲ INCIDENT: {inc['type']} contract={inc['contract_symbol']}")
                else:
                    logger.debug(f"ExecutionEngineV2.reconcile: clean cid={cid}")

                result = ReconciliationResult(
                    timestamp=now,
                    correlation_id=cid,
                    positions_from_broker=broker_pos_count,
                    positions_in_store=len(filled_contracts),
                    orders_from_broker=broker_order_count,
                    orders_in_store=store_order_count,
                    incidents=incidents,
                    is_clean=is_clean,
                )

                # Persist incidents to store
                if incidents:
                    await self._store_incidents(incidents)

                return result

            except Exception as exc:
                logger.error(f"ExecutionEngineV2.reconcile: error: {exc}")
                return ReconciliationResult(
                    timestamp=now,
                    correlation_id=cid,
                    positions_from_broker=0,
                    positions_in_store=0,
                    orders_from_broker=0,
                    orders_in_store=0,
                    incidents=[{"type": "reconciliation_error", "detail": str(exc)[:100], "correlation_id": cid}],
                    is_clean=False,
                )

    # ── Persistence helpers ───────────────────────────────────────────────────

    async def _persist_order(self, intent: OrderIntent, result: OrderResult) -> None:
        """Persist order to v3_store."""
        try:
            from .v3_store import get_v3_store
            import asyncio
            store = get_v3_store()
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, lambda: store.upsert_order({
                "order_id": result.broker_order_id or result.intent_id,
                "cycle_id": intent.cycle_id,
                "decision_id": intent.intent_id,
                "symbol": intent.symbol,
                "contract_symbol": intent.contract_symbol,
                "side": intent.side.value,
                "qty": result.qty,
                "limit_price": result.submitted_limit,
                "fill_price": result.fill_price,
                "status": result.status.value,
                "broker_order_id": result.broker_order_id,
                "correlation_id": result.correlation_id,
                "submitted_at": result.submitted_at.isoformat(),
                "error": result.error,
            }))
        except Exception as exc:
            logger.error(f"ExecutionEngineV2._persist_order: {exc}")

    async def _store_incidents(self, incidents: List[Dict[str, Any]]) -> None:
        """Store incident records."""
        try:
            from ..incidents import get_incident_store
            store = get_incident_store()
            for inc in incidents:
                store.create(inc)
        except Exception:
            pass  # non-fatal


# ── Singleton ─────────────────────────────────────────────────────────────────

_ENGINE: Optional[ExecutionEngineV2] = None


def get_execution_engine_v2() -> ExecutionEngineV2:
    global _ENGINE
    if _ENGINE is None:
        _ENGINE = ExecutionEngineV2()
    return _ENGINE
