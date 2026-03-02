# Apex Terminal — Bulletproof UI/UX Design Plan
> Bloomberg Terminal + TradingView SuperCharts Level — Complete Design Specification

---

## Executive Summary

Apex Terminal must feel like the love child of Bloomberg Terminal's informational density and TradingView's polished interactivity — but exceed both in modern UX. The design philosophy is **"Information at the Speed of Thought"**: every pixel earns its place, every interaction is intentional, and zero cognitive load is wasted on navigation.

**Design Identity:** *Dark Precision Terminal* — professional-grade financial tool with military-grade information density, surgical color usage, and zero decorative noise.

---

## 1. Design Principles

| # | Principle | Definition |
|---|-----------|------------|
| 1 | **Density Without Chaos** | Show maximum information without visual noise. Every element must be signal, never decoration. |
| 2 | **Zero-Friction Workflow** | Power users must reach any function within 2 keystrokes or 1 click. Command palette is always ≤1 keystroke away. |
| 3 | **Glanceable at Scale** | Status, P&L, risk — all readable in 200ms. Color semantics are absolute: green = profit/up, red = loss/down, always. |
| 4 | **Context-Aware UI** | The interface adapts to the active mode (Live / Paper / Backtest / Replay). Mode is always visually declared. |
| 5 | **Trustworthy Data** | All data shows source, timestamp, latency. Stale data is visually marked. No silent failures. |
| 6 | **Progressive Disclosure** | Summary → Detail → Deep Dive. Never front-load all data. Panels expand, not navigate. |
| 7 | **Keyboard-First** | Every action has a keyboard shortcut. Mouse is optional, never required for power tasks. |
| 8 | **Predictable, Not Surprising** | Animations are functional, not decorative. Transitions orient the user, not entertain them. |

---

## 2. Design System

### 2.1 Color Palette (Canonical)

#### Base Layers
```
Layer 0 — Deepest Background:   #0C0E12   (app chrome, outermost shell)
Layer 1 — Panel Background:     #131722   (panels, sidebars, chart bg)
Layer 2 — Element Background:   #1E222D   (cards, inputs, dropdowns)
Layer 3 — Surface / Hover:      #181C27   (hover states, active rows)
Layer 4 — Elevated Surface:     #242836   (tooltips, popovers, raised elements)
```

#### Borders
```
Default:     #2A2E39   (subtle panel borders)
Active:      #434651   (focused/hovered elements)
Focus Ring:  #2962FF   (keyboard focus — accessibility)
```

#### Brand & Action
```
Primary CTA:      #2962FF   (blue — buy orders, primary actions)
Primary Hover:    #1E53E4
Primary Muted:    rgba(41, 98, 255, 0.12)   (bg tints)
```

#### Trading Semantics (SACRED — never deviate)
```
Bullish / Up / Profit:   #089981   (TradingView green — absolute)
Bullish Hover:           #0AAE8E
Bearish / Down / Loss:   #F23645   (TradingView red — absolute)
Bearish Hover:           #FF4757
Warning / Neutral:       #F7931A   (amber — warnings, neutral alerts)
```

#### Mode Color System
```
Live Mode:      #089981 / rgba(8,153,129,0.1)    (green — real money at risk)
Paper Mode:     #F59E0B / rgba(245,158,11,0.1)   (amber — simulated)
Backtest Mode:  #06B6D4 / rgba(6,182,212,0.1)    (cyan — historical)
Replay Mode:    #9333EA / rgba(147,51,234,0.1)    (purple — playback)
```

#### Text Hierarchy
```
Primary Text:    #D1D4DC   (main content)
Secondary Text:  #787B86   (labels, metadata)
Muted Text:      #5D606B   (disabled, timestamps)
Inverse Text:    #0C0E12   (text on light backgrounds)
```

#### Chart Colors (Distinct, Colorblind-Safe)
```
Series 1:  #2962FF   (blue)
Series 2:  #FF9800   (orange)
Series 3:  #E91E63   (pink)
Series 4:  #00BCD4   (cyan)
Series 5:  #9C27B0   (purple)
Series 6:  #4CAF50   (green — distinct from trading up)
Series 7:  #FF5722   (deep orange)
Series 8:  #607D8B   (blue-grey)
```

### 2.2 Typography

#### Font Stack
```
Display / Headers:   "Inter" variable (weights 400–800)
Body / UI:           "Inter" variable (weights 300–600)
Monospace / Prices:  "JetBrains Mono" (weights 400–700)
Code / Terminal:     "JetBrains Mono" (weights 400–500)
```

**Rationale:** Inter is industry-standard for financial data (legible at 11px), JetBrains Mono for tabular numbers (fixed-width = column alignment in tables).

#### Type Scale (px)
```
xxs:   10px / 14px   — timestamps, footnotes, micro labels
xs:    11px / 15px   — table cell text, secondary metadata
sm:    12px / 16px   — sidebar labels, chip text, tooltips
base:  13px / 18px   — default body, table primary cells
md:    14px / 20px   — panel headings, button text
lg:    16px / 22px   — section titles, KPI labels
xl:    18px / 26px   — page subsection titles
2xl:   24px / 30px   — page titles, primary KPI values
3xl:   28px / 34px   — hero numbers (P&L, price)
4xl:   36px / 44px   — large display numbers (account value)
```

