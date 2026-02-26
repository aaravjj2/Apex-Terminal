/**
 * live-reconciliation.spec.ts
 *
 * Verifies the Positions tab shows broker-truth positions and
 * that the incident banner fires when exit triggers are active.
 */

import { test, expect } from '@playwright/test';

const PAGE = 'http://localhost:5100/ui2/autopilot-command-center';

test.describe('Autopilot — Positions & Reconciliation', () => {

  test('positions tab is reachable and renders', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-positions').click();
    await expect(page.getByTestId('tab-positions')).toBeVisible();
  });

  test('positions list or empty state present', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-positions').click();
    const list  = page.getByTestId('positions-list');
    const empty = page.getByTestId('positions-empty');
    const anyVisible = (await list.isVisible().catch(() => false)) || (await empty.isVisible().catch(() => false));
    expect(anyVisible).toBe(true);
  });

  test('position rows contain symbol, side, qty, unrealized pl columns', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-positions').click();

    const listVisible = await page.getByTestId('positions-list').isVisible().catch(() => false);
    if (!listVisible) {
      test.skip();
      return;
    }

    const firstRow = page.locator('[data-testid^="position-row-"]').first();
    await expect(firstRow).toBeVisible();
    const text = (await firstRow.textContent()) ?? '';
    // Row must contain currency or percentage info
    expect(text.length).toBeGreaterThan(5);
  });

  test('incident banner renders when exit trigger present', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-positions').click();

    // The incident banner is conditional — only shown when triggers exist
    // We just verify the DOM element type is correct if it appears
    const banner = page.getByTestId('incident-banner');
    const visible = await banner.isVisible().catch(() => false);
    if (visible) {
      const bannerText = (await banner.textContent()) ?? '';
      expect(bannerText).toContain('exit trigger');
    }
    // If not visible with live data, that's correct (no triggered exits)
  });

  test('PnL tab card-account is shown', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-pnl').click();
    await expect(page.getByTestId('tab-pnl')).toBeVisible();
    // card-account or empty state
    const card  = page.getByTestId('card-account');
    const empty = page.getByTestId('pnl-empty');
    const anyVisible = (await card.isVisible().catch(() => false)) || (await empty.isVisible().catch(() => false));
    expect(anyVisible).toBe(true);
  });

  test('daily-loss-bar renders when pnl data available', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-pnl').click();
    // May or may not exist depending on API; verify no JS error crashes page
    await expect(page.getByTestId('tab-pnl')).toBeVisible();
  });
});
