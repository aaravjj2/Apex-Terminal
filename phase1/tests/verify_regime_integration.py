
import sys
import os
import asyncio
from datetime import datetime

# Add phase1 to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.autopilot.regime_classifier import RegimeClassifier

def test_regime_integration():
    print(">>> Testing RegimeClassifier Integration...")
    classifier = RegimeClassifier(lookback_bars=20)
    
    # 1. Generate "Normal" data (low volatility)
    # Price oscillating between 100 and 101
    normal_bars = []
    for i in range(30):
        normal_bars.append({
            "c": 100 + (i%2), 
            "h": 101 + (i%2), 
            "l": 99 + (i%2), 
            "v": 1000
        })
    
    res_normal = classifier.classify("TEST_NORMAL", normal_bars)
    print(f"[Normal] ATR: {res_normal.features.atr_pct:.2f}%, Range Expansion: {res_normal.features.range_expansion:.2f}")
    
    # Expectation: Range Expansion near 1.0 (Current Range ~= Average Range)
    if 0.5 <= res_normal.features.range_expansion <= 1.5:
        print("✅ Normal logic PASSED")
    else:
        print(f"❌ Normal logic FAILED (Expected ~1.0, Got {res_normal.features.range_expansion})")

    # 2. Generate "Explosion" data (Breakout)
    # Sudden move: 100 -> 110 (Range 10) vs ATR of ~2
    explode_bars = normal_bars.copy()
    explode_bars.append({
        "c": 110,
        "h": 110,
        "l": 100, # Large candle
        "v": 50000
    })
    
    res_explode = classifier.classify("TEST_EXPLODE", explode_bars)
    print(f"[Explode] ATR: {res_explode.features.atr_pct:.2f}%, Range Expansion: {res_explode.features.range_expansion:.2f}")
    
    # Expectation: Range Expansion > 3.0 (Range 10 / ATR ~2 = 5.0)
    if res_explode.features.range_expansion > 3.0:
         print("✅ Expansion logic PASSED")
    else:
         print(f"❌ Expansion logic FAILED (Expected > 3.0, Got {res_explode.features.range_expansion})")

if __name__ == "__main__":
    test_regime_integration()
