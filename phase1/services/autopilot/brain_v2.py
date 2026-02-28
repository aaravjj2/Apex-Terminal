"""
Autopilot Brain v2 — Ruled + Explainable Decision Engine.

Architecture:
  1. Market session gate (hard: market must be open to generate decisions)
  2. Kill switch gate (hard: immediately halt)
  3. Per-symbol chain fetch via OptionsMarketDataGateway (correct endpoint)
  4. Contract scoring via ContractScorer
  5. Position lifecycle check (exit logic for existing positions)
  6. Risk gate (position count limit, premium cap, daily loss cap)
  7. Decision: BUY_CALL / BUY_PUT / EXIT / HOLD / REJECT
  8. Anomaly detection (filled BTO but no position and no close order)

Decision Output (DecisionV2):
  - decision_type: str
  - contract_symbol: str
  - score: float
  - spread_pct: float
  - dte: int
  - delta: float | None
  - confidence: float (deterministic from feature weights)
  - limit_price_rule: str (e.g. "mid", "mid*1.01")
  - limit_price: float
  - risk_checks: dict (pass/fail per check)
  - feature_contributions: list of {name, value, contribution} dicts
  - explanation: str (non-LLM, from features)
  - candidates_count: int  (how many candidates were scored)
  - candidates_accepted_count: int

Position Exit Logic:
  - take_profit_pct: +30% on entry premium
  - stop_loss_pct: -25% on entry premium (absolute)
  - time_stop_dte: exit when DTE < 7

Anomaly Detection:
  - After cycle: if any BTO order is filled but corresponding position doesn't exist
    and no close order found => emit incident
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def _cid() -> str:
    return f"br2-{uuid.uuid4().hex[:8]}"


# ── Brain Config ──────────────────────────────────────────────────────────────

@dataclass
class BrainConfig:
    # Scoring / selection
    dte_min: int = 14
    dte_max: int = 45
    strike_pct_range: float = 0.15     # ±15% of spot for chain fetch
    target_delta: float = 0.45         # ATM-ish
    max_spread_pct: float = 8.0        # hard liquidity rule
    min_premium: float = 0.15          # min contract mid price

    # Risk caps
    max_premium_risk_usd: float = 500.0    # per trade (1 contract = 100 shares); ATM options naturally cost $300-$800
    max_concurrent_positions: int = 4
    max_notional_usd: float = 5000.0
    max_daily_loss_usd: float = 200.0

    # Position lifecycle
    take_profit_pct: float = 30.0      # +30% on entry premium
    stop_loss_pct: float = 25.0        # -25% on entry premium
    time_stop_dte: int = 7             # exit when DTE < 7

    # Limit price rule
    limit_price_rule: str = "mid"      # "mid" | "mid*1.01" | "ask"


DEFAULT_BRAIN_CONFIG = BrainConfig()


# ── Decision Data Models ──────────────────────────────────────────────────────

@dataclass
class FeatureContribution:
    name: str
    value: Any
    contribution: str   # human-readable, e.g. "+15% confidence"
    pass_fail: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "value": self.value,
            "contribution": self.contribution,
            "pass_fail": self.pass_fail,
        }


@dataclass
class RiskCheck:
    name: str
    passed: bool
    value: Any
    limit: Any
    message: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "passed": self.passed,
            "value": self.value,
            "limit": self.limit,
            "message": self.message,
        }


@dataclass
class DecisionV2:
    decision_id: str
    symbol: str
    timestamp: str
    decision_type: str          # BUY_CALL / BUY_PUT / EXIT / HOLD / REJECT

    # Contract info (populated if decision_type != REJECT/HOLD)
    contract_symbol: Optional[str] = None
    option_type: Optional[str] = None
    strike: Optional[float] = None
    expiry: Optional[str] = None
    dte: Optional[int] = None
    bid: Optional[float] = None
    ask: Optional[float] = None
    mid: Optional[float] = None
    spread_pct: Optional[float] = None
    delta: Optional[float] = None
    iv: Optional[float] = None
    score: Optional[float] = None

    # Order
    limit_price: Optional[float] = None
    limit_price_rule: str = "mid"
    qty: int = 1
    side: str = "buy"

    # Risk + scoring context
    candidates_count: int = 0
    candidates_accepted: int = 0
    premium_cost_usd: float = 0.0
    confidence: float = 0.0

    # Feature breakdown (non-LLM)
    feature_contributions: List[FeatureContribution] = field(default_factory=list)
    risk_checks: List[RiskCheck] = field(default_factory=list)
    explanation: str = ""

    # Execution flags
    armed: bool = False
    market_open: bool = False
    will_submit: bool = False

    # Rejection reason (when REJECT)
    rejection_reason: Optional[str] = None
    rejection_detail: Optional[str] = None

    correlation_id: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "decision_id": self.decision_id,
            "symbol": self.symbol,
            "timestamp": self.timestamp,
            "decision_type": self.decision_type,
            "contract": {
                "contract_symbol": self.contract_symbol,
                "option_type": self.option_type,
                "strike": self.strike,
                "expiry": self.expiry,
                "dte": self.dte,
                "bid": self.bid,
                "ask": self.ask,
                "mid": self.mid,
                "spread_pct": self.spread_pct,
                "delta": self.delta,
                "iv": self.iv,
                "score": self.score,
            } if self.contract_symbol else None,
            "order": {
                "limit_price": self.limit_price,
                "limit_price_rule": self.limit_price_rule,
                "qty": self.qty,
                "side": self.side,
            } if self.limit_price else None,
            "candidates_count": self.candidates_count,
            "candidates_accepted": self.candidates_accepted,
            "premium_cost_usd": self.premium_cost_usd,
            "confidence": self.confidence,
            "feature_contributions": [f.to_dict() for f in self.feature_contributions],
            "risk_checks": [r.to_dict() for r in self.risk_checks],
            "explanation": self.explanation,
            "armed": self.armed,
            "market_open": self.market_open,
            "will_submit": self.will_submit,
            "rejection_reason": self.rejection_reason,
            "rejection_detail": self.rejection_detail,
            "correlation_id": self.correlation_id,
        }


@dataclass
class RejectionV2:
    decision_id: str
    symbol: Optional[str]
    timestamp: str
    reason: str                # machine code
    detail: str               # human-readable
    hard_rule: Optional[str] = None  # which hard rule failed
    candidates_count: int = 0
    candidates_accepted: int = 0
    rejection_counts: Dict[str, int] = field(default_factory=dict)
    correlation_id: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "decision_id": self.decision_id,
            "symbol": self.symbol,
            "timestamp": self.timestamp,
            "reason": self.reason,
            "detail": self.detail,
            "hard_rule": self.hard_rule,
            "candidates_count": self.candidates_count,
            "candidates_accepted": self.candidates_accepted,
            "rejection_counts": self.rejection_counts,
            "correlation_id": self.correlation_id,
        }


@dataclass
class CycleResult:
    cycle_id: str
    timestamp: str
    duration_ms: float
    market_open: bool

    decisions: List[DecisionV2] = field(default_factory=list)
    rejections: List[RejectionV2] = field(default_factory=list)
    orders_submitted: List[Dict[str, Any]] = field(default_factory=list)
    anomalies: List[Dict[str, Any]] = field(default_factory=list)

    # Per-symbol chain diagnostics (for debug_snapshot)
    chain_diagnostics: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "cycle_id": self.cycle_id,
            "timestamp": self.timestamp,
            "duration_ms": self.duration_ms,
            "market_open": self.market_open,
            "decisions": [d.to_dict() for d in self.decisions],
            "rejections": [r.to_dict() for r in self.rejections],
            "orders_submitted": self.orders_submitted,
            "anomalies": self.anomalies,
            "summary": {
                "decisions": len(self.decisions),
                "rejections": len(self.rejections),
                "orders": len(self.orders_submitted),
                "anomalies": len(self.anomalies),
            },
        }


# ── Brain ──────────────────────────────────────────────────────────────────────

class AutopilotBrainV2:
    """
    Ruled, fully explainable autopilot brain.

    Usage:
        brain = AutopilotBrainV2()
        result = await brain.run_cycle(universe, armed=False, submit_orders=False)
    """

    def __init__(self, cfg: Optional[BrainConfig] = None):
        self.cfg = cfg or DEFAULT_BRAIN_CONFIG

    async def run_cycle(
        self,
        universe: List[str],
        armed: bool = False,
        submit_orders: bool = False,
        kill_switch: bool = False,
        existing_daily_loss_usd: float = 0.0,
    ) -> CycleResult:
        cid = _cid()
        cycle_id = f"cyc-{uuid.uuid4().hex[:10]}"
        t0 = time.monotonic()
        now_ts = datetime.utcnow().isoformat() + "Z"

        result = CycleResult(
            cycle_id=cycle_id,
            timestamp=now_ts,
            duration_ms=0.0,
            market_open=False,
        )

        # ── Gate 1: Kill switch ───────────────────────────────────────────
        if kill_switch:
            result.rejections.append(RejectionV2(
                decision_id=f"{cycle_id}-kill",
                symbol=None,
                timestamp=now_ts,
                reason="kill_switch_active",
                detail="Kill switch is active — all trading halted.",
                correlation_id=cid,
            ))
            result.duration_ms = round((time.monotonic() - t0) * 1000, 1)
            return result

        # ── Gate 2: Market session ────────────────────────────────────────
        market_open = await self._check_market_open()
        result.market_open = market_open

        can_submit = submit_orders and armed and market_open

        # ── Gate 3: Account state ─────────────────────────────────────────
        existing_positions, account_info = await self._get_account_state()
        buying_power = account_info.get("buying_power", 0.0) or 0.0

        # ── Daily loss gate ───────────────────────────────────────────────
        if existing_daily_loss_usd >= self.cfg.max_daily_loss_usd:
            result.rejections.append(RejectionV2(
                decision_id=f"{cycle_id}-daily-loss",
                symbol=None,
                timestamp=now_ts,
                reason="daily_loss_limit",
                detail=f"Daily loss ${existing_daily_loss_usd:.0f} >= limit ${self.cfg.max_daily_loss_usd:.0f}",
                correlation_id=cid,
            ))
            result.duration_ms = round((time.monotonic() - t0) * 1000, 1)
            return result

        # ── Position exit check ───────────────────────────────────────────
        exit_decisions = await self._check_exits(
            existing_positions, cycle_id, cid, can_submit
        )
        result.decisions.extend(exit_decisions)

        # ── Position count check ──────────────────────────────────────────
        # Subtract positions that are being exited
        active_position_count = existing_positions.get("count", 0)
        exiting_count = len([d for d in exit_decisions if d.decision_type == "EXIT"])
        effective_positions = active_position_count - exiting_count

        # ── Per-symbol analysis ───────────────────────────────────────────
        from .options_data_gateway import get_options_mdg
        from .contract_scorer import score_contracts, ScorerConfig

        mdg = get_options_mdg()
        scorer_cfg = ScorerConfig(
            max_spread_pct=self.cfg.max_spread_pct,
            min_premium=self.cfg.min_premium,
            min_dte=self.cfg.dte_min,
            max_dte=self.cfg.dte_max,
            target_delta=self.cfg.target_delta,
        )

        for symbol in universe:
            sym_decision_id = f"{cycle_id}-{symbol}"
            sym_ts = datetime.utcnow().isoformat() + "Z"

            # ── Fetch chain ────────────────────────────────────────────
            chain = await mdg.fetch_chain_snapshots(
                symbol=symbol,
                dte_min=self.cfg.dte_min,
                dte_max=self.cfg.dte_max,
                option_type="call",  # v2: calls only (can extend to puts later)
                strike_pct_range=self.cfg.strike_pct_range,
            )
            result.chain_diagnostics[symbol] = mdg.get_last_chain_diag(symbol)

            if not chain.get("ok") or not chain.get("snapshots"):
                hint = chain.get("hint") or chain.get("error") or "unknown"
                result.rejections.append(RejectionV2(
                    decision_id=sym_decision_id,
                    symbol=symbol,
                    timestamp=sym_ts,
                    reason="no_contracts",
                    detail=f"No option snapshots for {symbol}: {hint}",
                    hard_rule="chain_fetch_failed",
                    correlation_id=cid,
                ))
                continue

            from .options_data_gateway import OptionSnapshot
            snapshots = [OptionSnapshot(**{k: v for k, v in s.items() if k in OptionSnapshot.__dataclass_fields__}) for s in chain["snapshots"]]

            # ── Score contracts ────────────────────────────────────────
            selection = score_contracts(snapshots, option_type="call", cfg=scorer_cfg, symbol=symbol)

            if selection.winner is None:
                reason_detail = ", ".join(f"{k}={v}" for k, v in selection.rejection_counts.items()) or "all contracts failed hard rules"
                result.rejections.append(RejectionV2(
                    decision_id=sym_decision_id,
                    symbol=symbol,
                    timestamp=sym_ts,
                    reason="no_liquid_contracts",
                    detail=f"No contracts passed scoring for {symbol}: {reason_detail}",
                    hard_rule=list(selection.rejection_counts.keys())[0] if selection.rejection_counts else "unknown",
                    candidates_count=selection.candidates_total,
                    candidates_accepted=selection.candidates_accepted,
                    rejection_counts=selection.rejection_counts,
                    correlation_id=cid,
                ))
                continue

            winner = selection.winner
            snap = winner.snapshot

            # ── Risk gate checks ──────────────────────────────────────
            risk_checks: List[RiskCheck] = []
            any_risk_fail = False

            # Position limit
            pos_check = RiskCheck(
                name="position_limit",
                passed=effective_positions < self.cfg.max_concurrent_positions,
                value=effective_positions,
                limit=self.cfg.max_concurrent_positions,
                message=f"{effective_positions}/{self.cfg.max_concurrent_positions} positions",
            )
            risk_checks.append(pos_check)
            if not pos_check.passed:
                any_risk_fail = True

            # Premium risk
            premium_usd = (snap.mid or 0) * 100
            prem_check = RiskCheck(
                name="premium_risk",
                passed=0 < premium_usd <= self.cfg.max_premium_risk_usd,
                value=round(premium_usd, 2),
                limit=self.cfg.max_premium_risk_usd,
                message=f"${premium_usd:.0f} vs cap ${self.cfg.max_premium_risk_usd:.0f}",
            )
            risk_checks.append(prem_check)
            if not prem_check.passed:
                any_risk_fail = True

            # Buying power
            bp_check = RiskCheck(
                name="buying_power",
                passed=buying_power <= 0 or premium_usd <= buying_power * 0.3,
                value=round(premium_usd, 2),
                limit=round(buying_power * 0.3, 2),
                message=f"${premium_usd:.0f} vs 30% BP ${buying_power * 0.3:.0f}",
            )
            risk_checks.append(bp_check)
            if not bp_check.passed:
                any_risk_fail = True

            if any_risk_fail:
                fail_names = [r.name for r in risk_checks if not r.passed]
                result.rejections.append(RejectionV2(
                    decision_id=sym_decision_id,
                    symbol=symbol,
                    timestamp=sym_ts,
                    reason="risk_cap",
                    detail=f"Risk gates failed for {symbol}: {', '.join(fail_names)}",
                    hard_rule=fail_names[0],
                    candidates_count=selection.candidates_total,
                    candidates_accepted=selection.candidates_accepted,
                    rejection_counts=selection.rejection_counts,
                    correlation_id=cid,
                ))
                continue

            # ── Compute limit price ────────────────────────────────────
            limit_price = snap.mid or snap.ask or 0
            if self.cfg.limit_price_rule == "mid*1.01" and snap.mid:
                limit_price = round(snap.mid * 1.01, 2)
            elif self.cfg.limit_price_rule == "ask" and snap.ask:
                limit_price = snap.ask
            limit_price = round(limit_price, 2)

            # ── Feature contributions ──────────────────────────────────
            features: List[FeatureContribution] = [
                FeatureContribution(
                    name="spread_score",
                    value=f"{snap.spread_pct:.1f}%",
                    contribution=f"spread_score={winner.spread_score:.0f}/100 (weight 40%)",
                    pass_fail=True,
                ),
                FeatureContribution(
                    name="volume",
                    value=snap.volume,
                    contribution=f"volume_score={winner.volume_score:.0f}/100 (weight 20%)",
                    pass_fail=True,
                ),
                FeatureContribution(
                    name="delta",
                    value=snap.delta,
                    contribution=f"delta_score={winner.delta_score:.0f}/100 (target={self.cfg.target_delta:.2f}, weight 25%)",
                    pass_fail=snap.delta is not None,
                ),
                FeatureContribution(
                    name="dte",
                    value=snap.dte,
                    contribution=f"dte_score={winner.dte_score:.0f}/100 (sweet spot 21-35, weight 15%)",
                    pass_fail=True,
                ),
                FeatureContribution(
                    name="iv",
                    value=snap.iv,
                    contribution="implied_vol available" if snap.iv else "implied_vol not available",
                    pass_fail=True,
                ),
            ]

            # Confidence = normalized score / 100, clipped to 0.4..0.9
            confidence = round(max(0.4, min(0.9, winner.score / 100.0)), 3)

            explanation_parts = [
                f"BUY_CALL {symbol}: {snap.contract_symbol}",
                f"DTE={snap.dte}, strike={snap.strike}, mid=${snap.mid:.2f}",
                f"spread={snap.spread_pct:.1f}%, delta={snap.delta or 'N/A'}, score={winner.score:.1f}",
                f"confidence={confidence:.0%} | {selection.candidates_accepted}/{selection.candidates_total} candidates passed",
            ]

            dec = DecisionV2(
                decision_id=sym_decision_id,
                symbol=symbol,
                timestamp=sym_ts,
                decision_type="BUY_CALL",
                contract_symbol=snap.contract_symbol,
                option_type=snap.option_type,
                strike=snap.strike,
                expiry=snap.expiry,
                dte=snap.dte,
                bid=snap.bid,
                ask=snap.ask,
                mid=snap.mid,
                spread_pct=snap.spread_pct,
                delta=snap.delta,
                iv=snap.iv,
                score=winner.score,
                limit_price=limit_price,
                limit_price_rule=self.cfg.limit_price_rule,
                qty=1,
                side="buy",
                candidates_count=selection.candidates_total,
                candidates_accepted=selection.candidates_accepted,
                premium_cost_usd=premium_usd,
                confidence=confidence,
                feature_contributions=features,
                risk_checks=risk_checks,
                explanation=" | ".join(explanation_parts),
                armed=armed,
                market_open=market_open,
                will_submit=can_submit,
                correlation_id=cid,
            )
            result.decisions.append(dec)

            # ── Submit order if armed + market open ────────────────────
            if can_submit and limit_price > 0:
                order_result = await self._submit_order(
                    contract_symbol=snap.contract_symbol,
                    qty=1,
                    side="buy",
                    limit_price=limit_price,
                    decision_id=sym_decision_id,
                )
                result.orders_submitted.append(order_result)
                effective_positions += 1

        # ── Anomaly check ─────────────────────────────────────────────────
        if armed:
            anomalies = await self._detect_anomalies(
                result.orders_submitted,
                existing_positions.get("positions", []),
                cycle_id,
            )
            result.anomalies.extend(anomalies)

        result.duration_ms = round((time.monotonic() - t0) * 1000, 1)
        return result

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def _check_market_open(self) -> bool:
        try:
            from .alpaca_client import get_alpaca_client
            client = get_alpaca_client()
            clock = await client.get_clock()
            return bool(clock and clock.is_open)
        except Exception:
            return False

    async def _get_account_state(self) -> tuple:
        """Returns (positions_result_dict, account_info_dict)."""
        # Use the original options_gateway for positions + account (it works)
        try:
            from .options_gateway import get_options_gateway
            gw = get_options_gateway()
            positions = await gw.list_option_positions()
            account = await gw.get_account_info()
            return positions, account
        except Exception as e:
            logger.warning(f"Account state fetch failed: {e}")
            return {"count": 0, "positions": []}, {}

    async def _check_exits(
        self,
        positions_result: Dict[str, Any],
        cycle_id: str,
        cid: str,
        can_submit: bool,
    ) -> List[DecisionV2]:
        """Check existing positions for exit conditions."""
        exits: List[DecisionV2] = []
        positions = positions_result.get("positions", [])

        for pos in positions:
            sym_ts = datetime.utcnow().isoformat() + "Z"
            pnl_pct = pos.get("unrealized_pnl_pct", 0.0) or 0.0
            symbol = pos.get("symbol", "?")

            exit_reason = None
            if pnl_pct >= self.cfg.take_profit_pct:
                exit_reason = f"take_profit: {pnl_pct:.1f}% >= {self.cfg.take_profit_pct:.0f}%"
            elif pnl_pct <= -self.cfg.stop_loss_pct:
                exit_reason = f"stop_loss: {pnl_pct:.1f}% <= -{self.cfg.stop_loss_pct:.0f}%"
            else:
                # Check DTE via OCC symbol parse
                from .options_data_gateway import parse_occ_symbol
                parsed = parse_occ_symbol(symbol)
                if parsed and parsed["dte"] < self.cfg.time_stop_dte:
                    exit_reason = f"time_stop: {parsed['dte']} DTE < {self.cfg.time_stop_dte}"

            if exit_reason:
                # Get current mid price for limit price
                mid_price = pos.get("current_price", 0.0) or 0.0
                exits.append(DecisionV2(
                    decision_id=f"{cycle_id}-exit-{symbol[:8]}",
                    symbol=symbol,
                    timestamp=sym_ts,
                    decision_type="EXIT",
                    contract_symbol=symbol,
                    option_type=None,
                    limit_price=round(mid_price, 2),
                    limit_price_rule="current_price",
                    qty=abs(int(pos.get("qty", 1))),
                    side="sell",
                    explanation=exit_reason,
                    armed=can_submit,
                    market_open=True,
                    will_submit=can_submit,
                    correlation_id=cid,
                ))

        return exits

    async def _submit_order(
        self,
        contract_symbol: str,
        qty: int,
        side: str,
        limit_price: float,
        decision_id: str,
    ) -> Dict[str, Any]:
        try:
            from .options_gateway import get_options_gateway
            gw = get_options_gateway()
            result = await gw.place_option_order(
                contract_symbol=contract_symbol,
                qty=qty,
                side=side,
                limit_price=limit_price,
                client_order_id=f"apex-v2-{decision_id[-10:]}",
            )
            return result
        except Exception as e:
            logger.error(f"Order submission failed for {contract_symbol}: {e}")
            return {"ok": False, "error": str(e), "symbol": contract_symbol}

    async def _detect_anomalies(
        self,
        submitted_orders: List[Dict[str, Any]],
        current_positions: List[Dict[str, Any]],
        cycle_id: str,
    ) -> List[Dict[str, Any]]:
        """
        Detect filled BTO orders with no corresponding position and no close order.
        This indicates a data inconsistency or rapid exercise.
        """
        anomalies = []
        position_symbols = {p["symbol"] for p in current_positions}

        # Check recently submitted orders that may have filled
        for order_result in submitted_orders:
            if not order_result.get("ok"):
                continue
            order = order_result.get("order", {})
            sym = order.get("symbol", "")
            status = order.get("status", "")
            side = order.get("side", "")

            if side in ("buy", "buy_to_open") and status == "filled":
                if sym and sym not in position_symbols:
                    anomalies.append({
                        "type": "filled_bto_no_position",
                        "symbol": sym,
                        "order_id": order.get("order_id"),
                        "detail": f"BTO order filled for {sym} but no position found",
                        "cycle_id": cycle_id,
                        "timestamp": datetime.utcnow().isoformat() + "Z",
                    })

        return anomalies


# ── Singleton ─────────────────────────────────────────────────────────────────

_brain: Optional[AutopilotBrainV2] = None


def get_brain_v2(cfg: Optional[BrainConfig] = None) -> AutopilotBrainV2:
    global _brain
    if _brain is None:
        _brain = AutopilotBrainV2(cfg)
    return _brain
