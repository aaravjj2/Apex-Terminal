from typing import List, Dict, Optional
from .brain_types import Bar
import math

# Pure feature calculation - no pandas to keep lightweight/portable if possible
# or use micro-numpy if needed. For now, simple list math.

def calculate_sma(prices: List[float], period: int) -> float:
    if len(prices) < period:
        return 0.0
    return sum(prices[-period:]) / period

def calculate_std_dev(prices: List[float], period: int) -> float:
    if len(prices) < period:
        return 0.0
    mean = calculate_sma(prices, period)
    variance = sum((p - mean) ** 2 for p in prices[-period:]) / period
    return math.sqrt(variance)

def calculate_rsi(prices: List[float], period: int = 14) -> float:
    if len(prices) < period + 1:
        return 50.0
    
    gains = []
    losses = []
    
    # Calculate initial average
    for i in range(1, period + 1):
        change = prices[i] - prices[i-1]
        if change >= 0:
            gains.append(change)
            losses.append(0.0)
        else:
            gains.append(0.0)
            losses.append(abs(change))
            
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    
    if avg_loss == 0:
        return 100.0
    
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))

class FeatureCalculator:
    _instance = None
    
    @classmethod
    def compute_features(cls, bars: List[Bar]) -> Dict[str, float]:
        """Compute technical features from bar history."""
        if not bars:
            return {}
            
        closes = [b.close for b in bars]
        last_close = closes[-1]
        
        # Trend
        sma_20 = calculate_sma(closes, 20)
        sma_50 = calculate_sma(closes, 50)
        
        trend_score = 0.0
        if last_close > sma_20: trend_score += 1.0
        if sma_20 > sma_50: trend_score += 1.0
        
        # Volatility (Annualized Realized)
        stats_len = 20
        if len(closes) > stats_len:
            # Log returns
            returns = []
            for i in range(1, len(closes)):
                r = math.log(closes[i] / closes[i-1])
                returns.append(r)
            
            # Std dev of returns (last 20)
            if len(returns) >= stats_len:
                mean_ret = sum(returns[-stats_len:]) / stats_len
                variance = sum((r - mean_ret)**2 for r in returns[-stats_len:]) / stats_len
                daily_vol = math.sqrt(variance)
                hv_annual = daily_vol * math.sqrt(252)
            else:
                hv_annual = 0.0
        else:
            hv_annual = 0.0

        # RSI
        rsi_14 = calculate_rsi(closes, 14)
        
        return {
            "sma_20": sma_20,
            "sma_50": sma_50,
            "trend_score": trend_score, # 0 (bear) to 2 (bull)
            "hv_annual": hv_annual,
            "rsi_14": rsi_14,
            "last_price": last_close
        }
