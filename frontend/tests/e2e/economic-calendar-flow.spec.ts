import { test, expect } from '@playwright/test';

const LOAD_OPTS = { timeout: 30_000 };

test.describe('Economic Calendar Flow', () => {
  test('economic calendar loads', async ({ page }) => {
    await page.goto('/ui2/economic-calendar');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('economic calendar has content', async ({ page }) => {
    await page.goto('/ui2/economic-calendar');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    const text = await page.textContent('body');
    expect(text?.length ?? 0).toBeGreaterThan(50);
  });
});
