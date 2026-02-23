"""
Portfolio Construction — Wave 12
Portfolio allocator with exposure caps, volatility targeting,
correlation-aware diversification. 8-10 symbols.
"""

import math
import logging
from typing import Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


@dataclass
class ExposureLimit:
    max_symbol_pct: float = 15.0      # Max single symbol exposure %
    max_sector_pct: float = 35.0      # Max single sector exposure %
    max_gross_pct: float = 100.0      # Max total exposure %
    max_positions: int = 10            # Max concurrent positions
    vol_target_annual: float = 15.0    # Target annualized volatility %

    def to_dict(self) -> dict:
        return {
            "max_symbol_pct": self.max_symbol_pct,
            "max_sector_pct": self.max_sector_pct,
            "max_gross_pct": self.max_gross_pct,
            "max_positions": self.max_positions,
            "vol_target_annual": self.vol_target_annual,
        }


# Standard sector classification for the default universe
SYMBOL_SECTORS = {
    "AAPL": "Technology",
    "MSFT": "Technology",
    "GOOGL": "Technology",
    "AMZN": "Consumer Discretionary",
    "NVDA": "Technology",
    "META": "Technology",
    "TSLA": "Consumer Discretionary",
    "JPM": "Financials",
    "V": "Financials",
    "UNH": "Healthcare",
}


@dataclass
class AllocationResult:
    symbol: str
    weight: float  # 0-1 fraction
    shares: int
    dollar_amount: float
    sector: str
    vol_contribution: float = 0.0

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "weight": round(self.weight, 4),
            "shares": self.shares,
            "dollar_amount": round(self.dollar_amount, 2),
            "sector": self.sector,
            "vol_contribution": round(self.vol_contribution, 4),
        }


@dataclass
class ExposureDashboard:
    total_exposure_pct: float
    symbol_exposures: dict[str, float]
    sector_exposures: dict[str, float]
    position_count: int
    portfolio_vol: float
    limit_breaches: list[str]

    def to_dict(self) -> dict:
        return {
            "total_exposure_pct": round(self.total_exposure_pct, 2),
            "symbol_exposures": {k: round(v, 2) for k, v in self.symbol_exposures.items()},
            "sector_exposures": {k: round(v, 2) for k, v in self.sector_exposures.items()},
            "position_count": self.position_count,
            "portfolio_vol": round(self.portfolio_vol, 4),
            "limit_breaches": self.limit_breaches,
        }


