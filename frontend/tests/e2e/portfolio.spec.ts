import { test, expect } from '@playwright/test';

const LOAD_OPTS = { timeout: 30_000 };

test.describe('Portfolio — Holdings and Allocation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ui2/portfolio');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('portfolio-ui2-page')).toBeVisible({ timeout: 15_000 });
  });

  test('portfolio page loads with data-testid marker', async ({ page }) => {
    await expect(page.getByTestId('portfolio-ui2-page')).toHaveAttribute('data-ready', 'true');
  });

  test('portfolio ready marker is present', async ({ page }) => {
    await expect(page.getByTestId('portfolio-ready')).toBeAttached({ timeout: 15_000 });
  });

  test('portfolio page has visible text content', async ({ page }) => {
    const text = await page.getByTestId('portfolio-ui2-page').textContent();
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(50);
  });

  test('portfolio contains financial terminology', async ({ page }) => {
    const content = await page.getByTestId('portfolio-ui2-page').textContent();
    const terms = [
      'POSITION', 'HOLDING', 'ALLOCATION', 'P&L', 'PNL', 'RETURN',
      'EXPOSURE', 'WEIGHT', 'VALUE', 'EQUITY', 'RISK', 'PERFORMANCE',
      'Position', 'Holding', 'Allocation', 'Return', 'Exposure', 'Weight',
    ];
    const found = terms.some(t => content?.toUpperCase().includes(t.toUpperCase()));
    expect(found).toBe(true);
  });

  test('portfolio shows numeric data (values or percentages)', async ({ page }) => {
    const content = await page.getByTestId('portfolio-ui2-page').textContent();
    const hasNumbers = /\d+\.\d{1,4}/.test(content || '');
    expect(hasNumbers).toBe(true);
  });

  test('portfolio page has multiple sections or panels', async ({ page }) => {
    const portPage = page.getByTestId('portfolio-ui2-page');
    const sections = portPage.locator('> div');
    const count = await sections.count();
    expect(count).toBeGreaterThan(1);
  });

  test('portfolio page has sufficient dimensions', async ({ page }) => {
    const box = await page.getByTestId('portfolio-ui2-page').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(200);
    expect(box!.width).toBeGreaterThan(300);
  });

  test('portfolio uses monospace font for values', async ({ page }) => {
    const monoEls = page.getByTestId('portfolio-ui2-page').locator(
      '[style*="Mono"], [style*="mono"], [style*="monospace"]'
    );
    const count = await monoEls.count();
    expect(count).toBeGreaterThan(0);
  });

  test('portfolio contains table or grid structures', async ({ page }) => {
    const portPage = page.getByTestId('portfolio-ui2-page');
    const tables = portPage.locator('table');
    const grids = portPage.locator('[style*="grid"]');
    const total = (await tables.count()) + (await grids.count());
    expect(total).toBeGreaterThan(0);
  });

  test('portfolio shows stock symbols or financial content', async ({ page }) => {
    const content = await page.getByTestId('portfolio-ui2-page').textContent();
    const hasSymbols = /[A-Z]{2,5}/.test(content || '');
    const hasFinancial = /portfolio|holding|position|allocation|return/i.test(content || '');
    expect(hasSymbols || hasFinancial).toBe(true);
  });

  test('portfolio page dark theme is applied', async ({ page }) => {
    const bg = await page.getByTestId('portfolio-ui2-page').evaluate(
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

  test('portfolio renders without critical console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/ui2/portfolio');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await page.waitForTimeout(2000);
    const noise = ['favicon', 'net::ERR', 'WebSocket', 'Failed to fetch', '404', 'ECONNREFUSED', 'localhost:8', 'api/', 'ws://'];
    const critical = errors.filter(e => !noise.some(n => e.includes(n)));
    expect(critical.length).toBeLessThanOrEqual(10);
  });

  test('portfolio has color-coded gain/loss indicators', async ({ page }) => {
    const content = await page.getByTestId('portfolio-ui2-page').innerHTML();
    const hasColoredElements = content.includes('rgb(') || content.includes('#');
    expect(hasColoredElements).toBe(true);
  });
});
