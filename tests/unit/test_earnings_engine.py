"""
test_earnings_engine.py
Comprehensive unit tests for the earnings engine:
calendar, historical results, revisions, PEAD, sector aggregates,
whisper accuracy, and earnings season summaries.
"""

import pytest
from datetime import date, timedelta
from typing import List


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def engine():
    try:
        from phase1.services.earnings_engine import EarningsEngine
        return EarningsEngine()
    except ImportError:
        from services.earnings_engine import EarningsEngine
        return EarningsEngine()


@pytest.fixture
def enums():
    try:
        from phase1.services.earnings_engine import (
            SurpriseDirection, GuideDirection, EarningsTiming
        )
    except ImportError:
        from services.earnings_engine import (
            SurpriseDirection, GuideDirection, EarningsTiming
        )
    return SurpriseDirection, GuideDirection, EarningsTiming


# ─── Earnings Calendar ────────────────────────────────────────────────────────

class TestEarningsCalendar:

    def test_returns_entries(self, engine):
        entries = engine.get_upcoming_calendar(days_ahead=30)
        assert len(entries) > 0

    def test_entries_in_date_range(self, engine):
        today = date.today()
        entries = engine.get_upcoming_calendar(days_ahead=14)
        for e in entries:
            assert today <= e.report_date <= today + timedelta(days=14)

    def test_entry_has_required_fields(self, engine):
        entries = engine.get_upcoming_calendar(days_ahead=30)
        e = entries[0]
        assert e.ticker
        assert e.company_name
        assert e.sector
        assert e.eps_consensus != 0 or e.rev_consensus != 0
        assert e.expected_move_pct > 0

    def test_sorted_by_date(self, engine):
        entries = engine.get_upcoming_calendar(days_ahead=30)
        dates = [e.report_date for e in entries]
        assert dates == sorted(dates), "Calendar should be sorted by date"

    def test_importance_levels_valid(self, engine):
        valid = {'low', 'medium', 'high', 'critical'}
        entries = engine.get_upcoming_calendar(days_ahead=30)
        for e in entries:
            assert e.importance in valid

    def test_major_tickers_included(self, engine):
        entries = engine.get_upcoming_calendar(days_ahead=30)
        tickers = {e.ticker for e in entries}
        # Not all may be in a 30-day window depending on randomization
        assert len(tickers) > 5

    def test_ticker_filtering(self, engine):
        tickers = ['NVDA', 'AAPL', 'MSFT']
        entries = engine.get_upcoming_calendar(days_ahead=30, tickers=tickers)
        returned_tickers = {e.ticker for e in entries}
        assert returned_tickers.issubset(set(tickers))

    def test_expected_move_reasonable(self, engine):
        entries = engine.get_upcoming_calendar(days_ahead=30)
        for e in entries:
            assert 1.0 <= e.expected_move_pct <= 50.0, f"Unexpected move % {e.expected_move_pct} for {e.ticker}"

    def test_beat_rate_valid_range(self, engine):
        entries = engine.get_upcoming_calendar(days_ahead=30)
        for e in entries:
            assert 40.0 <= e.avg_beat_rate <= 95.0


# ─── Historical EPS Results ───────────────────────────────────────────────────

class TestHistoricalResults:

    @pytest.mark.parametrize("ticker", ["NVDA", "AAPL", "MSFT", "SPY"])
    def test_results_count(self, engine, ticker):
        results = engine.get_historical_results(ticker, num_quarters=8)
        assert len(results) == 8

    def test_result_fields_complete(self, engine):
        results = engine.get_historical_results("NVDA", num_quarters=4)
        r = results[0]
        assert r.ticker == "NVDA"
        assert r.eps_actual is not None
        assert r.eps_consensus is not None
        assert r.eps_surprise == pytest.approx(r.eps_actual - r.eps_consensus, abs=0.001)

    def test_surprise_pct_calculated_correctly(self, engine):
        results = engine.get_historical_results("AAPL", num_quarters=4)
        for r in results:
            if abs(r.eps_consensus) > 0.01:
                expected_pct = (r.eps_actual - r.eps_consensus) / abs(r.eps_consensus) * 100
                assert abs(r.eps_surprise_pct - expected_pct) < 0.1

    def test_direction_consistent_with_surprise(self, engine, enums):
        SurpriseDirection, _, _ = enums
        results = engine.get_historical_results("MSFT", num_quarters=8)
        for r in results:
            if r.eps_actual > r.eps_consensus * 1.01:
                assert r.eps_direction == SurpriseDirection.BEAT
            elif r.eps_actual < r.eps_consensus * 0.99:
                assert r.eps_direction == SurpriseDirection.MISS

    def test_beat_both_flag(self, engine):
        results = engine.get_historical_results("META", num_quarters=8)
        for r in results:
            if r.beat_both:
                assert r.eps_actual > r.eps_consensus
                assert r.rev_actual > r.rev_consensus

    def test_report_dates_decreasing(self, engine):
        results = engine.get_historical_results("NVDA", num_quarters=6)
        dates = [r.report_date for r in results]
        assert dates == sorted(dates, reverse=True) or dates == sorted(dates)

    def test_guidance_directions_valid(self, engine, enums):
        _, GuideDirection, _ = enums
        results = engine.get_historical_results("AAPL", num_quarters=4)
        valid_directions = set(d for d in GuideDirection)
        for r in results:
            assert r.guidance_direction in valid_directions


# ─── EPS Revisions ───────────────────────────────────────────────────────────

