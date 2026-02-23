/**
 * W91 — ES Templates + Aliases v4: Playwright E2E Tests
 * Tests: ES Templates tab visible, health badges ready, 7 entity rows,
 *        install idempotency, refresh, API contracts.
 */
import { test, expect } from "@playwright/test";

const UI = "http://localhost:5100";
const API = "http://localhost:8090";

const ENTITY_TYPES = ["events", "strategies", "backtests", "workflows", "jobs", "tickets", "edges"];

// Ensure templates are installed + healthy before all tests
test.beforeAll(async ({ request }) => {
  const install = await request.post(`${API}/api/v3/ops/es/templates/install`, { timeout: 45000 });
  expect(install.status()).toBe(200);
  const data = await install.json();
  expect(data.ok).toBe(true);
  // Verify health
  const health = await request.get(`${API}/api/v3/ops/es/templates`, { timeout: 45000 });
  expect(health.status()).toBe(200);
  const hdata = await health.json();
  expect(hdata.templates_healthy).toBe(true);
  expect(hdata.aliases_healthy).toBe(true);
});

test.describe("W91 ES Templates Tab", () => {
  test("OpsUI2 ES Templates tab is clickable", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-ui2-page"]', { timeout: 10000 });
    const tab = page.locator('[data-testid="ops-tabs-tab-es-templates"]');
    await expect(tab).toBeVisible();
  });

  test("ES Templates panel is visible after clicking tab", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-ui2-page"]', { timeout: 10000 });
    await page.locator('[data-testid="ops-tabs-tab-es-templates"]').click();
    await page.waitForSelector('[data-testid="ops-es-templates-panel"]', { timeout: 8000 });
    await expect(page.locator('[data-testid="ops-es-templates-panel"]')).toBeVisible();
  });

  test("templates table loads with 7 entity rows", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-ui2-page"]', { timeout: 10000 });
    await page.locator('[data-testid="ops-tabs-tab-es-templates"]').click();
    await page.waitForSelector('[data-testid="ops-template-row-events"]', { timeout: 30000 });
    for (const entity of ENTITY_TYPES) {
      await expect(page.locator(`[data-testid="ops-template-row-${entity}"]`)).toBeVisible();
    }
  });

  test("templates-healthy badge shows data-ready=true after data loads", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-ui2-page"]', { timeout: 10000 });
    await page.locator('[data-testid="ops-tabs-tab-es-templates"]').click();
    // Wait for rows to confirm data is fully loaded
    await page.waitForSelector('[data-testid="ops-template-row-events"]', { timeout: 30000 });
    const badge = page.locator('[data-testid="ops-templates-healthy"]');
    await expect(badge).toBeVisible();
    expect(await badge.getAttribute("data-ready")).toBe("true");
  });

  test("aliases-healthy badge shows data-ready=true after data loads", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-ui2-page"]', { timeout: 10000 });
    await page.locator('[data-testid="ops-tabs-tab-es-templates"]').click();
    // Wait for rows to confirm data is fully loaded
    await page.waitForSelector('[data-testid="ops-template-row-events"]', { timeout: 30000 });
    const badge = page.locator('[data-testid="ops-aliases-healthy"]');
    await expect(badge).toBeVisible();
    expect(await badge.getAttribute("data-ready")).toBe("true");
  });

  test("install button is visible and panel stays visible after click", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-ui2-page"]', { timeout: 10000 });
    await page.locator('[data-testid="ops-tabs-tab-es-templates"]').click();
    await page.waitForSelector('[data-testid="ops-es-install-btn"]', { timeout: 8000 });
    const btn = page.locator('[data-testid="ops-es-install-btn"]');
    await expect(btn).toBeVisible();
    await btn.click();
    await page.waitForSelector('[data-testid="ops-es-templates-panel"]', { timeout: 8000 });
    await expect(page.locator('[data-testid="ops-es-templates-panel"]')).toBeVisible();
  });

  test("refresh button is visible", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-ui2-page"]', { timeout: 10000 });
    await page.locator('[data-testid="ops-tabs-tab-es-templates"]').click();
    await page.waitForSelector('[data-testid="ops-es-templates-refresh"]', { timeout: 8000 });
    await expect(page.locator('[data-testid="ops-es-templates-refresh"]')).toBeVisible();
  });
});

test.describe("W91 ES Templates API Contract", () => {
  test("GET /api/v3/ops/es/templates returns 200 with templates_healthy=true", async ({ request }) => {
    const resp = await request.get(`${API}/api/v3/ops/es/templates`, { timeout: 45000 });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data.templates_healthy).toBe(true);
  });

  test("GET /api/v3/ops/es/templates returns aliases_healthy=true", async ({ request }) => {
    const resp = await request.get(`${API}/api/v3/ops/es/templates`, { timeout: 45000 });
    const data = await resp.json();
    expect(data.aliases_healthy).toBe(true);
  });

  test("templates array has 7 entries with correct naming", async ({ request }) => {
    const resp = await request.get(`${API}/api/v3/ops/es/templates`, { timeout: 45000 });
    const data = await resp.json();
    expect(data.templates).toHaveLength(7);
    for (const t of data.templates) {
      expect(t.template_name).toMatch(/^apex-[a-z]+-template$/);
      expect(t.version).toBe("4");
    }
  });

  test("aliases array has 7 entries with correct naming", async ({ request }) => {
    const resp = await request.get(`${API}/api/v3/ops/es/templates`, { timeout: 45000 });
    const data = await resp.json();
    expect(data.aliases).toHaveLength(7);
    for (const a of data.aliases) {
      expect(a.write_alias).toMatch(/^apex-[a-z]+-write$/);
      expect(a.read_alias).toMatch(/^apex-[a-z]+-read$/);
      expect(a.write_alias_exists).toBe(true);
      expect(a.read_alias_exists).toBe(true);
    }
  });

  test("POST /api/v3/ops/es/templates/install is idempotent and returns ok=true", async ({ request }) => {
    const resp = await request.post(`${API}/api/v3/ops/es/templates/install`, { timeout: 45000 });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data.ok).toBe(true);
    expect(data.templates_installed).toHaveLength(7);
  });

  test("POST /api/v3/ops/es/reindex/{entity}?dry_run=true returns plan", async ({ request }) => {
    const resp = await request.post(`${API}/api/v3/ops/es/reindex/events?dry_run=true`, { timeout: 30000 });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data.dry_run).toBe(true);
    expect(data.correlation_id).toBeTruthy();
    expect(Array.isArray(data.audit_events)).toBe(true);
    expect(data.audit_events.length).toBeGreaterThan(0);
  });
});
