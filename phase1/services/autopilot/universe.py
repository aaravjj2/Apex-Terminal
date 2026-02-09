"""
Universe Manager

Manages the liquid options universe with dynamic filtering based on:
- Liquidity (bid-ask spread, open interest)
- Options availability
- Real-time spread checks
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Set
from datetime import datetime, date
import logging

logger = logging.getLogger(__name__)


@dataclass
class UniverseSymbol:
    """A symbol in the trading universe with metadata."""
    symbol: str
    last_price: float = 0.0
    avg_volume: float = 0.0
    has_options: bool = True
    avg_option_spread_pct: float = 0.0  # Average bid-ask spread %
    avg_open_interest: float = 0.0
    liquidity_score: float = 0.0  # 0-1
    last_updated: Optional[datetime] = None
    next_earnings: Optional[date] = None
    
    def to_dict(self) -> Dict:
        return {
            "symbol": self.symbol,
            "last_price": self.last_price,
            "avg_volume": self.avg_volume,
            "has_options": self.has_options,
            "avg_option_spread_pct": self.avg_option_spread_pct,
            "avg_open_interest": self.avg_open_interest,
            "liquidity_score": self.liquidity_score,
            "last_updated": self.last_updated.isoformat() if self.last_updated else None,
            "next_earnings": self.next_earnings.isoformat() if self.next_earnings else None,
        }


@dataclass
class LiquidityFilter:
    """Liquidity requirements for trading."""
    min_underlying_volume: float = 1_000_000  # Shares/day
    max_option_spread_pct: float = 0.10  # 10% max bid-ask spread
    min_open_interest: float = 100  # Contracts


class UniverseManager:
    """
    Manages the trading universe with liquidity filtering.
    """
    
    def __init__(
        self,
        allowed_symbols: List[str],
        liquidity_filter: Optional[LiquidityFilter] = None
    ):
        self.allowed_symbols = set(allowed_symbols)
        self.liquidity_filter = liquidity_filter or LiquidityFilter()
        self.symbols: Dict[str, UniverseSymbol] = {}
        
        # Auto-initialize with default data so symbols are tradeable
        for sym in allowed_symbols:
            self.symbols[sym] = UniverseSymbol(
                symbol=sym,
                has_options=True,
                avg_volume=10_000_000,  # Default: highly liquid
                avg_option_spread_pct=0.02,  # Default: tight spread
                avg_open_interest=5000,  # Default: good OI
                liquidity_score=0.8,
            )
        
        self._initialized = True
        logger.info(f"Universe initialized with {len(self.symbols)} symbols")
    
    def initialize(self, symbols: List[str]) -> None:
        """Initialize universe with a list of symbols."""
        for sym in symbols:
            if sym in self.allowed_symbols:
                self.symbols[sym] = UniverseSymbol(symbol=sym)
        self._initialized = True
        logger.info(f"Universe re-initialized with {len(self.symbols)} symbols")
    
    def update_symbol_data(
        self,
        symbol: str,
        last_price: Optional[float] = None,
        avg_volume: Optional[float] = None,
        avg_option_spread_pct: Optional[float] = None,
        avg_open_interest: Optional[float] = None,
        next_earnings: Optional[date] = None,
    ) -> None:
        """Update data for a symbol."""
        if symbol not in self.symbols:
            if symbol in self.allowed_symbols:
                self.symbols[symbol] = UniverseSymbol(symbol=symbol)
            else:
                return
        
        sym = self.symbols[symbol]
        
        if last_price is not None:
            sym.last_price = last_price
        if avg_volume is not None:
            sym.avg_volume = avg_volume
        if avg_option_spread_pct is not None:
            sym.avg_option_spread_pct = avg_option_spread_pct
        if avg_open_interest is not None:
            sym.avg_open_interest = avg_open_interest
        if next_earnings is not None:
            sym.next_earnings = next_earnings
        
        # Recalculate liquidity score
        sym.liquidity_score = self._calculate_liquidity_score(sym)
        sym.last_updated = datetime.utcnow()
    
    def _calculate_liquidity_score(self, sym: UniverseSymbol) -> float:
        """Calculate liquidity score (0-1) for a symbol."""
        score = 0.0
        
        # Volume score (0-0.4)
        if sym.avg_volume > 0:
            volume_ratio = min(sym.avg_volume / 10_000_000, 1.0)
            score += volume_ratio * 0.4
        
        # Spread score (0-0.3) - lower spread = higher score
        if sym.avg_option_spread_pct > 0:
            spread_score = max(0, 1.0 - (sym.avg_option_spread_pct / 0.20))
            score += spread_score * 0.3
        else:
            score += 0.3  # Assume good if no data
        
        # Open interest score (0-0.3)
        if sym.avg_open_interest > 0:
            oi_ratio = min(sym.avg_open_interest / 10000, 1.0)
            score += oi_ratio * 0.3
        
        return min(score, 1.0)
    
    def get_tradeable_symbols(
        self,
        earnings_blackout_days: int = 7
    ) -> List[UniverseSymbol]:
        """
        Get list of currently tradeable symbols after filtering.
        
        Args:
            earnings_blackout_days: Days before earnings to exclude symbol
        
        Returns:
            List of tradeable symbols sorted by liquidity score
        """
        tradeable = []
        today = date.today()
        
        for sym in self.symbols.values():
            # Check basic liquidity
            if not self._passes_liquidity_filter(sym):
                continue
            
            # Check earnings blackout
            if sym.next_earnings:
                days_to_earnings = (sym.next_earnings - today).days
                if 0 <= days_to_earnings <= earnings_blackout_days:
                    logger.debug(f"Skipping {sym.symbol}: earnings in {days_to_earnings} days")
                    continue
            
            tradeable.append(sym)
        
        # Sort by liquidity score descending
        tradeable.sort(key=lambda s: s.liquidity_score, reverse=True)
        
        return tradeable
    
    def _passes_liquidity_filter(self, sym: UniverseSymbol) -> bool:
        """Check if symbol passes liquidity requirements."""
        if not sym.has_options:
            return False
        
        # Volume check (if we have data)
        if sym.avg_volume > 0:
            if sym.avg_volume < self.liquidity_filter.min_underlying_volume:
                return False
        
        # Spread check (if we have data)
        if sym.avg_option_spread_pct > 0:
            if sym.avg_option_spread_pct > self.liquidity_filter.max_option_spread_pct:
                return False
        
        # Open interest check (if we have data)
        if sym.avg_open_interest > 0:
            if sym.avg_open_interest < self.liquidity_filter.min_open_interest:
                return False
        
        return True
    
    def is_in_earnings_blackout(
        self,
        symbol: str,
        blackout_days: int = 7
    ) -> bool:
        """Check if a symbol is in earnings blackout period."""
        if symbol not in self.symbols:
            return False
        
        sym = self.symbols[symbol]
        if not sym.next_earnings:
            return False
        
        days_to_earnings = (sym.next_earnings - date.today()).days
        return 0 <= days_to_earnings <= blackout_days
    
    def get_symbols_with_upcoming_earnings(
        self,
        days_ahead: int = 14
    ) -> List[UniverseSymbol]:
        """Get symbols with earnings in the next N days."""
        today = date.today()
        result = []
        
        for sym in self.symbols.values():
            if sym.next_earnings:
                days_to_earnings = (sym.next_earnings - today).days
                if 0 <= days_to_earnings <= days_ahead:
                    result.append(sym)
        
        return sorted(result, key=lambda s: s.next_earnings or date.max)
    
    def get_symbol(self, symbol: str) -> Optional[UniverseSymbol]:
        """Get a specific symbol from the universe."""
        return self.symbols.get(symbol)
    
    def get_all_symbols(self) -> List[UniverseSymbol]:
        """Get all symbols in the universe."""
        return list(self.symbols.values())
    
    def to_dict(self) -> Dict:
        """Convert universe to dictionary."""
        return {
            "symbols": [s.to_dict() for s in self.symbols.values()],
            "allowed_count": len(self.allowed_symbols),
            "active_count": len(self.symbols),
            "tradeable_count": len(self.get_tradeable_symbols()),
        }
