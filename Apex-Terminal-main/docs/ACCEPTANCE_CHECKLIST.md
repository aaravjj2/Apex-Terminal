# ACCEPTANCE CHECKLIST

**Project**: FREE-ONLY LOCAL-FIRST Trading System  
**Version**: 1.0  
**Date**: January 27, 2026

## PASS/FAIL CRITERIA

This checklist must be 100% complete with all items marked ✅ before the system is considered production-ready.

---

## 1. DATA PIPELINE

### 1.1 Downloader Implementation
- [ ] ✅ Alpaca API integration with proper authentication
- [ ] ✅ Support for multi-symbol batch requests
- [ ] ✅ Pagination with `next_page_token` handled correctly
- [ ] ✅ Downloads complete dataset for ALL symbols (not just first)
- [ ] ✅ Supports 30Min timeframe (primary)
- [ ] ✅ Supports 5Min timeframe (optional)
- [ ] ✅ Date range configurable (start/end)
- [ ] ✅ Incremental updates (re-run only fetches missing bars)
- [ ] ✅ Dry-run mode (1-2 days, 1-2 symbols) completes in < 30s

### 1.2 Data Validation
- [ ] ✅ Bar count check: ~13 bars/day for 30Min RTH
- [ ] ✅ Gap detection: flags missing bars
- [ ] ✅ Duplicate detection: no duplicate timestamps per symbol
- [ ] ✅ Timezone verification: UTC storage, ET conversion
- [ ] ✅ Monotonic timestamp check: strictly increasing per symbol
- [ ] ✅ Corporate action flagging: warns about splits/dividends

### 1.3 Storage
- [ ] ✅ Parquet format with pyarrow
- [ ] ✅ Partition scheme: `symbol=X/year=Y/month=M/data.parquet`
- [ ] ✅ Metadata file: source, timeframe, date range, validation hash
- [ ] ✅ Idempotent writes: re-run doesn't duplicate data
- [ ] ✅ Read function loads filtered data efficiently

### 1.4 End-to-End Data Test
```bash
# Test command
python -m backend.app.data.downloader download \
  --symbols SPY,QQQ,AAPL,MSFT,NVDA,AMZN,META,GLD \
  --start 2024-01-01 \
  --end 2024-01-31 \
  --timeframe 30Min

# Expected outcome
```
- [ ] ✅ Downloads complete without errors
- [ ] ✅ Parquet files created in correct directory structure
- [ ] ✅ Metadata.json generated with correct stats
- [ ] ✅ Validation report shows 0 critical issues
- [ ] ✅ Re-run is idempotent (no duplicate bars)

---

## 2. BACKTEST ENGINE

### 2.1 Core Engine
- [ ] ✅ Bar-close deterministic processing
- [ ] ✅ No lookahead: indicators computed on closed bars only
- [ ] ✅ Daily filter uses PREVIOUS day's close (no lookahead)
- [ ] ✅ Fill model: MOC (market-on-close) implemented
- [ ] ✅ Fill model: NBO (next-bar-open) implemented
- [ ] ✅ Slippage configurable in ticks (default 1 tick = $0.01)
- [ ] ✅ Commission configurable (default 0% for Alpaca)
- [ ] ✅ Fractional shares: on/off toggle

### 2.2 Portfolio Constraints
- [ ] ✅ Max positions: enforced (default 8)
- [ ] ✅ Position size: enforced (default $1000/trade)
- [ ] ✅ Max allocation: enforced (default 15% per position)
- [ ] ✅ Long-only: no shorts allowed
- [ ] ✅ Cash availability check before entry
- [ ] ✅ Rejection logging: reason captured when trade rejected

### 2.3 Session Handling
- [ ] ✅ RTH only: 09:30-16:00 ET enforced
- [ ] ✅ Bar alignment: 30Min bars match 09:30, 10:00, 10:30...
- [ ] ✅ Pre-market/after-hours bars excluded

