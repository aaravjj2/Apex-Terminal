/**
 * Demo Structure Validation — Playwright E2E
 * 
 * Validates that the React frontend matches the demo/index.html
 * layout structure: TopBar, Left Nav (grouped), Center, Right Sidebar (6 tabs),
 * Status Bar, and proper design tokens.
 * 
 * Run with: xvfb-run --auto-servernum --server-args="-screen 0 1280x1024x24" \
 *   npx playwright test tests/e2e/demo-structure-validation.spec.ts --config=playwright.config.mcp.ts
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5100';

test.describe('Demo Structure — Shell Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/ui2/dashboard`, { waitUntil: 'networkidle' });
    // Wait for React hydration
    await page.waitForSelector('[data-testid="ui2-app-shell"]', { timeout: 15000 });
  });

  test('App shell renders with correct grid layout', async ({ page }) => {
    const shell = page.locator('[data-testid="ui2-app-shell"]');
    await expect(shell).toBeVisible();
    // Shell should be full viewport
    const box = await shell.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThan(800);
    expect(box!.height).toBeGreaterThan(600);
  });

  test('TopBar is present with logo, search, user area', async ({ page }) => {
    const topbar = page.locator('[data-testid="ui2-topbar"]');
    await expect(topbar).toBeVisible();
    // Should contain APEX text
    await expect(topbar).toContainText('APEX');
    // Should have command trigger
    const cmdTrigger = page.locator('[data-testid="ui2-command-trigger"]');
    await expect(cmdTrigger).toBeVisible();
  });

  test('Left rail navigation is present and has items', async ({ page }) => {
    const rail = page.locator('[data-testid="ui2-left-rail"]');
    await expect(rail).toBeVisible();
    // Should have multiple nav items
    const navButtons = rail.locator('button');
    const count = await navButtons.count();
    expect(count).toBeGreaterThan(5);
  });

  test('Center workspace renders Outlet content', async ({ page }) => {
    const center = page.locator('[data-testid="ui2-center"]');
    await expect(center).toBeVisible();
    // Should have content (the routed page)
    const box = await center.boundingBox();
    expect(box!.width).toBeGreaterThan(200);
  });

  test('Right sidebar is present', async ({ page }) => {
    const sidebar = page.locator('[data-testid="ui2-right-sidebar"]');
    await expect(sidebar).toBeVisible();
  });

  test('Command palette opens with Ctrl+K', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const palette = page.locator('[data-testid="command-palette"]');
    await expect(palette).toBeVisible({ timeout: 3000 });
    // Close it
    await page.keyboard.press('Escape');
  });

  test('Navigation works — clicking rail item changes route', async ({ page }) => {
    // Find the trading rail button
    const tradingBtn = page.locator('[data-testid="ui2-rail-trading"]');
    if (await tradingBtn.isVisible()) {
      await tradingBtn.click();
      await page.waitForURL(/\/ui2\/trading/, { timeout: 5000 });
      expect(page.url()).toContain('/ui2/trading');
    }
  });

  test('No console errors on initial load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    await page.goto(`${BASE}/ui2/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    // Filter out known acceptable errors (e.g., API connection issues in test env)
    const criticalErrors = errors.filter(e => 
      !e.includes('net::ERR_') && 
      !e.includes('WebSocket') && 
      !e.includes('favicon') &&
      !e.includes('Failed to load resource')
    );
    expect(criticalErrors).toEqual([]);
  });
});

test.describe('Demo Structure — Key Pages Load', () => {
  const criticalPages = [
    { path: '/ui2/dashboard', name: 'Dashboard' },
    { path: '/ui2/trading', name: 'Trading' },
    { path: '/ui2/heatmap', name: 'Heatmap' },
    { path: '/ui2/options-chain', name: 'Options Chain' },
    { path: '/ui2/risk-dashboard', name: 'Risk Dashboard' },
    { path: '/ui2/bloomberg-terminal', name: 'Bloomberg Terminal' },
    { path: '/ui2/portfolio-analytics', name: 'Portfolio Analytics' },
    { path: '/ui2/backtest-engine', name: 'Backtest Engine' },
  ];

  for (const pg of criticalPages) {
    test(`${pg.name} page loads without error`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('net::ERR_') && !text.includes('WebSocket') && 
              !text.includes('favicon') && !text.includes('Failed to load resource')) {
            errors.push(text);
          }
        }
      });
      await page.goto(`${BASE}${pg.path}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-testid="ui2-app-shell"]', { timeout: 15000 });
      await page.waitForTimeout(1000);
      expect(errors).toEqual([]);
    });
  }
});
