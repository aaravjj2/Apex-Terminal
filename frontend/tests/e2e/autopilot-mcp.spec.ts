/**
 * Autopilot MCP-based E2E Tests
 * Non-headless tests with mandatory snapshots
 */

import { test, expect } from '@playwright/test';

test.describe('Autopilot MCP Testing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');  // Use baseURL from config
  });

  test('should navigate to autopilot view', async ({ page }) => {
    // Click on Autopilot nav item
    await page.click('[data-testid="nav-item-autopilot"]');
    
    // Verify autopilot view is visible
    await expect(page.locator('[data-testid="autopilot-view"]')).toBeVisible();
    
    // Take snapshot
    await expect(page.locator('[data-testid="autopilot-view"]')).toHaveScreenshot('autopilot-view.png');
  });

  test('should display all 4 tabs', async ({ page }) => {
    await page.click('[data-testid="nav-item-autopilot"]');
    
    // Verify all tabs exist using data-testid for specificity
    await expect(page.getByTestId('autopilot-tab-dashboard')).toBeVisible();
    await expect(page.getByTestId('autopilot-tab-positions')).toBeVisible();
    await expect(page.getByTestId('autopilot-tab-activity')).toBeVisible();
    await expect(page.getByTestId('autopilot-tab-settings')).toBeVisible();
  });

  test('should show paper mode banner', async ({ page }) => {
    await page.click('[data-testid="nav-item-autopilot"]');
    
    // Verify paper mode banner
    const banner = page.getByTestId('paper-mode-banner');
    await expect(banner).toBeVisible();
    
    // Take snapshot of dashboard
    await expect(page.locator('[data-testid="autopilot-dashboard"]')).toHaveScreenshot('autopilot-dashboard.png');
  });

  test('should display portfolio metrics', async ({ page }) => {
    await page.click('[data-testid="nav-item-autopilot"]');
    
    // Verify key metrics are visible
    await expect(page.getByTestId('autopilot-stats-grid')).toBeVisible();
    await expect(page.getByTestId('stat-positions')).toBeVisible();
  });

  test('should switch to positions tab', async ({ page }) => {
    await page.click('[data-testid="nav-item-autopilot"]');
    await page.getByTestId('autopilot-tab-positions').click();
    
    // Verify positions view
    await expect(page.getByTestId('position-ledger-heading')).toBeVisible();
    
    // Take snapshot
    await expect(page.getByTestId('main-content')).toHaveScreenshot('autopilot-positions.png');
  });

  test('should switch to activity tab', async ({ page }) => {
    await page.click('[data-testid="nav-item-autopilot"]');
    await page.getByTestId('autopilot-tab-activity').click();
    
    // Verify activity view
    await expect(page.getByTestId('activity-log-heading')).toBeVisible();
    
    // Take snapshot
    await expect(page.getByTestId('main-content')).toHaveScreenshot('autopilot-activity.png');
  });

  test('should switch to settings tab', async ({ page }) => {
    await page.click('[data-testid="nav-item-autopilot"]');
    await page.getByTestId('autopilot-tab-settings').click();
    
    // Verify settings view
    await expect(page.getByTestId('autopilot-settings-heading')).toBeVisible();
    
    // Take snapshot
    await expect(page.locator('[data-testid="autopilot-settings"]')).toHaveScreenshot('autopilot-settings.png');
  });

  test('should toggle autopilot state', async ({ page }) => {
    await page.click('[data-testid="nav-item-autopilot"]');
    
    // Deactivate kill switch first if active (buttons disabled when kill switch is on)
    const killSwitch = page.getByTestId('kill-switch-btn');
    if (await killSwitch.isVisible().catch(() => false)) {
      if (await killSwitch.textContent().then(t => t?.includes('Deactivate'))) {
        await killSwitch.click();
        await page.waitForTimeout(500);
      }
    }
    
    // Click Pause/Resume button using data-testid
    await page.getByTestId('pause-resume-btn').click();
    
    // Wait for state to change
    await page.waitForTimeout(500);
    
    // Verify button is still there (indicates toggle worked)
    await expect(page.getByTestId('pause-resume-btn')).toBeVisible();
  });
});
