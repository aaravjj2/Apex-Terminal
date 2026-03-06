/**
 * W92 — Bulk Ingest + DLQ + Lag Metrics: Playwright E2E Tests
 * Tests: Ingest & DLQ tab, DLQ stats, lag metrics, drain action, API contracts.
 */
import { test, expect } from "@playwright/test";

const UI = "http://localhost:5100";
const API = "http://localhost:8000";

const ENTITY_TYPES = ["events", "strategies", "backtests", "workflows", "jobs", "tickets", "edges"];

// Ensure DLQ is clean before tests start
test.beforeAll(async ({ request }) => {
  // Drain any leftover DLQ items
  const r = await request.post(`${API}/api/v3/ops/ingest/dlq/drain`, { timeout: 30000 });
  expect(r.status()).toBe(200);
});

test.describe("W92 Ingest & DLQ Tab", () => {
  test("Ingest & DLQ tab is clickable on OpsUI2", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-ui2-page"]', { timeout: 10000 });
    const tab = page.locator('[data-testid="ops-tabs-tab-ingest-dlq"]');
    await expect(tab).toBeVisible();
  });

  test("Ingest & DLQ panel is visible after clicking tab", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-ui2-page"]', { timeout: 10000 });
    await page.locator('[data-testid="ops-tabs-tab-ingest-dlq"]').click();
    await page.waitForSelector('[data-testid="ops-ingest-dlq-panel"]', { timeout: 8000 });
    await expect(page.locator('[data-testid="ops-ingest-dlq-panel"]')).toBeVisible();
  });

  test("DLQ pending badge shows data-ready=true when queue is empty", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-ui2-page"]', { timeout: 10000 });
    await page.locator('[data-testid="ops-tabs-tab-ingest-dlq"]').click();
    // Wait for data to arrive before checking badge attribute
    await page.waitForSelector('[data-testid="ops-dlq-row-events"]', { timeout: 30000 });
    const badge = page.locator('[data-testid="ops-dlq-pending-badge"]');
    await expect(badge).toBeVisible({ timeout: 5000 });
    expect(await badge.getAttribute("data-ready")).toBe("true");
  });

  test("DLQ stats table shows 7 entity rows", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-ui2-page"]', { timeout: 10000 });
    await page.locator('[data-testid="ops-tabs-tab-ingest-dlq"]').click();
    // Wait for data to arrive: first row proves API responded
    await page.waitForSelector('[data-testid="ops-dlq-row-events"]', { timeout: 30000 });
    for (const entity of ENTITY_TYPES) {
      await expect(page.locator(`[data-testid="ops-dlq-row-${entity}"]`)).toBeVisible({ timeout: 5000 });
    }
  });

  test("Lag metrics table shows 7 entity rows", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-ui2-page"]', { timeout: 10000 });
    await page.locator('[data-testid="ops-tabs-tab-ingest-dlq"]').click();
    // Wait for data to arrive: first row proves lag API responded
    await page.waitForSelector('[data-testid="ops-lag-row-events"]', { timeout: 30000 });
    for (const entity of ENTITY_TYPES) {
      await expect(page.locator(`[data-testid="ops-lag-row-${entity}"]`)).toBeVisible({ timeout: 5000 });
    }
  });

  test("Drain button is visible", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-ui2-page"]', { timeout: 10000 });
    await page.locator('[data-testid="ops-tabs-tab-ingest-dlq"]').click();
    await page.waitForSelector('[data-testid="ops-dlq-drain-btn"]', { timeout: 8000 });
    await expect(page.locator('[data-testid="ops-dlq-drain-btn"]')).toBeVisible();
  });

  test("Drain action: add DLQ item via API then drain from UI", async ({ page, request }) => {
    // Force a DLQ item via API
    await request.post(`${API}/api/v3/ops/ingest/test?entity=events&count=1&fail=true`, { timeout: 30000 });

    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-ui2-page"]', { timeout: 10000 });
    await page.locator('[data-testid="ops-tabs-tab-ingest-dlq"]').click();
    // Wait for data to load (row proves API responded with DLQ state)
    await page.waitForSelector('[data-testid="ops-dlq-row-events"]', { timeout: 30000 });

    // Click drain button
    await page.locator('[data-testid="ops-dlq-drain-btn"]').click();
    // After drain + refresh, pending badge should show data-ready=true (0 pending)
    await page.waitForSelector('[data-testid="ops-dlq-pending-badge"][data-ready="true"]', { timeout: 20000 });
    expect(await page.locator('[data-testid="ops-dlq-pending-badge"]').getAttribute("data-ready")).toBe("true");
  });

  test("Refresh button is visible", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-ui2-page"]', { timeout: 10000 });
    await page.locator('[data-testid="ops-tabs-tab-ingest-dlq"]').click();
    await page.waitForSelector('[data-testid="ops-ingest-dlq-refresh"]', { timeout: 8000 });
    await expect(page.locator('[data-testid="ops-ingest-dlq-refresh"]')).toBeVisible();
  });
});

test.describe("W92 Ingest API Contract", () => {
  test("GET /api/v3/ops/ingest/lag returns 200 with metrics array", async ({ request }) => {
    const resp = await request.get(`${API}/api/v3/ops/ingest/lag`, { timeout: 30000 });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(Array.isArray(data.metrics)).toBe(true);
    expect(data.metrics).toHaveLength(7);
  });

  test("Lag metrics have required fields", async ({ request }) => {
    const resp = await request.get(`${API}/api/v3/ops/ingest/lag`, { timeout: 30000 });
    const data = await resp.json();
    for (const m of data.metrics) {
      expect(typeof m.entity).toBe("string");
      expect(typeof m.dlq_pending).toBe("number");
      expect(typeof m.es_count).toBe("number");
      expect(typeof m.lag).toBe("number");
    }
  });

  test("GET /api/v3/ops/ingest/dlq returns 200 with stats", async ({ request }) => {
    const resp = await request.get(`${API}/api/v3/ops/ingest/dlq`, { timeout: 30000 });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(Array.isArray(data.stats)).toBe(true);
    expect(typeof data.total_pending).toBe("number");
  });

  test("POST /ingest/test without fail=true returns ok=true", async ({ request }) => {
    const resp = await request.post(`${API}/api/v3/ops/ingest/test?entity=events&count=1`, { timeout: 30000 });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data.ok).toBe(true);
    expect(data.dlq_added).toBe(0);
  });

  test("POST /ingest/test with fail=true adds to DLQ", async ({ request }) => {
    const before = (await (await request.get(`${API}/api/v3/ops/ingest/dlq`, { timeout: 30000 })).json()).total_pending;
    await request.post(`${API}/api/v3/ops/ingest/test?entity=events&count=1&fail=true`, { timeout: 30000 });
    const after = (await (await request.get(`${API}/api/v3/ops/ingest/dlq`, { timeout: 30000 })).json()).total_pending;
    expect(after).toBeGreaterThan(before);
    // Clean up
    await request.post(`${API}/api/v3/ops/ingest/dlq/drain`, { timeout: 30000 });
  });

  test("POST /api/v3/ops/ingest/dlq/drain returns 200", async ({ request }) => {
    const resp = await request.post(`${API}/api/v3/ops/ingest/dlq/drain`, { timeout: 30000 });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(typeof data.drained).toBe("number");
  });
});
