import { test, expect } from '@playwright/test';

const LOAD_OPTS = { timeout: 30_000 };

test.describe('UI Smoke', () => {
  test('discovery loads', async ({ page }) => {
    await page.goto('/ui2/discovery');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('sentiment-v2 loads', async ({ page }) => {
    await page.goto('/ui2/sentiment-v2');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('dataset-snapshots loads', async ({ page }) => {
    await page.goto('/ui2/dataset-snapshots');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('runs page loads', async ({ page }) => {
    await page.goto('/ui2/runs');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('automation loads', async ({ page }) => {
    await page.goto('/ui2/automation');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('export loads', async ({ page }) => {
    await page.goto('/ui2/export');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('data-spine loads', async ({ page }) => {
    await page.goto('/ui2/data-spine');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('broker-v2 loads', async ({ page }) => {
    await page.goto('/ui2/broker-v2');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('corporate-actions loads', async ({ page }) => {
    await page.goto('/ui2/corporate-actions');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('factor-model loads', async ({ page }) => {
    await page.goto('/ui2/factor-model');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });
});
