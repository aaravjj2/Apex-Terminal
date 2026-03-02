import { test, expect } from '@playwright/test';

const LOAD_OPTS = { timeout: 30_000 };

test.describe('Navigation Extended', () => {
  test('dashboard loads', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('portfolio loads', async ({ page }) => {
    await page.goto('/ui2/portfolio');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('backtest loads', async ({ page }) => {
    await page.goto('/ui2/backtest');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('options matrix loads', async ({ page }) => {
    await page.goto('/ui2/options-matrix');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('risk loads', async ({ page }) => {
    await page.goto('/ui2/risk');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('alerts loads', async ({ page }) => {
    await page.goto('/ui2/alerts');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('search loads', async ({ page }) => {
    await page.goto('/ui2/search');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('screeners loads', async ({ page }) => {
    await page.goto('/ui2/screeners');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('root redirects to dashboard', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    expect(page.url()).toMatch(/dashboard|ui2/);
  });

  test('research loads', async ({ page }) => {
    await page.goto('/ui2/research');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('replay loads', async ({ page }) => {
    await page.goto('/ui2/replay');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('monitor loads', async ({ page }) => {
    await page.goto('/ui2/monitor');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('ops loads', async ({ page }) => {
    await page.goto('/ui2/ops');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('performance-v2 loads', async ({ page }) => {
    await page.goto('/ui2/performance-v2');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('attribution loads', async ({ page }) => {
    await page.goto('/ui2/attribution');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('workflow-builder loads', async ({ page }) => {
    await page.goto('/ui2/workflow-builder');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('observability-v2 loads', async ({ page }) => {
    await page.goto('/ui2/observability-v2');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('news-enrichment loads', async ({ page }) => {
    await page.goto('/ui2/news-enrichment');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('cross-asset-quote loads', async ({ page }) => {
    await page.goto('/ui2/cross-asset-quote');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });
});
