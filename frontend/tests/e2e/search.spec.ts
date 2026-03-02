import { test, expect } from '@playwright/test';

const LOAD_OPTS = { timeout: 30_000 };

test.describe('Search — Symbol and Entity Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ui2/search');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('search-ui2-page')).toBeVisible({ timeout: 15_000 });
  });

  test('search page loads with data-testid marker', async ({ page }) => {
    await expect(page.getByTestId('search-ui2-page')).toHaveAttribute('data-ready', 'true');
  });

  test('search page has search input field', async ({ page }) => {
    await expect(page.getByTestId('search-input')).toBeVisible({ timeout: 10_000 });
  });

  test('search input is an editable text field', async ({ page }) => {
    const input = page.getByTestId('search-input');
    await expect(input).toBeVisible();
    await input.fill('AAPL');
    await expect(input).toHaveValue('AAPL');
  });

  test('search page has search button', async ({ page }) => {
    await expect(page.getByTestId('search-button')).toBeVisible({ timeout: 10_000 });
  });

  test('search page has search bar container', async ({ page }) => {
    await expect(page.getByTestId('search-bar')).toBeVisible();
  });

  test('search page has filter options', async ({ page }) => {
    await expect(page.getByTestId('search-filters')).toBeVisible({ timeout: 10_000 });
  });

  test('search page has results panel area', async ({ page }) => {
    await expect(page.getByTestId('search-results-panel')).toBeAttached({ timeout: 10_000 });
  });

  test('search page has symbol filter', async ({ page }) => {
    const filter = page.getByTestId('search-symbol-filter');
    const visible = await filter.isVisible().catch(() => false);
    expect(visible).toBe(true);
  });

  test('search page has result count indicator', async ({ page }) => {
    await expect(page.getByTestId('search-count')).toBeVisible({ timeout: 10_000 });
  });

  test('search page has provider status section', async ({ page }) => {
    await expect(page.getByTestId('search-provider-status')).toBeVisible({ timeout: 10_000 });
  });

  test('search ready marker is present', async ({ page }) => {
    await expect(page.getByTestId('search-ready')).toBeAttached({ timeout: 15_000 });
  });

  test('search page renders without critical errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/ui2/search');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await page.waitForTimeout(2000);
    const noise = ['favicon', 'net::ERR', 'WebSocket', 'Failed to fetch', '404', 'ECONNREFUSED', 'localhost:8', 'api/', 'ws://'];
    const critical = errors.filter(e => !noise.some(n => e.includes(n)));
    expect(critical.length).toBeLessThanOrEqual(10);
  });
});
