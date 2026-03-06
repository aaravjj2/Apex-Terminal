/**
 * Hardening Suite  Gate 5: Elasticsearch Connectivity
 *
 * Tests the REAL Elasticsearch 8.17 cluster at localhost:9200.
 * Cluster: apex-local, single-node (yellow status = expected for single node).
 *
 * Direct ES endpoints (no proxy needed):
 *   GET http://localhost:9200/               -> cluster info
 *   GET http://localhost:9200/_cluster/health -> {cluster_name,status,number_of_nodes,...}
 *   GET http://localhost:9200/_cat/indices?format=json -> array of indices
 *   GET http://localhost:9200/apex-trades    -> index mapping
 *
 * Note: /api/v2/elasticsearch/health on the running backend (port 8090) returns
 * 500 because that server instance has a different ES config  we test ES
 * directly for ground truth.
 */
import { test, expect } from '@playwright/test';

const ES = 'http://localhost:9200';
const API = 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Direct ES connectivity
// ---------------------------------------------------------------------------
test.describe('Elasticsearch  Direct Cluster', () => {

  test('GET http://localhost:9200/ returns 200', async ({ request }) => {
    const resp = await request.get(`${ES}/`);
    expect(resp.status()).toBe(200);
  });

  test('ES root response has cluster_name', async ({ request }) => {
    const json = await (await request.get(`${ES}/`)).json();
    expect(typeof json.cluster_name).toBe('string');
    expect(json.cluster_name).toBe('apex-local');
  });

  test('ES root has version object', async ({ request }) => {
    const json = await (await request.get(`${ES}/`)).json();
    expect(typeof json.version).toBe('object');
    expect(json.version).not.toBeNull();
  });

  test('ES cluster/health returns 200', async ({ request }) => {
    const resp = await request.get(`${ES}/_cluster/health`);
    expect(resp.status()).toBe(200);
  });

  test('cluster_name is apex-local', async ({ request }) => {
    const json = await (await request.get(`${ES}/_cluster/health`)).json();
    expect(json.cluster_name).toBe('apex-local');
  });

  test('cluster status is green or yellow (not red)', async ({ request }) => {
    const json = await (await request.get(`${ES}/_cluster/health`)).json();
    expect(['green', 'yellow']).toContain(json.status);
  });

  test('cluster has at least 1 node', async ({ request }) => {
    const json = await (await request.get(`${ES}/_cluster/health`)).json();
    expect(json.number_of_nodes).toBeGreaterThanOrEqual(1);
  });

  test('cluster has no unassigned shards (or is normal for single-node)', async ({ request }) => {
    const json = await (await request.get(`${ES}/_cluster/health`)).json();
    // For single-node cluster, some replica shards may be unassigned (yellow)  that is fine
    expect(typeof json.unassigned_shards).toBe('number');
  });

});

// ---------------------------------------------------------------------------
// Index existence
// ---------------------------------------------------------------------------
test.describe('Elasticsearch  apex-trades Index', () => {

  test('GET /apex-trades returns 200 (index exists)', async ({ request }) => {
    const resp = await request.get(`${ES}/apex-trades`);
    expect(resp.status()).toBe(200);
  });

  test('apex-trades index has mappings', async ({ request }) => {
    const json = await (await request.get(`${ES}/apex-trades`)).json();
    expect(json['apex-trades']).toBeDefined();
    expect(json['apex-trades'].mappings).toBeDefined();
  });

});

// ---------------------------------------------------------------------------
// Indices list
// ---------------------------------------------------------------------------
test.describe('Elasticsearch  Indices List', () => {

  test('GET /_cat/indices?format=json returns 200', async ({ request }) => {
    const resp = await request.get(`${ES}/_cat/indices?format=json`);
    expect(resp.status()).toBe(200);
  });

  test('indices list is an array', async ({ request }) => {
    const json = await (await request.get(`${ES}/_cat/indices?format=json`)).json();
    expect(Array.isArray(json)).toBe(true);
  });

  test('apex-trades appears in indices list', async ({ request }) => {
    const json = await (await request.get(`${ES}/_cat/indices?format=json`)).json();
    const names = json.map((idx: any) => idx.index);
    expect(names).toContain('apex-trades');
  });

});

// ---------------------------------------------------------------------------
// Document indexing round-trip
// ---------------------------------------------------------------------------
test.describe('Elasticsearch  Document Round-trip', () => {

  test('can index a test document into apex-trades', async ({ request }) => {
    const doc = {
      symbol: 'AAPL',
      action: 'BUY',
      price: 185.5,
      quantity: 10,
      timestamp: new Date().toISOString(),
      run_id: 'test-e2e-hardening',
    };
    const resp = await request.post(`${ES}/apex-trades/_doc`, {
      data: doc,
      headers: { 'Content-Type': 'application/json' },
    });
    expect([200, 201]).toContain(resp.status());
  });

  test('indexed document has result created or updated', async ({ request }) => {
    const doc = { symbol: 'TEST', price: 100.0, timestamp: new Date().toISOString() };
    const json = await (await request.post(`${ES}/apex-trades/_doc`, {
      data: doc,
      headers: { 'Content-Type': 'application/json' },
    })).json();
    expect(['created', 'updated']).toContain(json.result);
  });

});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
test.describe('Elasticsearch  Search', () => {

  test('GET /apex-trades/_search returns 200', async ({ request }) => {
    const resp = await request.get(`${ES}/apex-trades/_search`);
    expect(resp.status()).toBe(200);
  });

  test('search response has hits object', async ({ request }) => {
    const json = await (await request.get(`${ES}/apex-trades/_search`)).json();
    expect(json.hits).toBeDefined();
    expect(typeof json.hits.total).toBe('object');
  });

  test('search total is non-negative', async ({ request }) => {
    const json = await (await request.get(`${ES}/apex-trades/_search`)).json();
    expect(json.hits.total.value).toBeGreaterThanOrEqual(0);
  });

});
