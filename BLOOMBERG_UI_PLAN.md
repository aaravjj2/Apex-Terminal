# Bloomberg Terminal UI Implementation Plan
## Apex Terminal — Production-Grade Bloomberg + TradingView Clone

---

## 1. Bloomberg Terminal Visual DNA

### 1.1 Core Design Principles
Bloomberg Terminal's UI is instantly recognizable due to:

| Element | Bloomberg Standard | Our Implementation |
|---------|-------------------|-------------------|
| **Background** | Pure black `#000000` or near-black `#0a0a0a` | `#0a0a0a` base, `#111111` panels |
| **Primary Accent** | Amber/Orange `#FF8C00` → `#FFA500` | `#f5a623` (warm amber) |
| **Text Color** | Bright white/grey on black | `#e8e8ee` primary, `#a0a0a8` secondary |
| **Grid System** | Dense tiled panels, no wasted space | CSS Grid with gap: 1px |
| **Typography** | Monospaced (proprietary Bloomberg font) | IBM Plex Mono / Roboto Mono |
| **Data Density** | Maximum information per pixel | Compact rows (20-24px height) |
| **Color Coding** | Green=up, Red=down, Amber=active, Blue=links | Consistent across all views |
| **Borders** | 1px solid dark grey between panels | `#1e1e1e` or `#2a2a2a` |
| **Window Chrome** | Title bar with amber text, function keys | Custom header bars per panel |

### 1.2 Bloomberg Color System (Complete)

```
/* Bloomberg Exact Palette */
--bb-bg-primary:     #000000;   /* Main background */
--bb-bg-panel:       #111111;   /* Panel background */
--bb-bg-active:      #1a1a1a;   /* Active/hover state */
--bb-bg-selected:    #1e3a5f;   /* Selected row */
--bb-border:         #1e1e1e;   /* Panel borders */
--bb-border-light:   #333333;   /* Inner dividers */

--bb-amber:          #ff8c00;   /* Primary amber (headers, active) */
--bb-amber-bright:   #ffa500;   /* Bright amber (highlights) */
--bb-amber-dim:      #c87000;   /* Dim amber (secondary) */

--bb-green:          #00c853;   /* Positive/up */
--bb-green-dim:      #1b8a4e;   /* Muted green */
--bb-red:            #ff1744;   /* Negative/down */
--bb-red-dim:        #b71c1c;   /* Muted red */

--bb-blue:           #448aff;   /* Links, interactive */
--bb-blue-dim:       #1565c0;   /* Secondary blue */
--bb-white:          #ffffff;   /* Highest emphasis */
--bb-text:           #e0e0e0;   /* Standard text */
--bb-text-dim:       #808080;   /* Muted text */
--bb-text-label:     #666666;   /* Labels, headers */

--bb-yellow:         #ffd600;   /* Warnings, highlights */
--bb-cyan:           #00bcd4;   /* Special indicators */
--bb-magenta:        #e040fb;   /* Alerts, critical */
```

### 1.3 Typography System

```
/* Bloomberg Font Stack */
--font-mono: 'IBM Plex Mono', 'Roboto Mono', 'Consolas', 'Courier New', monospace;
--font-data: 'IBM Plex Mono', monospace;  /* Numbers & data */
--font-ui:   'Inter', 'Segoe UI', system-ui, sans-serif;  /* UI labels only */

/* Sizes - Dense */
--font-xs:   10px;  /* Micro labels */
--font-sm:   11px;  /* Secondary data */
--font-md:   12px;  /* Primary data */
--font-lg:   13px;  /* Headers */
--font-xl:   14px;  /* Panel titles */
--font-xxl:  16px;  /* Section headers */
```

---

## 2. Panel Architecture

### 2.1 Bloomberg-Style Layout Grid

