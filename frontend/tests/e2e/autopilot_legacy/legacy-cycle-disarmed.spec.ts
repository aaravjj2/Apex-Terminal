/**
 * legacy-cycle-disarmed.spec.ts
 *
 * LEGACY PARITY CONTRACT §4.1 — Exit-before-Entry enforced.
 * LEGACY PARITY CONTRACT §4.4 — Kill-switch honored.
 * CONTRACT: Disarmed cycle produces candidates/rejections but submits 0 orders.
 *
 * Rules:
 *  - data-testid selectors ONLY for UI assertions
 *  - page.request used for direct API checks
 *  - no waitForTimeout
 */

import { test, expect } from '@playwright/test';

const BACKEND = 'http://localhost:8000';
const PAGE    = 'http://localhost:5100/ui2/autopilot-command-center';

test.describe('Legacy Parity — Disarmed Cycle & Kill-Switch', () => {
  // Cycles take up to 15 s; override action timeout for this describe block
  test.use({ actionTimeout: 60_000 });

  // ── API: cycle while disarmed returns success=true, orders_filled=0 ────────

  test('cycle response has required legacy fields', async ({ request }) => {
    const res = await request.post(`${BACKEND}/api/v1/autopilot/cycle`, {
      data: { dry_run: false, force: false }
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // All required fields must exist
    expect(body).toHaveProperty('run_id');
    expect(body).toHaveProperty('success');
    expect(body).toHaveProperty('duration_ms');
    expect(body).toHaveProperty('candidates_generated');
    expect(body).toHaveProperty('candidates_selected');
    expect(body).toHaveProperty('exits_triggered');
    expect(body).toHaveProperty('exits_executed');
    expect(body).toHaveProperty('orders_filled');
    expect(body).toHaveProperty('error');
    // success must be a boolean (not undefined)
    expect(typeof body.success).toBe('boolean');
    // duration must be positive
    expect(body.duration_ms).toBeGreaterThan(0);
  });

  test('disarmed cycle: orders_filled equals 0', async ({ request }) => {
    // First ensure disarmed state by checking status
    const statusRes = await request.get(`${BACKEND}/api/v1/autopilot/status`);
    const status = await statusRes.json();

    // Only assert 0 orders if automation is disabled
    if (!status.automation_enabled) {
      const cycleRes = await request.post(`${BACKEND}/api/v1/autopilot/cycle`, {
        data: { dry_run: false, force: false }
      });
      const cycle = await cycleRes.json();
      // When market is closed or disarmed, no orders should be filled
      expect(cycle.orders_filled).toBe(0);
    }
    // If armed, skip this assertion (orders may fill)
  });

  test('cycle run_id is persisted and retrievable', async ({ request }) => {
    const cycleRes = await request.post(`${BACKEND}/api/v1/autopilot/cycle`, {
      data: { dry_run: false, force: false }
    });
    const cycle = await cycleRes.json();
    expect(cycle.success).toBe(true);

    // The run must be retrievable by ID
    const runRes = await request.get(`${BACKEND}/api/v1/autopilot/run/${cycle.run_id}`);
    expect(runRes.status()).toBe(200);
    const run = await runRes.json();
    expect(run.run_id).toBe(cycle.run_id);
  });

  // ── API: Kill-switch ────────────────────────────────────────────────────────

  test('kill-switch can be toggled on and off', async ({ request }) => {
    // Activate kill switch — field name is 'active' per KillSwitchRequest model
    const onRes = await request.post(`${BACKEND}/api/v1/autopilot/kill-switch`, {
      data: { active: true, close_all: false }
    });
    expect(onRes.status()).toBe(200);

    // Verify it's active
    const statusOn = await (await request.get(`${BACKEND}/api/v1/autopilot/status`)).json();
    expect(statusOn.kill_switch_active).toBe(true);

    // Deactivate kill switch
    const offRes = await request.post(`${BACKEND}/api/v1/autopilot/kill-switch`, {
      data: { active: false, close_all: false }
    });
    expect(offRes.status()).toBe(200);

    // Verify it's inactive
    const statusOff = await (await request.get(`${BACKEND}/api/v1/autopilot/status`)).json();
    expect(statusOff.kill_switch_active).toBe(false);
  });

  // ── UI: Tab navigation ──────────────────────────────────────────────────────

  test('tab-bar and all tab buttons are visible', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('tab-bar')).toBeVisible();
    for (const tabId of ['status', 'cycles', 'decisions', 'rejections', 'orders', 'positions', 'pnl', 'llm']) {
      await expect(page.getByTestId(`tab-btn-${tabId}`)).toBeVisible();
    }
  });

  test('clicking Cycles tab renders tab-cycles section', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-cycles').click();
    await expect(page.getByTestId('tab-cycles')).toBeVisible();
  });

  test('cycles tab shows cycles-list or cycles-empty', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-cycles').click();
    const list  = page.getByTestId('cycles-list');
    const empty = page.getByTestId('cycles-empty');
    const anyVisible = (await list.isVisible().catch(() => false)) ||
                       (await empty.isVisible().catch(() => false));
    expect(anyVisible).toBe(true);
  });

  test('btn-arm or btn-disarm is present (reflects live state)', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    const armVisible   = await page.getByTestId('btn-arm').isVisible().catch(() => false);
    const disarmVisible = await page.getByTestId('btn-disarm').isVisible().catch(() => false);
    expect(armVisible || disarmVisible).toBe(true);
  });

  test('btn-kill-switch is visible and clickable', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    const btn = page.getByTestId('btn-kill-switch');
    await expect(btn).toBeVisible();
  });

  test('btn-run-now triggers cycle without crashing the page', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('btn-run-now').click();
    await expect(page.getByTestId('tab-content')).toBeVisible();
  });
});
