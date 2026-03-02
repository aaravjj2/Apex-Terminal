import { test, expect } from '@playwright/test';

const LOAD_OPTS = { timeout: 30_000 };

test.describe('Alerts Flow', () => {
  test('alerts page loads', async ({ page }) => {
    await page.goto('/ui2/alerts');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('alerts has content', async ({ page }) => {
    await page.goto('/ui2/alerts');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    const text = await page.textContent('body');
    expect(text?.length ?? 0).toBeGreaterThan(50);
  });
});
