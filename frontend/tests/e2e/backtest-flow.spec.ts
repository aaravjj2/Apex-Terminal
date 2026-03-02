import { test, expect } from '@playwright/test';

const LOAD_OPTS = { timeout: 30_000 };

test.describe('Backtest Flow', () => {
  test('backtest page loads', async ({ page }) => {
    await page.goto('/ui2/backtest');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('backtest has run or strategy controls', async ({ page }) => {
    await page.goto('/ui2/backtest');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    const content = await page.textContent('body');
    const hasControls = /run|strategy|backtest|start|execute/i.test(content || '');
    expect(hasControls).toBe(true);
  });

  test('backtester-v3 loads', async ({ page }) => {
    await page.goto('/ui2/backtester-v3');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });
});
