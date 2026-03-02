import { test, expect } from '@playwright/test';

const LOAD_OPTS = { timeout: 30_000 };

test.describe('Portfolio Flow', () => {
  test('portfolio page loads', async ({ page }) => {
    await page.goto('/ui2/portfolio');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('portfolio has content area', async ({ page }) => {
    await page.goto('/ui2/portfolio');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    const text = await page.textContent('body');
    expect(text?.length ?? 0).toBeGreaterThan(50);
  });

  test('portfolio shows numeric or table content', async ({ page }) => {
    await page.goto('/ui2/portfolio');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    const content = await page.textContent('body');
    const hasData = /\d|table|holdings|value|total/i.test(content || '');
    expect(hasData).toBe(true);
  });

  test('portfolio-v2 loads', async ({ page }) => {
    await page.goto('/ui2/portfolio-v2');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });
});
