
import sys
import os
import unittest
from datetime import datetime

# Add phase1 to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.autopilot.regime_classifier import RegimeClassifier, MarketRegime

class TestRegimeFeatures(unittest.TestCase):
    def setUp(self):
        self.classifier = RegimeClassifier(lookback_bars=2)

    def test_range_expansion(self):
        # Create bars with increasing range
        # Need 'o' for open, 'c' for close, 'h' for high, 'l' for low, 'v' for volume
        bars = [
            {"o": 100, "c": 100, "h": 101, "l": 99, "v": 1000},  # Range 2
            {"o": 100, "c": 100, "h": 101, "l": 99, "v": 1000},  # Range 2
            {"o": 100, "c": 100, "h": 101, "l": 99, "v": 1000},  # Range 2
            {"o": 100, "c": 100, "h": 101, "l": 99, "v": 1000},  # Range 2
            # Big expansion
            {"o": 100, "c": 105, "h": 110, "l": 95, "v": 5000},  # Range 15
        ]
        
        result = self.classifier.classify("TEST", bars)
        
        print(f"Features: {result.features}")
        
        # ATR should be approx (2+2+2+2+15)/5 = 4.6 (simple avg logic in code)
        # Actually code uses last 14 bars, but list is short.
        # Logic: if len < period+1, default ADX=25. 
        # ATR uses period=14 by default.
        # But _compute_atr uses min(len, period) effectively via slicing [-period:]
        
        # Expected:
        # ATR approx (2*4 + 15)/5 = 4.6
        # Current True Range = 15 (h-l) vs gaps. 110-95=15.
        # Range Expansion = 15 / 4.6 ~= 3.26
        
        self.assertGreater(result.features.range_expansion, 2.0)
        print(f"Range Expansion: {result.features.range_expansion}")

    def test_small_expansion(self):
        # Need 'o' for open
        bars = [
            {"o": 100, "c": 100, "h": 101, "l": 99, "v": 1000},
            {"o": 100, "c": 100, "h": 101, "l": 99, "v": 1000}, 
            {"o": 100, "c": 100, "h": 101, "l": 99, "v": 1000},
        ]
        result = self.classifier.classify("TEST", bars)
        # ATR=2, Current TR=2. RE=1.0
        self.assertAlmostEqual(result.features.range_expansion, 1.0, delta=0.2)

if __name__ == '__main__':
    unittest.main()
