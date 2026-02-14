"""
Ticker normalization and resolution service.
Deterministic DEMO mode implementation with known collision detection.
"""
from typing import Dict, Set
from .models import TickerResolveResponse


# Known ticker normalizations (DEMO mode fixtures)
TICKER_NORMALIZATIONS: Dict[str, str] = {
    "BRK-B": "BRK.B",
    "BRK/B": "BRK.B",
    "brk-b": "BRK.B",
    "brk/b": "BRK.B",
    "BRK.B": "BRK.B",
    "AAPL": "AAPL",
    "aapl": "AAPL",
    "SPY": "SPY",
    "spy": "SPY",
    "TSLA": "TSLA",
    "tsla": "TSLA",
}

# Known ambiguous tickers (collision cases)
AMBIGUOUS_TICKERS: Set[str] = {
    "ON",  # Could be word "on" or "Onex Corporation"
    "IT",  # Could be word "it" or "Gartner Inc"
    "A",   # Could be letter or "Agilent Technologies"
}

# Known invalid tickers
KNOWN_VALID_TICKERS: Set[str] = {
    "AAPL", "BRK.B", "SPY", "TSLA", "MSFT", "GOOGL", "AMZN", "ON", "IT", "A"
}


def normalize_ticker(ticker: str) -> str:
    """
    Quick normalization: strip whitespace, convert slashes/hyphens to dots.
    """
    # Strip whitespace
    normalized = ticker.strip()
    
    # Replace common separators with dots
    normalized = normalized.replace("-", ".").replace("/", ".")
    
    # Check if we have a known normalization
    if normalized.upper() in TICKER_NORMALIZATIONS:
        return TICKER_NORMALIZATIONS[normalized.upper()]
    
    # Default: uppercase
    return normalized.upper()


def resolve_ticker(ticker: str) -> TickerResolveResponse:
    """
    Resolve a single ticker with collision detection.
    """
    # Normalize first
    normalized = normalize_ticker(ticker)
    
    # Check for ambiguous input (collision)
    if normalized.upper() in AMBIGUOUS_TICKERS:
        return TickerResolveResponse(
            ticker=normalized,
            normalized=normalized,
            confidence="low",
            reason="Ambiguous input: could be multiple securities",
            collision=True
        )
    
    # Check if ticker is known valid
    is_known = normalized in KNOWN_VALID_TICKERS or ticker.upper() in KNOWN_VALID_TICKERS
    
    if not is_known:
        # Unknown ticker
        return TickerResolveResponse(
            ticker=normalized,
            normalized=normalized,
            confidence="low",
            reason="Unknown ticker",
            collision=False
        )
    
    # High confidence resolution
    reason = "Normalized from user input" if normalized != ticker else "Exact match"
    return TickerResolveResponse(
        ticker=normalized,
        normalized=normalized,
        confidence="high",
        reason=reason,
        collision=False
    )
