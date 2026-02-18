# RUNBOOK: FREE-ONLY LOCAL-FIRST Trading System

**Version**: 1.0  
**Last Updated**: January 27, 2026  
**Maintainer**: Development Team

## QUICK START

```bash
# 1. Bootstrap environment
./scripts/bootstrap.sh

# 2. Download data (dry run for testing)
python -m backend.app.data.downloader download --symbols SPY --start 2024-01-01 --end 2024-01-03 --dry-run

# 3. Run backtest
python -m backend.app.backtest.engine run --symbols SPY --start 2024-01-01 --end 2024-01-03

# 4. Start dashboard
# Terminal 1: Backend
cd backend && uvicorn app.api.main:app --reload --port 8080

# Terminal 2: Frontend
cd frontend && npm run dev -- --port 50001

# 5. Open browser
# Navigate to: http://localhost:50001
```

---

## TABLE OF CONTENTS

1. [Environment Setup](#environment-setup)
2. [Data Management](#data-management)
3. [Backtesting](#backtesting)
4. [Live Paper Trading](#live-paper-trading)
5. [Dashboard Operations](#dashboard-operations)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)
8. [Maintenance](#maintenance)

---

## ENVIRONMENT SETUP

### Prerequisites

**System Requirements**:
- OS: Linux, macOS, or Windows 10+
- Python: 3.11 or higher
- Node.js: 18 or higher
- Memory: 4GB RAM minimum, 8GB recommended
- Disk: 10GB free space for data storage

**Check Versions**:
```bash
python --version    # Should be 3.11+
node --version      # Should be v18+
npm --version       # Should be 9+
```

### Initial Setup

**1. Clone Repository**:
```bash
cd /home/aarav/Aarav/
git clone <your-repo-url> "Tradingview recreation"
cd "Tradingview recreation"
```

**2. Configure Environment**:
```bash
# Copy example env file
cp .env.example .env

# Edit with your Alpaca credentials
nano .env
```

**Required Environment Variables** (`.env`):
```bash
# Alpaca Paper Trading (FREE)
ALPACA_API_KEY=your_paper_api_key_here
ALPACA_API_SECRET=your_paper_api_secret_here
ALPACA_PAPER_BASE_URL=https://paper-api.alpaca.markets
ALPACA_DATA_BASE_URL=https://data.alpaca.markets

# Optional: Logging
LOG_LEVEL=INFO
```

**Get Alpaca Keys**:
1. Go to https://alpaca.markets
2. Sign up for free account
3. Navigate to "Paper Trading"
4. Copy API Key and Secret Key
5. Paste into `.env` file

**3. Run Bootstrap Script**:
```bash
chmod +x scripts/bootstrap.sh
./scripts/bootstrap.sh
```

This script will:
- Create Python virtual environment in `backend/.venv`
- Install all Python dependencies
- Run pytest to verify backend setup
- Install Node.js dependencies
- Build frontend assets
- Verify installation

**Expected Output**:
```
✅ Python venv created
✅ Python dependencies installed
✅ pytest: 15 passed
✅ Node dependencies installed
✅ Frontend build successful
🎉 Bootstrap complete!
```

**Manual Setup (if script fails)**:
```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
pytest -v

# Frontend
cd ../frontend
npm install
npm run build
```

---

## DATA MANAGEMENT

### Download Historical Data

**Dry Run (Fast Test)**:
```bash
# Download 2 days of SPY data (completes in ~30 seconds)
python -m backend.app.data.downloader download \
  --symbols SPY \
  --start 2024-01-01 \
  --end 2024-01-03 \
  --timeframe 30Min \
  --dry-run
```

**Production Download (Full Basket)**:
```bash
# Download 1 year of data for 8 symbols (~5 minutes)
python -m backend.app.data.downloader download \
  --symbols SPY,QQQ,AAPL,MSFT,NVDA,AMZN,META,GLD \
  --start 2024-01-01 \
  --end 2024-12-31 \
  --timeframe 30Min
```

**Incremental Update**:
```bash
# Fetch only missing bars (idempotent)
python -m backend.app.data.downloader update \
  --symbols SPY,QQQ,AAPL,MSFT,NVDA,AMZN,META,GLD
```

**Download Options**:
- `--symbols`: Comma-separated ticker symbols
- `--start`: Start date (YYYY-MM-DD)
- `--end`: End date (YYYY-MM-DD)
- `--timeframe`: Bar size (5Min, 30Min)
- `--dry-run`: Test mode (1-2 days only)
- `--validate`: Run validation after download

**Expected Output**:
```
[INFO] Starting download...
[INFO] Symbols: SPY, QQQ, AAPL, MSFT, NVDA, AMZN, META, GLD
[INFO] Date range: 2024-01-01 to 2024-12-31
[INFO] Timeframe: 30Min
[INFO] Fetching batch 1/23... (symbols: SPY, QQQ, AAPL)
[INFO] Pagination: next_page_token present, continuing...
[INFO] Fetching batch 2/23... (symbols: MSFT, NVDA, AMZN)
...
[INFO] Total bars downloaded: 156,780
[INFO] Writing to Parquet...
[INFO] Validating data...
✅ Download complete!
✅ Validation passed: 0 critical issues
```

**Data Storage Location**:
```
data/market/
  bars_30Min/
    symbol=SPY/
      year=2024/
        month=01/data.parquet
        month=02/data.parquet
        ...
    symbol=QQQ/
      year=2024/
        ...
  metadata.json
```

### Validate Data

**Run Validation**:
```bash
python -m backend.app.data.validation validate \
  --timeframe 30Min
```

**Validation Checks**:
- ✅ Bar counts: ~13 bars/day for 30Min RTH
- ✅ Gaps: Missing bars flagged
- ✅ Duplicates: Duplicate timestamps detected
- ✅ Timezone: UTC storage verified
- ✅ Monotonic: Timestamps strictly increasing

**Sample Validation Report**:
```json
{
  "status": "passed",
  "checks": {
    "bar_count": {"passed": 248, "failed": 2, "details": "Missing bars on 2024-03-15, 2024-07-04 (holidays)"},
    "gaps": {"passed": true, "max_gap_minutes": 30},
    "duplicates": {"passed": true, "count": 0},
    "timezone": {"passed": true, "format": "UTC"},
    "monotonic": {"passed": true}
  },
  "summary": "2 non-critical issues (holidays)"
}
```

### Data Cleanup

**Remove All Data**:
```bash
# ⚠️ WARNING: Deletes all downloaded bars
rm -rf data/market/bars_*
```

**Remove Specific Symbol**:
```bash
rm -rf data/market/bars_30Min/symbol=AAPL
```

---

## BACKTESTING

### Run Backtest

**Quick Test (Single Symbol)**:
```bash
python -m backend.app.backtest.engine run \
  --symbols SPY \
  --start 2024-01-01 \
  --end 2024-01-31 \
  --fill-model MOC \
  --slippage 1 \
  --output results/quick_test.json
```

**Full Backtest (Basket)**:
```bash
python -m backend.app.backtest.engine run \
  --symbols SPY,QQQ,AAPL,MSFT,NVDA,AMZN,META,GLD \
  --start 2024-01-01 \
  --end 2024-12-31 \
  --fill-model MOC \
  --slippage 1 \
  --commission 0.0 \
  --max-positions 8 \
  --position-size 1000 \
  --output results/full_year_2024.json
```

**Backtest Options**:
- `--symbols`: Comma-separated tickers
- `--start`: Start date (YYYY-MM-DD)
- `--end`: End date (YYYY-MM-DD)
- `--fill-model`: MOC (market-on-close) or NBO (next-bar-open)
- `--slippage`: Ticks (1 tick = $0.01)
- `--commission`: Percent (0.0 = free)
- `--max-positions`: Max concurrent positions (default 8)
- `--position-size`: USD per trade (default 1000)
- `--output`: Results JSON file path

**Expected Output**:
```
[INFO] Loading data from Parquet...
[INFO] Symbols: SPY, QQQ, AAPL, MSFT, NVDA, AMZN, META, GLD
[INFO] Date range: 2024-01-01 to 2024-12-31
[INFO] Total bars: 156,780
[INFO] Running backtest...
[INFO] Processing 2024-01-02...
[INFO] Signal: SPY BUY (Engine A: VWAP reclaim)
[INFO] Order filled: SPY 20 shares @ $450.25
[INFO] Processing 2024-01-03...
...
[INFO] Backtest complete!
[INFO] Total trades: 234
[INFO] Win rate: 58.5%
[INFO] Total PnL: $12,345.67
[INFO] Max drawdown: -8.2%
[INFO] Sharpe ratio: 1.42
[INFO] Results saved to: results/full_year_2024.json
```

**View Results**:
```bash
# Pretty print JSON
cat results/full_year_2024.json | python -m json.tool

# Summary only
jq '.metrics' results/full_year_2024.json

# Per-symbol breakdown
jq '.per_symbol' results/full_year_2024.json

# Equity curve
jq '.equity_curve' results/full_year_2024.json
```

### Backtest Modes

**1. MOC (Market-On-Close) - Default**:
- Signal generated on bar close
- Fill price = bar close + slippage
- Matches TradingView default behavior

**2. NBO (Next-Bar-Open)**:
- Signal generated on bar N close
- Fill price = bar N+1 open + slippage
- More realistic for market orders

**Comparison**:
```bash
# Run both modes
python -m backend.app.backtest.engine run --symbols SPY --fill-model MOC --output moc.json
python -m backend.app.backtest.engine run --symbols SPY --fill-model NBO --output nbo.json

# Compare
diff <(jq '.metrics' moc.json) <(jq '.metrics' nbo.json)
```

### Determinism Test

**Verify Reproducibility**:
```bash
# Run same config 3 times
for i in {1..3}; do
  python -m backend.app.backtest.engine run \
    --symbols SPY,QQQ \
    --start 2024-01-01 \
    --end 2024-01-31 \
    --fill-model MOC \
    --output run_$i.json
done

# Compare outputs (should be identical)
diff run_1.json run_2.json && echo "✅ Deterministic!"
diff run_2.json run_3.json && echo "✅ Deterministic!"
```

---

## LIVE PAPER TRADING

### Start Live Runner

**Basic Start**:
```bash
python -m backend.app.live.runner start \
  --symbols SPY,QQQ,AAPL \
  --timeframe 30Min
```

**Options**:
- `--symbols`: Comma-separated tickers to trade
- `--timeframe`: Bar size (30Min recommended)
- `--max-positions`: Max concurrent positions (default 8)
- `--position-size`: USD per trade (default 1000)
- `--log-level`: DEBUG, INFO, ERROR

**Expected Output**:
```
[INFO] Live runner starting...
[INFO] Alpaca Paper account: $142,839.68 equity
[INFO] Symbols: SPY, QQQ, AAPL
[INFO] Timeframe: 30Min
[INFO] Max positions: 8
[INFO] Position size: $1000
[INFO] Waiting for market open (09:30 ET)...
[INFO] Market open! Starting...
[INFO] [09:30] Fetching latest bars...
[INFO] [09:30] SPY: no signal (VWAP not rising)
[INFO] [09:30] QQQ: no signal (ADX < 20)
[INFO] [09:30] AAPL: BUY signal (Engine A: VWAP reclaim)
[INFO] [09:30] Submitting order: AAPL 3 shares @ market
[INFO] [09:30] Order filled: AAPL 3 @ $260.38
[INFO] [09:30] Position opened: AAPL 3 shares
[INFO] [10:00] Waiting for next bar close...
...
```

### Monitor Live Runner

**Check Status**:
```bash
# Via API
curl http://localhost:8080/api/live/status

# Via dashboard
# Open: http://localhost:50001/live
```

**View Logs**:
```bash
# Tail logs in real-time
tail -f backend/logs/live_runner.log

# Filter for signals only
grep "signal" backend/logs/live_runner.log

# Filter for orders
grep "Order" backend/logs/live_runner.log
```

### Stop Live Runner

```bash
# Graceful stop (Ctrl+C)
# Or send SIGTERM
pkill -f "backend.app.live.runner"
```

**On Stop**:
- Runner logs final state
- Open positions remain (must close manually)
- Logs archived with timestamp

---

## DASHBOARD OPERATIONS

### Start Dashboard

**Method 1: Separate Terminals**:
```bash
# Terminal 1: Backend
cd backend
source .venv/bin/activate
uvicorn app.api.main:app --reload --port 8080

# Terminal 2: Frontend
cd frontend
npm run dev -- --port 50001
```

**Method 2: Background Processes**:
```bash
# Start backend in background
cd backend && nohup uvicorn app.api.main:app --port 8080 > logs/backend.log 2>&1 &

# Start frontend in background
cd frontend && nohup npm run dev -- --port 50001 > logs/frontend.log 2>&1 &

# Check processes
lsof -i :8080  # Backend
lsof -i :50001 # Frontend
```

**Access Dashboard**:
```
Frontend: http://localhost:50001
Backend API: http://localhost:8080
API Docs: http://localhost:8080/docs
```

### Dashboard Features

**1. Overview Page** (`/`):
- Latest backtest summary
- Current live positions
- Recent signals
- System health

**2. Backtest Page** (`/backtest`):
- Run backtest button with config form
- Equity curve chart
- Metrics summary
- Per-symbol breakdown
- Trade log table

**3. Live Page** (`/live`):
- Current positions with P&L
- Recent signals log
- Account info (equity, buying power)
- Auto-refresh toggle

**4. Console Page** (`/console`):
- Strategy decision log
- Indicator snapshots
- Engine A/B rationale
- Force signal check button

**5. Data Page** (`/data`):
- Download status
- Validation report
- Download data button
- Gap detection

### API Endpoints

**Health Check**:
```bash
curl http://localhost:8080/api/health
```

**Run Backtest**:
```bash
curl -X POST http://localhost:8080/api/backtest/run \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["SPY", "QQQ"],
    "start": "2024-01-01",
    "end": "2024-01-31",
    "fill_model": "MOC",
    "slippage": 1
  }'
```

**Get Results**:
```bash
curl http://localhost:8080/api/backtest/results/{run_id}
```

**Get Live Positions**:
```bash
curl http://localhost:8080/api/alpaca/positions
```

**Get Strategy Logs**:
```bash
curl http://localhost:8080/api/strategy/logs?limit=50
```

---

## TESTING

### Backend Tests (pytest)

**Run All Tests**:
```bash
cd backend
pytest -v
```

**Run Specific Test File**:
```bash
pytest tests/test_downloader.py -v
pytest tests/test_backtest.py -v
pytest tests/test_strategy.py -v
```

**Run Specific Test**:
```bash
pytest tests/test_backtest.py::test_determinism -v
```

**With Coverage**:
```bash
pytest --cov=app --cov-report=html -v
# Open: htmlcov/index.html
```

**Expected Output**:
```
tests/test_downloader.py::test_pagination PASSED
tests/test_downloader.py::test_validation PASSED
tests/test_backtest.py::test_determinism PASSED
tests/test_backtest.py::test_portfolio_constraints PASSED
tests/test_strategy.py::test_engine_a PASSED
tests/test_strategy.py::test_engine_b PASSED
tests/test_strategy.py::test_indicators PASSED
======================== 15 passed in 5.23s ========================
```

### Frontend Tests (Playwright)

**Run E2E Tests (Non-Headless)**:
```bash
cd frontend
npx playwright test --headed
```

**Run Specific Test**:
```bash
npx playwright test backtest.spec.ts --headed
```

**With Debug**:
```bash
npx playwright test --debug
```

**Expected Output**:
```
Running 4 tests using 1 worker

  ✓ backtest.spec.ts:5:1 › Dashboard loads (2s)
  ✓ backtest.spec.ts:12:1 › Run backtest button works (5s)
  ✓ backtest.spec.ts:23:1 › Results display correctly (3s)
  ✓ live.spec.ts:5:1 › Live page shows positions (2s)

  4 passed (12s)
```

### End-to-End Test Script

**Run Full E2E Flow**:
```bash
chmod +x scripts/e2e_test.sh
./scripts/e2e_test.sh
```

**Script Steps**:
1. Download 2 days of SPY data
2. Run backtest on that data
3. Start backend + frontend
4. Run Playwright tests
5. Verify outputs
6. Cleanup

**Expected Output**:
```
[E2E] Step 1: Download data...
✅ Download complete
[E2E] Step 2: Run backtest...
✅ Backtest complete
[E2E] Step 3: Start services...
✅ Backend started on port 8080
✅ Frontend started on port 50001
[E2E] Step 4: Run Playwright...
✅ All tests passed
[E2E] Step 5: Verify outputs...
✅ results.json exists
✅ Equity curve has 26 points
[E2E] Step 6: Cleanup...
✅ Services stopped
🎉 E2E test passed!
```

---

## TROUBLESHOOTING

### Backend Issues

**Problem**: Backend won't start
```bash
# Check port 8080 is free
lsof -i :8080
# Kill process if occupied
kill -9 <PID>

# Check Python version
python --version  # Must be 3.11+

# Check dependencies
pip list | grep fastapi
pip list | grep alpaca

# Reinstall if needed
pip install -r requirements.txt --force-reinstall
```

**Problem**: Alpaca API authentication fails
```bash
# Verify .env file exists
cat .env | grep ALPACA

# Test credentials
python -c "
from alpaca.trading.client import TradingClient
client = TradingClient(
    api_key='YOUR_KEY',
    secret_key='YOUR_SECRET',
    paper=True
)
print(client.get_account())
"
```

**Problem**: Database errors
```bash
# Reset database
rm backend/trading.db

# Recreate tables
python -m backend.app.db.init_db
```

### Frontend Issues

**Problem**: Frontend won't start
```bash
# Check port 50001 is free
lsof -i :50001

# Check Node version
node --version  # Must be 18+

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

**Problem**: Build errors
```bash
# Clear cache
npm cache clean --force

# Rebuild
npm run build
```

**Problem**: API connection fails
```bash
# Check backend is running
curl http://localhost:8080/api/health

# Check CORS settings in backend
# Ensure frontend URL is allowed
```

### Data Issues

**Problem**: Download fails with pagination error
```bash
# Check Alpaca API status
curl https://status.alpaca.markets/

# Reduce batch size in config
# Edit: backend/app/data/downloader.py
# MAX_SYMBOLS_PER_REQUEST = 3  # Lower from 10
```

**Problem**: Validation reports gaps
```bash
# Re-download specific date range
python -m backend.app.data.downloader download \
  --symbols SPY \
  --start 2024-03-15 \
  --end 2024-03-15

# Note: Gaps on holidays are normal
```

**Problem**: Parquet read errors
```bash
# Check file integrity
python -c "
import pandas as pd
df = pd.read_parquet('data/market/bars_30Min/symbol=SPY/year=2024/month=01/data.parquet')
print(df.info())
"

# Rebuild if corrupted
rm -rf data/market/bars_30Min/symbol=SPY/year=2024/month=01
# Re-download
```

### Backtest Issues

**Problem**: Backtest produces no trades
```bash
# Check data availability
python -c "
from backend.app.data.storage import ParquetStorage
storage = ParquetStorage()
df = storage.read_bars(['SPY'], '2024-01-01', '2024-01-31')
print(f'Bars: {len(df)}')
"

# Lower signal thresholds in config
# Edit: backend/app/strategy/config.py
# ADX_THRESHOLD = 15  # Lower from 20
```

**Problem**: Backtest results differ from TradingView
```bash
# Compare settings:
# 1. Fill model (MOC vs NBO)
# 2. Slippage (1 tick = $0.01)
# 3. Commission (0% for Alpaca)
# 4. Session times (09:30-16:00 ET)

# See: docs/KNOWN_DIFFERENCES.md
```

### Live Runner Issues

**Problem**: Runner not placing orders
```bash
# Check market hours
python -c "
from datetime import datetime
import pytz
et = pytz.timezone('US/Eastern')
now = datetime.now(et)
print(f'Current ET: {now}')
print(f'Market hours: 09:30-16:00')
"

# Check Alpaca buying power
curl http://localhost:8080/api/alpaca/account

# Check logs for rejections
grep "rejected" backend/logs/live_runner.log
```

**Problem**: Orders rejected by Alpaca
```bash
# Common reasons:
# 1. Insufficient buying power
# 2. Market closed
# 3. Invalid symbol
# 4. Fractional shares not supported

# Check order details in logs
grep "Order rejected" backend/logs/live_runner.log -A 5
```

---

## MAINTENANCE

### Daily Tasks

**Check Live Runner Status**:
```bash
curl http://localhost:8080/api/live/status
```

**Review Logs**:
```bash
tail -f backend/logs/live_runner.log | grep -E "signal|Order"
```

**Check Positions**:
```bash
curl http://localhost:8080/api/alpaca/positions | python -m json.tool
```

### Weekly Tasks

**Update Data**:
```bash
# Incremental download (fetches last 7 days)
python -m backend.app.data.downloader update \
  --symbols SPY,QQQ,AAPL,MSFT,NVDA,AMZN,META,GLD
```

**Validate Data**:
```bash
python -m backend.app.data.validation validate --timeframe 30Min
```

**Run Performance Backtest**:
```bash
# Re-run backtest on updated data
python -m backend.app.backtest.engine run \
  --symbols SPY,QQQ,AAPL,MSFT,NVDA,AMZN,META,GLD \
  --start $(date -d "7 days ago" +%Y-%m-%d) \
  --end $(date +%Y-%m-%d) \
  --output results/weekly_$(date +%Y%m%d).json
```

### Monthly Tasks

**Archive Logs**:
```bash
# Compress old logs
tar -czf logs/archive/logs_$(date +%Y%m).tar.gz backend/logs/*.log
rm backend/logs/*.log
```

**Review Backtest Performance**:
```bash
# Compare last 3 months
jq '.metrics.total_pnl' results/*_202401*.json
jq '.metrics.total_pnl' results/*_202402*.json
jq '.metrics.total_pnl' results/*_202403*.json
```

**Update Dependencies**:
```bash
# Backend
cd backend
pip list --outdated
pip install --upgrade <package>

# Frontend
cd frontend
npm outdated
npm update <package>
```

### Backup Strategy

**Backup Data**:
```bash
# Backup Parquet files
tar -czf backups/market_data_$(date +%Y%m%d).tar.gz data/market/

# Backup backtest results
tar -czf backups/results_$(date +%Y%m%d).tar.gz results/

# Backup database
cp backend/trading.db backups/trading_$(date +%Y%m%d).db
```

**Restore Data**:
```bash
# Restore from backup
tar -xzf backups/market_data_20240127.tar.gz -C data/
```

---

## QUICK REFERENCE

### Common Commands

```bash
# Start everything
./scripts/bootstrap.sh && ./scripts/start_all.sh

# Download data
python -m backend.app.data.downloader download --symbols SPY --start 2024-01-01 --end 2024-12-31

# Run backtest
python -m backend.app.backtest.engine run --symbols SPY --start 2024-01-01 --end 2024-12-31

# Start dashboard
cd backend && uvicorn app.api.main:app --port 8080 &
cd frontend && npm run dev -- --port 50001 &

# Run tests
pytest -v && npx playwright test --headed

# Stop all
pkill -f uvicorn && pkill -f "npm run dev"
```

### Useful Aliases

Add to `~/.bashrc` or `~/.zshrc`:

```bash
alias trading-backend='cd /home/aarav/Aarav/"Tradingview recreation"/backend && source .venv/bin/activate && uvicorn app.api.main:app --reload --port 8080'
alias trading-frontend='cd /home/aarav/Aarav/"Tradingview recreation"/frontend && npm run dev -- --port 50001'
alias trading-test='cd /home/aarav/Aarav/"Tradingview recreation" && pytest -v && npx playwright test --headed'
alias trading-logs='tail -f /home/aarav/Aarav/"Tradingview recreation"/backend/logs/live_runner.log'
```

### Support

**Documentation**:
- Specification: [docs/V1_SPEC.md](V1_SPEC.md)
- Acceptance Checklist: [docs/ACCEPTANCE_CHECKLIST.md](ACCEPTANCE_CHECKLIST.md)
- Known Differences: [docs/KNOWN_DIFFERENCES.md](KNOWN_DIFFERENCES.md)

**External Resources**:
- Alpaca API Docs: https://docs.alpaca.markets/
- Alpaca Status: https://status.alpaca.markets/
- TradingView Pine Script: https://www.tradingview.com/pine-script-docs/

---

**END OF RUNBOOK**
