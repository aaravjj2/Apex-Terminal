/**
 * Wave 107 — Safe actions (tickets) E2E tests.
 * Playwright: agent creates ticket → ticket searchable → audit trail visible.
 * Hard rules: data-testid only, no waitForTimeout, workers=1.
 */

import { test, expect } from '@playwright/test';

const API = 'http://localhost:8090/api/v3/tickets';
const UI  = 'http://localhost:5100/ui2/safe-actions';

// Clean tickets before every test
test.beforeEach(async ({ request }) => {
  await request.delete(`${API}/data`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Page structure
// ─────────────────────────────────────────────────────────────────────────────

test('safe-actions page loads', async ({ page }) => {
  await page.goto(UI);
  const shell = page.getByTestId('safe-actions-page');
  await expect(shell).toBeAttached();
  const ready = page.getByTestId('page-ready');
  await expect(ready).toBeAttached();
});

test('safe-actions has title', async ({ page }) => {
  await page.goto(UI);
  await expect(page.getByTestId('page-ready')).toBeAttached();
  await expect(page.getByTestId('safe-actions-title')).toBeAttached();
});

test('safe-actions has create ticket form', async ({ page }) => {
  await page.goto(UI);
  await expect(page.getByTestId('page-ready')).toBeAttached();
  await expect(page.getByTestId('create-ticket-panel')).toBeAttached();
  await expect(page.getByTestId('ticket-title-input')).toBeAttached();
  await expect(page.getByTestId('create-ticket-btn')).toBeAttached();
});

test('safe-actions has search input and audit panel', async ({ page }) => {
  await page.goto(UI);
  await expect(page.getByTestId('page-ready')).toBeAttached();
  await expect(page.getByTestId('ticket-search-input')).toBeAttached();
  await expect(page.getByTestId('audit-trail-panel')).toBeAttached();
});

// ─────────────────────────────────────────────────────────────────────────────
// Core scenario: create → appears in list → open audit trail
// ─────────────────────────────────────────────────────────────────────────────

test('agent creates ticket → ticket searchable → audit trail visible', async ({ page }) => {
  await page.goto(UI);
  await expect(page.getByTestId('page-ready')).toBeAttached();

  // Fill form
  await page.getByTestId('ticket-title-input').fill('Critical position limit breach');
  await page.getByTestId('ticket-description-input').fill('Detected by agent monitor');
  await page.getByTestId('ticket-priority-select').selectOption('high');
  await page.getByTestId('ticket-role-select').selectOption('agent');

  // Submit
  await page.getByTestId('create-ticket-btn').click();

  // Success feedback
  await expect(page.getByTestId('create-ticket-success')).toBeAttached();

  // Ticket appears in list (use first ticket-row to get the most recent)
  const list = page.getByTestId('tickets-list');
  await expect(list).toBeAttached();
  const firstRow = list.locator('[data-testid^="ticket-row-"]').first();
  await expect(firstRow).toBeAttached();

  // Click ticket to open audit trail
  await firstRow.click();
  const auditPanel = page.getByTestId('audit-trail-panel');
  await expect(auditPanel).toBeAttached();
  const eventsList = page.getByTestId('audit-events-list');
  await expect(eventsList).toBeAttached();
  // At least one audit event visible
  const firstEvent = eventsList.locator('[data-testid^="audit-event-"]').first();
  await expect(firstEvent).toBeAttached();
});

// ─────────────────────────────────────────────────────────────────────────────
// RBAC gate: viewer is blocked
// ─────────────────────────────────────────────────────────────────────────────

test('viewer role is blocked from creating ticket', async ({ page }) => {
  await page.goto(UI);
  await expect(page.getByTestId('page-ready')).toBeAttached();
  await page.getByTestId('ticket-title-input').fill('RBAC test');
  await page.getByTestId('ticket-role-select').selectOption('viewer (blocked)');
  await page.getByTestId('create-ticket-btn').click();
  await expect(page.getByTestId('create-ticket-error')).toBeAttached();
});

// ─────────────────────────────────────────────────────────────────────────────
// API contract tests
// ─────────────────────────────────────────────────────────────────────────────

test('API GET /version returns w107', async ({ request }) => {
  const r = await request.get(`${API}/version`);
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(body.version).toMatch(/^w107-/);
});

test('API POST /tickets creates ticket with admin role', async ({ request }) => {
  const r = await request.post(`${API}/tickets`, {
    data: { title: 'API test', description: '', priority: 'medium', created_by: 'test', role: 'admin' },
  });
  expect(r.status()).toBe(201);
  const body = await r.json();
  expect(body.id).toBeTruthy();
  expect(body.status).toBe('open');
});

test('API POST /tickets returns 403 for viewer role', async ({ request }) => {
  const r = await request.post(`${API}/tickets`, {
    data: { title: 'blocked', description: '', priority: 'low', created_by: 'v1', role: 'viewer' },
  });
  expect(r.status()).toBe(403);
});

test('API POST /tickets idempotent with same ticket_id', async ({ request }) => {
  const tid = `idem-${Date.now()}`;
  const r1 = await request.post(`${API}/tickets`, {
    data: { title: 'original', description: '', priority: 'low', created_by: 'a', role: 'agent', ticket_id: tid },
  });
  expect(r1.status()).toBe(201);
  const r2 = await request.post(`${API}/tickets`, {
    data: { title: 'duplicate', description: '', priority: 'high', created_by: 'b', role: 'admin', ticket_id: tid },
  });
  expect(r2.status()).toBe(201);
  const b1 = await r1.json();
  const b2 = await r2.json();
  expect(b1.id).toBe(b2.id);
  expect(b2.title).toBe('original');
});

test('API GET /tickets/search returns hits structure', async ({ request }) => {
  const r = await request.get(`${API}/tickets/search`);
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(Array.isArray(body.hits)).toBe(true);
  expect(typeof body.total).toBe('number');
});

test('API GET /tickets/{id}/audit returns events', async ({ request }) => {
  const cr = await request.post(`${API}/tickets`, {
    data: { title: 'Audit test', description: '', priority: 'medium', created_by: 'ag', role: 'agent' },
  });
  const ticket = await cr.json();
  const r = await request.get(`${API}/tickets/${ticket.id}/audit`);
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(Array.isArray(body.events)).toBe(true);
  expect(body.events.length).toBeGreaterThanOrEqual(1);
  expect(body.events[0].event_type).toBe('created');
});

test('API GET /tickets/{id} 404 for unknown', async ({ request }) => {
  const r = await request.get(`${API}/tickets/nonexistent-ticket-id`);
  expect(r.status()).toBe(404);
});

test('API PATCH /tickets/{id} updates status + produces audit event', async ({ request }) => {
  const cr = await request.post(`${API}/tickets`, {
    data: { title: 'Patch test', description: '', priority: 'medium', created_by: 'ag', role: 'agent' },
  });
  const ticket = await cr.json();
  const pr = await request.patch(`${API}/tickets/${ticket.id}`, {
    data: { updated_by: 'admin1', role: 'admin', updates: { status: 'closed' } },
  });
  expect(pr.status()).toBe(200);
  const updated = await pr.json();
  expect(updated.status).toBe('closed');

  // Verify audit trail has 'updated' event
  const ar = await request.get(`${API}/tickets/${ticket.id}/audit`);
  const audit = await ar.json();
  const types = audit.events.map((e: { event_type: string }) => e.event_type);
  expect(types).toContain('updated');
});

test('API GET /rbac/check returns allowed status', async ({ request }) => {
  const r1 = await request.get(`${API}/rbac/check?role=admin`);
  expect(r1.status()).toBe(200);
  const b1 = await r1.json();
  expect(b1.allowed).toBe(true);

  const r2 = await request.get(`${API}/rbac/check?role=viewer`);
  const b2 = await r2.json();
  expect(b2.allowed).toBe(false);
});
