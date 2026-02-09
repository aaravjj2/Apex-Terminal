"""
Volume Profile Calculator
Computes POC, VAH, VAL, HVN/LVN zones for various profile types
"""

from typing import List, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime
import numpy as np

from ..models import Bar


@dataclass
class ProfileLevel:
    """Single price level in volume profile"""
    price: float
    volume: float
    percentage: float  # % of total volume


@dataclass
class VolumeProfile:
    """Complete volume profile result"""
    poc: float  # Point of Control (highest volume price)
    vah: float  # Value Area High (top of 70% volume area)
    val: float  # Value Area Low (bottom of 70% volume area)
    hvn_zones: List[Tuple[float, float]]  # High Volume Nodes (price ranges)
    lvn_zones: List[Tuple[float, float]]  # Low Volume Nodes (price ranges)
    levels: List[ProfileLevel]  # All price levels with volume
    total_volume: float
    start_time: datetime
    end_time: datetime
    profile_type: str  # "visible_range", "fixed_range", "session", "developing"


class VolumeProfileCalculator:
    """
    Calculate volume profiles from bar data
    
    Profile Types:
    - Visible Range (VRVP): Based on currently visible bars on chart
    - Fixed Range (FRVP): User-defined start/end time
    - Session Profile: Daily or weekly session
    - Developing POC: Real-time POC that updates throughout session
    """
    
    DEFAULT_NUM_ROWS = 24  # Standard TPO chart rows
    VALUE_AREA_PERCENTAGE = 0.70  # 70% volume defines value area
    HVN_THRESHOLD = 1.5  # Volume > 1.5x average = HVN
    LVN_THRESHOLD = 0.5  # Volume < 0.5x average = LVN
    
    @classmethod
    def calculate_visible_range_profile(
        cls,
        bars: List[Bar],
        num_rows: int = DEFAULT_NUM_ROWS,
    ) -> Optional[VolumeProfile]:
        """
        Calculate profile for visible bars on chart
        
        Args:
            bars: List of bars in visible range
            num_rows: Number of price rows (default 24)
        
        Returns:
            VolumeProfile or None if insufficient data
        """
        if not bars or len(bars) < 2:
            return None
        
        return cls._calculate_profile(
            bars=bars,
            num_rows=num_rows,
            profile_type="visible_range",
        )
    
    @classmethod
    def calculate_fixed_range_profile(
        cls,
        bars: List[Bar],
        start_time: datetime,
        end_time: datetime,
        num_rows: int = DEFAULT_NUM_ROWS,
    ) -> Optional[VolumeProfile]:
        """
        Calculate profile for fixed time range
        
        Args:
            bars: All available bars
            start_time: Range start
            end_time: Range end
            num_rows: Number of price rows
        
        Returns:
            VolumeProfile or None if insufficient data
        """
        # Filter bars to time range
        filtered_bars = [
            b for b in bars
            if start_time <= datetime.fromtimestamp(b.ts_start_ms / 1000) <= end_time
        ]
        
        if not filtered_bars or len(filtered_bars) < 2:
            return None
        
        return cls._calculate_profile(
            bars=filtered_bars,
            num_rows=num_rows,
            profile_type="fixed_range",
        )
    
    @classmethod
    def calculate_session_profile(
        cls,
        bars: List[Bar],
        session_date: datetime,
        num_rows: int = DEFAULT_NUM_ROWS,
    ) -> Optional[VolumeProfile]:
        """
        Calculate profile for trading session (day/week)
        
        Args:
            bars: All available bars
            session_date: Date of session
            num_rows: Number of price rows
        
        Returns:
            VolumeProfile or None if insufficient data
        """
        # Filter bars to session date (simplistic - assumes daily session)
        filtered_bars = [
            b for b in bars
            if datetime.fromtimestamp(b.ts_start_ms / 1000).date() == session_date.date()
        ]
        
        if not filtered_bars or len(filtered_bars) < 2:
            return None
        
        return cls._calculate_profile(
            bars=filtered_bars,
            num_rows=num_rows,
            profile_type="session",
        )
    
    @classmethod
    def calculate_developing_poc(
        cls,
        bars: List[Bar],
        num_rows: int = DEFAULT_NUM_ROWS,
    ) -> Optional[float]:
        """
        Calculate developing POC (real-time POC for current session)
        
        Args:
            bars: Bars from current session so far
            num_rows: Number of price rows
        
        Returns:
            Current POC price or None
        """
        profile = cls._calculate_profile(
            bars=bars,
            num_rows=num_rows,
            profile_type="developing",
        )
        
        return profile.poc if profile else None
    
    @classmethod
    def _calculate_profile(
        cls,
        bars: List[Bar],
        num_rows: int,
        profile_type: str,
    ) -> Optional[VolumeProfile]:
        """
        Core profile calculation logic
        
        Args:
            bars: Bars to analyze
            num_rows: Number of price levels to create
            profile_type: Type of profile being calculated
        
        Returns:
            VolumeProfile or None if insufficient data
        """
        if not bars or len(bars) < 2:
            return None
        
        # Determine price range
        high_prices = [b.high for b in bars]
        low_prices = [b.low for b in bars]
        price_high = max(high_prices)
        price_low = min(low_prices)
        price_range = price_high - price_low
        
        if price_range == 0:
            return None
        
        # Create price levels
        row_size = price_range / num_rows
        levels: List[ProfileLevel] = []
        
        for i in range(num_rows):
            level_low = price_low + (i * row_size)
            level_high = level_low + row_size
            level_mid = (level_low + level_high) / 2
            
            # Accumulate volume for this level
            level_volume = 0.0
            for bar in bars:
                # Check if bar overlaps this price level
                if bar.low <= level_high and bar.high >= level_low:
                    # Distribute bar volume proportionally
                    overlap_low = max(bar.low, level_low)
                    overlap_high = min(bar.high, level_high)
                    overlap_range = overlap_high - overlap_low
                    bar_range = bar.high - bar.low
                    
                    if bar_range > 0:
                        volume_fraction = overlap_range / bar_range
                        level_volume += bar.volume * volume_fraction
                    else:
                        # Bar has no range (single price), assign full volume
                        level_volume += bar.volume
            
            levels.append(ProfileLevel(
                price=level_mid,
                volume=level_volume,
                percentage=0.0,  # Will calculate after total is known
            ))
        
        # Calculate total volume and percentages
        total_volume = sum(l.volume for l in levels)
        if total_volume == 0:
            return None
        
        for level in levels:
            level.percentage = (level.volume / total_volume) * 100
        
        # Find POC (highest volume level)
        poc_level = max(levels, key=lambda l: l.volume)
        poc = poc_level.price
        
        # Calculate Value Area (70% of volume around POC)
        vah, val = cls._calculate_value_area(levels, poc_level)
        
        # Identify HVN and LVN zones
        hvn_zones, lvn_zones = cls._identify_volume_nodes(levels)
        
        return VolumeProfile(
            poc=poc,
            vah=vah,
            val=val,
            hvn_zones=hvn_zones,
            lvn_zones=lvn_zones,
            levels=levels,
            total_volume=total_volume,
            start_time=datetime.fromtimestamp(bars[0].ts_start_ms / 1000),
            end_time=datetime.fromtimestamp(bars[-1].ts_start_ms / 1000),
            profile_type=profile_type,
        )
    
    @classmethod
    def _calculate_value_area(
        cls,
        levels: List[ProfileLevel],
        poc_level: ProfileLevel,
    ) -> Tuple[float, float]:
        """
        Calculate Value Area High and Low (70% volume area around POC)
        
        Args:
            levels: All price levels
            poc_level: Point of Control level
        
        Returns:
            (VAH, VAL) tuple
        """
        # Sort levels by price
        sorted_levels = sorted(levels, key=lambda l: l.price)
        
        # Find POC index
        poc_index = sorted_levels.index(poc_level)
        
        # Expand from POC until we capture 70% of volume
        target_volume = sum(l.volume for l in levels) * cls.VALUE_AREA_PERCENTAGE
        accumulated_volume = poc_level.volume
        
        low_index = poc_index
        high_index = poc_index
        
        while accumulated_volume < target_volume:
            # Check which direction has more volume
            can_expand_up = high_index < len(sorted_levels) - 1
            can_expand_down = low_index > 0
            
            if not can_expand_up and not can_expand_down:
                break
            
            vol_above = sorted_levels[high_index + 1].volume if can_expand_up else 0
            vol_below = sorted_levels[low_index - 1].volume if can_expand_down else 0
            
            if vol_above >= vol_below and can_expand_up:
                high_index += 1
                accumulated_volume += sorted_levels[high_index].volume
            elif can_expand_down:
                low_index -= 1
                accumulated_volume += sorted_levels[low_index].volume
            else:
                break
        
        vah = sorted_levels[high_index].price
        val = sorted_levels[low_index].price
        
        return vah, val
    
    @classmethod
    def _identify_volume_nodes(
        cls,
        levels: List[ProfileLevel],
    ) -> Tuple[List[Tuple[float, float]], List[Tuple[float, float]]]:
        """
        Identify High Volume Nodes (HVN) and Low Volume Nodes (LVN)
        
        Args:
            levels: All price levels
        
        Returns:
            (hvn_zones, lvn_zones) tuple of price ranges
        """
        if not levels:
            return [], []
        
        # Calculate average volume
        avg_volume = sum(l.volume for l in levels) / len(levels)
        
        # Sort levels by price for zone detection
        sorted_levels = sorted(levels, key=lambda l: l.price)
        
        hvn_zones: List[Tuple[float, float]] = []
        lvn_zones: List[Tuple[float, float]] = []
        
        # Detect contiguous HVN zones
        in_hvn_zone = False
        hvn_start = None
        
        for i, level in enumerate(sorted_levels):
            is_hvn = level.volume > avg_volume * cls.HVN_THRESHOLD
            
            if is_hvn and not in_hvn_zone:
                # Start new HVN zone
                in_hvn_zone = True
                hvn_start = level.price
            elif not is_hvn and in_hvn_zone:
                # End HVN zone
                in_hvn_zone = False
                hvn_end = sorted_levels[i - 1].price
                hvn_zones.append((hvn_start, hvn_end))
        
        # Close final HVN zone if still open
        if in_hvn_zone and hvn_start is not None:
            hvn_zones.append((hvn_start, sorted_levels[-1].price))
        
        # Detect contiguous LVN zones
        in_lvn_zone = False
        lvn_start = None
        
        for i, level in enumerate(sorted_levels):
            is_lvn = level.volume < avg_volume * cls.LVN_THRESHOLD and level.volume > 0
            
            if is_lvn and not in_lvn_zone:
                # Start new LVN zone
                in_lvn_zone = True
                lvn_start = level.price
            elif not is_lvn and in_lvn_zone:
                # End LVN zone
                in_lvn_zone = False
                lvn_end = sorted_levels[i - 1].price
                lvn_zones.append((lvn_start, lvn_end))
        
        # Close final LVN zone if still open
        if in_lvn_zone and lvn_start is not None:
            lvn_zones.append((lvn_start, sorted_levels[-1].price))
        
        return hvn_zones, lvn_zones
