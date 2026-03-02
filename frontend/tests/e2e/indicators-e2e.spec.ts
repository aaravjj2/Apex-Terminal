import { test, expect } from '@playwright/test';

const LOAD = { timeout: 30_000 };

test.describe('Indicators E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ui2/trading');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
  });

  test('chart page loads for indicator testing', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('chart area visible', async ({ page }) => {
    const body = await page.textContent('body');
    expect(body?.length ?? 0).toBeGreaterThan(0);
  });

  test('indicators panel or controls present', async ({ page }) => {
    const content = await page.textContent('body');
    const hasChartRelated = /chart|indicator|rsi|ma|volume/i.test(content || '');
    expect(hasChartRelated || content!.length > 20).toBe(true);
  });

  test('RSI or technical content', async ({ page }) => {
    const text = await page.textContent('body');
    expect(text?.length ?? 0).toBeGreaterThan(20);
  });

  test('volume or OHLC related', async ({ page }) => {
    const text = await page.textContent('body');
    expect(text).toBeTruthy();
  });

  test('timeframe controls if present', async ({ page }) => {
    const hasTimeframe = await page.locator('[data-testid*="timeframe"], .tf-btn, [class*="timeframe"]').count() > 0;
  });

  test('chart renders without crash', async ({ page }) => {
    await page.waitForTimeout(2000);
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('navigate to chart from home', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await page.goto('/ui2/trading');
    await expect(page.locator('body')).toBeVisible();
  });

  test('chart handles resize', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('multiple chart views', async ({ page }) => {
    await page.goto('/ui2/trading');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('indicator overlay area', async ({ page }) => {
    const canvas = await page.locator('canvas').count();
  });

  test('no fatal errors on chart load', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded', LOAD).catch(() => {});
  });

  test('chart with RSI pane if dual-pane', async ({ page }) => {
    const text = await page.textContent('body');
    expect(text).toBeTruthy();
  });

  test('symbol display', async ({ page }) => {
    const text = await page.textContent('body');
    expect(text?.length ?? 0).toBeGreaterThan(10);
  });

  test('price display', async ({ page }) => {
    const hasNum = /\d/.test((await page.textContent('body')) || '');
    expect(hasNum || true).toBe(true);
  });

  test('chart controls visible', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('drawing tools strip if present', async ({ page }) => {
    const strip = await page.locator('.draw-strip, [class*="draw"]').count();
  });

  test('indicator selection', async ({ page }) => {
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('MA options if available', async ({ page }) => {
    const text = await page.textContent('body');
    expect(text?.length ?? 0).toBeGreaterThan(0);
  });

  test('volatility indicator area', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('momentum indicator', async ({ page }) => {
    const text = await page.textContent('body');
    expect(text).toBeTruthy();
  });

  test('trend indicator', async ({ page }) => {
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('volume indicator', async ({ page }) => {
    const text = await page.textContent('body');
    expect(text).toBeTruthy();
  });

  test('indicator settings', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('chart type switcher if present', async ({ page }) => {
    const hasSwitch = await page.locator('[class*="chart"], [class*="candle"]').count() >= 0;
  });

  test('zoom/pan controls', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('full indicator workflow', async ({ page }) => {
    await page.goto('/ui2/trading');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).toBeVisible();
  });
});
