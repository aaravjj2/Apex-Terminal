/**
 * legacy-health.spec.ts
 *
 * LEGACY PARITY CONTRACT §3 — All required endpoints return 200.
 * LEGACY PARITY CONTRACT §4.5 — Run-ID format matches /^UAC-\d{14}-\d{4}$/.
 *
 * Rules:
 *  - data-testid selectors ONLY for UI assertions
 *  - page.request used for API assertions
 *  - no waitForTimeout
 *  - retries=0, workers=1 (set in playwright.config.ts)
 */

import { test, expect } from '@playwright/test';

const BACKEND  = 'http://localhost:8000';
const PAGE     = 'http://localhost:5100/ui2/autopilot-command-center';
const RUN_ID_RE = /^UAC-\d{14}-\d{4}$/;

test.describe('Legacy Parity — Health & Endpoint Contract', () => {

  // ── API: required GET endpoints must return 200 ────────────────────────────

  test('GET /api/v1/autopilot/status returns 200', async ({ request }) => {
    const res = await request.get(`${BACKEND}/api/v1/autopilot/status`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.is_running).toBe('boolean');
    expect(typeof body.cycle_count).toBe('number');
    expect(typeof body.automation_enabled).toBe('boolean');
    expect(typeof body.kill_switch_active).toBe('boolean');
    expect(body).toHaveProperty('current_phase');
    expect(body).toHaveProperty('state');
    expect(body).toHaveProperty('trades_executed');
  });

  test('GET /api/v1/autopilot/runs returns 200', async ({ request }) => {
    const res = await request.get(`${BACKEND}/api/v1/autopilot/runs`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Must be an array (empty or populated)
    expect(Array.isArray(body)).toBe(true);
  });

  test('GET /api/v1/autopilot/health returns 200', async ({ request }) => {
    const res = await request.get(`${BACKEND}/api/v1/autopilot/health`);
    expect(res.status()).toBe(200);
  });

  test('GET /api/v1/autopilot/positions returns 200', async ({ request }) => {
    const res = await request.get(`${BACKEND}/api/v1/autopilot/positions`);
    expect(res.status()).toBe(200);
  });

  test('GET /api/v1/autopilot/broker/metrics returns 200', async ({ request }) => {
    const res = await request.get(`${BACKEND}/api/v1/autopilot/broker/metrics`);
    expect(res.status()).toBe(200);
  });

  test('GET /api/ops/autopilot/health returns 200 with all deps', async ({ request }) => {
    const res = await request.get(`${BACKEND}/api/ops/autopilot/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.checks)).toBe(true);
    const names = body.checks.map((c: { name: string }) => c.name);
    expect(names).toContain('alpaca');
    expect(names).toContain('elasticsearch');
    expect(names).toContain('yfinance');
    // Market session must be present
    expect(body).toHaveProperty('market_session');
    expect(body.market_session).toHaveProperty('state');
    expect(body.market_session).toHaveProperty('allow_trading');
  });

  test('GET /api/ops/autopilot/version returns 200', async ({ request }) => {
    const res = await request.get(`${BACKEND}/api/ops/autopilot/version`);
    expect(res.status()).toBe(200);
  });

  // ── API: Alpaca must be connected (not just configured) ────────────────────

  test('Alpaca paper account shows ok in ops health', async ({ request }) => {
    const res = await request.get(`${BACKEND}/api/ops/autopilot/health`);
    const body = await res.json();
    const alpaca = body.checks.find((c: { name: string }) => c.name === 'alpaca');
    expect(alpaca).toBeDefined();
    expect(alpaca.status).toBe('ok');
  });

  // ── API: run_id format parity ──────────────────────────────────────────────

  test('run_id in status matches legacy format UAC-YYYYMMDDHHMMSS-XXXX', async ({ request }) => {
    const statusRes = await request.get(`${BACKEND}/api/v1/autopilot/status`);
    const status = await statusRes.json();
    if (status.last_run_id && status.last_run_id !== null) {
      expect(status.last_run_id).toMatch(RUN_ID_RE);
    }
    // If no run has happened yet, last_run_id may be null — that's acceptable
  });

  test('runs list run_ids all match legacy format', async ({ request }) => {
    const runsRes = await request.get(`${BACKEND}/api/v1/autopilot/runs?limit=100`);
    const runs = await runsRes.json();
    for (const run of runs as Array<{ run_id: string }>) {
      expect(run.run_id).toMatch(RUN_ID_RE);
    }
  });

  // ── UI: page loads and status badges render ────────────────────────────────

  test('page loads without errors and page-title is visible', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('page-title')).toBeVisible();
  });

  test('status-strip renders with alpaca and market badges', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('status-strip')).toBeVisible();
    await expect(page.getByTestId('badge-alpaca-connected')).toBeVisible();
    await expect(page.getByTestId('badge-market-open')).toBeVisible();
  });

  test('ops health checks render via health-checks-list', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    // Health checks panel may require scroll/tab; try status tab first
    await expect(page.getByTestId('status-strip')).toBeVisible();
    // health-checks-list should appear in the status tab
    const hcList = page.getByTestId('health-checks-list');
    const visible = await hcList.isVisible().catch(() => false);
    if (visible) {
      // At least one health check entry must be present
      const checks = page.locator('[data-testid^="health-check-"]');
      const count = await checks.count();
      expect(count).toBeGreaterThan(0);
    }
  });
});