```
┌─────────────────────────────────────────────────────────────┐
│ [COMMAND BAR]  AAPL US Equity  │ 13:45:22 │ USER │ HELP    │
├──────────┬──────────────────────┬───────────┬───────────────┤
│ SECURITY │     CHART AREA       │  ORDER    │  WATCHLIST    │
│  DETAIL  │                      │  ENTRY    │               │
│  PANEL   │    (Main chart +     │           │  Symbol  Last │
│          │     indicators)      │  Buy/Sell │  AAPL  189.23 │
│  Name    │                      │  Qty: 100 │  MSFT  378.45 │
│  Price   │                      │  Limit    │  GOOG 2845.12 │
│  Change  │                      │  Stop     │  AMZN  178.90 │
│  Volume  │                      │           │  META  505.67 │
│  52wk    │                      │  [SEND]   │               │
├──────────┼──────────────────────┼───────────┼───────────────┤
│ DEPTH    │   HEAT MAP / SCANNER │ POSITIONS │  NEWS FEED    │
│ OF MKT   │                      │ & P&L     │               │
│          │                      │           │  14:02 Fed... │
│ Bid  Ask │   Sector Treemap     │ Sym  P&L  │  13:55 AAPL.. │
│ 189 190  │   with changes       │ AAPL +234 │  13:48 Oil... │
│ ...  ... │                      │ MSFT -120 │  13:30 Bonds. │
└──────────┴──────────────────────┴───────────┴───────────────┘
│ [STATUS BAR] Connected │ Alpaca Paper │ 2143 tests ✓ │ v2.0 │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Panel Components (Detailed List)

Each panel is a self-contained React component with:
- Amber title bar with drag handle
- Minimize/maximize/close buttons
- Resize handles (all 4 edges + corners)
- Content area with scroll
- Status row at bottom

**Required Panels (29 total):**

| # | Panel | Bloomberg Equivalent | Priority |
|---|-------|---------------------|----------|
| 1 | Command Bar | `<GO>` command line | P0 |
| 2 | Security Detail | DES / Description | P0 |
| 3 | Chart (Main) | GP / Chart | P0 |
| 4 | Watchlist | MOST / Monitor | P0 |
| 5 | Order Entry | OET / Trade Ticket | P0 |
| 6 | Position Manager | PORT / Portfolio | P0 |
| 7 | Depth of Market | BBO / Level 2 | P1 |
| 8 | Heat Map | IMAP / Heat Map | P1 |
| 9 | News Feed | TOP / News | P1 |
| 10 | Scanner/Screener | EQS / Screener | P1 |
| 11 | Alert Manager | ALRT / Alerts | P1 |
| 12 | Options Chain | OMON / Options Monitor | P1 |
| 13 | Economic Calendar | ECO / Economic | P1 |
| 14 | Sector Performance | SECF / Sector | P2 |
| 15 | Correlation Matrix | RV / Relative Value | P2 |
| 16 | Volatility Surface | OVDV / Vol Surface | P2 |
| 17 | Market Profile | MRKT / Volume Profile | P2 |
| 18 | Backtester | BTST / Backtest | P2 |
| 19 | Pattern Scanner | PTTN / Patterns | P2 |
| 20 | Risk Dashboard | RISK / Risk Monitor | P2 |
| 21 | Portfolio Analytics | PORT / Analytics | P2 |
| 22 | Multi-Asset View | ALLQ / All Quotes | P2 |
| 23 | Yield Curve | GC / Yield Curve | P3 |
| 24 | Position Sizing | Custom | P3 |
| 25 | Market Replay | Custom | P3 |
| 26 | Execution Monitor | EMSX / Execution | P3 |
| 27 | Strategy Builder | Custom Pine-like | P3 |
| 28 | Performance Report | PRTU / Attribution | P3 |
| 29 | Settings/Preferences | Custom | P3 |

---

## 3. Component Specifications

### 3.1 Command Bar (`<GO>` Bar)

Bloomberg's most iconic feature. Top-level command input.

```tsx
// CommandBar.tsx specs:
// - Full-width amber-accented input at top
// - Auto-complete dropdown (cmdk library)
// - Commands: "AAPL <EQUITY>", "GP" (chart), "DES" (description)
// - Keyboard: Enter=execute, Tab=autocomplete, Esc=clear
// - History: up/down arrows navigate previous commands
// - Style: monospace, amber cursor, #111 background

