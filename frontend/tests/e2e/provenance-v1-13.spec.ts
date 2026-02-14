/**
 * v1.13 Provenance Display E2E Tests
 * Validates that provenance information is displayed in UI (Backtest, Risk Desk)
 */

import { test, expect } from '@playwright/test';

test.describe('v1.13 Provenance Display', () => {
  test('should display provenance in Backtest Analyze tab', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for React to mount
    await page.waitForFunction(
      () => (document.getElementById('root')?.childElementCount ?? 0) > 0,
      { timeout: 20000 }
    );

    // Navigate directly to Backtest
    await page.getByTestId('nav-item-backtest').click();
    await page.waitForTimeout(1000);

    // Verify we're on Backtest view
    await expect(page.getByTestId('backtest-panel')).toBeVisible({ timeout: 10000 });

    // Make sure we're on Configure tab
    await page.getByTestId('backtest-tab-configure').click();
    await page.waitForTimeout(500);

    // Run a backtest
    await page.getByTestId('backtest-strategy-select').selectOption({ index: 1 });
    await page.getByTestId('run-backtest-btn').click();
    
    // Wait for completion
    await page.waitForSelector('[data-testid="backtest-run-status"]', { timeout: 30000 });

    // Navigate to Runs tab
    await page.getByTestId('backtest-tab-runs').click();
    await page.waitForTimeout(500);

    // Click on first run to analyze
    await page.locator('[data-testid^="analyze-run-"]').first().click();
    await page.waitForTimeout(1000);

    // Wait for Analyze tab to be ready
    await page.getByTestId('backtest-analyze-ready').waitFor({ state: 'visible', timeout: 10000 });

    // Verify provenance display is present and visible
    const provenanceDisplay = page.getByTestId('provenance-display');
    await provenanceDisplay.scrollIntoViewIfNeeded();
    await expect(provenanceDisplay).toBeVisible();

    // Verify source is DEMO
    const provenanceSource = page.getByTestId('provenance-source');
    await expect(provenanceSource).toContainText('DEMO');
  });

  test('should display provenance in Risk Desk', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for React to mount
    await page.waitForFunction(
      () => (document.getElementById('root')?.childElementCount ?? 0) > 0,
      { timeout: 20000 }
    );
    await page.waitForTimeout(1000);

    // Navigate to Options → Risk Desk
    const optionsNav = page.locator('[data-testid="nav-item-options"]');
    await optionsNav.waitFor({ state: 'visible', timeout: 10000 });
    await optionsNav.click();

    // Wait for Options view header to be visible
    await expect(page.getByTestId('options-heading')).toBeVisible({ timeout: 10000 });

    // Click Risk Desk main tab
    const riskDeskTab = page.locator('[data-testid="options-main-tab-risk-desk"]');
    await riskDeskTab.waitFor({ state: 'visible', timeout: 10000 });
    await riskDeskTab.click();
    await page.waitForTimeout(500);

    // Verify panel
    await expect(page.locator('[data-testid="risk-desk-panel"]')).toBeVisible({ timeout: 10000 });

    // Load demo portfolio
    await page.getByTestId('load-demo-btn').waitFor({ state: 'visible' });
    await page.getByTestId('load-demo-btn').click();

    // Run risk pipeline
    await page.getByTestId('run-button').click();
    
    // Wait for Risk Desk to be ready
    await page.getByTestId('riskdesk-ready').waitFor({ state: 'visible', timeout: 30000 });

    // Verify provenance display is present and visible
    const provenanceDisplay = page.getByTestId('provenance-display');
    await provenanceDisplay.scrollIntoViewIfNeeded();
    await expect(provenanceDisplay).toBeVisible();

    // Verify source is DEMO
    const provenanceSource = page.getByTestId('provenance-source');
    await expect(provenanceSource).toContainText('DEMO');
    
    // Verify provider information
    const provenanceProvider = page.getByTestId('provenance-provider');
    await expect(provenanceProvider).toBeVisible();
    await expect(provenanceProvider).toContainText('Demo Data');
  });
});

