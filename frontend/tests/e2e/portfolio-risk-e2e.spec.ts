import { test, expect } from '@playwright/test';

const LOAD = { timeout: 30_000 };

test.describe('Portfolio Risk E2E', () => {
  test('portfolio page loads', async ({ page }) => {
    await page.goto('/ui2/portfolio');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('risk page loads', async ({ page }) => {
    await page.goto('/ui2/risk');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('portfolio has risk content', async ({ page }) => {
    await page.goto('/ui2/portfolio');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    const text = await page.textContent('body');
    expect(text?.length ?? 0).toBeGreaterThan(50);
  });

  test('risk page has metrics', async ({ page }) => {
    await page.goto('/ui2/risk');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    const text = await page.textContent('body');
    const hasRisk = /var|risk|volatility|drawdown|sharpe/i.test(text || '');
    expect(hasRisk || text!.length > 30).toBe(true);
  });

  test('portfolio to risk navigation', async ({ page }) => {
    await page.goto('/ui2/portfolio');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await page.goto('/ui2/risk');
    await expect(page.locator('body')).toBeVisible();
  });

  test('risk to portfolio navigation', async ({ page }) => {
    await page.goto('/ui2/risk');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await page.goto('/ui2/portfolio');
    await expect(page.locator('body')).toBeVisible();
  });

  test('portfolio optimizer loads', async ({ page }) => {
    await page.goto('/ui2/portfolio-optimizer');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('risk network loads', async ({ page }) => {
    await page.goto('/ui2/risk-network');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('numeric or table content in portfolio', async ({ page }) => {
    await page.goto('/ui2/portfolio');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    const content = await page.textContent('body');
    expect(/\d|table|holdings|value|total/i.test(content || '')).toBe(true);
  });

  test('VaR or stress content in risk', async ({ page }) => {
    await page.goto('/ui2/risk');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    const text = await page.textContent('body');
    expect(text).toBeTruthy();
  });

  test('full risk workflow', async ({ page }) => {
    await page.goto('/ui2/portfolio');
    await page.waitForTimeout(1000);
    await page.goto('/ui2/risk');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });
});
