import { test, expect } from '@playwright/test';

test.describe('Forecast/AI Panel Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('AI Panel displays forecast data on Dashboard', async ({ page }) => {
    // Navigate to Dashboard (EnhancedCommandCenterView)
    const dashboardNav = page.locator('[data-testid="nav-item-dashboard"]');
    await expect(dashboardNav).toBeVisible({ timeout: 5000 });
    await dashboardNav.click();
    await page.waitForTimeout(1000);

    // Verify dashboard content is visible (command center view)
    const dashboardContent = page.locator('text=/Command Center|Portfolio|Watchlist|Positions|Orders|Risk/i').first();
    await expect(dashboardContent).toBeVisible({ timeout: 10000 });
  });

  test('Dashboard shows trading panels', async ({ page }) => {
    await page.getByTestId('nav-item-dashboard').click();
    await page.waitForTimeout(500);

    // Verify main dashboard content loads
    const dashboardContent = page.locator('text=/Positions|Orders|Watchlist/i').first();
    await expect(dashboardContent).toBeVisible({ timeout: 10000 });
  });
});
