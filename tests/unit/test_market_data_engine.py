"""
test_market_data_engine.py — Comprehensive tests for MarketDataEngine
======================================================================
Tests: BarAggregator, MultiTimeframeAggregator, RealTimeStats, OrderBookProcessor,
       TimeAndSalesProcessor, MarketBreadth, SessionAnalytics, IntradayVWAP,
       CorrelationAnalyzer, MarketDataEngine orchestrator.
"""

import math
import pytest
import numpy as np
import pandas as pd

from phase1.services.market_data_engine import (
    MarketDataEngine, BarAggregator, MultiTimeframeAggregator, RealTimeStats,
    OrderBookProcessor, TimeAndSalesProcessor, MarketBreadth, SessionAnalytics,
    IntradayVWAP, CorrelationAnalyzer,
    Tick, Bar, OrderBook, OrderBookLevel, TradeRecord,
    BarType, SessionType, TF_SECONDS,
)


# ═══════════════════════════════════════════════════════════════════════════════
#  Fixtures
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def make_ticks():
    """Generate a sequence of ticks."""
    def _make(n=100, symbol='AAPL', start_price=150.0, start_time=1700000000, interval=0.1):
        rng = np.random.RandomState(42)
        ticks = []
        price = start_price
        for i in range(n):
            price += rng.randn() * 0.1
            size = rng.randint(1, 500)
            side = 'buy' if rng.rand() > 0.5 else 'sell'
            ticks.append(Tick(
                symbol=symbol,
                price=round(price, 2),
                size=float(size),
                timestamp=start_time + i * interval,
                side=side,
            ))
        return ticks
    return _make


@pytest.fixture
def sample_1m_bars():
    """Create 1-minute bar data."""
    n = 200
    rng = np.random.RandomState(42)
    times = [1700000000 + i * 60 for i in range(n)]
    o = 150 + np.cumsum(rng.randn(n) * 0.2)
    h = o + rng.rand(n) * 1.5
    l = o - rng.rand(n) * 1.5
    c = o + rng.randn(n) * 0.3
    v = rng.randint(100, 5000, n).astype(float)
    return pd.DataFrame({
        'time': times, 'open': o, 'high': h, 'low': l, 'close': c, 'volume': v,
    })


@pytest.fixture
def sample_order_book():
    """Create a sample L2 order book."""
    bids = [
        OrderBookLevel(price=150.00, size=500, count=3),
        OrderBookLevel(price=149.99, size=200, count=2),
        OrderBookLevel(price=149.98, size=800, count=5),
        OrderBookLevel(price=149.97, size=150, count=1),
        OrderBookLevel(price=149.96, size=300, count=2),
    ]
    asks = [
        OrderBookLevel(price=150.01, size=400, count=2),
        OrderBookLevel(price=150.02, size=100, count=1),
        OrderBookLevel(price=150.03, size=600, count=4),
        OrderBookLevel(price=150.04, size=250, count=2),
        OrderBookLevel(price=150.05, size=350, count=3),
    ]
    return OrderBook(symbol='AAPL', bids=bids, asks=asks, timestamp=1700000000)


# ═══════════════════════════════════════════════════════════════════════════════
#  Test Tick
# ═══════════════════════════════════════════════════════════════════════════════

class TestTick:
    def test_tick_properties(self):
        t = Tick(symbol='AAPL', price=150.0, size=100, timestamp=1700000000, side='buy')
        assert t.is_uptick is True
        assert t.notional == 15000.0

    def test_tick_default_side(self):
        t = Tick(symbol='AAPL', price=150.0, size=100, timestamp=1700000000)
        assert t.is_uptick is False


# ═══════════════════════════════════════════════════════════════════════════════
#  Test Bar
# ═══════════════════════════════════════════════════════════════════════════════

