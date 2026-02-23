/**
 * W101 — Convergence Cockpit v1 Playwright tests (14)
 * UI: 3-pane layout, scenario run, create ticket
 * API: scenarios, run, tickets
 */
import { test, expect } from '@playwright/test';

const API = 'http://localhost:8090/api/v3/cockpit';

test.beforeEach(async ({ request }) => {
  await request.delete(`${API}/data`);
});

// ─── UI tests ──────────────────────────────────────────────────────────────

test('page loads with convergence-cockpit-page testid', async ({ page }) => {
  await page.goto('http://localhost:5100/ui2/convergence');
  await expect(page.getByTestId('convergence-cockpit-page')).toBeVisible();
});

test('scenario-select and run-scenario-btn are visible', async ({ page }) => {
  await page.goto('http://localhost:5100/ui2/convergence');
  await expect(page.getByTestId('scenario-select')).toBeVisible();
  await expect(page.getByTestId('run-scenario-btn')).toBeVisible();
});

test('left-pane, center-pane, right-pane are visible', async ({ page }) => {
  await page.goto('http://localhost:5100/ui2/convergence');
  await expect(page.getByTestId('left-pane')).toBeVisible();
  await expect(page.getByTestId('center-pane')).toBeVisible();
  await expect(page.getByTestId('right-pane')).toBeVisible();
});

test('run scenario populates left-pane search results', async ({ page }) => {
  await page.goto('http://localhost:5100/ui2/convergence');
  await page.getByTestId('run-scenario-btn').click();
  await expect(page.getByTestId('search-results-list')).toBeVisible();
  await expect(page.getByTestId('search-result-0')).toBeVisible();
});

test('run scenario populates center-pane evidence graph', async ({ page }) => {
  await page.goto('http://localhost:5100/ui2/convergence');
  await page.getByTestId('run-scenario-btn').click();
  // wait for search results (guarantees result state is set)
  await expect(page.getByTestId('search-results-list')).toBeVisible();
  // evidence-graph is in center-pane; check via first node
  await expect(page.locator('[data-testid^="evidence-node-"]').first()).toBeVisible();
});

test('run scenario populates right-pane agent trace and citations', async ({ page }) => {
  await page.goto('http://localhost:5100/ui2/convergence');
  await page.getByTestId('run-scenario-btn').click();
  await expect(page.getByTestId('search-results-list')).toBeVisible();
  await expect(page.getByTestId('agent-trace-panel')).toBeVisible();
  await expect(page.getByTestId('citation-list')).toBeVisible();
  await expect(page.getByTestId('citation-0')).toBeVisible();
});

test('create-ticket-btn shows after running scenario', async ({ page }) => {
  await page.goto('http://localhost:5100/ui2/convergence');
  await page.getByTestId('run-scenario-btn').click();
  await expect(page.getByTestId('search-results-list')).toBeVisible();
  await expect(page.getByTestId('create-ticket-btn')).toBeVisible();
});

test('clicking create-ticket-btn shows ticket-title-input', async ({ page }) => {
  await page.goto('http://localhost:5100/ui2/convergence');
  await page.getByTestId('run-scenario-btn').click();
  await expect(page.getByTestId('search-results-list')).toBeVisible();
  await page.getByTestId('create-ticket-btn').click();
  await expect(page.getByTestId('ticket-title-input')).toBeVisible();
});

test('submitting ticket shows it in tickets-list', async ({ page }) => {
  await page.goto('http://localhost:5100/ui2/convergence');
  await page.getByTestId('run-scenario-btn').click();
  await expect(page.getByTestId('search-results-list')).toBeVisible();
  await page.getByTestId('create-ticket-btn').click();
  await page.getByTestId('ticket-title-input').fill('My Playwright Ticket');
  await page.getByTestId('submit-ticket-btn').click();
  await expect(page.getByTestId('tickets-list')).toBeVisible();
});

// ─── API tests ─────────────────────────────────────────────────────────────

test('GET /scenarios returns 4 scenarios', async ({ request }) => {
  const r = await request.get(`${API}/scenarios`);
  expect(r.status()).toBe(200);
  const data = await r.json();
  expect(data.total).toBe(4);
});

test('POST /scenarios/:id/run returns 201 with 3 panes', async ({ request }) => {
  const r = await request.post(`${API}/scenarios/scen-volatility/run`);
  expect(r.status()).toBe(201);
  const body = await r.json();
  expect(body.left_pane).toBeTruthy();
  expect(body.center_pane).toBeTruthy();
  expect(body.right_pane).toBeTruthy();
});

test('POST /tickets creates open ticket', async ({ request }) => {
  const r = await request.post(`${API}/tickets`, {
    data: { title: 'API Ticket', scenario_id: 'scen-risk' },
  });
  expect(r.status()).toBe(201);
  const body = await r.json();
  expect(body.status).toBe('open');
  expect(body.id).toBeTruthy();
});

test('GET /tickets lists tickets', async ({ request }) => {
  await request.post(`${API}/tickets`, { data: { title: 'T1', scenario_id: 'scen-risk' } });
  await request.post(`${API}/tickets`, { data: { title: 'T2', scenario_id: 'scen-convergence' } });
  const r = await request.get(`${API}/tickets`);
  expect((await r.json()).total).toBe(2);
});

test('DELETE /data clears all sessions and tickets', async ({ request }) => {
  await request.post(`${API}/scenarios/scen-agent-health/run`);
  await request.post(`${API}/tickets`, { data: { title: 'ClearMe', scenario_id: 'scen-agent-health' } });
  const r = await request.delete(`${API}/data`);
  expect(r.status()).toBe(200);
  const tickets = await request.get(`${API}/tickets`);
  expect((await tickets.json()).total).toBe(0);
});