#### Price Display Rules
```
Large price:    28px / JetBrains Mono / weight 600 / tabular-nums
Mid price:      24px / JetBrains Mono / weight 600
Small price:    18px / JetBrains Mono / weight 500
Table price:    13px / JetBrains Mono / weight 400 / tabular-nums
Change %:       same size as price / weight 500 / color = up/down
```

### 2.3 Spacing System

**Base unit: 4px**

```
2px   — hairline separators, micro gaps
4px   — icon padding, tight list items
6px   — inline element spacing
8px   — component inner padding (small)
12px  — component inner padding (default)
16px  — section padding, card padding
20px  — panel content padding
24px  — section gaps
32px  — major section gaps
40px  — page section gaps
48px  — between major layout blocks
```

### 2.4 Border Radius
```
none  — data tables, terminal elements (maximum density)
2px   — pills, tight chips, status badges
4px   — buttons, inputs, small cards
6px   — panels, dropdowns
8px   — modals, large cards
12px  — floating panels (command palette, tooltips)
```

**Rule:** Primary trading interface = sharp/minimal radius. Analytical/dashboard = subtle radius. Modal/overlay = 8px max.

### 2.5 Shadow System
```
Level 1 (subtle):   0 1px 3px rgba(0,0,0,0.4)              — inline elements
Level 2 (card):     0 4px 12px rgba(0,0,0,0.5)             — panels, cards
Level 3 (elevated): 0 8px 24px rgba(0,0,0,0.6)             — dropdowns, tooltips
Level 4 (overlay):  0 16px 48px rgba(0,0,0,0.7)            — modals
Focus Glow:         0 0 0 2px rgba(41,98,255,0.4)          — focused inputs
Green Glow:         0 0 8px rgba(8,153,129,0.3)            — profit indicators
Red Glow:           0 0 8px rgba(242,54,69,0.3)            — loss/alert indicators
```

### 2.6 Animation Standards

```
Micro (state change):     150ms / ease-out    — button hover, toggle
Fast (element appear):    200ms / ease-out    — dropdown open, tooltip
Standard (transition):    250ms / ease-in-out — panel slide, tab switch
Slow (page transition):   350ms / ease-in-out — route change, modal open
Data flash (price tick):  400ms / flash       — price update highlight
Reduce motion:            All animations respect prefers-reduced-motion
```

**Price tick animation:** On price update, the number background briefly flashes #089981 (up) or #F23645 (down) for 400ms, then fades back. This is the only place glow is acceptable.

---

## 3. Layout Architecture

### 3.1 The Five Zones

```
┌─────────────────────────────────────────────────────────────────┐
│  ZONE 1: TOP BAR (40px fixed)                                   │
│  Logo | Mode Badge | Symbol Search | Clock | Alerts | User      │
├────────────┬────────────────────────────────────┬───────────────┤
│            │  ZONE 3: MAIN CONTENT AREA         │               │
│  ZONE 2:   │  (fills remaining space)           │  ZONE 4:      │
│  LEFT NAV  │                                    │  RIGHT        │
│  (collapsed│  [Primary Panel / Chart]           │  SIDEBAR      │
│   = 48px,  │                                    │  (collapsible │
│   expanded │  [Secondary Panels below or split] │   = 320px)    │
│   = 220px) │                                    │               │
│            │                                    │               │
├────────────┴────────────────────────────────────┴───────────────┤
│  ZONE 5: BOTTOM DOCK (variable height, collapsible)             │
│  Order Entry | Time & Sales | Trade Log | Status Bar            │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Zone Specifications

#### Zone 1 — Top Bar (40px, always visible)
- **Left:** Apex logo (24px) + vertical divider + Active Mode Badge (pill: Live/Paper/Backtest/Replay with mode color)
- **Center:** Global Symbol Search (Bloomberg-style, always focused on `/` key)
- **Right:** Market clock (exchange time zones) | Latency indicator | Alerts bell (unread count) | Connection status (WS dot) | User avatar + menu
- **Background:** #0C0E12 — deepest layer, creates visual separation
- **Height:** 40px — compact, never doubles

#### Zone 2 — Left Navigation (48px collapsed / 220px expanded)
- **Default state:** Collapsed (icon-only) — maximum chart real estate
- **Expand:** Hover or keyboard shortcut `Alt+N`
- **Icons:** 20px Lucide icons, 40px touch targets, tooltip on hover
- **Active state:** Brand blue left border (3px) + #1E222D bg
- **Sections:**
  1. Trading (chart, orders, blotter)
  2. Portfolio (positions, performance, attribution)
  3. Risk (VaR, scenarios, stress test)
  4. Options (chain, vol surface, strategy lab)
  5. Backtest (runner, results, walk-forward)
  6. Research (news, fundamentals, sentiment)
  7. AI/Autopilot
  8. Platform (settings, admin, observability)
- **Bottom pins:** Settings gear, Help `?`, User profile

#### Zone 3 — Main Content
- **Chart view:** Chart takes 100% width, indicators/price strip along top
- **Dashboard view:** Flexible grid of resizable panels (react-resizable-panels)
- **Multi-chart:** Up to 4 charts in configurable split layouts (2x1, 2x2, 3x1, 1+3, etc.)
- **Panel resize:** Drag handles on all panel borders, double-click to equalize

#### Zone 4 — Right Sidebar (320px, collapsible)
- **Default:** Collapsed (saves 320px for chart)
- **Toggle:** `Alt+R` or panel icon in top-right corner
- **Content (context-sensitive):**
  - On chart: Order ticket, watchlist, news feed
  - On portfolio: Position details, attribution breakdown
  - On backtest: Strategy parameters, quick metrics
  - On options: Greeks, payoff diagram
- **Always pinnable:** Any panel can be pinned to remain open

#### Zone 5 — Bottom Dock
- **Default height:** 0px (hidden) or 160px (trade log visible)
- **Expand handles:** Drag up from bottom or click dock icons
- **Tabs:** Orders | Positions | Time & Sales | Trade Log | Alerts | News
- **Status bar** (always visible, 20px): Mode | Connection | Last price update | Data provider health

### 3.3 Workspace System

Bloomberg-style workspace management:

```
Workspace = Named set of:
  - Panel layout (which views, what sizes, what positions)
  - Active symbols per panel
  - Active indicators per chart
  - Right sidebar state + content
  - Bottom dock state + active tab
  - Linked panels (color groups)

