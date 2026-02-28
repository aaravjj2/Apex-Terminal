"""
earnings_engine.py
Earnings analysis engine: EPS estimates, surprise tracking,
revision momentum, whisper numbers, earnings season calendar,
post-earnings drift (PEAD) analysis, sector earnings aggregation,
and guidance tracking.
"""

from __future__ import annotations
import math
import logging
import random
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import List, Optional, Dict, Tuple, Literal
from enum import Enum

logger = logging.getLogger(__name__)

# ─── Types ─────────────────────────────────────────────────────────────────────

class EarningsTiming(str, Enum):
    BEFORE_OPEN = "BMO"    # Before market open
    AFTER_CLOSE = "AMC"    # After market close
    DURING_SESSION = "DMH"  # During market hours
    UNCONFIRMED = "TBD"

class SurpriseDirection(str, Enum):
    BEAT = "BEAT"
    MISS = "MISS"
    IN_LINE = "IN-LINE"

class GuideDirection(str, Enum):
    RAISED = "RAISED"
    LOWERED = "LOWERED"
    MAINTAINED = "MAINTAINED"
    WITHDREW = "WITHDREW"
    NA = "N/A"

# ─── Data Classes ─────────────────────────────────────────────────────────────

@dataclass
class EarningsEstimate:
    ticker: str
    fiscal_quarter: str      # e.g. "Q1 FY2025"
    fiscal_year: int
    fiscal_period: str
    report_date: date
    report_timing: EarningsTiming
    eps_consensus: float
    eps_high: float
    eps_low: float
    eps_stdev: float
    eps_num_analysts: int
    rev_consensus: float     # Revenue in millions
    rev_high: float
    rev_low: float
    rev_num_analysts: int
    eps_year_ago: float
    rev_year_ago: float
    eps_growth_est: float    # yoy %
    rev_growth_est: float    # yoy %
    whisper_eps: float       # unofficial market expectation

@dataclass
class EarningsResult:
    ticker: str
    fiscal_quarter: str
    report_date: date
    report_timing: EarningsTiming
    # Actuals
    eps_actual: float
    rev_actual: float        # in millions
    eps_year_ago: float
    rev_year_ago: float
    # vs Consensus
    eps_consensus: float
    rev_consensus: float
    eps_surprise: float      # absolute
    eps_surprise_pct: float
    rev_surprise: float      # absolute (millions)
    rev_surprise_pct: float
    eps_direction: SurpriseDirection
    rev_direction: SurpriseDirection
    # vs Whisper
    eps_whisper: float
    eps_vs_whisper: float
    eps_vs_whisper_pct: float
    # Guidance
    next_eps_guide_low: Optional[float]
    next_eps_guide_high: Optional[float]
    next_rev_guide_low: Optional[float]
    next_rev_guide_high: Optional[float]
    guidance_direction: GuideDirection
    # Market reaction
    price_before: float
    price_after_close: float
    gap_pct: float
    next_day_open: float
    next_day_close: float
    next_day_return: float
    three_day_return: float
    one_week_return: float
    one_month_return: float
    # Quality metrics
    beat_both: bool  # beat both EPS and revenue
    management_tone_score: float  # -1 to +1 sentiment
    call_sentiment: str

@dataclass
class EarningsRevision:
    ticker: str
    fiscal_quarter: str
    analyst_firm: str
    revision_date: date
    old_eps_est: float
    new_eps_est: float
    old_rev_est: float
    new_rev_est: float
    eps_change: float
    eps_change_pct: float
    rev_change_pct: float
    direction: Literal['up', 'down', 'unchanged']
    analyst_name: Optional[str] = None
    note: Optional[str] = None

@dataclass
class EarningsCalendarEntry:
    ticker: str
    company_name: str
    sector: str
    market_cap: float
    report_date: date
    report_timing: EarningsTiming
    eps_consensus: float
    rev_consensus: float
    eps_year_ago: float
    rev_growth_est: float
    eps_growth_est: float
    options_iv_crush: float     # Expected IV crush post-earnings
    expected_move_pct: float    # Implied by options market
    historical_avg_move_pct: float
    avg_beat_rate: float        # % of quarters beaten historically
    importance: Literal['low', 'medium', 'high', 'critical']

@dataclass
class PEADResult:
    ticker: str
    report_date: date
    eps_surprise_pct: float
    beat_miss: SurpriseDirection
    day0_return: float       # earnings day
    day1_return: float
    day5_return: float    # 1-week
    day21_return: float   # 1-month
    day63_return: float   # 3-month
    drift_persistent: bool
    drift_explanation: str

