"""
Deterministic Backtest Engine v1
Supports: SMA/EMA/RSI indicators, simple crossover and threshold strategies
"""

from typing import List, Dict, Optional
from datetime import datetime
import hashlib
import json
import uuid
import numpy as np

from .models import (
    BacktestConfig, BacktestRun, BacktestStatus, TradeFill, Side,
    BacktestMetrics, EquityPoint
)
from .fixtures import get_demo_bars
from ..strategy_lab.models import StrategyDefinition
from ..strategy_lab.storage import get_storage as get_strategy_storage


class BacktestEngine:
    """
    Deterministic bar-based backtest engine.
    Version 1: Supports long-only equity strategies with simple indicators.
    """
    
    def __init__(self):
        self.strategy_storage = get_strategy_storage()
    
    def run_backtest(self, config: BacktestConfig) -> BacktestRun:
        """
        Run a complete backtest and return results.
        Deterministic: same config + seed = same results.
        """
        # Generate run ID
        run_id = f"run-{uuid.uuid4().hex[:12]}"
        
        # Calculate config hash for determinism tracking
        config_hash = self._calc_config_hash(config)
        
        # Create run object
        run = BacktestRun(
            run_id=run_id,
            config=config,
            status=BacktestStatus.RUNNING,
            config_hash=config_hash,
            trades=[],
            equity_curve=[],
            started_at=datetime.utcnow()
        )
        
        try:
            # Load strategy (with demo fallback for any strategy_id)
            strategy = self.strategy_storage.get(config.strategy_id)
            if not strategy:
                # Demo fallback: create a default SMA crossover strategy
                # This allows any strategy_id from the strategies API to work
                strategy = StrategyDefinition(
                    id=config.strategy_id,
                    name=config.strategy_id,
                    description="Auto-generated fallback strategy for demo mode",
                    strategy_type="crossover",
                    indicators=[
                        {"type": "SMA", "params": {"period": 20}},
                        {"type": "SMA", "params": {"period": 50}}
                    ],
                    entry_condition={
                        "condition_type": "cross_above",
                        "indicator": "SMA_20",
                        "reference_indicator": "SMA_50"
                    },
                    exit_condition={
                        "condition_type": "cross_below",
                        "indicator": "SMA_20",
                        "reference_indicator": "SMA_50"
                    },
                    stop_loss_pct=2.0,
                    take_profit_pct=5.0,
                    tags=["demo", "fallback"],
                )
            
            # Get bar data
            bars = get_demo_bars(
                config.symbol,
                config.start_date.isoformat(),
                config.end_date.isoformat(),
                config.seed
            )
            
            if not bars:
                raise ValueError("No bar data available for date range")
            
            # Run simulation
            trades, equity_curve = self._simulate(strategy, config, bars)
            
            # Calculate metrics
            metrics = self._calculate_metrics(trades, equity_curve, config.initial_capital)
            
            # Update run
            run.trades = trades
            run.equity_curve = equity_curve
            run.metrics = metrics
            run.status = BacktestStatus.COMPLETED
            run.completed_at = datetime.utcnow()
            
        except Exception as e:
            run.status = BacktestStatus.FAILED
            run.error = str(e)
            run.completed_at = datetime.utcnow()
        
        return run
    
    def _calc_config_hash(self, config: BacktestConfig) -> str:
        """Calculate deterministic hash of config"""
        config_dict = config.model_dump(mode='json')  # Converts dates to strings
        config_str = json.dumps(config_dict, sort_keys=True)
        hash_obj = hashlib.sha256(config_str.encode())
        return hash_obj.hexdigest()
    
    def _simulate(self, strategy: StrategyDefinition, config: BacktestConfig, bars: List[Dict]) -> tuple:
        """
        Core simulation loop.
        Returns: (trades, equity_curve)
        """
        trades: List[TradeFill] = []
        equity_curve: List[EquityPoint] = []
        
        # Initialize position tracking
        position = 0.0  # Current position size
        entry_price = 0.0
        cash = config.initial_capital
        equity = cash
        
        # Calculate indicators
        indicators = self._calculate_indicators(strategy, bars)
        
        # Simulate bar by bar
        for i, bar in enumerate(bars):
            timestamp = bar["timestamp"]
            close = bar["close"]
            
            # Get indicator values at this bar
            ind_values = {name: vals[i] if i < len(vals) else None 
                          for name, vals in indicators.items()}
            
            # Check for signals
            if position == 0:
                # Check entry
                if self._check_entry_signal(strategy, ind_values, close):
                    # Enter position
                    shares = int(cash * 0.95 / close)  # Use 95% of cash
                    if shares > 0:
                        cost = shares * close * (1 + config.slippage_bps / 10000) + config.fee_per_trade
                        if cost <= cash:
                            position = shares
                            entry_price = close
                            cash -= cost
                            
                            trade = TradeFill(
                                trade_id=f"trade-{len(trades)+1:03d}",
                                timestamp=timestamp,
                                symbol=config.symbol,
                                side=Side.BUY,
                                quantity=shares,
                                price=close,
                                fees=config.fee_per_trade
                            )
                            trades.append(trade)
            else:
                # Check exit
                if self._check_exit_signal(strategy, ind_values, close, entry_price):
                    # Exit position
                    proceeds = position * close * (1 - config.slippage_bps / 10000) - config.fee_per_trade
                    pnl = proceeds - (position * entry_price)
                    cash += proceeds
                    
                    trade = TradeFill(
                        trade_id=f"trade-{len(trades)+1:03d}",
                        timestamp=timestamp,
                        symbol=config.symbol,
                        side=Side.SELL,
                        quantity=position,
                        price=close,
                        fees=config.fee_per_trade,
                        pnl=pnl
                    )
                    trades.append(trade)
                    
                    position = 0.0
                    entry_price = 0.0
            
            # Calculate equity
            equity = cash + (position * close if position > 0 else 0)
            equity_curve.append(EquityPoint(timestamp=timestamp, equity=equity))
        
        # Close any open position at end
        if position > 0:
            close = bars[-1]["close"]
            timestamp = bars[-1]["timestamp"]
            proceeds = position * close * (1 - config.slippage_bps / 10000) - config.fee_per_trade
            pnl = proceeds - (position * entry_price)
            cash += proceeds
            
            trade = TradeFill(
                trade_id=f"trade-{len(trades)+1:03d}",
                timestamp=timestamp,
                symbol=config.symbol,
                side=Side.SELL,
                quantity=position,
                price=close,
                fees=config.fee_per_trade,
                pnl=pnl
            )
            trades.append(trade)
        
        return trades, equity_curve
    
    def _calculate_indicators(self, strategy: StrategyDefinition, bars: List[Dict]) -> Dict[str, List[float]]:
        """Calculate all indicators needed for strategy"""
        close_prices = np.array([b["close"] for b in bars])
        indicators = {}
        
        for ind_config in strategy.indicators:
            ind_type = ind_config.type
            params = ind_config.params
            
            if ind_type == "SMA":
                period = params.get("period", 20)
                values = self._calc_sma(close_prices, period)
                indicators[f"SMA_{period}"] = values.tolist()
            
            elif ind_type == "EMA":
                period = params.get("period", 20)
                values = self._calc_ema(close_prices, period)
                indicators[f"EMA_{period}"] = values.tolist()
            
            elif ind_type == "RSI":
                period = params.get("period", 14)
                values = self._calc_rsi(close_prices, period)
                indicators[f"RSI_{period}"] = values.tolist()
        
        return indicators
    
    def _calc_sma(self, prices: np.ndarray, period: int) -> np.ndarray:
        """Calculate Simple Moving Average"""
        sma = np.full(len(prices), np.nan)
        for i in range(period - 1, len(prices)):
            sma[i] = np.mean(prices[i - period + 1:i + 1])
        return sma
    
    def _calc_ema(self, prices: np.ndarray, period: int) -> np.ndarray:
        """Calculate Exponential Moving Average"""
        ema = np.full(len(prices), np.nan)
        multiplier = 2 / (period + 1)
        
        # Start with SMA
        ema[period - 1] = np.mean(prices[:period])
        
        for i in range(period, len(prices)):
            ema[i] = (prices[i] * multiplier) + (ema[i - 1] * (1 - multiplier))
        
        return ema
    
    def _calc_rsi(self, prices: np.ndarray, period: int = 14) -> np.ndarray:
        """Calculate Relative Strength Index"""
        rsi = np.full(len(prices), np.nan)
        deltas = np.diff(prices)
        
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)
        
        avg_gain = np.mean(gains[:period])
        avg_loss = np.mean(losses[:period])
        
        for i in range(period, len(prices)):
            if avg_loss == 0:
                rsi[i] = 100
            else:
                rs = avg_gain / avg_loss
                rsi[i] = 100 - (100 / (1 + rs))
            
            # Update averages
            if i < len(deltas):
                avg_gain = (avg_gain * (period - 1) + gains[i]) / period
                avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        
        return rsi
    
    def _check_entry_signal(self, strategy: StrategyDefinition, indicators: Dict, price: float) -> bool:
        """Check if entry conditions are met"""
        if not strategy.entry_condition:
            return False
        
        cond = strategy.entry_condition
        
        # Get indicator values
        if cond.indicator == "price":
            ind_val = price
        else:
            ind_val = indicators.get(cond.indicator)
            if ind_val is None or np.isnan(ind_val):
                return False
        
        # Check condition type
        if cond.condition_type == "cross_above":
            # Need previous values to detect cross
            # Simplified: just check if above now
            if cond.reference_indicator:
                ref_val = indicators.get(cond.reference_indicator)
                if ref_val is None or np.isnan(ref_val):
                    return False
                return ind_val > ref_val
            return False
        
        elif cond.condition_type == "below":
            if cond.reference is not None:
                return ind_val < cond.reference
            return False
        
        elif cond.condition_type == "above":
            if cond.reference is not None:
                return ind_val > cond.reference
            return False
        
        return False
    
    def _check_exit_signal(self, strategy: StrategyDefinition, indicators: Dict, price: float, entry_price: float) -> bool:
        """Check if exit conditions are met"""
        # Check stop loss / take profit first
        if strategy.stop_loss_pct:
            if price < entry_price * (1 - strategy.stop_loss_pct / 100):
                return True
        
        if strategy.take_profit_pct:
            if price > entry_price * (1 + strategy.take_profit_pct / 100):
                return True
        
        # Check strategy exit condition
        if not strategy.exit_condition:
            return False
        
        cond = strategy.exit_condition
        
        if cond.indicator == "price":
            ind_val = price
        else:
            ind_val = indicators.get(cond.indicator)
            if ind_val is None or np.isnan(ind_val):
                return False
        
        if cond.condition_type == "cross_below":
            if cond.reference_indicator:
                ref_val = indicators.get(cond.reference_indicator)
                if ref_val is None or np.isnan(ref_val):
                    return False
                return ind_val < ref_val
            return False
        
        elif cond.condition_type == "above":
            if cond.reference is not None:
                return ind_val > cond.reference
            return False
        
        elif cond.condition_type == "below":
            if cond.reference is not None:
                return ind_val < cond.reference
            return False
        
        return False
    
    def _calculate_metrics(self, trades: List[TradeFill], equity_curve: List[EquityPoint], initial_capital: float) -> BacktestMetrics:
        """Calculate performance metrics"""
        if not equity_curve:
            return BacktestMetrics(
                total_return_pct=0.0,
                cagr_pct=0.0,
                max_drawdown_pct=0.0,
                sharpe_ratio=0.0,
                win_rate_pct=0.0,
                total_trades=0,
                winning_trades=0,
                losing_trades=0,
                avg_win=0.0,
                avg_loss=0.0,
                profit_factor=0.0,
                final_equity=initial_capital
            )
        
        final_equity = equity_curve[-1].equity
        total_return_pct = ((final_equity - initial_capital) / initial_capital) * 100
        
        # Calculate CAGR (simplified)
        days = (equity_curve[-1].timestamp - equity_curve[0].timestamp).days
        years = days / 365.25
        if years > 0:
            cagr_pct = (pow(final_equity / initial_capital, 1 / years) - 1) * 100
        else:
            cagr_pct = total_return_pct
        
        # Max drawdown
        max_dd_pct = 0.0
        peak = initial_capital
        for point in equity_curve:
            if point.equity > peak:
                peak = point.equity
            dd = ((point.equity - peak) / peak) * 100
            if dd < max_dd_pct:
                max_dd_pct = dd
        
        # Trade statistics  
        exit_trades = [t for t in trades if t.side == Side.SELL and t.pnl is not None]
        total_trades = len(exit_trades)
        winning_trades = len([t for t in exit_trades if t.pnl > 0])
        losing_trades = len([t for t in exit_trades if t.pnl <= 0])
        
        win_rate_pct = (winning_trades / total_trades * 100) if total_trades > 0 else 0.0
        
        wins = [t.pnl for t in exit_trades if t.pnl > 0]
        losses = [abs(t.pnl) for t in exit_trades if t.pnl <= 0]
        
        avg_win = np.mean(wins) if wins else 0.0
        avg_loss = np.mean(losses) if losses else 0.0
        
        total_wins = sum(wins) if wins else 0.0
        total_losses = sum(losses) if losses else 0.0
        profit_factor = (total_wins / total_losses) if total_losses > 0 else 0.0
        
        # Sharpe ratio (simplified daily returns)
        returns = []
        for i in range(1, len(equity_curve)):
            ret = (equity_curve[i].equity - equity_curve[i-1].equity) / equity_curve[i-1].equity
            returns.append(ret)
        
        if returns:
            mean_return = np.mean(returns)
            std_return = np.std(returns)
            sharpe_ratio = (mean_return / std_return) * np.sqrt(252) if std_return > 0 else 0.0
        else:
            sharpe_ratio = 0.0
        
        return BacktestMetrics(
            total_return_pct=round(total_return_pct, 2),
            cagr_pct=round(cagr_pct, 2),
            max_drawdown_pct=round(max_dd_pct, 2),
            sharpe_ratio=round(sharpe_ratio, 2),
            win_rate_pct=round(win_rate_pct, 1),
            total_trades=total_trades,
            winning_trades=winning_trades,
            losing_trades=losing_trades,
            avg_win=round(avg_win, 2),
            avg_loss=round(avg_loss, 2),
            profit_factor=round(profit_factor, 2),
            final_equity=round(final_equity, 2)
        )


# Global engine instance
_engine = BacktestEngine()


def get_engine() -> BacktestEngine:
    """Get the global engine instance"""
    return _engine
