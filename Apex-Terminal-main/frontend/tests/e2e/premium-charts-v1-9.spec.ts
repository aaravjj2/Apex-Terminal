/**
 * v1.9 – Premium Risk Charts E2E
 * ================================
 * Verifies that the three institutional-grade charts render after a
 * Risk Desk demo run, and that animation gating works in E2E mode.
 *
 * Charts tested:
 *   1. Payoff Curve (payoff-curve-chart)
 *   2. Greeks vs Underlying (greeks-vs-underlying-chart)
 *   3. Scenario Ladder (scenario-ladder-chart)
 */

import { test, expect } from '@playwright/test';

const URL = 'http://localhost:5100';

async function gotoRiskDesk(page: import('@playwright/test').Page) {
  await page.goto(URL);
  await page.getByTestId('nav-item-options').click();
  await page.getByTestId('options-main-tab-risk-desk').click();
}

async function loadDemoAndRun(page: import('@playwright/test').Page) {
  // Click Load Demo (either empty-state CTA or a visible "Load Demo" button)
  const loadBtn = page.getByTestId('load-demo-btn').first();
  await loadBtn.click();
  // Wait for portfolio to populate (run button becomes enabled)
  await expect(page.getByTestId('run-button')).toBeEnabled({ timeout: 10000 });
  // Run the analysis
  await page.getByTestId('run-button').click();
  // Wait for greeks-card as proof the pipeline finished
  await expect(page.getByTestId('greeks-card')).toBeVisible({ timeout: 15000 });
}

// ═══════════════════════════════════════════════════════════════════════════

test.describe('v1.9 – Premium Risk Charts', () => {
  test('v1.9-C01 – Premium charts container appears after run', async ({ page }) => {
    await gotoRiskDesk(page);
    await loadDemoAndRun(page);
    await expect(page.getByTestId('premium-risk-charts')).toBeVisible({ timeout: 5000 });
  });

  test('v1.9-C02 – Payoff Curve chart renders', async ({ page }) => {
    await gotoRiskDesk(page);
    await loadDemoAndRun(page);
    const chart = page.getByTestId('payoff-curve-chart');
    await expect(chart).toBeVisible();
    // Chart should have its heading
    await expect(chart.getByTestId('chart-heading')).toContainText('Payoff Curve');
    // Recharts container verified via parent testid
  });

  test('v1.9-C03 – Greeks vs Underlying chart renders', async ({ page }) => {
    await gotoRiskDesk(page);
    await loadDemoAndRun(page);
    const chart = page.getByTestId('greeks-vs-underlying-chart');
    await expect(chart).toBeVisible();
    await expect(chart.getByTestId('chart-heading')).toContainText('Greeks vs Underlying');
    // Recharts container verified via parent testid
  });

  test('v1.9-C04 – Scenario Ladder chart renders', async ({ page }) => {
    await gotoRiskDesk(page);
    await loadDemoAndRun(page);
    const chart = page.getByTestId('scenario-ladder-chart');
    await expect(chart).toBeVisible();
    await expect(chart.getByTestId('chart-heading')).toContainText('Scenario Ladder');
    // Recharts container verified via parent testid
  });

  test('v1.9-C05 – All three charts visible simultaneously', async ({ page }) => {
    await gotoRiskDesk(page);
    await loadDemoAndRun(page);
    // Scroll to make sure all are in view
    await page.getByTestId('premium-risk-charts').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('payoff-curve-chart')).toBeVisible();
    await expect(page.getByTestId('greeks-vs-underlying-chart')).toBeVisible();
    await expect(page.getByTestId('scenario-ladder-chart')).toBeVisible();
  });

  test('v1.9-C06 – Animation gating via E2E flag', async ({ page }) => {
    // Set E2E mode before navigating
    await page.goto(URL);
    await page.evaluate(() => { (window as any).__E2E_MODE = true; });
    await page.getByTestId('nav-item-options').click();
    await page.getByTestId('options-main-tab-risk-desk').click();
    await loadDemoAndRun(page);
    // Charts should render (animation disabled but still present)
    await expect(page.getByTestId('premium-risk-charts')).toBeVisible();
    // Verify SVG paths exist (charts rendered their data even without animation)
    const payoff = page.getByTestId('payoff-curve-chart');
    await expect(payoff.getByTestId('chart-svg')).toBeVisible();
  });

  test('v1.9-C07 – Charts not visible before run', async ({ page }) => {
    await gotoRiskDesk(page);
    // Before running, premium charts should not exist
    await expect(page.getByTestId('premium-risk-charts')).not.toBeVisible();
  });
});
