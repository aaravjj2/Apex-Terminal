# Backtest Tutorial

> Validate your trading strategies with historical data before risking real capital.

Apex Terminal's backtesting engine lets you define strategies, run them against historical data, analyze detailed performance metrics, and perform walk-forward optimization to guard against overfitting.

---

## Table of Contents

1. [Opening the Backtester](#opening-the-backtester)
2. [Selecting a Strategy](#selecting-a-strategy)
3. [Configuring Parameters](#configuring-parameters)
4. [Choosing a Date Range](#choosing-a-date-range)
5. [Running the Backtest](#running-the-backtest)
6. [Reading Results](#reading-results)
7. [Optimization](#optimization)
8. [Walk-Forward Analysis](#walk-forward-analysis)
9. [Tips and Pitfalls](#tips-and-pitfalls)

---

## Opening the Backtester

Access the backtest module via:

- **Command bar:** `Ctrl+K` → type `backtest`
- **Sidebar:** Click the flask icon in the left sidebar
- **Menu:** Tools → Backtesting

The backtester opens as a dedicated workspace panel that can be resized alongside charts.

![Backtest Panel](../assets/screenshots/backtest-panel.png)

---

## Selecting a Strategy

1. Click **Select Strategy** at the top of the backtest panel.
2. Choose from built-in strategies or your custom strategies:
   - **Moving Average Crossover** — dual MA with configurable fast/slow periods
   - **RSI Mean Reversion** — overbought/oversold entries with RSI
   - **Breakout** — price breaks above/below N-period high/low
   - **MACD Signal** — MACD line crossing signal line
   - **Custom** — strategies you've coded via the strategy editor
3. Click a strategy to load it and view its configurable parameters.

---

## Configuring Parameters

Each strategy exposes tunable parameters:

| Parameter | Example (MA Crossover) | Description |
|-----------|----------------------|-------------|
| Fast Period | 10 | Short-term moving average length |
| Slow Period | 50 | Long-term moving average length |
| MA Type | EMA | SMA, EMA, WMA, or HMA |
| Position Size | 100% | Percentage of equity per trade |
| Commission | 0.1% | Per-trade commission cost |
| Slippage | 0.05% | Simulated execution slippage |

Adjust values using the input fields. Changes reflect in the strategy summary below.

> **Tip:** Start with default parameters to establish a baseline, then optimize incrementally.

---

## Choosing a Date Range

1. Set the **Start Date** and **End Date** using the date pickers.
2. Alternatively, use quick-select buttons: 1Y, 3Y, 5Y, 10Y, Max.
3. The data availability indicator shows whether historical data exists for the selected range.

> **Note:** Longer date ranges provide more statistical significance but take longer to process. 3–5 years is a good default for most equity strategies.

---

## Running the Backtest

1. Verify your symbol, strategy, parameters, and date range.
2. Click **Run Backtest**. A progress bar shows completion status.
3. The engine processes bar-by-bar, simulating entries and exits according to your rules.
4. Results populate automatically when the run completes.

Backtests run in a Web Worker to keep the UI responsive. Complex strategies over long periods may take 10–30 seconds.

---

## Reading Results

Results are presented across several tabs:

### Equity Curve

A line chart showing portfolio value over time, with drawdown shading.

![Equity Curve](../assets/screenshots/backtest-equity-curve.png)

### Performance Metrics

| Metric | Description |
|--------|-------------|
| Total Return | Net profit as percentage of starting equity |
| CAGR | Compound annual growth rate |
| Sharpe Ratio | Risk-adjusted return (annualized) |
| Sortino Ratio | Downside-risk-adjusted return |
| Max Drawdown | Largest peak-to-trough decline |
| Win Rate | Percentage of profitable trades |
| Profit Factor | Gross profit ÷ gross loss |
| Avg Trade P&L | Mean profit/loss per trade |
| Total Trades | Number of round-trip trades |

### Trade List

A table of every trade with entry/exit dates, prices, P&L, and duration. Click any trade to highlight it on the equity curve.

---

## Optimization

Find the best parameter combination:

1. Click the **Optimize** tab.
2. Define parameter ranges (e.g., Fast Period: 5–30, step 5).
3. Select the optimization target: Sharpe Ratio, Total Return, or Profit Factor.
4. Click **Run Optimization**. The engine tests all combinations.
5. Results appear in a heatmap and ranked table.

![Optimization Heatmap](../assets/screenshots/backtest-optimization.png)

> **Warning:** Optimizing too many parameters simultaneously risks overfitting. Limit to 2–3 parameters at a time.

---

## Walk-Forward Analysis

Walk-forward analysis validates optimization results out-of-sample:

1. Switch to the **Walk-Forward** tab.
2. Set the **in-sample** period (e.g., 2 years) and **out-of-sample** period (e.g., 6 months).
3. The engine slides this window forward through history, optimizing in-sample and testing out-of-sample.
4. A combined equity curve from all out-of-sample segments is produced.
5. Compare in-sample vs. out-of-sample Sharpe ratios to assess robustness.

This is the gold standard for strategy validation — if out-of-sample performance matches in-sample, the strategy is likely robust.

---

## Tips and Pitfalls

- **Avoid lookahead bias** — never use future data in your entry/exit logic.
- **Account for costs** — always include realistic commission and slippage.
- **Beware survivorship bias** — use data that includes delisted securities if possible.
- **Don't over-optimize** — a strategy that works on 1000 parameter sets is more robust than one that works on 3.
- **Walk-forward is essential** — never deploy a strategy that hasn't passed out-of-sample testing.

---

*Next: [Options Tutorial](OPTIONS_TUTORIAL.md) to explore options analytics.*
