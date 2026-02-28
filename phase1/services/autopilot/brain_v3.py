"""
Autopilot Brain V3 — Closed-Loop Trading System Orchestrator.

Architecture:
  1. Persist cycle in v3_store (autopilot_cycles)
  2. Fetch portfolio risk snapshot
  3. Run exit manager: evaluate + sync open positions
  4. Signal provider: get directional signal per symbol
  5. Chain fetch via OptionsMarketDataGateway (correct endpoint)
  6. Contract scoring via ContractScorer
  7. Risk engine: full v3 gate assessment
  8. Direction alignment check (signal must align with CALL/PUT type)
  9. Generate V3 Decision with full traceability
  10. Submit orders if armed + market open
  11. Sync fills → position records
  12. Evaluator: post-cycle evaluation of any new exits
  13. Complete cycle record

Invariant checker runs every cycle.
All state written to autopilot_v3.db.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def _cid() -> str:
    return f"bv3-{uuid.uuid4().hex[:8]}"


# ── V3 Decision / Result dataclasses ─────────────────────────────────────────

@dataclass
class V3Decision:
    """Full V3 decision with all traceability fields."""
    decision_id: str
    cycle_id: str
    symbol: str
    timestamp: str
    decision_type: str          # BUY_CALL | BUY_PUT | EXIT | HOLD | REJECT

    # Contract (populated for BUY_*)
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
    premium_cost_usd: float = 0.0

    # Scoring context
    candidates_count: int = 0
    candidates_accepted: int = 0
    confidence: float = 0.0

    # Signal context
    signal_direction: Optional[str] = None    # bullish | bearish | neutral
    signal_strength: Optional[float] = None
    signal_source: Optional[str] = None
    signal_regime: Optional[str] = None

    # Full explanations
    feature_contributions: List[Dict[str, Any]] = field(default_factory=list)
    risk_checks: List[Dict[str, Any]] = field(default_factory=list)
    explanation: str = ""

    # Execution flags
    armed: bool = False
    market_open: bool = False
    will_submit: bool = False

    # Rejection
    rejection_reason: Optional[str] = None
    rejection_detail: Optional[str] = None
    hard_rule: Optional[str] = None

    correlation_id: str = ""

    def to_dict(self) -> Dict[str, Any]:
        d = {
            "decision_id": self.decision_id,
            "cycle_id": self.cycle_id,
            "symbol": self.symbol,
            "timestamp": self.timestamp,
            "decision_type": self.decision_type,
            "candidates_count": self.candidates_count,
            "candidates_accepted": self.candidates_accepted,
            "confidence": self.confidence,
            "signal": {
                "direction": self.signal_direction,
                "strength": self.signal_strength,
                "source": self.signal_source,
                "regime": self.signal_regime,
            },
            "feature_contributions": self.feature_contributions,
            "risk_checks": self.risk_checks,
            "explanation": self.explanation,
            "armed": self.armed,
            "market_open": self.market_open,
            "will_submit": self.will_submit,
            "rejection_reason": self.rejection_reason,
            "rejection_detail": self.rejection_detail,
            "hard_rule": self.hard_rule,
            "correlation_id": self.correlation_id,
        }
        if self.contract_symbol:
            d["contract"] = {
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
            }
            d["order"] = {
                "limit_price": self.limit_price,
                "limit_price_rule": self.limit_price_rule,
                "qty": self.qty,
                "side": self.side,
                "premium_cost_usd": self.premium_cost_usd,
            }
        return d

    def to_store_dict(self) -> Dict[str, Any]:
        """Dict for v3_store.decision_upsert()."""
        return {
            "decision_id": self.decision_id,
            "cycle_id": self.cycle_id,
            "symbol": self.symbol,
            "decision_type": self.decision_type,
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
            "confidence": self.confidence,
            "limit_price": self.limit_price,
            "qty": self.qty,
            "premium_cost_usd": self.premium_cost_usd,
            "candidates_count": self.candidates_count,
            "candidates_accepted": self.candidates_accepted,
            "risk_checks": [rc for rc in self.risk_checks],
            "feature_contributions": self.feature_contributions,
            "explanation": self.explanation,
            "will_submit": self.will_submit,
            "rejection_reason": self.rejection_reason,
            "rejection_detail": self.rejection_detail,
            "signal_direction": self.signal_direction,
            "signal_strength": self.signal_strength,
            "created_at": self.timestamp,
        }


@dataclass
class V3CycleResult:
    cycle_id: str
    correlation_id: str
    decisions: List[V3Decision] = field(default_factory=list)
    rejections: List[V3Decision] = field(default_factory=list)
    exit_proposals: List[Dict[str, Any]] = field(default_factory=list)
    orders_submitted: List[Dict[str, Any]] = field(default_factory=list)
    anomalies: List[Dict[str, Any]] = field(default_factory=list)
    chain_diagnostics: Dict[str, Any] = field(default_factory=dict)
    portfolio_snapshot: Optional[Dict[str, Any]] = None
    duration_ms: float = 0.0
    market_open: bool = False
    armed: bool = False


# ── Brain V3 ──────────────────────────────────────────────────────────────────

class AutopilotBrainV3:
    """
    V3 Closed-Loop Autopilot Brain.

    Integrates:
    - v3_store: persistent state
    - risk_engine: full cap enforcement
    - signal_provider: directional signals per symbol
    - exit_manager: position lifecycle
    - evaluator: post-trade learning
    - options_data_gateway: live chain data
    - contract_scorer: liquidity scoring
    """

    def __init__(self):
        from .risk_engine import get_risk_engine, RiskConfig
        from .exit_manager import get_exit_manager
        from .evaluator import get_evaluator

        self.risk_engine = get_risk_engine()
        self.exit_manager = get_exit_manager()
        self.evaluator = get_evaluator()

    async def run_cycle(
        self,
        universe: List[str],
        armed: bool = False,
        submit_orders: bool = False,
        kill_switch: bool = False,
        existing_daily_loss_usd: float = 0.0,
    ) -> V3CycleResult:
        """Run a full V3 decision cycle."""
        from . import v3_store

        t0 = time.monotonic()
        cid = _cid()
        now_str = datetime.utcnow().isoformat() + "Z"

        # ── Create cycle record ────────────────────────────────────────────────
        market_open = await self._check_market_open()
        cycle_id = v3_store.cycle_create(
            universe=universe,
            armed=armed,
            correlation_id=cid,
            market_open=market_open,
        )

        result = V3CycleResult(
            cycle_id=cycle_id,
            correlation_id=cid,
            market_open=market_open,
            armed=armed,
        )

        can_submit = submit_orders and armed and market_open and not kill_switch

        # ── Kill switch gate ───────────────────────────────────────────────────
        if kill_switch:
            result.rejections.append(V3Decision(
                decision_id=f"{cycle_id}-ks",
                cycle_id=cycle_id,
                symbol="ALL",
                timestamp=now_str,
                decision_type="REJECT",
                rejection_reason="kill_switch_active",
                rejection_detail="Kill switch is active — all trading halted.",
                armed=armed,
                market_open=market_open,
                correlation_id=cid,
            ))
            self._complete_cycle(cycle_id, result, t0)
            return result

        # ── Fetch account state ────────────────────────────────────────────────
        positions_result, account_info = await self._get_account_state()
        broker_positions = positions_result.get("positions", [])
        buying_power = float(account_info.get("options_buying_power") or account_info.get("buying_power") or 0)
        equity = float(account_info.get("equity") or 0)

        # ── Sync positions to v3_store ────────────────────────────────────────
        await self.exit_manager.sync_positions_from_broker(broker_positions, cycle_id)

        # ── Portfolio risk snapshot ────────────────────────────────────────────
        portfolio_snap = self.risk_engine.compute_portfolio_snapshot(
            broker_positions, account_info, equity_start=0.0
        )
        result.portfolio_snapshot = portfolio_snap.to_dict()

        # ── Daily loss gate ────────────────────────────────────────────────────
        daily_loss = existing_daily_loss_usd or portfolio_snap.estimated_daily_loss
        if daily_loss < -self.risk_engine.cfg.max_daily_loss_usd:
            result.rejections.append(V3Decision(
                decision_id=f"{cycle_id}-dl",
                cycle_id=cycle_id,
                symbol="ALL",
                timestamp=now_str,
                decision_type="REJECT",
                rejection_reason="daily_loss_limit",
                rejection_detail=f"Daily loss ${daily_loss:.0f} exceeds cap ${self.risk_engine.cfg.max_daily_loss_usd:.0f}",
                armed=armed,
                market_open=market_open,
                correlation_id=cid,
            ))
            self._complete_cycle(cycle_id, result, t0)
            return result

        # ── Exit manager: check open positions for exit triggers ───────────────
        exit_proposals = await self.exit_manager.evaluate_positions(
            broker_positions, armed=can_submit, cycle_id=cycle_id, correlation_id=cid
        )
        for ep in exit_proposals:
            result.exit_proposals.append(ep.to_dict())
            # Convert to EXIT decision
            exit_dec = V3Decision(
                decision_id=f"{cycle_id}-exit-{ep.symbol[:8]}",
                cycle_id=cycle_id,
                symbol=ep.symbol,
                timestamp=now_str,
                decision_type="EXIT",
                contract_symbol=ep.contract_symbol,
                limit_price=ep.limit_price,
                qty=ep.qty,
                side="sell",
                explanation=f"EXIT: {ep.exit_reason} — {ep.trigger_detail}",
                rejection_reason=None,
                armed=armed,
                market_open=market_open,
                will_submit=can_submit,
                correlation_id=cid,
            )
            result.decisions.append(exit_dec)
            v3_store.decision_upsert(exit_dec.to_store_dict())

            # Submit STC if armed
            if can_submit and ep.limit_price > 0:
                order_result = await self._submit_order(
                    contract_symbol=ep.contract_symbol,
                    qty=ep.qty,
                    side="sell",
                    limit_price=ep.limit_price,
                    intent="STC",
                    decision_id=exit_dec.decision_id,
                    cycle_id=cycle_id,
                )
                result.orders_submitted.append(order_result)

        # ── Get signals in parallel ────────────────────────────────────────────
        from .signal_provider import get_signals_batch
        signals = await get_signals_batch(universe)

        # ── Get adaptive thresholds ────────────────────────────────────────────
        thresholds = self.evaluator.get_thresholds()

        # ── Per-symbol: chain → score → risk → signal align → decide ──────────
        from .options_data_gateway import get_options_mdg, OptionSnapshot
        from .contract_scorer import score_contracts, ScorerConfig

        mdg = get_options_mdg()
        scorer_cfg = ScorerConfig(
            max_spread_pct=thresholds.max_spread_pct,
            min_dte=thresholds.min_dte,
            max_dte=thresholds.max_dte,
            target_delta=thresholds.target_delta,
        )

        effective_positions = portfolio_snap.open_positions_count

        for symbol in universe:
            sym_ts = datetime.utcnow().isoformat() + "Z"
            sym_decision_id = f"{cycle_id}-{symbol}"

            signal = signals.get(symbol)
            signal_direction = signal.direction if signal else "neutral"
            signal_strength = signal.strength if signal else 0.0
            signal_bias = signal.bias_for_options if signal else "NEUTRAL"
            confidence_boost = signal.confidence_boost if signal else 0.0

            # Determine option type to search
            option_type = "call"
            if signal_bias == "PUT":
                option_type = "put"

            # ── Chain fetch ────────────────────────────────────────────────────
            spot = await mdg.get_spot_price(symbol)
            chain = await mdg.fetch_chain_snapshots(
                symbol, dte_min=thresholds.min_dte, dte_max=thresholds.max_dte,
                option_type=option_type,
            )
            diag = mdg.get_last_chain_diag(symbol)
            result.chain_diagnostics[symbol] = diag

            if not chain.get("ok") or not chain.get("snapshots"):
                rej = V3Decision(
                    decision_id=sym_decision_id,
                    cycle_id=cycle_id,
                    symbol=symbol,
                    timestamp=sym_ts,
                    decision_type="REJECT",
                    rejection_reason="chain_unavailable",
                    rejection_detail=chain.get("error") or "No snapshots returned",
                    hard_rule="chain_unavailable",
                    signal_direction=signal_direction,
                    signal_strength=signal_strength,
                    armed=armed,
                    market_open=market_open,
                    correlation_id=cid,
                )
                result.rejections.append(rej)
                v3_store.decision_upsert(rej.to_store_dict())
                continue

            # ── Score contracts ────────────────────────────────────────────────
            snapshots = []
            for s in chain["snapshots"]:
                try:
                    snapshots.append(OptionSnapshot(**{k: v for k, v in s.items() if k in OptionSnapshot.__dataclass_fields__}))
                except Exception:
                    pass

            selection = score_contracts(snapshots, option_type=option_type, cfg=scorer_cfg, symbol=symbol)

            if selection.winner is None:
                reason_detail = ", ".join(f"{k}={v}" for k, v in selection.rejection_counts.items()) or "all scored below threshold"
                rej = V3Decision(
                    decision_id=sym_decision_id,
                    cycle_id=cycle_id,
                    symbol=symbol,
                    timestamp=sym_ts,
                    decision_type="REJECT",
                    rejection_reason="no_liquid_contracts",
                    rejection_detail=f"{reason_detail}",
                    hard_rule=list(selection.rejection_counts.keys())[0] if selection.rejection_counts else "unknown",
                    candidates_count=selection.candidates_total,
                    candidates_accepted=selection.candidates_accepted,
                    signal_direction=signal_direction,
                    signal_strength=signal_strength,
                    armed=armed,
                    market_open=market_open,
                    correlation_id=cid,
                )
                result.rejections.append(rej)
                v3_store.decision_upsert(rej.to_store_dict())
                continue

            winner = selection.winner
            snap = winner.snapshot

            # ── Signal alignment check ─────────────────────────────────────────
            if signal_bias != "NEUTRAL":
                call_put = snap.option_type.upper() if snap.option_type else "CALL"
                if call_put != signal_bias:
                    rej = V3Decision(
                        decision_id=sym_decision_id,
                        cycle_id=cycle_id,
                        symbol=symbol,
                        timestamp=sym_ts,
                        decision_type="REJECT",
                        rejection_reason="signal_misalign",
                        rejection_detail=f"Signal is {signal_direction} but scored winner is {call_put}",
                        signal_direction=signal_direction,
                        signal_strength=signal_strength,
                        candidates_count=selection.candidates_total,
                        candidates_accepted=selection.candidates_accepted,
                        armed=armed,
                        market_open=market_open,
                        correlation_id=cid,
                    )
                    result.rejections.append(rej)
                    v3_store.decision_upsert(rej.to_store_dict())
                    continue

            # ── Full V3 Risk Assessment ────────────────────────────────────────
            risk_assessment = self.risk_engine.assess_new_order(
                symbol=symbol,
                contract_symbol=snap.contract_symbol,
                mid_price=snap.mid or 0,
                delta=snap.delta,
                qty=1,
                spot_price=spot,
                portfolio_snap=portfolio_snap,
                buying_power=buying_power,
                account_daily_loss=daily_loss,
            )

            if not risk_assessment.passed:
                fail_names = [g.name for g in risk_assessment.failed_gates()]
                rej = V3Decision(
                    decision_id=sym_decision_id,
                    cycle_id=cycle_id,
                    symbol=symbol,
                    timestamp=sym_ts,
                    decision_type="REJECT",
                    rejection_reason="risk_cap",
                    rejection_detail=f"Failed: {', '.join(fail_names)}",
                    hard_rule=fail_names[0],
                    candidates_count=selection.candidates_total,
                    candidates_accepted=selection.candidates_accepted,
                    risk_checks=[g.to_dict() for g in risk_assessment.gates],
                    signal_direction=signal_direction,
                    signal_strength=signal_strength,
                    armed=armed,
                    market_open=market_open,
                    correlation_id=cid,
                )
                result.rejections.append(rej)
                v3_store.decision_upsert(rej.to_store_dict())
                continue

            # ── Compute limit price ────────────────────────────────────────────
            limit_price = snap.mid or snap.ask or 0
            limit_price = round(limit_price, 2)

            # ── Confidence: scorer + signal boost ─────────────────────────────
            base_confidence = max(0.4, min(0.85, winner.score / 100.0))
            confidence = max(0.0, min(0.99, base_confidence + confidence_boost))

            # ── Confidence gate ────────────────────────────────────────────────
            if confidence < thresholds.min_confidence:
                rej = V3Decision(
                    decision_id=sym_decision_id,
                    cycle_id=cycle_id,
                    symbol=symbol,
                    timestamp=sym_ts,
                    decision_type="REJECT",
                    rejection_reason="low_confidence",
                    rejection_detail=f"Confidence {confidence:.1%} < threshold {thresholds.min_confidence:.1%}",
                    candidates_count=selection.candidates_total,
                    candidates_accepted=selection.candidates_accepted,
                    signal_direction=signal_direction,
                    signal_strength=signal_strength,
                    armed=armed,
                    market_open=market_open,
                    correlation_id=cid,
                )
                result.rejections.append(rej)
                v3_store.decision_upsert(rej.to_store_dict())
                continue

            # ── Build feature contributions ────────────────────────────────────
            features = [
                {"name": "spread_score", "value": f"{snap.spread_pct:.1f}%",
                 "contribution": f"spread_score={winner.spread_score:.0f}/100 (40%)", "pass_fail": True},
                {"name": "volume", "value": snap.volume,
                 "contribution": f"volume_score={winner.volume_score:.0f}/100 (20%)", "pass_fail": True},
                {"name": "delta", "value": snap.delta,
                 "contribution": f"delta_score={winner.delta_score:.0f}/100 (target={scorer_cfg.target_delta:.2f}, 25%)",
                 "pass_fail": snap.delta is not None},
                {"name": "dte", "value": snap.dte,
                 "contribution": f"dte_score={winner.dte_score:.0f}/100 (sweet 21-35, 15%)", "pass_fail": True},
                {"name": "signal", "value": signal_direction,
                 "contribution": f"signal={signal_direction} strength={signal_strength:.0%} boost={confidence_boost:+.0%}",
                 "pass_fail": signal_direction != "neutral"},
            ]

            decision_type = "BUY_CALL" if (snap.option_type or "call").lower() == "call" else "BUY_PUT"

            dec = V3Decision(
                decision_id=sym_decision_id,
                cycle_id=cycle_id,
                symbol=symbol,
                timestamp=sym_ts,
                decision_type=decision_type,
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
                limit_price_rule="mid",
                qty=1,
                side="buy",
                premium_cost_usd=risk_assessment.premium_cost_usd,
                candidates_count=selection.candidates_total,
                candidates_accepted=selection.candidates_accepted,
                confidence=round(confidence, 3),
                signal_direction=signal_direction,
                signal_strength=signal_strength,
                signal_source=signal.source if signal else "unknown",
                signal_regime=signal.regime if signal else "unknown",
                feature_contributions=features,
                risk_checks=[g.to_dict() for g in risk_assessment.gates],
                explanation=(
                    f"{decision_type} {symbol}: {snap.contract_symbol} | "
                    f"DTE={snap.dte}, score={winner.score:.1f}, spread={snap.spread_pct:.1f}%, "
                    f"confidence={confidence:.0%}, signal={signal_direction}({signal_strength:.0%})"
                ),
                armed=armed,
                market_open=market_open,
                will_submit=can_submit,
                correlation_id=cid,
            )
            result.decisions.append(dec)
            v3_store.decision_upsert(dec.to_store_dict())

            # ── Submit BTO order ──────────────────────────────────────────────
            if can_submit and limit_price > 0:
                order_result = await self._submit_order(
                    contract_symbol=snap.contract_symbol,
                    qty=1,
                    side="buy",
                    limit_price=limit_price,
                    intent="BTO",
                    decision_id=sym_decision_id,
                    cycle_id=cycle_id,
                )
                result.orders_submitted.append(order_result)

                # Create position record immediately
                if order_result.get("ok"):
                    order_id = order_result.get("client_order_id", sym_decision_id)
                    try:
                        v3_store.position_open({
                            "symbol": symbol,
                            "contract_symbol": snap.contract_symbol,
                            "decision_id": sym_decision_id,
                            "open_order_id": order_id,
                            "qty": 1,
                            "avg_entry": limit_price,
                            "delta_at_open": snap.delta,
                            "dte_at_open": snap.dte,
                            "score_at_open": winner.score,
                            "spread_pct_at_open": snap.spread_pct,
                        })
                    except Exception as e:
                        logger.warning(f"position_open failed: {e}")

                effective_positions += 1

        # ── Invariant check ────────────────────────────────────────────────────
        from . import v3_store as _store
        inv = _store.invariant_check()
        if not inv["ok"]:
            for v in inv["violations"]:
                result.anomalies.append(v)
                try:
                    _store.incident_create(
                        category="invariant_violation",
                        title=v.get("type", "invariant_violated"),
                        severity="error",
                        description=str(v),
                        cycle_id=cycle_id,
                    )
                except Exception:
                    pass

        # ── Post-cycle evaluation ──────────────────────────────────────────────
        try:
            eval_count = self.evaluator.evaluate_pending_exits()
            if eval_count:
                logger.info(f"Evaluated {eval_count} pending exits")
        except Exception as e:
            logger.debug(f"evaluate_pending_exits failed: {e}")

        # ── Complete cycle ─────────────────────────────────────────────────────
        result.duration_ms = round((time.monotonic() - t0) * 1000, 1)
        self._complete_cycle(cycle_id, result, t0)
        return result

    def _complete_cycle(self, cycle_id: str, result: V3CycleResult, t0: float) -> None:
        from . import v3_store
        try:
            v3_store.cycle_complete(
                cycle_id=cycle_id,
                decisions_count=len(result.decisions),
                rejections_count=len(result.rejections),
                orders_count=len(result.orders_submitted),
                duration_ms=round((time.monotonic() - t0) * 1000, 1),
                market_session="open" if result.market_open else "closed",
            )
        except Exception as e:
            logger.warning(f"cycle_complete failed: {e}")

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def _check_market_open(self) -> bool:
        try:
            from .alpaca_client import get_alpaca_client
            client = get_alpaca_client()
            clock = await client.get_clock()
            return bool(clock and clock.is_open)
        except Exception:
            return False

    async def _get_account_state(self):
        try:
            from .options_gateway import get_options_gateway
            gw = get_options_gateway()
            positions = await gw.list_option_positions()
            account = await gw.get_account_info()
            return positions, account
        except Exception as e:
            logger.warning(f"Account state fetch failed: {e}")
            return {"count": 0, "positions": []}, {}

    async def _submit_order(
        self,
        contract_symbol: str,
        qty: int,
        side: str,
        limit_price: float,
        intent: str,
        decision_id: str,
        cycle_id: str,
    ) -> Dict[str, Any]:
        from . import v3_store
        client_oid = f"apx-v3-{decision_id[-10:]}"
        order_id = v3_store.order_create({
            "order_id": client_oid,
            "cycle_id": cycle_id,
            "decision_id": decision_id,
            "symbol": contract_symbol[:6],
            "contract_symbol": contract_symbol,
            "intent": intent,
            "side": side,
            "qty": qty,
            "limit_price": limit_price,
            "limit_price_rule": "mid",
            "status": "pending",
        })

        try:
            from .options_gateway import get_options_gateway
            gw = get_options_gateway()
            result = await gw.place_option_order(
                contract_symbol=contract_symbol,
                qty=qty,
                side=side,
                limit_price=limit_price,
                client_order_id=client_oid,
            )
            broker_oid = result.get("order", {}).get("order_id") or result.get("order_id")
            v3_store.order_update_fill(
                order_id=client_oid,
                broker_order_id=broker_oid or "",
                status="submitted",
                filled_qty=0,
                filled_avg_price=None,
            )
            return {**result, "client_order_id": client_oid}
        except Exception as e:
            logger.error(f"Order submission failed {contract_symbol}: {e}")
            try:
                v3_store.order_update_fill(client_oid, "", "failed", 0, None)
            except Exception:
                pass
            return {"ok": False, "error": str(e), "symbol": contract_symbol, "client_order_id": client_oid}


# ── Singleton ─────────────────────────────────────────────────────────────────

_brain_v3: Optional[AutopilotBrainV3] = None


def get_brain_v3() -> AutopilotBrainV3:
    global _brain_v3
    if _brain_v3 is None:
        _brain_v3 = AutopilotBrainV3()
    return _brain_v3
