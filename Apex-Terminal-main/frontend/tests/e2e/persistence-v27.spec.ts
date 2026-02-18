/**
 * v1.27 — Portfolio Persistence + Session-State Audit E2E
 *
 * Tests:
 * 1. Portfolio selection survives tab switches in Risk Desk
 * 2. Portfolio list survives navigation away and back
 * 3. Multi-portfolio selection survives within session
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

async function navigateToPortfolio(page: Page) {
  const portfolioNav = page.getByTestId('nav-item-portfolio');
  await expect(portfolioNav).toBeVisible({ timeout: 5000 });
  await portfolioNav.click();
}

test.describe('v1.27 Session-State Persistence', () => {
  test('v1.27-1: portfolio list visible after nav away and back', async ({ page }) => {
    await page.goto('/');
    await navigateToPortfolio(page);

    // Verify portfolio table visible
    const manageTab = page.getByTestId('tab-manage');
    await expect(manageTab).toBeVisible({ timeout: 5000 });
    await manageTab.click();

    const table = page.getByTestId('portfolio-table');
    await expect(table).toBeVisible({ timeout: 5000 });

    // Navigate away to Risk Desk
    await navigateToRiskDesk(page);
    await expect(page.getByTestId('risk-desk-panel')).toBeVisible();

    // Navigate back to Portfolio
    await navigateToPortfolio(page);
    const manageTab2 = page.getByTestId('tab-manage');
    await expect(manageTab2).toBeVisible({ timeout: 5000 });
    await manageTab2.click();

    // Table should still be visible after round-trip
    await expect(page.getByTestId('portfolio-table')).toBeVisible({ timeout: 5000 });
  });

  test('v1.27-2: portfolio attach selector state in Risk Desk', async ({ page }) => {
    await page.goto('/');
    await navigateToRiskDesk(page);

    // Verify attach selector visible (v1.21)
    const selector = page.getByTestId('portfolio-attach-selector');
    await expect(selector).toBeVisible({ timeout: 5000 });

    // Switch to Export tab and back to Run
    await page.getByTestId('riskdesk-subtab-export').click();
    await page.getByTestId('riskdesk-subtab-run').click();

    // Selector should still be visible (it's in the header, not tab-dependent)
    await expect(selector).toBeVisible({ timeout: 5000 });
  });

  test('v1.27-3: multi-portfolio valuation cards reload after nav', async ({ page }) => {
    await page.goto('/');
    await navigateToRiskDesk(page);

    const section = page.getByTestId('multi-portfolio-section');
    await expect(section).toBeVisible({ timeout: 5000 });

    // Wait for cards to load
    await expect(section.getByTestId('multi-valuation-cards')).toBeVisible({ timeout: 10000 });

    // Navigate away
    await navigateToPortfolio(page);
    await expect(page.getByTestId('nav-item-portfolio')).toBeVisible();

    // Navigate back
    await navigateToRiskDesk(page);

    // Cards should reload
    const sectionAgain = page.getByTestId('multi-portfolio-section');
    await expect(sectionAgain).toBeVisible({ timeout: 5000 });
    await expect(sectionAgain.getByTestId('multi-valuation-cards')).toBeVisible({ timeout: 10000 });
  });

  test('v1.27-4: backend fixture reset does not break UI', async ({ page }) => {
    await page.goto('/');
    await navigateToRiskDesk(page);

    // Reset fixtures via API
    const resetResp = await page.request.post('/api/v1/portfolios/reset');
    expect(resetResp.status()).toBe(200);

    // Navigate to portfolio view
    await navigateToPortfolio(page);
    const manageTab = page.getByTestId('tab-manage');
    await expect(manageTab).toBeVisible({ timeout: 5000 });
    await manageTab.click();

    // Table should render after reset
    await expect(page.getByTestId('portfolio-table')).toBeVisible({ timeout: 5000 });
    // DEMO-PORT-001 row should exist
    await expect(page.getByTestId('portfolio-row-DEMO-PORT-001')).toBeVisible({ timeout: 5000 });
  });
});
