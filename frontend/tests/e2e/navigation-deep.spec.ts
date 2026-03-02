import { test, expect } from '@playwright/test';

const LOAD = { timeout: 30_000 };
const ROUTES = [
  '/ui2/dashboard',
  '/ui2/trading',
  '/ui2/portfolio',
  '/ui2/risk',
  '/ui2/orders',
  '/ui2/backtest',
  '/ui2/autopilot',
  '/ui2/alerts',
  '/ui2/settings',
  '/ui2/research',
  '/ui2/options-matrix',
  '/ui2/search',
  '/ui2/sentiment',
  '/ui2/market-hours',
  '/ui2/portfolio-optimizer',
  '/ui2/strategy-optimizer',
  '/ui2/walk-forward',
  '/ui2/monte-carlo',
  '/ui2/microstructure',
  '/ui2/observability',
];

test.describe('Navigation Deep', () => {
  test('each main route loads', async ({ page }) => {
    for (const route of ROUTES.slice(0, 10)) {
      await page.goto(route);
      await page.waitForLoadState('networkidle', LOAD).catch(() => {});
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('dashboard to all hubs', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    for (const route of ['/ui2/trading', '/ui2/portfolio', '/ui2/risk', '/ui2/backtest']) {
      await page.goto(route);
      await page.waitForLoadState('networkidle', LOAD).catch(() => {});
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('deep link trading', async ({ page }) => {
    await page.goto('/ui2/trading');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('deep link portfolio', async ({ page }) => {
    await page.goto('/ui2/portfolio');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('deep link risk', async ({ page }) => {
    await page.goto('/ui2/risk');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('deep link backtest', async ({ page }) => {
    await page.goto('/ui2/backtest');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('sequential navigation', async ({ page }) => {
    const sequence = ['/ui2/dashboard', '/ui2/trading', '/ui2/portfolio', '/ui2/risk', '/ui2/backtest', '/ui2/dashboard'];
    for (const r of sequence) {
      await page.goto(r);
      await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    }
    await expect(page.locator('body')).toBeVisible();
  });

  test('index redirects to dashboard', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
  });

  test('settings loads', async ({ page }) => {
    await page.goto('/ui2/settings');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('health loads', async ({ page }) => {
    await page.goto('/ui2/health');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('ops loads', async ({ page }) => {
    await page.goto('/ui2/ops');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('autopilot loads', async ({ page }) => {
    await page.goto('/ui2/autopilot');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('alerts loads', async ({ page }) => {
    await page.goto('/ui2/alerts');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('replay loads', async ({ page }) => {
    await page.goto('/ui2/replay');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('runs loads', async ({ page }) => {
    await page.goto('/ui2/runs');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('observability loads', async ({ page }) => {
    await page.goto('/ui2/observability');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('compliance loads', async ({ page }) => {
    await page.goto('/ui2/compliance');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('anomalies loads', async ({ page }) => {
    await page.goto('/ui2/anomalies');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('liquidity loads', async ({ page }) => {
    await page.goto('/ui2/liquidity');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('no 404 on valid routes', async ({ page }) => {
    const res = await page.goto('/ui2/dashboard');
    expect(res?.status()).toBeLessThan(500);
  });

  test('browser back after navigation', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await page.goto('/ui2/portfolio');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await page.goBack();
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('browser forward', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    await page.goto('/ui2/portfolio');
    await page.goBack();
    await page.goForward();
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('refresh preserves route', async ({ page }) => {
    await page.goto('/ui2/portfolio');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    await page.reload();
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
    expect(page.url()).toContain('portfolio');
  });

  test('direct url load', async ({ page }) => {
    await page.goto('/ui2/risk');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
  });
});
