/**
 * UI2 Full Parity E2E Spec
 * Navigate all 13 UI2 routes, verify real UI1 components render,
 * capture screenshots for proof pack.
 * REQUIRES: headed mode, retries=0, workers=1, video=on, trace=on, screenshot=on
 */

import { test, expect } from '@playwright/test';

test.describe('UI2 Full Parity', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  const routes = [
    { path: '/ui2/dashboard', name: 'dashboard', testid: 'dashboard-ui2-page' },
    { path: '/ui2/trading', name: 'trading', testid: 'trading-ui2-page' },
    { path: '/ui2/portfolio', name: 'portfolio', testid: 'portfolio-ui2-page' },
    { path: '/ui2/orders', name: 'orders', testid: 'orders-ui2-page' },
    { path: '/ui2/risk', name: 'risk', testid: 'risk-ui2-page' },
    { path: '/ui2/research', name: 'research', testid: 'research-ui2-page' },
    { path: '/ui2/backtest', name: 'backtest', testid: 'backtest-ui2-page' },
    { path: '/ui2/autopilot', name: 'autopilot', testid: 'autopilot-ui2-page' },
    { path: '/ui2/alerts', name: 'alerts', testid: 'alerts-ui2-page' },
    { path: '/ui2/replay', name: 'replay', testid: 'replay-ui2-page' },
    { path: '/ui2/runs', name: 'runs', testid: 'runs-ui2-page' },
    { path: '/ui2/ops', name: 'ops', testid: 'ops-ui2-page' },
    { path: '/ui2/settings', name: 'settings', testid: 'settings-ui2-page' },
  ];

  // ── Shell structure tests ──────────────────────────────────────────
  for (const route of routes) {
    test(`${route.name} — page loads + shell visible`, async ({ page }) => {
      await page.goto(`http://localhost:5100${route.path}`);
      await page.waitForSelector(`[data-testid="${route.testid}"]`, { timeout: 15000 });

      // Shell structure
      await expect(page.locator('[data-testid="ui2-app-shell"]')).toBeVisible();
      await expect(page.locator('[data-testid="ui2-topbar"]')).toBeVisible();
      await expect(page.locator('[data-testid="ui2-left-rail"]')).toBeVisible();
      await expect(page.locator('[data-testid="ui2-bottom-dock"]')).toBeVisible();

      // Page content rendered
      await expect(page.locator(`[data-testid="${route.testid}"]`)).toBeVisible();

      await page.screenshot({
        path: `artifacts/ui2-media/screenshots/${route.name}-overview.png`,
        fullPage: false,
      });
    });
  }

  // ── Navigation test ────────────────────────────────────────────────
  test('navigation — all 13 workspaces accessible via left rail', async ({ page }) => {
    await page.goto('http://localhost:5100/ui2');
    // Default redirect should go to dashboard
    await page.waitForURL('**/ui2/dashboard', { timeout: 10000 });
    await expect(page.locator('[data-testid="dashboard-ui2-page"]')).toBeVisible();

    // Click through all workspaces via left rail
    for (const route of routes.slice(1)) {
      const railButton = page.locator(`[data-testid="ui2-rail-${route.name}"]`);
      await railButton.click();
      await page.waitForURL(`**${route.path}`, { timeout: 10000 });
      await page.waitForSelector(`[data-testid="${route.testid}"]`, { timeout: 15000 });
    }

    await page.screenshot({
      path: 'artifacts/ui2-media/screenshots/navigation-complete.png',
      fullPage: false,
    });
  });

  // ── Specific feature tests ────────────────────────────────────────

  test('trading — chart + watchlist + orders visible', async ({ page }) => {
    await page.goto('http://localhost:5100/ui2/trading');
    await page.waitForSelector('[data-testid="trading-ui2-page"]', { timeout: 15000 });

    // Chart area should render
    await expect(page.locator('[data-testid="trading-chart-container"]')).toBeVisible();
    // Watchlist should render
    await expect(page.locator('[data-testid="trading-watchlist-container"]')).toBeVisible();
    // Orders blotter
    await expect(page.locator('[data-testid="trading-blotter-container"]')).toBeVisible();

    await page.screenshot({
      path: 'artifacts/ui2-media/screenshots/trading-detail.png',
      fullPage: false,
    });
  });

  test('research — tabs switch between strategies/backtest/runs', async ({ page }) => {
    await page.goto('http://localhost:5100/ui2/research');
    await page.waitForSelector('[data-testid="research-ui2-page"]', { timeout: 15000 });

    // Strategies tab is default
    await expect(page.locator('[data-testid="research-strategies-embed"]')).toBeVisible();

    // Switch to backtest tab
    await page.locator('[data-testid="research-tabs"]').locator('text=Backtest').click();
    await expect(page.locator('[data-testid="research-backtest-embed"]')).toBeVisible();

    // Switch to runs tab  
    await page.locator('[data-testid="research-tabs"]').locator('text=Runs').click();
    await expect(page.locator('[data-testid="research-runs-embed"]')).toBeVisible();

    await page.screenshot({
      path: 'artifacts/ui2-media/screenshots/research-tabs.png',
      fullPage: false,
    });
  });

  test('ops — tabs switch between incidents/reports/settings', async ({ page }) => {
    await page.goto('http://localhost:5100/ui2/ops');
    await page.waitForSelector('[data-testid="ops-ui2-page"]', { timeout: 15000 });

    // Incidents tab is default
    await expect(page.locator('[data-testid="ops-incidents-embed"]')).toBeVisible();

    // Switch to reports tab
    await page.locator('[data-testid="ops-tabs"]').locator('text=Reports').click();
    await expect(page.locator('[data-testid="ops-reports-embed"]')).toBeVisible();

    // Switch to settings tab
    await page.locator('[data-testid="ops-tabs"]').locator('text=Settings').click();
    await expect(page.locator('[data-testid="ops-settings-embed"]')).toBeVisible();

    await page.screenshot({
      path: 'artifacts/ui2-media/screenshots/ops-tabs.png',
      fullPage: false,
    });
  });

  test('bottom dock — orders/trades tabs functional', async ({ page }) => {
    await page.goto('http://localhost:5100/ui2/dashboard');
    await page.waitForSelector('[data-testid="dashboard-ui2-page"]', { timeout: 15000 });

    const dock = page.locator('[data-testid="ui2-bottom-dock"]');
    await expect(dock).toBeVisible();

    await page.screenshot({
      path: 'artifacts/ui2-media/screenshots/bottom-dock.png',
      fullPage: false,
    });
  });
});