Workspaces stored in: Zustand workspaceStore → localStorage + backend sync
Switching: Workspace picker in top bar → instant restore (< 100ms)
Defaults: "Trading", "Portfolio", "Research", "Backtest", "Options"
Custom: Users can save/name/share any layout
```

### 3.4 Panel Linking

Bloomberg color-link system — panels linked by color respond to the same symbol:

```
Link Groups: Red | Blue | Green | Yellow | Purple | Orange
Usage: Set chart panel to "Blue", orders panel to "Blue" → changing chart symbol also changes orders panel symbol
Visual indicator: Small colored dot in panel top-right corner
```

---

## 4. Core Views — Detailed Specifications

### 4.1 Trading / Chart View

**The most important screen. Must match TradingView SuperCharts quality.**

#### Chart Header Strip (32px)
```
[Symbol] [Exchange] [Price] [Change] [Change%] [OHLCV] | [Timeframe selector] [Chart type] [Indicators ⊕] [Compare ⊕] | [Drawing tools toggle] [Template] [Screenshot] [Layout]
```

- **Symbol display:** "AAPL" (Inter 14px bold white) | "NASDAQ" (11px muted) | "$182.45" (16px JetBrains Mono, green/red) | "+1.23 (+0.68%)" (13px, colored)
- **OHLCV strip:** "O:181.20 H:183.10 L:180.85 C:182.45 V:48.2M" (11px mono muted) — appears on crosshair hover, always shows latest on static
- **Timeframe buttons:** 1m | 5m | 15m | 1h | 4h | D | W | M | custom — current = white bg, rest = transparent
- **Chart type icons:** Candlestick (default), Heikin-Ashi, Line, Area, Bar, Renko, PnF, Kagi — icons, no text
- **Indicators button:** "⊕ Indicators (3)" — opens indicator modal, count = currently active

#### Chart Canvas
```
Background:         #131722
Grid lines:         #1E222D (subtle, don't compete with price)
Crosshair:          #787B86 dashed lines, full height/width
Price scale (right):40px width, JetBrains Mono, auto-formatted
Time scale (bottom):20px height, formatted per timeframe
Volume bars:        Bottom 15% of chart, semi-transparent (20% opacity)
Current price line: Dashed #D1D4DC, right-side label in #0C0E12 bg
High/Low lines:     Optional, subtle #5D606B
```

#### Drawing Tools Sidebar (left, icon-only, 36px wide)
```
Lines:     Trend line, Horizontal, Vertical, Ray, Extended, Cross, Parallel channel
Fibonacci: Retracement, Extension, Channel, Fan, Arc, Time Zone
Patterns:  ABCD, XABCD, Head & Shoulders, Elliott Wave, Harmonic
Shapes:    Rectangle, Triangle, Circle, Arrow, Brush, Highlighter
Text:      Text label, Note, Callout, Price label, Anchored note
Gann:      Gann box, Gann square, Gann fan
Measure:   Price range, Date range, Price + Date range
Trade:     Long position, Short position, Forecast
Special:   Magnet mode, Lock all, Visible on this TF only
```

All drawing tools:
- Snap to OHLCV (magnet mode)
- Right-click → Edit properties
- Lock to prevent accidental moves
- Visibility rules: "show on 1D and above only"
- Save as drawing template

#### Indicator Panel (below chart, collapsible)
Each sub-chart has:
```
[Indicator name] [Settings gear] [Visibility toggle] [Close X]  ←  header (20px)
[Chart area]
```

Sub-charts: RSI, MACD, Volume, Stochastic, ATR, OBV, etc. — all resizable.

#### Right-Click Context Menu (on chart)
```
Add indicator | Add drawing | 
──────────────
Go to... (date picker) | Replay from here |
──────────────
Price scale: Linear | Log | % 
Auto-scale | Reset scale |
──────────────
Take screenshot | Print |
──────────────
Panel settings | Workspace settings
```

### 4.2 Order Entry

**The most critical interaction. Must be flawless.**

#### Order Ticket (Right sidebar or floating modal)

```
┌──────────────────────────────┐
│  AAPL  NASDAQ  ·  $182.45  ↑ │  ← Symbol header
├──────────────────────────────┤
│  [BUY]          [SELL]       │  ← Direction toggle (green/red bg when active)
├──────────────────────────────┤
│  Order type: [Market ▾]      │
│  Quantity:   [___100____]    │  ← Shares
│  Limit price:[___182.50__]   │  ← Only shows for Limit/Stop-Limit
│  Stop price: [___181.00__]   │  ← Only shows for Stop
│  TIF:        [Day ▾]         │  ← GTC | Day | IOC | FOK | etc.
├──────────────────────────────┤
│  Est. value:  $18,250.00     │
│  Buying power: $45,000.00    │
│  Risk check:   ✓ Passed      │  ← or ✗ with reason
├──────────────────────────────┤
│  [PLACE BUY ORDER ↑]         │  ← green button, requires confirm
└──────────────────────────────┘
```

**Order flow:**
1. Place → Confirm dialog (1 click, 3-second auto-dismiss option)
2. Submitting → Button shows spinner + "Sending..."
3. Accepted → Toast: "BUY 100 AAPL @Market — Accepted #ORD-4521"
4. Filled → Toast: "FILLED 100 AAPL @182.47 — $18,247.00"
5. Rejected → Banner: "REJECTED: Insufficient buying power"

**Risk pre-check rules (real-time, inline):**
- Position size exceeds limit → amber warning
- Notional exceeds daily limit → red block
- Short selling not enabled → red block
- Outside market hours → amber warning with session info
- Order would cause concentration > threshold → amber warning

### 4.3 Dashboard View

**Bento grid layout — configurable tiles.**

#### Default Layout (1440px)
```
┌────────────────┬──────────┬──────────┐
│  MAIN CHART    │  ORDERS  │  P&L     │
│  (SPY, 1D)     │  BLOTTER │  TODAY   │
│  (60% height)  │          │          │
├────────┬───────┤          │          │
│ WATCH  │ NEWS  │          ├──────────┤
│ LIST   │ FEED  │          │  RISK    │
│        │       │          │  METRICS │
├────────┴───────┴──────────┴──────────┤
│  MARKET TAPE (scrolling ticker)      │
└──────────────────────────────────────┘
```

#### KPI Strip (top of dashboard, 56px)
```
[Account Value: $127,450] [Day P&L: +$2,341 (+1.87%)] [Open P&L: +$8,920] [Positions: 12] [Day Trades: 3] [Buying Power: $45,200] [Beta: 0.94] [VaR (95%): $3,400]
```
All values update in real-time with price flash on change.

### 4.4 Portfolio View

#### Layout
```
┌───────────────────────────────────────────────┐
│  KPI Strip: Total Value | Day P&L | Return | Beta | VaR │
├─────────────────────────┬─────────────────────┤
│  POSITIONS TABLE        │  ALLOCATION PIE     │
│  (sortable, filterable) │  Sector / Asset     │
│  Symbol | Qty | Avg | P&L| MktVal | Weight    │
├─────────────────────────┼─────────────────────┤
│  PERFORMANCE CHART      │  RISK METRICS       │
│  (equity curve vs bench)│  Sharpe | Sortino   │
│                         │  MaxDD | Calmar     │
├─────────────────────────┴─────────────────────┤
│  ATTRIBUTION TABLE (Brinson: Alloc/Select/Int)│
└───────────────────────────────────────────────┘
```

#### Positions Table Columns
```
Symbol | Name | Qty | Avg Cost | Last | P&L $ | P&L % | Mkt Value | Weight | Beta | Delta (if options) | Days Held | Actions
```

Rows:
- Color-coded P&L (green positive, red negative)
- Inline sparkline (7-day price mini chart, 40px wide)
- Right-click: Close position | Add to watchlist | View chart | Edit stop
- Keyboard: Arrow keys to navigate, Enter to open detail, Del to close

### 4.5 Risk View

#### Risk Dashboard Layout
```
┌──────────────┬──────────────┬──────────────┐
│  VaR GAUGE   │  EXPOSURE    │  GREEKS      │
│  1D 95%      │  BY SECTOR   │  NET PORTFOLIO│
│  $3,400      │  (bar chart) │  Δ Γ Θ Ν Ρ   │
├──────────────┴──────────────┴──────────────┤
│  VaR BREAKDOWN TABLE                       │
│  Asset | Weight | Individual VaR | Marginal│
├─────────────────────────────────────────────┤
│  STRESS TEST SCENARIOS                     │
│  2008 GFC | 2020 COVID | 2000 Dot-com | Custom│
├─────────────────────────────────────────────┤
│  CORRELATION MATRIX HEATMAP                │
└─────────────────────────────────────────────┘
```

---

## 5. Component Design Specifications

### 5.1 Data Tables

Trading tables require pixel-perfection for readability:

```
Row height:      28px (compact) / 36px (comfortable)
Header height:   32px
Header bg:       #1E222D
Header text:     #787B86 / 11px / uppercase / letter-spacing 0.05em
Cell text:       #D1D4DC / 13px / JetBrains Mono for numbers
Cell padding:    0 8px
Alternating rows: none (flat is cleaner at this density)
Hover row:       bg #181C27
Selected row:    bg #1a2040, left border 2px #2962FF
Sorted column:   header underline #2962FF
Frozen columns:  Shadow right edge: 4px solid rgba(0,0,0,0.5)
```

**Column types:**
- **Number/Price:** Right-aligned, JetBrains Mono, tabular-nums
- **P&L columns:** Right-aligned, colored (#089981 or #F23645)
- **Text:** Left-aligned, Inter
- **Symbol:** Left-aligned, Inter bold (13px)
- **Status:** Center-aligned, StatusBadge component
- **Actions:** Center-aligned, icon buttons (appear on row hover)

**Performance requirements:**
- Virtual scrolling: Required for >100 rows (useVirtualList hook)
- Streaming updates: Only re-render changed cells (memoization + cell-level keys)
- Sort/filter: Client-side for <10K rows, server-side above that

### 5.2 Buttons

```
Variants:
  primary    — bg #2962FF → hover #1E53E4 / white text / 4px radius
  danger     — bg #F23645 → hover #CC2230 / white text
  success    — bg #089981 → hover #0AAE8E / white text
  ghost      — transparent → hover bg #1E222D / #D1D4DC text
  outline    — border #2A2E39 → hover border #434651
  muted      — bg #1E222D → hover bg #242836

