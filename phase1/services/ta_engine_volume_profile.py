"""
ta_engine_volume_profile.py — Volume Profile & Market Profile Analysis
======================================================================
Bloomberg-grade volume profile, market profile (TPO), and advanced
volume analysis tools:
- Volume Profile (fixed range, visible range, session)
- Market Profile / TPO (Time Price Opportunity)
- Volume-Weighted Average Price variants (anchored, multi-session)
- Volume Delta & Cumulative Delta
- Volume Spread Analysis (VSA)
- Order Flow indicators (from OHLCV approximation)

Usage:
    from phase1.services.ta_engine_volume_profile import VolumeProfileEngine
    vp = VolumeProfileEngine(df)
    profile = vp.volume_profile(bins=100)
"""

from __future__ import annotations
import numpy as np
import pandas as pd
from typing import Optional, Tuple, List, Dict
from dataclasses import dataclass, field
import math


@dataclass
class VolumeProfileLevel:
    """Single price level in a volume profile."""
    price: float
    volume: float
    buy_volume: float
    sell_volume: float
    delta: float  # buy - sell
    pct_of_total: float


@dataclass
class VolumeProfileResult:
    """Complete volume profile result."""
    levels: List[VolumeProfileLevel]
    poc: float  # Point of Control
    vah: float  # Value Area High
    val: float  # Value Area Low
    total_volume: float
    value_area_volume: float
    high_volume_nodes: List[float]
    low_volume_nodes: List[float]


@dataclass
class TPOProfile:
    """Time Price Opportunity profile."""
    price_levels: Dict[float, int]  # price -> TPO count
    poc: float
    vah: float
    val: float
    initial_balance_high: float
    initial_balance_low: float
    profile_type: str  # normal, b-shaped, p-shaped, D-shaped
    single_prints: List[float]


@dataclass
class VSASignal:
    """Volume Spread Analysis signal."""
    bar_index: int
    signal_type: str  # 'climactic_action', 'no_demand', 'no_supply', etc.
    direction: int  # +1 bullish, -1 bearish
    strength: float  # 0-1


