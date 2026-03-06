/**
 * W82 Smoke Spec
 * Validates: UI2 loads, core routes work, backend reachable on 8090
 * Rules: data-testid only, no waitForTimeout, headed MCP.
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5100/ui2';
const API = 'http://localhost:8000';

test.describe('W82 Monorepo Smoke', () => {
  test('dashboard route renders', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await expect(page.getByTestId('dashboard-ui2-page')).toBeVisible({ timeout: 10000 });
  });

  test('trading route renders', async ({ page }) => {
    await page.goto(`${BASE}/trading`);
    await expect(page.getByTestId('trading-ui2-page')).toBeVisible({ timeout: 10000 });
  });

  test('backtest route renders', async ({ page }) => {
    await page.goto(`${BASE}/backtest`);
    await expect(page.getByTestId('backtest-ui2-page')).toBeVisible({ timeout: 10000 });
  });

  test('search route renders', async ({ page }) => {
    await page.goto(`${BASE}/search`);
    await expect(page.getByTestId('search-ui2-page')).toBeVisible({ timeout: 10000 });
  });

  test('health route renders', async ({ page }) => {
    await page.goto(`${BASE}/health`);
    await expect(page.getByTestId('platform-health-page')).toBeVisible({ timeout: 10000 });
  });

  test('backend health reachable from browser context', async ({ request }) => {
    const r = await request.get(`${API}/health`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.status).toBe('healthy');
  });

  test('backend backtest endpoint works', async ({ request }) => {
    const r = await request.post(`${API}/api/backtest/run`, {
      data: {
        symbol: 'AAPL',
        strategy_id: 'sma_cross',
        seed: 42,
        initial_capital: 100000,
        start_date: '2024-01-01',
        end_date: '2024-03-28',
      },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty('run_id');
    expect(body).toHaveProperty('status');
  });

  test('UI2 AppShell renders topbar', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await expect(page.getByTestId('ui2-topbar')).toBeVisible({ timeout: 10000 });
  });
});
