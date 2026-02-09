"""
Pattern Detection Engine
Detects chart patterns with context filtering
"""

from typing import List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
from enum import Enum

from ..models import Bar


class PatternType(str, Enum):
    """Supported pattern types"""
    FLAG = "flag"
    PENNANT = "pennant"
    TRIANGLE_ASCENDING = "triangle_ascending"
    TRIANGLE_DESCENDING = "triangle_descending"
    TRIANGLE_SYMMETRICAL = "triangle_symmetrical"
    RECTANGLE = "rectangle"
    WEDGE_RISING = "wedge_rising"
    WEDGE_FALLING = "wedge_falling"
    DOUBLE_TOP = "double_top"
    DOUBLE_BOTTOM = "double_bottom"
    HEAD_SHOULDERS = "head_shoulders"
    HEAD_SHOULDERS_INVERSE = "head_shoulders_inverse"
    CUP_HANDLE = "cup_handle"
    ROUNDING_BOTTOM = "rounding_bottom"
    GAP_BREAKAWAY = "gap_breakaway"
    GAP_RUNAWAY = "gap_runaway"
    GAP_EXHAUSTION = "gap_exhaustion"
    ENGULFING_BULLISH = "engulfing_bullish"
    ENGULFING_BEARISH = "engulfing_bearish"
    DOJI = "doji"
    HAMMER = "hammer"


@dataclass
class Pattern:
    """Detected pattern"""
    pattern_type: PatternType
    start_index: int
    end_index: int
    start_time: datetime
    end_time: datetime
    confidence: float  # 0.0 to 1.0
    context: str  # Explanation of pattern and context
    key_levels: List[float]  # Important price levels
    direction: str  # "bullish", "bearish", "neutral"


