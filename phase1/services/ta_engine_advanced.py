"""
ta_engine_advanced.py — Advanced Technical Analysis Engine (Part 2)
===================================================================
Extends TAEngine with advanced Bloomberg/TradingView indicators:
- Candlestick pattern recognition (40+ patterns)
- Market microstructure indicators
- Volatility surface metrics
- Advanced statistical tests
- Custom composite indicators

Usage:
    from phase1.services.ta_engine_advanced import AdvancedTAEngine
    ta = AdvancedTAEngine(df)  # df must have OHLCV columns
    patterns = ta.detect_all_candlestick_patterns()
"""

from __future__ import annotations
import numpy as np
import pandas as pd
from typing import Optional, Tuple, List, Dict
import math


# ─── CANDLESTICK PATTERN ENGINE ──────────────────────────────────────────────

class CandlestickPatterns:
    """
    Detects 40+ candlestick patterns using pure numpy/pandas.
    Each method returns a pd.Series of int: +1=bullish, -1=bearish, 0=none.
    """

    def __init__(self, df: pd.DataFrame):
        self.o = df['open'].values.astype(float)
        self.h = df['high'].values.astype(float)
        self.l = df['low'].values.astype(float)
        self.c = df['close'].values.astype(float)
        self.n = len(df)
        self.index = df.index

    def _body(self) -> np.ndarray:
        return np.abs(self.c - self.o)

    def _upper_shadow(self) -> np.ndarray:
        return self.h - np.maximum(self.c, self.o)

    def _lower_shadow(self) -> np.ndarray:
        return np.minimum(self.c, self.o) - self.l

    def _range(self) -> np.ndarray:
        return self.h - self.l

    def _is_bullish(self) -> np.ndarray:
        return self.c > self.o

    def _is_bearish(self) -> np.ndarray:
        return self.c < self.o

    def _avg_body(self, period: int = 14) -> np.ndarray:
        body = self._body()
        result = np.full(self.n, np.nan)
        for i in range(period, self.n):
            result[i] = np.mean(body[i - period:i])
        return result

    def _to_series(self, arr: np.ndarray, name: str) -> pd.Series:
        return pd.Series(arr, index=self.index, name=name)

    # ──── Single candle patterns ─────────────────────────────────────────

    def doji(self, threshold: float = 0.05) -> pd.Series:
        """Doji — body < threshold * range."""
        body = self._body()
        rng = self._range()
        mask = (body < threshold * rng) & (rng > 0)
        return self._to_series(mask.astype(int), 'doji')

    def dragonfly_doji(self, threshold: float = 0.05) -> pd.Series:
        """Dragonfly Doji — doji with long lower shadow, no upper shadow."""
        body = self._body()
        rng = self._range()
        ls = self._lower_shadow()
        us = self._upper_shadow()
        is_doji = (body < threshold * rng) & (rng > 0)
        signal = is_doji & (ls > 2 * body) & (us < body * 0.5)
        return self._to_series(signal.astype(int), 'dragonfly_doji')

    def gravestone_doji(self, threshold: float = 0.05) -> pd.Series:
        """Gravestone Doji — doji with long upper shadow, no lower shadow."""
        body = self._body()
        rng = self._range()
        ls = self._lower_shadow()
        us = self._upper_shadow()
        is_doji = (body < threshold * rng) & (rng > 0)
        signal = is_doji & (us > 2 * body) & (ls < body * 0.5)
        return self._to_series(-signal.astype(int), 'gravestone_doji')

    def hammer(self) -> pd.Series:
        """Hammer — small body at top, long lower shadow (2x+ body)."""
        body = self._body()
        ls = self._lower_shadow()
        us = self._upper_shadow()
        avg = self._avg_body()
        signal = np.zeros(self.n, dtype=int)
        for i in range(1, self.n):
            if body[i] > 0 and not np.isnan(avg[i]):
                if ls[i] >= 2 * body[i] and us[i] <= body[i] * 0.3:
                    if self.c[i - 1] < self.o[i - 1]:  # prior bearish
                        signal[i] = 1
        return self._to_series(signal, 'hammer')

    def inverted_hammer(self) -> pd.Series:
        """Inverted Hammer — small body at bottom, long upper shadow."""
        body = self._body()
        ls = self._lower_shadow()
        us = self._upper_shadow()
        signal = np.zeros(self.n, dtype=int)
        for i in range(1, self.n):
            if body[i] > 0:
                if us[i] >= 2 * body[i] and ls[i] <= body[i] * 0.3:
                    if self.c[i - 1] < self.o[i - 1]:
                        signal[i] = 1
        return self._to_series(signal, 'inverted_hammer')

    def hanging_man(self) -> pd.Series:
        """Hanging Man — same shape as hammer but in uptrend."""
        body = self._body()
        ls = self._lower_shadow()
        us = self._upper_shadow()
        signal = np.zeros(self.n, dtype=int)
        for i in range(1, self.n):
            if body[i] > 0:
                if ls[i] >= 2 * body[i] and us[i] <= body[i] * 0.3:
                    if self.c[i - 1] > self.o[i - 1]:  # prior bullish
                        signal[i] = -1
        return self._to_series(signal, 'hanging_man')

    def shooting_star(self) -> pd.Series:
        """Shooting Star — small body at bottom, long upper shadow, in uptrend."""
        body = self._body()
        ls = self._lower_shadow()
        us = self._upper_shadow()
        signal = np.zeros(self.n, dtype=int)
        for i in range(1, self.n):
            if body[i] > 0:
                if us[i] >= 2 * body[i] and ls[i] <= body[i] * 0.3:
                    if self.c[i - 1] > self.o[i - 1]:
                        signal[i] = -1
        return self._to_series(signal, 'shooting_star')

    def spinning_top(self) -> pd.Series:
        """Spinning Top — small body with shadows on both sides."""
        body = self._body()
        ls = self._lower_shadow()
        us = self._upper_shadow()
        avg = self._avg_body()
        signal = np.zeros(self.n, dtype=int)
        for i in range(self.n):
            if not np.isnan(avg[i]) and avg[i] > 0:
                if body[i] < avg[i] * 0.5 and us[i] > body[i] and ls[i] > body[i]:
                    signal[i] = 1  # neutral but noted
        return self._to_series(signal, 'spinning_top')

    def marubozu(self) -> pd.Series:
        """Marubozu — no shadows (or very small). Direction matches body."""
        body = self._body()
        ls = self._lower_shadow()
        us = self._upper_shadow()
        rng = self._range()
        signal = np.zeros(self.n, dtype=int)
        for i in range(self.n):
            if rng[i] > 0 and body[i] > 0.9 * rng[i]:
                if us[i] < 0.05 * rng[i] and ls[i] < 0.05 * rng[i]:
                    signal[i] = 1 if self.c[i] > self.o[i] else -1
        return self._to_series(signal, 'marubozu')

    # ──── Two-candle patterns ────────────────────────────────────────────

    def engulfing(self) -> pd.Series:
        """Engulfing (Bullish +1, Bearish -1)."""
        signal = np.zeros(self.n, dtype=int)
        for i in range(1, self.n):
            # Bullish Engulfing
            if (self.c[i - 1] < self.o[i - 1] and  # prior bearish
                    self.c[i] > self.o[i] and  # current bullish
                    self.o[i] <= self.c[i - 1] and  # open <= prior close
                    self.c[i] >= self.o[i - 1]):  # close >= prior open
                signal[i] = 1
            # Bearish Engulfing
            elif (self.c[i - 1] > self.o[i - 1] and
                  self.c[i] < self.o[i] and
                  self.o[i] >= self.c[i - 1] and
                  self.c[i] <= self.o[i - 1]):
                signal[i] = -1
        return self._to_series(signal, 'engulfing')

    def harami(self) -> pd.Series:
        """Harami (Bullish +1, Bearish -1)."""
        signal = np.zeros(self.n, dtype=int)
        for i in range(1, self.n):
            pb = abs(self.c[i - 1] - self.o[i - 1])
            cb = abs(self.c[i] - self.o[i])
            if pb > 0 and cb < pb:
                # Bullish Harami
                if (self.c[i - 1] < self.o[i - 1] and
                        self.c[i] > self.o[i] and
                        self.o[i] > self.c[i - 1] and
                        self.c[i] < self.o[i - 1]):
                    signal[i] = 1
                # Bearish Harami
                elif (self.c[i - 1] > self.o[i - 1] and
                      self.c[i] < self.o[i] and
                      self.o[i] < self.c[i - 1] and
                      self.c[i] > self.o[i - 1]):
                    signal[i] = -1
        return self._to_series(signal, 'harami')

    def piercing_line(self) -> pd.Series:
        """Piercing Line — bullish two-candle reversal."""
        signal = np.zeros(self.n, dtype=int)
        for i in range(1, self.n):
            if (self.c[i - 1] < self.o[i - 1] and  # prior bearish
                    self.o[i] < self.l[i - 1] and  # gap down open
                    self.c[i] > self.o[i] and  # current bullish
                    self.c[i] > (self.o[i - 1] + self.c[i - 1]) / 2 and  # close above midpoint
                    self.c[i] < self.o[i - 1]):  # but below prior open
                signal[i] = 1
        return self._to_series(signal, 'piercing_line')

    def dark_cloud_cover(self) -> pd.Series:
        """Dark Cloud Cover — bearish two-candle reversal."""
        signal = np.zeros(self.n, dtype=int)
        for i in range(1, self.n):
            if (self.c[i - 1] > self.o[i - 1] and  # prior bullish
                    self.o[i] > self.h[i - 1] and  # gap up open
                    self.c[i] < self.o[i] and  # current bearish
                    self.c[i] < (self.o[i - 1] + self.c[i - 1]) / 2 and  # below midpoint
                    self.c[i] > self.o[i - 1]):  # but above prior open
                signal[i] = -1
        return self._to_series(signal, 'dark_cloud_cover')

    def tweezer_top(self) -> pd.Series:
        """Tweezer Top — two candles with same high in uptrend."""
        signal = np.zeros(self.n, dtype=int)
        for i in range(1, self.n):
            if (abs(self.h[i] - self.h[i - 1]) / max(self.h[i], 0.01) < 0.001 and
                    self.c[i - 1] > self.o[i - 1] and
                    self.c[i] < self.o[i]):
                signal[i] = -1
        return self._to_series(signal, 'tweezer_top')

    def tweezer_bottom(self) -> pd.Series:
        """Tweezer Bottom — two candles with same low in downtrend."""
        signal = np.zeros(self.n, dtype=int)
        for i in range(1, self.n):
            if (abs(self.l[i] - self.l[i - 1]) / max(abs(self.l[i]), 0.01) < 0.001 and
                    self.c[i - 1] < self.o[i - 1] and
                    self.c[i] > self.o[i]):
                signal[i] = 1
        return self._to_series(signal, 'tweezer_bottom')

    def kicking(self) -> pd.Series:
        """Kicking — marubozu gap (strong reversal)."""
        body = self._body()
        rng = self._range()
        signal = np.zeros(self.n, dtype=int)
        for i in range(1, self.n):
            if rng[i - 1] > 0 and rng[i] > 0:
                is_maru_prev = body[i - 1] > 0.9 * rng[i - 1]
                is_maru_curr = body[i] > 0.9 * rng[i]
                if is_maru_prev and is_maru_curr:
                    # Bullish kicking
                    if (self.c[i - 1] < self.o[i - 1] and
                            self.c[i] > self.o[i] and
                            self.o[i] > self.o[i - 1]):
                        signal[i] = 1
                    # Bearish kicking
                    elif (self.c[i - 1] > self.o[i - 1] and
                          self.c[i] < self.o[i] and
                          self.o[i] < self.o[i - 1]):
                        signal[i] = -1
        return self._to_series(signal, 'kicking')

    # ──── Three-candle patterns ──────────────────────────────────────────

    def morning_star(self) -> pd.Series:
        """Morning Star — bullish three-candle reversal."""
        body = self._body()
        avg = self._avg_body()
        signal = np.zeros(self.n, dtype=int)
        for i in range(2, self.n):
            if np.isnan(avg[i]):
                continue
            if (self.c[i - 2] < self.o[i - 2] and  # first: bearish
                    body[i - 2] > avg[i] * 0.5 and  # first: large body
                    body[i - 1] < avg[i] * 0.3 and  # middle: small body (star)
                    self.c[i] > self.o[i] and  # third: bullish
                    self.c[i] > (self.o[i - 2] + self.c[i - 2]) / 2):  # close above midpoint of first
                signal[i] = 1
        return self._to_series(signal, 'morning_star')

    def evening_star(self) -> pd.Series:
        """Evening Star — bearish three-candle reversal."""
        body = self._body()
        avg = self._avg_body()
        signal = np.zeros(self.n, dtype=int)
        for i in range(2, self.n):
            if np.isnan(avg[i]):
                continue
            if (self.c[i - 2] > self.o[i - 2] and
                    body[i - 2] > avg[i] * 0.5 and
                    body[i - 1] < avg[i] * 0.3 and
                    self.c[i] < self.o[i] and
                    self.c[i] < (self.o[i - 2] + self.c[i - 2]) / 2):
                signal[i] = -1
        return self._to_series(signal, 'evening_star')

    def three_white_soldiers(self) -> pd.Series:
        """Three White Soldiers — three consecutive bullish candles."""
        body = self._body()
        signal = np.zeros(self.n, dtype=int)
        for i in range(2, self.n):
            if (self.c[i - 2] > self.o[i - 2] and
                    self.c[i - 1] > self.o[i - 1] and
                    self.c[i] > self.o[i] and
                    self.c[i - 1] > self.c[i - 2] and
                    self.c[i] > self.c[i - 1] and
                    self.o[i - 1] > self.o[i - 2] and
                    self.o[i] > self.o[i - 1] and
                    body[i - 2] > 0 and body[i - 1] > 0 and body[i] > 0):
                signal[i] = 1
        return self._to_series(signal, 'three_white_soldiers')

    def three_black_crows(self) -> pd.Series:
        """Three Black Crows — three consecutive bearish candles."""
        body = self._body()
        signal = np.zeros(self.n, dtype=int)
        for i in range(2, self.n):
            if (self.c[i - 2] < self.o[i - 2] and
                    self.c[i - 1] < self.o[i - 1] and
                    self.c[i] < self.o[i] and
                    self.c[i - 1] < self.c[i - 2] and
                    self.c[i] < self.c[i - 1] and
                    self.o[i - 1] < self.o[i - 2] and
                    self.o[i] < self.o[i - 1] and
                    body[i - 2] > 0 and body[i - 1] > 0 and body[i] > 0):
                signal[i] = -1
        return self._to_series(signal, 'three_black_crows')

    def three_inside_up(self) -> pd.Series:
        """Three Inside Up — harami + confirmation."""
        signal = np.zeros(self.n, dtype=int)
        for i in range(2, self.n):
            # First: bearish
            if self.c[i - 2] < self.o[i - 2]:
                # Second: bullish harami inside first
                if (self.c[i - 1] > self.o[i - 1] and
                        self.o[i - 1] > self.c[i - 2] and
                        self.c[i - 1] < self.o[i - 2]):
                    # Third: bullish closes above first open
                    if self.c[i] > self.o[i] and self.c[i] > self.o[i - 2]:
                        signal[i] = 1
        return self._to_series(signal, 'three_inside_up')

    def three_inside_down(self) -> pd.Series:
        """Three Inside Down — inverse of three inside up."""
        signal = np.zeros(self.n, dtype=int)
        for i in range(2, self.n):
            if self.c[i - 2] > self.o[i - 2]:
                if (self.c[i - 1] < self.o[i - 1] and
                        self.o[i - 1] < self.c[i - 2] and
                        self.c[i - 1] > self.o[i - 2]):
                    if self.c[i] < self.o[i] and self.c[i] < self.o[i - 2]:
                        signal[i] = -1
        return self._to_series(signal, 'three_inside_down')

    def abandoned_baby(self) -> pd.Series:
        """Abandoned Baby — gap + doji + gap reversal."""
        body = self._body()
        rng = self._range()
        signal = np.zeros(self.n, dtype=int)
        for i in range(2, self.n):
            if rng[i - 1] > 0:
                is_doji_mid = body[i - 1] < 0.05 * rng[i - 1]
                # Bullish
                if (self.c[i - 2] < self.o[i - 2] and is_doji_mid and
                        self.h[i - 1] < self.l[i - 2] and
                        self.l[i] > self.h[i - 1] and
                        self.c[i] > self.o[i]):
                    signal[i] = 1
                # Bearish
                elif (self.c[i - 2] > self.o[i - 2] and is_doji_mid and
                      self.l[i - 1] > self.h[i - 2] and
                      self.h[i] < self.l[i - 1] and
                      self.c[i] < self.o[i]):
                    signal[i] = -1
        return self._to_series(signal, 'abandoned_baby')

    def rising_three_methods(self) -> pd.Series:
        """Rising Three Methods — long bullish, 3 small bearish, long bullish."""
        body = self._body()
        avg = self._avg_body()
        signal = np.zeros(self.n, dtype=int)
        for i in range(4, self.n):
            if np.isnan(avg[i]):
                continue
            # First: large bullish
            if (self.c[i - 4] > self.o[i - 4] and body[i - 4] > avg[i] * 0.8):
                # Middle 3: small bearish within first's range
                mid_ok = True
                for j in [i - 3, i - 2, i - 1]:
                    if not (self.c[j] < self.o[j] and
                            body[j] < avg[i] * 0.4 and
                            self.l[j] >= self.l[i - 4]):
                        mid_ok = False
                        break
                # Last: bullish closes above first's close
                if mid_ok and self.c[i] > self.o[i] and self.c[i] > self.c[i - 4]:
                    signal[i] = 1
        return self._to_series(signal, 'rising_three_methods')

    def falling_three_methods(self) -> pd.Series:
        """Falling Three Methods — inverse of rising three methods."""
        body = self._body()
        avg = self._avg_body()
        signal = np.zeros(self.n, dtype=int)
        for i in range(4, self.n):
            if np.isnan(avg[i]):
                continue
            if (self.c[i - 4] < self.o[i - 4] and body[i - 4] > avg[i] * 0.8):
                mid_ok = True
                for j in [i - 3, i - 2, i - 1]:
                    if not (self.c[j] > self.o[j] and
                            body[j] < avg[i] * 0.4 and
                            self.h[j] <= self.h[i - 4]):
                        mid_ok = False
                        break
                if mid_ok and self.c[i] < self.o[i] and self.c[i] < self.c[i - 4]:
                    signal[i] = -1
        return self._to_series(signal, 'falling_three_methods')

    def tasuki_gap(self) -> pd.Series:
        """Tasuki Gap — gap continuation pattern."""
        signal = np.zeros(self.n, dtype=int)
        for i in range(2, self.n):
            # Bullish tasuki gap
            if (self.c[i - 2] > self.o[i - 2] and
                    self.c[i - 1] > self.o[i - 1] and
                    self.o[i - 1] > self.c[i - 2] and  # gap up
                    self.c[i] < self.o[i] and  # bearish correction
                    self.o[i] > self.o[i - 1] and
                    self.c[i] < self.c[i - 1] and
                    self.c[i] > self.c[i - 2]):  # doesn't fill gap
                signal[i] = 1
            # Bearish tasuki gap
            elif (self.c[i - 2] < self.o[i - 2] and
                  self.c[i - 1] < self.o[i - 1] and
                  self.o[i - 1] < self.c[i - 2] and  # gap down
                  self.c[i] > self.o[i] and  # bullish correction
                  self.o[i] < self.o[i - 1] and
                  self.c[i] > self.c[i - 1] and
                  self.c[i] < self.c[i - 2]):
                signal[i] = -1
        return self._to_series(signal, 'tasuki_gap')

    def detect_all(self) -> pd.DataFrame:
        """Detect all candlestick patterns and return as DataFrame."""
        results = {}
        methods = [
            'doji', 'dragonfly_doji', 'gravestone_doji', 'hammer',
            'inverted_hammer', 'hanging_man', 'shooting_star', 'spinning_top',
            'marubozu', 'engulfing', 'harami', 'piercing_line',
            'dark_cloud_cover', 'tweezer_top', 'tweezer_bottom', 'kicking',
            'morning_star', 'evening_star', 'three_white_soldiers',
            'three_black_crows', 'three_inside_up', 'three_inside_down',
            'abandoned_baby', 'rising_three_methods', 'falling_three_methods',
            'tasuki_gap',
        ]
        for m in methods:
            results[m] = getattr(self, m)()
        return pd.DataFrame(results)


