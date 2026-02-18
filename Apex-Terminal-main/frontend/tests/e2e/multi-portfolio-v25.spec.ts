/**
 * v1.25 — Multi-Portfolio Support E2E
 *
 * Tests:
 * 1. Multi-portfolio selector visible in Risk Desk
 * 2. Select All / Deselect All work
 * 3. Multi-valuation cards render with $ values
 */
import { test, expect, type Page } from '@playwright/test';

async function navigateToRiskDesk(page: Page) {
  const optionsNav = page.getByTestId('nav-item-options');
  await expect(optionsNav).toBeVisible({ timeout: 5000 });
  await optionsNav.click();

  const riskDeskTab = page.getByTestId('options-main-tab-risk-desk');
  await expect(riskDeskTab).toBeVisible({ timeout: 5000 });
  await riskDeskTab.click();

  await expect(page.getByTestId('risk-desk-panel')).toBeVisible({ timeout: 5000 });
}

test.describe('v1.25 Multi-Portfolio Support', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await navigateToRiskDesk(page);
  });

  test('v1.25-1: multi-portfolio section visible in Risk Desk', async ({ page }) => {
    const section = page.getByTestId('multi-portfolio-section');
    await expect(section).toBeVisible({ timeout: 10000 });

    // Multi-portfolio selector should be within section
    const selector = section.getByTestId('multi-portfolio-selector');
    await expect(selector).toBeVisible();

    // Toggle button should be visible
    const toggle = section.getByTestId('multi-portfolio-toggle');
    await expect(toggle).toBeVisible();
  });

  test('v1.25-2: multi-portfolio selector shows options and select all', async ({ page }) => {
    const section = page.getByTestId('multi-portfolio-section');
    await expect(section).toBeVisible({ timeout: 10000 });

    // Open dropdown
    const toggle = section.getByTestId('multi-portfolio-toggle');
    await toggle.click();

    // Should see portfolio options
    const option1 = section.getByTestId('multi-portfolio-option-DEMO-PORT-001');
    await expect(option1).toBeVisible({ timeout: 5000 });

    // Select All button
    const selectAll = section.getByTestId('multi-portfolio-select-all');
    await expect(selectAll).toBeVisible();
    await selectAll.click();

    // After select all, summary should show multiple
    const summary = section.getByTestId('multi-portfolio-summary');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('DEMO-PORT-001');
    await expect(summary).toContainText('DEMO-PORT-002');
  });

  test('v1.25-3: multi-valuation cards show $ values', async ({ page }) => {
    const section = page.getByTestId('multi-portfolio-section');
    await expect(section).toBeVisible({ timeout: 10000 });

    // Wait for multi-valuation cards to load (default selection is DEMO-PORT-001)
    const cards = section.getByTestId('multi-valuation-cards');
    await expect(cards).toBeVisible({ timeout: 10000 });

    // Count card should show 1
    const count = section.getByTestId('multi-valuation-count');
    await expect(count).toBeVisible();
    await expect(count).toContainText('1');

    // Total value should contain $
    const total = section.getByTestId('multi-valuation-total');
    await expect(total).toBeVisible();
    await expect(total).toContainText('$');

    // P&L should contain $
    const pnl = section.getByTestId('multi-valuation-pnl');
    await expect(pnl).toBeVisible();
    await expect(pnl).toContainText('$');
  });
});
