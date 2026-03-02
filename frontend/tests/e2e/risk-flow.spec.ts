import { test, expect } from '@playwright/test';

const LOAD_OPTS = { timeout: 30_000 };

test.describe('Risk Flow', () => {
  test('risk page loads', async ({ page }) => {
    await page.goto('/ui2/risk');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('risk has metrics content', async ({ page }) => {
    await page.goto('/ui2/risk');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    const content = await page.textContent('body');
    const hasRisk = /var|risk|exposure|drawdown|volatility|value/i.test(content || '');
    expect(hasRisk).toBe(true);
  });

  test('stress scenarios loads', async ({ page }) => {
    await page.goto('/ui2/stress-scenarios');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('pre-trade-risk loads', async ({ page }) => {
    await page.goto('/ui2/pre-trade-risk');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });
});
