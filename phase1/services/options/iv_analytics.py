"""
IV Analytics Calculator
IV Rank, IV Percentile, and historical IV analysis
"""

from datetime import date, datetime
from typing import List, Optional, Tuple
from dataclasses import dataclass

from .models import IVAnalytics, VolatilitySkew, TermStructure
from .greeks import BlackScholesCalculator


@dataclass
class IVHistoryPoint:
    """Single point in IV history"""
    date: date
    iv: float


class IVAnalyticsCalculator:
    """
    Calculator for IV analytics including IV Rank and IV Percentile
    
    IV Rank = (Current IV - 52wk Low) / (52wk High - 52wk Low) * 100
    IV Percentile = % of days in lookback where IV was lower than current
    """
    
    DEFAULT_LOOKBACK_DAYS = 252  # Trading days in a year
    
    @classmethod
    def calculate_iv_rank(
        cls,
        current_iv: float,
        iv_high: float,
        iv_low: float,
    ) -> float:
        """
        Calculate IV Rank (0-100)
        
        IV Rank shows where current IV sits within its historical range
        0 = at 52-week low
        100 = at 52-week high
        """
        if iv_high == iv_low:
            return 50.0  # Default to middle if no range
        
        rank = ((current_iv - iv_low) / (iv_high - iv_low)) * 100
        return max(0.0, min(100.0, rank))
    
    @classmethod
    def calculate_iv_percentile(
        cls,
        current_iv: float,
        historical_ivs: List[float],
    ) -> float:
        """
        Calculate IV Percentile (0-100)
        
        IV Percentile shows % of days where IV was lower than current
        High percentile = IV is high relative to typical levels
        """
        if not historical_ivs:
            return 50.0  # Default if no history
        
        count_lower = sum(1 for iv in historical_ivs if iv < current_iv)
        return (count_lower / len(historical_ivs)) * 100
    
    @classmethod
    def calculate_analytics(
        cls,
        symbol: str,
        current_iv: float,
        historical_ivs: List[float],
        lookback_days: int = DEFAULT_LOOKBACK_DAYS,
    ) -> IVAnalytics:
        """
        Calculate full IV analytics from historical data
        
        Args:
            symbol: Ticker symbol
            current_iv: Current implied volatility (decimal)
            historical_ivs: List of historical IV values (decimals)
            lookback_days: Number of days for calculations
            
        Returns:
            IVAnalytics with rank, percentile, and range data
        """
        # Use only recent history up to lookback
        recent_ivs = historical_ivs[-lookback_days:] if historical_ivs else []
        
        if not recent_ivs:
            # No historical data - return unavailable state
            return IVAnalytics(
                symbol=symbol,
                current_iv=current_iv,
                iv_rank=50.0,  # Unknown, default to middle
                iv_percentile=50.0,
                iv_high=current_iv,
                iv_low=current_iv,
                lookback_days=lookback_days,
            )
        
        iv_high = max(recent_ivs)
        iv_low = min(recent_ivs)
        
        iv_rank = cls.calculate_iv_rank(current_iv, iv_high, iv_low)
        iv_percentile = cls.calculate_iv_percentile(current_iv, recent_ivs)
        
        return IVAnalytics(
            symbol=symbol,
            current_iv=current_iv,
            iv_rank=iv_rank,
            iv_percentile=iv_percentile,
            iv_high=iv_high,
            iv_low=iv_low,
            lookback_days=lookback_days,
        )


