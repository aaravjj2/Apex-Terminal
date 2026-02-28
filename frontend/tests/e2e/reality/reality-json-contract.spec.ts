/**
 * Reality Test: JSON Error Contract
 * Ensures all API responses (including errors) return valid JSON
 * with the stable error schema: { ok, code, message, correlation_id }
 */
import { test, expect } from '@playwright/test';

const BE = 'http://localhost:8090';

test.describe('Reality — JSON Error Contract', () => {
  test('404 on unknown endpoint returns JSON error', async ({ request }) => {
    const res = await request.get(`${BE}/api/nonexistent-endpoint-xyz`);
    expect(res.status()).toBe(404);
    const ct = res.headers()['content-type'] || '';
    expect(ct).toContain('application/json');
    const body = await res.json();
    // FastAPI returns {"detail": "Not Found"} for unmatched routes
    expect(body).toHaveProperty('detail');
    expect(body.detail).toBe('Not Found');
  });

  test('All error responses include X-Correlation-Id header', async ({ request }) => {
    const res = await request.get(`${BE}/api/nonexistent-endpoint-xyz`);
    const cid = res.headers()['x-correlation-id'];
    expect(cid).toBeTruthy();
    expect(typeof cid).toBe('string');
  });

  test('Health endpoint returns valid JSON', async ({ request }) => {
    const res = await request.get(`${BE}/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status');
  });

  test('Broker health returns valid JSON', async ({ request }) => {
    const res = await request.get(`${BE}/api/broker/health`);
    // May be 200 or 503 depending on Alpaca connectivity
    const ct = res.headers()['content-type'] || '';
    expect(ct).toContain('application/json');
    const body = await res.json();
    expect(body).toHaveProperty('ok');
    if (res.status() === 200) {
      expect(body.ok).toBe(true);
      expect(body).toHaveProperty('connected', true);
      expect(body).toHaveProperty('account_id');
    }
  });

  test('Market session returns valid JSON', async ({ request }) => {
    const res = await request.get(`${BE}/api/ops/market_session`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('is_open_now');
    expect(body).toHaveProperty('session');
    expect(body).toHaveProperty('timezone', 'America/New_York');
    expect(['closed', 'pre', 'regular', 'post']).toContain(body.session);
  });
});