interface Command {
  name: string;          // "GP", "DES", "OMON"
  aliases: string[];     // ["CHART", "GRAPH"]
  description: string;   // "Price Chart"
  action: () => void;    // Panel opener / navigation
  shortcut?: string;     // "F6"
}
```

**Full command list (75+ commands):**
- `GP` / `CHART` — Open chart panel
- `DES` — Security description
- `BQ` — Quote details
- `MOST` / `MON` — Watchlist/monitor
- `EQS` / `SCAN` — Equity screener
- `OMON` — Options monitor
- `OET` / `TRADE` — Order entry ticket
- `PORT` — Portfolio view
- `RISK` — Risk dashboard
- `ECO` — Economic calendar
- `TOP` / `NEWS` — News feed
- `SECF` — Sector performance
- `RV` — Relative value / correlation
- `OVDV` — Volatility surface
- `ALLQ` — Multi-asset quotes
- `ANR` — Analyst recommendations
- `FA` — Financial analysis
- `GC` — Yield curve
- `IMAP` — Heat map
- `BTST` — Backtester
- `ALRT` — Alerts
- `EMSX` — Execution management
- `PRTU` — Performance attribution

### 3.2 Security Detail Panel

```
┌──────────────────────────────────┐
│ ■ AAPL US Equity          DES   │  ← Amber header
├──────────────────────────────────┤
│ Apple Inc.                       │
│ TECHNOLOGY / HARDWARE            │
│                                  │
│ Last      189.23  ▲ +2.45 +1.31%│  ← Green for up
│ Open      186.78                 │
│ High      190.12                 │
│ Low       186.45                 │
│ Volume    45.2M                  │
│ VWAP      188.67                 │
│                                  │
│ 52W High  199.62                 │
│ 52W Low   143.90                 │
│ Market Cap  2.98T                │
│ P/E       31.2                   │
│ EPS       6.06                   │
│ Div Yield 0.52%                  │
│                                  │
│ Sector    Technology             │
│ Industry  Consumer Electronics   │
│ Exchange  NASDAQ                 │
│ β(SPY)    1.23                   │
└──────────────────────────────────┘
```

### 3.3 Chart Panel (TradingView Feature Parity)

**CRITICAL — Must match TradingView exactly:**

| Feature | TradingView | Implementation |
|---------|------------|----------------|
| Candlestick chart | ✓ | lightweight-charts |
| Line/Bar/Area | ✓ | Built-in |
| Heikin Ashi | ✓ | charting_calculations_engine |
| Renko | ✓ | charting_calculations_engine |
| Drawing tools | ✓ | DrawingToolbar.tsx |
| Fibonacci suite | ✓ | chart_annotations_engine |
| Indicator overlay | ✓ | IndicatorRegistry.ts |
| Multi-chart layout | ✓ | Grid layout |
| Comparison | ✓ | overlay series |
| Pine Script equiv | Partial | Strategy builder |
| Volume profile | ✓ | charting_calculations_engine |
| VWAP | ✓ | charting_calculations_engine |
| Market profile | ✓ | charting_calculations_engine |
| Alerts from chart | ✓ | alert_engine |
| Screenshot | ✓ | html2canvas |
| Timeframes | 1m→1M | Selector |
| Fullscreen | ✓ | Panel maximize |
| Crosshair | ✓ | lightweight-charts |
| Magnet mode | ✓ | Snap to OHLCV |
| Price scale | Log/Lin/% | Built-in |

**Indicator Library (60+ indicators from our engines):**

```
Category: Trend
  - SMA, EMA, WMA, DEMA, TEMA
  - Supertrend
  - Ichimoku Cloud
  - Parabolic SAR
  - ADX/DI+/DI-

Category: Momentum
  - RSI
  - MACD
  - Stochastic
  - CCI
  - Williams %R
  - ROC
  - CMO

Category: Volatility
  - Bollinger Bands
  - ATR
  - Keltner Channels
  - Donchian Channels
  - Historical Volatility

Category: Volume
  - OBV
  - Volume Profile
  - VWAP + Bands
  - MFI (Money Flow Index)
  - CMF (Chaikin Money Flow)
  - A/D Line
  - Force Index

Category: Custom
  - Pattern Recognition overlay
  - Support/Resistance auto-detect
  - Trend line auto-detect
  - Pivot Points
  - Fibonacci auto-draw
