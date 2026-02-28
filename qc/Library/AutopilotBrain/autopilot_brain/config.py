from typing import List

# ============================================================================
# V1-A PATTERN CONSTRAINTS (NON-NEGOTIABLE)
# ============================================================================

# Strategy
ALLOWED_TEMPLATES = ["LONG_CALL", "LONG_PUT"]
PREFER_DELTA = True # Try to use delta if available
TARGET_DELTA_MIN = 0.35
TARGET_DELTA_MAX = 0.65

# DTE
MIN_DTE_ENTRY = 3
MAX_DTE_ENTRY = 7
TIME_STOP_DTE = 2 # Exit if DTE <= 2

# Risk Limits
MAX_OPEN_POSITIONS = 10
MAX_PREMIUM_EXPOSURE = 1000.0 # USD
MAX_RISK_PER_TRADE_PCT = 0.02 # 2% of budget
INITIAL_BUDGET = 1000.0

# Exit Rules
STOP_LOSS_PCT = 0.10 # 10% hard stop
PROFIT_TARGET_PCT = 0.50 # 50% target

# Scan Schedule (ET)
# Mapped to QC scheduled events
SCAN_TIMES = ["09:45", "11:00", "14:00", "15:45"]

# Universe
TARGET_UNDERLYINGS = ["SPY", "QQQ", "IWM", "AAPL", "NVDA", "AMD", "MSFT", "AMZN", "GOOGL", "META"]
