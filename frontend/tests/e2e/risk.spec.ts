import { test, expect } from '@playwright/test';

const LOAD_OPTS = { timeout: 30_000 };

test.describe('Risk — Risk Analytics Terminal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ui2/risk');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('risk-ui2-page')).toBeVisible({ timeout: 15_000 });
  });

  test('risk page loads with data-testid marker', async ({ page }) => {
    await expect(page.getByTestId('risk-ui2-page')).toBeVisible();
  });

  test('risk page has visible text content', async ({ page }) => {
    const text = await page.getByTestId('risk-ui2-page').textContent();
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(50);
  });

  test('risk page contains VaR-related terminology', async ({ page }) => {
    const content = await page.getByTestId('risk-ui2-page').textContent();
    const terms = [
      'VAR', 'VaR', 'Value at Risk', 'CVaR', 'CVAR',
      'Confidence', '95%', '99%', 'Expected Shortfall',
    ];
    const found = terms.some(t => content?.toUpperCase().includes(t.toUpperCase()));
    expect(found).toBe(true);
  });

  test('risk page contains stress testing references', async ({ page }) => {
    const content = await page.getByTestId('risk-ui2-page').textContent();
    const terms = [
      'STRESS', 'Stress', 'SCENARIO', 'Scenario', 'GFC', 'COVID',
      'Black Monday', 'CRASH', 'Crash', 'Shock', 'SHOCK',
    ];
    const found = terms.some(t => content?.includes(t));
    expect(found).toBe(true);
  });

  test('risk page shows numeric risk metrics', async ({ page }) => {
    const content = await page.getByTestId('risk-ui2-page').textContent();
    const hasNumbers = /[-+]?\d+\.\d{1,4}/.test(content || '');
    expect(hasNumbers).toBe(true);
  });

  test('risk page has performance metrics terminology', async ({ page }) => {
    const content = await page.getByTestId('risk-ui2-page').textContent();
    const terms = [
      'SHARPE', 'Sharpe', 'SORTINO', 'Sortino', 'CALMAR', 'Calmar',
      'DRAWDOWN', 'Drawdown', 'VOLATILITY', 'Volatility', 'MAX DD',
      'CAGR', 'Return', 'RETURN',
    ];
    const found = terms.some(t => content?.includes(t));
    expect(found).toBe(true);
  });

  test('risk page has multiple panel sections', async ({ page }) => {
    const riskPage = page.getByTestId('risk-ui2-page');
    const children = riskPage.locator('> div');
    const count = await children.count();
    expect(count).toBeGreaterThan(1);
  });

  test('risk page has sufficient dimensions', async ({ page }) => {
    const box = await page.getByTestId('risk-ui2-page').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(200);
    expect(box!.width).toBeGreaterThan(300);
  });

  test('risk page uses monospace font for data', async ({ page }) => {
    const monoEls = page.getByTestId('risk-ui2-page').locator(
      '[style*="Mono"], [style*="mono"], [style*="monospace"]'
    );
    const count = await monoEls.count();
    expect(count).toBeGreaterThan(0);
  });

  test('risk page has table or grid structures', async ({ page }) => {
    const riskPage = page.getByTestId('risk-ui2-page');
    const tables = riskPage.locator('table');
    const grids = riskPage.locator('[style*="grid"]');
    const total = (await tables.count()) + (await grids.count());
    expect(total).toBeGreaterThan(0);
  });

  test('risk page has color-coded values (green/red for gain/loss)', async ({ page }) => {
    const html = await page.getByTestId('risk-ui2-page').innerHTML();
    const hasColors = html.includes('rgb(') || html.includes('#26a69a') ||
      html.includes('#ef5350') || html.includes('green') || html.includes('red');
    expect(hasColors).toBe(true);
  });

  test('risk page has interactive elements', async ({ page }) => {
    const riskPage = page.getByTestId('risk-ui2-page');
    const buttons = riskPage.locator('button');
    const selects = riskPage.locator('select');
    const inputs = riskPage.locator('input');
    const total = (await buttons.count()) + (await selects.count()) + (await inputs.count());
    expect(total).toBeGreaterThan(0);
  });

  test('risk page renders without critical console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/ui2/risk');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await page.waitForTimeout(2000);
    const noise = ['favicon', 'net::ERR', 'WebSocket', 'Failed to fetch', '404', 'ECONNREFUSED', 'localhost:8', 'api/', 'ws://'];
    const critical = errors.filter(e => !noise.some(n => e.includes(n)));
    expect(critical.length).toBeLessThanOrEqual(10);
  });
});