class PortfolioAllocator:
    """
    Portfolio allocator with exposure caps, volatility targeting,
    and correlation-aware diversification.
    """

    def __init__(self, limits: Optional[ExposureLimit] = None):
        self.limits = limits or ExposureLimit()
        self._volatilities: dict[str, float] = {}
        self._correlations: dict[tuple[str, str], float] = {}

    def set_volatilities(self, vols: dict[str, float]) -> None:
        """Set annualized volatilities for symbols from daily bars."""
        self._volatilities = vols.copy()

    def set_correlations(self, corrs: dict[tuple[str, str], float]) -> None:
        """Set pairwise correlations."""
        self._correlations = corrs.copy()

    def compute_volatility_from_bars(self, daily_returns: list[float]) -> float:
        """Compute annualized volatility from daily returns."""
        if len(daily_returns) < 2:
            return 0.0
        mean = sum(daily_returns) / len(daily_returns)
        variance = sum((r - mean) ** 2 for r in daily_returns) / (len(daily_returns) - 1)
        daily_vol = math.sqrt(variance)
        return daily_vol * math.sqrt(252)

    def compute_correlation(self, returns_a: list[float], returns_b: list[float]) -> float:
        """Compute correlation between two return series."""
        n = min(len(returns_a), len(returns_b))
        if n < 2:
            return 0.0
        a = returns_a[:n]
        b = returns_b[:n]
        mean_a = sum(a) / n
        mean_b = sum(b) / n
        cov = sum((a[i] - mean_a) * (b[i] - mean_b) for i in range(n)) / (n - 1)
        std_a = math.sqrt(sum((x - mean_a) ** 2 for x in a) / (n - 1))
        std_b = math.sqrt(sum((x - mean_b) ** 2 for x in b) / (n - 1))
        if std_a == 0 or std_b == 0:
            return 0.0
        return cov / (std_a * std_b)

    def allocate_equal_weight(
        self,
        symbols: list[str],
        total_capital: float,
        prices: dict[str, float],
    ) -> list[AllocationResult]:
        """Equal-weight allocation with exposure limit enforcement."""
        n = min(len(symbols), self.limits.max_positions)
        symbols = symbols[:n]
        weight = 1.0 / n if n > 0 else 0.0

        # Enforce max symbol exposure
        max_weight = self.limits.max_symbol_pct / 100.0
        weight = min(weight, max_weight)

        results = []
        for sym in symbols:
            price = prices.get(sym, 1.0)
            dollar_amount = total_capital * weight
            shares = int(dollar_amount / price) if price > 0 else 0
            actual_dollar = shares * price
            vol = self._volatilities.get(sym, 0.20)

            results.append(AllocationResult(
                symbol=sym,
                weight=weight,
                shares=shares,
                dollar_amount=actual_dollar,
                sector=SYMBOL_SECTORS.get(sym, "Unknown"),
                vol_contribution=weight * vol,
            ))

        return results

    def allocate_volatility_targeted(
        self,
        symbols: list[str],
        total_capital: float,
        prices: dict[str, float],
    ) -> list[AllocationResult]:
        """Volatility-targeted allocation: inverse-vol weighting."""
        n = min(len(symbols), self.limits.max_positions)
        symbols = symbols[:n]

        # Get volatilities
        vols = {s: self._volatilities.get(s, 0.20) for s in symbols}
        inv_vols = {s: 1.0 / max(v, 0.01) for s, v in vols.items()}
        total_inv = sum(inv_vols.values())

        results = []
        for sym in symbols:
            weight = inv_vols[sym] / total_inv if total_inv > 0 else 1.0 / n

            # Enforce limits
            max_weight = self.limits.max_symbol_pct / 100.0
            weight = min(weight, max_weight)

            price = prices.get(sym, 1.0)
            dollar_amount = total_capital * weight
            shares = int(dollar_amount / price) if price > 0 else 0
            actual_dollar = shares * price

            results.append(AllocationResult(
                symbol=sym,
                weight=weight,
                shares=shares,
                dollar_amount=actual_dollar,
                sector=SYMBOL_SECTORS.get(sym, "Unknown"),
                vol_contribution=weight * vols[sym],
            ))

        return results

    def check_exposure(
        self,
        allocations: list[AllocationResult],
        total_capital: float,
    ) -> ExposureDashboard:
        """Check current exposure against limits."""
        symbol_exp = {}
        sector_exp: dict[str, float] = {}
        total_exp = 0.0
        breaches = []

        for alloc in allocations:
            pct = (alloc.dollar_amount / total_capital * 100) if total_capital > 0 else 0
            symbol_exp[alloc.symbol] = pct
            sector_exp[alloc.sector] = sector_exp.get(alloc.sector, 0) + pct
            total_exp += pct

            if pct > self.limits.max_symbol_pct:
                breaches.append(f"{alloc.symbol}: {pct:.1f}% > max {self.limits.max_symbol_pct}%")

        for sector, pct in sector_exp.items():
            if pct > self.limits.max_sector_pct:
                breaches.append(f"Sector {sector}: {pct:.1f}% > max {self.limits.max_sector_pct}%")

        if total_exp > self.limits.max_gross_pct:
            breaches.append(f"Total exposure: {total_exp:.1f}% > max {self.limits.max_gross_pct}%")

        if len(allocations) > self.limits.max_positions:
            breaches.append(f"Positions: {len(allocations)} > max {self.limits.max_positions}")

        portfolio_vol = sum(a.vol_contribution for a in allocations)

        return ExposureDashboard(
            total_exposure_pct=total_exp,
            symbol_exposures=symbol_exp,
            sector_exposures=sector_exp,
            position_count=len(allocations),
            portfolio_vol=portfolio_vol,
            limit_breaches=breaches,
        )


_allocator: Optional[PortfolioAllocator] = None


def get_portfolio_allocator() -> PortfolioAllocator:
    global _allocator
    if _allocator is None:
        _allocator = PortfolioAllocator()
    return _allocator
