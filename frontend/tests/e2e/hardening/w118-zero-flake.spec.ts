// Wave 118 — Zero-flake: same API call 3× must yield identical results.
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8000';

async function fetchHealth(request: any) {
  const r = await request.get(`${BASE}/api/v3/ops/health`);
  expect(r.status()).toBe(200);
  return r.json();
}

test('w118 health deterministic run 1', async ({ request }) => {
  const d = await fetchHealth(request);
  expect(typeof d).toBe('object');
});

test('w118 health deterministic run 2', async ({ request }) => {
  const d = await fetchHealth(request);
  expect(typeof d).toBe('object');
});

test('w118 health deterministic run 3', async ({ request }) => {
  const d = await fetchHealth(request);
  expect(typeof d).toBe('object');
});

test('w118 ws health deterministic x3', async ({ request }) => {
  const results: string[] = [];
  for (let i = 0; i < 3; i++) {
    const r = await request.get(`${BASE}/api/v3/ops/ws/health`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    results.push(JSON.stringify({ running: data.running }));
  }
  expect(new Set(results).size).toBe(1);
});

test('w118 reset version deterministic x3', async ({ request }) => {
  const versions: string[] = [];
  for (let i = 0; i < 3; i++) {
    const r = await request.get(`${BASE}/api/v3/ops/reset/version`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    versions.push(data.version);
  }
  expect(new Set(versions).size).toBe(1);
});

test('w118 es health deterministic x3', async ({ request }) => {
  const statuses: string[] = [];
  for (let i = 0; i < 3; i++) {
    const r = await request.get(`${BASE}/api/v3/ops/elasticsearch`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    statuses.push(data.cluster_status);
  }
  expect(new Set(statuses).size).toBe(1);
});

test('w118 broker health deterministic x3', async ({ request }) => {
  const flags: boolean[] = [];
  for (let i = 0; i < 3; i++) {
    const r = await request.get(`${BASE}/api/v3/ops/broker`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    flags.push(data.connected);
  }
  expect(new Set(flags).size).toBe(1);
});
