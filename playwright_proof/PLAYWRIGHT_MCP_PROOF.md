# Playwright MCP Non-Headless Live Browser Test — Proof Report

**Date**: 2026-02-24  
**Tool**: Playwright MCP (mcp_io_github_chr_*) — non-headless Chrome  
**Target**: `http://localhost:5100/ui2/backtest`  
**Backend**: FastAPI on port 8000  

---

## Test Summary

All 5 tabs of BacktestUI2 were verified live in a real browser with real API calls.

| Tab | Status | Evidence |
|---|---|---|
| New Run | ✅ PASS | Strategy dropdown populated from `/api/backtest/strategies` (4 strategies) |
| Runs | ✅ PASS | DataTable shows completed + failed runs with all columns |
| Results | ✅ PASS | 14 KPI cards + equity curve canvas + drawdown canvas + trades table |
| Compare | ✅ PASS | Side-by-side metrics table + equity overlay canvas |
| Data Health | ✅ PASS | Coverage table, Refresh updates AAPL to OK with 1759 rows |

---

## Evidence: Backtests Executed

### Run 1 — SMA Crossover
| Metric | Value |
|---|---|
| Run ID | `run-2fad319c0358` |
| Symbol | AAPL |
| Strategy | `sma-crossover` |
| Date Range | 2019-02-24 → 2026-02-24 |
| Status | COMPLETED |
| CAGR | 8.51% |
| Total Return | 77.10% |
| Sharpe | 0.76 |
| Sortino | 0.60 |
| Max DD | -23.57% |
| Win Rate | 40% |
| Profit Factor | 1.97 |
| Expectancy | $3,855.81 |
| Final Equity | $177,096.14 |
| Trades | 20 |
| Exposure | 25% |
| Turnover | 39.2x |
| Data Hash | `c7469ba366fa…` |
| Provider | yfinance |

### Run 2 — RSI Mean Reversion
| Metric | Value |
|---|---|
| Run ID | `run-8b9b7fecab86` |
| Symbol | AAPL |
| Strategy | `rsi-mean-reversion` |
| Date Range | 2019-02-24 → 2026-02-24 |
| Status | COMPLETED |
| CAGR | 7.81% |
| Total Return | 69.19% |
| Sharpe | 0.75 |
| Sortino | 0.43 |
| Max DD | -16.47% |
| Win Rate | 61.5% |
| Profit Factor | 3.22 |
| Expectancy | $5,323.34 |
| Final Equity | $169,190.44 |
| Trades | 13 |

---

## Evidence: Compare Tab

`run-2fad319c0358` vs `run-8b9b7fecab86`:

| Metric | SMA (A) | RSI (B) | Δ |
|---|---|---|---|
| CAGR (%) | 8.51 | 7.81 | -0.70 |
| Total Return (%) | 77.10 | 69.19 | -7.91 |
| Sharpe Ratio | 0.76 | 0.75 | -0.01 |
| Sortino Ratio | 0.60 | 0.43 | -0.17 |
| Max Drawdown (%) | -23.57 | -16.47 | +7.10 |
| Win Rate (%) | 40.00 | 61.50 | +21.50 |
| Total Trades | 20 | 13 | -7 |
| Profit Factor | 1.97 | 3.22 | +1.25 |
| Expectancy ($) | 3,855.81 | 5,323.34 | +1,467.53 |
| Final Equity ($) | 177,096.14 | 169,190.44 | -7,905.70 |

---

## Evidence: Data Health (after Refresh)

| Symbol | Status | Rows | Earliest | Latest | Missing% | Provider | Last Fetch |
|---|---|---|---|---|---|---|---|
| AAPL | **OK** | 1759 | 2019-02-25 | 2026-02-23 | 0% | yfinance | 2026-02-24 |
| SPY | NOT PRIMED | - | - | - | - | - | - |
| MSFT | NOT PRIMED | - | - | - | - | - | - |
| … | NOT PRIMED | - | - | - | - | - | - |

---

## Evidence: API Routes (confirmed on fresh server)

```
['/api/backtest/run',
 '/api/backtest/runs',
 '/api/backtest/run/{run_id}',
 '/api/backtest/run/{run_id}/artifacts',
 '/api/backtest/compare',
 '/api/backtest/strategies',    ← NEW
 '/api/backtest/data/health',   ← NEW
 '/api/backtest/data/prime']    ← NEW
```

---

## Screenshots

| File | Content |
|---|---|
| 01_new_run_tab.png | New Run form with strategy dropdown populated |
| 02_backtest_result_preview.png | Post-run preview with CAGR/Sharpe/MaxDD/WinRate |
| 03_results_tab_kpis.png | Full Results tab with 14 KPI cards |
| 04_runs_tab.png | Runs DataTable with completed/failed runs |
| 05_compare_tab.png | Compare tab with side-by-side metrics |
| 06_data_health_tab.png | Data Health (before refresh, all NOT PRIMED) |
| 07_data_health_refreshed.png | Data Health (after refresh, AAPL = OK) |
| 08_results_fullpage.png | Full-page Results tab with canvas charts |

---

## Test Verdict: ✅ ALL PASS

The BacktestUI2 is fully functional end-to-end:
- Real yfinance data (7y AAPL history, 1759 days)
- Real strategy simulation (SMA Crossover, RSI Mean Reversion)
- Real metrics computed server-side
- Provenance tracking (SHA256 hash, provider)
- All 5 UI tabs operational
- Live browser, non-headless, Playwright MCP