```

### 3.4 Watchlist Panel

```
┌────────────────────────────────────────────────┐
│ ■ WATCHLIST                          MOST      │
├─────────┬────────┬────────┬─────────┬──────────┤
│ Symbol  │ Last   │ Change │ %Chg    │ Volume   │
├─────────┼────────┼────────┼─────────┼──────────┤
│ AAPL    │ 189.23 │ +2.45  │ +1.31%  │ 45.2M    │  ← Green
│ MSFT    │ 378.45 │ -1.20  │ -0.32%  │ 22.1M    │  ← Red
│ GOOG    │2845.12 │ +12.30 │ +0.43%  │ 1.2M     │  ← Green
│ AMZN    │ 178.90 │ +0.00  │  0.00%  │ 38.5M    │  ← Neutral
│ NVDA    │ 875.30 │ +15.60 │ +1.81%  │ 52.8M    │  ← Green
│ TSLA    │ 245.67 │ -8.90  │ -3.49%  │ 89.3M    │  ← Red
│ META    │ 505.67 │ +3.22  │ +0.64%  │ 15.7M    │  ← Green
│ JPM     │ 195.40 │ +1.10  │ +0.57%  │ 8.9M     │  ← Green
├─────────┴────────┴────────┴─────────┴──────────┤
│ Lists: [Favorites] [Tech] [Finance] [Custom]   │
│ Sort: [Symbol ▲] │ Filter: [All ▼]             │
│ Sparkline: [On] │ Heatmap: [Off]               │
└────────────────────────────────────────────────┘
```

Features:
- Click row → switch all panels to that symbol
- Right-click → context menu (chart, trade, details, alert)
- Mini sparkline column (last 50 bars)
- Color-coded background rows for P&L heat
- Drag-drop reorder
- Multiple watchlist tabs
- Real-time updates via WebSocket

### 3.5 Order Entry (Trade Ticket)

```
┌──────────────────────────────┐
│ ■ ORDER ENTRY          OET   │
├──────────────────────────────┤
│ AAPL US Equity               │
│ Last: 189.23  Bid: 189.22    │
│              Ask: 189.24     │
│                              │
│ Side:  [● BUY] [○ SELL]     │
│                              │
│ Type:  [LIMIT ▼]            │
│ Qty:   [100        ]        │
│ Price: [189.22     ]        │
│ TIF:   [DAY ▼]              │
│                              │
│ Est. Cost: $18,922.00        │
│ Commission: ~$0.50           │
│ Buying Power: $245,678       │
│                              │
│ ┌──── Position Sizing ─────┐ │
│ │ Method: [Percent Risk ▼] │ │
│ │ Risk:   2.0%             │ │
│ │ Stop:   [185.00]         │ │
│ │ Sug. Qty: 474            │ │
│ │ Risk $: $2,000.00        │ │
│ └──────────────────────────┘ │
│                              │
│ [████ SEND ORDER ████]       │  ← Amber button
│                              │
│ Position: 500 @ 186.50       │
│ Unrealized P&L: +$1,365.00  │
└──────────────────────────────┘
```

### 3.6 Heat Map Panel

```
┌──────────────────────────────────────────────────────┐
│ ■ SECTOR HEAT MAP                           IMAP     │
├──────────────────────────────────────────────────────┤
│ ┌──────────────────┬──────────┬──────────────────┐   │
│ │                  │          │                  │   │
│ │   AAPL +1.31%    │MSFT      │    GOOG +0.43%   │   │
│ │   (green bg)     │-0.32%    │    (green bg)    │   │
│ │                  │(red bg)  │                  │   │
│ ├──────────────────┼──────────┼──────────────────┤   │
│ │   NVDA +1.81%    │ TSLA     │    META +0.64%   │   │
│ │   (bright green) │ -3.49%   │    (dim green)   │   │
│ │                  │(bright   │                  │   │
│ │                  │ red)     │                  │   │
│ ├──────────────────┴──────────┴──────────────────┤   │
│ │            FINANCIALS  │   HEALTHCARE          │   │
│ │   JPM +0.57%  BAC +0.2│  UNH -0.1%  JNJ -0.3 │   │
│ └────────────────────────┴───────────────────────┘   │
│ View: [Sector▼] Color: [Change▼] Size: [MarketCap▼] │
└──────────────────────────────────────────────────────┘
```

### 3.7 Options Chain (OMON)

```
┌──────────────────────────────────────────────────────────────┐
│ ■ OPTIONS MONITOR  AAPL US Equity                    OMON    │
├──────────────────────────────────────────────────────────────┤
│ Expiry: [Jun 21, 2024 ▼]  Days: 45  IV: 28.5%               │
├────────────────────────┬──────┬───────────────────────────────┤
│       CALLS            │Strike│          PUTS                 │
├──────┬──────┬──────┬───┼──────┼───┬──────┬──────┬────────────┤
│ Last │ Bid  │ Ask  │ IV│      │IV │ Bid  │ Ask  │ Last       │
├──────┼──────┼──────┼───┼──────┼───┼──────┼──────┼────────────┤
│ 9.50 │ 9.40 │ 9.60 │24%│ 180  │22%│ 0.35 │ 0.40 │ 0.38      │
│ 5.20 │ 5.10 │ 5.30 │26%│ 185  │25%│ 0.85 │ 0.95 │ 0.90      │
│ 2.15 │ 2.10 │ 2.20 │28%│ 190  │28%│ 2.80 │ 2.90 │ 2.85  ←ATM│
│ 0.65 │ 0.60 │ 0.70 │31%│ 195  │30%│ 5.30 │ 5.40 │ 5.35      │
│ 0.15 │ 0.10 │ 0.20 │35%│ 200  │33%│ 9.80 │ 9.90 │ 9.85      │
├──────┴──────┴──────┴───┴──────┴───┴──────┴──────┴────────────┤
│ Greeks: [On]  Vol Surface: [Show]  Strategy: [None ▼]        │
│ Δ: 0.52  Γ: 0.034  Θ: -0.12  V: 0.28  ρ: 0.08              │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. TradingView Feature Parity Checklist

