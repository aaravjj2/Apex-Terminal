import { test, expect } from '@playwright/test';

const API = 'http://localhost:8090/api/v3/pages';

// Helper: navigate and wait for page-ready sentinel
async function waitForPageReady(page: import('@playwright/test').Page, url: string) {
  await page.goto(url);
  await expect(page.getByTestId('page-ready')).toBeAttached({ timeout: 10000 });
}

// ── Core page: loading → ready transitions ────────────────────────────────

test('search page loads and shows page-ready sentinel', async ({ page }) => {
  await waitForPageReady(page, 'http://localhost:5100/ui2/search');
  await expect(page.getByTestId('search-ui2-page')).toBeVisible();
});

test('backtest page loads and shows page-ready sentinel', async ({ page }) => {
  await waitForPageReady(page, 'http://localhost:5100/ui2/backtest');
  await expect(page.getByTestId('backtest-ui2-page')).toBeVisible();
});

test('backtest page has submit action button', async ({ page }) => {
  await waitForPageReady(page, 'http://localhost:5100/ui2/backtest');
  await page.getByTestId('backtest-tabs-tab-new-run').click();
  await expect(page.getByTestId('backtest-submit-btn')).toBeVisible();
});

test('strategy optimizer page loads', async ({ page }) => {
  await waitForPageReady(page, 'http://localhost:5100/ui2/strategy-optimizer');
  await expect(page.getByTestId('strategy-optimizer-page')).toBeVisible();
});

test('job queue page loads and shows page-ready sentinel', async ({ page }) => {
  await waitForPageReady(page, 'http://localhost:5100/ui2/job-queue');
  await expect(page.getByTestId('job-queue-page')).toBeVisible();
});

test('job queue page has submit job button', async ({ page }) => {
  await waitForPageReady(page, 'http://localhost:5100/ui2/job-queue');
  await expect(page.getByTestId('submit-job-btn')).toBeVisible();
});

test('agent page loads and shows page-ready sentinel', async ({ page }) => {
  await waitForPageReady(page, 'http://localhost:5100/ui2/agent');
  await expect(page.getByTestId('agent-ui2-page')).toBeVisible();
});

test('agent page has send button key action', async ({ page }) => {
  await waitForPageReady(page, 'http://localhost:5100/ui2/agent');
  await expect(page.getByTestId('agent-send-btn')).toBeVisible();
});

test('ops page loads and shows page-ready sentinel', async ({ page }) => {
  await waitForPageReady(page, 'http://localhost:5100/ui2/ops');
  await expect(page.getByTestId('ops-ui2-page')).toBeVisible();
});

test('auditor page loads with page-shell testid', async ({ page }) => {
  await page.goto('http://localhost:5100/ui2/auditor');
  await expect(page.getByTestId('auditor-ui2-page')).toBeVisible({ timeout: 12000 });
  await expect(page.getByTestId('page-ready')).toBeAttached();
});

test('auditor page shows events table with toolbar', async ({ page }) => {
  await page.goto('http://localhost:5100/ui2/auditor');
  await expect(page.getByTestId('page-ready')).toBeAttached({ timeout: 12000 });
  await expect(page.getByTestId('auditor-events-table')).toBeVisible();
  await expect(page.getByTestId('data-table-toolbar')).toBeVisible();
});

// ── API contract tests ────────────────────────────────────────────────────────

test('API GET /pages returns 7 core pages', async ({ request }) => {
  const r = await request.get(`${API}/pages`);
  expect(r.status()).toBe(200);
  const data = await r.json();
  expect(data.count).toBe(7);
  const ids = data.pages.map((p: { id: string }) => p.id);
  expect(ids).toContain('auditor');
  expect(ids).toContain('agent');
});

test('API GET /components has PageShellUI2 and DataTableUI2', async ({ request }) => {
  const r = await request.get(`${API}/components`);
  expect(r.status()).toBe(200);
  const ids = (await r.json()).components.map((c: { id: string }) => c.id);
  expect(ids).toContain('PageShellUI2');
  expect(ids).toContain('DataTableUI2');
});