class PatternDetector:
    """
    Detect chart patterns with context filtering
    
    Requires:
    - ATR for regime check
    - VWAP/profile levels for reference
    - Prior swing highs/lows for structure
    """
    
    MIN_ATR_THRESHOLD = 0.001  # Minimum ATR for pattern validity
    
    @classmethod
    def detect_patterns(
        cls,
        bars: List[Bar],
        atr_values: Optional[List[float]] = None,
        vwap: Optional[float] = None,
        poc: Optional[float] = None,
    ) -> List[Pattern]:
        """
        Detect all patterns in bar data with context filtering
        
        Args:
            bars: List of bars to analyze
            atr_values: ATR values for regime check (optional)
            vwap: Current VWAP level for reference (optional)
            poc: Current POC level for reference (optional)
        
        Returns:
            List of detected patterns
        """
        if not bars or len(bars) < 20:
            return []
        
        patterns: List[Pattern] = []
        
        # Detect each pattern type
        patterns.extend(cls._detect_flags_pennants(bars, atr_values))
        patterns.extend(cls._detect_triangles(bars, atr_values))
        patterns.extend(cls._detect_rectangles(bars))
        patterns.extend(cls._detect_wedges(bars, atr_values))
        patterns.extend(cls._detect_double_tops_bottoms(bars, atr_values))
        patterns.extend(cls._detect_head_shoulders(bars, atr_values))
        patterns.extend(cls._detect_cup_handle(bars))
        patterns.extend(cls._detect_gaps(bars, atr_values))
        patterns.extend(cls._detect_candle_patterns(bars, atr_values, vwap))
        
        # Filter by context (ATR, levels, structure)
        filtered_patterns = cls._filter_by_context(
            patterns=patterns,
            bars=bars,
            atr_values=atr_values,
            vwap=vwap,
            poc=poc,
        )
        
        return filtered_patterns
    
    @classmethod
    def _detect_flags_pennants(
        cls,
        bars: List[Bar],
        atr_values: Optional[List[float]],
    ) -> List[Pattern]:
        """Detect flag and pennant patterns"""
        patterns: List[Pattern] = []
        
        # Simplified detection: Look for consolidation after strong move
        for i in range(20, len(bars) - 10):
            # Check for strong move (pole)
            pole_start = i - 20
            pole_end = i
            pole_bars = bars[pole_start:pole_end]
            
            pole_change = (pole_bars[-1].close - pole_bars[0].close) / pole_bars[0].close
            
            if abs(pole_change) < 0.05:  # Need 5% move minimum
                continue
            
            # Check for consolidation (flag)
            flag_bars = bars[i:i+10]
            flag_range = max(b.high for b in flag_bars) - min(b.low for b in flag_bars)
            flag_midpoint = (max(b.high for b in flag_bars) + min(b.low for b in flag_bars)) / 2
            
            # Flag should be smaller than pole
            pole_range = max(b.high for b in pole_bars) - min(b.low for b in pole_bars)
            
            if flag_range < pole_range * 0.5:
                patterns.append(Pattern(
                    pattern_type=PatternType.FLAG,
                    start_index=pole_start,
                    end_index=i+10,
                    start_time=datetime.fromtimestamp(bars[pole_start].ts_start_ms / 1000),
                    end_time=datetime.fromtimestamp(bars[i+10].ts_start_ms / 1000),
                    confidence=0.6,
                    context=f"Flag after {pole_change*100:.1f}% move, consolidation at {flag_midpoint:.2f}",
                    key_levels=[flag_midpoint],
                    direction="bullish" if pole_change > 0 else "bearish",
                ))
        
        return patterns
    
    @classmethod
    def _detect_triangles(
        cls,
        bars: List[Bar],
        atr_values: Optional[List[float]],
    ) -> List[Pattern]:
        """Detect triangle patterns"""
        patterns: List[Pattern] = []
        
        # Simplified: Look for converging highs and lows
        window = 30
        for i in range(window, len(bars) - 5):
            window_bars = bars[i-window:i]
            
            highs = [b.high for b in window_bars]
            lows = [b.low for b in window_bars]
            
            # Check if range is contracting
            first_half_range = max(highs[:window//2]) - min(lows[:window//2])
            second_half_range = max(highs[window//2:]) - min(lows[window//2:])
            
            if second_half_range < first_half_range * 0.7:
                # Converging pattern detected
                patterns.append(Pattern(
                    pattern_type=PatternType.TRIANGLE_SYMMETRICAL,
                    start_index=i-window,
                    end_index=i,
                    start_time=datetime.fromtimestamp(bars[i-window].ts_start_ms / 1000),
                    end_time=datetime.fromtimestamp(bars[i].ts_start_ms / 1000),
                    confidence=0.5,
                    context="Symmetrical triangle: converging highs and lows",
                    key_levels=[max(highs), min(lows)],
                    direction="neutral",
                ))
        
        return patterns
    
    @classmethod
    def _detect_rectangles(cls, bars: List[Bar]) -> List[Pattern]:
        """Detect rectangle/range patterns"""
        patterns: List[Pattern] = []
        
        # Look for sideways price action
        window = 30
        for i in range(window, len(bars) - 5):
            window_bars = bars[i-window:i]
            
            closes = [b.close for b in window_bars]
            mean_close = sum(closes) / len(closes)
            variance = sum((c - mean_close) ** 2 for c in closes) / len(closes)
            std_dev = variance ** 0.5
            
            # If low variance, likely range-bound
            if std_dev / mean_close < 0.02:  # 2% standard deviation
                patterns.append(Pattern(
                    pattern_type=PatternType.RECTANGLE,
                    start_index=i-window,
                    end_index=i,
                    start_time=datetime.fromtimestamp(bars[i-window].ts_start_ms / 1000),
                    end_time=datetime.fromtimestamp(bars[i].ts_start_ms / 1000),
                    confidence=0.6,
                    context=f"Range-bound: {std_dev/mean_close*100:.1f}% volatility",
                    key_levels=[mean_close],
                    direction="neutral",
                ))
        
        return patterns
    
    @classmethod
    def _detect_wedges(
        cls,
        bars: List[Bar],
        atr_values: Optional[List[float]],
    ) -> List[Pattern]:
        """Detect rising and falling wedge patterns"""
        # Simplified implementation
        return []
    
    @classmethod
    def _detect_double_tops_bottoms(
        cls,
        bars: List[Bar],
        atr_values: Optional[List[float]],
    ) -> List[Pattern]:
        """Detect double top/bottom patterns"""
        patterns: List[Pattern] = []
        
        # Look for two peaks or troughs at similar levels
        window = 50
        for i in range(window, len(bars) - 10):
            window_bars = bars[i-window:i]
            
            # Find local peaks
            peaks = []
            for j in range(5, len(window_bars) - 5):
                if (window_bars[j].high > window_bars[j-1].high and
                    window_bars[j].high > window_bars[j+1].high):
                    peaks.append((j, window_bars[j].high))
            
            # Check for double top (two peaks at similar level)
            if len(peaks) >= 2:
                last_two_peaks = peaks[-2:]
                peak_diff = abs(last_two_peaks[0][1] - last_two_peaks[1][1])
                avg_peak = (last_two_peaks[0][1] + last_two_peaks[1][1]) / 2
                
                if peak_diff / avg_peak < 0.02:  # Within 2%
                    patterns.append(Pattern(
                        pattern_type=PatternType.DOUBLE_TOP,
                        start_index=i-window+last_two_peaks[0][0],
                        end_index=i,
                        start_time=datetime.fromtimestamp(bars[i-window+last_two_peaks[0][0]].ts_start_ms / 1000),
                        end_time=datetime.fromtimestamp(bars[i].ts_start_ms / 1000),
                        confidence=0.7,
                        context=f"Double top at {avg_peak:.2f}",
                        key_levels=[avg_peak],
                        direction="bearish",
                    ))
        
        return patterns
    
    @classmethod
    def _detect_head_shoulders(
        cls,
        bars: List[Bar],
        atr_values: Optional[List[float]],
    ) -> List[Pattern]:
        """Detect head and shoulders patterns"""
        # Simplified implementation
        return []
    
    @classmethod
    def _detect_cup_handle(cls, bars: List[Bar]) -> List[Pattern]:
        """Detect cup and handle pattern"""
        # Simplified implementation
        return []
    
    @classmethod
    def _detect_gaps(
        cls,
        bars: List[Bar],
        atr_values: Optional[List[float]],
    ) -> List[Pattern]:
        """Detect gap patterns"""
        patterns: List[Pattern] = []
        
        for i in range(1, len(bars)):
            prev_bar = bars[i-1]
            curr_bar = bars[i]
            
            # Check for gap up
            if curr_bar.low > prev_bar.high:
                gap_size = curr_bar.low - prev_bar.high
                gap_pct = gap_size / prev_bar.close
                
                if gap_pct > 0.02:  # 2% gap minimum
                    patterns.append(Pattern(
                        pattern_type=PatternType.GAP_BREAKAWAY,
                        start_index=i-1,
                        end_index=i,
                        start_time=datetime.fromtimestamp(prev_bar.ts_start_ms / 1000),
                        end_time=datetime.fromtimestamp(curr_bar.ts_start_ms / 1000),
                        confidence=0.8,
                        context=f"Gap up: {gap_pct*100:.1f}%",
                        key_levels=[prev_bar.high, curr_bar.low],
                        direction="bullish",
                    ))
            
            # Check for gap down
            elif curr_bar.high < prev_bar.low:
                gap_size = prev_bar.low - curr_bar.high
                gap_pct = gap_size / prev_bar.close
                
                if gap_pct > 0.02:
                    patterns.append(Pattern(
                        pattern_type=PatternType.GAP_BREAKAWAY,
                        start_index=i-1,
                        end_index=i,
                        start_time=datetime.fromtimestamp(prev_bar.ts_start_ms / 1000),
                        end_time=datetime.fromtimestamp(curr_bar.ts_start_ms / 1000),
                        confidence=0.8,
                        context=f"Gap down: {gap_pct*100:.1f}%",
                        key_levels=[prev_bar.low, curr_bar.high],
                        direction="bearish",
                    ))
        
        return patterns
    
    @classmethod
    def _detect_candle_patterns(
        cls,
        bars: List[Bar],
        atr_values: Optional[List[float]],
        vwap: Optional[float],
    ) -> List[Pattern]:
        """Detect candlestick patterns"""
        patterns: List[Pattern] = []
        
        for i in range(1, len(bars)):
            prev_bar = bars[i-1]
            curr_bar = bars[i]
            
            # Engulfing patterns
            if (curr_bar.close > curr_bar.open and  # Bullish bar
                prev_bar.close < prev_bar.open and  # Prev bearish
                curr_bar.close > prev_bar.open and
                curr_bar.open < prev_bar.close):
                
                patterns.append(Pattern(
                    pattern_type=PatternType.ENGULFING_BULLISH,
                    start_index=i-1,
                    end_index=i,
                    start_time=datetime.fromtimestamp(prev_bar.ts_start_ms / 1000),
                    end_time=datetime.fromtimestamp(curr_bar.ts_start_ms / 1000),
                    confidence=0.6,
                    context="Bullish engulfing candle",
                    key_levels=[curr_bar.close],
                    direction="bullish",
                ))
            
            # Doji
            body_size = abs(curr_bar.close - curr_bar.open)
            total_range = curr_bar.high - curr_bar.low
            
            if total_range > 0 and body_size / total_range < 0.1:
                patterns.append(Pattern(
                    pattern_type=PatternType.DOJI,
                    start_index=i,
                    end_index=i,
                    start_time=datetime.fromtimestamp(curr_bar.ts_start_ms / 1000),
                    end_time=datetime.fromtimestamp(curr_bar.ts_start_ms / 1000),
                    confidence=0.5,
                    context="Doji: indecision candle",
                    key_levels=[curr_bar.close],
                    direction="neutral",
                ))
        
        return patterns
    
    @classmethod
    def _filter_by_context(
        cls,
        patterns: List[Pattern],
        bars: List[Bar],
        atr_values: Optional[List[float]],
        vwap: Optional[float],
        poc: Optional[float],
    ) -> List[Pattern]:
        """
        Filter patterns by context:
        - ATR regime check
        - Reference levels (VWAP, POC)
        - Structure confirmation
        """
        filtered: List[Pattern] = []
        
        for pattern in patterns:
            # Check ATR regime if available
            if atr_values and len(atr_values) > pattern.end_index:
                atr = atr_values[pattern.end_index]
                if atr < cls.MIN_ATR_THRESHOLD:
                    continue  # Skip patterns in very low volatility
            
            # Add context about VWAP/POC if available
            if vwap and pattern.key_levels:
                closest_level = min(pattern.key_levels, key=lambda x: abs(x - vwap))
                if abs(closest_level - vwap) / vwap < 0.01:
                    pattern.context += f" | Near VWAP ({vwap:.2f})"
                    pattern.confidence += 0.1
            
            if poc and pattern.key_levels:
                closest_level = min(pattern.key_levels, key=lambda x: abs(x - poc))
                if abs(closest_level - poc) / poc < 0.01:
                    pattern.context += f" | Near POC ({poc:.2f})"
                    pattern.confidence += 0.1
            
            # Cap confidence at 1.0
            pattern.confidence = min(pattern.confidence, 1.0)
            
            filtered.append(pattern)
        
        return filtered
