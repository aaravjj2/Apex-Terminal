import { test, expect } from '@playwright/test';

test.describe('Forecast/AI Panel Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('AI Panel displays forecast data on Dashboard', async ({ page }) => {
    // Navigate to Dashboard where AIPanel shows forecasts
    const dashboardNav = page.locator('[data-testid="nav-item-dashboard"]');
    await expect(dashboardNav).toBeVisible({ timeout: 5000 });
    await dashboardNav.click();
    await page.waitForTimeout(1000);

    // Verify AIPanel is visible
    const aiPanel = page.getByTestId('ai-panel');
    await expect(aiPanel).toBeVisible({ timeout: 10000 });

    // Check for "What the bot sees" tab content (D1) which includes forecasts
    const seesTab = page.getByTestId('ai-tab-sees');
    if (await seesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await seesTab.click();
      await page.waitForTimeout(500);
      
      // Look for forecast-related content
      const regimeSection = page.locator('text=/Regime|Volatility|Sentiment/i').first();
      await expect(regimeSection).toBeVisible({ timeout: 5000 });
    }
  });

  test('Dashboard shows trading panels', async ({ page }) => {
    await page.getByTestId('nav-item-dashboard').click();
    await page.waitForTimeout(500);

    // Verify main dashboard content loads
    const dashboardContent = page.locator('text=/Positions|Orders|Watchlist/i').first();
    await expect(dashboardContent).toBeVisible({ timeout: 10000 });
  });
});
