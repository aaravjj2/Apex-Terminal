/**
 * Wave 6-10 E2E Tests
 * UI2: Monte Carlo, Walk-Forward, Scoring, Sentiment, Regime,
 *       Elasticsearch, Nova, Market Hours, Kill Switch Recovery,
 *       System Health, Observability, Compliance, Performance
 * data-testid selectors ONLY — headed, workers=1, retries=0
 */
import { test, expect } from '@playwright/test';

const BASE = '/ui2';

// ── Wave 6: Monte Carlo ────────────────────────────────────

test.describe('Wave 6 — Monte Carlo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/monte-carlo`);
    await page.waitForSelector('[data-testid="monte-carlo-ui2-page"]', { state: 'attached', timeout: 10000 });
  });

  test('page loads', async ({ page }) => {
    await expect(page.locator('[data-testid="monte-carlo-ui2-page"]')).toBeVisible();
  });

  test('shows simulation results', async ({ page }) => {
    await expect(page.locator('[data-testid="mc-symbol"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="mc-p5"]')).toBeVisible();
    await expect(page.locator('[data-testid="mc-p50"]')).toBeVisible();
    await expect(page.locator('[data-testid="mc-p95"]')).toBeVisible();
  });

  test('shows VaR', async ({ page }) => {
    await expect(page.locator('[data-testid="mc-var"]')).toBeVisible({ timeout: 8000 });
  });

  test('shows path count', async ({ page }) => {
    await expect(page.locator('[data-testid="mc-paths"]')).toBeVisible({ timeout: 8000 });
  });
});

// ── Wave 6: Walk-Forward ────────────────────────────────────

test.describe('Wave 6 — Walk-Forward', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/walk-forward`);
    await page.waitForSelector('[data-testid="walk-forward-ui2-page"]', { state: 'attached', timeout: 10000 });
  });

  test('page loads', async ({ page }) => {
    await expect(page.locator('[data-testid="walk-forward-ui2-page"]')).toBeVisible();
  });

  test('shows folds table', async ({ page }) => {
    await expect(page.locator('[data-testid="wf-folds-table"]')).toBeVisible({ timeout: 8000 });
  });
});

// ── Wave 6: Scoring ────────────────────────────────────────

test.describe('Wave 6 — Scoring', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/scoring`);
    await page.waitForSelector('[data-testid="scoring-ui2-page"]', { state: 'attached', timeout: 10000 });
  });

  test('page loads', async ({ page }) => {
    await expect(page.locator('[data-testid="scoring-ui2-page"]')).toBeVisible();
  });

  test('shows score cards', async ({ page }) => {
    const cards = page.locator('[data-testid^="score-card-"]');
    await expect(cards.first()).toBeVisible({ timeout: 8000 });
    expect(await cards.count()).toBeGreaterThanOrEqual(1);
  });
});

// ── Wave 6: Sentiment ──────────────────────────────────────

test.describe('Wave 6 — Sentiment', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/sentiment`);
    await page.waitForSelector('[data-testid="sentiment-ui2-page"]', { state: 'attached', timeout: 10000 });
  });

  test('page loads', async ({ page }) => {
    await expect(page.locator('[data-testid="sentiment-ui2-page"]')).toBeVisible();
  });

  test('shows market mood badge', async ({ page }) => {
    await expect(page.locator('[data-testid="market-mood"]')).toBeVisible({ timeout: 8000 });
  });

  test('shows symbol sentiment cards', async ({ page }) => {
    const cards = page.locator('[data-testid^="sentiment-"]');
    await expect(cards.first()).toBeVisible({ timeout: 8000 });
  });
});

// ── Wave 6: Regime ─────────────────────────────────────────

test.describe('Wave 6 — Regime', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/regime`);
    await page.waitForSelector('[data-testid="regime-ui2-page"]', { state: 'attached', timeout: 10000 });
  });

  test('page loads', async ({ page }) => {
    await expect(page.locator('[data-testid="regime-ui2-page"]')).toBeVisible();
  });

  test('shows regime summary', async ({ page }) => {
    await expect(page.locator('[data-testid="regime-summary"]')).toBeVisible({ timeout: 8000 });
  });

  test('shows symbol regime cards', async ({ page }) => {
    await expect(page.locator('[data-testid="regime-SPY"]')).toBeVisible({ timeout: 8000 });
  });
});

// ── Wave 7: Elasticsearch ──────────────────────────────────

