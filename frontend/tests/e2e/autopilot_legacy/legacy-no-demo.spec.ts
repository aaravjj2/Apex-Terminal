/**
 * legacy-no-demo.spec.ts
 *
 * LEGACY PARITY CONTRACT §4.3 — No Demo Data in Runtime.
 * LEGACY PARITY CONTRACT §7 — No-Demo Verification (API + UI).
 * CONTRACT: The system must run exclusively on live Alpaca paper data with
 *           zero mock/demo/seed values in any response or rendered element.
 *
 * Rules:
 *  - data-testid selectors ONLY for UI assertions
 *  - page.request for API checks
 *  - no waitForTimeout
 */

import { test, expect } from '@playwright/test';

const BACKEND = 'http://localhost:8000';
const PAGE    = 'http://localhost:5100/ui2/autopilot-command-center';

// Prefixes that would indicate demo / mock data
const DEMO_PREFIXES = ['mock-', 'demo-', 'seed-', 'fake-', 'test-'];

test.describe('Legacy Parity — No Demo / Mock / Seed Data', () => {  // Cycles take up to 15 s; override action timeout for this describe block
  test.use({ actionTimeout: 60_000 });
  // ── API: run_ids must not be demo ──────────────────────────────────────────

  test('no run_id in /runs starts with a demo prefix', async ({ request }) => {
    const res = await request.get(`${BACKEND}/api/v1/autopilot/runs`);
    expect(res.status()).toBe(200);
    const runs = (await res.json()) as Array<{ run_id: string }>;
    for (const run of runs) {
      for (const prefix of DEMO_PREFIXES) {
        expect(run.run_id.toLowerCase()).not.toContain(prefix);
      }
    }
  });

  test('fresh cycle run_id is not a demo prefix', async ({ request }) => {
    const res = await request.post(`${BACKEND}/api/v1/autopilot/cycle`, {
      data: { dry_run: false, force: false }
    });
    const cycle = await res.json();
    for (const prefix of DEMO_PREFIXES) {
      expect(cycle.run_id.toLowerCase()).not.toContain(prefix);
    }
  });

  // ── API: broker metrics must not be hardcoded demo values ─────────────────

  test('broker/metrics equity is not exactly 100000.0 (demo sentinel)', async ({ request }) => {
    const res = await request.get(`${BACKEND}/api/v1/autopilot/broker/metrics`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    // The exact triple 100000/100000/100000 is the demo sentinel value
    const isAllDemo = body.equity === 100000.0 &&
                      body.buying_power === 100000.0 &&
                      body.cash === 100000.0;
    expect(isAllDemo).toBe(false);
  });

  // ── API: positions must not contain a DEMO symbol ─────────────────────────

  test('positions do not contain a DEMO symbol', async ({ request }) => {
    const res = await request.get(`${BACKEND}/api/v1/autopilot/positions`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    const positions: Array<{ symbol: string }> = body?.positions ?? body ?? [];
    const demoPos = positions.filter(p => p.symbol === 'DEMO');
    expect(demoPos).toHaveLength(0);
  });

  // ── API: Alpaca must be live (ok status, non-zero latency or configured) ───

  test('Alpaca health shows ok — not a simulated response', async ({ request }) => {
    const res = await request.get(`${BACKEND}/api/ops/autopilot/health`);
    const body = await res.json();
    const alpaca = (body.checks as Array<{ name: string; status: string; latency_ms?: number }>)
      .find(c => c.name === 'alpaca');
    expect(alpaca).toBeDefined();
    expect(alpaca!.status).toBe('ok');
    // Non-zero latency indicates a real network round-trip, not a mocked response
    if (alpaca!.latency_ms !== undefined) {
      expect(alpaca!.latency_ms).toBeGreaterThan(0);
    }
  });

  // ── API: cycle error must be null (not a demo error payload) ──────────────

  test('cycle returns error=null on success', async ({ request }) => {
    const res = await request.post(`${BACKEND}/api/v1/autopilot/cycle`, {
      data: { dry_run: false, force: false }
    });
    const cycle = await res.json();
    expect(cycle.success).toBe(true);
    expect(cycle.error).toBeNull();
  });

  // ── UI: no "demo", "mock", "seed" literal text in key panels ──────────────

  test('Status Strip contains no "demo" or "mock" label text', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    const stripText = (await page.getByTestId('status-strip').textContent()) ?? '';
    expect(stripText.toLowerCase()).not.toContain('demo');
    expect(stripText.toLowerCase()).not.toContain('mock');
    expect(stripText.toLowerCase()).not.toContain('seed');
  });

  test('Cycles tab contains no "demo" in run IDs', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-cycles').click();
    const tabText = (await page.getByTestId('tab-cycles').textContent()) ?? '';
    // Run IDs rendered in cycles tab must not start with demo prefixes
    expect(tabText.toLowerCase()).not.toMatch(/\bmock-|\bdemo-|\bseed-/);
  });

  test('Decisions tab contains no "demo" entries', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-decisions').click();
    const tabText = (await page.getByTestId('tab-decisions').textContent()) ?? '';
    expect(tabText.toLowerCase()).not.toMatch(/\bdemo symbol|\bfake trade|\bseed position/);
  });

  test('Positions tab has no DEMO symbol row', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-positions').click();
    // Check if any position row has DEMO as symbol
    const demoRow = page.getByTestId('position-row-DEMO');
    const demoVisible = await demoRow.isVisible().catch(() => false);
    expect(demoVisible).toBe(false);
  });

  test('page renders without a global error banner containing "demo"', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    const errorBanner = page.getByTestId('global-error-banner');
    const visible = await errorBanner.isVisible().catch(() => false);
    if (visible) {
      const text = (await errorBanner.textContent()) ?? '';
      expect(text.toLowerCase()).not.toContain('demo');
      expect(text.toLowerCase()).not.toContain('mock');
    }
  });
});
