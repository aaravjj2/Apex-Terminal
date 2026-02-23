import { test, expect } from '@playwright/test';

const API = 'http://localhost:8090/api/v3/backtest-contract';
const UI = 'http://localhost:5100/ui2/backtest-contract';
const GOLDEN_IDS = ['GOLDEN_MA_CROSS_001', 'GOLDEN_MR_001', 'GOLDEN_HOLD_001'];

test.beforeEach(async ({ request }) => {
  await request.delete(`${API}/runs`);
});

// ─── UI tests ────────────────────────────────────────────────────────────────

test('page loads and shows backtest-contract-page testid', async ({ page }) => {
  await page.goto(UI);
  await expect(page.getByTestId('backtest-contract-page')).toBeVisible();
});

test('invariants panel is visible with 3 invariants', async ({ page }) => {
  await page.goto(UI);
  await expect(page.getByTestId('invariants-panel')).toBeVisible();
  for (const id of ['no_lookahead', 'equity_balance', 'fill_rules']) {
    await expect(page.getByTestId(`invariant-row-${id}`)).toBeVisible();
  }
});

test('golden-runs-list shows 3 golden run rows', async ({ page }) => {
  await page.goto(UI);
  await expect(page.getByTestId('golden-runs-list')).toBeVisible();
  for (const id of GOLDEN_IDS) {
    await expect(page.getByTestId(`golden-run-row-${id}`)).toBeVisible();
  }
});

test('execute golden run shows validation-result-panel', async ({ page }) => {
  await page.goto(UI);
  await page.getByTestId('execute-golden-btn-GOLDEN_MA_CROSS_001').click();
  await expect(page.getByTestId('validation-result-panel')).toBeVisible({ timeout: 15000 });
});

test('validation-status-badge shows PASSED after golden execute', async ({ page }) => {
  await page.goto(UI);
  await page.getByTestId('execute-golden-btn-GOLDEN_HOLD_001').click();
  const badge = page.getByTestId('validation-status-badge');
  await expect(badge).toBeVisible({ timeout: 15000 });
  await expect(badge).toContainText('PASSED');
});

test('invariant-status-badge shows INVARIANTS OK', async ({ page }) => {
  await page.goto(UI);
  await page.getByTestId('execute-golden-btn-GOLDEN_MR_001').click();
  await expect(page.getByTestId('invariant-status-badge')).toContainText('INVARIANTS OK', { timeout: 15000 });
});

test('runs table appears after execution', async ({ page }) => {
  await page.goto(UI);
  await page.getByTestId('execute-golden-btn-GOLDEN_MA_CROSS_001').click();
  await expect(page.getByTestId('validation-result-panel')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('runs-table')).toBeVisible();
});

// ─── API tests ────────────────────────────────────────────────────────────────

test('GET /golden-runs returns 3 items', async ({ request }) => {
  const r = await request.get(`${API}/golden-runs`);
  expect(r.status()).toBe(200);
  const data = await r.json();
  expect(data.count).toBe(3);
  expect(data.golden_runs).toHaveLength(3);
});

test('GET /golden-runs each has required fields', async ({ request }) => {
  const r = await request.get(`${API}/golden-runs`);
  const { golden_runs } = await r.json();
  for (const g of golden_runs) {
    expect(g).toHaveProperty('id');
    expect(g).toHaveProperty('name');
    expect(g).toHaveProperty('strategy_type');
    expect(g).toHaveProperty('expected_trade_count');
  }
});

test('GET /golden-runs/:id returns 200 for each golden run', async ({ request }) => {
  for (const id of GOLDEN_IDS) {
    const r = await request.get(`${API}/golden-runs/${id}`);
    expect(r.status()).toBe(200);
    expect((await r.json()).id).toBe(id);
  }
});

test('GET /golden-runs/BAD_ID returns 404', async ({ request }) => {
  const r = await request.get(`${API}/golden-runs/BAD_ID`);
  expect(r.status()).toBe(404);
});

test('POST /golden-runs/:id/execute returns 201 and passes', async ({ request }) => {
  for (const id of GOLDEN_IDS) {
    const r = await request.post(`${API}/golden-runs/${id}/execute`);
    expect(r.status()).toBe(201);
    const data = await r.json();
    expect(data.all_pass).toBe(true);
    expect(data.status).toBe('passed');
  }
});

test('GET /invariants returns 3 enforced invariants', async ({ request }) => {
  const r = await request.get(`${API}/invariants`);
  expect(r.status()).toBe(200);
  const data = await r.json();
  expect(data.count).toBe(3);
  const ids = data.invariants.map((i: any) => i.id);
  expect(ids).toContain('no_lookahead');
  expect(ids).toContain('equity_balance');
  expect(ids).toContain('fill_rules');
});

test('POST /validate rejects missing fields', async ({ request }) => {
  const r = await request.post(`${API}/validate`, { data: {} });
  expect(r.status()).toBe(200);
  const data = await r.json();
  expect(data.valid).toBe(false);
  expect(data.errors.length).toBeGreaterThan(0);
});
