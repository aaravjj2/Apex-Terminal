"""
Portfolio valuation service (v1.21 deterministic).

Computes portfolio net value and PnL using deterministic pricing fixtures.
All computations use Decimal for precision and stable ordering for reproducibility.
"""

from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime
from typing import List, Dict
import hashlib

from .schemas import (
    Portfolio,
    Position,
    ValuationSnapshot,
    PositionValuation,
    ValuationInputs,
)
from .pricing import load_demo_prices, get_pricing_source_label

def _quantize(value: Decimal, policy: str = "0.01") -> Decimal:
    """Quantize decimal to specified precision (default 0.01 for 2 decimal places)"""
    return value.quantize(Decimal(policy), rounding=ROUND_HALF_UP)

def compute_portfolio_valuation(portfolio: Portfolio) -> ValuationSnapshot:
    """
    Compute deterministic valuation for a portfolio.
    
    Uses:
    - Deterministic pricing from fixtures (not live market data)
    - Decimal arithmetic internally
    - Stable ordering (by symbol ascending)
    - Explicit rounding policy at serialization boundary
    
    Args:
        portfolio: Portfolio object with positions
    
    Returns:
        ValuationSnapshot with net value, PnL, and per-position details
    """
    # Load deterministic prices
    prices, as_of, source_checksum = load_demo_prices()
    rounding_policy = "0.01"
    
    # Valuation inputs (for determinism verification)
    valuation_inputs = ValuationInputs(
        pricing_source=get_pricing_source_label(),
        source_checksum=source_checksum,
        rounding_policy=rounding_policy,
        as_of=as_of
    )
    
    # Compute per-position valuations
    per_position: List[PositionValuation] = []
    
    # Sort positions by symbol for stable ordering
    sorted_positions = sorted(portfolio.positions, key=lambda p: p.symbol)
    
    for position in sorted_positions:
        current_price = prices.get(position.symbol)
        if current_price is None:
            # If no price available, use cost basis as fallback (no PnL)
            current_price = position.average_cost_basis
        
        # Compute market value and unrealized PnL
        quantity = position.quantity
        cost_basis = position.average_cost_basis * quantity
        market_value = quantity * current_price
        unrealized_pnl = market_value - cost_basis
        
        # Quantize for output
        pos_val = PositionValuation(
            symbol=position.symbol,
            quantity=_quantize(quantity, rounding_policy),
            cost_basis=_quantize(position.average_cost_basis, rounding_policy),
            current_price=_quantize(current_price, rounding_policy),
            market_value=_quantize(market_value, rounding_policy),
            unrealized_pnl=_quantize(unrealized_pnl, rounding_policy)
        )
        per_position.append(pos_val)
    
    # Aggregate totals
    positions_market_value = sum((p.market_value for p in per_position), Decimal("0"))
    pnl_total = sum((p.unrealized_pnl for p in per_position), Decimal("0"))
    cash_balance = portfolio.cash_balance
    net_value = cash_balance + positions_market_value
    
    # Generate snapshot ID (deterministic based on portfolio_id + as_of)
    snapshot_id_data = f"{portfolio.portfolio_id}:{as_of.isoformat()}"
    snapshot_id = f"SNAP-{hashlib.sha256(snapshot_id_data.encode()).hexdigest()[:12]}"
    
    # Create snapshot
    snapshot = ValuationSnapshot(
        snapshot_id=snapshot_id,
        portfolio_id=portfolio.portfolio_id,
        as_of=as_of,
        net_value=_quantize(net_value, rounding_policy),
        pnl_total=_quantize(pnl_total, rounding_policy),
        cash_balance=_quantize(cash_balance, rounding_policy),
        positions_market_value=_quantize(positions_market_value, rounding_policy),
        per_position=per_position,
        valuation_inputs=valuation_inputs
    )
    
    # Compute content hash
    snapshot.content_hash = snapshot.compute_hash()
    
    return snapshot
