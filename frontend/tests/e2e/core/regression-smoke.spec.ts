/**
 * Core Correctness Track — Regression Smoke Suite
 * Verifies all 4 core features load correctly and nav shows only core items.
 * All selectors use data-testid only. No waitForTimeout.
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5100/ui2';

test.describe('Core Regression Smoke', () => {

  test('app shell loads with data-testid=ui2-app-shell', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByTestId('ui2-app-shell')).toBeVisible();
    await expect(page.getByTestId('ui2-left-rail')).toBeVisible();
    await expect(page.getByTestId('ui2-topbar')).toBeVisible();
    await expect(page.getByTestId('ui2-center')).toBeVisible();
  });

  test('nav rail shows autopilot item', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByTestId('ui2-rail-autopilot')).toBeVisible();
  });

  test('nav rail shows search item', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByTestId('ui2-rail-search')).toBeVisible();
  });

  test('nav rail shows workflow-builder item', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByTestId('ui2-rail-workflow-builder')).toBeVisible();
  });

  test('nav rail shows backtest item', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByTestId('ui2-rail-backtest')).toBeVisible();
  });

  test('nav rail shows runs item', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByTestId('ui2-rail-runs')).toBeVisible();
  });

  test('nav rail shows settings item', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByTestId('ui2-rail-settings')).toBeVisible();
  });

  test('nav rail does NOT show dashboard item (feature-flagged off)', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByTestId('ui2-rail-dashboard')).not.toBeVisible();
  });

  test('nav rail does NOT show trading item (feature-flagged off)', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByTestId('ui2-rail-trading')).not.toBeVisible();
  });

  test('autopilot page loads', async ({ page }) => {
    await page.goto(`${BASE}/autopilot`);
    await expect(page.getByTestId('autopilot-ui2-page')).toBeVisible();
  });

  test('search page loads with ready marker', async ({ page }) => {
    await page.goto(`${BASE}/search`);
    await expect(page.getByTestId('search-ui2-page')).toBeVisible();
    await expect(page.getByTestId('search-ready')).toBeAttached();
  });

  test('workflow-builder page loads', async ({ page }) => {
    await page.goto(`${BASE}/workflow-builder`);
    await expect(page.getByTestId('ui2-workflow-builder-page')).toBeVisible();
  });

  test('backtest page loads with ready marker', async ({ page }) => {
    await page.goto(`${BASE}/backtest`);
    await expect(page.getByTestId('backtest-ui2-page')).toBeVisible();
    await expect(page.getByTestId('backtest-ready')).toBeAttached();
  });

  test('runs page loads', async ({ page }) => {
    await page.goto(`${BASE}/runs`);
    // Verify the URL navigated correctly
    await expect(page).toHaveURL(/\/ui2\/runs/);
  });

  test('settings page loads', async ({ page }) => {
    await page.goto(`${BASE}/settings`);
    await expect(page).toHaveURL(/\/ui2\/settings/);
  });

  test('clicking autopilot nav rail navigates to autopilot', async ({ page }) => {
    await page.goto(BASE);
    await page.getByTestId('ui2-rail-autopilot').click();
    await expect(page).toHaveURL(/\/ui2\/autopilot/);
    await expect(page.getByTestId('autopilot-ui2-page')).toBeVisible();
  });

  test('clicking search nav rail navigates to search', async ({ page }) => {
    await page.goto(BASE);
    await page.getByTestId('ui2-rail-search').click();
    await expect(page).toHaveURL(/\/ui2\/search/);
    await expect(page.getByTestId('search-ui2-page')).toBeVisible();
  });

  test('clicking workflow-builder rail navigates correctly', async ({ page }) => {
    await page.goto(BASE);
    await page.getByTestId('ui2-rail-workflow-builder').click();
    await expect(page).toHaveURL(/\/ui2\/workflow-builder/);
    await expect(page.getByTestId('ui2-workflow-builder-page')).toBeVisible();
  });

  test('clicking backtest rail navigates correctly', async ({ page }) => {
    await page.goto(BASE);
    await page.getByTestId('ui2-rail-backtest').click();
    await expect(page).toHaveURL(/\/ui2\/backtest/);
    await expect(page.getByTestId('backtest-ui2-page')).toBeVisible();
  });

});
