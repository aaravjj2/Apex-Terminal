# Accessibility

> WCAG 2.1 AA compliance guidelines, keyboard navigation, screen reader support, and inclusive design patterns for Apex Terminal.

---

## Table of Contents

- [Overview](#overview)
- [WCAG 2.1 AA Compliance](#wcag-21-aa-compliance)
- [Keyboard Navigation](#keyboard-navigation)
- [Screen Reader Support](#screen-reader-support)
- [ARIA Labels for Charts & Data Tables](#aria-labels-for-charts--data-tables)
- [Color Contrast Ratios](#color-contrast-ratios)
- [Focus Management](#focus-management)
- [Skip Navigation](#skip-navigation)
- [High-Contrast Mode](#high-contrast-mode)
- [Reduced Motion Support](#reduced-motion-support)
- [Accessible Form Patterns](#accessible-form-patterns)
- [Accessibility Utilities](#accessibility-utilities)

---

## Overview

Apex Terminal targets WCAG 2.1 AA compliance to ensure all users — including those using screen readers, keyboard-only navigation, or high-contrast display settings — can access financial data and execute trades. The `lib/platform/accessibility.ts` module provides shared utilities for focus trapping, live region announcements, and accessible labeling. All interactive components support full keyboard operation.

---

## WCAG 2.1 AA Compliance

The platform adheres to the four WCAG principles:

| Principle | Implementation |
|-----------|---------------|
| **Perceivable** | Text alternatives for charts, sufficient contrast, resizable text |
| **Operable** | Full keyboard access, no time limits, skip navigation |
| **Understandable** | Consistent navigation, input assistance, error prevention |
| **Robust** | Semantic HTML, valid ARIA, tested with multiple screen readers |

### Automated Checks

ESLint's `eslint-plugin-jsx-a11y` runs on every commit to catch common accessibility violations at build time, including missing `alt` attributes, invalid ARIA roles, and non-interactive elements with click handlers.

---

## Keyboard Navigation

Every feature in Apex Terminal is fully operable via keyboard:

### Global Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open command palette |
| `Cmd/Ctrl + /` | Bloomberg command line |
| `Tab` / `Shift+Tab` | Navigate between panels and controls |
| `Escape` | Close modal, dismiss command palette, deselect |
| `Arrow keys` | Navigate within lists, grids, and menus |
| `Enter` / `Space` | Activate focused element |

### Grid Navigation

Data grids (options chain, watchlist, screener results) implement the WAI-ARIA grid pattern:

```tsx
function DataGrid({ data, columns }: DataGridProps) {
  const [focusedCell, setFocusedCell] = useState({ row: 0, col: 0 });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowRight': setFocusedCell(prev => ({ ...prev, col: Math.min(prev.col + 1, columns.length - 1) })); break;
      case 'ArrowLeft': setFocusedCell(prev => ({ ...prev, col: Math.max(prev.col - 1, 0) })); break;
      case 'ArrowDown': setFocusedCell(prev => ({ ...prev, row: Math.min(prev.row + 1, data.length - 1) })); break;
      case 'ArrowUp': setFocusedCell(prev => ({ ...prev, row: Math.max(prev.row - 1, 0) })); break;
    }
  };

  return (
    <div role="grid" onKeyDown={handleKeyDown} aria-label="Market data grid">
      {/* cells with tabIndex based on focusedCell */}
    </div>
  );
}
```

The `useHotkeys` hook manages shortcut registration and conflict resolution across the application.

---

## Screen Reader Support

### Live Region Announcements

Real-time data updates (price changes, order fills, alerts) are announced via ARIA live regions:

```typescript
import { announce } from '@/lib/platform/accessibility';

wsClient.subscribe(`orders:${userId}`, (update: OrderUpdate) => {
  if (update.status === 'filled') {
    announce(`Order filled: ${update.quantity} shares of ${update.symbol} at $${update.price}`);
  }
});
```

The `announce` utility injects text into a visually hidden `aria-live="polite"` region:

```typescript
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const region = document.getElementById(`sr-announce-${priority}`);
  if (region) {
    region.textContent = '';
    requestAnimationFrame(() => { region.textContent = message; });
  }
}
```

### Landmark Regions

The application shell uses semantic landmarks:

```tsx
<header role="banner">{/* TopBar */}</header>
<nav role="navigation" aria-label="Main navigation">{/* LeftNav */}</nav>
<main role="main" aria-label="Content">{/* Routed pages */}</main>
<aside role="complementary" aria-label="Side panel">{/* Context panel */}</aside>
```

---

## ARIA Labels for Charts & Data Tables

### Canvas Charts

Since Canvas elements are opaque to screen readers, an accessible summary is provided:

```tsx
function CandlestickChart({ symbol, data }: ChartProps) {
  const summary = useMemo(() => {
    const latest = data[data.length - 1];
    return `${symbol} candlestick chart. ${data.length} candles displayed. ` +
      `Latest: Open ${latest.open}, High ${latest.high}, Low ${latest.low}, Close ${latest.close}.`;
  }, [symbol, data]);

  return (
    <div role="img" aria-label={summary}>
      <canvas ref={canvasRef} aria-hidden="true" />
      <button className="sr-only" onClick={openDataTable}>
        View chart data as table
      </button>
    </div>
  );
}
```

A hidden button offers a tabular alternative for users who cannot perceive the visual chart.

### Data Tables

All data tables include proper headers and scope attributes:

```tsx
<table aria-label="Portfolio holdings">
  <thead>
    <tr>
      <th scope="col">Symbol</th>
      <th scope="col" aria-sort={sortCol === 'pnl' ? sortDir : 'none'}>P&L</th>
      <th scope="col">Quantity</th>
    </tr>
  </thead>
</table>
```

---

## Color Contrast Ratios

The dark-first design system enforces WCAG AA minimum contrast ratios:

| Element | Foreground | Background | Ratio | Required |
|---------|-----------|------------|-------|----------|
| Body text | `#e4e4e7` (zinc-200) | `#18181b` (zinc-900) | 13.5:1 | 4.5:1 |
| Secondary text | `#a1a1aa` (zinc-400) | `#18181b` (zinc-900) | 7.1:1 | 4.5:1 |
| Positive (green) | `#4ade80` (green-400) | `#18181b` (zinc-900) | 8.2:1 | 4.5:1 |
| Negative (red) | `#f87171` (red-400) | `#18181b` (zinc-900) | 5.6:1 | 4.5:1 |
| Disabled text | `#52525b` (zinc-600) | `#18181b` (zinc-900) | 3.8:1 | 3:1 (large) |

Color is never the sole indicator of state. Positive/negative values also use directional arrows, and error states combine red color with icon + text.

---

## Focus Management

### Focus Trapping in Modals

The `useFocusTrap` utility keeps keyboard focus within modal dialogs:

```typescript
export function useFocusTrap(containerRef: RefObject<HTMLElement>, active: boolean) {
  useEffect(() => {
    if (!active || !containerRef.current) return;

    const focusable = containerRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };

    first?.focus();
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [active, containerRef]);
}
```

### Focus Restoration

When modals or dropdowns close, focus returns to the element that triggered them, preventing focus loss.

---

## Skip Navigation

A skip-to-content link appears on Tab press, allowing keyboard users to bypass the navigation:

```tsx
function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-zinc-800 focus:px-4 focus:py-2 focus:rounded focus:text-white"
    >
      Skip to main content
    </a>
  );
}
```

---

## High-Contrast Mode

A high-contrast theme is available in settings, increasing border widths and boosting contrast:

```typescript
const highContrastOverrides = {
  '--border-width': '2px',
  '--text-primary': '#ffffff',
  '--text-secondary': '#d4d4d8',
  '--bg-surface': '#000000',
  '--accent': '#60a5fa',
  '--positive': '#22c55e',
  '--negative': '#ef4444',
};
```

The `useTheme` hook applies these as CSS custom properties when the user enables high-contrast mode. The setting is persisted in localStorage and respects `prefers-contrast: more` from the operating system.

---

## Reduced Motion Support

Animations are disabled when the user's OS requests reduced motion:

```typescript
export function usePrefersReducedMotion(): boolean {
  const query = useMediaQuery('(prefers-reduced-motion: reduce)');
  return query;
}
```

Components conditionally apply animations:

```tsx
const shouldAnimate = !usePrefersReducedMotion();

<div className={shouldAnimate ? 'transition-all duration-200' : ''}>
  {content}
</div>
```

The Tailwind config includes `motion-reduce:` variants for utility-based control.

---

## Accessible Form Patterns

The order ticket and alert forms follow accessible form patterns:

```tsx
function OrderTicket() {
  return (
    <form aria-label="Order entry" onSubmit={handleSubmit}>
      <div role="group" aria-labelledby="quantity-label">
        <label id="quantity-label" htmlFor="qty">Quantity</label>
        <input id="qty" type="number" aria-describedby="qty-error" aria-invalid={!!errors.quantity} />
        {errors.quantity && <span id="qty-error" role="alert">{errors.quantity}</span>}
      </div>

      <div role="group" aria-labelledby="price-label">
        <label id="price-label" htmlFor="price">Limit Price</label>
        <input id="price" type="number" step="0.01" aria-describedby="price-hint" />
        <span id="price-hint" className="text-xs text-zinc-400">Leave empty for market orders</span>
      </div>

      <button type="submit" aria-busy={isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Place Order'}
      </button>
    </form>
  );
}
```

Validation errors are announced via `role="alert"`, and `aria-invalid` flags the specific field.

---

## Accessibility Utilities

The `lib/platform/accessibility.ts` module exports shared helpers:

| Utility | Purpose |
|---------|---------|
| `announce(message, priority)` | Inject text into screen reader live region |
| `useFocusTrap(ref, active)` | Trap keyboard focus within a container |
| `usePrefersReducedMotion()` | Detect OS reduced-motion preference |
| `getAriaSort(column, sortState)` | Compute `aria-sort` for sortable table headers |
| `generateId(prefix)` | Create unique IDs for `aria-labelledby` / `aria-describedby` pairs |
| `visuallyHiddenStyles` | CSS object for `sr-only` equivalent in JS |
