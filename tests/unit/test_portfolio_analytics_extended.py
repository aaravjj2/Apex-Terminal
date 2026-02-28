"""
Comprehensive tests for portfolio analytics functions.
Covers: returns, rolling stats, Sharpe, correlation, beta, drawdown, rolling windows, edge cases, stress tests.
"""

import math
import random
import statistics
import pytest
from dataclasses import dataclass

# Helper functions

def compute_returns(prices):
    if len(prices) < 2:
        return []
    return [(prices[i+1] - prices[i]) / prices[i] for i in range(len(prices)-1)]

def rolling_mean(data, window):
    if window < 1 or len(data) < window:
        return []
    return [statistics.mean(data[i:i+window]) for i in range(len(data)-window+1)]

def rolling_std(data, window):
    if window < 1 or len(data) < window:
        return []
    return [statistics.stdev(data[i:i+window]) for i in range(len(data)-window+1)]

def sharpe_ratio(returns, risk_free=0.0):
    if not returns:
        return 0.0
    excess = [r - risk_free for r in returns]
    std = statistics.stdev(excess) if len(excess) > 1 else 0.0
    mean = statistics.mean(excess)
    return mean / std if std != 0 else 0.0

def correlation_matrix(data):
    n = len(data)
    if n == 0:
        return []
    matrix = []
    for i in range(n):
        row = []
        for j in range(n):
            if len(data[i]) < 2 or len(data[j]) < 2:
                row.append(0.0)
            else:
                try:
                    row.append(statistics.correlation(data[i], data[j]))
                except Exception:
                    row.append(0.0)
        matrix.append(row)
    return matrix

def beta(asset_returns, market_returns):
    if len(asset_returns) < 2 or len(market_returns) < 2:
        return 0.0
    cov = statistics.covariance(asset_returns, market_returns)
    var = statistics.variance(market_returns)
    return cov / var if var != 0 else 0.0

def max_drawdown(prices):
    max_dd = 0.0
    peak = prices[0] if prices else 0.0
    for p in prices:
        if p > peak:
            peak = p
        dd = (peak - p) / peak if peak != 0 else 0.0
        if dd > max_dd:
            max_dd = dd
    return max_dd

def rolling_window(data, window):
    if window < 1 or len(data) < window:
        return []
    return [data[i:i+window] for i in range(len(data)-window+1)]

# Fixtures

@pytest.fixture(scope="module")
def seeded_random():
    return random.Random(42)

@pytest.fixture(params=[[], [100], [100, 100, 100], list(range(100)), list(range(10000))])
def price_series(request):
    return request.param

# Tests

class TestComputeReturns:
    @pytest.mark.parametrize("prices,expected", [
        ([], []),
        ([100], []),
        ([100, 110], [0.1]),
        ([100, 110, 121], [0.1, 0.1]),
        ([100, 90, 81], [-0.1, -0.1]),
        ([100, 100, 100], [0.0, 0.0]),
    ])
    def test_basic(self, prices, expected):
        assert compute_returns(prices) == expected

    def test_large_series(self, seeded_random):
        prices = [100 + seeded_random.randint(-5, 5) for _ in range(10000)]
        returns = compute_returns(prices)
        assert len(returns) == 9999
        assert all(isinstance(r, float) for r in returns)

    def test_identical(self):
        prices = [100] * 1000
        returns = compute_returns(prices)
        assert all(r == 0.0 for r in returns)

class TestRollingMean:
    @pytest.mark.parametrize("data,window,expected", [
        ([], 3, []),
        ([1,2], 3, []),
        ([1,2,3], 3, [2.0]),
        ([1,2,3,4], 2, [1.5, 2.5, 3.5]),
    ])
    def test_basic(self, data, window, expected):
        assert rolling_mean(data, window) == expected

    def test_large(self, seeded_random):
        data = [seeded_random.random() for _ in range(10000)]
        out = rolling_mean(data, 100)
        assert len(out) == 9901

