/**
 * Wave 109 — Docker compose + judge mode smoke tests.
 * Validates every service endpoint that a judge would hit against the full stack.
 * Tests run against the locally running stack (same ports as docker-compose.judge.yml).
 */

import { test, expect } from '@playwright/test';

const BACKEND = 'http://localhost:8090';
const FRONTEND = 'http://localhost:5100';
const ES      = 'http://localhost:9200';

// ─────────────────────────────────────────────────────────────────────────────
// ES health
// ─────────────────────────────────────────────────────────────────────────────

test('ES cluster health responds', async ({ request }) => {
  const r = await request.get(`${ES}/_cluster/health`);
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(['green', 'yellow']).toContain(body.status);
});

test('ES version is 8.x', async ({ request }) => {
  const r = await request.get(ES);
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(body.version.number).toMatch(/^8\./);
});

// ─────────────────────────────────────────────────────────────────────────────
// Backend API version smoke
// ─────────────────────────────────────────────────────────────────────────────

test('W104 a11y version responds', async ({ request }) => {
  const r = await request.get(`${BACKEND}/api/v3/a11y/version`);
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(body.version).toMatch(/^w104-/);
});

test('W105 perf version responds', async ({ request }) => {
  const r = await request.get(`${BACKEND}/api/v3/perf/version`);
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(body.version).toMatch(/^w105-/);
});

test('W106 controls version responds', async ({ request }) => {
  const r = await request.get(`${BACKEND}/api/v3/controls/version`);
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(body.version).toMatch(/^w106-/);
});

test('W107 tickets version responds', async ({ request }) => {
  const r = await request.get(`${BACKEND}/api/v3/tickets/version`);
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(body.version).toMatch(/^w107-/);
  expect(body.status).toBe('ok');
});

test('W108 export version responds', async ({ request }) => {
  const r = await request.get(`${BACKEND}/api/v3/export/version`);
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(body.version).toMatch(/^w108-/);
  expect(body.status).toBe('ok');
});

// ─────────────────────────────────────────────────────────────────────────────
// Frontend smoke
// ─────────────────────────────────────────────────────────────────────────────

test('frontend loads at root', async ({ page }) => {
  await page.goto(`${FRONTEND}/ui2/export-bundle`);
  await expect(page.getByTestId('export-bundle-page')).toBeAttached();
  await expect(page.getByTestId('page-ready')).toBeAttached();
});

test('a11y audit page accessible', async ({ page }) => {
  await page.goto(`${FRONTEND}/ui2/accessibility`);
  await expect(page.getByTestId('a11y-audit-page')).toBeAttached();
  await expect(page.getByTestId('page-ready')).toBeAttached();
});

test('perf budget page accessible', async ({ page }) => {
  await page.goto(`${FRONTEND}/ui2/perf-budget`);
  await expect(page.getByTestId('perf-budget-page')).toBeAttached();
  await expect(page.getByTestId('page-ready')).toBeAttached();
});

test('controls domain page accessible', async ({ page }) => {
  await page.goto(`${FRONTEND}/ui2/controls-domain`);
  await expect(page.getByTestId('controls-domain-page')).toBeAttached();
  await expect(page.getByTestId('page-ready')).toBeAttached();
});

test('safe actions page accessible', async ({ page }) => {
  await page.goto(`${FRONTEND}/ui2/safe-actions`);
  await expect(page.getByTestId('safe-actions-page')).toBeAttached();
  await expect(page.getByTestId('page-ready')).toBeAttached();
});

test('export bundle page accessible', async ({ page }) => {
  await page.goto(`${FRONTEND}/ui2/export-bundle`);
  await expect(page.getByTestId('export-bundle-page')).toBeAttached();
  await expect(page.getByTestId('page-ready')).toBeAttached();
});

// ─────────────────────────────────────────────────────────────────────────────
// Judge export round-trip smoke
// ─────────────────────────────────────────────────────────────────────────────

test('judge can create export bundle', async ({ request }) => {
  const r = await request.post(`${BACKEND}/api/v3/export/bundle`);
  expect(r.status()).toBe(201);
  const body = await r.json();
  expect(body.manifest.bundle_hash.length).toBe(64);
});

test('judge can download ZIP bundle', async ({ request }) => {
  const r = await request.get(`${BACKEND}/api/v3/export/bundle/download`);
  expect(r.status()).toBe(200);
  const ct = r.headers()['content-type'];
  expect(ct).toMatch(/zip/);
  expect(r.headers()['x-bundle-hash']).toBeTruthy();
});
