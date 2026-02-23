/**
 * W87 — WS Reliability: Playwright E2E Tests
 * Verifies /api/v3/ops/ws/health schema and ops page renders with WS data.
 */
import { test, expect, APIRequestContext } from "@playwright/test";

const API = "http://localhost:8090";
const UI = "http://localhost:5100";

test.describe("W87 WS Health API", () => {
  let request: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    request = await playwright.request.newContext({ baseURL: API });
  });

  test.afterAll(async () => {
    await request.dispose();
  });

  test("ws/health returns 200", async () => {
    const r = await request.get("/api/v3/ops/ws/health");
    expect(r.status()).toBe(200);
  });

  test("ws/health has running field", async () => {
    const r = await request.get("/api/v3/ops/ws/health");
    const body = await r.json();
    expect(typeof body.running).toBe("boolean");
  });

  test("ws/health running is true", async () => {
    const r = await request.get("/api/v3/ops/ws/health");
    const body = await r.json();
    expect(body.running).toBe(true);
  });

  test("ws/health active_clients is number", async () => {
    const r = await request.get("/api/v3/ops/ws/health");
    const body = await r.json();
    expect(typeof body.active_clients).toBe("number");
  });

  test("ws/health disconnect_count is number", async () => {
    const r = await request.get("/api/v3/ops/ws/health");
    const body = await r.json();
    expect(typeof body.disconnect_count).toBe("number");
  });

  test("ws/health heartbeat_task_alive is boolean", async () => {
    const r = await request.get("/api/v3/ops/ws/health");
    const body = await r.json();
    expect(typeof body.heartbeat_task_alive).toBe("boolean");
  });

  test("ws/health heartbeat_interval_s is number", async () => {
    const r = await request.get("/api/v3/ops/ws/health");
    const body = await r.json();
    expect(typeof body.heartbeat_interval_s).toBe("number");
  });

  test("ws/health heartbeat_task_alive is true", async () => {
    const r = await request.get("/api/v3/ops/ws/health");
    const body = await r.json();
    expect(body.heartbeat_task_alive).toBe(true);
  });

  test("ws/health subscriptions is number", async () => {
    const r = await request.get("/api/v3/ops/ws/health");
    const body = await r.json();
    expect(typeof body.subscriptions).toBe("number");
  });
});

test.describe("W87 Ops Page with WS health", () => {
  test("ops page renders", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-ui2-page"]', { timeout: 10000 });
    const el = page.locator('[data-testid="ops-ui2-page"]');
    await expect(el).toBeVisible();
  });

  test("ops page has ops-health-dashboard", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-health-dashboard"]', { timeout: 10000 });
    const el = page.locator('[data-testid="ops-health-dashboard"]');
    await expect(el).toBeVisible();
  });

  test("ops page has ops-summary-services", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-summary-services"]', { timeout: 10000 });
    const el = page.locator('[data-testid="ops-summary-services"]');
    await expect(el).toBeVisible();
  });
});
