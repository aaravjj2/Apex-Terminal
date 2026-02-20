/**
 * Quick verification test: Frontend loads without runtime errors
 * Verifies the PageHeader fix and all major views render.
 * Uses correct nav-item-{id} testids from LeftNavEnhanced.
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5100';

test.describe('UI Fix Verification', () => {

  test('01 - App loads without runtime errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(BASE, { waitUntil: 'networkidle' });

    // Should NOT see "Something went wrong"
    const errorBoundary = page.locator('text=Something went wrong');
    await expect(errorBoundary).not.toBeVisible({ timeout: 5000 });

    // Should see the nav
    const nav = page.getByTestId('left-nav');
    await expect(nav).toBeVisible({ timeout: 10000 });

    // No JS errors
    expect(errors).toEqual([]);

    await page.screenshot({ path: 'test-results/verify-01-app-loads.png', fullPage: true });
  });

  test('02 - Command Center (Dashboard) renders with PageHeader', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });

    const header = page.getByTestId('command-center-header');
    await expect(header).toBeVisible({ timeout: 10000 });

    await expect(page.locator('h1:has-text("Command Center")')).toBeVisible();

    await page.screenshot({ path: 'test-results/verify-02-command-center.png', fullPage: true });
  });

  test('03 - Navigate to Options view', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.getByTestId('left-nav').waitFor({ state: 'visible', timeout: 10000 });

    await page.getByTestId('nav-item-options').click();
    await expect(page.getByTestId('options-view')).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'test-results/verify-03-options.png', fullPage: true });
  });

  test('04 - Navigate to Autopilot view', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.getByTestId('left-nav').waitFor({ state: 'visible', timeout: 10000 });

    await page.getByTestId('nav-item-autopilot').click();
    await expect(page.getByTestId('autopilot-view')).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'test-results/verify-04-autopilot.png', fullPage: true });
  });

  test('05 - Navigate to Portfolio view', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.getByTestId('left-nav').waitFor({ state: 'visible', timeout: 10000 });

    await page.getByTestId('nav-item-portfolio').click();
    await expect(page.getByTestId('portfolio-view')).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'test-results/verify-05-portfolio.png', fullPage: true });
  });

  test('06 - Navigate to Strategies view', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.getByTestId('left-nav').waitFor({ state: 'visible', timeout: 10000 });

    await page.getByTestId('nav-item-strategies').click();
    await expect(page.getByTestId('strategies-view')).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'test-results/verify-06-strategies.png', fullPage: true });
  });

  test('07 - Navigate to Alerts view', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.getByTestId('left-nav').waitFor({ state: 'visible', timeout: 10000 });

    await page.getByTestId('nav-item-alerts').click();
    await expect(page.getByTestId('alerts-view')).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'test-results/verify-07-alerts.png', fullPage: true });
  });

  test('08 - Navigate to Orders view', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.getByTestId('left-nav').waitFor({ state: 'visible', timeout: 10000 });

    await page.getByTestId('nav-item-orders').click();
    await expect(page.getByTestId('orders-view')).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'test-results/verify-08-orders.png', fullPage: true });
  });

  test('09 - Navigate to Settings view', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.getByTestId('left-nav').waitFor({ state: 'visible', timeout: 10000 });

    await page.getByTestId('nav-item-settings').click();
    await expect(page.getByTestId('settings-view')).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'test-results/verify-09-settings.png', fullPage: true });
  });

  test('10 - Navigate to Incidents view', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.getByTestId('left-nav').waitFor({ state: 'visible', timeout: 10000 });

    await page.getByTestId('nav-item-incidents').click();
    await expect(page.getByTestId('incidents-view')).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'test-results/verify-10-incidents.png', fullPage: true });
  });

  test('11 - Navigate to Runs/Audit view', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.getByTestId('left-nav').waitFor({ state: 'visible', timeout: 10000 });

    await page.getByTestId('nav-item-runs').click();
    await expect(page.getByTestId('runs-audit-view')).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'test-results/verify-11-runs-audit.png', fullPage: true });
  });

  test('12 - Navigate to Replay view', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.getByTestId('left-nav').waitFor({ state: 'visible', timeout: 10000 });

    await page.getByTestId('nav-item-replay').click();
    await expect(page.getByTestId('replay-view')).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'test-results/verify-12-replay.png', fullPage: true });
  });

  test('13 - No JS errors navigating through all primary views', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.getByTestId('left-nav').waitFor({ state: 'visible', timeout: 10000 });

    const navIds = [
      'dashboard', 'portfolio', 'orders', 'runs', 'strategies',
      'options', 'autopilot', 'replay', 'alerts', 'incidents', 'settings'
    ];

    for (const id of navIds) {
      await page.getByTestId(`nav-item-${id}`).click();
      await page.waitForLoadState('networkidle');
    }

    expect(errors).toEqual([]);
    await page.screenshot({ path: 'test-results/verify-13-all-views-clean.png', fullPage: true });
  });
});
