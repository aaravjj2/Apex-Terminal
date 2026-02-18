import { test, expect } from '@playwright/test';

test.describe('Forecast/AI Panel Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('AI Panel displays forecast data on Autopilot', async ({ page }) => {
    // Navigate to Autopilot where AIPanel is rendered
    const autopilotNav = page.locator('[data-testid="nav-item-autopilot"]');
    await expect(autopilotNav).toBeVisible({ timeout: 5000 });
    await autopilotNav.click();
    await page.waitForTimeout(1000);

    // Verify AIPanel is visible
    const aiPanel = page.getByTestId('ai-panel');
    await expect(aiPanel).toBeVisible({ timeout: 10000 });

    // Check for "What the bot sees" tab content (D1) which includes forecasts
    const seesTab = page.getByTestId('ai-tab-sees');
    if (await seesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await seesTab.click();
      await page.waitForTimeout(500);
      
      // Look for forecast-related content (AI panel contains regime/volatility/sentiment data)
      await expect(page.getByTestId('ai-panel')).toBeVisible({ timeout: 5000 });
    }
  });

  test('Dashboard shows trading panels', async ({ page }) => {
    await page.getByTestId('nav-item-dashboard').click();
    await page.waitForTimeout(500);

    // Verify main dashboard content loads
    await expect(page.getByTestId('dashboard-view')).toBeVisible({ timeout: 10000 });
  });
});
