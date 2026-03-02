# Keyboard Shortcuts

Complete keyboard shortcut system with customizable bindings, Vim-style multi-key sequences, command palette, and per-context shortcut maps.

## Table of Contents

- [Overview](#overview)
- [Shortcut Categories](#shortcut-categories)
- [Navigation Shortcuts](#navigation-shortcuts)
- [Charting Shortcuts](#charting-shortcuts)
- [Trading Shortcuts](#trading-shortcuts)
- [Search and Command Palette](#search-and-command-palette)
- [Vim-Style Multi-Key Sequences](#vim-style-multi-key-sequences)
- [useHotkeys Hook](#usehotkeys-hook)
- [Customization](#customization)
- [Shortcut Reference Table](#shortcut-reference-table)

## Overview

The keyboard shortcut system (`lib/platform/keyboard.ts`) provides comprehensive keyboard-driven control of the entire platform. Every action accessible via mouse is also reachable through keyboard shortcuts, designed for traders who need speed.

```typescript
import { KeyboardManager } from '@/lib/platform/keyboard';
import { useHotkeys } from '@/hooks/useHotkeys';
```

## Shortcut Categories

Shortcuts are organized into contextual categories that activate based on the focused panel:

```typescript
type ShortcutCategory =
  | 'global'        // always active
  | 'navigation'    // workspace and panel navigation
  | 'charting'      // active when chart is focused
  | 'trading'       // active in order entry / trading panels
  | 'search'        // active in search/command contexts
  | 'watchlist'     // active in watchlist panel
  | 'journal'       // active in trade journal
  | 'bloomberg';    // active in Bloomberg terminal mode

interface ShortcutBinding {
  keys: string;              // e.g., 'ctrl+shift+n' or 'g c' (sequence)
  action: string;
  category: ShortcutCategory;
  description: string;
  enabled: boolean;
  customizable: boolean;
}
```

Context-aware activation prevents conflicts — charting shortcuts only fire when a chart panel has focus.

## Navigation Shortcuts

Move between panels, layouts, and views:

| Shortcut | Action |
|---|---|
| `Ctrl+1` through `Ctrl+9` | Switch to workspace panel by index |
| `Ctrl+Tab` | Cycle to next panel |
| `Ctrl+Shift+Tab` | Cycle to previous panel |
| `F1` through `F12` | Load saved layout |
| `Ctrl+N` | Open new panel |
| `Ctrl+W` | Close active panel |
| `Ctrl+Shift+F` | Toggle fullscreen for active panel |
| `Ctrl+\` | Toggle sidebar |
| `Ctrl+,` | Open settings |

## Charting Shortcuts

Control chart behavior when a chart panel is focused:

| Shortcut | Action |
|---|---|
| `1` through `9` | Switch timeframe (1=1m, 2=5m, 3=15m, 4=1h, 5=4h, 6=D, 7=W, 8=M) |
| `+` / `-` | Zoom in / out |
| `←` / `→` | Scroll chart left / right |
| `Home` / `End` | Jump to oldest / newest data |
| `Alt+H` | Toggle crosshair |
| `Alt+L` | Draw horizontal line at cursor |
| `Alt+T` | Draw trendline |
| `Alt+F` | Draw Fibonacci retracement |
| `Alt+R` | Draw rectangle |
| `Ctrl+Z` | Undo last drawing |
| `Ctrl+Shift+Z` | Redo drawing |
| `Delete` | Remove selected drawing |
| `C` | Toggle candlestick / line chart type |
| `I` | Open indicator picker |
| `S` | Screenshot chart |

## Trading Shortcuts

Quick order actions when trading panels are active:

| Shortcut | Action |
|---|---|
| `B` | Open buy order dialog |
| `S` | Open sell order dialog |
| `Ctrl+Enter` | Submit order |
| `Escape` | Cancel order dialog |
| `Ctrl+Shift+C` | Cancel all open orders |
| `Ctrl+Shift+X` | Flatten all positions |
| `Alt+A` | Open alerts manager |
| `Alt+W` | Focus watchlist |

## Search and Command Palette

Universal search and command execution:

```typescript
// Ctrl+K opens the command palette
interface CommandPaletteItem {
  id: string;
  label: string;
  category: string;
  shortcut?: string;
  action: () => void;
  icon?: string;
  keywords: string[];       // additional search terms
}
```

| Shortcut | Action |
|---|---|
| `Ctrl+K` | Open command palette |
| `Ctrl+P` | Quick symbol search |
| `/` | Focus command line (Bloomberg mode) |
| `Escape` | Close palette / clear search |

The command palette searches across all available commands, recently used symbols, settings, and documentation. Results rank by frequency of use.

## Vim-Style Multi-Key Sequences

Multi-key sequences for power users, inspired by Vim's modal editing:

```typescript
const sequences: KeySequence[] = [
  { keys: 'g c', action: 'goToChart', description: 'Go to chart' },
  { keys: 'g w', action: 'goToWatchlist', description: 'Go to watchlist' },
  { keys: 'g j', action: 'goToJournal', description: 'Go to journal' },
  { keys: 'g n', action: 'goToNews', description: 'Go to news' },
  { keys: 'g e', action: 'goToEconomicCalendar', description: 'Go to economic calendar' },
  { keys: 'g s', action: 'goToScreener', description: 'Go to screener' },
  { keys: 'g a', action: 'goToAlerts', description: 'Go to alerts' },
  { keys: 'g p', action: 'goToPortfolio', description: 'Go to portfolio' },
  { keys: 'z i', action: 'zoomIn', description: 'Zoom into chart' },
  { keys: 'z o', action: 'zoomOut', description: 'Zoom out of chart' },
  { keys: 'z r', action: 'zoomReset', description: 'Reset chart zoom' },
  { keys: 'd d', action: 'deleteDrawing', description: 'Delete selected drawing' },
  { keys: 'y y', action: 'copyDrawing', description: 'Copy selected drawing' },
  { keys: 'p p', action: 'pasteDrawing', description: 'Paste drawing' },
];
```

After pressing the first key, a 500ms timeout window waits for the second key. A visual indicator shows the pending key state.

## useHotkeys Hook

React hook for registering shortcuts in components:

```typescript
function MyComponent() {
  useHotkeys('ctrl+s', () => saveLayout(), { category: 'global' });
  useHotkeys('escape', () => closePanel(), { category: 'navigation', enabled: isPanelOpen });
  useHotkeys('g c', () => navigateTo('chart'), { category: 'navigation', sequence: true });

  useHotkeys([
    { keys: 'ctrl+shift+1', handler: () => setLayout('trading') },
    { keys: 'ctrl+shift+2', handler: () => setLayout('research') },
    { keys: 'ctrl+shift+3', handler: () => setLayout('monitor') },
  ], { category: 'navigation' });
}
```

The hook handles registration/cleanup on mount/unmount, respects focus context, and prevents conflicts with text input fields.

## Customization

Rebind any shortcut through the settings UI or programmatically:

```typescript
const { rebind, resetToDefaults, exportBindings, importBindings } = KeyboardManager;

rebind('charting.zoomIn', 'ctrl+=');
rebind('navigation.goToChart', 'g c');

const bindings = exportBindings();    // JSON export of all custom bindings
importBindings(savedBindings);        // restore from backup

resetToDefaults('charting');          // reset a category
resetToDefaults();                    // reset all
```

Custom bindings persist in the settings store. Conflict detection warns when a new binding overlaps an existing one.

## Shortcut Reference Table

Access the full shortcut reference in-app via `Ctrl+/` or the settings panel. The reference is searchable and grouped by category, showing both default and custom bindings.

```typescript
const allShortcuts = KeyboardManager.getAllBindings();
// [{ keys, action, category, description, isCustom, defaultKeys }, ...]
```