### 4.1 Chart Features
- [x] Candlestick, Line, Bar, Area charts
- [x] Heikin Ashi, Renko, Kagi, P&F, Line Break
- [x] 60+ technical indicators
- [x] Drawing tools (lines, channels, Fibonacci, Gann)
- [x] Volume profile & VWAP
- [x] Multiple chart layouts (1/2/4/6/8 panels)
- [x] Chart comparison (overlay symbols)
- [x] Timeframe selector (1m to 1M)
- [x] Log/Linear/Percentage scale
- [ ] Replay mode (backend done, needs UI)
- [ ] Alerts from chart context
- [ ] Screenshot capture
- [ ] Template save/load
- [ ] Indicator search & favorites

### 4.2 Screener Features
- [x] Stock screener with 50+ filters
- [x] Scanner presets (momentum, volume, etc.)
- [x] Custom filter expressions
- [ ] Screener results → chart integration
- [ ] Alert on screener match
- [ ] Heatmap view of results

### 4.3 Alert System
- [x] Price alerts (above/below/cross)
- [x] Volume alerts
- [x] Indicator-based alerts
- [x] Portfolio alerts (P&L, drawdown)
- [x] News/sentiment alerts
- [ ] Alert notification UI (toast + sound)
- [ ] Alert management panel
- [ ] Webhook integration UI

### 4.4 Trading Features
- [x] Order entry (market/limit/stop)
- [x] Position management
- [x] Execution algorithms (backend)
- [x] Position sizing (10 methods)
- [ ] DOM/ladder order entry
- [ ] Trade ticket from chart right-click
- [ ] Bracket orders UI
- [ ] P&L visualization on chart

### 4.5 Analytics
- [x] Portfolio analytics (Sharpe, Sortino, max DD)
- [x] Risk management (exposure, margin, Greeks)
- [x] Backtesting engine (8 strategies)
- [x] Correlation analysis
- [x] Pattern recognition
- [x] Options pricing (BS, Greeks)
- [x] Volatility surface
- [ ] Backtester UI with equity curve
- [ ] Risk dashboard panel
- [ ] Performance attribution visual

---

## 5. Implementation Phases

### Phase A: Core Shell (Weeks 1-2)
**Files to create/modify:**
1. `frontend/src/layouts/BloombergShell.tsx` — Main layout grid
2. `frontend/src/components/CommandBar.tsx` — `<GO>` command bar
3. `frontend/src/components/PanelContainer.tsx` — Draggable/resizable panel wrapper
4. `frontend/src/components/StatusBar.tsx` — Bottom status bar
5. `frontend/src/stores/panelStore.ts` — Panel state management (zustand)
6. `frontend/src/stores/symbolStore.ts` — Cross-panel symbol sync
7. `frontend/src/theme/bloomberg.ts` — Complete Bloomberg theme tokens
8. `frontend/src/theme/bloomberg.css` — CSS custom properties

**Key decisions:**
- Use CSS Grid for main layout: `grid-template-rows: 36px 1fr 24px`
- Panel system: react-grid-layout for drag/resize
- Command bar: cmdk library (already installed)
- State sync: zustand with shallow comparison

### Phase B: Data Panels (Weeks 3-4)
1. `SecurityDetailPanel.tsx` — DES equivalent
2. `WatchlistPanel.tsx` — MOST equivalent (enhance existing)
3. `NewsFeedPanel.tsx` — TOP equivalent
4. `DepthOfMarketPanel.tsx` — BBO/Level 2
5. `EconomicCalendarPanel.tsx` — ECO equivalent
6. Upgrade existing chart to Bloomberg styling

