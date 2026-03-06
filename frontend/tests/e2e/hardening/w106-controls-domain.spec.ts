/**
 * Wave 106 — Controls Domain Playwright spec
 * ES-first controls search, evidence graph with edges.
 * Tests: UI page loads, search → open evidence → see edges, API contract.
 */

import { test, expect } from '@playwright/test';

const FRONT = 'http://localhost:5100';
const API   = 'http://localhost:8000/api/v3/controls';

// ── Helper: seed a control + edge, return IDs ─────────────────────────────
async function seedControlAndEdge(
  request: import('@playwright/test').APIRequestContext,
  reference: string,
) {
  const controlRes = await request.post(`${API}/controls`, {
    data: { doc_type: 'ap-ar', data: { reference, amount: 9999, description: 'Test AP/AR entry' } },
  });
  expect(controlRes.status()).toBe(201);
  const controlId = (await controlRes.json()).id;

  const edgeRes = await request.post(`${API}/edges`, {
    data: { from_id: controlId, to_id: 'audit-event-w106', edge_type: 'control-link', metadata: { test: true } },
  });
  expect(edgeRes.status()).toBe(201);
  return { controlId };
}

// ── 1. Page structure tests ───────────────────────────────────────────────────

test('controls-domain page loads', async ({ page }) => {
  await page.goto(`${FRONT}/ui2/controls-domain`);
  await expect(page.getByTestId('controls-domain-page')).toBeAttached({ timeout: 15000 });
  await expect(page.getByTestId('page-ready')).toBeAttached({ timeout: 15000 });
  await expect(page.getByTestId('controls-domain-title')).toBeAttached();
});

test('controls-domain has search input and button', async ({ page }) => {
  await page.goto(`${FRONT}/ui2/controls-domain`);
  await expect(page.getByTestId('page-ready')).toBeAttached({ timeout: 15000 });
  await expect(page.getByTestId('controls-search-input')).toBeAttached();
  await expect(page.getByTestId('controls-search-btn')).toBeAttached();
});

// ── 2. Core scenario: search → open evidence → see edges ─────────────────────

test('auditor: search control → open evidence → see linked edges', async ({ page, request }) => {
  // Seed
  await request.delete(`${API}/data`);
  const { controlId } = await seedControlAndEdge(request, 'INV-W106-SCENARIO');

  // Navigate and search
  await page.goto(`${FRONT}/ui2/controls-domain`);
  await expect(page.getByTestId('page-ready')).toBeAttached({ timeout: 15000 });

  await page.getByTestId('controls-search-input').fill('INV-W106-SCENARIO');
  await page.getByTestId('controls-search-btn').click();

  // Results list appears with at least one item
  await expect(page.getByTestId('controls-results-list')).toBeAttached({ timeout: 10000 });
  const resultItem = page.getByTestId(`controls-result-${controlId}`);
  await expect(resultItem).toBeAttached({ timeout: 10000 });

  // Click the result to open evidence panel
  await resultItem.click();

  // Evidence panel is now populated with edges
  await expect(page.getByTestId('controls-evidence-panel')).toBeAttached();
  await expect(page.getByTestId('controls-edges-list')).toBeAttached({ timeout: 5000 });
});

// ── 3. Evidence panel visible on page load ───────────────────────────────────

test('controls-domain has evidence panel visible', async ({ page }) => {
  await page.goto(`${FRONT}/ui2/controls-domain`);
  await expect(page.getByTestId('page-ready')).toBeAttached({ timeout: 15000 });
  await expect(page.getByTestId('controls-evidence-panel')).toBeAttached();
  await expect(page.getByTestId('controls-results-list')).toBeAttached();
});

// ── 4. API contract tests ─────────────────────────────────────────────────────

test('API GET /controls/version returns w106', async ({ request }) => {
  const res = await request.get(`${API}/version`);
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.version).toContain('w106');
  expect(data.doc_types).toContain('ap-ar');
  expect(data.doc_types).toContain('reconciliation');
});

test('API POST /controls indexes AP/AR control', async ({ request }) => {
  const res = await request.post(`${API}/controls`, {
    data: { doc_type: 'ap-ar', data: { reference: 'AP-TEST-001', amount: 1500 } },
  });
  expect(res.status()).toBe(201);
  const data = await res.json();
  expect(data.id).toBeTruthy();
  expect(data.doc_type).toBe('ap-ar');
});

test('API POST /controls indexes reconciliation control', async ({ request }) => {
  const res = await request.post(`${API}/controls`, {
    data: { doc_type: 'reconciliation', data: { reference: 'RECON-TEST-001', period: '2025-Q1' } },
  });
  expect(res.status()).toBe(201);
  expect((await res.json()).doc_type).toBe('reconciliation');
});

test('API GET /controls/search returns hits structure', async ({ request }) => {
  const res = await request.get(`${API}/controls/search?q=`);
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data).toHaveProperty('hits');
  expect(data).toHaveProperty('total');
});

test('API POST /edges + GET /edges returns edge', async ({ request }) => {
  const controlRes = await request.post(`${API}/controls`, {
    data: { doc_type: 'ap-ar', data: { reference: 'EDGE-TEST-API' } },
  });
  const controlId = (await controlRes.json()).id;

  const edgeRes = await request.post(`${API}/edges`, {
    data: { from_id: controlId, to_id: 'ev-999', edge_type: 'linked-event' },
  });
  expect(edgeRes.status()).toBe(201);

  const listRes = await request.get(`${API}/edges?from_id=${controlId}`);
  const data = await listRes.json();
  expect(data.total).toBeGreaterThanOrEqual(1);
  expect(data.edges[0].from_id).toBe(controlId);
});

test('API GET /controls/{doc_id} returns control', async ({ request }) => {
  const posted = await request.post(`${API}/controls`, {
    data: { doc_type: 'ap-ar', data: { reference: 'GET-BY-ID-TEST' } },
  });
  const docId = (await posted.json()).id;

  const res = await request.get(`${API}/controls/${docId}`);
  expect(res.status()).toBe(200);
  expect((await res.json()).id).toBe(docId);
});

test('API GET /controls/{doc_id} 404 for missing', async ({ request }) => {
  const res = await request.get(`${API}/controls/definitely-missing-id`);
  expect(res.status()).toBe(404);
});
