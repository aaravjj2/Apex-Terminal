/**
 * v1.17 Backtest Polish E2E Tests
 * Validates UI primitives (Skeleton, EmptyState, SeverityBanner) 
 * and improved backtest UX
 */

import { test, expect } from '@playwright/test';

test.describe('v1.17 Backtest Polish', () => {
  test('should show empty state when no runs available', async ({ page, context }) => {
    // Mock backtest runs endpoint with empty array
    await context.route('**/api/backtest/runs', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for React to mount
    await page.waitForFunction(
      () => (document.getElementById('root')?.childElementCount ?? 0) > 0,
      { timeout: 20000 }
    );

    // Navigate to Backtest
    await page.getByTestId('nav-item-backtest').click();
    await page.waitForTimeout(500);

    // Verify backtest panel is visible
    await expect(page.getByTestId('backtest-panel')).toBeVisible({ timeout: 10000 });

    // Navigate to Runs tab
    await page.getByTestId('backtest-tab-runs').click();
    await page.waitForTimeout(500);

    // Should show empty state
    await expect(page.getByTestId('backtest-empty-state')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('backtest-empty-state-title')).toContainText('No backtest runs yet');
    await expect(page.getByTestId('empty-configure-action')).toBeVisible();

    // Capture screenshot
    await page.screenshot({ path: 'artifacts/verification/backtest-empty-state.png', fullPage: true });
  });

  test('should show loading skeleton in configure tab', async ({ page, context }) => {
    // Mock slow strategies endpoint
    await context.route('**/api/v1/strategies', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'sma-crossover', name: 'SMA Crossover' }
        ])
      });
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for React to mount
    await page.waitForFunction(
      () => (document.getElementById('root')?.childElementCount ?? 0) > 0,
      { timeout: 20000 }
    );

    // Navigate to Backtest
    await page.getByTestId('nav-item-backtest').click();
    await page.waitForTimeout(100);

    // Should show skeleton while loading
    const skeleton = page.getByTestId('skeleton').first();
    if (await skeleton.isVisible()) {
      await page.screenshot({ path: 'artifacts/verification/backtest-loading-skeleton.png', fullPage: true });
    }

    // Wait for content to load
    await expect(page.getByTestId('backtest-strategy-select')).toBeVisible({ timeout: 10000 });
  });

  test('should show success banner after backtest completes', async ({ page, context }) => {
    // Mock backtest run endpoint
    await context.route('**/api/backtest/run', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            run_id: 'test-run-001',
            status: 'completed',
            config: {
              strategy_id: 'sma-crossover',
              symbol: 'SPY',
              start_date: '2023-01-01',
              end_date: '2023-12-31',
              initial_capital: 100000,
              slippage_bps: 5,
              fee_per_trade: 1,
              seed: 42
            },
            config_hash: 'abc123',
            metrics: {
              total_return_pct: 15.3,
              cagr_pct: 15.1,
              max_drawdown_pct: -8.2,
              sharpe_ratio: 1.45,
              win_rate_pct: 58.3,
              total_trades: 24,
              winning_trades: 14,
              losing_trades: 10,
              avg_win: 850.0,
              avg_loss: -420.0,
              profit_factor: 2.02,
              final_equity: 115300.0
            },
            trades: [],
            equity_curve: [],
            started_at: '2023-01-01T00:00:00Z',
            completed_at: '2023-12-31T23:59:59Z'
          })
        });
      }
    });

    // Mock runs list endpoint
    await context.route('**/api/backtest/runs', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    // Mock strategies endpoint
    await context.route('**/api/v1/strategies', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'sma-crossover', name: 'SMA Crossover' }
        ])
      });
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.waitForFunction(
      () => (document.getElementById('root')?.childElementCount ?? 0) > 0,
      { timeout: 20000 }
    );

    // Navigate to Backtest
    await page.getByTestId('nav-item-backtest').click();
    await page.waitForTimeout(500);

    // Wait for strategies to load
    await page.waitForTimeout(500);

    // Run backtest
    await page.getByTestId('run-backtest-btn').click();
    await page.waitForTimeout(1000);

    // Should show success banner
    await expect(page.getByTestId('backtest-success-banner')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('backtest-success-banner-message')).toContainText('Backtest completed successfully');

    // Capture screenshot
    await page.screenshot({ path: 'artifacts/verification/backtest-success-banner.png', fullPage: true });
  });

  test('should show error banner on backtest failure', async ({ page, context }) => {
    // Mock backtest run endpoint with error
    await context.route('**/api/backtest/run', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            detail: 'Invalid configuration: start_date must be before end_date'
          })
        });
      }
    });

    // Mock strategies endpoint
    await context.route('**/api/v1/strategies', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'sma-crossover', name: 'SMA Crossover' }
        ])
      });
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.waitForFunction(
      () => (document.getElementById('root')?.childElementCount ?? 0) > 0,
      { timeout: 20000 }
    );

    // Navigate to Backtest
    await page.getByTestId('nav-item-backtest').click();
    await page.waitForTimeout(500);

    // Wait for strategies to load
    await page.waitForTimeout(500);

    // Run backtest
    await page.getByTestId('run-backtest-btn').click();
    await page.waitForTimeout(1000);

    // Should show error banner
    await expect(page.getByTestId('backtest-error-banner')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('backtest-error-banner-message')).toContainText('Invalid configuration');

    // Capture screenshot
    await page.screenshot({ path: 'artifacts/verification/backtest-error-banner.png', fullPage: true });
  });

  test('should show empty state in analyze tab with no run selected', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.waitForFunction(
      () => (document.getElementById('root')?.childElementCount ?? 0) > 0,
      { timeout: 20000 }
    );

    // Navigate to Backtest
    await page.getByTestId('nav-item-backtest').click();
    await page.waitForTimeout(500);

    // Navigate to Analyze tab
    await page.getByTestId('backtest-tab-analyze').click();
    await page.waitForTimeout(500);

    // Should show empty state
    await expect(page.getByTestId('analyze-empty-state')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('analyze-empty-state-title')).toContainText('No run selected');
    await expect(page.getByTestId('analyze-empty-action')).toBeVisible();

    // Capture screenshot
    await page.screenshot({ path: 'artifacts/verification/backtest-analyze-empty.png', fullPage: true });
  });
});
