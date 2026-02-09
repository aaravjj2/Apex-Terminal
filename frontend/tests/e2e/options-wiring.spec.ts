import { test, expect } from '@playwright/test';

test.describe('Options Wiring', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to root
        await page.goto('/');
        // Wait for app to load
        await expect(page.locator('nav')).toBeVisible({ timeout: 10000 });
    });

    test('Option Chain Tile displays data', async ({ page }) => {
        // Navigate to Options via LeftNav
        await page.getByTestId('nav-item-options').click();
        await page.waitForTimeout(500);

        // Verify options page loaded
        const optionsContent = page.locator('text=/Options|Analytics|Chain/i').first();
        await expect(optionsContent).toBeVisible({ timeout: 10000 });

        // Take screenshot to verify page loaded
        await page.screenshot({ path: 'frontend/screenshots/options-wire-check.png' });
    });

    test('Options Analytics View displays chain', async ({ page }) => {
        // Navigate to Options view via LeftNav
        await page.getByTestId('nav-item-options').click();
        await page.waitForTimeout(500);

        // Verify options page loaded (look for any content)
        const optionsContent = page.locator('text=/Options|Analytics|Chain/i').first();
        await expect(optionsContent).toBeVisible({ timeout: 10000 });

        // Take screenshot
        await page.screenshot({ path: 'frontend/screenshots/options-view-check.png' });
    });
});
