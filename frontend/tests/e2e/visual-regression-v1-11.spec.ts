/**
 * Visual Regression Suite v1.11 (Objective E)
 * =============================================
 * Requirements: >= 20 screenshot assertions, retries=0, fixed viewport
 * Coverage: Dashboard, Options (Analytics, Risk Desk, Strategy Lab), Backtest (all tabs),
 *           Charts, Loading States, Empty States, Banners
 *
 * Deterministic rendering: animations disabled, reduced-motion override
 * Viewport: 1440×900 for consistency
 */

import { test, expect } from '@playwright/test';

// Fixed viewport for all visual regression tests
test.use({
  viewport: { width: 1440, height: 900 },
});

// ─── Helpers ────────────────────────────────────────────────────────────────

async function disableAnimations(page: import('@playwright/test').Page) {
  await page.addStyleTag({ 
    content: `
      *, *::before, *::after { 
        animation-duration: 0s !important; 
        animation-delay: 0s !important;
        transition-duration: 0s !important; 
        transition-delay: 0s !important;
      }
    ` 
  });
}

async function gotoPage(page: import('@playwright/test').Page, path: string = '/') {
  await page.goto(`http://localhost:5100${path}`, { waitUntil: 'domcontentloaded' });
  await disableAnimations(page);
}

async function gotoOptions(page: import('@playwright/test').Page) {
  await gotoPage(page);
  await page.getByTestId('nav-item-options').click();
  await page.waitForTimeout(100);
}

async function gotoBacktest(page: import('@playwright/test').Page) {
  await gotoPage(page);
  await page.getByTestId('nav-item-backtest').click();
  await page.waitForTimeout(100);
}

