# Demo/index.html — Comprehensive Structural Analysis

> **Purpose**: React frontend implementation spec derived from the vanilla HTML/CSS/JS reference at `demo/index.html` (4,775 lines).

---

## 1. All Views / Pages with `data-view` IDs

| # | `data-view` ID | Element ID | View Title | Nav Group | Lines (approx) | Sub-tabs / Sections |
|---|---------------|-----------|------------|-----------|----------------|---------------------|
| 1 | `trading` | `view-trading` | Trading / Chart | TRADE | 600–640 | Chart header (symbol/price/OHLCV/timeframes/controls), Drawing tools strip, Main chart canvas + RSI canvas, Replay bar |
| 2 | `dashboard` | `view-dashboard` | Dashboard | TRADE | 640–720 | 8 KPIs, Equity curve canvas, Sector chart canvas, Top movers list, News feed, Market indices, Economic events |
| 3 | `portfolio` | `view-portfolio` | Portfolio | TRADE | 720–810 | KPIs, Positions table, Allocation bars, Equity curve canvas, P&L chart. **Enhanced tabs**: Positions, Efficient Frontier (Markowitz), P&L Attribution (Brinson + Factor), Transactions |
| 4 | `orders` | `view-orders` | Orders / Blotter | TRADE | 810–960 | **5 sub-tabs**: Open Orders, Pending, Filled, Cancelled, Blotter. Each has a full table with columns and action buttons |
| 5 | `risk` | `view-risk` | Risk Management | TRADE | 960–1060 | 3 risk metric cards (VaR/CVaR/Beta), Stress test grid (8 scenarios), Position risk table, Correlation heatmap canvas |
| 6 | `heatmap` | `view-heatmap` | Market Heatmap | TRADE | injected ~3800 | Treemap canvas (8 sectors with individual stocks), Filter pills (market cap/timeframe), Legend |
| 7 | `backtest` | `view-backtest` | Backtest | STRAT | 1060–1180 | Config panel (strategy/symbol/dates/capital/sizing), Results strip (4 metrics), Equity curve canvas, Drawdown canvas, Monthly returns heatmap grid, Trade list table |
| 8 | `walkforward` | `view-walkforward` | Walk-Forward | STRAT | 1180–1240 | KPIs, 6 walk-forward period cards (IS/OOS Sharpe), OOS equity chart canvas, Parameter stability cards |
| 9 | `montecarlo` | `view-montecarlo` | Monte Carlo | STRAT | 1240–1310 | Stats strip (5 metrics), Config panel, Equity path distribution canvas (60 sim paths + percentile bands), Return distribution canvas, Drawdown distribution canvas |
| 10 | `strategy` | `view-strategy` | Strategy Studio | STRAT | 1310–1430 | Code editor (Python strategy textarea), Live metrics cards, Signal log table, Parameter sweep heatmap canvas |
| 11 | `options` | `view-options` | Options Chain | MKTS | 1430–1560 | Expiry selector, Options chain table (calls/puts with greeks), Portfolio greeks. **Enhanced tabs**: Chain, IV Surface (3D heatmap + smile + term structure), Payoff Diagram (8 strategies), Options Scanner (unusual activity flow) |
| 12 | `screener` | `view-screener` | Screener | MKTS | 1560–1690 | **2 sub-tabs**: Screener (filter pills, presets, results table), Real-Time Scanner (scan types, results) |
| 13 | `alerts` | `view-alerts` | Alerts | MKTS | 1690–1780 | Triggered alerts list, Active alerts list, Create alert form (symbol/type/condition/value/notify/repeat) |
| 14 | `macro` | `view-macro` | Economic Calendar | MKTS | 1780–1870 | Impact filter pills, Country filter pills, Day-grouped rows calendar table (time/impact/currency/event/actual/forecast/previous) |
| 15 | `research` | `view-research` | Research / Sentiment | MKTS | 1870–2000 | **3-column**: Sentiment panel (Fear & Greed index, social sentiment bars, put/call ratios), News & Research (filterable feed), Fundamentals (24+ metrics + analyst ratings bar chart) |
| 16 | `social` | `view-social` | Ideas / Social | MKTS | injected ~3850 | **3-column**: Popular ideas (4 cards), Publish idea form + feed, Top contributors + trending tags |
| 17 | `autopilot` | `view-autopilot` | Autopilot / AI | special | 2000–2130 | **3-column**: Agent controls (5 toggle switches + agent registry), Trade proposals (4 cards with approve/modify/reject), Agent reasoning (timestamped thoughts + ML predictions) |
| 18 | `compliance` | `view-compliance` | Compliance | SYSTEM | 2130–2280 | KPIs, **2-column**: Pre-trade checks (7 items with PASS/WARN/FAIL badges), Audit trail table, Surveillance section, Regulatory reporting |
| 19 | `platform` | `view-platform` | Platform / Observability | SYSTEM | 2280–2400 | KPIs, **2-column**: Services list (6 services with latency), Latency chart canvas, Run history, Logs (monospace terminal-style) |
| 20 | `fixedincome` | `view-fixedincome` | Fixed Income | ASSET | injected ~3600 | KPIs, **4 tabs**: Yield Curve (canvas + comparison table), Bond Search (table), Analytics (duration/spread/cash flow), Credit Spreads (CDS rates table) |
| 21 | `fx` | `view-fx` | FX Analytics | ASSET | injected ~3700 | KPIs, Cross-rate matrix (8×8 currencies), Forward points table, Central bank tracker (4 banks), FX vol surface canvas |
| 22 | `commodities` | `view-commodities` | Commodities | ASSET | injected ~3750 | KPIs (7 commodities), Futures curve canvas, Commodity tracker table, Seasonality canvas, Spread analysis, EIA inventory |
| 23 | `crypto` | `view-crypto` | Crypto Analytics | ASSET | injected ~3780 | KPIs, On-chain exchange flows canvas, Liquidations canvas, Crypto market table (8 assets), On-chain analytics (Bitcoin metrics + DeFi overview) |

