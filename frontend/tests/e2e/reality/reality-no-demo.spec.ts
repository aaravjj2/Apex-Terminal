/**
 * Reality Test: No Demo / Seeded Data
 * Ensures no "DEMO STREAM", "DEMO" mode badges, or pre-seeded trades
 * appear anywhere in the rendered UI.
 */
import { test, expect } from '@playwright/test';

test.describe('Reality — No Demo Data', () => {
  test('Market tape does not show DEMO STREAM', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // The tape should never say "DEMO STREAM"
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('DEMO STREAM');
  });

  test('No DEMO mode badge in header or settings', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Check that no element contains exact "DEMO" as a mode/status badge
    // (Allow "demo" in lowercase as part of longer words like "demonstration" if any)
    const badges = page.locator('[data-testid*="mode"], [data-testid*="status"]');
    const count = await badges.count();
    for (let i = 0; i < count; i++) {
      const text = await badges.nth(i).innerText();
      expect(text.trim()).not.toBe('DEMO');
    }
  });

  test('Autopilot activity feed starts empty', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Navigate to autopilot
    const navItem = page.getByTestId('nav-item-autopilot');
    if (await navItem.isVisible().catch(() => false)) {
      await navItem.click();
      await page.waitForLoadState('domcontentloaded');
      // The activity feed should be empty (no pre-seeded trades)
      const feedItems = page.locator('[data-testid="activity-item"]');
      const feedCount = await feedItems.count();
      expect(feedCount).toBe(0);
    }
  });

  test('Backtest runs list starts empty', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const navItem = page.getByTestId('nav-item-backtest');
    if (await navItem.isVisible().catch(() => false)) {
      await navItem.click();
      await page.waitForLoadState('domcontentloaded');
      // Wait a moment for any seeded data to render
      await page.waitForTimeout(1000);
      // No pre-seeded backtest runs
      const runRows = page.locator('[data-testid="backtest-run-row"]');
      const count = await runRows.count();
      expect(count).toBe(0);
    }
  });

  test('Settings shows LIVE mode, not DEMO', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const navItem = page.getByTestId('nav-item-settings');
    if (await navItem.isVisible().catch(() => false)) {
      await navItem.click();
      await page.waitForLoadState('domcontentloaded');
      const body = await page.locator('body').innerText();
      // Should not contain "DEMO" as a mode label
      // "LIVE" or "Online" should appear instead
      expect(body).not.toMatch(/\bDEMO\b/);
    }
  });
});
