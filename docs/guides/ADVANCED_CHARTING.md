# Advanced Chart Techniques

> Multi-timeframe analysis, custom indicators, pattern recognition, and specialized chart overlays.

This guide goes beyond basic charting to cover techniques used by professional technical analysts. Ensure you're comfortable with the [Chart Tutorial](CHART_TUTORIAL.md) before proceeding.

---

## Table of Contents

1. [Multi-Timeframe Analysis](#multi-timeframe-analysis)
2. [Indicator Overlays and Combinations](#indicator-overlays-and-combinations)
3. [Custom Indicator Creation](#custom-indicator-creation)
4. [Pattern Recognition](#pattern-recognition)
5. [Correlation Charts](#correlation-charts)
6. [Market Profile](#market-profile)
7. [Volume Profile](#volume-profile)
8. [Advanced Drawing Techniques](#advanced-drawing-techniques)
9. [Tips](#tips)

---

## Multi-Timeframe Analysis

Analyze the same instrument across multiple timeframes simultaneously to align entries with higher-timeframe trends:

### Setup

1. Create a multi-chart layout (e.g., 1×3 for three panels).
2. Load the same symbol in all panels.
3. Set different timeframes: Weekly → Daily → 4H (or Daily → 1H → 15m for intraday).

### Methodology

| Timeframe | Purpose |
|-----------|---------|
| **Higher** (Weekly/Daily) | Identify the primary trend direction |
| **Middle** (Daily/4H) | Find the trading zone and key levels |
| **Lower** (4H/1H/15m) | Time precise entries and exits |

**Rule of thumb:** Trade in the direction of the higher timeframe. The lower timeframe is only for timing.

![Multi-Timeframe Setup](../assets/screenshots/multi-timeframe.png)

> **Tip:** Enable linked crosshairs across panels so you can see the exact position across timeframes simultaneously.

---

## Indicator Overlays and Combinations

Layer multiple indicators strategically for confirmation-based signals:

### Trend + Momentum + Volume

```
Setup:
  - 200 EMA (trend direction)
  - RSI(14) (momentum confirmation)
  - VWAP (institutional reference)
  - Volume bars with 20-period average line

Signal: Price above 200 EMA, RSI rising from < 50, price bouncing off VWAP, volume above average
```

### Volatility-Based Entries

```
Setup:
  - Bollinger Bands (20, 2)
  - Keltner Channels (20, 1.5)
  - ATR(14) in sub-panel

Signal: Bollinger Bands squeeze inside Keltner Channels → breakout
(Known as the "TTM Squeeze" setup)
```

### Ichimoku Cloud Comprehensive

```
Setup:
  - Full Ichimoku Cloud (9, 26, 52)
  - MACD(12, 26, 9) in sub-panel

Signal: Price above cloud, Tenkan crosses above Kijun, Chikou above price, MACD bullish
```

> **Note:** Avoid "indicator soup" — each indicator should add unique information. If two indicators always agree, one is redundant.

---

## Custom Indicator Creation

Build your own indicators using the strategy editor:

1. Open **Tools → Custom Indicators** or press `Ctrl+K` → type `custom indicator`.
2. Use the built-in editor to write indicator logic.

### Example: Z-Score Indicator

```typescript
function calculate(bars: Bar[], params: { period: number }): number[] {
  const closes = bars.map(b => b.close);
  return closes.map((_, i) => {
    if (i < params.period) return 0;
    const slice = closes.slice(i - params.period, i);
    const mean = slice.reduce((a, b) => a + b) / params.period;
    const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / params.period);
    return std === 0 ? 0 : (closes[i] - mean) / std;
  });
}
```

3. Set the display type: Line, Histogram, Area, or Dots.
4. Configure colors and the sub-panel vs. overlay rendering.
5. Save and the indicator appears in your indicator search.

Custom indicators are stored in IndexedDB and can be exported as JSON.

---

## Pattern Recognition

Apex Terminal includes automated pattern detection:

### Chart Patterns

Enable pattern recognition from **Indicators → Patterns**:

| Pattern | Type | Signal |
|---------|------|--------|
| Head & Shoulders | Reversal | Bearish after neckline break |
| Inverse H&S | Reversal | Bullish after neckline break |
| Double Top/Bottom | Reversal | Direction change at support/resistance |
| Triangle (Ascending) | Continuation | Bullish breakout |
| Triangle (Descending) | Continuation | Bearish breakdown |
| Flag / Pennant | Continuation | Trend continuation after pause |
| Cup & Handle | Continuation | Bullish breakout from rounded base |
| Wedge | Reversal/Continuation | Direction depends on wedge type |

Detected patterns appear as overlays on the chart with projected targets.

### Candlestick Patterns

Enable via **Indicators → Candlestick Patterns**:

- Engulfing (bullish/bearish), Doji, Hammer, Shooting Star, Morning/Evening Star, Three White Soldiers, Three Black Crows, Harami, and more.

Patterns are marked with small icons below or above the relevant candle.

![Pattern Recognition](../assets/screenshots/pattern-recognition.png)

---

## Correlation Charts

Visualize how two instruments move relative to each other:

1. Open the command bar: `Ctrl+K` → `COMP AAPL MSFT`.
2. Both securities overlay on the same chart, normalized to percentage change.
3. A rolling correlation indicator can be added as a sub-panel.
4. Scatter plot mode is available for regression analysis.

Use correlation analysis to:
- Identify hedging instruments
- Spot divergences between correlated pairs
- Confirm sector-wide moves vs. stock-specific moves

---

## Market Profile

Market Profile displays price activity as a distribution, showing where the most trading occurred:

1. Add the **Market Profile** indicator from the indicator menu.
2. Configure the session period (daily or multi-day composite).

| Concept | Description |
|---------|-------------|
| **Point of Control (POC)** | Price with the highest traded volume — fair value |
| **Value Area High (VAH)** | Upper bound of 70% volume distribution |
| **Value Area Low (VAL)** | Lower bound of 70% volume distribution |
| **Initial Balance** | First hour's range — sets the day's framework |

Market Profile helps identify acceptance/rejection of value areas and potential trend-day setups.

![Market Profile](../assets/screenshots/market-profile.png)

---

## Volume Profile

Volume Profile aggregates volume by price level over a configurable range:

1. Add the **Volume Profile** indicator.
2. Set the lookback period (visible range, session, fixed range).
3. The profile renders as a horizontal histogram on the price axis.

Key levels:
- **High Volume Nodes (HVN):** Price levels with heavy trading — act as support/resistance.
- **Low Volume Nodes (LVN):** Price levels with light trading — price moves quickly through these.
- **VPOC:** Volume Point of Control — the price with the most total volume.

Use volume profile to identify where institutional participants are positioned.

---

## Advanced Drawing Techniques

### Fibonacci Confluence Zones

Draw multiple Fibonacci retracements from different swing points. Where levels cluster (e.g., 38.2% from one swing aligns with 61.8% from another), confluence suggests strong support/resistance.

### Elliott Wave Markup

Use the Elliott Wave drawing tool to label impulsive and corrective waves. The tool enforces valid wave rules (wave 3 is never the shortest, wave 2 doesn't retrace beyond wave 1's start).

### Gann Analysis

Gann fan and Gann grid tools plot geometric angles from significant highs/lows. Popular angles: 1×1 (45°), 1×2, 2×1.

### Session Boxes

Automatically highlight specific trading sessions (e.g., London, New York, Tokyo) with colored boxes. Useful for identifying session-based support/resistance and breakout patterns.

---

## Tips

- **Start with the higher timeframe** — it provides context that the lower timeframe cannot.
- **Custom indicators are powerful** — but validate them with backtesting before relying on them.
- **Pattern recognition is probabilistic** — not every head & shoulders leads to a reversal. Always confirm with other analysis.
- **Volume Profile reveals structure** — it shows where participants are positioned, not just where price has been.
- **Less is more** — a clean chart with 2–3 focused tools beats a cluttered chart with 15 indicators.

---

*For foundational charting skills, review the [Chart Tutorial](CHART_TUTORIAL.md).*