### View Rendering Notes

- **Static views** (1–19): Defined inline in the HTML body.
- **Injected views** (20–23 + 6 + 16): Created dynamically via `injectViews()` on `DOMContentLoaded`. HTML is inserted via `content.insertAdjacentHTML('beforeend', ...)`.
- **Enhanced views** (3, 11): `enhancePortfolioView()` and `enhanceOptionsView()` add sub-tabs to existing views using `insertAdjacentElement`. Protected by `dataset.enhanced` guard flag.

---

## 2. Left Navigation Structure

### Container
- Element: `#leftnav`
- Width: `48px` (CSS grid column)
- Background: `var(--bg0)` (`#0C0E12`)
- Border: right border `1px solid var(--bdr)`
- Layout: `flex-direction: column`, centered items, vertical scrolling (scrollbar hidden)

### Item Architecture
Each nav item is a `div.nav-item` with:
- `data-view="<viewId>"` attribute
- `onclick="switchView('<viewId>')"`
- SVG icon (15×15 or 16×16, stroke-based)
- Tooltip: `span.nav-tip` (appears on hover, positioned to the right)
- Active state: `.active` class → blue left bar indicator, blue icon color, blue background tint
- Size: `40px × 34px`, border-radius `6px`

### Full Item Order (top to bottom)

```
┌─────────────────────────────────────────┐
│  .nav-logo (SVG hexagon + chart icon)   │
│                                         │
│  ★ Autopilot / AI (.nav-item-autopilot) │
│  ─── separator (.nav-sep) ───           │
│                                         │
│  ▼ TRADE (expanded by default)          │
│    ├── Trading ✦ (active by default)    │
│    ├── Dashboard                        │
│    ├── Portfolio                        │
│    ├── Orders / Blotter                 │
│    ├── Risk Management                  │
│    └── Market Heatmap                   │
│                                         │
│  ▶ STRAT (collapsed)                    │
│    ├── Backtest                         │
│    ├── Walk-Forward                     │
│    ├── Monte Carlo                      │
│    └── Strategy Studio                  │
│                                         │
│  ▶ MKTS (collapsed)                     │
│    ├── Options Chain                    │
│    ├── Screener                         │
│    ├── Alerts                           │
│    ├── Economic Calendar                │
│    ├── Research / Sentiment             │
│    └── Ideas / Social                   │
│                                         │
│  ▶ ASSET (collapsed)                    │
│    ├── Fixed Income                     │
│    ├── FX Analytics                     │
│    ├── Commodities                      │
│    └── Crypto Analytics                 │
│                                         │
│  ── .nav-spacer (flex: 1) ──            │
│                                         │
│  SYSTEM (.nav-group-bottom)             │
│    ├── Compliance                       │
│    └── Platform                         │
└─────────────────────────────────────────┘
```

### Group Behavior
- Each group is `div.nav-group` with `data-group="trade|strat|mkts|asset"`
- Groups have `nav-group-expanded` or `nav-group-collapsed` CSS classes
- Group labels show ▼ (expanded) or ▶ (collapsed) chevron
- `toggleNavGroup(el)` toggles between expanded/collapsed
- Collapsed groups hide child `.nav-item` elements
- SYSTEM group has no collapse behavior (always visible, pushed to bottom via `.nav-spacer`)

---

## 3. Right Sidebar Structure

### Container
- Element: `#rightsidebar`
- Width: `286px` (CSS grid column)
- Background: `var(--bg0)` (`#0C0E12`)
- Border: left border `1px solid var(--bdr)`
- Layout: `flex-direction: column`

### Tab Bar
6 tabs in `.s-tabs`:

| Tab Label | Content ID | Active by Default |
|-----------|-----------|-------------------|
| Order | `sc-order` | ✅ |
| Watch | `sc-watchlist` | |
| Pos | `sc-positions` | |
| News | `sc-news` | |
| L2 | `sc-depth` | |
| T&S | `sc-ts` | |

Tab switching: `onclick="switchSidebarTab(this,'<tabId>')"`

### Tab Content Details

