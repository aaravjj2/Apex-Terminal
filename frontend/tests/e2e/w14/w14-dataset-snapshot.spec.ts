/**
 * W14 — Immutable Dataset Snapshot E2E Test Suite
 *
 * Tests all Week 14 deliverables:
 * 1. Backend Dataset Snapshot API (create, list, get, bars, checksum, auth)
 * 2. Dataset Snapshot UI Page (navigation, tabs, form, snapshot cards)
 * 3. Backtest Run with dataset_id Binding (provenance validation)
 * 4. SHA-256 Determinism (same inputs → same hash)
 * 5. Typed Error Responses (BT_CFG_INVALID, BT_DATA_MISSING)
 *
 * Rules:
 * - Selectors: ONLY data-testid (NO getByRole, NO getByText)
 * - No waitForTimeout
 * - workers=1, retries=0
 * - Non-headless (headed) mode
 * - MCP config (playwright.config.mcp.ts)
 */

import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://localhost:5100';
const API = 'http://localhost:8000';
const AUTH = { Authorization: 'Bearer e2e-test-token-w14' };

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Backend Dataset Snapshot API
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('W14 — Dataset Snapshot API', () => {

  test('GET /api/v3/backtest/datasets returns dataset list', async ({ request }) => {
    const res = await request.get(`${API}/api/v3/backtest/datasets`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('datasets');
    expect(body).toHaveProperty('count');
    expect(Array.isArray(body.datasets)).toBe(true);
    expect(body).toHaveProperty('correlation_id');
  });

  test('GET /api/v3/backtest/datasets/snapshot requires auth (401)', async ({ request }) => {
    const res = await request.get(`${API}/api/v3/backtest/datasets/snapshot`);
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.detail).toHaveProperty('error_code', 'AUTH_REQUIRED');
  });

  test('GET /api/v3/backtest/datasets/snapshot with auth returns 200', async ({ request }) => {
    const res = await request.get(`${API}/api/v3/backtest/datasets/snapshot`, {
      headers: AUTH,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('dataset_id');
    expect(body).toHaveProperty('correlation_id');
  });

  test('POST /api/v3/backtest/datasets/snapshot requires auth (401)', async ({ request }) => {
    const res = await request.post(`${API}/api/v3/backtest/datasets/snapshot`, {
      data: { symbol: 'AAPL', start_date: '2020-01-01', end_date: '2023-01-01' },
    });
    expect(res.status()).toBe(401);
  });

  test('POST snapshot with invalid date returns 422', async ({ request }) => {
    const res = await request.post(`${API}/api/v3/backtest/datasets/snapshot`, {
      headers: AUTH,
      data: { symbol: 'AAPL', start_date: 'bad', end_date: '2023-01-01' },
    });
    // Pydantic min_length=8 validation rejects "bad" with 422
    expect(res.status()).toBe(422);
  });

  test('POST snapshot creates real dataset with SHA-256', async ({ request }) => {
    const res = await request.post(`${API}/api/v3/backtest/datasets/snapshot`, {
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      data: {
        symbol: 'AAPL',
        start_date: '2020-01-01',
        end_date: '2023-01-01',
        provider: 'yfinance',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('dataset_id');
    expect(body.dataset_id).toMatch(/^ds-/);
    expect(body).toHaveProperty('sha256');
    expect(body.sha256).toHaveLength(64);
    expect(body).toHaveProperty('row_count');
    expect(body.row_count).toBeGreaterThan(0);
    expect(body).toHaveProperty('symbol', 'AAPL');
    expect(body).toHaveProperty('performance');
    expect(body.performance).toHaveProperty('elapsed_ms');
  });

  test('POST snapshot dedup returns same ID', async ({ request }) => {
    const payload = {
      symbol: 'AAPL',
      start_date: '2020-01-01',
      end_date: '2023-01-01',
      provider: 'yfinance',
    };
    const r1 = await request.post(`${API}/api/v3/backtest/datasets/snapshot`, {
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      data: payload,
    });
    const r2 = await request.post(`${API}/api/v3/backtest/datasets/snapshot`, {
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      data: payload,
    });
    const b1 = await r1.json();
    const b2 = await r2.json();
    expect(b1.dataset_id).toBe(b2.dataset_id);
    expect(b1.sha256).toBe(b2.sha256);
  });

  test('GET /api/v3/backtest/datasets/{id} returns snapshot metadata', async ({ request }) => {
    // First create a snapshot
    const createRes = await request.post(`${API}/api/v3/backtest/datasets/snapshot`, {
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      data: { symbol: 'AAPL', start_date: '2020-01-01', end_date: '2023-01-01' },
    });
    const created = await createRes.json();
    const dsId = created.dataset_id;

    const res = await request.get(`${API}/api/v3/backtest/datasets/${dsId}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.dataset_id).toBe(dsId);
    expect(body.symbol).toBe('AAPL');
    expect(body).toHaveProperty('sha256');
    expect(body).toHaveProperty('row_count');
    expect(body).toHaveProperty('source_manifest');
  });

  test('GET /api/v3/backtest/datasets/{id}/bars returns bar data', async ({ request }) => {
    const createRes = await request.post(`${API}/api/v3/backtest/datasets/snapshot`, {
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      data: { symbol: 'AAPL', start_date: '2020-01-01', end_date: '2023-01-01' },
    });
    const created = await createRes.json();

    const res = await request.get(`${API}/api/v3/backtest/datasets/${created.dataset_id}/bars`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.dataset_id).toBe(created.dataset_id);
    expect(body).toHaveProperty('row_count');
    expect(body.row_count).toBeGreaterThan(0);
    expect(body).toHaveProperty('bars');
    expect(Array.isArray(body.bars)).toBe(true);
    expect(body.bars.length).toBeGreaterThan(0);
    // Verify bar structure
    const bar = body.bars[0];
    expect(bar).toHaveProperty('date');
    expect(bar).toHaveProperty('open');
    expect(bar).toHaveProperty('high');
    expect(bar).toHaveProperty('low');
    expect(bar).toHaveProperty('close');
    expect(bar).toHaveProperty('volume');
  });

  test('GET /api/v3/backtest/datasets/{id}/checksum verifies integrity', async ({ request }) => {
    const createRes = await request.post(`${API}/api/v3/backtest/datasets/snapshot`, {
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      data: { symbol: 'AAPL', start_date: '2020-01-01', end_date: '2023-01-01' },
    });
    const created = await createRes.json();

    const res = await request.get(`${API}/api/v3/backtest/datasets/${created.dataset_id}/checksum`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.integrity).toBe('verified');
    expect(body.stored_sha256).toBe(body.recomputed_sha256);
    expect(body.stored_sha256).toBe(created.sha256);
    expect(body.row_count).toBe(created.row_count);
  });

  test('GET nonexistent dataset returns BT_DATA_MISSING (409)', async ({ request }) => {
    const res = await request.get(`${API}/api/v3/backtest/datasets/ds-nonexistent-xyz`);
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.error_code).toBe('BT_DATA_MISSING');
    expect(body).toHaveProperty('message');
    expect(body).toHaveProperty('correlation_id');
  });

  test('GET nonexistent dataset bars returns BT_DATA_MISSING (409)', async ({ request }) => {
    const res = await request.get(`${API}/api/v3/backtest/datasets/ds-nonexistent-xyz/bars`);
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.error_code).toBe('BT_DATA_MISSING');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Backtest Run with Dataset ID Binding
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('W14 — Backtest with Dataset Binding', () => {

  test('POST /api/backtest/run with dataset_id uses DATASET_SNAPSHOT source', async ({ request }) => {
    // Create snapshot first
    const snapRes = await request.post(`${API}/api/v3/backtest/datasets/snapshot`, {
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      data: { symbol: 'AAPL', start_date: '2020-01-01', end_date: '2023-01-01' },
    });
    const snap = await snapRes.json();

    // Run backtest with dataset_id
    const runRes = await request.post(`${API}/api/backtest/run`, {
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      data: {
        symbol: 'AAPL',
        strategy_id: 'sma-crossover',
        start_date: '2020-01-01',
        end_date: '2023-01-01',
        initial_capital: 100000,
        dataset_id: snap.dataset_id,
      },
    });
    expect(runRes.status()).toBe(200);
    const run = await runRes.json();
    expect(run.status).toBe('completed');
    expect(run.provenance).toHaveProperty('source', 'DATASET_SNAPSHOT');
    expect(run.provenance).toHaveProperty('dataset_id', snap.dataset_id);
    expect(run.provenance).toHaveProperty('checksum');
    expect(run.trades.length).toBeGreaterThan(0);
    expect(run.equity_curve.length).toBeGreaterThan(0);
  });

  test('POST /api/backtest/run with bad dataset_id returns error', async ({ request }) => {
    const runRes = await request.post(`${API}/api/backtest/run`, {
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      data: {
        symbol: 'AAPL',
        strategy_id: 'sma-crossover',
        start_date: '2020-01-01',
        end_date: '2023-01-01',
        initial_capital: 100000,
        dataset_id: 'ds-nonexistent-xyz',
      },
    });
    expect(runRes.status()).toBe(200);
    const run = await runRes.json();
    expect(run.status).toBe('failed');
    expect(run.error).toContain('ds-nonexistent-xyz');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Dataset Snapshot UI — 6-Tab Interface
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('W14 — Dataset Snapshot UI', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/ui2/dataset-snapshots`);
    await page.waitForSelector('[data-testid="w14-dataset-snapshot-page"][data-ready="true"]', {
      state: 'attached',
      timeout: 15000,
    });
  });

  test('page loads with ready marker', async ({ page }) => {
    await expect(page.locator('[data-testid="w14-dataset-snapshot-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="w14-dataset-snapshot-page"]'))
      .toHaveAttribute('data-ready', 'true');
    await expect(page.locator('[data-testid="w14-ready"]')).toBeAttached();
  });

  test('tabs are visible and all 6 switchable', async ({ page }) => {
    // Default tab is dashboard
    await expect(page.locator('[data-testid="w14-tabs"]')).toBeVisible();
    await expect(page.locator('[data-testid="w14-dashboard-tab"]')).toBeVisible();

    // Switch to snapshots
    await page.locator('[data-testid="w14-tabs-tab-snapshots"]').click();
    await expect(page.locator('[data-testid="w14-snapshot-list"]')).toBeVisible();

    // Switch to create
    await page.locator('[data-testid="w14-tabs-tab-create"]').click();
    await expect(page.locator('[data-testid="w14-create-form"]')).toBeVisible();

    // Switch to inspector
    await page.locator('[data-testid="w14-tabs-tab-inspector"]').click();
    await expect(page.locator('[data-testid="w14-inspect-tab"]')).toBeVisible();

    // Switch to integrity
    await page.locator('[data-testid="w14-tabs-tab-integrity"]').click();
    await expect(page.locator('[data-testid="w14-integrity-tab"]')).toBeVisible();

    // Switch to backtest
    await page.locator('[data-testid="w14-tabs-tab-backtest"]').click();
    await expect(page.locator('[data-testid="w14-backtest-tab"]')).toBeVisible();

    // Back to dashboard
    await page.locator('[data-testid="w14-tabs-tab-dashboard"]').click();
    await expect(page.locator('[data-testid="w14-dashboard-tab"]')).toBeVisible();
  });

  test('dashboard shows KPI strip and panels', async ({ page }) => {
    await expect(page.locator('[data-testid="w14-dashboard-kpi"]')).toBeVisible();
    await expect(page.locator('[data-testid="w14-symbol-dist"]')).toBeVisible();
    await expect(page.locator('[data-testid="w14-quick-stats"]')).toBeVisible();
    await expect(page.locator('[data-testid="w14-recent-panel"]')).toBeVisible();
  });

  test('create tab has form inputs', async ({ page }) => {
    await page.locator('[data-testid="w14-tabs-tab-create"]').click();
    await expect(page.locator('[data-testid="w14-create-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="w14-symbol-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="w14-start-date"]')).toBeVisible();
    await expect(page.locator('[data-testid="w14-end-date"]')).toBeVisible();
    await expect(page.locator('[data-testid="w14-provider"]')).toBeVisible();
    await expect(page.locator('[data-testid="w14-create-btn"]')).toBeVisible();
  });

  test('inspector tab has load and verify controls', async ({ page }) => {
    await page.locator('[data-testid="w14-tabs-tab-inspector"]').click();
    await expect(page.locator('[data-testid="w14-inspect-id-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="w14-inspect-load-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="w14-inspect-verify-btn"]')).toBeVisible();
  });

  test('integrity tab has batch verify button and progress', async ({ page }) => {
    await page.locator('[data-testid="w14-tabs-tab-integrity"]').click();
    await expect(page.locator('[data-testid="w14-integrity-tab"]')).toBeVisible();
    await expect(page.locator('[data-testid="w14-batch-verify-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="w14-integrity-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="w14-integrity-header"]')).toBeVisible();
  });

  test('backtest tab has config and dataset panels', async ({ page }) => {
    await page.locator('[data-testid="w14-tabs-tab-backtest"]').click();
    await expect(page.locator('[data-testid="w14-backtest-tab"]')).toBeVisible();
    await expect(page.locator('[data-testid="w14-bt-config"]')).toBeVisible();
    await expect(page.locator('[data-testid="w14-bt-dataset-info"]')).toBeVisible();
    await expect(page.locator('[data-testid="w14-bt-dataset"]')).toBeVisible();
    await expect(page.locator('[data-testid="w14-bt-strategy"]')).toBeVisible();
    await expect(page.locator('[data-testid="w14-bt-run-btn"]')).toBeVisible();
  });

  test('snapshots tab shows filter and table or empty state', async ({ page }) => {
    await page.locator('[data-testid="w14-tabs-tab-snapshots"]').click();
    await expect(page.locator('[data-testid="w14-snapshot-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="w14-snapshot-filter"]')).toBeVisible();
    await expect(page.locator('[data-testid="w14-refresh-btn"]')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. SHA-256 Determinism
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('W14 — SHA-256 Determinism', () => {
  test('same inputs produce identical SHA-256 across 3 calls', async ({ request }) => {
    const payload = {
      symbol: 'AAPL',
      start_date: '2020-01-01',
      end_date: '2023-01-01',
      provider: 'yfinance',
    };
    const hashes: string[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await request.post(`${API}/api/v3/backtest/datasets/snapshot`, {
        headers: { ...AUTH, 'Content-Type': 'application/json' },
        data: payload,
      });
      const body = await res.json();
      hashes.push(body.sha256);
    }
    // All 3 calls must produce identical SHA-256
    expect(hashes[0]).toBe(hashes[1]);
    expect(hashes[1]).toBe(hashes[2]);
    expect(hashes[0]).toHaveLength(64);
  });
});
