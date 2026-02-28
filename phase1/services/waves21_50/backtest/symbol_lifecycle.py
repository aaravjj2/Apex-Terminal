"""
Wave 24 — Symbol Lifecycle & Survivorship Guardrails
Track symbol state (active, delisted, merged) to prevent survivorship bias.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import List, Optional, Dict, Any


class SymbolStatus(str, Enum):
    ACTIVE = "active"
    DELISTED = "delisted"
    MERGED = "merged"
    SUSPENDED = "suspended"
    PRE_IPO = "pre_ipo"


@dataclass
class SymbolMeta:
    symbol: str
    name: str
    status: SymbolStatus = SymbolStatus.ACTIVE
    ipo_date: Optional[str] = None      # ISO date
    delist_date: Optional[str] = None   # ISO date
    merge_into: Optional[str] = None    # successor symbol
    sector: str = ""
    exchange: str = ""

    def is_tradable_on(self, dt: str) -> bool:
        """Check if symbol was tradable on a given date."""
        if self.status == SymbolStatus.PRE_IPO:
            return False
        if self.ipo_date and dt < self.ipo_date:
            return False
        if self.delist_date and dt > self.delist_date:
            return False
        if self.status == SymbolStatus.DELISTED and self.delist_date and dt >= self.delist_date:
            return False
        return True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "name": self.name,
            "status": self.status.value,
            "ipo_date": self.ipo_date,
            "delist_date": self.delist_date,
            "merge_into": self.merge_into,
            "sector": self.sector,
            "exchange": self.exchange,
        }


class SymbolRegistry:
    """Registry of known symbols with lifecycle tracking."""

    def __init__(self) -> None:
        self._symbols: Dict[str, SymbolMeta] = {}

    def register(self, meta: SymbolMeta) -> None:
        self._symbols[meta.symbol] = meta

    def get(self, symbol: str) -> Optional[SymbolMeta]:
        return self._symbols.get(symbol)

    def is_tradable(self, symbol: str, dt: str) -> bool:
        meta = self._symbols.get(symbol)
        if meta is None:
            return True  # Unknown symbols assumed tradable
        return meta.is_tradable_on(dt)

    def survivorship_check(self, symbols: List[str], start_date: str) -> Dict[str, Any]:
        """Check for survivorship bias in a symbol list."""
        warnings: List[str] = []
        valid: List[str] = []
        excluded: List[str] = []

        for sym in symbols:
            meta = self._symbols.get(sym)
            if meta is None:
                valid.append(sym)
                continue

            if meta.status == SymbolStatus.DELISTED:
                if meta.delist_date and meta.delist_date < start_date:
                    excluded.append(sym)
                    warnings.append(f"{sym} was delisted on {meta.delist_date} (before backtest start)")
                else:
                    valid.append(sym)
            elif meta.ipo_date and meta.ipo_date > start_date:
                warnings.append(f"{sym} IPO on {meta.ipo_date} — lookback bias risk")
                valid.append(sym)
            else:
                valid.append(sym)

        return {
            "valid_symbols": valid,
            "excluded_symbols": excluded,
            "warnings": warnings,
            "survivorship_safe": len(warnings) == 0,
        }

    def list_all(self) -> List[SymbolMeta]:
        return list(self._symbols.values())

    def count(self) -> int:
        return len(self._symbols)


# Singleton
_registry: Optional[SymbolRegistry] = None

def get_symbol_registry() -> SymbolRegistry:
    global _registry
    if _registry is None:
        _registry = SymbolRegistry()
    return _registry
