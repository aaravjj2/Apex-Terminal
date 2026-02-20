/**
 * Core Depth Upgrade — TOUR Video Recording
 * Walks through all 4 depth areas sequentially for a ≥3 min TOUR.webm
 * Single test file — runs as one continuous video.
 */

import { test, expect } from '@playwright/test';

test.describe('DEPTH UPGRADE TOUR', () => {
  test('Full depth tour across all 4 core areas', async ({ page }) => {
    // Helper: pause so the video shows the section
    const pause = (ms: number) => page.waitForTimeout(ms);

    // ================================================================
    // SECTION 1: Autopilot — Risk Controls + Evaluation
    // ================================================================
    await page.goto('http://localhost:5100/ui2/autopilot');
    await expect(page.getByTestId('autopilot-ui2-page')).toBeVisible();
    await pause(2000);

    // Navigate to Risk Controls tab
    await page.getByTestId('autopilot-tab-risk').click();
    await expect(page.getByTestId('autopilot-risk-panel')).toBeVisible();
    await pause(2000);

    // Show risk controls fields
    await expect(page.getByTestId('autopilot-risk-controls')).toBeVisible();
    await expect(page.getByTestId('autopilot-exec-params')).toBeVisible();
    await pause(2000);

    // Modify a risk control value
    const riskInput = page.getByTestId('autopilot-risk-input-max_daily_loss');
    if (await riskInput.isVisible()) {
      await riskInput.fill('8000');
      await pause(1000);
    }

    // Run Evaluation
    await page.getByTestId('autopilot-run-eval-btn').click();
    await pause(1000);

    // Navigate to Evaluation tab
    await page.getByTestId('autopilot-tab-evaluation').click();
    await expect(page.getByTestId('autopilot-eval-panel')).toBeVisible();
    await pause(2000);

    // Show evaluation details
    await expect(page.getByTestId('autopilot-eval-summary')).toBeVisible();
    await expect(page.getByTestId('autopilot-eval-attribution')).toBeVisible();
    await expect(page.getByTestId('autopilot-eval-fills')).toBeVisible();
    await expect(page.getByTestId('autopilot-eval-hash')).toBeVisible();
    await pause(3000);

    // ================================================================
    // SECTION 2: Backtester — Sweeps, Walk-Forward, Robustness
    // ================================================================
    await page.goto('http://localhost:5100/ui2/backtest');
    await expect(page.getByTestId('backtest-ready')).toBeAttached();
    await pause(2000);

    // Param Sweep tab
    await page.getByTestId('backtest-tabs-tab-sweeps').click();
    await expect(page.getByTestId('backtest-sweep-panel')).toBeVisible();
    await pause(1500);

    // Run sweep
    await page.getByTestId('backtest-sweep-run-btn').click();
    await expect(page.getByTestId('backtest-sweep-results')).toBeVisible();
    await expect(page.getByTestId('backtest-sweep-heatmap')).toBeVisible();
    await pause(3000);

    // Walk-Forward tab
    await page.getByTestId('backtest-tabs-tab-walkforward').click();
    await expect(page.getByTestId('backtest-wf-panel')).toBeVisible();
    await pause(1500);

    // Run walk-forward
    await page.getByTestId('backtest-wf-run-btn').click();
    await expect(page.getByTestId('backtest-wf-results')).toBeVisible();
    await expect(page.getByTestId('backtest-wf-summary')).toBeVisible();
    await pause(3000);

    // Robustness tab
    await page.getByTestId('backtest-tabs-tab-robustness').click();
    await expect(page.getByTestId('backtest-rob-panel')).toBeVisible();
    await pause(1500);

    // Run robustness
    await page.getByTestId('backtest-rob-run-btn').click();
    await expect(page.getByTestId('backtest-rob-results')).toBeVisible();
    await expect(page.getByTestId('backtest-rob-scenarios')).toBeVisible();
    await pause(3000);

    // ================================================================
    // SECTION 3: Workflow Builder — RBAC, Scheduling, Runs, Audit
    // ================================================================
    await page.goto('http://localhost:5100/ui2/workflow-builder');
    await expect(page.getByTestId('ui2-workflow-builder-page')).toBeVisible();
    await pause(2000);

    // Show RBAC bar
    await expect(page.getByTestId('ui2-workflow-rbac-bar')).toBeVisible();
    await pause(1500);

    // Templates tab with search
    await page.getByTestId('ui2-workflow-tab-templates').click();
    await pause(1500);
    const searchInput = page.getByTestId('ui2-workflow-search-templates');
    if (await searchInput.isVisible()) {
      await searchInput.fill('export');
      await pause(1500);
      await searchInput.clear();
      await pause(500);
    }

    // Scheduling tab
    await page.getByTestId('ui2-workflow-tab-scheduling').click();
    await expect(page.getByTestId('ui2-workflow-scheduling-panel')).toBeVisible();
    await expect(page.getByTestId('ui2-workflow-jobs-table')).toBeVisible();
    await pause(3000);

    // Toggle a job
    const toggle = page.getByTestId('ui2-workflow-job-toggle-job-001');
    if (await toggle.isVisible()) {
      await toggle.click();
      await pause(1000);
    }

    // Runs tab
    await page.getByTestId('ui2-workflow-tab-runs').click();
    await expect(page.getByTestId('ui2-workflow-runs-panel')).toBeVisible();
    await expect(page.getByTestId('ui2-workflow-runs-table')).toBeVisible();
    await pause(2000);

    // Trigger a run
    await page.getByTestId('ui2-workflow-trigger-run-btn').click();
    await pause(1500);

    // Audit tab
    await page.getByTestId('ui2-workflow-tab-audit').click();
    await expect(page.getByTestId('ui2-workflow-audit-panel')).toBeVisible();
    await pause(1500);

    // Export audit
    await page.getByTestId('ui2-workflow-audit-export-btn').click();
    await expect(page.getByTestId('ui2-workflow-audit-json')).toBeVisible();
    await expect(page.getByTestId('ui2-workflow-audit-hash')).toBeVisible();
    await pause(3000);

    // Switch to viewer role to show RBAC denied
    await page.getByTestId('ui2-workflow-role-select').selectOption('user-viewer-001');
    await pause(1000);
    await page.getByTestId('ui2-workflow-tab-audit').click();
    await expect(page.getByTestId('ui2-workflow-audit-denied')).toBeVisible();
    await pause(2000);

    // ================================================================
    // SECTION 4: Global Search — Provider Status + Explain
    // ================================================================
    await page.goto('http://localhost:5100/ui2/search');
    await expect(page.getByTestId('search-ui2-page')).toBeVisible();
    await pause(2000);

    // Provider status bar
    await expect(page.getByTestId('search-provider-status')).toBeVisible();
    await expect(page.getByTestId('search-provider-reachable')).toBeVisible();
    await pause(2000);

    // Toggle mappings
    await page.getByTestId('search-toggle-mappings').click();
    await expect(page.getByTestId('search-mappings-panel')).toBeVisible();
    await pause(3000);

    // Close mappings
    await page.getByTestId('search-toggle-mappings').click();
    await pause(500);

    // Search for something
    const input = page.getByTestId('search-input');
    await input.fill('AAPL');
    await input.press('Enter');
    await expect(page.getByTestId('search-results-table')).toBeVisible();
    await pause(2000);

    // Click first result to show explain view
    const firstRow = page.locator('[data-testid="search-results-table"] tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await expect(page.getByTestId('search-detail-drawer')).toBeVisible();
      await pause(1500);
      const explainPanel = page.getByTestId('search-explain-panel');
      if (await explainPanel.isVisible()) {
        await pause(3000);
      }
    }

    // Final hold
    await pause(2000);
  });
});
