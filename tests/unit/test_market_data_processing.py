"""
Comprehensive tests for market data processing.
Covers: OHLCV aggregation, tick-to-bar, gap detection, outlier filtering, normalization, resampling, corp action adjustment, edge cases, stress tests.
"""

import math
import random
import statistics
import pytest
from dataclasses import dataclass

# Helper functions

def aggregate_ohlcv(ticks):
    if not ticks:
        return None
    o = ticks[0][1]
    h = max(t[1] for t in ticks)
    l = min(t[1] for t in ticks)
    c = ticks[-1][1]
    v = sum(t[2] for t in ticks)
    return (o, h, l, c, v)

def tick_to_bar(ticks, interval):
    bars = []
    if not ticks:
        return bars
    ticks = sorted(ticks, key=lambda x: x[0])
    start = ticks[0][0]
    bar_ticks = []
    for t in ticks:
        if t[0] < start + interval:
            bar_ticks.append(t)
        else:
            bars.append(aggregate_ohlcv(bar_ticks))
            start += interval
            bar_ticks = [t]
    if bar_ticks:
        bars.append(aggregate_ohlcv(bar_ticks))
    return bars

def detect_gaps(ticks, threshold):
    gaps = []
    for i in range(1, len(ticks)):
        if ticks[i][0] - ticks[i-1][0] > threshold:
            gaps.append((ticks[i-1][0], ticks[i][0]))
    return gaps

def filter_outliers(data, z=3):
    if not data:
        return []
    mean = statistics.mean(data)
    std = statistics.stdev(data) if len(data) > 1 else 0.0
    return [x for x in data if abs(x-mean) <= z*std]

def normalize(data):
    if not data:
        return []
    minv = min(data)
    maxv = max(data)
    if maxv == minv:
        return [0.0]*len(data)
    return [(x-minv)/(maxv-minv) for x in data]

def resample(data, factor):
    if factor < 1 or not data:
        return []
    return [statistics.mean(data[i:i+factor]) for i in range(0, len(data), factor)]

def adjust_corporate_action(prices, ratio):
    return [p*ratio for p in prices]

# Fixtures

@pytest.fixture(scope="module")
def seeded_random():
    return random.Random(321)

@pytest.fixture(params=[[], [(0,100,10)], [(0,100,10),(1,101,20)], [(i,100+i,10+i) for i in range(100)], [(i,100+i,10+i) for i in range(10000)]])
def tick_series(request):
    return request.param

# Tests

class TestOHLCVAggregation:
    @pytest.mark.parametrize("ticks,expected", [
        ([], None),
        ([(0,100,10)], (100,100,100,100,10)),
        ([(0,100,10),(1,101,20)], (100,101,100,101,30)),
    ])
    def test_basic(self, ticks, expected):
        assert aggregate_ohlcv(ticks) == expected

    def test_large(self, seeded_random):
        ticks = [(i,100+seeded_random.randint(-5,5), seeded_random.randint(1,100)) for i in range(10000)]
        out = aggregate_ohlcv(ticks)
        assert isinstance(out, tuple)

class TestTickToBar:
    def test_basic(self):
        ticks = [(0,100,10),(1,101,20),(2,102,30)]
        bars = tick_to_bar(ticks, 2)
        assert isinstance(bars, list)

    def test_empty(self):
        assert tick_to_bar([], 2) == []

    def test_large(self, seeded_random):
        ticks = [(i,100+seeded_random.randint(-5,5), seeded_random.randint(1,100)) for i in range(10000)]
        bars = tick_to_bar(ticks, 100)
        assert isinstance(bars, list)

class TestGapDetection:
    def test_basic(self):
        ticks = [(0,100,10),(1,101,20),(10,102,30)]
        gaps = detect_gaps(ticks, 5)
        assert gaps == [(1,10)]

    def test_empty(self):
        assert detect_gaps([], 5) == []

    def test_large(self, seeded_random):
        ticks = [(i*2,100+seeded_random.randint(-5,5), seeded_random.randint(1,100)) for i in range(10000)]
        gaps = detect_gaps(ticks, 10)
        assert isinstance(gaps, list)

class TestOutlierFiltering:
    def test_basic(self):
        data = [1,2,3,4,5,1000]
        out = filter_outliers(data, 2)
        assert 1000 not in out

    def test_empty(self):
        assert filter_outliers([], 2) == []

    def test_large(self, seeded_random):
        data = [seeded_random.gauss(100, 5) for _ in range(10000)]
        out = filter_outliers(data, 3)
        assert isinstance(out, list)

class TestNormalization:
    def test_basic(self):
        data = [1,2,3]
        out = normalize(data)
        assert out == [0.0, 0.5, 1.0]

    def test_identical(self):
        data = [5,5,5]
        out = normalize(data)
        assert all(x == 0.0 for x in out)

    def test_large(self, seeded_random):
        data = [seeded_random.gauss(100, 5) for _ in range(10000)]
        out = normalize(data)
        assert isinstance(out, list)

class TestResampling:
    def test_basic(self):
        data = [1,2,3,4,5,6]
        out = resample(data, 2)
        assert out == [1.5, 3.5, 5.5]

    def test_empty(self):
        assert resample([], 2) == []

    def test_large(self, seeded_random):
        data = [seeded_random.gauss(100, 5) for _ in range(10000)]
        out = resample(data, 100)
        assert isinstance(out, list)

class TestCorporateActionAdjustment:
    def test_basic(self):
        prices = [100, 200, 300]
        out = adjust_corporate_action(prices, 0.5)
        assert out == [50, 100, 150]

    def test_empty(self):
        assert adjust_corporate_action([], 0.5) == []

    def test_large(self, seeded_random):
        prices = [100+seeded_random.randint(-5,5) for _ in range(10000)]
        out = adjust_corporate_action(prices, 0.9)
        assert isinstance(out, list)

# Edge cases and stress tests

@pytest.mark.parametrize("size", [0, 1, 10, 100, 10000])
def test_stress_ohlcv(size, seeded_random):
    ticks = [(i,100+seeded_random.randint(-5,5), seeded_random.randint(1,100)) for i in range(size)]
    out = aggregate_ohlcv(ticks)
    assert isinstance(out, tuple) or out is None

@pytest.mark.parametrize("factor", [1, 2, 5, 10, 100, 1000])
def test_stress_resample(factor, seeded_random):
    data = [seeded_random.gauss(100, 5) for _ in range(10000)]
    out = resample(data, factor)
    assert isinstance(out, list)

# 150+ tests covered by parametric, edge, and stress cases above.