#### 3a. Order Ticket (`sc-order`)
```
┌───────────────────────────────────┐
│ Symbol Bar (sym + exchange + price│
│   + change %) — .ot-sym-bar      │
│                                   │
│ Direction Toggle — .dir-grp       │
│   [BUY] [SELL]                    │
│                                   │
│ Order Type — <select>             │
│   Market / Limit / Stop /         │
│   Stop Limit / Trailing Stop /    │
│   TWAP / VWAP / MOC / LOC        │
│                                   │
│ Quantity — <input type="number">  │
│ Limit Price — <input> (conditional│
│   visibility via updateOrderType) │
│                                   │
│ Time in Force — <select>          │
│   DAY / GTC / GTD / IOC / FOK    │
│                                   │
│ Stop Loss — <input>               │
│ Take Profit — <input>             │
│                                   │
│ Order Summary — .ot-summary       │
│   Est. Value / Commission /       │
│   Buying Power / Portfolio %      │
│                                   │
│ Risk Check — .ot-risk             │
│   "✓ All pre-trade checks passed" │
│                                   │
│ [SUBMIT BUY ORDER] — .ot-submit   │
└───────────────────────────────────┘
```

#### 3b. Watchlist (`sc-watchlist`)
- Header with "WATCHLIST" + "+" add button
- Scrollable list of `.wl-row` items
- Each row: symbol name, price, change %
- Clickable rows call `setSymbol()`
- Symbols: AAPL, TSLA, SPY, AMZN, GOOGL, MSFT, NVDA, META, BTC, ETH, SOL, SPX, QQQ, NFLX, AMD

#### 3c. Positions Mini (`sc-positions`)
- Header: "POSITIONS" + count badge
- Compact position cards showing:
  - Symbol, Qty, Direction (LONG/SHORT)
  - Entry price, Last price
  - P&L (color-coded up/dn)

#### 3d. News (`sc-news`)
- Filter input at top
- Scrollable news items with:
  - Timestamp
  - Headline
  - Source badge
  - Sentiment indicator (up/dn/neutral)

#### 3e. Level 2 / Depth (`sc-depth`)
- Header: Symbol + mid-price + spread
- Two-panel layout (`.l2-grid`):
  - **Bids** (left): Price + Size + cumulative depth bars (green)
  - **Asks** (right): Price + Size + cumulative depth bars (red)
- Footer: Total bid size, Total ask size, Imbalance ratio
- Updated every 600ms via `renderLevel2()`

#### 3f. Time & Sales (`sc-ts`)
- Column headers: TIME | PRICE | SIZE | EXCH
- Real-time scrolling feed of trades
- Each row color-coded: `.buy` (green) or `.sell` (red)
- Updated every 450ms via `initTimeAndSales()`
- Exchange codes: NYSE, NASD, ARCA, BATS, EDGX, IEX, DARK

---

## 4. Layout Grid Structure

### Top-Level Grid (`#app`)
```css
#app {
  display: grid;
  grid-template-rows: 40px 1fr 20px;
  height: 100vh;
  overflow: hidden;
}
```

```
┌────────────────────────────────────────────────────┐
│                   TOPBAR (40px)                     │ #topbar
├────────────────────────────────────────────────────┤
│                                                    │
│                  LAYOUT (1fr)                      │ #layout
│                                                    │
├────────────────────────────────────────────────────┤
│                  STATUSBAR (20px)                   │ #statusbar
└────────────────────────────────────────────────────┘
```

### Layout Grid (`#layout`)
```css
#layout {
  display: grid;
  grid-template-columns: 48px 1fr 286px;
  overflow: hidden;
  height: 100%;
}
```

```
┌──────┬──────────────────────────────┬───────────┐
│      │                              │           │
│ LEFT │         CONTENT              │  RIGHT    │
│ NAV  │        (#content)            │ SIDEBAR   │
│ 48px │          1fr                 │  286px    │
│      │                              │           │
└──────┴──────────────────────────────┴───────────┘
```

### Content Area (`#content`)
```css
#content {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg1);
  position: relative;
}
```
- Contains all `.view` divs (only one is `display:flex` at a time)
- Each view uses `display:none` / `display:flex` toggling

### Trading View Internal Grid (`.chart-body`)
```css
.chart-body {
  flex: 1;
  display: grid;
  grid-template-rows: 1fr 100px;
  overflow: hidden;
  position: relative;
}
```
```
┌─────────────────────────────────┐
│  Chart Header (34px, flex)       │
├─────────────────────────────────┤
│                                  │
│   Main Chart Canvas (1fr)        │ #cmw > #chart-main
│                                  │
├─────────────────────────────────┤
│   RSI Chart Canvas (100px)       │ #crw > #chart-rsi
├─────────────────────────────────┤
│   Replay Bar (28px, conditional) │
└─────────────────────────────────┘
```

### View-Specific Internal Layouts

