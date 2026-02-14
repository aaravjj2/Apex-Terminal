import { test, expect } from '@playwright/test';

test.describe('Indicator System', () => {
  test.beforeEach(async ({ page }) => {
    // Listen to console logs
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', exception => console.log('PAGE ERROR:', exception));

    // Navigate to the built app (use Playwright baseURL)
    await page.goto('/');
    // Wait for Shell to render - check for nav item which has data-testid
    await expect(page.getByTestId('nav-item-monitor')).toBeVisible({ timeout: 10000 });
    
    // Navigate to Monitor view which has the chart with Indicators button
    await page.getByTestId('nav-item-monitor').click();
    // Wait for the chart header strip to be visible
    await page.waitForTimeout(500);
  });

  test('should open indicator library and add RSI', async ({ page }) => {
    // 1. Open Indicator Library - use data-testid for reliability
    await page.getByTestId('indicators-btn').click();

    // 2. Verify Modal Opens - wait for dialog
    const modal = page.getByTestId('modal-dialog');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // 3. Search for RSI
    const searchInput = page.getByTestId('indicator-search-input');
    await searchInput.fill('RSI');
    await page.waitForTimeout(300);

    // 4. Select RSI row using data-testid
    await page.getByTestId('indicator-row-RSI').click();
    
    // 5. Verify right panel shows the indicator config with Add to Chart button
    await expect(page.getByTestId('add-to-chart-btn')).toBeVisible({ timeout: 3000 });
    await page.getByTestId('add-to-chart-btn').click();

    // 6. Verify Indicator is Active in Right Panel
    // Click "Ind" tab in the right dock panel
    await page.waitForTimeout(300);
    const indTab = page.getByTestId('right-dock-tab-ind');
    await indTab.click();
    await expect(page.getByTestId('active-indicator-RSI')).toBeVisible({ timeout: 3000 });
  });

  test('should add and remove SMA from library', async ({ page }) => {
    // Open modal and add SMA using data-testid
    await page.getByTestId('indicators-btn').click();
    await expect(page.getByTestId('modal-dialog')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('indicator-search-input').fill('SMA');
    // Wait a moment for search results
    await page.waitForTimeout(300);
    
    // Click on the search result using data-testid
    await page.getByTestId('indicator-row-SMA').click();

    // Wait for right panel to show Add to Chart button and click it
    await expect(page.getByTestId('add-to-chart-btn')).toBeVisible({ timeout: 3000 });
    await page.getByTestId('add-to-chart-btn').click();

    // Wait for modal to close
    await page.waitForTimeout(500);

    // Ensure badge shows a number
    const badgeText = await page.getByTestId('indicator-count-badge').innerText();
    expect(badgeText).toMatch(/^\d+$/);

    // Click "Ind" tab in right panel to view added indicators
    const indTab = page.getByTestId('right-dock-tab-ind');
    await indTab.click();
    
    // Wait for indicator list to render - check for indicator item by data-testid
    await expect(page.getByTestId('active-indicator-SMA')).toBeVisible({ timeout: 5000 });

    // Remove the indicator using the trash button within the indicator item
    await page.getByTestId('remove-indicator-SMA').click();
    await expect(page.getByTestId('no-indicators-msg')).toBeVisible({ timeout: 5000 });
  });
});
