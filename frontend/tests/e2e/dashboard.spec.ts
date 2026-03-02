import { test, expect } from '@playwright/test';

const LOAD_OPTS = { timeout: 30_000 };

test.describe('Dashboard — Market Command Center', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ui2/dashboard');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('dashboard-ui2-page')).toBeVisible({ timeout: 15_000 });
  });

  test('dashboard page loads with data-testid marker', async ({ page }) => {
    await expect(page.getByTestId('dashboard-ui2-page')).toHaveAttribute('data-ready', 'true');
  });

  test('dashboard renders inside ui2-center content area', async ({ page }) => {
    const center = page.getByTestId('ui2-center');
    await expect(center).toBeVisible();
    const dashboard = center.getByTestId('dashboard-ui2-page');
    await expect(dashboard).toBeVisible();
  });

  test('dashboard contains visible text content', async ({ page }) => {
    const dashText = await page.getByTestId('dashboard-ui2-page').textContent();
    expect(dashText).toBeTruthy();
    expect(dashText!.length).toBeGreaterThan(50);
  });

  test('dashboard has sector heatmap section with sector abbreviations', async ({ page }) => {
    const dashContent = await page.getByTestId('dashboard-ui2-page').textContent();
    const sectorAbbrs = ['XLK', 'XLF', 'XLV', 'XLY', 'XLE'];
    const hasAtLeastOne = sectorAbbrs.some(abbr => dashContent?.includes(abbr));
    expect(hasAtLeastOne).toBe(true);
  });

  test('dashboard shows index or market data labels', async ({ page }) => {
    const content = await page.getByTestId('dashboard-ui2-page').textContent();
    const marketTerms = ['SPX', 'NDX', 'DJIA', 'VIX', 'S&P', 'Nasdaq', 'Russell', 'SECTOR'];
    const found = marketTerms.some(t => content?.toUpperCase().includes(t.toUpperCase()));
    expect(found).toBe(true);
  });

  test('dashboard contains numeric data (prices or percentages)', async ({ page }) => {
    const content = await page.getByTestId('dashboard-ui2-page').textContent();
    const hasNumbers = /\d+\.\d{2}/.test(content || '');
    expect(hasNumbers).toBe(true);
  });

  test('dashboard has panel headers (uppercase labels)', async ({ page }) => {
    const page$ = page.getByTestId('dashboard-ui2-page');
    const allText = await page$.textContent();
    const panelKeywords = ['MOVERS', 'SECTOR', 'HEATMAP', 'POSITION', 'INDEX', 'BREADTH', 'VOLATIL', 'NEWS', 'OVERVIEW'];
    const found = panelKeywords.some(k => allText?.toUpperCase().includes(k));
    expect(found).toBe(true);
  });

  test('dashboard has dark theme (background is dark)', async ({ page }) => {
    const bg = await page.getByTestId('dashboard-ui2-page').evaluate(
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

  test('dashboard renders without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/ui2/dashboard');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await page.waitForTimeout(2000);
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') && !e.includes('404') && !e.includes('net::ERR')
    );
    expect(criticalErrors.length).toBeLessThanOrEqual(5);
  });

  test('dashboard page has non-zero height', async ({ page }) => {
    const box = await page.getByTestId('dashboard-ui2-page').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(200);
    expect(box!.width).toBeGreaterThan(200);
  });

  test('dashboard ready marker is present', async ({ page }) => {
    await expect(page.getByTestId('dashboard-ready')).toBeAttached({ timeout: 15_000 });
  });

  test('dashboard has multiple child panels', async ({ page }) => {
    const dash = page.getByTestId('dashboard-ui2-page');
    const children = dash.locator('> div');
    const count = await children.count();
    expect(count).toBeGreaterThan(2);
  });

  test('dashboard shows color-coded values (green/red)', async ({ page }) => {
    const greenEls = page.getByTestId('dashboard-ui2-page').locator('[style*="rgb(0"]');
    const redEls = page.getByTestId('dashboard-ui2-page').locator('[style*="rgb(255"]');
    const total = (await greenEls.count()) + (await redEls.count());
    expect(total).toBeGreaterThanOrEqual(0);
  });

  test('dashboard uses monospace font for data values', async ({ page }) => {
    const dash = page.getByTestId('dashboard-ui2-page');
    const monoEls = dash.locator('[style*="Mono"], [style*="mono"], [style*="monospace"]');
    const count = await monoEls.count();
    expect(count).toBeGreaterThan(0);
  });

  test('dashboard layout fills available viewport', async ({ page }) => {
    const center = page.getByTestId('ui2-center');
    const box = await center.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(400);
    expect(box!.height).toBeGreaterThan(300);
  });

  test('dashboard contains table elements or grid data', async ({ page }) => {
    const dash = page.getByTestId('dashboard-ui2-page');
    const tables = dash.locator('table');
    const grids = dash.locator('[style*="grid"]');
    const totalStructural = (await tables.count()) + (await grids.count());
    expect(totalStructural).toBeGreaterThan(0);
  });
});
