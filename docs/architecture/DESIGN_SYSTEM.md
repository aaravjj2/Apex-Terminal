# Design System

> Design tokens, theming architecture, component library, and visual language for Apex Terminal.

---

## Table of Contents

- [Overview](#overview)
- [Design Tokens](#design-tokens)
- [Color System](#color-system)
- [Typography](#typography)
- [Spacing & Layout](#spacing--layout)
- [Component Library](#component-library)
- [Theming Architecture](#theming-architecture)
- [Iconography](#iconography)
- [Motion & Animation](#motion--animation)
- [Responsive Design](#responsive-design)

---

## Overview

Apex Terminal's design system is a dark-first, data-dense visual language optimized for professional financial workflows. It draws inspiration from Bloomberg Terminal, TradingView, and modern fintech dashboards. The system is implemented through Tailwind CSS v4 with custom design tokens defined in `tailwind.config.js`.

---

## Design Tokens

Tokens are organized in three tiers:

### Tier 1: Primitive Tokens

Raw values that form the foundation:

```javascript
// tailwind.config.js
{
  colors: {
    gray: {
      50: '#fafafa', 100: '#f5f5f5', 200: '#e5e5e5',
      300: '#d4d4d4', 400: '#a3a3a3', 500: '#737373',
      600: '#525252', 700: '#404040', 800: '#262626',
      850: '#1a1a1a', 900: '#171717', 950: '#0a0a0a',
    },
  },
}
```

### Tier 2: Semantic Tokens

Purpose-driven aliases referencing primitives:

```javascript
{
  background: {
    primary: 'var(--bg-primary)',     // Main background
    secondary: 'var(--bg-secondary)', // Card/panel background
    tertiary: 'var(--bg-tertiary)',   // Nested element background
    elevated: 'var(--bg-elevated)',   // Popover/modal background
  },
  brand: {
    primary: 'var(--brand-primary)',
    hover: 'var(--brand-hover)',
    muted: 'var(--brand-muted)',
  },
  trade: {
    buy: 'var(--trade-buy)',          // Green for positive/buy
    sell: 'var(--trade-sell)',        // Red for negative/sell
    neutral: 'var(--trade-neutral)', // Gray for unchanged
  },
}
```

### Tier 3: Component Tokens

Scoped to specific components:

```css
:root {
  --chart-grid: rgba(255, 255, 255, 0.04);
  --chart-crosshair: rgba(255, 255, 255, 0.3);
  --chart-candle-up: #22c55e;
  --chart-candle-down: #ef4444;
  --orderbook-bid: rgba(34, 197, 94, 0.15);
  --orderbook-ask: rgba(239, 68, 68, 0.15);
}
```

---

## Color System

### Core Palette

| Token | Dark Theme | Purpose |
|-------|-----------|---------|
| `--bg-primary` | `#0a0a0a` | App background |
| `--bg-secondary` | `#141414` | Panel/card background |
| `--bg-tertiary` | `#1a1a1a` | Input/nested backgrounds |
| `--bg-elevated` | `#262626` | Modals, popovers |
| `--text-primary` | `#fafafa` | Primary text |
| `--text-secondary` | `#a3a3a3` | Secondary/muted text |
| `--text-tertiary` | `#737373` | Placeholder text |
| `--border-primary` | `#262626` | Primary borders |
| `--border-secondary` | `#404040` | Emphasized borders |

### Semantic Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--trade-buy` | `#22c55e` | Positive change, buy actions, profit |
| `--trade-sell` | `#ef4444` | Negative change, sell actions, loss |
| `--brand-primary` | `#3b82f6` | Primary actions, links, focus |
| `--warning` | `#f59e0b` | Alerts, caution states |
| `--error` | `#ef4444` | Error states, critical alerts |
| `--success` | `#22c55e` | Success confirmations |

---

## Typography

### Font Stack

```css
:root {
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}
```

### Type Scale

| Level | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `text-xs` | 11px | 400 | 1.4 | Labels, captions |
| `text-sm` | 13px | 400 | 1.4 | Table cells, secondary |
| `text-base` | 14px | 400 | 1.5 | Body text, inputs |
| `text-lg` | 16px | 500 | 1.5 | Section headers |
| `text-xl` | 20px | 600 | 1.3 | Page titles |
| `text-2xl` | 24px | 700 | 1.2 | Dashboard headlines |
| `font-mono` | 13px | 400 | 1.4 | Prices, code, data |

---

## Spacing & Layout

### Spacing Scale

```
4px  → gap-1   (tight: between icon and label)
8px  → gap-2   (compact: table cell padding)
12px → gap-3   (default: component internal spacing)
16px → gap-4   (medium: between components)
24px → gap-6   (large: section spacing)
32px → gap-8   (extra: page-level spacing)
```

### Panel Layout

The application uses `react-resizable-panels` for a flexible layout system:

```tsx
<PanelGroup direction="horizontal">
  <Panel defaultSize={20} minSize={15}>
    <Sidebar />
  </Panel>
  <PanelResizeHandle />
  <Panel defaultSize={60}>
    <ChartArea />
  </Panel>
  <PanelResizeHandle />
  <Panel defaultSize={20} minSize={15}>
    <WatchlistPanel />
  </Panel>
</PanelGroup>
```

---

## Component Library

### Base Components

| Component | Variants | Description |
|-----------|----------|-------------|
| `Button` | primary, secondary, ghost, danger | Action triggers with loading state |
| `Input` | text, number, search | Form inputs with validation |
| `Select` | single, multi, searchable | Dropdown selection |
| `Table` | sortable, resizable, virtual | Data tables with virtual scroll |
| `Tabs` | horizontal, vertical | Tabbed content switching |
| `Modal` | centered, drawer, fullscreen | Overlay dialogs |
| `Tooltip` | top, bottom, left, right | Contextual hints |
| `Badge` | status, count, label | Status indicators |
| `Skeleton` | text, chart, table | Loading placeholders |
| `Toast` | success, error, warning, info | Transient notifications |

### Data Display

| Component | Purpose |
|-----------|---------|
| `PriceDisplay` | Formatted price with color coding |
| `ChangeDisplay` | Percentage/absolute change with arrow |
| `SparklineGrid` | Mini charts in grid layout |
| `HeatmapCell` | Color-coded data cell |
| `ProgressBar` | Visual progress indicator |

---

## Theming Architecture

Themes are implemented via CSS custom properties:

```typescript
// lib/platform/theme.ts
export const themes = {
  dark: {
    '--bg-primary': '#0a0a0a',
    '--bg-secondary': '#141414',
    '--text-primary': '#fafafa',
    '--trade-buy': '#22c55e',
    '--trade-sell': '#ef4444',
  },
  light: {
    '--bg-primary': '#ffffff',
    '--bg-secondary': '#f5f5f5',
    '--text-primary': '#171717',
    '--trade-buy': '#16a34a',
    '--trade-sell': '#dc2626',
  },
  midnight: {
    '--bg-primary': '#0c1222',
    '--bg-secondary': '#111827',
    '--text-primary': '#e5e7eb',
    '--trade-buy': '#34d399',
    '--trade-sell': '#f87171',
  },
};
```

Theme switching applies all custom properties to `document.documentElement`:

```typescript
function applyTheme(themeName: keyof typeof themes) {
  const root = document.documentElement;
  const tokens = themes[themeName];
  Object.entries(tokens).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}
```

---

## Iconography

Apex Terminal uses **lucide-react** for consistent iconography:

- 24px default size for navigation
- 16px for inline/table icons
- 20px for toolbar actions
- Stroke width: 1.5px (consistent with the UI weight)

---

## Motion & Animation

Animations are subtle and purposeful — never decorative:

```css
:root {
  --transition-fast: 100ms ease-out;
  --transition-normal: 200ms ease-out;
  --transition-slow: 300ms ease-in-out;
}

/* Panel resize */
.panel-transition { transition: width var(--transition-normal); }

/* Price flash on update */
@keyframes price-flash {
  0% { background-color: var(--trade-buy-flash); }
  100% { background-color: transparent; }
}

/* Skeleton shimmer */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

---

## Responsive Design

The platform uses a desktop-first approach with responsive breakpoints:

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| `xl` | ≥1440px | Full multi-panel layout |
| `lg` | ≥1280px | Reduced sidebar, collapsible panels |
| `md` | ≥1024px | Single-panel with drawer navigation |
| `sm` | ≥768px | Tablet-optimized simplified views |
| `xs` | <768px | Mobile-optimized essential views |
