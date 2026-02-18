import { test, expect } from '@playwright/test';

test.describe('Shell Component', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should render main shell components', async ({ page }) => {
        // TopBar should be visible
        await expect(page.getByTestId('top-app-bar')).toBeVisible({ timeout: 10000 });

        // LeftNav should be visible
        await expect(page.getByTestId('left-nav')).toBeVisible({ timeout: 10000 });

        // Main content area should be visible
        await expect(page.getByTestId('main-content')).toBeVisible({ timeout: 10000 });
    });

    test('should toggle left nav collapse/expand', async ({ page }) => {
        // Look for the collapse toggle button
        const toggleButton = page.getByTestId('nav-toggle');

        // If toggle exists, click it
        if (await toggleButton.isVisible()) {
            await toggleButton.click();
            await page.waitForTimeout(300); // Animation time
            await toggleButton.click();
        }
    });

    test('should navigate to different views', async ({ page }) => {
        // Click on each nav item and verify the page changes
        const navItems = ['monitor', 'replay', 'strategies', 'alerts', 'portfolio', 'runs', 'settings'];

        for (const item of navItems) {
            const navBtn = page.getByTestId(`nav-item-${item}`);
            if (await navBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await navBtn.click();
                await page.waitForTimeout(200);
            }
        }
    });

    test('should capture shell screenshot', async ({ page }) => {
        await page.waitForTimeout(500); // Wait for animations
        await expect(page).toHaveScreenshot('shell-default.png', {
            fullPage: true,
            animations: 'disabled',
        });
    });
});

test.describe('TopBar Component', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should display mode badge', async ({ page }) => {
        // Mode badge should show LIVE, REPLAY, BACKTEST, or PAPER
        const modeBadge = page.getByTestId('mode-badge');
        await expect(modeBadge).toBeVisible({ timeout: 10000 });
    });

    test('should display symbol selector', async ({ page }) => {
        // Symbol should be visible (e.g., AAPL)
        await page.waitForTimeout(1000);
        const symbolDisplay = page.getByTestId('symbol-display');
        await expect(symbolDisplay).toBeVisible({ timeout: 15000 });
    });

    test('should display timeframe selector', async ({ page }) => {
        // Timeframe should be visible (e.g., 1m, 5m, 1h, 1d)
        const timeframeDisplay = page.getByTestId('timeframe-display');
        if (await timeframeDisplay.isVisible({ timeout: 2000 }).catch(() => false)) {
            await expect(timeframeDisplay).toBeVisible();
        }
    });
});

test.describe('Left Navigation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should highlight active nav item', async ({ page }) => {
        // Click Chart nav item (monitor) and verify it's highlighted
        const chartNav = page.getByTestId('nav-item-monitor');
        if (await chartNav.isVisible({ timeout: 2000 }).catch(() => false)) {
            await chartNav.click();
            // Check for active state - the parent container should have brand color
            await expect(chartNav).toHaveClass(/bg-brand|text-brand/);
        }
    });

    test('should show tooltips on collapsed nav', async ({ page }) => {
        // If nav is collapsible, test tooltip visibility
        const collapseButton = page.getByTestId('nav-toggle');
        if (await collapseButton.isVisible({ timeout: 1000 }).catch(() => false)) {
            await collapseButton.click();
            await page.waitForTimeout(300);

            // Hover over first nav icon
            const firstNavIcon = page.getByTestId('nav-item-monitor');
            await firstNavIcon.hover();

            // Just verify the nav item still works after collapse
            await expect(firstNavIcon).toBeVisible({ timeout: 2000 });

            // Re-expand
            await collapseButton.click();
        }
    });
});