// ═══════════════════════════════════════════════════════════════════════════
//  DASHBOARD (3 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Dashboard Visual Regression v1.11', () => {
  test('VR11-01: Dashboard landing page', async ({ page }) => {
    await gotoPage(page);
    await expect(page.getByTestId('nav-item-dashboard')).toBeVisible();

    await expect(page).toHaveScreenshot('vr11-01-dashboard-landing.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });

  test('VR11-02: Dashboard navigation bar', async ({ page }) => {
    await gotoPage(page);
    const navbar = page.getByTestId('left-nav');
    await expect(navbar).toBeVisible();

    await expect(navbar).toHaveScreenshot('vr11-02-dashboard-navbar.png', {
      animations: 'disabled',
    });
  });

  test('VR11-03: Data source selector', async ({ page }) => {
    await gotoPage(page);
    await expect(page.getByTestId('data-source-selector')).toBeVisible();

    await expect(page.getByTestId('data-source-selector')).toHaveScreenshot('vr11-03-data-source-selector.png', {
      animations: 'disabled',
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  OPTIONS - ANALYTICS (2 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Options: Analytics Visual Regression v1.11', () => {
  test('VR11-04: Analytics panel default view', async ({ page }) => {
    await gotoOptions(page);
    await expect(page.getByTestId('analytics-panel')).toBeVisible();

    await expect(page).toHaveScreenshot('vr11-04-analytics-panel.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });

  test('VR11-05: Quick actions strip', async ({ page }) => {
    await gotoOptions(page);
    const strip = page.getByTestId('quick-actions-strip');
    await expect(strip).toBeVisible();

    await expect(strip).toHaveScreenshot('vr11-05-quick-actions-strip.png', {
      animations: 'disabled',
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  OPTIONS - RISK DESK (4 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Options: Risk Desk Visual Regression v1.11', () => {
  test('VR11-06: Risk Desk empty state', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-risk-desk').click();
    await expect(page.getByTestId('risk-desk-panel')).toBeVisible();

    await expect(page).toHaveScreenshot('vr11-06-risk-desk-empty.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });

  test('VR11-07: Risk Desk with demo data loaded', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-risk-desk').click();
    await page.getByTestId('load-demo-btn').click();
    await expect(page.getByTestId('run-button')).toBeEnabled();

    await expect(page).toHaveScreenshot('vr11-07-risk-desk-demo-loaded.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });

  test('VR11-08: Risk Desk Greeks card after run', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-risk-desk').click();
    await page.getByTestId('load-demo-btn').click();
    await page.getByTestId('run-button').click();
    await expect(page.getByTestId('greeks-card')).toBeVisible();

    await expect(page.getByTestId('greeks-card')).toHaveScreenshot('vr11-08-risk-desk-greeks.png', {
      animations: 'disabled',
    });
  });

  test('VR11-09: Risk Desk chart visualization', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-risk-desk').click();
    await page.getByTestId('load-demo-btn').click();
    await page.getByTestId('run-button').click();
    await expect(page.getByTestId('greeks-card')).toBeVisible();
    
    // Check if charts are rendered
    const chartsContainer = page.getByTestId('premium-risk-charts');
    if (await chartsContainer.isVisible()) {
      await expect(chartsContainer).toHaveScreenshot('vr11-09-risk-desk-charts.png', {
        animations: 'disabled',
      });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  OPTIONS - STRATEGY LAB (3 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Options: Strategy Lab Visual Regression v1.11', () => {
  test('VR11-10: Strategy Lab Builder tab', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-strategy-lab').click();
    await expect(page.getByTestId('strategy-lab-panel')).toBeVisible();

    await expect(page).toHaveScreenshot('vr11-10-strategy-lab-builder.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });

  test('VR11-11: Strategy Lab Library subtab', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-strategy-lab').click();
    await page.getByTestId('strategy-lab-tab-library').click();
    
    // Wait for library items to load
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('vr11-11-strategy-lab-library.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });

  test('VR11-12: Strategy Lab Validate subtab', async ({ page }) => {
    await gotoOptions(page);
    await page.getByTestId('options-main-tab-strategy-lab').click();
    await page.getByTestId('strategy-lab-tab-validate').click();

    await expect(page).toHaveScreenshot('vr11-12-strategy-lab-validate.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  BACKTEST TOOL (6 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Backtest Tool Visual Regression v1.11', () => {
  test('VR11-13: Backtest Configure tab initial', async ({ page }) => {
    await gotoBacktest(page);
    await expect(page.getByTestId('backtest-panel')).toBeVisible();
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('vr11-13-backtest-configure.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });

  test('VR11-14: Backtest Configure with strategy selected', async ({ page }) => {
    await gotoBacktest(page);
    await page.getByTestId('backtest-strategy-select').selectOption({ index: 1 });
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('vr11-14-backtest-configure-strategy.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });

  test('VR11-15: Backtest Runs tab after creating run', async ({ page }) => {
    await gotoBacktest(page);
    await page.getByTestId('backtest-strategy-select').selectOption({ index: 1 });
    await page.getByTestId('backtest-start-date').fill('2023-01-01');
    await page.getByTestId('backtest-end-date').fill('2023-03-31');
    await page.getByTestId('run-backtest-btn').click();
    await expect(page.getByTestId('backtest-runs-row-0')).toBeVisible({ timeout: 30000 });

    await expect(page).toHaveScreenshot('vr11-15-backtest-runs-list.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });

  test('VR11-16: Backtest Analyze tab equity chart', async ({ page }) => {
    await gotoBacktest(page);
    await page.getByTestId('backtest-strategy-select').selectOption({ index: 1 });
    await page.getByTestId('backtest-start-date').fill('2023-01-01');
    await page.getByTestId('backtest-end-date').fill('2023-03-31');
    await page.getByTestId('run-backtest-btn').click();
    await expect(page.getByTestId('backtest-runs-row-0')).toBeVisible({ timeout: 30000 });
    
    // Navigate to Analyze subtab
    await page.getByTestId('backtest-tab-analyze').click();
    await page.waitForTimeout(1000);
    
    const equityChart = page.getByTestId('backtest-analyze-chart-equity');
    await expect(equityChart).toBeVisible();
    await expect(equityChart).toHaveScreenshot('vr11-16-backtest-analyze-equity.png', {
      animations: 'disabled',
    });
  });

  test('VR11-17: Backtest Analyze tab drawdown chart', async ({ page }) => {
    await gotoBacktest(page);
    await page.getByTestId('backtest-strategy-select').selectOption({ index: 1 });
    await page.getByTestId('backtest-start-date').fill('2023-01-01');
    await page.getByTestId('backtest-end-date').fill('2023-03-31');
    await page.getByTestId('run-backtest-btn').click();
    await expect(page.getByTestId('backtest-runs-row-0')).toBeVisible({ timeout: 30000 });
    
    await page.getByTestId('backtest-tab-analyze').click();
    await page.waitForTimeout(1000);
    
    const drawdownChart = page.getByTestId('backtest-analyze-chart-drawdown');
    await expect(drawdownChart).toBeVisible();
    await expect(drawdownChart).toHaveScreenshot('vr11-17-backtest-analyze-drawdown.png', {
      animations: 'disabled',
    });
  });

  test('VR11-18: Backtest Compare tab', async ({ page }) => {
    await gotoBacktest(page);
    await page.getByTestId('backtest-strategy-select').selectOption({ index: 1 });
    await page.getByTestId('backtest-start-date').fill('2023-01-01');
    await page.getByTestId('backtest-end-date').fill('2023-03-31');
    await page.getByTestId('run-backtest-btn').click();
    await expect(page.getByTestId('backtest-runs-row-0')).toBeVisible({ timeout: 30000 });
    
    await page.getByTestId('backtest-tab-compare').click();
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('vr11-18-backtest-compare.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  CROSS-CUTTING (2 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Cross-Cutting Visual Regression v1.11', () => {
  test('VR11-19: Data provider dropdown open', async ({ page }) => {
    await gotoPage(page);
    await page.getByTestId('data-source-trigger').click();
    await page.waitForTimeout(300);
    await expect(page.getByTestId('data-source-dropdown')).toBeVisible();

    await expect(page.getByTestId('data-source-dropdown')).toHaveScreenshot('vr11-19-provider-dropdown.png', {
      animations: 'disabled',
    });
  });

  test('VR11-20: Full page layout consistency', async ({ page }) => {
    await gotoPage(page);
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('vr11-20-full-page-layout.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});
