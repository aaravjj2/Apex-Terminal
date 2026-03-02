"""
Adaptive position sizing (Phase 4a) — Kelly criterion from v3_store history.

Uses rolling 30-trade window for win_rate, avg_win, avg_loss.
position_size = min(kelly_fraction * equity * risk_scalar, max_position_usd)
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def compute_kelly_contracts(
    equity: float,
    premium_per_contract: float,
    risk_scalar: float = 0.5,
    max_position_usd: float = 150.0,
    min_contracts: int = 1,
    max_contracts: int = 5,
    window: int = 30,
) -> int:
    """
    Compute position size in contracts using fractional Kelly.

    Args:
        equity: Account equity (e.g. paper_equity)
        premium_per_contract: Premium per contract in $ (e.g. 2.50 = $250 per contract)
        risk_scalar: Fraction of full Kelly to use (0.5 = half-Kelly, conservative)
        max_position_usd: Cap position size in USD
        min_contracts: Minimum contracts (fallback when no history)
        max_contracts: Maximum contracts
        window: Number of recent trades to use (default 30)

    Returns:
        Number of contracts (1-N)
    """
    from .v3_store import trades_for_kelly

    trades = trades_for_kelly(limit=window)
    if len(trades) < 5:
        return min_contracts

    wins = [t for t in trades if (t.get("realized_pnl") or 0) > 0]
    losses = [t for t in trades if (t.get("realized_pnl") or 0) < 0]
    n = len(trades)
    win_rate = len(wins) / n if n else 0
    avg_win = sum(w["realized_pnl"] for w in wins) / len(wins) if wins else 0
    avg_loss = abs(sum(l["realized_pnl"] for l in losses) / len(losses)) if losses else 1.0

    if avg_win <= 0:
        return min_contracts

    kelly_fraction = (win_rate * avg_win - (1 - win_rate) * avg_loss) / avg_win
    kelly_fraction = max(0.0, min(kelly_fraction, 1.0))
    kelly_fraction *= risk_scalar

    position_usd = kelly_fraction * equity
    position_usd = min(position_usd, max_position_usd)

    cost_per_contract = premium_per_contract * 100 if premium_per_contract else 150.0
    if cost_per_contract <= 0:
        return min_contracts
    contracts = max(min_contracts, min(max_contracts, int(position_usd / cost_per_contract)))

    logger.debug(
        f"Kelly sizing: win_rate={win_rate:.2f} avg_win=${avg_win:.0f} avg_loss=${avg_loss:.0f} "
        f"kelly={kelly_fraction:.2%} -> {contracts} contracts"
    )
    return contracts
