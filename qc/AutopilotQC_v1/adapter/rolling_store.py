from collections import deque
from autopilot_brain.brain_types import Bar
from datetime import datetime, timedelta
from AlgorithmImports import Resolution

class RollingStore:
    """
    Maintains rolling 60 daily bars per symbol.
    Seeded once at Initialize(); updated incrementally.
    STRICT: Only accepts completed daily bars.
    """
    def __init__(self, algo, window_size=60):
        self.algo = algo
        self.window_size = window_size
        # Map Symbol -> Deque[Bar]
        self._windows = {} 
        self._last_bar_time = {} # Symbol -> datetime
        
    def add(self, symbol, bar):
        """Add a complete daily bar."""
        # Safety Check: Deduplication & Resolution
        if symbol not in self._last_bar_time:
            self._last_bar_time[symbol] = None
        
        # QC Daily Bar Rule: 
        # Bar emitted at 00:00 T+1 represents trading on T.
        # We must ensure we are not peeking at a bar that closes "today" (if backtest allows it).
        # But stronger: just ensure we don't add the same time twice.
        if self._last_bar_time[symbol] == bar.Time:
            return
            
        self._last_bar_time[symbol] = bar.Time
        
        # Convert & Store
        b = Bar(
            timestamp=bar.Time,
            open=float(bar.Open),
            high=float(bar.High),
            low=float(bar.Low),
            close=float(bar.Close),
            volume=float(bar.Volume)
        )
        
        if symbol not in self._windows:
            self._windows[symbol] = deque(maxlen=self.window_size)
            
        self._windows[symbol].append(b)
        last_time = self._last_bar_time.get(symbol)
        if last_time and bar.Time <= last_time:
            return # Duplicate or out of order
            
        self._last_bar_time[symbol] = bar.Time
        
        # Convert QC TradeBar to Brain Bar
        brain_bar = Bar(
            timestamp=bar.Time,
            open=float(bar.Open),
            high=float(bar.High),
            low=float(bar.Low),
            close=float(bar.Close),
            volume=float(bar.Volume)
        )
        self._windows[symbol].append(brain_bar)
        
    def get_history(self, symbol) -> list:
        if symbol in self._windows:
            return list(self._windows[symbol])
        return []
    
    def is_ready(self, symbol) -> bool:
        """Check if we have enough bars (e.g. at least 20 for features)."""
        if symbol not in self._windows:
            return False
        return len(self._windows[symbol]) >= 20
        
    def seed_history(self, symbol):
        """Fetch history ONCE to seed the window."""
        # Guard: Check run status? No, only Initialize.
        
        # Use QC History
        bars = self.algo.History(symbol, self.window_size, Resolution.Daily)
        if not bars.empty:
             # Handle DF index intricacies (Symbol, Time) vs Time
             # Reset index to access time column if multi-index
             df = bars.loc[symbol] if 'symbol' in bars.index.names else bars
             
             for idx, row in df.iterrows():
                 try:
                    ts = idx if isinstance(idx, datetime) else row.name
                    
                    b = Bar(
                        timestamp=ts,
                        open=float(row.open),
                        high=float(row.high),
                        low=float(row.low),
                        close=float(row.close),
                        volume=float(row.volume)
                    )
                    
                    self.add(symbol, type('MockBar', (), {
                        'Time': ts, 
                        'Open': b.open, 
                        'High': b.high, 
                        'Low': b.low, 
                        'Close': b.close, 
                        'Volume': b.volume
                    }))
                 except Exception as e:
                     self.algo.Log(f"RollingStore Seed Error {symbol}: {e}")
        else:
            self.algo.Log(f"RollingStore: No history for {symbol}")
