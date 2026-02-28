/**
 * W100 — Job Queue v2 + WS progress
 * 14 Playwright tests: UI interactions + API contract
 */
import { test, expect } from '@playwright/test';

const API = 'http://localhost:8090/api/v3/jobs';

/* clear jobs before each test */
test.beforeEach(async ({ request }) => {
  await request.delete(`${API}/jobs`);
});

// ─── UI tests ──────────────────────────────────────────────────────────────

test('page loads with job-queue-page testid', async ({ page }) => {
  await page.goto('http://localhost:5100/ui2/job-queue');
  await expect(page.getByTestId('job-queue-page')).toBeVisible();
});

test('submit-job-btn is visible', async ({ page }) => {
  await page.goto('http://localhost:5100/ui2/job-queue');
  await expect(page.getByTestId('submit-job-btn')).toBeVisible();
});

test('job-type-select is visible', async ({ page }) => {
  await page.goto('http://localhost:5100/ui2/job-queue');
  await expect(page.getByTestId('job-type-select')).toBeVisible();
});

test('empty state shows when no jobs', async ({ page }) => {
  await page.goto('http://localhost:5100/ui2/job-queue');
  await expect(page.getByTestId('jobs-empty-state')).toBeVisible();
});

test('submit job appears in jobs-table', async ({ page }) => {
  await page.goto('http://localhost:5100/ui2/job-queue');
  await page.getByTestId('job-name-input').fill('Playwright Test Job');
  await page.getByTestId('submit-job-btn').click();
  await expect(page.getByTestId('jobs-table')).toBeVisible();
});

test('submitted job row shows status badge', async ({ page, request }) => {
  const job = await request.post(`${API}/jobs`, {
    data: { name: 'Badge Test', job_type: 'backtest', auto_run: false },
  });
  const { id } = await job.json();
  await page.goto('http://localhost:5100/ui2/job-queue');
  await expect(page.getByTestId(`job-status-badge-${id}`)).toBeVisible();
});

test('cancel button visible for queued job', async ({ page, request }) => {
  const job = await request.post(`${API}/jobs`, {
    data: { name: 'Cancel Test', job_type: 'data_export', auto_run: false },
  });
  const { id } = await job.json();
  await page.goto('http://localhost:5100/ui2/job-queue');
  await expect(page.getByTestId(`cancel-job-btn-${id}`)).toBeVisible();
});

test('clicking job row opens detail drawer', async ({ page, request }) => {
  const job = await request.post(`${API}/jobs`, {
    data: { name: 'Drawer Test', job_type: 'report_gen', auto_run: false },
  });
  const { id } = await job.json();
  await page.goto('http://localhost:5100/ui2/job-queue');
  await page.getByTestId(`job-row-${id}`).click();
  await expect(page.getByTestId('job-detail-drawer')).toBeVisible();
});

test('drawer shows job-drawer-status and job-drawer-progress', async ({ page, request }) => {
  const job = await request.post(`${API}/jobs`, {
    data: { name: 'Status Drawer', job_type: 'model_train', auto_run: false },
  });
  const { id } = await job.json();
  await page.goto('http://localhost:5100/ui2/job-queue');
  await page.getByTestId(`job-row-${id}`).click();
  await expect(page.getByTestId('job-drawer-status')).toBeVisible();
  await expect(page.getByTestId('job-drawer-progress')).toBeVisible();
});

test('drawer close button hides drawer', async ({ page, request }) => {
  const job = await request.post(`${API}/jobs`, {
    data: { name: 'Close Test', job_type: 'backtest', auto_run: false },
  });
  const { id } = await job.json();
  await page.goto('http://localhost:5100/ui2/job-queue');
  await page.getByTestId(`job-row-${id}`).click();
  await expect(page.getByTestId('job-detail-drawer')).toBeVisible();
  await page.getByTestId('job-drawer-close').click();
  await expect(page.getByTestId('job-detail-drawer')).not.toBeVisible();
});

// ─── API tests ─────────────────────────────────────────────────────────────

test('POST /jobs returns 201 with queued status', async ({ request }) => {
  const r = await request.post(`${API}/jobs`, {
    data: { name: 'API Job', job_type: 'backtest', auto_run: false },
  });
  expect(r.status()).toBe(201);
  const body = await r.json();
  expect(body.status).toBe('queued');
  expect(body.id).toBeTruthy();
});

test('GET /jobs lists submitted jobs', async ({ request }) => {
  await request.post(`${API}/jobs`, {
    data: { name: 'List Test A', job_type: 'search_index', auto_run: false },
  });
  await request.post(`${API}/jobs`, {
    data: { name: 'List Test B', job_type: 'data_export', auto_run: false },
  });
  const r = await request.get(`${API}/jobs`);
  expect(r.status()).toBe(200);
  const data = await r.json();
  expect(data.total).toBe(2);
});

test('POST /jobs/:id/cancel returns canceled status', async ({ request }) => {
  const created = await request.post(`${API}/jobs`, {
    data: { name: 'Cancel API', job_type: 'backtest', auto_run: false },
  });
  const { id } = await created.json();
  const r = await request.post(`${API}/jobs/${id}/cancel`);
  expect(r.status()).toBe(200);
  expect((await r.json()).status).toBe('canceled');
});

test('DELETE /jobs clears all jobs', async ({ request }) => {
  await request.post(`${API}/jobs`, {
    data: { name: 'Del1', job_type: 'report_gen', auto_run: false },
  });
  const r = await request.delete(`${API}/jobs`);
  expect(r.status()).toBe(200);
  const list = await request.get(`${API}/jobs`);
  expect((await list.json()).total).toBe(0);
});