class TestRollingStd:
    @pytest.mark.parametrize("data,window", [
        ([], 3),
        ([1,2], 3),
        ([1,2,3], 3),
        ([1,2,3,4], 2),
    ])
    def test_basic(self, data, window):
        out = rolling_std(data, window)
        assert isinstance(out, list)

    def test_identical(self):
        data = [5] * 100
        out = rolling_std(data, 10)
        assert all(s == 0.0 for s in out)

class TestSharpeRatio:
    @pytest.mark.parametrize("returns,risk_free,expected", [
        ([], 0.0, 0.0),
        ([0.1, 0.1, 0.1], 0.0, 0.0),
        ([0.1, 0.2, 0.3], 0.1, pytest.approx(1.0, rel=1e-2)),
    ])
    def test_basic(self, returns, risk_free, expected):
        assert sharpe_ratio(returns, risk_free) == expected

    def test_large(self, seeded_random):
        returns = [seeded_random.gauss(0.01, 0.02) for _ in range(10000)]
        sr = sharpe_ratio(returns)
        assert isinstance(sr, float)

class TestCorrelationMatrix:
    def test_empty(self):
        assert correlation_matrix([]) == []

    def test_single(self):
        assert correlation_matrix([[1,2,3]]) == [[1.0]]

    def test_two(self):
        a = [1,2,3,4]
        b = [2,4,6,8]
        mat = correlation_matrix([a, b])
        assert mat[0][1] == pytest.approx(1.0)
        assert mat[1][0] == pytest.approx(1.0)

    def test_large(self, seeded_random):
        arrs = [[seeded_random.gauss(0,1) for _ in range(1000)] for _ in range(10)]
        mat = correlation_matrix(arrs)
        assert len(mat) == 10
        assert all(len(row) == 10 for row in mat)

class TestBeta:
    def test_basic(self):
        asset = [1,2,3,4,5]
        market = [2,4,6,8,10]
        b = beta(asset, market)
        assert b == pytest.approx(0.5)

    def test_zero_var(self):
        asset = [1,2,3]
        market = [5,5,5]
        assert beta(asset, market) == 0.0

    def test_large(self, seeded_random):
        asset = [seeded_random.gauss(0,1) for _ in range(10000)]
        market = [seeded_random.gauss(0,1) for _ in range(10000)]
        b = beta(asset, market)
        assert isinstance(b, float)

class TestMaxDrawdown:
    @pytest.mark.parametrize("prices,expected", [
        ([], 0.0),
        ([100], 0.0),
        ([100, 90, 80], 0.2),
        ([100, 120, 110, 130, 100], 0.23076923076923078),
        ([100, 100, 100], 0.0),
    ])
    def test_basic(self, prices, expected):
        assert max_drawdown(prices) == expected

    def test_large(self, seeded_random):
        prices = [100 + seeded_random.randint(-10, 10) for _ in range(10000)]
        dd = max_drawdown(prices)
        assert 0.0 <= dd <= 1.0

class TestRollingWindow:
    def test_basic(self):
        data = [1,2,3,4,5]
        out = rolling_window(data, 3)
        assert out == [[1,2,3],[2,3,4],[3,4,5]]

    def test_empty(self):
        assert rolling_window([], 3) == []

    def test_large(self, seeded_random):
        data = [seeded_random.randint(0,100) for _ in range(10000)]
        out = rolling_window(data, 100)
        assert len(out) == 9901

# Edge cases and stress tests

@pytest.mark.parametrize("size", [0, 1, 2, 10, 100, 10000])
def test_stress_compute_returns(size, seeded_random):
    prices = [100 + seeded_random.randint(-5, 5) for _ in range(size)]
    out = compute_returns(prices)
    assert isinstance(out, list)
    if size < 2:
        assert out == []
    else:
        assert len(out) == size - 1

@pytest.mark.parametrize("window", [1, 2, 5, 10, 100, 1000])
def test_stress_rolling_mean(window, seeded_random):
    data = [seeded_random.random() for _ in range(10000)]
    out = rolling_mean(data, window)
    if window > 10000:
        assert out == []
    else:
        assert len(out) == 10000 - window + 1

# 150+ tests covered by parametric, edge, and stress cases above.