class TestBar:
    def test_bar_to_dict(self):
        b = Bar(time=1700000000, open=150, high=155, low=149, close=152, volume=1000)
        d = b.to_dict()
        assert d['open'] == 150
        assert d['close'] == 152

    def test_bar_update_with_tick(self):
        b = Bar(time=1700000000, is_closed=False)
        t1 = Tick(symbol='AAPL', price=150, size=100, timestamp=1700000000, side='buy')
        b.update_with_tick(t1)
        assert b.open == 150
        assert b.high == 150
        assert b.low == 150
        assert b.close == 150
        assert b.volume == 100
        assert b.buy_volume == 100

        t2 = Tick(symbol='AAPL', price=155, size=200, timestamp=1700000001, side='sell')
        b.update_with_tick(t2)
        assert b.high == 155
        assert b.close == 155
        assert b.volume == 300
        assert b.sell_volume == 200
        assert b.trades == 2


# ═══════════════════════════════════════════════════════════════════════════════
#  Test BarAggregator
# ═══════════════════════════════════════════════════════════════════════════════

class TestBarAggregator:
    def test_time_bar_aggregation(self, make_ticks):
        agg = BarAggregator(bar_type=BarType.TIME, interval=10, symbol='AAPL')
        ticks = make_ticks(200, interval=0.1)  # 200 ticks over 20 seconds
        bars = agg.process_ticks(ticks)
        assert len(bars) >= 1
        for b in bars:
            assert b.is_closed
            assert b.volume > 0

    def test_tick_bar_aggregation(self, make_ticks):
        agg = BarAggregator(bar_type=BarType.TICK, interval=10, symbol='AAPL')
        ticks = make_ticks(100)
        bars = agg.process_ticks(ticks)
        assert len(bars) == 10  # 100 ticks / 10 per bar
        for b in bars:
            assert b.trades == 10

    def test_volume_bar_aggregation(self, make_ticks):
        agg = BarAggregator(bar_type=BarType.VOLUME, interval=5000, symbol='AAPL')
        ticks = make_ticks(200)
        bars = agg.process_ticks(ticks)
        assert len(bars) >= 1
        # Each completed bar should have at least interval volume
        for b in bars:
            assert b.volume >= 5000 or not b.is_closed

    def test_range_bar_aggregation(self, make_ticks):
        agg = BarAggregator(bar_type=BarType.RANGE, interval=0.5, symbol='AAPL')
        ticks = make_ticks(500, start_price=150)
        bars = agg.process_ticks(ticks)
        assert len(bars) >= 1

    def test_renko_bar_aggregation(self, make_ticks):
        agg = BarAggregator(bar_type=BarType.RENKO, interval=0.5, symbol='AAPL')
        ticks = make_ticks(500, start_price=150)
        bars = agg.process_ticks(ticks)
        # Check that renko bricks have fixed size
        for b in bars:
            assert abs(b.close - b.open) <= 0.5 + 1e-6

    def test_bar_callback(self, make_ticks):
        received = []
        agg = BarAggregator(bar_type=BarType.TICK, interval=10)
        agg.on_bar_complete(lambda b: received.append(b))
        agg.process_ticks(make_ticks(50))
        assert len(received) == 5

    def test_current_bar(self, make_ticks):
        agg = BarAggregator(bar_type=BarType.TIME, interval=3600)
        ticks = make_ticks(10)
        agg.process_ticks(ticks)
        assert agg.current_bar is not None
        assert agg.current_bar.is_closed is False

    def test_reset(self, make_ticks):
        agg = BarAggregator(bar_type=BarType.TICK, interval=10)
        agg.process_ticks(make_ticks(50))
        assert len(agg.bars) > 0
        agg.reset()
        assert len(agg.bars) == 0
        assert agg.current_bar is None


# ═══════════════════════════════════════════════════════════════════════════════
#  Test MultiTimeframeAggregator
# ═══════════════════════════════════════════════════════════════════════════════

