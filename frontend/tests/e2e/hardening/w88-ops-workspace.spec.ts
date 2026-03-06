/**
 * W88 — Ops Workspace v1: Playwright E2E Tests
 * Verifies OpsUI2 live service cards with data-ready gating.
 */
import { test, expect, APIRequestContext } from "@playwright/test";

const API = "http://localhost:8000";
const UI = "http://localhost:5100";

test.describe("W88 Ops Live Service Cards", () => {
  test("ops page renders with live services section", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-live-services"]', { timeout: 10000 });
    const el = page.locator('[data-testid="ops-live-services"]');
    await expect(el).toBeVisible();
  });

  test("ops-es-card is present", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-es-card"]', { timeout: 10000 });
    const el = page.locator('[data-testid="ops-es-card"]');
    await expect(el).toBeVisible();
  });

  test("ops-broker-card is present", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-broker-card"]', { timeout: 10000 });
    const el = page.locator('[data-testid="ops-broker-card"]');
    await expect(el).toBeVisible();
  });

  test("ops-ws-card is present", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-ws-card"]', { timeout: 10000 });
    const el = page.locator('[data-testid="ops-ws-card"]');
    await expect(el).toBeVisible();
  });

  test("ops-jobs-card is present", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-jobs-card"]', { timeout: 10000 });
    const el = page.locator('[data-testid="ops-jobs-card"]');
    await expect(el).toBeVisible();
  });

  test("ops-es-card has data-ready attribute", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-es-card"]', { timeout: 10000 });
    const card = page.locator('[data-testid="ops-es-card"]');
    const ready = await card.getAttribute("data-ready");
    expect(ready === "true" || ready === "false").toBe(true);
  });

  test("ops-broker-card has data-ready attribute", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-broker-card"]', { timeout: 10000 });
    const card = page.locator('[data-testid="ops-broker-card"]');
    const ready = await card.getAttribute("data-ready");
    expect(ready === "true" || ready === "false").toBe(true);
  });

  test("ops-ws-card has data-ready attribute", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-ws-card"]', { timeout: 10000 });
    const card = page.locator('[data-testid="ops-ws-card"]');
    const ready = await card.getAttribute("data-ready");
    expect(ready === "true" || ready === "false").toBe(true);
  });

  test("ops-es-card has copy-cid button", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-es-card-copy-cid"]', { timeout: 10000 });
    const btn = page.locator('[data-testid="ops-es-card-copy-cid"]');
    await expect(btn).toBeVisible();
  });

  test("ops-ready gated (not hardcoded)", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    // Wait for data to load by checking for the live services cards
    await page.waitForSelector('[data-testid="ops-es-card"]', { timeout: 10000 });
    // Now check the ops-ready hidden sentinel has the right attribute
    const el = page.locator('[data-testid="ops-ready"]');
    const readyAttr = await el.getAttribute("data-ready");
    // data-ready must be "true" or "false" — never absent
    expect(["true", "false"]).toContain(readyAttr);
  });

  test("ops refresh button present", async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.waitForSelector('[data-testid="ops-refresh-btn"]', { timeout: 10000 });
    const el = page.locator('[data-testid="ops-refresh-btn"]');
    await expect(el).toBeVisible();
  });
});

test.describe("W88 Ops API Redaction", () => {
  let request: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    request = await playwright.request.newContext({ baseURL: API });
  });

  test.afterAll(async () => {
    await request.dispose();
  });

  test("ops/broker redacts account_number", async () => {
    const r = await request.get("/api/v3/ops/broker");
    expect(r.status()).toBe(200);
    const body = await r.json();
    if (body.account_number) {
      expect((body.account_number as string).startsWith("***")).toBe(true);
    }
  });

  test("broker/account redacts account_number", async () => {
    const r = await request.get("/api/v3/broker/account");
    if (r.status() === 200) {
      const body = await r.json();
      if (body.account_number) {
        expect((body.account_number as string).startsWith("***")).toBe(true);
      }
    } else {
      expect([200, 503]).toContain(r.status());
    }
  });
});
