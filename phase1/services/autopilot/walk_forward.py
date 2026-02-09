"""
Walk-Forward Analysis & Stress Testing (Milestone 3)

Implements:
- Walk-forward optimization framework
- Train/test splits
- Performance metrics (Sharpe, MaxDD, etc.)
- Stress test scenarios
"""

import logging
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Tuple
from datetime import datetime, timedelta
import statistics

logger = logging.getLogger(__name__)

@dataclass
class PerformanceMetrics:
    """Comprehensive performance metrics."""
    # Returns
    total_return: float = 0.0
    annualized_return: float = 0.0
    
    # Risk
    max_drawdown: float = 0.0
    volatility: float = 0.0
    
    # Risk-adjusted
    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0
    calmar_ratio: float = 0.0
    
    # Trading
    total_trades: int = 0
    win_rate: float = 0.0
    avg_win: float = 0.0
    avg_loss: float = 0.0
    profit_factor: float = 0.0
    
    # Time
    avg_holding_time_minutes: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_return": f"{self.total_return:.2%}",
            "annualized_return": f"{self.annualized_return:.2%}",
            "max_drawdown": f"{self.max_drawdown:.2%}",
            "sharpe_ratio": f"{self.sharpe_ratio:.2f}",
            "sortino_ratio": f"{self.sortino_ratio:.2f}",
            "total_trades": self.total_trades,
            "win_rate": f"{self.win_rate:.1%}",
            "profit_factor": f"{self.profit_factor:.2f}",
        }

@dataclass
class WalkForwardWindow:
    """Single walk-forward window."""
    window_id: int
    train_start: datetime
    train_end: datetime
    test_start: datetime
    test_end: datetime
    
    # Results
    train_metrics: Optional[PerformanceMetrics] = None
    test_metrics: Optional[PerformanceMetrics] = None
    
    # Parameters selected during training
    selected_params: Dict[str, Any] = field(default_factory=dict)

class MetricsCalculator:
    """Calculate performance metrics from trade history."""
    
    @staticmethod
    def calculate(
        trades: List[Dict[str, Any]],
        equity_curve: List[Dict[str, Any]],
        start_equity: float,
        end_equity: float,
        days: int = 252,
    ) -> PerformanceMetrics:
        """Calculate all metrics from trade/equity data."""
        
        metrics = PerformanceMetrics()
        
        if not trades:
            return metrics
        
        # Basic returns
        metrics.total_return = (end_equity - start_equity) / start_equity
        
        # Win/loss stats
        pnls = [t.get("pnl", 0) for t in trades]
        winners = [p for p in pnls if p > 0]
        losers = [p for p in pnls if p < 0]
        
        metrics.total_trades = len(trades)
        metrics.win_rate = len(winners) / len(trades) if trades else 0
        metrics.avg_win = statistics.mean(winners) if winners else 0
        metrics.avg_loss = statistics.mean(losers) if losers else 0
        
        # Profit factor
        total_gross = sum(winners) if winners else 0
        total_loss = abs(sum(losers)) if losers else 1
        metrics.profit_factor = total_gross / total_loss if total_loss > 0 else 0
        
        # Max drawdown
        if equity_curve:
            equities = [e.get("equity", start_equity) for e in equity_curve]
            peak = start_equity
            max_dd = 0
            for eq in equities:
                if eq > peak:
                    peak = eq
                dd = (peak - eq) / peak
                max_dd = max(max_dd, dd)
            metrics.max_drawdown = max_dd
        
        # Volatility and Sharpe
        if len(equity_curve) > 1:
            # Daily returns
            equities = [e.get("equity", start_equity) for e in equity_curve]
            returns = [(equities[i] - equities[i-1]) / equities[i-1] 
                       for i in range(1, len(equities)) if equities[i-1] > 0]
            
            if returns:
                metrics.volatility = statistics.stdev(returns) if len(returns) > 1 else 0
                avg_ret = statistics.mean(returns)
                
                # Sharpe (assuming 0 risk-free rate)
                if metrics.volatility > 0:
                    metrics.sharpe_ratio = (avg_ret / metrics.volatility) * (252 ** 0.5)
                
                # Sortino (only downside deviation)
                downside = [r for r in returns if r < 0]
                if downside and len(downside) > 1:
                    downside_dev = statistics.stdev(downside)
                    if downside_dev > 0:
                        metrics.sortino_ratio = (avg_ret / downside_dev) * (252 ** 0.5)
        
        # Calmar ratio
        if metrics.max_drawdown > 0:
            metrics.calmar_ratio = metrics.annualized_return / metrics.max_drawdown
        
        # Average holding time
        holding_times = [t.get("holding_minutes", 0) for t in trades]
        if holding_times:
            metrics.avg_holding_time_minutes = statistics.mean(holding_times)
        
        return metrics