class TestMultiTimeframeAggregator:
    def test_aggregate_5m(self, sample_1m_bars):
        result = MultiTimeframeAggregator.aggregate(sample_1m_bars, '5m')
        # 200 1-min bars → 40 full 5-min bars + possibly 1 partial
        assert 40 <= len(result) <= 41
        assert 'open' in result.columns
        assert 'high' in result.columns

    def test_aggregate_15m(self, sample_1m_bars):
        result = MultiTimeframeAggregator.aggregate(sample_1m_bars, '15m')
        expected = 200 // 15 + (1 if 200 % 15 else 0)
        assert len(result) <= expected + 1

    def test_aggregate_1h(self, sample_1m_bars):
        result = MultiTimeframeAggregator.aggregate(sample_1m_bars, '1h')
        # 200 minutes → ~ 3-4 hourly bars
        assert len(result) >= 3

    def test_aggregate_preserves_ohlc(self, sample_1m_bars):
        result = MultiTimeframeAggregator.aggregate(sample_1m_bars, '5m')
        for _, row in result.iterrows():
            assert row['high'] >= row['open']
            assert row['high'] >= row['close']
            assert row['low'] <= row['open']
            assert row['low'] <= row['close']

    def test_aggregate_with_extras(self, sample_1m_bars):
        result = MultiTimeframeAggregator.aggregate_with_extras(sample_1m_bars, '5m')
        assert 'volume' in result.columns
        assert result['volume'].sum() > 0

    def test_aggregate_empty(self):
        result = MultiTimeframeAggregator.aggregate(pd.DataFrame(), '5m')
        assert len(result) == 0

    def test_aggregate_invalid_tf(self, sample_1m_bars):
        with pytest.raises(ValueError):
            MultiTimeframeAggregator.aggregate(sample_1m_bars, 'invalid')


# ═══════════════════════════════════════════════════════════════════════════════
#  Test RealTimeStats
# ═══════════════════════════════════════════════════════════════════════════════

class TestRealTimeStats:
    def test_empty_snapshot(self):
        stats = RealTimeStats()
        snap = stats.snapshot()
        assert snap['tick_count'] == 0

    def test_basic_stats(self, make_ticks):
        stats = RealTimeStats()
        for t in make_ticks(100):
            stats.update(t)
        snap = stats.snapshot()
        assert snap['tick_count'] == 100
        assert snap['last_price'] > 0
        assert snap['total_volume'] > 0
        assert snap['high'] >= snap['low']
        assert 0 <= snap['buy_ratio'] <= 1

    def test_vwap(self, make_ticks):
        stats = RealTimeStats()
        for t in make_ticks(50):
            stats.update(t)
        snap = stats.snapshot()
        assert snap['vwap'] > 0
        assert snap['vwap'] >= snap['low']
        assert snap['vwap'] <= snap['high']

    def test_volatility(self, make_ticks):
        stats = RealTimeStats()
        for t in make_ticks(100):
            stats.update(t)
        snap = stats.snapshot()
        assert snap['volatility_window'] >= 0

    def test_reset(self, make_ticks):
        stats = RealTimeStats()
        for t in make_ticks(50):
            stats.update(t)
        stats.reset()
        snap = stats.snapshot()
        assert snap['tick_count'] == 0


# ═══════════════════════════════════════════════════════════════════════════════
#  Test OrderBook & OrderBookProcessor
# ═══════════════════════════════════════════════════════════════════════════════

class TestOrderBook:
    def test_book_properties(self, sample_order_book):
        book = sample_order_book
        assert book.best_bid == 150.00
        assert book.best_ask == 150.01
        assert abs(book.mid_price - 150.005) < 1e-6
        assert abs(book.spread - 0.01) < 1e-6
        assert book.spread_bps is not None
        assert book.total_bid_depth == 1950
        assert book.total_ask_depth == 1700
        assert -1 <= book.imbalance <= 1

    def test_depth_chart(self, sample_order_book):
        result = OrderBookProcessor.depth_chart(sample_order_book)
        assert len(result['bids']) == 5
        assert len(result['asks']) == 5
        # Cumulative should be increasing
        for i in range(1, len(result['bids'])):
            assert result['bids'][i]['cumulative'] >= result['bids'][i-1]['cumulative']

    def test_book_pressure(self, sample_order_book):
        result = OrderBookProcessor.book_pressure(sample_order_book, depth=5)
        assert result['bid_pressure'] + result['ask_pressure'] == pytest.approx(1.0, rel=1e-6)
        assert result['bid_depth'] == 1950
        assert result['ask_depth'] == 1700

    def test_detect_walls(self, sample_order_book):
        result = OrderBookProcessor.detect_walls(sample_order_book, threshold_multiple=1.5)
        # Should find the 800-size bid wall at 149.98 and 600-size ask wall at 150.03
        assert isinstance(result['bid_walls'], list)
        assert isinstance(result['ask_walls'], list)

    def test_weighted_mid_price(self, sample_order_book):
        wmp = OrderBookProcessor.weighted_mid_price(sample_order_book)
        assert wmp is not None
        assert 150.00 <= wmp <= 150.01

    def test_book_shape(self, sample_order_book):
        shape = OrderBookProcessor.book_shape(sample_order_book)
        assert 0 <= shape['bid_concentration'] <= 1
        assert shape['bid_shape'] in ('concentrated', 'distributed')


