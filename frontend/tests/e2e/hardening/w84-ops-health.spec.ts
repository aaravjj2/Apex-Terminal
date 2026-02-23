/**
 * W84 – Config Loader + Startup Checks
 * Verifies:
 *  1. /api/v3/ops/health returns correlation_id, ready, dependencies
 *  2. ES and broker are connected in the live response
 *  3. UI2 Ops page renders and shows all dependency cards
 *  4. Each call to /api/v3/ops/health returns a different correlation_id
 *  5. /api/v3/ops/elasticsearch and /api/v3/ops/broker return correct schemas
 */
import { test, expect } from '@playwright/test';

const API = 'http://127.0.0.1:8090';
const UI  = 'http://localhost:5100';

test.describe('W84 Ops Health V3 – API contract', () => {
  test('ops-health returns 200 with correlation_id', async ({ request }) => {
    const res = await request.get(`${API}/api/v3/ops/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('correlation_id');
    // Must parse as a UUID (8-4-4-4-12)
    expect(body.correlation_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  test('ops-health ready flag is true when stack is up', async ({ request }) => {
    const res = await request.get(`${API}/api/v3/ops/health`);
    const body = await res.json();
    expect(body.ready).toBe(true);
  });

  test('ops-health dependencies.elasticsearch connected = true', async ({ request }) => {
    const res = await request.get(`${API}/api/v3/ops/health`);
    const body = await res.json();
    expect(body.dependencies?.elasticsearch?.connected).toBe(true);
  });

  test('ops-health dependencies.elasticsearch cluster_name = apex-local', async ({ request }) => {
    const res = await request.get(`${API}/api/v3/ops/health`);
    const body = await res.json();
    expect(body.dependencies?.elasticsearch?.cluster_name).toBe('apex-local');
  });

  test('ops-health dependencies.broker connected = true and ACTIVE', async ({ request }) => {
    const res = await request.get(`${API}/api/v3/ops/health`);
    const body = await res.json();
    expect(body.dependencies?.broker?.connected).toBe(true);
    expect(body.dependencies?.broker?.account_status).toBe('ACTIVE');
  });

  test('ops-health correlation_id differs on each call', async ({ request }) => {
    const [r1, r2] = await Promise.all([
      request.get(`${API}/api/v3/ops/health`),
      request.get(`${API}/api/v3/ops/health`),
    ]);
    const b1 = await r1.json();
    const b2 = await r2.json();
    expect(b1.correlation_id).not.toBe(b2.correlation_id);
  });

  test('/api/v3/ops/elasticsearch returns connected=true', async ({ request }) => {
    const res = await request.get(`${API}/api/v3/ops/elasticsearch`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.connected).toBe(true);
    expect(body).toHaveProperty('cluster_name');
    expect(body).toHaveProperty('latency_ms');
  });

  test('/api/v3/ops/broker returns account_status=ACTIVE', async ({ request }) => {
    const res = await request.get(`${API}/api/v3/ops/broker`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.connected).toBe(true);
    expect(body.account_status).toBe('ACTIVE');
    expect(body.trading_blocked).toBe(false);
  });
});

test.describe('W84 Ops Health V3 – UI2 render', () => {
  test('ops page renders with data-testid=ops-ui2-page', async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    const el = page.getByTestId('ops-ui2-page');
    await expect(el).toBeVisible({ timeout: 15_000 });
  });

  test('ops page health dashboard testid is visible', async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.getByTestId('ops-ui2-page').waitFor({ timeout: 15_000 });
    // Health dashboard is the default active tab
    await expect(page.getByTestId('ops-health-dashboard')).toBeVisible({ timeout: 10_000 });
  });

  test('ops page health summary shows service count', async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await page.getByTestId('ops-ui2-page').waitFor({ timeout: 15_000 });
    // ops-summary-services card shows the count of monitored services
    await expect(page.getByTestId('ops-summary-services')).toBeVisible({ timeout: 10_000 });
  });
});
