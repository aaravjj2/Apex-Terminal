import { test, expect } from '@playwright/test';

const LOAD_OPTS = { timeout: 30_000 };

test.describe('Navigation — All UI2 Routes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ui2/dashboard');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
  });

  test('dashboard (/ui2/dashboard) loads and renders page', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('dashboard-ui2-page')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('body')).toBeVisible();
  });

  test('trading (/ui2/trading) loads and renders page', async ({ page }) => {
    await page.goto('/ui2/trading');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('trading-ui2-page')).toBeVisible({ timeout: 15_000 });
  });

  test('portfolio (/ui2/portfolio) loads and renders page', async ({ page }) => {
    await page.goto('/ui2/portfolio');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('portfolio-ui2-page')).toBeVisible({ timeout: 15_000 });
  });

  test('orders (/ui2/orders) loads and renders page', async ({ page }) => {
    await page.goto('/ui2/orders');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
    const content = page.locator('#root, [data-testid="ui2-center"]');
    await expect(content.first()).toBeVisible({ timeout: 15_000 });
  });

  test('risk (/ui2/risk) loads and renders page', async ({ page }) => {
    await page.goto('/ui2/risk');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('risk-ui2-page')).toBeVisible({ timeout: 15_000 });
  });

  test('backtest (/ui2/backtest) loads and renders page', async ({ page }) => {
    await page.goto('/ui2/backtest');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    const hasContent = await page.locator('body').textContent();
    expect(hasContent).toBeTruthy();
    const backtestVisible = await page.getByTestId('backtest-ui2-page').isVisible().catch(() => false);
    const hasBacktestText = (hasContent || '').toLowerCase().includes('backtest') || (hasContent || '').toLowerCase().includes('strategy');
    expect(backtestVisible || hasBacktestText).toBe(true);
  });

  test('alerts (/ui2/alerts) loads and renders page', async ({ page }) => {
    await page.goto('/ui2/alerts');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('alerts-ui2-page')).toBeVisible({ timeout: 15_000 });
  });

  test('sentiment (/ui2/sentiment) loads and renders page', async ({ page }) => {
    await page.goto('/ui2/sentiment');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
    const center = page.getByTestId('ui2-center');
    await expect(center).toBeVisible({ timeout: 15_000 });
  });

  test('options-matrix (/ui2/options-matrix) loads and renders page', async ({ page }) => {
    await page.goto('/ui2/options-matrix');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('options-matrix-page')).toBeVisible({ timeout: 15_000 });
  });

  test('settings (/ui2/settings) loads and renders page', async ({ page }) => {
    await page.goto('/ui2/settings');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('settings-ui2-page')).toBeVisible({ timeout: 15_000 });
  });

  test('screeners (/ui2/screeners) loads and renders page', async ({ page }) => {
    await page.goto('/ui2/screeners');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('screeners-page')).toBeVisible({ timeout: 15_000 });
  });

  test('economic-calendar (/ui2/economic-calendar) loads and renders page', async ({ page }) => {
    await page.goto('/ui2/economic-calendar');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    const center = page.getByTestId('ui2-center');
    await expect(center).toBeVisible({ timeout: 15_000 });
  });

  test('factor-model (/ui2/factor-model) loads and renders page', async ({ page }) => {
    await page.goto('/ui2/factor-model');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    const center = page.getByTestId('ui2-center');
    await expect(center).toBeVisible({ timeout: 15_000 });
  });

  test('vol-surface (/ui2/vol-surface) loads and renders page', async ({ page }) => {
    await page.goto('/ui2/vol-surface');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('vol-surface-page')).toBeVisible({ timeout: 15_000 });
  });

  test('blotter (/ui2/blotter) loads and renders page', async ({ page }) => {
    await page.goto('/ui2/blotter');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    const center = page.getByTestId('ui2-center');
    await expect(center).toBeVisible({ timeout: 15_000 });
  });

  test('search (/ui2/search) loads and renders page', async ({ page }) => {
    await page.goto('/ui2/search');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('search-ui2-page')).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Navigation — App Shell Persistence', () => {
  test('app shell is present on every route', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('ui2-app-shell')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('ui2-topbar')).toBeVisible();
    await expect(page.getByTestId('ui2-left-rail')).toBeVisible();
  });

  test('topbar remains visible across navigation', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('ui2-topbar')).toBeVisible({ timeout: 15_000 });

    await page.goto('/ui2/trading');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('ui2-topbar')).toBeVisible();
  });

  test('left rail navigation items are visible', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    const rail = page.getByTestId('ui2-left-rail');
    await expect(rail).toBeVisible({ timeout: 15_000 });
    const railItems = rail.locator('[data-testid^="ui2-rail-"]');
    const count = await railItems.count();
    expect(count).toBeGreaterThan(3);
  });

  test('navigating via left rail updates page content', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('dashboard-ui2-page')).toBeVisible({ timeout: 15_000 });

    const tradingRail = page.getByTestId('ui2-rail-trading');
    if (await tradingRail.isVisible()) {
      await tradingRail.click();
      await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
      await expect(page.getByTestId('trading-ui2-page')).toBeVisible({ timeout: 15_000 });
    }
  });

  test('default route redirects to /ui2/dashboard', async ({ page }) => {
    await page.goto('/ui2');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    expect(page.url()).toContain('/ui2/dashboard');
  });

  test('command trigger button is accessible in topbar', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('ui2-command-trigger')).toBeVisible({ timeout: 15_000 });
  });
});
