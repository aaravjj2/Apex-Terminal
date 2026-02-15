import { test, expect } from '@playwright/test';
import { join } from 'path';

const SCREENSHOTS_DIR = 'C:\\Tradingview recreation\\artifacts\\proof\\v1-53-54-uiux\\screenshots_before';

test.describe('BEFORE Screenshots - v1.53-54 Baseline', () => {
  test.setTimeout(600000); // 10 minutes timeout

  test('Capture comprehensive 30+ BEFORE screenshots', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    let screenshotCount = 0;
    const screenshot = async (name: string) => {
      screenshotCount++;
      const paddedNum = String(screenshotCount).padStart(3, '0');
      await page.screenshot({
        path: join(SCREENSHOTS_DIR, `${paddedNum}-${name}.png`),
        fullPage: true,
      });
      console.log(`📸 ${paddedNum}: ${name}`);
    };

    // Navigate to app
    await page.goto('http://localhost:5100');
    await page.waitForSelector('[data-testid="app-shell"]', { state: 'visible', timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 1-3. Dashboard views
    await screenshot('001-dashboard-home');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);
    await screenshot('002-dashboard-scrolled');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // 4. Portfolio
    await page.click('[data-testid="nav-item-portfolio"]');
    await page.waitForTimeout(1500);
    await page.waitForLoadState('networkidle');
    await screenshot('003-portfolio-main');

    // 5. Orders
    await page.click('[data-testid="nav-item-orders"]');
    await page.waitForTimeout(1500);
    await page.waitForLoadState('networkidle');
    await screenshot('004-orders-list');

    // 6-7. Runs/Audit
    await page.click('[data-testid="nav-item-runs"]');
    await page.waitForTimeout(1500);
    await page.waitForLoadState('networkidle');
    await screenshot('005-runs-audit-main');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);
    await screenshot('006-runs-audit-scrolled');
    await page.evaluate(() => window.scrollTo(0, 0));

    // 8. Strategies
    await page.click('[data-testid="nav-item-strategies"]');
    await page.waitForTimeout(1500);
    await page.waitForLoadState('networkidle');
    await screenshot('007-strategies-list');

    // 9-16. Options Hub - Risk Desk
    await page.click('[data-testid="nav-item-options"]');
    await page.waitForTimeout(1500);
    await page.waitForLoadState('networkidle');
    await screenshot('008-options-hub');

    const riskDeskTab = page.locator('[data-testid="options-main-tab-risk-desk"]').first();
    if (await riskDeskTab.isVisible()) {
      await riskDeskTab.click();
      await page.waitForTimeout(1500);
      await screenshot('009-risk-desk-initial');

      // Load demo
      const loadDemoBtn = page.locator('button:has-text("Load Demo")').first();
      if (await loadDemoBtn.isVisible()) {
        await loadDemoBtn.click();
        await page.waitForTimeout(1500);
        await screenshot('010-risk-desk-demo-loaded');

        // Run
        const runBtn = page.locator('button:has-text("Run")').first();
        if (await runBtn.isVisible()) {
          await runBtn.click();
          await page.waitForTimeout(3000);
          await screenshot('011-risk-desk-running');

          // Timeline tab
          const timelineTab = page.locator('[data-testid="risk-tab-timeline"]').first();
          if (await timelineTab.isVisible()) {
            await timelineTab.click();
            await page.waitForTimeout(1500);
            await screenshot('012-risk-desk-timeline');
          }

          // Status tab
          const statusTab = page.locator('[data-testid="risk-tab-status"]').first();
          if (await statusTab.isVisible()) {
            await statusTab.click();
            await page.waitForTimeout(1500);
            await screenshot('013-risk-desk-status');
          }

          // Export tab
          const exportTab = page.locator('[data-testid="risk-tab-export"]').first();
          if (await exportTab.isVisible()) {
            await exportTab.click();
            await page.waitForTimeout(1500);
            await screenshot('014-risk-desk-export');
          }
        }
      }
    }

    // 17-20. Strategy Lab
    const strategyLabTab = page.locator('[data-testid="options-main-tab-strategy-lab"]').first();
    if (await strategyLabTab.isVisible()) {
      await strategyLabTab.click();
      await page.waitForTimeout(1500);
      await screenshot('015-strategy-lab-initial');

      // Library tab
      const libraryTab = page.locator('button:has-text("Library")').first();
      if (await libraryTab.isVisible()) {
        await libraryTab.click();
        await page.waitForTimeout(1500);
        await screenshot('016-strategy-lab-library');
      }

      // Builder tab
      const builderTab = page.locator('button:has-text("Builder")').first();
      if (await builderTab.isVisible()) {
        await builderTab.click();
        await page.waitForTimeout(1500);
        await screenshot('017-strategy-lab-builder');
      }

      // Validation tab (if exists)
      const validationTab = page.locator('button:has-text("Validate")').first();
      if (await validationTab.isVisible()) {
        await validationTab.click();
        await page.waitForTimeout(1500);
        await screenshot('018-strategy-lab-validation');
      }
    }

    // 21-25. Backtest views
    await page.click('[data-testid="nav-item-backtest"]');
    await page.waitForTimeout(1500);
    await page.waitForLoadState('networkidle');
    await screenshot('019-backtest-initial');

    // Configure tab
    const configureTab = page.locator('button:has-text("Configure")').first();
    if (await configureTab.isVisible()) {
      await configureTab.click();
      await page.waitForTimeout(1500);
      await screenshot('020-backtest-configure');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await page.waitForTimeout(500);
      await screenshot('021-backtest-configure-scrolled');
      await page.evaluate(() => window.scrollTo(0, 0));
    }

    // Runs tab
    const runsTab = page.locator('button:has-text("Runs")').first();
    if (await runsTab.isVisible()) {
      await runsTab.click();
      await page.waitForTimeout(1500);
      await screenshot('022-backtest-runs');
    }

    // Analyze tab
    const analyzeTab = page.locator('button:has-text("Analyze")').first();
    if (await analyzeTab.isVisible()) {
      await analyzeTab.click();
      await page.waitForTimeout(1500);
      await screenshot('023-backtest-analyze');
    }

    // 26-30. Autopilot views
    await page.click('[data-testid="nav-item-autopilot"]');
    await page.waitForTimeout(1500);
    await page.waitForLoadState('networkidle');
    await screenshot('024-autopilot-dashboard');

    // Positions tab
    const positionsTab = page.locator('button:has-text("Positions")').first();
    if (await positionsTab.isVisible()) {
      await positionsTab.click();
      await page.waitForTimeout(1500);
      await screenshot('025-autopilot-positions');
    }

    // Activity tab
    const activityTab = page.locator('button:has-text("Activity")').first();
    if (await activityTab.isVisible()) {
      await activityTab.click();
      await page.waitForTimeout(1500);
      await screenshot('026-autopilot-activity');
    }

    // Settings/Config tab
    const autopilotSettingsTab = page.locator('button:has-text("Settings"), button:has-text("Config")').first();
    if (await autopilotSettingsTab.isVisible()) {
      await autopilotSettingsTab.click();
      await page.waitForTimeout(1500);
      await screenshot('027-autopilot-settings');
    }

    // 31-32. Chart/Monitor
    await page.click('[data-testid="nav-item-monitor"]');
    await page.waitForTimeout(1500);
    await screenshot('033-chart-monitor');

    // 33. Replay
    await page.click('[data-testid="nav-item-replay"]');
    await page.waitForTimeout(1500);
    await screenshot('034-replay-main');

    // 34. Alerts
    await page.click('[data-testid="nav-item-alerts"]');
    await page.waitForTimeout(1500);
    await screenshot('035-alerts-main');

    // 35. Incidents
    await page.click('[data-testid="nav-item-incidents"]');
    await page.waitForTimeout(1500);
    await screenshot('036-incidents-main');

    // 36-37. Settings
    await page.click('[data-testid="nav-item-settings"]');
    await page.waitForTimeout(1500);
    await screenshot('037-settings-main');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);
    await screenshot('038-settings-scrolled');

    console.log(`\n✅ Total BEFORE screenshots captured: ${screenshotCount}`);
    expect(errors).toEqual([]);
    expect(screenshotCount).toBeGreaterThanOrEqual(30);
  });
});
