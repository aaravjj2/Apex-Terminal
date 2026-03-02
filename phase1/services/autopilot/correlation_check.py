"""
Correlation-aware portfolio construction (Phase 4b).

Reject new positions if correlation > 0.7 with any existing position.
Uses recent returns from data provider.
"""

import logging
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)

CORRELATION_THRESHOLD = 0.7
MIN_RETURNS = 10


def _compute_returns(prices: List[float]) -> List[float]:
    """Compute log returns from price series."""
    if len(prices) < 2:
        return []
    returns = []
    for i in range(1, len(prices)):
        if prices[i - 1] and prices[i - 1] > 0 and prices[i] and prices[i] > 0:
            returns.append((prices[i] - prices[i - 1]) / prices[i - 1])
    return returns


def _pearson(a: List[float], b: List[float]) -> float:
    """Compute Pearson correlation; return 0 if insufficient data."""
    n = min(len(a), len(b))
    if n < MIN_RETURNS:
        return 0.0
    a, b = a[:n], b[:n]
    ma = sum(a) / n
    mb = sum(b) / n
    va = sum((x - ma) ** 2 for x in a) / n
    vb = sum((x - mb) ** 2 for x in b) / n
    if va <= 0 or vb <= 0:
        return 0.0
    cov = sum((a[i] - ma) * (b[i] - mb) for i in range(n)) / n
    return max(-1.0, min(1.0, cov / (va ** 0.5 * vb ** 0.5)))


def check_correlation(
    candidate_symbol: str,
    existing_underlyings: List[str],
    threshold: float = CORRELATION_THRESHOLD,
    lookback_days: int = 60,
) -> Tuple[bool, Optional[str]]:
    """
    Reject if candidate correlates > threshold with any existing position.

    Returns:
        (allowed, reason) - allowed=False if correlation too high
    """
    if not existing_underlyings:
        return True, None

    try:
        from .data_fetcher import get_data_provider
        provider = get_data_provider()
        cand_prices = provider.get_price_history(candidate_symbol, days=lookback_days)
        cand_rets = _compute_returns(cand_prices)
        if len(cand_rets) < MIN_RETURNS:
            return True, None  # Fail open if insufficient data
        for sym in existing_underlyings:
            if sym == candidate_symbol:
                continue
            try:
                prices = provider.get_price_history(sym, days=lookback_days)
                rets = _compute_returns(prices)
                if len(rets) < MIN_RETURNS:
                    continue
                corr = _pearson(cand_rets, rets)
                if corr > threshold:
                    return False, f"Correlation {corr:.2f} > {threshold} with {sym}"
            except Exception:
                continue
        return True, None
    except Exception as e:
        logger.debug(f"Correlation check skipped: {e}")
        return True, None  # Fail open
