/**
 * live-order-preview.spec.ts
 *
 * Checks that the Orders tab renders broker orders correctly,
 * that filters are functional, and that order drawers expose raw JSON.
 */

import { test, expect } from '@playwright/test';

const PAGE = 'http://localhost:5100/ui2/autopilot-command-center';

test.describe('Autopilot — Orders Tab', () => {

  test('orders tab is reachable and renders', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-orders').click();
    await expect(page.getByTestId('tab-orders')).toBeVisible();
  });

  test('order-filter-symbol input is present', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-orders').click();
    await expect(page.getByTestId('order-filter-symbol')).toBeVisible();
  });

  test('order-filter-status dropdown is present', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-orders').click();
    await expect(page.getByTestId('order-filter-status')).toBeVisible();
  });

  test('order-filter-side dropdown is present', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-orders').click();
    await expect(page.getByTestId('order-filter-side')).toBeVisible();
  });

  test('order-count badge renders', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-orders').click();
    await expect(page.getByTestId('order-count')).toBeVisible();
  });

  test('filtering by symbol narrows results', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-orders').click();

    const countBefore = (await page.getByTestId('order-count').textContent()) ?? '';
    await page.getByTestId('order-filter-symbol').fill('ZZZZZ_NOMATCH');
    // Count should show "0 / N orders"
    const countAfter = (await page.getByTestId('order-count').textContent()) ?? '';
    expect(countAfter).toMatch(/^0 \//);
    expect(countBefore).not.toBe('');   // just confirm it was rendered
  });

  test('orders list or empty state is present', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-orders').click();
    const list  = page.getByTestId('orders-list');
    const empty = page.getByTestId('orders-empty');
    const anyVisible = (await list.isVisible().catch(() => false)) || (await empty.isVisible().catch(() => false));
    expect(anyVisible).toBe(true);
  });

  test('clicking an order row opens drawer with raw JSON', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-orders').click();

    // Only test drawer if there are rows
    const listVisible = await page.getByTestId('orders-list').isVisible().catch(() => false);
    if (!listVisible) {
      test.skip(); // no orders in live state — acceptable
      return;
    }

    const firstRow = page.locator('[data-testid^="order-row-"]').first();
    await firstRow.click();

    // Raw JSON pre block should appear
    const rawBlock = page.locator('[data-testid^="order-raw-"]').first();
    await expect(rawBlock).toBeVisible();
    const text = await rawBlock.textContent();
    expect(text).toContain('"symbol"');   // raw broker JSON contains symbol key
  });
});
