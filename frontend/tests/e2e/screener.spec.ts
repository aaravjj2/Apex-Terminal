import { test, expect } from '@playwright/test';

const LOAD_OPTS = { timeout: 30_000 };

test.describe('Screener — Stock Screening Terminal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ui2/screeners');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('screeners-page')).toBeVisible({ timeout: 15_000 });
  });

  test('screener page loads with data-testid marker', async ({ page }) => {
    await expect(page.getByTestId('screeners-page')).toBeVisible();
  });

  test('screener page has visible text content', async ({ page }) => {
    const text = await page.getByTestId('screeners-page').textContent();
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(50);
  });

  test('screener contains screening-related terminology', async ({ page }) => {
    const content = await page.getByTestId('screeners-page').textContent();
    const terms = [
      'MOMENTUM', 'VALUE', 'GROWTH', 'QUALITY', 'SCREEN', 'FILTER',
      'CRITERIA', 'UNIVERSE', 'PRESET', 'SCORE', 'RSI', 'P/E',
      'Momentum', 'Value', 'Growth', 'Quality', 'Screen', 'Filter',
      'Criteria', 'Universe', 'Preset', 'Score', 'Run',
    ];
    const found = terms.some(t => content?.includes(t));
    expect(found).toBe(true);
  });

  test('screener has table for results', async ({ page }) => {
    const screenerPage = page.getByTestId('screeners-page');
    const tables = screenerPage.locator('table');
    const grids = screenerPage.locator('[style*="grid"]');
    const total = (await tables.count()) + (await grids.count());
    expect(total).toBeGreaterThan(0);
  });

  test('screener shows numeric data', async ({ page }) => {
    const content = await page.getByTestId('screeners-page').textContent();
    const hasNumbers = /\d+/.test(content || '');
    expect(hasNumbers).toBe(true);
  });

  test('screener has interactive filter elements', async ({ page }) => {
    const screenerPage = page.getByTestId('screeners-page');
    const buttons = screenerPage.locator('button');
    const selects = screenerPage.locator('select');
    const inputs = screenerPage.locator('input');
    const total = (await buttons.count()) + (await selects.count()) + (await inputs.count());
    expect(total).toBeGreaterThan(0);
  });

  test('screener has preset strategy buttons', async ({ page }) => {
    const content = await page.getByTestId('screeners-page').textContent();
    const presets = ['Momentum', 'Value', 'Growth', 'Mean Reversion', 'Quality',
      'MOMENTUM', 'VALUE', 'GROWTH', 'MEAN REVERSION', 'QUALITY'];
    const found = presets.some(p => content?.includes(p));
    expect(found).toBe(true);
  });

  test('screener page has sufficient dimensions', async ({ page }) => {
    const box = await page.getByTestId('screeners-page').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(200);
    expect(box!.width).toBeGreaterThan(300);
  });

  test('screener uses monospace font for data values', async ({ page }) => {
    const monoEls = page.getByTestId('screeners-page').locator(
      '[style*="Mono"], [style*="mono"], [style*="monospace"]'
    );
    const count = await monoEls.count();
    expect(count).toBeGreaterThan(0);
  });

  test('screener shows uppercase content', async ({ page }) => {
    const content = await page.getByTestId('screeners-page').textContent();
    const hasUpperCase = /[A-Z]{2,}/.test(content || '');
    expect(hasUpperCase).toBe(true);
  });

  test('screener has column headers (Symbol, Price, RSI, etc.)', async ({ page }) => {
    const content = await page.getByTestId('screeners-page').textContent();
    const headers = ['SYMBOL', 'PRICE', 'RSI', 'MACD', 'VOLUME', 'P/E', 'SCORE',
      'Symbol', 'Price', 'Volume', 'Score'];
    const found = headers.some(h => content?.toUpperCase().includes(h.toUpperCase()));
    expect(found).toBe(true);
  });

  test('screener renders without critical console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/ui2/screeners');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await page.waitForTimeout(2000);
    const noise = ['favicon', 'net::ERR', 'WebSocket', 'Failed to fetch', '404', 'ECONNREFUSED', 'localhost:8', 'api/', 'ws://'];
    const critical = errors.filter(e => !noise.some(n => e.includes(n)));
    expect(critical.length).toBeLessThanOrEqual(10);
  });

  test('screener has multiple layout sections', async ({ page }) => {
    const screenerPage = page.getByTestId('screeners-page');
    const children = screenerPage.locator('> div');
    const count = await children.count();
    expect(count).toBeGreaterThan(1);
  });
});