class VolumeProfileEngine:
    """
    Bloomberg-grade volume profile and market profile analysis.
    All methods work with standard OHLCV DataFrames.
    """

    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()
        self.o = df['open'].values.astype(float)
        self.h = df['high'].values.astype(float)
        self.l = df['low'].values.astype(float)
        self.c = df['close'].values.astype(float)
        self.v = df['volume'].values.astype(float) if 'volume' in df.columns else np.ones(len(df))
        self.n = len(df)
        self.index = df.index

    # ──── Volume Profile ─────────────────────────────────────────────────

    def volume_profile(self, start_idx: int = 0, end_idx: Optional[int] = None,
                       bins: int = 100, value_area_pct: float = 0.70) -> VolumeProfileResult:
        """
        Compute volume profile for a price range.

        Args:
            start_idx: Start bar index
            end_idx: End bar index (None = last)
            bins: Number of price levels
            value_area_pct: Percentage of volume for value area (default 70%)

        Returns:
            VolumeProfileResult with all profile data
        """
        if end_idx is None:
            end_idx = self.n

        h = self.h[start_idx:end_idx]
        l = self.l[start_idx:end_idx]
        c = self.c[start_idx:end_idx]
        o = self.o[start_idx:end_idx]
        v = self.v[start_idx:end_idx]

        if len(h) == 0:
            return VolumeProfileResult([], 0, 0, 0, 0, 0, [], [])

        price_low = np.min(l)
        price_high = np.max(h)
        price_range = price_high - price_low

        if price_range <= 0:
            return VolumeProfileResult([], price_low, price_low, price_low, 0, 0, [], [])

        # Create price bins
        bin_edges = np.linspace(price_low, price_high, bins + 1)
        bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2
        bin_volumes = np.zeros(bins)
        bin_buy = np.zeros(bins)
        bin_sell = np.zeros(bins)

        # Distribute volume across price levels
        for bar in range(len(h)):
            bar_low = l[bar]
            bar_high = h[bar]
            bar_vol = v[bar]
            bar_close = c[bar]
            bar_open = o[bar]

            # Determine buy/sell split
            is_bullish = bar_close >= bar_open
            buy_pct = 0.6 if is_bullish else 0.4  # Approximation from OHLCV

            # Find which bins this bar spans
            for b in range(bins):
                bin_lo = bin_edges[b]
                bin_hi = bin_edges[b + 1]

                # Overlap between bar range and bin
                overlap_lo = max(bar_low, bin_lo)
                overlap_hi = min(bar_high, bin_hi)

                if overlap_hi > overlap_lo:
                    bar_range = bar_high - bar_low
                    if bar_range > 0:
                        fraction = (overlap_hi - overlap_lo) / bar_range
                    else:
                        fraction = 1.0 / bins
                    vol_share = bar_vol * fraction
                    bin_volumes[b] += vol_share
                    bin_buy[b] += vol_share * buy_pct
                    bin_sell[b] += vol_share * (1 - buy_pct)

        total_volume = np.sum(bin_volumes)

        # Point of Control (POC) — highest volume level
        poc_idx = np.argmax(bin_volumes)
        poc_price = bin_centers[poc_idx]

        # Value Area — 70% of volume around POC
        vah_price, val_price, va_volume = self._compute_value_area(
            bin_centers, bin_volumes, poc_idx, value_area_pct
        )

        # High/Low Volume Nodes
        avg_vol = np.mean(bin_volumes[bin_volumes > 0]) if np.any(bin_volumes > 0) else 0
        hvn = [bin_centers[i] for i in range(bins)
               if bin_volumes[i] > avg_vol * 1.5]
        lvn = [bin_centers[i] for i in range(bins)
               if 0 < bin_volumes[i] < avg_vol * 0.5]

        # Build levels
        levels = []
        for b in range(bins):
            if bin_volumes[b] > 0:
                levels.append(VolumeProfileLevel(
                    price=float(bin_centers[b]),
                    volume=float(bin_volumes[b]),
                    buy_volume=float(bin_buy[b]),
                    sell_volume=float(bin_sell[b]),
                    delta=float(bin_buy[b] - bin_sell[b]),
                    pct_of_total=float(bin_volumes[b] / total_volume * 100) if total_volume > 0 else 0.0,
                ))

        return VolumeProfileResult(
            levels=levels,
            poc=float(poc_price),
            vah=float(vah_price),
            val=float(val_price),
            total_volume=float(total_volume),
            value_area_volume=float(va_volume),
            high_volume_nodes=hvn,
            low_volume_nodes=lvn,
        )

    def _compute_value_area(self, centers: np.ndarray, volumes: np.ndarray,
                            poc_idx: int, target_pct: float) -> Tuple[float, float, float]:
        """Expand from POC to capture target_pct of total volume."""
        total = np.sum(volumes)
        if total == 0:
            return centers[0], centers[0], 0.0

        target_vol = total * target_pct
        current_vol = volumes[poc_idx]
        upper = poc_idx
        lower = poc_idx

        while current_vol < target_vol:
            go_up = upper + 1 < len(volumes)
            go_down = lower - 1 >= 0

            if not go_up and not go_down:
                break

            up_vol = volumes[upper + 1] if go_up else -1
            down_vol = volumes[lower - 1] if go_down else -1

            if up_vol >= down_vol:
                upper += 1
                current_vol += volumes[upper]
            else:
                lower -= 1
                current_vol += volumes[lower]

        return float(centers[upper]), float(centers[lower]), float(current_vol)

    def visible_range_volume_profile(self, bins: int = 100) -> VolumeProfileResult:
        """Volume profile for entire visible range (all data)."""
        return self.volume_profile(0, self.n, bins)

    def session_volume_profile(self, session_length: int = 78, bins: int = 50) -> List[VolumeProfileResult]:
        """
        Compute volume profile for each trading session.
        Args:
            session_length: Number of bars per session (78 for 5min in 6.5hr session)
        """
        profiles = []
        for start in range(0, self.n, session_length):
            end = min(start + session_length, self.n)
            if end - start < 5:
                continue
            profiles.append(self.volume_profile(start, end, bins))
        return profiles

    # ──── Market Profile / TPO ───────────────────────────────────────────

    def tpo_profile(self, start_idx: int = 0, end_idx: Optional[int] = None,
                    tpo_size: Optional[float] = None, ib_periods: int = 2,
                    value_area_pct: float = 0.70) -> TPOProfile:
        """
        Time Price Opportunity (Market Profile) computation.

        Args:
            start_idx: Start bar
            end_idx: End bar
            tpo_size: Tick size for price levels (auto-computed if None)
            ib_periods: Number of bars for Initial Balance
            value_area_pct: Value area percentage

        Returns:
            TPOProfile with all market profile data
        """
        if end_idx is None:
            end_idx = self.n

        h = self.h[start_idx:end_idx]
        l = self.l[start_idx:end_idx]
        n_bars = len(h)

        if n_bars == 0:
            return TPOProfile({}, 0, 0, 0, 0, 0, 'normal', [])

        price_low = np.min(l)
        price_high = np.max(h)

        # Auto-compute TPO size
        if tpo_size is None:
            tpo_size = (price_high - price_low) / 100
            if tpo_size <= 0:
                tpo_size = 0.01

        # Build TPO counts
        price_levels: Dict[float, int] = {}
        tpo_by_period: Dict[float, List[int]] = {}

        for i in range(n_bars):
            bar_low = l[i]
            bar_high = h[i]
            level = math.floor(bar_low / tpo_size) * tpo_size
            while level <= bar_high:
                rounded = round(level, 8)
                price_levels[rounded] = price_levels.get(rounded, 0) + 1
                if rounded not in tpo_by_period:
                    tpo_by_period[rounded] = []
                tpo_by_period[rounded].append(i)
                level += tpo_size

        if not price_levels:
            return TPOProfile({}, price_low, price_low, price_low, price_low, price_low, 'normal', [])

        # POC — level with most TPOs
        poc_price = max(price_levels, key=price_levels.get)

        # Value Area
        sorted_levels = sorted(price_levels.items(), key=lambda x: x[1], reverse=True)
        total_tpo = sum(price_levels.values())
        target = total_tpo * value_area_pct

        va_levels = set()
        va_count = 0
        for price, count in sorted_levels:
            if va_count >= target:
                break
            va_levels.add(price)
            va_count += count

        vah = max(va_levels) if va_levels else price_high
        val = min(va_levels) if va_levels else price_low

        # Initial Balance
        ib_end = min(ib_periods, n_bars)
        ib_high = np.max(h[:ib_end]) if ib_end > 0 else price_high
        ib_low = np.min(l[:ib_end]) if ib_end > 0 else price_low

        # Detect single prints (levels visited by only one period)
        single_prints = [p for p, periods in tpo_by_period.items()
                         if len(set(periods)) == 1]

        # Profile type classification
        profile_type = self._classify_profile(price_levels, poc_price, vah, val, price_high, price_low)

        return TPOProfile(
            price_levels=price_levels,
            poc=float(poc_price),
            vah=float(vah),
            val=float(val),
            initial_balance_high=float(ib_high),
            initial_balance_low=float(ib_low),
            profile_type=profile_type,
            single_prints=sorted(single_prints),
        )

    def _classify_profile(self, levels: Dict[float, int], poc: float,
                          vah: float, val: float,
                          high: float, low: float) -> str:
        """
        Classify market profile shape.
        - normal (D-shape): balanced, POC near center
        - b-shape: POC near bottom (accumulation)
        - P-shape: POC near top (distribution)
        - elongated: no clear POC (trending day)
        """
        price_range = high - low
        if price_range == 0:
            return 'normal'

        poc_position = (poc - low) / price_range

        if poc_position < 0.35:
            return 'b-shape'
        elif poc_position > 0.65:
            return 'P-shape'

        # Check for elongated (trending)
        sorted_counts = sorted(levels.values(), reverse=True)
        if len(sorted_counts) > 3:
            top3_avg = np.mean(sorted_counts[:3])
            overall_avg = np.mean(sorted_counts)
            if top3_avg < overall_avg * 1.3:
                return 'elongated'

        return 'normal'

    # ──── Anchored VWAP ──────────────────────────────────────────────────

    def anchored_vwap(self, anchor_idx: int, num_std: int = 2) -> Dict[str, pd.Series]:
        """
        Anchored VWAP — VWAP calculated from a specific bar.

        Args:
            anchor_idx: Bar index to anchor VWAP
            num_std: Number of standard deviation bands

        Returns:
            Dict with 'vwap', 'upper_1', 'lower_1', 'upper_2', 'lower_2', etc.
        """
        result = {}
        typical = (self.h + self.l + self.c) / 3

        cum_tp_vol = np.cumsum(typical[anchor_idx:] * self.v[anchor_idx:])
        cum_vol = np.cumsum(self.v[anchor_idx:])
        cum_vol_safe = np.where(cum_vol > 0, cum_vol, np.nan)
        vwap_vals = cum_tp_vol / cum_vol_safe

        # Variance for bands
        cum_tp2_vol = np.cumsum((typical[anchor_idx:] ** 2) * self.v[anchor_idx:])
        variance = cum_tp2_vol / cum_vol_safe - vwap_vals ** 2
        std_vals = np.sqrt(np.maximum(variance, 0))

        # Pad with NaN for pre-anchor bars
        pad = np.full(anchor_idx, np.nan)
        full_vwap = np.concatenate([pad, vwap_vals])
        full_std = np.concatenate([pad, std_vals])

        result['vwap'] = pd.Series(full_vwap, index=self.index, name='anchored_vwap')
        for i in range(1, num_std + 1):
            result[f'upper_{i}'] = pd.Series(full_vwap + i * full_std, index=self.index,
                                              name=f'avwap_upper_{i}')
            result[f'lower_{i}'] = pd.Series(full_vwap - i * full_std, index=self.index,
                                              name=f'avwap_lower_{i}')
        return result

    def rolling_vwap(self, period: int = 20) -> Dict[str, pd.Series]:
        """
        Rolling VWAP with standard deviation bands.
        Unlike session VWAP, this uses a rolling window.
        """
        typical = (self.h + self.l + self.c) / 3
        tp_vol = typical * self.v

        tp_vol_s = pd.Series(tp_vol, index=self.index)
        vol_s = pd.Series(self.v, index=self.index)

        cum_tp_vol = tp_vol_s.rolling(period).sum()
        cum_vol = vol_s.rolling(period).sum()
        vwap = cum_tp_vol / cum_vol.replace(0, np.nan)

        # Variance
        tp2_vol = (typical ** 2) * self.v
        tp2_vol_s = pd.Series(tp2_vol, index=self.index)
        cum_tp2_vol = tp2_vol_s.rolling(period).sum()
        var = cum_tp2_vol / cum_vol.replace(0, np.nan) - vwap ** 2
        std = np.sqrt(var.clip(lower=0))

        return {
            'vwap': pd.Series(vwap, index=self.index, name='rolling_vwap'),
            'upper_1': pd.Series(vwap + std, index=self.index, name='rvwap_upper_1'),
            'lower_1': pd.Series(vwap - std, index=self.index, name='rvwap_lower_1'),
            'upper_2': pd.Series(vwap + 2 * std, index=self.index, name='rvwap_upper_2'),
            'lower_2': pd.Series(vwap - 2 * std, index=self.index, name='rvwap_lower_2'),
        }

    # ──── Volume Delta Analysis ──────────────────────────────────────────

    def volume_delta(self) -> pd.DataFrame:
        """
        Estimate volume delta (buy vol - sell vol) from OHLCV data.
        Uses the close position within the bar to estimate direction.

        Returns DataFrame with: buy_vol, sell_vol, delta, cumulative_delta
        """
        rng = self.h - self.l
        rng_safe = np.where(rng > 0, rng, 1.0)

        # Close position within bar: 0.0 = at low, 1.0 = at high
        close_pos = (self.c - self.l) / rng_safe

        # Approximate buy/sell split
        buy_pct = close_pos * 0.4 + 0.3  # Range: 0.3 to 0.7
        sell_pct = 1.0 - buy_pct

        buy_vol = self.v * buy_pct
        sell_vol = self.v * sell_pct
        delta = buy_vol - sell_vol
        cum_delta = np.cumsum(delta)

        return pd.DataFrame({
            'buy_volume': buy_vol,
            'sell_volume': sell_vol,
            'delta': delta,
            'cumulative_delta': cum_delta,
        }, index=self.index)

    def cumulative_volume_delta(self, period: int = 20) -> pd.DataFrame:
        """
        Cumulative Volume Delta with moving average.
        Useful for spotting divergences between price and CVD.
        """
        vd = self.volume_delta()
        cvd = vd['cumulative_delta']
        cvd_ma = cvd.rolling(period).mean()

        # Divergence detection
        price_trend = pd.Series(self.c, index=self.index).diff(period)
        cvd_trend = cvd.diff(period)

        divergence = pd.Series(0, index=self.index, name='divergence')
        # Bullish divergence: price down, CVD up
        divergence[(price_trend < 0) & (cvd_trend > 0)] = 1
        # Bearish divergence: price up, CVD down
        divergence[(price_trend > 0) & (cvd_trend < 0)] = -1

        vd['cvd_ma'] = cvd_ma
        vd['divergence'] = divergence
        return vd

    # ──── Volume Spread Analysis (VSA) ───────────────────────────────────

    def vsa_analysis(self, lookback: int = 20) -> List[VSASignal]:
        """
        Volume Spread Analysis — Wyckoff method.
        Detects: climactic action, no demand, no supply, stopping volume,
        test, upthrust, shakeout.
        """
        signals = []
        body = np.abs(self.c - self.o)
        spread = self.h - self.l
        avg_vol = pd.Series(self.v).rolling(lookback).mean().values
        avg_spread = pd.Series(spread).rolling(lookback).mean().values

        for i in range(lookback, self.n):
            if np.isnan(avg_vol[i]) or avg_vol[i] == 0:
                continue

            vol_ratio = self.v[i] / avg_vol[i]
            spread_ratio = spread[i] / avg_spread[i] if avg_spread[i] > 0 else 1.0
            is_up = self.c[i] > self.o[i]
            is_down = self.c[i] < self.o[i]
            close_pos = (self.c[i] - self.l[i]) / spread[i] if spread[i] > 0 else 0.5

            # Climactic Buying (Buying Climax)
            if vol_ratio > 2.0 and is_up and spread_ratio > 1.5 and close_pos < 0.5:
                signals.append(VSASignal(i, 'buying_climax', -1, min(vol_ratio / 3, 1.0)))

            # Climactic Selling (Selling Climax)
            elif vol_ratio > 2.0 and is_down and spread_ratio > 1.5 and close_pos > 0.5:
                signals.append(VSASignal(i, 'selling_climax', 1, min(vol_ratio / 3, 1.0)))

            # No Demand
            elif vol_ratio < 0.5 and is_up and spread_ratio < 0.6:
                signals.append(VSASignal(i, 'no_demand', -1, 0.6))

            # No Supply
            elif vol_ratio < 0.5 and is_down and spread_ratio < 0.6:
                signals.append(VSASignal(i, 'no_supply', 1, 0.6))

            # Stopping Volume
            elif vol_ratio > 1.5 and is_down and close_pos > 0.6:
                signals.append(VSASignal(i, 'stopping_volume', 1, min(vol_ratio / 2, 1.0)))

            # Upthrust
            elif vol_ratio > 1.3 and spread_ratio > 1.2 and close_pos < 0.3:
                if self.h[i] > max(self.h[i - 3:i]):
                    signals.append(VSASignal(i, 'upthrust', -1, 0.8))

            # Test
            elif vol_ratio < 0.6 and spread_ratio < 0.8 and close_pos > 0.5:
                if self.l[i] < min(self.l[i - 5:i]):
                    signals.append(VSASignal(i, 'test', 1, 0.7))

            # Shakeout
            elif vol_ratio > 1.5 and is_down:
                if self.l[i] < min(self.l[i - 10:i]) and close_pos > 0.4:
                    signals.append(VSASignal(i, 'shakeout', 1, 0.8))

        return signals

    def vsa_signals_series(self, lookback: int = 20) -> pd.DataFrame:
        """
        Convert VSA analysis to a DataFrame of signals per bar.
        """
        signals = self.vsa_analysis(lookback)
        types = pd.Series('', index=self.index, name='vsa_type')
        directions = pd.Series(0, index=self.index, name='vsa_direction')
        strengths = pd.Series(0.0, index=self.index, name='vsa_strength')

        for sig in signals:
            if sig.bar_index < self.n:
                idx = self.index[sig.bar_index]
                types[idx] = sig.signal_type
                directions[idx] = sig.direction
                strengths[idx] = sig.strength

        return pd.DataFrame({'vsa_type': types, 'vsa_direction': directions, 'vsa_strength': strengths})

    # ──── Volume-Weighted Indicators ─────────────────────────────────────

    def volume_weighted_rsi(self, period: int = 14) -> pd.Series:
        """
        Volume-Weighted RSI — RSI where gains/losses are weighted by volume.
        More responsive to high-volume moves.
        """
        diff = pd.Series(self.c, index=self.index).diff()
        vol = pd.Series(self.v, index=self.index)

        up = (diff.clip(lower=0) * vol).rolling(period).sum()
        down = ((-diff.clip(upper=0)) * vol).rolling(period).sum()
        rs = up / down.replace(0, np.nan)
        vwrsi = 100 - 100 / (1 + rs)
        return vwrsi.rename('vw_rsi')

    def volume_weighted_macd(self, fast: int = 12, slow: int = 26,
                              signal: int = 9) -> Dict[str, pd.Series]:
        """
        Volume-Weighted MACD — MACD using VWMA instead of EMA.
        More responsive to volume surges.
        """
        def vwma(period):
            vol = pd.Series(self.v, index=self.index)
            close = pd.Series(self.c, index=self.index)
            return (close * vol).rolling(period).sum() / vol.rolling(period).sum().replace(0, np.nan)

        fast_line = vwma(fast)
        slow_line = vwma(slow)
        macd = fast_line - slow_line
        sig = macd.ewm(span=signal, adjust=False).mean()
        hist = macd - sig

        return {
            'macd': macd.rename('vw_macd'),
            'signal': sig.rename('vw_macd_signal'),
            'histogram': hist.rename('vw_macd_hist'),
        }

    def volume_profile_indicator(self, period: int = 50, bins: int = 30) -> pd.DataFrame:
        """
        Rolling volume profile as a time series indicator.
        For each bar, computes the volume profile of the last `period` bars
        and returns POC, VAH, VAL relative to current price.

        Useful for overlay on price charts.
        """
        poc = pd.Series(np.nan, index=self.index, name='vp_poc')
        vah = pd.Series(np.nan, index=self.index, name='vp_vah')
        val = pd.Series(np.nan, index=self.index, name='vp_val')

        for i in range(period, self.n):
            profile = self.volume_profile(i - period, i, bins)
            poc.iloc[i] = profile.poc
            vah.iloc[i] = profile.vah
            val.iloc[i] = profile.val

        return pd.DataFrame({'vp_poc': poc, 'vp_vah': vah, 'vp_val': val})

    # ──── Money Flow ─────────────────────────────────────────────────────

    def smart_money_flow(self, period: int = 20) -> pd.Series:
        """
        Smart Money Flow — tracks institutional vs retail volume.
        First hour and last hour volume is considered 'smart money'.
        Since we don't have intraday timing, we approximate using
        volume + price action patterns.

        High volume with small range = absorption (institutional).
        Low volume with large range = retail.
        """
        spread = pd.Series(self.h - self.l, index=self.index)
        vol = pd.Series(self.v, index=self.index)
        avg_spread = spread.rolling(period).mean()
        avg_vol = vol.rolling(period).mean()

        spread_ratio = spread / avg_spread.replace(0, np.nan)
        vol_ratio = vol / avg_vol.replace(0, np.nan)

        # Smart money: high vol + low spread = absorption
        smart_indicator = vol_ratio / spread_ratio.replace(0, np.nan)
        price_dir = pd.Series(np.sign(self.c - self.o), index=self.index)

        smart_flow = (smart_indicator * price_dir).rolling(period).sum()
        return smart_flow.rename('smart_money_flow')

    def on_balance_volume_oscillator(self, fast: int = 12, slow: int = 26) -> pd.Series:
        """
        OBV Oscillator — difference between fast and slow OBV EMA.
        Useful for detecting OBV divergences earlier.
        """
        direction = np.sign(np.diff(self.c, prepend=self.c[0]))
        obv = np.cumsum(self.v * direction)
        obv_series = pd.Series(obv, index=self.index)
        fast_ema = obv_series.ewm(span=fast, adjust=False).mean()
        slow_ema = obv_series.ewm(span=slow, adjust=False).mean()
        return (fast_ema - slow_ema).rename('obv_osc')

    def klinger_volume_oscillator(self, fast: int = 34, slow: int = 55,
                                   signal: int = 13) -> Dict[str, pd.Series]:
        """
        Klinger Volume Oscillator — measures force of money flow.
        Similar to MACD but volume-based.
        """
        hlc = self.h + self.l + self.c
        dm = hlc - np.roll(hlc, 1)
        dm[0] = 0

        trend = np.where(dm > 0, 1, -1)
        vol_force = pd.Series(self.v * np.abs(2 * (dm / np.maximum(hlc, 1e-10)) - 1) * trend * 100,
                               index=self.index)

        fast_ema = vol_force.ewm(span=fast, adjust=False).mean()
        slow_ema = vol_force.ewm(span=slow, adjust=False).mean()
        kvo = fast_ema - slow_ema
        sig = kvo.ewm(span=signal, adjust=False).mean()

        return {
            'kvo': kvo.rename('kvo'),
            'signal': sig.rename('kvo_signal'),
            'histogram': (kvo - sig).rename('kvo_hist'),
        }

    # ──── Accumulation / Distribution Variants ───────────────────────────

    def williams_accumulation_distribution(self) -> pd.Series:
        """
        Williams Accumulation/Distribution — true buying/selling pressure.
        Uses open price to determine pressure direction.
        """
        wad = np.zeros(self.n)
        for i in range(1, self.n):
            if self.c[i] > self.c[i - 1]:
                wad[i] = wad[i - 1] + self.c[i] - min(self.l[i], self.c[i - 1])
            elif self.c[i] < self.c[i - 1]:
                wad[i] = wad[i - 1] + self.c[i] - max(self.h[i], self.c[i - 1])
            else:
                wad[i] = wad[i - 1]
        return pd.Series(wad, index=self.index, name='williams_ad')

    def chaikin_oscillator(self, fast: int = 3, slow: int = 10) -> pd.Series:
        """
        Chaikin Oscillator — difference of fast and slow A/D line EMA.
        """
        clv = ((self.c - self.l) - (self.h - self.c)) / np.maximum(self.h - self.l, 1e-10)
        ad = pd.Series(np.cumsum(clv * self.v), index=self.index)
        fast_ema = ad.ewm(span=fast, adjust=False).mean()
        slow_ema = ad.ewm(span=slow, adjust=False).mean()
        return (fast_ema - slow_ema).rename('chaikin_osc')

    def ease_of_movement_histogram(self, period: int = 14) -> pd.Series:
        """
        Ease of Movement histogram — smoothed EoM for trend detection.
        """
        hl_mid = (self.h + self.l) / 2
        hl_mid_prev = np.roll(hl_mid, 1)
        hl_mid_prev[0] = hl_mid[0]
        distance = hl_mid - hl_mid_prev
        box_ratio = (self.v / 1e6) / np.maximum(self.h - self.l, 1e-10)
        eom = pd.Series(distance / np.maximum(box_ratio, 1e-10), index=self.index)
        return eom.rolling(period).mean().rename('eom_hist')

    # ──── Volume Zone Oscillator ─────────────────────────────────────────

    def volume_zone_oscillator(self, period: int = 14) -> pd.Series:
        """
        Volume Zone Oscillator (VZO) — identifies volume flow direction.
        Values > 40 = strong bullish, < -40 = strong bearish.
        """
        direction = np.sign(np.diff(self.c, prepend=self.c[0]))
        signed_vol = self.v * direction
        vp = pd.Series(signed_vol, index=self.index).ewm(span=period, adjust=False).mean()
        tv = pd.Series(self.v, index=self.index).ewm(span=period, adjust=False).mean()
        vzo = (vp / tv.replace(0, np.nan)) * 100
        return vzo.rename('vzo')

    # ──── Volume Weighted Momentum ───────────────────────────────────────

    def volume_weighted_momentum(self, period: int = 14) -> pd.Series:
        """
        Volume-weighted momentum — ROC weighted by relative volume.
        More weight on high-volume moves.
        """
        roc = pd.Series(self.c, index=self.index).pct_change(period) * 100
        vol = pd.Series(self.v, index=self.index)
        rel_vol = vol / vol.rolling(period).mean().replace(0, np.nan)
        return (roc * rel_vol).rename('vw_momentum')

    def put_call_volume_proxy(self, period: int = 20) -> pd.Series:
        """
        Estimate put/call volume ratio from OHLCV data.
        Uses bearish volume fraction as proxy for put activity.
        """
        rng = self.h - self.l
        rng_safe = np.where(rng > 0, rng, 1.0)
        close_pos = (self.c - self.l) / rng_safe
        bearish_pct = 1.0 - close_pos
        bear_vol = pd.Series(self.v * bearish_pct, index=self.index)
        bull_vol = pd.Series(self.v * close_pos, index=self.index)
        ratio = bear_vol.rolling(period).sum() / bull_vol.rolling(period).sum().replace(0, np.nan)
        return ratio.rename('pc_volume_proxy')