Sizes:
  sm:  28px height / 12px text / 8px h-padding
  md:  32px height / 13px text / 12px h-padding (default)
  lg:  36px height / 14px text / 16px h-padding
  xl:  40px height / 14px text / 20px h-padding

States:
  loading:  Replace text with spinner, disable pointer events
  disabled: opacity 0.4, cursor not-allowed
  
All: cursor-pointer / transition-colors duration-150
```

### 5.3 Panels

```
Structure:
  Panel header (32px): [Icon] [Title] [badge/count] ── flex-1 ── [toolbar buttons] [collapse ▲▼]
  Panel body: overflow-auto, padding 12px
  Panel footer (optional): 32px, action buttons

Header bg: #1E222D
Body bg:   #131722
Border:    1px solid #2A2E39
Resize handle: 4px, appears on hover as #434651 bg

Panel states:
  Normal: As above
  Collapsed: Header only (32px), body hidden, collapse icon rotates
  Loading: Skeleton placeholders in body
  Error: ErrorBanner in body, retry button
  Empty: EmptyState component with contextual message
```

### 5.4 Command Palette

Bloomberg-style command bar — the power user's primary navigation tool:

```
Trigger: Cmd+K / Ctrl+K  (or type any letter in the command bar in top bar)
Appearance: Modal, centered, 560px wide, max-h 400px
Bg: #1E222D / shadow Level 4 / border #434651 / radius 8px

