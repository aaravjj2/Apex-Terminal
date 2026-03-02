# Chart Usage Tutorial

> Master charting — from basic navigation to multi-chart layouts with indicators and drawing tools.

Apex Terminal's charting engine is built on lightweight-charts and extended with custom overlays, 35+ indicators, and 70+ drawing tools. This tutorial covers everything you need to get productive.

---

## Table of Contents

1. [Adding Symbols](#adding-symbols)
2. [Changing Timeframes](#changing-timeframes)
3. [Switching Chart Types](#switching-chart-types)
4. [Adding Indicators](#adding-indicators)
5. [Using Drawing Tools](#using-drawing-tools)
6. [Multi-Chart Layouts](#multi-chart-layouts)
7. [Saving Chart Templates](#saving-chart-templates)
8. [Keyboard Shortcuts](#keyboard-shortcuts)

---

## Adding Symbols

Load a symbol onto any chart panel:

1. Click the **symbol field** in the chart header and type a ticker.
2. Press `Ctrl+K` and enter a ticker to load it into the active chart.
3. Drag a symbol from the watchlist and drop it onto a chart panel.

The chart immediately fetches historical data from the backend and begins streaming real-time updates via WebSocket.

![Add Symbol](../assets/screenshots/chart-add-symbol.png)

---

## Changing Timeframes

The timeframe selector is in the chart toolbar. Available intervals:

| Category | Options |
|----------|---------|
| Intraday | 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h |
| Daily+ | 1D, 1W, 1M |

Click a timeframe button or use keyboard shortcuts:

- `1` — 1 minute
- `5` — 5 minutes
- `D` — Daily
- `W` — Weekly

> **Tip:** Hold `Shift` while clicking a timeframe to apply it across all charts in the current workspace.

---

## Switching Chart Types

Apex Terminal supports 7 chart types. Switch via the chart-type dropdown in the toolbar:

1. **Candlestick** — Traditional OHLC candles (default)
2. **OHLC Bars** — Open-high-low-close bar chart
3. **Line** — Close-price line chart
4. **Area** — Filled area under the close line
5. **Heikin-Ashi** — Smoothed candles for trend identification
6. **Renko** — Price-movement bricks ignoring time
7. **Baseline** — Above/below a reference price with color coding

![Chart Types](../assets/screenshots/chart-types.png)

---

## Adding Indicators

1. Click the **Indicators** button (fx icon) in the toolbar, or press `I`.
2. Search by name — e.g., "RSI", "MACD", "Bollinger".
3. Click an indicator to add it. Overlays appear on the price chart; oscillators open in a sub-panel.
4. Click the gear icon on any active indicator to adjust parameters.
5. Drag the divider between the price chart and sub-panels to resize.

**Popular indicators available:**

- Moving Averages (SMA, EMA, WMA, VWMA, HMA)
- MACD, RSI, Stochastic, CCI, Williams %R
- Bollinger Bands, Keltner Channels, Donchian Channels
- Volume Profile, OBV, MFI, VWAP
- Ichimoku Cloud, Parabolic SAR, ADX
- ATR, Standard Deviation, Historical Volatility

> **Note:** You can stack up to 10 indicators on a single chart. Beyond that, consider multi-chart layouts for clarity.

---

## Using Drawing Tools

The drawing toolbar sits on the left edge of the chart. Tools are grouped into categories:

| Category | Examples |
|----------|----------|
| **Lines** | Trend line, horizontal line, vertical line, ray, channel |
| **Fibonacci** | Retracement, extension, fan, arc, time zones |
| **Shapes** | Rectangle, circle, triangle, arrow |
| **Patterns** | Head & shoulders, Elliott wave, ABCD, Gann |
| **Measurement** | Price range, date range, bars pattern |
| **Text** | Note, callout, price label |

**To draw:**

1. Select a tool from the sidebar (or press its hotkey).
2. Click on the chart to place the first anchor point.
3. Click again to place additional points. The tool snaps to OHLC values by default.
4. Double-click or press `Escape` to finish.

Right-click any drawing to edit properties (color, line style, thickness) or delete it.

![Drawing Tools](../assets/screenshots/drawing-tools.png)

> **Tip:** Press `Ctrl+Z` to undo the last drawing action. `Ctrl+Shift+Z` to redo.

---

## Multi-Chart Layouts

View multiple charts simultaneously:

1. Click the **Layout** button in the top bar.
2. Choose a grid: 1×1, 1×2, 2×1, 2×2, 1×3, 3×1, or custom.
3. Each cell is an independent chart with its own symbol, timeframe, and indicators.
4. Drag panel borders to resize. The layout uses `react-resizable-panels` for fluid resizing.
5. Click a chart cell to make it the **active chart** — indicator additions and symbol changes apply to it.

![Multi-Chart Layout](../assets/screenshots/multi-chart-layout.png)

> **Tip:** Use linked crosshairs (toggle in settings) to synchronize the crosshair position across all charts.

---

## Saving Chart Templates

Save your indicator and drawing setup as a reusable template:

1. Configure your chart with the desired indicators, drawing tools, and settings.
2. Click the **Template** button (disk icon) → **Save as Template**.
3. Name the template (e.g., "Swing Setup", "Scalping View").
4. To apply a saved template, click **Template** → select from the list.

Templates store: chart type, indicators with parameters, drawing tools, color scheme, and timeframe.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `I` | Open indicator search |
| `D` | Switch to daily timeframe |
| `Ctrl+Z` | Undo last drawing |
| `Ctrl+Shift+Z` | Redo drawing |
| `Alt+H` | Toggle horizontal line tool |
| `Alt+T` | Toggle trend line tool |
| `Delete` | Remove selected drawing |
| `Escape` | Cancel current drawing or deselect |
| `+` / `-` | Zoom in / out |
| `Home` | Jump to latest bar |

---

*Next: [Backtest Tutorial](BACKTEST_TUTORIAL.md) to validate your strategies.*
