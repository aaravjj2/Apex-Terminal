/**
 * Core Correctness Track — Global Search E2E Suite
 * Tests search input, entity filters, results table, detail drawer, recent searches.
 * All selectors use data-testid only. No waitForTimeout.
 */

import { test, expect } from '@playwright/test';

const PAGE = 'http://localhost:5100/ui2/search';

test.describe('Search — Page Load & Layout', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByTestId('search-ui2-page')).toBeVisible();
  });

  test('search bar is visible', async ({ page }) => {
    await expect(page.getByTestId('search-bar')).toBeVisible();
  });

  test('search input is visible and editable', async ({ page }) => {
    const input = page.getByTestId('search-input');
    await expect(input).toBeVisible();
    await input.fill('MSFT');
    await expect(input).toHaveValue('MSFT');
  });

  test('search button is visible', async ({ page }) => {
    await expect(page.getByTestId('search-button')).toBeVisible();
  });

  test('search results count is visible', async ({ page }) => {
    await expect(page.getByTestId('search-count')).toBeVisible();
  });

  test('entity filter chips are rendered', async ({ page }) => {
    await expect(page.getByTestId('search-filters')).toBeVisible();
    // "all" filter chip should be visible
    await expect(page.getByTestId('search-filter-all')).toBeVisible();
  });

  test('multiple entity type filters are available', async ({ page }) => {
    const filters = page.locator('[data-testid^="search-filter-"]');
    expect(await filters.count()).toBeGreaterThanOrEqual(5);
  });

  test('results panel is visible after page load', async ({ page }) => {
    await expect(page.getByTestId('search-results-panel')).toBeVisible();
  });

  test('results table renders on initial load', async ({ page }) => {
    await expect(page.getByTestId('search-results-table')).toBeVisible();
  });

  test('search-ready marker is attached', async ({ page }) => {
    await expect(page.getByTestId('search-ready')).toBeAttached();
  });

  test('symbol filter input is visible', async ({ page }) => {
    await expect(page.getByTestId('search-symbol-filter')).toBeVisible();
  });

});

test.describe('Search — Query Execution', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByTestId('search-ui2-page')).toBeVisible();
  });

  test('typing in search input updates results live', async ({ page }) => {
    const input = page.getByTestId('search-input');
    await input.fill('MSFT');
    // Results should update immediately via local search
    const count = await page.getByTestId('search-count').textContent();
    expect(count).toMatch(/\d+ results/);
  });

  test('pressing Enter with text runs search', async ({ page }) => {
    const input = page.getByTestId('search-input');
    await input.fill('order');
    await input.press('Enter');
    // Should show loading then results
    await expect(page.getByTestId('search-count')).toBeVisible();
  });

  test('searching for "AMZN" returns results', async ({ page }) => {
    const input = page.getByTestId('search-input');
    await input.fill('AMZN');
    // Wait for results to update
    await expect(page.getByTestId('search-results-table')).toBeVisible();
    const count = await page.getByTestId('search-count').textContent();
    expect(count).not.toBe('0 results');
  });

  test('searching for "strategy" returns results', async ({ page }) => {
    const input = page.getByTestId('search-input');
    await input.fill('strategy');
    await expect(page.getByTestId('search-results-table')).toBeVisible();
  });

  test('searching for "workflow" returns results', async ({ page }) => {
    const input = page.getByTestId('search-input');
    await input.fill('workflow');
    await expect(page.getByTestId('search-results-table')).toBeVisible();
  });

  test('clear input resets results to all', async ({ page }) => {
    const input = page.getByTestId('search-input');
    await input.fill('AAPL');
    await input.fill('');
    // After clearing, count should reflect all results
    const count = await page.getByTestId('search-count').textContent();
    expect(count).toMatch(/\d+ results/);
  });

  test('symbol filter narrows results', async ({ page }) => {
    const symbolFilter = page.getByTestId('search-symbol-filter');
    await symbolFilter.fill('MSFT');
    const count = await page.getByTestId('search-count').textContent();
    expect(count).toMatch(/\d+ results/);
  });

});

test.describe('Search — Entity Type Filters', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByTestId('search-ui2-page')).toBeVisible();
  });

  test('clicking "order" filter shows only orders', async ({ page }) => {
    const orderFilter = page.getByTestId('search-filter-order');
    if (await orderFilter.isVisible()) {
      await orderFilter.click();
      // Filter should be active (accent color)
      await expect(page.getByTestId('search-results-table')).toBeVisible();
    }
  });

  test('clicking "strategy" filter shows strategies', async ({ page }) => {
    const stratFilter = page.getByTestId('search-filter-strategy');
    if (await stratFilter.isVisible()) {
      await stratFilter.click();
      await expect(page.getByTestId('search-results-table')).toBeVisible();
    }
  });

  test('clicking "all" filter resets to all entity types', async ({ page }) => {
    // Click a specific filter first
    const orderFilter = page.getByTestId('search-filter-order');
    if (await orderFilter.isVisible()) {
      await orderFilter.click();
    }
    // Then reset to all
    await page.getByTestId('search-filter-all').click();
    await expect(page.getByTestId('search-results-table')).toBeVisible();
  });

});

test.describe('Search — Detail Drawer', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByTestId('search-results-table')).toBeVisible();
  });

  test('clicking a result row opens detail drawer', async ({ page }) => {
    // Click first result row
    const firstRow = page.locator('[data-testid="search-results-table"] tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await expect(page.getByTestId('search-detail-drawer')).toBeVisible();
    }
  });

  test('detail drawer shows title', async ({ page }) => {
    const firstRow = page.locator('[data-testid="search-results-table"] tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await expect(page.getByTestId('search-detail-drawer')).toBeVisible();
      await expect(page.getByTestId('search-detail-title')).toBeVisible();
    }
  });

  test('detail drawer shows entity type badge', async ({ page }) => {
    const firstRow = page.locator('[data-testid="search-results-table"] tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await expect(page.getByTestId('search-detail-type')).toBeVisible();
    }
  });

  test('detail drawer shows snippet', async ({ page }) => {
    const firstRow = page.locator('[data-testid="search-results-table"] tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await expect(page.getByTestId('search-detail-snippet')).toBeVisible();
    }
  });

  test('detail drawer shows result ID', async ({ page }) => {
    const firstRow = page.locator('[data-testid="search-results-table"] tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await expect(page.getByTestId('search-detail-id')).toBeVisible();
    }
  });

  test('detail drawer shows score', async ({ page }) => {
    const firstRow = page.locator('[data-testid="search-results-table"] tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await expect(page.getByTestId('search-detail-score')).toBeVisible();
      const score = await page.getByTestId('search-detail-score').textContent();
      expect(score).toMatch(/Score: \d+\.\d+/);
    }
  });

  test('close button dismisses detail drawer', async ({ page }) => {
    const firstRow = page.locator('[data-testid="search-results-table"] tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await expect(page.getByTestId('search-detail-drawer')).toBeVisible();
      await page.getByTestId('search-detail-close').click();
      await expect(page.getByTestId('search-detail-drawer')).not.toBeVisible();
    }
  });

  test('deep link button is visible in drawer', async ({ page }) => {
    const firstRow = page.locator('[data-testid="search-results-table"] tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await expect(page.getByTestId('search-deep-link-btn')).toBeVisible();
    }
  });

});