class VolatilitySkewCalculator:
    """
    Calculator for volatility skew analysis
    """
    
    @classmethod
    def calculate_skew(
        cls,
        symbol: str,
        expiration: date,
        strikes: List[float],
        ivs: List[float],
        underlying_price: float,
        deltas: Optional[List[float]] = None,
    ) -> VolatilitySkew:
        """
        Calculate volatility skew metrics
        
        Args:
            symbol: Ticker symbol
            expiration: Option expiration date
            strikes: List of strike prices (sorted)
            ivs: List of IVs corresponding to strikes
            underlying_price: Current underlying price
            deltas: Optional list of deltas for 25Δ calculations
            
        Returns:
            VolatilitySkew with metrics
        """
        if not strikes or not ivs or len(strikes) != len(ivs):
            raise ValueError("Invalid strikes/ivs data")
        
        # Find ATM strike and IV
        atm_idx = min(range(len(strikes)), key=lambda i: abs(strikes[i] - underlying_price))
        atm_strike = strikes[atm_idx]
        atm_iv = ivs[atm_idx]
        
        # Calculate skew slope (linear regression of IV vs moneyness)
        # Moneyness = ln(K/S)
        import math
        moneyness = [math.log(k / underlying_price) for k in strikes]
        
        skew_slope = cls._linear_slope(moneyness, ivs)
        
        # Find 25Δ put and call IVs if deltas provided
        delta25_put_iv = None
        delta25_call_iv = None
        skew_ratio = None
        
        if deltas and len(deltas) == len(strikes):
            # 25Δ put has delta around -0.25
            # 25Δ call has delta around 0.25
            put_idx = cls._find_nearest_delta(deltas, -0.25)
            call_idx = cls._find_nearest_delta(deltas, 0.25)
            
            if put_idx is not None:
                delta25_put_iv = ivs[put_idx]
            if call_idx is not None:
                delta25_call_iv = ivs[call_idx]
            
            if delta25_put_iv and delta25_call_iv and delta25_call_iv > 0:
                skew_ratio = delta25_put_iv / delta25_call_iv
        
        return VolatilitySkew(
            symbol=symbol,
            expiration=expiration,
            strikes=strikes,
            ivs=ivs,
            atm_strike=atm_strike,
            atm_iv=atm_iv,
            skew_slope=skew_slope,
            delta25_put_iv=delta25_put_iv,
            delta25_call_iv=delta25_call_iv,
            skew_ratio=skew_ratio,
        )
    
    @staticmethod
    def _linear_slope(x: List[float], y: List[float]) -> float:
        """Calculate slope of simple linear regression"""
        n = len(x)
        if n < 2:
            return 0.0
        
        mean_x = sum(x) / n
        mean_y = sum(y) / n
        
        numerator = sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(x, y))
        denominator = sum((xi - mean_x) ** 2 for xi in x)
        
        if denominator == 0:
            return 0.0
        
        return numerator / denominator
    
    @staticmethod
    def _find_nearest_delta(deltas: List[float], target: float) -> Optional[int]:
        """Find index of delta closest to target"""
        if not deltas:
            return None
        
        idx = min(range(len(deltas)), key=lambda i: abs(deltas[i] - target))
        
        # Only return if reasonably close (within 0.1)
        if abs(deltas[idx] - target) < 0.1:
            return idx
        return None


class TermStructureCalculator:
    """
    Calculator for IV term structure analysis
    """
    
    @classmethod
    def calculate_term_structure(
        cls,
        symbol: str,
        expirations: List[date],
        atm_ivs: List[float],
        reference_date: Optional[date] = None,
    ) -> TermStructure:
        """
        Calculate IV term structure and classify shape
        
        Args:
            symbol: Ticker symbol
            expirations: List of expiration dates (sorted)
            atm_ivs: ATM IV for each expiration
            reference_date: Reference date for DTE calculation (default: today)
            
        Returns:
            TermStructure with shape classification
        """
        if not expirations or not atm_ivs or len(expirations) != len(atm_ivs):
            raise ValueError("Invalid expirations/ivs data")
        
        if reference_date is None:
            reference_date = date.today()
        
        # Calculate days to expiration
        days_to_exp = [(exp - reference_date).days for exp in expirations]
        
        # Filter out expired or same-day
        valid_pairs = [
            (exp, dte, iv) 
            for exp, dte, iv in zip(expirations, days_to_exp, atm_ivs)
            if dte > 0
        ]
        
        if not valid_pairs:
            return TermStructure(
                symbol=symbol,
                expirations=[],
                days_to_expiration=[],
                ivs=[],
                structure_type="flat",
            )
        
        expirations_valid, dtes, ivs = zip(*valid_pairs)
        
        # Classify structure
        structure_type = cls._classify_structure(list(dtes), list(ivs))
        
        return TermStructure(
            symbol=symbol,
            expirations=list(expirations_valid),
            days_to_expiration=list(dtes),
            ivs=list(ivs),
            structure_type=structure_type,
        )
    
    @classmethod
    def _classify_structure(
        cls,
        dtes: List[int],
        ivs: List[float],
    ) -> str:
        """
        Classify term structure shape
        
        - contango: IV increases with time (normal)
        - backwardation: IV decreases with time
        - flat: No significant slope
        - inverted: Near-term IV significantly higher (event-driven)
        """
        if len(ivs) < 2:
            return "flat"
        
        # Calculate slope of IV vs DTE
        slope = VolatilitySkewCalculator._linear_slope(dtes, ivs)
        
        # Check for inversion (front month significantly elevated)
        front_iv = ivs[0]
        back_ivs = ivs[1:]
        avg_back_iv = sum(back_ivs) / len(back_ivs)
        
        # Inversion threshold: front IV > 20% higher than average back
        if front_iv > avg_back_iv * 1.20:
            return "inverted"
        
        # Classify by slope
        # Slope threshold relative to average IV
        avg_iv = sum(ivs) / len(ivs)
        slope_threshold = avg_iv * 0.001  # 0.1% of avg IV per day
        
        if slope > slope_threshold:
            return "contango"
        elif slope < -slope_threshold:
            return "backwardation"
        else:
            return "flat"


# Convenience function for API
def calculate_iv_analytics(
    symbol: str,
    current_iv: float,
    historical_ivs: List[float],
    lookback_days: int = 252,
) -> dict:
    """Calculate IV analytics and return as dictionary"""
    analytics = IVAnalyticsCalculator.calculate_analytics(
        symbol, current_iv, historical_ivs, lookback_days
    )
    return analytics.to_dict()
