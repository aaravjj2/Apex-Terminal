# Testing Strategy

> Test pyramid, tooling, and coverage approach for ensuring reliability across the Apex Terminal platform.

---

## Table of Contents

- [Overview](#overview)
- [Test Pyramid](#test-pyramid)
- [Unit Tests with Vitest](#unit-tests-with-vitest)
- [Integration Tests](#integration-tests)
- [E2E Tests with Playwright](#e2e-tests-with-playwright)
- [Store Testing Patterns](#store-testing-patterns)
- [Worker Testing](#worker-testing)
- [Mocking Strategies](#mocking-strategies)
- [Test Setup & Configuration](#test-setup--configuration)
- [Coverage Targets](#coverage-targets)

---

## Overview

Apex Terminal uses a three-tier testing strategy: fast unit tests for pure logic, integration tests for store/hook interactions, and end-to-end tests for full user workflows. The test suite currently includes 30+ unit test files covering indicators, options pricing, portfolio math, and stores, plus 204 Playwright E2E specs validating the entire platform.

---

## Test Pyramid

```
          ╱╲
         ╱  ╲         E2E (Playwright)
        ╱ 204 ╲        Full user workflows, cross-page navigation
       ╱ specs  ╲       ~30 min full suite
      ╱──────────╲
     ╱            ╲    Integration
    ╱  Store/Hook   ╲   Store interactions, hook behavior, API mocks
   ╱   composition   ╲  ~2 min full suite
  ╱────────────────────╲
 ╱                      ╲  Unit (Vitest)
╱   30+ files, 500+      ╲  Pure functions, indicators, pricing, risk math
╱    assertions            ╲ ~15 sec full suite
╱────────────────────────────╲
```

---

## Unit Tests with Vitest

Unit tests validate the 117 pure computation libraries under `lib/`. These have zero React or DOM dependencies and run in milliseconds.

### Test File Inventory

| Directory | Files | Coverage Area |
|-----------|-------|---------------|
| `tests/unit/indicators/` | 7 | SMA, EMA, RSI, MACD, Bollinger, ATR, Stochastic, OBV, VWAP, patterns |
| `tests/unit/options/` | 3 | Black-Scholes, binomial tree, strategy payoff diagrams |
| `tests/unit/portfolio/` | 4 | Markowitz optimization, performance attribution, risk metrics, fixed income |
| `tests/unit/backtest/` | 3 | Backtest engine, strategy execution, analytics (Sharpe, drawdown) |
| `tests/unit/core/` | 2 | ChartEngine, Scales coordinate mapping |
| `tests/unit/state/` | 1 | Core store structure and initialization |
| `tests/unit/` (root) | 10+ | Wave stores, telemetry, search, regression locks, disambiguator |

### Example: Indicator Tests

```typescript
import { describe, it, expect } from 'vitest';
import { sma, ema, rsi } from '@/lib/indicators/movingAverages';

describe('SMA', () => {
  const data = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08];

  it('computes correct 5-period SMA', () => {
    const result = sma(data, 5);
    expect(result[4]).toBeCloseTo(44.074, 2);
    expect(result[9]).toBeCloseTo(45.454, 2);
  });

  it('returns NaN for periods before enough data', () => {
    const result = sma(data, 5);
    expect(result[3]).toBeNaN();
  });
});
```

### Example: Options Pricing Tests

```typescript
describe('Black-Scholes', () => {
  it('prices a call option correctly', () => {
    const price = blackScholes({ S: 100, K: 100, T: 1, r: 0.05, sigma: 0.2, type: 'call' });
    expect(price).toBeCloseTo(10.45, 1);
  });

  it('satisfies put-call parity', () => {
    const call = blackScholes({ S: 100, K: 100, T: 1, r: 0.05, sigma: 0.2, type: 'call' });
    const put = blackScholes({ S: 100, K: 100, T: 1, r: 0.05, sigma: 0.2, type: 'put' });
    expect(call - put).toBeCloseTo(100 - 100 * Math.exp(-0.05), 1);
  });
});
```

---

## Integration Tests

Integration tests verify that hooks, stores, and API modules work together correctly:

```typescript
describe('useMarketData + chartStore integration', () => {
  it('updates chart data when symbol changes', async () => {
    vi.spyOn(marketDataApi, 'getHistorical').mockResolvedValue(mockOHLCV);
    useChartStore.getState().setSymbol('TSLA');

    const { result } = renderHook(() => useChartData('TSLA', '1D'));
    await waitFor(() => expect(result.current.data).toHaveLength(100));
    expect(marketDataApi.getHistorical).toHaveBeenCalledWith('TSLA', '1D');
  });
});
```

---

## E2E Tests with Playwright

204 Playwright specs test full user workflows across the application:

### Spec Categories

| Category | Specs | Scope |
|----------|-------|-------|
| Charting | 35 | Chart rendering, indicator overlay, drawing tools, timeframe switching |
| Trading | 28 | Order entry, bracket orders, execution blotter, position management |
| Options | 22 | Chain loading, Greeks display, strategy builder, IV surface |
| Portfolio | 18 | Holdings view, P&L display, attribution, rebalancing |
| Backtest | 20 | Strategy configuration, run execution, results analysis |
| Bloomberg | 15 | Command line parsing, security finder, launchpad navigation |
| Screening | 14 | Filter creation, scan execution, result export |
| Risk | 12 | VaR calculation, stress tests, scenario analysis |
| Navigation | 20 | Route transitions, deep linking, breadcrumbs |
| Settings | 10 | Theme switching, preferences persistence, keyboard shortcuts |
| Misc | 10 | Search, alerts, watchlists, news feed |

### Example: Trading Workflow

```typescript
test('submit a limit buy order', async ({ page }) => {
  await page.goto('/trading');
  await page.fill('[data-testid="symbol-input"]', 'AAPL');
  await page.click('[data-testid="order-type-limit"]');
  await page.fill('[data-testid="quantity-input"]', '100');
  await page.fill('[data-testid="price-input"]', '150.00');
  await page.click('[data-testid="submit-buy"]');

  await expect(page.locator('[data-testid="order-confirmation"]')).toBeVisible();
  await expect(page.locator('[data-testid="blotter-row-0"]')).toContainText('AAPL');
});
```

---

## Store Testing Patterns

Zustand stores are tested by directly calling `getState()` and `setState()` without React rendering:

```typescript
describe('orderStore', () => {
  beforeEach(() => {
    useOrderStore.setState({
      tickets: [],
      validation: { valid: true, errors: [] },
    });
  });

  it('validates a limit order requires a price', () => {
    useOrderStore.getState().validateOrder({
      symbol: 'AAPL', type: 'limit', quantity: 100, price: undefined,
    });
    const { validation } = useOrderStore.getState();
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Limit price required');
  });
});
```

---

## Worker Testing

Web Workers are tested by importing their computation functions directly (bypassing the `postMessage` interface) and by using a `MessageChannel` polyfill for message-based tests:

```typescript
describe('indicatorWorker', () => {
  it('calculates SMA via message protocol', async () => {
    const worker = new Worker(
      new URL('@/workers/indicatorWorker.ts', import.meta.url),
      { type: 'module' }
    );

    const result = await new Promise((resolve) => {
      worker.onmessage = (e) => {
        if (e.data.type === 'result') resolve(e.data.data);
      };
      worker.postMessage({
        type: 'calculate',
        taskId: 'test-1',
        indicators: [{ type: 'sma', params: { period: 5 } }],
        bars: generateMockBars(20),
      });
    });

    expect(result).toHaveProperty('indicator', 'sma');
    worker.terminate();
  });
});
```

---

## Mocking Strategies

| Dependency | Mock Approach |
|------------|--------------|
| API modules | `vi.spyOn(api, 'method').mockResolvedValue(data)` |
| WebSocket | Custom `MockWebSocket` class with `emit()` helper |
| IndexedDB | `fake-indexeddb` package for persistence tests |
| `Date.now` | `vi.useFakeTimers()` for time-dependent calculations |
| Workers | Direct function import or `MessageChannel` polyfill |
| `localStorage` | Vitest's JSDOM provides a working implementation |
| `fetch` | `vi.stubGlobal('fetch', mockFetch)` |

---

## Test Setup & Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/lib/**', 'src/stores/**', 'src/hooks/**'],
    },
  },
});
```

The `tests/setup.ts` file configures global mocks for `ResizeObserver`, `IntersectionObserver`, `matchMedia`, and `requestAnimationFrame` that JSDOM does not provide.

---

## Coverage Targets

| Layer | Target | Current |
|-------|--------|---------|
| `lib/` (computation) | 90% | ~85% |
| `stores/` | 80% | ~75% |
| `hooks/` | 70% | ~65% |
| `workers/` | 85% | ~80% |
| E2E page coverage | 100% of routes | 95%+ |

Coverage reports are generated on every CI run via `vitest --coverage` and uploaded as build artifacts. PRs that reduce `lib/` coverage below 85% are blocked by CI.
