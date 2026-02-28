"""
Sector Analysis Engine — Sector rotation models, relative performance, sector momentum,
inter-sector correlations, business cycle mapping, sector breadth, and ETF proxy analytics.
Covers all 11 GICS sectors. Pure computation — no FastAPI dependencies.
"""
from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class GICSSector(str, Enum):
    ENERGY = "energy"
    MATERIALS = "materials"
    INDUSTRIALS = "industrials"
    CONSUMER_DISCRETIONARY = "consumer_discretionary"
    CONSUMER_STAPLES = "consumer_staples"
    HEALTHCARE = "healthcare"
    FINANCIALS = "financials"
    IT = "information_technology"
    COMMUNICATION = "communication_services"
    UTILITIES = "utilities"
    REAL_ESTATE = "real_estate"


class BusinessCyclePhase(str, Enum):
    EARLY_RECOVERY = "early_recovery"
    MID_CYCLE = "mid_cycle"
    LATE_CYCLE = "late_cycle"
    RECESSION = "recession"


class SectorMomentumSignal(str, Enum):
    STRONG_BUY = "strong_buy"
    BUY = "buy"
    NEUTRAL = "neutral"
    SELL = "sell"
    STRONG_SELL = "strong_sell"


SECTOR_CYCLE_MAP: dict[BusinessCyclePhase, list[GICSSector]] = {
    BusinessCyclePhase.EARLY_RECOVERY: [
        GICSSector.CONSUMER_DISCRETIONARY, GICSSector.FINANCIALS,
        GICSSector.INDUSTRIALS, GICSSector.IT,
    ],
    BusinessCyclePhase.MID_CYCLE: [
        GICSSector.IT, GICSSector.INDUSTRIALS,
        GICSSector.ENERGY, GICSSector.MATERIALS,
    ],
    BusinessCyclePhase.LATE_CYCLE: [
        GICSSector.ENERGY, GICSSector.MATERIALS,
        GICSSector.CONSUMER_STAPLES, GICSSector.HEALTHCARE,
    ],
    BusinessCyclePhase.RECESSION: [
        GICSSector.CONSUMER_STAPLES, GICSSector.HEALTHCARE,
        GICSSector.UTILITIES, GICSSector.COMMUNICATION,
    ],
}

SECTOR_BETA_ESTIMATES: dict[GICSSector, float] = {
    GICSSector.IT: 1.25,
    GICSSector.CONSUMER_DISCRETIONARY: 1.20,
    GICSSector.FINANCIALS: 1.15,
    GICSSector.INDUSTRIALS: 1.05,
    GICSSector.MATERIALS: 1.10,
    GICSSector.ENERGY: 1.00,
    GICSSector.HEALTHCARE: 0.80,
    GICSSector.COMMUNICATION: 0.90,
    GICSSector.CONSUMER_STAPLES: 0.65,
    GICSSector.REAL_ESTATE: 0.75,
    GICSSector.UTILITIES: 0.55,
}


@dataclass
class SectorData:
    sector: GICSSector
    returns_history: list[float] = field(default_factory=list)  # daily returns
    market_cap_b: float = 0.0       # total market cap in billions
    num_stocks: int = 0
    pe_ratio: float = 0.0
    revenue_growth: float = 0.0
    earnings_growth: float = 0.0
    dividend_yield: float = 0.0

    @property
    def mtd_return(self) -> float:
        if len(self.returns_history) < 21:
            return sum(self.returns_history)
        return sum(self.returns_history[-21:])

    @property
    def ytd_return(self) -> float:
        return sum(self.returns_history)

    @property
    def volatility_30d(self) -> float:
        if len(self.returns_history) < 2:
            return 0.0
        recent = self.returns_history[-30:]
        if len(recent) < 2:
            return 0.0
        return statistics.stdev(recent) * math.sqrt(252)

    @property
    def momentum_3m(self) -> float:
        return sum(self.returns_history[-63:]) if len(self.returns_history) >= 63 else sum(self.returns_history)

    @property
    def momentum_6m(self) -> float:
        return sum(self.returns_history[-126:]) if len(self.returns_history) >= 126 else sum(self.returns_history)

    @property
    def momentum_12m(self) -> float:
        return sum(self.returns_history[-252:]) if len(self.returns_history) >= 252 else sum(self.returns_history)

    def to_dict(self) -> dict:
        return {
            "sector": self.sector.value,
            "mtd_return": round(self.mtd_return, 4),
            "ytd_return": round(self.ytd_return, 4),
            "volatility_30d": round(self.volatility_30d, 4),
            "momentum_3m": round(self.momentum_3m, 4),
            "momentum_6m": round(self.momentum_6m, 4),
            "market_cap_b": self.market_cap_b,
            "pe_ratio": self.pe_ratio,
            "revenue_growth": round(self.revenue_growth, 4),
        }