@dataclass
class SectorEarningsAggregate:
    sector: str
    num_companies: int
    num_reported: int
    beat_rate: float
    miss_rate: float
    inline_rate: float
    avg_eps_surprise_pct: float
    avg_rev_surprise_pct: float
    blended_eps_growth: float
    blended_rev_growth: float
    forward_pe: float
    guidance_up_count: int
    guidance_down_count: int
    net_guidance_score: float  # +1 all raised, -1 all lowered

@dataclass
class EarningsSeason:
    season_name: str    # e.g. "Q1 2025 Earnings Season"
    start_date: date
    end_date: date
    total_companies: int
    reported_count: int
    beat_count: int
    miss_count: int
    inline_count: int
    beat_rate: float
    avg_eps_surprise: float
    avg_rev_surprise: float
    guidance_raised_pct: float
    key_themes: List[str]
    sector_aggregates: List[SectorEarningsAggregate]

# ─── Mock Data Generators ────────────────────────────────────────────────────

TICKERS_BY_SECTOR = {
    'Technology': ['NVDA', 'AAPL', 'MSFT', 'META', 'GOOGL', 'AVGO', 'AMD', 'ASML', 'TSM', 'QCOM'],
    'Financials': ['JPM', 'BAC', 'GS', 'MS', 'BRK.B', 'V', 'MA', 'SCHW', 'C', 'WFC'],
    'Health Care': ['UNH', 'JNJ', 'LLY', 'ABBV', 'MRK', 'PFE', 'TMO', 'ABT', 'AMGN', 'BMY'],
    'Consumer Disc': ['AMZN', 'TSLA', 'HD', 'MCD', 'SBUX', 'NKE', 'TJX', 'LOW', 'BKNG', 'CMG'],
    'Industrials': ['CAT', 'HON', 'RTX', 'UPS', 'LMT', 'BA', 'DE', 'GE', 'FDX', 'NSC'],
    'Comm Services': ['NFLX', 'DIS', 'CMCSA', 'VZ', 'T', 'EA', 'TTWO'],
    'Energy': ['XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC'],
    'Materials': ['LIN', 'SHW', 'APD', 'FCX', 'NEM', 'NUE'],
}

COMPANY_NAMES = {
    'NVDA': 'NVIDIA Corp', 'AAPL': 'Apple Inc', 'MSFT': 'Microsoft', 'META': 'Meta Platforms',
    'GOOGL': 'Alphabet', 'AMZN': 'Amazon.com', 'TSLA': 'Tesla Inc', 'JPM': 'JPMorgan Chase',
    'LLY': 'Eli Lilly', 'UNH': 'UnitedHealth Group', 'HD': 'Home Depot',
    'NFLX': 'Netflix', 'XOM': 'Exxon Mobil', 'AVGO': 'Broadcom',
}

def _company_name(ticker: str) -> str:
    return COMPANY_NAMES.get(ticker, f'{ticker} Corp')

