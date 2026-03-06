/**
 * W94 Agent Tools v1 — Playwright E2E Hardening Tests
 * 14 tests — UI + API
 * No waitForTimeout, data-testid only
 */
import { test, expect, request as playwrightRequest } from '@playwright/test';

const API = 'http://localhost:8000';
const UI = 'http://localhost:5100/ui2/agent-tools';

test.describe('W94 Agent Tools — UI', () => {
  test.beforeAll(async () => {
    const ctx = await playwrightRequest.newContext();
    await ctx.delete(`${API}/api/v3/agent/runs`, { timeout: 15000 });
    await ctx.dispose();
  });

  test('page loads and main wrapper visible', async ({ page }) => {
    await page.goto(UI);
    await expect(page.locator('[data-testid="agent-tools-page"]')).toBeVisible({ timeout: 10000 });
  });

  test('query input is visible', async ({ page }) => {
    await page.goto(UI);
    await expect(page.locator('[data-testid="agent-query-input"]')).toBeVisible({ timeout: 10000 });
  });

  test('run button is visible', async ({ page }) => {
    await page.goto(UI);
    await expect(page.locator('[data-testid="agent-run-btn"]')).toBeVisible({ timeout: 10000 });
  });

  test('runs table is visible', async ({ page }) => {
    await page.goto(UI);
    await expect(page.locator('[data-testid="agent-runs-table"]')).toBeVisible({ timeout: 10000 });
  });

  test('empty state shown when no runs', async ({ page }) => {
    await page.goto(UI);
    await expect(page.locator('[data-testid="agent-empty-state"]')).toBeVisible({ timeout: 10000 });
  });

  test('submitting query creates run and shows traces panel', async ({ page }) => {
    await page.goto(UI);
    await page.locator('[data-testid="agent-query-input"]').fill('find strategies for w94 test');
    await page.locator('[data-testid="agent-run-btn"]').click();
    // Wait for the tool traces panel to appear
    await page.waitForSelector('[data-testid="agent-tool-traces-panel"]', { timeout: 30000 });
    await expect(page.locator('[data-testid="agent-tool-traces-panel"]')).toBeVisible({ timeout: 5000 });
  });

  test('run appears in runs table after submit', async ({ page }) => {
    await page.goto(UI);
    await page.locator('[data-testid="agent-query-input"]').fill('w94 e2e listing test');
    await page.locator('[data-testid="agent-run-btn"]').click();
    await page.waitForSelector('[data-testid="agent-tool-traces-panel"]', { timeout: 30000 });
    // Check runs table has at least one row
    const runs = page.locator('[data-testid^="agent-run-row-"]');
    await expect(runs.first()).toBeVisible({ timeout: 10000 });
  });

  test('run status badge shows completed', async ({ page }) => {
    await page.goto(UI);
    await page.locator('[data-testid="agent-query-input"]').fill('w94 status badge test');
    await page.locator('[data-testid="agent-run-btn"]').click();
    await page.waitForSelector('[data-testid="agent-run-status-badge"]', { timeout: 30000 });
    const badge = page.locator('[data-testid="agent-run-status-badge"]');
    await expect(badge).toBeVisible({ timeout: 5000 });
    await expect(badge).toContainText('completed');
  });

  test('citations panel renders after run', async ({ page }) => {
    await page.goto(UI);
    await page.locator('[data-testid="agent-query-input"]').fill('w94 citation panel check');
    await page.locator('[data-testid="agent-run-btn"]').click();
    await page.waitForSelector('[data-testid="agent-citations-list"]', { timeout: 30000 });
    await expect(page.locator('[data-testid="agent-citations-list"]')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('W94 Agent Tools — API', () => {
  test('GET /tools returns 5 tools', async ({ request }) => {
    const r = await request.get(`${API}/api/v3/agent/tools`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.count).toBe(5);
    expect(data.tools.length).toBe(5);
  });

  test('POST /run returns run_id and completed status', async ({ request }) => {
    const r = await request.post(`${API}/api/v3/agent/run`, {
      data: { query: 'playwright w94 api test run' },
      timeout: 30000,
    });
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.run_id).toBeTruthy();
    expect(data.status).toBe('completed');
    expect(Array.isArray(data.tool_calls)).toBe(true);
  });

  test('GET /runs returns list with count', async ({ request }) => {
    const r = await request.get(`${API}/api/v3/agent/runs`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(Array.isArray(data.runs)).toBe(true);
    expect(typeof data.count).toBe('number');
  });

  test('GET /runs/{id} returns run with traces', async ({ request }) => {
    const create = await request.post(`${API}/api/v3/agent/run`, {
      data: { query: 'playwright get by id test' },
      timeout: 30000,
    });
    const { run_id } = await create.json();
    const r = await request.get(`${API}/api/v3/agent/runs/${run_id}`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    // detail endpoint uses "id" field
    expect(data.id ?? data.run_id).toBe(run_id);
    expect(Array.isArray(data.traces)).toBe(true);
    expect(data.traces.length).toBeGreaterThanOrEqual(1);
  });

  test('DELETE /runs returns ok:true', async ({ request }) => {
    const r = await request.delete(`${API}/api/v3/agent/runs`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.ok).toBe(true);
  });
});
