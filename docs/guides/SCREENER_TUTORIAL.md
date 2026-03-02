# Using the Stock Screener

> Find trading opportunities by filtering the universe with fundamental and technical criteria.

The screener lets you define custom filters, combine fundamental data with technical indicators, and scan in real time. Save your screens for repeated use and export results for further analysis.

---

## Table of Contents

1. [Accessing the Screener](#accessing-the-screener)
2. [Creating a Custom Screen](#creating-a-custom-screen)
3. [Fundamental Filters](#fundamental-filters)
4. [Technical Filters](#technical-filters)
5. [Using Presets](#using-presets)
6. [Saving Screens](#saving-screens)
7. [Real-Time Scanning](#real-time-scanning)
8. [Exporting Results](#exporting-results)
9. [Tips](#tips)

---

## Accessing the Screener

- **Command bar:** `Ctrl+K` → type `screener` or `screen`
- **Sidebar:** Click the funnel icon
- **Top menu:** Tools → Screener

The screener opens with a filter panel on the left and results table on the right.

![Screener Overview](../assets/screenshots/screener-overview.png)

---

## Creating a Custom Screen

1. Click **New Screen** to start with a blank filter set.
2. Click **Add Filter** to choose a criterion.
3. Configure the filter's operator and value (e.g., "Market Cap > $10B").
4. Add additional filters — they combine with AND logic by default.
5. Click **Run Screen** to execute. Results populate the table.

Filters are applied server-side for performance. The backend scans the full universe and returns matching symbols.

---

## Fundamental Filters

Available fundamental criteria:

| Filter | Description | Example |
|--------|-------------|---------|
| Market Cap | Total market capitalization | > $1B |
| P/E Ratio | Price to earnings | 10–25 |
| P/B Ratio | Price to book value | < 3 |
| Dividend Yield | Annual dividend / price | > 2% |
| Revenue Growth | Year-over-year revenue change | > 10% |
| EPS Growth | Earnings per share growth | > 15% |
| Debt/Equity | Total debt / shareholder equity | < 1.0 |
| ROE | Return on equity | > 15% |
| Sector | GICS sector classification | Technology |
| Country | Exchange country | US |

Combine multiple fundamental filters to narrow the universe to your criteria.

---

## Technical Filters

Overlay technical conditions on the screened results:

| Filter | Description | Example |
|--------|-------------|---------|
| Price vs. SMA | Price relative to moving average | Above 200-day SMA |
| RSI | Relative Strength Index | RSI(14) < 30 |
| MACD | MACD signal crossover | Bullish cross today |
| Volume | Average daily volume | > 1M shares |
| ATR | Average True Range | ATR(14) > $2 |
| 52-Week Range | Position within yearly range | Within 10% of 52W high |
| Bollinger Bands | Price vs. bands | Below lower band |
| New High/Low | Making new highs or lows | New 20-day high |

> **Tip:** Combining "RSI < 30" with "Price above 200-day SMA" creates a classic mean-reversion screen on uptrending stocks.

---

## Using Presets

Apex Terminal includes built-in screen presets for common strategies:

- **Value Stocks** — Low P/E, low P/B, high dividend yield
- **Growth Monsters** — High revenue growth, high EPS growth
- **Momentum** — Near 52-week high, above all key SMAs
- **Oversold Bounce** — RSI < 30, positive MACD divergence
- **High Volume Breakouts** — Price at new high, volume > 2× average
- **Dividend Aristocrats** — Consistent dividend growth > 10 years
- **Small Cap Gems** — Market cap $300M–$2B, ROE > 20%

Click a preset to load its filters. You can modify any preset and save as your own.

---

## Saving Screens

1. Configure your filters.
2. Click **Save Screen** (disk icon).
3. Name it (e.g., "My Value Screen").
4. Access saved screens from the **Saved** dropdown at any time.

Screens are stored in IndexedDB and persist across sessions. Export/import screens as JSON for sharing.

---

## Real-Time Scanning

The **Scanner** mode runs your screen continuously against live data:

1. Click the **Scanner** toggle next to **Run Screen**.
2. The screen re-evaluates every 30 seconds (configurable).
3. New matches appear highlighted at the top of the results.
4. Symbols that no longer match are grayed out and eventually removed.

The scanner is useful for intraday setups — for example, alerting when a stock's RSI drops below 30 in real time.

> **Note:** Real-time scanning increases data consumption. Limit the number of active filters for best performance.

---

## Exporting Results

Export screener results for external analysis:

- **CSV** — Click **Export → CSV** for spreadsheet-compatible output
- **JSON** — Click **Export → JSON** for programmatic use
- **Clipboard** — Click **Copy** to copy the results table to clipboard

Exported data includes all visible columns plus the raw filter values.

---

## Tips

- **Start broad, then narrow** — begin with a few filters and add more to refine.
- **Combine fundamental + technical** — the best screens use both.
- **Save your best screens** — build a library of go-to screens for different market regimes.
- **Use the scanner for timing** — screen for candidates fundamentally, then scan technically for entries.
- **Review results critically** — screens find candidates, not certainties. Always do further analysis.

---

*Next: [Alerts Tutorial](ALERTS_TUTORIAL.md) to get notified when conditions are met.*
