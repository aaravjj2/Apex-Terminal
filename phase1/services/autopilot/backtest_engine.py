"""
Backtest Simulation Engine (Milestone 3)

Enables backtesting with:
- Historical bar replay
- Slippage modeling
- Fill probability
- Same pipeline, different clock

Core principle: If you backtest with perfect fills, you are lying to yourself.
"""

import logging
from enum import Enum
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Callable, Generator
from datetime import datetime, timedelta, timezone
import random

logger = logging.getLogger(__name__)

class TimeOfDay(str, Enum):
    """Time of day buckets for slippage adjustment."""
    OPEN = "open"       # First 30 min
    MID_MORNING = "mid_morning"
    MIDDAY = "midday"
    AFTERNOON = "afternoon"
    CLOSE = "close"     # Last 30 min

@dataclass
class SlippageConfig:
    """Configuration for slippage model."""
    base_slippage_pct: float = 0.002  # 0.2% base
    
    # Time-of-day multipliers
    open_multiplier: float = 2.0      # 2x at open
    close_multiplier: float = 1.5     # 1.5x at close
    
    # Spread-based adjustments
    spread_factor: float = 0.5        # Fill at N% into spread
    wide_spread_threshold: float = 0.05  # >5% spread = wide
    wide_spread_penalty: float = 0.01    # Extra 1% slippage
    
    # Liquidity adjustments
    low_liquidity_threshold: float = 100  # OI < 100 = illiquid
    low_liquidity_penalty: float = 0.02   # Extra 2% slippage

@dataclass
class FillResult:
    """Result of simulated fill."""
    filled: bool
    fill_price: float
    slippage_bps: float  # Basis points of slippage
    fill_probability: float
    reason: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "filled": self.filled,
            "fill_price": self.fill_price,
            "slippage_bps": self.slippage_bps,
            "fill_probability": self.fill_probability,
            "reason": self.reason,
        }

class SlippageModel:
    """
    Realistic slippage model for options backtesting.
    """
    
    def __init__(self, config: Optional[SlippageConfig] = None, seed: int = 42):
        self.config = config or SlippageConfig()
        self.rng = random.Random(seed)  # Deterministic randomness
    
    def calculate_fill(
        self,
        order_side: str,  # "buy" or "sell"
        limit_price: float,
        bid: float,
        ask: float,
        timestamp: datetime,
        open_interest: int = 500,
    ) -> FillResult:
        """
        Calculate simulated fill with slippage.
        """
        spread = ask - bid
        spread_pct = spread / ((bid + ask) / 2) if (bid + ask) > 0 else 0
        mid = (bid + ask) / 2
        
        # Determine time of day
        hour = timestamp.hour
        minute = timestamp.minute
        time_minutes = hour * 60 + minute
        
        # Market hours: 9:30 AM - 4:00 PM ET (570 - 960 minutes)
        market_open = 9 * 60 + 30
        market_close = 16 * 60
        
        if time_minutes < market_open + 30:
            tod = TimeOfDay.OPEN
            time_mult = self.config.open_multiplier
        elif time_minutes > market_close - 30:
            tod = TimeOfDay.CLOSE
            time_mult = self.config.close_multiplier
        else:
            tod = TimeOfDay.MIDDAY
            time_mult = 1.0
        
        # Calculate base slippage
        slippage = self.config.base_slippage_pct * time_mult
        
        # Wide spread penalty
        if spread_pct > self.config.wide_spread_threshold:
            slippage += self.config.wide_spread_penalty
        
        # Low liquidity penalty
        if open_interest < self.config.low_liquidity_threshold:
            slippage += self.config.low_liquidity_penalty
        
        # Calculate fill price
        if order_side == "buy":
            # Buyer pays more than mid
            fill_price = mid + (spread * self.config.spread_factor)
            fill_price *= (1 + slippage)
            
            # Check if limit would fill
            filled = limit_price >= fill_price
        else:
            # Seller gets less than mid
            fill_price = mid - (spread * self.config.spread_factor)
            fill_price *= (1 - slippage)
            
            # Check if limit would fill
            filled = limit_price <= fill_price
        
        # Add small random noise (deterministic based on seed)
        noise = self.rng.gauss(0, spread * 0.1)
        fill_price += noise
        
        # Calculate fill probability
        fill_prob = self._calculate_fill_probability(
            order_side, limit_price, bid, ask, open_interest
        )
        
        # Probabilistic fill (for realistic modeling)
        if filled and self.rng.random() > fill_prob:
            filled = False
        
        slippage_bps = abs(fill_price - mid) / mid * 10000 if mid > 0 else 0
        
        return FillResult(
            filled=filled,
            fill_price=round(fill_price, 2),
            slippage_bps=slippage_bps,
            fill_probability=fill_prob,
            reason=f"TOD={tod.value}, spread={spread_pct:.2%}, OI={open_interest}",
        )
    
    def _calculate_fill_probability(
        self,
        order_side: str,
        limit_price: float,
        bid: float,
        ask: float,
        open_interest: int,
    ) -> float:
        """Calculate probability of fill."""
        spread = ask - bid
        mid = (bid + ask) / 2
        
        if order_side == "buy":
            # How aggressive is the limit?
            aggressiveness = (limit_price - bid) / spread if spread > 0 else 0.5
        else:
            aggressiveness = (ask - limit_price) / spread if spread > 0 else 0.5
        
        # Base probability from aggressiveness
        base_prob = min(1.0, max(0.1, aggressiveness))
        
        # Liquidity adjustment
        if open_interest < 50:
            base_prob *= 0.5
        elif open_interest < 100:
            base_prob *= 0.7
        elif open_interest > 1000:
            base_prob *= 1.1
        
        return min(1.0, base_prob)

