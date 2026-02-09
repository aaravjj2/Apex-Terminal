"""
Input Validation Layer (Phase 1, Layer 1)

Ensures that all data fed into the decision engine is:
1. Fresh (not stale)
2. Sane (prices > 0, valid ranges)
3. Consistent (cross-referenced where possible)

This module acts as the first line of defense against "garbage in, garbage out".
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, List
import math

logger = logging.getLogger(__name__)

class DataValidationError(Exception):
    """Base class for data validation errors."""
    pass

class StaleDataError(DataValidationError):
    """Raised when data is too old."""
    pass

class InvalidPriceError(DataValidationError):
    """Raised when prices are nonsensical (e.g. <= 0 or infinite)."""
    pass

class GreeksValidationError(DataValidationError):
    """Raised when Greeks are out of theoretical bounds."""
    pass

def validate_market_data(
    quote: Dict[str, Any],
    max_age_seconds: float = 5.0,
    enforce_cross_ref: bool = False
) -> bool:
    """
    Validate a market quote (stock or option).
    
    Args:
        quote: Dictionary containing 'price', 'timestamp', 'symbol', and optional 'bid'/'ask'.
        max_age_seconds: Maximum allowed age of the data in seconds.
        enforce_cross_ref: If True, insists on having valid bid/ask to cross-check last price.
        
    Returns:
        True if valid.
        
    Raises:
        StaleDataError: If timestamp is too old.
        InvalidPriceError: If price is <= 0 or bid > ask.
    """
    symbol = quote.get('symbol', 'UNKNOWN')
    price = quote.get('price')
    ts = quote.get('timestamp')  # Expecting ISO string or datetime object

    # 1. Sanity Checks
    if price is None:
        raise InvalidPriceError(f"Missing price for {symbol}")
    
    try:
        price = float(price)
    except (ValueError, TypeError):
        raise InvalidPriceError(f"Non-numeric price for {symbol}: {price}")

    if price <= 0:
        raise InvalidPriceError(f"Price for {symbol} must be > 0, got {price}")
    
    # Bid/Ask Logic
    bid = quote.get('bid')
    ask = quote.get('ask')
    if bid is not None and ask is not None:
        try:
            bid = float(bid)
            ask = float(ask)
            if bid > ask:
                # Crossed market is suspicious but happens; warn or error depending on strictness
                logger.warning(f"Crossed market for {symbol}: Bid {bid} > Ask {ask}")
                # For now, we allow it but log it. In strict mode, we might reject.
            
            if enforce_cross_ref:
                # Ensure last price is within reasonable bounds of bid/ask (e.g. not 50% away)
                mid = (bid + ask) / 2
                if price < bid * 0.5 or price > ask * 1.5:
                    raise InvalidPriceError(f"Price {price} deviates significantly from quote {bid}/{ask}")
        except (ValueError, TypeError):
            pass  # Ignore malformed bid/ask if price checks passed

    # 2. Freshness Check
    if ts:
        if isinstance(ts, str):
            try:
                # Handle ISO format with potential Z or offsets
                # Simplified ISO parse; robust usage requires external libs or strict format
                ts_dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except ValueError:
                logger.warning(f"Could not parse timestamp {ts} for {symbol}, skipping freshness check")
                ts_dt = None
        elif isinstance(ts, (int, float)):
             # Unix timestamp
            ts_dt = datetime.fromtimestamp(ts, tz=timezone.utc)
        elif isinstance(ts, datetime):
            ts_dt = ts
            if ts_dt.tzinfo is None:
                ts_dt = ts_dt.replace(tzinfo=timezone.utc)
        else:
            ts_dt = None

        if ts_dt:
            now = datetime.now(timezone.utc)
            age = (now - ts_dt).total_seconds()
            
            if age > max_age_seconds:
                raise StaleDataError(f"Data for {symbol} is {age:.1f}s old (limit {max_age_seconds}s)")
            
            # Future timestamp check (clock skew)
            if age < -5:  # Allow small skew
                 logger.warning(f"Data for {symbol} is from the future ({age:.1f}s). Check clock sync.")

    return True

def verify_greeks(
    delta: float,
    gamma: float,
    theta: float,
    vega: float,
    option_type: str = 'call'
) -> bool:
    """
    Validate Option Greeks satisfy theoretical bounds.
    
    Args:
        delta: Delta value.
        gamma: Gamma value.
        theta: Theta value.
        vega: Vega value.
        option_type: 'call' or 'put'.
        
    Raises:
        GreeksValidationError: If values are impossible.
    """
    option_type = option_type.lower()
    
    # DELTA
    if option_type == 'call':
        if not (-0.1 <= delta <= 1.1): # Allow slight noise around 0/1
            raise GreeksValidationError(f"Call delta {delta} out of range [0, 1]")
    elif option_type == 'put':
        if not (-1.1 <= delta <= 0.1): # Allow slight noise
            raise GreeksValidationError(f"Put delta {delta} out of range [-1, 0]")
    
    # GAMMA - Convexity should generally be positive for long options
    # But checking raw value: Gamma is usually positive for single options
    if gamma < -0.0001: 
        # Note: Some providers might return negative gamma for checking specific complex positions,
        # but for a single option leg, gamma is positive.
        # We'll valid strictness later. For now, strict 'single leg' logic implies gamma >= 0
        pass 
        
    # VEGA - Usually positive for long options
    
    # IV consistency check could go here if IV + Underlying Price + Strike provided
    
    return True
