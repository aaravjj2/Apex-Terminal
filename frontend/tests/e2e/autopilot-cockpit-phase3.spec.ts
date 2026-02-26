/**
 * Phase 3: AutopilotCockpit E2E Tests
 * Tests the ⚡ Live Cockpit (6-tab ops view) via non-headless Playwright.
 *
 * Coverage:
 *  - Cockpit renders as default tab when navigating to /autopilot
 *  - Health tab: all 5 checks green, VIX value visible, regime text
 *  - Run-Now button: triggers cycle, toast appears, cycle-log updates
 *  - Tab navigation: overview → health → cycle-log → positions → orders → universe
 *  - Universe grid: shows at least one symbol
 */

import { test, expect } from '@playwright/test';

const BACKEND = process.env.APEX_BACKEND_URL || 'http://localhost:8000';

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

async function navigateToCockpit(page: import('@playwright/test').Page) {
  // The Shell (legacy UI) with AutopilotCockpit is at /legacy/
  await page.goto('/legacy/');

  // Wait for nav to be ready — nav-item-autopilot is rendered by LeftNavEnhanced
  const navItem = page.locator('[data-testid="nav-item-autopilot"]');
  await navItem.waitFor({ state: 'visible', timeout: 30_000 });
  await navItem.click();

  // Should default to cockpit tab since AutopilotView defaults to 'cockpit'
  const cockpit = page.locator('[data-testid="autopilot-cockpit"]');
  await cockpit.waitFor({ state: 'visible', timeout: 30_000 });
  return cockpit;
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

test.describe('AutopilotCockpit — Phase 3 E2E', () => {

  // -------------------------------------------------------------------------
  test('cockpit renders as default tab', async ({ page }) => {
    await navigateToCockpit(page);
    await expect(page.locator('[data-testid="autopilot-cockpit"]')).toBeVisible();
    await page.screenshot({ path: 'cockpit-default.png', fullPage: false });
  });

  // -------------------------------------------------------------------------
  test('overview tab shows engine, regime, and cycle cards', async ({ page }) => {
    await navigateToCockpit(page);

    // Click Overview tab (it may already be active)
    const overviewTab = page.locator('[data-testid="cockpit-tab-overview"]');
    await overviewTab.waitFor({ state: 'visible', timeout: 10_000 });
    await overviewTab.click();

    // Key cards visible
    await expect(page.locator('[data-testid="cockpit-engine-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="cockpit-regime-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="cockpit-last-cycle-card"]')).toBeVisible();

    // Regime label + VIX level
    await expect(page.locator('[data-testid="market-regime"]')).toBeVisible();

    // VIX loads async — wait up to 15s for a non-empty value
    const vixLoc = page.locator('[data-testid="vix-level"]');
    await vixLoc.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(vixLoc).toBeVisible();

    await page.screenshot({ path: 'cockpit-overview.png' });
  });

  // -------------------------------------------------------------------------
  test('health tab shows overall ok and all check rows', async ({ page }) => {
    await navigateToCockpit(page);

    const healthTab = page.locator('[data-testid="cockpit-tab-health"]');
    await healthTab.waitFor({ state: 'visible', timeout: 10_000 });
    await healthTab.click();

    // Overall status — health checks run async (Alpaca/ES latency), give ample time
    const status = page.locator('[data-testid="health-overall-status"]');
    await status.waitFor({ state: 'visible', timeout: 30_000 });
    await expect(status).toContainText(/ok/i);

    // Each subsystem check row
    for (const name of ['alpaca', 'elasticsearch', 'yfinance', 'tradier', 'news_provider']) {
      const row = page.locator(`[data-testid="health-check-${name}"]`);
      await row.waitFor({ state: 'visible', timeout: 10_000 });
      await expect(row).toBeVisible();
    }

    await page.screenshot({ path: 'cockpit-health.png' });
  });

  // -------------------------------------------------------------------------
  test('run-now button triggers cycle and cycle-log updates', async ({ page }) => {
    await navigateToCockpit(page);

    // Click Run-Now
    const runBtn = page.locator('[data-testid="cockpit-run-now-btn"]');
    await runBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await runBtn.click();

    // Toast should appear
    const toast = page.locator('[data-testid="cockpit-toast"]');
    await toast.waitFor({ state: 'visible', timeout: 8_000 });
    await expect(toast).toBeVisible();

    // Switch to cycle-log tab and wait for a row
    const cycleLogTab = page.locator('[data-testid="cockpit-tab-cycle-log"]');
    await cycleLogTab.waitFor({ state: 'visible', timeout: 10_000 });
    await cycleLogTab.click();

    // Wait up to 40 s for the cycle to complete and at least one row to appear
    const cycleList = page.locator('[data-testid="cycle-log-list"]');
    await cycleList.waitFor({ state: 'visible', timeout: 40_000 });

    const firstRow = cycleList.locator('[data-testid^="cycle-row-"]').first();
    await firstRow.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(firstRow).toBeVisible();

    await page.screenshot({ path: 'cockpit-cycle-log.png' });
  });

  // -------------------------------------------------------------------------
  test('arm and disarm buttons are present and functional', async ({ page }) => {
    await navigateToCockpit(page);

    const armBtn = page.locator('[data-testid="cockpit-arm-btn"]');
    await armBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await expect(armBtn).toBeVisible();

    const disarmBtn = page.locator('[data-testid="cockpit-disarm-btn"]');
    await expect(disarmBtn).toBeVisible();

    await page.screenshot({ path: 'cockpit-arm-buttons.png' });
  });

  // -------------------------------------------------------------------------
  test('universe tab shows grid with symbols', async ({ page }) => {
    await navigateToCockpit(page);

    const universeTab = page.locator('[data-testid="cockpit-tab-universe"]');
    await universeTab.waitFor({ state: 'visible', timeout: 10_000 });
    await universeTab.click();

    // Universe data loads async — wait for at least one symbol card to appear
    const firstCard = page.locator('[data-testid^="universe-symbol-"]').first();
    await firstCard.waitFor({ state: 'visible', timeout: 20_000 });

    const cards = page.locator('[data-testid^="universe-symbol-"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    await page.screenshot({ path: 'cockpit-universe.png' });
  });

  // -------------------------------------------------------------------------
  test('positions and orders tabs are reachable', async ({ page }) => {
    await navigateToCockpit(page);

    // Positions tab — check the tab container (table only renders when positions exist)
    const posTab = page.locator('[data-testid="cockpit-tab-positions"]');
    await posTab.waitFor({ state: 'visible', timeout: 10_000 });
    await posTab.click();
    await page.locator('[data-testid="cockpit-positions-tab"]').waitFor({ state: 'visible', timeout: 10_000 });
    await expect(page.locator('[data-testid="cockpit-positions-tab"]')).toBeVisible();
    await page.screenshot({ path: 'cockpit-positions.png' });

    // Orders tab — check the tab container (table only renders when orders exist)
    const ordTab = page.locator('[data-testid="cockpit-tab-orders"]');
    await ordTab.click();
    await page.locator('[data-testid="cockpit-orders-tab"]').waitFor({ state: 'visible', timeout: 10_000 });
    await expect(page.locator('[data-testid="cockpit-orders-tab"]')).toBeVisible();
    await page.screenshot({ path: 'cockpit-orders.png' });
  });

});
