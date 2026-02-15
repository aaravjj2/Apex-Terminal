/**
 * Hackathon Media Capture Suite
 * Produces 40+ screenshots + 3+ minute video demonstrating all major features
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE = 'http://localhost:5100';
const OUTPUT_DIR = 'C:\\Tradingview recreation\\artifacts\\hackathon-submission-pack\\screenshots';
let screenshotCounter = 1;

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function getScreenshotPath(name: string): string {
  const paddedNum = String(screenshotCounter++).padStart(2, '0');
  return path.join(OUTPUT_DIR, `${paddedNum}-${name}.png`);
}

test.use({ 
  viewport: { width: 1920, height: 1080 },
  video: {
    mode: 'on',
    size: { width: 1920, height: 1080 }
  }
});

test.setTimeout(300000); // 5 minutes timeout for the full capture

test.describe('Hackathon Media Capture', () => {
  test('Full demo walkthrough - 3+ minutes', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // SECTION 1: Initial Load & Dashboard (15s)
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.getByTestId('left-nav').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(2000); // Let page settle
    await page.screenshot({ path: getScreenshotPath('dashboard-home'), fullPage: false });
    
    await page.waitForTimeout(2000);
    await page.screenshot({ path: getScreenshotPath('dashboard-full-view'), fullPage: true });
    await page.waitForTimeout(2000);

    // SECTION 2: Portfolio View (10s)
    await page.getByTestId('nav-item-portfolio').click();
    await page.waitForLoadState('networkidle');
    await page.getByTestId('portfolio-view').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: getScreenshotPath('portfolio-main'), fullPage: false });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: getScreenshotPath('portfolio-full'), fullPage: true });
    await page.waitForTimeout(2000);

    // SECTION 3: Orders View (8s)
    await page.getByTestId('nav-item-orders').click();
    await page.waitForLoadState('networkidle');
    await page.getByTestId('orders-view').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: getScreenshotPath('orders-view'), fullPage: false });
    await page.waitForTimeout(2000);

    // SECTION 4: Runs/Audit View (10s)
    await page.getByTestId('nav-item-runs').click();
    await page.waitForLoadState('networkidle');
    await page.getByTestId('runs-audit-view').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: getScreenshotPath('runs-audit-main'), fullPage: false });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: getScreenshotPath('runs-audit-full'), fullPage: true });
    await page.waitForTimeout(2000);

    // SECTION 5: Strategies View (8s)
    await page.getByTestId('nav-item-strategies').click();
    await page.waitForLoadState('networkidle');
    await page.getByTestId('strategies-view').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: getScreenshotPath('strategies-list'), fullPage: false });
    await page.waitForTimeout(2000);

    // SECTION 6: Options View - Risk Desk Workflow (60s)
    await page.getByTestId('nav-item-options').click();
    await page.waitForLoadState('networkidle');
    await page.getByTestId('options-view').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: getScreenshotPath('options-analytics-main'), fullPage: false });
    await page.waitForTimeout(2000);

    // Options - Chain tab
    const chainTab = page.getByTestId('options-tab-chain');
    if (await chainTab.isVisible()) {
      await chainTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: getScreenshotPath('options-chain'), fullPage: false });
      await page.waitForTimeout(2000);
    }

    // Options - Strategy Builder
    const strategyTab = page.getByTestId('options-tab-strategy');
    if (await strategyTab.isVisible()) {
      await strategyTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: getScreenshotPath('options-strategy-builder'), fullPage: false });
      await page.waitForTimeout(2000);
    }

    // Options - Risk Desk Main Workflow
    const riskDeskMainTab = page.getByTestId('options-main-tab-risk-desk');
    if (await riskDeskMainTab.isVisible()) {
      await riskDeskMainTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: getScreenshotPath('risk-desk-initial'), fullPage: false });
      await page.waitForTimeout(2000);

      // Risk Desk - Load Demo
      const loadDemoBtn = page.getByTestId('risk-load-demo-btn');
      if (await loadDemoBtn.isVisible()) {
        await loadDemoBtn.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000); // Let demo data populate
        await page.screenshot({ path: getScreenshotPath('risk-desk-demo-loaded'), fullPage: false });
        await page.waitForTimeout(2000);

        // Risk Desk - Run
        const runBtn = page.getByTestId('risk-run-btn');
        if (await runBtn.isVisible()) {
          await runBtn.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(3000); // Let run start
          await page.screenshot({ path: getScreenshotPath('risk-desk-running'), fullPage: false });
          await page.waitForTimeout(5000); // Let run complete
          await page.screenshot({ path: getScreenshotPath('risk-desk-completed'), fullPage: false });
          await page.waitForTimeout(2000);

          // Risk Desk - Timeline tab
          const timelineTab = page.locator('[role="tab"]:has-text("Timeline")').or(page.locator('button:has-text("Timeline")')).first();
          if (await timelineTab.isVisible()) {
            await timelineTab.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000);
            await page.screenshot({ path: getScreenshotPath('risk-desk-timeline'), fullPage: false });
            await page.waitForTimeout(2000);
          }

          // Risk Desk - Status tab
          const statusTab = page.locator('[role="tab"]:has-text("Status")').or(page.locator('button:has-text("Status")')).first();
          if (await statusTab.isVisible()) {
            await statusTab.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000);
            await page.screenshot({ path: getScreenshotPath('risk-desk-status'), fullPage: false });
            await page.waitForTimeout(2000);
          }

          // Risk Desk - Export tab
          const exportTab = page.locator('[role="tab"]:has-text("Export")').or(page.locator('button:has-text("Export")')).first();
          if (await exportTab.isVisible()) {
            await exportTab.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000);
            await page.screenshot({ path: getScreenshotPath('risk-desk-export'), fullPage: false });
            await page.waitForTimeout(2000);
          }
        }
      }
    }

    // Options - Strategy Lab (20s)
    const strategyLabMainTab = page.getByTestId('options-main-tab-strategy-lab');
    if (await strategyLabMainTab.isVisible()) {
      await strategyLabMainTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: getScreenshotPath('strategy-lab-initial'), fullPage: false });
      await page.waitForTimeout(2000);

      // Strategy Lab - Library tab
      const libraryTab = page.locator('[role="tab"]:has-text("Library")').or(page.locator('button:has-text("Library")')).first();
      if (await libraryTab.isVisible()) {
        await libraryTab.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: getScreenshotPath('strategy-lab-library'), fullPage: false });
        await page.waitForTimeout(2000);
      }

      // Strategy Lab - Builder tab
      const builderTab = page.locator('[role="tab"]:has-text("Builder")').or(page.locator('button:has-text("Builder")')).first();
      if (await builderTab.isVisible()) {
        await builderTab.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: getScreenshotPath('strategy-lab-builder'), fullPage: false });
        await page.waitForTimeout(2000);
      }

      // Strategy Lab - Validate tab
      const validateTab = page.locator('[role="tab"]:has-text("Validate")').or(page.locator('button:has-text("Validate")')).first();
      if (await validateTab.isVisible()) {
        await validateTab.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: getScreenshotPath('strategy-lab-validate'), fullPage: false });
        await page.waitForTimeout(2000);
      }
    }

    // Options - Runs
    const runsMainTab = page.getByTestId('options-main-tab-runs');
    if (await runsMainTab.isVisible()) {
      await runsMainTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: getScreenshotPath('options-runs-main'), fullPage: false });
      await page.waitForTimeout(2000);
    }

    // SECTION 7: Backtest View (30s)
    await page.getByTestId('nav-item-backtest').click();
    await page.waitForLoadState('networkidle');
    const backtestView = page.locator('[data-testid*="backtest"]').first();
    await backtestView.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: getScreenshotPath('backtest-initial'), fullPage: false });
    await page.waitForTimeout(2000);

    // Backtest - Configure tab
    const configureTab = page.locator('[role="tab"]:has-text("Configure")').or(page.locator('button:has-text("Configure")')).first();
    if (await configureTab.isVisible()) {
      await configureTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: getScreenshotPath('backtest-configure'), fullPage: false });
      await page.waitForTimeout(2000);

      // Try to load and run a backtest
      const selectStrategy = page.locator('select, [role="combobox"]').first();
      if (await selectStrategy.isVisible()) {
        await selectStrategy.click();
        await page.waitForTimeout(1000);
        const firstOption = page.locator('option, [role="option"]').nth(1);
        if (await firstOption.isVisible()) {
          await firstOption.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(2000);
          await page.screenshot({ path: getScreenshotPath('backtest-strategy-selected'), fullPage: false });
          await page.waitForTimeout(2000);

          const runBacktestBtn = page.locator('button:has-text("Run")').first();
          if (await runBacktestBtn.isVisible()) {
            await runBacktestBtn.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(4000); // Let backtest run
            await page.screenshot({ path: getScreenshotPath('backtest-running'), fullPage: false });
            await page.waitForTimeout(2000);
          }
        }
      }
    }

    // Backtest - Runs tab
    const runsTab = page.locator('[role="tab"]:has-text("Runs")').or(page.locator('button:has-text("Runs")')).first();
    if (await runsTab.isVisible()) {
      await runsTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: getScreenshotPath('backtest-runs'), fullPage: false });
      await page.waitForTimeout(2000);
    }

    // Backtest - Analyze tab
    const analyzeTab = page.locator('[role="tab"]:has-text("Analyze")').or(page.locator('button:has-text("Analyze")')).first();
    if (await analyzeTab.isVisible()) {
      await analyzeTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: getScreenshotPath('backtest-analyze'), fullPage: false });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: getScreenshotPath('backtest-analyze-full'), fullPage: true });
      await page.waitForTimeout(2000);
    }

    // SECTION 8: Autopilot View (20s)
    await page.getByTestId('nav-item-autopilot').click();
    await page.waitForLoadState('networkidle');
    await page.getByTestId('autopilot-view').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: getScreenshotPath('autopilot-dashboard'), fullPage: false });
    await page.waitForTimeout(2000);

    // Autopilot - Positions
    const positionsTab = page.locator('[role="tab"]:has-text("Positions")').or(page.locator('button:has-text("Positions")')).first();
    if (await positionsTab.isVisible()) {
      await positionsTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: getScreenshotPath('autopilot-positions'), fullPage: false });
      await page.waitForTimeout(2000);
    }

    // Autopilot - Activity
    const activityTab = page.locator('[role="tab"]:has-text("Activity")').or(page.locator('button:has-text("Activity")')).first();
    if (await activityTab.isVisible()) {
      await activityTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: getScreenshotPath('autopilot-activity'), fullPage: false });
      await page.waitForTimeout(2000);
    }

    // Autopilot - Settings
    const settingsTab = page.locator('[role="tab"]:has-text("Settings")').or(page.locator('button:has-text("Settings")')).first();
    if (await settingsTab.isVisible()) {
      await settingsTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: getScreenshotPath('autopilot-settings'), fullPage: false });
      await page.waitForTimeout(2000);
    }

    // SECTION 9: Replay View (10s)
    await page.getByTestId('nav-item-replay').click();
    await page.waitForLoadState('networkidle');
    await page.getByTestId('replay-view').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: getScreenshotPath('replay-main'), fullPage: false });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: getScreenshotPath('replay-full'), fullPage: true });
    await page.waitForTimeout(2000);

    // SECTION 10: Alerts View (8s)
    await page.getByTestId('nav-item-alerts').click();
    await page.waitForLoadState('networkidle');
    await page.getByTestId('alerts-view').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: getScreenshotPath('alerts-main'), fullPage: false });
    await page.waitForTimeout(2000);

    // SECTION 11: Incidents View (8s)
    await page.getByTestId('nav-item-incidents').click();
    await page.waitForLoadState('networkidle');
    await page.getByTestId('incidents-view').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: getScreenshotPath('incidents-main'), fullPage: false });
    await page.waitForTimeout(2000);

    // SECTION 12: Settings View (10s)
    await page.getByTestId('nav-item-settings').click();
    await page.waitForLoadState('networkidle');
    await page.getByTestId('settings-view').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: getScreenshotPath('settings-main'), fullPage: false });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: getScreenshotPath('settings-full'), fullPage: true });
    await page.waitForTimeout(2000);

    // SECTION 13: Additional views from secondary nav (16s - 2s each)
    const secondaryNavIds = ['monitor', 'search', 'agents', 'cache', 'watchlist', 'correlation', 'journal', 'notifications'];
    for (const navId of secondaryNavIds) {
      const navItem = page.getByTestId(`nav-item-${navId}`);
      if (await navItem.isVisible()) {
        await navItem.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);
        await page.screenshot({ path: getScreenshotPath(`${navId}-view`), fullPage: false });
        await page.waitForTimeout(500);
      }
    }

    // Final check: verify no errors
    expect(errors).toEqual([]);

    console.log(`Total screenshots captured: ${screenshotCounter - 1}`);
  });
});