Layout:
  [🔍 Search...___________________________] ← 40px input, always focused
  ──────────────────────────────────────
  [Category label: RECENT]
  [Command row: icon | name | description | shortcut]
  [Command row: icon | name | description | shortcut]
  ──────────────────────────────────────
  [Category label: TRADING]
  [Command row...]

Command categories:
  Recent commands (5 max)
  Trading: Buy, Sell, New order, Cancel all
  Navigation: Go to [page]
  Chart: Add indicator, Change timeframe, Toggle drawing tools
  Data: Load symbol, Compare symbol, Change data source
  Workspace: Save layout, Load layout, Split chart
  Settings: Preferences, Shortcuts, Theme
  Bloomberg functions: AAPL<EQUITY>GO syntax

Row height: 40px
Active row: bg #2962FF/15% + border-left 2px #2962FF
Icon: 16px Lucide
Name: 13px Inter
Shortcut: 11px mono, right-aligned, #5D606B
```

### 5.5 Tooltips & Popovers

```
Tooltip (info on hover):
  Delay: 400ms show / 100ms hide
  Max width: 280px
  Bg: #242836
  Border: 1px solid #434651
  Shadow: Level 3
  Radius: 6px
  Text: 12px Inter / #D1D4DC
  Arrow: 6px

Data tooltip (chart crosshair):
  Shows: Date | O | H | L | C | V | All active indicator values
  Layout: Grid, symbol-aligned columns
  Position: Follows cursor, flips at viewport edges
  Performance: requestAnimationFrame for smooth 60fps tracking

Popover (interaction required):
  Same styles as tooltip
  Click outside to close
  Focus trap enabled
  Escape to close
```

### 5.6 Status Indicators

```
Live data dot:  8px circle, animated pulse
  Green pulse:  Connected, data flowing
  Amber static: Connected, data delayed > 5s
  Red static:   Disconnected

Mode badge (top bar):
  [● LIVE]     — #089981 bg/10%, #089981 text, green dot
  [● PAPER]    — #F59E0B bg/10%, #F59E0B text, amber dot
  [◉ BACKTEST] — #06B6D4 bg/10%, #06B6D4 text, cyan bars icon
  [▶ REPLAY]   — #9333EA bg/10%, #9333EA text, purple play icon

Price change indicators:
  Up arrow: ▲ (Unicode) / Lucide TrendingUp — #089981
  Down arrow: ▼ (Unicode) / Lucide TrendingDown — #F23645
  Flat: — (dash) — #787B86
