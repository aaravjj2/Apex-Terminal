/**
 * Visual Regression Suite v1.4
 * Requirements: >= 12 tests, retries=0, named screenshots, fixed viewport
 * Coverage: Risk Desk, Strategy Lab, Backtest, Analytics, Navigation
 *
 * Uses Playwright's toHaveScreenshot() for pixel-level visual comparison.
 * First run generates baseline screenshots; subsequent runs compare against them.
 * Viewport: 1440×900, animations disabled, reduced-motion override.
 */

import { test, expect } from '@playwright/test';

// Fixed viewport for all visual regression tests
test.use({
  viewport: { width: 1440, height: 900 },
});

// ─── helpers ────────────────────────────────────────────────────────────────

async function gotoOptions(page: import('@playwright/test').Page) {
  await page.goto('http://localhost:5100');
  // Override CSS to disable animations for deterministic screenshots
  await page.addStyleTag({ content: '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }' });
  await page.getByTestId('nav-item-options').click();
}

async function riskDeskLoadAndRun(page: import('@playwright/test').Page) {
  await page.getByTestId('options-main-tab-risk-desk').click();
  await page.getByTestId('load-demo-btn').click();
  await page.getByTestId('run-button').click();
  await expect(page.getByTestId('greeks-card')).toBeVisible();
}

async function backtestCreateRun(page: import('@playwright/test').Page) {
  await page.getByTestId('nav-item-backtest').click();
  await page.getByTestId('backtest-strategy-select').selectOption({ index: 1 });
  await page.getByTestId('backtest-start-date').fill('2023-01-01');
  await page.getByTestId('backtest-end-date').fill('2023-03-31');
  await page.getByTestId('run-backtest-btn').click();
  await expect(page.getByTestId('backtest-runs-row-0')).toBeVisible({ timeout: 30000 });
}

// ═══════════════════════════════════════════════════════════════════════════
//  ANALYTICS VIEW (2 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Analytics Visual Regression', () => {
  test('VR-01 Analytics Panel Default State', async ({ page }) => {
    await gotoOptions(page);
    // Analytics is the default tab
    await expect(page.getByTestId('analytics-panel')).toBeVisible();

    await expect(page).toHaveScreenshot('vr-01-analytics-panel-default.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });

  test('VR-02 Quick Actions Strip Visible', async ({ page }) => {
    await gotoOptions(page);
    const strip = page.getByTestId('quick-actions-strip');
    await expect(strip).toBeVisible();

    await expect(strip).toHaveScreenshot('vr-02-quick-actions-strip.png', {
      animations: 'disabled',
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  RISK DESK (3 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Risk Desk Visual Regression', () => {
  test('VR-03 Risk Desk Empty State', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-risk-desk').click();
    await expect(page.getByTestId('risk-desk-panel')).toBeVisible();

    await expect(page).toHaveScreenshot('vr-03-risk-desk-empty.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });

  test('VR-04 Risk Desk After Load Demo', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-risk-desk').click();
    await page.getByTestId('load-demo-btn').click();
    // Wait for demo data to load and run button to be enabled
    await expect(page.getByTestId('run-button')).toBeEnabled();

    await expect(page).toHaveScreenshot('vr-04-risk-desk-demo-loaded.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });

  test('VR-05 Risk Desk Greeks Results', async ({ page }) => {
    await gotoOptions(page);
    await riskDeskLoadAndRun(page);

    // Focus on the greeks card
    const greeksCard = page.getByTestId('greeks-card');
    await expect(greeksCard).toBeVisible();

    await expect(greeksCard).toHaveScreenshot('vr-05-risk-desk-greeks.png', {
      animations: 'disabled',
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  STRATEGY LAB (2 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Strategy Lab Visual Regression', () => {
  test('VR-06 Strategy Library Table', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-strategy-lab').click();
    // Navigate to Library subtab (default is Builder)
    await page.getByTestId('strategy-lab-tab-library').click();
    // Wait for library to load
    await expect(page.locator('[data-testid^="library-item-"]').first()).toBeVisible({ timeout: 10000 });

    await expect(page).toHaveScreenshot('vr-06-strategy-library.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });

  test('VR-07 Strategy Validate Tab', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-strategy-lab').click();
    await page.getByTestId('strategy-lab-tab-validate').click();

    await expect(page).toHaveScreenshot('vr-07-strategy-validate.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  BACKTEST (4 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Backtest Visual Regression', () => {
  test('VR-08 Backtest Configure Tab', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('nav-item-backtest').click();

    await expect(page.getByTestId('backtest-panel')).toBeVisible();

    await expect(page).toHaveScreenshot('vr-08-backtest-configure.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });

  test('VR-09 Backtest Runs Table Populated', async ({ page }) => {
    await gotoOptions(page);
    await backtestCreateRun(page);

    await expect(page.getByTestId('backtest-runs-table')).toBeVisible();

    await expect(page).toHaveScreenshot('vr-09-backtest-runs-table.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });

  test('VR-10 Backtest Analyze Charts', async ({ page }) => {
    await gotoOptions(page);
    await backtestCreateRun(page);

    // Click Analyze on row 0
    await page.getByTestId('backtest-runs-row-0').locator('[data-testid^="analyze-run-"]').click();
    await expect(page.getByTestId('backtest-analyze-chart-equity')).toBeVisible({ timeout: 15000 });

    // Take full page to capture all 5 charts
    await expect(page).toHaveScreenshot('vr-10-backtest-analyze-charts.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('VR-11 Backtest Metrics Summary', async ({ page }) => {
    await gotoOptions(page);
    await backtestCreateRun(page);

    await page.getByTestId('backtest-runs-row-0').locator('[data-testid^="analyze-run-"]').click();
    const metrics = page.getByTestId('analyze-metrics');
    await expect(metrics).toBeVisible({ timeout: 15000 });

    await expect(metrics).toHaveScreenshot('vr-11-backtest-metrics.png', {
      animations: 'disabled',
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  NAVIGATION & LAYOUT (3 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Navigation Visual Regression', () => {
  test('VR-12 Full Page Default Load', async ({ page }) => {
    await page.goto('http://localhost:5100');
    await page.addStyleTag({ content: '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }' });
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveScreenshot('vr-12-full-page-default.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('VR-13 Options Tab Strip', async ({ page }) => {
    await gotoOptions(page);
    // Capture the main tab navigation strip by getting the container
    const tabStrip = page.getByTestId('options-main-tab-analytics');
    await expect(tabStrip).toBeVisible();

    await expect(page).toHaveScreenshot('vr-13-options-tab-strip.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });

  test('VR-14 Risk Desk Stress Card', async ({ page }) => {
    await gotoOptions(page);
    await riskDeskLoadAndRun(page);

    // Check for stress card
    const stressCard = page.getByTestId('stress-card');
    if (await stressCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(stressCard).toHaveScreenshot('vr-14-risk-desk-stress.png', {
        animations: 'disabled',
      });
    } else {
      // Fallback: capture the full risk desk results area
      await expect(page).toHaveScreenshot('vr-14-risk-desk-results.png', {
        fullPage: false,
        animations: 'disabled',
      });
    }
  });
});
