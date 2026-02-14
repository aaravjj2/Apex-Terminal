/**
 * Strategy Validation E2E Tests (v1.29)
 * 
 * Tests:
 * - Navigate to Strategy Lab > Validate tab
 * - Enter invalid strategy spec
 * - Run validation => deterministic error list
 * - Verify errors contain specific rule_ids in deterministic order
 * - Screenshot of validation panel
 */

import { test, expect } from '@playwright/test';

// Navigate to Strategy Lab Validate tab
async function navigateToStrategyLabValidate(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  
  // Click Options nav item
  const navOptions = page.locator('[data-testid="nav-item-options"]');
  await expect(navOptions).toBeVisible({ timeout: 10000 });
  await navOptions.click();
  
  // Click Strategy Lab main tab
  const strategyLabTab = page.locator('[data-testid="options-main-tab-strategy-lab"]');
  await expect(strategyLabTab).toBeVisible({ timeout: 5000 });
  await strategyLabTab.click();
  
  // Verify strategy lab panel is visible
  const labPanel = page.locator('[data-testid="strategy-lab-panel"]');
  await expect(labPanel).toBeVisible({ timeout: 5000 });
  
  // Click Validate tab
  const validateTab = page.locator('[data-testid="strategy-lab-tab-validate"]');
  await expect(validateTab).toBeVisible({ timeout: 5000 });
  await validateTab.click();
  
  // Verify validate panel ready
  const validateReady = page.locator('[data-testid="strategy-validate-ready"]');
  await expect(validateReady).toBeVisible({ timeout: 5000 });
}

test.describe('v1.29 Strategy Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Reset demo state
    await page.request.post('http://localhost:8000/api/v1/strategy-artifacts/reset-demo');
  });

  test('validation panel is visible on validate tab', async ({ page }) => {
    await navigateToStrategyLabValidate(page);
    
    // Verify validation panel exists
    const validationPanel = page.locator('[data-testid="strategy-validation-panel"]');
    await expect(validationPanel).toBeVisible();
    
    // Verify run validation button exists
    const runBtn = page.locator('[data-testid="strategy-validation-run"]');
    await expect(runBtn).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/snapshots/strategy-validation-panel.png', fullPage: false });
  });

  test('empty strategy produces deterministic errors', async ({ page }) => {
    await navigateToStrategyLabValidate(page);
    
    // Click Run Validation on the empty strategy (default from builder)
    const runBtn = page.locator('[data-testid="strategy-validation-run"]');
    await runBtn.click();
    
    // Wait for errors to appear (allow extra time for API round-trip)
    const errorsGroup = page.locator('[data-testid="strategy-validation-errors"]');
    await expect(errorsGroup).toBeVisible({ timeout: 15000 });
    
    // Wait for warnings to appear
    const warningsGroup = page.locator('[data-testid="strategy-validation-warnings"]');
    await expect(warningsGroup).toBeVisible({ timeout: 10000 });
    
    // Verify we have validation issues
    const issues = page.locator('[data-testid^="strategy-validation-issue-"]');
    await expect(issues.first()).toBeVisible({ timeout: 10000 });
    const issueCount = await issues.count();
    expect(issueCount).toBeGreaterThan(0);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/snapshots/strategy-validation-errors.png', fullPage: false });
  });

  test('invalid strategy via API returns deterministic error report', async ({ page }) => {
    // Call validation API directly with an invalid spec
    const invalidSpec = {
      name: '',
      type: 'unknown_type',
      spec: null,
    };
    
    const res = await page.request.post('http://localhost:8000/api/v1/strategy-artifacts/validate', {
      data: invalidSpec,
    });
    const report = await res.json();
    
    // Assert report structure
    expect(report.valid).toBe(false);
    expect(report.input_checksum).toBeTruthy();
    expect(report.input_checksum.length).toBe(64);
    
    // Assert errors contain expected rule_ids
    const errorRuleIds = report.errors.map((e: { rule_id: string }) => e.rule_id);
    expect(errorRuleIds).toContain('STRAT_001'); // name required
    expect(errorRuleIds).toContain('STRAT_002'); // unsupported type
    expect(errorRuleIds).toContain('STRAT_003'); // spec required
    
    // Assert deterministic ordering: sorted by rule_id
    for (let i = 1; i < errorRuleIds.length; i++) {
      expect(errorRuleIds[i] >= errorRuleIds[i - 1]).toBe(true);
    }
    
    // Run the same validation again and verify identical output
    const res2 = await page.request.post('http://localhost:8000/api/v1/strategy-artifacts/validate', {
      data: invalidSpec,
    });
    const report2 = await res2.json();
    
    expect(report.input_checksum).toBe(report2.input_checksum);
    expect(report.errors).toEqual(report2.errors);
    expect(report.warnings).toEqual(report2.warnings);
  });

  test('validation report is deterministic across repeated API calls', async ({ page }) => {
    const spec = {
      name: 'Test',
      type: 'crossover',
      spec: {
        indicators: [{ type: 'SMA', params: { period: 20 } }],
        stop_loss_pct: 60,
        take_profit_pct: 0.5,
      },
    };
    
    const res1 = await page.request.post('http://localhost:8000/api/v1/strategy-artifacts/validate', {
      data: spec,
    });
    const report1 = await res1.json();
    
    const res2 = await page.request.post('http://localhost:8000/api/v1/strategy-artifacts/validate', {
      data: spec,
    });
    const report2 = await res2.json();
    
    // Full equality
    expect(report1).toEqual(report2);
    
    // Should have STRAT_005 error (crossover with 1 indicator)
    const errorRuleIds = report1.errors.map((e: { rule_id: string }) => e.rule_id);
    expect(errorRuleIds).toContain('STRAT_005');
    
    // Should have STRAT_004 warnings (large stop loss, small take profit)
    const warningRuleIds = report1.warnings.map((w: { rule_id: string }) => w.rule_id);
    expect(warningRuleIds).toContain('STRAT_004');
  });

  test('validation errors appear in UI with correct testid selectors', async ({ page }) => {
    await navigateToStrategyLabValidate(page);
    
    // Run validation on empty strategy
    const runBtn = page.locator('[data-testid="strategy-validation-run"]');
    await runBtn.click();
    
    // Wait for errors group
    const errorsGroup = page.locator('[data-testid="strategy-validation-errors"]');
    await expect(errorsGroup).toBeVisible({ timeout: 15000 });
    
    // Wait for warnings group  
    const warningsGroup = page.locator('[data-testid="strategy-validation-warnings"]');
    await expect(warningsGroup).toBeVisible({ timeout: 10000 });
    
    // Should see at least one issue with proper testid format
    const firstIssue = page.locator('[data-testid^="strategy-validation-issue-STRAT_"]').first();
    await expect(firstIssue).toBeVisible({ timeout: 10000 });
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/snapshots/strategy-validation-issues-ui.png', fullPage: false });
  });
});