# ═══════════════════════════════════════════════════════════════════════════════
#  Test TimeAndSalesProcessor
# ═══════════════════════════════════════════════════════════════════════════════

class TestTimeAndSalesProcessor:
    def test_add_trade(self):
        processor = TimeAndSalesProcessor()
        trade = TradeRecord(timestamp=1700000000, price=150, size=100, side='buy')
        processor.add_trade(trade)
        assert len(processor._trades) == 1

    def test_block_trades(self):
        processor = TimeAndSalesProcessor()
        processor._block_threshold = 1000
        processor.add_trade(TradeRecord(timestamp=1700000000, price=150, size=5000, side='buy'))
        processor.add_trade(TradeRecord(timestamp=1700000001, price=150, size=100, side='sell'))
        blocks = processor.block_trades()
        assert len(blocks) == 1
        assert blocks[0]['size'] == 5000

    def test_tape_speed(self):
        processor = TimeAndSalesProcessor()
        for i in range(100):
            processor.add_trade(TradeRecord(
                timestamp=1700000000 + i * 0.5,
                price=150 + i * 0.01,
                size=100,
                side='buy' if i % 2 == 0 else 'sell',
            ))
        speed = processor.tape_speed(window_seconds=60)
        assert speed['tps'] > 0
        assert speed['total_volume'] > 0
        assert speed['trades_in_window'] == 100

    def test_price_at_volume(self):
        processor = TimeAndSalesProcessor()
        for i in range(200):
            processor.add_trade(TradeRecord(
                timestamp=1700000000 + i, price=150 + (i % 10) * 0.1, size=100, side='buy',
            ))
        pav = processor.price_at_volume(levels=10)
        assert len(pav) == 10
        for item in pav:
            assert 'price' in item
            assert 'volume' in item


# ═══════════════════════════════════════════════════════════════════════════════
#  Test MarketBreadth
# ═══════════════════════════════════════════════════════════════════════════════

class TestMarketBreadth:
    def test_advance_decline_line(self):
        adv = pd.Series([100, 120, 90, 110, 130])
        dec = pd.Series([80, 60, 90, 70, 50])
        ad_line = MarketBreadth.advance_decline_line(adv, dec)
        assert len(ad_line) == 5
        assert ad_line.iloc[0] == 20  # 100-80

    def test_trin(self):
        adv = pd.Series([200, 200, 200])
        dec = pd.Series([100, 100, 100])
        adv_vol = pd.Series([1000000, 1000000, 1000000])
        dec_vol = pd.Series([500000, 500000, 500000])
        trin = MarketBreadth.trin(adv, dec, adv_vol, dec_vol)
        # TRIN = (200/100) / (1M/0.5M) = 2/2 = 1
        assert abs(trin.iloc[0] - 1.0) < 1e-6

    def test_mcclellan_oscillator(self):
        rng = np.random.RandomState(42)
        adv = pd.Series(100 + rng.randint(-20, 20, 100))
        dec = pd.Series(80 + rng.randint(-20, 20, 100))
        result = MarketBreadth.mcclellan_oscillator(adv, dec)
        assert 'oscillator' in result.columns
        assert 'summation' in result.columns
        assert len(result) == 100

    def test_new_highs_lows(self):
        highs = pd.Series([50, 60, 70, 40, 80])
        lows = pd.Series([30, 20, 10, 50, 5])
        result = MarketBreadth.new_highs_lows(highs, lows)
        assert 'diff' in result.columns
        assert 'cumulative' in result.columns

    def test_percent_above_ma(self):
        rng = np.random.RandomState(42)
        closes = pd.DataFrame({
            'A': 100 + np.cumsum(rng.randn(100)),
            'B': 100 + np.cumsum(rng.randn(100)),
            'C': 100 + np.cumsum(rng.randn(100)),
        })
        pct = MarketBreadth.percent_above_ma(closes, ma_period=20)
        assert len(pct) == 100
        # Should be between 0 and 100
        valid = pct.dropna()
        assert (valid >= 0).all() and (valid <= 100).all()

    def test_sector_rotation(self):
        rng = np.random.RandomState(42)
        sectors = pd.DataFrame({
            'Tech': rng.randn(100) * 0.01,
            'Finance': rng.randn(100) * 0.01,
            'Energy': rng.randn(100) * 0.01,
        })
        market = pd.Series(rng.randn(100) * 0.01)
        result = MarketBreadth.sector_rotation(sectors, market, lookback=20)
        assert 'Tech' in result.columns
        assert len(result) == 100


