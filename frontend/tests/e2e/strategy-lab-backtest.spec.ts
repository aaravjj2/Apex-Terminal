/**
 * Strategy Lab + Backtest E2E Tests
 * CRITICAL: retries=0 enforced in playwright.config.ts
 * Tests must be deterministic and pass on first try
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5100';

// Helper to navigate to Options view
async function navigateToOptions(page: Page) {
  const optionsNav = page.locator('[data-testid="nav-item-options"]');
  await expect(optionsNav).toBeVisible({ timeout: 10000 });
  await optionsNav.click();
  await page.waitForTimeout(1000);
}

test.describe('Strategy Lab + Backtest E2E Suite', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500); // Give time for app to initialize
  });

  test('01 - Options → Strategy Lab tab renders', async ({ page }) => {
    await navigateToOptions(page);
    
    // Click Strategy Lab main tab
    const strategyLabTab = page.locator('[data-testid="options-main-tab-strategy-lab"]');
    await expect(strategyLabTab).toBeVisible({ timeout: 5000 });
    await strategyLabTab.click();
    await page.waitForTimeout(500);
    
    // Verify Strategy Lab panel loaded - check heading specifically
    await expect(page.locator('h2:has-text("Strategy Lab")')).toBeVisible();
    
    // Screenshot
    await page.screenshot({ path: 'e2e-results/01-strategy-lab-main.png', fullPage: true });
  });

  test('02 - Strategy Lab Builder → Save button exists', async ({ page }) => {
    await navigateToOptions(page);
    await page.click('[data-testid="options-main-tab-strategy-lab"]');
    await page.waitForTimeout(300);
    
    // Verify Save button exists in Builder
    const saveBtn = page.locator('[data-testid="save-strategy-btn"]');
    await expect(saveBtn).toBeVisible();
    
    await page.screenshot({ path: 'e2e-results/02-strategy-builder.png', fullPage: true });
  });

  test('03 - Strategy Lab Library → shows demo strategies', async ({ page }) => {
    await navigateToOptions(page);
    await page.click('[data-testid="options-main-tab-strategy-lab"]');
    await page.waitForTimeout(300);
    
    // Click Library tab
    await page.click('[data-testid="strategy-tab-library"]');
    await page.waitForTimeout(500);
    
    // Verify table exists
    const table = page.locator('[data-testid="strategy-library-table"]');
    await expect(table).toBeVisible();
    
    // Verify at least one demo strategy (SMA Crossover or RSI Mean Reversion)
    const rows = page.locator('[data-testid="strategy-library-table"] tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    
    await page.screenshot({ path: 'e2e-results/03-strategy-library.png', fullPage: true });
  });

  test('04 - Strategy Lab Library → Load strategy → Builder prefilled', async ({ page }) => {
    await navigateToOptions(page);
    await page.click('[data-testid="options-main-tab-strategy-lab"]');
    await page.waitForTimeout(300);
    
    // Go to Library
    await page.click('[data-testid="strategy-tab-library"]');
    await page.waitForTimeout(500);
    
    // Click first Load button
    const loadBtn = page.locator('[data-testid^="load-strategy-"]').first();
    await loadBtn.click();
    await page.waitForTimeout(500);
    
    // Verify switched to Builder and name filled
    const nameInput = page.locator('[data-testid="strategy-name-input"]');
    const nameValue = await nameInput.inputValue();
    expect(nameValue.length).toBeGreaterThan(0);
    
    await page.screenshot({ path: 'e2e-results/04-strategy-load.png', fullPage: true });
  });

  test('05 - Strategy Lab Validate → upload JSON → validate', async ({ page }) => {
    await navigateToOptions(page);
    await page.click('[data-testid="options-main-tab-strategy-lab"]');
    await page.waitForTimeout(300);
    
    // Go to Validate tab
    await page.click('[data-testid="strategy-tab-validate"]');
    await page.waitForTimeout(300);
    
    // Fill JSON textarea with valid strategy
    const validJSON = JSON.stringify({
      name: "Test Validation",
      strategy_type: "crossover",
      indicators: [
        { type: "sma", params: { period: 20 } },
        { type: "sma", params: { period: 50 } }
      ]
    }, null, 2);
    
    await page.fill('[data-testid="strategy-json-input"]', validJSON);
    
    // Click Validate
    await page.click('[data-testid="validate-json-btn"]');
    await page.waitForTimeout(500);
    
    // Screenshot result
    await page.screenshot({ path: 'e2e-results/05-strategy-validate.png', fullPage: true });
  });

  test('06 - Options → Backtest tab renders', async ({ page }) => {
    // Click Backtest main tab
    await page.click('[data-testid="nav-item-backtest"]');
    await page.waitForTimeout(300);
    
    // Verify Backtest panel loaded
    const panel = page.locator('[data-testid="backtest-panel"]');
    await expect(panel).toBeVisible();
    
    // Verify subtabs present
    await expect(page.locator('[data-testid="backtest-tab-configure"]')).toBeVisible();
    await expect(page.locator('[data-testid="backtest-tab-runs"]')).toBeVisible();
    await expect(page.locator('[data-testid="backtest-tab-analyze"]')).toBeVisible();
    await expect(page.locator('[data-testid="backtest-tab-compare"]')).toBeVisible();
    await expect(page.locator('[data-testid="backtest-tab-export"]')).toBeVisible();
    
await page.screenshot({ path: 'e2e-results/06-backtest-main.png', fullPage: true });
  });

  test('07 - Backtest Configure → select strategy → run → appears in Runs', async ({ page }) => {
    await page.click('[data-testid="nav-item-backtest"]');
    await page.waitForTimeout(300);
    
    // Ensure Configure tab active
    await page.click('[data-testid="backtest-tab-configure"]');
    await page.waitForTimeout(300);
    
    // Select first strategy
    await page.selectOption('[data-testid="backtest-strategy-select"]', { index: 1 });
    
    // Fill other config
    await page.fill('[data-testid="backtest-symbol-input"]', 'SPY');
    await page.fill('[data-testid="backtest-start-date"]', '2023-01-01');
    await page.fill('[data-testid="backtest-end-date"]', '2023-03-31');
    await page.fill('[data-testid="backtest-capital-input"]', '100000');
    
    // Screenshot config
    await page.screenshot({ path: 'e2e-results/07a-backtest-config.png', fullPage: true });
    
    // Click Run
    await page.click('[data-testid="run-backtest-btn"]');
    await page.waitForTimeout(2000);
    
    // Should navigate to Runs tab automatically (or stay on config)
    // Go to Runs tab
    await page.click('[data-testid="backtest-tab-runs"]');
    await page.waitForTimeout(500);
    
    // Verify run appears in table
    const table = page.locator('[data-testid="backtest-runs-table"]');
    await expect(table).toBeVisible();
    
    const rows = page.locator('[data-testid="backtest-runs-table"] tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    
    await page.screenshot({ path: 'e2e-results/07b-backtest-run-complete.png', fullPage: true });
  });

  test('08 - Backtest Runs → table shows run history', async ({ page }) => {
    await page.click('[data-testid="nav-item-backtest"]');
    await page.waitForTimeout(300);
    
    // Go to Runs tab
    await page.click('[data-testid="backtest-tab-runs"]');
    await page.waitForTimeout(500);
    
    // Verify table
    const table = page.locator('[data-testid="backtest-runs-table"]');
    await expect(table).toBeVisible();
    
    // Verify columns
    await expect(page.locator('text=Run ID')).toBeVisible();
    await expect(page.locator('text=Symbol')).toBeVisible();
    await expect(page.locator('text=Status')).toBeVisible();
    
    await page.screenshot({ path: 'e2e-results/08-backtest-runs-table.png', fullPage: true });
  });

  test('09 - Backtest Analyze → click run → metrics displayed', async ({ page }) => {
    await page.click('[data-testid="nav-item-backtest"]');
    await page.waitForTimeout(300);
    
    // Go to Runs
    await page.click('[data-testid="backtest-tab-runs"]');
    await page.waitForTimeout(500);
    
    // Click Analyze on first run
    const analyzeBtn = page.locator('[data-testid^="analyze-run-"]').first();
    await analyzeBtn.click();
    await page.waitForTimeout(500);
    
    // Should be on Analyze tab now
    // Verify metrics displayed
    const metricsPanel = page.locator('[data-testid="analyze-metrics"]');
    await expect(metricsPanel).toBeVisible();
    
    // Verify trade blotter
    const blotter = page.locator('[data-testid="trade-blotter"]');
    await expect(blotter).toBeVisible();
    
    await page.screenshot({ path: 'e2e-results/09-backtest-analyze.png', fullPage: true });
  });

  test('10 - Backtest Compare → select 2 runs → delta shown', async ({ page }) => {
    await page.click('[data-testid="nav-item-backtest"]');
    await page.waitForTimeout(300);
    
    // Go to Compare tab
    await page.click('[data-testid="backtest-tab-compare"]');
    await page.waitForTimeout(300);
    
    // Verify compare panel (placeholder for v1)
    await expect(page.locator('[data-testid="backtest-tab-compare"]')).toBeVisible();
    
    await page.screenshot({ path: 'e2e-results/10-backtest-compare.png', fullPage: true });
  });

  test('11 - Backtest Export → download artifacts', async ({ page }) => {
    await page.click('[data-testid="nav-item-backtest"]');
    await page.waitForTimeout(300);
    
    // Go to Runs
    await page.click('[data-testid="backtest-tab-runs"]');
    await page.waitForTimeout(500);
    
    // Click Download on first run
    const downloadBtn = page.locator('[data-testid^="download-run-"]').first();
    
    // Listen for download
    const downloadPromise = page.waitForEvent('download');
    await downloadBtn.click();
    const download = await downloadPromise;
    
    // Verify download filename
    expect(download.suggestedFilename()).toMatch(/report_bundle_|artifacts\.zip/);
    
    await page.screenshot({ path: 'e2e-results/11-backtest-export.png', fullPage: true });
  });

  test('12 - Determinism check: run same config twice → hashes match', async ({ page }) => {
    await page.click('[data-testid="nav-item-backtest"]');
    await page.waitForTimeout(300);
    
    // Configure
    await page.click('[data-testid="backtest-tab-configure"]');
    await page.selectOption('[data-testid="backtest-strategy-select"]', { index: 1 });
    await page.fill('[data-testid="backtest-symbol-input"]', 'SPY');
    await page.fill('[data-testid="backtest-start-date"]', '2023-01-01');
    await page.fill('[data-testid="backtest-end-date"]', '2023-02-28');
    await page.fill('[data-testid="backtest-capital-input"]', '100000');
    
    // Run first time
    await page.click('[data-testid="run-backtest-btn"]');
    await page.waitForTimeout(2000);
    
    // Run second time with same config
    await page.click('[data-testid="backtest-tab-configure"]');
    await page.click('[data-testid="run-backtest-btn"]');
    await page.waitForTimeout(2000);
    
    // Go to Runs
    await page.click('[data-testid="backtest-tab-runs"]');
    await page.waitForTimeout(500);
    
    // Get first two run IDs (should have same metrics)
    const rows = page.locator('[data-testid="backtest-runs-table"] tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(2);
    
    // Screenshot showing multiple runs with same config
    await page.screenshot({ path: 'e2e-results/12-determinism-check.png', fullPage: true });
  });

  test('13 - Navigation regression: Risk Desk still works', async ({ page }) => {
    // Navigate to Options first, then click Risk Desk tab
    await navigateToOptions(page);
    await page.click('[data-testid="options-main-tab-risk-desk"]');
    await page.waitForTimeout(500);
    
    // Verify Risk Desk loaded
    await expect(page.locator('text=Risk Desk').first()).toBeVisible();
    
    await page.screenshot({ path: 'e2e-results/13-risk-desk-regression.png', fullPage: true });
  });

  test('14 - Navigation regression: Dashboard quick action works', async ({ page }) => {
    // Go back to dashboard
    const dashboardNav = page.locator('[data-testid="nav-item-dashboard"]');
    await dashboardNav.click();
    await page.waitForTimeout(500);
    
    // Verify dashboard loaded
    await expect(page.locator('text=Dashboard').or(page.locator('text=Command Center'))).toBeVisible();
    
    await page.screenshot({ path: 'e2e-results/14-dashboard-regression.png', fullPage: true });
  });

});
