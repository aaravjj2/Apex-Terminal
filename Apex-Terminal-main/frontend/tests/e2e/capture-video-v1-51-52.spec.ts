import { test, expect } from '@playwright/test';
import { join } from 'path';

test.use({ video: 'on' });

const VIDEO_DIR = 'C:\\Tradingview recreation\\artifacts\\proof\\v1-51-52-uiux\\video';

test.describe('v1.51-52 UI/UX Redesign Demo Video', () => {
  test.setTimeout(300000); // 5 minutes timeout

  test('Capture comprehensive 180+ second demo walkthrough', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    console.log('🎬 Starting v1.51-52 UI/UX redesign demo video capture...');

    // Navigate to app
    await page.goto('http://localhost:5100');
    await page.waitForSelector('[data-testid="app-shell"]', { state: 'visible', timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000); // Show home - 5s

    console.log('✅ Dashboard loaded');

    // Scroll dashboard to show full content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 3));
    await page.waitForTimeout(3000); // 8s
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(3000); // 11s
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(3000); // 14s

    // Portfolio
    await page.click('[data-testid="nav-item-portfolio"]');
    await page.waitForTimeout(5000); // 19s
    console.log('✅ Portfolio view');

    // Orders
    await page.click('[data-testid="nav-item-orders"]');
    await page.waitForTimeout(5000); // 24s
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(3000); // 27s
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(2000); // 29s
    console.log('✅ Orders view');

    // Runs/Audit - Critical view
    await page.click('[data-testid="nav-item-runs"]');
    await page.waitForTimeout(5000); // 34s
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(4000); // 38s
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(2000); // 40s
    console.log('✅ Runs/Audit view');

    // Strategies
    await page.click('[data-testid="nav-item-strategies"]');
    await page.waitForTimeout(5000); // 45s
    console.log('✅ Strategies view');

    // Options Hub
    await page.click('[data-testid="nav-item-options"]');
    await page.waitForTimeout(5000); // 50s
    console.log('✅ Options Hub');

    // Risk Desk - The star of the show (longest section)
    const riskDeskTab = page.locator('[data-testid="options-main-tab-risk-desk"]').first();
    if (await riskDeskTab.isVisible()) {
      await riskDeskTab.click();
      await page.waitForTimeout(5000); // 55s
      console.log('✅ Risk Desk opened');

      // Load Demo
      const loadDemoBtn = page.locator('button:has-text("Load Demo")').first();
      if (await loadDemoBtn.isVisible()) {
        await loadDemoBtn.click();
        await page.waitForTimeout(5000); // 60s
        console.log('✅ Demo data loaded');

        // Run - Critical action
        const runBtn = page.locator('button:has-text("Run")').first();
        if (await runBtn.isVisible()) {
          await runBtn.click();
          await page.waitForTimeout(8000); // 68s - Show execution + results
          console.log('✅ Risk Desk executed');

          // Timeline tab
          const timelineTab = page.locator('[data-testid="risk-tab-timeline"]').first();
          if (await timelineTab.isVisible()) {
            await timelineTab.click();
            await page.waitForTimeout(5000); // 73s
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
            await page.waitForTimeout(3000); // 76s
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.waitForTimeout(2000); // 78s
            console.log('✅ Timeline tab');
          }

          // Status tab
          const statusTab = page.locator('[data-testid="risk-tab-status"]').first();
          if (await statusTab.isVisible()) {
            await statusTab.click();
            await page.waitForTimeout(5000); // 83s
            console.log('✅ Status tab');
          }

          // Export tab
          const exportTab = page.locator('[data-testid="risk-tab-export"]').first();
          if (await exportTab.isVisible()) {
            await exportTab.click();
            await page.waitForTimeout(5000); // 88s
            console.log('✅ Export tab');
          }
        }
      }
    }

    // Strategy Lab
    const strategyLabTab = page.locator('[data-testid="options-main-tab-strategy-lab"]').first();
    if (await strategyLabTab.isVisible()) {
      await strategyLabTab.click();
      await page.waitForTimeout(5000); // 93s
      console.log('✅ Strategy Lab');

      // Library tab
      const libraryTab = page.locator('button:has-text("Library")').first();
      if (await libraryTab.isVisible()) {
        await libraryTab.click();
        await page.waitForTimeout(4000); // 97s
      }

      // Builder tab
      const builderTab = page.locator('button:has-text("Builder")').first();
      if (await builderTab.isVisible()) {
        await builderTab.click();
        await page.waitForTimeout(4000); // 101s
      }
    }

    // Backtest - Critical feature
    await page.click('[data-testid="nav-item-backtest"]');
    await page.waitForTimeout(5000); // 106s
    console.log('✅ Backtest view');

    // Configure tab
    const configureTab = page.locator('button:has-text("Configure")').first();
    if (await configureTab.isVisible()) {
      await configureTab.click();
      await page.waitForTimeout(5000); // 111s
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await page.waitForTimeout(3000); // 114s
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(2000); // 116s
    }

    // Runs tab
    const runsTab = page.locator('button:has-text("Runs")').first();
    if (await runsTab.isVisible()) {
      await runsTab.click();
      await page.waitForTimeout(5000); // 121s
    }

    // Analyze tab
    const analyzeTab = page.locator('button:has-text("Analyze")').first();
    if (await analyzeTab.isVisible()) {
      await analyzeTab.click();
      await page.waitForTimeout(5000); // 126s
    }

    // Autopilot - Major feature
    await page.click('[data-testid="nav-item-autopilot"]');
    await page.waitForTimeout(5000); // 131s
    console.log('✅ Autopilot view');

    // Positions tab
    const positionsTab = page.locator('button:has-text("Positions")').first();
    if (await positionsTab.isVisible()) {
      await positionsTab.click();
      await page.waitForTimeout(5000); // 136s
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await page.waitForTimeout(3000); // 139s
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(2000); // 141s
    }

    // Activity tab
    const activityTab = page.locator('button:has-text("Activity")').first();
    if (await activityTab.isVisible()) {
      await activityTab.click();
      await page.waitForTimeout(5000); // 146s
    }

    // Settings tab in Autopilot
    const autopilotSettingsTab = page.locator('button:has-text("Settings"), button:has-text("Config")').first();
    if (await autopilotSettingsTab.isVisible()) {
      await autopilotSettingsTab.click();
      await page.waitForTimeout(5000); // 151s
    }

    // Replay
    await page.click('[data-testid="nav-item-replay"]');
    await page.waitForTimeout(5000); // 156s
    console.log('✅ Replay view');

    // Alerts
    await page.click('[data-testid="nav-item-alerts"]');
    await page.waitForTimeout(5000); // 161s
    console.log('✅ Alerts view');

    // Incidents
    await page.click('[data-testid="nav-item-incidents"]');
    await page.waitForTimeout(5000); // 166s
    console.log('✅ Incidents view');

    // Settings
    await page.click('[data-testid="nav-item-settings"]');
    await page.waitForTimeout(5000); // 171s
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(3000); // 174s
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(2000); // 176s
    console.log('✅ Settings view');

    // Back to Dashboard for final view
    await page.click('[data-testid="nav-item-dashboard"]');
    await page.waitForTimeout(6000); // 182s - Final showcase
    console.log('✅ Back to Dashboard - Demo complete');

    console.log('🎥 Video capture completed - 180+ seconds achieved');
    expect(errors).toEqual([]);
  });
});
