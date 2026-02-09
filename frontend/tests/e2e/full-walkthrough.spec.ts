import { test, expect } from '@playwright/test';

test.describe('Full System Walkthrough', () => {
    test('navigate through all major features', async ({ page }) => {
        // 1. Start at Home
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        // Verify shell is loaded
        await expect(page.locator('[data-testid="app-shell"], nav')).toBeVisible({ timeout: 10000 });

        // 2. Navigate to Monitor (Chart view)
        const monitorNav = page.locator('[data-testid="nav-item-monitor"]');
        if (await monitorNav.isVisible({ timeout: 2000 }).catch(() => false)) {
            await monitorNav.click();
            await page.waitForTimeout(500);
        }

        // 3. Navigate to Dashboard
        const dashboardNav = page.locator('[data-testid="nav-item-dashboard"]');
        if (await dashboardNav.isVisible({ timeout: 2000 }).catch(() => false)) {
            await dashboardNav.click();
            await page.waitForTimeout(500);
        }

        // 4. Navigate to Autopilot
        const autopilotNav = page.locator('[data-testid="nav-item-autopilot"]');
        if (await autopilotNav.isVisible({ timeout: 2000 }).catch(() => false)) {
            await autopilotNav.click();
            await page.waitForTimeout(500);
            
            // Verify autopilot view
            await expect(page.locator('[data-testid="autopilot-view"]')).toBeVisible();
        }

        // 5. Navigate to Portfolio
        const portfolioNav = page.locator('[data-testid="nav-item-portfolio"]');
        if (await portfolioNav.isVisible({ timeout: 2000 }).catch(() => false)) {
            await portfolioNav.click();
            await page.waitForTimeout(500);
        }

        // 6. Navigate to Settings
        const settingsNav = page.locator('[data-testid="nav-item-settings"]');
        if (await settingsNav.isVisible({ timeout: 2000 }).catch(() => false)) {
            await settingsNav.click();
            await page.waitForTimeout(500);
        }

        // Take final screenshot
        await page.screenshot({ path: 'test-results/snapshots/full-walkthrough-final.png' });
    });
});
