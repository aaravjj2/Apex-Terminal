# Component Development Guide

How to create, structure, and test React components in Apex Terminal.

## Table of Contents

- [File Structure](#file-structure)
- [Props Interface](#props-interface)
- [Hook Usage Patterns](#hook-usage-patterns)
- [Tailwind Styling Conventions](#tailwind-styling-conventions)
- [Compound Component Pattern](#compound-component-pattern)
- [Error Boundary Wrapping](#error-boundary-wrapping)
- [Accessibility Requirements](#accessibility-requirements)
- [Testing Components](#testing-components)
- [Do's and Don'ts](#dos-and-donts)

## File Structure

Components live in `frontend/src/components/` organized by domain:

```
components/
├── bloomberg/       # Terminal-style widgets (watchlist, heatmap, ticker)
├── charts/          # Chart rendering, toolbar, indicator panels
│   └── advanced/    # Multi-chart layouts, comparison views
├── trading/         # Order entry, position table, DOM ladder
├── pages/           # Full page compositions
└── shared/          # Buttons, modals, inputs, tooltips — used everywhere
```

A component file follows this template:

```typescript
// 1. Imports
import { useState, useCallback, memo } from 'react';
import type { ChartType } from '@/stores/chartStore';

// 2. Props interface
interface ChartTypeSelectorProps {
  readonly activeType: ChartType;
  readonly onSelect: (type: ChartType) => void;
  readonly disabled?: boolean;
}

// 3. Constants (if needed)
const CHART_TYPES: ChartType[] = ['candlestick', 'line', 'area', 'ohlc'];

// 4. Component
export const ChartTypeSelector = memo(function ChartTypeSelector({
  activeType,
  onSelect,
  disabled = false,
}: ChartTypeSelectorProps) {
  return (
    <div role="radiogroup" aria-label="Chart type" className="flex gap-1">
      {CHART_TYPES.map((type) => (
        <button
          key={type}
          role="radio"
          aria-checked={type === activeType}
          disabled={disabled}
          onClick={() => onSelect(type)}
          className={`px-3 py-1 rounded text-sm transition-colors
            ${type === activeType ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
        >
          {type}
        </button>
      ))}
    </div>
  );
});
```

## Props Interface

- Prefix interface name with the component name: `ChartTypeSelectorProps`.
- Mark all props as `readonly`.
- Callbacks use `on` prefix: `onSelect`, `onChange`, `onClose`.
- Provide defaults for optional props via destructuring.

```typescript
interface OrderPanelProps {
  readonly symbol: string;
  readonly side: 'buy' | 'sell';
  readonly onSubmit: (order: OrderPayload) => void;
  readonly maxQuantity?: number;        // default: Infinity
  readonly showAdvanced?: boolean;       // default: false
}
```

## Hook Usage Patterns

Keep store selectors stable with selector functions:

```typescript
import { useChartStore, selectActiveChart } from '@/stores/chartStore';

export function ChartHeader() {
  const chart = useChartStore(selectActiveChart);
  const updateSymbol = useChartStore((s) => s.updateChartSymbol);

  // Don't destructure the entire store — causes unnecessary re-renders
  // BAD: const { charts, activeChartId, ... } = useChartStore();
}
```

Prefer custom hooks for logic reuse instead of duplicating `useEffect` chains:

```typescript
import { useDebounce } from '@/hooks/useDebounce';
import { useHotkeys } from '@/hooks/useHotkeys';

export function SearchPanel() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  useHotkeys('mod+k', () => inputRef.current?.focus());
}
```

## Tailwind Styling Conventions

- Use the project's dark theme tokens: `bg-zinc-900`, `text-zinc-300`, `border-zinc-700`.
- Accent colors: green `#00C087` for bullish, red `#FF4976` for bearish.
- Spacing: `gap-2` between sibling elements, `p-4` for panel padding.
- Use `cn()` (a clsx/twMerge wrapper) for conditional classes:

```typescript
import { cn } from '@/lib/utils/cn';

<div className={cn(
  'rounded border px-3 py-1 text-sm',
  isActive ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-700 bg-zinc-800',
)} />
```

## Compound Component Pattern

For complex widgets with shared state, use compound components:

```typescript
interface PanelContextValue {
  expanded: boolean;
  toggle: () => void;
}

const PanelContext = createContext<PanelContextValue | null>(null);
function usePanelContext() {
  const ctx = useContext(PanelContext);
  if (!ctx) throw new Error('Panel sub-components must be inside <Panel>');
  return ctx;
}

export function Panel({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <PanelContext.Provider value={{ expanded, toggle: () => setExpanded((e) => !e) }}>
      <div className="border border-zinc-700 rounded">{children}</div>
    </PanelContext.Provider>
  );
}

Panel.Header = function PanelHeader({ children }: { children: React.ReactNode }) {
  const { toggle } = usePanelContext();
  return <div onClick={toggle} className="flex items-center p-2 cursor-pointer">{children}</div>;
};

Panel.Body = function PanelBody({ children }: { children: React.ReactNode }) {
  const { expanded } = usePanelContext();
  if (!expanded) return null;
  return <div className="p-3">{children}</div>;
};
```

## Error Boundary Wrapping

Wrap panels and independent sections so one crash doesn't take down the whole layout:

```typescript
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

export function TradingPage() {
  return (
    <div className="grid grid-cols-[1fr_300px] h-full">
      <ErrorBoundary fallback={<ChartErrorFallback />}>
        <ChartPanel />
      </ErrorBoundary>
      <ErrorBoundary fallback={<OrderErrorFallback />}>
        <OrderPanel />
      </ErrorBoundary>
    </div>
  );
}
```

## Accessibility Requirements

Every interactive component must:

1. Be keyboard-navigable (`Tab`, `Enter`, `Escape`, arrow keys where appropriate).
2. Have appropriate ARIA roles (`role="dialog"`, `role="grid"`, `role="radiogroup"`).
3. Convey state via ARIA: `aria-selected`, `aria-expanded`, `aria-live`.
4. Support `prefers-reduced-motion` — disable chart animations when set.
5. Provide `aria-label` or visible label for icon-only buttons.

```typescript
<button
  aria-label="Close panel"
  onClick={onClose}
  className="p-1 hover:bg-zinc-700 rounded"
>
  <XIcon className="w-4 h-4" />
</button>
```

## Testing Components

Use React Testing Library + Vitest:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChartTypeSelector } from './ChartTypeSelector';

describe('ChartTypeSelector', () => {
  it('renders all chart types', () => {
    render(<ChartTypeSelector activeType="candlestick" onSelect={vi.fn()} />);
    expect(screen.getByRole('radio', { name: /line/i })).toBeInTheDocument();
  });

  it('calls onSelect when a type is clicked', () => {
    const onSelect = vi.fn();
    render(<ChartTypeSelector activeType="candlestick" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('radio', { name: /area/i }));
    expect(onSelect).toHaveBeenCalledWith('area');
  });

  it('marks active type as checked', () => {
    render(<ChartTypeSelector activeType="line" onSelect={vi.fn()} />);
    expect(screen.getByRole('radio', { name: /line/i })).toHaveAttribute('aria-checked', 'true');
  });
});
```

## Do's and Don'ts

**Do:**
- Wrap components with `memo` when they receive stable props from parent
- Use `data-testid` for elements that are hard to query by role/text
- Co-locate component tests in the same directory: `ChartToolbar.test.tsx`
- Extract sub-components when JSX exceeds ~80 lines

**Don't:**
- Use `useEffect` for derived state — compute it inline or with `useMemo`
- Pass entire store objects as props — select only what the child needs
- Use `index` as `key` for lists that can reorder
- Add `onClick` to `<div>` — use `<button>` for clickable elements
- Hardcode colors — use Tailwind tokens or CSS custom properties
