import { test, expect } from '@playwright/test';

const API = 'http://localhost:8090/api/v3/eval';

test.beforeEach(async ({ request }) => {
  await request.delete(`${API}/runs`);
});

test('page loads with agent-eval-page testid', async ({ page }) => {
  await page.goto('http://localhost:5100/ui2/agent-eval');
  await expect(page.getByTestId('agent-eval-page')).toBeVisible();
});

test('eval dataset table is visible', async ({ page }) => {
  await page.goto('http://localhost:5100/ui2/agent-eval');
  await expect(page.getByTestId('eval-dataset-table')).toBeVisible();
});

test('dataset table shows 6 case rows', async ({ page }) => {
  await page.goto('http://localhost:5100/ui2/agent-eval');
  await expect(page.getByTestId('eval-dataset-table')).toBeVisible();
  for (let i = 1; i <= 6; i++) {
    const id = `eval-00${i}`;
    await expect(page.getByTestId(`eval-case-row-${id}`)).toBeVisible();
  }
});

test('run eval button is visible', async ({ page }) => {
  await page.goto('http://localhost:5100/ui2/agent-eval');
  await expect(page.getByTestId('run-eval-btn')).toBeVisible();
});

test('run eval button click triggers eval and shows run row', async ({ page }) => {
  await page.goto('http://localhost:5100/ui2/agent-eval');
  await page.getByTestId('run-eval-btn').click();
  await expect(page.getByTestId('eval-scores-table')).toBeVisible({ timeout: 30000 });
});

test('scores table shows 6 case score rows after run', async ({ page }) => {
  await page.goto('http://localhost:5100/ui2/agent-eval');
  await page.getByTestId('run-eval-btn').click();
  await expect(page.getByTestId('eval-scores-table')).toBeVisible({ timeout: 30000 });
  for (let i = 1; i <= 6; i++) {
    await expect(page.getByTestId(`score-row-eval-00${i}`)).toBeVisible();
  }
});

test('inspect button opens case detail drawer', async ({ page }) => {
  await page.goto('http://localhost:5100/ui2/agent-eval');
  await page.getByTestId('run-eval-btn').click();
  await expect(page.getByTestId('eval-scores-table')).toBeVisible({ timeout: 30000 });
  await page.getByTestId('inspect-case-btn-eval-001').click();
  await expect(page.getByTestId('case-detail-drawer')).toBeVisible();
});

test('case detail drawer shows agent answer', async ({ page }) => {
  await page.goto('http://localhost:5100/ui2/agent-eval');
  await page.getByTestId('run-eval-btn').click();
  await expect(page.getByTestId('eval-scores-table')).toBeVisible({ timeout: 30000 });
  await page.getByTestId('inspect-case-btn-eval-001').click();
  await expect(page.getByTestId('drawer-answer')).toBeVisible();
});

test('drawer close button dismisses drawer', async ({ page }) => {
  await page.goto('http://localhost:5100/ui2/agent-eval');
  await page.getByTestId('run-eval-btn').click();
  await expect(page.getByTestId('eval-scores-table')).toBeVisible({ timeout: 30000 });
  await page.getByTestId('inspect-case-btn-eval-001').click();
  await expect(page.getByTestId('case-detail-drawer')).toBeVisible();
  await page.getByTestId('drawer-close-btn').click();
  await expect(page.getByTestId('case-detail-drawer')).not.toBeVisible();
});

// API contract tests

test('API GET /dataset returns 6 cases', async ({ request }) => {
  const r = await request.get(`${API}/dataset`);
  expect(r.status()).toBe(200);
  const data = await r.json();
  expect(data.cases).toHaveLength(6);
  expect(data.version).toBe('v1.0');
});

test('API POST /run returns 201 with run_id and scores', async ({ request }) => {
  const r = await request.post(`${API}/run`);
  expect(r.status()).toBe(201);
  const data = await r.json();
  expect(data.run_id).toBeTruthy();
  expect(data.case_count).toBe(6);
  expect(data.scores).toHaveLength(6);
});

test('API scores are deterministic across two runs', async ({ request }) => {
  const r1 = await (await request.post(`${API}/run`)).json();
  const r2 = await (await request.post(`${API}/run`)).json();
  expect(Math.abs(r1.avg_total - r2.avg_total)).toBeLessThan(0.001);
  expect(Math.abs(r1.avg_recall - r2.avg_recall)).toBeLessThan(0.001);
});

test('API GET /runs accumulates and DELETE /runs clears', async ({ request }) => {
  await request.post(`${API}/run`);
  await request.post(`${API}/run`);
  const list = await (await request.get(`${API}/runs`)).json();
  expect(list.runs.length).toBe(2);
  await request.delete(`${API}/runs`);
  const listAfter = await (await request.get(`${API}/runs`)).json();
  expect(listAfter.runs).toHaveLength(0);
});

test('API GET /runs/{id} returns per-case scores', async ({ request }) => {
  const run = await (await request.post(`${API}/run`)).json();
  const byId = await (await request.get(`${API}/runs/${run.run_id}`)).json();
  expect(byId.scores).toHaveLength(6);
  for (const s of byId.scores) {
    expect(s.citation_recall).toBeGreaterThanOrEqual(0);
    expect(s.total_score).toBeLessThanOrEqual(1);
  }
});
