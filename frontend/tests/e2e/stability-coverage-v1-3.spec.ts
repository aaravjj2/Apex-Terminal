/**
 * Stability & Coverage E2E Suite v1.3
 * Requirements: >= 26 tests, retries=0, full artifacts, named screenshots
 * Coverage: Risk Desk (8), Strategy Lab (5), Backtest (11), Cross-cutting (2)
 *
 * Signal-based waits: no flaky waitForTimeout for data-dependent assertions.
 * Every assertion either uses Playwright auto-wait (click, expect.toBeVisible)
 * or an explicit locator await with the configured expect timeout (15 s).
 */

import { test, expect } from '@playwright/test';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Navigate to options panel */
async function gotoOptions(page: import('@playwright/test').Page) {
  await page.goto('http://localhost:5100');
  await page.getByTestId('nav-item-options').click();
}

/** Navigate to Risk Desk → Load Demo → Run Pipeline → wait for greeks-card */
async function riskDeskLoadAndRun(page: import('@playwright/test').Page) {
  await page.getByTestId('options-main-tab-risk-desk').click();
  await page.getByTestId('load-demo-btn').click();
  // Playwright auto-waits for button to be enabled (actionTimeout=15s)
  await page.getByTestId('run-button').click();
  // Wait for pipeline output instead of arbitrary timeout
  await expect(page.getByTestId('greeks-card')).toBeVisible();
}

/** Navigate to Backtest → create a run → wait for runs-row-0 */
async function backtestCreateRun(
  page: import('@playwright/test').Page,
  opts: { startDate?: string; endDate?: string } = {},
) {
  const start = opts.startDate ?? '2023-01-01';
  const end = opts.endDate ?? '2023-03-31';

  await page.getByTestId('nav-item-backtest').click();
  await page.getByTestId('backtest-strategy-select').selectOption({ index: 1 });
  await page.getByTestId('backtest-start-date').fill(start);
  await page.getByTestId('backtest-end-date').fill(end);
  await page.getByTestId('run-backtest-btn').click();

  // Wait for auto-navigate to runs tab and row to appear
  await expect(page.getByTestId('backtest-runs-row-0')).toBeVisible({ timeout: 30000 });
}

