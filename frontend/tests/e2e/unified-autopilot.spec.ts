import { test, expect } from '@playwright/test';

test.describe('Unified Autopilot + Forecast Integration', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');  // Uses baseURL from playwright.config.ts
        await page.waitForLoadState('domcontentloaded');
        // Wait for nav to be visible (LeftNav renders as <nav>)
        await page.waitForSelector('nav', { timeout: 20000 });
    });

    test('Autopilot view shows tabs and dashboard', async ({ page }) => {
        // Navigate to Autopilot view
        await page.getByTestId('nav-item-autopilot').click();
        await page.waitForTimeout(2000);

        // Take screenshot of Autopilot view
        await page.screenshot({ path: 'test-results/autopilot-view.png', fullPage: true });

        // Check for Controls tab (primary/dashboard tab in AutopilotUI2)
        const controlsTab = page.getByTestId('autopilot-tab-controls');
        await expect(controlsTab).toBeVisible({ timeout: 10000 });

        // Check for Positions tab
        const positionsTab = page.getByTestId('autopilot-tab-positions');
        await expect(positionsTab).toBeVisible();

        // Check for Cycles tab (captures activity history)
        const cyclesTab = page.getByTestId('autopilot-tab-cycles');
        await expect(cyclesTab).toBeVisible();

        // Check for Pipeline tab
        const pipelineTab = page.getByTestId('autopilot-tab-pipeline');
        await expect(pipelineTab).toBeVisible();
    });

    test('Autopilot tabs are interactive', async ({ page }) => {
        // Navigate to Autopilot view
        await page.getByTestId('nav-item-autopilot').click();
        await page.waitForTimeout(2000);

        // Click on Positions tab
        await page.getByTestId('autopilot-tab-positions').click();
        await page.waitForTimeout(500);

        // Take screenshot of positions view
        await page.screenshot({ path: 'test-results/autopilot-positions-view.png', fullPage: true });

        // Click to Risk tab
        await page.getByTestId('autopilot-tab-risk').click();
        await page.waitForTimeout(500);

        // Take screenshot
        await page.screenshot({ path: 'test-results/autopilot-risk-view.png', fullPage: true });

        // Click back to Controls (primary)
        await page.getByTestId('autopilot-tab-controls').click();
        await page.waitForTimeout(500);

        // Take screenshot
        await page.screenshot({ path: 'test-results/autopilot-controls-view.png', fullPage: true });
    });
});
