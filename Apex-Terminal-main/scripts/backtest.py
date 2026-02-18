#!/usr/bin/env python3
"""
Backtest CLI - Run backtests from command line.

Usage:
    python scripts/backtest.py --strategy strategies/sma_crossover.py --symbol AAPL --from 2024-01-01 --to 2025-01-01 --timeframe 1d

Environment variables required:
    - FINNHUB_API_KEY (for Finnhub data)
    - APCA_API_KEY_ID, APCA_API_SECRET_KEY (for Alpaca data)
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "phase1"))

from services.backtest.backtester import Backtester, BacktestConfig, DataProvider
from services.backtest.fill_simulator import SlippageConfig, CommissionConfig, SlippageModel


def load_strategy(strategy_path: str):
    """Dynamically load a strategy from a Python file."""
    import importlib.util
    
    path = Path(strategy_path)
    if not path.exists():
        raise FileNotFoundError(f"Strategy file not found: {strategy_path}")
    
    spec = importlib.util.spec_from_file_location("strategy_module", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    
    if hasattr(module, "strategy_class"):
        return module.strategy_class()
    
    # Try to find a class that extends BaseStrategy
    from services.strategy.base_strategy import BaseStrategy
    for attr_name in dir(module):
        attr = getattr(module, attr_name)
        if isinstance(attr, type) and issubclass(attr, BaseStrategy) and attr is not BaseStrategy:
            return attr()
    
    raise ValueError(f"No strategy class found in {strategy_path}")


def main():
    parser = argparse.ArgumentParser(description="Run a backtest")
    parser.add_argument("--strategy", "-s", required=True, help="Path to strategy file")
    parser.add_argument("--symbol", required=True, help="Trading symbol (e.g., AAPL)")
    parser.add_argument("--from", dest="from_date", required=True, help="Start date (YYYY-MM-DD)")
    parser.add_argument("--to", dest="to_date", required=True, help="End date (YYYY-MM-DD)")
    parser.add_argument("--timeframe", "-tf", default="1d", help="Bar timeframe (1m, 5m, 1h, 1d)")
    parser.add_argument("--capital", "-c", type=float, default=100000, help="Initial capital")
    parser.add_argument("--provider", "-p", default="yfinance", choices=["yfinance", "alpaca", "finnhub"])
    parser.add_argument("--seed", type=int, default=None, help="Random seed for slippage")
    parser.add_argument("--slippage", type=float, default=0.0, help="Slippage percentage")
    parser.add_argument("--commission", type=float, default=0.0, help="Commission per share")
    parser.add_argument("--output", "-o", default=None, help="Output file for results")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    
    args = parser.parse_args()
    
    # Parse dates
    try:
        start_date = datetime.strptime(args.from_date, "%Y-%m-%d")
        end_date = datetime.strptime(args.to_date, "%Y-%m-%d")
    except ValueError as e:
        print(f"Error parsing dates: {e}")
        sys.exit(1)
    
    # Check API keys for providers that need them
    if args.provider == "alpaca":
        if not os.environ.get("APCA_API_KEY_ID") or not os.environ.get("APCA_API_SECRET_KEY"):
            print("ERROR: Alpaca requires APCA_API_KEY_ID and APCA_API_SECRET_KEY environment variables")
            sys.exit(1)
    
    if args.provider == "finnhub":
        if not os.environ.get("FINNHUB_API_KEY"):
            print("ERROR: Finnhub requires FINNHUB_API_KEY environment variable")
            sys.exit(1)
    
    # Create config
    slippage_config = SlippageConfig(
        model=SlippageModel.PERCENTAGE if args.slippage > 0 else SlippageModel.NONE,
        percentage=args.slippage,
        seed=args.seed,
    )
    
    commission_config = CommissionConfig(
        per_share=args.commission,
    )
    
    config = BacktestConfig(
        symbol=args.symbol.upper(),
        start_date=start_date,
        end_date=end_date,
        timeframe=args.timeframe,
        initial_capital=args.capital,
        data_provider=DataProvider(args.provider),
        slippage=slippage_config,
        commission=commission_config,
        seed=args.seed,
    )
    
    # Load strategy
    try:
        strategy = load_strategy(args.strategy)
        strategy.set_params(symbol=args.symbol.upper())
    except Exception as e:
        print(f"Error loading strategy: {e}")
        sys.exit(1)
    
    if args.verbose:
        print(f"Running backtest:")
        print(f"  Strategy: {strategy.name}")
        print(f"  Symbol: {args.symbol}")
        print(f"  Period: {args.from_date} to {args.to_date}")
        print(f"  Timeframe: {args.timeframe}")
        print(f"  Capital: ${args.capital:,.2f}")
        print(f"  Provider: {args.provider}")
        print()
    
    # Run backtest
    try:
        backtester = Backtester(config)
        result = backtester.run(strategy)
    except Exception as e:
        print(f"Backtest error: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)
    
    # Print results
    print("=" * 60)
    print(f"BACKTEST RESULTS - {strategy.name}")
    print("=" * 60)
    print(f"Symbol:          {args.symbol}")
    print(f"Period:          {args.from_date} to {args.to_date}")
    print(f"Initial Capital: ${result.initial_capital:,.2f}")
    print(f"Final Equity:    ${result.final_equity:,.2f}")
    print(f"Total Return:    ${result.total_return:,.2f} ({result.total_return_pct:.2f}%)")
    print()
    print(f"Total Trades:    {result.total_trades}")
    print(f"Winning Trades:  {result.winning_trades}")
    print(f"Losing Trades:   {result.losing_trades}")
    print(f"Win Rate:        {result.win_rate:.1f}%")
    print()
    print(f"Max Drawdown:    ${result.max_drawdown:,.2f} ({result.max_drawdown_pct:.2f}%)")
    print(f"Sharpe Ratio:    {result.sharpe_ratio:.2f}")
    print(f"Sortino Ratio:   {result.sortino_ratio:.2f}")
    print()
    print("HASHES (for determinism verification):")
    print(f"  Config:       {result.config_hash[:16]}...")
    print(f"  Trade Log:    {result.trade_log_hash[:16]}...")
    print(f"  Equity Curve: {result.equity_curve_hash[:16]}...")
    print("=" * 60)
    
    # Save output
    if args.output:
        output_data = result.to_dict()
        output_data["equity_curve"] = result.equity_curve
        output_data["trades"] = result.trades
        
        with open(args.output, "w") as f:
            json.dump(output_data, f, indent=2)
        print(f"\nResults saved to: {args.output}")
    
    # Return success
    sys.exit(0)


if __name__ == "__main__":
    main()