| View | Layout | CSS |
|------|--------|-----|
| Dashboard | Single column, scrollable sections | Flex column |
| Portfolio | 2-column: table (1fr) + sidebar (256px) | `.port-grid { grid-template-columns: 1fr 256px }` |
| Orders | Tab bar + table content | Flex column with tab switching |
| Risk | 3-column risk cards + 2-column stress grid + table + canvas | Mixed grid/flex |
| Backtest | 2-column: config (232px) + results (1fr) | `.bt-layout { grid-template-columns: 232px 1fr }` |
| Strategy Studio | 2-column: editor (1fr) + results (296px) | `.ss-layout { grid-template-columns: 1fr 296px }` |
| Research | 3-column: sentiment (196px) + news (1fr) + fundamentals (216px) | `.research-layout { grid-template-columns: 196px 1fr 216px }` |
| Autopilot | 3-column: controls (196px) + proposals (1fr) + reasoning (216px) | `.ap-layout { grid-template-columns: 196px 1fr 216px }` |
| Compliance | 2-column: checks (1fr) + surveillance (1fr) | `.comp-layout { grid-template-columns: 1fr 1fr }` |
| Platform | 2-column: services (1fr) + logs (1fr) | `.plat-layout { grid-template-columns: 1fr 1fr }` |
| Fixed Income | 2-column: left panel (220px) + right (1fr) | `.fi-layout { grid-template-columns: 220px 1fr }` |
| FX Analytics | 2-column: matrix (1fr) + right panel (280px) | `.fx-layout { grid-template-columns: 1fr 280px }` |
| Commodities | 2-column: main (1fr) + right (240px) | `.cmdt-layout { grid-template-columns: 1fr 240px }` |
| Crypto | 2-column: main (1fr) + right (240px) | `.crypto-layout { grid-template-columns: 1fr 240px }` |
| Social / Ideas | 3-column: popular (220px) + main (1fr) + right (220px) | `.social-layout { grid-template-columns: 220px 1fr 220px }` |
| Efficient Frontier (portfolio tab) | 2-column: chart (1fr) + right (260px) | `.ef-layout { grid-template-columns: 1fr 260px }` |

### Topbar Layout (`#topbar`)
```css
#topbar {
  background: var(--bg0);
  border-bottom: 1px solid var(--bdr);
  display: flex;
  align-items: center;
  padding: 0 10px;
  gap: 6px;
  z-index: 30;
}
```
```
[Logo APEX] | [Mode Badge] | [Search ⌘K] [Symbol Strip: AAPL TSLA SPY BTC ETH] [Latency] | [Clock] [Notif] [Layout] [Settings] [User Avatar]
```

### Status Bar Layout (`#statusbar`)
```css
#statusbar {
  display: flex;
  align-items: center;
  padding: 0 10px;
  gap: 10px;
  font-size: 10px;
}
```
```
[●Live] [Market Open] [NAV $1,234,567] [Leverage 1.2x] | <scrolling ticker tape> | [Apex Terminal v2.0] [All systems operational]
```

---

## 5. JavaScript Functionality

### 5.1 Core View Routing

```
switchView(v)
├── Hides all .view elements (display:none)
├── Shows #view-{v} (display:flex)
├── Updates .nav-item active state
├── Calls view-specific init function:
│   ├── trading → initCharts()
│   ├── dashboard → initDashboard()
│   ├── portfolio → initPortfolio()
│   ├── orders → initOrders()
│   ├── risk → initRisk()
│   ├── backtest → initBacktest()
│   ├── walkforward → initWalkForward()
│   ├── montecarlo → initMonteCarlo()
│   ├── strategy → initStrategy()
│   ├── options → initOptions()
│   ├── screener → initScreener()
│   ├── alerts → (inline)
│   ├── macro → (static)
│   ├── research → initResearch()
│   ├── autopilot → initAutopilot()
│   ├── compliance → (static)
│   ├── platform → initPlatform()
│   ├── fixedincome → initFixedIncome()
│   ├── fx → initFX()
│   ├── commodities → initCommodities()
│   ├── crypto → initCrypto()
│   ├── heatmap → initHeatmap()
│   └── social → initSocial()
├── Enhanced (override pattern): origSwitchView stores original,
│   new switchView handles injected + enhanced views
└── Keyboard shortcut: F1 → trading
```

### 5.2 Chart System

**Data Generation:**
- `genOHLCV(n, start, vol_base, drift)` → generates synthetic OHLCV bars
- `calcEMA(data, period)` → Exponential Moving Average
- `calcRSI(data, period)` → Relative Strength Index (default 14)
- `calcBB(data, period, mult)` → Bollinger Bands (default 20, 2)

**Canvas Rendering:**
- `renderMainChart()`:
  - Grid lines (horizontal + vertical)
  - EMA(12) in blue, EMA(26) in orange
  - Bollinger Bands (20, 2) with fill
  - Candlestick or line chart (toggled by `chartType`)
  - Last price horizontal line with label
  - Volume bars at bottom
  - Y-axis price labels, X-axis time labels
- `renderRSIChart()`:
  - RSI(14) line with overbought (70) / oversold (30) fill zones
  - Level lines at 30, 50, 70

**Chart Controls:**
- `setTF(el, tf)` — timeframe selector (1m, 5m, 15m, 1h, 4h, 1D, 1W)
- `toggleChartType()` — switches between 'candles' and 'line'
- `addIndicator()` — shows toast notification
- `toggleReplayBar()` — shows/hides replay controls
- `exportChart()` — toast notification (stub)

**Enhanced Chart Toolbar** (added dynamically):
- Chart type dropdown (Candles, Line, Area, Heikin-Ashi, Renko, Kagi)
- Indicator panel toggle with checkboxes (EMA 12, EMA 26, Bollinger Bands, VWAP, RSI, MACD, Volume Profile, Ichimoku)

### 5.3 Symbol Management