### Phase C: Trading Panels (Weeks 5-6)
1. `OrderEntryPanel.tsx` — OET with position sizing
2. `PositionManagerPanel.tsx` — PORT positions tab
3. `ExecutionMonitorPanel.tsx` — EMSX equivalent
4. `AlertManagerPanel.tsx` — ALRT management

### Phase D: Analytics Panels (Weeks 7-8)
1. `HeatMapPanel.tsx` — IMAP sector treemap
2. `OptionsChainPanel.tsx` — OMON with Greeks
3. `VolSurfacePanel.tsx` — OVDV 3D surface
4. `CorrelationMatrixPanel.tsx` — RV matrix
5. `ScannerPanel.tsx` — EQS screener

### Phase E: Advanced Panels (Weeks 9-10)
1. `BacktestPanel.tsx` — Equity curve, strategy builder
2. `RiskDashboardPanel.tsx` — Risk overview
3. `PortfolioAnalyticsPanel.tsx` — Attribution, allocation
4. `PatternScannerPanel.tsx` — Auto-detected patterns
5. `MarketReplayPanel.tsx` — Historical replay controls
6. `PositionSizerPanel.tsx` — Kelly, percent-risk UI
7. `YieldCurvePanel.tsx` — Term structure visualization

### Phase F: Polish (Weeks 11-12)
1. Keyboard shortcuts (Bloomberg-style function keys)
2. Multi-window support (undock panels)
3. Layout save/restore
4. Dark/light theme (default dark)
5. Responsive for large monitors (4K+)
6. Performance optimization (virtualized lists)
7. Accessibility (ARIA labels, keyboard nav)
8. Loading states, error boundaries

---

## 6. Keyboard Shortcuts Map

| Key | Action | Bloomberg Equiv |
|-----|--------|----------------|
| `F1` | Help panel | F1 |
| `F2` | Command bar focus | HOME |
| `F3` | News feed | N |
| `F5` | Refresh data | F5 |
| `F6` | Chart panel | F6 |
| `F7` | Order entry | F7 |
| `F8` | Portfolio | F8 |
| `F9` | Heat map | F9 |
| `Ctrl+1-9` | Switch to panel slot | Function |
| `Ctrl+N` | New watchlist | |
| `Ctrl+F` | Find/search | |
| `Ctrl+Shift+C` | Command palette | |
| `Esc` | Close panel/dialog | |
| `Tab` | Next field | |
| `Enter` | Execute command | |
| `↑/↓` | Navigate list | |
| `Space` | Toggle selection | |

---

## 7. WebSocket Data Flow

```
Browser → WebSocket → Backend
  ├── Channel: "quotes"      → Real-time price updates
  ├── Channel: "trades"      → Live trades/executions
  ├── Channel: "orderbook"   → L2 depth updates
  ├── Channel: "alerts"      → Alert triggers
  ├── Channel: "news"        → News feed
  ├── Channel: "positions"   → Position changes
  └── Channel: "system"      → Health, status

Data format:
{
  "channel": "quotes",
  "symbol": "AAPL",
  "data": {
    "last": 189.23,
    "bid": 189.22,
    "ask": 189.24,
    "volume": 45200000,
    "change": 2.45,
    "change_pct": 1.31,
    "timestamp": 1709123456789
  }
}
```

---

## 8. File Structure (Frontend)

