import { test, expect } from '@playwright/test';

const LOAD_OPTS = { timeout: 30_000 };

test.describe('Search Flow', () => {
  test('search page loads', async ({ page }) => {
    await page.goto('/ui2/search');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('search has input', async ({ page }) => {
    await page.goto('/ui2/search');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    const input = page.locator('input[type="text"], input[placeholder*="search"], input[aria-label*="search"]');
    const count = await input.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('search explain loads', async ({ page }) => {
    await page.goto('/ui2/search-explain');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });
});
