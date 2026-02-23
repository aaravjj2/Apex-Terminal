/**
 * W112 — Persistent window: single browser context reused across all tests.
 *
 * Pattern:
 *   - One Page created in beforeAll; reused by every test (describe.serial).
 *   - Server state reset via POST /api/v3/ops/reset-all in beforeEach.
 *   - Tests verify: reset endpoints, navigation across multiple routes on the
 *     same page object, context count, and data-clearing behaviour.
 *
 * Hard gates: data-testid selectors only · no waitForTimeout · headless=false ·
 *             workers=1 · retries=0
 */

import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:8090';
const UI  = 'http://localhost:5100';

// Shared page — created once, reused by every test in this describe block.
let sharedPage: Page;

test.describe.serial('W112 — persistent window (single context)', () => {
  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage();
  });

  test.afterAll(async () => {
    await sharedPage.context().close();
  });

  // Reset server state before each individual test.
  test.beforeEach(async ({ request }) => {
    const res = await request.post(`${API}/api/v3/ops/reset-all`);
    expect(res.status()).toBe(200);
  });

  // ── reset version endpoint ──────────────────────────────────────────────
  test('w112-01 reset/version returns w112-v1.0', async ({ request }) => {
    const res  = await request.get(`${API}/api/v3/ops/reset/version`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.version).toBe('w112-v1.0');
    expect(body.status).toBe('ok');
  });

  // ── reset-all shape ─────────────────────────────────────────────────────
  test('w112-02 reset-all returns status ok with expected keys', async ({ request }) => {
    const res  = await request.post(`${API}/api/v3/ops/reset-all`);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBe('w112-v1.0');
    expect(body).toHaveProperty('sqlite');
    expect(body).toHaveProperty('es');
  });

  // ── persistent page — navigation ────────────────────────────────────────
  test('w112-03 shared page loads /ui2/safe-actions', async () => {
    await sharedPage.goto(`${UI}/ui2/safe-actions`);
    await expect(sharedPage.locator('[data-testid="page-ready"]')).toBeAttached({ timeout: 15_000 });
  });

  test('w112-04 same page navigates to /ui2/accessibility without new context', async () => {
    await sharedPage.goto(`${UI}/ui2/accessibility`);
    await expect(sharedPage.locator('[data-testid="page-ready"]')).toBeAttached({ timeout: 15_000 });
    expect(sharedPage.isClosed()).toBe(false);
  });

  test('w112-05 same page navigates to /ui2/export-bundle', async () => {
    await sharedPage.goto(`${UI}/ui2/export-bundle`);
    await expect(sharedPage.locator('[data-testid="page-ready"]')).toBeAttached({ timeout: 15_000 });
  });

  // ── context count assertion ─────────────────────────────────────────────
  test('w112-06 browser has at least one context (shared context exists)', async ({ browser }) => {
    // We created sharedPage in beforeAll → at least one context must exist.
    expect(browser.contexts().length).toBeGreaterThanOrEqual(1);
  });

  // ── data clearing ───────────────────────────────────────────────────────
  test('w112-07 reset-all clears created ticket (sqlite rowcount >= 1)', async ({ request }) => {
    // Create a ticket so there is at least one row to delete.
    const create = await request.post(`${API}/api/v3/tickets/tickets`, {
      data: { title: 'W112 e2e sentinel', created_by: 'w112-spec', role: 'auditor' },
    });
    expect([200, 201]).toContain(create.status());

    // Reset — sqlite.tickets must be >= 1.
    const reset = await request.post(`${API}/api/v3/ops/reset-all`);
    expect(reset.status()).toBe(200);
    const body = await reset.json();
    const ticketCount = (body.sqlite as Record<string, unknown>)['tickets'];
    expect(typeof ticketCount).toBe('number');
    expect(ticketCount as number).toBeGreaterThanOrEqual(1);
  });

  // ── idempotency ─────────────────────────────────────────────────────────
  test('w112-08 reset-all is idempotent — second call also returns ok', async ({ request }) => {
    const r2 = await request.post(`${API}/api/v3/ops/reset-all`);
    expect(r2.status()).toBe(200);
    expect((await r2.json()).status).toBe('ok');
  });

  // ── page survives full reset ─────────────────────────────────────────────
  test('w112-09 shared page still alive after server reset', async ({ request }) => {
    await request.post(`${API}/api/v3/ops/reset-all`);
    // The page object must still be usable.
    expect(sharedPage.isClosed()).toBe(false);
    await sharedPage.goto(`${UI}/ui2/safe-actions`);
    await expect(sharedPage.locator('[data-testid="page-ready"]')).toBeAttached({ timeout: 15_000 });
  });

  // ── all expected tables reported in sqlite result ───────────────────────
  test('w112-10 sqlite result contains all expected table keys', async ({ request }) => {
    const res  = await request.post(`${API}/api/v3/ops/reset-all`);
    const body = await res.json();
    const sqlite = body.sqlite as Record<string, unknown>;
    for (const tbl of ['tickets', 'controls_documents', 'a11y_audit_runs', 'perf_budget_samples']) {
      expect(sqlite).toHaveProperty(tbl);
    }
  });
});
