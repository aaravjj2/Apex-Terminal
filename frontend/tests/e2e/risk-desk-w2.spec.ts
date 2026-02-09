/**
 * Risk Desk E2E Tests — Week 2 (Playwright)
 *
 * Tests the full 5-tool risk pipeline, 3-column UI, hedge candidates,
 * compliance gate, ticket builder, and tool trace.
 *
 * All tests run against `vite build` + `vite preview` (production build)
 * to avoid Vite HMR page reload issues.
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results-risk-desk', 'screenshots');

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

// ── Navigate to Risk Desk ──────────────────────────────────────────────────

async function navigateToRiskDesk(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Wait for React to mount
  await page.waitForFunction(
    () => (document.getElementById('root')?.childElementCount ?? 0) > 0,
    { timeout: 20000 }
  );
  await page.waitForTimeout(1000);

  // Click Options nav item
  const optionsNav = page.locator('[data-testid="nav-item-options"]');
  await optionsNav.waitFor({ state: 'visible', timeout: 10000 });
  await optionsNav.click();

  // Wait for OptionsView
  await expect(page.locator('text=Options Analytics')).toBeVisible({ timeout: 10000 });

  // Click Risk Desk tab
  const riskDeskTab = page.locator('[data-testid="options-tab-risk-desk"]');
  await riskDeskTab.waitFor({ state: 'visible', timeout: 10000 });
  await riskDeskTab.click();
  await page.waitForTimeout(500);

  // Verify panel
  await expect(page.locator('[data-testid="risk-desk-panel"]')).toBeVisible({ timeout: 10000 });
}

// ── Test 1: Navigate + 3-column layout visible ────────────────────────────

test('1. Navigate to Risk Desk — 3-column layout visible', async ({ page }) => {
  await navigateToRiskDesk(page);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'w2-01-risk-desk-layout.png') });

  await expect(page.locator('[data-testid="risk-desk-title"]')).toContainText('Risk Desk');
  await expect(page.locator('[data-testid="inputs-column"]')).toBeVisible();
  await expect(page.locator('[data-testid="outputs-column"]')).toBeVisible();
  await expect(page.locator('[data-testid="trace-column"]')).toBeVisible();

  // Scenario selector should be visible
  await expect(page.locator('[data-testid="scenario-select"]')).toBeVisible();

  // Run button should be visible but disabled (no portfolio loaded)
  const runBtn = page.locator('[data-testid="run-button"]');
  await expect(runBtn).toBeVisible();
  await expect(runBtn).toBeDisabled();
});

// ── Test 2: Load demo + run pipeline (happy path) ─────────────────────────

test('2. Load demo → Run pipeline → full results visible', async ({ page }) => {
  await navigateToRiskDesk(page);

  // Load demo portfolio
  await page.locator('[data-testid="load-demo-btn"]').click();
  await expect(page.locator('[data-testid="drop-zone"]')).toContainText('demo_portfolio.csv', { timeout: 10000 });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'w2-02a-demo-loaded.png') });

  // Run button should now be enabled
  const runBtn = page.locator('[data-testid="run-button"]');
  await expect(runBtn).toBeEnabled();

  // Click Run
  await runBtn.click();

  // Wait for running indicator then results
  await expect(page.locator('[data-testid="run-status"]')).toBeVisible({ timeout: 30000 });

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'w2-02b-pipeline-complete.png') });

  // Pipeline should complete OK
  await expect(page.locator('[data-testid="run-status"]')).toContainText('Pipeline Complete');

  // Greeks card should be visible with numbers
  await expect(page.locator('[data-testid="greeks-card"]')).toBeVisible();
  await expect(page.locator('[data-testid="net-delta"]')).toBeVisible();
  await expect(page.locator('[data-testid="net-gamma"]')).toBeVisible();

  // Stress card should be visible
  await expect(page.locator('[data-testid="stress-card"]')).toBeVisible();
  await expect(page.locator('[data-testid="stress-pnl"]')).toBeVisible();

  // Hedge candidates should be visible
  await expect(page.locator('[data-testid="hedge-candidates"]')).toBeVisible();
  await expect(page.locator('[data-testid="hedge-name-hedge_A"]')).toContainText('Protective Put Spread');
  await expect(page.locator('[data-testid="hedge-name-hedge_B"]')).toContainText('Call Spread Collar');

  // Verification card
  await expect(page.locator('[data-testid="verification-card"]')).toBeVisible();
  await expect(page.locator('[data-testid="verification-card"]')).toContainText('Passed');

  // Compliance card (demo portfolio has uncovered shorts → blocked)
  await expect(page.locator('[data-testid="compliance-card"]')).toBeVisible();
  await expect(page.locator('[data-testid="compliance-card"]')).toContainText('Blocked');

  // Tool trace should show 5 tools
  await expect(page.locator('[data-testid="trace-T1"]')).toBeVisible();
  await expect(page.locator('[data-testid="trace-T2"]')).toBeVisible();
  await expect(page.locator('[data-testid="trace-T3"]')).toBeVisible();
  await expect(page.locator('[data-testid="trace-T4"]')).toBeVisible();
  await expect(page.locator('[data-testid="trace-T5"]')).toBeVisible();
});

// ── Test 3: Compliance blocked — violations listed ────────────────────────

test('3. Compliance gate blocks uncovered shorts', async ({ page }) => {
  await navigateToRiskDesk(page);

  // Load demo (has uncovered short puts on AAPL, TSLA, GOOGL)
  await page.locator('[data-testid="load-demo-btn"]').click();
  await expect(page.locator('[data-testid="drop-zone"]')).toContainText('demo_portfolio.csv', { timeout: 10000 });
  await page.locator('[data-testid="run-button"]').click();
  await expect(page.locator('[data-testid="compliance-card"]')).toBeVisible({ timeout: 30000 });

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'w2-03-compliance-blocked.png') });

  // Should be blocked
  await expect(page.locator('[data-testid="compliance-card"]')).toContainText('Blocked');

  // Should list UNCOVERED_SHORT violations
  await expect(page.locator('[data-testid="violation-0"]')).toBeVisible();
  await expect(page.locator('[data-testid="violation-0"]')).toContainText('CRITICAL');
  await expect(page.locator('[data-testid="violation-0"]')).toContainText('Uncovered short');
});

// ── Test 4: Tool trace integrity — 5 tools, all OK ───────────────────────

test('4. Tool trace shows 5 tools with OK status', async ({ page }) => {
  await navigateToRiskDesk(page);

  await page.locator('[data-testid="load-demo-btn"]').click();
  await expect(page.locator('[data-testid="drop-zone"]')).toContainText('demo_portfolio.csv', { timeout: 10000 });
  await page.locator('[data-testid="run-button"]').click();
  await expect(page.locator('[data-testid="trace-T5"]')).toBeVisible({ timeout: 30000 });

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'w2-04-trace-all-ok.png') });

  // All 5 tools should show ✓
  for (const tid of ['T1', 'T2', 'T3', 'T4', 'T5']) {
    const trace = page.locator(`[data-testid="trace-${tid}"]`);
    await expect(trace).toBeVisible();
    await expect(trace).toContainText('✓');
  }

  // Download trace button should be visible
  await expect(page.locator('[data-testid="download-trace"]')).toBeVisible();
});

// ── Test 5: Build ticket for hedge A ──────────────────────────────────────

test('5. Build ticket for hedge A', async ({ page }) => {
  await navigateToRiskDesk(page);

  await page.locator('[data-testid="load-demo-btn"]').click();
  await expect(page.locator('[data-testid="drop-zone"]')).toContainText('demo_portfolio.csv', { timeout: 10000 });
  await page.locator('[data-testid="run-button"]').click();
  await expect(page.locator('[data-testid="hedge-candidates"]')).toBeVisible({ timeout: 30000 });

  // Click "Build Ticket" for hedge_A
  await page.locator('[data-testid="build-ticket-hedge_A"]').click();

  // Ticket card should appear
  await expect(page.locator('[data-testid="ticket-card"]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-testid="ticket-card"]')).toContainText('Protective Put Spread');

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'w2-05-ticket-built.png') });

  // Ticket JSON should contain run_id
  const ticketJson = await page.locator('[data-testid="ticket-json"]').textContent();
  expect(ticketJson).toContain('run_id');
  expect(ticketJson).toContain('hedge_A');

  // Copy button should be visible
  await expect(page.locator('[data-testid="copy-ticket"]')).toBeVisible();
});

// ── Test 6: Scenario selector changes stress output ───────────────────────

test('6. Scenario selector switches stress scenario', async ({ page }) => {
  await navigateToRiskDesk(page);

  await page.locator('[data-testid="load-demo-btn"]').click();
  await expect(page.locator('[data-testid="drop-zone"]')).toContainText('demo_portfolio.csv', { timeout: 10000 });

  // Select severe crash scenario
  await page.locator('[data-testid="scenario-select"]').selectOption('severe_crash');

  await page.locator('[data-testid="run-button"]').click();
  await expect(page.locator('[data-testid="stress-card"]')).toBeVisible({ timeout: 30000 });

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'w2-06-severe-crash.png') });

  // Should show severe crash label
  await expect(page.locator('[data-testid="stress-card"]')).toContainText('Severe Crash');

  // P&L should be a larger negative (more severe scenario)
  const pnlText = await page.locator('[data-testid="stress-pnl"]').textContent();
  expect(pnlText).toBeTruthy();
  // The number should be negative (displayed with $- prefix)
  expect(pnlText!).toContain('-');
});
