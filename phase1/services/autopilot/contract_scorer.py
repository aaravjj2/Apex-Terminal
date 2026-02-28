"""
Contract Scorer — Liquidity-aware contract selection for Autopilot Brain v2.

Hard liquidity rules (reject if ANY fails):
  - bid == 0 or ask == 0 or bid is None or ask is None
  - spread_pct > max_spread_pct (default 8%)
  - mid < min_premium (default $0.15)
  - dte outside window (min_dte..max_dte)

Quality score components (0..100):
  - spread_score:   tighter spread → higher score (40% weight)
  - volume_score:   higher daily volume → higher score (20% weight)
  - delta_score:    delta closer to target_delta → higher score (25% weight)
  - dte_score:      prefer sweet spot 21-35 DTE (15% weight)

Selection:
  - Score all candidates, reject on hard rules first (with reason code)
  - Return sorted list: accepted (with score breakdown), rejected (with reason)
  - Never violate risk caps passed from the caller
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from .options_data_gateway import OptionSnapshot


# ── Config ────────────────────────────────────────────────────────────────────

@dataclass
class ScorerConfig:
    max_spread_pct: float = 8.0       # % — reject if (ask-bid)/mid*100 > this
    min_premium: float = 0.15         # $ mid price floor
    min_dte: int = 14
    max_dte: int = 45
    sweet_dte_lo: int = 21            # DTE sweet spot start
    sweet_dte_hi: int = 35            # DTE sweet spot end
    target_delta: float = 0.45        # ATM-ish delta (0.5 = exactly ATM call)
    delta_range: float = 0.30         # accept delta 0.15..0.75 for calls
    min_volume: int = 0               # 0 = no hard min
    weight_spread: float = 0.40
    weight_volume: float = 0.20
    weight_delta: float = 0.25
    weight_dte: float = 0.15


DEFAULT_CONFIG = ScorerConfig()


# ── Result models ─────────────────────────────────────────────────────────────

@dataclass
class ScoredContract:
    snapshot: OptionSnapshot
    score: float                       # 0..100
    spread_score: float
    volume_score: float
    delta_score: float
    dte_score: float
    rejection_code: Optional[str] = None   # None = accepted

    @property
    def accepted(self) -> bool:
        return self.rejection_code is None

    def to_dict(self) -> Dict[str, Any]:
        d = self.snapshot.to_dict()
        d.update({
            "score": round(self.score, 2),
            "spread_score": round(self.spread_score, 2),
            "volume_score": round(self.volume_score, 2),
            "delta_score": round(self.delta_score, 2),
            "dte_score": round(self.dte_score, 2),
            "rejection_code": self.rejection_code,
        })
        return d


@dataclass
class SelectionResult:
    symbol: str
    candidates_total: int
    candidates_accepted: int
    candidates_rejected: int
    rejection_counts: Dict[str, int] = field(default_factory=dict)
    winner: Optional[ScoredContract] = None
    top_candidates: List[ScoredContract] = field(default_factory=list)  # top 10

    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "candidates_total": self.candidates_total,
            "candidates_accepted": self.candidates_accepted,
            "candidates_rejected": self.candidates_rejected,
            "rejection_counts": self.rejection_counts,
            "winner": self.winner.to_dict() if self.winner else None,
            "top_candidates": [c.to_dict() for c in self.top_candidates],
        }


# ── Scoring functions ─────────────────────────────────────────────────────────

def _spread_score(spread_pct: Optional[float], max_spread: float) -> float:
    """Score 0..100 — lower spread → higher score. Linear from 0 to max_spread."""
    if spread_pct is None:
        return 0.0
    if spread_pct <= 0:
        return 100.0
    if spread_pct >= max_spread:
        return 0.0
    return round(100.0 * (1 - spread_pct / max_spread), 2)


def _volume_score(volume: int) -> float:
    """Score 0..100 using log scale. 0 vol → 0, 1000 vol → ~66, 10000 vol → ~100."""
    if volume <= 0:
        return 0.0
    # log10(1) = 0, log10(1000) = 3, log10(10000) = 4
    return round(min(100.0, 25.0 * math.log10(volume + 1)), 2)


def _delta_score(delta: Optional[float], option_type: str, target: float) -> float:
    """
    Score 0..100 for delta proximity to target.
    For puts: use -delta (absolute value); target still positive.
    """
    if delta is None:
        return 50.0  # neutral when no greeks

    d = abs(delta)  # calls 0..1, puts already absolute
    if delta < 0:
        # Put delta is negative; convert to 0..1
        d = -delta

    dist = abs(d - target)
    # Max distance we care about: 0.5 (from 0.0 to 0.5)
    score = max(0.0, 100.0 - (dist / 0.5 * 100.0))
    return round(score, 2)


def _dte_score(dte: int, sweet_lo: int, sweet_hi: int) -> float:
    """
    Score for DTE:
    - In sweet spot [sweet_lo, sweet_hi] → 100
    - Linear decay outside (floor 0)
    """
    if sweet_lo <= dte <= sweet_hi:
        return 100.0
    if dte < sweet_lo:
        # Decay: 0 DTE → 0, sweet_lo DTE → 100
        return round(max(0.0, 100.0 * dte / sweet_lo), 2)
    else:
        # Decay: sweet_hi → 100, sweet_hi*2 → 0
        decay_len = sweet_hi  # decay over same distance
        excess = dte - sweet_hi
        return round(max(0.0, 100.0 * (1 - excess / decay_len)), 2)


# ── Hard rule checks ──────────────────────────────────────────────────────────

def _hard_rule_rejection(snap: OptionSnapshot, cfg: ScorerConfig) -> Optional[str]:
    """
    Return a rejection code string if the contract fails any hard rule.
    Return None if it passes all hard rules.
    """
    # DTE bounds
    if snap.dte < cfg.min_dte:
        return "dte_too_short"
    if snap.dte > cfg.max_dte:
        return "dte_too_long"

    # Bid/ask presence
    if snap.bid is None or snap.bid <= 0:
        return "no_bid"
    if snap.ask is None or snap.ask <= 0:
        return "no_ask"

    # Minimum premium
    mid = snap.mid or ((snap.bid + snap.ask) / 2 if snap.bid and snap.ask else 0)
    if mid < cfg.min_premium:
        return "below_min_premium"

    # Spread pct
    if snap.spread_pct is not None and snap.spread_pct > cfg.max_spread_pct:
        return "spread_too_wide"

    # Volume floor (optional)
    if cfg.min_volume > 0 and snap.volume < cfg.min_volume:
        return "low_volume"

    return None


# ── Main scorer ───────────────────────────────────────────────────────────────

def score_contracts(
    snapshots: List[OptionSnapshot],
    option_type: str = "call",
    cfg: Optional[ScorerConfig] = None,
    symbol: Optional[str] = None,
) -> SelectionResult:
    """
    Score + select the best contract from a list of snapshots.

    Returns SelectionResult with winner and top_candidates (for UI drawer).
    """
    cfg = cfg or DEFAULT_CONFIG
    sym = symbol or (snapshots[0].underlying if snapshots else "?")

    type_filtered = [s for s in snapshots if s.option_type == option_type]
    candidates_total = len(type_filtered)

    scored: List[ScoredContract] = []
    rejection_counts: Dict[str, int] = {}

    for snap in type_filtered:
        # Hard rules
        rej = _hard_rule_rejection(snap, cfg)
        if rej:
            rejection_counts[rej] = rejection_counts.get(rej, 0) + 1
            # Still score it so we can show the drawer
            sc = _compute_score(snap, cfg)
            scored.append(ScoredContract(
                snapshot=snap,
                score=sc[0],
                spread_score=sc[1],
                volume_score=sc[2],
                delta_score=sc[3],
                dte_score=sc[4],
                rejection_code=rej,
            ))
            continue

        sc = _compute_score(snap, cfg)
        scored.append(ScoredContract(
            snapshot=snap,
            score=sc[0],
            spread_score=sc[1],
            volume_score=sc[2],
            delta_score=sc[3],
            dte_score=sc[4],
        ))

    accepted = [c for c in scored if c.accepted]
    rejected_count = sum(rejection_counts.values())

    # Sort accepted by score desc
    accepted.sort(key=lambda c: c.score, reverse=True)
    winner = accepted[0] if accepted else None

    # Top 10 overall (for drawer)
    all_sorted = sorted(scored, key=lambda c: c.score, reverse=True)
    top_candidates = all_sorted[:10]

    return SelectionResult(
        symbol=sym,
        candidates_total=candidates_total,
        candidates_accepted=len(accepted),
        candidates_rejected=rejected_count,
        rejection_counts=rejection_counts,
        winner=winner,
        top_candidates=top_candidates,
    )


def _compute_score(
    snap: OptionSnapshot,
    cfg: ScorerConfig,
) -> Tuple[float, float, float, float, float]:
    """Returns (total_score, spread_score, volume_score, delta_score, dte_score)."""
    ss = _spread_score(snap.spread_pct, cfg.max_spread_pct)
    vs = _volume_score(snap.volume)
    ds = _delta_score(snap.delta, snap.option_type, cfg.target_delta)
    dt = _dte_score(snap.dte, cfg.sweet_dte_lo, cfg.sweet_dte_hi)

    total = (
        ss * cfg.weight_spread
        + vs * cfg.weight_volume
        + ds * cfg.weight_delta
        + dt * cfg.weight_dte
    )
    return round(total, 2), ss, vs, ds, dt