### 2.4 Output
- [ ] ✅ Results JSON with run_id, config, metrics
- [ ] ✅ Summary metrics: total PnL, trade count, win rate, profit factor, max DD, Sharpe
- [ ] ✅ Per-symbol breakdown: trades, PnL, win rate for each ticker
- [ ] ✅ Equity curve: timestamp + equity value array
- [ ] ✅ Trade log: entry/exit times, prices, PnL, engine, reason

### 2.5 Determinism Test
```bash
# Run same backtest 3 times
for i in {1..3}; do
  python -m backend.app.backtest.engine run \
    --symbols SPY,QQQ \
    --start 2024-01-01 \
    --end 2024-01-31 \
    --fill-model MOC \
    --slippage 1 \
    --output run_$i.json
done

# Compare outputs
diff run_1.json run_2.json
diff run_2.json run_3.json
```
- [ ] ✅ All 3 runs produce identical output (byte-for-byte)
- [ ] ✅ Equity curves match exactly
- [ ] ✅ Trade logs match exactly

### 2.6 Single Symbol Test
```bash
python -m backend.app.backtest.engine run \
  --symbols SPY \
  --start 2024-01-01 \
  --end 2024-12-31 \
  --fill-model MOC
```
- [ ] ✅ Completes in < 2 minutes
- [ ] ✅ Produces valid results.json
- [ ] ✅ Metrics calculated correctly
- [ ] ✅ Equity curve has > 0 data points

### 2.7 Basket Test
```bash
python -m backend.app.backtest.engine run \
  --symbols SPY,QQQ,AAPL,MSFT,NVDA,AMZN,META,GLD \
  --start 2024-01-01 \
  --end 2024-12-31 \
  --fill-model MOC
```
- [ ] ✅ Completes in < 5 minutes
- [ ] ✅ All 8 symbols processed
- [ ] ✅ Per-symbol results present for all symbols
- [ ] ✅ Portfolio constraints enforced (max 8 positions)

---

## 3. STRATEGY MODULE

### 3.1 Indicators
- [ ] ✅ VWAP: intraday anchored at 09:30 ET, resets daily
- [ ] ✅ EMA(20): exponential moving average
- [ ] ✅ EMA(50): exponential moving average
- [ ] ✅ RSI(14): relative strength index
- [ ] ✅ ATR(14): average true range
- [ ] ✅ ADX(14): average directional index (Wilder)
- [ ] ✅ +DI, -DI: directional indicators

### 3.2 Engine A: Trend Pullback/Reclaim
- [ ] ✅ Daily filter: yesterday close > SMA(200)
- [ ] ✅ VWAP rising: slope > 0
- [ ] ✅ EMA alignment: EMA(20) > EMA(50)
- [ ] ✅ ADX threshold: ADX > 20
- [ ] ✅ Directional: +DI > -DI
- [ ] ✅ Touch: price touched below VWAP in last N bars
- [ ] ✅ Reclaim: current bar closes above VWAP
- [ ] ✅ Exit: price closes below EMA(20) OR RSI > 70

### 3.3 Engine B: Mean Reversion
- [ ] ✅ Daily filter: yesterday close > SMA(200)
- [ ] ✅ RSI oversold: RSI < 30
- [ ] ✅ Above VWAP: price > VWAP
- [ ] ✅ Low trend: ADX < 25
- [ ] ✅ Exit: RSI > 50 OR price closes below VWAP

### 3.4 DRY Principle
- [ ] ✅ Single strategy module file: `vwap_dual_engine.py`
- [ ] ✅ Used by backtest engine (import verified)
- [ ] ✅ Used by live runner (import verified)
- [ ] ✅ No duplicated logic between backtest and live

### 3.5 TradingView Parity Config
- [ ] ✅ Session times: 09:30-16:00 ET
- [ ] ✅ Bar alignment: configurable (30Min default)
- [ ] ✅ Fill model: MOC or NBO selectable
- [ ] ✅ Slippage: ticks configurable
- [ ] ✅ Commission: percent configurable
- [ ] ✅ Fractional shares: on/off toggle

---

## 4. LIVE PAPER TRADING RUNNER

