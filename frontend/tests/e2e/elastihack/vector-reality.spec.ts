/**
 * ElastiHack Vector Reality Spec — Phase 4
 *
 * Verifies that the LIVE Elasticsearch cluster actually has dense_vector
 * mappings in real indices. These tests fail if the cluster was never patched.
 *
 * All assertions require real cluster state — no mocking.
 *
 * Endpoints tested:
 *   GET  /vector/verify-es-mapping     → pass=true, dims=64
 *   GET  /vector/mappings/live         → indices_with_vector ≥ 1
 *   GET  /vector/coverage/live         → source=real_es
 *   POST /vector/backfill              → ok=true, index=apex-backtests
 *   UI:  Vector tab "Verify ES mapping" button → PASS banner
 */
import { test, expect } from '@playwright/test';

const BASE        = 'http://localhost:5100';
const API_BASE    = 'http://localhost:8000';
const EH          = `${API_BASE}/api/v4/elastihack`;
// ES direct access via backend proxy (ES may be IPv6-only, not reachable from Playwright)

// ── 1. ES mapping verification — via backend /vector/mappings/live proxy ──────

test.describe('ES Cluster — Mapping Verification (via backend)', () => {
  test('apex-backtests has dense_vector pattern_vec (dims=64, cosine)', async ({ request }) => {
    const r = await request.get(`${EH}/vector/mappings/live`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.ok).toBe(true);

    const bt = data.results?.find((x: any) => x.index === 'apex-backtests');
    expect(bt).toBeDefined();
    expect(bt.has_vector).toBe(true);
    expect(bt.vector_fields?.pattern_vec?.dims).toBe(64);
    expect(bt.vector_fields?.pattern_vec?.similarity).toBe('cosine');
    expect(bt.vector_fields?.pattern_vec?.index).toBe(true);
  });

  test('apex-workflows has dense_vector pattern_vec', async ({ request }) => {
    const r = await request.get(`${EH}/vector/mappings/live`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    const wf = data.results?.find((x: any) => x.index === 'apex-workflows');
    expect(wf).toBeDefined();
    expect(wf.has_vector).toBe(true);
    expect(wf.vector_fields?.pattern_vec?.dims).toBe(64);
  });

  test('apex-strategies has dense_vector pattern_vec', async ({ request }) => {
    const r = await request.get(`${EH}/vector/mappings/live`);
    const data = await r.json();
    const st = data.results?.find((x: any) => x.index === 'apex-strategies');
    expect(st).toBeDefined();
    expect(st.has_vector).toBe(true);
  });

  test('apex-autopilot has dense_vector pattern_vec', async ({ request }) => {
    const r = await request.get(`${EH}/vector/mappings/live`);
    const data = await r.json();
    const ap = data.results?.find((x: any) => x.index === 'apex-autopilot');
    expect(ap).toBeDefined();
    expect(ap.has_vector).toBe(true);
  });

  test('apex-backtests-vec-* has dense_vector', async ({ request }) => {
    const r = await request.get(`${EH}/vector/mappings/live`);
    const data = await r.json();
    const vecIndices = data.results?.filter((x: any) => x.index.startsWith('apex-backtests-vec-') && x.has_vector);
    expect(vecIndices?.length).toBeGreaterThan(0);
  });

  test('AT LEAST 5 indices have pattern_vec dense_vector', async ({ request }) => {
    const r = await request.get(`${EH}/vector/mappings/live`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.indices_with_vector).toBeGreaterThanOrEqual(5);
  });
});


// ── 2. Backend verify-es-mapping endpoint ────────────────────────────────────

test.describe('API — /vector/verify-es-mapping', () => {
  test('returns pass=true with dims=64', async ({ request }) => {
    const r = await request.get(`${EH}/vector/verify-es-mapping`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.pass).toBe(true);
    expect(data.dims).toBe(64);
    expect(data.similarity).toBe('cosine');
    expect(data.fields_found.length).toBeGreaterThan(0);
    expect(data.indices_with_vector.length).toBeGreaterThan(0);
    expect(data.message).toMatch(/PASS/i);
  });

  test('fields_found entries all have dims=64', async ({ request }) => {
    const r = await request.get(`${EH}/vector/verify-es-mapping`);
    const data = await r.json();
    for (const f of data.fields_found) {
      expect(f.dims).toBe(64);
      expect(f.similarity).toBe('cosine');
      expect(f.index_enabled).toBe(true);
    }
  });
});


// ── 3. Live vector mappings endpoint ─────────────────────────────────────────

test.describe('API — /vector/mappings/live', () => {
  test('returns ok=true with ≥3 indices having vector', async ({ request }) => {
    const r = await request.get(`${EH}/vector/mappings/live`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.ok).toBe(true);
    expect(data.indices_with_vector).toBeGreaterThanOrEqual(3);
  });

  test('results contain apex-backtests with pattern_vec', async ({ request }) => {
    const r = await request.get(`${EH}/vector/mappings/live`);
    const data = await r.json();
    const bt = data.results?.find((x: any) => x.index === 'apex-backtests');
    expect(bt).toBeDefined();
    expect(bt.has_vector).toBe(true);
    expect(bt.vector_fields?.pattern_vec?.dims).toBe(64);
  });
});


// ── 4. Live coverage endpoint ─────────────────────────────────────────────────

test.describe('API — /vector/coverage/live', () => {
  test('returns ok=true with source=real_es', async ({ request }) => {
    const r = await request.get(`${EH}/vector/coverage/live`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.ok).toBe(true);
    expect(data.source).toBe('real_es');
    expect(data.dims).toBe(64);
    expect(data.coverage).toHaveProperty('backtest_run');
    expect(data.coverage).toHaveProperty('autopilot_cycle');
    expect(data.coverage).toHaveProperty('strategies');
  });

  test('backtest_run coverage > 0% (canary doc present)', async ({ request }) => {
    const r = await request.get(`${EH}/vector/coverage/live`);
    const data = await r.json();
    expect(data.coverage.backtest_run.with_pattern_vec).toBeGreaterThan(0);
    expect(data.coverage.backtest_run.coverage_pct).toBeGreaterThan(0);
  });
});


// ── 5. Backfill endpoint ──────────────────────────────────────────────────────

test.describe('API — POST /vector/backfill', () => {
  test('apex-backtests backfill returns ok=true', async ({ request }) => {
    const r = await request.post(`${EH}/vector/backfill?index=apex-backtests&limit=100`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.ok).toBe(true);
    expect(data.index).toBe('apex-backtests');
    expect(data).toHaveProperty('updated');
    expect(data).toHaveProperty('dlq_count');
    expect(data.dlq_count).toBe(0);
  });

  test('apex-workflows backfill returns ok=true', async ({ request }) => {
    const r = await request.post(`${EH}/vector/backfill?index=apex-workflows&limit=100`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.ok).toBe(true);
  });

  test('unknown index returns ok=false gracefully', async ({ request }) => {
    const r = await request.post(`${EH}/vector/backfill?index=apex-does-not-exist-xyz&limit=10`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBeTruthy();
  });
});


// ── 6. UI — Vector tab "Verify ES mapping" button ────────────────────────────

test.describe('UI — ElastiHack Vector Tab verify button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/ui2/elastihack`);
    await page.waitForSelector('[data-testid="elastihack-tabs"]', { timeout: 10000 }).catch(() => {});
  });

  test('Vector tab renders verify button', async ({ page }) => {
    const tab = page.locator('button', { hasText: 'Vector' });
    await tab.click();
    await expect(page.locator('[data-testid="verify-es-mapping-btn"]')).toBeVisible();
  });

  test('clicking Verify ES mapping shows PASS result', async ({ page }) => {
    const tab = page.locator('button', { hasText: 'Vector' });
    await tab.click();
    await page.locator('[data-testid="verify-es-mapping-btn"]').click();

    const result = page.locator('[data-testid="es-mapping-verify-result"]');
    await expect(result).toBeVisible({ timeout: 10000 });
    await expect(result).toContainText('PASS');
  });

  test('verify result shows dims=64 in table', async ({ page }) => {
    const tab = page.locator('button', { hasText: 'Vector' });
    await tab.click();
    await page.locator('[data-testid="verify-es-mapping-btn"]').click();

    const result = page.locator('[data-testid="es-mapping-verify-result"]');
    await expect(result).toBeVisible({ timeout: 10000 });
    await expect(result).toContainText('64');
  });

  test('verify result shows cosine similarity', async ({ page }) => {
    const tab = page.locator('button', { hasText: 'Vector' });
    await tab.click();
    await page.locator('[data-testid="verify-es-mapping-btn"]').click();

    const result = page.locator('[data-testid="es-mapping-verify-result"]');
    await expect(result).toBeVisible({ timeout: 10000 });
    await expect(result).toContainText('cosine');
  });
});