```javascript
SYMBOLS = {
  AAPL: { name: 'Apple Inc.', exchange: 'NASDAQ', base: 182, vol: 0.02 },
  TSLA: { name: 'Tesla Inc.', exchange: 'NASDAQ', base: 241, vol: 0.04 },
  SPY:  { name: 'SPDR S&P 500', exchange: 'ARCA', base: 478, vol: 0.008 },
  BTC:  { name: 'Bitcoin', exchange: 'CRYPTO', base: 67420, vol: 0.03 },
  ETH:  { name: 'Ethereum', exchange: 'CRYPTO', base: 3520, vol: 0.035 }
}
```

`setSymbol(sym)`:
1. Regenerates OHLCV data for new symbol
2. Re-renders chart
3. Updates chart header (symbol, exchange, price, change, OHLCV)
4. Updates order ticket (symbol, price)
5. Navigates to trading view

### 5.4 API Bridge Pattern

```
<script src="/demo/api-bridge.js"></script>  ← loaded first
```

Functions attempt API calls first, fall back to generated data:
- `fetchBars()` → `/api/bars`
- `fetchPortfolio()` → `/api/portfolio`
- `fetchOrders()` → `/api/orders`
- `fetchOptions()` → `/api/options`
- `fetchScreener()` → `/api/screener`

Pattern in each init function:
```javascript
if (typeof fetchPortfolio === 'function') {
  fetchPortfolio().then(data => { /* render real data */ });
} else {
  /* render synthetic data */
}
```

### 5.5 Live Ticking System

- `tickPrices()` — runs every **800ms**
  - Updates last bar's close (random walk)
  - Re-renders chart if trading view is active
  - Updates watchlist prices and change colors
- `updateClock()` — runs every **1000ms**
  - Updates `#tb-clock` with HH:MM:SS ET
  - Updates latency display (random 1–5ms)
- `renderLevel2()` — runs every **600ms**
  - Regenerates bid/ask levels for L2 depth book
- Time & Sales feed — runs every **450ms**
  - Generates new trade entries

### 5.6 Dynamic View Injection

`injectViews()` called on `DOMContentLoaded`:

```javascript
function injectViews() {
  const content = document.getElementById('content');
  // Creates 6 views via insertAdjacentHTML:
  // 1. Fixed Income (view-fixedincome)
  // 2. FX Analytics (view-fx)
  // 3. Commodities (view-commodities)
  // 4. Crypto Analytics (view-crypto)
  // 5. Market Heatmap (view-heatmap)
  // 6. Social / Ideas (view-social)
}
```

### 5.7 View Enhancement Pattern

```javascript
function enhanceOptionsView() {
  const view = document.getElementById('view-options');
  if (view.dataset.enhanced) return; // guard
  view.dataset.enhanced = 'true';
  // Adds tab bar: Chain | IV Surface | Payoff | Scanner
  // Wraps existing content
  // Inserts new tab content panels
}

function enhancePortfolioView() {
  const view = document.getElementById('view-portfolio');
  if (view.dataset.enhanced) return;
  view.dataset.enhanced = 'true';
  // Adds tabs: Positions | Efficient Frontier | Attribution | Transactions
}
```

### 5.8 Command Palette

- Toggle: `⌘K` or click search bar → `openCmd()` / `closeCmd()`
- DOM: `#cmd-overlay` > `#cmd-box` > search input + results list
- **29 commands** in `CMD_LIST`:

```
Category TRADE:    Trading, Dashboard, Portfolio, Orders, Risk, Market Heatmap
Category STRAT:    Backtest, Walk-Forward, Monte Carlo, Strategy Studio
Category MKTS:     Options, Screener, Alerts, Calendar, Research, Ideas/Social
Category ASSETS:   Fixed Income, FX Analytics, Commodities, Crypto
Category SYSTEM:   Compliance, Platform
Category ACTIONS:  New Order, Export Portfolio, Quick Chart, Settings
```

Each command: `{ name, desc, action: () => ..., cat, key? }`
- Filtered by search input text
- Grouped by category in display
- Highlighted item: `.cmd-item.sel`

### 5.9 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Escape` | Close command palette / settings |
| `⌘K` / `Ctrl+K` | Open command palette |
| `⌘,` / `Ctrl+,` | Open settings |
| `⌘A` / `Ctrl+Shift+A` | Switch to autopilot |
| `⌘B` / `Ctrl+Shift+B` | Switch to backtest |
| `⌘P` / `Ctrl+Shift+P` | Switch to portfolio |
| `F1` | Switch to trading |

### 5.10 Settings & Export

`openSettings()` → `#settings-overlay`:
- Theme toggle: Dark / Light / System
- Chart font size slider
- Export buttons:
  - Portfolio CSV
  - Orders export
  - Screener results
  - Chart PNG
  - PDF Report
- Keyboard shortcuts reference

### 5.11 Order Ticket Controls

- `setDir(dir)` — sets BUY/SELL direction, updates button styles + submit button
- `updateOrderType()` — shows/hides limit price field based on order type
- `updateSummary()` — recalculates estimated value, commission, buying power, portfolio %
- `submitOrder()` — shows success toast, resets form

### 5.12 Mode Cycling

`cycleModes(el)`:
- Cycles through: `live` → `paper` → `bt` → `replay`
- Updates badge text and styling
- Shows toast notification

### 5.13 Canvas-Based Visualizations

