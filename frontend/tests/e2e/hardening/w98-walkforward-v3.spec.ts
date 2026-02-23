import { test, expect } from '@playwright/test';

const API = 'http://localhost:8090/api/v3/walkforward';
const UI = 'http://localhost:5100/ui2/walkforward-v3';

test.beforeEach(async ({ request }) => {
  await request.delete(`${API}/data`);
});

// ─── UI tests ────────────────────────────────────────────────────────────────

test('page loads with walkforward-v3-page testid', async ({ page }) => {
  await page.goto(UI);
  await expect(page.getByTestId('walkforward-v3-page')).toBeVisible();
});

test('controls are visible', async ({ page }) => {
  await page.goto(UI);
  await expect(page.getByTestId('walkforward-controls')).toBeVisible();
  await expect(page.getByTestId('n-folds-input')).toBeVisible();
  await expect(page.getByTestId('purge-bars-input')).toBeVisible();
  await expect(page.getByTestId('run-walkforward-btn')).toBeVisible();
});

test('run walk-forward shows folds-panel', async ({ page }) => {
  await page.goto(UI);
  await page.getByTestId('run-walkforward-btn').click();
  await expect(page.getByTestId('folds-panel')).toBeVisible({ timeout: 15000 });
});

test('folds-table visible after run', async ({ page }) => {
  await page.goto(UI);
  await page.getByTestId('run-walkforward-btn').click();
  await expect(page.getByTestId('folds-table')).toBeVisible({ timeout: 15000 });
});

test('fold rows are visible after run (4 folds)', async ({ page }) => {
  await page.goto(UI);
  await page.getByTestId('run-walkforward-btn').click();
  await expect(page.getByTestId('folds-panel')).toBeVisible({ timeout: 15000 });
  for (let i = 0; i < 4; i++) {
    await expect(page.getByTestId(`fold-row-${i}`)).toBeVisible();
  }
});

test('run robustness shows robustness-panel', async ({ page }) => {
  await page.goto(UI);
  await page.getByTestId('run-robustness-btn').click();
  await expect(page.getByTestId('robustness-panel')).toBeVisible({ timeout: 20000 });
});

test('robustness-table visible after run', async ({ page }) => {
  await page.goto(UI);
  await page.getByTestId('run-robustness-btn').click();
  await expect(page.getByTestId('robustness-table')).toBeVisible({ timeout: 20000 });
});

test('heatmap loads and shows heatmap-panel', async ({ page }) => {
  await page.goto(UI);
  await page.getByTestId('load-heatmap-btn').click();
  await expect(page.getByTestId('heatmap-panel')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('heatmap-table')).toBeVisible();
});

// ─── API tests ────────────────────────────────────────────────────────────────

test('GET /heatmap returns 200 with 3 slippage levels', async ({ request }) => {
  const r = await request.get(`${API}/heatmap`);
  expect(r.status()).toBe(200);
  const data = await r.json();
  expect(data.slippage_levels).toHaveLength(3);
  expect(data.spread_levels).toHaveLength(3);
});

test('POST /run returns 201 with folds', async ({ request }) => {
  const r = await request.post(`${API}/run`, { data: { n_folds: 4, purge_bars: 2 } });
  expect(r.status()).toBe(201);
  const data = await r.json();
  expect(data.folds).toHaveLength(4);
  expect(data.config_id).toBeTruthy();
});

test('POST /run with n_folds=1 returns 400', async ({ request }) => {
  const r = await request.post(`${API}/run`, { data: { n_folds: 1 } });
  expect(r.status()).toBe(400);
});

test('POST /robustness returns 201 with matrix rows', async ({ request }) => {
  const r = await request.post(`${API}/robustness`, { data: {} });
  expect(r.status()).toBe(201);
  const data = await r.json();
  expect(data.count).toBeGreaterThan(0);
  expect(data.matrix.length).toBeGreaterThan(0);
});

test('GET /configs accumulates after run', async ({ request }) => {
  const before = (await (await request.get(`${API}/configs`)).json()).count;
  await request.post(`${API}/run`, { data: { n_folds: 4 } });
  const after = (await (await request.get(`${API}/configs`)).json()).count;
  expect(after).toBeGreaterThan(before);
});

test('DELETE /data clears configs', async ({ request }) => {
  await request.post(`${API}/run`, { data: { n_folds: 4 } });
  await request.delete(`${API}/data`);
  const r = await request.get(`${API}/configs`);
  expect((await r.json()).count).toBe(0);
});
