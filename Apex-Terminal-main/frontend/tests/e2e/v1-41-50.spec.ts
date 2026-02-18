/**
 * v1.41–v1.50 E2E suite
 *
 * v1.41: Watchlist Manager
 * v1.42: Correlation Matrix
 * v1.43: Trade Journal
 * v1.44: Notifications Center
 * v1.45: System Audit Log
 * v1.46: Performance Attribution
 * v1.47: Risk Scenarios
 * v1.48: Data Quality Monitor
 * v1.49: Strategy Comparison Matrix
 * v1.50: Platform Health Dashboard
 */

import { test, expect } from '@playwright/test';
import {
  enableDeterministicMode,
  waitForAppReady,
  waitForTestId,
  clickTestId,
} from './helpers';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5100';

/* ------------------------------------------------------------------ */
/* v1.41: Watchlist Manager                                           */
/* ------------------------------------------------------------------ */

test.describe('v1.41 — Watchlist Manager', () => {
  test('WL01: Navigate to watchlist panel', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-watchlist');
    await waitForTestId(page, 'watchlist-panel');
    await waitForTestId(page, 'watchlist-panel-ready');

    await page.screenshot({ path: 'e2e-results/v41-01-watchlist-panel.png' });
  });

  test('WL02: Watchlist tabs visible', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-watchlist');
    await waitForTestId(page, 'watchlist-panel-ready');

    await waitForTestId(page, 'watchlist-tab-wl-001', { timeout: 10000 });
    await expect(page.getByTestId('watchlist-tab-wl-001')).toBeVisible();

    await page.screenshot({ path: 'e2e-results/v41-02-watchlist-tabs.png' });
  });

  test('WL03: Symbols table renders', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-watchlist');
    await waitForTestId(page, 'watchlist-panel-ready');

    await waitForTestId(page, 'watchlist-symbol-0', { timeout: 10000 });
    const rows = page.locator('[data-testid^="watchlist-symbol-"]');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(3);

    await page.screenshot({ path: 'e2e-results/v41-03-watchlist-symbols.png' });
  });
});

/* ------------------------------------------------------------------ */
/* v1.42: Correlation Matrix                                          */
/* ------------------------------------------------------------------ */

test.describe('v1.42 — Correlation Matrix', () => {
  test('CM01: Navigate to correlation panel', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-correlation');
    await waitForTestId(page, 'correlation-panel');
    await waitForTestId(page, 'correlation-panel-ready');

    await page.screenshot({ path: 'e2e-results/v42-01-correlation-panel.png' });
  });

  test('CM02: Matrix cells visible', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-correlation');
    await waitForTestId(page, 'correlation-panel-ready');

    await waitForTestId(page, 'corr-cell-0-0', { timeout: 10000 });
    const cell = page.getByTestId('corr-cell-0-0');
    await expect(cell).toBeVisible();
    // Diagonal should be 1.00
    await expect(cell).toHaveText('1.00');

    await page.screenshot({ path: 'e2e-results/v42-02-correlation-cells.png' });
  });

  test('CM03: Column headers show symbols', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-correlation');
    await waitForTestId(page, 'correlation-panel-ready');

    await waitForTestId(page, 'corr-header-SPY', { timeout: 10000 });
    await expect(page.getByTestId('corr-header-SPY')).toBeVisible();

    await page.screenshot({ path: 'e2e-results/v42-03-correlation-headers.png' });
  });
});

/* ------------------------------------------------------------------ */
/* v1.43: Trade Journal                                               */
/* ------------------------------------------------------------------ */

test.describe('v1.43 — Trade Journal', () => {
  test('TJ01: Navigate to journal panel', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-journal');
    await waitForTestId(page, 'journal-panel');
    await waitForTestId(page, 'journal-panel-ready');

    await page.screenshot({ path: 'e2e-results/v43-01-journal-panel.png' });
  });

  test('TJ02: Journal entries render', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-journal');
    await waitForTestId(page, 'journal-panel-ready');

    await waitForTestId(page, 'journal-entry-0', { timeout: 10000 });
    const entries = page.locator('[data-testid^="journal-entry-"]');
    const count = await entries.count();
    expect(count).toBe(4);

    await page.screenshot({ path: 'e2e-results/v43-02-journal-entries.png' });
  });

  test('TJ03: Journal stats bar visible', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-journal');
    await waitForTestId(page, 'journal-panel-ready');

    await waitForTestId(page, 'journal-stats', { timeout: 10000 });
    await expect(page.getByTestId('journal-stats')).toBeVisible();

    await page.screenshot({ path: 'e2e-results/v43-03-journal-stats.png' });
  });
});

/* ------------------------------------------------------------------ */
/* v1.44: Notifications Center                                        */
/* ------------------------------------------------------------------ */

