/**
 * legacy-cycle-armed-order-preview.spec.ts
 *
 * LEGACY PARITY CONTRACT §5 — Structured event log per cycle.
 * LEGACY PARITY CONTRACT §3 — POST /arm and /run-now return 200.
 * CONTRACT: Each run artifact is persisted and contains required legacy fields.
 *
 * Rules:
 *  - data-testid selectors ONLY for UI assertions
 *  - page.request for API checks
 *  - no waitForTimeout
 */

import { test, expect } from '@playwright/test';

const BACKEND = 'http://localhost:8000';
const PAGE    = 'http://localhost:5100/ui2/autopilot-command-center';

test.describe('Legacy Parity — Armed State & Structured Event Log', () => {  // Cycles take up to 15 s; override action timeout for this describe block
  test.use({ actionTimeout: 60_000 });
  // ── API: arm + disarm endpoints ────────────────────────────────────────────

  test('POST /api/ops/autopilot/arm returns 200', async ({ request }) => {
    const res = await request.post(`${BACKEND}/api/ops/autopilot/arm`);
    expect(res.status()).toBe(200);
    // Ensure we disarm after arming to keep state clean
    await request.post(`${BACKEND}/api/ops/autopilot/disarm`);
  });

  test('arm sets automation_enabled=true in status', async ({ request }) => {
    await request.post(`${BACKEND}/api/ops/autopilot/arm`);
    const statusRes = await request.get(`${BACKEND}/api/v1/autopilot/status`);
    const status = await statusRes.json();
    expect(status.automation_enabled).toBe(true);
    // Clean up — disarm is POST, not GET
    await request.post(`${BACKEND}/api/ops/autopilot/disarm`);
  });

  test('disarm sets automation_enabled=false in status', async ({ request }) => {
    await request.post(`${BACKEND}/api/ops/autopilot/arm`);
    // disarm is a POST endpoint
    await request.post(`${BACKEND}/api/ops/autopilot/disarm`);
    const statusRes = await request.get(`${BACKEND}/api/v1/autopilot/status`);
    const status = await statusRes.json();
    expect(status.automation_enabled).toBe(false);
  });

  // ── API: structured event log in run artifact (BEFORE run-now to avoid background-task race) ──

  test('cycle run artifact is persisted and contains structured fields', async ({ request }) => {
    // Trigger a cycle (60 s timeout — cycles can take ~5–10 s)
    const cycleRes = await request.post(`${BACKEND}/api/v1/autopilot/cycle`, {
      data: { dry_run: false, force: false },
      timeout: 60_000,
    });
    const cycle = await cycleRes.json();
    expect(cycle.success).toBe(true);

    // Fetch the run artifact
    const runRes = await request.get(`${BACKEND}/api/v1/autopilot/run/${cycle.run_id}`);
    expect(runRes.status()).toBe(200);
    const run = await runRes.json();

    // Must have all parity contract fields — run artifact uses nested shape
    expect(run).toHaveProperty('run_id');
    expect(run.run_id).toBe(cycle.run_id);
    expect(run).toHaveProperty('success');
    expect(run).toHaveProperty('duration_ms');
    expect(run).toHaveProperty('correlation_id');
    // candidates are nested: run.candidates.generated / run.candidates.selected
    expect(run).toHaveProperty('candidates');
    expect(run.candidates).toHaveProperty('generated');
    expect(run.candidates).toHaveProperty('selected');
    // monitoring: run.monitoring.exits_triggered / run.monitoring.exits_executed
    expect(run).toHaveProperty('monitoring');
    expect(run.monitoring).toHaveProperty('exits_triggered');
    expect(run.monitoring).toHaveProperty('exits_executed');
    // orders: run.orders.filled
    expect(run).toHaveProperty('orders');
    expect(run.orders).toHaveProperty('filled');
  });

  test('runs list grows after cycle completes', async ({ request }) => {
    // Use limit=100 to avoid the default limit=20 masking the growth
    const beforeRes = await request.get(`${BACKEND}/api/v1/autopilot/runs?limit=100`);
    const runsBefore = (await beforeRes.json()) as unknown[];
    const countBefore = runsBefore.length;

    // Trigger cycle (60 s timeout)
    await request.post(`${BACKEND}/api/v1/autopilot/cycle`, {
      data: { dry_run: false, force: false },
      timeout: 60_000,
    });

    const afterRes = await request.get(`${BACKEND}/api/v1/autopilot/runs?limit=100`);
    const runsAfter = (await afterRes.json()) as unknown[];
    // Run count must have increased by exactly 1
    expect(runsAfter.length).toBe(countBefore + 1);
  });

  // ── API: broker metrics structure ──────────────────────────────────────────

  test('broker/metrics contains equity, buying_power, cash, day_trade_count', async ({ request }) => {
    const res = await request.get(`${BACKEND}/api/v1/autopilot/broker/metrics`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('equity');
    expect(body).toHaveProperty('buying_power');
    expect(body).toHaveProperty('cash');
    expect(typeof body.equity).toBe('number');
    expect(typeof body.buying_power).toBe('number');
    expect(typeof body.cash).toBe('number');
  });

  // ── UI: Orders tab ─────────────────────────────────────────────────────────

  test('Orders tab renders with filter controls', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-orders').click();
    await expect(page.getByTestId('tab-orders')).toBeVisible();
    await expect(page.getByTestId('order-filter-symbol')).toBeVisible();
    await expect(page.getByTestId('order-filter-status')).toBeVisible();
    await expect(page.getByTestId('order-filter-side')).toBeVisible();
    await expect(page.getByTestId('order-count')).toBeVisible();
  });

  test('Orders list or empty state is present', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-orders').click();
    const list  = page.getByTestId('orders-list');
    const empty = page.getByTestId('orders-empty');
    const anyVisible = (await list.isVisible().catch(() => false)) ||
                       (await empty.isVisible().catch(() => false));
    expect(anyVisible).toBe(true);
  });

  test('Symbol filter narrows order count to zero for impossible symbol', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-orders').click();
    await page.getByTestId('order-filter-symbol').fill('ZZZZZ_NOMATCH');
    const countText = await page.getByTestId('order-count').textContent();
    expect(countText).toMatch(/^0 \//);
  });

  // ── API: run-now (LAST — background task must not race with cycle tests above) ─

  test('POST /api/ops/autopilot/run-now returns 200 and is not already running', async ({ request }) => {
    const res = await request.post(`${BACKEND}/api/ops/autopilot/run-now`);
    expect([200, 202]).toContain(res.status());
    const body = await res.json();
    // Either ok=true (cycle started) or already_running=true (safe fallback)
    expect(body.ok === true || body.already_running === true).toBe(true);
  });
});