# ── Sector Relative Performance ───────────────────────────────────────

class SectorRelativePerformance:
    """Sector vs. benchmark relative strength calculations."""

    @staticmethod
    def relative_return(
        sector_returns: list[float],
        benchmark_returns: list[float],
    ) -> list[float]:
        """Cumulative relative return (sector - benchmark)."""
        if len(sector_returns) != len(benchmark_returns):
            return []
        return [round(s - b, 6) for s, b in zip(sector_returns, benchmark_returns)]

    @staticmethod
    def rs_ratio(
        sector_returns: list[float],
        benchmark_returns: list[float],
        period: int = 126,
    ) -> float:
        """Relative Strength ratio (RS line) over period."""
        rel = SectorRelativePerformance.relative_return(sector_returns, benchmark_returns)
        if len(rel) < period:
            cumrel = sum(rel)
        else:
            cumrel = sum(rel[-period:])
        return round(cumrel, 4)

    @staticmethod
    def rank_sectors(
        sectors: list[SectorData],
        period_returns: str = "mtd",  # "mtd", "ytd", "3m", "6m", "12m"
    ) -> list[dict]:
        """Rank sectors by return over given period."""
        attr_map = {
            "mtd": "mtd_return",
            "ytd": "ytd_return",
            "3m": "momentum_3m",
            "6m": "momentum_6m",
            "12m": "momentum_12m",
        }
        attr = attr_map.get(period_returns, "mtd_return")
        ranked = sorted(sectors, key=lambda s: -getattr(s, attr))
        return [
            {
                "rank": i + 1,
                "sector": s.sector.value,
                "return": round(getattr(s, attr), 4),
                "signal": (
                    SectorMomentumSignal.STRONG_BUY if i < 2
                    else SectorMomentumSignal.BUY if i < 4
                    else SectorMomentumSignal.NEUTRAL if i < 7
                    else SectorMomentumSignal.SELL if i < 9
                    else SectorMomentumSignal.STRONG_SELL
                ).value,
            }
            for i, s in enumerate(ranked)
        ]

    @staticmethod
    def sector_dispersion(sectors: list[SectorData], period: str = "mtd") -> dict:
        """Spread in returns across sectors (indicator of rotation activity)."""
        attr_map = {"mtd": "mtd_return", "ytd": "ytd_return", "3m": "momentum_3m"}
        attr = attr_map.get(period, "mtd_return")
        returns = [getattr(s, attr) for s in sectors]
        if not returns:
            return {}
        return {
            "max": round(max(returns), 4),
            "min": round(min(returns), 4),
            "spread": round(max(returns) - min(returns), 4),
            "std": round(statistics.stdev(returns) if len(returns) > 1 else 0, 4),
            "mean": round(statistics.mean(returns), 4),
        }


# ── Sector Rotation Model ─────────────────────────────────────────────

