/**
 * Wave 21-50 E2E Tests
 * UI2: Backtest V4, Evaluation, Strategy V2, Elasticsearch V3
 * data-testid selectors ONLY — headed, workers=1, retries=0
 */
import { test, expect } from '@playwright/test';

const BASE = '/ui2';

// ── Wave 21-26: Data Health ─────────────────────────────────

test.describe('Waves 21-26 — Data Health', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/data-health`);
    await page.waitForSelector('[data-testid="data-health-ui2-page"][data-ready="true"]', { state: 'attached', timeout: 8000 });
  });

  test('page loads with ready marker', async ({ page }) => {
    await expect(page.locator('[data-testid="data-health-ui2-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="data-health-ui2-page"]')).toHaveAttribute('data-ready', 'true');
  });

  test('shows pipeline health section', async ({ page }) => {
    await expect(page.locator('[data-testid="data-health-pipeline"]')).toBeVisible();
  });

  test('shows symbols section', async ({ page }) => {
    await expect(page.locator('[data-testid="data-health-symbols"]')).toBeVisible();
  });

  test('shows quality section', async ({ page }) => {
    await expect(page.locator('[data-testid="data-health-quality"]')).toBeVisible();
  });
});

// ── Waves 27-33: Backtest V4 ────────────────────────────────

test.describe('Waves 27-33 — Backtest V4', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/backtest-v4`);
    await page.waitForSelector('[data-testid="backtest-v4-ui2-page"][data-ready="true"]', { state: 'attached', timeout: 8000 });
  });

  test('page loads with ready marker', async ({ page }) => {
    await expect(page.locator('[data-testid="backtest-v4-ui2-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="backtest-v4-ui2-page"]')).toHaveAttribute('data-ready', 'true');
  });

  test('shows symbol input', async ({ page }) => {
    await expect(page.locator('[data-testid="bt4-symbols"]')).toBeVisible();
  });

  test('shows capital input', async ({ page }) => {
    await expect(page.locator('[data-testid="bt4-capital"]')).toBeVisible();
  });

  test('shows cost model selector', async ({ page }) => {
    await expect(page.locator('[data-testid="bt4-cost-model"]')).toBeVisible();
  });

  test('shows run button', async ({ page }) => {
    await expect(page.locator('[data-testid="bt4-run-btn"]')).toBeVisible();
  });
});

// ── Wave 34: Sweep V2 ──────────────────────────────────────

test.describe('Wave 34 — Sweep V2', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/sweep-v2`);
    await page.waitForSelector('[data-testid="sweep-v2-ui2-page"][data-ready="true"]', { state: 'attached', timeout: 8000 });
  });

  test('page loads with ready marker', async ({ page }) => {
    await expect(page.locator('[data-testid="sweep-v2-ui2-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="sweep-v2-ui2-page"]')).toHaveAttribute('data-ready', 'true');
  });

  test('shows symbol input', async ({ page }) => {
    await expect(page.locator('[data-testid="sweep-symbols"]')).toBeVisible();
  });

  test('shows run button', async ({ page }) => {
    await expect(page.locator('[data-testid="sweep-run-btn"]')).toBeVisible();
  });
});

// ── Wave 35: Walk Forward V2 ────────────────────────────────

test.describe('Wave 35 — Walk Forward V2', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/walk-forward-v2`);
    await page.waitForSelector('[data-testid="walk-forward-v2-ui2-page"][data-ready="true"]', { state: 'attached', timeout: 8000 });
  });

  test('page loads with ready marker', async ({ page }) => {
    await expect(page.locator('[data-testid="walk-forward-v2-ui2-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="walk-forward-v2-ui2-page"]')).toHaveAttribute('data-ready', 'true');
  });

  test('shows symbols input', async ({ page }) => {
    await expect(page.locator('[data-testid="wf2-symbols"]')).toBeVisible();
  });

  test('shows folds input', async ({ page }) => {
    await expect(page.locator('[data-testid="wf2-folds"]')).toBeVisible();
  });

  test('shows run button', async ({ page }) => {
    await expect(page.locator('[data-testid="wf2-run-btn"]')).toBeVisible();
  });
});

// ── Wave 36: Robustness ─────────────────────────────────────

test.describe('Wave 36 — Robustness', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/robustness`);
    await page.waitForSelector('[data-testid="robustness-ui2-page"][data-ready="true"]', { state: 'attached', timeout: 8000 });
  });

  test('page loads with ready marker', async ({ page }) => {
    await expect(page.locator('[data-testid="robustness-ui2-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="robustness-ui2-page"]')).toHaveAttribute('data-ready', 'true');
  });

  test('shows symbols input', async ({ page }) => {
    await expect(page.locator('[data-testid="robust-symbols"]')).toBeVisible();
  });

  test('shows stress run button', async ({ page }) => {
    await expect(page.locator('[data-testid="robust-run-btn"]')).toBeVisible();
  });

  test('shows overfit check button', async ({ page }) => {
    await expect(page.locator('[data-testid="overfit-run-btn"]')).toBeVisible();
  });
});

// ── Waves 38-40: Monte Carlo V2 ────────────────────────────

test.describe('Waves 38-40 — Monte Carlo V2', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/monte-carlo-v2`);
    await page.waitForSelector('[data-testid="monte-carlo-v2-ui2-page"][data-ready="true"]', { state: 'attached', timeout: 8000 });
  });

  test('page loads with ready marker', async ({ page }) => {
    await expect(page.locator('[data-testid="monte-carlo-v2-ui2-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="monte-carlo-v2-ui2-page"]')).toHaveAttribute('data-ready', 'true');
  });

  test('shows symbols input', async ({ page }) => {
    await expect(page.locator('[data-testid="mc2-symbols"]')).toBeVisible();
  });

  test('shows MC run button', async ({ page }) => {
    await expect(page.locator('[data-testid="mc2-run-btn"]')).toBeVisible();
  });

  test('shows benchmark button', async ({ page }) => {
    await expect(page.locator('[data-testid="mc2-bench-btn"]')).toBeVisible();
  });

  test('shows portfolio select button', async ({ page }) => {
    await expect(page.locator('[data-testid="mc2-portfolio-btn"]')).toBeVisible();
  });
});

