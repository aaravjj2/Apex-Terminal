from typing import Any, List
from .types import OptionContract

def round_price(price: float) -> float:
    """Deterministic rounding to 2 decimal places."""
    return round(price, 2)

def contract_sort_key(c: OptionContract) -> str:
    """Stable sort key for OptionContract."""
    # PRIMARY: Expiry (Ascending)
    # SECONDARY: Distance from ATM (Ascending - need underlying price to compute external, 
    # but here we rely on pre-filtering or pass context.
    # For a pure contract key:
    return f"{c.expiry.isoformat()}|{c.right.value}|{c.strike:010.2f}|{c.contract_id}"

def safe_divide(num: float, den: float, default: float = 0.0) -> float:
    if den == 0:
        return default
    return num / den
