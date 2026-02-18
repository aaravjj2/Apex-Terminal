/**
 * v1.9 – Dashboard Tour
 * ======================
 * A comprehensive E2E walkthrough of every major feature.
 * Playwright records video → DASHBOARD_TOUR.webm
 *
 * This test is designed to produce a cinematic tour demonstrating:
 *  1. Dashboard overview
 *  2. Chart view with symbol switch
 *  3. Options workstation tabs
 *  4. Risk Desk demo run + premium charts
 *  5. Backtest panel (standalone nav)
 *  6. Ticker disambiguation
 *  7. Data source selector
 */

import { test, expect } from '@playwright/test';

const URL = 'http://localhost:5100';
const PAUSE = 1200; // Pause between scenes for readability in video

test('v1.9-TOUR – Full Dashboard Tour', async ({ page }) => {
  // ── Scene 1: Dashboard Landing ─────────────────────────────────
  await page.goto(URL);
  await expect(page.getByTestId('nav-item-dashboard')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(PAUSE);
  await page.screenshot({ path: 'artifacts/tour/01-dashboard-landing.png', fullPage: true });

  // ── Scene 2: Chart View ────────────────────────────────────────
  await page.getByTestId('nav-item-monitor').click();
  await page.waitForTimeout(PAUSE);
  await page.screenshot({ path: 'artifacts/tour/02-chart-view.png', fullPage: true });

  // ── Scene 3: Options Workstation ───────────────────────────────
  await page.getByTestId('nav-item-options').click();
  await page.waitForTimeout(PAUSE);
  await page.screenshot({ path: 'artifacts/tour/03-options-analytics.png', fullPage: true });

  // Switch through Options tabs
  await page.getByTestId('options-main-tab-risk-desk').click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'artifacts/tour/04-risk-desk-empty.png', fullPage: true });

  await page.getByTestId('options-main-tab-strategy-lab').click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'artifacts/tour/05-strategy-lab.png', fullPage: true });

  // ── Scene 4: Risk Desk Demo Run ────────────────────────────────
  await page.getByTestId('options-main-tab-risk-desk').click();
  await page.getByTestId('load-demo-btn').click();
  await expect(page.getByTestId('run-button')).toBeEnabled({ timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'artifacts/tour/06-risk-desk-loaded.png', fullPage: true });

  await page.getByTestId('run-button').click();
  await expect(page.getByTestId('greeks-card')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(PAUSE);
  await page.screenshot({ path: 'artifacts/tour/07-risk-desk-run-complete.png', fullPage: true });

  // ── Scene 5: Premium Charts ────────────────────────────────────
  await page.getByTestId('premium-risk-charts').scrollIntoViewIfNeeded();
  await page.waitForTimeout(PAUSE);
  await page.screenshot({ path: 'artifacts/tour/08-premium-charts.png', fullPage: true });

  // ── Scene 6: Backtest Panel (standalone nav) ───────────────────
  await page.getByTestId('nav-item-backtest').click();
  await page.waitForTimeout(PAUSE);
  await expect(page.getByTestId('backtest-panel')).toBeVisible();
  await page.screenshot({ path: 'artifacts/tour/09-backtest-panel.png', fullPage: true });

  // ── Scene 7: Ticker Disambiguation ─────────────────────────────
  await page.keyboard.press('Control+k');
  await expect(page.getByTestId('command-palette')).toBeVisible({ timeout: 5000 });
  await page.getByTestId('command-palette-input').fill('ON');
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('ticker-disambiguation-dialog')).toBeVisible({ timeout: 3000 });
  await page.screenshot({ path: 'artifacts/tour/10-ticker-disambiguation.png', fullPage: true });
  // Cancel disambiguation
  await page.getByTestId('disambiguation-cancel').click();
  await page.waitForTimeout(500);

  // ── Scene 8: Data Source Selector ──────────────────────────────
  await page.keyboard.press('Escape'); // close any dialogs
  await page.waitForTimeout(300);
  await page.getByTestId('data-source-trigger').click();
  await expect(page.getByTestId('data-source-dropdown')).toBeVisible();
  await page.waitForTimeout(PAUSE);
  await page.screenshot({ path: 'artifacts/tour/11-data-source-selector.png', fullPage: true });

  // ── Scene 9: Back to Dashboard ─────────────────────────────────
  await page.keyboard.press('Escape');
  await page.getByTestId('nav-item-dashboard').click();
  await page.waitForTimeout(PAUSE);
  await page.screenshot({ path: 'artifacts/tour/12-tour-complete.png', fullPage: true });
});
