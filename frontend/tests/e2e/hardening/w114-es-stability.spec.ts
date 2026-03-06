/**
 * W114 — Suite-level Elasticsearch health + lag monitor.
 *
 * SLO (from docs/ops/SLO.md):
 *   connected=true, cluster_status != red, latency_ms < 2000, node_count >= 1
 *
 * Hard gates: data-testid only · no waitForTimeout · headless=false ·
 *             workers=1 · retries=0
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API = 'http://localhost:8000';

test.describe('W114 — ES stability monitor', () => {
  test('w114-01 SLO.md exists with ES thresholds', async () => {
    const sloPath = path.resolve(__dirname, '../../../../docs/ops/SLO.md');
    expect(fs.existsSync(sloPath)).toBe(true);
    const content = fs.readFileSync(sloPath, 'utf8');
    expect(content).toContain('Elasticsearch');
    expect(content).toContain('2000');
  });

  test('w114-02 elasticsearch endpoint returns 200', async ({ request }) => {
    const res = await request.get(`${API}/api/v3/ops/elasticsearch`);
    expect(res.status()).toBe(200);
  });

  test('w114-03 elasticsearch has required fields', async ({ request }) => {
    const body = await (await request.get(`${API}/api/v3/ops/elasticsearch`)).json();
    expect(body).toHaveProperty('connected');
    expect(body).toHaveProperty('cluster_status');
    expect(body).toHaveProperty('latency_ms');
    expect(body).toHaveProperty('node_count');
  });

  test('w114-04 SLO: connected is true', async ({ request }) => {
    const body = await (await request.get(`${API}/api/v3/ops/elasticsearch`)).json();
    expect(body.connected).toBe(true);
  });

  test('w114-05 SLO: cluster_status is not red', async ({ request }) => {
    const body = await (await request.get(`${API}/api/v3/ops/elasticsearch`)).json();
    expect(body.cluster_status).not.toBe('red');
    expect(['yellow', 'green']).toContain(body.cluster_status);
  });

  test('w114-06 SLO: latency_ms under 2000ms threshold', async ({ request }) => {
    const body = await (await request.get(`${API}/api/v3/ops/elasticsearch`)).json();
    expect(body.latency_ms).toBeLessThan(2000);
  });

  test('w114-07 SLO: node_count >= 1', async ({ request }) => {
    const body = await (await request.get(`${API}/api/v3/ops/elasticsearch`)).json();
    expect(body.node_count).toBeGreaterThanOrEqual(1);
  });

  test('w114-08 cluster_name is set', async ({ request }) => {
    const body = await (await request.get(`${API}/api/v3/ops/elasticsearch`)).json();
    expect(typeof body.cluster_name).toBe('string');
    expect(body.cluster_name.length).toBeGreaterThan(0);
  });

  test('w114-09 es health stable across two polls', async ({ request }) => {
    const b1 = await (await request.get(`${API}/api/v3/ops/elasticsearch`)).json();
    const b2 = await (await request.get(`${API}/api/v3/ops/elasticsearch`)).json();
    // connected should remain true across both polls
    expect(b1.connected).toBe(true);
    expect(b2.connected).toBe(true);
    // cluster_status should not flip to red between polls
    expect(b2.cluster_status).not.toBe('red');
  });
});