### 4.1 Connection
- [ ] ✅ Alpaca Paper API authenticated
- [ ] ✅ Paper account verified (not production)
- [ ] ✅ Positions retrievable
- [ ] ✅ Orders retrievable
- [ ] ✅ Account info retrievable

### 4.2 Runner Logic
- [ ] ✅ Polls Alpaca every 30 minutes for latest bars
- [ ] ✅ Computes signals using same strategy module as backtest
- [ ] ✅ Submits orders to Alpaca Paper
- [ ] ✅ Logs every decision: bar, indicators, signal, order
- [ ] ✅ Handles market hours: only trades 09:30-16:00 ET
- [ ] ✅ Handles order rejections gracefully

### 4.3 Live Test
```bash
# Start runner
python -m backend.app.live.runner start \
  --symbols SPY,QQQ \
  --timeframe 30Min
```
- [ ] ✅ Runner starts without errors
- [ ] ✅ Connects to Alpaca Paper
- [ ] ✅ Logs signals correctly
- [ ] ✅ Submits at least 1 order (if signal present)
- [ ] ✅ Order visible in Alpaca Paper dashboard
- [ ] ✅ Position visible in system dashboard

### 4.4 Mismatch Documentation
- [ ] ✅ Documented: backtest MOC vs live market order timing
- [ ] ✅ Documented: perfect backtest fills vs real slippage
- [ ] ✅ Documented: backtest assumes no partial fills vs live reality
- [ ] ✅ Documented: expected variance range (e.g., ±0.5% PnL)

---

## 5. DASHBOARD (REACT)

### 5.1 Routes
- [ ] ✅ `/` - Overview page implemented
- [ ] ✅ `/backtest` - Backtest results viewer implemented
- [ ] ✅ `/live` - Live positions page implemented
- [ ] ✅ `/console` - Strategy log viewer (existing)
- [ ] ✅ `/data` - Data management page implemented

### 5.2 Backtest Page Features
- [ ] ✅ "Run Backtest" button present
- [ ] ✅ Config form: symbols, date range, fill model, slippage
- [ ] ✅ Triggers API call to `/api/backtest/run`
- [ ] ✅ Displays metrics summary on completion
- [ ] ✅ Equity curve chart renders correctly
- [ ] ✅ Per-symbol table shows trades, PnL, win rate
- [ ] ✅ Trade log table with filters (symbol, engine)

### 5.3 Live Page Features
- [ ] ✅ Current positions table: symbol, qty, avg price, current price, P&L
- [ ] ✅ Recent signals log: timestamp, symbol, engine, reason
- [ ] ✅ Account info: equity, buying power, cash
- [ ] ✅ Auto-refresh toggle (updates every 30s)

### 5.4 Data Page Features
- [ ] ✅ Download status: symbols, date range, bar count
- [ ] ✅ Validation report: gaps, duplicates, issues
- [ ] ✅ "Download Data" button triggers download
- [ ] ✅ Progress indicator during download

### 5.5 UI/UX Test
- [ ] ✅ Dashboard loads in < 3 seconds
- [ ] ✅ No console errors in browser devtools
- [ ] ✅ Responsive design works on 1920x1080 and 1366x768
- [ ] ✅ Charts render without flickering
- [ ] ✅ Buttons are clickable and provide feedback

---

## 6. API ENDPOINTS

### 6.1 Backtest Endpoints
- [ ] ✅ `POST /api/backtest/run` - Trigger backtest
  - Request: `{symbols, start, end, fill_model, slippage, commission}`
  - Response: `{run_id, status}`
- [ ] ✅ `GET /api/backtest/results/{run_id}` - Get results
  - Response: Full backtest results JSON
- [ ] ✅ `GET /api/backtest/list` - List past runs
  - Response: Array of {run_id, timestamp, symbols, metrics_summary}

### 6.2 Data Endpoints
- [ ] ✅ `POST /api/data/download` - Trigger download
  - Request: `{symbols, start, end, timeframe}`
  - Response: `{task_id, status}`
