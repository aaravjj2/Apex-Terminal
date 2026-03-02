# Portfolio Management Tutorial

> Track positions, optimize allocation, analyze risk, and compare against benchmarks.

Apex Terminal's portfolio module combines position tracking with Markowitz mean-variance optimization, risk attribution, and performance analytics. This guide walks through the full workflow.

---

## Table of Contents

1. [Accessing the Portfolio Module](#accessing-the-portfolio-module)
2. [Adding Positions](#adding-positions)
3. [Viewing Allocation](#viewing-allocation)
4. [Running Optimization](#running-optimization)
5. [Analyzing Risk Metrics](#analyzing-risk-metrics)
6. [Rebalancing](#rebalancing)
7. [Performance Attribution](#performance-attribution)
8. [Benchmark Comparison](#benchmark-comparison)
9. [Tips](#tips)

---

## Accessing the Portfolio Module

- **Command bar:** `Ctrl+K` → type `portfolio`
- **Sidebar:** Click the briefcase icon
- **Top menu:** Views → Portfolio

The module opens with your current holdings, allocation chart, and performance summary.

![Portfolio Overview](../assets/screenshots/portfolio-overview.png)

---

## Adding Positions

1. Click **Add Position** in the portfolio toolbar.
2. Enter the symbol, quantity, and average entry price.
3. Optionally set the acquisition date for time-weighted return calculations.
4. Click **Add**. The position appears in the holdings table.

Positions can also be auto-populated from filled orders in the trading blotter.

| Field | Description |
|-------|-------------|
| Symbol | Ticker of the instrument |
| Quantity | Number of shares or contracts held |
| Avg Price | Average cost basis per unit |
| Current Price | Live market price |
| Market Value | Quantity × Current Price |
| P&L | Unrealized profit or loss |
| Weight | Position's percentage of total portfolio value |

> **Tip:** Import positions from a CSV file via **Portfolio → Import** for bulk entry.

---

## Viewing Allocation

The allocation panel shows your portfolio composition through multiple lenses:

- **Pie chart** — visual weight of each position
- **Sector breakdown** — allocation by GICS sector
- **Asset class** — equities, options, fixed income, cash
- **Geography** — domestic vs. international exposure

Click any segment to drill down into individual holdings within that group.

![Allocation Chart](../assets/screenshots/portfolio-allocation.png)

---

## Running Optimization

Markowitz mean-variance optimization finds the efficient frontier for your holdings:

1. Click the **Optimize** tab in the portfolio panel.
2. Select the assets to include (defaults to all current holdings).
3. Set constraints:
   - Minimum / maximum weight per asset (e.g., 5%–25%)
   - Target return or target volatility
   - Allow / disallow short selling
4. Click **Run Optimization**. The efficient frontier chart renders.
5. Click any point on the frontier to view the suggested allocation.

![Efficient Frontier](../assets/screenshots/efficient-frontier.png)

The tangency portfolio (maximum Sharpe ratio) is highlighted automatically.

> **Note:** Optimization uses historical return and covariance data. Past performance doesn't guarantee future results.

---

## Analyzing Risk Metrics

The risk tab displays key portfolio-level statistics:

| Metric | Description |
|--------|-------------|
| Portfolio Beta | Sensitivity to the benchmark index |
| Sharpe Ratio | Return per unit of total risk |
| Sortino Ratio | Return per unit of downside risk |
| Max Drawdown | Largest peak-to-trough decline |
| VaR (95%) | Maximum expected loss at 95% confidence (1-day) |
| CVaR (95%) | Expected loss beyond VaR threshold |
| Volatility | Annualized standard deviation of returns |
| Correlation Matrix | Pairwise correlations between holdings |

Click **Stress Test** to simulate portfolio impact under historical crisis scenarios (2008, 2020, etc.).

---

## Rebalancing

When actual allocation drifts from your target:

1. Set target weights in the **Targets** column of the holdings table.
2. Click **Calculate Rebalance**. The platform computes the trades needed.
3. Review the suggested buy/sell orders with estimated costs.
4. Click **Execute Rebalance** to generate the orders automatically.

> **Tip:** Set a drift threshold (e.g., 5%) in Settings → Portfolio. The platform alerts you when any position deviates beyond the threshold.

---

## Performance Attribution

Understand what drove returns:

- **Asset attribution** — contribution of each holding to total return
- **Sector attribution** — performance by sector relative to benchmark
- **Factor attribution** — exposure to market, size, value, momentum factors

The attribution chart shows return decomposition over your selected time period.

![Performance Attribution](../assets/screenshots/performance-attribution.png)

---

## Benchmark Comparison

1. Select a benchmark from the dropdown: S&P 500, NASDAQ 100, Russell 2000, or a custom index.
2. The performance chart overlays your portfolio return against the benchmark.
3. Key comparison metrics include Alpha, Beta, Tracking Error, and Information Ratio.

---

## Tips

- **Diversify across sectors** — concentration in a single sector amplifies drawdowns.
- **Rebalance periodically** — quarterly or when drift exceeds 5%.
- **Use optimization as a guide** — don't blindly follow the tangency portfolio. Apply judgment.
- **Monitor correlations** — during crises, correlations spike. Stress testing reveals this.
- **Track attribution over time** — consistent alpha from specific holdings validates your thesis.

---

*Next: [Risk Tutorial](RISK_TUTORIAL.md) for a deep dive into risk analytics.*
