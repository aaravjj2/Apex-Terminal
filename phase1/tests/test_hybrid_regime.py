
import sys
import os
import unittest
from datetime import datetime

# Add phase1 to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.autopilot.regime_classifier import RegimeClassifier, MarketRegime

class TestHybridRegime(unittest.TestCase):
    def setUp(self):
        # Lookback 20 to allow feature builder sufficient data
        self.classifier = RegimeClassifier(lookback_bars=20)

    def test_ml_risk_off_override(self):
        """Test that High Volatility (ML Risk Off) overrides Trend to Chaos."""
        print("\n>>> Testing ML Risk Off Override...")
        
        # construct a "Trending" price series but with HUGE volatility
        # Base logic check: ADX high (Trend), Slope success.
        # ML Logic check: Realized Vol > 0.30 -> Risk Off -> Chaos.
        
        bars = []
        price = 100.0
        for i in range(100):
            # Upward trend but very noisy (high vol)
            # +5, -4 -> Net +1 but huge daily swings (~4-5%)
            change = 5.0 if i % 2 == 0 else -4.0 
            # This constant zigzag creates high realized vol
            price += change
            bars.append({
                "c": price,
                "h": price + 5, # Large wicks for ATR
                "l": price - 5,
                "v": 1000,
                "o": price # Feature builder needs open
            })
            
        result = self.classifier.classify("TEST_RISK_OFF", bars)
        print(f"Result Regime: {result.regime}")
        print(f"Result Confidence: {result.confidence}")
        
        # Logic: 
        # Base might say TREND_UP due to net positive move.
        # But ML Adapter realized_vol should be high.
        # Expectation: CHAOS due to override.
        
        self.assertEqual(result.regime, MarketRegime.CHAOS)
        
    def test_ml_trend_quality_boost(self):
        """Test that Robust Trend (ML Quality) boosts confidence."""
        print("\n>>> Testing ML Trend Quality Boost...")
        
        # Construct a "Perfect" trend (Low Vol, Steady Up)
        bars = []
        price = 100.0
        for i in range(100):
            price += 0.5 # Steady climb
            bars.append({
                "c": price,
                "h": price + 0.1,
                "l": price - 0.1,
                "v": 1000,
                "o": price
            })
            
        result = self.classifier.classify("TEST_QUALITY", bars)
        print(f"Result Regime: {result.regime}")
        print(f"Result Confidence: {result.confidence}")
        
        # Base confidence calculation:
        # linear slope + adx. Often around 0.5-0.8.
        # With boost (+0.2), should be very high.
        
        self.assertEqual(result.regime, MarketRegime.TREND_UP)
        self.assertGreaterEqual(result.confidence, 0.8) # Base likely 0.5-0.6, +0.2 boost

if __name__ == '__main__':
    unittest.main()
