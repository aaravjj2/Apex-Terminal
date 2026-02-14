"""
Ticker resolution and normalization utilities.

Provides deterministic ticker normalization to handle:
- Mixed case inputs (AAPL, aapl, AaPl)
- Whitespace
- Separator variants (BRK.B, BRK-B, BRK/B)
- English word collisions (A, I, ON, IT, ARE)
"""

import json
import re
from pathlib import Path
from typing import Dict, List, Tuple, Optional

# Load lexicon once at module level
LEXICON_PATH = Path(__file__).parent / "ticker_lexicon.json"
with open(LEXICON_PATH) as f:
    _lexicon_data = json.load(f)
    CANONICAL_TICKERS: List[Dict] = _lexicon_data["canonical_tickers"]

# Build lookup maps
_ticker_to_canonical: Dict[str, str] = {}
_collision_tickers: set = set()

for entry in CANONICAL_TICKERS:
    canonical = entry["ticker"]
    for alias in entry["aliases"]:
        _ticker_to_canonical[alias.upper()] = canonical
    if entry.get("collision"):
        _collision_tickers.add(canonical)


def normalize_separator(raw: str) -> str:
    """Convert BRK-B, BRK/B → BRK.B (OCC standard dot notation)."""
    # Replace dash or slash between letters/numbers with dot
    normalized = re.sub(r'([A-Z0-9])[-/]([A-Z0-9])', r'\1.\2', raw.upper())
    return normalized


def resolve_ticker(input_str: str) -> Dict[str, any]:
    """
    Resolve and normalize a ticker input.
    
    Returns:
        {
            "ticker": str,           # Canonical ticker (e.g., "BRK.B")
            "normalized": str,       # Normalized form used for resolution
            "confidence": str,       # "high" | "low"
            "reason": str,           # Human-readable explanation
            "collision": bool,       # True if ticker is an English word
            "company": str | None,   # Company name if known
        }
    
    Rules (deterministic):
    1. Trim whitespace
    2. Uppercase
    3. Normalize separators (dash/slash → dot)
    4. Look up in lexicon
    5. If collision ticker: confidence=low
    6. If unknown: confidence=low
    """
    # Step 1-2: Trim + uppercase
    trimmed = input_str.strip()
    if not trimmed:
        return {
            "ticker": "",
            "normalized": "",
            "confidence": "low",
            "reason": "Empty input",
            "collision": False,
            "company": None,
        }
    
    upper = trimmed.upper()
    
    # Step 3: Normalize separators
    normalized = normalize_separator(upper)
    
    # Step 4: Look up in lexicon
    canonical = _ticker_to_canonical.get(normalized)
    
    if canonical:
        # Known ticker
        entry = next((e for e in CANONICAL_TICKERS if e["ticker"] == canonical), None)
        is_collision = canonical in _collision_tickers
        
        # If collision ticker, require user confirmation
        confidence = "low" if is_collision else "high"
        
        # Determine reason string
        if is_collision:
            reason = f"Ambiguous input: '{input_str}' is a collision ticker ({canonical}) — also an English word"
        elif normalized != upper:
            # Separator normalization happened (e.g. BRK-B → BRK.B)
            reason = f"Normalized '{input_str}' → '{canonical}' (separator standardized)"
        elif input_str.strip() != canonical:
            reason = f"Normalized '{input_str}' → '{canonical}'"
        else:
            reason = f"Resolved '{input_str}' → '{canonical}'"
        
        return {
            "ticker": canonical,
            "normalized": normalized,
            "confidence": confidence,
            "reason": reason,
            "collision": is_collision,
            "company": entry.get("company") if entry else None,
        }
    else:
        # Unknown ticker
        return {
            "ticker": normalized,  # Use normalized form as-is
            "normalized": normalized,
            "confidence": "low",
            "reason": f"Unknown ticker '{normalized}' (not in lexicon)",
            "collision": False,
            "company": None,
        }


def resolve_ticker_batch(inputs: List[str]) -> List[Dict[str, any]]:
    """Resolve multiple tickers in one call."""
    return [resolve_ticker(t) for t in inputs]


def get_normalized_form(input_str: str) -> str:
    """Quick helper to get just the normalized ticker string."""
    result = resolve_ticker(input_str)
    return result["ticker"]


# ============================================================================
# OBJECTIVE H: Finance Lexicon Disambiguation (v1.12)
# ============================================================================

def classify_token(input_str: str) -> Dict[str, any]:
    """
    Classify a token as TICKER, WORD, AMBIGUOUS, or INVALID.
    
    Deterministic rules (no ML/LLM):
    - INVALID: Empty or contains only whitespace/special chars
    - TICKER: Known ticker in lexicon, not a collision word
    - AMBIGUOUS: Known ticker in lexicon AND marked as collision (e.g., A, I, ON, IT, ARE)
    - WORD: Not in lexicon, appears to be an English word
    
    Returns:
        {
            "classification": "TICKER" | "WORD" | "AMBIGUOUS" | "INVALID",
            "ticker": str | None,         # Canonical ticker if applicable
            "confidence": str,             # "high" | "low" | "none"
            "reason": str,                 # Human-readable explanation
            "company": str | None,         # Company name if known
            "disambiguation_needed": bool, # True for AMBIGUOUS classification
        }
    """
    trimmed = input_str.strip()
    
    # Rule 1: INVALID - empty or only special characters
    if not trimmed:
        return {
            "classification": "INVALID",
            "ticker": None,
            "confidence": "none",
            "reason": "Empty input",
            "company": None,
            "disambiguation_needed": False,
        }
    
    # Check if contains only special characters (no alphanumerics)
    if not re.search(r'[A-Za-z0-9]', trimmed):
        return {
            "classification": "INVALID",
            "ticker": None,
            "confidence": "none",
            "reason": "No alphanumeric characters",
            "company": None,
            "disambiguation_needed": False,
        }
    
    # Use existing resolver to check lexicon
    resolution = resolve_ticker(trimmed)
    canonical = resolution["ticker"]
    normalized = resolution["normalized"]
    
    # If found in lexicon
    if resolution["confidence"] != "low" or normalized in _ticker_to_canonical:
        # Check if it's a collision ticker
        if resolution["collision"]:
            # Rule 2: AMBIGUOUS - ticker exists but is also an English word
            return {
                "classification": "AMBIGUOUS",
                "ticker": canonical,
                "confidence": "low",
                "reason": f"'{trimmed}' is both a valid ticker ({canonical}) and an English word",
                "company": resolution.get("company"),
                "disambiguation_needed": True,
            }
        else:
            # Rule 3: TICKER - unambiguous ticker in lexicon
            return {
                "classification": "TICKER",
                "ticker": canonical,
                "confidence": "high",
                "reason": f"Resolved to ticker {canonical}",
                "company": resolution.get("company"),
                "disambiguation_needed": False,
            }
    
    # Not in lexicon
    # Rule 4: WORD - assume it's an English word or invalid ticker
    # (In DEMO mode, we treat unknown tokens as potential words rather than invalid)
    return {
        "classification": "WORD",
        "ticker": None,
        "confidence": "none",
        "reason": f"'{trimmed}' not found in ticker lexicon, interpreting as word",
        "company": None,
        "disambiguation_needed": False,
    }


def classify_tokens_batch(inputs: List[str]) -> List[Dict[str, any]]:
    """Classify multiple tokens in one call."""
    return [classify_token(t) for t in inputs]

