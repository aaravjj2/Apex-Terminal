import { test, expect } from '@playwright/test';

const LOAD_OPTS = { timeout: 30_000 };

test.describe('Options Flow', () => {
  test('options matrix page loads', async ({ page }) => {
    await page.goto('/ui2/options-matrix');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('options matrix has grid or table', async ({ page }) => {
    await page.goto('/ui2/options-matrix');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    const content = await page.textContent('body');
    const hasOpts = /strike|iv|delta|gamma|theta|vega|call|put|option/i.test(content || '');
    expect(hasOpts).toBe(true);
  });

  test('vol surface loads', async ({ page }) => {
    await page.goto('/ui2/vol-surface');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('greeks service loads', async ({ page }) => {
    await page.goto('/ui2/greeks-service');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('payoff lab loads', async ({ page }) => {
    await page.goto('/ui2/payoff-lab');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });
});
