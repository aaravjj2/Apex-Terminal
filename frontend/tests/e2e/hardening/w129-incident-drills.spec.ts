// Wave 129 — Incident drills: monitoring endpoints expose recovery data.
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8090';

test('w129 ws health has disconnect_count', async ({ request }) => {
  const r = await request.get(`${BASE}/api/v3/ops/ws/health`);
  expect(r.status()).toBe(200);
  const data = await r.json();
  expect(data).toHaveProperty('disconnect_count');
});

test('w129 ws health has running flag', async ({ request }) => {
  const r = await request.get(`${BASE}/api/v3/ops/ws/health`);
  const data = await r.json();
  expect(data).toHaveProperty('running');
});

test('w129 es health has connected flag', async ({ request }) => {
  const r = await request.get(`${BASE}/api/v3/ops/elasticsearch`);
  expect(r.status()).toBe(200);
  const data = await r.json();
  expect(data).toHaveProperty('connected');
});

test('w129 es health has latency_ms', async ({ request }) => {
  const r = await request.get(`${BASE}/api/v3/ops/elasticsearch`);
  const data = await r.json();
  expect(data).toHaveProperty('latency_ms');
});

test('w129 broker has trading_blocked', async ({ request }) => {
  const r = await request.get(`${BASE}/api/v3/ops/broker`);
  expect(r.status()).toBe(200);
  const data = await r.json();
  expect(data).toHaveProperty('trading_blocked');
});

test('w129 broker has connected flag', async ({ request }) => {
  const r = await request.get(`${BASE}/api/v3/ops/broker`);
  const data = await r.json();
  expect(data).toHaveProperty('connected');
});

test('w129 reset-all returns ok', async ({ request }) => {
  const r = await request.post(`${BASE}/api/v3/ops/reset-all`);
  expect(r.status()).toBe(200);
  const data = await r.json();
  expect(data.status).toBe('ok');
});

test('w129 reset version starts with w', async ({ request }) => {
  const r = await request.get(`${BASE}/api/v3/ops/reset/version`);
  const data = await r.json();
  expect(data.version).toMatch(/^w/);
});
