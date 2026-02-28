"""
ta_engine_order_flow.py — Order Flow & Tape Analysis Engine
============================================================
Advanced order flow analysis tools approximated from OHLCV data:
- Footprint chart data generation
- Delta profile
- Imbalance detection
- Absorption detection
- Exhaustion moves
- Iceberg order detection (proxy)
- Cumulative tick analysis
- Aggression ratio
- Liquidity levels
- Market auction theory metrics
- Supply/Demand zone detection
- Institutional flow proxy

Usage:
    from phase1.services.ta_engine_order_flow import OrderFlowEngine
    of = OrderFlowEngine(df)
    footprint = of.footprint_data()
"""

from __future__ import annotations
import numpy as np
import pandas as pd
from typing import Optional, Tuple, List, Dict
from dataclasses import dataclass, field
import math


# ─── DATA STRUCTURES ─────────────────────────────────────────────────────────

@dataclass
class FootprintBar:
    """Single bar in a footprint chart."""
    index: int
    open: float
    high: float
    low: float
    close: float
    total_volume: float
    buy_volume: float
    sell_volume: float
    delta: float
    levels: List['FootprintLevel']
    max_delta_price: float
    min_delta_price: float


@dataclass
class FootprintLevel:
    """Single price level within a footprint bar."""
    price: float
    bid_volume: float
    ask_volume: float
    delta: float
    is_imbalance: bool
    imbalance_direction: int  # +1 = ask imbalance, -1 = bid imbalance, 0 = none


@dataclass
class SupplyDemandZone:
    """Supply or demand zone."""
    zone_type: str  # 'supply' or 'demand'
    high: float
    low: float
    start_idx: int
    strength: float  # 0-1
    volume: float
    touches: int
    is_fresh: bool


@dataclass
class LiquidityLevel:
    """Detected liquidity level."""
    price: float
    type: str  # 'buy_stops', 'sell_stops', 'equal_highs', 'equal_lows'
    strength: float
    bar_indices: List[int]


@dataclass
class InstitutionalActivity:
    """Detected institutional activity."""
    bar_index: int
    activity_type: str  # 'accumulation', 'distribution', 'absorption', 'initiative'
    direction: int  # +1 or -1
    confidence: float
    volume_ratio: float


