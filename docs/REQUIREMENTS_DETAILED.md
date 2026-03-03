# Apex Terminal — Detailed Requirements & Specifications

> Exhaustive breakdown of what is needed and required to achieve Bloomberg/TradingView parity.
> Each section includes: requirements, acceptance criteria, technical specs, dependencies, and data needs.

---

## Table of Contents
1. [Chart Types](#1-chart-types)
2. [Multi-Chart Layouts](#2-multi-chart-layouts)
3. [Drawing Tools](#3-drawing-tools)
4. [Technical Indicators](#4-technical-indicators)
5. [Chart Interaction](#5-chart-interaction)
6. [Order Management](#6-order-management)
7. [Order Book & Market Depth](#7-order-book--market-depth)
8. [Backtesting](#8-backtesting)
9. [Options Analytics](#9-options-analytics)
10. [Portfolio & Risk](#10-portfolio--risk)
11. [Fixed Income, FX, Commodities](#11-fixed-income-fx-commodities)
12. [News, Research, Social](#12-news-research-social)
13. [Screening & Scanning](#13-screening--scanning)
14. [Alerts & Notifications](#14-alerts--notifications)
15. [Platform Infrastructure](#15-platform-infrastructure)

---

## 1. Chart Types

### 1.1 Volume Profile (Visible Range)

**Requirement:** Display volume distribution by price level for a user-selected visible range on the chart.

**Acceptance Criteria:**
- User can select a visible range (or use full chart)
- Histogram shows volume at each price level, drawn horizontally from price axis
- Configurable: tick size (price bucket), color scheme, POC (Point of Control) highlight
- Updates when zoom/pan changes the visible range
- Works with any base chart type (candlestick, etc.)

**Technical Specs:**
- **Lib:** `VolumeProfileVisible()` in `chart-types.ts` — exists, returns `VolumeProfileResult` with `bins[]`
- **Data:** OHLCV bars; volume aggregation by price bucket
- **Rendering:** Custom series or overlay; lightweight-charts does not natively support — need custom `IPlotFactory` or canvas overlay
- **Files to modify:** `AdvancedChartEngine.tsx` — add Volume Profile as overlay/sub-pane; or integrate `VolumeProfile.tsx` component (exists in `components/charts/advanced/`)

**Dependencies:** None. Can use existing OHLCV.

---

### 1.2 Footprint Chart

**Requirement:** Display bid/ask volume at each price level within each bar (order flow at bar granularity).

**Acceptance Criteria:**
- Each bar shows sub-levels: bid volume (red) vs ask volume (green) at each price tick
- Modes: bid/ask split, delta (net), profile
- Requires tick/tape data (trade-by-trade with bid/ask attribution) or synthetic from OHLCV
- Configurable tick size, colors, levels per bar

**Technical Specs:**
- **Lib:** `Footprint()` in `chart-types.ts` — exists, returns `FootprintCell[]`; needs tick-level or synthetic data
- **Data:** Either (a) tick/tape with bid/ask, or (b) synthetic from OHLCV (limited accuracy)
- **Component:** `FootprintChart.tsx` exists in `components/charts/advanced/` — needs wiring to main chart or as standalone pane
- **Rendering:** Canvas-based; each bar is a mini heatmap

**Dependencies:** Tick data or L2 feed for accurate bid/ask; otherwise synthetic.

---

### 1.3 Market Profile (TPO)

**Requirement:** Time Price Opportunity chart — letters (A, B, C, …) show time spent at each price level per session.

**Acceptance Criteria:**
- Sessions (e.g., RTH 9:30–16:00) with TPO letters
- POC, Value Area (VA), Initial Balance (IB) highlighted
- Configurable session times, tick size, letter range
- Multiple sessions visible (day, week, etc.)

**Technical Specs:**
- **Lib:** `MarketProfile()` in `chart-types.ts` — exists, returns `MarketProfileRow[]`
- **Component:** `MarketProfile.tsx` exists in `components/charts/advanced/`
- **Data:** OHLCV with session metadata; or tick data for accuracy
- **Rendering:** Custom; typically right-side panel or overlay

**Dependencies:** Session definitions (exchange hours, overnight).

---

### 1.4 Tick Chart

**Requirement:** Each bar represents N trades (e.g., 100-tick, 500-tick bars).

**Acceptance Criteria:**
- User selects tick count (e.g., 100, 200, 500)
- Bars form when N trades occur; no time basis
- OHLCV per tick bar
- Works with live and historical data

**Technical Specs:**
- **Lib:** Does not exist — need `TickBars(data: Tick[], tickCount: number): OHLCVBar[]`
- **Data:** Trade tape (timestamp, price, size, side)
- **API:** Need `/api/v1/trades/{symbol}` or equivalent tick endpoint
- **Rendering:** Standard candlestick/bar — same as existing once data is aggregated

**Dependencies:** Tick/trade data feed; aggregation logic.

---

### 1.5 Step Line, Line with Markers, HLC Area, Volume Candle

**Requirements:**
- **Step line:** Line that steps horizontally at each data point (stepBefore, stepAfter)
- **Line with markers:** Line + circle/dot at each point
- **HLC area:** Area chart using High-Low-Close (no open)
- **Volume candle:** Candle width proportional to volume

**Technical Specs:**
- **lightweight-charts:** LineSeries supports `stepLine: true`; AreaSeries similar
- **Line with markers:** Custom or use `lastValueVisible`; markers may need custom series
- **Volume candle:** Requires custom series (width varies) — lightweight-charts does not support natively; consider custom candlestick renderer

**Dependencies:** None for step/line; volume candle needs volume in data.

---

### 1.6 Baseline Chart

**Requirement:** Line chart with a baseline (e.g., 0 or custom value); area above baseline green, below red.

**Technical Specs:**
- **Lib:** `Baseline()` in `chart-types.ts` — exists
- **Rendering:** AreaSeries with `baseValue` or custom fill logic

---

## 2. Multi-Chart Layouts

### 2.1 Split Screen (2, 4, 6, 8 Panels)

**Requirement:** Multiple chart panes in a grid; each pane can show a different symbol/timeframe or same.

**Acceptance Criteria:**
- Layout presets: 1×1, 2×1, 1×2, 2×2, 2×3, 3×2, 4×4
- Resizable panes (drag divider)
- Each pane: full chart with indicators, drawings, type selection
- Independent or linked symbol/timeframe (user choice)

**Technical Specs:**
- **Existing:** `MultiChartLayoutUI2.tsx`, `MultiChartLayout.tsx` (in components/charts/advanced)
- **Needed:** Ensure each cell renders `AdvancedChartEngine` (or ChartTile); resize handling; state per pane (symbol, timeframe, chartType, indicators)

**Dependencies:** Chart engine must be instantiable multiple times without conflict.

---

### 2.2 Synchronized Crosshair

**Requirement:** When crosshair moves on one chart, all linked charts show crosshair at the same logical time.

**Acceptance Criteria:**
- User enables "Sync crosshair" (or link group)
- Moving crosshair on chart A updates crosshair position on charts B, C in same group
- Position = same timestamp (not pixel); each chart maps timestamp to its own x-axis
- Works across different timeframes (e.g., 1m vs 1D — same date/time)

**Technical Specs:**
- **Store:** `chartStore.ts` has `crosshairSyncEnabled`, `updateCrosshairPosition`, `linkGroups`
- **Implementation:** On crosshair move, get `time` from chart; dispatch to store; subscribed charts call `timeScale().scrollToPosition()` or `timeScale().subscribeVisibleTimeRangeChange()` and set crosshair
- **lightweight-charts:** `chart.subscribeCrosshairMove(callback)` — get `time` from `param.time`; `chart.timeScale().scrollToRealTime()` or similar for sync

**Dependencies:** Shared store or event bus; chart refs for each pane.

---

### 2.3 Symbol/Timeframe Sync

**Requirement:** Changing symbol (or timeframe) on one chart updates all linked charts.

**Acceptance Criteria:**
- "Link symbol" mode: change symbol in pane 1 → all linked panes load same symbol
- "Link timeframe" mode: same for timeframe
- Independent mode: each pane controls its own symbol/timeframe
- Sync is per link group, not global

**Technical Specs:**
- **State:** `symbol: string`, `timeframe: string` per pane or per group
- **UI:** Toggle "Link symbol" / "Link timeframe" in toolbar or pane header
- **Implementation:** When symbol changes in linked pane, `setSymbol(symbol)` for all panes in group

---

### 2.4 Tabbed Chart Workspaces

**Requirement:** Multiple "workspaces" (e.g., Tech, Macro, Crypto); each has its own layout and charts.

**Acceptance Criteria:**
- Tabs at top: Workspace 1, Workspace 2, …
- Each tab has full layout (panes, symbols, drawings)
- Switch tab → load that workspace state
- Add/remove/rename tabs

**Technical Specs:**
- **State:** `workspaces: Workspace[]`; `Workspace = { id, name, layout, panes: PaneConfig[] }`
- **Persistence:** Save to `localStorage` or `/api/v1/workspaces`
- **UI:** Tab bar above chart area; each tab body = MultiChartLayout with saved config

---

### 2.5 Chart Templates (Save/Load)

**Requirement:** Save current chart config (type, indicators, drawings, layout) and load it later or apply to another symbol.

**Acceptance Criteria:**
- "Save template" → name it, store indicators + drawings + chart type
- "Load template" → apply to current chart
- List of saved templates; delete/rename
- Templates can be shared (export JSON, import)

**Technical Specs:**
- **Schema:** `ChartTemplate = { name, chartType, indicators: IndicatorConfig[], drawings: Drawing[] }`
- **API:** `POST /api/v1/chart-templates`, `GET /api/v1/chart-templates`, `DELETE /api/v1/chart-templates/:id`
- **Implementation:** Serialize current chart state; on load, apply indicators and drawings

---

## 3. Drawing Tools

### 3.1 Drive Toolbar from Library

**Requirement:** DrawingToolbar must derive its list of tools from `drawing-tools.ts`, not hardcoded.

**Acceptance Criteria:**
- `getAllDrawingTools()` or `DRAWING_TOOLS` from lib is source of truth
- Toolbar renders one button per tool (or grouped)
- Clicking button sets `activeTool` to tool id
- New tools added to lib appear in toolbar without code change

**Technical Specs:**
- **Current:** `DrawingToolbar.tsx` has `TOOLS` array hardcoded
- **Change:** `import { getAllDrawingTools } from '@/lib/ta/drawing-tools'`; map to buttons
- **Categories:** Group by `tool.category` (lines, channels, fibonacci, shapes, etc.)

---

### 3.2 Hit Testing & Selection

**Requirement:** User can click an existing drawing to select it; show handles for resize/move.

**Acceptance Criteria:**
- Click on drawing → select (highlight, show handles)
- Drag handle → resize (e.g., extend trend line)
- Drag drawing → move
- Hit tolerance (e.g., 5px) for small/thin drawings
- Deselect: click elsewhere or Escape

**Technical Specs:**
- **Lib:** Each tool has `hitTest(state, { x, y, viewport, tolerance })`
- **DrawingLayer:** On mouse down, iterate drawings, call `hitTest`; if hit, set `selectedDrawingId`, `selectedPointIndex`
- **Handles:** For 2-point tools, render small squares at each point when selected; allow drag
- **Cursor:** Change to move/resize cursor when over handle

---

### 3.3 Persistence to Backend

**Requirement:** Drawings are saved to backend and loaded when chart opens.

**Acceptance Criteria:**
- On "Save" or auto-save: `POST /api/v1/drawings` with `{ symbol, timeframe, drawings: Drawing[] }`
- On chart load: `GET /api/v1/drawings?symbol=X&timeframe=1D` — render returned drawings
- Drawings persist across sessions and devices (if user logged in)

**Technical Specs:**
- **API:** `GET /api/v1/drawings`, `POST /api/v1/drawings` (exists per tasks.md)
- **Payload:** `drawings` array; each `Drawing` has `type`, `points`, `color`, etc. — use `toJSON` from lib
- **Load:** After bars load, fetch drawings, `fromJSON` each, add to store

---

### 3.4 Keep Drawing Mode

**Requirement:** After placing a drawing, stay in that tool so user can place another without re-selecting.

**Acceptance Criteria:**
- Toggle "Keep drawing" (or similar) in toolbar
- When on: after placing line, tool stays active; user can immediately draw another line
- When off: after placing, revert to cursor/select tool

**Technical Specs:**
- **State:** `keepDrawingMode: boolean` in store or toolbar state
- **Logic:** After `addDrawing()`, if `keepDrawingMode` then do NOT `setTool('cursor')`

---

### 3.5 Properties Panel

**Requirement:** When a drawing is selected, show a panel to edit color, line width, extend (for rays), lock, etc.

**Acceptance Criteria:**
- Panel appears (floating or sidebar) when drawing selected
- Editable: color, lineWidth, lineStyle (solid/dashed), lock
- For rays/lines: extend left/right (infinite or not)
- Changes apply immediately

**Technical Specs:**
- **UI:** Modal or popover; form with color picker, number inputs
- **State:** Update `drawings` in store; re-render
- **Lock:** When locked, drawing not selectable/draggable

---

### 3.6 Magnet Mode (Snap to OHLC)

**Requirement:** When placing or moving a drawing point, snap to nearest OHLC price (or bar timestamp).

**Acceptance Criteria:**
- Toggle "Magnet" (weak/strong/off)
- Weak: snap if within N pixels of price/timestamp
- Strong: always snap to closest OHLC
- Works for both price (y) and time (x)
- Optional: snap to indicator values (more complex)

**Technical Specs:**
- **Data:** Need current visible bars in DrawingLayer (or pass from chart)
- **Logic:** On mouse up (or move): `snapPrice(y) → nearest bar.low/high/close`, `snapTime(x) → nearest bar.time`
- **Implementation:** When converting pixel to price/time, round to nearest bar value

---

### 3.7 Missing Pattern Tools

**Requirement:** Implement Elliott Wave, Head & Shoulders, ABCD, XABCD, Three Drives, Triangle, Cyclic Lines, etc.

**Acceptance Criteria (per pattern):**
- User places N anchor points (pattern-specific)
- Tool renders pattern (lines, labels)
- Hit test for selection
- toJSON/fromJSON for persistence

**Technical Specs:**
- **Elliott Wave:** 5 points for impulse; 3 for correction; render wave labels (1,2,3,4,5 or A,B,C)
- **H&S:** 3 peaks + neckline; 5 points
- **ABCD:** 4 points; AB=CD projection
- **XABCD:** 5 points; harmonic pattern
- **Implementation:** Add to `drawing-tools.ts` following existing `createTool()` pattern; each needs `minPoints`, `maxPoints`, `render`, `hitTest`

---

### 3.8 Volume-Based Drawings (Anchored VWAP, VP)

**Requirement:** Anchored VWAP (from user-selected bar), Fixed Range Volume Profile, Anchored Volume Profile.

**Acceptance Criteria:**
- **Anchored VWAP:** User selects anchor bar; VWAP line extends from that bar forward
- **Fixed Range VP:** User draws range (2 points); volume profile computed for that range, displayed as horizontal histogram
- **Anchored VP:** Same but anchored to bar

**Technical Specs:**
- **Data:** Need OHLCV for range; VWAP = cumsum(price*vol)/cumsum(vol)
- **Rendering:** Line for VWAP; histogram for VP — custom overlay
- **New tools:** Add to drawing-tools; they are "smart" (compute from chart data)

---

## 4. Technical Indicators

### 4.1 Client-Side Fallback

**Requirement:** When `/api/v4/indicators/compute` fails (offline, timeout), compute indicators client-side.

**Acceptance Criteria:**
- Chart requests indicator from API first
- On 4xx/5xx or timeout: call `SMA()`, `EMA()`, `RSI()`, etc. from `indicators-extended.ts`
- Chart displays result either way
- User sees no difference (except maybe slight delay for client compute)

**Technical Specs:**
- **Current:** `fetchIndicatorData` in AdvancedChartEngine calls API only
- **Change:** Wrap in try/catch; on fail, `import { SMA, RSI, ... } from '@/lib/ta/indicators-extended'` and compute from `rawBars`
- **Mapping:** IndicatorRegistry id → function name (e.g., `sma` → `SMA`)

**Dependencies:** `indicators-extended` must have same signatures (data, params) as API expects.

---

### 4.2 Indicator Registry ↔ indicators-extended Parity

**Requirement:** Every indicator in IndicatorRegistry that exists in indicators-extended should be usable client-side.

**Acceptance Criteria:**
- Audit: list all IndicatorRegistry ids
- For each, either (a) implement in indicators-extended with matching params, or (b) document API-only
- Common ones (SMA, EMA, RSI, MACD, BB, ATR, Stochastic, etc.) must work client-side

**Technical Specs:**
- **Files:** `IndicatorRegistry.ts`, `indicators-extended.ts`
- **Map:** `registryIdToClientFn: Record<string, (data, params) => IndicatorResult>`

---

### 4.3 Custom Formula Builder (Pine Script–Like)

**Requirement:** User can write custom indicator formulas in a simple language (Pine-like).

**Acceptance Criteria:**
- Code editor with syntax highlighting
- Supported: `close`, `open`, `high`, `low`, `volume`, `sma(close, 14)`, `ema(close, 21)`, `rsi(close, 14)`, arithmetic, etc.
- Parse, compile, run on bar data; display as overlay or oscillator
- Predefined functions: 20+ common indicators

**Technical Specs:**
- **Options:** (a) Embed a JS expression evaluator (e.g., `expr-eval`); (b) Custom parser/VM; (c) Restrict to JSON config (e.g., `{ fn: 'sma', input: 'close', period: 14 }`)
- **Scope:** Start with config-based (no full Pine); expand later
- **Effort:** Large (2–4 weeks for minimal formula builder)

---

## 5. Chart Interaction

### 5.1 Crosshair with Rich Tooltip

**Requirement:** Crosshair shows OHLCV + indicator values at hovered bar.

**Acceptance Criteria:**
- Tooltip appears near crosshair
- Content: date/time, O, H, L, C, V; plus values for each visible indicator
- Configurable: show/hide per series
- Styled to match theme

**Technical Specs:**
- **lightweight-charts:** `subscribeCrosshairMove` callback gets `param.seriesData` — map of series to value
- **Custom tooltip:** Create div, position at `param.point.x/y`, populate from `seriesData`
- **Indicators:** For each overlay/oscillator, get value at `param.time` from series

---

### 5.2 Measure Tool

**Requirement:** User draws a measure line between two points; see price change, %, bar count.

**Acceptance Criteria:**
- Select Measure tool; click two points on chart
- Line appears; label shows: price diff, %, number of bars
- Move handles to adjust
- Persist as drawing

**Technical Specs:**
- **Lib:** `Measure` tool exists in drawing-tools
- **Display:** Dynamic label: `Δ $X.XX (Y%) | N bars`

---

### 5.3 Screenshot/Export Chart

**Requirement:** Export chart as PNG or SVG.

**Acceptance Criteria:**
- Button "Export" or "Screenshot"
- Options: PNG, SVG (if supported)
- Resolution: current viewport or user-selected (e.g., 2x for retina)
- Download file

**Technical Specs:**
- **lightweight-charts:** `chart.takeScreenshot()` or canvas `toDataURL('image/png')`
- **SVG:** Chart may be canvas-based; SVG export might require re-render to SVG or use library like `html2canvas` / `dom-to-image`
- **API:** Optional `POST /api/v1/export/chart` that returns image (for server-side watermark, etc.)

---

### 5.4 Go-to Date/Time

**Requirement:** User can jump to a specific date/time.

**Acceptance Criteria:**
- Menu item or shortcut (e.g., Ctrl+G)
- Dialog: date picker + time picker (or datetime-local input)
- On submit: scroll chart to that time, center or left-align

**Technical Specs:**
- **lightweight-charts:** `timeScale().scrollToRealTime()` or `scrollToPosition()` with logical index
- **Mapping:** User datetime → bar index or timestamp → `timeScale().scrollToPosition(index)`

---

## 6. Order Management

### 6.1 Missing Order Types in UI

**Requirement:** Expose IOC, FOK, GTD, MOO, MOC, LOO, LOC, Peg, OCO, OTO, Iceberg in order form.

**Acceptance Criteria (per type):**
- **IOC/FOK:** Dropdown or checkbox; no extra fields
- **GTD:** Date picker for expiry
- **MOO/MOC/LOO/LOC:** Session selector (e.g., open/close)
- **Peg:** Peg type (midpoint, market, primary); offset
- **OCO:** Two orders; when one fills, cancel other
- **OTO:** Second order triggered when first fills
- **Iceberg:** Display quantity (show) vs total quantity

**Technical Specs:**
- **Lib:** `order-types.ts` has `createLimitOrder`, `validateOrderSpec` with these types
- **UI:** OrderTicket or AdvancedOrderForm — extend `type` dropdown; add conditional fields per type
- **Validation:** Use `validateOrderSpec` before submit

---

### 6.2 Execution Algorithm UI

**Requirement:** Full UI for TWAP, VWAP, POV, Dark Pool, SOR with parameters.

**Acceptance Criteria:**
- Algo selector: TWAP, VWAP, POV, Implementation Shortfall, etc.
- Per-algo params:
  - TWAP: start time, end time, slice interval, participation cap
  - VWAP: start/end, volume profile (or use historical), max participation
  - POV: target participation %
- Order preview shows algo and params
- Submit to EMSX or broker API that supports algos

**Technical Specs:**
- **Lib:** `order-types.ts` has `TWAPAlgoParams`, `VWAPAlgoParams`, etc.
- **UI:** Expand OrderTicket when algo selected; show algo-specific form
- **Backend:** Broker integration must support algo routing (Alpaca, etc.)

---

### 6.3 Blotter Real-Time Updates

**Requirement:** Orders and fills update in real time via WebSocket.

**Acceptance Criteria:**
- Blotter shows orders; new orders appear without refresh
- Order status changes (working → filled, partial, cancelled) update live
- Fills appear as they occur
- Optional: sound or visual cue on fill

**Technical Specs:**
- **API:** WebSocket `ws://.../ws/orders` or similar; or broker WebSocket (Alpaca)
- **Store:** Merge incoming order/fill into `orders` and `fills` arrays; trigger re-render
- **Polling fallback:** If no WebSocket, poll `GET /api/v1/orders` every 5s

---

### 6.4 TCA Column in Blotter

**Requirement:** Show transaction cost analysis per fill (slippage, market impact, etc.).

**Acceptance Criteria:**
- Column: "Arrival", "VWAP", "Slippage", "Market Impact" or similar
- Values computed by `tca.ts` or backend
- Requires arrival price (order sent time mid) and fill price

**Technical Specs:**
- **Lib:** `lib/orders/tca.ts` — compute metrics
- **Data:** Need order timestamp, limit/market price, fill price, size
- **API:** May need backend to compute (has more context)

---

## 7. Order Book & Market Depth

### 7.1 Wire level2_processor to UI

**Requirement:** Backend `level2_processor.py` output drives L2 display.

**Acceptance Criteria:**
- API returns L2: `{ bids: [[price, size], ...], asks: [...] }`
- UI fetches from `/api/v1/orderbook/{symbol}` or WebSocket
- L2OrderBookPanel displays bids/asks; updates in real time
- Level count configurable (5, 10, 20)

**Technical Specs:**
- **Backend:** Ensure route `/api/v1/orderbook` exists and uses level2_processor
- **Frontend:** L2OrderBookPanel — replace mock with API/WS
- **Format:** Align backend output with frontend expected shape

---

### 7.2 Order Book Heatmap

**Requirement:** Visual heatmap of order book (price vs size, color by depth).

**Acceptance Criteria:**
- Grid or gradient: rows = price levels, color = size (or cumulative)
- Bid side one color (e.g., green), ask side another (red)
- Hover: show exact price and size

**Technical Specs:**
- **Rendering:** Canvas or SVG; each cell = price level, color scale from size
- **Data:** Same L2 structure

---

### 7.3 Order Flow / Trade Reconstruction

**Requirement:** Display trade flow (aggressor side, size) and optionally reconstruct order book.

**Acceptance Criteria:**
- Time & Sales with aggressor (buy/sell)
- Cumulative delta
- Order flow histogram (buy vs sell volume over time)
- Requires tick/trade data with side

**Technical Specs:**
- **Data:** Trade tape with `side` (buy/sell) and `aggressor`
- **API:** `/api/v1/trades/{symbol}` streaming or historical
- **Components:** Extend TimeSales; add OrderFlowChart

---

## 8. Backtesting

### 8.1 Unify Backtest UIs

**Requirement:** Single entry point for backtesting; v5 engine as default.

**Acceptance Criteria:**
- One "Backtest" page or panel
- Strategy: code editor or template picker
- Parameters: date range, initial capital, commission, slippage
- Run → results in same UI (no separate v2/v3/v4 pages)
- v5 engine used for execution

**Technical Specs:**
- **Backend:** Single route `POST /api/v4/backtest/run` (or v5) with strategy + params
- **Frontend:** One BacktestLauncher or BacktestUI2; route to v4/v5 based on config
- **Deprecate:** Old v2, v3 UIs or fold into one

---

### 8.2 Tearsheet UI Parity with TradingView

**Requirement:** Equity curve, drawdown chart, monthly heatmap, trade list, key metrics.

**Acceptance Criteria:**
- **Equity curve:** Line chart of portfolio value over time
- **Drawdown:** Underwater chart (drawdown from peak)
- **Monthly returns:** Heatmap (rows = year, cols = month)
- **Trade list:** Table with entry/exit, P&L, hold time
- **Metrics:** Win rate, profit factor, Sharpe, Sortino, max DD, etc.

**Technical Specs:**
- **Backend:** Reporter or tearsheet endpoint returns `{ equityCurve, drawdown, monthlyReturns, trades, metrics }`
- **Frontend:** Charts using recharts or lightweight-charts; table for trades
- **Existing:** `reporter.ts`, tearsheet route — ensure structure matches UI needs

---

### 8.3 Walk-Forward & Monte Carlo UI

**Requirement:** Full UI to configure and view walk-forward and Monte Carlo results.

**Acceptance Criteria:**
- **Walk-forward:** In-sample / out-of-sample periods; rolling or anchored; results per fold
- **Monte Carlo:** Number of simulations; distribution of outcomes; percentile curves
- **UI:** Config form (periods, params) + results (table, charts)
- **Backend:** Routes exist (`/tearsheet`, `/wfo`, `/montecarlo`) — wire to UI

**Technical Specs:**
- **API:** Document request/response for wfo and montecarlo
- **Frontend:** BacktestUI2 or separate WalkForwardUI2, MonteCarloUI2; forms + result views

---

## 9. Options Analytics

### 9.1 Custom Chain Columns

**Requirement:** User can choose which columns to show in options chain (OI, IV, Greeks, etc.).

**Acceptance Criteria:**
- Column config: show/hide, reorder
- Columns: Bid, Ask, Last, Change, OI, Volume, IV, Delta, Gamma, Theta, Vega
- Save column config per user

**Technical Specs:**
- **State:** `chainColumns: { key: string, visible: boolean, order: number }[]`
- **UI:** Table with configurable columns; persist to user prefs

---

### 9.2 Pre-Built Strategy Templates

**Requirement:** One-click to create Iron Condor, Strangle, Calendar Spread, etc.

**Acceptance Criteria:**
- List of strategies: Bull Call, Bear Put, Straddle, Strangle, Iron Condor, Iron Butterfly, Calendar, Diagonal, Collar, Covered Call, Protective Put, Jade Lizard, Broken Wing
- User selects strategy → form pre-filled with typical structure (e.g., Iron Condor: sell put spread + sell call spread)
- User picks strikes and quantities; preview P&L

**Technical Specs:**
- **Data:** Each strategy has `legs: { type: call|put, side: buy|sell, strike, expiry }[]`
- **UI:** Strategy picker → leg editor → payoff chart
- **Existing:** PayoffLabUI2 — extend with templates

---

### 9.3 Wire pricing-models.ts to UI

**Requirement:** Show theoretical price (BSM/binomial) vs market price in chain.

**Acceptance Criteria:**
- Column "Theo" = theoretical price from `blackScholes` or `binomial`
- "Edge" = theo - market (or %)
- User can toggle model (BSM vs Binomial)
- Uses `pricing-models.ts` or `blackScholes.ts`, `binomial.ts`

**Technical Specs:**
- **Import:** `import { blackScholes } from '@/lib/options/blackScholes'`
- **Compute:** For each option row, call with S, K, T, r, sigma; display theo
- **IV:** If market price known, can imply IV (Newton-Raphson) — optional

---

## 10. Portfolio & Risk

### 10.1 Brinson Attribution

**Requirement:** Decompose portfolio return into allocation, selection, interaction effects.

**Acceptance Criteria:**
- Input: portfolio weights, benchmark weights, returns
- Output: Allocation effect, Selection effect, Interaction effect per sector/asset
- Chart: stacked bar or table
- **Formula:** Standard Brinson model

**Technical Specs:**
- **Lib:** `lib/portfolio/attribution.ts` or similar
- **API:** `POST /api/v1/portfolio/attribution` with holdings + benchmark
- **UI:** PortfolioUI2 — add "Attribution" tab

---

### 10.2 VaR Dashboard

**Requirement:** VaR (Historical, Parametric, Monte Carlo) at 95%, 99% confidence; drill-down.

**Acceptance Criteria:**
- Dashboard: 1-day VaR, 10-day VaR, Expected Shortfall
- Methodology selector
- Component breakdown (by position, sector)
- Back-testing VaR (count of exceptions)

**Technical Specs:**
- **Lib:** `lib/risk/` — VaR functions
- **API:** `/api/v1/risk/var`
- **UI:** RiskDashboardUI2 — VaR section with charts and tables

---

## 11. Fixed Income, FX, Commodities

*(Abbreviated — each is a large domain)*

**Fixed Income:** Bond pricing (YTM, duration, convexity), yield curves, OAS, Z-spread. Requires bond reference data (coupon, maturity, credit). YieldCurveChart exists — wire to real data.

**FX:** Spot, forwards, options. Cross rate matrix, forward points. Requires FX reference data.

**Commodities:** Futures curves, roll yield, seasonality. Requires futures and commodity data.

**Data dependency:** All require specific data feeds; effort scales with data availability.

---

## 12. News, Research, Social

**News:** Real-time feed, symbol filter, sentiment scoring. Requires news API (e.g., Finnhub, NewsAPI). NewsTerminalUI2 exists — extend with sentiment.

**Research:** Analyst estimates, earnings. Requires fundamentals API.

**Social:** Ideas, comments, follow. Requires user auth, backend for posts, moderation. Large greenfield.

---

## 13. Screening & Scanning

**Screener:** Custom formula filters (e.g., `close > sma(close, 50)`). Requires formula parser + execution over universe.

**Scanner:** Real-time breakouts, volume spikes. Requires streaming scan service or frequent batch scans.

**Unusual options:** Options flow data (large trades, sweeps). Requires options tape.

---

## 14. Alerts & Notifications

**Alert types:** Price, indicator, drawing cross. Backend evaluates conditions (cron or event-driven).

**Delivery:** Webhook (POST to URL), email (SMTP), SMS (Twilio). Requires integration and config UI.

**In-app:** Notification center, toast, badge count. Standard frontend.

---

## 15. Platform Infrastructure

### 15.1 Performance

**Sub-100ms chart render:** Profile; ensure canvas resize, data update, redraw are efficient. Use `requestAnimationFrame`, avoid layout thrash.

**WebSocket 10K+ msg/sec:** Batch updates; use `requestAnimationFrame` to coalesce; avoid re-render per message.

**Virtual scrolling:** For large tables (blotter, screener results), use `react-window` or similar.

**Web Worker:** Offload indicator computation to worker; keep main thread responsive.

### 15.2 Accessibility (WCAG 2.1 AA)

**Keyboard:** All actions available via keyboard; visible focus indicators; logical tab order.

**Screen reader:** ARIA labels, roles; chart described (e.g., "Candlestick chart, SPY, 1D, 250 bars").

**Color:** Sufficient contrast; don't rely on color alone. High contrast mode.

### 15.3 Customization

**Keyboard shortcut customization:** User remaps shortcuts. Store in user prefs. Conflict detection.

**Workspace save/load:** Serialize layout, symbol, chart config; save to API; load on login.

---

## Dependency Summary

| Feature | Depends On |
|---------|------------|
| Volume Profile, Footprint, TPO | OHLCV (Footprint prefers tick) |
| Tick chart | Tick/trade data API |
| Synced crosshair | Multi-chart layout, shared store |
| Drawing persistence | `/api/v1/drawings` |
| Indicator client fallback | indicators-extended |
| L2 heatmap | L2 API |
| Order flow | Trade tape with side |
| Backtest unification | v5 engine, reporter |
| Brinson attribution | Portfolio holdings, benchmark |
| VaR | Portfolio positions, market data |
| Fixed income | Bond reference data |
| Alerts (webhook, email) | Alert backend, integrations |
| Social | Auth, posts API |

---

## Effort Ordering (Rough)

1. **Quick wins (1–3 days each):** Indicator client fallback, drive toolbar from lib, Measure tool UI, Export chart PNG, Go-to date
2. **Medium (1–2 weeks each):** Synced crosshair, drawing persistence, L2 heatmap, Order types (IOC/FOK/GTD), Backtest tearsheet UI
3. **Large (2–4 weeks each):** Volume Profile/Footprint/TPO in main chart, Custom formula builder, Walk-forward/Monte Carlo UI, Options strategy templates
4. **Very large (1+ months):** Full social, Fixed income, FX, Commodities, Custom formula (Pine-like)
