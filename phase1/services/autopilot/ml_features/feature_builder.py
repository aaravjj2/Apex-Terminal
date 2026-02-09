"""Build features from price and news data (Ported from Forecast Models)."""

import pandas as pd
import numpy as np
from typing import Optional, Dict, List
import logging

logger = logging.getLogger(__name__)

class FeatureBuilder:
    """Build time-aligned, leak-free features from price and news data."""
    
    def __init__(self):
        self.feature_metadata = {}
    
    def calculate_safe_divide(self, n, d):
        return n / d.replace(0, np.nan)

    def build_price_features(self, prices: pd.DataFrame) -> pd.DataFrame:
        """
        Build price-based features.
        Args:
            prices: DataFrame with columns: open, high, low, close, volume (normalized keys)
        """
        df = prices.copy()
        
        # Ensure column names are lowercase
        df.columns = [c.lower() for c in df.columns]
        
        # Returns over multiple periods
        for period in [1, 5, 20]:
            df[f'return_{period}d'] = df['close'].pct_change(period)
        
        # Volatility measures & Term Structure (B1)
        for period in [5, 10, 20, 60]:
            df[f'volatility_{period}d'] = df['return_1d'].rolling(period).std()
            df[f'realized_vol_{period}d'] = df[f'volatility_{period}d'] * np.sqrt(252)
            
        # Volatility Term Structure (Short / Long)
        df['vol_term_structure'] = self.calculate_safe_divide(df['volatility_5d'], df['volatility_60d'])
        
        # RSI (Relative Strength Index)
        df['rsi_14'] = self._calculate_rsi(df['close'], 14)
        
        # ATR (Average True Range)
        df['atr_14'] = self._calculate_atr(df, 14)
        
        # Intraday Range
        df['intraday_range_pct'] = (df['high'] - df['low']) / df['open']
        
        # Volume & Liquidity Features (B2)
        for window in [20, 50]:
            df[f'volume_ma_{window}'] = df['volume'].rolling(window).mean()
            # Volume Shock (Ratio)
            df[f'volume_ratio_{window}'] = self.calculate_safe_divide(df['volume'], df[f'volume_ma_{window}'])
        
        # Amihud Illiquidity Proxy (AbsRet / DollarVolume)
        # Dollar Volume = Close * Volume
        dollar_vol = df['close'] * df['volume']
        df['amihud_illiquidity'] = self.calculate_safe_divide(df['return_1d'].abs(), dollar_vol).rolling(20).mean() * 1e6
        
        # Stationary Amihud (Relative to recent history)
        df['amihud_ma_60'] = df['amihud_illiquidity'].rolling(60).mean()
        df['amihud_rel_60'] = self.calculate_safe_divide(df['amihud_illiquidity'], df['amihud_ma_60'])
        
        # Momentum
        for period in [5, 10, 20]:
            df[f'momentum_{period}d'] = df['close'] / df['close'].shift(period) - 1
        
        return df

    def _calculate_rsi(self, prices: pd.Series, period: int = 14) -> pd.Series:
        """Calculate Relative Strength Index."""
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = self.calculate_safe_divide(gain, loss)
        rsi = 100 - (100 / (1 + rs))
        return rsi
    
    def _calculate_atr(self, df: pd.DataFrame, period: int = 14) -> pd.Series:
        """Calculate Average True Range."""
        high_low = df['high'] - df['low']
        high_close = np.abs(df['high'] - df['close'].shift())
        low_close = np.abs(df['low'] - df['close'].shift())
        tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        atr = tr.rolling(period).mean()
        return atr
