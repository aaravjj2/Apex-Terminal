/**
 * Visual Regression Suite v1.26
 * Expansion for v1.23-v1.25 features:
 * - Portfolio Manage Tab (v1.23)
 * - Multi-Portfolio Section in Risk Desk (v1.25)
 * - Portfolio Overlay in Backtest Analyze (v1.24)
 *
 * Charts hardened with animations disabled + fixed viewport.
 * Viewport: 1440×900, animations disabled.
 */

import { test, expect, type Page } from '@playwright/test';

test.use({
  viewport: { width: 1440, height: 900 },
});

// ─── helpers ────────────────────────────────────────────────────────────────

async function disableAnimations(page: Page) {
  await page.addStyleTag({
    content: '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }',
  });
}

async function navigateToRiskDesk(page: Page) {
  await page.goto('/');
  await disableAnimations(page);
  const optionsNav = page.getByTestId('nav-item-options');
  await expect(optionsNav).toBeVisible({ timeout: 5000 });
  await optionsNav.click();
  const riskDeskTab = page.getByTestId('options-main-tab-risk-desk');
  await expect(riskDeskTab).toBeVisible({ timeout: 5000 });
  await riskDeskTab.click();
  await expect(page.getByTestId('risk-desk-panel')).toBeVisible({ timeout: 5000 });
}

async function navigateToPortfolioManage(page: Page) {
  await page.goto('/');
  await disableAnimations(page);
  const portfolioNav = page.getByTestId('nav-item-portfolio');
  await expect(portfolioNav).toBeVisible({ timeout: 5000 });
  await portfolioNav.click();
  const manageTab = page.getByTestId('tab-manage');
  await expect(manageTab).toBeVisible({ timeout: 5000 });
  await manageTab.click();
}

async function navigateToBacktestAnalyze(page: Page) {
  await page.goto('/');
  await disableAnimations(page);
  await page.getByTestId('nav-item-backtest').click();
  // Create a run first
  await page.getByTestId('backtest-strategy-select').selectOption({ index: 1 });
  await page.getByTestId('backtest-start-date').fill('2023-01-01');
  await page.getByTestId('backtest-end-date').fill('2023-03-31');
  await page.getByTestId('run-backtest-btn').click();
  await expect(page.getByTestId('backtest-runs-row-0')).toBeVisible({ timeout: 30000 });
  // Switch to Analyze
  await page.getByTestId('backtest-tab-analyze').click();
  await expect(page.getByTestId('backtest-analyze-ready')).toBeVisible({ timeout: 10000 });
}

// ═══════════════════════════════════════════════════════════════════════════
//  v1.23 PORTFOLIO MANAGE TAB
// ═══════════════════════════════════════════════════════════════════════════

test.describe('v1.26 Visual Regression — Portfolio Manage', () => {
  test('VR-26-01 Portfolio Manage Tab', async ({ page }) => {
    await navigateToPortfolioManage(page);

    const cruPanel = page.getByTestId('portfolio-panel');
    await expect(cruPanel).toBeVisible({ timeout: 5000 });

    await expect(page).toHaveScreenshot('vr-26-01-portfolio-manage-tab.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  v1.25 MULTI-PORTFOLIO SECTION IN RISK DESK
// ═══════════════════════════════════════════════════════════════════════════

test.describe('v1.26 Visual Regression — Multi-Portfolio', () => {
  test('VR-26-02 Multi-Portfolio Section Default', async ({ page }) => {
    await navigateToRiskDesk(page);

    const section = page.getByTestId('multi-portfolio-section');
    await expect(section).toBeVisible({ timeout: 5000 });

    // Wait for valuation cards to load
    await expect(section.getByTestId('multi-valuation-cards')).toBeVisible({ timeout: 10000 });

    await expect(section).toHaveScreenshot('vr-26-02-multi-portfolio-default.png', {
      animations: 'disabled',
    });
  });

  test('VR-26-03 Multi-Portfolio Dropdown Open', async ({ page }) => {
    await navigateToRiskDesk(page);

    const section = page.getByTestId('multi-portfolio-section');
    await expect(section).toBeVisible({ timeout: 5000 });

    // Open dropdown
    await section.getByTestId('multi-portfolio-toggle').click();

    // Wait for options to be visible
    await expect(section.getByTestId('multi-portfolio-option-DEMO-PORT-001')).toBeVisible({ timeout: 5000 });

    await expect(section).toHaveScreenshot('vr-26-03-multi-portfolio-dropdown.png', {
      animations: 'disabled',
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  v1.24 BACKTEST PORTFOLIO OVERLAY
// ═══════════════════════════════════════════════════════════════════════════

test.describe('v1.26 Visual Regression — Backtest Overlay', () => {
  test('VR-26-04 Backtest Analyze with Portfolio Overlay', async ({ page }) => {
    await navigateToBacktestAnalyze(page);

    const overlay = page.getByTestId('backtest-portfolio-overlay');
    await expect(overlay).toBeVisible({ timeout: 5000 });

    await expect(overlay).toHaveScreenshot('vr-26-04-backtest-portfolio-overlay.png', {
      animations: 'disabled',
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  CHART HARDENING — Deterministic comparison
// ═══════════════════════════════════════════════════════════════════════════

test.describe('v1.26 Chart Hardening', () => {
  test('VR-26-05 Risk Desk Charts After Run — deterministic', async ({ page }) => {
    await navigateToRiskDesk(page);

    // Load demo and run
    const loadDemoBtn = page.getByTestId('load-demo-btn');
    await expect(loadDemoBtn).toBeVisible({ timeout: 5000 });
    await loadDemoBtn.click();
    await page.getByTestId('run-button').click();

    // Wait for results
    await expect(page.getByTestId('riskdesk-ready')).toBeVisible({ timeout: 15000 });

    const outputsCol = page.getByTestId('outputs-column');
    await expect(outputsCol).toBeVisible();

    await expect(outputsCol).toHaveScreenshot('vr-26-05-risk-desk-charts-post-run.png', {
      animations: 'disabled',
      // Slightly higher threshold for chart rendering differences
      maxDiffPixelRatio: 0.02,
    });
  });
});
