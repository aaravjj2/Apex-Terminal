"""Node 1 — OSI (Options Symbology Initiative) deterministic parser."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime


class OSIParseError(ValueError):
    """Raised when OSI string fails structural validation."""


@dataclass(frozen=True)
class OSIComponents:
    osi_symbol: str
    underlying: str
    expiration_date: date
    option_type: str  # "Call" | "Put"
    strike_price: float


def parse_osi(osi_string: str) -> OSIComponents:
    """
    Parse a 21-character OSI string per Options Symbology Initiative rules.

    Layout: [0:6] root (space-padded), [6:12] YYMMDD, [12:13] C|P, [13:21] strike×1000.
    """
    raw = osi_string if len(osi_string) == 21 else osi_string.ljust(21)[:21]
    if len(raw) != 21:
        raise OSIParseError(f"OSI must be exactly 21 characters, got {len(osi_string)}")

    root = raw[0:6].rstrip()
    if not root:
        raise OSIParseError("Root symbol is empty after stripping padding")

    exp_slice = raw[6:12]
    if not exp_slice.isdigit():
        raise OSIParseError(f"Expiration segment must be YYMMDD digits, got {exp_slice!r}")

    right = raw[12:13]
    if right not in ("C", "P"):
        raise OSIParseError(f"Option type must be C or P, got {right!r}")

    strike_slice = raw[13:21]
    if not strike_slice.isdigit():
        raise OSIParseError(f"Strike segment must be 8 digits, got {strike_slice!r}")

    yy, mm, dd = int(exp_slice[0:2]), int(exp_slice[2:4]), int(exp_slice[4:6])
    expiration = date(2000 + yy, mm, dd)

    strike = int(strike_slice) / 1000.0
    option_type = "Call" if right == "C" else "Put"

    return OSIComponents(
        osi_symbol=raw,
        underlying=root,
        expiration_date=expiration,
        option_type=option_type,
        strike_price=strike,
    )


def osi_from_occ(occ: str) -> str:
    """Convert compact OCC (e.g. SPY251219C00600000) to padded 21-char OSI."""
    occ = occ.upper().strip()
    if len(occ) == 21 and occ[6:12].isdigit():
        return occ
    # SPY + YYMMDD + C/P + 8-digit strike
    import re

    m = re.match(r"^([A-Z]{1,6})(\d{6})([CP])(\d{8})$", occ.replace(" ", ""))
    if not m:
        raise OSIParseError(f"Cannot convert OCC to OSI: {occ!r}")
    root, yymmdd, right, strike = m.groups()
    return f"{root.ljust(6)[:6]}{yymmdd}{right}{strike}"
