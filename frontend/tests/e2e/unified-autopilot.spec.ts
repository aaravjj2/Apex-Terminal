import { test, expect } from '@playwright/test';

test.describe('Unified Autopilot + Forecast Integration', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');  // Uses baseURL from playwright.config.ts
        await page.waitForLoadState('networkidle');
        // Wait for nav to be visible
        await page.waitForSelector('nav', { timeout: 10000 });
    });

    test('Autopilot view shows tabs and dashboard', async ({ page }) => {
        // Navigate to Autopilot view
        await page.getByTestId('nav-item-autopilot').click();
        await page.waitForTimeout(2000);

        // Take screenshot of Autopilot view
        await page.screenshot({ path: 'test-results/autopilot-view.png', fullPage: true });

        // Check for Dashboard tab
        const dashboardTab = page.getByTestId('autopilot-tab-dashboard');
        await expect(dashboardTab).toBeVisible({ timeout: 10000 });

        // Check for Positions tab
        const positionsTab = page.getByTestId('autopilot-tab-positions');
        await expect(positionsTab).toBeVisible();

        // Check for Activity tab
        const activityTab = page.getByTestId('autopilot-tab-activity');
        await expect(activityTab).toBeVisible();

        // Check for Settings tab
        const settingsTab = page.getByTestId('autopilot-tab-settings');
        await expect(settingsTab).toBeVisible();
    });

    test('Autopilot tabs are interactive', async ({ page }) => {
        // Navigate to Autopilot view
        await page.getByTestId('nav-item-autopilot').click();
        await page.waitForTimeout(2000);

        // Click on Settings tab
        await page.getByTestId('autopilot-tab-settings').click();
        await page.waitForTimeout(500);

        // Verify Settings tab is now active
        await expect(page.getByTestId('autopilot-tab-settings')).toHaveClass(/border-blue-500/);

        // Take screenshot of settings view
        await page.screenshot({ path: 'test-results/autopilot-settings-view.png', fullPage: true });

        // Click back to Dashboard
        await page.getByTestId('autopilot-tab-dashboard').click();
        await page.waitForTimeout(500);

        // Take screenshot
        await page.screenshot({ path: 'test-results/autopilot-dashboard-view.png', fullPage: true });
    });
});