- [ ] ✅ `GET /api/data/status` - Get download status
  - Response: `{task_id, progress_pct, eta}`
- [ ] ✅ `GET /api/data/validation` - Get validation report
  - Response: Validation report JSON

### 6.3 Live Endpoints (Existing)
- [ ] ✅ `GET /api/alpaca/positions` - Get live positions
- [ ] ✅ `GET /api/alpaca/account` - Get account info
- [ ] ✅ `GET /api/alpaca/orders` - Get order history
- [ ] ✅ `GET /api/strategy/logs` - Get strategy decision log
- [ ] ✅ `POST /api/strategy/force-check` - Manual signal check

### 6.4 API Test
```bash
# Test backtest endpoint
curl -X POST http://localhost:8080/api/backtest/run \
  -H "Content-Type: application/json" \
  -d '{"symbols":["SPY"],"start":"2024-01-01","end":"2024-01-31","fill_model":"MOC"}'

# Expected: {"run_id": "...", "status": "running"}
```
- [ ] ✅ Returns 200 status
- [ ] ✅ Returns valid JSON
- [ ] ✅ `run_id` is present and unique

---

## 7. TESTING

### 7.1 Backend Tests (pytest)
- [ ] ✅ `test_downloader.py`: pagination test passes
- [ ] ✅ `test_downloader.py`: validation test passes
- [ ] ✅ `test_storage.py`: write/read parquet test passes
- [ ] ✅ `test_backtest.py`: determinism test passes
- [ ] ✅ `test_backtest.py`: portfolio constraints test passes
- [ ] ✅ `test_strategy.py`: engine A logic test passes
- [ ] ✅ `test_strategy.py`: engine B logic test passes
- [ ] ✅ `test_strategy.py`: indicator calculation test passes
- [ ] ✅ All tests pass: `pytest -v` shows 0 failures

### 7.2 Frontend Tests (Playwright)
- [ ] ✅ `backtest.spec.ts`: Dashboard loads
- [ ] ✅ `backtest.spec.ts`: Run backtest button works
- [ ] ✅ `backtest.spec.ts`: Results display correctly
- [ ] ✅ `live.spec.ts`: Live page shows positions
- [ ] ✅ All tests pass: `npx playwright test --headed` shows 0 failures

### 7.3 End-to-End Script
```bash
./scripts/e2e_test.sh
# 1. Downloads 2 days of SPY data
# 2. Runs backtest on that data
# 3. Starts backend + frontend
# 4. Runs Playwright tests
# 5. Verifies outputs
```
- [ ] ✅ Script completes without errors
- [ ] ✅ Download step succeeds
- [ ] ✅ Backtest step succeeds
- [ ] ✅ Dashboard serves correctly
- [ ] ✅ Playwright tests pass
- [ ] ✅ Outputs verified (results.json exists and valid)

---

## 8. DOCUMENTATION

### 8.1 Files Present
- [ ] ✅ `docs/V1_SPEC.md` - Complete specification
- [ ] ✅ `docs/ACCEPTANCE_CHECKLIST.md` - This file
- [ ] ✅ `docs/RUNBOOK.md` - Operational guide
- [ ] ✅ `docs/KNOWN_DIFFERENCES.md` - TradingView comparison

### 8.2 RUNBOOK.md Content
- [ ] ✅ Bootstrap command documented
- [ ] ✅ Download command documented with examples
- [ ] ✅ Backtest command documented with examples
- [ ] ✅ Serve command documented
- [ ] ✅ Paper runner command documented
- [ ] ✅ Testing commands documented
- [ ] ✅ Troubleshooting section included

### 8.3 KNOWN_DIFFERENCES.md Content
- [ ] ✅ VWAP calculation comparison
- [ ] ✅ Bar alignment comparison
- [ ] ✅ Fill model comparison (MOC vs live market)
- [ ] ✅ Slippage comparison
- [ ] ✅ Commission comparison
- [ ] ✅ Expected variance quantified (e.g., ±0.5% PnL)

---

## 9. ENVIRONMENT

