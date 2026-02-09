import os
import zipfile
import pandas as pd
from datetime import datetime, timedelta

def create_equity_daily(ticker, folder):
    # Lean Format: date, open, high, low, close, volume (multiplied by 10000 sometimes? No, daily is standard CSV usually)
    # Format: YYYYMMDD,open,high,low,close,volume
    # Scaled? QC Daily data is usually unscaled strings or scaled.
    # Let's use standard QC Daily format: 20230103000000,1000000,1050000,990000,1020000,1000000
    # QC Daily format: Date(YYYYMMDD HH:MM), Open, High, Low, Close, Volume
    
    os.makedirs(folder, exist_ok=True)
    csv_content = []
    
    start_date = datetime(2022, 10, 1) # Warmup
    end_date = datetime(2023, 1, 31)
    
    curr = start_date
    val = 1000000 # 100.00
    while curr <= end_date:
        if curr.weekday() < 5:
            date_str = curr.strftime("%Y%m%d 00:00")
            line = f"{date_str},{val},{val+50000},{val-50000},{val+20000},1000000"
            csv_content.append(line)
        curr += timedelta(days=1)
        
    csv_str = "\n".join(csv_content)
    
    zip_path = os.path.join(folder, f"{ticker.lower()}.zip")
    with zipfile.ZipFile(zip_path, 'w') as zf:
        zf.writestr(f"{ticker.lower()}.csv", csv_str)
    print(f"Created {zip_path}")

def generate_data():
    root = "data"
    create_equity_daily("spy", f"{root}/equity/usa/daily")
    create_equity_daily("qqq", f"{root}/equity/usa/daily")
    
if __name__ == "__main__":
    generate_data()
