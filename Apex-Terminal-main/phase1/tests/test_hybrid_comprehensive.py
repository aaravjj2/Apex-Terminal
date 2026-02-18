
import sys
import os
import unittest
from datetime import datetime

# Add phase1 to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.autopilot.regime_classifier import RegimeClassifier, MarketRegime

class TestHybridComprehensive(unittest.TestCase):
    def setUp(self):
        self.classifier = RegimeClassifier(lookback_bars=65) # Need 60+ for Amihud

    def _generate_bars(self, base_price=100.0, n=100, pattern='steady', vol_mult=1.0, volume_mult=1.0, start_price=None):
        bars = []
        price = start_price if start_price is not None else base_price
        for i in range(n):
            if pattern == 'steady':
                change = 0.5
            elif pattern == 'chop':
                change = 5.0 if i % 2 == 0 else -4.0
            elif pattern == 'crash':
                change = -2.0
            elif pattern == 'drift':
                change = 0.1 # Slow drift
            else:
                change = 0
            
            price += (change * vol_mult)
            
            # Volume logic
            vol = 1000 * volume_mult
            
            bars.append({
                "c": price,
                "h": price + abs(change)*0.5,
                "l": price - abs(change)*0.5,
                "v": vol,
                "o": price - change
            })
        return bars

    def test_scenario_A_liquidity_stress(self):
        """Test Scenario A: Liquidity Stress (Volume Cliff) -> Confidence Penalty"""
        print("\n>>> Testing Scenario A: Liquidity Stress")
        
        # We need relative Amihud spike. 
        # Phase 1: High Volume (Normal Liquidity) for 60 bars
        phase1 = self._generate_bars(pattern='steady', n=60, volume_mult=10.0)
        # Phase 2: Volume Collapse (Liquidity Crunch) for 5 bars
        phase2 = self._generate_bars(pattern='steady', n=5, start_price=phase1[-1]['c'], volume_mult=0.01)
        
        bars = phase1 + phase2
        
        result = self.classifier.classify("TEST_LIQ", bars)
        print(f"Regime: {result.regime}, Conf: {result.confidence}")
        
        self.assertLess(result.confidence, 0.8) # Should handle the penalty

    def test_scenario_B_info_drift(self):
        """Test Scenario B: Info Drift (Momentum without Volume) -> Drift Penalty"""
        print("\n>>> Testing Scenario B: Info Drift")
        
        # Drift: Momentum > 0.05 but VolRatio < 0.8
        # Generate trend with low-ish volume (but not crash low)
        bars = self._generate_bars(pattern='drift', n=80, volume_mult=0.5)
        
        result = self.classifier.classify("TEST_DRIFT", bars)
        print(f"Regime: {result.regime}, Conf: {result.confidence}")
        
        # Should be detected as Drift (penalty 0.9)
        # Verify result is valid
        self.assertIn(result.regime, [MarketRegime.TREND_UP, MarketRegime.RANGE])

    def test_scenario_C_volatility_veto(self):
        """Test Scenario C: Volatility (Risk Off) -> Chaos Veto"""
        print("\n>>> Testing Scenario C: Volatility Veto")
        
        # High Vol Chop
        bars = self._generate_bars(pattern='chop', vol_mult=2.0)
        
        result = self.classifier.classify("TEST_VOL", bars)
        print(f"Regime: {result.regime}, Conf: {result.confidence}")
        
        self.assertEqual(result.regime, MarketRegime.CHAOS)

    def test_scenario_D_trend_quality(self):
        """Test Scenario D: Best Case (Quality Trend)"""
        print("\n>>> Testing Scenario D: Robust Trend")
        
        # Low noise, good volume
        bars = self._generate_bars(pattern='steady', vol_mult=1.0, volume_mult=1.5)
        
        result = self.classifier.classify("TEST_BEST", bars)
        print(f"Regime: {result.regime}, Conf: {result.confidence}")
        
        # Should get boost
        self.assertGreaterEqual(result.confidence, 0.7)

if __name__ == '__main__':
    unittest.main()