// ── Waves 41-43: Strategy Builder V2 ────────────────────────

test.describe('Waves 41-43 — Strategy Builder V2', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/strategy-builder-v2`);
    await page.waitForSelector('[data-testid="strategy-builder-v2-ui2-page"][data-ready="true"]', { state: 'attached', timeout: 8000 });
  });

  test('page loads with ready marker', async ({ page }) => {
    await expect(page.locator('[data-testid="strategy-builder-v2-ui2-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="strategy-builder-v2-ui2-page"]')).toHaveAttribute('data-ready', 'true');
  });

  test('shows name input', async ({ page }) => {
    await expect(page.locator('[data-testid="sb2-name"]')).toBeVisible();
  });

  test('shows validate button', async ({ page }) => {
    await expect(page.locator('[data-testid="sb2-validate-btn"]')).toBeVisible();
  });

  test('shows AI prompt textarea', async ({ page }) => {
    await expect(page.locator('[data-testid="sb2-prompt"]')).toBeVisible();
  });

  test('shows AI assist button', async ({ page }) => {
    await expect(page.locator('[data-testid="sb2-ai-btn"]')).toBeVisible();
  });

  test('shows generate candidates button', async ({ page }) => {
    await expect(page.locator('[data-testid="sb2-gen-btn"]')).toBeVisible();
  });
});

// ── Waves 44-45: Research Queue ─────────────────────────────

test.describe('Waves 44-45 — Research Queue', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/research-queue`);
    await page.waitForSelector('[data-testid="research-queue-ui2-page"][data-ready="true"]', { state: 'attached', timeout: 8000 });
  });

  test('page loads with ready marker', async ({ page }) => {
    await expect(page.locator('[data-testid="research-queue-ui2-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="research-queue-ui2-page"]')).toHaveAttribute('data-ready', 'true');
  });

  test('shows submit button', async ({ page }) => {
    await expect(page.locator('[data-testid="rq-submit-btn"]')).toBeVisible();
  });

  test('shows refresh button', async ({ page }) => {
    await expect(page.locator('[data-testid="rq-refresh-btn"]')).toBeVisible();
  });

  test('shows job count', async ({ page }) => {
    await expect(page.locator('[data-testid="rq-count"]')).toBeVisible();
  });
});

// ── Waves 46-48: Search V2 ──────────────────────────────────

test.describe('Waves 46-48 — Search V2', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/search-v2`);
    await page.waitForSelector('[data-testid="search-v2-ui2-page"][data-ready="true"]', { state: 'attached', timeout: 8000 });
  });

  test('page loads with ready marker', async ({ page }) => {
    await expect(page.locator('[data-testid="search-v2-ui2-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-v2-ui2-page"]')).toHaveAttribute('data-ready', 'true');
  });

  test('shows query input', async ({ page }) => {
    await expect(page.locator('[data-testid="s2-query"]')).toBeVisible();
  });

  test('shows index selector', async ({ page }) => {
    await expect(page.locator('[data-testid="s2-index"]')).toBeVisible();
  });

  test('shows search button', async ({ page }) => {
    await expect(page.locator('[data-testid="s2-search-btn"]')).toBeVisible();
  });

  test('shows save query button', async ({ page }) => {
    await expect(page.locator('[data-testid="s2-save-btn"]')).toBeVisible();
  });
});

// ── Waves 49-50: ES Ops ─────────────────────────────────────

test.describe('Waves 49-50 — ES Ops', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/es-ops`);
    await page.waitForSelector('[data-testid="es-ops-ui2-page"][data-ready="true"]', { state: 'attached', timeout: 8000 });
  });

  test('page loads with ready marker', async ({ page }) => {
    await expect(page.locator('[data-testid="es-ops-ui2-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="es-ops-ui2-page"]')).toHaveAttribute('data-ready', 'true');
  });

  test('shows templates card', async ({ page }) => {
    await expect(page.locator('[data-testid="es-ops-templates"]')).toBeVisible();
  });

  test('shows aliases card', async ({ page }) => {
    await expect(page.locator('[data-testid="es-ops-aliases"]')).toBeVisible();
  });

  test('shows pipeline card', async ({ page }) => {
    await expect(page.locator('[data-testid="es-ops-pipeline"]')).toBeVisible();
  });

  test('shows lag card', async ({ page }) => {
    await expect(page.locator('[data-testid="es-ops-lag"]')).toBeVisible();
  });

  test('shows semantic card', async ({ page }) => {
    await expect(page.locator('[data-testid="es-ops-semantic"]')).toBeVisible();
  });

  test('shows artifacts card', async ({ page }) => {
    await expect(page.locator('[data-testid="es-ops-artifacts"]')).toBeVisible();
  });
});
