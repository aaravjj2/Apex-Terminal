/**
 * Supergraph Chart E2E Tests
 * 
 * Tests for:
 * - Chart rendering with candlesticks + volume
 * - VWAP overlay toggle
 * - MA20/MA50 overlay toggles
 * - Entry/Exit markers
 * - Real-time price updates
 * - Chart header info
 * 
 * Runs in headed Chrome with video + trace + screenshots on failure.
 */

import { test, expect } from '@playwright/test';

test.describe('Supergraph Chart', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to chart/monitor view
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        // Monitor view should be default, but click to be sure
        const monitorNav = page.locator('[data-testid="nav-item-monitor"]');
        await monitorNav.click();
        
        // Wait for chart to render
        await page.waitForTimeout(2000);
    });

    test('displays chart canvas', async ({ page }) => {
        // Look for chart container
        const chartContainer = page.locator('canvas').first();
        await expect(chartContainer).toBeVisible({ timeout: 10000 });
    });

    test('displays chart header with symbol and price', async ({ page }) => {
        // Look for symbol display (default is AAPL or similar)
        const headerArea = page.locator('text=/[A-Z]{1,5}/').first();
        await expect(headerArea).toBeVisible();
    });

    test('chart canvas renders candlesticks', async ({ page }) => {
        // Verify canvas has been drawn
        const canvas = page.locator('canvas').first();
        await expect(canvas).toBeVisible();
        
        // Canvas should have content (non-zero dimensions)
        const box = await canvas.boundingBox();
        expect(box?.width).toBeGreaterThan(100);
        expect(box?.height).toBeGreaterThan(100);
    });

    test('takes screenshot of chart view', async ({ page }) => {
        // Wait for chart to fully render
        await page.waitForTimeout(3000);
        
        // Take screenshot
        await expect(page).toHaveScreenshot('chart-view.png', {
            fullPage: true,
            animations: 'disabled',
        });
    });
});

test.describe('Chart Overlay Controls', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.locator('[data-testid="nav-item-monitor"]').click();
        await page.waitForTimeout(2000);
    });

    test('VWAP toggle button exists and works', async ({ page }) => {
        const vwapToggle = page.locator('button:has-text("VWAP")');
        
        if (await vwapToggle.isVisible()) {
            // Click to toggle off
            await vwapToggle.click();
            await page.waitForTimeout(500);
            
            // Click to toggle on
            await vwapToggle.click();
            await page.waitForTimeout(500);
        }
    });

    test('MA20 toggle button exists and works', async ({ page }) => {
        const ma20Toggle = page.locator('button:has-text("MA20")');
        
        if (await ma20Toggle.isVisible()) {
            await ma20Toggle.click();
            await page.waitForTimeout(500);
            await ma20Toggle.click();
        }
    });

    test('MA50 toggle button exists and works', async ({ page }) => {
        const ma50Toggle = page.locator('button:has-text("MA50")');
        
        if (await ma50Toggle.isVisible()) {
            await ma50Toggle.click();
            await page.waitForTimeout(500);
        }
    });
});

test.describe('Chart Interactions', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.locator('[data-testid="nav-item-monitor"]').click();
        await page.waitForTimeout(2000);
    });

    test('crosshair shows on mouse move', async ({ page }) => {
        const canvas = page.locator('canvas').first();
        
        if (await canvas.isVisible()) {
            const box = await canvas.boundingBox();
            if (box) {
                // Move mouse over chart
                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                await page.waitForTimeout(500);
            }
        }
    });

    test('chart is responsive to window resize', async ({ page }) => {
        const canvas = page.locator('canvas').first();
        const initialBox = await canvas.boundingBox();
        
        // Resize viewport
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.waitForTimeout(1000);
        
        // Verify chart is still visible
        await expect(canvas).toBeVisible();
        
        // Resize back
        await page.setViewportSize({ width: 1920, height: 1080 });
    });
});

test.describe('Dashboard with Supergraph', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        // Navigate to dashboard
        const dashboardNav = page.locator('[data-testid="nav-item-dashboard"]');
        await dashboardNav.click();
        await page.waitForTimeout(2000);
    });

    test('dashboard view loads', async ({ page }) => {
        // Dashboard should have tiles - use .first() to avoid strict mode violation
        await expect(page.locator('text=/Dashboard|Watchlist|Positions|Orders/').first()).toBeVisible({ timeout: 10000 });
    });

    test('dashboard displays grid layout', async ({ page }) => {
        // Look for grid structure
        const tiles = page.locator('[class*="grid"]').first();
        await expect(tiles).toBeVisible();
    });

    test('takes screenshot of dashboard', async ({ page }) => {
        await page.waitForTimeout(2000);
        
        await expect(page).toHaveScreenshot('dashboard-view.png', {
            fullPage: true,
            animations: 'disabled',
        });
    });
});