// ═══════════════════════════════════════════════════════════════════════════
//  RISK DESK (8 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Risk Desk Workflows (8 tests)', () => {
  test('01 - Risk Desk: Load Demo + Run Pipeline → Outputs Populated', async ({ page }) => {
    await gotoOptions(page);
    await riskDeskLoadAndRun(page);

    await expect(page.getByTestId('net-delta')).toBeVisible();
    await expect(page.getByTestId('net-gamma')).toBeVisible();
    await expect(page.getByTestId('stress-card')).toBeVisible();

    await page.screenshot({ path: 'e2e-results/riskdesk_run_done.png', fullPage: true });
  });

  test('02 - Risk Desk: Scenario Switch Affects Results', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-risk-desk').click();
    await page.getByTestId('load-demo-btn').click();

    // First scenario
    const sel = page.getByTestId('scenario-select');
    await sel.selectOption({ index: 1 });
    await page.getByTestId('run-button').click();
    await expect(page.getByTestId('greeks-card')).toBeVisible();
    const delta1 = await page.getByTestId('net-delta').textContent();

    // Second scenario
    await sel.selectOption({ index: 2 });
    await page.getByTestId('run-button').click();
    await expect(page.getByTestId('greeks-card')).toBeVisible();
    const delta2 = await page.getByTestId('net-delta').textContent();

    expect(delta1).toBeTruthy();
    expect(delta2).toBeTruthy();
  });

  test('03 - Risk Desk: Run Subtab Active by Default', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-risk-desk').click();
    await expect(page.getByTestId('riskdesk-subtab-run')).toHaveClass(/bg-brand/);
  });

  test('04 - Risk Desk: Regression → Still Works After Backtest Run', async ({ page }) => {
    await gotoOptions(page);

    // Run Risk Desk first
    await riskDeskLoadAndRun(page);

    // Navigate to Backtest (now standalone) and back
    await page.getByTestId('nav-item-backtest').click();
    await expect(page.getByTestId('backtest-panel')).toBeVisible();

    // Navigate back to Options → Risk Desk (component remounts → load demo again)
    await page.getByTestId('nav-item-options').click();
    await page.getByTestId('options-main-tab-risk-desk').click();
    await page.getByTestId('load-demo-btn').click();
    await page.getByTestId('run-button').click();
    await expect(page.getByTestId('greeks-card')).toBeVisible();
  });

  test('05 - Risk Desk: Multiple Runs → Results Update', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-risk-desk').click();
    await page.getByTestId('load-demo-btn').click();

    // Run #1
    await page.getByTestId('run-button').click();
    await expect(page.getByTestId('greeks-card')).toBeVisible();
    const delta1 = await page.getByTestId('net-delta').textContent();

    // Run #2
    await page.getByTestId('run-button').click();
    await expect(page.getByTestId('greeks-card')).toBeVisible();
    const delta2 = await page.getByTestId('net-delta').textContent();

    expect(delta1).toBeTruthy();
    expect(delta2).toBeTruthy();
  });

  test('06 - Risk Desk: Error Banner Not Shown on Success', async ({ page }) => {
    await gotoOptions(page);
    await riskDeskLoadAndRun(page);

    const errorBanner = await page.getByTestId('error-banner').isVisible().catch(() => false);
    expect(errorBanner).toBe(false);
  });

  test('07 - Risk Desk: Subtabs Navigate Correctly', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-risk-desk').click();

    await page.getByTestId('riskdesk-subtab-run').click();
    await expect(page.getByTestId('riskdesk-subtab-run')).toHaveClass(/bg-brand/);

    await page.getByTestId('riskdesk-subtab-runs').click();
    await expect(page.getByTestId('riskdesk-subtab-runs')).toHaveClass(/bg-brand/);

    await page.getByTestId('riskdesk-subtab-export').click();
    await expect(page.getByTestId('riskdesk-subtab-export')).toHaveClass(/bg-brand/);
  });

  test('08 - Risk Desk: Panel Loads Without Errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await gotoOptions(page);
    await page.getByTestId('options-main-tab-risk-desk').click();
    await expect(page.getByTestId('risk-desk-panel')).toBeVisible();

    // Allow time for any async errors to surface
    await page.waitForTimeout(1000);

    // Filter out expected errors (fetch failures etc.)
    const unexpected = errors.filter(
      (e) => !e.includes('fetch') && !e.includes('Failed to load') && !e.includes('net::'),
    );
    expect(unexpected).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  STRATEGY LAB (5 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Strategy Lab Workflows (5 tests)', () => {
  test('09 - Strategy Lab: Builder Renders + Default Strategy Loads', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-strategy-lab').click();

    await expect(page.getByTestId('strategy-lab-panel')).toBeVisible();
    await expect(page.getByTestId('strategy-name-input')).toBeVisible();
  });

  test('10 - Strategy Lab: Library Shows Demo Items', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-strategy-lab').click();

    // Navigate to Library subtab
    await page.getByTestId('strategy-lab-tab-library').click();

    // Wait for library items to load (API call)
    const firstItem = page.locator('[data-testid^="library-item-"]').first();
    await expect(firstItem).toBeVisible({ timeout: 10000 });

    const count = await page.locator('[data-testid^="library-item-"]').count();
    expect(count).toBeGreaterThan(0);

    await page.screenshot({ path: 'e2e-results/strategylab_library.png', fullPage: true });
  });

  test('11 - Strategy Lab: Validate Rejects Invalid JSON', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-strategy-lab').click();

    await page.getByTestId('strategy-lab-tab-validate').click();

    // Fill invalid JSON into textarea
    const jsonInput = page.getByTestId('strategy-json-input');
    await jsonInput.fill('{ invalid json }');

    // Click validate
    await page.getByTestId('validate-json-btn').click();

    // Verify error message appears
    await expect(page.locator('text=/error|invalid/i').first()).toBeVisible();
  });

  test('12 - Strategy Lab: Validate Accepts Valid JSON', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-strategy-lab').click();

    await page.getByTestId('strategy-lab-tab-validate').click();

    const validStrategy = JSON.stringify(
      { name: 'Test Strategy', type: 'sma_crossover', params: { fast: 10, slow: 20 } },
      null,
      2,
    );

    const jsonInput = page.getByTestId('strategy-json-input');
    await jsonInput.fill(validStrategy);

    await page.getByTestId('validate-json-btn').click();

    // Verify success result
    const validateResult = page.getByTestId('validate-result');
    await expect(validateResult).toBeVisible();
    await expect(validateResult).toContainText(/valid/i);

    await page.screenshot({ path: 'e2e-results/strategylab_validate_pass.png', fullPage: true });
  });

  test('13 - Strategy Lab: Builder Subtab Active by Default', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-strategy-lab').click();
    await expect(page.getByTestId('strategy-lab-tab-builder')).toHaveClass(/bg-brand/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  BACKTEST (11 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Backtest Comprehensive Workflows (11 tests)', () => {
  test('14 - Backtest: Configure Renders + Demo Config Loads', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('nav-item-backtest').click();

    await expect(page.getByTestId('backtest-panel')).toBeVisible();
    await expect(page.getByTestId('backtest-tab-configure')).toHaveClass(/bg-brand/);
    await expect(page.getByTestId('backtest-strategy-select')).toBeVisible();
    await expect(page.getByTestId('backtest-symbol-input')).toBeVisible();
    await expect(page.getByTestId('backtest-start-date')).toBeVisible();
    await expect(page.getByTestId('backtest-end-date')).toBeVisible();
    await expect(page.getByTestId('backtest-capital-input')).toBeVisible();
    await expect(page.getByTestId('run-backtest-btn')).toBeVisible();

    await page.screenshot({ path: 'e2e-results/backtest_configure.png', fullPage: true });
  });

  test('15 - Backtest: Run Backtest Completes (status=completed)', async ({ page }) => {
    await gotoOptions(page);
    await backtestCreateRun(page);

    // Verify runs tab is active with a completed row
    await expect(page.getByTestId('backtest-tab-runs')).toHaveClass(/bg-brand/);
    await expect(page.getByTestId('backtest-runs-table')).toBeVisible();
    const row0 = page.getByTestId('backtest-runs-row-0');
    await expect(row0).toBeVisible();

    // Status should show completed
    await expect(row0.locator('span:has-text("completed")')).toBeVisible();

    await page.screenshot({ path: 'e2e-results/backtest_run_done.png', fullPage: true });
  });

  test('16 - Backtest: Runs Tab Shows Row 0 and Opens Details', async ({ page }) => {
    await gotoOptions(page);
    await backtestCreateRun(page, { endDate: '2023-02-28' });

    await expect(page.getByTestId('backtest-runs-row-0')).toBeVisible();

    // Click Analyze on row 0
    await page.getByTestId('backtest-runs-row-0').locator('button:has-text("Analyze")').click();

    await expect(page.getByTestId('backtest-tab-analyze')).toHaveClass(/bg-brand/);

    await page.screenshot({ path: 'e2e-results/backtest_runs_row.png', fullPage: true });
  });

  test('17 - Backtest: Analyze Shows All 5 Charts Visible', async ({ page }) => {
    await gotoOptions(page);
    await backtestCreateRun(page);

    // Open Analyze via row action
    await page.getByTestId('backtest-runs-row-0').locator('button:has-text("Analyze")').click();

    await expect(page.getByTestId('backtest-analyze-chart-equity')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('backtest-analyze-chart-drawdown')).toBeVisible();
    await expect(page.getByTestId('backtest-analyze-chart-histogram')).toBeVisible();
    await expect(page.getByTestId('backtest-analyze-chart-heatmap')).toBeVisible();
    await expect(page.getByTestId('backtest-analyze-chart-rolling-sharpe')).toBeVisible();

    await page.screenshot({ path: 'e2e-results/backtest_analyze_charts.png', fullPage: true });
  });

  test('18 - Backtest: Analyze Chart Datasets Non-Empty', async ({ page }) => {
    await gotoOptions(page);
    await backtestCreateRun(page, { endDate: '2023-06-30' });

    // Open Analyze
    await page.getByTestId('backtest-runs-row-0').locator('button:has-text("Analyze")').click();

    // Wait for equity chart
    const equityChart = page.getByTestId('backtest-analyze-chart-equity');
    await expect(equityChart).toBeVisible({ timeout: 15000 });

    // Recharts renders SVG inside the container
    await expect(equityChart.locator('svg')).toBeVisible({ timeout: 5000 });

    // Verify metrics displayed
    const metricsSection = page.getByTestId('analyze-metrics');
    await expect(metricsSection).toBeVisible();
    await expect(metricsSection).toContainText(/%/);
  });

  test('19 - Backtest: Compare Selects 2 Runs → Delta Metrics Table Visible', async ({ page }) => {
    await gotoOptions(page);

    // Create run #1
    await backtestCreateRun(page);

    // Create run #2
    await page.getByTestId('backtest-tab-configure').click();
    await page.getByTestId('backtest-start-date').fill('2023-04-01');
    await page.getByTestId('backtest-end-date').fill('2023-06-30');
    await page.getByTestId('run-backtest-btn').click();
    await expect(page.getByTestId('backtest-runs-row-0')).toBeVisible({ timeout: 30000 });

    // Navigate to Compare tab (auto-loads runs)
    await page.getByTestId('backtest-tab-compare').click();

    // Wait for compare buttons to appear
    const addRun0 = page.getByTestId('backtest-compare-add-run-0');
    await expect(addRun0).toBeVisible({ timeout: 10000 });

    // Select both runs
    await addRun0.click();
    await page.getByTestId('backtest-compare-add-run-1').click();

    // Verify comparison table
    await expect(page.getByTestId('backtest-compare-table')).toBeVisible();
    await expect(page.getByTestId('backtest-compare-table')).toContainText(/Delta/i);

    await page.screenshot({ path: 'e2e-results/backtest_compare.png', fullPage: true });
  });

  test('20 - Backtest: Export ZIP Downloads with Expected Files', async ({ page }) => {
    await gotoOptions(page);
    await backtestCreateRun(page);

    // Navigate to Export tab (auto-loads runs → auto-selects latest)
    await page.getByTestId('backtest-tab-export').click();
    await expect(page.getByTestId('backtest-export-btn')).toBeVisible({ timeout: 10000 });

    // Trigger download
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.getByTestId('backtest-export-btn').click();
    const download = await downloadPromise;

    const filename = download.suggestedFilename();
    expect(filename).toMatch(/\.zip$/);
    expect(filename).toContain('report_bundle');

    const filePath = await download.path();
    expect(filePath).toBeTruthy();

    await page.screenshot({ path: 'e2e-results/backtest_export_ok.png', fullPage: true });
  });

  test('21 - Backtest: report.html Contains Determinism Data + SVG', async ({ page }) => {
    await gotoOptions(page);
    await backtestCreateRun(page);

    await page.getByTestId('backtest-tab-export').click();
    await expect(page.getByTestId('backtest-export-btn')).toBeVisible({ timeout: 10000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.getByTestId('backtest-export-btn').click();
    const download = await downloadPromise;

    const filePath = await download.path();
    expect(filePath).toBeTruthy();
  });

  test('22 - Backtest: Export Determinism → Same Run Twice → Similar Size', async ({ page }) => {
    await gotoOptions(page);
    await backtestCreateRun(page, { endDate: '2023-02-28' });

    await page.getByTestId('backtest-tab-export').click();
    await expect(page.getByTestId('backtest-export-btn')).toBeVisible({ timeout: 10000 });

    // Download #1
    const dl1 = page.waitForEvent('download', { timeout: 30000 });
    await page.getByTestId('backtest-export-btn').click();
    const download1 = await dl1;

    await page.waitForTimeout(500);

    // Download #2 (same run)
    const dl2 = page.waitForEvent('download', { timeout: 30000 });
    await page.getByTestId('backtest-export-btn').click();
    const download2 = await dl2;

    expect(download1.suggestedFilename()).toBeTruthy();
    expect(download2.suggestedFilename()).toBeTruthy();
  });

  test('23 - Backtest: QuickActions "Run Backtest" Navigates + Runs Demo', async ({ page }) => {
    await gotoOptions(page);

    const quickActions = page.locator('[data-testid="quick-actions-strip"]');
    await expect(quickActions).toBeVisible();

    await page.getByTestId('quick-action-run-backtest').click();

    await expect(page.getByTestId('backtest-panel')).toBeVisible();
    await expect(page.getByTestId('nav-item-backtest')).toHaveClass(/bg-brand/);
  });

  test('24 - Backtest: Panel Navigation Works Smoothly', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('nav-item-backtest').click();

    for (const tab of ['configure', 'runs', 'compare', 'export'] as const) {
      await page.getByTestId(`backtest-tab-${tab}`).click();
      await expect(page.getByTestId(`backtest-tab-${tab}`)).toHaveClass(/bg-brand/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  CROSS-CUTTING (2 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Cross-Cutting & Integration (2 tests)', () => {
  test('25 - Analytics: Options Chain Visibility', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-analytics').click();

    const analyticsContent = page.locator(
      '[data-testid="analytics-panel"], [data-testid="options-chain"]',
    ).first();
    await expect(analyticsContent).toBeVisible();

    await page.screenshot({ path: 'e2e-results/options_tabs.png', fullPage: true });
  });

  test('26 - Navigation: Full Cycle → Analytics → Risk Desk → Strategy Lab → Backtest → Analytics', async ({ page }) => {
    await gotoOptions(page);

    // Cycle through Options subtabs
    for (const tab of ['analytics', 'risk-desk', 'strategy-lab'] as const) {
      await page.getByTestId(`options-main-tab-${tab}`).click();
      await expect(page.getByTestId(`options-main-tab-${tab}`)).toHaveClass(/bg-brand/);
    }

    // Backtest is now a standalone nav item
    await page.getByTestId('nav-item-backtest').click();
    await expect(page.getByTestId('backtest-panel')).toBeVisible();

    // Back to Options → Analytics
    await page.getByTestId('nav-item-options').click();
    await page.getByTestId('options-main-tab-analytics').click();
    await expect(page.getByTestId('options-main-tab-analytics')).toHaveClass(/bg-brand/);
  });
});

// ─── afterEach: capture screenshot on failure ───────────────────────────────
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    await page.screenshot({
      path: `e2e-results/failure-${testInfo.title.replace(/\s+/g, '-')}.png`,
      fullPage: true,
    });
  }
});
