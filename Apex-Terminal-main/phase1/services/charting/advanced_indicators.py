"""
Advanced Indicators: Anchored VWAP, ATR Bands, EMA Regime
"""

from typing import List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime

from ..models import Bar


@dataclass
class AnchoredVWAPResult:
    """Anchored VWAP with bands"""
    vwap: List[Tuple[datetime, float]]
    upper_band_1std: List[Tuple[datetime, float]]
    lower_band_1std: List[Tuple[datetime, float]]
    upper_band_2std: List[Tuple[datetime, float]]
    lower_band_2std: List[Tuple[datetime, float]]
    anchor_time: datetime
    anchor_price: float


@dataclass
class ATRBandsResult:
    """ATR-based bands around price"""
    upper_band: List[Tuple[datetime, float]]
    lower_band: List[Tuple[datetime, float]]
    atr_values: List[Tuple[datetime, float]]
    multiplier: float


@dataclass
class EMARegime:
    """EMA regime analysis"""
    ema_20: float
    ema_50: float
    ema_200: float
    slope_20: float  # Rate of change (angle)
    slope_50: float
    slope_200: float
    regime: str  # "bullish", "bearish", "neutral"
    crossover_state: str  # "golden_cross", "death_cross", "none"


class AdvancedIndicators:
    """Advanced technical indicators for regime and volatility analysis"""
    
    @classmethod
    def calculate_anchored_vwap(
        cls,
        bars: List[Bar],
        anchor_index: int,
        std_dev_multipliers: List[float] = [1.0, 2.0],
    ) -> Optional[AnchoredVWAPResult]:
        """
        Calculate VWAP anchored to a specific bar with standard deviation bands
        
        Args:
            bars: List of bars
            anchor_index: Index of anchor bar (0 = first bar)
            std_dev_multipliers: Multipliers for bands (default [1.0, 2.0])
        
        Returns:
            AnchoredVWAPResult or None if insufficient data
        """
        if not bars or anchor_index < 0 or anchor_index >= len(bars):
            return None
        
        anchor_bar = bars[anchor_index]
        anchor_time = datetime.fromtimestamp(anchor_bar.ts_start_ms / 1000)
        anchor_price = (anchor_bar.high + anchor_bar.low + anchor_bar.close) / 3
        
        # Calculate VWAP from anchor point
        vwap_data: List[Tuple[datetime, float]] = []
        upper_1std: List[Tuple[datetime, float]] = []
        lower_1std: List[Tuple[datetime, float]] = []
        upper_2std: List[Tuple[datetime, float]] = []
        lower_2std: List[Tuple[datetime, float]] = []
        
        cumulative_tpv = 0.0  # Typical Price * Volume
        cumulative_volume = 0.0
        cumulative_tp_sq_v = 0.0  # (TypicalPrice^2) * Volume for variance
        
        for i in range(anchor_index, len(bars)):
            bar = bars[i]
            typical_price = (bar.high + bar.low + bar.close) / 3
            
            cumulative_tpv += typical_price * bar.volume
            cumulative_volume += bar.volume
            cumulative_tp_sq_v += (typical_price ** 2) * bar.volume
            
            if cumulative_volume == 0:
                continue
            
            vwap = cumulative_tpv / cumulative_volume
            
            # Calculate standard deviation
            variance = (cumulative_tp_sq_v / cumulative_volume) - (vwap ** 2)
            std_dev = variance ** 0.5 if variance > 0 else 0
            
            bar_time = datetime.fromtimestamp(bar.ts_start_ms / 1000)
            vwap_data.append((bar_time, vwap))
            upper_1std.append((bar_time, vwap + std_dev))
            lower_1std.append((bar_time, vwap - std_dev))
            upper_2std.append((bar_time, vwap + 2 * std_dev))
            lower_2std.append((bar_time, vwap - 2 * std_dev))
        
        return AnchoredVWAPResult(
            vwap=vwap_data,
            upper_band_1std=upper_1std,
            lower_band_1std=lower_1std,
            upper_band_2std=upper_2std,
            lower_band_2std=lower_2std,
            anchor_time=anchor_time,
            anchor_price=anchor_price,
        )
    
    @classmethod
    def calculate_atr_bands(
        cls,
        bars: List[Bar],
        atr_period: int = 14,
        multiplier: float = 2.0,
    ) -> Optional[ATRBandsResult]:
        """
        Calculate ATR-based bands around price
        
        Args:
            bars: List of bars
            atr_period: ATR calculation period
            multiplier: Band distance in ATR multiples
        
        Returns:
            ATRBandsResult or None if insufficient data
        """
        if not bars or len(bars) < atr_period + 1:
            return None
        
        # Calculate ATR
        atr_values: List[Tuple[datetime, float]] = []
        upper_band: List[Tuple[datetime, float]] = []
        lower_band: List[Tuple[datetime, float]] = []
        
        atr = 0.0
        
        for i in range(len(bars)):
            if i == 0:
                atr_values.append((datetime.fromtimestamp(bars[i].ts_start_ms / 1000), 0.0))
                upper_band.append((datetime.fromtimestamp(bars[i].ts_start_ms / 1000), bars[i].close))
                lower_band.append((datetime.fromtimestamp(bars[i].ts_start_ms / 1000), bars[i].close))
                continue
            
            # Calculate True Range
            high = bars[i].high
            low = bars[i].low
            prev_close = bars[i - 1].close
            
            tr = max(
                high - low,
                abs(high - prev_close),
                abs(low - prev_close)
            )
            
            if i < atr_period:
                # Initial ATR (simple average)
                atr = (atr * (i - 1) + tr) / i
            else:
                # Smoothed ATR (Wilder's smoothing)
                atr = (atr * (atr_period - 1) + tr) / atr_period
            
            bar_time = datetime.fromtimestamp(bars[i].ts_start_ms / 1000)
            atr_values.append((bar_time, atr))
            upper_band.append((bar_time, bars[i].close + multiplier * atr))
            lower_band.append((bar_time, bars[i].close - multiplier * atr))
        
        return ATRBandsResult(
            upper_band=upper_band,
            lower_band=lower_band,
            atr_values=atr_values,
            multiplier=multiplier,
        )
    
    @classmethod
    def calculate_ema_regime(
        cls,
        bars: List[Bar],
        lookback_for_slope: int = 5,
    ) -> Optional[EMARegime]:
        """
        Calculate EMA regime (20/50/200) with slopes and crossover state
        
        Args:
            bars: List of bars (needs at least 200 bars)
            lookback_for_slope: Bars to use for slope calculation
        
        Returns:
            EMARegime or None if insufficient data
        """
        if not bars or len(bars) < 200:
            return None
        
        # Calculate EMAs
        ema_20 = cls._calculate_ema(bars, 20)
        ema_50 = cls._calculate_ema(bars, 50)
        ema_200 = cls._calculate_ema(bars, 200)
        
        if ema_20 is None or ema_50 is None or ema_200 is None:
            return None
        
        # Calculate slopes (rate of change)
        slope_20 = cls._calculate_slope(bars, 20, lookback_for_slope)
        slope_50 = cls._calculate_slope(bars, 50, lookback_for_slope)
        slope_200 = cls._calculate_slope(bars, 200, lookback_for_slope)
        
        # Determine regime
        regime = "neutral"
        if ema_20 > ema_50 > ema_200 and slope_20 > 0 and slope_50 > 0:
            regime = "bullish"
        elif ema_20 < ema_50 < ema_200 and slope_20 < 0 and slope_50 < 0:
            regime = "bearish"
        
        # Detect crossovers (simplified - check current state)
        crossover_state = "none"
        if ema_50 > ema_200:
            # Check if recent (last 10 bars) for golden cross
            if len(bars) >= 210:
                ema_50_prev = cls._calculate_ema(bars[:-10], 50)
                ema_200_prev = cls._calculate_ema(bars[:-10], 200)
                if ema_50_prev and ema_200_prev and ema_50_prev <= ema_200_prev:
                    crossover_state = "golden_cross"
        elif ema_50 < ema_200:
            # Check if recent for death cross
            if len(bars) >= 210:
                ema_50_prev = cls._calculate_ema(bars[:-10], 50)
                ema_200_prev = cls._calculate_ema(bars[:-10], 200)
                if ema_50_prev and ema_200_prev and ema_50_prev >= ema_200_prev:
                    crossover_state = "death_cross"
        
        return EMARegime(
            ema_20=ema_20,
            ema_50=ema_50,
            ema_200=ema_200,
            slope_20=slope_20,
            slope_50=slope_50,
            slope_200=slope_200,
            regime=regime,
            crossover_state=crossover_state,
        )
    
    @classmethod
    def _calculate_ema(cls, bars: List[Bar], period: int) -> Optional[float]:
        """Calculate EMA (most recent value)"""
        if len(bars) < period:
            return None
        
        k = 2 / (period + 1)
        
        # Initialize with SMA
        sma = sum(b.close for b in bars[:period]) / period
        ema = sma
        
        # Apply EMA formula
        for i in range(period, len(bars)):
            ema = bars[i].close * k + ema * (1 - k)
        
        return ema
    
    @classmethod
    def _calculate_slope(cls, bars: List[Bar], ema_period: int, lookback: int) -> float:
        """Calculate slope (rate of change) of EMA over lookback period"""
        if len(bars) < ema_period + lookback:
            return 0.0
        
        # Get EMAs at current and lookback positions
        current_bars = bars
        past_bars = bars[:-lookback]
        
        current_ema = cls._calculate_ema(current_bars, ema_period)
        past_ema = cls._calculate_ema(past_bars, ema_period)
        
        if current_ema is None or past_ema is None:
            return 0.0
        
        # Slope = change / time (in bars)
        slope = (current_ema - past_ema) / lookback
        
        return slope
