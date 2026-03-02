import { test, expect } from '@playwright/test';

const LOAD_OPTS = { timeout: 30_000 };

test.describe('Autopilot Flow', () => {
  test('autopilot page loads', async ({ page }) => {
    await page.goto('/ui2/autopilot');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('autopilot-v2 loads', async ({ page }) => {
    await page.goto('/ui2/autopilot-v2');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  });

  test('autopilot has controls', async ({ page }) => {
    await page.goto('/ui2/autopilot');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    const content = await page.textContent('body');
    const hasControls = /run|cycle|arm|paper|live|autopilot/i.test(content || '');
    expect(hasControls).toBe(true);
  });
});
