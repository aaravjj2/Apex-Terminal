"""
Autopilot V3 Evaluator — Outcome evaluation and deterministic learning loop.

After each exit:
  1. Compute outcome quality: realized PnL, MAE, MFE, signal correctness.
  2. Store evaluation record (indexed in v3_store).
  3. After every N exits, recompute thresholds deterministically.

Learning loop rules (NO ML, purely deterministic):
  - If win_rate < 0.45 over last 10 trades:
      → tighten confidence_threshold (+0.05)
      → tighten max_spread_pct (-1%)
  - If loss_rate > 0.6 over last 10 trades:
      → tighten max_spread_pct (-1%)
      → tighten stop_loss_pct (-2%)
  - If avg_held_days > 8 (theta decay hurting):
      → widen DTE range to max_dte + 7
  - If win_rate > 0.65 over last 15 trades:
      → can slightly loosen confidence_threshold (-0.02)

All threshold changes are recorded in autopilot_threshold_history.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ── Adaptive Thresholds ───────────────────────────────────────────────────────

@dataclass
class AdaptiveThresholds:
    """Current thresholds used by the brain for decision making."""
    # Scoring
    min_confidence: float = 0.5          # reject if confidence below this
    max_spread_pct: float = 8.0          # hard liquidity rule
    min_dte: int = 14
    max_dte: int = 45
    target_delta: float = 0.45

    # Risk
    max_premium_per_trade_usd: float = 500.0
    stop_loss_pct: float = 25.0
    take_profit_pct: float = 30.0

    # Learning params
    sample_n: int = 0                     # how many completed trades informed these
    last_win_rate: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "min_confidence": self.min_confidence,
            "max_spread_pct": self.max_spread_pct,
            "min_dte": self.min_dte,
            "max_dte": self.max_dte,
            "target_delta": self.target_delta,
            "max_premium_per_trade_usd": self.max_premium_per_trade_usd,
            "stop_loss_pct": self.stop_loss_pct,
            "take_profit_pct": self.take_profit_pct,
            "sample_n": self.sample_n,
            "last_win_rate": self.last_win_rate,
        }


# ── Evaluator ─────────────────────────────────────────────────────────────────

class Evaluator:
    """
    Post-trade outcome evaluator and threshold learning loop.
    """

    # How many trades to accumulate before reassessing thresholds
    REASSESS_INTERVAL = 5

    def __init__(self):
        self._thresholds = AdaptiveThresholds()

    def get_thresholds(self) -> AdaptiveThresholds:
        return self._thresholds

    def evaluate_exit(
        self,
        decision: Dict[str, Any],
        position: Dict[str, Any],
        exit_event: Dict[str, Any],
        cycle_id: Optional[str] = None,
    ) -> str:
        """
        Create an evaluation record for a completed trade.
        Returns eval_id.
        """
        try:
            from . import v3_store

            realized_pnl_pct = float(exit_event.get("realized_pnl_pct", 0))
            entry_price = float(position.get("avg_entry") or 0)
            exit_price = float(exit_event.get("exit_price") or 0)
            held_days = float(exit_event.get("held_days", 0))

            # Signal correctness: did underlying move in predicted direction?
            signal_dir = decision.get("signal_direction", "neutral")
            direction_correct = _check_signal_correctness(
                symbol=decision.get("symbol", ""),
                signal_dir=signal_dir,
                realized_pnl_pct=realized_pnl_pct,
            )

            # MAE/MFE: use position's recorded data if available, else estimate
            mae_pct = min(0.0, realized_pnl_pct)   # max adverse = worst pnl seen
            mfe_pct = max(0.0, realized_pnl_pct)   # max favorable = best pnl seen

            eval_id = v3_store.evaluation_create({
                "cycle_id": cycle_id,
                "decision_id": decision.get("decision_id"),
                "position_id": position.get("position_id"),
                "exit_id": exit_event.get("exit_id"),
                "symbol": decision.get("symbol", ""),
                "entry_spread_pct": decision.get("spread_pct"),
                "entry_dte": decision.get("dte"),
                "entry_delta": decision.get("delta"),
                "entry_iv": decision.get("iv"),
                "entry_liquidity_score": decision.get("score"),
                "entry_signal_direction": signal_dir,
                "entry_signal_strength": decision.get("signal_strength"),
                "realized_pnl_pct": realized_pnl_pct,
                "mae_pct": mae_pct,
                "mfe_pct": mfe_pct,
                "direction_correct": direction_correct,
                "exit_reason": exit_event.get("exit_reason"),
                "held_days": held_days,
                "thresholds_snapshot": self._thresholds.to_dict(),
            })

            # Check if we should reassess thresholds
            total_evals = len(v3_store.evaluations_list(limit=1000))
            if total_evals > 0 and total_evals % self.REASSESS_INTERVAL == 0:
                self._reassess_thresholds(v3_store.evaluations_list(limit=20))

            return eval_id
        except Exception as e:
            logger.warning(f"evaluate_exit failed: {e}")
            return ""

    def _reassess_thresholds(self, recent_evals: List[Dict[str, Any]]) -> None:
        """
        Deterministically adjust thresholds based on last N completed trades.
        Records every change to autopilot_threshold_history.
        """
        if not recent_evals:
            return

        n = len(recent_evals)
        wins = sum(1 for e in recent_evals if (e.get("realized_pnl_pct") or 0) > 0)
        losses = sum(1 for e in recent_evals if (e.get("realized_pnl_pct") or 0) < 0)
        win_rate = wins / n if n > 0 else None
        loss_rate = losses / n if n > 0 else None
        avg_held = sum((e.get("held_days") or 0) for e in recent_evals) / n if n > 0 else 0

        old = self._thresholds.to_dict()
        changes = []

        # Rule 1: Win rate too low → tighten spread and confidence
        if win_rate is not None and win_rate < 0.45 and n >= 10:
            if self._thresholds.min_confidence < 0.80:
                self._thresholds.min_confidence = min(0.80, self._thresholds.min_confidence + 0.05)
                changes.append(f"min_confidence ↑ to {self._thresholds.min_confidence:.2f} (win_rate={win_rate:.1%})")
            if self._thresholds.max_spread_pct > 3.0:
                self._thresholds.max_spread_pct = max(3.0, self._thresholds.max_spread_pct - 1.0)
                changes.append(f"max_spread_pct ↓ to {self._thresholds.max_spread_pct:.1f}% (win_rate={win_rate:.1%})")

        # Rule 2: Loss rate too high → tighten everything
        if loss_rate is not None and loss_rate > 0.60 and n >= 10:
            if self._thresholds.max_spread_pct > 3.0:
                self._thresholds.max_spread_pct = max(3.0, self._thresholds.max_spread_pct - 1.0)
                changes.append(f"max_spread_pct ↓ to {self._thresholds.max_spread_pct:.1f}% (loss_rate={loss_rate:.1%})")
            if self._thresholds.stop_loss_pct > 15.0:
                self._thresholds.stop_loss_pct = max(15.0, self._thresholds.stop_loss_pct - 2.0)
                changes.append(f"stop_loss_pct ↓ to {self._thresholds.stop_loss_pct:.1f}% (loss_rate={loss_rate:.1%})")

        # Rule 3: Theta decay (long held days) → widen DTE
        if avg_held > 8 and self._thresholds.max_dte < 60:
            self._thresholds.max_dte = min(60, self._thresholds.max_dte + 7)
            changes.append(f"max_dte ↑ to {self._thresholds.max_dte} (avg_held={avg_held:.1f}d)")

        # Rule 4: Winning streak → loosen confidence slightly to get more trades
        if win_rate is not None and win_rate > 0.65 and n >= 15:
            if self._thresholds.min_confidence > 0.45:
                self._thresholds.min_confidence = max(0.45, self._thresholds.min_confidence - 0.02)
                changes.append(f"min_confidence ↓ to {self._thresholds.min_confidence:.2f} (win_rate={win_rate:.1%})")

        self._thresholds.sample_n = n
        self._thresholds.last_win_rate = win_rate

        if changes:
            new = self._thresholds.to_dict()
            logger.info(f"Threshold adjustment: {'; '.join(changes)}")
            try:
                from . import v3_store
                v3_store.threshold_change_record(
                    trigger_reason="; ".join(changes),
                    old_values=old,
                    new_values=new,
                    trade_sample_n=n,
                    win_rate=win_rate,
                    notes=f"win={wins}/{n}, loss={losses}/{n}, avg_held={avg_held:.1f}d",
                )
            except Exception as e:
                logger.warning(f"threshold_change_record failed: {e}")

    def evaluate_pending_exits(self) -> int:
        """
        Run evaluation for any exits that don't yet have evaluation records.
        Returns count of evaluations created.
        """
        count = 0
        try:
            from . import v3_store
            exits = v3_store.exits_list(limit=100)
            existing_evals = v3_store.evaluations_list(limit=200)
            evaled_exit_ids = {e.get("exit_id") for e in existing_evals if e.get("exit_id")}

            for ex in exits:
                if ex["exit_id"] in evaled_exit_ids:
                    continue
                # Find decision
                dec_list = v3_store.decisions_list(limit=500)
                dec = next((d for d in dec_list if d.get("decision_id") == ex.get("decision_id")), None)
                if not dec:
                    dec = {"symbol": ex.get("symbol", ""), "decision_id": ex.get("decision_id", "")}

                pos_list = v3_store.positions_list(status=None, limit=500)
                pos = next((p for p in pos_list if p.get("position_id") == ex.get("position_id")), None)
                if not pos:
                    pos = {"position_id": ex.get("position_id", ""), "avg_entry": ex.get("entry_price")}

                self.evaluate_exit(dec, pos, ex)
                count += 1
        except Exception as e:
            logger.warning(f"evaluate_pending_exits failed: {e}")
        return count


# ── Signal correctness helper ─────────────────────────────────────────────────

def _check_signal_correctness(
    symbol: str,
    signal_dir: str,
    realized_pnl_pct: float,
) -> bool:
    """
    Simplified: if bullish signal and positive PnL → correct.
    A full impl would check underlying price change over next N days.
    """
    if signal_dir == "bullish":
        return realized_pnl_pct > 0
    elif signal_dir == "bearish":
        return realized_pnl_pct > 0   # PUT gains when underlying falls
    return False   # neutral can't be "correct"


# ── Singleton ─────────────────────────────────────────────────────────────────

_evaluator: Optional[Evaluator] = None


def get_evaluator() -> Evaluator:
    global _evaluator
    if _evaluator is None:
        _evaluator = Evaluator()
    return _evaluator