| View | Canvas ID / Container | Visualization |
|------|----------------------|---------------|
| Trading | `#chart-main`, `#chart-rsi` | Candlestick/line chart, RSI |
| Dashboard | `#equity-chart`, `#sector-chart` | Equity curve, Sector pie |
| Portfolio | `#port-equity` | Equity curve |
| Risk | `#corr-canvas` | Correlation heatmap |
| Backtest | `#bt-equity`, `#bt-drawdown`, `#bt-monthly-canvas` | Equity, drawdown, monthly returns |
| Walk-Forward | `#wf-oos-chart` | OOS equity chart |
| Monte Carlo | `#mc-equity`, `#mc-return-dist`, `#mc-dd-dist` | Path distribution, return dist, DD dist |
| Strategy | `#sweep-canvas` | Parameter sweep heatmap |
| Platform | `#latency-chart` | Latency over time |
| Fixed Income | `#yc-canvas` | Yield curve |
| FX | `#fx-vol-canvas` | FX vol surface |
| Commodities | `#futures-curve-canvas`, `#seasonality-canvas` | Futures curve, seasonality |
| Crypto | `#onchain-canvas`, `#liq-canvas` | Exchange flows, liquidations |
| Heatmap | `#heatmap-canvas` | Market treemap |
| Options (enhanced) | `#iv-3d-canvas`, `#iv-smile-canvas`, `#iv-term-canvas`, `#payoff-canvas` | IV surface, smile, term structure, payoff diagram |
| Portfolio (enhanced) | `#ef-canvas`, `#attr-rolling-canvas` | Efficient frontier, rolling attribution |

---

## 6. Overall Architecture

### Single-Page Application Pattern
```
                     ┌─────────────────────┐
                     │   demo/index.html    │
                     │   (4,775 lines)      │
                     └─────────┬───────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
   ┌────▼────┐           ┌────▼────┐           ┌────▼────┐
   │  CSS    │           │  HTML   │           │  JS     │
   │ (~560   │           │ (~2060  │           │ (~2155  │
   │  lines) │           │  lines) │           │  lines) │
   └─────────┘           └─────────┘           └─────────┘
```

### Key Architecture Decisions

1. **View Switching (not routing)**: All 23 views exist in the DOM simultaneously. `switchView()` toggles visibility via `display:none`/`display:flex`. No URL routing, no lazy loading.

2. **Canvas 2D for all charts**: No charting library—all visualizations use raw `<canvas>` with `getContext('2d')`. This includes candlestick charts, pie charts, heatmaps, distribution plots, yield curves, etc.

3. **CSS Custom Properties for theming**: All colors defined as CSS variables on `:root`. Theme switching would only require updating these variables.

4. **Synthetic data generation**: All data is generated client-side (random walks, distributions, etc.) with an API bridge pattern that tries real API endpoints first.

5. **No build system**: Pure vanilla HTML/CSS/JS, no modules, no bundler, no framework.

6. **Progressive enhancement**: Base views are static HTML, then `injectViews()` adds asset-class views, then `enhanceOptionsView()` / `enhancePortfolioView()` add advanced tabs.

7. **Event-driven**: No state management—UI updates driven by direct DOM manipulation, `onclick` handlers, and `setInterval` for live data.

### External Dependencies
- **Fonts**: Google Fonts — Inter (300-800) + JetBrains Mono (400-600)
- **API Bridge**: `/demo/api-bridge.js` (separate file, loaded via `<script>`)
- **No other external libraries** — no jQuery, no charting library, no UI framework

### CSS Design System

| Token | Value | Usage |
|-------|-------|-------|
| `--bg0` | `#0C0E12` | Darkest background (topbar, nav, sidebar, statusbar) |
| `--bg1` | `#131722` | Content background |
| `--bg2` | `#1E222D` | Cards, hover states, table headers |
| `--bg3` | `#181C27` | Subtle card backgrounds |
| `--bg4` | `#242836` | Elevated elements (modals, popovers) |
| `--bdr` | `#2A2E39` | Standard borders |
| `--bdr-a` | `#434651` | Active/modal borders |
| `--brand` | `#2962FF` | Primary blue (TradingView blue) |
| `--brand-h` | `#1E53E4` | Brand hover |
| `--brand-m` | `rgba(41,98,255,.12)` | Brand muted background |
| `--up` | `#089981` | Positive/green |
| `--dn` | `#F23645` | Negative/red |
| `--warn` | `#F7931A` | Warning/orange |
| `--tx` | `#D1D4DC` | Primary text |
| `--tx2` | `#787B86` | Secondary text |
| `--tx3` | `#5D606B` | Tertiary text |
| `--replay` | `#9333EA` | Replay mode purple |
| `--bt` | `#06B6D4` | Backtest mode cyan |
| `--paper` | `#F59E0B` | Paper trading amber |
| `--live` | `#089981` | Live trading green |
| `--mono` | `JetBrains Mono` | Monospace font |
| `--sans` | `Inter` | Sans-serif font |
| `--r2/r4/r6/r8` | `2/4/6/8px` | Border radius scale |
| `--sh2/sh3/sh4` | Box shadows | Elevation levels |

### Component Pattern Library

Reusable CSS classes used across multiple views:

