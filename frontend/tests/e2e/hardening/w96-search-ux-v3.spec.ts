/**
 * W96 Search UX v3 — Playwright E2E Hardening Tests
 * 14 tests — UI + API
 * No waitForTimeout, data-testid only
 */
import { test, expect, request as playwrightRequest } from '@playwright/test';

const API = 'http://localhost:8090';
const UI = 'http://localhost:5100/ui2/search-v3';

test.describe('W96 Search UX v3 — UI', () => {
  test.beforeAll(async () => {
    const ctx = await playwrightRequest.newContext();
    await ctx.delete(`${API}/api/v3/search-ux/saved`, { timeout: 15000 });
    await ctx.dispose();
  });

  test('page loads and main wrapper visible', async ({ page }) => {
    await page.goto(UI);
    await expect(page.locator('[data-testid="search-v3-page"]')).toBeVisible({ timeout: 10000 });
  });

  test('query input is visible', async ({ page }) => {
    await page.goto(UI);
    await expect(page.locator('[data-testid="search-v3-query-input"]')).toBeVisible({ timeout: 10000 });
  });

  test('search button is visible', async ({ page }) => {
    await page.goto(UI);
    await expect(page.locator('[data-testid="search-v3-submit-btn"]')).toBeVisible({ timeout: 10000 });
  });

  test('explain button is visible', async ({ page }) => {
    await page.goto(UI);
    await expect(page.locator('[data-testid="search-v3-explain-btn"]')).toBeVisible({ timeout: 10000 });
  });

  test('empty state visible before search', async ({ page }) => {
    await page.goto(UI);
    await expect(page.locator('[data-testid="search-v3-empty-state"]')).toBeVisible({ timeout: 10000 });
  });

  test('submit search shows result count and results list', async ({ page }) => {
    await page.goto(UI);
    await page.locator('[data-testid="search-v3-query-input"]').fill('test');
    await page.locator('[data-testid="search-v3-submit-btn"]').click();
    await page.waitForSelector('[data-testid="search-v3-result-count"]', { timeout: 15000 });
    await expect(page.locator('[data-testid="search-v3-result-count"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="search-v3-results-list"]')).toBeVisible({ timeout: 5000 });
  });

  test('clicking Explain opens explain drawer', async ({ page }) => {
    await page.goto(UI);
    await page.locator('[data-testid="search-v3-explain-btn"]').click();
    await page.waitForSelector('[data-testid="search-v3-explain-drawer"]', { timeout: 10000 });
    await expect(page.locator('[data-testid="search-v3-explain-drawer"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="search-v3-explain-content"]')).toBeVisible({ timeout: 5000 });
  });

  test('explain drawer can be closed', async ({ page }) => {
    await page.goto(UI);
    await page.locator('[data-testid="search-v3-explain-btn"]').click();
    await page.waitForSelector('[data-testid="search-v3-explain-drawer"]', { timeout: 10000 });
    await page.locator('[data-testid="search-v3-explain-close"]').click();
    await expect(page.locator('[data-testid="search-v3-explain-drawer"]')).not.toBeVisible({ timeout: 5000 });
  });

  test('save search adds entry to saved list', async ({ page }) => {
    await page.goto(UI);
    await page.locator('[data-testid="search-v3-save-name-input"]').fill('W96 E2E Saved');
    await page.locator('[data-testid="search-v3-save-btn"]').click();
    await page.waitForSelector('[data-testid^="saved-search-row-"]', { timeout: 15000 });
    await expect(page.locator('[data-testid^="saved-search-row-"]').first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('W96 Search UX v3 — API', () => {
  test('GET /facets returns facet dimensions', async ({ request }) => {
    const r = await request.get(`${API}/api/v3/search-ux/facets`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    const names = data.facets.map((f: { name: string }) => f.name);
    expect(names).toContain('entity_type');
    expect(names).toContain('severity');
  });

  test('POST /search returns results with facets', async ({ request }) => {
    const r = await request.post(`${API}/api/v3/search-ux/search`, {
      data: { query: 'test', sort_field: '_score', sort_dir: 'desc' },
    });
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(typeof data.total).toBe('number');
    expect(Array.isArray(data.hits)).toBe(true);
    expect(data.facets).toBeTruthy();
  });

  test('stable sort — same query returns same total twice', async ({ request }) => {
    const body = { query: 'test', sort_field: '_score', sort_dir: 'desc', size: 10 };
    const r1 = await request.post(`${API}/api/v3/search-ux/search`, { data: body });
    const r2 = await request.post(`${API}/api/v3/search-ux/search`, { data: body });
    expect((await r1.json()).total).toBe((await r2.json()).total);
  });

  test('POST /explain returns plan with secrets_redacted:true', async ({ request }) => {
    const r = await request.post(`${API}/api/v3/search-ux/explain`, {
      data: { query: 'test' },
    });
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.redaction_applied).toBe(true);
    expect(data.query_type).toBeTruthy();
  });

  test('POST /saved + GET /saved roundtrip', async ({ request }) => {
    const create = await request.post(`${API}/api/v3/search-ux/saved`, {
      data: { name: 'Playwright W96 Save', query: 'playwright test' },
    });
    expect(create.status()).toBe(201);
    const list = await request.get(`${API}/api/v3/search-ux/saved`);
    expect(list.status()).toBe(200);
    const data = await list.json();
    expect(data.count).toBeGreaterThan(0);
  });
});
