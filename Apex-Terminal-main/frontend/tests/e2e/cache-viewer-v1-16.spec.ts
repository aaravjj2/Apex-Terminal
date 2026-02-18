/**
 * v1.16 Cache Viewer E2E Tests
 * Validates Cache Viewer panel displaying cache manifest entries in LOCAL mode
 * and showing "not available" message in DEMO mode
 */

import { test, expect } from '@playwright/test';

test.describe('v1.16 Cache Viewer', () => {
  test('should show "not available" message in DEMO mode', async ({ page, context }) => {
    // Mock the cache API to return DEMO mode
    await context.route('**/api/v1/cache/entries', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode: 'DEMO',
          entries: [],
          total: 0
        })
      });
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for React to mount
    await page.waitForFunction(
      () => (document.getElementById('root')?.childElementCount ?? 0) > 0,
      { timeout: 20000 }
    );

    // Navigate to Cache viewer via left nav
    const cacheNav = page.locator('[data-testid="nav-item-cache"]');
    await cacheNav.waitFor({ state: 'visible', timeout: 10000 });
    await cacheNav.click();
    await page.waitForTimeout(500);

    // In DEMO mode, should show not available message
    await expect(page.getByTestId('cache-viewer-demo')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('cache-viewer-demo-message')).toContainText('Not available in DEMO mode');

    // Capture screenshot
    await page.screenshot({ path: 'artifacts/verification/cache-viewer-demo-mode.png', fullPage: true });
  });

  test('should display cache entries table in LOCAL mode', async ({ page, context }) => {
    // Mock the cache API to return LOCAL mode with sample entries
    await context.route('**/api/v1/cache/entries', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode: 'LOCAL',
          entries: [
            {
              cache_key: 'AAPL_bars_2024-01-01_2024-01-31_1h',
              request_type: 'bars',
              params: {
                symbol: 'AAPL',
                timeframe: '1h',
                start: '2024-01-01',
                end: '2024-01-31'
              },
              checksum: 'abc123def456789',
              captured_at: '2024-01-31T12:00:00Z'
            },
            {
              cache_key: 'MSFT_bars_2024-02-01_2024-02-28_1d',
              request_type: 'bars',
              params: {
                symbol: 'MSFT',
                timeframe: '1d',
                start: '2024-02-01',
                end: '2024-02-28'
              },
              checksum: '789xyz456abc123',
              captured_at: '2024-02-28T12:00:00Z'
            }
          ]
        })
      });
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for React to mount
    await page.waitForFunction(
      () => (document.getElementById('root')?.childElementCount ?? 0) > 0,
      { timeout: 20000 }
    );

    // Navigate to Cache viewer via left nav
    const cacheNav = page.locator('[data-testid="nav-item-cache"]');
    await cacheNav.waitFor({ state: 'visible', timeout: 10000 });
    await cacheNav.click();
    await page.waitForTimeout(500);

    // Should show LOCAL mode with table
    await expect(page.getByTestId('cache-viewer-ready')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('cache-viewer-table')).toBeVisible();

    // Verify table headers
    await expect(page.getByTestId('cache-table-header-cache-key')).toContainText('Cache Key');
    await expect(page.getByTestId('cache-table-header-type')).toContainText('Type');
    await expect(page.getByTestId('cache-table-header-params')).toContainText('Params');
    await expect(page.getByTestId('cache-table-header-checksum')).toContainText('Checksum');
    await expect(page.getByTestId('cache-table-header-captured')).toContainText('Captured');

    // Verify both entries are rendered
    await expect(page.getByTestId('cache-entry-0')).toBeVisible();
    await expect(page.getByTestId('cache-entry-1')).toBeVisible();

    // Verify first entry content
    await expect(page.getByTestId('cache-entry-0-cache-key')).toContainText('AAPL_bars_2024-01-01_2024-01-31_1h');
    await expect(page.getByTestId('cache-entry-0-type')).toContainText('bars');
    await expect(page.getByTestId('cache-entry-0-checksum')).toContainText('abc123');

    // Verify copy buttons exist
    await expect(page.getByTestId('copy-checksum-0')).toBeVisible();
    await expect(page.getByTestId('copy-checksum-1')).toBeVisible();

    // Capture screenshot
    await page.screenshot({ path: 'artifacts/verification/cache-viewer-local-mode.png', fullPage: true });
  });

  test('should handle copy checksum action', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Mock the cache API to return LOCAL mode with one entry
    await context.route('**/api/v1/cache/entries', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode: 'LOCAL',
          entries: [
            {
              cache_key: 'TEST_bars_2024-01-01_2024-01-31_1h',
              request_type: 'bars',
              params: { symbol: 'TEST' },
              checksum: 'abc123def456789',
              captured_at: '2024-01-31T12:00:00Z'
            }
          ]
        })
      });
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for React to mount
    await page.waitForFunction(
      () => (document.getElementById('root')?.childElementCount ?? 0) > 0,
      { timeout: 20000 }
    );

    // Navigate to Cache viewer
    await page.getByTestId('nav-item-cache').click();
    await page.waitForTimeout(500);

    // Wait for cache viewer to be ready
    await expect(page.getByTestId('cache-viewer-ready')).toBeVisible({ timeout: 10000 });

    // Click copy button
    await page.getByTestId('copy-checksum-0').click();
    await page.waitForTimeout(500);

    // Verify checkmark appears (indicating successful copy)
    const copyButton = page.getByTestId('copy-checksum-0');
    await expect(copyButton).toContainText('✓');

    // Capture screenshot
    await page.screenshot({ path: 'artifacts/verification/cache-viewer-copy-success.png', fullPage: true });
  });

  test('should show empty state when no cache entries', async ({ page, context }) => {
    // Mock the cache API to return LOCAL mode with empty entries
    await context.route('**/api/v1/cache/entries', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode: 'LOCAL',
          entries: [],
          total: 0
        })
      });
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for React to mount
    await page.waitForFunction(
      () => (document.getElementById('root')?.childElementCount ?? 0) > 0,
      { timeout: 20000 }
    );

    // Navigate to Cache viewer
    await page.getByTestId('nav-item-cache').click();
    await page.waitForTimeout(500);

    // Should show LOCAL mode ready
    await expect(page.getByTestId('cache-viewer-ready')).toBeVisible({ timeout: 10000 });

    // Should show empty state, not the table
    await expect(page.getByTestId('cache-viewer-empty')).toBeVisible();
    
    // Should not have table or entry rows
    await expect(page.getByTestId('cache-viewer-table')).not.toBeVisible();
    await expect(page.getByTestId('cache-entry-0')).not.toBeVisible();

    // Capture screenshot
    await page.screenshot({ path: 'artifacts/verification/cache-viewer-empty-state.png', fullPage: true });
  });

  test('should navigate to cache viewer from left nav', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for React to mount
    await page.waitForFunction(
      () => (document.getElementById('root')?.childElementCount ?? 0) > 0,
      { timeout: 20000 }
    );

    // Wait for cache nav to be visible
    const cacheNav = page.getByTestId('nav-item-cache');
    await cacheNav.waitFor({ state: 'visible', timeout: 10000 });
    
    // Capture nav before click
    await page.screenshot({ path: 'artifacts/verification/cache-viewer-nav-before.png', fullPage: true });
    
    await cacheNav.click();
    await page.waitForTimeout(500);

    // Capture nav after click
    await page.screenshot({ path: 'artifacts/verification/cache-viewer-nav-after.png', fullPage: true });

    // Verify cache viewer is displayed (either DEMO or LOCAL mode)
    const cacheViewer = page.locator('[data-testid="cache-viewer-demo"], [data-testid="cache-viewer-ready"]');
    await expect(cacheViewer.first()).toBeVisible({ timeout: 10000 });
  });
});
