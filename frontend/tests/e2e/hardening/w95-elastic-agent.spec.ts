/**
 * W95 Elastic Agent Builder — Playwright E2E Hardening Tests
 * 14 tests — UI + API
 * No waitForTimeout, data-testid only
 */
import { test, expect, request as playwrightRequest } from '@playwright/test';

const API = 'http://localhost:8090';
const UI = 'http://localhost:5100/ui2/agent-builder';

test.describe('W95 Elastic Agent Builder — UI', () => {
  test.beforeAll(async () => {
    const ctx = await playwrightRequest.newContext();
    await ctx.delete(`${API}/api/v3/elastic-agent/data`, { timeout: 15000 });
    await ctx.dispose();
  });

  test('page loads and main wrapper visible', async ({ page }) => {
    await page.goto(UI);
    await expect(page.locator('[data-testid="agent-builder-page"]')).toBeVisible({ timeout: 10000 });
  });

  test('status bar is visible', async ({ page }) => {
    await page.goto(UI);
    await expect(page.locator('[data-testid="builder-status-bar"]')).toBeVisible({ timeout: 10000 });
  });

  test('mode badge shows local (no keys configured)', async ({ page }) => {
    await page.goto(UI);
    await expect(page.locator('[data-testid="builder-mode-badge"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="builder-mode-badge"]')).toContainText('local');
  });

  test('agent name input is visible', async ({ page }) => {
    await page.goto(UI);
    await expect(page.locator('[data-testid="builder-agent-name-input"]')).toBeVisible({ timeout: 10000 });
  });

  test('create agent button is visible', async ({ page }) => {
    await page.goto(UI);
    await expect(page.locator('[data-testid="builder-create-agent-btn"]')).toBeVisible({ timeout: 10000 });
  });

  test('create agent and see it in agents list', async ({ page }) => {
    await page.goto(UI);
    await page.locator('[data-testid="builder-agent-name-input"]').fill('W95 E2E Agent');
    await page.locator('[data-testid="builder-create-agent-btn"]').click();
    // Wait for the agent to appear in the list
    await page.waitForSelector('[data-testid="builder-agents-list"] [data-testid^="builder-agent-row-"]', { timeout: 15000 });
    const rows = page.locator('[data-testid^="builder-agent-row-"]');
    await expect(rows.first()).toBeVisible({ timeout: 5000 });
  });

  test('no-agent-selected state visible before selecting', async ({ page }) => {
    await page.goto(UI);
    await expect(page.locator('[data-testid="builder-no-agent-selected"]')).toBeVisible({ timeout: 10000 });
  });

  test('select agent and run query shows tool calls panel', async ({ page }) => {
    await page.goto(UI);
    // Create an agent first
    await page.locator('[data-testid="builder-agent-name-input"]').fill('W95 Run E2E Agent');
    await page.locator('[data-testid="builder-create-agent-btn"]').click();
    // Wait for agent to appear and click it
    await page.waitForSelector('[data-testid^="builder-agent-row-"]', { timeout: 15000 });
    await page.locator('[data-testid^="builder-agent-row-"]').first().click();
    // Now fill query and run
    await page.waitForSelector('[data-testid="builder-run-query-input"]', { timeout: 10000 });
    await page.locator('[data-testid="builder-run-query-input"]').fill('w95 e2e backtest strategies');
    await page.locator('[data-testid="builder-run-btn"]').click();
    // Wait for tool calls panel
    await page.waitForSelector('[data-testid="builder-tool-calls-panel"]', { timeout: 30000 });
    await expect(page.locator('[data-testid="builder-tool-calls-panel"]')).toBeVisible({ timeout: 5000 });
  });

  test('run result status badge shows completed', async ({ page }) => {
    await page.goto(UI);
    // Create and select agent
    await page.locator('[data-testid="builder-agent-name-input"]').fill('W95 Status E2E');
    await page.locator('[data-testid="builder-create-agent-btn"]').click();
    await page.waitForSelector('[data-testid^="builder-agent-row-"]', { timeout: 15000 });
    await page.locator('[data-testid^="builder-agent-row-"]').first().click();
    await page.waitForSelector('[data-testid="builder-run-query-input"]', { timeout: 10000 });
    await page.locator('[data-testid="builder-run-query-input"]').fill('w95 status test');
    await page.locator('[data-testid="builder-run-btn"]').click();
    await page.waitForSelector('[data-testid="builder-run-status-badge"]', { timeout: 30000 });
    await expect(page.locator('[data-testid="builder-run-status-badge"]')).toContainText('completed');
  });
});

test.describe('W95 Elastic Agent Builder — API', () => {
  test('GET /status returns 200 with mode field', async ({ request }) => {
    const r = await request.get(`${API}/api/v3/elastic-agent/status`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.mode).toBe('local');
    expect(data.remote_enabled).toBe(false);
  });

  test('POST /connect-test returns 503 without keys', async ({ request }) => {
    const r = await request.post(`${API}/api/v3/elastic-agent/connect-test`);
    expect(r.status()).toBe(503);
    const data = await r.json();
    expect(data.detail.required_env).toContain('ELASTIC_AGENT_URL');
  });

  test('POST /agents creates agent with 201', async ({ request }) => {
    const r = await request.post(`${API}/api/v3/elastic-agent/agents`, {
      data: { name: 'Playwright W95 Agent', description: 'e2e test' },
    });
    expect(r.status()).toBe(201);
    const data = await r.json();
    expect(data.agent_id).toBeTruthy();
    expect(data.name).toBe('Playwright W95 Agent');
  });

  test('POST /agents/{id}/run executes query and returns results', async ({ request }) => {
    const create = await request.post(`${API}/api/v3/elastic-agent/agents`, {
      data: { name: 'Playwright Run Agent' },
    });
    const { agent_id } = await create.json();
    const r = await request.post(`${API}/api/v3/elastic-agent/agents/${agent_id}/run`, {
      data: { query: 'playwright w95 run test' },
      timeout: 30000,
    });
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.status).toBe('completed');
    expect(data.remote_used).toBe(false);
    expect(Array.isArray(data.tool_calls)).toBe(true);
  });

  test('DELETE /data returns ok:true', async ({ request }) => {
    const r = await request.delete(`${API}/api/v3/elastic-agent/data`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.ok).toBe(true);
  });
});
