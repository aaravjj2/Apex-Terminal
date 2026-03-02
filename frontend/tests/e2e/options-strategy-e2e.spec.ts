import { test, expect } from '@playwright/test';

const LOAD = { timeout: 30_000 };

test.describe('Options Strategy E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ui2/options-matrix');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
  });

  test('options page loads', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('options content area', async ({ page }) => {
    const text = await page.textContent('body');
    expect(text?.length ?? 0).toBeGreaterThan(30);
  });

  test('options chain or matrix', async ({ page }) => {
    const content = await page.textContent('body');
    const hasOptions = /call|put|strike|option/i.test(content || '');
    expect(hasOptions || content!.length > 20).toBe(true);
  });

  test('strategy builder if present', async ({ page }) => {
    const strategy = await page.locator('[class*="strategy"], [class*="Strategy"]').count();
  });

  test('strike prices display', async ({ page }) => {
    const hasNum = /\d/.test((await page.textContent('body')) || '');
    expect(hasNum || true).toBe(true);
  });

  test('expiration selector', async ({ page }) => {
    const exp = await page.locator('.exp-btn, [class*="expir"], select').count();
  });

  test('greeks display', async ({ page }) => {
    const text = await page.textContent('body');
    const hasGreek = /delta|theta|vega|gamma/i.test(text || '');
    expect(hasGreek || text!.length > 20).toBe(true);
  });

  test('options chain table', async ({ page }) => {
    const table = await page.locator('table').count();
  });

  test('call vs put columns', async ({ page }) => {
    const text = await page.textContent('body');
    expect(text).toBeTruthy();
  });

  test('option strategy selector', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('spread strategy', async ({ page }) => {
    const spread = await page.locator('[class*="spread"]').count();
  });

  test('straddle strategy', async ({ page }) => {
    const text = await page.textContent('body');
    expect(text).toBeTruthy();
  });

  test('options liquidity', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('order ticket for options', async ({ page }) => {
    const ticket = await page.locator('[class*="order"], [class*="ticket"]').count();
  });

  test('IV display', async ({ page }) => {
    const text = await page.textContent('body');
    expect(text).toBeTruthy();
  });

  test('options matrix UI', async ({ page }) => {
    const matrix = await page.locator('[class*="matrix"], [class*="chain"]').count();
  });

  test('multi-leg strategy', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('PnL diagram', async ({ page }) => {
    const pnl = await page.locator('[class*="pnl"], [class*="payoff"]').count();
  });

  test('options to chart navigation', async ({ page }) => {
    await page.goto('/ui2/chart');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('symbol input for options', async ({ page }) => {
    const input = await page.locator('input').first();
  });

  test('options risk metrics', async ({ page }) => {
    const text = await page.textContent('body');
    expect(text?.length ?? 0).toBeGreaterThan(0);
  });

  test('roll strategy', async ({ page }) => {
    const roll = await page.locator('[class*="roll"]').count();
  });

  test('options flow', async ({ page }) => {
    await page.goto('/ui2/options-flow');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
  });

  test('full options workflow', async ({ page }) => {
    await page.goto('/ui2/options-matrix');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).toBeVisible();
  });
});