class SectorRotationModel:
    """
    Detect and predict sector rotation based on momentum, cycle, and relative strength.
    """

    @staticmethod
    def detect_rotation(
        sectors: list[SectorData],
        previous_leaders: list[GICSSector] = None,
        lookback: int = 21,
    ) -> dict:
        """Find sectors gaining momentum vs. those fading."""
        if not sectors:
            return {}

        # Current momentum ranking
        current = sorted(sectors, key=lambda s: -s.momentum_3m)
        current_top = [s.sector for s in current[:3]]
        current_bottom = [s.sector for s in current[-3:]]

        # Acceleration: recent 1m vs 3m momentum
        accelerating = []
        decelerating = []
        for s in sectors:
            recent = sum(s.returns_history[-21:]) if len(s.returns_history) >= 21 else s.mtd_return
            longer = s.momentum_3m / 3 if s.momentum_3m else 0
            if recent > longer * 1.2:
                accelerating.append(s.sector.value)
            elif recent < longer * 0.8:
                decelerating.append(s.sector.value)

        rotation_detected = bool(
            previous_leaders
            and set(s.value for s in current_top) != set(s.value for s in previous_leaders[:3])
        )

        return {
            "current_leaders": [s.value for s in current_top],
            "current_laggards": [s.value for s in current_bottom],
            "accelerating": accelerating,
            "decelerating": decelerating,
            "rotation_detected": rotation_detected,
        }

    @staticmethod
    def cycle_phase_allocation(phase: BusinessCyclePhase) -> dict:
        """Get recommended sector weights for business cycle phase."""
        preferred = SECTOR_CYCLE_MAP.get(phase, [])
        all_sectors = list(GICSSector)
        n = len(all_sectors)
        preferred_weight = 0.15
        other_weight = (1 - len(preferred) * preferred_weight) / max(n - len(preferred), 1)
        other_weight = max(other_weight, 0.02)

        weights = {}
        for s in all_sectors:
            weights[s.value] = preferred_weight if s in preferred else other_weight

        total = sum(weights.values())
        weights = {k: round(v / total, 4) for k, v in weights.items()}

        return {
            "phase": phase.value,
            "preferred_sectors": [s.value for s in preferred],
            "weights": weights,
        }

    @staticmethod
    def jdj_model_score(sector: SectorData) -> float:
        """
        JdJ (Ji, de Jong, Jay) model: momentum + fundamental score.
        Score = 0.6*momentum_6m + 0.2*earnings_growth + 0.2*revenue_growth
        """
        mom = sector.momentum_6m * 100  # convert to pct
        score = 0.6 * mom + 0.2 * sector.earnings_growth * 100 + 0.2 * sector.revenue_growth * 100
        return round(score, 4)


# ── Sector Correlation Analysis ───────────────────────────────────────

class SectorCorrelationAnalyzer:
    """Compute and interpret inter-sector return correlations."""

    @staticmethod
    def pairwise_correlation(
        sectors: list[SectorData],
        lookback: int = 252,
    ) -> dict:
        """Compute full correlation matrix."""
        if len(sectors) < 2:
            return {}

        returns = {}
        for s in sectors:
            returns[s.sector.value] = s.returns_history[-lookback:] if len(s.returns_history) >= lookback else s.returns_history

        min_len = min(len(r) for r in returns.values())
        if min_len < 2:
            return {}

        trimmed = {k: v[-min_len:] for k, v in returns.items()}
        keys = list(trimmed.keys())
        n = len(keys)

        corr_matrix = {}
        for i in range(n):
            corr_matrix[keys[i]] = {}
            for j in range(n):
                if i == j:
                    corr_matrix[keys[i]][keys[j]] = 1.0
                    continue
                x = trimmed[keys[i]]
                y = trimmed[keys[j]]
                mean_x = statistics.mean(x)
                mean_y = statistics.mean(y)
                cov = sum((x[k] - mean_x) * (y[k] - mean_y) for k in range(min_len))
                std_x = math.sqrt(sum((v - mean_x) ** 2 for v in x))
                std_y = math.sqrt(sum((v - mean_y) ** 2 for v in y))
                if std_x == 0 or std_y == 0:
                    corr_matrix[keys[i]][keys[j]] = 0.0
                else:
                    corr_matrix[keys[i]][keys[j]] = round(cov / (std_x * std_y), 4)

        return corr_matrix

    @staticmethod
    def diversification_score(corr_matrix: dict) -> float:
        """
        Average pairwise correlation — lower = more diversification.
        """
        sectors = list(corr_matrix.keys())
        n = len(sectors)
        if n < 2:
            return 0.0

        total = 0.0
        count = 0
        for i in range(n):
            for j in range(i + 1, n):
                total += corr_matrix[sectors[i]].get(sectors[j], 0)
                count += 1

        avg_corr = total / count if count > 0 else 0
        diversification = (1 - avg_corr) / 2  # 0 to 1
        return round(max(0, min(1, diversification)), 4)


