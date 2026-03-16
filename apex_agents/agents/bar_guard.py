"""
BarGuard — bar_is_confirmed()
==============================
Guard function used in the brain's scoring loop to skip bars that are less
than 90% elapsed.  Scoring on an incomplete bar gives a noisy, forward-biased
signal; requiring ≥90% completion ensures the bar's OHLCV data is stable.

Usage (in _generate_candidates / any scoring loop):

    from apex_agents.agents.bar_guard import bar_is_confirmed

    if not bar_is_confirmed(bar_open_time, timeframe_seconds=300):
        continue    # skip this 5-min bar — only 60% elapsed
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Union

logger = logging.getLogger(__name__)

# Completion threshold.  Change to 0.95 for tighter enforcement.
_COMPLETION_THRESHOLD = 0.90


def bar_is_confirmed(
    bar_open_time: Union[datetime, float, int, str],
    timeframe_seconds: int = 300,
    threshold: float = _COMPLETION_THRESHOLD,
    _now: Optional[datetime] = None,   # injectable for unit tests
) -> bool:
    """
    Return True iff the bar starting at *bar_open_time* is at least
    *threshold* (default 90%) complete.

    Parameters
    ----------
    bar_open_time : datetime | float | int | str
        When the bar opened.  Accepts:
          - timezone-aware datetime
          - naive datetime (assumed UTC)
          - Unix timestamp (float/int)
          - ISO-8601 string
    timeframe_seconds : int
        Bar duration in seconds.  Common values:
          60 = 1m,  300 = 5m,  900 = 15m,  3600 = 1h,  86400 = 1d
    threshold : float
        Fraction of the bar that must have elapsed (default 0.90 = 90%).
    _now : datetime | None
        Override for the current time; used in tests to freeze the clock.

    Returns
    -------
    bool
        True  → bar is confirmed (≥ threshold elapsed) → safe to score
        False → bar still forming → skip this bar
    """
    if timeframe_seconds <= 0:
        return True     # unknown timeframe — let it through

    now_utc = (_now or datetime.now(timezone.utc)).replace(tzinfo=timezone.utc) \
        if (_now or datetime.now(timezone.utc)).tzinfo is None \
        else (_now or datetime.now(timezone.utc))

    # ── Normalise bar_open_time to tz-aware UTC datetime ─────────────────
    try:
        if isinstance(bar_open_time, (int, float)):
            open_dt = datetime.fromtimestamp(float(bar_open_time), tz=timezone.utc)
        elif isinstance(bar_open_time, str):
            open_dt = datetime.fromisoformat(bar_open_time)
            if open_dt.tzinfo is None:
                open_dt = open_dt.replace(tzinfo=timezone.utc)
        elif isinstance(bar_open_time, datetime):
            open_dt = bar_open_time
            if open_dt.tzinfo is None:
                open_dt = open_dt.replace(tzinfo=timezone.utc)
        else:
            logger.debug("bar_is_confirmed: unknown type %s — letting through", type(bar_open_time))
            return True
    except Exception as exc:
        logger.debug("bar_is_confirmed: could not parse bar_open_time=%r (%s) — letting through", bar_open_time, exc)
        return True

    # ── Compute elapsed fraction ──────────────────────────────────────────
    elapsed_seconds = (now_utc - open_dt).total_seconds()

    # A bar that opened in the future (clock skew) — let it through
    if elapsed_seconds < 0:
        return True

    fraction = elapsed_seconds / timeframe_seconds
    confirmed = fraction >= threshold

    if not confirmed:
        logger.debug(
            "bar_is_confirmed: SKIP — bar opened %s, elapsed=%.1fs / %ds (%.0f%% < %.0f%%)",
            open_dt.isoformat(), elapsed_seconds, timeframe_seconds,
            fraction * 100, threshold * 100,
        )
    return confirmed


# ── Allow `from apex_agents.agents.bar_guard import bar_is_confirmed` ─────────
# Also expose Optional so the function signature parses without a top-level import
from typing import Optional   # noqa: E402  (placed here to keep the module lean)
