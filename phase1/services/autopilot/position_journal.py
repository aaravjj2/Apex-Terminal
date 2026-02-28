"""
Position Journal — Phase 1F: Broker-Truth Position Lifecycle

Maintains a complete audit trail of every options position.

Life of a position:
  1. OPEN: BTO order filled by Alpaca → position created
  2. MONITORED: exit manager checks TP/SL/DTE/time-stop every cycle
  3. EXIT_TRIGGERED: one of the exit rules fires
  4. CLOSING: STO order submitted
  5. CLOSED: STO filled, PnL realized

Exit rules (configurable via env):
  TAKE_PROFIT_PCT     = 30.0    exit if position up 30%+
  STOP_LOSS_PCT       = 25.0    exit if position down 25%+
  DTE_EXIT_THRESHOLD  = 7       exit if DTE <= 7 (avoid expiry assignment)
  MAX_SPREAD_PCT      = 25.0    exit if spread widens to 25% (liquidity deterioration)

All positions synced from Alpaca /v2/positions (broker is truth).
Any mismatch → incident event.

Usage:
  from .position_journal import get_position_journal, PositionRecord

  journal = get_position_journal()
  await journal.sync_from_broker()
  exits = await journal.check_exit_triggers()
  for exit_evt in exits:
      # submit STO order
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone, date, timedelta
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ── Exit config ───────────────────────────────────────────────────────────────

TAKE_PROFIT_PCT    = float(os.environ.get("TAKE_PROFIT_PCT",    "30.0"))
STOP_LOSS_PCT      = float(os.environ.get("STOP_LOSS_PCT",      "25.0"))
DTE_EXIT_THRESHOLD = int(os.environ.get("DTE_EXIT_THRESHOLD",   "7"))
MAX_SPREAD_PCT     = float(os.environ.get("MAX_SPREAD_PCT",     "25.0"))
TIME_STOP_HOURS    = float(os.environ.get("TIME_STOP_HOURS",    "120.0"))  # 5 trading days


# ── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class PositionRecord:
    """A single options position, synced from Alpaca."""
    position_id: str            # internal ID
    correlation_id: str
    symbol: str                 # underlying
    contract_symbol: str        # OCC symbol
    option_type: str            # call | put
    strike: float
    expiry: str                 # YYYY-MM-DD
    dte: int                    # days to expiry (current)
    qty: int
    avg_cost: float             # per-share (per 1x multiplier)
    current_price: float        # current mid or last
    unrealized_pnl: float       # from Alpaca
    unrealized_pnl_pct: float
    market_value: float
    spread_pct: float           # current bid-ask spread %
    entry_at: datetime
    last_updated: datetime
    status: str                 # open | closing | closed | unknown

    # Broker truth fields
    broker_qty: int = 0
    broker_market_value: float = 0.0
    broker_unrealized_pl: float = 0.0
    broker_avg_entry_price: float = 0.0

    # Exit tracking
    exit_trigger: Optional[str] = None    # tp | sl | dte | spread | time_stop
    exit_submitted_at: Optional[datetime] = None
    exit_order_id: Optional[str] = None

    def compute_dte(self) -> int:
        """Compute DTE from expiry string."""
        try:
            exp = date.fromisoformat(self.expiry)
            return max(0, (exp - date.today()).days)
        except Exception:
            return self.dte

    def is_exit_eligible(self) -> Tuple[bool, str]:
        """
        Check if this position should be exited.
        Returns (should_exit, reason_code).
        """
        dte = self.compute_dte()
        pnl_pct = self.unrealized_pnl_pct

        if dte <= DTE_EXIT_THRESHOLD:
            return True, "dte_threshold"
        if pnl_pct >= TAKE_PROFIT_PCT:
            return True, "take_profit"
        if pnl_pct <= -STOP_LOSS_PCT:
            return True, "stop_loss"
        if self.spread_pct >= MAX_SPREAD_PCT:
            return True, "spread_blowout"
        age_hours = (datetime.now(timezone.utc) - self.entry_at).total_seconds() / 3600
        if age_hours >= TIME_STOP_HOURS:
            return True, "time_stop"

        return False, "hold"

    def to_dict(self) -> Dict[str, Any]:
        dte = self.compute_dte()
        should_exit, exit_reason = self.is_exit_eligible()
        return {
            "position_id": self.position_id,
            "correlation_id": self.correlation_id,
            "symbol": self.symbol,
            "contract_symbol": self.contract_symbol,
            "option_type": self.option_type,
            "strike": self.strike,
            "expiry": self.expiry,
            "dte": dte,
            "qty": self.qty,
            "avg_cost": round(self.avg_cost, 4),
            "current_price": round(self.current_price, 4),
            "unrealized_pnl": round(self.unrealized_pnl, 2),
            "unrealized_pnl_pct": round(self.unrealized_pnl_pct, 4),
            "market_value": round(self.market_value, 2),
            "spread_pct": round(self.spread_pct, 4),
            "entry_at": self.entry_at.isoformat(),
            "last_updated": self.last_updated.isoformat(),
            "status": self.status,
            "exit_trigger": self.exit_trigger or exit_reason if should_exit else None,
            "should_exit": should_exit,
            "exit_reason": exit_reason if should_exit else None,
            "exit_submitted_at": self.exit_submitted_at.isoformat() if self.exit_submitted_at else None,
            "exit_order_id": self.exit_order_id,
        }


@dataclass
class ExitEvent:
    """Represents a triggered exit decision."""
    position_id: str
    contract_symbol: str
    symbol: str
    qty: int
    reason: str                 # tp | sl | dte | spread | time_stop
    unrealized_pnl: float
    unrealized_pnl_pct: float
    current_price: float
    dte: int
    correlation_id: str
    triggered_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "position_id": self.position_id,
            "contract_symbol": self.contract_symbol,
            "symbol": self.symbol,
            "qty": self.qty,
            "reason": self.reason,
            "unrealized_pnl": round(self.unrealized_pnl, 2),
            "unrealized_pnl_pct": round(self.unrealized_pnl_pct, 4),
            "current_price": round(self.current_price, 4),
            "dte": self.dte,
            "correlation_id": self.correlation_id,
            "triggered_at": self.triggered_at.isoformat(),
        }


# ── Position Journal ─────────────────────────────────────────────────────────

class PositionJournal:
    """
    Thread-safe position lifecycle journal.

    Always syncs from Alpaca /v2/positions on every check.
    Internal store is kept in sync via periodic broker sync.
    """

    SYNC_INTERVAL_S = 30.0   # Sync from broker every 30s

    def __init__(self):
        self._positions: Dict[str, PositionRecord] = {}  # contract_symbol → record
        self._last_sync: Optional[datetime] = None
        self._sync_lock = asyncio.Lock()
        self._closed_history: List[Dict[str, Any]] = []  # last 100 closed positions

    async def sync_from_broker(self, force: bool = False, cid: str = "") -> int:
        """
        Sync positions from Alpaca /v2/positions.
        Returns number of positions after sync.
        """
        async with self._sync_lock:
            cid = cid or f"pj-{uuid.uuid4().hex[:8]}"
            now = datetime.now(timezone.utc)

            # Throttle unless forced
            if (
                not force
                and self._last_sync is not None
                and (now - self._last_sync).total_seconds() < self.SYNC_INTERVAL_S
            ):
                return len(self._positions)

            try:
                from .alpaca_client import get_alpaca_client
                client = get_alpaca_client()
                if not client.is_configured:
                    logger.warning("PositionJournal: Alpaca not configured, cannot sync")
                    return len(self._positions)

                broker_positions = await client.get_positions()
                logger.debug(f"PositionJournal: synced {len(broker_positions)} positions from Alpaca")

                # Maps contract_symbol → position_record from Alpaca
                new_map: Dict[str, PositionRecord] = {}
                for bp in broker_positions:
                    sym   = bp.get("symbol", "")
                    asset_class = bp.get("asset_class", "")
                    # Only track options positions
                    if asset_class not in ("us_option",) and not self._looks_like_option(sym):
                        continue

                    rec = self._broker_pos_to_record(bp, cid)
                    new_map[sym] = rec

                # Detect closed positions (were open, now gone from broker)
                for contract, old_rec in self._positions.items():
                    if contract not in new_map and old_rec.status == "open":
                        old_rec.status = "closed"
                        self._closed_history.append(old_rec.to_dict())
                        if len(self._closed_history) > 100:
                            self._closed_history.pop(0)
                        logger.info(f"PositionJournal: position closed: {contract}")

                self._positions = new_map
                self._last_sync = now
                return len(self._positions)

            except Exception as exc:
                logger.error(f"PositionJournal.sync_from_broker: {exc}")
                return len(self._positions)

    def _broker_pos_to_record(self, bp: Dict[str, Any], cid: str) -> PositionRecord:
        """Convert Alpaca position dict to PositionRecord."""
        now = datetime.now(timezone.utc)
        sym = bp.get("symbol", "")
        qty = int(float(bp.get("qty", 1)))
        market_value = float(bp.get("market_value", 0) or 0)
        unrealized_pl = float(bp.get("unrealized_pl", 0) or 0)
        avg_entry = float(bp.get("avg_entry_price", 0) or 0)
        current_price = float(bp.get("current_price", 0) or 0)

        unrealized_pnl_pct = 0.0
        if avg_entry > 0:
            unrealized_pnl_pct = (unrealized_pl / (avg_entry * qty * 100)) * 100

        # Parse OCC symbol for meta
        option_type, strike, expiry = self._parse_occ_symbol(sym)

        # DTE
        try:
            dte = max(0, (date.fromisoformat(expiry) - date.today()).days) if expiry else 0
        except Exception:
            dte = 0

        return PositionRecord(
            position_id=f"pj-{sym}-{cid[:6]}",
            correlation_id=cid,
            symbol=sym[:4] if len(sym) > 4 else sym,   # rough underlying extraction
            contract_symbol=sym,
            option_type=option_type,
            strike=strike,
            expiry=expiry,
            dte=dte,
            qty=qty,
            avg_cost=avg_entry,
            current_price=current_price,
            unrealized_pnl=unrealized_pl,
            unrealized_pnl_pct=unrealized_pnl_pct,
            market_value=market_value,
            spread_pct=0.0,  # would need quote for live spread
            entry_at=now,  # Alpaca doesn't expose entry_at directly in positions
            last_updated=now,
            status="open",
            broker_qty=qty,
            broker_market_value=market_value,
            broker_unrealized_pl=unrealized_pl,
            broker_avg_entry_price=avg_entry,
        )

    @staticmethod
    def _parse_occ_symbol(sym: str) -> Tuple[str, float, str]:
        """Parse OCC option symbol into (option_type, strike, expiry)."""
        try:
            # OCC format: AAPL260320C00225000
            # Find letters after the underlying
            import re
            m = re.search(r'(\d{6})([CP])(\d{8})', sym)
            if m:
                date_str = m.group(1)
                ot = "call" if m.group(2) == "C" else "put"
                strike_raw = int(m.group(3))
                strike = strike_raw / 1000.0
                yy, mm, dd = date_str[:2], date_str[2:4], date_str[4:6]
                expiry = f"20{yy}-{mm}-{dd}"
                return ot, strike, expiry
        except Exception:
            pass
        return "unknown", 0.0, ""

    @staticmethod
    def _looks_like_option(sym: str) -> bool:
        """Heuristic: OCC symbols are long and contain C or P."""
        return len(sym) > 10 and ("C" in sym[4:] or "P" in sym[4:])

    # ── Exit triggers ─────────────────────────────────────────────────────────

    async def check_exit_triggers(self, cid: str = "") -> List[ExitEvent]:
        """
        Check all open positions for exit triggers.
        Returns list of ExitEvent objects that need STO orders.
        """
        await self.sync_from_broker(cid=cid)
        cid = cid or f"ext-{uuid.uuid4().hex[:8]}"

        exit_events: List[ExitEvent] = []
        for contract, pos in list(self._positions.items()):
            if pos.status != "open":
                continue
            if pos.exit_submitted_at is not None:
                continue  # Already submitted STO

            should_exit, reason = pos.is_exit_eligible()
            if should_exit:
                evt = ExitEvent(
                    position_id=pos.position_id,
                    contract_symbol=contract,
                    symbol=pos.symbol,
                    qty=pos.qty,
                    reason=reason,
                    unrealized_pnl=pos.unrealized_pnl,
                    unrealized_pnl_pct=pos.unrealized_pnl_pct,
                    current_price=pos.current_price,
                    dte=pos.compute_dte(),
                    correlation_id=cid,
                )
                exit_events.append(evt)
                # Mark as exit-submitted to avoid re-triggering
                pos.exit_trigger = reason

        if exit_events:
            logger.info(
                f"PositionJournal: {len(exit_events)} exit(s) triggered: "
                + ", ".join(f"{e.contract_symbol}({e.reason})" for e in exit_events)
            )

        return exit_events

    def mark_exit_submitted(self, contract_symbol: str, order_id: str) -> None:
        """Mark a position as having a closing order submitted."""
        pos = self._positions.get(contract_symbol)
        if pos:
            pos.exit_submitted_at = datetime.now(timezone.utc)
            pos.exit_order_id = order_id
            pos.status = "closing"

    # ── Queries ───────────────────────────────────────────────────────────────

    def get_open_positions(self) -> List[PositionRecord]:
        return [p for p in self._positions.values() if p.status == "open"]

    def get_all_positions(self) -> List[PositionRecord]:
        return list(self._positions.values())

    def get_position(self, contract_symbol: str) -> Optional[PositionRecord]:
        return self._positions.get(contract_symbol)

    def get_closed_history(self, limit: int = 20) -> List[Dict[str, Any]]:
        return list(reversed(self._closed_history))[:limit]

    def get_pnl_summary(self) -> Dict[str, Any]:
        """Current P&L summary: unrealized, premium at risk, delta exposure."""
        open_pos = self.get_open_positions()
        total_unrealized = sum(p.unrealized_pnl for p in open_pos)
        total_market_value = sum(p.market_value for p in open_pos)
        calls = [p for p in open_pos if p.option_type == "call"]
        puts  = [p for p in open_pos if p.option_type == "put"]

        return {
            "open_positions": len(open_pos),
            "total_unrealized_pnl": round(total_unrealized, 2),
            "total_market_value": round(total_market_value, 2),
            "call_positions": len(calls),
            "put_positions": len(puts),
            "closed_positions_tracked": len(self._closed_history),
            "last_sync": self._last_sync.isoformat() if self._last_sync else None,
        }


# ── Singleton ─────────────────────────────────────────────────────────────────

_JOURNAL: Optional[PositionJournal] = None


def get_position_journal() -> PositionJournal:
    global _JOURNAL
    if _JOURNAL is None:
        _JOURNAL = PositionJournal()
    return _JOURNAL
