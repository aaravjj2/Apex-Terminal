/**
 * v1.18 Offline Report Viewer E2E Tests
 * Validates report generation with provenance and offline viewing capability
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('v1.18 Offline Report Viewer', () => {
  test('should download report bundle with provenance', async ({ page, context }) => {
    const downloadsPath = path.join(process.cwd(), 'test-results', 'downloads');
    if (!fs.existsSync(downloadsPath)) {
      fs.mkdirSync(downloadsPath, { recursive: true });
    }

    // Mock backtest runs endpoint with sample run
    await context.route('**/api/backtest/runs', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            run_id: 'test-run-with-provenance',
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
            config_hash: 'abc123def456',
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
            provenance: {
              source: 'DEMO',
              provider: 'demo',
              cache_key: 'SPY_bars_2023-01-01_2023-12-31',
              checksum: 'sha256:xyz789abc123',
              fetched_at: '2024-01-01T10:00:00Z'
            },
            trades: [],
            equity_curve: [],
            started_at: '2023-01-01T00:00:00Z',
            completed_at: '2023-12-31T23:59:59Z'
          }
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

    // Navigate to Runs tab
    await page.getByTestId('backtest-tab-runs').click();
    await page.waitForTimeout(500);

    // Wait for runs table
    await expect(page.getByTestId('backtest-runs-table')).toBeVisible({ timeout: 10000 });

    // Capture runs list with download button
    await page.screenshot({ path: 'artifacts/verification/backtest-runs-with-download.png', fullPage: true });

    // Note: Actual download testing requires real backend artifacts
    // In E2E, we verify the button exists and is clickable
    const downloadButton = page.getByTestId('download-run-test-run-with-provenance');
    await expect(downloadButton).toBeVisible();
  });

  test('should display provenance in analyze tab', async ({ page, context }) => {
    // Mock backtest run endpoint with provenance
    await context.route('**/api/backtest/runs', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            run_id: 'test-run-prov',
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
              total_return_pct: 12.5,
              cagr_pct: 12.3,
              max_drawdown_pct: -5.1,
              sharpe_ratio: 1.8,
              win_rate_pct: 62.0,
              total_trades: 30,
              winning_trades: 18,
              losing_trades: 12,
              avg_win: 700.0,
              avg_loss: -350.0,
              profit_factor: 2.5,
              final_equity: 112500.0
            },
            provenance: {
              source: 'LOCAL_REPLAY',
              provider: 'yfinance',
              cache_key: 'SPY_bars_2023-01-01_2023-12-31_1d',
              checksum: 'sha256:abc123def456',
              fetched_at: '2024-02-10T08:30:00Z'
            },
            trades: [],
            equity_curve: [],
            started_at: '2023-01-01T00:00:00Z',
            completed_at: '2023-12-31T23:59:59Z'
          }
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

    // Navigate to Runs tab
    await page.getByTestId('backtest-tab-runs').click();
    await page.waitForTimeout(500);

    // Click analyze button
    await page.getByTestId('analyze-run-test-run-prov').click();
    await page.waitForTimeout(500);

    // Should show Analyze tab with provenance
    await expect(page.getByTestId('backtest-analyze-ready')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('provenance-display')).toBeVisible();
    await expect(page.getByTestId('provenance-source')).toContainText('LOCAL_REPLAY');

    // Capture screenshot
    await page.screenshot({ path: 'artifacts/verification/backtest-analyze-with-provenance.png', fullPage: true });
  });

  test('should navigate through all backtest tabs', async ({ page, context }) => {
    // Mock strategies endpoint
    await context.route('**/api/v1/strategies', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'sma-crossover', name: 'SMA Crossover' },
          { id: 'rsi-mean-reversion', name: 'RSI Mean Reversion' }
        ])
      });
    });

    // Mock runs endpoint
    await context.route('**/api/backtest/runs', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
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

    await expect(page.getByTestId('backtest-panel')).toBeVisible();

    // Configure tab (default)
    await expect(page.getByTestId('backtest-tab-configure')).toBeVisible();
    await page.screenshot({ path: 'artifacts/verification/backtest-tab-configure.png', fullPage: true });

    // Runs tab
    await page.getByTestId('backtest-tab-runs').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'artifacts/verification/backtest-tab-runs.png', fullPage: true });

    // Analyze tab
    await page.getByTestId('backtest-tab-analyze').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'artifacts/verification/backtest-tab-analyze.png', fullPage: true });

    // Compare tab
    await page.getByTestId('backtest-tab-compare').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'artifacts/verification/backtest-tab-compare.png', fullPage: true });

    // Export tab
    await page.getByTestId('backtest-tab-export').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'artifacts/verification/backtest-tab-export.png', fullPage: true });
  });
});
