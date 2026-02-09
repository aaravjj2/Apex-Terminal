/**
 * Strategy Lab + Backtest E2E Tests - FINAL VERSION
 * Uses ONLY stable data-testid selectors
 * CRITICAL: retries=0, must pass on first try
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5100';

test.describe('Strategy Lab + Backtest E2E Suite', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    // Wait for app to initialize
    await page.waitForSelector('[data-testid="nav-item-dashboard"]', { timeout: 10000 });
  });

  test('01 - Navigate to Options view', async ({ page }) => {
    // Click Options navigation
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(1000);
    
    // Verify we're in Options view by checking for main tabs
    await expect(page.getByTestId('options-main-tab-analytics')).toBeVisible();
    await expect(page.getByTestId('options-main-tab-risk-desk')).toBeVisible();
    await expect(page.getByTestId('options-main-tab-strategy-lab')).toBeVisible();
    // Backtest is now a standalone nav item, not an Options subtab
    await expect(page.getByTestId('nav-item-backtest')).toBeVisible();
    
    await page.screenshot({ path: 'e2e-results/01-options-view.png', fullPage: true });
  });

  test('02 - Strategy Lab tab renders with subtabs', async ({ page }) => {
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);
    
    // Click Strategy Lab main tab
    await page.getByTestId('options-main-tab-strategy-lab').click();
    await page.waitForTimeout(500);
    
    // Verify Strategy Lab panel and subtabs
    await expect(page.getByTestId('strategy-lab-panel')).toBeVisible();
    await expect(page.getByTestId('strategy-lab-tab-builder')).toBeVisible();
    await expect(page.getByTestId('strategy-lab-tab-library')).toBeVisible();
    await expect(page.getByTestId('strategy-lab-tab-validate')).toBeVisible();
    
    await page.screenshot({ path: 'e2e-results/02-strategy-lab-panel.png', fullPage: true });
  });

  test('03 - Strategy Lab Builder tab shows form elements', async ({ page }) => {
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);
    await page.getByTestId('options-main-tab-strategy-lab').click();
    await page.waitForTimeout(500);
    
    // Click Builder subtab
    await page.getByTestId('strategy-lab-tab-builder').click();
    await page.waitForTimeout(300);
    
    // Verify form elements
    await expect(page.getByTestId('strategy-name-input')).toBeVisible();
    await expect(page.getByTestId('strategy-type-select')).toBeVisible();
    await expect(page.getByTestId('strategy-description-input')).toBeVisible();
    await expect(page.getByTestId('save-strategy-btn')).toBeVisible();
    await expect(page.getByTestId('validate-strategy-btn')).toBeVisible();
    
    await page.screenshot({ path: 'e2e-results/03-strategy-lab-builder.png', fullPage: true });
  });

  test('04 - Strategy Lab Library shows demo strategies', async ({ page }) => {
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);
    await page.getByTestId('options-main-tab-strategy-lab').click();
    await page.waitForTimeout(500);
    
    // Click Library subtab
    await page.getByTestId('strategy-lab-tab-library').click();
    await page.waitForTimeout(500);
    
    // Verify library table
    await expect(page.getByTestId('strategy-library-table')).toBeVisible();
    
    // Verify at least one row (demo strategies should be loaded)
    const rows = page.locator('[data-testid="strategy-library-table"] tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 3000 });
    
    await page.screenshot({ path: 'e2e-results/04-strategy-lab-library.png', fullPage: true });
  });

  test('05 - Strategy Lab Validate tab has JSON input', async ({ page }) => {
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);
    await page.getByTestId('options-main-tab-strategy-lab').click();
    await page.waitForTimeout(500);
    
    // Click Validate subtab
    await page.getByTestId('strategy-lab-tab-validate').click();
    await page.waitForTimeout(300);
    
    // Verify validate elements
    await expect(page.getByTestId('strategy-json-input')).toBeVisible();
    await expect(page.getByTestId('validate-json-btn')).toBeVisible();
    
    await page.screenshot({ path: 'e2e-results/05-strategy-lab-validate.png', fullPage: true });
  });

  test('06 - Backtest tab renders with subtabs', async ({ page }) => {
    // Backtest is now a standalone nav item
    await page.getByTestId('nav-item-backtest').click();
    await page.waitForTimeout(500);
    
    // Verify Backtest panel and subtabs
    await expect(page.getByTestId('backtest-panel')).toBeVisible();
    await expect(page.getByTestId('backtest-tab-configure')).toBeVisible();
    await expect(page.getByTestId('backtest-tab-runs')).toBeVisible();
    await expect(page.getByTestId('backtest-tab-analyze')).toBeVisible();
    await expect(page.getByTestId('backtest-tab-compare')).toBeVisible();
    await expect(page.getByTestId('backtest-tab-export')).toBeVisible();
    
    await page.screenshot({ path: 'e2e-results/06-backtest-panel.png', fullPage: true });
  });

  test('07 - Backtest Configure tab shows form elements', async ({ page }) => {
    await page.getByTestId('nav-item-backtest').click();
    await page.waitForTimeout(500);
    
    // Configure tab should be active by default, but click to be sure
    await page.getByTestId('backtest-tab-configure').click();
    await page.waitForTimeout(300);
    
    // Verify configure form elements
    await expect(page.getByTestId('backtest-strategy-select')).toBeVisible();
    await expect(page.getByTestId('backtest-symbol-input')).toBeVisible();
    await expect(page.getByTestId('backtest-start-date')).toBeVisible();
    await expect(page.getByTestId('backtest-end-date')).toBeVisible();
    await expect(page.getByTestId('backtest-capital-input')).toBeVisible();
    await expect(page.getByTestId('run-backtest-btn')).toBeVisible();
    
    await page.screenshot({ path: 'e2e-results/07-backtest-configure.png', fullPage: true });
  });

  test('08 - Backtest Runs tab shows table', async ({ page }) => {
    await page.getByTestId('nav-item-backtest').click();
    await page.waitForTimeout(500);
    
    // Click Runs subtab
    await page.getByTestId('backtest-tab-runs').click();
    await page.waitForTimeout(300);
    
    // Verify runs table
    await expect(page.getByTestId('backtest-runs-table')).toBeVisible();
    
    await page.screenshot({ path: 'e2e-results/08-backtest-runs.png', fullPage: true });
  });

  test('09 - Run a backtest and verify it completes', async ({ page }) => {
    await page.getByTestId('nav-item-backtest').click();
    await page.waitForTimeout(500);
    
    // Configure subtab
    await page.getByTestId('backtest-tab-configure').click();
    await page.waitForTimeout(300);
    
    // Select first strategy
    await page.getByTestId('backtest-strategy-select').selectOption({ index: 1 });
    await page.getByTestId('backtest-symbol-input').fill('SPY');
    await page.getByTestId('backtest-start-date').fill('2023-01-01');
    await page.getByTestId('backtest-end-date').fill('2023-03-31');
    await page.getByTestId('backtest-capital-input').fill('100000');
    
    // Run backtest
    await page.getByTestId('run-backtest-btn').click();
    await page.waitForTimeout(2000); // Wait for backtest to complete
    
    // Navigate to Runs tab
    await page.getByTestId('backtest-tab-runs').click();
    await page.waitForTimeout(500);
    
    // Verify at least one run exists
    const rows = page.locator('[data-testid="backtest-runs-table"] tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 3000 });
    
    await page.screenshot({ path: 'e2e-results/09-backtest-run-complete.png', fullPage: true });
  });

  test('10 - Backtest Analyze tab shows metrics', async ({ page }) => {
    await page.getByTestId('nav-item-backtest').click();
    await page.waitForTimeout(500);
    
    // Go to Runs tab first
    await page.getByTestId('backtest-tab-runs').click();
    await page.waitForTimeout(500);
    
    // Check if there are any runs
    const rows = page.locator('[data-testid="backtest-runs-table"] tbody tr');
    const rowCount = await rows.count();
    
    if (rowCount > 0) {
      // Click Analyze on first run
      const analyzeBtn = page.locator('[data-testid^="analyze-run-"]').first();
      await analyzeBtn.click();
      await page.waitForTimeout(500);
      
      // Verify analyze panel
      await expect(page.getByTestId('analyze-metrics')).toBeVisible();
      await expect(page.getByTestId('trade-blotter')).toBeVisible();
      
      await page.screenshot({ path: 'e2e-results/10-backtest-analyze.png', fullPage: true });
    } else {
      // If no runs, just verify we can navigate to Analyze tab
      await page.getByTestId('backtest-tab-analyze').click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'e2e-results/10-backtest-analyze-empty.png', fullPage: true });
    }
  });

  test('11 - Backend determinism: same config produces same hash', async ({ request }) => {
    // Get strategies
    const strategiesResponse = await request.get('http://localhost:8000/api/strategy/list');
    expect(strategiesResponse.ok()).toBeTruthy();
    
    const strategies = await strategiesResponse.json();
    expect(strategies.length).toBeGreaterThan(0);
    
    // Run backtest twice with same config
    const config = {
      strategy_id: strategies[0].id,
      symbol: 'SPY',
      start_date: '2023-01-01',
      end_date: '2023-02-28',
      initial_capital: 100000,
      slippage_bps: 5,
      fee_per_trade: 1,
      seed: 42
    };
    
    const run1Response = await request.post('http://localhost:8000/api/backtest/run', { data: config });
    expect(run1Response.ok()).toBeTruthy();
    const run1 = await run1Response.json();
    
    const run2Response = await request.post('http://localhost:8000/api/backtest/run', { data: config });
    expect(run2Response.ok()).toBeTruthy();
    const run2 = await run2Response.json();
    
    // Verify determinism
    expect(run1.config_hash).toBe(run2.config_hash);
    expect(run1.metrics.total_return_pct).toBe(run2.metrics.total_return_pct);
  });

  test('12 - Regression: Risk Desk still works', async ({ page }) => {
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);
    
    // Click Risk Desk main tab
    await page.getByTestId('options-main-tab-risk-desk').click();
    await page.waitForTimeout(500);
    
    // Verify Risk Desk panel loads
    await expect(page.getByTestId('risk-desk-title')).toBeVisible();
    
    await page.screenshot({ path: 'e2e-results/12-risk-desk-regression.png', fullPage: true });
  });

});
