/**
 * Data Provider E2E Tests (v1.9 - Step 4)
 * =========================================
 * Validates the Data Source Selector UI and provider switching.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5100';

test.describe('Data Provider Selector (v1.9)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="nav-item-dashboard"]', { timeout: 10000 });
  });

  test('v1.9-data-01 - Data source selector visible in top bar', async ({ page }) => {
    await expect(page.getByTestId('data-source-selector')).toBeVisible();
    await expect(page.getByTestId('data-source-trigger')).toBeVisible();

    await page.screenshot({ path: 'e2e-results/data-01-selector-visible.png', fullPage: true });
  });

  test('v1.9-data-02 - Dropdown opens with 3 provider options', async ({ page }) => {
    await page.getByTestId('data-source-trigger').click();
    await page.waitForTimeout(300);

    await expect(page.getByTestId('data-source-dropdown')).toBeVisible();

    // Should show fixture, cached, and yahoo options
    await expect(page.getByTestId('data-source-option-fixture')).toBeVisible();
    await expect(page.getByTestId('data-source-option-cached-yahoo')).toBeVisible();
    await expect(page.getByTestId('data-source-option-yahoo')).toBeVisible();

    await page.screenshot({ path: 'e2e-results/data-02-dropdown-open.png', fullPage: true });
  });

  test('v1.9-data-03 - Default is Demo Fixtures', async ({ page }) => {
    const trigger = page.getByTestId('data-source-trigger');
    const text = await trigger.textContent();
    expect(text).toContain('Demo Fixtures');
  });

  test('v1.9-data-04 - Switch to Cached provider', async ({ page }) => {
    await page.getByTestId('data-source-trigger').click();
    await page.waitForTimeout(200);
    await page.getByTestId('data-source-option-cached-yahoo').click();
    await page.waitForTimeout(300);

    // Dropdown should close
    await expect(page.getByTestId('data-source-dropdown')).not.toBeVisible();

    // Trigger should now show Cached label
    const text = await page.getByTestId('data-source-trigger').textContent();
    expect(text).toContain('Cached');

    await page.screenshot({ path: 'e2e-results/data-04-cached.png', fullPage: true });
  });

  test('v1.9-data-05 - Switch back to Demo Fixtures', async ({ page }) => {
    // First switch to cached
    await page.getByTestId('data-source-trigger').click();
    await page.waitForTimeout(200);
    await page.getByTestId('data-source-option-cached-yahoo').click();
    await page.waitForTimeout(200);

    // Switch back to fixture
    await page.getByTestId('data-source-trigger').click();
    await page.waitForTimeout(200);
    await page.getByTestId('data-source-option-fixture').click();
    await page.waitForTimeout(200);

    const text = await page.getByTestId('data-source-trigger').textContent();
    expect(text).toContain('Demo Fixtures');

    await page.screenshot({ path: 'e2e-results/data-05-back-to-fixture.png', fullPage: true });
  });

  test('v1.9-data-06 - Yahoo Finance option shows network requirement', async ({ page }) => {
    await page.getByTestId('data-source-trigger').click();
    await page.waitForTimeout(200);

    const yahooOption = page.getByTestId('data-source-option-yahoo');
    const text = await yahooOption.textContent();
    expect(text).toContain('Requires network');

    await page.screenshot({ path: 'e2e-results/data-06-yahoo-network.png', fullPage: true });
  });
});
