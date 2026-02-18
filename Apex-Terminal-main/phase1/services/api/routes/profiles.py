"""
API Routes for Volume Profile and Advanced Indicators
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from datetime import datetime

from ...charting.volume_profile import VolumeProfileCalculator, VolumeProfile
from ...charting.advanced_indicators import AdvancedIndicators
from ...persistence.repository import BarRepository
from ...models import Bar


router = APIRouter(tags=["Profiles"])


@router.get("/volume-profile/{symbol}")
async def get_volume_profile(
    symbol: str,
    timeframe: str = "1D",
    profile_type: str = Query("visible_range", pattern="^(visible_range|fixed_range|session|developing)$"),
    num_rows: int = Query(24, ge=10, le=100),
    start_time: Optional[int] = None,
    end_time: Optional[int] = None,
    limit: int = Query(500, ge=10, le=5000),
):
    """
    Get volume profile for symbol
    
    Profile Types:
    - visible_range: Last N bars (use limit param)
    - fixed_range: Between start_time and end_time (unix timestamps)
    - session: Single session (use start_time for date)
    - developing: Current session POC
    """
    try:
        repo = BarRepository()
        
        # Fetch bars
        if profile_type == "fixed_range":
            if not start_time or not end_time:
                raise HTTPException(400, "start_time and end_time required for fixed_range")
            
            bars = await repo.get_bars(
                symbol=symbol.upper(),
                timeframe=timeframe,
                limit=10000,  # Fetch large range
            )
            # Filter to time range
            bars = [
                b for b in bars
                if start_time <= b.time <= end_time
            ]
        else:
            bars = await repo.get_bars(
                symbol=symbol.upper(),
                timeframe=timeframe,
                limit=limit,
            )
        
        if not bars:
            raise HTTPException(404, f"No bars found for {symbol}/{timeframe}")
        
        # Calculate profile
        profile: Optional[VolumeProfile] = None
        
        if profile_type == "visible_range":
            profile = VolumeProfileCalculator.calculate_visible_range_profile(
                bars=bars,
                num_rows=num_rows,
            )
        elif profile_type == "fixed_range":
            profile = VolumeProfileCalculator.calculate_fixed_range_profile(
                bars=bars,
                start_time=datetime.fromtimestamp(start_time),
                end_time=datetime.fromtimestamp(end_time),
                num_rows=num_rows,
            )
        elif profile_type == "session":
            if not start_time:
                raise HTTPException(400, "start_time required for session profile")
            profile = VolumeProfileCalculator.calculate_session_profile(
                bars=bars,
                session_date=datetime.fromtimestamp(start_time),
                num_rows=num_rows,
            )
        elif profile_type == "developing":
            # Get today's bars only
            today = datetime.now().date()
            today_bars = [
                b for b in bars
                if datetime.fromtimestamp(b.time).date() == today
            ]
            if today_bars:
                poc = VolumeProfileCalculator.calculate_developing_poc(
                    bars=today_bars,
                    num_rows=num_rows,
                )
                if poc:
                    return {"developing_poc": poc, "profile_type": "developing"}
                else:
                    raise HTTPException(500, "Failed to calculate developing POC")
            else:
                raise HTTPException(404, "No bars found for today")
        
        if not profile:
            raise HTTPException(500, "Failed to calculate volume profile")
        
        # Serialize profile
        return {
            "symbol": symbol.upper(),
            "timeframe": timeframe,
            "profile_type": profile.profile_type,
            "poc": profile.poc,
            "vah": profile.vah,
            "val": profile.val,
            "hvn_zones": profile.hvn_zones,
            "lvn_zones": profile.lvn_zones,
            "total_volume": profile.total_volume,
            "start_time": int(profile.start_time.timestamp()),
            "end_time": int(profile.end_time.timestamp()),
            "levels": [
                {
                    "price": l.price,
                    "volume": l.volume,
                    "percentage": round(l.percentage, 2),
                }
                for l in profile.levels
            ],
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Profile calculation failed: {str(e)}")


@router.get("/anchored-vwap/{symbol}")
async def get_anchored_vwap(
    symbol: str,
    timeframe: str = "1D",
    anchor_time: int = Query(..., description="Unix timestamp of anchor point"),
    limit: int = Query(500, ge=10, le=5000),
):
    """
    Get Anchored VWAP with standard deviation bands
    
    Args:
        symbol: Ticker symbol
        timeframe: Bar timeframe
        anchor_time: Unix timestamp to anchor VWAP
        limit: Number of bars to fetch
    """
    try:
        repo = BarRepository()
        bars = await repo.get_bars(
            symbol=symbol.upper(),
            timeframe=timeframe,
            limit=limit,
        )
        
        if not bars:
            raise HTTPException(404, f"No bars found for {symbol}/{timeframe}")
        
        # Find anchor index
        anchor_index = None
        for i, bar in enumerate(bars):
            if bar.time >= anchor_time:
                anchor_index = i
                break
        
        if anchor_index is None:
            raise HTTPException(400, "Anchor time not found in bar range")
        
        # Calculate Anchored VWAP
        result = AdvancedIndicators.calculate_anchored_vwap(
            bars=bars,
            anchor_index=anchor_index,
        )
        
        if not result:
            raise HTTPException(500, "Failed to calculate Anchored VWAP")
        
        return {
            "symbol": symbol.upper(),
            "timeframe": timeframe,
            "anchor_time": int(result.anchor_time.timestamp()),
            "anchor_price": result.anchor_price,
            "vwap": [(int(dt.timestamp()), val) for dt, val in result.vwap],
            "upper_band_1std": [(int(dt.timestamp()), val) for dt, val in result.upper_band_1std],
            "lower_band_1std": [(int(dt.timestamp()), val) for dt, val in result.lower_band_1std],
            "upper_band_2std": [(int(dt.timestamp()), val) for dt, val in result.upper_band_2std],
            "lower_band_2std": [(int(dt.timestamp()), val) for dt, val in result.lower_band_2std],
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Anchored VWAP calculation failed: {str(e)}")


@router.get("/atr-bands/{symbol}")
async def get_atr_bands(
    symbol: str,
    timeframe: str = "1D",
    atr_period: int = Query(14, ge=5, le=100),
    multiplier: float = Query(2.0, ge=0.5, le=5.0),
    limit: int = Query(500, ge=10, le=5000),
):
    """
    Get ATR-based bands around price
    
    Args:
        symbol: Ticker symbol
        timeframe: Bar timeframe
        atr_period: ATR calculation period
        multiplier: Band distance in ATR multiples
        limit: Number of bars
    """
    try:
        repo = BarRepository()
        bars = await repo.get_bars(
            symbol=symbol.upper(),
            timeframe=timeframe,
            limit=limit,
        )
        
        if not bars:
            raise HTTPException(404, f"No bars found for {symbol}/{timeframe}")
        
        result = AdvancedIndicators.calculate_atr_bands(
            bars=bars,
            atr_period=atr_period,
            multiplier=multiplier,
        )
        
        if not result:
            raise HTTPException(500, "Failed to calculate ATR bands")
        
        return {
            "symbol": symbol.upper(),
            "timeframe": timeframe,
            "atr_period": atr_period,
            "multiplier": result.multiplier,
            "upper_band": [(int(dt.timestamp()), val) for dt, val in result.upper_band],
            "lower_band": [(int(dt.timestamp()), val) for dt, val in result.lower_band],
            "atr": [(int(dt.timestamp()), val) for dt, val in result.atr_values],
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"ATR bands calculation failed: {str(e)}")


@router.get("/ema-regime/{symbol}")
async def get_ema_regime(
    symbol: str,
    timeframe: str = "1D",
    limit: int = Query(250, ge=200, le=1000),
):
    """
    Get EMA regime analysis (20/50/200 EMAs with slopes and crossover state)
    
    Args:
        symbol: Ticker symbol
        timeframe: Bar timeframe
        limit: Number of bars (minimum 200)
    """
    try:
        repo = BarRepository()
        bars = await repo.get_bars(
            symbol=symbol.upper(),
            timeframe=timeframe,
            limit=limit,
        )
        
        if not bars or len(bars) < 200:
            raise HTTPException(404, f"Insufficient bars for EMA regime (need 200+, got {len(bars) if bars else 0})")
        
        result = AdvancedIndicators.calculate_ema_regime(bars=bars)
        
        if not result:
            raise HTTPException(500, "Failed to calculate EMA regime")
        
        return {
            "symbol": symbol.upper(),
            "timeframe": timeframe,
            "ema_20": result.ema_20,
            "ema_50": result.ema_50,
            "ema_200": result.ema_200,
            "slope_20": result.slope_20,
            "slope_50": result.slope_50,
            "slope_200": result.slope_200,
            "regime": result.regime,
            "crossover_state": result.crossover_state,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"EMA regime calculation failed: {str(e)}")