| Class | Purpose | Used In |
|-------|---------|---------|
| `.kpi-strip` + `.kpi-item` | Top KPI metrics bar | Dashboard, Portfolio, Risk, Backtest, WF, MC, FI, FX, Commodities, Crypto, Compliance, Platform |
| `.ph` + `.ph-title` | Panel header with title + actions | All views |
| `.tbl-wrap` + `table` | Scrollable data table | Orders, Portfolio, Screener, Options, Backtest, etc. |
| `.stat-card` / `.card-grid` | Metric cards in grid | Dashboard, WF, MC, Strategy |
| `.badge` / `.pill` | Status badges | Everywhere |
| `.btn-pri` / `.btn-sm` / `.btn-g` | Button variants | All views |
| `.field` | Form field (label + input) | Alerts, Backtest config, Order ticket |
| `.filter-pill` | Filter toggle pills | Screener, Calendar, Heatmap |
| `.alloc-row` | Allocation bar with label | Portfolio |
| `.proposal-card` | AI trade proposal | Autopilot |
| `.svc-card` | Service status card | Platform |
| `.check-row` | Compliance check item | Compliance |
| `.idea-card` | Social idea entry | Social |
| `.depth-row` | L2 depth row | Order book |
| `.ts-row` | Time & sales row | T&S feed |

---

## 7. Implementation Completeness Assessment

### Verdict: ALL 23 VIEWS ARE FULLY IMPLEMENTED

Every single view contains rich, detailed content with:
- Populated data (synthetic but realistic)
- Interactive controls
- Canvas visualizations where applicable
- Proper styling with the design system
- JavaScript init functions

### Detailed Status Per View

| View | Status | Canvas | Interactive | API Bridge | Sub-tabs | Notes |
|------|--------|--------|-------------|------------|----------|-------|
| Trading | ✅ FULL | 2 (main + RSI) | TF, chart type, drawing tools, replay | Yes (fetchBars) | — | Most complex view; live ticking |
| Dashboard | ✅ FULL | 2 (equity + sector) | — | — | — | 8 KPIs, movers, news, indices, events |
| Portfolio | ✅ FULL + ENHANCED | 3 (equity + EF + attr) | Tab switching | Yes (fetchPortfolio) | 4 tabs | Markowitz frontier, Brinson attribution |
| Orders | ✅ FULL | — | Tab switching, actions | Yes (fetchOrders) | 5 tabs | Each tab with full table |
| Risk | ✅ FULL | 1 (correlation) | — | — | — | VaR/CVaR/Beta, 8 stress scenarios |
| Backtest | ✅ FULL | 3 (equity + DD + monthly) | Config form, Run button | — | — | Full config → results pipeline |
| Walk-Forward | ✅ FULL | 1 (OOS equity) | — | — | — | 6 period cards, parameter stability |
| Monte Carlo | ✅ FULL | 3 (equity + return + DD) | Config (paths/CI) | — | — | 60 simulation paths rendered |
| Strategy Studio | ✅ FULL | 1 (sweep heatmap) | Code editing, run | — | — | Python strategy editor |
| Options | ✅ FULL + ENHANCED | 4 (IV 3D + smile + term + payoff) | Expiry selector, tab switching | Yes (fetchOptions) | 4 tabs | 8 payoff strategies, scanner |
| Screener | ✅ FULL | — | Filter pills, presets, scan types | Yes (fetchScreener) | 2 tabs | Screener + Real-Time Scanner |
| Alerts | ✅ FULL | — | Create form, toggle | — | — | Triggered + active lists |
| Economic Calendar | ✅ FULL | — | Impact/country filters | — | — | Full calendar with grouped rows |
| Research | ✅ FULL | — | News filtering | — | — | Sentiment + news + 24 fundamentals |
| Autopilot | ✅ FULL | — | 5 toggles, approve/reject | — | — | Agent registry, ML predictions |
| Compliance | ✅ FULL | — | — | — | — | 7 checks, audit trail, surveillance |
| Platform | ✅ FULL | 1 (latency) | — | — | — | 6 services, run history, logs |
| Fixed Income | ✅ FULL | 1 (yield curve) | Tab switching | — | 4 tabs | Bond search, analytics, CDS |
| FX Analytics | ✅ FULL | 1 (vol surface) | — | — | — | 8×8 cross-rate matrix |
| Commodities | ✅ FULL | 2 (futures + seasonality) | — | — | — | 7 commodity KPIs |
| Crypto | ✅ FULL | 2 (on-chain + liquidations) | — | — | — | 8 assets, DeFi overview |
| Market Heatmap | ✅ FULL | 1 (treemap) | Filter pills | — | — | 8 sectors, individual stocks |
| Social / Ideas | ✅ FULL | — | Publish form | — | — | Ideas feed, contributors, tags |

### Placeholder/Stub Operations (functional stubs, not missing views)
These are minor actions that show a toast notification instead of performing a real operation:
- `addIndicator()` → toast "Indicator added"
- `exportChart()` → toast "Chart exported"
- `Compare` button → toast "Add comparison symbol"
- `submitOrder()` → toast "Order submitted" (no real order execution)
- Various settings export buttons → toast notifications

---

## Appendix A: Modals & Overlays

| Element ID | Trigger | Content |
|-----------|---------|---------|
| `settings-overlay` | Click gear icon / `⌘,` | Theme toggle, font size, export buttons, keyboard shortcuts ref |
| `cmd-overlay` | Click search / `⌘K` | Command palette with filtered search, 29 commands |
| `toast-wrap` | `showToast(title, msg, type)` | Floating notification toasts (bottom-right), auto-dismiss |

