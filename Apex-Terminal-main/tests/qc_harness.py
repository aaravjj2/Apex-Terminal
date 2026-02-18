import sys
import unittest
from datetime import datetime, timedelta
# Mock QC imports
from dataclasses import dataclass, field
from typing import Dict, List, Any

# ==============================================================================
# MOCKS
# ==============================================================================

class Resolution:
    Daily = "Daily"
    Minute = "Minute"

class SecurityType:
    Option = "Option"
    Equity = "Equity"

class OptionRight:
    Call = 0
    Put = 1

@dataclass
class SymbolID:
    Date: datetime
    StrikePrice: float
    OptionRight: int
    def ToString(self): return f"ID:{self.StrikePrice}"

@dataclass(frozen=True)
class Symbol:
    Value: str
    ID: SymbolID = None
    SecurityType: str = SecurityType.Equity
    def ToString(self): return self.Value

@dataclass
class Security:
    Symbol: Symbol
    Price: float = 100.0
    BidPrice: float = 99.0
    AskPrice: float = 101.0
    
@dataclass
class Holding:
    Invested: bool = False
    Quantity: float = 0
    AveragePrice: float = 0
    UnrealizedProfitPercent: float = 0.0

class ObjectStoreMock:
    def __init__(self):
        self.data = {}
    def ContainsKey(self, key): return key in self.data
    def SaveBytes(self, key, val): self.data[key] = val
    def ReadBytes(self, key): return self.data[key]
    def SaveString(self, key, val): self.data[key] = val.encode('utf-8')

class OptionChainProviderMock:
    def GetOptionContractList(self, symbol, time):
        # Return fake list of Symbols
        expiry = time + timedelta(days=5) # 5 DTE
        s1 = Symbol("SPY_OPT_1", SymbolID(expiry, 400.0, OptionRight.Call), SecurityType.Option)
        s2 = Symbol("SPY_OPT_2", SymbolID(expiry, 390.0, OptionRight.Put), SecurityType.Option)
        return [s1, s2]

class MockOption:
    def SetFilter(self, minExpiry, maxExpiry): pass
    
class DateRulesMock:
    def EveryDay(self, t): return "EveryDay"

class TimeRulesMock:
    def At(self, h, m): return f"{h}:{m}"

class ScheduleMock:
    def On(self, d, t, func): pass

class QCAlgorithmMock:
    def __init__(self):
        self.Time = datetime(2023, 1, 1, 9, 30)
        self.Portfolio = {} 
        self.Securities = {} 
        self.tickers = []
        self.ObjectStore = ObjectStoreMock()
        self.OptionChainProvider = OptionChainProviderMock()
        self.symbols = []
        self.logs = []
        self.history_calls = 0
        self.DateRules = DateRulesMock()
        self.TimeRules = TimeRulesMock()
        self.Schedule = ScheduleMock()
        
    def Log(self, msg):
        self.logs.append(msg)
        
    def SetStartDate(self, y, m, d): pass
    def SetEndDate(self, y, m, d): pass
    def SetCash(self, amount): pass
        
    def AddEquity(self, ticker, res):
        s = Symbol(ticker)
        self.Securities[ticker] = Security(s) # Access via string in Main mock logic
        # Also via symbol
        self.Securities[s] = self.Securities[ticker]
        self.history_calls = 0
        self.DateRules = DateRulesMock()
        self.TimeRules = TimeRulesMock()
        self.Schedule = ScheduleMock()
        
    def Log(self, msg):
        self.logs.append(msg)
        
    def SetStartDate(self, y, m, d): pass
    def SetEndDate(self, y, m, d): pass
    def SetCash(self, amount): pass
        
    def AddEquity(self, ticker, res):
        s = Symbol(ticker)
        self.Securities[ticker] = Security(s) # Access via string in Main mock logic
        # Also via symbol
        self.Securities[s] = self.Securities[ticker]
        return self.Securities[ticker]
        
    def AddOption(self, underlying_symbol):
        return MockOption()
        
    def History(self, symbol, period, res):
        self.history_calls += 1
        # Return empty DF-like mock
        import pandas as pd
        return pd.DataFrame()
        
    def IsMarketOpen(self, ticker): return True
    
    def MarketOrder(self, symbol, qty, async_, tag=""):
        self.Log(f"ORDER: {symbol.Value} {qty} {tag}")

# ==============================================================================
# INJECT MOCKS TO SYS MODULES
# ==============================================================================
# We need `AlgorithmImports` to be importable by main.py
module_name = "AlgorithmImports"
if module_name not in sys.modules:
    mod = type(sys)("AlgorithmImports")
    mod.QCAlgorithm = QCAlgorithmMock
    mod.Resolution = Resolution
    mod.SecurityType = SecurityType
    mod.OptionRight = OptionRight
    mod.timedelta = timedelta # re-export
    sys.modules[module_name] = mod

# ==============================================================================
# HARNESS
# ==============================================================================

class ValidationTest(unittest.TestCase):
    def test_end_to_end_flow(self):
        # Fix path to allow importing qc.AutopilotQC_v1.main
        import os
        base_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        if base_path not in sys.path:
            sys.path.insert(0, base_path)
            
        # Also need 'qc' module to resolve if it's not a package?
        # Manually import by path if easier, or assume qc is in base_path (it is).
        # But 'qc' is a folder. 'AutopilotQC_v1' is a folder. 
        # So 'from qc.AutopilotQC_v1.main' requires qc/__init__.py and qc/AutopilotQC_v1/__init__.py.
        # Since they likely don't exist in scaffold, we use direct file path import trick or append the folder specifically.
        
        qc_algo_path = os.path.join(base_path, "qc", "AutopilotQC_v1")
        if qc_algo_path not in sys.path:
            sys.path.insert(0, qc_algo_path)
            
        import main
        from main import AutopilotQC_v1
        
        algo = AutopilotQC_v1()
        algo.Initialize()
        
        # 1. Warmup Check
        # Verify ticker added
        self.assertTrue("SPY" in algo.tickers)
        
        # 2. Inject Fake Data for RollingStore
        # Manually add to rolling store since no History
        from autopilot_brain.types import Bar
        b = Bar(algo.Time, 100, 101, 99, 100, 1000)
        algo.rolling.add("SPY", type('M',(),{'Time':algo.Time, 'Open':100,'High':101,'Low':99,'Close':100,'Volume':1000}))
        
        # 3. Trigger Cycle
        algo.RunCycle()
        
        # 4. Verify Tape (New Deterministic Key)
        # scan_index starts at 1
        tape_key = f"tape/2023-01-01/scan-0001.json"
        self.assertTrue(algo.ObjectStore.ContainsKey(tape_key), f"Tape key {tape_key} missing. Keys: {list(algo.ObjectStore.data.keys())}")
        
        # Verify Content
        import json
        tape_json = json.loads(algo.ObjectStore.data[tape_key].decode('utf-8'))
        self.assertEqual(tape_json['scan_index'], 1)
        # Mock returned 2 opts, filter might pass 1. Just check field existence.
        self.assertIn('candidate_count', tape_json)
        
        # 5. Verify Dry Run (No Orders Logged if Dry Run True)
        # Check logs
        order_logs = [l for l in algo.logs if "ORDER:" in l]
        self.assertEqual(len(order_logs), 0, f"Orders found in dry run: {order_logs}")
        
        # 6. Verify Log Output (Proof of Lookahead Check)
        self.assertTrue(any("DataProof" in l for l in algo.logs))
        self.assertTrue(any("Cycle End" in l for l in algo.logs))

if __name__ == '__main__':
    unittest.main()
