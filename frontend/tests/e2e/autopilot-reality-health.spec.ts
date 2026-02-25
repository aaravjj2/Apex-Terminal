/**
 * Autopilot Options — Reality Health E2E
 *
 * Verifies the /ui2/autopilot-options Health tab shows live Alpaca
 * connectivity, market session badge, options status, and has
 * NO DEMO banner anywhere on screen.
 *
 * data-testid only — no CSS selectors.
 */

import { test, expect } from '@playwright/test';

const BASE = '/ui2/autopilot-options';

test.describe('Autopilot Options — Health Reality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('[data-testid="autopilot-options-page"]', { timeout: 15000 });
  });

  test('page loads with header and status strip', async ({ page }) => {
    // Header exists
    await expect(page.getByTestId('autopilot-options-header')).toBeVisible();

    // Status strip badges
    await expect(page.getByTestId('autopilot-options-alpaca-badge')).toBeVisible();
    await expect(page.getByTestId('autopilot-options-opts-badge')).toBeVisible();
    await expect(page.getByTestId('autopilot-options-market-badge')).toBeVisible();
  });

  test('no DEMO banner on screen', async ({ page }) => {
    // The page must not contain any demo/mock banner text
    const body = await page.textContent('body');
    expect(body?.toUpperCase()).not.toContain('DEMO MODE');
    expect(body?.toUpperCase()).not.toContain('MOCK DATA');
  });

  test('health tab shows connectivity details', async ({ page }) => {
    // Click Health tab
    await page.getByTestId('autopilot-options-tab-health').click();
    await page.waitForSelector('[data-testid="autopilot-options-health-panel"]', { timeout: 10000 });

    // Connectivity panel exists
    await expect(page.getByTestId('autopilot-options-connectivity')).toBeVisible({ timeout: 10000 });

    // Paper URL shown
    await expect(page.getByTestId('autopilot-options-paper-url')).toBeVisible();

    // Connection badge exists (success or danger depending on config)
    await expect(page.getByTestId('autopilot-options-conn-badge')).toBeVisible();

    // Latency shown
    await expect(page.getByTestId('autopilot-options-latency')).toBeVisible();

    // Options enabled badge
    await expect(page.getByTestId('autopilot-options-enabled-badge')).toBeVisible();
  });

  test('health tab shows system health details', async ({ page }) => {
    await page.getByTestId('autopilot-options-tab-health').click();
    await page.waitForSelector('[data-testid="autopilot-options-health-details"]', { timeout: 10000 });

    await expect(page.getByTestId('autopilot-options-armed-detail')).toBeVisible();
    await expect(page.getByTestId('autopilot-options-ks-detail')).toBeVisible();
    await expect(page.getByTestId('autopilot-options-market-detail')).toBeVisible();
    await expect(page.getByTestId('autopilot-options-alpaca-detail')).toBeVisible();
    await expect(page.getByTestId('autopilot-options-gw-detail')).toBeVisible();
    await expect(page.getByTestId('autopilot-options-cycles-detail')).toBeVisible();
  });

  test('/api/autopilot-options/health returns valid JSON with correlation_id', async ({ request }) => {
    const resp = await request.get('/api/autopilot-options/health');
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body).toHaveProperty('armed');
    expect(body).toHaveProperty('kill_switch_active');
    expect(body).toHaveProperty('market_session');
    expect(body).toHaveProperty('providers');
    expect(body).toHaveProperty('loop');
    expect(body).toHaveProperty('risk_controls');
    expect(body).toHaveProperty('universe');
    expect(body).toHaveProperty('correlation_id');
    expect(body.correlation_id).toMatch(/^ap-/);
  });
});