test.describe('Wave 7 — Elasticsearch', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/elasticsearch`);
    await page.waitForSelector('[data-testid="elasticsearch-ui2-page"]', { state: 'attached', timeout: 10000 });
  });

  test('page loads', async ({ page }) => {
    await expect(page.locator('[data-testid="elasticsearch-ui2-page"]')).toBeVisible();
  });

  test('shows status info', async ({ page }) => {
    await expect(page.locator('[data-testid="es-status"]')).toBeVisible({ timeout: 8000 });
  });

  test('search input exists', async ({ page }) => {
    await expect(page.locator('[data-testid="es-search-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="es-search-btn"]')).toBeVisible();
  });

  test('can perform search', async ({ page }) => {
    await page.locator('[data-testid="es-search-input"]').fill('AAPL');
    await page.locator('[data-testid="es-search-btn"]').click();
    const hit = page.locator('[data-testid^="es-hit-"]');
    await expect(hit.first()).toBeVisible({ timeout: 8000 });
  });
});

// ── Wave 8: Nova LLM ───────────────────────────────────────

test.describe('Wave 8 — Nova LLM', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/nova`);
    await page.waitForSelector('[data-testid="nova-ui2-page"]', { state: 'attached', timeout: 10000 });
  });

  test('page loads', async ({ page }) => {
    await expect(page.locator('[data-testid="nova-ui2-page"]')).toBeVisible();
  });

  test('shows status', async ({ page }) => {
    await expect(page.locator('[data-testid="nova-status"]')).toBeVisible({ timeout: 8000 });
  });

  test('prompt input and generate button', async ({ page }) => {
    await expect(page.locator('[data-testid="nova-prompt"]')).toBeVisible();
    await expect(page.locator('[data-testid="nova-generate-btn"]')).toBeVisible();
  });

  test('can generate response', async ({ page }) => {
    await page.locator('[data-testid="nova-prompt"]').fill('Analyze AAPL');
    await page.locator('[data-testid="nova-generate-btn"]').click();
    await expect(page.locator('[data-testid="nova-response"]')).toBeVisible({ timeout: 10000 });
  });
});

// ── Wave 9: Market Hours ───────────────────────────────────

test.describe('Wave 9 — Market Hours', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/market-hours`);
    await page.waitForSelector('[data-testid="market-hours-ui2-page"]', { state: 'attached', timeout: 10000 });
  });

  test('page loads', async ({ page }) => {
    await expect(page.locator('[data-testid="market-hours-ui2-page"]')).toBeVisible();
  });

  test('shows trading status', async ({ page }) => {
    await expect(page.locator('[data-testid="mh-can-trade"]')).toBeVisible({ timeout: 8000 });
  });

  test('shows holidays', async ({ page }) => {
    await expect(page.locator('[data-testid="holiday-0"]')).toBeVisible({ timeout: 8000 });
  });
});

// ── Wave 9: Kill Switch Recovery ───────────────────────────

test.describe('Wave 9 — Kill Switch Recovery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/kill-switch-recovery`);
    await page.waitForSelector('[data-testid="kill-switch-recovery-ui2-page"]', { state: 'attached', timeout: 10000 });
  });

  test('page loads', async ({ page }) => {
    await expect(page.locator('[data-testid="kill-switch-recovery-ui2-page"]')).toBeVisible();
  });

  test('shows override button', async ({ page }) => {
    await expect(page.locator('[data-testid="ks-override-btn"]')).toBeVisible();
  });

  test('shows recovery events', async ({ page }) => {
    await expect(page.locator('[data-testid="ks-event-0"]')).toBeVisible({ timeout: 8000 });
  });
});

// ── Wave 9: System Health ──────────────────────────────────

test.describe('Wave 9 — System Health', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/system-health`);
    await page.waitForSelector('[data-testid="system-health-ui2-page"]', { state: 'attached', timeout: 10000 });
  });

  test('page loads', async ({ page }) => {
    await expect(page.locator('[data-testid="system-health-ui2-page"]')).toBeVisible();
  });

  test('shows component health cards', async ({ page }) => {
    await expect(page.locator('[data-testid="health-database"]')).toBeVisible({ timeout: 8000 });
  });
});

// ── Wave 10: Observability ─────────────────────────────────

test.describe('Wave 10 — Observability', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/observability`);
    await page.waitForSelector('[data-testid="observability-ui2-page"]', { state: 'attached', timeout: 10000 });
  });

  test('page loads', async ({ page }) => {
    await expect(page.locator('[data-testid="observability-ui2-page"]')).toBeVisible();
  });

  test('shows performance metrics', async ({ page }) => {
    await expect(page.locator('[data-testid="obs-rps"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="obs-p50"]')).toBeVisible();
    await expect(page.locator('[data-testid="obs-p95"]')).toBeVisible();
  });

  test('shows metrics table', async ({ page }) => {
    await expect(page.locator('[data-testid="obs-metrics-table"]')).toBeVisible({ timeout: 8000 });
  });
});

// ── Wave 10: Compliance ────────────────────────────────────

test.describe('Wave 10 — Compliance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/compliance`);
    await page.waitForSelector('[data-testid="compliance-ui2-page"]', { state: 'attached', timeout: 10000 });
  });

  test('page loads', async ({ page }) => {
    await expect(page.locator('[data-testid="compliance-ui2-page"]')).toBeVisible();
  });

  test('shows compliance checks', async ({ page }) => {
    await expect(page.locator('[data-testid^="compliance-"]')).toBeVisible({ timeout: 8000 });
  });
});

// ── Wave 10: Performance ───────────────────────────────────

test.describe('Wave 10 — Performance Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/performance`);
    await page.waitForSelector('[data-testid="performance-ui2-page"]', { state: 'attached', timeout: 10000 });
  });

  test('page loads', async ({ page }) => {
    await expect(page.locator('[data-testid="performance-ui2-page"]')).toBeVisible();
  });

  test('shows period returns', async ({ page }) => {
    await expect(page.locator('[data-testid^="perf-period-"]')).toBeVisible({ timeout: 8000 });
  });

  test('shows strategies table', async ({ page }) => {
    await expect(page.locator('[data-testid="perf-strategies-table"]')).toBeVisible({ timeout: 8000 });
  });
});
