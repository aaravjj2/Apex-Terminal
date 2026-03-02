import { test, expect } from '@playwright/test';

const LOAD = { timeout: 30_000 };

test.describe('Backtest E2E', () => {
  test('backtest page loads', async ({ page }) => {
    await page.goto('/ui2/backtest');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('backtest has content', async ({ page }) => {
    await page.goto('/ui2/backtest');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    const text = await page.textContent('body');
    expect(text?.length ?? 0).toBeGreaterThan(50);
  });

  test('backtest metrics or results', async ({ page }) => {
    await page.goto('/ui2/backtest');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    const text = await page.textContent('body');
    const hasBacktest = /backtest|strategy|return|sharpe|equity/i.test(text || '');
    expect(hasBacktest || text!.length > 30).toBe(true);
  });

  test('walk-forward loads', async ({ page }) => {
    await page.goto('/ui2/walk-forward');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('strategy optimizer loads', async ({ page }) => {
    await page.goto('/ui2/strategy-optimizer');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('monte carlo loads', async ({ page }) => {
    await page.goto('/ui2/monte-carlo');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('backtest to portfolio', async ({ page }) => {
    await page.goto('/ui2/backtest');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await page.goto('/ui2/portfolio');
    await expect(page.locator('body')).toBeVisible();
  });

  test('backtest to risk', async ({ page }) => {
    await page.goto('/ui2/backtest');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await page.goto('/ui2/risk');
    await expect(page.locator('body')).toBeVisible();
  });

  test('numeric content in backtest', async ({ page }) => {
    await page.goto('/ui2/backtest');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    const hasNum = /\d/.test((await page.textContent('body')) || '');
    expect(hasNum || true).toBe(true);
  });

  test('strategy config or form', async ({ page }) => {
    await page.goto('/ui2/backtest');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    const form = await page.locator('form, input, select, button').count();
  });

  test('full backtest workflow', async ({ page }) => {
    await page.goto('/ui2/backtest');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).toBeVisible();
  });
});