```
frontend/src/
├── layouts/
│   └── BloombergShell.tsx          # Main grid layout
├── components/
│   ├── CommandBar.tsx              # <GO> command bar
│   ├── PanelContainer.tsx          # Draggable panel wrapper
│   ├── StatusBar.tsx               # Bottom status bar
│   └── common/
│       ├── DataGrid.tsx            # Bloomberg-style data grid
│       ├── MiniChart.tsx           # Sparkline component
│       ├── ColorCell.tsx           # Green/red value cell
│       ├── TickerTape.tsx          # Scrolling ticker
│       └── AmberHeader.tsx         # Panel header bar
├── panels/
│   ├── SecurityDetailPanel.tsx
│   ├── WatchlistPanel.tsx
│   ├── ChartPanel.tsx
│   ├── OrderEntryPanel.tsx
│   ├── PositionManagerPanel.tsx
│   ├── DepthOfMarketPanel.tsx
│   ├── HeatMapPanel.tsx
│   ├── NewsFeedPanel.tsx
│   ├── ScannerPanel.tsx
│   ├── AlertManagerPanel.tsx
│   ├── OptionsChainPanel.tsx
│   ├── EconomicCalendarPanel.tsx
│   ├── CorrelationMatrixPanel.tsx
│   ├── VolSurfacePanel.tsx
│   ├── MarketProfilePanel.tsx
│   ├── BacktestPanel.tsx
│   ├── PatternScannerPanel.tsx
│   ├── RiskDashboardPanel.tsx
│   ├── PortfolioAnalyticsPanel.tsx
│   ├── MultiAssetPanel.tsx
│   ├── PositionSizerPanel.tsx
│   ├── MarketReplayPanel.tsx
│   ├── ExecutionMonitorPanel.tsx
│   ├── YieldCurvePanel.tsx
│   ├── SectorPerformancePanel.tsx
│   ├── PerformanceReportPanel.tsx
│   ├── StrategyBuilderPanel.tsx
│   └── SettingsPanel.tsx
├── stores/
│   ├── panelStore.ts               # Panel layout state
│   ├── symbolStore.ts              # Active symbol
│   ├── themeStore.ts               # Theme preferences
│   ├── alertStore.ts               # Alert notifications
│   └── wsStore.ts                  # WebSocket connection
├── theme/
│   ├── bloomberg.ts                # Theme tokens
│   ├── bloomberg.css               # CSS variables
│   └── components.css              # Component styles
├── hooks/
│   ├── useWebSocket.ts             # WS connection hook
│   ├── useRealTimeQuote.ts         # Quote subscription
│   ├── usePanel.ts                 # Panel management
│   └── useCommand.ts               # Command execution
└── features/
    └── chart/                      # Existing chart features
        ├── AdvancedChartEngine.tsx
        ├── IndicatorRegistry.ts
        ├── IndicatorPicker.tsx
        └── DrawingToolbar.tsx
```

---

## 9. Backend API Integration Map

| Frontend Panel | Backend API Endpoints |
|----------------|----------------------|
| Chart | `/api/v1/ta-indicators/*`, `/api/v2/charting/*` |
| Watchlist | `/api/v2/watchlists/*` |
| Order Entry | `/api/v2/orders/*`, `/api/v2/sizing/*` |
| Positions | `/api/v2/orders/positions/*` |
| Heat Map | `/api/v2/heatmap/*` |
| Scanner | `/api/v1/scanner/*` |
| Alerts | `/api/v2/alerts/*` |
| Options | `/api/v1/options-pricing/*` |
| Vol Surface | `/api/v2/vol-surface/*` |
| Correlation | `/api/v2/correlation/*` |
| Economic Cal | `/api/v2/economic-calendar/*` |
| Backtest | `/api/v2/backtest/*` |
| Patterns | `/api/v2/patterns/*` |
| Multi-Asset | `/api/v2/multi-asset/*` |
| Market Replay | `/api/v2/replay/*` |
| Risk | `/api/v1/risk-management/*` |
| Portfolio | `/api/v1/portfolio-analytics/*` |
| News | `/api/v1/news-sentiment/*` |
| Market Data | `/api/v2/market-data/*` |
| Execution | `/api/v1/execution/*` |
| Position Sizing | `/api/v2/sizing/*` |

---

## 10. Performance Targets

| Metric | Target |
|--------|--------|
| First paint | < 1.5s |
| Chart render (1000 bars) | < 200ms |
| WebSocket latency | < 50ms |
| Panel resize | 60fps |
| Watchlist update (100 symbols) | < 16ms |
| Memory (10 panels open) | < 300MB |
| Bundle size (gzipped) | < 500KB |
| Largest Contentful Paint | < 2.5s |

---

## 11. Accessibility

- WCAG 2.1 AA compliance
- All panels keyboard-navigable
- ARIA roles: region, grid, dialog, toolbar
- High contrast mode (amber on black already high contrast)
- Screen reader support for data grids
- Focus management for panel switching
- Color-blind safe alternatives (patterns + shapes)

---

*Document Version: 2.0 — Apex Terminal Bloomberg UI Plan*
*Generated: Session 2143-test milestone*
*Backend engines: 20+ (all tested, all routes registered)*
*Total test count: 2143 passed*
