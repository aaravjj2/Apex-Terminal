/**
 * v1.8 Visual Regression + Accessibility E2E Tests
 * 21 tests, 15 screenshot assertions
 * Covers: Options main tabs, Risk Desk subtabs, Backtest subtabs,
 *         RunStatusHeader, Empty states, Accessibility (ARIA),
 *         Tool trace & compliance, Guided first-run states.
 */

import { test, expect } from '@playwright/test';

// ─── Helpers (same pattern as v1.6) ────────────────────────────────────────

async function gotoOptions(page: import('@playwright/test').Page) {
  await page.goto('http://localhost:5100');
  await page.getByTestId('nav-item-options').click();
}

async function gotoBacktest(page: import('@playwright/test').Page) {
  await page.goto('http://localhost:5100');
  await page.getByTestId('nav-item-backtest').click();
}

async function riskDeskLoadAndRun(page: import('@playwright/test').Page) {
  await page.getByTestId('options-main-tab-risk-desk').click();
  await page.getByTestId('load-demo-btn').click();
  await page.getByTestId('run-button').click();
  await expect(page.getByTestId('greeks-card')).toBeVisible({ timeout: 15000 });
}

// ═══════════════════════════════════════════════════════════════════════════
//  OPTIONS MAIN TABS VISUAL REGRESSION (5 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('v1.8 - Options Main Tabs Visual Regression', () => {
  test('v1.8-01 - Analytics tab default state', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-analytics').click();
    await expect(page.getByTestId('analytics-panel')).toBeVisible();
    await expect(page).toHaveScreenshot('v1.8-01-analytics-default.png', { fullPage: false });
  });

  test('v1.8-02 - Risk Desk tab with empty state', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-risk-desk').click();
    await expect(page.getByTestId('risk-desk-panel')).toBeVisible();
    await expect(page.getByTestId('empty-state')).toBeVisible();
    await expect(page).toHaveScreenshot('v1.8-02-risk-desk-empty.png', { fullPage: false });
  });

  test('v1.8-03 - Strategy Lab tab visible', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-strategy-lab').click();
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('v1.8-03-strategy-lab.png', { fullPage: false });
  });

  test('v1.8-04 - Backtest standalone default state', async ({ page }) => {
    await gotoBacktest(page);
    await expect(page.getByTestId('backtest-panel')).toBeVisible();
    await expect(page).toHaveScreenshot('v1.8-04-backtest-default.png', { fullPage: false });
  });

  test('v1.8-05 - Runs tab visible', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-runs').click();
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('v1.8-05-runs-tab.png', { fullPage: false });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  RISK DESK EMPTY & GUIDED STATES (4 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('v1.8 - Risk Desk Empty & Guided States', () => {
  test('v1.8-06 - Risk Desk empty state has CTA text', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-risk-desk').click();
    await expect(page.getByTestId('empty-state')).toBeVisible();
    await expect(page.getByTestId('empty-state-load-demo')).toBeVisible();
    const cta = page.getByTestId('empty-state-load-demo');
    await expect(cta).toContainText('sample portfolio');
  });

  test('v1.8-07 - Risk Desk Runs tab empty state', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-risk-desk').click();
    await page.getByTestId('riskdesk-subtab-runs').click();
    await expect(page.getByTestId('runs-empty-state')).toBeVisible();
    await expect(page.getByTestId('runs-empty-goto-run')).toBeVisible();
    await expect(page).toHaveScreenshot('v1.8-07-runs-empty-state.png', { fullPage: false });
  });

  test('v1.8-08 - Risk Desk Export tab no-run state', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-risk-desk').click();
    await page.getByTestId('riskdesk-subtab-export').click();
    await expect(page.getByTestId('export-tab')).toBeVisible();
    await expect(page).toHaveScreenshot('v1.8-08-export-no-run.png', { fullPage: false });
  });

  test('v1.8-09 - Empty state load demo click populates portfolio', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-risk-desk').click();
    await expect(page.getByTestId('empty-state-load-demo')).toBeVisible();
    await page.getByTestId('empty-state-load-demo').click();
    // After loading demo, the Run button should be enabled
    await expect(page.getByTestId('run-button')).toBeEnabled({ timeout: 10000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  RISK DESK RUN STATUS HEADER (3 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('v1.8 - Risk Desk Run Status Header', () => {
  test('v1.8-10 - RunStatusHeader appears after pipeline run', async ({ page }) => {
    await gotoOptions(page);
    await riskDeskLoadAndRun(page);
    await expect(page.getByTestId('run-status-header')).toBeVisible();
    await expect(page.getByTestId('run-status-run-id')).toBeVisible();
    await expect(page.getByTestId('run-status-badge')).toBeVisible();
    await expect(page).toHaveScreenshot('v1.8-10-run-status-header.png', { fullPage: false, maxDiffPixelRatio: 0.10 });
  });

  test('v1.8-11 - RunStatusHeader shows run_id text', async ({ page }) => {
    await gotoOptions(page);
    await riskDeskLoadAndRun(page);
    const header = page.getByTestId('run-status-header');
    await expect(header).toBeVisible();
    await expect(page.getByTestId('run-status-run-id')).not.toBeEmpty();
  });

  test('v1.8-12 - Full risk run pipeline with greeks visible', async ({ page }) => {
    await gotoOptions(page);
    await riskDeskLoadAndRun(page);
    await expect(page.getByTestId('greeks-card')).toBeVisible();
    await expect(page.getByTestId('stress-card')).toBeVisible();
    await expect(page).toHaveScreenshot('v1.8-12-full-run-results.png', { fullPage: false, maxDiffPixelRatio: 0.10 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  BACKTEST SUBTABS & STATUS (3 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('v1.8 - Backtest Subtabs & Status', () => {
  test('v1.8-13 - Backtest configure tab with strategy select', async ({ page }) => {
    await gotoBacktest(page);
    await expect(page.getByTestId('backtest-strategy-select')).toBeVisible();
    await expect(page).toHaveScreenshot('v1.8-13-backtest-configure.png', { fullPage: false });
  });

  test('v1.8-14 - Backtest runs tab', async ({ page }) => {
    await gotoBacktest(page);
    await page.getByTestId('backtest-tab-runs').click();
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('v1.8-14-backtest-runs.png', { fullPage: false });
  });

  test('v1.8-15 - Backtest export tab', async ({ page }) => {
    await gotoBacktest(page);
    await page.getByTestId('backtest-tab-export').click();
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('v1.8-15-backtest-export.png', { fullPage: false });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  ACCESSIBILITY (ARIA / Keyboard) (3 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('v1.8 - Accessibility (ARIA / Keyboard)', () => {
  test('v1.8-16 - Main tabs have ARIA role=tab and aria-selected', async ({ page }) => {
    await gotoOptions(page);
    // Check analytics tab (default selected)
    const analyticsTab = page.getByTestId('options-main-tab-analytics');
    await expect(analyticsTab).toHaveAttribute('role', 'tab');
    await expect(analyticsTab).toHaveAttribute('aria-selected', 'true');

    // Check risk-desk tab is not selected
    const riskTab = page.getByTestId('options-main-tab-risk-desk');
    await expect(riskTab).toHaveAttribute('role', 'tab');
    await expect(riskTab).toHaveAttribute('aria-selected', 'false');

    // Click risk-desk, verify it becomes selected
    await riskTab.click();
    await expect(riskTab).toHaveAttribute('aria-selected', 'true');
    await expect(analyticsTab).toHaveAttribute('aria-selected', 'false');
  });

  test('v1.8-17 - Risk Desk subtabs have ARIA tablist', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-risk-desk').click();
    const tablist = page.getByTestId('riskdesk-tablist');
    await expect(tablist).toBeVisible();
    const runTab = page.getByTestId('riskdesk-subtab-run');
    await expect(runTab).toHaveAttribute('role', 'tab');
    await expect(runTab).toHaveAttribute('aria-selected', 'true');
  });

  test('v1.8-18 - Backtest subtabs have ARIA tablist', async ({ page }) => {
    await gotoBacktest(page);
    const tablist = page.getByTestId('backtest-tablist');
    await expect(tablist).toBeVisible();
    const configTab = page.getByTestId('backtest-tab-configure');
    await expect(configTab).toHaveAttribute('role', 'tab');
    await expect(configTab).toHaveAttribute('aria-selected', 'true');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  TOOL TRACE & COMPLIANCE (3 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('v1.8 - Tool Trace & Compliance', () => {
  test('v1.8-19 - Tool trace timeline shows after run', async ({ page }) => {
    await gotoOptions(page);
    await riskDeskLoadAndRun(page);
    await expect(page.getByTestId('trace-column')).toBeVisible();
    await expect(page).toHaveScreenshot('v1.8-19-tool-trace.png', { fullPage: false, maxDiffPixelRatio: 0.10 });
  });

  test('v1.8-20 - Compliance card visible after run', async ({ page }) => {
    await gotoOptions(page);
    await riskDeskLoadAndRun(page);
    await expect(page.getByTestId('compliance-card')).toBeVisible();
    await expect(page).toHaveScreenshot('v1.8-20-compliance-card.png', { fullPage: false, maxDiffPixelRatio: 0.10 });
  });

  test('v1.8-21 - Verification card visible after run', async ({ page }) => {
    await gotoOptions(page);
    await riskDeskLoadAndRun(page);
    await expect(page.getByTestId('verification-card')).toBeVisible();
    await expect(page).toHaveScreenshot('v1.8-21-verification-card.png', { fullPage: false, maxDiffPixelRatio: 0.10 });
  });
});
