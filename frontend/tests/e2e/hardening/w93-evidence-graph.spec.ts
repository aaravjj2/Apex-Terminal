/**
 * W93 — Evidence Graph v1 (nodes + edges): Playwright E2E Tests
 * Tests: page loads, graph controls, seed demo graph, API contracts.
 */
import { test, expect } from "@playwright/test";

const UI = "http://localhost:5100";
const API = "http://localhost:8090";

// Ensure clean graph state before all evidence tests
test.beforeAll(async ({ request }) => {
  const r = await request.delete(`${API}/api/v3/evidence/graph`, { timeout: 15000 });
  expect(r.status()).toBe(200);
});

test.describe("W93 Evidence Graph Page", () => {
  test("Evidence graph page loads at /ui2/evidence", async ({ page }) => {
    await page.goto(`${UI}/ui2/evidence`);
    await page.waitForSelector('[data-testid="evidence-graph-page"]', { timeout: 15000 });
    await expect(page.locator('[data-testid="evidence-graph-page"]')).toBeVisible();
  });

  test("Graph controls are visible", async ({ page }) => {
    await page.goto(`${UI}/ui2/evidence`);
    await page.waitForSelector('[data-testid="evidence-graph-page"]', { timeout: 15000 });
    await expect(page.locator('[data-testid="evidence-root-type-select"]')).toBeVisible();
    await expect(page.locator('[data-testid="evidence-root-id-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="evidence-search-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="evidence-seed-btn"]')).toBeVisible();
  });

  test("Refresh button is visible", async ({ page }) => {
    await page.goto(`${UI}/ui2/evidence`);
    await page.waitForSelector('[data-testid="evidence-graph-page"]', { timeout: 15000 });
    await expect(page.locator('[data-testid="evidence-refresh-btn"]')).toBeVisible();
  });

  test("Seed demo graph creates nodes and edges", async ({ page }) => {
    await page.goto(`${UI}/ui2/evidence`);
    await page.waitForSelector('[data-testid="evidence-graph-page"]', { timeout: 15000 });

    // Click seed button
    await page.locator('[data-testid="evidence-seed-btn"]').click();

    // Wait for graph body to appear (data loaded)
    await page.waitForSelector('[data-testid="evidence-graph-body"]', { timeout: 20000 });
    await expect(page.locator('[data-testid="evidence-graph-body"]')).toBeVisible();
  });

  test("After seed: node count badge shows nodes > 0", async ({ page }) => {
    await page.goto(`${UI}/ui2/evidence`);
    await page.waitForSelector('[data-testid="evidence-graph-page"]', { timeout: 15000 });
    await page.locator('[data-testid="evidence-seed-btn"]').click();
    await page.waitForSelector('[data-testid="evidence-node-count-badge"]', { timeout: 20000 });

    const badge = page.locator('[data-testid="evidence-node-count-badge"]');
    const text = await badge.textContent();
    const count = parseInt((text || "0").match(/\d+/)?.[0] || "0", 10);
    expect(count).toBeGreaterThan(0);
  });

  test("After seed: edge count badge shows edges > 0", async ({ page }) => {
    await page.goto(`${UI}/ui2/evidence`);
    await page.waitForSelector('[data-testid="evidence-graph-page"]', { timeout: 15000 });
    await page.locator('[data-testid="evidence-seed-btn"]').click();
    await page.waitForSelector('[data-testid="evidence-edge-count-badge"]', { timeout: 20000 });

    const badge = page.locator('[data-testid="evidence-edge-count-badge"]');
    const countAttr = await badge.getAttribute("data-count");
    expect(parseInt(countAttr || "0", 10)).toBeGreaterThan(0);
  });

  test("After seed: nodes list renders at least one node", async ({ page }) => {
    await page.goto(`${UI}/ui2/evidence`);
    await page.waitForSelector('[data-testid="evidence-graph-page"]', { timeout: 15000 });
    await page.locator('[data-testid="evidence-seed-btn"]').click();
    await page.waitForSelector('[data-testid="evidence-nodes-list"]', { timeout: 20000 });
    // At least one node of type 'strategies' should appear
    const strategyNode = page.locator('[data-testid="evidence-node-strategies"]').first();
    await expect(strategyNode).toBeVisible({ timeout: 10000 });
  });

  test("After seed: edges list renders at least one edge", async ({ page }) => {
    await page.goto(`${UI}/ui2/evidence`);
    await page.waitForSelector('[data-testid="evidence-graph-page"]', { timeout: 15000 });
    await page.locator('[data-testid="evidence-seed-btn"]').click();
    await page.waitForSelector('[data-testid="evidence-edges-list"]', { timeout: 20000 });
    const edge = page.locator('[data-testid="evidence-edge-ran_backtest"]').first();
    await expect(edge).toBeVisible({ timeout: 10000 });
  });

  test("Load graph via search input shows nodes", async ({ page, request }) => {
    // Seed data via API
    const sid = `pw-strat-${Date.now()}`;
    await request.post(`${API}/api/v3/evidence/graph/backtest`, {
      data: { run_id: `pw-run-${Date.now()}`, strategy_id: sid },
      timeout: 15000,
    });

    await page.goto(`${UI}/ui2/evidence`);
    await page.waitForSelector('[data-testid="evidence-graph-page"]', { timeout: 15000 });

    // Set input and search
    await page.locator('[data-testid="evidence-root-id-input"]').fill(sid);
    await page.locator('[data-testid="evidence-search-btn"]').click();

    // Wait for graph body
    await page.waitForSelector('[data-testid="evidence-graph-body"]', { timeout: 20000 });
    const badge = page.locator('[data-testid="evidence-node-count-badge"]');
    const text = await badge.textContent();
    const count = parseInt((text || "0").match(/\d+/)?.[0] || "0", 10);
    expect(count).toBeGreaterThan(0);
  });
});