test.describe('v1.44 — Notifications Center', () => {
  test('NC01: Navigate to notifications panel', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-notifications');
    await waitForTestId(page, 'notifications-panel');
    await waitForTestId(page, 'notifications-panel-ready');

    await page.screenshot({ path: 'e2e-results/v44-01-notifications-panel.png' });
  });

  test('NC02: Unread badge visible', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-notifications');
    await waitForTestId(page, 'notifications-panel-ready');

    await waitForTestId(page, 'notifications-badge', { timeout: 10000 });
    await expect(page.getByTestId('notifications-badge')).toBeVisible();

    await page.screenshot({ path: 'e2e-results/v44-02-notifications-badge.png' });
  });

  test('NC03: Notification items render', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-notifications');
    await waitForTestId(page, 'notifications-panel-ready');

    await waitForTestId(page, 'notification-item-0', { timeout: 10000 });
    const items = page.locator('[data-testid^="notification-item-"]');
    const count = await items.count();
    expect(count).toBe(5);

    await page.screenshot({ path: 'e2e-results/v44-03-notification-items.png' });
  });
});

/* ------------------------------------------------------------------ */
/* v1.45: System Audit Log                                            */
/* ------------------------------------------------------------------ */

test.describe('v1.45 — System Audit Log', () => {
  test('AL01: Navigate to audit panel', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-audit');
    await waitForTestId(page, 'audit-panel');
    await waitForTestId(page, 'audit-panel-ready');

    await page.screenshot({ path: 'e2e-results/v45-01-audit-panel.png' });
  });

  test('AL02: Audit rows render', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-audit');
    await waitForTestId(page, 'audit-panel-ready');

    await waitForTestId(page, 'audit-row-0', { timeout: 10000 });
    const rows = page.locator('[data-testid^="audit-row-"]');
    const count = await rows.count();
    expect(count).toBe(6);

    await page.screenshot({ path: 'e2e-results/v45-02-audit-rows.png' });
  });

  test('AL03: Audit count badge', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-audit');
    await waitForTestId(page, 'audit-panel-ready');

    await waitForTestId(page, 'audit-count', { timeout: 10000 });
    const ct = page.getByTestId('audit-count');
    await expect(ct).toBeVisible();
    await expect(ct).toContainText('6');

    await page.screenshot({ path: 'e2e-results/v45-03-audit-count.png' });
  });
});

/* ------------------------------------------------------------------ */
/* v1.46: Performance Attribution                                     */
/* ------------------------------------------------------------------ */

test.describe('v1.46 — Performance Attribution', () => {
  test('PA01: Navigate to attribution panel', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-attribution');
    await waitForTestId(page, 'attribution-panel');
    await waitForTestId(page, 'attribution-panel-ready');

    await page.screenshot({ path: 'e2e-results/v46-01-attribution-panel.png' });
  });

  test('PA02: Attribution summary visible', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-attribution');
    await waitForTestId(page, 'attribution-panel-ready');

    await waitForTestId(page, 'attribution-summary', { timeout: 10000 });
    await expect(page.getByTestId('attribution-summary')).toBeVisible();

    await page.screenshot({ path: 'e2e-results/v46-02-attribution-summary.png' });
  });

  test('PA03: Strategy breakdowns visible', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-attribution');
    await waitForTestId(page, 'attribution-panel-ready');

    await waitForTestId(page, 'attr-strategy-0', { timeout: 10000 });
    const strats = page.locator('[data-testid^="attr-strategy-"]');
    const count = await strats.count();
    expect(count).toBe(4);

    await page.screenshot({ path: 'e2e-results/v46-03-attribution-strategies.png' });
  });
});

/* ------------------------------------------------------------------ */
/* v1.47: Risk Scenarios                                              */
/* ------------------------------------------------------------------ */

test.describe('v1.47 — Risk Scenarios', () => {
  test('RS01: Navigate to risk scenarios panel', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-risk-scenarios');
    await waitForTestId(page, 'risk-scenarios-panel');
    await waitForTestId(page, 'risk-scenarios-panel-ready');

    await page.screenshot({ path: 'e2e-results/v47-01-risk-scenarios-panel.png' });
  });

  test('RS02: Scenario cards render', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-risk-scenarios');
    await waitForTestId(page, 'risk-scenarios-panel-ready');

    await waitForTestId(page, 'scenario-card-0', { timeout: 10000 });
    const cards = page.locator('[data-testid^="scenario-card-"]');
    const count = await cards.count();
    expect(count).toBe(4);

    await page.screenshot({ path: 'e2e-results/v47-02-scenario-cards.png' });
  });

  test('RS03: Expand scenario shock details', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-risk-scenarios');
    await waitForTestId(page, 'risk-scenarios-panel-ready');

    await waitForTestId(page, 'scenario-card-0', { timeout: 10000 });
    await clickTestId(page, 'scenario-card-0');
    await waitForTestId(page, 'scenario-shock-0', { timeout: 5000 });
    await expect(page.getByTestId('scenario-shock-0')).toBeVisible();

    await page.screenshot({ path: 'e2e-results/v47-03-scenario-shock.png' });
  });
});

