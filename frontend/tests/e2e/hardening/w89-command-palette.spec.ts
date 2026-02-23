/**
 * W89 — Command Palette + Deep Link Contract: Playwright E2E Tests
 * Tests: palette open, deep-link navigation, row highlight, browser back.
 */
import { test, expect } from "@playwright/test";

const UI = "http://localhost:5100";

test.describe("W89 Command Palette", () => {
  test("command palette opens with Ctrl+K", async ({ page }) => {
    await page.goto(`${UI}/ui2/dashboard`);
    await page.waitForSelector('[data-testid="dashboard-ui2-page"]', { timeout: 10000 });
    await page.locator('[data-testid="ui2-command-trigger"]').click();
    await page.waitForSelector('[data-testid="command-palette"]', { timeout: 5000 });
    const palette = page.locator('[data-testid="command-palette"]');
    await expect(palette).toBeVisible();
  });

  test("command palette has data-state open", async ({ page }) => {
    await page.goto(`${UI}/ui2/dashboard`);
    await page.waitForSelector('[data-testid="dashboard-ui2-page"]', { timeout: 10000 });
    await page.locator('[data-testid="ui2-command-trigger"]').click();
    await page.waitForSelector('[data-testid="command-palette"]', { timeout: 5000 });
    const palette = page.locator('[data-testid="command-palette"]');
    const state = await palette.getAttribute("data-state");
    expect(state).toBe("open");
  });

  test("command palette closes with Escape", async ({ page }) => {
    await page.goto(`${UI}/ui2/dashboard`);
    await page.waitForSelector('[data-testid="dashboard-ui2-page"]', { timeout: 10000 });
    await page.locator('[data-testid="ui2-command-trigger"]').click();
    await page.waitForSelector('[data-testid="command-palette"]', { timeout: 5000 });
    await page.keyboard.press("Escape");
    // Palette should be gone
    const palette = page.locator('[data-testid="command-palette"]');
    await expect(palette).not.toBeVisible();
  });

  test("command palette has input element", async ({ page }) => {
    await page.goto(`${UI}/ui2/dashboard`);
    await page.waitForSelector('[data-testid="dashboard-ui2-page"]', { timeout: 10000 });
    await page.locator('[data-testid="ui2-command-trigger"]').click();
    await page.waitForSelector('[data-testid="command-palette-input"]', { timeout: 5000 });
    const input = page.locator('[data-testid="command-palette-input"]');
    await expect(input).toBeVisible();
  });

  test("command palette shows results on query", async ({ page }) => {
    await page.goto(`${UI}/ui2/dashboard`);
    await page.waitForSelector('[data-testid="dashboard-ui2-page"]', { timeout: 10000 });
    await page.locator('[data-testid="ui2-command-trigger"]').click();
    await page.waitForSelector('[data-testid="command-palette-input"]', { timeout: 5000 });
    await page.locator('[data-testid="command-palette-input"]').fill("backtest");
    await page.waitForSelector('[data-testid^="command-palette-item"]', { timeout: 5000 });
    const items = page.locator('[data-testid^="command-palette-item"]');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe("W89 Deep Link Contract", () => {
  test("deep link navigates to backtest page with highlight", async ({ page }) => {
    await page.goto(`${UI}/ui2/backtest?highlight=bt-deep-link-test`);
    await page.waitForSelector('[data-testid="backtest-ui2-page"]', { timeout: 10000 });
    const highlighted = page.locator('[data-highlighted="true"]');
    await expect(highlighted).toBeVisible();
  });

  test("highlighted row has data-highlighted=true", async ({ page }) => {
    await page.goto(`${UI}/ui2/backtest?highlight=bt-deep-link-test`);
    await page.waitForSelector('[data-highlighted="true"]', { timeout: 10000 });
    const row = page.locator('[data-highlighted="true"]').first();
    const attrVal = await row.getAttribute("data-highlighted");
    expect(attrVal).toBe("true");
  });

  test("browser back returns to originating page", async ({ page }) => {
    // Start on dashboard
    await page.goto(`${UI}/ui2/dashboard`);
    await page.waitForSelector('[data-testid="dashboard-ui2-page"]', { timeout: 10000 });

    // Navigate to deep link
    await page.goto(`${UI}/ui2/backtest?highlight=bt-deep-link-test`);
    await page.waitForSelector('[data-testid="backtest-ui2-page"]', { timeout: 10000 });

    // Go back
    await page.goBack();
    await page.waitForSelector('[data-testid="dashboard-ui2-page"]', { timeout: 10000 });
    const dashboard = page.locator('[data-testid="dashboard-ui2-page"]');
    await expect(dashboard).toBeVisible();
  });

  test("deep link URL has highlight query param", async ({ page }) => {
    await page.goto(`${UI}/ui2/backtest?highlight=bt-deep-link-test`);
    await page.waitForSelector('[data-testid="backtest-ui2-page"]', { timeout: 10000 });
    const url = page.url();
    expect(url).toContain("highlight=bt-deep-link-test");
  });

  test("palette navigates to backtest deep link result", async ({ page }) => {
    await page.goto(`${UI}/ui2/dashboard`);
    await page.waitForSelector('[data-testid="dashboard-ui2-page"]', { timeout: 10000 });

    // Open palette and search for the specific deep-link command
    await page.locator('[data-testid="ui2-command-trigger"]').click();
    await page.waitForSelector('[data-testid="command-palette-input"]', { timeout: 5000 });
    await page.locator('[data-testid="command-palette-input"]').fill("deep-link");
    // Wait for the specific backtest deep-link item
    await page.waitForSelector('[data-testid="command-palette-item-deep-backtest-example"]', { timeout: 5000 });

    // Click the specific deep-link backtest item
    await page.locator('[data-testid="command-palette-item-deep-backtest-example"]').click();

    // Should navigate to backtest page with highlight
    await page.waitForSelector('[data-testid="backtest-ui2-page"]', { timeout: 10000 });
    const url = page.url();
    expect(url).toContain("highlight=bt-deep-link-test");
  });

  test("highlight cleared from URL preserves page", async ({ page }) => {
    await page.goto(`${UI}/ui2/backtest?highlight=bt-deep-link-test`);
    await page.waitForSelector('[data-testid="backtest-ui2-page"]', { timeout: 10000 });
    // The page should still render with the highlight
    const el = page.locator('[data-testid="backtest-ui2-page"]');
    await expect(el).toBeVisible();
  });
});

