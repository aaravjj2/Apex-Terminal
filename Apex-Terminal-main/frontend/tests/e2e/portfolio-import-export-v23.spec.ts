/**
 * Portfolio Import/Export v1.23 E2E Tests
 *
 * Tests:
 * - Manage tab visible in Portfolio view
 * - Export button downloads canonical JSON
 * - Import button accepts JSON and creates portfolio
 *
 * Constraints:
 * - 0 skipped, 0 retries
 * - ONLY data-testid selectors
 * - No waitForTimeout
 */

import { test, expect, Page } from '@playwright/test';

/** Navigate to Portfolio → Manage tab → PortfolioCrudPanel */
async function navigateToManageTab(page: Page) {
  const navItem = page.getByTestId('nav-item-portfolio');
  await expect(navItem).toBeVisible({ timeout: 5000 });
  await navItem.click();
  await expect(page.getByTestId('portfolio-view')).toBeVisible({ timeout: 5000 });

  // Switch to Manage tab
  const manageTab = page.getByTestId('tab-manage');
  await expect(manageTab).toBeVisible({ timeout: 5000 });
  await manageTab.click();
  await expect(page.getByTestId('portfolio-panel')).toBeVisible({ timeout: 5000 });
}

async function loadDemoPortfolios(page: Page) {
  const loadDemoBtn = page.getByTestId('portfolio-load-demo-btn');
  await expect(loadDemoBtn).toBeVisible({ timeout: 5000 });
  await loadDemoBtn.click();

  // Wait for table to appear (demo portfolios loaded)
  await expect(page.getByTestId('portfolio-ready')).toBeVisible({ timeout: 8000 });
}

test.describe('Portfolio v1.23: Import/Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('v1.23-1: Manage tab visible with import/export controls', async ({ page }) => {
    await navigateToManageTab(page);

    // Import button should be in the header
    const importBtn = page.getByTestId('portfolio-import-btn');
    await expect(importBtn).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: 'artifacts/w3-screenshots/v23-manage-tab.png',
      fullPage: true,
    });
  });

  test('v1.23-2: Export button downloads canonical JSON', async ({ page }) => {
    await navigateToManageTab(page);
    await loadDemoPortfolios(page);

    // Export button should exist for DEMO-PORT-001
    const exportBtn = page.getByTestId('portfolio-export-btn-DEMO-PORT-001');
    await expect(exportBtn).toBeVisible({ timeout: 5000 });

    // Click and verify download
    const downloadPromise = page.waitForEvent('download');
    await exportBtn.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^portfolio-DEMO-PORT-001\.json$/);

    await page.screenshot({
      path: 'artifacts/w3-screenshots/v23-export-download.png',
      fullPage: true,
    });
  });

  test('v1.23-3: Import portfolio from file creates new row', async ({ page }) => {
    await navigateToManageTab(page);
    await loadDemoPortfolios(page);

    // Get canonical export via API
    const exportRes = await page.request.get('http://localhost:8000/api/v1/portfolios/DEMO-PORT-001/export');
    expect(exportRes.ok()).toBeTruthy();
    const exportData = await exportRes.json();

    // Count rows before import
    const rowsBefore = await page.getByTestId('portfolio-table').locator('tbody tr').count();

    // Trigger file import via the hidden input
    const fileInput = page.getByTestId('portfolio-import-file-input');
    await fileInput.setInputFiles({
      name: 'test-import.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(exportData)),
    });

    // Wait for new row to appear
    const table = page.getByTestId('portfolio-table');
    await expect(table.locator('tbody tr')).toHaveCount(rowsBefore + 1, { timeout: 8000 });

    // Success banner should appear
    const successBanner = page.getByTestId('portfolio-success-banner');
    await expect(successBanner).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: 'artifacts/w3-screenshots/v23-import-success.png',
      fullPage: true,
    });
  });
});