@dataclass
class BacktestBar:
    """Single bar in backtest."""
    timestamp: datetime
    symbol: str
    open: float
    high: float
    low: float
    close: float
    volume: int
    
    # Options-specific
    bid: Optional[float] = None
    ask: Optional[float] = None
    open_interest: Optional[int] = None

class BacktestEngine:
    """
    Main backtest engine.
    
    Replays historical data through the same decision pipeline
    used in live trading.
    """
    
    def __init__(
        self,
        slippage_model: Optional[SlippageModel] = None,
        bar_interval_minutes: int = 5,
    ):
        self.slippage = slippage_model or SlippageModel()
        self.bar_interval = bar_interval_minutes
        
        # State
        self._current_time: Optional[datetime] = None
        self._position: Optional[Dict[str, Any]] = None
        self._trades: List[Dict[str, Any]] = []
        self._equity_curve: List[Dict[str, Any]] = []
        
    def run(
        self,
        bars: List[BacktestBar],
        decision_fn: Callable,  # async fn(symbol, price, bars) -> DecisionResult
        start_equity: float = 10000.0,
    ) -> Dict[str, Any]:
        """
        Run backtest over historical bars.
        
        Args:
            bars: List of BacktestBar (chronological order)
            decision_fn: Decision function (same as live)
            start_equity: Starting account equity
            
        Returns:
            Backtest results with metrics
        """
        import asyncio
        
        equity = start_equity
        self._trades = []
        self._equity_curve = []
        
        # Group bars by timestamp
        bar_groups = self._group_bars_by_time(bars)
        
        for timestamp, bar_group in bar_groups.items():
            self._current_time = timestamp
            
            # Get primary symbol bar (e.g., SPY)
            primary_bar = bar_group.get("SPY") or list(bar_group.values())[0]
            
            # Build context
            recent_bars = self._get_recent_bars(bars, timestamp, count=50)
            
            # Call decision function
            loop = asyncio.new_event_loop()
            try:
                # In real implementation, decision_fn would be async
                # For now, simulate synchronous call
                pass
            finally:
                loop.close()
            
            # Record equity
            self._equity_curve.append({
                "timestamp": timestamp.isoformat(),
                "equity": equity,
            })
        
        # Calculate metrics
        metrics = self._calculate_metrics(start_equity, equity)
        
        return {
            "start_equity": start_equity,
            "end_equity": equity,
            "trades": self._trades,
            "equity_curve": self._equity_curve,
            "metrics": metrics,
        }
    
    def _group_bars_by_time(
        self, bars: List[BacktestBar]
    ) -> Dict[datetime, Dict[str, BacktestBar]]:
        """Group bars by timestamp."""
        groups = {}
        for bar in bars:
            if bar.timestamp not in groups:
                groups[bar.timestamp] = {}
            groups[bar.timestamp][bar.symbol] = bar
        return dict(sorted(groups.items()))
    
    def _get_recent_bars(
        self, 
        all_bars: List[BacktestBar],
        current_time: datetime,
        count: int,
    ) -> List[Dict[str, Any]]:
        """Get recent bars before current time."""
        recent = [
            {
                "open": b.open,
                "high": b.high,
                "low": b.low,
                "close": b.close,
                "volume": b.volume,
            }
            for b in all_bars
            if b.timestamp < current_time
        ]
        return recent[-count:]
    
    def _calculate_metrics(
        self, 
        start_equity: float,
        end_equity: float,
    ) -> Dict[str, Any]:
        """Calculate backtest performance metrics."""
        total_return = (end_equity - start_equity) / start_equity
        
        if not self._trades:
            return {
                "total_return": total_return,
                "total_trades": 0,
                "win_rate": 0.0,
                "avg_pnl": 0.0,
                "max_drawdown": 0.0,
                "sharpe_ratio": 0.0,
            }
        
        # Win rate
        winners = [t for t in self._trades if t.get("pnl", 0) > 0]
        win_rate = len(winners) / len(self._trades)
        
        # Average PnL
        pnls = [t.get("pnl", 0) for t in self._trades]
        avg_pnl = sum(pnls) / len(pnls)
        
        # Max drawdown from equity curve
        max_dd = 0.0
        peak = start_equity
        for point in self._equity_curve:
            equity = point["equity"]
            if equity > peak:
                peak = equity
            dd = (peak - equity) / peak
            max_dd = max(max_dd, dd)
        
        return {
            "total_return": total_return,
            "total_trades": len(self._trades),
            "win_rate": win_rate,
            "avg_pnl": avg_pnl,
            "max_drawdown": max_dd,
            "sharpe_ratio": 0.0,  # Would need daily returns
        }
