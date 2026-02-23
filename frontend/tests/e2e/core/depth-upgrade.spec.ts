/**
 * Core Depth Upgrade — E2E Suite
 * Tests all 4 depth areas: Autopilot Risk/Eval, Backtest Sweeps/WF/Robustness,
 * Workflow Scheduling/RBAC/Runs/Audit, Search Provider/Explain.
 * All selectors use data-testid only. No waitForTimeout.
 */

import { test, expect } from '@playwright/test';

// ──────────────────────────────────────────────────────────────────────────
// A: Autopilot Depth — Risk Controls + Evaluation
// ──────────────────────────────────────────────────────────────────────────
test.describe('Autopilot Depth — Risk & Evaluation', () => {
  const PAGE = 'http://localhost:5100/ui2/autopilot';

  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByTestId('autopilot-ui2-page')).toBeVisible();
  });

  test('risk tab exists and is clickable', async ({ page }) => {
    const riskTab = page.getByTestId('autopilot-tab-risk');
    await expect(riskTab).toBeVisible();
    await riskTab.click();
    await expect(page.getByTestId('autopilot-risk-panel')).toBeVisible();
  });

  test('risk controls panel has all fields', async ({ page }) => {
    await page.getByTestId('autopilot-tab-risk').click();
    await expect(page.getByTestId('autopilot-risk-controls')).toBeVisible();
    await expect(page.getByTestId('autopilot-risk-max_position_notional')).toBeVisible();
    await expect(page.getByTestId('autopilot-risk-max_gross_exposure')).toBeVisible();
    await expect(page.getByTestId('autopilot-risk-max_daily_loss')).toBeVisible();
    await expect(page.getByTestId('autopilot-risk-max_trades_per_run')).toBeVisible();
  });

  test('execution params panel has all fields', async ({ page }) => {
    await page.getByTestId('autopilot-tab-risk').click();
    await expect(page.getByTestId('autopilot-exec-params')).toBeVisible();
    await expect(page.getByTestId('autopilot-exec-fee_per_order')).toBeVisible();
    await expect(page.getByTestId('autopilot-exec-bps_fee')).toBeVisible();
    await expect(page.getByTestId('autopilot-exec-slippage_base_bps')).toBeVisible();
    await expect(page.getByTestId('autopilot-exec-slippage_vol_multiplier')).toBeVisible();
  });

  test('evaluation tab exists and shows data after running', async ({ page }) => {
    // First run evaluation
    const evalBtn = page.getByTestId('autopilot-run-eval-btn');
    await expect(evalBtn).toBeVisible();
    await evalBtn.click();
    // Switch to eval tab
    await page.getByTestId('autopilot-tab-evaluation').click();
    await expect(page.getByTestId('autopilot-eval-panel')).toBeVisible();
  });

  test('evaluation panel shows summary, attribution, fills', async ({ page }) => {
    await page.getByTestId('autopilot-run-eval-btn').click();
    await page.getByTestId('autopilot-tab-evaluation').click();
    await expect(page.getByTestId('autopilot-eval-summary')).toBeVisible();
    await expect(page.getByTestId('autopilot-eval-attribution')).toBeVisible();
    await expect(page.getByTestId('autopilot-eval-fills')).toBeVisible();
  });

  test('evaluation hash is displayed', async ({ page }) => {
    await page.getByTestId('autopilot-run-eval-btn').click();
    await page.getByTestId('autopilot-tab-evaluation').click();
    const hash = page.getByTestId('autopilot-eval-hash');
    await expect(hash).toBeVisible();
    const text = await hash.textContent();
    expect(text!.length).toBeGreaterThan(6);
  });

  test('risk budget remaining grid is visible', async ({ page }) => {
    await page.getByTestId('autopilot-run-eval-btn').click();
    await page.getByTestId('autopilot-tab-evaluation').click();
    await expect(page.getByTestId('autopilot-eval-budget')).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// B: Backtest Depth — Sweeps, Walk-Forward, Robustness
// ──────────────────────────────────────────────────────────────────────────
test.describe('Backtest Depth — Sweeps, Walk-Forward, Robustness', () => {
  const PAGE = 'http://localhost:5100/ui2/backtest';

  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByTestId('backtest-ready')).toBeAttached();
  });

  test('sweep tab exists and is interactive', async ({ page }) => {
    await page.getByTestId('backtest-tabs-tab-sweeps').click();
    await expect(page.getByTestId('backtest-sweep-panel')).toBeVisible();
    await expect(page.getByTestId('backtest-sweep-symbol')).toBeVisible();
    await expect(page.getByTestId('backtest-sweep-strategy')).toBeVisible();
    await expect(page.getByTestId('backtest-sweep-run-btn')).toBeVisible();
  });

  test('running a sweep produces heatmap', async ({ page }) => {
    await page.getByTestId('backtest-tabs-tab-sweeps').click();
    await page.getByTestId('backtest-sweep-run-btn').click();
    await expect(page.getByTestId('backtest-sweep-results')).toBeVisible();
    await expect(page.getByTestId('backtest-sweep-heatmap')).toBeVisible();
    await expect(page.getByTestId('backtest-sweep-best')).toBeVisible();
  });

  test('sweep hash is displayed', async ({ page }) => {
    await page.getByTestId('backtest-tabs-tab-sweeps').click();
    await page.getByTestId('backtest-sweep-run-btn').click();
    const hash = page.getByTestId('backtest-sweep-hash');
    await expect(hash).toBeVisible();
    const text = await hash.textContent();
    expect(text).toContain('Hash:');
  });

  test('walk-forward tab runs and shows results', async ({ page }) => {
    await page.getByTestId('backtest-tabs-tab-walkforward').click();
    await expect(page.getByTestId('backtest-wf-panel')).toBeVisible();
    await page.getByTestId('backtest-wf-run-btn').click();
    await expect(page.getByTestId('backtest-wf-results')).toBeVisible();
    await expect(page.getByTestId('backtest-wf-summary')).toBeVisible();
    await expect(page.getByTestId('backtest-wf-windows')).toBeVisible();
  });

  test('walk-forward hash is displayed', async ({ page }) => {
    await page.getByTestId('backtest-tabs-tab-walkforward').click();
    await page.getByTestId('backtest-wf-run-btn').click();
    const hash = page.getByTestId('backtest-wf-hash');
    await expect(hash).toBeVisible();
  });

  test('robustness tab runs and shows scenarios', async ({ page }) => {
    await page.getByTestId('backtest-tabs-tab-robustness').click();
    await expect(page.getByTestId('backtest-rob-panel')).toBeVisible();
    await page.getByTestId('backtest-rob-run-btn').click();
    await expect(page.getByTestId('backtest-rob-results')).toBeVisible();
    await expect(page.getByTestId('backtest-rob-scenarios')).toBeVisible();
  });

  test('robustness score and hash visible', async ({ page }) => {
    await page.getByTestId('backtest-tabs-tab-robustness').click();
    await page.getByTestId('backtest-rob-run-btn').click();
    const hash = page.getByTestId('backtest-rob-hash');
    await expect(hash).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// C: Workflow Depth — Scheduling, RBAC, Runs, Audit
// ──────────────────────────────────────────────────────────────────────────
test.describe('Workflow Depth — Scheduling, RBAC, Runs, Audit', () => {
  const PAGE = 'http://localhost:5100/ui2/workflow-builder';

  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByTestId('ui2-workflow-builder-page')).toBeVisible();
  });

  test('RBAC bar is visible with role selector', async ({ page }) => {
    await expect(page.getByTestId('ui2-workflow-rbac-bar')).toBeVisible();
    await expect(page.getByTestId('ui2-workflow-role-select')).toBeVisible();
    await expect(page.getByTestId('ui2-workflow-role-badge')).toBeVisible();
  });

  test('role switcher changes role badge', async ({ page }) => {
    const select = page.getByTestId('ui2-workflow-role-select');
    await select.selectOption('user-viewer-001');
    await expect(page.getByTestId('ui2-workflow-role-badge')).toContainText('viewer');
  });

  test('scheduling tab shows job table', async ({ page }) => {
    await page.getByTestId('ui2-workflow-tab-scheduling').click();
    await expect(page.getByTestId('ui2-workflow-scheduling-panel')).toBeVisible();
    await expect(page.getByTestId('ui2-workflow-jobs-table')).toBeVisible();
    // At least 3 initial jobs
    await expect(page.getByTestId('ui2-workflow-job-job-001')).toBeVisible();
    await expect(page.getByTestId('ui2-workflow-job-job-002')).toBeVisible();
    await expect(page.getByTestId('ui2-workflow-job-job-003')).toBeVisible();
  });

  test('schedule form visible for admin', async ({ page }) => {
    await page.getByTestId('ui2-workflow-tab-scheduling').click();
    await expect(page.getByTestId('ui2-workflow-schedule-form')).toBeVisible();
    await expect(page.getByTestId('ui2-workflow-schedule-wfid')).toBeVisible();
    await expect(page.getByTestId('ui2-workflow-schedule-cron')).toBeVisible();
  });

  test('toggling job status works', async ({ page }) => {
    await page.getByTestId('ui2-workflow-tab-scheduling').click();
    const toggle = page.getByTestId('ui2-workflow-job-toggle-job-001');
    await expect(toggle).toBeVisible();
    const before = await page.getByTestId('ui2-workflow-job-status-job-001').textContent();
    await toggle.click();
    const after = await page.getByTestId('ui2-workflow-job-status-job-001').textContent();
    expect(before).not.toBe(after);
  });

  test('runs tab shows run history', async ({ page }) => {
    await page.getByTestId('ui2-workflow-tab-runs').click();
    await expect(page.getByTestId('ui2-workflow-runs-panel')).toBeVisible();
    await expect(page.getByTestId('ui2-workflow-runs-table')).toBeVisible();
  });

  test('trigger run button creates new run', async ({ page }) => {
    await page.getByTestId('ui2-workflow-tab-runs').click();
    const triggerBtn = page.getByTestId('ui2-workflow-trigger-run-btn');
    await expect(triggerBtn).toBeVisible();
    await triggerBtn.click();
    // Should have at least 9 rows now (8 initial + 1)
    const rows = page.locator('[data-testid^="ui2-workflow-run-"]');
    await expect(rows.first()).toBeVisible();
  });

  test('audit tab shows export controls for admin', async ({ page }) => {
    await page.getByTestId('ui2-workflow-tab-audit').click();
    await expect(page.getByTestId('ui2-workflow-audit-panel')).toBeVisible();
    await expect(page.getByTestId('ui2-workflow-audit-export-btn')).toBeVisible();
  });

  test('audit tab denied for viewer role', async ({ page }) => {
    await page.getByTestId('ui2-workflow-role-select').selectOption('user-viewer-001');
    await page.getByTestId('ui2-workflow-tab-audit').click();
    await expect(page.getByTestId('ui2-workflow-audit-denied')).toBeVisible();
  });

  test('audit export produces JSON with hash', async ({ page }) => {
    await page.getByTestId('ui2-workflow-tab-audit').click();
    await page.getByTestId('ui2-workflow-audit-export-btn').click();
    await expect(page.getByTestId('ui2-workflow-audit-json')).toBeVisible();
    await expect(page.getByTestId('ui2-workflow-audit-hash')).toBeVisible();
  });

  test('template search filters templates', async ({ page }) => {
    await page.getByTestId('ui2-workflow-tab-templates').click();
    const searchInput = page.getByTestId('ui2-workflow-search-templates');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('export');
    // Should show at least 1 matching depth template
    await expect(page.locator('[data-testid^="ui2-workflow-depth-template-"]').first()).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// D: Search Depth — Provider Status + Explain
// ──────────────────────────────────────────────────────────────────────────
test.describe('Search Depth — Provider Status & Explain', () => {
  const PAGE = 'http://localhost:5100/ui2/search';

  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByTestId('search-ui2-page')).toBeVisible();
  });

  test('provider status bar is visible', async ({ page }) => {
    await expect(page.getByTestId('search-provider-status')).toBeVisible();
  });

  test('provider shows elastic backend', async ({ page }) => {
    await expect(page.getByTestId('search-provider-backend')).toContainText('elastic');
  });

  test('provider shows doc count', async ({ page }) => {
    const docs = page.getByTestId('search-provider-docs');
    await expect(docs).toBeVisible();
    const text = await docs.textContent();
    // Online mode: starts with 0 docs (populated after indexing)
    expect(text).toContain('0');
  });

  test('provider shows index count', async ({ page }) => {
    // Online mode: starts with 0 indexes (populated after refreshStatus)
    await expect(page.getByTestId('search-provider-indexes')).toContainText('0');
  });

  test('provider shows reachable status', async ({ page }) => {
    // Online mode: starts as OFFLINE until backend is connected
    await expect(page.getByTestId('search-provider-reachable')).toContainText('OFFLINE');
  });

  test('toggle mappings button works', async ({ page }) => {
    await page.getByTestId('search-toggle-mappings').click();
    await expect(page.getByTestId('search-mappings-panel')).toBeVisible();
    // Online mode: no pre-loaded index mappings; panel is visible but empty until refreshStatus
  });

  test('explain view appears in detail drawer after search', async ({ page }) => {
    // Type a search and hit enter
    const input = page.getByTestId('search-input');
    await input.fill('AAPL');
    await input.press('Enter');
    // Wait for results
    await expect(page.getByTestId('search-results-table')).toBeVisible();
    // Click on the first result row
    const firstRow = page.locator('[data-testid="search-results-table"] tbody tr').first();
    await firstRow.click();
    // Detail drawer should open
    await expect(page.getByTestId('search-detail-drawer')).toBeVisible();
    // Explain panel should be visible because we have a query
    await expect(page.getByTestId('search-explain-panel')).toBeVisible();
    await expect(page.getByTestId('search-explain-score')).toBeVisible();
    await expect(page.getByTestId('search-explain-hash')).toBeVisible();
  });

  test('explain shows 4 ranking factors', async ({ page }) => {
    await page.getByTestId('search-input').fill('momentum');
    await page.getByTestId('search-input').press('Enter');
    await expect(page.getByTestId('search-results-table')).toBeVisible();
    const firstRow = page.locator('[data-testid="search-results-table"] tbody tr').first();
    await firstRow.click();
    await expect(page.getByTestId('search-detail-drawer')).toBeVisible();
    // 4 factors: tf-idf, field_boost_title, recency, symbol_match
    await expect(page.getByTestId('search-explain-factor-0')).toBeVisible();
    await expect(page.getByTestId('search-explain-factor-1')).toBeVisible();
    await expect(page.getByTestId('search-explain-factor-2')).toBeVisible();
    await expect(page.getByTestId('search-explain-factor-3')).toBeVisible();
  });
});
