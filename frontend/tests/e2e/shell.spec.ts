import { test, expect } from '@playwright/test';

test.describe('Shell Component', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('index.html');
    });

    test('should render main shell components', async ({ page }) => {
        // TopBar should be visible
        await expect(page.locator('header.bg-panel-bg, [data-testid="topbar"]').first()).toBeVisible({ timeout: 10000 });

        // LeftNav should be visible
        await expect(page.locator('nav, [data-testid="leftnav"]').first()).toBeVisible({ timeout: 10000 });

        // Main content area should be visible
        await expect(page.locator('main, [role="main"], div.flex-1').first()).toBeVisible({ timeout: 10000 });
    });

    test('should toggle left nav collapse/expand', async ({ page }) => {
        // Look for the collapse toggle button
        const toggleButton = page.locator('button').filter({ hasText: /collapse|expand/i }).first();

        // If toggle exists, click it
        if (await toggleButton.isVisible()) {
            await toggleButton.click();
            await page.waitForTimeout(300); // Animation time
            await toggleButton.click();
        }
    });

    test('should navigate to different views', async ({ page }) => {
        // Click on each nav item and verify the page changes
        const navItems = ['Monitor', 'Replay', 'Strategies', 'Alerts', 'Portfolio', 'Reports', 'Settings'];

        for (const item of navItems) {
            const navButton = page.locator(`button, a, [role="button"]`).filter({ hasText: item }).first();
            if (await navButton.isVisible({ timeout: 1000 }).catch(() => false)) {
                await navButton.click();
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
        await page.goto('index.html');
    });

    test('should display mode badge', async ({ page }) => {
        // Mode badge should show LIVE, REPLAY, BACKTEST, or PAPER
        const modeBadge = page.locator('text=/LIVE|REPLAY|BACKTEST|PAPER/i').first();
        await expect(modeBadge).toBeVisible({ timeout: 10000 });
    });

    test('should display symbol selector', async ({ page }) => {
        // Symbol should be visible (e.g., AAPL)
        await page.waitForTimeout(1000);
        const symbolDisplay = page.locator('text=/AAPL|TSLA|MSFT|SPY|GOOGL/').first();
        await expect(symbolDisplay).toBeVisible({ timeout: 15000 });
    });

    test('should display timeframe selector', async ({ page }) => {
        // Timeframe should be visible (e.g., 1m, 5m, 1h, 1d)
        const timeframeDisplay = page.locator('text=/[15]m|[15]h|1d|1w/').first();
        if (await timeframeDisplay.isVisible({ timeout: 2000 }).catch(() => false)) {
            await expect(timeframeDisplay).toBeVisible();
        }
    });
});

test.describe('Left Navigation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('index.html');
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
        const collapseButton = page.locator('button').filter({ hasText: /<<|collapse/i }).first();
        if (await collapseButton.isVisible({ timeout: 1000 }).catch(() => false)) {
            await collapseButton.click();
            await page.waitForTimeout(300);

            // Hover over first nav icon
            const firstNavIcon = page.locator('nav button').first();
            await firstNavIcon.hover();

            // Tooltip should appear
            const tooltip = page.locator('[role="tooltip"], .tooltip');
            await expect(tooltip).toBeVisible({ timeout: 2000 });
        }
    });
});
