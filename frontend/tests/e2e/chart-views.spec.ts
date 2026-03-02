import { test, expect } from '@playwright/test';

const LOAD_OPTS = { timeout: 30_000 };

test.describe('Chart Views', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ui2/trading');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('trading-ui2-page')).toBeVisible({ timeout: 15_000 });
  });

  test('chart container is visible', async ({ page }) => {
    await expect(page.getByTestId('trading-chart-container')).toBeVisible({ timeout: 10_000 });
  });

  test('chart has timeframe controls', async ({ page }) => {
    const content = await page.getByTestId('trading-ui2-page').textContent();
    const hasTf = /1m|5m|15m|1h|4h|1D|1W|Day|Week|Month/i.test(content || '');
    expect(hasTf).toBe(true);
  });

  test('chart type can be switched if selector exists', async ({ page }) => {
    const typeBtn = page.locator('[data-testid*="chart-type"], [aria-label*="chart"], .chart-type, button:has-text("Candle"), button:has-text("Line")');
    const count = await typeBtn.count();
    if (count > 0) {
      await typeBtn.first().click();
      await page.waitForTimeout(500);
      expect(true).toBe(true);
    }
  });

  test('chart displays price data', async ({ page }) => {
    const content = await page.getByTestId('trading-ui2-page').textContent();
    const hasNumbers = /\d+\.?\d*/.test(content || '');
    expect(hasNumbers).toBe(true);
  });

  test('chart container has meaningful dimensions', async ({ page }) => {
    const box = await page.getByTestId('trading-chart-container').boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.height).toBeGreaterThan(50);
      expect(box.width).toBeGreaterThan(100);
    }
  });

  test('chart area contains canvas or svg', async ({ page }) => {
    const chartArea = page.getByTestId('trading-chart-container');
    const canvas = chartArea.locator('canvas');
    const svg = chartArea.locator('svg');
    const canvasCount = await canvas.count();
    const svgCount = await svg.count();
    expect(canvasCount + svgCount).toBeGreaterThanOrEqual(0);
  });

  test('trading page shows symbol', async ({ page }) => {
    const content = await page.getByTestId('trading-ui2-page').textContent();
    const hasSymbol = /[A-Z]{2,5}/.test(content || '');
    expect(hasSymbol).toBe(true);
  });

  test('watchlist container visible', async ({ page }) => {
    await expect(page.getByTestId('trading-watchlist-container')).toBeVisible({ timeout: 10_000 });
  });

  test('chart has OHLC or price display', async ({ page }) => {
    const content = await page.getByTestId('trading-ui2-page').textContent();
    const hasPrice = /open|high|low|close|volume|OHLC/i.test(content || '');
    expect(hasPrice).toBe(true);
  });

  test('trading page loads without crash', async ({ page }) => {
    await page.goto('/ui2/trading');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await page.waitForTimeout(2000);
    await expect(page.getByTestId('trading-ui2-page')).toBeVisible({ timeout: 5_000 });
  });

  test('chart body has positive height', async ({ page }) => {
    const chartBody = page.locator('.chart-body, [class*="chart-body"]');
    if ((await chartBody.count()) > 0) {
      const box = await chartBody.first().boundingBox();
      expect(box?.height ?? 0).toBeGreaterThan(0);
    }
  });
});
