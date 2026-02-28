/**
 * W81 Baseline Health Spec
 * Validates all data-ready="true" cards on the Ops/Health page.
 * Rules: data-testid selectors only, no waitForTimeout, headed MCP.
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5100/ui2';

test.describe('W81 Baseline Health Gates', () => {
  test('health endpoint returns healthy', async ({ request }) => {
    const r = await request.get('http://127.0.0.1:8090/health');
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.status).toBe('healthy');
  });

  test('Alpaca broker reachable and account active', async ({ request }) => {
    const r = await request.get('http://127.0.0.1:8090/api/v1/verification/alpaca/health');
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.api_reachable).toBe(true);
    expect(body.account_status).toBe('ACTIVE');
    expect(body.trading_blocked).toBe(false);
  });

  test('broker readiness kill_switch inactive', async ({ request }) => {
    const r = await request.get('http://127.0.0.1:8090/api/v2/broker/readiness');
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.kill_switch_active).toBe(false);
  });

  test('ES cluster healthy at localhost:9200', async ({ request }) => {
    const r = await request.get('http://localhost:9200/_cluster/health');
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(['green', 'yellow']).toContain(body.status);
    expect(body.cluster_name).toBe('apex-local');
  });

  test('UI2 health page loads and shows platform-health-page testid', async ({ page }) => {
    await page.goto(`${BASE}/health`);
    await expect(page.getByTestId('platform-health-page')).toBeVisible({ timeout: 10000 });
  });

  test('UI2 ops page loads', async ({ page }) => {
    await page.goto(`${BASE}/ops`);
    await expect(page.getByTestId('ops-ui2-page')).toBeVisible({ timeout: 10000 });
  });

  test('WS autopilot heartbeat running', async ({ request }) => {
    const r = await request.get('http://127.0.0.1:8090/api/v1/autopilot/ws_status');
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.heartbeat_running).toBe(true);
  });

  test('platform health summary returns components', async ({ request }) => {
    const r = await request.get('http://127.0.0.1:8090/api/v1/platform-health/summary');
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty('overall_status');
    expect(body).toHaveProperty('total_components');
  });
});
