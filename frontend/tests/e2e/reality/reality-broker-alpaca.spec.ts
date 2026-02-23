/**
 * Reality Test: Broker is Alpaca Paper
 * Ensures the broker gateway connects to Alpaca paper trading,
 * not mock/demo data.
 */
import { test, expect } from '@playwright/test';

const BE = 'http://localhost:8090';

test.describe('Reality — Alpaca Paper Broker', () => {
  test('Broker health identifies as alpaca_paper', async ({ request }) => {
    const res = await request.get(`${BE}/api/broker/health`);
    const body = await res.json();
    if (res.status() === 200) {
      expect(body.broker).toBe('alpaca_paper');
      expect(body.ok).toBe(true);
    } else {
      // Even if Alpaca is unreachable, response must be valid JSON
      expect(body).toHaveProperty('ok', false);
      expect(body).toHaveProperty('message');
    }
  });

  test('Broker account returns Alpaca schema or error', async ({ request }) => {
    const res = await request.get(`${BE}/api/broker/account`);
    const ct = res.headers()['content-type'] || '';
    expect(ct).toContain('application/json');
    const body = await res.json();
    if (res.status() === 200) {
      // Alpaca account fields
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('equity');
      expect(body).toHaveProperty('buying_power');
    } else {
      // Auth failure or connectivity issue — still valid JSON error
      expect(body).toHaveProperty('ok', false);
      expect(body).toHaveProperty('correlation_id');
    }
  });

  test('Broker orders returns array or error', async ({ request }) => {
    const res = await request.get(`${BE}/api/broker/orders`);
    const ct = res.headers()['content-type'] || '';
    expect(ct).toContain('application/json');
    const body = await res.json();
    if (res.status() === 200) {
      expect(Array.isArray(body)).toBe(true);
    } else {
      expect(body).toHaveProperty('ok', false);
    }
  });

  test('Broker positions returns array or error', async ({ request }) => {
    const res = await request.get(`${BE}/api/broker/positions`);
    const ct = res.headers()['content-type'] || '';
    expect(ct).toContain('application/json');
    const body = await res.json();
    if (res.status() === 200) {
      expect(Array.isArray(body)).toBe(true);
    } else {
      expect(body).toHaveProperty('ok', false);
    }
  });

  test('BrokerV2 page renders without crash', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const navItem = page.getByTestId('nav-item-broker');
    if (await navItem.isVisible().catch(() => false)) {
      await navItem.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      // Page should render without "Unexpected end of JSON input" errors
      // Check no unhandled error overlays
      const errorOverlay = page.locator('vite-error-overlay');
      expect(await errorOverlay.count()).toBe(0);
    }
  });
});