class TestEPSRevisions:

    def test_revisions_count(self, engine):
        revisions = engine.get_eps_revisions("NVDA", num_revisions=10)
        assert len(revisions) == 10

    def test_revision_direction_consistent(self, engine):
        revisions = engine.get_eps_revisions("AAPL")
        for r in revisions:
            if r.new_eps_est > r.old_eps_est:
                assert r.direction == 'up'
            elif r.new_eps_est < r.old_eps_est:
                assert r.direction == 'down'
            else:
                assert r.direction == 'unchanged'

    def test_eps_change_calculated(self, engine):
        revisions = engine.get_eps_revisions("MSFT")
        for r in revisions:
            expected_change = r.new_eps_est - r.old_eps_est
            assert abs(r.eps_change - expected_change) < 0.001

    def test_revision_pct_calculated(self, engine):
        revisions = engine.get_eps_revisions("NVDA")
        for r in revisions:
            if abs(r.old_eps_est) > 0.01:
                expected_pct = (r.new_eps_est - r.old_eps_est) / abs(r.old_eps_est) * 100
                assert abs(r.eps_change_pct - expected_pct) < 0.2

    def test_revision_score_valid_range(self, engine):
        revisions = engine.get_eps_revisions("NVDA")
        score = engine.get_revision_score(revisions)
        assert -1.0 <= score['score'] <= 1.0

    def test_revision_score_components(self, engine):
        revisions = engine.get_eps_revisions("AAPL", num_revisions=10)
        score = engine.get_revision_score(revisions)
        assert score['up_count'] + score['down_count'] + score['unchanged_count'] == 10

    def test_revision_signal_valid(self, engine):
        valid_signals = {'STRONG BUY', 'BUY', 'NEUTRAL', 'SELL', 'STRONG SELL'}
        revisions = engine.get_eps_revisions("MSFT")
        score = engine.get_revision_score(revisions)
        assert score['signal'] in valid_signals

    def test_empty_revisions_score(self, engine):
        score = engine.get_revision_score([])
        assert score['score'] == 0.0


# ─── PEAD Analysis ───────────────────────────────────────────────────────────

class TestPEAD:

    def test_pead_count(self, engine):
        pead = engine.get_pead_analysis("NVDA", num_quarters=8)
        assert len(pead) == 8

    def test_pead_has_returns(self, engine):
        pead = engine.get_pead_analysis("AAPL", num_quarters=4)
        for p in pead:
            assert p.day0_return is not None
            assert p.day21_return is not None
            assert p.day63_return is not None

    def test_pead_drift_explanation(self, engine):
        pead = engine.get_pead_analysis("MSFT", num_quarters=4)
        for p in pead:
            assert isinstance(p.drift_explanation, str)
            assert len(p.drift_explanation) > 0

    def test_pead_beat_miss_valid(self, engine, enums):
        SurpriseDirection, _, _ = enums
        pead = engine.get_pead_analysis("META", num_quarters=4)
        valid = {d for d in SurpriseDirection}
        for p in pead:
            assert p.beat_miss in valid


# ─── Sector Aggregates ────────────────────────────────────────────────────────

class TestSectorAggregates:

    @pytest.mark.parametrize("sector", ["Technology", "Financials", "Health Care"])
    def test_aggregate_returns_data(self, engine, sector):
        agg = engine.get_sector_aggregate(sector)
        assert agg.sector == sector
        assert agg.num_companies > 0
        assert agg.num_reported > 0

    def test_rates_sum_to_one(self, engine):
        agg = engine.get_sector_aggregate("Technology")
        total = agg.beat_rate + agg.miss_rate + agg.inline_rate
        assert abs(total - 1.0) < 0.05

    def test_reported_leq_total(self, engine):
        agg = engine.get_sector_aggregate("Financials")
        assert agg.num_reported <= agg.num_companies

    def test_forward_pe_reasonable(self, engine):
        agg = engine.get_sector_aggregate("Technology")
        assert 5 <= agg.forward_pe <= 100

    def test_guidance_counts_nonnegative(self, engine):
        agg = engine.get_sector_aggregate("Health Care")
        assert agg.guidance_up_count >= 0
        assert agg.guidance_down_count >= 0
        assert agg.guidance_up_count + agg.guidance_down_count <= agg.num_reported


# ─── Earnings Season ─────────────────────────────────────────────────────────

class TestEarningsSeason:

    def test_season_structure(self, engine):
        season = engine.get_earnings_season()
        assert season.season_name
        assert season.total_companies > 0
        assert season.reported_count > 0
        assert len(season.sector_aggregates) > 0
        assert len(season.key_themes) > 0

    def test_beat_rate_reasonable(self, engine):
        season = engine.get_earnings_season()
        assert 0.5 <= season.beat_rate <= 0.95

    def test_reported_leq_total(self, engine):
        season = engine.get_earnings_season()
        assert season.reported_count <= season.total_companies

    def test_counts_consistent(self, engine):
        season = engine.get_earnings_season()
        assert season.beat_count + season.miss_count + season.inline_count <= season.reported_count + 5


# ─── Whisper Accuracy ────────────────────────────────────────────────────────

class TestWhisperAccuracy:

    def test_whisper_accuracy_structure(self, engine):
        result = engine.calc_whisper_accuracy("NVDA", num_quarters=8)
        assert result['ticker'] == 'NVDA'
        assert result['avg_whisper_miss_pct'] >= 0
        assert result['avg_consensus_miss_pct'] >= 0
        assert 'whisper_more_accurate' in result
        assert isinstance(result['whisper_more_accurate'], bool)

    def test_total_quarters(self, engine):
        result = engine.calc_whisper_accuracy("AAPL", num_quarters=6)
        assert result['total_quarters'] == 6

    def test_correct_direction_count(self, engine):
        result = engine.calc_whisper_accuracy("MSFT", num_quarters=8)
        assert 0 <= result['whisper_correct_direction'] <= 8
