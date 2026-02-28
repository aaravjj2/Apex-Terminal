import csv
import random
import time
from datetime import datetime, timezone

# Target aligned with helpers.ts frozen time: Jan 15, 2025
# 12:00 UTC = 1736942400000
# We'll generate data from 09:30 AM to 12:30 PM UTC for a market session simulation
# Actually, if frozen time is 12:00 UTC, we want data leading up to that.
# Let's verify frozen time in helpers.ts: Date.UTC(2025, 0, 15, 12, 0, 0)
TARGET_DATE = datetime(2025, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
TARGET_MS = int(TARGET_DATE.timestamp() * 1000)

START_MS = TARGET_MS - (4 * 3600 * 1000) # 4 hours of data back
END_MS = TARGET_MS + (1 * 3600 * 1000)   # 1 hour forward

SYMBOLS = {
    "AAPL": 150.0,
    "MSFT": 300.0,
    "SPY": 400.0,
    "TSLA": 200.0,
    "NVDA": 500.0
}

TICKS_TOTAL = 5000

print(f"Generating data for {TARGET_DATE} (Target MS: {TARGET_MS})")

data = []

for symbol, base_price in SYMBOLS.items():
    current_price = base_price
    for i in range(TICKS_TOTAL):
        # Random time within range
        ts = random.randint(START_MS, END_MS)
        
        # Random walk price
        change = random.uniform(-0.1, 0.1)
        current_price += change
        current_price = round(current_price, 2)
        
        size = random.randint(1, 100)
        
        data.append({
            "symbol": symbol,
            "ts_ms": ts,
            "price": current_price,
            "size": size,
            "side": random.choice(["buy", "sell"])
        })

# Sort by timestamp
data.sort(key=lambda x: x["ts_ms"])

# Write to CSV
with open("data/sample_ticks.csv", "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["symbol", "ts_ms", "price", "size", "side"])
    writer.writeheader()
    writer.writerows(data)

print(f"Generated {len(data)} ticks to data/sample_ticks.csv")