# ── Sector Breadth Analytics ──────────────────────────────────────────

class SectorBreadthAnalyzer:
    """Advance-decline and breadth metrics within each sector."""

    @staticmethod
    def sector_breadth(
        sector: GICSSector,
        stock_returns: list[float],  # individual stock returns for the period
    ) -> dict:
        """A/D ratio and % above zero for a sector."""
        if not stock_returns:
            return {}
        advancing = sum(1 for r in stock_returns if r > 0)
        declining = sum(1 for r in stock_returns if r < 0)
        unchanged = len(stock_returns) - advancing - declining
        pct_advancing = advancing / len(stock_returns)

        avg_return = statistics.mean(stock_returns)
        median_return = statistics.median(stock_returns)

        return {
            "sector": sector.value,
            "advancing": advancing,
            "declining": declining,
            "unchanged": unchanged,
            "pct_advancing": round(pct_advancing, 4),
            "ad_ratio": round(advancing / max(declining, 1), 4),
            "avg_return": round(avg_return, 4),
            "median_return": round(median_return, 4),
            "breadth_signal": (
                "bullish" if pct_advancing > 0.65
                else "bearish" if pct_advancing < 0.35
                else "neutral"
            ),
        }

    @staticmethod
    def market_breadth_summary(sector_breadths: list[dict]) -> dict:
        """Aggregate breadth across all sectors."""
        if not sector_breadths:
            return {}
        total_adv = sum(s.get("advancing", 0) for s in sector_breadths)
        total_dec = sum(s.get("declining", 0) for s in sector_breadths)
        total_stocks = total_adv + total_dec + sum(s.get("unchanged", 0) for s in sector_breadths)
        bullish = sum(1 for s in sector_breadths if s.get("breadth_signal") == "bullish")
        bearish = sum(1 for s in sector_breadths if s.get("breadth_signal") == "bearish")

        return {
            "total_advancing": total_adv,
            "total_declining": total_dec,
            "total_stocks": total_stocks,
            "market_ad_ratio": round(total_adv / max(total_dec, 1), 4),
            "pct_advancing": round(total_adv / max(total_stocks, 1), 4),
            "bullish_sectors": bullish,
            "bearish_sectors": bearish,
            "market_breadth": (
                "strong_bull" if bullish >= 8
                else "bull" if bullish >= 6
                else "bear" if bearish >= 6
                else "strong_bear" if bearish >= 8
                else "mixed"
            ),
        }


# ── Sector Valuation ──────────────────────────────────────────────────