class WalkForwardAnalyzer:
    """
    Walk-forward analysis framework.
    
    Splits data into rolling train/test windows to validate
    strategy robustness out-of-sample.
    """
    
    def __init__(
        self,
        train_window_days: int = 60,
        test_window_days: int = 20,
        step_days: int = 20,
    ):
        self.train_days = train_window_days
        self.test_days = test_window_days
        self.step_days = step_days
        self._windows: List[WalkForwardWindow] = []
    
    def create_windows(
        self,
        start_date: datetime,
        end_date: datetime,
    ) -> List[WalkForwardWindow]:
        """Create walk-forward windows from date range."""
        windows = []
        
        current = start_date
        window_id = 0
        
        while current + timedelta(days=self.train_days + self.test_days) <= end_date:
            train_start = current
            train_end = current + timedelta(days=self.train_days)
            test_start = train_end
            test_end = test_start + timedelta(days=self.test_days)
            
            window = WalkForwardWindow(
                window_id=window_id,
                train_start=train_start,
                train_end=train_end,
                test_start=test_start,
                test_end=test_end,
            )
            windows.append(window)
            
            current += timedelta(days=self.step_days)
            window_id += 1
        
        self._windows = windows
        return windows
    
    def analyze_robustness(
        self,
        windows: List[WalkForwardWindow],
    ) -> Dict[str, Any]:
        """Analyze out-of-sample robustness."""
        
        if not windows:
            return {"robust": False, "reason": "No windows"}
        
        # Compare train vs test performance
        train_returns = []
        test_returns = []
        train_sharpes = []
        test_sharpes = []
        
        for w in windows:
            if w.train_metrics and w.test_metrics:
                train_returns.append(w.train_metrics.total_return)
                test_returns.append(w.test_metrics.total_return)
                train_sharpes.append(w.train_metrics.sharpe_ratio)
                test_sharpes.append(w.test_metrics.sharpe_ratio)
        
        if not test_returns:
            return {"robust": False, "reason": "No test data"}
        
        # Robustness checks
        avg_train_ret = statistics.mean(train_returns) if train_returns else 0
        avg_test_ret = statistics.mean(test_returns) if test_returns else 0
        
        # Test should be at least 50% of train performance
        performance_ratio = avg_test_ret / avg_train_ret if avg_train_ret != 0 else 0
        
        # Consistency: standard deviation of test returns
        test_std = statistics.stdev(test_returns) if len(test_returns) > 1 else float('inf')
        
        robust = performance_ratio > 0.5 and test_std < 0.3
        
        return {
            "robust": robust,
            "performance_ratio": performance_ratio,
            "avg_train_return": avg_train_ret,
            "avg_test_return": avg_test_ret,
            "test_consistency": test_std,
            "windows_analyzed": len(windows),
        }

@dataclass
class StressScenario:
    """Definition of a stress test scenario."""
    name: str
    description: str
    
    # Market conditions
    volatility_multiplier: float = 1.0
    spread_multiplier: float = 1.0
    liquidity_multiplier: float = 1.0
    gap_probability: float = 0.0
    
    # Slippage adjustments
    slippage_multiplier: float = 1.0
    fill_rate_multiplier: float = 1.0

