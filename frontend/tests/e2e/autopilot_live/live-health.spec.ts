/**
 * live-health.spec.ts
 *
 * Asserts that the Autopilot Command Center Status Strip shows live health data.
 *
 * Rules:
 *  - data-testid selectors ONLY
 *  - no waitForTimeout
 *  - retries=0, workers=1 (set in playwright.config.ts)
 */

import { test, expect } from '@playwright/test';

const BASE  = 'http://localhost:5100/ui2';
const PAGE  = `${BASE}/autopilot-command-center`;

test.describe('Autopilot Health — Status Strip', () => {

  test('page loads and tab-bar is visible', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('page-title')).toBeVisible();
    await expect(page.getByTestId('tab-bar')).toBeVisible();
  });

  test('status tab is default and status-strip renders', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('tab-btn-status')).toHaveAttribute('style', /color: rgb\(59, 130, 246\)|color: #3b82f6/);
    await expect(page.getByTestId('status-strip')).toBeVisible();
  });

  test('all status badges are present', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    for (const testId of [
      'badge-alpaca-connected',
      'badge-options-enabled',
      'badge-market-open',
      'badge-quote-fresh',
      'badge-chain-fresh',
      'badge-ws-status',
      'badge-armed',
      'badge-kill-switch',
    ]) {
      await expect(page.getByTestId(testId)).toBeVisible();
    }
  });

  test('card-market-session, card-data-plane, card-engine-loop exist', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('card-market-session')).toBeVisible();
    await expect(page.getByTestId('card-data-plane')).toBeVisible();
    await expect(page.getByTestId('card-engine-loop')).toBeVisible();
  });

  test('universe-list is rendered', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('universe-list')).toBeVisible();
  });

  test('risk-controls-grid is rendered', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('risk-controls-grid')).toBeVisible();
  });

  test('btn-refresh triggers a re-render without error', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('btn-refresh').click();
    // After refresh the tab content must still be present (no crash)
    await expect(page.getByTestId('tab-content')).toBeVisible();
  });
});
