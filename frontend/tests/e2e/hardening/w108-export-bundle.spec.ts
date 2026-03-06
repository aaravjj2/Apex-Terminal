/**
 * Wave 108 — Export bundle E2E tests.
 * Playwright: ops UI triggers export, manifest displayed, download available.
 */

import { test, expect } from '@playwright/test';

const API = 'http://localhost:8000/api/v3/export';
const UI  = 'http://localhost:5100/ui2/export-bundle';

// ─────────────────────────────────────────────────────────────────────────────
// Page structure
// ─────────────────────────────────────────────────────────────────────────────

test('export-bundle page loads', async ({ page }) => {
  await page.goto(UI);
  await expect(page.getByTestId('export-bundle-page')).toBeAttached();
  await expect(page.getByTestId('page-ready')).toBeAttached();
});

test('export-bundle has title', async ({ page }) => {
  await page.goto(UI);
  await expect(page.getByTestId('page-ready')).toBeAttached();
  await expect(page.getByTestId('export-bundle-title')).toBeAttached();
});

test('export-bundle has create bundle button', async ({ page }) => {
  await page.goto(UI);
  await expect(page.getByTestId('page-ready')).toBeAttached();
  await expect(page.getByTestId('create-bundle-btn')).toBeAttached();
  await expect(page.getByTestId('export-control-panel')).toBeAttached();
});

// ─────────────────────────────────────────────────────────────────────────────
// Core scenario: create bundle → see manifest
// ─────────────────────────────────────────────────────────────────────────────

test('ops triggers export → manifest shown with hashes', async ({ page }) => {
  await page.goto(UI);
  await expect(page.getByTestId('page-ready')).toBeAttached();

  // Click create bundle
  await page.getByTestId('create-bundle-btn').click();

  // Wait for result panel
  const result = page.getByTestId('bundle-result');
  await expect(result).toBeAttached();

  // Files list appears
  const filesList = page.getByTestId('manifest-files-list');
  await expect(filesList).toBeAttached();

  // Key files are present (manifest hashes the 3 content files; manifest.json is not in files list)
  await expect(page.getByTestId('manifest-file-README-md')).toBeAttached();
  await expect(page.getByTestId('manifest-file-db_tables-json')).toBeAttached();
  await expect(page.getByTestId('manifest-file-es_templates-json')).toBeAttached();

  // Download button appears after creation
  await expect(page.getByTestId('download-bundle-btn')).toBeAttached();
});

// ─────────────────────────────────────────────────────────────────────────────
// API contract tests
// ─────────────────────────────────────────────────────────────────────────────

test('API GET /version returns w108', async ({ request }) => {
  const r = await request.get(`${API}/version`);
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(body.version).toMatch(/^w108-/);
});

test('API POST /bundle returns 201 with manifest', async ({ request }) => {
  const r = await request.post(`${API}/bundle`);
  expect(r.status()).toBe(201);
  const body = await r.json();
  expect(body.filename).toMatch(/^apex-export-/);
  expect(body.manifest).toBeTruthy();
  expect(body.manifest.bundle_hash).toBeTruthy();
  expect(body.manifest.bundle_hash.length).toBe(64);
});

test('API GET /manifest has all required files', async ({ request }) => {
  const r = await request.get(`${API}/manifest`);
  expect(r.status()).toBe(200);
  const body = await r.json();
  // Manifest hashes the 3 content files (manifest.json itself is not in the files list)
  expect(body.files['README.md']).toBeTruthy();
  expect(body.files['db_tables.json']).toBeTruthy();
  expect(body.files['es_templates.json']).toBeTruthy();
});

test('API GET /manifest bundle_hash is 64-char SHA256', async ({ request }) => {
  const r = await request.get(`${API}/manifest`);
  const body = await r.json();
  expect(typeof body.bundle_hash).toBe('string');
  expect(body.bundle_hash.length).toBe(64);
});

test('API GET /manifest is deterministic', async ({ request }) => {
  const r1 = await request.get(`${API}/manifest`);
  const r2 = await request.get(`${API}/manifest`);
  const b1 = await r1.json();
  const b2 = await r2.json();
  expect(b1.bundle_hash).toBe(b2.bundle_hash);
  expect(b1.files['README.md'].sha256).toBe(b2.files['README.md'].sha256);
});

test('API GET /bundle/download returns ZIP content-type', async ({ request }) => {
  const r = await request.get(`${API}/bundle/download`);
  expect(r.status()).toBe(200);
  const ct = r.headers()['content-type'];
  expect(ct).toMatch(/zip/);
});

test('API GET /bundle/download has X-Bundle-Hash header', async ({ request }) => {
  const r = await request.get(`${API}/bundle/download`);
  const bundleHash = r.headers()['x-bundle-hash'];
  expect(bundleHash).toBeTruthy();
  expect(bundleHash.length).toBe(64);
});