# ═══════════════════════════════════════════════════════════════════════════════
#  Test SessionAnalytics
# ═══════════════════════════════════════════════════════════════════════════════

class TestSessionAnalytics:
    def test_classify_session_rth(self):
        # 2:30 PM ET = 7:30 PM UTC (during non-DST)
        # 9:30 AM ET = 2:30 PM UTC
        ts = 1700060400  # approximate
        result = SessionAnalytics.classify_session(ts)
        assert isinstance(result, SessionType)

    def test_gap_analysis(self):
        df = pd.DataFrame({
            'time': [1700000000, 1700086400, 1700172800],
            'open': [150, 155, 148],
            'high': [156, 158, 152],
            'low': [148, 153, 146],
            'close': [153, 156, 150],
        })
        gaps = SessionAnalytics.gap_analysis(df)
        assert len(gaps) == 2
        assert 'gap' in gaps.columns
        assert 'gap_pct' in gaps.columns
        assert 'gap_type' in gaps.columns
        assert 'gap_filled' in gaps.columns

    def test_gap_analysis_empty(self):
        result = SessionAnalytics.gap_analysis(pd.DataFrame())
        assert len(result) == 0


# ═══════════════════════════════════════════════════════════════════════════════
#  Test IntradayVWAP
# ═══════════════════════════════════════════════════════════════════════════════

class TestIntradayVWAP:
    def test_calculate_vwap(self, sample_1m_bars):
        result = IntradayVWAP.calculate(sample_1m_bars, bands=[1.0, 2.0])
        assert 'vwap' in result.columns
        assert 'upper_1.0' in result.columns
        assert 'lower_1.0' in result.columns
        assert 'upper_2.0' in result.columns
        assert 'lower_2.0' in result.columns
        # VWAP should be between high and low of session
        assert result['vwap'].iloc[-1] > 0

    def test_calculate_empty(self):
        result = IntradayVWAP.calculate(pd.DataFrame())
        assert len(result) == 0

    def test_anchored_vwap(self, sample_1m_bars):
        anchor = sample_1m_bars['time'].iloc[50]
        result = IntradayVWAP.anchored_vwap(sample_1m_bars, anchor)
        assert len(result) == 150  # 200 - 50
        assert result.iloc[0] > 0


# ═══════════════════════════════════════════════════════════════════════════════
#  Test CorrelationAnalyzer
# ═══════════════════════════════════════════════════════════════════════════════

