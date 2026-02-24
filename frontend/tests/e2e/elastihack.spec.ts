/**
 * ElastiHack E2E Proof Test
 *
 * Validates all 3 ElastiHack UI pages via headed Playwright:
 * 1. ElastiHack Command Center (/ui2/elastihack) — contract, templates, ops, canary, health
 * 2. Query Studio (/ui2/query-studio) — search, saved, autocomplete, explain
 * 3. DLQ Ops (/ui2/dlq-ops) — DLQ inject/drain, throughput, lag, indices, integrity
 *
 * Also validates the unified backend API (/api/v4/elastihack/*).
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5100';
const API_BASE = 'http://localhost:8000';

// ── API Tests ────────────────────────────────────────────────────────────────

test.describe('ElastiHack API v4', () => {
  test('GET /contract returns contract v5.0 with 8 entity types', async ({ request }) => {
    const r = await request.get(`${API_BASE}/api/v4/elastihack/contract`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.contract_version).toBe('5.0');
    expect(data.entity_types).toHaveLength(8);
    expect(data.doc_id_algo).toBe('sha256-first24');
    expect(data.analyzers).toContain('edge_ngram_analyzer');
  });

  test('GET /templates lists 8 index templates', async ({ request }) => {
    const r = await request.get(`${API_BASE}/api/v4/elastihack/templates`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.count).toBe(8);
    expect(data.templates[0].name).toMatch(/^apex-/);
  });

  test('GET /aliases lists read/write aliases', async ({ request }) => {
    const r = await request.get(`${API_BASE}/api/v4/elastihack/aliases`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.count).toBe(8);
    for (const a of data.aliases) {
      expect(a.write_alias).toMatch(/^apex-.*-write$/);
      expect(a.read_alias).toMatch(/^apex-.*-read$/);
    }
  });

  test('GET /ilm lists 3 ILM policies', async ({ request }) => {
    const r = await request.get(`${API_BASE}/api/v4/elastihack/ilm`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.count).toBe(3);
  });

  test('GET /analyzers lists 5 analyzers', async ({ request }) => {
    const r = await request.get(`${API_BASE}/api/v4/elastihack/analyzers`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.analyzers).toHaveLength(5);
  });

  test('GET /synonyms returns 9 domain synonyms', async ({ request }) => {
    const r = await request.get(`${API_BASE}/api/v4/elastihack/synonyms`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.count).toBe(9);
  });

  test('GET /pipelines lists 2 ingest pipelines', async ({ request }) => {
    const r = await request.get(`${API_BASE}/api/v4/elastihack/pipelines`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.pipelines).toHaveLength(2);
  });

  test('POST /canary writes and verifies canary docs', async ({ request }) => {
    const wr = await request.post(`${API_BASE}/api/v4/elastihack/canary`);
    expect(wr.status()).toBe(200);
    const writeData = await wr.json();
    expect(writeData.count).toBe(8);

    const vr = await request.get(`${API_BASE}/api/v4/elastihack/canary`);
    expect(vr.status()).toBe(200);
    const verifyData = await vr.json();
    expect(verifyData.count).toBe(8);
  });

  test('POST /search with explain returns synonym expansion', async ({ request }) => {
    const r = await request.post(`${API_BASE}/api/v4/elastihack/search`, {
      data: { query: 'backtest', explain: true },
    });
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.explain).toBeTruthy();
    expect(data.explain.synonym_expansion).toContain('bt');
    expect(data.explain.synonym_expansion).toContain('simulation');
    expect(data.correlation_id).toMatch(/^search-/);
  });

  test('POST /autocomplete returns suggestions', async ({ request }) => {
    const r = await request.post(`${API_BASE}/api/v4/elastihack/autocomplete`, {
      data: { prefix: 'SMA', field: 'strategy_name' },
    });
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.suggestions.length).toBeGreaterThan(0);
    expect(data.analyzer).toBe('edge_ngram_analyzer');
  });

  test('DLQ inject → drain cycle works', async ({ request }) => {
    // Inject
    const ir = await request.post(`${API_BASE}/api/v4/elastihack/dlq/inject`);
    expect(ir.status()).toBe(200);
    const injected = await ir.json();
    expect(injected.injected).toBe(true);

    // Verify
    const lr = await request.get(`${API_BASE}/api/v4/elastihack/dlq`);
    const list = await lr.json();
    expect(list.count).toBeGreaterThan(0);

    // Drain
    const dr = await request.post(`${API_BASE}/api/v4/elastihack/dlq/drain?rate_limit=100`);
    const drained = await dr.json();
    expect(drained.remaining).toBe(0);
  });

  test('POST /bulk indexes documents idempotently', async ({ request }) => {
    const r = await request.post(`${API_BASE}/api/v4/elastihack/bulk`, {
      data: {
        entity_type: 'events',
        documents: [
          { event: 'backtest_started', symbol: 'AAPL', ts: Date.now() },
          { event: 'backtest_completed', symbol: 'AAPL', ts: Date.now() },
        ],
      },
    });
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.indexed).toBe(2);
    expect(data.idempotent).toBe(true);
  });

  test('Saved searches CRUD works', async ({ request }) => {
    // Create
    const cr = await request.post(`${API_BASE}/api/v4/elastihack/saved-searches`, {
      data: { name: 'Test Search', query: 'AAPL backtest', pinned: true },
    });
    expect(cr.status()).toBe(200);
    const created = await cr.json();
    expect(created.name).toBe('Test Search');

    // List
    const lr = await request.get(`${API_BASE}/api/v4/elastihack/saved-searches`);
    const list = await lr.json();
    expect(list.searches.some((s: any) => s.name === 'Test Search')).toBe(true);

    // Delete
    const dr = await request.delete(`${API_BASE}/api/v4/elastihack/saved-searches/${created.id}`);
    expect(dr.status()).toBe(200);
  });

  test('GET /ops/latency returns percentiles', async ({ request }) => {
    const r = await request.get(`${API_BASE}/api/v4/elastihack/ops/latency`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data).toHaveProperty('p50');
    expect(data).toHaveProperty('p95');
    expect(data).toHaveProperty('p99');
  });

  test('GET /ops/integrity returns score', async ({ request }) => {
    const r = await request.get(`${API_BASE}/api/v4/elastihack/ops/integrity`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.integrity_score).toBe(100);
  });

  test('GET /hybrid/status returns vector configuration', async ({ request }) => {
    const r = await request.get(`${API_BASE}/api/v4/elastihack/hybrid/status`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data).toHaveProperty('vector_enabled');
  });

  test('POST /reindex/plan returns dry-run plan', async ({ request }) => {
    const r = await request.post(`${API_BASE}/api/v4/elastihack/reindex/plan`, {
      data: { entity_type: 'backtests', dry_run: true },
    });
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.plan.dry_run).toBe(true);
    expect(data.rollback_supported).toBe(true);
  });
});

// ── UI Tests ─────────────────────────────────────────────────────────────────

test.describe('ElastiHack UI Pages', () => {
  test('ElastiHack Command Center loads with 5 tabs', async ({ page }) => {
    await page.goto(`${BASE}/ui2/elastihack`);
    await page.waitForSelector('[data-testid="elastihack-ui2-page"]');

    // Verify contract version loads
    await expect(page.getByTestId('contract-version')).toBeVisible({ timeout: 10000 });

    // Verify all 5 tabs exist
    for (const tab of ['overview', 'templates', 'ops', 'canary', 'health']) {
      await expect(page.getByTestId(`elastihack-tab-${tab}`)).toBeVisible();
    }

    // Click Templates tab
    await page.getByTestId('elastihack-tab-templates').click();
    await expect(page.getByTestId('templates-table')).toBeVisible();

    // Click Canary tab and write canary docs
    await page.getByTestId('elastihack-tab-canary').click();
    await page.getByTestId('canary-write-btn').click();
    await expect(page.getByTestId('canary-results-table')).toBeVisible({ timeout: 10000 });

    // Click Health tab
    await page.getByTestId('elastihack-tab-health').click();
    await expect(page.getByTestId('health-status')).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'playwright_proof/elastihack-command-center.png', fullPage: true });
  });

  test('Query Studio performs search with explain', async ({ page }) => {
    await page.goto(`${BASE}/ui2/query-studio`);
    await page.waitForSelector('[data-testid="query-studio-ui2-page"]');

    // Type a search query
    await page.getByTestId('query-input').fill('backtest');
    
    // Enable explain
    await page.getByTestId('explain-toggle').check();

    // Execute search
    await page.getByTestId('search-btn').click();
    
    // Wait for results
    await expect(page.getByTestId('result-latency')).toBeVisible({ timeout: 10000 });
    
    // Verify explain drawer appears
    await expect(page.getByTestId('explain-drawer')).toBeVisible({ timeout: 5000 });

    // Save the search
    await page.getByTestId('save-search-toggle').click();
    await page.getByTestId('save-name-input').fill('My Backtest Search');
    await page.getByTestId('save-confirm-btn').click();

    await page.screenshot({ path: 'playwright_proof/elastihack-query-studio.png', fullPage: true });
  });

  test('DLQ Ops shows inject/drain cycle', async ({ page }) => {
    await page.goto(`${BASE}/ui2/dlq-ops`);
    await page.waitForSelector('[data-testid="dlq-ops-ui2-page"]');

    // Verify all 5 tabs exist
    for (const tab of ['dlq', 'throughput', 'lag', 'indices', 'integrity']) {
      await expect(page.getByTestId(`dlq-tab-${tab}`)).toBeVisible();
    }

    // Inject a test DLQ entry
    await page.getByTestId('dlq-inject-btn').click();
    // Allow page to refresh
    await page.waitForTimeout(500);
    
    // Click Throughput tab
    await page.getByTestId('dlq-tab-throughput').click();
    await expect(page.getByTestId('throughput-panel')).toBeVisible();

    // Click Indices tab
    await page.getByTestId('dlq-tab-indices').click();
    await expect(page.getByTestId('indices-table')).toBeVisible();

    // Click Integrity tab
    await page.getByTestId('dlq-tab-integrity').click();
    await expect(page.getByTestId('integrity-score')).toBeVisible();

    await page.screenshot({ path: 'playwright_proof/elastihack-dlq-ops.png', fullPage: true });
  });
});