## Appendix B: Animations & Transitions

| Animation | Keyframes | Duration | Used For |
|-----------|-----------|----------|----------|
| `pulse` | opacity 1→0.35→1 | 2s infinite | Mode badge dot, status dots |
| `fup` | green glow → normal | 0.5s | Price flash up |
| `fdn` | red glow → normal | 0.5s | Price flash down |
| `scrolll` | translateX(0) → translateX(-50%) | 55s linear infinite | Status bar ticker tape |
| `tin` | translateX(20px) opacity(0) → normal | 0.2s ease-out | Toast slide-in |

## Appendix C: React Component Mapping Recommendation

Based on the analysis, the recommended React component tree:

```
<App>
├── <Topbar>
│   ├── <Logo />
│   ├── <ModeBadge />
│   ├── <SearchBar /> → opens <CommandPalette />
│   ├── <SymbolStrip />
│   ├── <LatencyIndicator />
│   ├── <Clock />
│   ├── <NotificationButton />
│   ├── <LayoutButton />
│   ├── <SettingsButton />
│   └── <UserAvatar />
│
├── <Layout>
│   ├── <LeftNav>
│   │   ├── <NavLogo />
│   │   ├── <NavItem view="autopilot" special />
│   │   ├── <NavGroup label="TRADE" expanded>
│   │   │   └── <NavItem /> × 6
│   │   ├── <NavGroup label="STRAT" collapsed>
│   │   │   └── <NavItem /> × 4
│   │   ├── <NavGroup label="MKTS" collapsed>
│   │   │   └── <NavItem /> × 6
│   │   ├── <NavGroup label="ASSET" collapsed>
│   │   │   └── <NavItem /> × 4
│   │   └── <NavGroup label="SYSTEM" bottom>
│   │       └── <NavItem /> × 2
│   │
│   ├── <Content>
│   │   ├── <TradingView />        // chart + drawing tools + replay
│   │   ├── <DashboardView />      // KPIs + canvases + lists
│   │   ├── <PortfolioView />      // tabs: Positions, EF, Attribution, Txns
│   │   ├── <OrdersView />         // tabs: Open, Pending, Filled, Cancelled, Blotter
│   │   ├── <RiskView />           // cards + stress grid + table + canvas
│   │   ├── <HeatmapView />        // treemap canvas
│   │   ├── <BacktestView />       // config panel + results
│   │   ├── <WalkForwardView />    // period cards + canvas
│   │   ├── <MonteCarloView />     // config + 3 canvases
│   │   ├── <StrategyStudioView /> // editor + results
│   │   ├── <OptionsView />        // tabs: Chain, IV Surface, Payoff, Scanner
│   │   ├── <ScreenerView />       // tabs: Screener, Scanner
│   │   ├── <AlertsView />         // list + create form
│   │   ├── <EconomicCalendarView /> // calendar table
│   │   ├── <ResearchView />       // 3-col: sentiment + news + fundamentals
│   │   ├── <SocialView />         // 3-col: ideas + publish + contributors
│   │   ├── <AutopilotView />      // 3-col: controls + proposals + reasoning
│   │   ├── <ComplianceView />     // 2-col: checks + surveillance
│   │   ├── <PlatformView />       // 2-col: services + logs
│   │   ├── <FixedIncomeView />    // tabs: Yield Curve, Bonds, Analytics, Credit
│   │   ├── <FXView />             // matrix + forwards + banks + vol surface
│   │   ├── <CommoditiesView />    // futures curve + tracker + seasonality
│   │   └── <CryptoView />         // on-chain + market table + defi
│   │
│   └── <RightSidebar>
│       ├── <SidebarTabs />
│       ├── <OrderTicket />
│       ├── <Watchlist />
│       ├── <PositionsMini />
│       ├── <NewsFeed />
│       ├── <Level2Depth />
│       └── <TimeAndSales />
│
├── <StatusBar>
│   ├── <StatusIndicator />
│   ├── <TickerTape />
│   └── <SystemStatus />
│
├── <SettingsModal />
├── <CommandPalette />
└── <ToastContainer />
```

## Appendix D: DOMContentLoaded Init Sequence

```javascript
document.addEventListener('DOMContentLoaded', () => {
  1. injectViews()           // Create 6 dynamic views
  2. enhanceOptionsView()    // Add IV Surface, Payoff, Scanner tabs
  3. enhancePortfolioView()  // Add EF, Attribution, Transactions tabs
  4. enhanceChartToolbar()   // Add chart type dropdown + indicator panel
  5. initCharts()            // Render initial chart
  6. initWatchlist()         // Populate watchlist rows
  7. initMiniPositions()     // Populate sidebar positions
  8. initSidebarNews()       // Populate sidebar news
  9. initLevel2()            // Start L2 depth updates (600ms interval)
  10. initTimeAndSales()     // Start T&S feed (450ms interval)
  11. setInterval(tickPrices, 800)  // Start live price ticking
  12. setInterval(updateClock, 1000) // Start clock updates
  13. initStatusTape()       // Populate scrolling ticker tape
});
```