# Pre-defined stress scenarios
STRESS_SCENARIOS = {
    "flash_crash": StressScenario(
        name="Flash Crash",
        description="Sudden 5%+ drop with dried up liquidity",
        volatility_multiplier=5.0,
        spread_multiplier=10.0,
        liquidity_multiplier=0.1,
        gap_probability=0.3,
        slippage_multiplier=5.0,
        fill_rate_multiplier=0.3,
    ),
    "liquidity_crisis": StressScenario(
        name="Liquidity Crisis",
        description="Gradual liquidity deterioration",
        volatility_multiplier=2.0,
        spread_multiplier=5.0,
        liquidity_multiplier=0.2,
        slippage_multiplier=3.0,
        fill_rate_multiplier=0.5,
    ),
    "earnings_shock": StressScenario(
        name="Earnings Shock",
        description="10%+ gap on earnings",
        volatility_multiplier=3.0,
        spread_multiplier=3.0,
        gap_probability=0.8,
        slippage_multiplier=2.0,
    ),
    "fed_announcement": StressScenario(
        name="Fed Announcement",
        description="High volatility around Fed decision",
        volatility_multiplier=2.5,
        spread_multiplier=2.0,
        slippage_multiplier=1.5,
    ),
}

class StressTester:
    """Run stress tests on strategy."""
    
    def __init__(self):
        self.scenarios = STRESS_SCENARIOS.copy()
    
    def run_scenario(
        self,
        scenario: StressScenario,
        trades: List[Dict[str, Any]],
        start_equity: float = 10000.0,
    ) -> Dict[str, Any]:
        """
        Run a stress scenario on historical trades.
        
        Adjusts PnL based on stress conditions.
        """
        adjusted_trades = []
        equity = start_equity
        
        for trade in trades:
            pnl = trade.get("pnl", 0)
            
            # Adjust for stress conditions
            if pnl < 0:
                # Losses are worse in stress
                adjusted_pnl = pnl * scenario.volatility_multiplier
            else:
                # Profits are harder to capture
                adjusted_pnl = pnl / scenario.slippage_multiplier
            
            # Random gap if applicable
            if scenario.gap_probability > 0:
                import random
                if random.random() < scenario.gap_probability:
                    # Simulate gap against position
                    gap_impact = -abs(pnl) * 0.5  # 50% additional loss
                    adjusted_pnl += gap_impact
            
            adjusted_trade = trade.copy()
            adjusted_trade["original_pnl"] = pnl
            adjusted_trade["stress_pnl"] = adjusted_pnl
            adjusted_trades.append(adjusted_trade)
            
            equity += adjusted_pnl
        
        # Calculate stressed metrics
        calculator = MetricsCalculator()
        stressed_pnls = [t["stress_pnl"] for t in adjusted_trades]
        
        max_dd = 0
        peak = start_equity
        running_eq = start_equity
        for pnl in stressed_pnls:
            running_eq += pnl
            if running_eq > peak:
                peak = running_eq
            dd = (peak - running_eq) / peak if peak > 0 else 0
            max_dd = max(max_dd, dd)
        
        return {
            "scenario": scenario.name,
            "original_trades": len(trades),
            "start_equity": start_equity,
            "end_equity": equity,
            "total_return": (equity - start_equity) / start_equity,
            "max_drawdown_stressed": max_dd,
            "survived": equity > start_equity * 0.5,  # Survived if >50% equity remains
        }
    
    def run_all(
        self,
        trades: List[Dict[str, Any]],
        start_equity: float = 10000.0,
    ) -> Dict[str, Dict[str, Any]]:
        """Run all stress scenarios."""
        results = {}
        
        for name, scenario in self.scenarios.items():
            results[name] = self.run_scenario(scenario, trades, start_equity)
        
        return results