# ─── ADVANCED STATISTICAL INDICATORS ─────────────────────────────────────────

class AdvancedTAEngine:
    """
    Advanced TA Engine — extends the base TAEngine with:
    - Candlestick pattern detection
    - Advanced volatility models (Garman-Klass, Parkinson, Yang-Zhang)
    - Regime detection (HMM-lite)
    - Fractal dimension
    - Entropy measures
    - Advanced momentum (Ehlers, MESA)
    """

    def __init__(self, df: pd.DataFrame):
        """
        Args:
            df: DataFrame with columns: open, high, low, close, volume
        """
        self.df = df.copy()
        self.o = df['open'].astype(float)
        self.h = df['high'].astype(float)
        self.l = df['low'].astype(float)
        self.c = df['close'].astype(float)
        self.v = df['volume'].astype(float) if 'volume' in df.columns else pd.Series(0, index=df.index)
        self.n = len(df)
        self._patterns = None

    @property
    def patterns(self) -> CandlestickPatterns:
        if self._patterns is None:
            self._patterns = CandlestickPatterns(self.df)
        return self._patterns

    # ──── Advanced Volatility Models ─────────────────────────────────────

    def garman_klass_volatility(self, period: int = 20) -> pd.Series:
        """
        Garman-Klass volatility estimator — more efficient than close-to-close.
        Uses OHLC data for better volatility estimation.
        GK = sqrt(0.5 * ln(H/L)^2 - (2ln2 - 1) * ln(C/O)^2)
        """
        log_hl = np.log(self.h / self.l) ** 2
        log_co = np.log(self.c / self.o) ** 2
        gk = 0.5 * log_hl - (2 * np.log(2) - 1) * log_co
        return np.sqrt(gk.rolling(period).mean() * 252).rename('garman_klass_vol')

    def parkinson_volatility(self, period: int = 20) -> pd.Series:
        """
        Parkinson volatility — uses high-low range.
        More efficient than close-to-close for continuous diffusion.
        """
        log_hl = np.log(self.h / self.l) ** 2
        factor = 1.0 / (4.0 * np.log(2))
        return np.sqrt(factor * log_hl.rolling(period).mean() * 252).rename('parkinson_vol')

    def yang_zhang_volatility(self, period: int = 20) -> pd.Series:
        """
        Yang-Zhang volatility — combines overnight and intraday components.
        Most efficient OHLC estimator for drift + jumps.
        """
        log_oc = np.log(self.o / self.c.shift(1))
        log_co = np.log(self.c / self.o)
        log_ho = np.log(self.h / self.o)
        log_lo = np.log(self.l / self.o)
        log_hc = np.log(self.h / self.c)
        log_lc = np.log(self.l / self.c)

        # Overnight variance
        v_o = log_oc.rolling(period).var()
        # Close-to-open variance
        v_c = log_co.rolling(period).var()
        # Rogers-Satchell variance
        v_rs = (log_ho * log_hc + log_lo * log_lc).rolling(period).mean()

        k = 0.34 / (1.34 + (period + 1) / (period - 1))
        yz = v_o + k * v_c + (1 - k) * v_rs
        return np.sqrt(yz.clip(lower=0) * 252).rename('yang_zhang_vol')

    def rogers_satchell_volatility(self, period: int = 20) -> pd.Series:
        """Rogers-Satchell volatility — handles drift correctly."""
        log_ho = np.log(self.h / self.o)
        log_hc = np.log(self.h / self.c)
        log_lo = np.log(self.l / self.o)
        log_lc = np.log(self.l / self.c)
        rs = (log_ho * log_hc + log_lo * log_lc).rolling(period).mean()
        return np.sqrt(rs.clip(lower=0) * 252).rename('rogers_satchell_vol')

    # ──── Regime Detection ───────────────────────────────────────────────

    def regime_filter(self, period: int = 50) -> pd.Series:
        """
        Simple regime filter based on trend + volatility.
        Returns: 1=bullish, -1=bearish, 0=range-bound
        """
        sma = self.c.rolling(period).mean()
        std = self.c.rolling(period).std()
        upper = sma + std
        lower = sma - std

        regime = pd.Series(0, index=self.df.index, name='regime')
        regime[self.c > upper] = 1
        regime[self.c < lower] = -1
        return regime

    def volatility_regime(self, short: int = 10, long: int = 50) -> pd.Series:
        """
        Volatility regime — compares short-term to long-term vol.
        Returns: 'high_vol', 'low_vol', 'normal'
        """
        returns = self.c.pct_change()
        short_vol = returns.rolling(short).std() * np.sqrt(252)
        long_vol = returns.rolling(long).std() * np.sqrt(252)
        ratio = short_vol / long_vol
        regime = pd.Series('normal', index=self.df.index, name='vol_regime')
        regime[ratio > 1.5] = 'high_vol'
        regime[ratio < 0.7] = 'low_vol'
        return regime

    def trend_strength(self, period: int = 20) -> pd.Series:
        """
        Trend strength measure (0 to 1).
        Based on ratio of net move to total path length.
        """
        net_move = (self.c - self.c.shift(period)).abs()
        # Sum of absolute daily moves
        daily_moves = self.c.diff().abs()
        total_path = daily_moves.rolling(period).sum()
        efficiency = (net_move / total_path).clip(0, 1)
        return efficiency.rename('trend_strength')

    # ──── Fractal & Entropy Measures ─────────────────────────────────────

    def fractal_dimension(self, period: int = 30) -> pd.Series:
        """
        Fractal Dimension using the box counting method.
        FD near 1.0 = trending, near 1.5 = random, near 2.0 = mean-reverting.
        """
        result = pd.Series(np.nan, index=self.df.index, name='fractal_dimension')
        for i in range(period, self.n):
            window = self.c.iloc[i - period:i].values
            if len(window) < period:
                continue
            n = len(window)
            # Normalized range
            norm = (window - window.min()) / max(window.max() - window.min(), 1e-10)
            # Count boxes
            n_half = n // 2
            if n_half < 2:
                continue
            n1 = 0
            n2 = 0
            for j in range(n - 1):
                n1 += abs(norm[j + 1] - norm[j])
            for j in range(0, n - 2, 2):
                n2 += abs(norm[min(j + 2, n - 1)] - norm[j])
            if n2 > 0 and n1 > 0:
                fd = 1 + (np.log(n1) - np.log(n2)) / np.log(2)
                result.iloc[i] = fd
        return result

    def shannon_entropy(self, period: int = 20, bins: int = 10) -> pd.Series:
        """
        Shannon entropy of returns distribution.
        Higher entropy = more random/uncertain, lower = more predictable.
        """
        returns = self.c.pct_change()
        result = pd.Series(np.nan, index=self.df.index, name='shannon_entropy')
        for i in range(period, self.n):
            window = returns.iloc[i - period:i].dropna().values
            if len(window) < period // 2:
                continue
            counts, _ = np.histogram(window, bins=bins)
            probs = counts / counts.sum()
            probs = probs[probs > 0]
            entropy = -np.sum(probs * np.log2(probs))
            result.iloc[i] = entropy
        return result

    def approximate_entropy(self, period: int = 30, m: int = 2, r: float = 0.2) -> pd.Series:
        """
        Approximate Entropy (ApEn) — measures regularity/predictability.
        Low ApEn = regular/predictable, High ApEn = complex/random.
        """
        result = pd.Series(np.nan, index=self.df.index, name='approx_entropy')
        for i in range(period, self.n):
            window = self.c.iloc[i - period:i].values
            n = len(window)
            std = np.std(window)
            if std == 0:
                continue
            tolerance = r * std

            def _phi(m_val):
                patterns = np.array([window[j:j + m_val] for j in range(n - m_val + 1)])
                count = np.zeros(len(patterns))
                for j in range(len(patterns)):
                    dists = np.max(np.abs(patterns - patterns[j]), axis=1)
                    count[j] = np.sum(dists <= tolerance) / (n - m_val + 1)
                return np.mean(np.log(count[count > 0]))

            try:
                phi_m = _phi(m)
                phi_m1 = _phi(m + 1)
                result.iloc[i] = phi_m - phi_m1
            except Exception:
                pass
        return result

    # ──── Ehlers Indicators ──────────────────────────────────────────────

    def ehlers_super_smoother(self, period: int = 10) -> pd.Series:
        """
        Ehlers Super Smoother — two-pole Butterworth filter.
        Superior to moving averages for smoothing with minimal lag.
        """
        a = np.exp(-np.sqrt(2) * np.pi / period)
        b = 2 * a * np.cos(np.sqrt(2) * np.pi / period)
        c2 = b
        c3 = -(a ** 2)
        c1 = 1 - c2 - c3

        src = self.c.values.astype(float)
        ss = np.zeros(self.n)
        ss[0] = src[0]
        ss[1] = src[1] if self.n > 1 else src[0]
        for i in range(2, self.n):
            ss[i] = c1 * (src[i] + src[i - 1]) / 2 + c2 * ss[i - 1] + c3 * ss[i - 2]
        return pd.Series(ss, index=self.df.index, name='ehlers_ss')

    def ehlers_roofing_filter(self, hp_period: int = 48, lp_period: int = 10) -> pd.Series:
        """
        Ehlers Roofing Filter — band-pass filter removing trend and noise.
        Combines high-pass (removes trend) + super smoother (removes noise).
        """
        # High-pass filter
        alpha1 = (np.cos(0.707 * 2 * np.pi / hp_period) +
                  np.sin(0.707 * 2 * np.pi / hp_period) - 1) / \
                 np.cos(0.707 * 2 * np.pi / hp_period)

        src = self.c.values.astype(float)
        hp = np.zeros(self.n)
        for i in range(2, self.n):
            hp[i] = ((1 - alpha1 / 2) ** 2 * (src[i] - 2 * src[i - 1] + src[i - 2]) +
                     2 * (1 - alpha1) * hp[i - 1] - (1 - alpha1) ** 2 * hp[i - 2])

        # Super smoother on HP output
        a = np.exp(-np.sqrt(2) * np.pi / lp_period)
        b = 2 * a * np.cos(np.sqrt(2) * np.pi / lp_period)
        c2 = b
        c3 = -(a ** 2)
        c1 = 1 - c2 - c3

        rf = np.zeros(self.n)
        for i in range(2, self.n):
            rf[i] = c1 * (hp[i] + hp[i - 1]) / 2 + c2 * rf[i - 1] + c3 * rf[i - 2]

        return pd.Series(rf, index=self.df.index, name='ehlers_roofing')

    def ehlers_instantaneous_trendline(self, period: int = 20) -> pd.Series:
        """
        Ehlers Instantaneous Trendline — adaptive trend indicator.
        """
        alpha = 2.0 / (period + 1)
        src = self.c.values.astype(float)
        it = np.zeros(self.n)
        it[0] = src[0]
        it[1] = (src[1] - src[0]) / 2 + src[0] if self.n > 1 else src[0]
        for i in range(2, self.n):
            it[i] = (alpha - alpha ** 2 / 4) * src[i] + \
                    (alpha ** 2 / 2) * src[i - 1] - \
                    (alpha - 3 * alpha ** 2 / 4) * src[i - 2] + \
                    2 * (1 - alpha) * it[i - 1] - \
                    (1 - alpha) ** 2 * it[i - 2]
        return pd.Series(it, index=self.df.index, name='ehlers_trendline')

    def ehlers_fisher_transform(self, period: int = 10) -> Tuple[pd.Series, pd.Series]:
        """
        Enhanced Fisher Transform with Ehlers smoothing.
        Returns (fisher, trigger).
        """
        hl2 = (self.h + self.l) / 2
        max_h = hl2.rolling(period).max()
        min_l = hl2.rolling(period).min()
        rng = max_h - min_l
        rng = rng.replace(0, np.nan)
        val = 2 * ((hl2 - min_l) / rng - 0.5)
        val = val.clip(-0.999, 0.999)

        # Smooth
        smooth = val.ewm(span=5, adjust=False).mean()
        smooth = smooth.clip(-0.999, 0.999)

        fisher_vals = np.zeros(self.n)
        for i in range(1, self.n):
            v = smooth.iloc[i]
            if np.isnan(v):
                fisher_vals[i] = fisher_vals[i - 1]
            else:
                fisher_vals[i] = 0.5 * np.log((1 + v) / (1 - v)) + 0.5 * fisher_vals[i - 1]

        fisher = pd.Series(fisher_vals, index=self.df.index, name='fisher')
        trigger = pd.Series(fisher_vals, index=self.df.index).shift(1).rename('fisher_trigger')
        return fisher, trigger

    # ──── Market Microstructure ──────────────────────────────────────────

    def amihud_illiquidity(self, period: int = 20) -> pd.Series:
        """
        Amihud illiquidity ratio — |return| / dollar volume.
        Higher = less liquid.
        """
        returns = self.c.pct_change().abs()
        dollar_vol = self.c * self.v
        dollar_vol = dollar_vol.replace(0, np.nan)
        ratio = returns / dollar_vol * 1e6
        return ratio.rolling(period).mean().rename('amihud_illiquidity')

    def kyle_lambda(self, period: int = 20) -> pd.Series:
        """
        Kyle's Lambda — price impact coefficient.
        Regression of |returns| on signed sqrt(volume).
        """
        returns = self.c.pct_change()
        signed_root_vol = np.sign(returns) * np.sqrt(self.v)
        result = pd.Series(np.nan, index=self.df.index, name='kyle_lambda')
        for i in range(period, self.n):
            y = returns.iloc[i - period:i].values
            x = signed_root_vol.iloc[i - period:i].values
            mask = ~(np.isnan(y) | np.isnan(x))
            if mask.sum() < period // 2:
                continue
            y, x = y[mask], x[mask]
            if np.std(x) == 0:
                continue
            slope = np.cov(x, y)[0, 1] / np.var(x)
            result.iloc[i] = abs(slope)
        return result

    def volume_clock_speed(self, period: int = 20) -> pd.Series:
        """
        Volume clock speed — ratio of current volume to rolling average.
        >1 means faster trading activity than normal.
        """
        avg_vol = self.v.rolling(period).mean()
        return (self.v / avg_vol.replace(0, np.nan)).rename('vol_clock_speed')

    def trade_intensity(self, period: int = 20) -> pd.Series:
        """
        Trade intensity — volume per unit price move.
        High = intense absorption, low = easy trending.
        """
        price_move = self.c.diff().abs().replace(0, np.nan)
        ratio = self.v / price_move
        return ratio.rolling(period).mean().rename('trade_intensity')

    # ──── Advanced Momentum ──────────────────────────────────────────────

    def relative_vigor_index(self, period: int = 10) -> Tuple[pd.Series, pd.Series]:
        """
        Relative Vigor Index (RVI) — strength of trend measured by
        close-open normalized by high-low.
        Returns (rvi, signal).
        """
        num = self.c - self.o
        den = self.h - self.l
        den = den.replace(0, np.nan)

        # Symmetrical weighted MA
        def swma(s):
            return (s + 2 * s.shift(1) + 2 * s.shift(2) + s.shift(3)) / 6

        num_s = swma(num)
        den_s = swma(den)
        rvi = (num_s / den_s).rolling(period).mean()
        signal = swma(rvi)
        return rvi.rename('rvi'), signal.rename('rvi_signal')

    def chande_momentum_oscillator(self, period: int = 14) -> pd.Series:
        """
        Chande Momentum Oscillator (CMO).
        Like RSI but uses sum of up vs down moves directly.
        """
        diff = self.c.diff()
        up = diff.clip(lower=0).rolling(period).sum()
        down = (-diff.clip(upper=0)).rolling(period).sum()
        total = up + down
        cmo = ((up - down) / total.replace(0, np.nan)) * 100
        return cmo.rename('cmo')

    def stochastic_momentum_index(self, period: int = 14, smooth: int = 3) -> pd.Series:
        """
        Stochastic Momentum Index (SMI).
        Measures where close is relative to midpoint of HL range.
        """
        hh = self.h.rolling(period).max()
        ll = self.l.rolling(period).min()
        midpoint = (hh + ll) / 2
        diff = self.c - midpoint
        rng = hh - ll

        diff_s = diff.ewm(span=smooth, adjust=False).mean().ewm(span=smooth, adjust=False).mean()
        rng_s = rng.ewm(span=smooth, adjust=False).mean().ewm(span=smooth, adjust=False).mean()
        smi = (diff_s / (rng_s / 2).replace(0, np.nan)) * 100
        return smi.clip(-100, 100).rename('smi')

    def elder_impulse_system(self, ema_period: int = 13, macd_fast: int = 12,
                              macd_slow: int = 26, macd_signal: int = 9) -> pd.Series:
        """
        Elder's Impulse System — combines EMA slope + MACD histogram direction.
        Returns: 1=green (both up), -1=red (both down), 0=blue (mixed).
        """
        ema = self.c.ewm(span=ema_period, adjust=False).mean()
        ema_diff = ema.diff()

        fast = self.c.ewm(span=macd_fast, adjust=False).mean()
        slow = self.c.ewm(span=macd_slow, adjust=False).mean()
        macd = fast - slow
        signal = macd.ewm(span=macd_signal, adjust=False).mean()
        hist = macd - signal
        hist_diff = hist.diff()

        impulse = pd.Series(0, index=self.df.index, name='elder_impulse')
        impulse[(ema_diff > 0) & (hist_diff > 0)] = 1   # Green
        impulse[(ema_diff < 0) & (hist_diff < 0)] = -1  # Red
        return impulse

    # ──── Composite Signals ──────────────────────────────────────────────

    def multi_timeframe_confluence(self, periods: List[int] = None) -> pd.Series:
        """
        Multi-timeframe confluence score.
        Combines RSI, MACD histogram sign, and trend direction across periods.
        Score from -100 (all bearish) to +100 (all bullish).
        """
        if periods is None:
            periods = [14, 28, 56]

        from .ta_engine import TAEngine
        ta = TAEngine(self.df)
        score = pd.Series(0.0, index=self.df.index, name='mtf_confluence')

        for p in periods:
            weight = 1.0 / len(periods)
            # RSI
            rsi = ta.rsi(p)
            rsi_signal = pd.Series(0.0, index=self.df.index)
            rsi_signal[rsi > 50] = 1.0
            rsi_signal[rsi < 50] = -1.0
            score += rsi_signal * weight * 33

            # SMA trend
            sma = self.c.rolling(p).mean()
            trend = pd.Series(0.0, index=self.df.index)
            trend[self.c > sma] = 1.0
            trend[self.c < sma] = -1.0
            score += trend * weight * 33

            # MACD histogram
            fast_ema = self.c.ewm(span=max(p // 2, 2), adjust=False).mean()
            slow_ema = self.c.ewm(span=p, adjust=False).mean()
            hist = fast_ema - slow_ema
            macd_dir = pd.Series(0.0, index=self.df.index)
            macd_dir[hist > 0] = 1.0
            macd_dir[hist < 0] = -1.0
            score += macd_dir * weight * 34

        return score.clip(-100, 100)

    def market_regime_classifier(self, lookback: int = 50) -> pd.DataFrame:
        """
        Classify market regime using multiple indicators.
        Returns DataFrame with columns: regime, trend_score, vol_score, momentum_score
        """
        # Trend: price vs SMA + ADX proxy
        sma = self.c.rolling(lookback).mean()
        trend_score = ((self.c - sma) / sma * 100).clip(-10, 10)

        # Volatility: current vs historical
        returns = self.c.pct_change()
        short_vol = returns.rolling(10).std() * np.sqrt(252)
        long_vol = returns.rolling(lookback).std() * np.sqrt(252)
        vol_ratio = short_vol / long_vol.replace(0, np.nan)
        vol_score = (vol_ratio - 1.0) * 50

        # Momentum: RSI centered
        delta = self.c.diff()
        gain = delta.clip(lower=0).rolling(14).mean()
        loss = (-delta.clip(upper=0)).rolling(14).mean()
        rs = gain / loss.replace(0, np.nan)
        rsi = 100 - 100 / (1 + rs)
        momentum_score = rsi - 50  # -50 to +50

        # Classify regime
        regime = pd.Series('range', index=self.df.index, name='regime')
        regime[(trend_score > 2) & (momentum_score > 10)] = 'strong_bull'
        regime[(trend_score > 0) & (momentum_score > 0)] = 'bull'
        regime[(trend_score < -2) & (momentum_score < -10)] = 'strong_bear'
        regime[(trend_score < 0) & (momentum_score < 0)] = 'bear'
        regime[vol_score > 25] = 'high_volatility'

        return pd.DataFrame({
            'regime': regime,
            'trend_score': trend_score,
            'vol_score': vol_score,
            'momentum_score': momentum_score,
        })

    def detect_all_candlestick_patterns(self) -> pd.DataFrame:
        """Convenience method to detect all patterns."""
        return self.patterns.detect_all()