def _make_eps_result(ticker: str, base_eps: float = 2.50, qtr: str = "Q1 FY2025") -> EarningsResult:
    rng = random.Random(hash(ticker + qtr))
    consensus = round(base_eps * (1 + rng.gauss(0, 0.05)), 2)
    whisper = round(consensus * (1 + rng.gauss(0.01, 0.015)), 2)
    actual = round(whisper * (1 + rng.gauss(0.02, 0.04)), 2)
    eps_surp = actual - consensus
    rev_consensus = round(base_eps * 400 * rng.uniform(0.9, 1.1), 1)
    rev_actual = round(rev_consensus * (1 + rng.gauss(0.01, 0.025)), 1)
    price_before = round(100 + rng.gauss(0, 20), 2)
    gap = rng.gauss(0.03 if actual > consensus else -0.03, 0.04)
    price_after = round(price_before * (1 + gap), 2)
    return EarningsResult(
        ticker=ticker, fiscal_quarter=qtr,
        report_date=date.today() - timedelta(days=rng.randint(0, 60)),
        report_timing=rng.choice([EarningsTiming.AFTER_CLOSE, EarningsTiming.BEFORE_OPEN]),
        eps_actual=actual, rev_actual=rev_actual,
        eps_year_ago=round(consensus * 0.8, 2), rev_year_ago=round(rev_consensus * 0.85, 1),
        eps_consensus=consensus, rev_consensus=rev_consensus,
        eps_surprise=round(eps_surp, 4), eps_surprise_pct=round(eps_surp / abs(consensus) * 100, 2),
        rev_surprise=round(rev_actual - rev_consensus, 1),
        rev_surprise_pct=round((rev_actual - rev_consensus) / rev_consensus * 100, 2),
        eps_direction=SurpriseDirection.BEAT if actual > consensus * 1.01 else (SurpriseDirection.MISS if actual < consensus * 0.99 else SurpriseDirection.IN_LINE),
        rev_direction=SurpriseDirection.BEAT if rev_actual > rev_consensus * 1.01 else SurpriseDirection.MISS,
        eps_whisper=whisper, eps_vs_whisper=round(actual - whisper, 4),
        eps_vs_whisper_pct=round((actual - whisper) / abs(whisper) * 100, 2),
        next_eps_guide_low=round(actual * 0.95, 2), next_eps_guide_high=round(actual * 1.08, 2),
        next_rev_guide_low=round(rev_actual * 0.96, 1), next_rev_guide_high=round(rev_actual * 1.06, 1),
        guidance_direction=rng.choice([GuideDirection.RAISED, GuideDirection.MAINTAINED, GuideDirection.MAINTAINED, GuideDirection.LOWERED]),
        price_before=price_before, price_after_close=price_after, gap_pct=round(gap * 100, 2),
        next_day_open=round(price_after * rng.uniform(0.98, 1.02), 2),
        next_day_close=round(price_after * rng.uniform(0.97, 1.04), 2),
        next_day_return=round(rng.gauss(gap * 0.7, 0.015) * 100, 2),
        three_day_return=round(rng.gauss(gap * 0.5, 0.02) * 100, 2),
        one_week_return=round(rng.gauss(gap * 0.3, 0.03) * 100, 2),
        one_month_return=round(rng.gauss(gap * 0.15, 0.05) * 100, 2),
        beat_both=actual > consensus * 1.01 and rev_actual > rev_consensus * 1.01,
        management_tone_score=round(rng.gauss(0.1, 0.3), 2),
        call_sentiment='Positive' if actual > consensus else 'Cautious',
    )

# ─── Engine ───────────────────────────────────────────────────────────────────