### 9.1 Dependencies
- [ ] ✅ `backend/requirements.txt` complete
- [ ] ✅ Python 3.11+ specified
- [ ] ✅ All packages installable via pip
- [ ] ✅ `frontend/package.json` complete
- [ ] ✅ Node 18+ specified
- [ ] ✅ All packages installable via npm

### 9.2 Environment Variables
- [ ] ✅ `.env.example` provided
- [ ] ✅ `ALPACA_API_KEY` documented
- [ ] ✅ `ALPACA_API_SECRET` documented
- [ ] ✅ `ALPACA_PAPER_BASE_URL` documented
- [ ] ✅ `ALPACA_DATA_BASE_URL` documented
- [ ] ✅ No secrets committed to repo

### 9.3 Bootstrap Test
```bash
./scripts/bootstrap.sh
```
- [ ] ✅ Creates venv in `backend/.venv`
- [ ] ✅ Installs Python deps without errors
- [ ] ✅ Runs `pytest` and all tests pass
- [ ] ✅ Installs Node deps in `frontend/node_modules`
- [ ] ✅ Runs `npm run build` successfully

---

## 10. MANDATORY 3-LOOP SEQUENCE

### Loop 1: Bug-Fix Loop
```bash
cd backend && pytest -v
# Fix any failures
# Rerun until 100% pass
```
- [ ] ✅ All pytest tests pass (0 failures)
- [ ] ✅ Coverage > 80% for core modules

### Loop 2: Playwright Loop (NON-HEADLESS ONLY)
```bash
cd frontend && npx playwright test --headed
# Watch tests run in browser
# Fix any failures
# Rerun until 100% pass
```
- [ ] ✅ All Playwright tests pass (0 failures)
- [ ] ✅ Screenshots captured for each test
- [ ] ✅ No console errors in browser logs

### Loop 3: End-to-End Loop
```bash
./scripts/e2e_test.sh
# Download → Backtest → Serve → Verify
# Fix any failures
# Rerun until 100% pass
```
- [ ] ✅ Download completes successfully
- [ ] ✅ Backtest produces valid output
- [ ] ✅ Dashboard serves and responds
- [ ] ✅ Playwright verification passes
- [ ] ✅ Output files present and valid

---

## 11. PRODUCTION READINESS

### 11.1 Performance
- [ ] ✅ Download 30 days, 8 symbols completes in < 5 minutes
- [ ] ✅ Backtest 12 months, 8 symbols completes in < 5 minutes
- [ ] ✅ Dashboard initial load < 3 seconds
- [ ] ✅ API response times < 500ms (95th percentile)

### 11.2 Reliability
- [ ] ✅ System recovers from Alpaca API timeout (retry logic)
- [ ] ✅ System handles partial fills in live runner
- [ ] ✅ System detects and logs data quality issues
- [ ] ✅ No unhandled exceptions in logs (past 24h test run)

### 11.3 Observability
- [ ] ✅ Logs written to `backend/logs/` directory
- [ ] ✅ Log level configurable (DEBUG, INFO, ERROR)
- [ ] ✅ Backtest results archived with timestamp
- [ ] ✅ Live runner decisions logged with full context

---

## FINAL CHECKLIST

- [ ] ✅ ALL items above marked complete (100%)
- [ ] ✅ No critical bugs remaining
- [ ] ✅ All tests passing (pytest + Playwright + E2E)
- [ ] ✅ Documentation complete and accurate
- [ ] ✅ System runs end-to-end without manual intervention
- [ ] ✅ Live paper trading verified with real orders
- [ ] ✅ TradingView comparison documented

---

## SIGN-OFF

**Completed By**: ________________  
**Date**: ________________  
**Notes**: ________________

---

**Status**: 🔴 In Progress | 🟡 Partial | 🟢 Complete

**Current Status**: 🔴 In Progress (0% complete)

**Next Actions**:
1. Implement data downloader
2. Run pytest loop
3. Implement backtest engine
4. Run Playwright loop
5. Run E2E loop
6. Repeat until 100% ✅
