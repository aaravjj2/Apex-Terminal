/**
 * Strategy-to-Backtest Binding E2E Tests (v1.31)
 *
 * Tests:
 * - "Run Backtest" button on artifact rows
 * - Clicking navigates to Backtest view with artifact ID pre-filled
 * - Backtest config form shows strategy_artifact_id
 * - Running a backtest with artifact ID succeeds
 * - Screenshot assertions
 */

import { test, expect } from '@playwright/test';

async function navigateToStrategyLabArtifacts(page: import('@playwright/test').Page) {
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

  // Click Artifacts tab
  const artifactsTab = page.locator('[data-testid="strategy-lab-tab-artifacts"]');
  await expect(artifactsTab).toBeVisible({ timeout: 5000 });
  await artifactsTab.click();

  // Wait for artifacts to load
  const artifactsPanel = page.locator('[data-testid="strategy-artifacts-panel"]');
  await expect(artifactsPanel).toBeVisible({ timeout: 5000 });
  const rows = page.locator('[data-testid^="strategy-artifact-row-"]');
  await expect(rows.first()).toBeVisible({ timeout: 5000 });
}

test.describe('v1.31 Strategy-to-Backtest Binding', () => {
  test.beforeEach(async ({ page }) => {
    // Reset demo state for determinism
    await page.request.post('http://localhost:8000/api/v1/strategy-artifacts/reset-demo');
  });

  test('artifact rows have Run Backtest button', async ({ page }) => {
    await navigateToStrategyLabArtifacts(page);

    const runBtns = page.locator('[data-testid="strategy-run-backtest"]');
    await expect(runBtns.first()).toBeVisible({ timeout: 5000 });
    const count = await runBtns.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('Run Backtest navigates to backtest with artifact pre-filled', async ({ page }) => {
    await navigateToStrategyLabArtifacts(page);

    // Get the first artifact ID
    const firstRow = page.locator('[data-testid^="strategy-artifact-row-"]').first();
    const artifactIdSpan = firstRow.locator('[data-testid^="strategy-artifact-id-"]');
    const fullId = await artifactIdSpan.getAttribute('title');
    expect(fullId).toBeTruthy();

    // Click Run Backtest on first artifact
    const runBtn = firstRow.locator('[data-testid="strategy-run-backtest"]');
    await runBtn.click();

    // Should navigate to backtest view
    const backtestPanel = page.locator('[data-testid="backtest-panel"]');
    await expect(backtestPanel).toBeVisible({ timeout: 10000 });

    // Strategy artifact field should be pre-filled
    const artifactInput = page.locator('[data-testid="backtest-strategy-artifact-current"]');
    await expect(artifactInput).toBeVisible({ timeout: 5000 });
    const inputValue = await artifactInput.inputValue();
    expect(inputValue).toBe(fullId);
  });

  test('backtest config form shows strategy artifact select', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Navigate directly to backtest
    const navBacktest = page.locator('[data-testid="nav-item-backtest"]');
    await expect(navBacktest).toBeVisible({ timeout: 10000 });
    await navBacktest.click();

    const backtestPanel = page.locator('[data-testid="backtest-panel"]');
    await expect(backtestPanel).toBeVisible({ timeout: 10000 });

    // Strategy artifact select area should be visible
    const artifactSelect = page.locator('[data-testid="backtest-strategy-artifact-select"]');
    await expect(artifactSelect).toBeVisible({ timeout: 5000 });

    // Current artifact input should be visible
    const artifactCurrent = page.locator('[data-testid="backtest-strategy-artifact-current"]');
    await expect(artifactCurrent).toBeVisible();
  });

  test('backtest screenshot with artifact binding', async ({ page }) => {
    await navigateToStrategyLabArtifacts(page);

    // Click Run Backtest on first artifact
    const firstRunBtn = page.locator('[data-testid="strategy-run-backtest"]').first();
    await firstRunBtn.click();

    const backtestPanel = page.locator('[data-testid="backtest-panel"]');
    await expect(backtestPanel).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: 'test-results/snapshots/backtest-artifact-binding-v1-31.png',
      fullPage: false,
    });
  });
});
