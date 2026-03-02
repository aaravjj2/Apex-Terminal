# Keyboard Shortcut Reference

> Complete shortcut map for Apex Terminal. All bindings are configurable via Settings → Keyboard.

## Table of Contents

- [Global Navigation](#global-navigation)
- [Command Palette & Search](#command-palette--search)
- [Charting](#charting)
- [Drawing Tools](#drawing-tools)
- [Trading](#trading)
- [Workspace & Layout](#workspace--layout)
- [Data & Panels](#data--panels)
- [Accessibility](#accessibility)
- [Customization](#customization)

---

## Global Navigation

Navigate between major sections using `G` followed by a second key (vim-style go-to).

| Shortcut | Action | Route |
|----------|--------|-------|
| `G` then `D` | Go to Dashboard | `/dashboard` |
| `G` then `C` | Go to Chart | `/chart` |
| `G` then `T` | Go to Trading | `/trading` |
| `G` then `P` | Go to Portfolio | `/portfolio` |
| `G` then `O` | Go to Options | `/options` |
| `G` then `N` | Go to News | `/news` |
| `G` then `S` | Go to Screener | `/screener` |
| `G` then `B` | Go to Backtesting | `/backtest` |
| `G` then `A` | Go to Alerts | `/alerts` |
| `G` then `W` | Go to Watchlist | `/watchlist` |
| `G` then `R` | Go to Reports | `/reports` |

---

## Command Palette & Search

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` / `⌘+K` | Open command palette (cmdk) |
| `/` | Focus symbol search |
| `Escape` | Close palette / cancel current action |
| `Ctrl+Shift+P` | Open settings |
| `Ctrl+Shift+F` | Global search across all panels |

### Command Palette Actions

Type any command in the palette. Fuzzy matching is supported.

```
> chart AAPL          → open chart for AAPL
> indicator RSI       → add RSI indicator
> layout 3-panel      → switch layout
> theme dark          → switch theme
> export png          → export chart as PNG
```

---

## Charting

| Shortcut | Action |
|----------|--------|
| `I` | Open indicator selector |
| `D` | Open drawing tool selector |
| `T` | Toggle timeframe picker |
| `F` | Toggle fullscreen chart |
| `Ctrl+Z` / `⌘+Z` | Undo last chart action |
| `Ctrl+Shift+Z` / `⌘+Shift+Z` | Redo |
| `Ctrl+S` / `⌘+S` | Save chart layout |
| `R` | Reset chart zoom |
| `L` | Toggle log scale |
| `A` | Toggle auto-scale |
| `X` | Toggle crosshair |
| `.` | Snap to latest candle |
| `[` | Previous symbol in watchlist |
| `]` | Next symbol in watchlist |

### Timeframe Quick Keys

| Shortcut | Timeframe |
|----------|-----------|
| `1` | 1 minute |
| `5` | 5 minutes |
| `Shift+1` | 15 minutes |
| `Shift+3` | 30 minutes |
| `H` | 1 hour |
| `Shift+4` | 4 hours |
| `Shift+D` | 1 day |
| `W` | 1 week |
| `M` | 1 month |

---

## Drawing Tools

| Shortcut | Tool |
|----------|------|
| `Alt+T` | Trend line |
| `Alt+H` | Horizontal line |
| `Alt+V` | Vertical line |
| `Alt+R` | Rectangle |
| `Alt+F` | Fibonacci retracement |
| `Alt+P` | Pitchfork |
| `Alt+C` | Channel |
| `Alt+A` | Arrow |
| `Alt+X` | Text annotation |
| `Delete` / `Backspace` | Delete selected drawing |
| `Ctrl+A` | Select all drawings |
| `Ctrl+D` | Duplicate selected drawing |
| `Ctrl+L` | Lock / unlock selected drawing |

---

## Trading

| Shortcut | Action |
|----------|--------|
| `B` | Buy / open buy order form |
| `S` | Sell / open sell order form |
| `Escape` | Cancel current order entry |
| `Enter` | Submit order |
| `Ctrl+Shift+X` | Cancel all open orders |
| `Shift+B` | Quick market buy (pre-configured size) |
| `Shift+S` | Quick market sell (pre-configured size) |
| `Ctrl+Shift+C` | Close all positions |
| `F2` | Modify selected order |

---

## Workspace & Layout

| Shortcut | Action |
|----------|--------|
| `Ctrl+1` … `Ctrl+9` | Switch to workspace 1–9 |
| `Ctrl+N` | New workspace |
| `Ctrl+W` | Close current panel |
| `Ctrl+Shift+L` | Cycle layout presets |
| `Ctrl+\` | Toggle sidebar |
| `Ctrl+Shift+T` | Toggle top toolbar |
| `Ctrl+Shift+B` | Toggle bottom panel (terminal / logs) |
| `Ctrl+Shift+D` | Toggle dark / light mode |

---

## Data & Panels

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+W` | Toggle watchlist panel |
| `Ctrl+Shift+O` | Toggle order book panel |
| `Ctrl+Shift+N` | Toggle news panel |
| `Ctrl+Shift+A` | Toggle alerts panel |
| `Ctrl+Shift+H` | Toggle trade history |
| `Ctrl+Shift+E` | Export current view as CSV |
| `Ctrl+P` | Print / export as PDF |

---

## Accessibility

| Shortcut | Action |
|----------|--------|
| `Tab` | Move focus to next element |
| `Shift+Tab` | Move focus to previous element |
| `Enter` / `Space` | Activate focused element |
| `Ctrl++` / `Ctrl+-` | Zoom UI in / out |
| `Ctrl+0` | Reset UI zoom |
| `?` | Open keyboard shortcut overlay |

---

## Customization

Shortcuts can be rebound in **Settings → Keyboard → Key Bindings**.

### Configuration Format

Bindings are stored in `localStorage` under `apex:keybindings` as a JSON map:

```json
{
  "chart.addIndicator": "i",
  "chart.fullscreen": "f",
  "trading.buy": "b",
  "navigation.dashboard": "g d"
}
```

### Conflict Resolution

When a custom binding conflicts with an existing one, the newer binding wins and the previous action becomes unbound. A warning badge appears in settings.

### Reset to Defaults

Settings → Keyboard → **Reset All** restores factory bindings.

---

*Source: `lib/platform/keyboard.ts` — see `registerShortcuts()` for the runtime binding table.*
