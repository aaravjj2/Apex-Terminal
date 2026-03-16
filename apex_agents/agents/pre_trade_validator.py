"""
PreTradeValidator Agent
=======================
validate_order(candidate, context) → ApprovalResult

Called by unified_engine._execute_trades() immediately before every
exec_engine.submit_candidate() call.  Returns approved=False to hard-block
the order; the engine logs the refusal and moves to the next candidate.

Design principles:
- Pure function — no side effects, no I/O, deterministic.
- Fast — must complete in < 1 ms so it doesn't slow the cycle.
- All thresholds default to sensible values but can be overridden via
  context["limits"] dict so callers can pass config-derived values.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ── Result type ──────────────────────────────────────────────────────────────

@dataclass
class ApprovalResult:
    approved: bool
    reason: str
    flags: List[str] = field(default_factory=list)

    def __bool__(self) -> bool:          # allows `if validate_order(...):`
        return self.approved


# ── Defaults ─────────────────────────────────────────────────────────────────

_DEFAULTS: Dict[str, Any] = {
    "min_credit":          0.10,   # minimum credit collected ($)
    "min_pop":             0.45,   # minimum probability of profit (0–1)
    "min_dte":             1,      # minimum days-to-expiry
    "max_dte":             60,     # maximum days-to-expiry
    "min_iv_rank":         15,     # minimum IV rank (0–100)
    "max_iv_rank":         95,     # maximum IV rank (to avoid IV crush traps)
    "max_loss_usd":        2000,   # hard cap per trade ($)
    "max_spread_pct":      0.10,   # maximum bid/ask spread as % of mid
    "min_liquidity_score": 0.30,   # minimum liquidity score (0–1)
    "max_delta_abs":       0.50,   # short leg max |delta|
}


def _limits(context: Dict[str, Any]) -> Dict[str, Any]:
    """Merge caller-supplied limits over defaults (non-destructive)."""
    overrides = context.get("limits", {}) or {}
    return {**_DEFAULTS, **overrides}


# ── Public API ────────────────────────────────────────────────────────────────

def validate_order(
    candidate: Dict[str, Any],
    context:   Dict[str, Any],
) -> ApprovalResult:
    """
    Run all pre-trade checks on *candidate* and return an ApprovalResult.

    Parameters
    ----------
    candidate : dict
        The trade candidate dict as produced by _generate_candidates /
        _select_candidates.  Expected keys (all optional — missing → skip check):
          symbol, template, credit, pop, dte, iv_rank, max_loss, spread_percent,
          liquidity_score, delta, bid, ask.
    context : dict
        Execution context forwarded from unified_engine.  May contain:
          "limits"  – dict of threshold overrides (see _DEFAULTS above)
          "equity"  – current paper equity float (used for relative max-loss)
          "dry_run" – bool; if True, validation still runs but won't hard-block

    Returns
    -------
    ApprovalResult
        .approved  – False means the order MUST be skipped.
        .reason    – human-readable primary reason (first failing gate).
        .flags     – all failing gate names.
    """
    lim   = _limits(context)
    flags: List[str] = []

    # ── Guard: required fields ────────────────────────────────────────────
    symbol   = candidate.get("symbol", "UNKNOWN")
    template = candidate.get("template", "unknown")

    # ── 1. Credit floor ──────────────────────────────────────────────────
    credit = float(candidate.get("credit") or 0)
    if credit < lim["min_credit"]:
        flags.append(f"low_credit(${credit:.2f}<${lim['min_credit']:.2f})")

    # ── 2. Probability of profit floor ───────────────────────────────────
    pop = float(candidate.get("pop") or 0)
    if pop < lim["min_pop"]:
        flags.append(f"low_pop({pop:.0%}<{lim['min_pop']:.0%})")

    # ── 3. DTE bounds ────────────────────────────────────────────────────
    dte = int(candidate.get("dte") or 0)
    if dte < lim["min_dte"]:
        flags.append(f"dte_too_low({dte}<{lim['min_dte']})")
    elif dte > lim["max_dte"]:
        flags.append(f"dte_too_high({dte}>{lim['max_dte']})")

    # ── 4. IV rank window ────────────────────────────────────────────────
    iv_rank = float(candidate.get("iv_rank") or 0)
    if iv_rank < lim["min_iv_rank"]:
        flags.append(f"iv_rank_too_low({iv_rank:.0f}<{lim['min_iv_rank']})")
    elif iv_rank > lim["max_iv_rank"]:
        flags.append(f"iv_rank_too_high({iv_rank:.0f}>{lim['max_iv_rank']})")

    # ── 5. Max loss cap (absolute + equity-relative) ─────────────────────
    max_loss = float(candidate.get("max_loss") or 0)
    if max_loss > lim["max_loss_usd"]:
        flags.append(f"max_loss_too_high(${max_loss:.0f}>${lim['max_loss_usd']:.0f})")
    equity = float(context.get("equity") or 0)
    if equity > 0 and max_loss > equity * 0.04:   # never risk > 4% in a single order
        flags.append(f"max_loss_exceeds_4pct_equity(${max_loss:.0f}>{equity*0.04:.0f})")

    # ── 6. Spread quality ────────────────────────────────────────────────
    spread_pct = float(candidate.get("spread_percent") or 0)
    if spread_pct > lim["max_spread_pct"]:
        flags.append(f"spread_too_wide({spread_pct:.1%}>{lim['max_spread_pct']:.1%})")

    # ── 7. Liquidity floor ───────────────────────────────────────────────
    liq = float(candidate.get("liquidity_score") or 0)
    if liq < lim["min_liquidity_score"]:
        flags.append(f"illiquid({liq:.2f}<{lim['min_liquidity_score']:.2f})")

    # ── 8. Delta guard (short-leg |delta| must not be too high) ──────────
    delta = candidate.get("delta")
    if delta is not None:
        if abs(float(delta)) > lim["max_delta_abs"]:
            flags.append(f"delta_too_high(|{float(delta):.2f}|>{lim['max_delta_abs']:.2f})")

    # ── 9. Sanity: non-zero credit for credit strategies ─────────────────
    credit_templates = {"put_credit_spread", "call_credit_spread", "iron_condor",
                        "short_put", "short_call"}
    if template in credit_templates and credit <= 0:
        flags.append("zero_credit_for_credit_strategy")

    # ── Result ────────────────────────────────────────────────────────────
    if not flags:
        logger.debug("validate_order APPROVED  %s %s", symbol, template)
        return ApprovalResult(approved=True, reason="all gates passed", flags=[])

    primary = flags[0]
    logger.warning(
        "validate_order BLOCKED  %s %s  flags=%s",
        symbol, template, flags,
    )
    return ApprovalResult(approved=False, reason=primary, flags=flags)
