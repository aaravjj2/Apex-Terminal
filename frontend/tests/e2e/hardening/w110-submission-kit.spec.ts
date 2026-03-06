/**
 * Wave 110 — Submission kit demo tour specs.
 * Two automated tours that simulate the judge demo walkthroughs:
 * - TERRACODE tour: Safe Actions + Export Bundle
 * - ELASTIHACK tour: Controls Domain + ES health + ES-powered search
 */

import { test, expect } from '@playwright/test';

const BACKEND = 'http://localhost:8000';
const FRONTEND = 'http://localhost:5100';

// ─────────────────────────────────────────────────────────────────────────────
// TERRACODE Tour (2-3 min demo simulation)
// ─────────────────────────────────────────────────────────────────────────────

test('TERRACODE tour: backend version smoke', async ({ request }) => {
  const r = await request.get(`${BACKEND}/api/v3/export/version`);
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(body.version).toMatch(/^w108-/);
});

test('TERRACODE tour: safe actions page loads', async ({ page }) => {
  await page.goto(`${FRONTEND}/ui2/safe-actions`);
  await expect(page.getByTestId('safe-actions-page')).toBeAttached();
  await expect(page.getByTestId('page-ready')).toBeAttached();
  await expect(page.getByTestId('create-ticket-panel')).toBeAttached();
});

test('TERRACODE tour: ticket creation with admin role', async ({ page }) => {
  await page.goto(`${FRONTEND}/ui2/safe-actions`);
  await expect(page.getByTestId('page-ready')).toBeAttached();

  // Set admin role
  await page.getByTestId('ticket-role-select').selectOption('admin');

  // Fill in ticket
  await page.getByTestId('ticket-title-input').fill('Demo: SOX compliance review');
  await page.getByTestId('ticket-description-input').fill('TERRACODE submission demo ticket');
  await page.getByTestId('create-ticket-btn').click();

  // Success
  await expect(page.getByTestId('create-ticket-success')).toBeAttached();
});

test('TERRACODE tour: viewer is blocked from creating ticket', async ({ request }) => {
  const r = await request.post(`${BACKEND}/api/v3/tickets/tickets`, {
    data: { title: 'Demo', created_by: 'demo-user', role: 'viewer' },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(r.status()).toBe(403);
});

test('TERRACODE tour: export bundle page loads', async ({ page }) => {
  await page.goto(`${FRONTEND}/ui2/export-bundle`);
  await expect(page.getByTestId('export-bundle-page')).toBeAttached();
  await expect(page.getByTestId('page-ready')).toBeAttached();
  await expect(page.getByTestId('create-bundle-btn')).toBeAttached();
});

test('TERRACODE tour: create export bundle shows manifest', async ({ page }) => {
  await page.goto(`${FRONTEND}/ui2/export-bundle`);
  await expect(page.getByTestId('page-ready')).toBeAttached();
  await page.getByTestId('create-bundle-btn').click();
  await expect(page.getByTestId('bundle-result')).toBeAttached();
  await expect(page.getByTestId('manifest-files-list')).toBeAttached();
  await expect(page.getByTestId('download-bundle-btn')).toBeAttached();
});

test('TERRACODE tour: bundle is deterministic', async ({ request }) => {
  const r1 = await request.post(`${BACKEND}/api/v3/export/bundle`);
  const r2 = await request.post(`${BACKEND}/api/v3/export/bundle`);
  const b1 = await r1.json();
  const b2 = await r2.json();
  // db_tables changes with each ticket created, but README and es_templates stay same
  expect(b1.manifest.files['README.md'].sha256).toBe(b2.manifest.files['README.md'].sha256);
});

// ─────────────────────────────────────────────────────────────────────────────
// ELASTIHACK Tour (~3 min demo simulation)
// ─────────────────────────────────────────────────────────────────────────────

test('ELASTIHACK tour: ES cluster health', async ({ request }) => {
  const r = await request.get('http://localhost:9200/_cluster/health');
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(['green', 'yellow']).toContain(body.status);
});

test('ELASTIHACK tour: apex-tickets index exists', async ({ request }) => {
  // Create a ticket first to ensure the index exists
  await request.post(`${BACKEND}/api/v3/tickets/tickets`, {
    data: { title: 'Tour ticket for ES index check', role: 'admin' },
    headers: { 'Content-Type': 'application/json' },
  });
  const r = await request.get('http://localhost:9200/apex-tickets/_count');
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(typeof body.count).toBe('number');
});

test('ELASTIHACK tour: controls domain page loads', async ({ page }) => {
  await page.goto(`${FRONTEND}/ui2/controls-domain`);
  await expect(page.getByTestId('controls-domain-page')).toBeAttached();
  await expect(page.getByTestId('page-ready')).toBeAttached();
});

test('ELASTIHACK tour: controls domain ES sync', async ({ request }) => {
  // Create a control node — this ES write demos the live sync
  const r = await request.post(`${BACKEND}/api/v3/controls/controls`, {
    data: { doc_type: 'ap-ar', doc_id: 'elastihack-demo-1', data: { owner: 'demo', status: 'active' } },
    headers: { 'Content-Type': 'application/json' },
  });
  expect([200, 201]).toContain(r.status());
});

test('ELASTIHACK tour: ES-powered ticket search', async ({ request }) => {
  const r = await request.get(`${BACKEND}/api/v3/tickets/tickets/search?q=tour&role=admin`);
  expect(r.status()).toBe(200);
  const body = await r.json();
  // The search returns {hits: [...], total: N, source: 'es'}
  expect(typeof body.total).toBe('number');
  expect(Array.isArray(body.hits)).toBe(true);
});

test('ELASTIHACK tour: export bundle ES templates captured', async ({ request }) => {
  const r = await request.get(`${BACKEND}/api/v3/export/manifest`);
  expect(r.status()).toBe(200);
  const body = await r.json();
  // es_templates.json is in the manifest
  expect(body.files['es_templates.json']).toBeTruthy();
  expect(body.files['es_templates.json'].sha256.length).toBe(64);
});
