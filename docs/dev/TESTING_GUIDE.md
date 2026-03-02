# Testing Guide

Writing unit, integration, and end-to-end tests for Apex Terminal.

## Table of Contents

- [Test Stack](#test-stack)
- [Running Tests](#running-tests)
- [Unit Tests — Pure Functions](#unit-tests--pure-functions)
- [Unit Tests — Zustand Stores](#unit-tests--zustand-stores)
- [Component Tests](#component-tests)
- [E2E Tests with Playwright](#e2e-tests-with-playwright)
- [Mock Strategies](#mock-strategies)
- [Coverage Thresholds](#coverage-thresholds)
- [Conventions](#conventions)
- [Do's and Don'ts](#dos-and-donts)

## Test Stack

| Tool                     | Role                              |
| ------------------------ | --------------------------------- |
| Vitest                   | Unit + integration test runner    |
| React Testing Library    | Component rendering + interaction |
| Playwright               | E2E browser tests (204 specs)     |
| msw (Mock Service Worker)| API mocking                       |
| `vi.fn()` / `vi.mock()` | Spies and module mocking          |

## Running Tests

```bash
# Unit tests
npm run test              # watch mode
npm run test -- --run     # single run (CI)
npm run test -- --coverage

# E2E tests
npm run test:e2e          # all specs
npm run test:e2e -- --grep "chart"  # filter by name

# Type checking (not tests, but run in CI)
npm run typecheck
```

## Unit Tests — Pure Functions

Test indicator math and utility functions with known inputs and expected outputs:

```typescript
// frontend/tests/unit/indicators/movingAverages.test.ts
import { describe, it, expect } from 'vitest';
import { sma, ema } from '@/lib/indicators/movingAverages';

describe('sma', () => {
  it('computes simple moving average for period 3', () => {
    const data = [1, 2, 3, 4, 5];
    const result = sma(data, 3);
    expect(result[2]).toBeCloseTo(2);   // (1+2+3)/3
    expect(result[4]).toBeCloseTo(4);   // (3+4+5)/3
  });

  it('returns NaN for indices before the period', () => {
    const result = sma([10, 20, 30], 3);
    expect(result[0]).toBeNaN();
    expect(result[1]).toBeNaN();
  });

  it('handles empty input', () => {
    expect(sma([], 5)).toEqual([]);
  });

  it('returns all NaN when period exceeds data length', () => {
    const result = sma([1, 2], 5);
    expect(result.every(Number.isNaN)).toBe(true);
  });
});
```

## Unit Tests — Zustand Stores

Reset state before each test. Call actions via `getState()` and assert with `getState()`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useChartStore, selectActiveChart } from '@/stores/chartStore';

const initialState = useChartStore.getState();

beforeEach(() => {
  useChartStore.setState(initialState);
});

describe('chartStore', () => {
  it('adds a chart and sets it as active', () => {
    const id = useChartStore.getState().addChart('MSFT');
    expect(id).toBeTruthy();
    expect(useChartStore.getState().activeChartId).toBe(id);
  });

  it('enforces max chart limit', () => {
    const store = useChartStore.getState();
    for (let i = 0; i < 16; i++) store.addChart();
    const result = useChartStore.getState().addChart();
    expect(result).toBeNull();
  });

  it('selectActiveChart returns current chart', () => {
    const id = useChartStore.getState().addChart('TSLA');
    const chart = selectActiveChart(useChartStore.getState());
    expect(chart?.symbol).toBe('TSLA');
  });
});
```

## Component Tests

Use React Testing Library's queries by role/text, not implementation details:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TimeframeSelector } from '@/components/charts/TimeframeSelector';

describe('TimeframeSelector', () => {
  it('renders timeframe buttons', () => {
    render(<TimeframeSelector active="1D" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: '1D' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1W' })).toBeInTheDocument();
  });

  it('highlights the active timeframe', () => {
    render(<TimeframeSelector active="1h" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: '1h' })).toHaveClass('bg-blue-600');
  });

  it('calls onSelect with the clicked timeframe', () => {
    const onSelect = vi.fn();
    render(<TimeframeSelector active="1D" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: '1W' }));
    expect(onSelect).toHaveBeenCalledWith('1W');
  });
});
```

## E2E Tests with Playwright

E2E specs live in `frontend/tests/e2e/`. Each test file covers a user flow:

```typescript
// frontend/tests/e2e/chart-basics.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Chart Basics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="chart-container"]');
  });

  test('changes symbol via search', async ({ page }) => {
    await page.click('[data-testid="symbol-search"]');
    await page.fill('[data-testid="symbol-input"]', 'MSFT');
    await page.click('[data-testid="symbol-result-MSFT"]');
    await expect(page.locator('[data-testid="chart-symbol"]')).toHaveText('MSFT');
  });

  test('switches timeframe', async ({ page }) => {
    await page.click('[data-testid="timeframe-1W"]');
    await expect(page.locator('[data-testid="active-timeframe"]')).toHaveText('1W');
  });
});
```

Use `data-testid` attributes for stable selectors. Never select by CSS class names.

## Mock Strategies

### API mocks with msw

```typescript
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer(
  http.get('/api/market-data/quotes/AAPL', () =>
    HttpResponse.json({ symbol: 'AAPL', last: 189.50, change: 1.2 }),
  ),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Timer mocks

```typescript
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('debounces after 300ms', () => {
  // ... trigger change
  vi.advanceTimersByTime(300);
  expect(result.current).toBe('new value');
});
```

### Worker mocks

```typescript
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  postMessage(data: any) {
    setTimeout(() => {
      this.onmessage?.({ data: { taskId: data.taskId, type: 'result', data: {} } } as any);
    }, 0);
  }
  terminate() {}
}
vi.stubGlobal('Worker', MockWorker);
```

## Coverage Thresholds

Enforced in `vitest.config.ts`:

```typescript
coverage: {
  thresholds: {
    lines: 80,
    branches: 75,
    functions: 80,
    statements: 80,
  },
  include: ['src/**/*.ts', 'src/**/*.tsx'],
  exclude: ['src/**/*.d.ts', 'src/**/index.ts'],
}
```

New files should aim for **90%+ line coverage** to keep the project average healthy.

## Conventions

- Test files: `*.test.ts` or `*.test.tsx`, co-located or in `tests/unit/`.
- One `describe` per module/component. Nest for sub-features.
- Test names read as sentences: `it('returns NaN when period exceeds data length')`.
- Arrange-Act-Assert structure within each test.
- Shared test fixtures go in `tests/fixtures/`.

## Do's and Don'ts

**Do:**
- Test behavior, not implementation — assert on outputs and DOM state
- Use `vi.fn()` for callback props and verify calls
- Test edge cases: empty arrays, zero values, network errors, timeout
- Keep E2E tests independent — each test starts from a clean page

**Don't:**
- Test internal state of hooks — test through the component that uses them
- Use `sleep()` or arbitrary timeouts in tests — use fake timers or `waitFor`
- Mock more than necessary — test real code paths when feasible
- Write E2E tests for logic that unit tests already cover
- Snapshot test complex components — they create brittle, hard-to-review diffs