class SectorValuationAnalyzer:
    """Relative valuation of sectors vs. historical averages."""

    HISTORICAL_MEDIAN_PE: dict[str, float] = {
        GICSSector.IT.value: 22.0,
        GICSSector.HEALTHCARE.value: 18.0,
        GICSSector.CONSUMER_DISCRETIONARY.value: 20.0,
        GICSSector.CONSUMER_STAPLES.value: 19.0,
        GICSSector.INDUSTRIALS.value: 17.0,
        GICSSector.FINANCIALS.value: 12.0,
        GICSSector.ENERGY.value: 14.0,
        GICSSector.MATERIALS.value: 15.0,
        GICSSector.UTILITIES.value: 16.0,
        GICSSector.REAL_ESTATE.value: 35.0,  # FFO-based proxy
        GICSSector.COMMUNICATION.value: 17.0,
    }

    @staticmethod
    def pe_premium_discount(sector: SectorData) -> dict:
        """How rich/cheap is the sector vs. historical median P/E?"""
        if sector.pe_ratio == 0:
            return {}
        historical_median = SectorValuationAnalyzer.HISTORICAL_MEDIAN_PE.get(sector.sector.value, 18.0)
        pct_diff = (sector.pe_ratio - historical_median) / historical_median
        return {
            "sector": sector.sector.value,
            "current_pe": sector.pe_ratio,
            "historical_median_pe": historical_median,
            "pct_vs_history": round(pct_diff, 4),
            "valuation": (
                "expensive" if pct_diff > 0.20
                else "fair" if pct_diff > -0.10
                else "cheap"
            ),
        }

    @staticmethod
    def yield_spread_analysis(sectors: list[SectorData], risk_free_rate: float = 0.05) -> list[dict]:
        """Earnings yield vs. risk-free rate for each sector."""
        results = []
        for s in sectors:
            if s.pe_ratio > 0:
                earnings_yield = 1 / s.pe_ratio
                spread = earnings_yield - risk_free_rate
                results.append({
                    "sector": s.sector.value,
                    "earnings_yield": round(earnings_yield, 4),
                    "risk_free_rate": risk_free_rate,
                    "yield_spread": round(spread, 4),
                    "signal": "attractive" if spread > 0.02 else "neutral" if spread > 0 else "unattractive",
                })
        return results


# ── Orchestrator ──────────────────────────────────────────────────────

class SectorAnalysisEngine:
    """Top-level orchestrator for sector analysis."""

    def __init__(self):
        self.relative = SectorRelativePerformance()
        self.rotation = SectorRotationModel()
        self.correlation = SectorCorrelationAnalyzer()
        self.breadth = SectorBreadthAnalyzer()
        self.valuation = SectorValuationAnalyzer()

    def rank_sectors(self, sectors: list[SectorData], period: str = "mtd") -> list[dict]:
        return self.relative.rank_sectors(sectors, period)

    def detect_rotation(self, sectors: list[SectorData], prev_leaders: list[GICSSector] = None) -> dict:
        return self.rotation.detect_rotation(sectors, prev_leaders)

    def cycle_allocation(self, phase: BusinessCyclePhase) -> dict:
        return self.rotation.cycle_phase_allocation(phase)

    def correlation_matrix(self, sectors: list[SectorData]) -> dict:
        return self.correlation.pairwise_correlation(sectors)

    def sector_breadth(self, sector: GICSSector, stock_returns: list[float]) -> dict:
        return self.breadth.sector_breadth(sector, stock_returns)

    def market_breadth(self, sector_breadths: list[dict]) -> dict:
        return self.breadth.market_breadth_summary(sector_breadths)

    def valuation_snapshot(self, sectors: list[SectorData]) -> list[dict]:
        return [self.valuation.pe_premium_discount(s) for s in sectors if s.pe_ratio > 0]

    def jdj_ranking(self, sectors: list[SectorData]) -> list[dict]:
        scored = [(s, self.rotation.jdj_model_score(s)) for s in sectors]
        ranked = sorted(scored, key=lambda x: -x[1])
        return [{"rank": i + 1, "sector": s.sector.value, "jdj_score": sc} for i, (s, sc) in enumerate(ranked)]

    def dispersion(self, sectors: list[SectorData]) -> dict:
        return self.relative.sector_dispersion(sectors)

    def capabilities(self) -> dict:
        return {
            "engine": "SectorAnalysisEngine",
            "version": "1.0.0",
            "sectors": [s.value for s in GICSSector],
            "features": [
                "sector_ranking_mtd_ytd_3m_6m_12m",
                "relative_return_vs_benchmark",
                "rs_ratio_relative_strength",
                "sector_rotation_detection",
                "cycle_phase_allocation_11_sectors",
                "jdj_model_scoring",
                "pairwise_correlation_matrix",
                "portfolio_diversification_score",
                "breadth_advance_decline_per_sector",
                "market_breadth_aggregation",
                "pe_premium_discount_vs_history",
                "earnings_yield_spread_analysis",
                "momentum_acceleration_deceleration",
                "return_dispersion_across_sectors",
                "business_cycle_sector_mapping",
                "sector_beta_estimates",
                "top_bottom_sector_signals",
            ],
        }
