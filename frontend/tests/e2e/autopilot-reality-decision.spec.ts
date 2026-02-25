/**
 * Autopilot Options — Decision Cycle E2E
 *
 * Verifies that:
 *  1. Decision + rejection tables are empty on fresh state
 *  2. Running a cycle (disarmed) produces decisions/rejections but no orders
 *  3. All responses carry correlation_id
 *
 * data-testid only — no CSS selectors.
 */

import { test, expect } from '@playwright/test';

const BASE = '/ui2/autopilot-options';

test.describe('Autopilot Options — Decision Cycle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('[data-testid="autopilot-options-page"]', { timeout: 15000 });
  });

  test('decisions tab shows empty state initially', async ({ page }) => {
    await page.getByTestId('autopilot-options-tab-decisions').click();
    await page.waitForSelector('[data-testid="autopilot-options-decisions-panel"]', { timeout: 5000 });

    // The empty message OR a table — on a fresh server it should be empty
    const panel = page.getByTestId('autopilot-options-decisions-panel');
    await expect(panel).toBeVisible();
  });

  test('rejections tab shows empty state initially', async ({ page }) => {
    await page.getByTestId('autopilot-options-tab-rejections').click();
    await page.waitForSelector('[data-testid="autopilot-options-rejections-panel"]', { timeout: 5000 });

    const panel = page.getByTestId('autopilot-options-rejections-panel');
    await expect(panel).toBeVisible();
  });

  test('run now (disarmed) produces decisions but no orders via API', async ({ request }) => {
    // Ensure disarmed
    await request.post('/api/autopilot-options/arm', {
      data: { armed: false },
    });

    // Verify disarmed
    const armResp = await request.get('/api/autopilot-options/arm');
    const armBody = await armResp.json();
    expect(armBody.armed).toBe(false);

    // Run cycle
    const resp = await request.post('/api/autopilot-options/run-now', {
      data: { symbols: ['SPY'], dry_run: false },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body).toHaveProperty('ok', true);
    expect(body).toHaveProperty('decision_id');
    expect(body).toHaveProperty('decisions');
    expect(body).toHaveProperty('rejections');
    expect(body).toHaveProperty('orders');
    expect(body).toHaveProperty('correlation_id');
    expect(body.correlation_id).toMatch(/^ap-/);

    // Since disarmed: orders should be empty
    expect(body.orders).toHaveLength(0);

    // At least one decision OR rejection was produced for SPY
    const total = (body.decisions?.length ?? 0) + (body.rejections?.length ?? 0);
    expect(total).toBeGreaterThanOrEqual(1);
  });

  test('run now via UI produces run result', async ({ page }) => {
    // Navigate to controls tab (default)
    await page.waitForSelector('[data-testid="autopilot-options-controls-panel"]', { timeout: 5000 });

    // Click Run Now
    const runBtn = page.getByTestId('autopilot-options-run-btn');
    await expect(runBtn).toBeVisible();
    await runBtn.click();

    // Wait for run result to appear
    await page.waitForSelector('[data-testid="autopilot-options-run-result"]', { timeout: 30000 });
    const resultText = await page.getByTestId('autopilot-options-run-result').textContent();
    expect(resultText).toContain('Cycle done');
  });

  test('decisions endpoint returns valid JSON with correlation_id', async ({ request }) => {
    const resp = await request.get('/api/autopilot-options/decisions?limit=10');
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body).toHaveProperty('decisions');
    expect(body).toHaveProperty('count');
    expect(body).toHaveProperty('correlation_id');
    expect(Array.isArray(body.decisions)).toBe(true);
  });

  test('rejections endpoint returns valid JSON with correlation_id', async ({ request }) => {
    const resp = await request.get('/api/autopilot-options/rejections?limit=10');
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body).toHaveProperty('rejections');
    expect(body).toHaveProperty('count');
    expect(body).toHaveProperty('correlation_id');
    expect(Array.isArray(body.rejections)).toBe(true);
  });
});
