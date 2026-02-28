# QUANTCONNECT SPECIFIC IMPORTS
from AlgorithmImports import *
from adapter.snapshot_builder import SnapshotBuilder
from adapter.order_router import OrderRouter
from adapter.state_store import StateStore
from adapter.rolling_store import RollingStore

# SHARED LIBRARY
from autopilot_brain.decide import Brain
from autopilot_brain.brain_types import BrainState
import json

class AutopilotQC_v1(QCAlgorithm):
    def Initialize(self):
        self.SetStartDate(2023, 1, 1)
        self.SetEndDate(2023, 2, 1)
        self.SetCash(100000)
        
        # Universe
        self.tickers = ["SPY", "QQQ"] 
        self.symbols = [self.AddEquity(t, Resolution.Daily).Symbol for t in self.tickers]
        
        # Data Config
        # Option Universe Selection handled by AddOption logic or automatic universe
        # For V1-A Scaffold: Add options manually for the backtest targets
        for s in self.symbols:
             o = self.AddOption(s)
             o.SetFilter(minExpiry=timedelta(days=3), maxExpiry=timedelta(days=7)) 
        
        # Components
        self.rolling = RollingStore(self)
        self.state_store = StateStore(self.ObjectStore)
        self.snapshot_builder = SnapshotBuilder(self, self.rolling, self.state_store)
        self.order_router = OrderRouter(self, dry_run=True) # Dry run default
        
        # State
        self.brain_state = self.state_store.load() or BrainState()
        
        # Rolling Window Warmup (Phase 2)
        self.Log("Seeding History...")
        for ticker in self.tickers:
             # Get symbol
             self.rolling.seed_history(ticker)
             
        self.Log("History Seeded.")

        # Schedule
        # Times should match config.SCAN_TIMES
        #["09:45", "11:00", "14:00", "15:45"]
        self.Schedule.On(self.DateRules.EveryDay("SPY"), self.TimeRules.At(9, 45), self.RunCycle)
        self.Schedule.On(self.DateRules.EveryDay("SPY"), self.TimeRules.At(11, 0), self.RunCycle)
        self.Schedule.On(self.DateRules.EveryDay("SPY"), self.TimeRules.At(14, 0), self.RunCycle)
        self.Schedule.On(self.DateRules.EveryDay("SPY"), self.TimeRules.At(15, 45), self.RunCycle)

    def RunCycle(self):
        self.Log("Cycle Start")
        
        # Daily Reset Check
        today_str = self.Time.strftime("%Y-%m-%d")
        if self.brain_state.last_reset_date != today_str:
            self.brain_state.daily_trade_counter = 0
            self.brain_state.daily_scan_index = 0
            self.brain_state.last_reset_date = today_str
            self.Log(f"Daily Reset: {today_str}")
        
        # Increment Scan Index (1-based)
        self.brain_state.daily_scan_index += 1
        current_index = self.brain_state.daily_scan_index
        
        # 1. Build Snapshot
        snapshot = self.snapshot_builder.build(self.brain_state)
        
        # PROOF: Logging Markers for Real Engine Validation
        self.Log(f"SCAN_START: ScanIndex={current_index} Time={self.Time} Candidates={len(snapshot.options)}")
        
        # PROOF: Lookahead Check
        for t, und in snapshot.underlyings.items():
            last_date = "NONE"
            if und.bars_daily:
                # Log usage of Completed Bar
                last_bar = und.bars_daily[-1]
                last_date = last_bar.timestamp.date()
                # Strict Assertion Log
                if self.Time.date() <= last_date:
                    self.Error(f"LOOKAHEAD VIOLATION: Current={self.Time.date()} LastBar={last_date}")
            self.Log(f"DATA_PROOF: Ticker={t} CurrentDate={self.Time.date()} LastBarDate={last_date}")
        
        # 2. Brain Decide
        actions, new_state, explain = Brain.decide(snapshot, self.brain_state)
        
        # 3. Execute
        self.order_router.execute(actions)
        
        # 4. Persist
        self.brain_state = new_state
        self.state_store.save(self.brain_state)
        # write tape with deterministic index
        tape_key = self.state_store.write_tape_record(self.Time, actions, explain, current_index)
        self.Log(f"TAPE_WRITTEN: Key={tape_key} Actions={len(actions)}")
        
        self.Log(f"SCAN_END: ScanIndex={current_index}")

    def OnData(self, data):
        # Update rolling windows
        # Consolidator logic would go here if we used minute bars
        # For now, rolling store updates happen daily if we subscribe daily
        pass
