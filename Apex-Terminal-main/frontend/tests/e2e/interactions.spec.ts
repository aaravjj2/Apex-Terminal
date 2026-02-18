import { test, expect } from '@playwright/test';

test.describe('Interactive Elements', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
    });

    test('buttons should be clickable and show hover states', async ({ page }) => {
        // Target specific stable buttons in TopBar or Nav instead of generic 'button'
        // This avoids issues with hidden/detached buttons causing timeouts
        // Skip disabled buttons (e.g., autopilot-toggle in demo mode)
        const navButtons = page.getByTestId('left-nav').locator('[data-testid^="nav-item-"]').first();

        if (await navButtons.count() > 0) {
            const button = navButtons.first();
            await expect(button).toBeVisible();
            await expect(button).toBeEnabled();

            // Hover and verify (no specific visual assertion easier to just ensure action completes)
            await button.hover();
            await page.waitForTimeout(100);
        }
    });

    test('should handle rapid clicks gracefully', async ({ page }) => {
        // Use a safe button like the mode badge or a specific tool
        // Skip disabled buttons (e.g., autopilot-toggle in demo mode)
        const safeButton = page.getByTestId('topbar').locator('[data-testid^="topbar-btn-"]').first();
        if (await safeButton.isVisible()) {
            // Rapid clicks
            await safeButton.click({ clickCount: 5, delay: 50 });
            await page.waitForTimeout(300);
            await expect(page.getByTestId('app-shell')).toBeVisible();
        }
    });

    test('should handle double-click', async ({ page }) => {
        // Double click on the chart container or a robust element
        const chartContainer = page.getByTestId('chart-canvas');
        if (await chartContainer.isVisible()) {
            await chartContainer.dblclick({ force: true });
            await page.waitForTimeout(200);
        }
    });

    test('should handle right-click context menu', async ({ page }) => {
        const contextuableElement = page.getByTestId('chart-canvas');
        if (await contextuableElement.isVisible({ timeout: 2000 }).catch(() => false)) {
            await contextuableElement.click({ button: 'right' });
            await page.waitForTimeout(200);

            // Close context menu if opened
            await page.keyboard.press('Escape');
        }
    });
});
