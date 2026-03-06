import { test, expect } from '@playwright/test';

const API = 'http://localhost:8000/api/v3/strategy-studio';
const UI = 'http://localhost:5100/ui2/strategy-studio';

test.beforeEach(async ({ request }) => {
  await request.delete(`${API}/strategies`);
});

// ─── UI tests ────────────────────────────────────────────────────────────────

test('page loads with strategy-studio-page testid', async ({ page }) => {
  await page.goto(UI);
  await expect(page.getByTestId('strategy-studio-page')).toBeVisible();
});

test('template gallery shows 3 templates', async ({ page }) => {
  await page.goto(UI);
  await expect(page.getByTestId('template-gallery')).toBeVisible();
  for (const id of ['tpl-sma-cross', 'tpl-rsi-revert', 'tpl-breakout']) {
    await expect(page.getByTestId(`template-row-${id}`)).toBeVisible();
  }
});

test('strategy editor is visible', async ({ page }) => {
  await page.goto(UI);
  await expect(page.getByTestId('strategy-editor')).toBeVisible();
  await expect(page.getByTestId('strategy-name-input')).toBeVisible();
  await expect(page.getByTestId('strategy-type-select')).toBeVisible();
});

test('create valid strategy shows in strategies list', async ({ page }) => {
  await page.goto(UI);
  await page.getByTestId('strategy-name-input').fill('My E2E Strategy');
  await page.getByTestId('strategy-symbols-input').fill('AAPL');
  await page.getByTestId('create-strategy-btn').click();
  await expect(page.getByTestId('strategies-list')).toBeVisible({ timeout: 10000 });
  // After creation, strategy should appear in list
  await page.waitForFunction(() => document.querySelectorAll('[data-testid^="strategy-row-"]').length > 0, { timeout: 10000 });
});

test('lint shows errors for empty name', async ({ page }) => {
  await page.goto(UI);
  await page.getByTestId('strategy-name-input').fill('');
  await page.getByTestId('lint-strategy-btn').click();
  await expect(page.getByTestId('lint-errors-panel')).toBeVisible({ timeout: 5000 });
  // Should show lint errors
  await expect(page.getByTestId('lint-error-0')).toBeVisible({ timeout: 5000 });
});

test('search filters strategy list', async ({ page }) => {
  await page.goto(UI);
  await page.getByTestId('strategy-search-input').fill('nonexistent12345');
  await page.getByTestId('strategy-search-btn').click();
  await expect(page.getByTestId('strategies-empty')).toBeVisible({ timeout: 5000 });
});

// ─── API tests ────────────────────────────────────────────────────────────────

test('GET /templates returns 3 templates', async ({ request }) => {
  const r = await request.get(`${API}/templates`);
  expect(r.status()).toBe(200);
  const data = await r.json();
  expect(data.count).toBe(3);
});

test('POST /lint valid spec returns valid=true', async ({ request }) => {
  const r = await request.post(`${API}/lint`, {
    data: {
      name: 'My Strategy',
      strategy_type: 'ma_cross',
      symbols: ['AAPL'],
      start_date: '2024-01-01',
      end_date: '2024-12-31',
    },
  });
  expect(r.status()).toBe(200);
  expect((await r.json()).valid).toBe(true);
});

test('POST /lint missing name returns valid=false', async ({ request }) => {
  const r = await request.post(`${API}/lint`, {
    data: { name: '', strategy_type: 'ma_cross', symbols: ['AAPL'], start_date: '2024-01-01', end_date: '2024-12-31' },
  });
  const data = await r.json();
  expect(data.valid).toBe(false);
});

test('POST /strategies creates and returns 201', async ({ request }) => {
  const r = await request.post(`${API}/strategies`, {
    data: {
      name: 'API Test Strategy',
      strategy_type: 'ma_cross',
      symbols: ['MSFT'],
      start_date: '2024-01-01',
      end_date: '2024-12-31',
    },
  });
  expect(r.status()).toBe(201);
  const data = await r.json();
  expect(data.id).toBeTruthy();
  expect(data.version).toBe(1);
});

test('GET /strategies lists after create', async ({ request }) => {
  await request.post(`${API}/strategies`, {
    data: { name: 'List Test', strategy_type: 'rsi', symbols: ['AMZN'], start_date: '2024-01-01', end_date: '2024-12-31' },
  });
  const r = await request.get(`${API}/strategies`);
  expect((await r.json()).count).toBeGreaterThanOrEqual(1);
});

test('PATCH /strategies/:id increments version', async ({ request }) => {
  const cr = await request.post(`${API}/strategies`, {
    data: { name: 'Version Test', strategy_type: 'breakout', symbols: ['SPY'], start_date: '2024-01-01', end_date: '2024-12-31' },
  });
  const sid = (await cr.json()).id;
  const ur = await request.patch(`${API}/strategies/${sid}`, { data: { name: 'Version Test v2' } });
  expect((await ur.json()).version).toBe(2);
});

test('DELETE /strategies/:id removes strategy', async ({ request }) => {
  const cr = await request.post(`${API}/strategies`, {
    data: { name: 'Delete Me', strategy_type: 'momentum', symbols: ['TSLA'], start_date: '2024-01-01', end_date: '2024-12-31' },
  });
  const sid = (await cr.json()).id;
  await request.delete(`${API}/strategies/${sid}`);
  const r = await request.get(`${API}/strategies/${sid}`);
  expect(r.status()).toBe(404);
});

test('GET /strategies/:id/history returns version history', async ({ request }) => {
  const cr = await request.post(`${API}/strategies`, {
    data: { name: 'History Strategy', strategy_type: 'rsi', symbols: ['GOOG'], start_date: '2024-01-01', end_date: '2024-12-31' },
  });
  const sid = (await cr.json()).id;
  await request.patch(`${API}/strategies/${sid}`, { data: { name: 'History Strategy v2' } });
  const r = await request.get(`${API}/strategies/${sid}/history`);
  expect(r.status()).toBe(200);
  const data = await r.json();
  expect(data.count).toBeGreaterThanOrEqual(2);
});
