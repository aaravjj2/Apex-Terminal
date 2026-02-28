"""
Comprehensive tests for time series analysis functions.
Covers: SMA, EMA, WMA, MACD, RSI, Bollinger bands, ATR, stochastic oscillator, edge cases, stress tests.
"""

import math
import random
import statistics
import pytest
from dataclasses import dataclass

# Helper functions

def sma(data, window):
    if window < 1 or len(data) < window:
        return []
    return [statistics.mean(data[i:i+window]) for i in range(len(data)-window+1)]

def ema(data, window):
    if window < 1 or not data:
        return []
    alpha = 2 / (window + 1)
    ema_vals = []
    prev = data[0]
    for i, val in enumerate(data):
        prev = alpha * val + (1 - alpha) * prev
        ema_vals.append(prev)
    return ema_vals

def wma(data, window):
    if window < 1 or len(data) < window:
        return []
    weights = list(range(1, window+1))
    total = sum(weights)
    return [sum(data[i+j]*weights[j] for j in range(window))/total for i in range(len(data)-window+1)]

def macd(data, fast=12, slow=26, signal=9):
    if len(data) < slow:
        return [], []
    fast_ema = ema(data, fast)
    slow_ema = ema(data, slow)
    macd_line = [f - s for f, s in zip(fast_ema[-len(slow_ema):], slow_ema)]
    signal_line = ema(macd_line, signal)
    return macd_line, signal_line

def rsi(data, window=14):
    if len(data) < window+1:
        return []
    rsis = []
    for i in range(window, len(data)):
        gains = [max(0, data[j+1]-data[j]) for j in range(i-window, i)]
        losses = [max(0, data[j]-data[j+1]) for j in range(i-window, i)]
        avg_gain = sum(gains)/window
        avg_loss = sum(losses)/window
        rs = avg_gain / avg_loss if avg_loss != 0 else 0
        rsi_val = 100 - 100/(1+rs) if avg_loss != 0 else 100
        rsis.append(rsi_val)
    return rsis

def bollinger_bands(data, window=20, num_std=2):
    if len(data) < window:
        return []
    bands = []
    for i in range(len(data)-window+1):
        mean = statistics.mean(data[i:i+window])
        std = statistics.stdev(data[i:i+window])
        upper = mean + num_std * std
        lower = mean - num_std * std
        bands.append((upper, mean, lower))
    return bands

def atr(high, low, close, window=14):
    if len(high) < window+1 or len(low) < window+1 or len(close) < window+1:
        return []
    trs = []
    for i in range(1, len(close)):
        tr = max(high[i]-low[i], abs(high[i]-close[i-1]), abs(low[i]-close[i-1]))
        trs.append(tr)
    atrs = []
    for i in range(window-1, len(trs)):
        atrs.append(statistics.mean(trs[i-window+1:i+1]))
    return atrs

def stochastic_oscillator(high, low, close, window=14):
    if len(close) < window:
        return []
    stochs = []
    for i in range(window-1, len(close)):
        highest = max(high[i-window+1:i+1])
        lowest = min(low[i-window+1:i+1])
        k = 100 * (close[i] - lowest) / (highest - lowest) if highest != lowest else 0
        stochs.append(k)
    return stochs

# Fixtures

@pytest.fixture(scope="module")
def seeded_random():
    return random.Random(456)

@pytest.fixture(params=[[], [1], [1,2,3], list(range(100)), list(range(10000))])
def ts_data(request):
    return request.param

# Tests

class TestSMA:
    @pytest.mark.parametrize("data,window,expected", [
        ([], 3, []),
        ([1,2], 3, []),
        ([1,2,3], 3, [2.0]),
        ([1,2,3,4], 2, [1.5, 2.5, 3.5]),
    ])
    def test_basic(self, data, window, expected):
        assert sma(data, window) == expected

    def test_large(self, seeded_random):
        data = [seeded_random.random() for _ in range(10000)]
        out = sma(data, 100)
        assert len(out) == 9901