class OrderFlowEngine:
    """
    Order Flow Analysis Engine — approximates institutional-grade
    order flow metrics from standard OHLCV data.
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

    # ──── Footprint Chart ────────────────────────────────────────────────

    def footprint_data(self, levels_per_bar: int = 10,
                        imbalance_ratio: float = 3.0) -> List[FootprintBar]:
        """
        Generate footprint chart data from OHLCV.
        Approximates bid/ask volume at each price level.

        Args:
            levels_per_bar: Number of price levels within each bar
            imbalance_ratio: Threshold for detecting imbalances (ask/bid or bid/ask)
        """
        footprints = []

        for i in range(self.n):
            bar_high = self.h[i]
            bar_low = self.l[i]
            bar_range = bar_high - bar_low

            if bar_range <= 0:
                bar_range = 0.01
                bar_high = self.c[i] + 0.005
                bar_low = self.c[i] - 0.005

            # Create price levels
            level_size = bar_range / levels_per_bar
            bar_vol = self.v[i]
            is_bullish = self.c[i] >= self.o[i]

            # Close position determines overall buy/sell split
            close_pos = (self.c[i] - bar_low) / bar_range
            overall_buy_pct = close_pos * 0.3 + 0.35  # 0.35 to 0.65

            levels = []
            max_delta = -float('inf')
            min_delta = float('inf')
            max_delta_price = bar_low
            min_delta_price = bar_low

            for j in range(levels_per_bar):
                level_price = bar_low + (j + 0.5) * level_size
                level_position = (j + 0.5) / levels_per_bar

                # Volume distribution: more volume near open, close, and extremes
                # Use a simple distribution model
                dist_from_close = abs(level_position - close_pos)
                dist_from_open = abs(level_position - (self.o[i] - bar_low) / bar_range)
                vol_weight = 1.0 / (0.5 + dist_from_close + dist_from_open)

                level_vol = bar_vol * vol_weight
                # Normalize later

                # Buy/Sell split varies by position
                if is_bullish:
                    # In bullish bar, more buying near close (higher levels)
                    buy_pct = 0.3 + level_position * 0.4
                else:
                    # In bearish bar, more selling near close (lower levels)
                    buy_pct = 0.7 - level_position * 0.4

                ask_vol = level_vol * buy_pct
                bid_vol = level_vol * (1 - buy_pct)
                delta = ask_vol - bid_vol

                # Imbalance detection
                is_imbalance = False
                imb_dir = 0
                if bid_vol > 0 and ask_vol / bid_vol >= imbalance_ratio:
                    is_imbalance = True
                    imb_dir = 1
                elif ask_vol > 0 and bid_vol / ask_vol >= imbalance_ratio:
                    is_imbalance = True
                    imb_dir = -1

                if delta > max_delta:
                    max_delta = delta
                    max_delta_price = level_price
                if delta < min_delta:
                    min_delta = delta
                    min_delta_price = level_price

                levels.append(FootprintLevel(
                    price=float(level_price),
                    bid_volume=float(bid_vol),
                    ask_volume=float(ask_vol),
                    delta=float(delta),
                    is_imbalance=is_imbalance,
                    imbalance_direction=imb_dir,
                ))

            # Normalize volumes
            total_level_vol = sum(lv.bid_volume + lv.ask_volume for lv in levels)
            if total_level_vol > 0:
                scale = bar_vol / total_level_vol
                for lv in levels:
                    lv.bid_volume *= scale
                    lv.ask_volume *= scale
                    lv.delta = lv.ask_volume - lv.bid_volume

            total_buy = sum(lv.ask_volume for lv in levels)
            total_sell = sum(lv.bid_volume for lv in levels)

            footprints.append(FootprintBar(
                index=i,
                open=float(self.o[i]),
                high=float(self.h[i]),
                low=float(self.l[i]),
                close=float(self.c[i]),
                total_volume=float(bar_vol),
                buy_volume=float(total_buy),
                sell_volume=float(total_sell),
                delta=float(total_buy - total_sell),
                levels=levels,
                max_delta_price=float(max_delta_price),
                min_delta_price=float(min_delta_price),
            ))

        return footprints

    # ──── Delta Profile ──────────────────────────────────────────────────

    def delta_profile(self) -> pd.DataFrame:
        """
        Bar-by-bar delta (buy vs sell volume imbalance) analysis.
        """
        rng = self.h - self.l
        rng_safe = np.where(rng > 0, rng, 1.0)
        close_pos = (self.c - self.l) / rng_safe

        buy_pct = close_pos * 0.3 + 0.35
        buy_vol = self.v * buy_pct
        sell_vol = self.v * (1 - buy_pct)
        delta = buy_vol - sell_vol
        cum_delta = np.cumsum(delta)

        # Delta moving averages
        delta_series = pd.Series(delta, index=self.index)
        delta_ma_fast = delta_series.rolling(10).mean()
        delta_ma_slow = delta_series.rolling(30).mean()

        # Delta momentum
        delta_momentum = delta_series.rolling(5).sum()

        return pd.DataFrame({
            'buy_volume': buy_vol,
            'sell_volume': sell_vol,
            'delta': delta,
            'cumulative_delta': cum_delta,
            'delta_ma_fast': delta_ma_fast,
            'delta_ma_slow': delta_ma_slow,
            'delta_momentum': delta_momentum,
        }, index=self.index)

    # ──── Absorption Detection ───────────────────────────────────────────

    def absorption_detection(self, vol_threshold: float = 1.5,
                              spread_threshold: float = 0.5) -> pd.DataFrame:
        """
        Detect absorption — high volume with small price movement.
        Indicates institutional orders absorbing counter-party flow.
        """
        spread = self.h - self.l
        avg_spread = pd.Series(spread).rolling(20).mean().values
        avg_vol = pd.Series(self.v).rolling(20).mean().values

        absorption = np.zeros(self.n)
        direction = np.zeros(self.n)

        for i in range(20, self.n):
            if avg_vol[i] == 0 or avg_spread[i] == 0:
                continue

            vol_ratio = self.v[i] / avg_vol[i]
            spread_ratio = spread[i] / avg_spread[i]

            # High volume + small spread = absorption
            if vol_ratio > vol_threshold and spread_ratio < spread_threshold:
                is_bullish = self.c[i] >= self.o[i]
                absorption[i] = vol_ratio * (1 / max(spread_ratio, 0.1))
                direction[i] = 1 if is_bullish else -1

        return pd.DataFrame({
            'absorption_strength': absorption,
            'absorption_direction': direction,
        }, index=self.index)

    # ──── Exhaustion Detection ───────────────────────────────────────────

    def exhaustion_detection(self, period: int = 20) -> pd.DataFrame:
        """
        Detect exhaustion moves — climactic volume with reversal characteristics.
        """
        spread = self.h - self.l
        avg_spread = pd.Series(spread).rolling(period).mean().values
        avg_vol = pd.Series(self.v).rolling(period).mean().values

        exhaustion = pd.Series(0.0, index=self.index, name='exhaustion')
        direction = pd.Series(0, index=self.index, name='exhaustion_dir')

        for i in range(period + 1, self.n):
            if avg_vol[i] == 0 or avg_spread[i] == 0:
                continue

            vol_ratio = self.v[i] / avg_vol[i]
            spread_ratio = spread[i] / avg_spread[i]

            # High volume + wide spread + close near opposite end = exhaustion
            close_pos = (self.c[i] - self.l[i]) / spread[i] if spread[i] > 0 else 0.5
            is_bullish_bar = self.c[i] > self.o[i]

            # Bullish exhaustion: big up move, close near bottom of range
            if is_bullish_bar and vol_ratio > 2.0 and spread_ratio > 1.5 and close_pos < 0.4:
                exhaustion.iloc[i] = vol_ratio * spread_ratio
                direction.iloc[i] = -1  # Expect reversal down

            # Bearish exhaustion: big down move, close near top of range
            elif not is_bullish_bar and vol_ratio > 2.0 and spread_ratio > 1.5 and close_pos > 0.6:
                exhaustion.iloc[i] = vol_ratio * spread_ratio
                direction.iloc[i] = 1  # Expect reversal up

        return pd.DataFrame({'exhaustion': exhaustion, 'exhaustion_direction': direction})

    # ──── Aggression Ratio ───────────────────────────────────────────────

    def aggression_ratio(self, period: int = 14) -> pd.DataFrame:
        """
        Aggression ratio — measures buying vs selling aggression.
        High ratio = aggressive buyers, low ratio = aggressive sellers.
        """
        rng = self.h - self.l
        rng_safe = np.where(rng > 0, rng, 1.0)
        close_pos = (self.c - self.l) / rng_safe

        buy_aggression = close_pos * self.v
        sell_aggression = (1 - close_pos) * self.v

        buy_agg = pd.Series(buy_aggression, index=self.index)
        sell_agg = pd.Series(sell_aggression, index=self.index)

        ratio = (buy_agg.rolling(period).sum() /
                 sell_agg.rolling(period).sum().replace(0, np.nan))
        ratio_ma = ratio.rolling(5).mean()

        return pd.DataFrame({
            'aggression_ratio': ratio,
            'aggression_ratio_ma': ratio_ma,
            'buy_aggression': buy_agg.rolling(period).sum(),
            'sell_aggression': sell_agg.rolling(period).sum(),
        })

    # ──── Supply & Demand Zones ──────────────────────────────────────────

    def supply_demand_zones(self, lookback: int = 100, min_strength: float = 0.5) -> List[SupplyDemandZone]:
        """
        Detect supply and demand zones from price action.

        Demand zones: areas where price rallied sharply from (explosive move up)
        Supply zones: areas where price dropped sharply from (explosive move down)
        """
        zones = []
        avg_vol = pd.Series(self.v).rolling(20).mean().values
        avg_range = pd.Series(self.h - self.l).rolling(20).mean().values

        end = self.n
        start = max(0, end - lookback)

        for i in range(start + 2, end - 2):
            if np.isnan(avg_range[i]) or avg_range[i] == 0:
                continue

            # Check for explosive move UP from this level (demand zone)
            if (self.c[i + 1] > self.h[i] and
                    self.c[i + 2] > self.c[i + 1] and
                    (self.h[i + 1] - self.l[i + 1]) > avg_range[i] * 1.5):

                zone_high = max(self.o[i], self.c[i])
                zone_low = self.l[i]
                vol_ratio = self.v[i + 1] / avg_vol[i] if avg_vol[i] > 0 else 1.0
                strength = min(1.0, vol_ratio / 2.0) * 0.7

                # Check if zone is still fresh (price hasn't returned)
                is_fresh = all(self.l[j] > zone_low for j in range(i + 3, min(i + 20, end)))

                # Count touches
                touches = sum(1 for j in range(i + 2, end)
                              if self.l[j] <= zone_high and self.l[j] >= zone_low)

                if strength >= min_strength:
                    zones.append(SupplyDemandZone(
                        zone_type='demand',
                        high=float(zone_high),
                        low=float(zone_low),
                        start_idx=i,
                        strength=float(strength + min(touches * 0.1, 0.3)),
                        volume=float(self.v[i] + self.v[i + 1]),
                        touches=touches,
                        is_fresh=is_fresh,
                    ))

            # Check for explosive move DOWN from this level (supply zone)
            if i + 2 < end:
                if (self.c[i + 1] < self.l[i] and
                        self.c[i + 2] < self.c[i + 1] and
                        (self.h[i + 1] - self.l[i + 1]) > avg_range[i] * 1.5):

                    zone_high = self.h[i]
                    zone_low = min(self.o[i], self.c[i])
                    vol_ratio = self.v[i + 1] / avg_vol[i] if avg_vol[i] > 0 else 1.0
                    strength = min(1.0, vol_ratio / 2.0) * 0.7

                    is_fresh = all(self.h[j] < zone_high for j in range(i + 3, min(i + 20, end)))
                    touches = sum(1 for j in range(i + 2, end)
                                  if self.h[j] >= zone_low and self.h[j] <= zone_high)

                    if strength >= min_strength:
                        zones.append(SupplyDemandZone(
                            zone_type='supply',
                            high=float(zone_high),
                            low=float(zone_low),
                            start_idx=i,
                            strength=float(strength + min(touches * 0.1, 0.3)),
                            volume=float(self.v[i] + self.v[i + 1]),
                            touches=touches,
                            is_fresh=is_fresh,
                        ))

        return zones

    # ──── Liquidity Detection ────────────────────────────────────────────

    def liquidity_levels(self, lookback: int = 100,
                          eq_threshold: float = 0.002) -> List[LiquidityLevel]:
        """
        Detect liquidity levels — areas where stop orders likely reside.

        Types:
        - Equal highs: buy stops above
        - Equal lows: sell stops below
        - Swing highs: buy stops above key highs
        - Swing lows: sell stops below key lows
        """
        levels = []
        end = self.n
        start = max(0, end - lookback)

        # Detect equal highs (within eq_threshold %)
        for i in range(start, end):
            for j in range(i + 2, min(i + 20, end)):
                if abs(self.h[i] - self.h[j]) / max(self.h[i], 0.01) < eq_threshold:
                    # Equal highs found — buy stops above
                    price = max(self.h[i], self.h[j])
                    strength = 0.5 + 0.1 * (j - i)  # Wider = stronger
                    levels.append(LiquidityLevel(
                        price=float(price),
                        type='equal_highs',
                        strength=min(float(strength), 1.0),
                        bar_indices=[i, j],
                    ))
                    break

        # Detect equal lows
        for i in range(start, end):
            for j in range(i + 2, min(i + 20, end)):
                if abs(self.l[i] - self.l[j]) / max(abs(self.l[i]), 0.01) < eq_threshold:
                    price = min(self.l[i], self.l[j])
                    strength = 0.5 + 0.1 * (j - i)
                    levels.append(LiquidityLevel(
                        price=float(price),
                        type='equal_lows',
                        strength=min(float(strength), 1.0),
                        bar_indices=[i, j],
                    ))
                    break

        # Swing high stops
        swing_highs = []
        for i in range(start + 5, end - 5):
            if self.h[i] == np.max(self.h[i - 5:i + 6]):
                swing_highs.append(i)
                levels.append(LiquidityLevel(
                    price=float(self.h[i]),
                    type='buy_stops',
                    strength=0.7,
                    bar_indices=[i],
                ))

        # Swing low stops
        for i in range(start + 5, end - 5):
            if self.l[i] == np.min(self.l[i - 5:i + 6]):
                levels.append(LiquidityLevel(
                    price=float(self.l[i]),
                    type='sell_stops',
                    strength=0.7,
                    bar_indices=[i],
                ))

        return levels

    def liquidity_heatmap(self, lookback: int = 100, bins: int = 50) -> pd.DataFrame:
        """
        Generate liquidity heatmap — estimated stop density at each price level.
        """
        levels = self.liquidity_levels(lookback)

        if not levels:
            return pd.DataFrame(columns=['price', 'buy_stops', 'sell_stops', 'total'])

        all_prices = [lv.price for lv in levels]
        price_low = min(all_prices)
        price_high = max(all_prices)

        if price_low == price_high:
            return pd.DataFrame(columns=['price', 'buy_stops', 'sell_stops', 'total'])

        bin_edges = np.linspace(price_low, price_high, bins + 1)
        bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2
        buy_density = np.zeros(bins)
        sell_density = np.zeros(bins)

        for lv in levels:
            b = np.searchsorted(bin_edges[:-1], lv.price) - 1
            b = max(0, min(b, bins - 1))
            if lv.type in ('buy_stops', 'equal_highs'):
                buy_density[b] += lv.strength
            else:
                sell_density[b] += lv.strength

        return pd.DataFrame({
            'price': bin_centers,
            'buy_stops': buy_density,
            'sell_stops': sell_density,
            'total': buy_density + sell_density,
        })

    # ──── Institutional Flow Proxy ───────────────────────────────────────

    def institutional_flow(self, period: int = 20) -> List[InstitutionalActivity]:
        """
        Detect institutional activity patterns from OHLCV.

        Patterns detected:
        - Accumulation: repeated buying with tight range at lows
        - Distribution: repeated selling with tight range at highs
        - Absorption: high volume candles with small bodies
        - Initiative: breakout with volume
        """
        activities = []
        avg_vol = pd.Series(self.v).rolling(period).mean().values
        avg_range = pd.Series(self.h - self.l).rolling(period).mean().values
        avg_body = pd.Series(np.abs(self.c - self.o)).rolling(period).mean().values

        for i in range(period, self.n):
            if avg_vol[i] == 0 or avg_range[i] == 0:
                continue

            vol_ratio = self.v[i] / avg_vol[i]
            range_ratio = (self.h[i] - self.l[i]) / avg_range[i]
            body = abs(self.c[i] - self.o[i])
            body_ratio = body / avg_body[i] if avg_body[i] > 0 else 1.0
            is_bullish = self.c[i] > self.o[i]

            # Accumulation: low volume, tight range, at support
            if vol_ratio < 0.7 and range_ratio < 0.6:
                # Check if near recent low
                recent_low = np.min(self.l[max(0, i - period):i])
                if self.l[i] - recent_low < avg_range[i] * 0.5:
                    activities.append(InstitutionalActivity(
                        bar_index=i,
                        activity_type='accumulation',
                        direction=1,
                        confidence=0.6,
                        volume_ratio=float(vol_ratio),
                    ))

            # Distribution: low volume, tight range, at resistance
            elif vol_ratio < 0.7 and range_ratio < 0.6:
                recent_high = np.max(self.h[max(0, i - period):i])
                if recent_high - self.h[i] < avg_range[i] * 0.5:
                    activities.append(InstitutionalActivity(
                        bar_index=i,
                        activity_type='distribution',
                        direction=-1,
                        confidence=0.6,
                        volume_ratio=float(vol_ratio),
                    ))

            # Absorption: high volume, small body
            elif vol_ratio > 1.5 and body_ratio < 0.5:
                direction = 1 if is_bullish else -1
                activities.append(InstitutionalActivity(
                    bar_index=i,
                    activity_type='absorption',
                    direction=direction,
                    confidence=min(0.9, vol_ratio / 3),
                    volume_ratio=float(vol_ratio),
                ))

            # Initiative: breakout with volume
            elif vol_ratio > 2.0 and range_ratio > 1.5:
                if self.h[i] > np.max(self.h[max(0, i - period):i]):
                    activities.append(InstitutionalActivity(
                        bar_index=i,
                        activity_type='initiative',
                        direction=1,
                        confidence=min(0.9, vol_ratio / 3),
                        volume_ratio=float(vol_ratio),
                    ))
                elif self.l[i] < np.min(self.l[max(0, i - period):i]):
                    activities.append(InstitutionalActivity(
                        bar_index=i,
                        activity_type='initiative',
                        direction=-1,
                        confidence=min(0.9, vol_ratio / 3),
                        volume_ratio=float(vol_ratio),
                    ))

        return activities

    def institutional_flow_indicator(self, period: int = 20) -> pd.DataFrame:
        """
        Time series of institutional flow strength.
        Combines all institutional signals into a single indicator.
        """
        activities = self.institutional_flow(period)

        strength = pd.Series(0.0, index=self.index, name='inst_flow_strength')
        direction = pd.Series(0, index=self.index, name='inst_flow_direction')
        activity_type = pd.Series('', index=self.index, name='inst_flow_type')

        for act in activities:
            if act.bar_index < self.n:
                idx = self.index[act.bar_index]
                strength[idx] = act.confidence
                direction[idx] = act.direction
                activity_type[idx] = act.activity_type

        # Smoothed institutional pressure
        inst_pressure = (strength * direction).rolling(10).sum()

        return pd.DataFrame({
            'inst_flow_strength': strength,
            'inst_flow_direction': direction,
            'inst_flow_type': activity_type,
            'inst_pressure': inst_pressure,
        })

    # ──── Market Auction Theory ──────────────────────────────────────────

    def auction_metrics(self, period: int = 20) -> pd.DataFrame:
        """
        Market auction theory metrics:
        - Rotational Factor: number of consecutive up/down bars
        - Value migration: whether value area is migrating up/down
        - Extension detection: price probing beyond value
        - Responsive vs Initiative activity
        """
        # Rotational Factor (consecutive bars in one direction)
        rot_factor = np.zeros(self.n)
        count = 0
        for i in range(1, self.n):
            if self.c[i] > self.c[i - 1]:
                count = max(count + 1, 1)
            elif self.c[i] < self.c[i - 1]:
                count = min(count - 1, -1)
            else:
                count = 0
            rot_factor[i] = count

        # Value migration (SMA of typical price change)
        typical = (self.h + self.l + self.c) / 3
        typ_series = pd.Series(typical, index=self.index)
        value_change = typ_series.diff().rolling(period).mean()
        value_migration = np.zeros(self.n)
        value_migration[value_change > 0] = 1
        value_migration[value_change < 0] = -1

        # Extension detection (price beyond 2 std from SMA)
        sma = typ_series.rolling(period).mean()
        std = typ_series.rolling(period).std()
        upper_ext = sma + 2 * std
        lower_ext = sma - 2 * std

        extension = pd.Series(0, index=self.index)
        extension[pd.Series(self.h, index=self.index) > upper_ext] = 1  # Upward extension
        extension[pd.Series(self.l, index=self.index) < lower_ext] = -1  # Downward extension

        # Responsive vs Initiative
        # Responsive: price returns to value after extension
        # Initiative: price moves away from value with conviction
        avg_vol = pd.Series(self.v, index=self.index).rolling(period).mean()
        vol_ratio = pd.Series(self.v, index=self.index) / avg_vol.replace(0, np.nan)

        activity_type = pd.Series('balanced', index=self.index)
        activity_type[(extension != 0) & (vol_ratio > 1.5)] = 'initiative'
        activity_type[(extension != 0) & (vol_ratio < 0.7)] = 'responsive'

        return pd.DataFrame({
            'rotational_factor': rot_factor,
            'value_migration': value_migration,
            'extension': extension,
            'activity_type': activity_type,
            'vol_ratio': vol_ratio,
        }, index=self.index)

    # ──── Iceberg Order Proxy ────────────────────────────────────────────

    def iceberg_proxy(self, period: int = 20) -> pd.DataFrame:
        """
        Detect potential iceberg orders from OHLCV.
        Iceberg orders cause: high volume, tight spread, price barely moves.
        Repeated at same level over multiple bars.
        """
        spread = self.h - self.l
        body = np.abs(self.c - self.o)
        avg_vol = pd.Series(self.v).rolling(period).mean().values
        avg_spread = pd.Series(spread).rolling(period).mean().values

        iceberg_score = pd.Series(0.0, index=self.index, name='iceberg_score')
        iceberg_price = pd.Series(np.nan, index=self.index, name='iceberg_price')

        for i in range(period, self.n):
            if avg_vol[i] == 0 or avg_spread[i] == 0 or spread[i] == 0:
                continue

            vol_ratio = self.v[i] / avg_vol[i]
            spread_ratio = spread[i] / avg_spread[i]
            body_to_spread = body[i] / spread[i]

            # High volume + tight spread + small body = potential iceberg
            if vol_ratio > 1.3 and spread_ratio < 0.6 and body_to_spread < 0.3:
                # Check if this level has been tested before
                mid_price = (self.h[i] + self.l[i]) / 2
                repeat_count = 0
                for j in range(max(0, i - period), i):
                    if abs((self.h[j] + self.l[j]) / 2 - mid_price) < avg_spread[i] * 0.5:
                        repeat_count += 1

                score = vol_ratio * (1 / max(spread_ratio, 0.1)) * (1 + repeat_count * 0.2)
                iceberg_score.iloc[i] = min(score, 10.0)
                iceberg_price.iloc[i] = mid_price

        return pd.DataFrame({
            'iceberg_score': iceberg_score,
            'iceberg_price': iceberg_price,
        })

    # ──── Cumulative Tick ────────────────────────────────────────────────

    def cumulative_tick(self) -> pd.DataFrame:
        """
        Simulated cumulative tick analysis.
        Tick = +1 if close > previous close, -1 if close < previous close.
        Cumulative sum shows directional bias.
        """
        ticks = np.zeros(self.n)
        for i in range(1, self.n):
            if self.c[i] > self.c[i - 1]:
                ticks[i] = 1
            elif self.c[i] < self.c[i - 1]:
                ticks[i] = -1

        cum_tick = np.cumsum(ticks)
        tick_ma = pd.Series(ticks, index=self.index).rolling(20).mean()
        cum_tick_osc = pd.Series(cum_tick, index=self.index).diff(10)

        return pd.DataFrame({
            'tick': ticks,
            'cumulative_tick': cum_tick,
            'tick_ma': tick_ma,
            'cum_tick_osc': cum_tick_osc,
        }, index=self.index)

    # ──── Composite Order Flow Score ─────────────────────────────────────

    def composite_order_flow_score(self, period: int = 20) -> pd.DataFrame:
        """
        Composite score combining all order flow signals.
        Score ranges from -100 (extremely bearish) to +100 (extremely bullish).
        """
        # Delta
        dp = self.delta_profile()
        delta_signal = np.sign(dp['delta_momentum'].values) * 25

        # Absorption
        abs_df = self.absorption_detection()
        abs_signal = abs_df['absorption_direction'].values * abs_df['absorption_strength'].values * 25

        # Aggression
        agg = self.aggression_ratio(period)
        agg_ratio = agg['aggression_ratio'].values
        agg_signal = np.zeros(self.n)
        agg_signal[agg_ratio > 1.2] = 25
        agg_signal[agg_ratio < 0.8] = -25
        agg_signal[(agg_ratio >= 0.8) & (agg_ratio <= 1.2)] = (agg_ratio[(agg_ratio >= 0.8) & (agg_ratio <= 1.2)] - 1.0) * 125

        # Cumulative tick direction
        ct = self.cumulative_tick()
        tick_signal = np.sign(ct['tick_ma'].values) * 25

        total = delta_signal + abs_signal + agg_signal + tick_signal
        total_series = pd.Series(total, index=self.index).clip(-100, 100)

        # Smooth the score
        smoothed = total_series.rolling(5).mean()

        return pd.DataFrame({
            'raw_score': total_series,
            'smoothed_score': smoothed,
            'delta_component': delta_signal,
            'absorption_component': abs_signal,
            'aggression_component': agg_signal,
            'tick_component': tick_signal,
        }, index=self.index)
