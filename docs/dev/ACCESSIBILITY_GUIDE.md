# Accessibility Guide

Making Apex Terminal usable by everyone, including keyboard-only and screen reader users.

## Table of Contents

- [Standards](#standards)
- [ARIA Attributes](#aria-attributes)
- [Keyboard Navigation](#keyboard-navigation)
- [Focus Management](#focus-management)
- [Screen Reader Testing](#screen-reader-testing)
- [Color Contrast](#color-contrast)
- [Reduced Motion](#reduced-motion)
- [Accessible Data Tables](#accessible-data-tables)
- [Chart Accessibility Fallbacks](#chart-accessibility-fallbacks)
- [Conventions](#conventions)
- [Do's and Don'ts](#dos-and-donts)

## Standards

Apex Terminal targets **WCAG 2.1 AA** compliance. Key requirements:

- All interactive elements reachable via keyboard.
- Minimum 4.5:1 contrast ratio for text, 3:1 for large text and UI components.
- No information conveyed by color alone.
- All functionality available without a mouse.

## ARIA Attributes

Use semantic HTML first. Add ARIA only when native semantics are insufficient.

### Common ARIA patterns in the codebase

```typescript
// Tabs (chart type selector, timeframe bar)
<div role="tablist" aria-label="Timeframe">
  <button role="tab" aria-selected={active === '1D'} aria-controls="panel-1D">1D</button>
  <button role="tab" aria-selected={active === '1W'} aria-controls="panel-1W">1W</button>
</div>
<div role="tabpanel" id="panel-1D" aria-labelledby="tab-1D">...</div>

// Dialogs (order confirmation, alert editor)
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Confirm Order</h2>
  ...
</div>

// Live regions (price updates, alert notifications)
<div aria-live="polite" aria-atomic="true">
  AAPL: $189.64 (+0.8%)
</div>

// Icon buttons
<button aria-label="Toggle indicator visibility" onClick={toggleVisibility}>
  <EyeIcon className="w-4 h-4" />
</button>
```

### Required ARIA for custom widgets

| Widget         | Required ARIA                                           |
| -------------- | ------------------------------------------------------- |
| Dropdown       | `role="listbox"`, `aria-expanded`, `aria-activedescendant` |
| Modal          | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` |
| Tabs           | `role="tablist/tab/tabpanel"`, `aria-selected`          |
| Toggle         | `role="switch"`, `aria-checked`                         |
| Tree (watchlist)| `role="tree/treeitem"`, `aria-expanded`                |
| Grid (orders)  | `role="grid/row/gridcell"`, `aria-sort`                 |

## Keyboard Navigation

### Global hotkeys (via `useHotkeys`)

| Shortcut      | Action                      |
| ------------- | --------------------------- |
| `Mod+K`       | Open symbol search          |
| `Mod+B`       | Toggle sidebar              |
| `Mod+Shift+N` | New chart tab               |
| `Escape`      | Cancel drawing / close modal|
| `1-9`         | Switch timeframes           |

### Within components

- **Tab** moves between focusable elements in document order.
- **Arrow keys** navigate within composite widgets (tabs, grids, trees).
- **Enter/Space** activates buttons and toggles.
- **Escape** closes modals, dropdowns, and drawing mode.

Implement roving tabindex for composite widgets:

```typescript
function TabList({ tabs, activeIndex, onChange }: TabListProps) {
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') onChange(Math.min(index + 1, tabs.length - 1));
    if (e.key === 'ArrowLeft') onChange(Math.max(index - 1, 0));
    if (e.key === 'Home') onChange(0);
    if (e.key === 'End') onChange(tabs.length - 1);
  };

  return (
    <div role="tablist">
      {tabs.map((tab, i) => (
        <button
          key={tab.id}
          role="tab"
          tabIndex={i === activeIndex ? 0 : -1}
          aria-selected={i === activeIndex}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onClick={() => onChange(i)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

## Focus Management

- When a modal opens, move focus to the first focusable element inside it.
- When a modal closes, return focus to the element that triggered it.
- Trap focus inside modal dialogs (Tab cycles within the modal).

```typescript
useEffect(() => {
  if (isOpen) {
    previousFocusRef.current = document.activeElement as HTMLElement;
    dialogRef.current?.focus();
  }
  return () => { previousFocusRef.current?.focus(); };
}, [isOpen]);
```

## Screen Reader Testing

Test with at least one screen reader before shipping new interactive components:

| Platform | Screen Reader      |
| -------- | ------------------ |
| macOS    | VoiceOver (built-in) |
| Windows  | NVDA (free)        |
| Linux    | Orca               |

Verify:
- All interactive elements have accessible names.
- State changes are announced (e.g., "Order submitted", "Alert triggered").
- Data tables read row/column headers correctly.

## Color Contrast

The project's dark theme meets AA contrast ratios:

| Element           | Foreground | Background | Ratio |
| ----------------- | ---------- | ---------- | ----- |
| Body text         | `#D1D4DC`  | `#131722`  | 10.2:1|
| Muted text        | `#787B86`  | `#131722`  | 4.8:1 |
| Green (bullish)   | `#00C087`  | `#131722`  | 7.1:1 |
| Red (bearish)     | `#FF4976`  | `#131722`  | 5.4:1 |

When adding new colors, verify contrast with the WebAIM contrast checker.

Always supplement color with another indicator (icon, text label, pattern):

```typescript
<span className={pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
  {pnl >= 0 ? '▲' : '▼'} {formatCurrency(pnl)}
</span>
```

## Reduced Motion

Respect the user's OS setting:

```typescript
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

<div className={prefersReducedMotion ? '' : 'transition-all duration-200'}>
  ...
</div>
```

In Tailwind, use the `motion-safe:` variant:

```html
<div class="motion-safe:transition-all motion-safe:duration-200">...</div>
```

Disable chart animations (crosshair fade, series transitions) when reduced motion is active.

## Accessible Data Tables

Order tables, position grids, and screener results must use proper table semantics:

```typescript
<table role="grid" aria-label="Open Positions">
  <thead>
    <tr>
      <th scope="col" aria-sort={sortCol === 'symbol' ? sortDir : 'none'}>Symbol</th>
      <th scope="col" aria-sort={sortCol === 'pnl' ? sortDir : 'none'}>P&L</th>
    </tr>
  </thead>
  <tbody>
    {positions.map((pos) => (
      <tr key={pos.id} role="row">
        <td role="gridcell">{pos.symbol}</td>
        <td role="gridcell">{formatCurrency(pos.pnl)}</td>
      </tr>
    ))}
  </tbody>
</table>
```

## Chart Accessibility Fallbacks

Canvas-based charts are inherently inaccessible. Provide alternatives:

1. **Summary text** — `aria-label` on the chart container with current price and change.
2. **Data table toggle** — a button to show chart data as an accessible table.
3. **Keyboard OHLCV readout** — when focused on the chart, arrow keys move the crosshair and a live region announces the OHLCV values.

```typescript
<div
  role="img"
  aria-label={`${symbol} chart. Last price ${last}. Change ${changePct}%`}
  tabIndex={0}
  onKeyDown={handleChartKeyNav}
>
  <canvas ref={canvasRef} />
  <div aria-live="polite" className="sr-only">{crosshairAnnouncement}</div>
</div>
```

## Conventions

- Every PR touching interactive components must include keyboard nav testing notes.
- Use `eslint-plugin-jsx-a11y` — it's configured in the project ESLint.
- Add `aria-label` to every icon-only button.
- Use `sr-only` class for screen-reader-only text (visually hidden, still readable).

## Do's and Don'ts

**Do:**
- Use `<button>` for clickable elements, not `<div onClick>`
- Test with keyboard only (unplug your mouse) before merging
- Add `aria-live="polite"` for dynamic content updates (prices, alerts)
- Provide visible focus indicators — the default outline is intentional

**Don't:**
- Use `tabIndex` values > 0 — it breaks natural tab order
- Remove focus outlines (`outline-none`) without providing an alternative
- Put essential information only in `title` attributes — screen readers may not read them
- Use `aria-hidden="true"` on focusable elements
- Assume all users can see color differences