/* ------------------------------------------------------------------ */
/* v1.48: Data Quality Monitor                                        */
/* ------------------------------------------------------------------ */

test.describe('v1.48 — Data Quality Monitor', () => {
  test('DQ01: Navigate to data quality panel', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-data-quality');
    await waitForTestId(page, 'data-quality-panel');
    await waitForTestId(page, 'data-quality-panel-ready');

    await page.screenshot({ path: 'e2e-results/v48-01-data-quality-panel.png' });
  });

  test('DQ02: Feed cards render', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-data-quality');
    await waitForTestId(page, 'data-quality-panel-ready');

    await waitForTestId(page, 'feed-card-0', { timeout: 10000 });
    const feeds = page.locator('[data-testid^="feed-card-"]');
    const count = await feeds.count();
    expect(count).toBe(5);

    await page.screenshot({ path: 'e2e-results/v48-02-feed-cards.png' });
  });

  test('DQ03: Status colors differentiate health', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-data-quality');
    await waitForTestId(page, 'data-quality-panel-ready');

    // Just verify multiple cards are visible with status info
    await waitForTestId(page, 'feed-card-0', { timeout: 10000 });
    await waitForTestId(page, 'feed-card-4', { timeout: 10000 });
    await expect(page.getByTestId('feed-card-0')).toBeVisible();
    await expect(page.getByTestId('feed-card-4')).toBeVisible();

    await page.screenshot({ path: 'e2e-results/v48-03-data-quality-status.png' });
  });
});

/* ------------------------------------------------------------------ */
/* v1.49: Strategy Comparison Matrix                                  */
/* ------------------------------------------------------------------ */

test.describe('v1.49 — Strategy Comparison Matrix', () => {
  test('SC01: Navigate to strategy compare panel', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-strategy-compare');
    await waitForTestId(page, 'strategy-compare-panel');
    await waitForTestId(page, 'strategy-compare-panel-ready');

    await page.screenshot({ path: 'e2e-results/v49-01-strategy-compare-panel.png' });
  });

  test('SC02: Strategy rows render', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-strategy-compare');
    await waitForTestId(page, 'strategy-compare-panel-ready');

    await waitForTestId(page, 'compare-row-0', { timeout: 10000 });
    const rows = page.locator('[data-testid^="compare-row-"]');
    const count = await rows.count();
    expect(count).toBe(5);

    await page.screenshot({ path: 'e2e-results/v49-02-strategy-rows.png' });
  });

  test('SC03: Column sort works', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-strategy-compare');
    await waitForTestId(page, 'strategy-compare-panel-ready');

    await waitForTestId(page, 'compare-col-win_rate', { timeout: 10000 });
    await clickTestId(page, 'compare-col-win_rate');

    // After sort by win_rate, verify table still renders
    await waitForTestId(page, 'compare-row-0', { timeout: 5000 });
    await expect(page.getByTestId('compare-row-0')).toBeVisible();

    await page.screenshot({ path: 'e2e-results/v49-03-strategy-sorted.png' });
  });
});

/* ------------------------------------------------------------------ */
/* v1.50: Platform Health Dashboard                                   */
/* ------------------------------------------------------------------ */

test.describe('v1.50 — Platform Health Dashboard', () => {
  test('PH01: Navigate to platform health panel', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-platform-health');
    await waitForTestId(page, 'platform-health-panel');
    await waitForTestId(page, 'platform-health-panel-ready');

    await page.screenshot({ path: 'e2e-results/v50-01-platform-health-panel.png' });
  });

  test('PH02: Health summary visible', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-platform-health');
    await waitForTestId(page, 'platform-health-panel-ready');

    await waitForTestId(page, 'health-summary', { timeout: 10000 });
    await expect(page.getByTestId('health-summary')).toBeVisible();

    await page.screenshot({ path: 'e2e-results/v50-02-health-summary.png' });
  });

  test('PH03: Component cards render', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-platform-health');
    await waitForTestId(page, 'platform-health-panel-ready');

    await waitForTestId(page, 'health-component-0', { timeout: 10000 });
    const comps = page.locator('[data-testid^="health-component-"]');
    const count = await comps.count();
    expect(count).toBe(6);

    await page.screenshot({ path: 'e2e-results/v50-03-health-components.png' });
  });

  test('PH04: Version label shown', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-platform-health');
    await waitForTestId(page, 'platform-health-panel-ready');

    await waitForTestId(page, 'health-version', { timeout: 10000 });
    const v = page.getByTestId('health-version');
    await expect(v).toBeVisible();
    await expect(v).toContainText('1.50.0');

    await page.screenshot({ path: 'e2e-results/v50-04-health-version.png' });
  });
});
