/**
 * W115 — Suite-level broker sync monitor.
 *
 * SLO (from docs/ops/SLO.md):
 *   connected=true, latency_ms < 5000, trading_blocked=false
 *
 * Hard gates: data-testid only · no waitForTimeout · headless=false ·
 *             workers=1 · retries=0
 */

import { test, expect } from '@playwright/test';

const API = 'http://localhost:8090';

test.describe('W115 — Broker sync monitor', () => {
  test('w115-01 broker endpoint returns 200', async ({ request }) => {
    const res = await request.get(`${API}/api/v3/ops/broker`);
    expect(res.status()).toBe(200);
  });

  test('w115-02 broker has required fields', async ({ request }) => {
    const body = await (await request.get(`${API}/api/v3/ops/broker`)).json();
    expect(body).toHaveProperty('connected');
    expect(body).toHaveProperty('latency_ms');
    expect(body).toHaveProperty('trading_blocked');
  });

  test('w115-03 SLO: connected is true', async ({ request }) => {
    const body = await (await request.get(`${API}/api/v3/ops/broker`)).json();
    expect(body.connected).toBe(true);
  });

  test('w115-04 SLO: latency_ms under 5000ms threshold', async ({ request }) => {
    const body = await (await request.get(`${API}/api/v3/ops/broker`)).json();
    expect(body.latency_ms).toBeLessThan(5000);
  });

  test('w115-05 SLO: trading_blocked is false', async ({ request }) => {
    const body = await (await request.get(`${API}/api/v3/ops/broker`)).json();
    expect(body.trading_blocked).toBe(false);
  });

  test('w115-06 account_number is redacted or present', async ({ request }) => {
    const body = await (await request.get(`${API}/api/v3/ops/broker`)).json();
    expect(typeof body.account_number).toBe('string');
    expect(body.account_number.length).toBeGreaterThan(0);
  });

  test('w115-07 cash is a positive number', async ({ request }) => {
    const body = await (await request.get(`${API}/api/v3/ops/broker`)).json();
    expect(typeof body.cash).toBe('number');
    expect(body.cash).toBeGreaterThan(0);
  });

  test('w115-08 broker stable across two polls', async ({ request }) => {
    const b1 = await (await request.get(`${API}/api/v3/ops/broker`)).json();
    const b2 = await (await request.get(`${API}/api/v3/ops/broker`)).json();
    expect(b1.connected).toBe(true);
    expect(b2.connected).toBe(true);
    expect(b2.trading_blocked).toBe(false);
  });
});
