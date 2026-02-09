"""
Demo bar data fixtures for backtesting
"""

from datetime import datetime, timedelta
from typing import List, Dict
import random


def generate_demo_bars(symbol: str, start_date: datetime, end_date: datetime, seed: int = 42) -> List[Dict]:
    """
    Generate deterministic demo OHLCV bars for backtesting.
    Returns list of bars with: timestamp, open, high, low, close, volume
    """
    random.seed(seed)
    
    # Base prices by symbol
    base_prices = {
        "SPY": 400.0,
        "AAPL": 170.0,
        "MSFT": 350.0,
        "TSLA": 200.0,
        "QQQ": 350.0
    }
    
    base_price = base_prices.get(symbol, 100.0)
    current_price = base_price
    
    bars = []
    current_date = start_date
    
    while current_date <= end_date:
        # Skip weekends
        if current_date.weekday() >= 5:
            current_date += timedelta(days=1)
            continue
        
        # Generate daily bar with some realistic movement
        daily_change_pct = random.gauss(0.001, 0.015)  # ~1.5% daily volatility
        
        open_price = current_price
        close_price = current_price * (1 + daily_change_pct)
        
        # High/Low based on intraday range
        intraday_range = abs(close_price - open_price) * random.uniform(1.5, 3.0)
        high_price = max(open_price, close_price) + intraday_range * random.random()
        low_price = min(open_price, close_price) - intraday_range * random.random()
        
        # Volume (millions)
        volume = int(random.uniform(50_000_000, 150_000_000))
        
        bars.append({
            "timestamp": current_date,
            "open": round(open_price, 2),
            "high": round(high_price, 2),
            "low": round(low_price, 2),
            "close": round(close_price, 2),
            "volume": volume
        })
        
        current_price = close_price
        current_date += timedelta(days=1)
    
    return bars


def get_demo_bars(symbol: str, start_date: str, end_date: str, seed: int = 42) -> List[Dict]:
    """
    Get demo bars for a symbol and date range.
    Dates in YYYY-MM-DD format.
    """
    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
    end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    
    return generate_demo_bars(symbol, start_dt, end_dt, seed)