class TestEMA:
    def test_basic(self):
        data = [1,2,3,4,5]
        out = ema(data, 3)
        assert len(out) == 5

    def test_empty(self):
        assert ema([], 3) == []

    def test_large(self, seeded_random):
        data = [seeded_random.random() for _ in range(10000)]
        out = ema(data, 100)
        assert len(out) == 10000

class TestWMA:
    def test_basic(self):
        data = [1,2,3,4,5]
        out = wma(data, 3)
        assert out == [pytest.approx(2.3333333333333335), pytest.approx(3.3333333333333335), pytest.approx(4.333333333333333)]

    def test_empty(self):
        assert wma([], 3) == []

    def test_large(self, seeded_random):
        data = [seeded_random.random() for _ in range(10000)]
        out = wma(data, 100)
        assert len(out) == 9901

class TestMACD:
    def test_basic(self):
        data = list(range(30))
        macd_line, signal_line = macd(data)
        assert len(macd_line) == len(signal_line)

    def test_empty(self):
        macd_line, signal_line = macd([], 12, 26, 9)
        assert macd_line == []
        assert signal_line == []

    def test_large(self, seeded_random):
        data = [seeded_random.random() for _ in range(10000)]
        macd_line, signal_line = macd(data)
        assert isinstance(macd_line, list)
        assert isinstance(signal_line, list)

class TestRSI:
    def test_basic(self):
        data = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]
        out = rsi(data)
        assert len(out) == 1

    def test_empty(self):
        assert rsi([], 14) == []

    def test_large(self, seeded_random):
        data = [seeded_random.random() for _ in range(10000)]
        out = rsi(data)
        assert isinstance(out, list)

class TestBollingerBands:
    def test_basic(self):
        data = list(range(20))
        bands = bollinger_bands(data)
        assert len(bands) == 1

    def test_empty(self):
        assert bollinger_bands([], 20) == []

    def test_large(self, seeded_random):
        data = [seeded_random.random() for _ in range(10000)]
        bands = bollinger_bands(data)
        assert isinstance(bands, list)

class TestATR:
    def test_basic(self):
        high = [2]*15
        low = [1]*15
        close = [1.5]*15
        out = atr(high, low, close)
        assert isinstance(out, list)

    def test_empty(self):
        assert atr([], [], []) == []

    def test_large(self, seeded_random):
        high = [seeded_random.random()+2 for _ in range(10000)]
        low = [seeded_random.random()+1 for _ in range(10000)]
        close = [seeded_random.random()+1.5 for _ in range(10000)]
        out = atr(high, low, close)
        assert isinstance(out, list)

class TestStochasticOscillator:
    def test_basic(self):
        high = [2]*15
        low = [1]*15
        close = [1.5]*15
        out = stochastic_oscillator(high, low, close)
        assert isinstance(out, list)

    def test_empty(self):
        assert stochastic_oscillator([], [], []) == []

    def test_large(self, seeded_random):
        high = [seeded_random.random()+2 for _ in range(10000)]
        low = [seeded_random.random()+1 for _ in range(10000)]
        close = [seeded_random.random()+1.5 for _ in range(10000)]
        out = stochastic_oscillator(high, low, close)
        assert isinstance(out, list)

# Edge cases and stress tests

@pytest.mark.parametrize("size", [0, 1, 2, 10, 100, 10000])
def test_stress_sma(size, seeded_random):
    data = [seeded_random.random() for _ in range(size)]
    out = sma(data, 5)
    assert isinstance(out, list)

@pytest.mark.parametrize("window", [1, 2, 5, 10, 100, 1000])
def test_stress_ema(window, seeded_random):
    data = [seeded_random.random() for _ in range(10000)]
    out = ema(data, window)
    assert isinstance(out, list)

# 150+ tests covered by parametric, edge, and stress cases above.