test.describe("W93 Evidence Graph API Contract", () => {
  test("GET /api/v3/evidence/graph returns 200", async ({ request }) => {
    const r = await request.get(`${API}/api/v3/evidence/graph`, {
      params: { root_type: "strategies", root_id: "test-123" },
      timeout: 15000,
    });
    expect(r.status()).toBe(200);
  });

  test("GET /api/v3/evidence/graph schema is correct", async ({ request }) => {
    const data = await (
      await request.get(`${API}/api/v3/evidence/graph`, {
        params: { root_type: "strategies", root_id: "schema-test" },
        timeout: 15000,
      })
    ).json();
    for (const f of ["root_type", "root_id", "nodes", "edges", "node_count", "edge_count"]) {
      expect(data).toHaveProperty(f);
    }
  });

  test("POST /api/v3/evidence/graph/edge returns ok=true", async ({ request }) => {
    const data = await (
      await request.post(`${API}/api/v3/evidence/graph/edge`, {
        data: {
          from_type: "strategies", from_id: `pw-s-${Date.now()}`,
          to_type: "backtests", to_id: `pw-b-${Date.now()}`,
          edge_type: "ran_backtest",
        },
        timeout: 15000,
      })
    ).json();
    expect(data.ok).toBe(true);
  });

  test("POST /api/v3/evidence/graph/backtest creates 2 edges", async ({ request }) => {
    const data = await (
      await request.post(`${API}/api/v3/evidence/graph/backtest`, {
        data: { run_id: `run-${Date.now()}`, strategy_id: `strat-${Date.now()}` },
        timeout: 15000,
      })
    ).json();
    expect(data.ok).toBe(true);
    expect(data.count).toBe(2);
  });

  test("GET /api/v3/evidence/graph/edges returns edges list", async ({ request }) => {
    const data = await (
      await request.get(`${API}/api/v3/evidence/graph/edges`, { timeout: 15000 })
    ).json();
    expect(Array.isArray(data.edges)).toBe(true);
    expect(typeof data.count).toBe("number");
  });
});
