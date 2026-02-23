/**
 * Wave 105 — Performance Budgets Playwright spec
 * Collects page-load metrics on 7 core pages, asserts they are within budget,
 * and posts results to the backend for evidence.
 */

import { test, expect } from '@playwright/test';

const FRONT = 'http://localhost:5100';
const API   = 'http://localhost:8090/api/v3/perf';

// Timing budgets (ms) — generous for dev/CI environments (must match backend)
const BUDGETS = {
  lcp_ms:                 10000,
  fcp_ms:                  8000,
  dom_content_loaded_ms:   8000,
  load_time_ms:           10000,
};

interface PerfMetrics {
  fcp_ms: number;
  lcp_ms: number;
  dom_content_loaded_ms: number;
  load_time_ms: number;
}

// ── Helper: navigate and collect PerformanceTiming metrics ───────────────────
async function collectMetrics(page: import('@playwright/test').Page, url: string): Promise<PerfMetrics> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  // Wait for the page-ready sentinel so component is hydrated
  await expect(page.getByTestId('page-ready')).toBeAttached({ timeout: 15000 });

  // Collect via Navigation Timing Level 2 + Paint Timing
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paintEntries = performance.getEntriesByType('paint');
    const fcpEntry = paintEntries.find((e) => e.name === 'first-contentful-paint');
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
    const lcpEntry = lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1] : null;

    // nav.startTime is 0 for navigation entries – all timings are relative to navigationStart
    const domContentLoaded = nav
      ? Math.round(nav.domContentLoadedEventEnd)
      : 0;
    const loadTime = nav
      ? Math.round(nav.loadEventEnd)
      : 0;
    const fcp = fcpEntry
      ? Math.round(fcpEntry.startTime)
      : (domContentLoaded || loadTime);
    const lcp = lcpEntry
      ? Math.round((lcpEntry as PerformanceEntry & { startTime: number }).startTime)
      : (loadTime || domContentLoaded);

    return {
      fcp_ms: fcp,
      lcp_ms: lcp,
      dom_content_loaded_ms: domContentLoaded,
      load_time_ms: loadTime,
    };
  });
}

// ── Core pages under test ──────────────────────────────────────────────────────
const PAGES = [
  { id: 'search',             url: `${FRONT}/ui2/search` },
  { id: 'backtest',           url: `${FRONT}/ui2/backtest` },
  { id: 'strategy-optimizer', url: `${FRONT}/ui2/strategy-optimizer` },
  { id: 'job-queue',          url: `${FRONT}/ui2/job-queue` },
  { id: 'agent',              url: `${FRONT}/ui2/agent` },
  { id: 'ops',                url: `${FRONT}/ui2/ops` },
  { id: 'auditor',            url: `${FRONT}/ui2/auditor` },
];

// ── 7 performance sampling tests ─────────────────────────────────────────────
for (const p of PAGES) {
  test(`perf: ${p.id} page loads within budget`, async ({ page, request }) => {
    const metrics = await collectMetrics(page, p.url);

    // Assert each metric is within budget
    expect(metrics.fcp_ms, `${p.id} FCP > budget`).toBeLessThanOrEqual(BUDGETS.fcp_ms);
    expect(metrics.lcp_ms, `${p.id} LCP > budget`).toBeLessThanOrEqual(BUDGETS.lcp_ms);
    expect(metrics.dom_content_loaded_ms, `${p.id} DCL > budget`).toBeLessThanOrEqual(BUDGETS.dom_content_loaded_ms);
    expect(metrics.load_time_ms, `${p.id} loadTime > budget`).toBeLessThanOrEqual(BUDGETS.load_time_ms);

    // POST sample to backend evidence store
    const res = await request.post(`${API}/samples`, {
      data: {
        page_id:               p.id,
        page_url:              p.url,
        fcp_ms:                metrics.fcp_ms,
        lcp_ms:                metrics.lcp_ms,
        dom_content_loaded_ms: metrics.dom_content_loaded_ms,
        load_time_ms:          metrics.load_time_ms,
        user_agent:            'playwright/chromium',
      },
    });
    expect(res.status()).toBe(201);
    const saved = await res.json();
    expect(saved.budget_passed).toBe(true);
  });
}

// ── PerfBudgetUI2 page tests ──────────────────────────────────────────────────

test('perf-budget UI page loads', async ({ page }) => {
  await page.goto(`${FRONT}/ui2/perf-budget`);
  await expect(page.getByTestId('perf-budget-page')).toBeAttached({ timeout: 15000 });
  await expect(page.getByTestId('perf-budget-title')).toBeAttached();
  await expect(page.getByTestId('perf-budget-refresh-btn')).toBeAttached();
});

test('perf-budget UI shows KPI row after samples posted', async ({ page, request }) => {
  // Seed a sample
  await request.post(`${API}/samples`, {
    data: { page_id: 'search', page_url: `${FRONT}/ui2/search`, fcp_ms: 300, lcp_ms: 500, load_time_ms: 700 },
  });
  await page.goto(`${FRONT}/ui2/perf-budget`);
  await expect(page.getByTestId('perf-budget-page')).toBeAttached({ timeout: 15000 });
  await expect(page.getByTestId('perf-budget-kpi-row')).toBeAttached();
});

// ── API contract tests ────────────────────────────────────────────────────────

test('API GET /perf/version returns w105 version', async ({ request }) => {
  const res = await request.get(`${API}/version`);
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.version).toContain('w105');
  expect(data.pages_count).toBe(7);
});

test('API GET /perf/budgets returns timing + bundle budgets', async ({ request }) => {
  const res = await request.get(`${API}/budgets`);
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data).toHaveProperty('timing_budgets');
  expect(data).toHaveProperty('bundle_budgets');
  expect(data.pages).toHaveLength(7);
});

test('API POST /perf/samples + GET /summary reflects new data', async ({ request }) => {
  // Clean first
  await request.delete(`${API}/data`);

  const post = await request.post(`${API}/samples`, {
    data: {
      page_id: 'job-queue',
      page_url: `${FRONT}/ui2/job-queue`,
      fcp_ms: 280,
      lcp_ms: 450,
      dom_content_loaded_ms: 320,
      load_time_ms: 510,
    },
  });
  expect(post.status()).toBe(201);

  const summary = await request.get(`${API}/summary`);
  const data = await summary.json();
  expect(data.total_samples).toBeGreaterThanOrEqual(1);
  expect(data.pages_sampled).toBeGreaterThanOrEqual(1);
});

test('API GET /perf/summary has budgets field', async ({ request }) => {
  const res = await request.get(`${API}/summary`);
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data).toHaveProperty('budgets');
  expect(data.budgets).toHaveProperty('lcp_ms');
});
