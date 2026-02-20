/**
 * TOUR.spec.ts — Apex Terminal Core Correctness Tour
 *
 * Generates TOUR.webm ≥3 minutes showing all 4 core features:
 *  1. Autopilot + PnL
 *  2. Global Search
 *  3. Workflow Builder
 *  4. Strategy + Backtester
 *
 * Uses data-testid selectors only. Runs in headed Chrome.
 * Output: test-results/tour-TOUR-Tour-[hash]/video.webm
 */

import { test, expect } from '@playwright/test';

const BASE = '/ui2';
const PAUSE = 5500; // ms between actions — enough to be visible in video

test('Tour — Apex Terminal Core Features', async ({ page }) => {
  test.setTimeout(300_000); // 5-minute budget for ≥3-minute video
  // ── 0. Load App ─────────────────────────────────────────────────────────────
  await page.goto(BASE);
  await expect(page.getByTestId('ui2-app-shell')).toBeVisible();
  await page.waitForTimeout(PAUSE);

  // ── 1. Autopilot + PnL ──────────────────────────────────────────────────────
  await page.getByTestId('ui2-rail-autopilot').click();
  await expect(page.getByTestId('autopilot-ui2-page')).toBeVisible();
  await expect(page.getByTestId('autopilot-header')).toBeVisible();
  await page.waitForTimeout(PAUSE);

  // Controls tab — survey the UI
  await expect(page.getByTestId('autopilot-tabs')).toBeVisible();
  await expect(page.getByTestId('autopilot-kill-switch-panel')).toBeVisible();
  await expect(page.getByTestId('autopilot-rules-list')).toBeVisible();
  await expect(page.getByTestId('autopilot-activity-table')).toBeVisible();
  await page.waitForTimeout(PAUSE);

  // Switch to Pipeline 2.0 tab
  await page.getByTestId('autopilot-tab-pipeline').click();
  await expect(page.getByTestId('autopilot-pipeline-panel')).toBeVisible();
  await page.waitForTimeout(PAUSE);

  // Run the pipeline
  await page.getByTestId('autopilot-run-pipeline-btn').click();
  await expect(page.getByTestId('autopilot-stage-timeline')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(PAUSE);

  // Verify deterministic output
  await expect(page.getByTestId('autopilot-run-hash')).toBeVisible();
  const hash = await page.getByTestId('autopilot-run-hash').textContent();
  console.log(`[TOUR] Autopilot deterministic hash: ${hash}`);
  await page.waitForTimeout(PAUSE);

  // Check summary bar
  await expect(page.getByTestId('autopilot-summary-bar')).toBeVisible();
  await page.waitForTimeout(PAUSE);

  // Ledger tab
  await page.getByTestId('autopilot-tab-ledger').click();
  await expect(page.getByTestId('autopilot-ledger-panel')).toBeVisible();
  await page.getByTestId('autopilot-ledger-tab-decisions').click();
  await expect(page.getByTestId('autopilot-ledger-decisions')).toBeVisible();
  await page.waitForTimeout(PAUSE);

  // ── 2. Global Search ────────────────────────────────────────────────────────
  await page.getByTestId('ui2-rail-search').click();
  await expect(page.getByTestId('search-ui2-page')).toBeVisible();
  await expect(page.getByTestId('search-bar')).toBeVisible();
  await page.waitForTimeout(PAUSE);

  // Type a query
  await page.getByTestId('search-input').fill('AAPL');
  await page.getByTestId('search-button').click();
  await expect(page.getByTestId('search-results-panel')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(PAUSE);

  // Check results table
  await expect(page.getByTestId('search-results-table')).toBeVisible();
  await page.waitForTimeout(PAUSE);

  // Try strategy search
  await page.getByTestId('search-input').fill('strategy');
  await page.getByTestId('search-button').click();
  await page.waitForTimeout(PAUSE);

  // Try entity type filter
  await page.getByTestId('search-filter-order').click();
  await page.waitForTimeout(PAUSE);

  // Reset filter
  await page.getByTestId('search-filter-all').click();
  await page.waitForTimeout(PAUSE);

  // ── 3. Workflow Builder ──────────────────────────────────────────────────────
  await page.getByTestId('ui2-rail-workflow-builder').click();
  await expect(page.getByTestId('ui2-workflow-builder-page')).toBeVisible();
  await expect(page.getByTestId('ui2-workflow-builder-header')).toBeVisible();
  await page.waitForTimeout(PAUSE);

  // Create a new workflow
  await page.getByTestId('ui2-workflow-create-btn').click();
  await expect(page.getByTestId('ui2-workflow-form')).toBeVisible();
  await page.waitForTimeout(PAUSE);

  // Fill in form
  await page.getByTestId('ui2-workflow-name-input').fill('TOUR Demo Workflow');
  await page.waitForTimeout(PAUSE);

  // Set trigger
  await page.getByTestId('ui2-workflow-trigger-select').selectOption('schedule');
  await page.waitForTimeout(PAUSE);

  // Edit trigger config
  await page.getByTestId('ui2-workflow-trigger-config').fill('{"cron": "0 9 * * 1-5"}');
  await page.waitForTimeout(PAUSE);

  // Add an action
  await page.getByTestId('ui2-workflow-add-action-btn').click();
  await page.waitForTimeout(PAUSE);

  // Validate
  await page.getByTestId('ui2-workflow-validate-btn').click();
  await expect(page.getByTestId('ui2-workflow-validate-result')).toBeVisible();
  const validateMsg = await page.getByTestId('ui2-workflow-validate-result').textContent();
  console.log(`[TOUR] Validate result: ${validateMsg}`);
  await page.waitForTimeout(PAUSE);

  // Save the workflow
  await page.getByTestId('ui2-workflow-save-btn').click();
  await page.waitForTimeout(PAUSE);

  // Templates tab
  await page.getByTestId('ui2-workflow-tab-templates').click();
  await expect(page.getByTestId('ui2-workflow-templates-list')).toBeVisible();
  await page.waitForTimeout(PAUSE);

  // ── 4. Strategy + Backtester ────────────────────────────────────────────────
  await page.getByTestId('ui2-rail-backtest').click();
  await expect(page.getByTestId('backtest-ui2-page')).toBeVisible();
  await expect(page.getByTestId('backtest-header')).toBeVisible();
  await page.waitForTimeout(PAUSE);

  // Runs Manager tab
  await expect(page.getByTestId('backtest-runs-table')).toBeVisible();
  await page.waitForTimeout(PAUSE);

  // Filter by symbol
  await page.getByTestId('backtest-filter-symbol').fill('MSFT');
  await page.waitForTimeout(PAUSE);

  // Clear filter
  await page.getByTestId('backtest-filter-symbol').fill('');
  await page.waitForTimeout(PAUSE);

  // Open a report
  const openButtons = page.locator('[data-testid^="backtest-open-"]');
  await openButtons.first().click();
  await expect(page.getByTestId('backtest-report-content')).toBeVisible();
  await expect(page.getByTestId('backtest-report-results')).toBeVisible();
  await page.waitForTimeout(PAUSE);

  // New Run tab
  await page.getByTestId('backtest-tabs-tab-new-run').click();
  await expect(page.getByTestId('backtest-new-run-form')).toBeVisible();
  await page.waitForTimeout(PAUSE);

  // Submit a new run
  await page.getByTestId('backtest-new-symbol').selectOption('NVDA');
  await page.getByTestId('backtest-new-strategy').selectOption('strat-2');
  await page.getByTestId('backtest-new-months').selectOption('24');
  await page.waitForTimeout(PAUSE);

  await page.getByTestId('backtest-submit-btn').click();
  await expect(page.getByTestId('backtest-submit-result')).toBeVisible();
  const sharpe = await page.getByTestId('backtest-result-sharpe').textContent();
  console.log(`[TOUR] NVDA strat-2 Sharpe: ${sharpe}`);
  await page.waitForTimeout(PAUSE);

  // ── 5. Nav survey ───────────────────────────────────────────────────────────
  // Navigate through all core items to show scope freeze
  await page.getByTestId('ui2-rail-runs').click();
  await page.waitForTimeout(PAUSE);

  await page.getByTestId('ui2-rail-autopilot').click();
  await page.waitForTimeout(PAUSE);

  // Done
  console.log('[TOUR] Complete — all 4 core features demonstrated');
});