class EarningsEngine:
    """
    Full-featured earnings analytics engine providing:
    - Upcoming earnings calendar with options-implied moves
    - Historical EPS and revenue surprise tracking
    - Revision momentum scoring
    - PEAD analysis
    - Sector earnings aggregation
    - Earnings season summaries
    """

    def get_upcoming_calendar(
        self, days_ahead: int = 14, tickers: Optional[List[str]] = None
    ) -> List[EarningsCalendarEntry]:
        """Get upcoming earnings for the next N days."""
        all_tickers = tickers or [t for sector_list in TICKERS_BY_SECTOR.values() for t in sector_list]
        entries = []
        today = date.today()

        for i, ticker in enumerate(all_tickers[:40]):
            rng = random.Random(hash(ticker))
            report_date = today + timedelta(days=rng.randint(0, days_ahead))
            sector = next((s for s, tlist in TICKERS_BY_SECTOR.items() if ticker in tlist), 'Other')
            base_eps = rng.uniform(0.5, 8.0)
            expected_move = rng.uniform(4.0, 18.0)
            entries.append(EarningsCalendarEntry(
                ticker=ticker, company_name=_company_name(ticker),
                sector=sector, market_cap=round(rng.uniform(20, 3000), 1),
                report_date=report_date,
                report_timing=rng.choice(list(EarningsTiming)),
                eps_consensus=round(base_eps, 2),
                rev_consensus=round(base_eps * rng.uniform(300, 800), 1),
                eps_year_ago=round(base_eps * 0.82, 2),
                rev_growth_est=round(rng.gauss(8, 6), 1),
                eps_growth_est=round(rng.gauss(12, 8), 1),
                options_iv_crush=round(rng.uniform(30, 55), 1),
                expected_move_pct=round(expected_move, 1),
                historical_avg_move_pct=round(expected_move * rng.uniform(0.7, 1.3), 1),
                avg_beat_rate=round(rng.uniform(55, 82), 1),
                importance='critical' if ticker in ['NVDA', 'AAPL', 'MSFT', 'META', 'GOOGL', 'AMZN'] else (
                    'high' if i < 15 else ('medium' if i < 28 else 'low')),
            ))
        return sorted(entries, key=lambda e: e.report_date)

    def get_historical_results(
        self, ticker: str, num_quarters: int = 8
    ) -> List[EarningsResult]:
        """Get historical earnings results for a ticker."""
        results = []
        base_eps = {'NVDA': 5.20, 'AAPL': 1.80, 'MSFT': 2.95, 'META': 4.40}.get(ticker, 1.50)
        today = date.today()
        for i in range(num_quarters):
            q_num = ((today.month - 1) // 3 + 1 - i - 1) % 4 + 1
            fy = today.year - (i + 1) // 4
            qtr = f"Q{q_num} FY{fy}"
            growth = 1 + 0.08 * (num_quarters - i) / num_quarters
            result = _make_eps_result(ticker, base_eps * growth, qtr)
            result.report_date = today - timedelta(days=90 * i + 30)
            results.append(result)
        return results

    def get_eps_revisions(self, ticker: str, num_revisions: int = 12) -> List[EarningsRevision]:
        """Get recent analyst EPS revisions."""
        rng = random.Random(hash(ticker + 'revisions'))
        revisions = []
        base_eps = 2.50
        today = date.today()
        firms = ['Goldman Sachs', 'Morgan Stanley', 'JPMorgan', 'Bank of America',
                 'Citigroup', 'UBS', 'Deutsche Bank', 'Barclays', 'Wells Fargo', 'RBC Capital']
        for i in range(num_revisions):
            old_eps = round(base_eps * rng.uniform(0.9, 1.1), 2)
            change_dir = rng.gauss(0.01, 0.03)
            new_eps = round(old_eps * (1 + change_dir), 2)
            revisions.append(EarningsRevision(
                ticker=ticker, fiscal_quarter=f"Q2 FY{date.today().year}",
                analyst_firm=rng.choice(firms), revision_date=today - timedelta(days=i * rng.randint(2, 10)),
                old_eps_est=old_eps, new_eps_est=new_eps,
                old_rev_est=round(old_eps * 400, 1), new_rev_est=round(new_eps * 400, 1),
                eps_change=round(new_eps - old_eps, 4), eps_change_pct=round(change_dir * 100, 2),
                rev_change_pct=round(change_dir * 100, 2),
                direction='up' if new_eps > old_eps else ('down' if new_eps < old_eps else 'unchanged'),
            ))
        return sorted(revisions, key=lambda r: r.revision_date, reverse=True)

    def get_revision_score(self, revisions: List[EarningsRevision]) -> Dict:
        """Score the quality and direction of recent revisions."""
        if not revisions:
            return {'score': 0.0, 'up_count': 0, 'down_count': 0}
        up = sum(1 for r in revisions if r.direction == 'up')
        down = sum(1 for r in revisions if r.direction == 'down')
        total = len(revisions)
        score = (up - down) / total  # -1 to +1
        avg_magnitude = sum(abs(r.eps_change_pct) for r in revisions) / total
        return {
            'score': round(score, 3),
            'up_count': up,
            'down_count': down,
            'unchanged_count': total - up - down,
            'total': total,
            'avg_change_pct': round(avg_magnitude, 2),
            'signal': 'STRONG BUY' if score > 0.5 else ('BUY' if score > 0.2 else ('NEUTRAL' if score > -0.2 else ('SELL' if score > -0.5 else 'STRONG SELL'))),
        }

    def get_pead_analysis(self, ticker: str, num_quarters: int = 8) -> List[PEADResult]:
        """Post-Earnings Announcement Drift analysis."""
        results = self.get_historical_results(ticker, num_quarters)
        pead = []
        for r in results:
            drift_persistent = (r.eps_direction == SurpriseDirection.BEAT and r.one_month_return > 2) or \
                               (r.eps_direction == SurpriseDirection.MISS and r.one_month_return < -2)
            pead.append(PEADResult(
                ticker=ticker, report_date=r.report_date,
                eps_surprise_pct=r.eps_surprise_pct,
                beat_miss=r.eps_direction,
                day0_return=r.gap_pct,
                day1_return=r.next_day_return,
                day5_return=r.one_week_return,
                day21_return=r.one_month_return,
                day63_return=round(r.one_month_return * 1.3 + random.gauss(0, 3), 2),
                drift_persistent=drift_persistent,
                drift_explanation='Positive drift: market underreacted to beat' if drift_persistent and r.eps_direction == SurpriseDirection.BEAT else (
                    'Negative drift: market underreacted to miss' if drift_persistent else 'No persistent drift detected'),
            ))
        return pead

    def get_sector_aggregate(self, sector: str) -> SectorEarningsAggregate:
        """Aggregate earnings metrics for a sector."""
        tickers = TICKERS_BY_SECTOR.get(sector, [])
        if not tickers:
            tickers = ['SPY']
        rng = random.Random(hash(sector))
        num_companies = len(tickers) * 8
        num_reported = int(num_companies * rng.uniform(0.6, 0.95))
        beat_rate = rng.uniform(0.55, 0.80)
        miss_rate = rng.uniform(0.10, 0.30)
        return SectorEarningsAggregate(
            sector=sector, num_companies=num_companies, num_reported=num_reported,
            beat_rate=round(beat_rate, 3), miss_rate=round(miss_rate, 3),
            inline_rate=round(1 - beat_rate - miss_rate, 3),
            avg_eps_surprise_pct=round(rng.gauss(4.5, 2.5), 2),
            avg_rev_surprise_pct=round(rng.gauss(1.2, 1.5), 2),
            blended_eps_growth=round(rng.gauss(8, 6), 2),
            blended_rev_growth=round(rng.gauss(5, 4), 2),
            forward_pe=round(rng.uniform(12, 42), 1),
            guidance_up_count=int(num_reported * rng.uniform(0.25, 0.45)),
            guidance_down_count=int(num_reported * rng.uniform(0.10, 0.25)),
            net_guidance_score=round(rng.gauss(0.15, 0.3), 2),
        )

    def get_earnings_season(self) -> EarningsSeason:
        """Get current earnings season summary."""
        today = date.today()
        season_start = date(today.year, ((today.month - 1) // 3) * 3 + 1, 10)
        season_end = season_start + timedelta(days=50)

        sector_aggs = [self.get_sector_aggregate(s) for s in TICKERS_BY_SECTOR.keys()]
        total = sum(s.num_companies for s in sector_aggs)
        reported = sum(s.num_reported for s in sector_aggs)
        beat_count = int(reported * 0.72)
        miss_count = int(reported * 0.18)

        return EarningsSeason(
            season_name=f"Q1 {today.year} Earnings Season",
            start_date=season_start, end_date=season_end,
            total_companies=total, reported_count=reported,
            beat_count=beat_count, miss_count=miss_count,
            inline_count=reported - beat_count - miss_count,
            beat_rate=round(beat_count / max(1, reported), 3),
            avg_eps_surprise=4.8,
            avg_rev_surprise=1.4,
            guidance_raised_pct=38.2,
            key_themes=['AI Infrastructure Investment', 'Consumer Resilience', 'Cost Optimization', 'Cloud Growth Acceleration'],
            sector_aggregates=sector_aggs,
        )

    def calc_whisper_accuracy(self, ticker: str, num_quarters: int = 8) -> Dict:
        """Evaluate whisper number accuracy vs actual."""
        results = self.get_historical_results(ticker, num_quarters)
        whisper_misses = [abs(r.eps_vs_whisper_pct) for r in results]
        consensus_misses = [abs(r.eps_surprise_pct) for r in results]
        return {
            'ticker': ticker,
            'avg_whisper_miss_pct': round(sum(whisper_misses) / len(whisper_misses), 2),
            'avg_consensus_miss_pct': round(sum(consensus_misses) / len(consensus_misses), 2),
            'whisper_more_accurate': sum(whisper_misses) < sum(consensus_misses),
            'avg_whisper_vs_consensus': round(
                sum(r.eps_vs_whisper - r.eps_surprise for r in results) / len(results), 4),
            'whisper_correct_direction': sum(1 for r in results if r.eps_vs_whisper > 0 and r.eps_actual > r.eps_consensus) + sum(1 for r in results if r.eps_vs_whisper < 0 and r.eps_actual < r.eps_consensus),
            'total_quarters': num_quarters,
        }

# ─── Module-Level Instance ────────────────────────────────────────────────────

_engine = EarningsEngine()

def get_upcoming_calendar(days_ahead: int = 14) -> List[EarningsCalendarEntry]:
    return _engine.get_upcoming_calendar(days_ahead)

def get_historical_results(ticker: str, num_quarters: int = 8) -> List[EarningsResult]:
    return _engine.get_historical_results(ticker, num_quarters)

def get_eps_revisions(ticker: str) -> List[EarningsRevision]:
    return _engine.get_eps_revisions(ticker)

def get_earnings_season() -> EarningsSeason:
    return _engine.get_earnings_season()
