/**
 * Autopilot Live API — E2E Tests
 * Tests the real autopilot backend with live API calls
 */
import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:8000';

test.describe('Autopilot Backend API', () => {
  test('GET /api/v1/autopilot/status returns engine status', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/autopilot/status`, {
      timeout: 10_000,
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('kill_switch_active');
    expect(data).toHaveProperty('cycle_count');
    expect(typeof data.kill_switch_active).toBe('boolean');
  });

  test('GET /api/v1/autopilot/health returns healthy', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/autopilot/health`, {
      timeout: 10_000,
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('status');
  });

  test('GET /api/v1/autopilot/runs returns array', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/autopilot/runs?limit=5`, {
      timeout: 10_000,
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('GET /api/v1/autopilot/positions returns positions data', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/autopilot/positions`, {
      timeout: 15_000,
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    // Response may be a bare array OR an object with a positions property
    const isArray = Array.isArray(data);
    const hasPositionsArray = !isArray && data && Array.isArray(data.positions);
    expect(isArray || hasPositionsArray).toBeTruthy();
  });
});

test.describe('Autopilot UI2 Page', () => {
  test('autopilot page loads without crash', async ({ page }) => {
    await page.goto('/ui2/autopilot');
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
    const content = await page.locator('body').textContent();
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(50);
  });

  test('autopilot page shows key controls', async ({ page }) => {
    await page.goto('/ui2/autopilot');
    // Wait for lazy-loaded content to appear (Suspense resolves after network idle)
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    // Extra wait for React.lazy chunk to hydrate
    await page.waitForFunction(
      () => {
        const text = document.body.textContent?.toLowerCase() || '';
        return text.includes('autopilot') || text.includes('kill') ||
               text.includes('cycle') || text.includes('signal');
      },
      { timeout: 20_000 }
    ).catch(() => {});
    const bodyText = await page.locator('body').textContent() || '';
    // Should contain autopilot-related text
    const hasAutopilotContent =
      bodyText.toLowerCase().includes('autopilot') ||
      bodyText.toLowerCase().includes('kill') ||
      bodyText.toLowerCase().includes('cycle') ||
      bodyText.toLowerCase().includes('signal');
    expect(hasAutopilotContent).toBeTruthy();
  });

  test('autopilot v2 page loads', async ({ page }) => {
    await page.goto('/ui2/autopilot-v2');
    await page.waitForLoadState('domcontentloaded', { timeout: 30_000 }).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });
});