class TestCorrelationAnalyzer:
    def test_correlation_matrix(self):
        rng = np.random.RandomState(42)
        prices = pd.DataFrame({
            'AAPL': 100 + np.cumsum(rng.randn(100) * 0.5),
            'GOOG': 100 + np.cumsum(rng.randn(100) * 0.5),
            'MSFT': 100 + np.cumsum(rng.randn(100) * 0.5),
        })
        corr = CorrelationAnalyzer.correlation_matrix(prices, window=20)
        assert corr.shape == (3, 3)
        # Diagonal should be 1
        for sym in ['AAPL', 'GOOG', 'MSFT']:
            assert abs(corr.loc[sym, sym] - 1.0) < 1e-10

    def test_rolling_correlation(self):
        rng = np.random.RandomState(42)
        a = pd.Series(100 + np.cumsum(rng.randn(100)))
        b = pd.Series(100 + np.cumsum(rng.randn(100)))
        result = CorrelationAnalyzer.rolling_correlation(a, b, window=20)
        assert len(result) == 100
        valid = result.dropna()
        assert (valid >= -1).all() and (valid <= 1).all()

    def test_beta(self):
        rng = np.random.RandomState(42)
        asset = pd.Series(100 + np.cumsum(rng.randn(300)))
        bench = pd.Series(100 + np.cumsum(rng.randn(300)))
        result = CorrelationAnalyzer.beta(asset, bench, window=100)
        assert len(result) == 300

    def test_pair_divergence(self):
        rng = np.random.RandomState(42)
        a = pd.Series(100 + np.cumsum(rng.randn(100)))
        b = pd.Series(100 + np.cumsum(rng.randn(100)))
        result = CorrelationAnalyzer.pair_divergence(a, b, window=20)
        assert 'spread' in result.columns
        assert 'z_score' in result.columns
        assert 'signal' in result.columns


# ═══════════════════════════════════════════════════════════════════════════════
#  Test MarketDataEngine (orchestrator)
# ═══════════════════════════════════════════════════════════════════════════════

class TestMarketDataEngine:
    def test_register_symbol(self):
        engine = MarketDataEngine()
        engine.register_symbol('AAPL', timeframes=['1m', '5m'])
        assert 'AAPL' in engine._aggregators
        assert '1m' in engine._aggregators['AAPL']
        assert '5m' in engine._aggregators['AAPL']

    def test_process_tick(self, make_ticks):
        engine = MarketDataEngine()
        engine.register_symbol('AAPL', timeframes=['1m'])
        ticks = make_ticks(100, interval=1)
        for t in ticks:
            engine.process_tick(t)
        stats = engine.get_stats('AAPL')
        assert stats['tick_count'] == 100
        assert stats['total_volume'] > 0

    def test_get_bars(self, make_ticks):
        engine = MarketDataEngine()
        engine.register_symbol('AAPL', timeframes=['1m'])
        # Send enough ticks to fill multiple 1-minute bars
        ticks = make_ticks(200, interval=1.0)  # 200 seconds of ticks
        for t in ticks:
            engine.process_tick(t)
        bars = engine.get_bars('AAPL', '1m')
        assert len(bars) >= 2  # At least 2 completed 1-minute bars

    def test_get_current_bar(self, make_ticks):
        engine = MarketDataEngine()
        engine.register_symbol('AAPL', timeframes=['1m'])
        ticks = make_ticks(10, interval=0.1)
        for t in ticks:
            engine.process_tick(t)
        current = engine.get_current_bar('AAPL', '1m')
        assert current is not None
        assert current.is_closed is False

    def test_update_book(self, sample_order_book):
        engine = MarketDataEngine()
        engine.register_symbol('AAPL')
        engine.update_book(sample_order_book)
        analysis = engine.get_book_analysis('AAPL')
        assert 'bids' in analysis
        assert 'asks' in analysis
        assert 'pressure' in analysis

    def test_get_tape_analysis(self, make_ticks):
        engine = MarketDataEngine()
        engine.register_symbol('AAPL')
        for t in make_ticks(100, interval=0.5):
            engine.process_tick(t)
        analysis = engine.get_tape_analysis('AAPL')
        assert 'speed' in analysis
        assert 'block_trades' in analysis
        assert 'price_at_volume' in analysis

    def test_unregistered_symbol(self):
        engine = MarketDataEngine()
        assert engine.get_stats('UNKNOWN') == {}
        assert engine.get_bars('UNKNOWN', '1m') == []
        assert engine.get_current_bar('UNKNOWN', '1m') is None

    def test_multiple_symbols(self, make_ticks):
        engine = MarketDataEngine()
        engine.register_symbol('AAPL', timeframes=['1m'])
        engine.register_symbol('GOOG', timeframes=['1m'])
        for t in make_ticks(50, symbol='AAPL'):
            engine.process_tick(t)
        for t in make_ticks(30, symbol='GOOG'):
            engine.process_tick(t)
        assert engine.get_stats('AAPL')['tick_count'] == 50
        assert engine.get_stats('GOOG')['tick_count'] == 30
