#!/usr/bin/env python3
"""
Live Run CLI - Start a strategy in paper trading mode.

Usage:
    python scripts/live_run.py --strategy strategies/sma_crossover.py --symbol AAPL

Environment variables required:
    - FINNHUB_API_KEY (for live data)
    - APCA_API_KEY_ID, APCA_API_SECRET_KEY (for paper trading)
"""

import argparse
import os
import sys
import signal
import time
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "phase1"))


def check_api_keys():
    """Check that required API keys are present."""
    missing = []
    
    if not os.environ.get("FINNHUB_API_KEY"):
        missing.append("FINNHUB_API_KEY")
    if not os.environ.get("APCA_API_KEY_ID"):
        missing.append("APCA_API_KEY_ID")
    if not os.environ.get("APCA_API_SECRET_KEY"):
        missing.append("APCA_API_SECRET_KEY")
    
    if missing:
        print("ERROR: Missing required environment variables:")
        for key in missing:
            print(f"  - {key}")
        print("\nSet these variables before running live mode.")
        print("\nExample:")
        print('  export FINNHUB_API_KEY="your_key"')
        print('  export APCA_API_KEY_ID="your_key_id"')
        print('  export APCA_API_SECRET_KEY="your_secret"')
        sys.exit(1)
    
    # Verify paper trading endpoint
    endpoint = os.environ.get("APCA_ENDPOINT", "https://paper-api.alpaca.markets")
    if "paper" not in endpoint.lower():
        print("WARNING: APCA_ENDPOINT does not appear to be paper trading!")
        print(f"  Current: {endpoint}")
        print("  Paper:   https://paper-api.alpaca.markets")
        response = input("Continue anyway? (y/N): ")
        if response.lower() != "y":
            sys.exit(1)


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
    
    raise ValueError(f"No strategy class found in {strategy_path}")


def main():
    parser = argparse.ArgumentParser(description="Run a strategy in live paper trading mode")
    parser.add_argument("--strategy", "-s", required=True, help="Path to strategy file")
    parser.add_argument("--symbol", required=True, help="Trading symbol (e.g., AAPL)")
    parser.add_argument("--capital", "-c", type=float, default=10000, help="Initial capital")
    parser.add_argument("--max-position", type=float, default=1000, help="Max position size in $")
    parser.add_argument("--dry-run", action="store_true", help="Simulate without placing real orders")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    
    args = parser.parse_args()
    
    # Check API keys
    check_api_keys()
    
    # Load strategy
    try:
        strategy = load_strategy(args.strategy)
        strategy.set_params(symbol=args.symbol.upper())
    except Exception as e:
        print(f"Error loading strategy: {e}")
        sys.exit(1)
    
    print("=" * 60)
    print("LIVE PAPER TRADING MODE")
    print("=" * 60)
    print(f"Strategy:     {strategy.name}")
    print(f"Symbol:       {args.symbol}")
    print(f"Capital:      ${args.capital:,.2f}")
    print(f"Max Position: ${args.max_position:,.2f}")
    print(f"Dry Run:      {args.dry_run}")
    print("=" * 60)
    print()
    
    # Verify Alpaca connection
    try:
        from services.execution.alpaca_adapter import AlpacaAdapter
        adapter = AlpacaAdapter()
        account = adapter.verify_connection()
        
        print("Alpaca Connection Verified:")
        print(f"  Account:    {account['account_number']}")
        print(f"  Status:     {account['status']}")
        print(f"  Equity:     ${account['equity']:,.2f}")
        print(f"  Cash:       ${account['cash']:,.2f}")
        print(f"  Paper:      {account['is_paper']}")
        print()
        
        if not account['is_paper'] and not args.dry_run:
            print("ERROR: This is NOT a paper account! Refusing to run.")
            sys.exit(1)
            
    except Exception as e:
        print(f"Failed to connect to Alpaca: {e}")
        sys.exit(1)
    
    # Set up signal handlers
    running = True
    
    def handle_signal(signum, frame):
        nonlocal running
        print("\nShutting down...")
        running = False
    
    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)
    
    # Main loop placeholder
    print("Starting live trading...")
    print("Press Ctrl+C to stop")
    print()
    
    if args.dry_run:
        print("[DRY RUN] No real orders will be placed")
    
    # In a real implementation, this would:
    # 1. Connect to Finnhub WebSocket for live ticks
    # 2. Run strategy on each tick/bar
    # 3. Place orders via Alpaca adapter
    
    while running:
        time.sleep(1)
        # Would process live data here
        if args.verbose:
            print(".", end="", flush=True)
    
    print("\nStopped.")
    
    # Print final state
    try:
        positions = adapter.get_positions()
        if positions:
            print("\nOpen Positions:")
            for p in positions:
                print(f"  {p['symbol']}: {p['qty']} @ ${p['current_price']:.2f}")
    except:
        pass
    
    sys.exit(0)


if __name__ == "__main__":
    main()
