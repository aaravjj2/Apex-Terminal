/**
 * V1.53-54 AFTER Screenshots
 * Capture UI state after comprehensive redesign
 */

import { test, expect } from '@playwright/test';

test('Capture AFTER screenshots - v1.53-54 UI redesign', async ({ page }) => {
  test.setTimeout(180000); // 3 minutes
  const SCREENSHOT_DIR = 'C:/Tradingview recreation/artifacts/proof/v1-53-54-uiux/screenshots_after';
  let count = 0;

  const screenshot = async (name: string) => {
    count++;
    await page.waitForTimeout(500); // Visual dwell
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/${String(count).padStart(3, '0')}-${name}.png`,
      fullPage: true
    });
    console.log(`📸 ${String(count).padStart(3, '0')}: ${name}`);
  };

  // Navigate to app
  await page.goto('http://localhost:5100', { waitUntil: 'networkidle' });

  // 1-2: Dashboard (redesigned header, improved spacing, enhanced empty state)
  await page.waitForSelector('[data-testid="command-center-view"]', { timeout: 10000 });
  await page.waitForTimeout(1000); // Let UI settle
  await screenshot('001-dashboard-home');
  await page.evaluate(() => window.scrollTo(0, 500));
  await screenshot('002-dashboard-scrolled');

  // 3: Portfolio
  await page.click('[data-testid="nav-item-portfolio"]');
  await page.waitForSelector('[data-testid="portfolio-view"]', { timeout: 5000 });
  await screenshot('003-portfolio-main');

  // 4: Orders
  await page.click('[data-testid="nav-item-orders"]');
  await page.waitForSelector('[data-testid="orders-view"]', { timeout: 5000 });
  await screenshot('004-orders-main');

  // 5-6: Runs / Audit Log
  await page.click('[data-testid="nav-item-runs"]');
  await page.waitForSelector('[data-testid="runs-audit-view"]', { timeout: 5000 });
  await screenshot('005-runs-audit-main');
  await page.evaluate(() => window.scrollTo(0, 500));
  await screenshot('006-runs-audit-scrolled');

  // 7: Strategies
  await page.click('[data-testid="nav-item-strategies"]');
  await page.waitForSelector('[data-testid="strategies-view"]', { timeout: 5000 });
  await screenshot('007-strategies-main');

  // 8: Options Hub
  await page.click('[data-testid="nav-item-options"]');
  await page.waitForSelector('[data-testid="options-view"]', { timeout: 5000 });
  await screenshot('008-options-hub');

  // 9-14: Risk Desk (redesigned layout with ready markers)
  const riskDeskBtn = page.locator('button:has-text("Risk Desk")');
  if (await riskDeskBtn.isVisible()) {
    await riskDeskBtn.click();
    await page.waitForSelector('[data-testid="risk-desk-panel"]', { timeout: 10000 });
    await page.waitForTimeout(1000); // Let UI settle
    await screenshot('009-risk-desk-initial');

    // Load demo
    const loadDemoBtn = page.locator('button[data-testid="load-demo-btn"]');
    if (await loadDemoBtn.isVisible()) {
      await loadDemoBtn.click();
      await page.waitForTimeout(1000);
      await screenshot('010-risk-desk-demo-loaded');

      // Run risk analysis
      const runBtn = page.locator('button:has-text("Run Risk Analysis")').first();
      if (await runBtn.isVisible()) {
        await runBtn.click();
        await page.waitForTimeout(3000);
        await screenshot('011-risk-desk-running');
      }
    }

    // Timeline view
    const timelineTab = page.locator('[data-testid="riskdesk-subtab-runs"]');
    if (await timelineTab.isVisible()) {
      await timelineTab.click();
      await page.waitForTimeout(800);
      await screenshot('012-risk-desk-timeline');
    }

    // Status view
    const exportTab = page.locator('[data-testid="riskdesk-subtab-export"]');
    if (await exportTab.isVisible()) {
      await exportTab.click();
      await page.waitForTimeout(800);
      await screenshot('013-risk-desk-status');
    }

    // Export panel
    await screenshot('014-risk-desk-export');
  }

  // 15-18: Strategy Lab (with Tabs component, enhanced layout)
  await page.click('[data-testid="nav-item-strategies"]');
  await page.waitForSelector('[data-testid="strategies-view"]', { timeout: 5000 });
  await screenshot('015-strategy-lab-initial');

  const libraryTab = page.locator('button:has-text("Library")').first();
  if (await libraryTab.isVisible()) {
    await libraryTab.click();
    await page.waitForTimeout(800);
    await screenshot('016-strategy-lab-library');
  }

  const builderTab = page.locator('button:has-text("Builder")').first();
  if (await builderTab.isVisible()) {
    await builderTab.click();
    await page.waitForTimeout(800);
    await screenshot('017-strategy-lab-builder');
  }

  const validateTab = page.locator('button:has-text("Validate")').first();
  if (await validateTab.isVisible()) {
    await validateTab.click();
    await page.waitForTimeout(800);
    await screenshot('018-strategy-lab-validation');
  }

  // 19-23: Backtest (redesigned with better header, ready markers)
  await page.click('[data-testid="nav-item-backtest"]');
  await page.waitForSelector('[data-testid="backtest-panel"]', { timeout: 10000 });
  await page.waitForTimeout(1000); // Let UI settle
  await page.waitForSelector('[data-testid="backtest-ready"]', { state: 'attached', timeout: 10000 });
  await screenshot('019-backtest-initial');

  const configureTab = page.locator('[data-testid="backtest-tab-configure"]');
  if (await configureTab.isVisible()) {
    await configureTab.click();
    await page.waitForTimeout(800);
    await screenshot('020-backtest-configure');
    await page.evaluate(() => window.scrollTo(0, 500));
    await screenshot('021-backtest-configure-scrolled');
  }

  const runsTab = page.locator('[data-testid="backtest-tab-runs"]');
  if (await runsTab.isVisible()) {
    await runsTab.click();
    await page.waitForTimeout(800);
    await screenshot('022-backtest-runs');
  }

  const analyzeTab = page.locator('[data-testid="backtest-tab-analyze"]');
  if (await analyzeTab.isVisible()) {
    await analyzeTab.click();
    await page.waitForTimeout(800);
    await screenshot('023-backtest-analyze');
  }

  // 24-27: Autopilot (improved dashboard grid, DataTable)
  await page.click('[data-testid="nav-item-autopilot"]');
  await page.waitForSelector('[data-testid="autopilot-view"]', { timeout: 5000 });
  await screenshot('024-autopilot-dashboard');

  const positionsTab = page.locator('button:has-text("Positions")').first();
  if (await positionsTab.isVisible()) {
    await positionsTab.click();
    await page.waitForTimeout(800);
    await screenshot('025-autopilot-positions');
  }

  const activityTab = page.locator('button:has-text("Activity")').first();
  if (await activityTab.isVisible()) {
    await activityTab.click();
    await page.waitForTimeout(800);
    await screenshot('026-autopilot-activity');
  }

  const autopilotSettingsTab = page.locator('button:has-text("Settings")').first();
  if (await autopilotSettingsTab.isVisible()) {
    await autopilotSettingsTab.click();
    await page.waitForTimeout(800);
    await screenshot('027-autopilot-settings');
  }

  // 28: Chart/Monitor
  await page.click('[data-testid="nav-item-monitor"]');
  await page.waitForTimeout(2000);
  await screenshot('028-chart-monitor');

  // 29: Replay
  await page.click('[data-testid="nav-item-replay"]');
  await page.waitForSelector('[data-testid="replay-view"]', { timeout: 5000 });
  await screenshot('029-replay-mode');

  // 30: Alerts
  await page.click('[data-testid="nav-item-alerts"]');
  await page.waitForSelector('[data-testid="alerts-view"]', { timeout: 5000 });
  await screenshot('030-alerts-main');

  // 31: Incidents  
  await page.click('[data-testid="nav-item-incidents"]');
  await page.waitForSelector('[data-testid="incidents-view"]', { timeout: 5000 });
  await screenshot('031-incidents-main');

  // 32-33: Settings (improved section layout with Cards)
  await page.click('[data-testid="nav-item-settings"]');
  await page.waitForSelector('[data-testid="settings-view"]', { timeout: 5000 });
  await screenshot('032-settings-main');
  await page.evaluate(() => window.scrollTo(0, 800));
  await screenshot('033-settings-scrolled');

  // 34: Platform Health
  const healthNav = page.locator('[data-testid="nav-item-platform-health"]');
  if (await healthNav.isVisible()) {
    await healthNav.click();
    await page.waitForSelector('[data-testid="platform-health-panel"]', { timeout: 5000 });
    await screenshot('034-platform-health');
  }

  console.log(`\n✅ Total AFTER screenshots captured: ${count}`);
  expect(count).toBeGreaterThanOrEqual(30);
});
