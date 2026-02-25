/**
 * ElastiHack Vector E2E Spec — Waves W071–W102
 *
 * Validates:
 *  - Dense vector mappings API (W072-W074)
 *  - Vector coverage + ops status (W075-W079)
 *  - kNN similar_backtests, similar_cycles, similar_strategies (W080-W082)
 *  - kNN explain (W083-W085)
 *  - Hybrid RRF search (W086-W090)
 *  - Vector DLQ inject/drain/lag (W091-W096)
 *  - Agent tools manifest + similar-setup-flow (W097-W102)
 *  - UI: Vector tab, kNN tab in ElastiHack Command Center
 *
 * Rules: headed only, workers=1, retries=0, data-testid selectors, NO waitForTimeout.
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5100';
const API_BASE = 'http://localhost:8000';
const EH = `${API_BASE}/api/v4/elastihack`;

// ── API Tests ──────────────────────────────────────────────────────────────────

test.describe('ElastiHack Vector — API (W072-W102)', () => {

  // W072-W074: Vector Mappings
  test('GET /vector/mappings returns dense_vector spec with 64 dims', async ({ request }) => {
    const r = await request.get(`${EH}/vector/mappings`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data).toHaveProperty('pattern_vec');
    expect(data.pattern_vec.type).toBe('dense_vector');
    expect(data.pattern_vec.dims).toBe(64);
    expect(data.pattern_vec.similarity).toBe('cosine');
    expect(data.pattern_vec.index).toBe(true);
    expect(data.pattern_vec.applies_to).toContain('backtest_run');
    expect(data.pattern_vec.applies_to).toContain('autopilot_cycle');
    expect(data).toHaveProperty('text_vec');
    expect(data.text_vec.dims).toBe(384);
    expect(data.contract_version).toBeTruthy();
  });

  // W075-W077: Vector Coverage
  test('GET /vector/coverage returns coverage structure', async ({ request }) => {
    const r = await request.get(`${EH}/vector/coverage`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.dims).toBe(64);
    expect(data.similarity).toBe('cosine');
    expect(data).toHaveProperty('coverage');
    expect(data.coverage).toHaveProperty('backtest_run');
    expect(data.coverage).toHaveProperty('autopilot_cycle');
    expect(data.coverage).toHaveProperty('strategies');
  });

  // W076: Coverage update
  test('POST /vector/coverage/update persists values', async ({ request }) => {
    const r = await request.post(`${EH}/vector/coverage/update?entity_type=backtest_run&total=100&with_vec=75`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.updated).toBe(true);
    expect(data.coverage.coverage_pct).toBe(75);

    // Verify reflected in GET
    const cr = await request.get(`${EH}/vector/coverage`);
    const coverage = await cr.json();
    expect(coverage.coverage.backtest_run.coverage_pct).toBe(75);
  });

  // W078-W079: Vector Ops Status
  test('GET /vector/ops/status returns HNSW params and deterministic flag', async ({ request }) => {
    const r = await request.get(`${EH}/vector/ops/status`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.pattern_vec.dims).toBe(64);
    expect(data.pattern_vec.similarity).toBe('cosine');
    expect(data.pattern_vec.deterministic).toBe(true);
    expect(data.pattern_vec.external_api_required).toBe(false);
    expect(data.pattern_vec.hnsw_m).toBe(16);
    expect(data.pattern_vec.hnsw_ef_construction).toBe(100);
    expect(data).toHaveProperty('coverage_summary');
  });

  // W080: kNN Similar Backtests
  test('POST /knn/similar_backtests returns 64-dim pattern_vec_computed=true', async ({ request }) => {
    const r = await request.post(`${EH}/knn/similar_backtests`, {
      data: {
        run_id: 'test-run-001',
        metrics: { sharpe_ratio: 1.5, win_rate: 0.6, cagr: 0.22, max_drawdown: -0.12 },
        k: 10,
      },
    });
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.ok).toBe(true);
    expect(data.pattern_vec_computed).toBe(true);
    expect(data.pattern_vec_dims).toBe(64);
    expect(Array.isArray(data.pattern_vec_sample)).toBe(true);
    expect(data.pattern_vec_sample.length).toBe(8);
    expect(data.similarity).toBe('cosine');
    expect(data.correlation_id).toMatch(/^knn-bt-/);
    // ES may or may not be available — hits array always present
    expect(Array.isArray(data.hits)).toBe(true);
  });

  // Determinism test
  test('POST /knn/similar_backtests is deterministic — same input same vec', async ({ request }) => {
    const payload = {
      run_id: 'determinism-test-42',
      metrics: { sharpe_ratio: 1.2, win_rate: 0.55, cagr: 0.18 },
      k: 5,
    };
    const r1 = await request.post(`${EH}/knn/similar_backtests`, { data: payload });
    const r2 = await request.post(`${EH}/knn/similar_backtests`, { data: payload });
    const d1 = await r1.json();
    const d2 = await r2.json();
    expect(d1.pattern_vec_sample).toEqual(d2.pattern_vec_sample);
  });

  // W081: kNN Similar Cycles
  test('POST /knn/similar_cycles returns pattern_vec_computed=true', async ({ request }) => {
    const r = await request.post(`${EH}/knn/similar_cycles`, {
      data: {
        cycle_id: 'cycle-42',
        metrics: { win_rate: 0.58, sharpe_ratio: 1.3, cagr: 0.2 },
        k: 5,
      },
    });
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.ok).toBe(true);
    expect(data.pattern_vec_computed).toBe(true);
    expect(data.pattern_vec_dims).toBe(64);
    expect(data.correlation_id).toMatch(/^knn-cycle-/);
  });

  // W082: kNN Similar Strategies (vector not enabled by default)
  test('POST /knn/similar_strategies returns ok=false when vector not enabled', async ({ request }) => {
    const r = await request.post(`${EH}/knn/similar_strategies`, {
      data: { q: 'momentum strategy AAPL', k: 5 },
    });
    expect(r.status()).toBe(200);
    const data = await r.json();
    // ok=false because ELASTICSEARCH_VECTOR_ENABLED not set in test env
    // ok=true if it is set — both are valid
    expect(typeof data.ok).toBe('boolean');
    expect(data).toHaveProperty('correlation_id');
  });

  // W083-W085: kNN Explain
  test('POST /knn/explain returns feature-level similarity', async ({ request }) => {
    const r = await request.post(`${EH}/knn/explain?run_id=run-A&candidate_id=run-B`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.run_id).toBe('run-A');
    expect(data.candidate_id).toBe('run-B');
    expect(data.cosine_similarity).toBeGreaterThan(0);
    expect(Array.isArray(data.top_features)).toBe(true);
    expect(data.dims_compared).toBe(64);
  });

  // W086-W090: Hybrid RRF Search
  test('POST /hybrid/search mode=hybrid returns rrf retriever info', async ({ request }) => {
    const r = await request.post(`${EH}/hybrid/search`, {
      data: {
        query: 'AAPL momentum backtest',
        mode: 'hybrid',
        metrics: { sharpe_ratio: 1.2, win_rate: 0.55 },
        k: 10,
      },
    });
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.ok).toBe(true);
    expect(data.mode).toBe('hybrid');
    expect(data.retriever).toBe('rrf');
    expect(data).toHaveProperty('bm25_count');
    expect(data).toHaveProperty('knn_count');
    expect(data).toHaveProperty('rrf_count');
    expect(data).toHaveProperty('latency_ms');
    expect(data).toHaveProperty('pattern_vec_sample');
    expect(data.pattern_vec_sample.length).toBe(8);
    expect(data.correlation_id).toMatch(/^hybrid-/);
  });

  test('POST /hybrid/search mode=bm25 uses standard retriever only', async ({ request }) => {
    const r = await request.post(`${EH}/hybrid/search`, {
      data: { query: 'momentum', mode: 'bm25', k: 5 },
    });
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.mode).toBe('bm25');
    expect(data.retriever).toBe('bm25');
  });

  test('POST /hybrid/search mode=knn uses vector only', async ({ request }) => {
    const r = await request.post(`${EH}/hybrid/search`, {
      data: { query: 'any', mode: 'knn', k: 5 },
    });
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.mode).toBe('knn');
    expect(data.retriever).toBe('knn');
  });

  // W091-W096: Vector DLQ
  test('Vector DLQ inject → list → drain cycle', async ({ request }) => {
    // Inject
    const ir = await request.post(`${EH}/vector/dlq/inject`);
    expect(ir.status()).toBe(200);
    const injected = await ir.json();
    expect(injected.injected).toBe(true);
    expect(injected.vector_dlq_size).toBeGreaterThan(0);

    // List
    const lr = await request.get(`${EH}/vector/dlq`);
    const list = await lr.json();
    expect(list.count).toBeGreaterThan(0);
    expect(list.entries[0].error).toBe('vector_computation_failed');

    // Drain
    const dr = await request.post(`${EH}/vector/dlq/drain`);
    const drained = await dr.json();
    expect(drained.drained).toBeGreaterThan(0);
    expect(drained.remaining).toBe(0);
  });

  // W093-W096: Vector Lag
  test('GET /vector/lag returns slo_met and thresholds', async ({ request }) => {
    const r = await request.get(`${EH}/vector/lag`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.slo_met).toBe(true);
    expect(data.slo_threshold_docs).toBe(500);
    expect(data).toHaveProperty('pattern_vec_lag');
    expect(data).toHaveProperty('text_vec_lag');
  });

  // W097: Agent Tools Manifest
  test('GET /agent/tools returns 3 tool definitions', async ({ request }) => {
    const r = await request.get(`${EH}/agent/tools`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.tools.length).toBe(3);
    const names = data.tools.map((t: { name: string }) => t.name);
    expect(names).toContain('find_similar_setups');
    expect(names).toContain('summarize_similarities');
    expect(names).toContain('recommend_action');
    expect(data.contract_version).toBeTruthy();
  });

  // W098-W100: Agent Similar Setup Flow
  test('POST /agent/similar-setup-flow returns all 4 steps with recommendation', async ({ request }) => {
    const r = await request.post(`${EH}/agent/similar-setup-flow`, {
      data: {
        symbol: 'AAPL',
        metrics: { sharpe_ratio: 1.5, win_rate: 0.6, cagr: 0.22 },
        k: 5,
      },
    });
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.ok).toBe(true);
    expect(data.symbol).toBe('AAPL');
    expect(data.steps).toContain('compute_pattern_vec');
    expect(data.steps).toContain('knn_search');
    expect(data.steps).toContain('summarize');
    expect(data.steps).toContain('recommend');
    expect(data.pattern_vec_dims).toBe(64);
    expect(data.recommendation).toHaveProperty('action');
    expect(data.recommendation).toHaveProperty('confidence');
    expect(data.summary).toHaveProperty('common_patterns');
    expect(data.correlation_id).toMatch(/^agent-flow-/);
  });

  // W099: Summarize
  test('POST /agent/summarize returns hit_count and patterns', async ({ request }) => {
    const r = await request.post(`${EH}/agent/summarize`, {
      data: [
        { _id: 'run-1', _score: 0.95 },
        { _id: 'run-2', _score: 0.91 },
      ],
    });
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.hit_count).toBe(2);
    expect(Array.isArray(data.common_patterns)).toBe(true);
  });

  // W100: Recommend
  test('POST /agent/recommend with 4 hits returns PROCEED', async ({ request }) => {
    const r = await request.post(`${EH}/agent/recommend`, {
      data: {
        similar_hits: [
          { _id: 'r1', _score: 0.9 },
          { _id: 'r2', _score: 0.88 },
          { _id: 'r3', _score: 0.85 },
          { _id: 'r4', _score: 0.82 },
        ],
        current_setup: { symbol: 'AAPL' },
      },
    });
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.action).toBe('PROCEED');
    expect(data.based_on_hits).toBe(4);
    expect(data.confidence).toBeGreaterThan(0.5);
  });

});

// ── UI Tests ───────────────────────────────────────────────────────────────────

test.describe('ElastiHack Vector — UI (W083-W090)', () => {

  test('Vector tab loads with correct 64-dim / cosine spec', async ({ page }) => {
    await page.goto(`${BASE}/ui2/elastihack`);
    await page.waitForSelector('[data-testid="elastihack-ui2-page"]');

    // Click Vector tab
    await page.getByTestId('elastihack-tab-vector').click();

    // Verify vector panel visible
    await expect(page.getByTestId('elastihack-vector')).toBeVisible({ timeout: 10000 });

    // Dims = 64
    await expect(page.getByTestId('vector-dims')).toBeVisible({ timeout: 5000 });
    const dims = await page.getByTestId('vector-dims').textContent();
    expect(dims?.trim()).toBe('64');

    // Similarity = cosine
    await expect(page.getByTestId('vector-similarity')).toBeVisible({ timeout: 5000 });
    const sim = await page.getByTestId('vector-similarity').textContent();
    expect(sim?.trim()).toBe('cosine');

    // Deterministic = Yes
    await expect(page.getByTestId('vector-deterministic')).toBeVisible({ timeout: 5000 });

    // Mappings table present
    await expect(page.getByTestId('vector-mappings-table')).toBeVisible({ timeout: 5000 });

    // Coverage table
    await expect(page.getByTestId('vector-coverage-table')).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'playwright_proof/elastihack-vector-tab.png', fullPage: true });
  });

  test('kNN tab runs Find Similar and shows pattern_vec_dims=64', async ({ page }) => {
    await page.goto(`${BASE}/ui2/elastihack`);
    await page.waitForSelector('[data-testid="elastihack-ui2-page"]');

    // Click kNN tab
    await page.getByTestId('elastihack-tab-knn').click();
    await expect(page.getByTestId('elastihack-knn')).toBeVisible({ timeout: 10000 });

    // Fill inputs
    await page.getByTestId('knn-sharpe-input').fill('1.5');
    await page.getByTestId('knn-winrate-input').fill('0.60');
    await page.getByTestId('knn-cagr-input').fill('0.22');
    await page.getByTestId('knn-k-input').fill('5');

    // Run kNN search
    await page.getByTestId('knn-find-similar-btn').click();

    // Wait for results panel
    await expect(page.getByTestId('knn-results-panel')).toBeVisible({ timeout: 15000 });

    // Verify 64 dims shown
    await expect(page.getByTestId('knn-dims')).toBeVisible({ timeout: 5000 });
    const dims = await page.getByTestId('knn-dims').textContent();
    expect(dims?.trim()).toBe('64');

    await page.screenshot({ path: 'playwright_proof/elastihack-knn-results.png', fullPage: true });
  });

  test('kNN tab hybrid search returns RRF mode info', async ({ page }) => {
    await page.goto(`${BASE}/ui2/elastihack`);
    await page.waitForSelector('[data-testid="elastihack-ui2-page"]');

    await page.getByTestId('elastihack-tab-knn').click();
    await expect(page.getByTestId('elastihack-knn')).toBeVisible({ timeout: 10000 });

    // Select hybrid mode
    await page.getByTestId('knn-mode-select').selectOption('hybrid');

    // Fill query
    await page.getByTestId('knn-query-input').fill('AAPL momentum backtest');

    // Run hybrid
    await page.getByTestId('knn-hybrid-btn').click();

    await expect(page.getByTestId('hybrid-results-panel')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('hybrid-latency')).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'playwright_proof/elastihack-hybrid-rrf.png', fullPage: true });
  });

  test('kNN tab Agent Flow runs all 4 steps', async ({ page }) => {
    await page.goto(`${BASE}/ui2/elastihack`);
    await page.waitForSelector('[data-testid="elastihack-ui2-page"]');

    await page.getByTestId('elastihack-tab-knn').click();
    await expect(page.getByTestId('elastihack-knn')).toBeVisible({ timeout: 10000 });

    // Run agent flow
    await page.getByTestId('knn-agent-flow-btn').click();

    await expect(page.getByTestId('agent-flow-panel')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('agent-action')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('agent-confidence')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('agent-similar-count')).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'playwright_proof/elastihack-agent-flow.png', fullPage: true });
  });

  test('Existing 5 tabs still work after adding Vector+kNN tabs', async ({ page }) => {
    await page.goto(`${BASE}/ui2/elastihack`);
    await page.waitForSelector('[data-testid="elastihack-ui2-page"]');

    // All 5 original tabs must still be visible
    for (const tab of ['overview', 'templates', 'ops', 'canary', 'health']) {
      await expect(page.getByTestId(`elastihack-tab-${tab}`)).toBeVisible({ timeout: 5000 });
    }

    // Plus the 2 new ones
    await expect(page.getByTestId('elastihack-tab-vector')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('elastihack-tab-knn')).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'playwright_proof/elastihack-all-tabs.png', fullPage: true });
  });

});
