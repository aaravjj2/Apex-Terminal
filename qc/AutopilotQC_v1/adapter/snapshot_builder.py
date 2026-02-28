from autopilot_brain.brain_types import (
    Snapshot, RiskCounters, OptionContract, OptionRight, Bar, 
    UnderlyingSnapshot, PositionView
)
from autopilot_brain.config import TARGET_UNDERLYINGS
from datetime import datetime, timedelta
from .contract_id import ContractIdManager
from AlgorithmImports import SecurityType

class SnapshotBuilder:
    def __init__(self, algo, rolling_store, state_store):
        self.algo = algo
        self.rolling = rolling_store
        self.state_store = state_store
        self.id_mgr = ContractIdManager(algo)
        self.runtime_symbol_map = {} # Canonical -> QC Symbol (refresh each cycle)

    def on_data(self, data):
        """Ingest daily bars if available."""
        # Explicitly forward Bars to RollingStore
        # Only process Equity bars (Underlyings)
        for ticker in self.algo.tickers:
            # Assuming tickers match Symbols added to algo.tickers list
            # We need the actual QC Symbol object to lookup in data
            # Use algo.Securities[ticker].Symbol
            sym = self.algo.Securities[ticker].Symbol
            if data.ContainsKey(sym):
                bar = data[sym]
                self.rolling.add(ticker, bar)

    def build(self, brain_state) -> Snapshot:
        self.runtime_symbol_map = {} # Clear map
        
        # 1. Underlyings & Rolling Bars
        underlyings = {}
        for ticker in self.algo.tickers:
            qc_symbol = self.algo.Securities[ticker].Symbol
            try:
                # Get History
                bars = self.rolling.get_history(ticker)
                
                # CURRENT price (most recent tick/bar)
                last_price = float(self.algo.Securities[ticker].Price)
                
                underlyings[ticker] = UnderlyingSnapshot(
                    ticker=ticker,
                    last_price=last_price,
                    bars_daily=bars
                )
            except Exception as e:
                self.algo.Log(f"SnapshotBuilder Error {ticker}: {e}")
            
        # 2. Options (Chain Pull)
        options = []
        for ticker in self.algo.tickers:
             # Get Chain
             chain = self.algo.OptionChainProvider.GetOptionContractList(self.algo.Securities[ticker].Symbol, self.algo.Time)
             
             # Filter V1-A: 3-7 DTE (Business Days approx or Calendar?)
             # Config says "weekly_expiry_only=True" in original, V1-A docs say 3-7 DTE.
             # Strict Calendar DTE check.
             
             current_date = self.algo.Time.date()
             
             valid_expiry = []
             for s in chain:
                 # PH0-1: Precise DTE (Exchange Timezone implied by Algo Time)
                 # Ensure strictly date-based difference
                 expiry_date = s.ID.Date.date()
                 dte = (expiry_date - current_date).days
                 
                 # Strict V1-A: 3 <= DTE <= 7
                 if 3 <= dte <= 7:
                     valid_expiry.append(s)
             
             for sym in valid_expiry:
                 # Deterministic Filter: Strike Band (+- 5% ATM) to reduce calls
                 strike = float(sym.ID.StrikePrice)
                 und_price = underlyings[ticker].last_price
                 if und_price == 0: continue # Safety
                 
                 if not (und_price * 0.95 <= strike <= und_price * 1.05):
                     continue
                 
                 # QUOTE HYGIENE
                 # Retrieve current quote if available
                 sec = self.algo.Securities.get(sym)
                 if sec:
                     bid = float(sec.BidPrice)
                     ask = float(sec.AskPrice)
                     
                     # REJECT: Zero Bid or Invalid Spread
                     if bid < 0.05: continue 
                     if ask <= bid: continue
                     
                     mid = (bid + ask) / 2
                 else:
                     # If not in Securities, we have no data. Skip.
                     # (Unless we specifically added it and waiting for OnData)
                     continue
                     
                 # Canonical ID
                 cid = self.id_mgr.to_canonical(sym)
                 self.runtime_symbol_map[cid] = sym
                 
                 opt = OptionContract(
                     contract_id=cid,
                     underlying=ticker,
                     expiry=sym.ID.Date,
                     strike=strike,
                     right="CALL" if sym.ID.OptionRight == 0 else "PUT", # Verify enum
                     bid=bid,
                     ask=ask,
                     mid=mid,
                     delta=None # Optional
                 )
                 options.append(opt)
        
        # DETERMINISTIC SORT
        # Key: Underlying, Expiry, Right, Strike
        options.sort(key=lambda x: (
            x.underlying, 
            x.expiry.isoformat(), 
            x.right, 
            x.strike,
            x.contract_id
        ))

        # 3. Positions
        positions = []
        possible_holdings = [kvp for kvp in self.algo.Portfolio if kvp.Value.Invested]
        # Sort holdings deterministically
        possible_holdings.sort(key=lambda x: x.Key.ToString())
        
        for kvp in possible_holdings:
            sym = kvp.Key
            holding = kvp.Value
            if sym.SecurityType == SecurityType.Option:
                 cid = self.id_mgr.to_canonical(sym)
                 self.runtime_symbol_map[cid] = sym
                 
                 # Get meta from brain_state
                 meta = brain_state.position_meta.get(cid, {})
                 
                 pos = PositionView(
                     contract_id=cid,
                     qty=int(holding.Quantity),
                     entry_debit=float(holding.AveragePrice), # Approx
                     current_mid=float(self.algo.Securities[sym].Price),
                     dte=(sym.ID.Date.date() - self.algo.Time.date()).days,
                     unrealized_pnl_pct=float(holding.UnrealizedProfitPercent),
                     meta=meta if isinstance(meta, dict) else meta.__dict__
                 )
                 positions.append(pos)
                 
        # 4. Risk
        risk = RiskCounters(
            open_positions_count=len(positions),
            premium_exposure_used=sum(abs(p.qty * p.entry_debit * 100) for p in positions), # Approx
            trades_taken_today=brain_state.daily_trade_counter,
            kill_switch=False
        )
        
        return Snapshot(
            cycle_time=self.algo.Time,
            minutes_to_close=390, # Placeholder
            is_market_open=self.algo.IsMarketOpen(self.algo.tickers[0]),
            underlyings=underlyings,
            options=options,
            positions=positions,
            risk=risk
        )
