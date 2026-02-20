/**
 * V1.53-54 Video Walkthrough
 * Comprehensive product tour capturing 210s+ of video evidence
 * Covers all 10 panel redesigns with deliberate pacing
 */
import { test, expect } from '@playwright/test';

test.use({
  video: { mode: 'on', size: { width: 1920, height: 1080 } },
  viewport: { width: 1920, height: 1080 },
});

test('v1.53-54 UI/UX Walkthrough - Full Product Tour', async ({ page }) => {
  test.setTimeout(360000); // 6 minutes

  const dwell = (ms = 5000) => page.waitForTimeout(ms);

  // Helper to click nav items robustly (handles scrolling + overlaps)
  const clickNav = async (id: string) => {
    const nav = page.getByTestId(`nav-item-${id}`);
    await nav.scrollIntoViewIfNeeded();
    // Dispatch click event directly to avoid main-content overlay at 1920px
    await nav.dispatchEvent('click');
    await page.waitForTimeout(500); // Let view transition
  };

  // ── SECTION 1: App Shell + Dashboard (30s) ──
  await page.goto('http://localhost:5100', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="command-center-view"]', { timeout: 10000 });
  await dwell(6000); // Let viewer see the full dashboard

  // Hover over a few nav items to show active state
  for (const item of ['monitor', 'portfolio', 'strategies']) {
    const nav = page.locator(`[data-testid="nav-item-${item}"]`);
    if (await nav.isVisible()) {
      await nav.hover();
      await dwell(1000);
    }
  }
  // Move mouse away from nav to clear any tooltips
  await page.mouse.move(960, 540);
  await dwell(2000);

  // Scroll dashboard
  await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'smooth' }));
  await dwell(2000);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await dwell(1500);

  // ── SECTION 2: Portfolio (20s) ──
  await clickNav('portfolio');
  await page.waitForSelector('[data-testid="portfolio-view"]', { timeout: 5000 });
  await dwell(3000);
  await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'smooth' }));
  await dwell(2000);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await dwell(1500);

  // ── SECTION 3: Orders (10s) ──
  await clickNav('orders');
  await page.waitForSelector('[data-testid="orders-view"]', { timeout: 5000 });
  await dwell(3000);

  // ── SECTION 4: Runs/Audit (15s) ──
  await clickNav('runs');
  await page.waitForSelector('[data-testid="runs-audit-view"]', { timeout: 5000 });
  await dwell(3000);
  await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'smooth' }));
  await dwell(2000);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await dwell(1500);

  // ── SECTION 5: Strategies (20s) ──
  await clickNav('strategies');
  await page.waitForSelector('[data-testid="strategies-view"]', { timeout: 5000 });
  await dwell(3000);

  // Click first strategy if visible
  const stratItem = page.locator('[data-testid="strategies-view"] button, [data-testid="strategies-view"] li').first();
  if (await stratItem.isVisible()) {
    await stratItem.click();
    await dwell(2000);
  }

  // Library/Builder/Validate tabs
  for (const tabName of ['Library', 'Builder', 'Validate']) {
    const tab = page.locator(`button:has-text("${tabName}")`).first();
    if (await tab.isVisible()) {
      await tab.click();
      await dwell(2000);
    }
  }

  // ── SECTION 6: Options Hub + Risk Desk (35s) ──
  await clickNav('options');
  await page.waitForSelector('[data-testid="options-view"]', { timeout: 5000 });
  await dwell(3000);

  // Risk Desk
  const riskDeskBtn = page.locator('button:has-text("Risk Desk")');
  if (await riskDeskBtn.isVisible()) {
    await riskDeskBtn.click();
    await page.waitForSelector('[data-testid="risk-desk-panel"]', { timeout: 10000 });
    await dwell(3000);

    // Load Demo
    const loadDemoBtn = page.locator('button[data-testid="load-demo-btn"]');
    if (await loadDemoBtn.isVisible()) {
      await loadDemoBtn.click();
      await dwell(3000);

      // Run
      const runBtn = page.locator('button:has-text("Run Risk Analysis")').first();
      if (await runBtn.isVisible()) {
        await runBtn.click();
        await dwell(8000); // Watch analysis run
      }
    }

    // Runs tab
    const runsTab = page.locator('[data-testid="riskdesk-subtab-runs"]');
    if (await runsTab.isVisible()) {
      await runsTab.click();
      await dwell(2000);
    }

    // Export tab
    const exportTab = page.locator('[data-testid="riskdesk-subtab-export"]');
    if (await exportTab.isVisible()) {
      await exportTab.click();
      await dwell(2000);
    }
  }

  // ── SECTION 7: Backtest (30s) ──
  await clickNav('backtest');
  await page.waitForSelector('[data-testid="backtest-panel"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="backtest-ready"]', { state: 'attached', timeout: 10000 });
  await dwell(3000);

  // Configure tab
  const configTab = page.locator('[data-testid="backtest-tab-configure"]');
  if (await configTab.isVisible()) {
    await configTab.click();
    await dwell(2000);
    await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'smooth' }));
    await dwell(2000);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await dwell(1500);
  }

  // Runs tab
  const btRunsTab = page.locator('[data-testid="backtest-tab-runs"]');
  if (await btRunsTab.isVisible()) {
    await btRunsTab.click();
    await dwell(2000);
  }

  // Analyze tab
  const btAnalyzeTab = page.locator('[data-testid="backtest-tab-analyze"]');
  if (await btAnalyzeTab.isVisible()) {
    await btAnalyzeTab.click();
    await dwell(2000);
  }
  await dwell(2000);

  // ── SECTION 8: Autopilot (25s) ──
  await clickNav('autopilot');
  await page.waitForSelector('[data-testid="autopilot-view"]', { timeout: 5000 });
  await dwell(3000);

  for (const tabName of ['Positions', 'Activity', 'Settings']) {
    const tab = page.locator(`button:has-text("${tabName}")`).first();
    if (await tab.isVisible()) {
      await tab.click();
      await dwell(2500);
    }
  }

  // ── SECTION 9: Chart + Replay (15s) ──
  await clickNav('monitor');
  await dwell(6000);

  await clickNav('replay');
  await page.waitForSelector('[data-testid="replay-view"]', { timeout: 5000 });
  await dwell(3000);

  // ── SECTION 10: Alerts + Incidents (15s) ──
  await clickNav('alerts');
  await page.waitForSelector('[data-testid="alerts-view"]', { timeout: 5000 });
  await dwell(3000);

  await clickNav('incidents');
  await page.waitForSelector('[data-testid="incidents-view"]', { timeout: 5000 });
  await dwell(3000);

  // ── SECTION 11: Settings + Platform Health (20s) ──
  await clickNav('settings');
  await page.waitForSelector('[data-testid="settings-view"]', { timeout: 5000 });
  await dwell(3000);
  await page.evaluate(() => window.scrollTo({ top: 800, behavior: 'smooth' }));
  await dwell(2000);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await dwell(1500);

  const healthNav = page.locator('[data-testid="nav-item-platform-health"]');
  if (await healthNav.isVisible()) {
    await healthNav.click();
    await page.waitForSelector('[data-testid="platform-health-panel"]', { timeout: 5000 });
    await dwell(3000);
  }

  // ── SECTION 12: Second pass — Key redesigned panels (80s) ──
  // Re-visit the most redesigned panels for thorough evidence

  // Dashboard again - show the stat pills redesign
  await clickNav('dashboard');
  await page.waitForSelector('[data-testid="command-center-view"]', { timeout: 5000 }).catch(() => {});
  await dwell(6000);

  // Portfolio - stat cards
  await clickNav('portfolio');
  await dwell(5000);
  await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
  await dwell(3000);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await dwell(2000);

  // Options / Risk Desk
  await clickNav('options');
  await dwell(4000);
  const riskDeskBtn2 = page.locator('button:has-text("Risk Desk")');
  if (await riskDeskBtn2.isVisible()) {
    await riskDeskBtn2.click();
    await dwell(5000);
  }

  // Backtest
  await clickNav('backtest');
  await dwell(5000);
  await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
  await dwell(3000);

  // Autopilot - full redesign
  await clickNav('autopilot');
  await dwell(5000);

  // Runs/Audit
  await clickNav('runs');
  await dwell(4000);

  // Settings
  await clickNav('settings');
  await dwell(5000);
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'smooth' }));
  await dwell(3000);

  // Final: Dashboard
  await clickNav('dashboard');
  await dwell(6000);

  // Platform Health one more time
  await clickNav('platform-health');
  await dwell(5000);

  // Incidents
  await clickNav('incidents');
  await dwell(4000);

  // Alerts
  await clickNav('alerts');
  await dwell(4000);

  // Orders
  await clickNav('orders');
  await dwell(4000);

  // End on dashboard
  await clickNav('dashboard');
  await dwell(8000);

  console.log('✅ Full walkthrough complete — video should be 210s+');
});
