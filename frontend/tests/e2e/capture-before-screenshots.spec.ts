import { test, expect } from '@playwright/test';
import { join } from 'path';

const SCREENSHOTS_DIR = 'C:\\Tradingview recreation\\artifacts\\proof\\v1-51-52-uiux\\screenshots_before';

test.describe('BEFORE Screenshots - Current UI State', () => {
  test.setTimeout(300000); // 5 minutes timeout

  test('Capture comprehensive BEFORE screenshots', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    let screenshotCount = 0;
    const screenshot = async (name: string) => {
      screenshotCount++;
      const paddedNum = String(screenshotCount).padStart(2, '0');
      await page.screenshot({
        path: join(SCREENSHOTS_DIR, `${paddedNum}-${name}.png`),
        fullPage: true,
      });
    };

    // Navigate to app
    await page.goto('http://localhost:5100');
    await page.waitForSelector('[data-testid="app-shell"]', { state: 'visible', timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // 1. Dashboard - Home
    await screenshot('dashboard-home');
    
    // Scroll down to capture full dashboard
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);
    await screenshot('dashboard-scrolled');
    await page.evaluate(() => window.scrollTo(0, 0));

    // 2. Portfolio
    await page.click('[data-testid="nav-item-portfolio"]');
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');
    await screenshot('portfolio-main');

    // 3. Orders
    await page.click('[data-testid="nav-item-orders"]');
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');
    await screenshot('orders-view');

    // 4. Runs/Audit
    await page.click('[data-testid="nav-item-runs"]');
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');
    await screenshot('runs-audit-main');

    // 5. Strategies
    await page.click('[data-testid="nav-item-strategies"]');
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');
    await screenshot('strategies-list');

    // 6. Options Hub
    await page.click('[data-testid="nav-item-options"]');
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');
    await screenshot('options-hub-main');

    // 7. Risk Desk (within Options)
    const riskDeskTab = page.locator('[data-testid="options-main-tab-risk-desk"]').first();
    if (await riskDeskTab.isVisible()) {
      await riskDeskTab.click();
      await page.waitForTimeout(1000);
      await page.waitForLoadState('networkidle');
      await screenshot('risk-desk-initial');

      // Load demo
      const loadDemoBtn = page.locator('button:has-text("Load Demo")').first();
      if (await loadDemoBtn.isVisible()) {
        await loadDemoBtn.click();
        await page.waitForTimeout(1000);
        await screenshot('risk-desk-demo-loaded');

        // Run
        const runBtn = page.locator('button:has-text("Run")').first();
        if (await runBtn.isVisible()) {
          await runBtn.click();
          await page.waitForTimeout(3000); // Wait for run to complete
          await screenshot('risk-desk-running');

          // Check Timeline tab
          const timelineTab = page.locator('[data-testid="risk-tab-timeline"]').first();
          if (await timelineTab.isVisible()) {
            await timelineTab.click();
            await page.waitForTimeout(1000);
            await screenshot('risk-desk-timeline');
          }

          // Check Status tab
          const statusTab = page.locator('[data-testid="risk-tab-status"]').first();
          if (await statusTab.isVisible()) {
            await statusTab.click();
            await page.waitForTimeout(1000);
            await screenshot('risk-desk-status');
          }

          // Check Export tab
          const exportTab = page.locator('[data-testid="risk-tab-export"]').first();
          if (await exportTab.isVisible()) {
            await exportTab.click();
            await page.waitForTimeout(1000);
            await screenshot('risk-desk-export');
          }
        }
      }
    }

    // 8. Strategy Lab
    const strategyLabTab = page.locator('[data-testid="options-main-tab-strategy-lab"]').first();
    if (await strategyLabTab.isVisible()) {
      await strategyLabTab.click();
      await page.waitForTimeout(1000);
      await page.waitForLoadState('networkidle');
      await screenshot('strategy-lab-initial');

      // Library tab
      const libraryTab = page.locator('button:has-text("Library")').first();
      if (await libraryTab.isVisible()) {
        await libraryTab.click();
        await page.waitForTimeout(1000);
        await screenshot('strategy-lab-library');
      }

      // Builder tab
      const builderTab = page.locator('button:has-text("Builder")').first();
      if (await builderTab.isVisible()) {
        await builderTab.click();
        await page.waitForTimeout(1000);
        await screenshot('strategy-lab-builder');
      }
    }

    // 9. Backtest
    await page.click('[data-testid="nav-item-backtest"]');
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');
    await screenshot('backtest-initial');

    // Configure tab
    const configureTab = page.locator('button:has-text("Configure")').first();
    if (await configureTab.isVisible()) {
      await configureTab.click();
      await page.waitForTimeout(1000);
      await screenshot('backtest-configure');
    }

    // Runs tab
    const runsTab = page.locator('button:has-text("Runs")').first();
    if (await runsTab.isVisible()) {
      await runsTab.click();
      await page.waitForTimeout(1000);
      await screenshot('backtest-runs');
    }

    // Analyze tab
    const analyzeTab = page.locator('button:has-text("Analyze")').first();
    if (await analyzeTab.isVisible()) {
      await analyzeTab.click();
      await page.waitForTimeout(1000);
      await screenshot('backtest-analyze');
    }

    // 10. Autopilot
    await page.click('[data-testid="nav-item-autopilot"]');
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');
    await screenshot('autopilot-dashboard');

    // Positions tab
    const positionsTab = page.locator('button:has-text("Positions")').first();
    if (await positionsTab.isVisible()) {
      await positionsTab.click();
      await page.waitForTimeout(1000);
      await screenshot('autopilot-positions');
    }

    // Activity tab
    const activityTab = page.locator('button:has-text("Activity")').first();
    if (await activityTab.isVisible()) {
      await activityTab.click();
      await page.waitForTimeout(1000);
      await screenshot('autopilot-activity');
    }

    // Settings tab (within Autopilot)
    const autopilotSettingsTab = page.locator('button:has-text("Settings"), button:has-text("Config")').first();
    if (await autopilotSettingsTab.isVisible()) {
      await autopilotSettingsTab.click();
      await page.waitForTimeout(1000);
      await screenshot('autopilot-settings');
    }

    // 11. Replay
    await page.click('[data-testid="nav-item-replay"]');
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');
    await screenshot('replay-main');

    // 12. Alerts
    await page.click('[data-testid="nav-item-alerts"]');
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');
    await screenshot('alerts-main');

    // 13. Incidents
    await page.click('[data-testid="nav-item-incidents"]');
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');
    await screenshot('incidents-main');

    // 14. Settings
    await page.click('[data-testid="nav-item-settings"]');
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');
    await screenshot('settings-main');

    // Scroll settings
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);
    await screenshot('settings-scrolled');

    console.log(`Total BEFORE screenshots captured: ${screenshotCount}`);
    expect(errors).toEqual([]);
    expect(screenshotCount).toBeGreaterThanOrEqual(25);
  });
});
