/**
 * v1.13 Provenance Display E2E Tests
 * Validates that provenance information is displayed in UI (Backtest, Risk Desk, Analytics)
 */

import { test, expect } from '@playwright/test';

test.describe('v1.13 Provenance Display', () => {
  test('should display provenance in Backtest Analyze tab', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to Options → Backtest
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);
    await page.getByTestId('options-main-tab-backtest').click();
    await page.waitForTimeout(500);

    // Run a backtest
    await page.getByTestId('backtest-strategy-select').selectOption({ index: 0 });
    await page.getByTestId('run-backtest-btn').click();
    
    // Wait for completion
    await page.waitForSelector('[data-testid="backtest-run-status"]:has-text("complete")', { timeout: 30000 });

    // Click on first run to analyze
    await page.getByTestId('analyze-run-0').first().click();
    await page.waitForTimeout(500);

    // Verify Analyze tab is active
    await page.getByTestId('backtest-tab-analyze').isVisible();

    // Verify provenance display is present
    const provenanceDisplay = page.getByTestId('provenance-display');
    await expect(provenanceDisplay).toBeVisible();

    // Verify source is DEMO
    const provenanceSource = page.getByTestId('provenance-source');
    await expect(provenanceSource).toContainText('DEMO');
  });

  test('should display provenance in Risk Desk', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to Options → Risk Desk
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);
    await page.getByTestId('options-main-tab-risk-desk').click();
    await page.waitForTimeout(500);

    // Load demo portfolio
    await page.getByTestId('load-demo-btn').click();
    await page.waitForTimeout(500);

    // Run risk pipeline
    await page.getByTestId('run-button').click();
    
    // Wait for completion
    await page.waitForSelector('[data-testid="run-status"]', { timeout: 30000 });

    // Verify provenance display is present
    const provenanceDisplay = page.getByTestId('provenance-display');
    await expect(provenanceDisplay).toBeVisible();

    // Verify source is DEMO
    const provenanceSource = page.getByTestId('provenance-source');
    await expect(provenanceSource).toContainText('DEMO');
  });

  test('should display provenance in Analytics (IV Analytics)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to Options Dashboard (Analytics is part of this view)
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(1000);

    // Verify provenance display is present in analytics section
    const provenanceDisplay = page.getByTestId('provenance-display');
    await expect(provenanceDisplay).toBeVisible();

    // Verify source is DEMO
    const provenanceSource = page.getByTestId('provenance-source');
    await expect(provenanceSource).toContainText('DEMO');
  });

  test('provenance display should show provider information', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to Options
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(1000);

    // Check provenance display components
    const provenanceDisplay = page.getByTestId('provenance-display');
    await expect(provenanceDisplay).toBeVisible();

    const provenanceSource = page.getByTestId('provenance-source');
    await expect(provenanceSource).toBeVisible();
    await expect(provenanceSource).toContainText('DEMO');

    const provenanceProvider = page.getByTestId('provenance-provider');
    await expect(provenanceProvider).toBeVisible();
    await expect(provenanceProvider).toContainText('Demo Data');
  });
});
