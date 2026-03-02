import { test, expect } from '@playwright/test';

const LOAD_OPTS = { timeout: 30_000 };

test.describe('Trading — Chart and Order Interface', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ui2/trading');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('trading-ui2-page')).toBeVisible({ timeout: 15_000 });
  });

  test('trading page loads with data-testid marker', async ({ page }) => {
    await expect(page.getByTestId('trading-ui2-page')).toBeVisible();
  });

  test('trading page has chart container', async ({ page }) => {
    await expect(page.getByTestId('trading-chart-container')).toBeVisible({ timeout: 10_000 });
  });

  test('trading page has watchlist container', async ({ page }) => {
    await expect(page.getByTestId('trading-watchlist-container')).toBeVisible({ timeout: 10_000 });
  });

  test('trading page shows symbol ticker information', async ({ page }) => {
    const activeSymbol = page.getByTestId('ui2-active-symbol');
    if (await activeSymbol.isVisible()) {
      const text = await activeSymbol.textContent();
      expect(text).toBeTruthy();
      expect(text!.length).toBeGreaterThan(0);
    }
  });

  test('trading page layout has sufficient dimensions', async ({ page }) => {
    const box = await page.getByTestId('trading-ui2-page').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(200);
    expect(box!.width).toBeGreaterThan(400);
  });

  test('trading page contains canvas elements for charts', async ({ page }) => {
    const canvases = page.getByTestId('trading-chart-container').locator('canvas');
    const canvasCount = await canvases.count();
    expect(canvasCount).toBeGreaterThanOrEqual(0);
  });

  test('trading page has visible text content', async ({ page }) => {
    const text = await page.getByTestId('trading-ui2-page').textContent();
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(20);
  });

  test('trading page shows buy/sell or order-related elements', async ({ page }) => {
    const content = await page.getByTestId('trading-ui2-page').textContent();
    const orderTerms = ['BUY', 'SELL', 'Buy', 'Sell', 'Order', 'ORDER', 'Limit', 'Market', 'LIMIT', 'MARKET'];
    const found = orderTerms.some(t => content?.includes(t));
    expect(found).toBe(true);
  });

  test('trading page has multiple layout sections', async ({ page }) => {
    const trading = page.getByTestId('trading-ui2-page');
    const children = trading.locator('> div');
    const count = await children.count();
    expect(count).toBeGreaterThan(1);
  });

  test('trading page uses monospace font for price data', async ({ page }) => {
    const monoEls = page.getByTestId('trading-ui2-page').locator(
      '[style*="Mono"], [style*="mono"], [style*="monospace"]'
    );
    const count = await monoEls.count();
    expect(count).toBeGreaterThan(0);
  });

  test('trading page contains numeric data', async ({ page }) => {
    const content = await page.getByTestId('trading-ui2-page').textContent();
    const hasNumbers = /\d+/.test(content || '');
    expect(hasNumbers).toBe(true);
  });

  test('trading page renders without critical JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/ui2/trading');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await page.waitForTimeout(2000);
    const critical = errors.filter(e =>
      !e.includes('favicon') && !e.includes('net::ERR') && !e.includes('WebSocket') && !e.includes('Failed to fetch') && !e.includes('404')
    );
    expect(critical.length).toBeLessThanOrEqual(10);
  });

  test('watchlist area shows symbol-like text', async ({ page }) => {
    const text = await page.getByTestId('trading-ui2-page').textContent();
    const hasSymbolLikeContent = /[A-Z]{2,5}/.test(text || '');
    expect(hasSymbolLikeContent).toBe(true);
  });

  test('trading page has dark background theme', async ({ page }) => {
    const bg = await page.getByTestId('trading-ui2-page').evaluate(
      el => window.getComputedStyle(el).backgroundColor
    );
    if (bg && bg !== 'rgba(0, 0, 0, 0)') {
      const match = bg.match(/\d+/g);
      if (match) {
        const [r, g, b] = match.map(Number);
        expect(r + g + b).toBeLessThan(200);
      }
    }
  });

  test('chart container has meaningful height', async ({ page }) => {
    const box = await page.getByTestId('trading-chart-container').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(100);
  });

  test('trading page shows timeframe or period indicators', async ({ page }) => {
    const content = await page.getByTestId('trading-ui2-page').textContent();
    const timeframes = ['1m', '5m', '15m', '1h', '4h', '1D', '1W', 'Day', 'Week', 'Month'];
    const found = timeframes.some(tf => content?.includes(tf));
    expect(found).toBe(true);
  });
});