```

---

## 6. Interaction Patterns

### 6.1 Keyboard Shortcuts (Full Map)

**Global (always active):**
```
/              — Focus symbol search
Cmd+K          — Command palette
Alt+N          — Toggle left nav
Alt+R          — Toggle right sidebar
Alt+B          — Toggle bottom dock
Cmd+1..9       — Switch to workspace 1-9
Cmd+Shift+S    — Save current workspace
Cmd+Z / Cmd+Y  — Undo / Redo (drawings, layout)
Escape         — Close modal / deselect / cancel drawing
```

**Chart (when chart focused):**
```
→ / ←          — Scroll chart (1 bar)
Shift+→ / ←    — Scroll chart (10 bars)
Alt+→ / ←      — Scroll to next/prev earnings
+ / -          — Zoom in / out
0              — Reset zoom (fit all)
D              — Daily timeframe
W              — Weekly
M              — Monthly
1..5           — 1m, 5m, 15m, 1h, 4h
C              — Candlestick
L              — Line chart
A              — Area chart
T              — Select drawing tool (cycles through favorites)
Delete         — Delete selected drawing
Cmd+A          — Select all drawings
Cmd+C/V        — Copy/paste drawings
R              — Toggle chart replay
Cmd+S          — Screenshot chart
```

**Order Entry:**
```
B              — Buy order (when on chart/trading view)
S              — Sell order
O              — Open order ticket
Cmd+Enter      — Submit order (when ticket focused)
Escape         — Cancel / close ticket
```

**Tables / Lists:**
```
↑ / ↓          — Navigate rows
Enter          — Open selected item detail
Delete         — Close position / cancel order
Cmd+F          — Filter/search within table
Cmd+E          — Export table to CSV
```

### 6.2 Drag and Drop

```
Panel repositioning:
  Drag panel header → ghost outline shows valid drop zones
  Drop target highlights in brand blue (#2962FF)
  Snap to grid: 4-column layout guide

Watchlist reordering:
  Drag row handle (left side, 6px)
  Smooth re-ordering animation (Framer Motion-style)

Drawing tools:
  Drag existing drawings to move
  Drag endpoints to resize
  Snap to price/time when within 5px (magnet mode)
```

### 6.3 Context Menus

Right-click triggers context menu, styled as:
```
Position: Cursor-relative, flips at viewport edges
Min-width: 180px
Item height: 32px
Icon: 14px Lucide, left-aligned
Text: 13px Inter
Shortcut: Right-aligned, 11px mono muted
Separator: 1px #2A2E39
Active item: bg #1E222D
Danger item: text #F23645
```

### 6.4 Modal Dialogs

```
Overlay: rgba(0,0,0,0.7) full-screen backdrop
Focus trap: Tab cycles within modal
Escape: Close (unless destructive confirm)
Animation: scale(0.97) + opacity(0) → scale(1) + opacity(1), 200ms ease-out

Header (48px): [Icon] [Title] ── flex-1 ── [Close ×]
Body: scroll if content exceeds 80vh
Footer: right-aligned action buttons

Sizes:
  sm: 400px wide    — Confirms, alerts
  md: 560px wide    — Forms, settings
  lg: 720px wide    — Complex editors
  xl: 960px wide    — Full feature modals (strategy builder, indicator settings)
  fullscreen: 95vw × 95vh  — IDE, report builder
```

### 6.5 Toast Notifications

```
Position: Bottom-right, 16px from edges
Width: 320px max
Animation: slide-in from right (200ms), slide-out right (150ms)
Stack: max 4 visible, older ones compress

Types:
  success: border-left 3px #089981 + icon
  error:   border-left 3px #F23645 + icon
  warning: border-left 3px #F7931A + icon
  info:    border-left 3px #2962FF + icon

Auto-dismiss:
  success: 4s
  info:    5s
  warning: 8s
  error:   persistent (manual dismiss required)

Order events (special):
  Larger (400px wide), shows: action | symbol | qty | price | order ID
  Green/red border matching direction
  "View in blotter" link
```

---

## 7. Page-by-Page Design Specifications

### 7.1 Trading / Chart Page

```
Layout: Full-window chart, all chrome minimal
Chart: 100% available space
Left: Drawing tools sidebar (collapsed by default)
Right: Order ticket (collapsed by default)
Bottom: Time & Sales dock (collapsed by default)
Top strip: Symbol, OHLCV, chart controls

Key design rules:
- Zero padding on chart container (chart fills every pixel)
- All overlays (indicator panels, drawings) rendered within chart
- No background color change ever — #131722 always
- Crosshair follows cursor at 60fps (requestAnimationFrame)
- Legend updates on crosshair move, not on data change
```

### 7.2 Dashboard Page

```
Default workspace tiles (user-configurable):
  Top: KPI strip (account value, P&L, positions count, buying power, VaR)
  Main area: 3-column bento grid
    Col 1 (50%): Primary chart (SPY default, configurable)
    Col 2 (25%): Watchlist (streaming quotes, 15 symbols)
    Col 3 (25%): Orders blotter (top 10 open orders)
  Below: Market tape (scrolling ticker, all watchlist symbols)
  Right sidebar: News feed (configurable source)

Tile interaction:
  Hover: Tile header appears with settings/expand icons
  Drag corner: Resize tile (grid-snapping)
  Double-click header: Expand to full page
  Right-click header: Replace tile type menu
```

### 7.3 Portfolio Page

```
Header: Portfolio selector dropdown (multi-portfolio support)
KPI Strip: Total value | Day P&L | Total P&L | Sharpe | MaxDD | Beta | VaR

Main content (3-column):
  Left (55%):
    Positions table (primary, virtual scrolling)
    → Expandable row: individual position P&L chart, Greeks if options
  
  Right top (45%): 
    Allocation pie/treemap (by sector, asset class, or instrument)
    Toggle: Pie | Treemap | Sunburst
  
  Right bottom:
    Performance chart: Equity curve vs benchmark
    Time selector: 1D | 1W | 1M | 3M | YTD | 1Y | All

Below main (tabbed):
  Attribution | Risk Decomposition | Trade History | Rebalancing
```

### 7.4 Options Page

```
Header: Underlying selector (AAPL, SPY, etc.) + Expiry selector
KPI Strip: IV Rank | IV Percentile | Put/Call Ratio | 30D HV | Current IV

Main content:
  Left (60%): Options chain table
    Columns: Strike | Calls (Bid/Ask/IV/Delta/OI/Vol) | Strike | Puts (...)
    Color coding: In-the-money rows slightly brighter bg
    Highlighted: ATM strike with bold border
  
  Right (40%): 
    Top: Payoff diagram (P&L at expiry)
    Bottom: Strategy legs summary table

Side panel (tabbed): 
  Greeks | IV Surface | Term Structure | Skew Chart
```

### 7.5 Backtest Page

```
Layout: Split pane

Left (35%): Strategy configuration
  - Entry/exit conditions builder (drag & drop or code)
  - Parameters: commission, slippage, initial capital
  - Date range selector
  - Run button (prominent)

Right (65%): Results (appears after run)
  Top: Performance summary cards (Sharpe, MaxDD, Win rate, Profit factor)
  Charts (tabbed):
    Equity Curve (vs benchmark)
    Drawdown chart
    Monthly returns heatmap (calendar)
    Trade distribution histogram
  Bottom: Trade-by-trade log (sortable table)
```

---

## 8. Accessibility Standards

### WCAG 2.1 AA Requirements

| Requirement | Implementation |
|-------------|----------------|
| Color contrast 4.5:1 (normal text) | All text colors verified: #D1D4DC on #131722 = 8.1:1 ✓ |
| Color contrast 3:1 (large text) | Price displays: #D1D4DC on #0C0E12 = 9.1:1 ✓ |
| Focus rings visible | 2px #2962FF ring on all interactive elements |
| Keyboard navigation | Full Tab order, arrow keys in tables/lists |
| Screen reader | aria-labels on all icon buttons, live regions for price updates |
| Skip links | "Skip to main content" as first focusable element |
| Form labels | All inputs have visible or sr-only labels |
| Error identification | Errors described in text, not color alone |
| Color not sole indicator | All status uses icon + color |
| Reduced motion | `prefers-reduced-motion: reduce` disables all animations |
| Font scaling | UI functional at 200% browser zoom |
| High contrast | High contrast mode: pure #FFFFFF/#000000, no intermediates |

### Color Blind Support

```
Colorblind modes (settings toggle):
  Deuteranopia (most common): Replace red/green with blue/orange
    Up:   #0284C7 (blue)
    Down: #EA580C (orange)
  
  Protanopia: Same blue/orange scheme
  
  Tritanopia: Replace blue with purple
    Up:   #089981 (keep green)
    Down: #F23645 (keep red)
    Brand: #9333EA (purple instead of blue)

Pattern indicators: In addition to color, use ▲▼ symbols always
```

---

## 9. Performance Requirements

### Rendering Targets

| Metric | Target | Implementation |
|--------|--------|----------------|
| Chart initial render | < 100ms | Canvas-based lightweight-charts |
| Chart data update | < 16ms (60fps) | requestAnimationFrame, off-main-thread calc |
| Price tick flash | < 16ms per tick | CSS transition, no JS layout |
| Table row update | < 16ms | React.memo + cell-level keys |
| Page route transition | < 300ms | Code splitting, lazy routes |
| Command palette open | < 50ms | Pre-rendered, Suspense boundary |
| WebSocket throughput | 10,000 msg/sec | Web Worker message queue |
| Large dataset render | < 100ms | Virtual scrolling (useVirtualList) |
| Modal open | < 100ms | Pre-mount, opacity transition |

### Technical Architecture for Performance

```
Web Workers:
  Indicator calculations (moving averages, RSI, etc.) → worker
  Backtest simulation → worker
  Risk calculations (VaR, Monte Carlo) → worker
  Data aggregation → worker

Virtual DOM optimization:
  Tables > 50 rows: react-window or useVirtualList
  Charts: Canvas-only (no DOM elements per data point)
  Streaming updates: Batch DOM mutations with useTransition

State management:
  Market data: Zustand with selective subscriptions
  Chart data: Local component state (avoid global re-renders)
  Layout: WorkspaceStore (low-frequency updates)

Code splitting:
  Each major route: lazy(() => import(...))
  Heavy libraries (Chart.js, Monaco): lazy loaded
  Three.js (vol surface 3D): lazy loaded
```

---

## 10. Responsive Design

### Breakpoints

```
1920px+:  Full desktop — all panels visible simultaneously, maximum density
1440px:   Standard desktop — default layout, all zones comfortable
1280px:   Compact desktop — sidebar auto-collapsed, reduced padding
1024px:   Minimum desktop — bottom dock hidden by default
768px:    Tablet — single-panel mode, simplified navigation
480px:    Mobile — chart-only mode, drawer navigation
```

### Adaptive Behavior

| Screen | Changes |
|--------|---------|
| ≤ 1280px | Left nav collapses by default, right sidebar hidden |
| ≤ 1024px | Bottom dock hidden, KPI strip shows 4 metrics max |
| ≤ 768px | Full-screen single panel, hamburger menu, swipe between panels |
| ≤ 480px | Chart full-screen, order ticket as bottom sheet, tap-friendly controls |

**Mobile-specific:**
- Touch targets minimum 44×44px
- Swipe gestures: left/right = chart scroll, up = price scale zoom
- Bottom sheet order ticket (slides up from bottom)
- Pinch-to-zoom on charts
- Haptic feedback on order placement (navigator.vibrate)

---

## 11. Data Mode Visual System

The active trading mode must always be visually unambiguous — users risk real money.

### Visual Mode Declaration

**Every surface in the app shows the current mode:**

```
Top bar: Mode badge (color + label) — always visible
Page background: Subtle top border (2px, mode color) — ambient reminder
Order ticket: Tinted header background (mode color at 10% opacity)
Chart header: Mode color pip next to symbol
Bottom status bar: Mode indicator + description
```

**Mode transition animation:**
When switching modes (e.g., Live → Backtest):
1. Brief full-screen overlay (0.3s): "SWITCHING TO BACKTEST MODE" in cyan
2. All data sources switch
3. Timestamp resets / changes
4. Confirmation toast: "Now in Backtest Mode — Aug 1, 2020 to Jan 1, 2021"

---

## 12. Implementation Roadmap

### Phase A: Foundation (Weeks 1-2)
1. Implement design token system fully (CSS vars + Tailwind tokens aligned)
2. Audit all existing components for token usage (no hardcoded colors)
3. Typography audit (eliminate Arial/Roboto remnants)
4. Spacing audit (enforce 4px grid throughout)
5. Accessibility audit with axe-core (WCAG AA baseline)

### Phase B: Core Shell (Weeks 3-4)
6. Top bar redesign (40px, compact, all required elements)
7. Left nav (48px collapsed / 220px expanded, icon-first)
8. Right sidebar (320px collapsible, context-sensitive)
9. Bottom dock (tabs, draggable height)
10. Command palette (cmdk, full keyboard navigation, Bloomberg-style search)

### Phase C: Trading View (Weeks 5-7)
11. Chart header strip (OHLCV, controls, timeframe selector)
12. Drawing tools sidebar (all 70+ tools, proper icons)
13. Indicator panel (sub-chart management, resize handles)
14. Crosshair implementation (60fps, full OHLCV + indicator values)
15. Right-click context menu (full feature set)
16. Order ticket (complete, all order types, risk checks)

### Phase D: Tables & Data (Weeks 8-9)
17. DataTable redesign (virtual scroll, streaming updates, column types)
18. Positions table (all columns, inline sparklines, row actions)
19. Orders blotter (full lifecycle, cancel/amend inline)
20. Options chain table (bid/ask/IV/greeks, ITM/OTM visual distinction)

### Phase E: Analytical Views (Weeks 10-12)
21. Portfolio view (KPI strip, allocation chart, performance curve, attribution)
22. Risk dashboard (VaR gauges, stress scenarios, correlation matrix)
23. Options dashboard (payoff chart, IV surface, strategy builder)
24. Backtest results view (equity curve, drawdown, monthly heatmap)

### Phase F: Polish & Performance (Weeks 13-14)
25. Animation audit (150-300ms all interactions, reduce-motion compliance)
26. Performance profiling (chart rendering, table updates, WS throughput)
27. Keyboard shortcut completion (all 60+ shortcuts)
28. Accessibility final audit (axe-core + manual screen reader test)
29. Colorblind modes implementation
30. Mobile/responsive pass

---

## 13. Design Anti-Patterns to Avoid

| Anti-Pattern | Why | Instead |
|-------------|-----|---------|
| Purple gradients on white | Generic AI aesthetic | Dark terminal theme, purposeful color |
| Emoji as UI icons | Inconsistent, inaccessible | Lucide SVG icons throughout |
| Animations >350ms | Feels slow at trading speed | 150-300ms micro-interactions |
| Modal on every action | Breaks flow | Inline editing, slide-in panels |
| Infinite loading spinners | No feedback on failure | Timeout → error state with retry |
| Pagination in trading tables | Must see all positions at once | Virtual scrolling |
| Light mode default | Financial pros use dark mode | Dark default, light mode toggle optional |
| Color as sole status indicator | Accessibility failure | Icon + color + text always |
| Fixed-width sidebar at small screens | Content crowded | Collapsible with icon-only fallback |
| Toast for every data update | Notification blindness | Only for user-triggered events and errors |
| Bold red/green on white | Harsh, unprofessional | Semantic color on dark backgrounds only |
| Inter at 16px for prices | Proportional ≠ aligned columns | JetBrains Mono for all numeric data |
| Flat z-index (everything =10) | Z-fighting chaos | Strict z-index token system |

---

## 14. Design Checklist (Per Component)

Before any component ships:

**Visual:**
- [ ] Uses only design token colors (no hardcoded hex)
- [ ] Typography from scale (no custom font sizes)
- [ ] Spacing from 4px grid
- [ ] No emoji used as icons
- [ ] Hover state provides visual feedback
- [ ] Active/selected state visually distinct
- [ ] Loading state (skeleton or spinner)
- [ ] Empty state (informative placeholder)
- [ ] Error state (with retry action)

**Interaction:**
- [ ] cursor-pointer on all clickable elements
- [ ] transition-colors/opacity on hover (150-300ms)
- [ ] Keyboard accessible (Tab, Enter, Escape, Arrow keys)
- [ ] Focus ring visible (2px #2962FF)
- [ ] Disabled state (opacity 0.4, cursor not-allowed)

**Accessibility:**
- [ ] Color contrast ≥ 4.5:1 for text
- [ ] Icon buttons have aria-label
- [ ] Images have alt text
- [ ] aria-live for price/data updates
- [ ] prefers-reduced-motion respected

**Performance:**
- [ ] No layout thrash on update (transform/opacity only for animation)
- [ ] Large lists are virtualized
- [ ] Images use WebP + lazy loading
- [ ] Event listeners cleaned up on unmount

**Responsive:**
- [ ] Functions at 375px, 768px, 1024px, 1440px
- [ ] No horizontal scroll at any breakpoint
- [ ] Touch targets ≥ 44×44px
