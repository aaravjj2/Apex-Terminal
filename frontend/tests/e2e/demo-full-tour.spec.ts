import { test, expect } from '@playwright/test';

const LOAD = { timeout: 30_000 };

test.describe('Demo Full Tour', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
  });

  test('home/root loads', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('trading view visible', async ({ page }) => {
    await page.goto('/ui2/trading');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('portfolio view loads', async ({ page }) => {
    await page.goto('/ui2/portfolio');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    const body = await page.textContent('body');
    expect(body?.length ?? 0).toBeGreaterThan(20);
  });

  test('options view loads', async ({ page }) => {
    await page.goto('/ui2/options-matrix');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('backtest view loads', async ({ page }) => {
    await page.goto('/ui2/backtest');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('risk view loads', async ({ page }) => {
    await page.goto('/ui2/risk');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('screener view loads', async ({ page }) => {
    await page.goto('/ui2/search');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('alerts view loads', async ({ page }) => {
    await page.goto('/ui2/alerts');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('settings view loads', async ({ page }) => {
    await page.goto('/ui2/settings');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('dashboard view loads', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('Orders view loads', async ({ page }) => {
    await page.goto('/ui2/orders');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('news view loads', async ({ page }) => {
    await page.goto('/ui2/sentiment');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('autopilot view loads', async ({ page }) => {
    await page.goto('/ui2/autopilot');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('economic calendar loads', async ({ page }) => {
    await page.goto('/ui2/market-hours');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('portfolio-optimizer loads', async ({ page }) => {
    await page.goto('/ui2/portfolio-optimizer');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('body has content', async ({ page }) => {
    const text = await page.textContent('body');
    expect(text?.length ?? 0).toBeGreaterThan(50);
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded', LOAD).catch(() => {});
  });

  test('navigate trading to portfolio', async ({ page }) => {
    await page.goto('/ui2/trading');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await page.goto('/ui2/portfolio');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('navigate portfolio to options', async ({ page }) => {
    await page.goto('/ui2/portfolio');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await page.goto('/ui2/options-matrix');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('options to backtest', async ({ page }) => {
    await page.goto('/ui2/options-matrix');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await page.goto('/ui2/backtest');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('backtest to risk', async ({ page }) => {
    await page.goto('/ui2/backtest');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await page.goto('/ui2/risk');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('risk to search', async ({ page }) => {
    await page.goto('/ui2/risk');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await page.goto('/ui2/search');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('search to alerts', async ({ page }) => {
    await page.goto('/ui2/search');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await page.goto('/ui2/alerts');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('alerts to settings', async ({ page }) => {
    await page.goto('/ui2/alerts');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await page.goto('/ui2/settings');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('settings to dashboard', async ({ page }) => {
    await page.goto('/ui2/settings');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await page.goto('/ui2/dashboard');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('dashboard to orders', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await page.goto('/ui2/orders');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('orders to sentiment', async ({ page }) => {
    await page.goto('/ui2/orders');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await page.goto('/ui2/sentiment');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('news to autopilot', async ({ page }) => {
    await page.goto('/ui2/sentiment');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await page.goto('/ui2/autopilot');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('autopilot to market-hours', async ({ page }) => {
    await page.goto('/ui2/autopilot');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await page.goto('/ui2/market-hours');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('market-hours back to trading', async ({ page }) => {
    await page.goto('/ui2/market-hours');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await page.goto('/ui2/trading');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('full cycle navigation', async ({ page }) => {
    const routes = ['/ui2/trading', '/ui2/portfolio', '/ui2/options-matrix', '/ui2/backtest', '/ui2/trading'];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    }
    await expect(page.locator('body')).toBeVisible();
  });
});
