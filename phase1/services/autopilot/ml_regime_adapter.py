
"""
ML Regime Adapter (Hybrid Approach)

This service adapts the '4D Regime Lattice' interface from the external research repo
into the current Autopilot execution engine.

Architecture:
- Inputs: OHLCV Data (processed via FeatureBuilder)
- Logic: Currently uses HEURISTIC PROXIES to simulate ML model outputs.
         (Real LightGBM models would be loaded here in Phase 3b)
- Outputs: 4 Orthogonal Regime Flags (Vol, Trend, Liq, Info)

Regimes:
1. Volatility (Risk Off): High realized vol or downside momentum.
2. Trend Quality (Robust): Strong ADX + Low Noise.
3. Liquidity (Stressed): High Amihud / Volume Shock.
4. Info State (Drifting): Price/News Divergence.
"""

import pandas as pd
import numpy as np
from dataclasses import dataclass
from typing import Dict, List, Any, Optional
import logging

from .ml_features.feature_builder import FeatureBuilder

logger = logging.getLogger(__name__)

@dataclass
class LatticeState:
    vol_regime: int      # 1 = High Vol (Risk Off)
    trend_quality: int   # 1 = Robust Trend
    liquidity_stress: int # 1 = Stressed
    info_state: int      # 1 = Drifting

    def to_dict(self):
        return {
            "vol_regime": self.vol_regime,
            "trend_quality": self.trend_quality,
            "liquidity_stress": self.liquidity_stress,
            "info_state": self.info_state
        }

class MLRegimeAdapter:
    def __init__(self):
        self.feature_builder = FeatureBuilder()
        # In a real implementation, we would load .txt models here
        # self.vol_model = lgb.Booster(model_file='models/vol_model.txt')
        
    def predict_lattice_state(self, bars: List[Dict[str, Any]]) -> LatticeState:
        """
        Predict the 4D regime state from bar data.
        """
        if not bars:
            return LatticeState(0, 0, 0, 0)
            
        # 1. Convert to DataFrame
        df = pd.DataFrame(bars)
        # Normalize columns if needed
        cols = {c: c.lower() for c in df.columns}
        if 'c' in cols and 'close' not in cols:
            df = df.rename(columns={'c': 'close', 'h': 'high', 'l': 'low', 'o': 'open', 'v': 'volume'})
        
        # 2. Build Features
        features = self.feature_builder.build_price_features(df)
        last_row = features.iloc[-1]
        
        # 3. Apply Heuristic Proxies (Simulation of ML Model Logic)
        
        # A. Volatility Regime (Risk Off)
        # External Model Logic: High Realized Vol + Downside
        vol_regime = 1 if (last_row.get('realized_vol_20d', 0) > 0.30 or last_row.get('return_5d', 0) < -0.05) else 0
        
        # B. Trend Quality (Robust)
        # External Model Logic: High ADX equivalent + Low Volatility of Returns
        # We proxy 'Robust' as high RSI range (bullish) or low RSI range (bearish) but not extreme
        # Using simple Trend proxy: Close > MA50 and Vol < 40%
        ma50_ratio = last_row.get('close', 0) / last_row.get('ma_50_ratio', 1.0) # wait, ma_50_ratio is close/ma50
        # Wait, build_price_features output: ma_50_ratio = close / ma_50. 
        # So trend is positive if > 1.0
        is_trending = last_row.get('ma_50_ratio', 1.0) > 1.01 or last_row.get('ma_50_ratio', 1.0) < 0.99
        is_low_noise = last_row.get('volatility_5d', 0) < 0.02 # 2% daily vol max for "Quality"
        trend_quality = 1 if (is_trending and is_low_noise) else 0
        
        # C. Liquidity Stress
        # External Model: Amihud + Volume Shock
        # Logic: High Amihud OR Low Volume Ratio
        amihud = last_row.get('amihud_rel_60', 1.0)
        vol_ratio = last_row.get('volume_ratio_20', 1.0)
        liquidity_stress = 1 if (amihud > 2.0 or vol_ratio < 0.5) else 0
        
        # D. Info State (Drifting)
        # External Model: Momentum Persistence without News
        # Proxy: Strong Momentum but Low Volume (drift)
        mom_20 = abs(last_row.get('momentum_20d', 0))
        is_drifting = mom_20 > 0.05 and vol_ratio < 0.8
        info_state = 1 if is_drifting else 0
        
        return LatticeState(
            vol_regime=vol_regime,
            trend_quality=trend_quality,
            liquidity_stress=liquidity_stress,
            info_state=info_state
        )
