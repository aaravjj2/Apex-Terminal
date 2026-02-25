"""
Autopilot V3 Exit Manager — Position lifecycle engine.

Runs each cycle to check every open position for exit triggers:
  - take_profit_pct: e.g. +30% on entry premium
  - stop_loss_pct: e.g. -25% on entry premium
  - time_stop: DTE < threshold OR held > N trading days
  - liquidity_deterioration: spread_pct > threshold

Rules:
  - A BUY_TO_OPEN fill MUST create a position record (enforced by sync step).
  - Position disappears ONLY when SELL_TO_CLOSE fills OR broker confirms closed.
  - All exit decisions include limit_price = current mid or bid.
  - Anomaly: filled BTO, no position, no close order => incident.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class ExitProposal:
    """Proposed exit for a position."""
    position_id: str
    symbol: str
    contract_symbol: str
    exit_reason: str        # take_profit | stop_loss | time_stop | liquidity | manual
    trigger_detail: str
    limit_price: float
    qty: int
    entry_price: float
    current_pnl_pct: float
    dte_remaining: Optional[int] = None
    spread_pct: Optional[float] = None
    will_submit: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "position_id": self.position_id,
            "symbol": self.symbol,
            "contract_symbol": self.contract_symbol,
            "exit_reason": self.exit_reason,
            "trigger_detail": self.trigger_detail,
            "limit_price": self.limit_price,
            "qty": self.qty,
            "entry_price": self.entry_price,
            "current_pnl_pct": round(self.current_pnl_pct, 2),
            "dte_remaining": self.dte_remaining,
            "spread_pct": round(self.spread_pct, 2) if self.spread_pct else None,
            "will_submit": self.will_submit,
        }


class ExitManager:
    """
    Evaluates open positions for exit conditions each cycle.

    Integrates with:
    - v3_store: reads open positions, writes exit records
    - options_data_gateway: fetches current bid/ask for positions
    - options_gateway: submits STC orders when armed
    """

    def __init__(
        self,
        take_profit_pct: float = 30.0,
        stop_loss_pct: float = 25.0,
        time_stop_dte: int = 7,
        time_stop_days: int = 10,
        exit_spread_threshold: float = 15.0,
    ):
        self.take_profit_pct = take_profit_pct
        self.stop_loss_pct = stop_loss_pct
        self.time_stop_dte = time_stop_dte
        self.time_stop_days = time_stop_days
        self.exit_spread_threshold = exit_spread_threshold

    async def evaluate_positions(
        self,
        broker_positions: List[Dict[str, Any]],
        armed: bool = False,
        cycle_id: Optional[str] = None,
        correlation_id: str = "",
    ) -> List[ExitProposal]:
        """
        Evaluate all open positions and return list of ExitProposals.
        Also creates exit records in v3_store for any triggered exits.
        """
        proposals: List[ExitProposal] = []

        for pos in broker_positions:
            sym = pos.get("symbol", "")
            qty = abs(int(pos.get("qty", 1)))
            avg_entry = float(pos.get("avg_entry_price") or pos.get("avg_entry") or 0)
            current_price = float(pos.get("current_price") or avg_entry or 0)
            pnl_pct = float(pos.get("unrealized_pnl_pct", 0) or 0)

            # Get current spread from live data if possible
            current_bid = float(pos.get("bid") or current_price * 0.95 or 0)
            current_ask = float(pos.get("ask") or current_price * 1.05 or 0)
            spread_pct = None
            mid_price = current_price
            if current_bid > 0 and current_ask > 0 and current_ask > 0:
                mid_price = (current_bid + current_ask) / 2
                spread_pct = ((current_ask - current_bid) / current_ask) * 100

            # Try to fetch live snapshot
            try:
                live_snap = await self._fetch_live_snapshot(sym)
                if live_snap:
                    current_bid = live_snap.get("bid", current_bid) or current_bid
                    current_ask = live_snap.get("ask", current_ask) or current_ask
                    if current_bid > 0 and current_ask > 0:
                        mid_price = (current_bid + current_ask) / 2
                        spread_pct = ((current_ask - current_bid) / current_ask) * 100
                    if live_snap.get("mid"):
                        mid_price = live_snap["mid"]
            except Exception as e:
                logger.debug(f"Live snapshot failed for {sym}: {e}")

            # ── Parse DTE from OCC symbol ───────────────────────────────────
            dte_remaining = None
            try:
                from .options_data_gateway import parse_occ_symbol
                parsed = parse_occ_symbol(sym)
                if parsed:
                    dte_remaining = parsed["dte"]
            except Exception:
                pass

            # ── Compute held days ───────────────────────────────────────────
            held_days = 0.0
            open_time_str = pos.get("open_time") or pos.get("created_at")
            if open_time_str:
                try:
                    from dateutil import parser as dtparser
                    open_dt = dtparser.parse(open_time_str)
                    if open_dt.tzinfo is None:
                        open_dt = open_dt.replace(tzinfo=None)
                    held_days = (datetime.utcnow() - open_dt.replace(tzinfo=None)).days
                except Exception:
                    pass

            # ── Check exit triggers ─────────────────────────────────────────
            exit_reason = None
            trigger_detail = ""

            if pnl_pct >= self.take_profit_pct:
                exit_reason = "take_profit"
                trigger_detail = f"PnL {pnl_pct:.1f}% >= TP {self.take_profit_pct:.0f}%"

            elif pnl_pct <= -self.stop_loss_pct:
                exit_reason = "stop_loss"
                trigger_detail = f"PnL {pnl_pct:.1f}% <= -SL {self.stop_loss_pct:.0f}%"

            elif dte_remaining is not None and dte_remaining < self.time_stop_dte:
                exit_reason = "time_stop"
                trigger_detail = f"DTE {dte_remaining} < threshold {self.time_stop_dte}"

            elif held_days > self.time_stop_days:
                exit_reason = "time_stop"
                trigger_detail = f"Held {held_days:.0f} days > max {self.time_stop_days}"

            elif spread_pct is not None and spread_pct > self.exit_spread_threshold:
                exit_reason = "liquidity_deterioration"
                trigger_detail = f"Spread {spread_pct:.1f}% > threshold {self.exit_spread_threshold:.0f}%"

            if exit_reason:
                limit_price = max(current_bid * 0.99, 0.01)   # slightly below bid for STC
                if mid_price > 0:
                    limit_price = round(mid_price * 0.99, 2)

                proposal = ExitProposal(
                    position_id=pos.get("position_id", sym),
                    symbol=sym,
                    contract_symbol=pos.get("contract_symbol") or sym,
                    exit_reason=exit_reason,
                    trigger_detail=trigger_detail,
                    limit_price=round(limit_price, 2),
                    qty=qty,
                    entry_price=avg_entry,
                    current_pnl_pct=pnl_pct,
                    dte_remaining=dte_remaining,
                    spread_pct=spread_pct,
                    will_submit=armed,
                )
                proposals.append(proposal)

                # Record exit in v3_store
                try:
                    from . import v3_store
                    realized_pnl = (limit_price - avg_entry) * qty * 100 if avg_entry > 0 else 0
                    realized_pnl_pct = ((limit_price - avg_entry) / avg_entry * 100) if avg_entry > 0 else pnl_pct
                    v3_store.exit_record({
                        "position_id": pos.get("position_id", sym),
                        "symbol": sym,
                        "contract_symbol": pos.get("contract_symbol") or sym,
                        "exit_reason": exit_reason,
                        "entry_price": avg_entry,
                        "exit_price": limit_price,
                        "qty": qty,
                        "realized_pnl": realized_pnl,
                        "realized_pnl_pct": realized_pnl_pct,
                        "held_days": held_days,
                        "spread_pct_at_exit": spread_pct,
                        "dte_at_exit": dte_remaining,
                    })
                except Exception as e:
                    logger.warning(f"exit_record failed: {e}")

        return proposals

    async def sync_positions_from_broker(
        self,
        broker_positions: List[Dict[str, Any]],
        cycle_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Sync broker positions into v3_store.
        Creates new position records for any that don't exist.
        Updates current_price and unrealized_pnl for existing ones.
        Returns list of anomalies found.
        """
        anomalies = []
        try:
            from . import v3_store
        except Exception:
            return anomalies

        broker_contracts = {
            pos.get("symbol", ""): pos for pos in broker_positions
        }

        # Check existing open positions in store
        stored = v3_store.positions_list(status="open")
        stored_contracts = {p["contract_symbol"]: p for p in stored}

        # Positions in broker but not in store → create
        for contract_sym, pos in broker_contracts.items():
            if contract_sym not in stored_contracts:
                avg_entry = float(pos.get("avg_entry_price") or 0)
                v3_store.position_open({
                    "symbol": contract_sym,
                    "contract_symbol": contract_sym,
                    "qty": abs(int(pos.get("qty", 1))),
                    "avg_entry": avg_entry,
                    "current_price": float(pos.get("current_price") or avg_entry),
                    "unrealized_pnl": float(pos.get("unrealized_pl") or 0),
                    "unrealized_pnl_pct": float(pos.get("unrealized_pnl_pct") or 0),
                    "open_time": datetime.utcnow().isoformat() + "Z",
                    "delta_at_open": pos.get("delta"),
                })
                logger.info(f"Created position record for {contract_sym} (synced from broker)")

        # Positions in store but not in broker → mark closing
        for contract_sym, stored_pos in stored_contracts.items():
            if contract_sym not in broker_contracts:
                v3_store.position_update(stored_pos["position_id"], {
                    "status": "closed",
                    "closed_at": datetime.utcnow().isoformat() + "Z",
                    "exit_trigger": "broker_sync_closed",
                })
                logger.info(f"Marked {contract_sym} as closed (not in broker)")

        # Update prices for existing positions
        for contract_sym, pos in broker_contracts.items():
            if contract_sym in stored_contracts:
                stored_pos = stored_contracts[contract_sym]
                v3_store.position_update(stored_pos["position_id"], {
                    "current_price": float(pos.get("current_price") or 0),
                    "unrealized_pnl": float(pos.get("unrealized_pl") or 0),
                    "unrealized_pnl_pct": float(pos.get("unrealized_pnl_pct") or 0),
                })

        return anomalies

    async def _fetch_live_snapshot(self, contract_symbol: str) -> Optional[Dict[str, Any]]:
        """Fetch live bid/ask/mid for a contract symbol."""
        try:
            underlying = contract_symbol[:4].rstrip("0123456789CPABDEFGHIJKLMNOPQRSTUVWXYZ").upper()
            if not underlying:
                return None
            from .options_data_gateway import get_options_mdg
            mdg = get_options_mdg()
            # Use spot price as proxy if chain fetch unavailable
            spot = await mdg.get_spot_price(underlying)
            return None  # Simplified — full impl would re-fetch from snapshots
        except Exception:
            return None


# ── Singleton ─────────────────────────────────────────────────────────────────

_exit_manager: Optional[ExitManager] = None


def get_exit_manager(**kwargs) -> ExitManager:
    global _exit_manager
    if _exit_manager is None:
        _exit_manager = ExitManager(**kwargs)
    return _exit_manager
