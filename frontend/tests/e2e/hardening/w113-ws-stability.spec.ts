/**
 * W113 — Suite-level WebSocket stability monitor.
 *
 * SLO: running=true, heartbeat_task_alive=true, disconnect_count must not
 *      increment between polls, last_heartbeat_age_s < 60.
 *
 * Hard gates: data-testid only · no waitForTimeout · headless=false ·
 *             workers=1 · retries=0
 */

import { test, expect } from '@playwright/test';

const API = 'http://localhost:8000';

test.describe('W113 — WS stability monitor', () => {
  test('w113-01 ws/health returns 200', async ({ request }) => {
    const res = await request.get(`${API}/api/v3/ops/ws/health`);
    expect(res.status()).toBe(200);
  });

  test('w113-02 ws/health has required fields', async ({ request }) => {
    const body = await (await request.get(`${API}/api/v3/ops/ws/health`)).json();
    expect(body).toHaveProperty('running');
    expect(body).toHaveProperty('heartbeat_task_alive');
    expect(body).toHaveProperty('disconnect_count');
    expect(body).toHaveProperty('last_heartbeat_age_s');
  });

  test('w113-03 SLO: running is true', async ({ request }) => {
    const body = await (await request.get(`${API}/api/v3/ops/ws/health`)).json();
    expect(body.running).toBe(true);
  });

  test('w113-04 SLO: heartbeat_task_alive is true', async ({ request }) => {
    const body = await (await request.get(`${API}/api/v3/ops/ws/health`)).json();
    expect(body.heartbeat_task_alive).toBe(true);
  });

  test('w113-05 SLO: last_heartbeat_age_s is within 60s', async ({ request }) => {
    const body = await (await request.get(`${API}/api/v3/ops/ws/health`)).json();
    expect(body.last_heartbeat_age_s).toBeLessThan(60);
  });

  test('w113-06 SLO: disconnect_count does not increment between two polls', async ({ request }) => {
    const b1 = await (await request.get(`${API}/api/v3/ops/ws/health`)).json();
    const b2 = await (await request.get(`${API}/api/v3/ops/ws/health`)).json();
    expect(b2.disconnect_count).toBeLessThanOrEqual(b1.disconnect_count);
  });

  test('w113-07 SLO: active_clients is non-negative integer', async ({ request }) => {
    const body = await (await request.get(`${API}/api/v3/ops/ws/health`)).json();
    expect(typeof body.active_clients).toBe('number');
    expect(body.active_clients).toBeGreaterThanOrEqual(0);
  });

  test('w113-08 disconnect_count is non-negative', async ({ request }) => {
    const body = await (await request.get(`${API}/api/v3/ops/ws/health`)).json();
    expect(body.disconnect_count).toBeGreaterThanOrEqual(0);
  });

  test('w113-09 heartbeat_interval_s is positive', async ({ request }) => {
    const body = await (await request.get(`${API}/api/v3/ops/ws/health`)).json();
    expect(body.heartbeat_interval_s).toBeGreaterThan(0);
  });
});
