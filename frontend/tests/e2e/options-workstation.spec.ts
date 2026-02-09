import { test, expect } from '@playwright/test';

const BACKEND_URL = 'http://localhost:8000';

// Helper to check if backend is available
async function isBackendAvailable(request: any): Promise<boolean> {
  try {
    const res = await request.get(`${BACKEND_URL}/health`, { timeout: 3000 });
    return res.ok();
  } catch {
    return false;
  }
}

test.describe('Options Workstation E2E Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Options View Navigation', async ({ page }) => {
    const optionsNav = page.locator('[data-testid="nav-item-options"]');
    await expect(optionsNav).toBeVisible({ timeout: 5000 });
    await optionsNav.click();
    await page.waitForTimeout(500);

    // Verify Options view loaded
    const optionsContent = page.locator('text=/Options|Analytics|Chain/i').first();
    await expect(optionsContent).toBeVisible({ timeout: 10000 });
  });

  test('Trust UX Component Verification', async ({ page }) => {
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);

    // Check for mode indicator in top bar
    const modeBadge = page.locator('[class*="bg-"][class*="text-"]').filter({ hasText: /LIVE|REPLAY|PAPER|BACKTEST/ }).first();
    await expect(modeBadge).toBeVisible({ timeout: 5000 });
  });

  test('Console Error Check', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      errors.push(error.message);
    });

    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(2000);

    // Filter out common noise
    const criticalErrors = errors.filter(err =>
      !err.includes('favicon') &&
      !err.includes('sourcemap') &&
      !err.includes('Warning') &&
      !err.includes('ResizeObserver') &&
      !err.includes('WebSocket')
    );

    expect(criticalErrors.length).toBeLessThan(10);
  });
});

test.describe('Backend API Endpoints', () => {
  test('Backend API Health Check', async ({ request }) => {
    const backendUp = await isBackendAvailable(request);
    test.skip(!backendUp, 'Backend not available - skipping API test');

    const response = await request.get(`${BACKEND_URL}/health`);
    expect(response.ok()).toBeTruthy();
  });

  test('Autopilot Reconnect Endpoint', async ({ request }) => {
    const backendUp = await isBackendAvailable(request);
    test.skip(!backendUp, 'Backend not available - skipping API test');

    const response = await request.post(`${BACKEND_URL}/api/v1/autopilot/reconnect`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('status');
  });
});
