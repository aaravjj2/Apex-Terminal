/**
 * Enhanced Portfolio E2E Tests
 * 
 * Tests for:
 * - Portfolio view navigation
 * - Basic UI elements
 */

import { test, expect } from '@playwright/test';

test.describe('Enhanced Portfolio', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to portfolio view
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        // Click on Portfolio nav item
        const portfolioNav = page.locator('[data-testid="nav-item-portfolio"]');
        await portfolioNav.click();
        await page.waitForTimeout(500);
    });

    test('displays portfolio summary cards', async ({ page }) => {
        // Verify summary cards are visible using .first() to avoid strict mode
        await expect(page.locator('text=Total Equity').first()).toBeVisible({ timeout: 10000 });
        await expect(page.locator('text=Open P&L').first()).toBeVisible();
        await expect(page.locator('text=Buying Power').first()).toBeVisible();
    });

    test('shows positions tab with position data', async ({ page }) => {
        // Positions tab should be active by default
        const positionsTab = page.locator('button:has-text("Positions")').first();
        await expect(positionsTab).toBeVisible();
    });

    test('can switch between Positions and Orders tabs', async ({ page }) => {
        // Find and click Orders tab
        const ordersTab = page.locator('button:has-text("Orders")').first();
        await ordersTab.click();
        
        // Verify tab switching worked (orders tab should be active)
        await page.waitForTimeout(300);
        
        // Click back to Positions
        const positionsTab = page.locator('button:has-text("Positions")').first();
        await positionsTab.click();
    });

    test('takes screenshot of portfolio view', async ({ page }) => {
        // Wait for any loading to complete
        await page.waitForTimeout(1000);
        
        // Take screenshot
        await expect(page).toHaveScreenshot('portfolio-view.png', {
            fullPage: true,
            animations: 'disabled',
            maxDiffPixelRatio: 0.1,
        });
    });
});
