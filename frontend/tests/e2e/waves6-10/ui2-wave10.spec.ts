/**
 * ui2-wave10.spec.ts — Wave 10: Policy Signal, Risk Network, Hedge Fund
 * Plus Compliance and Performance from prior waves
 * Minimum 15 tests — all selectors via data-testid
 */
import { test, expect } from '@playwright/test';

const BASE = '/ui2/';

test.describe('Wave 10 — Policy Signal Generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}policy-signal`);
    await page.getByTestId('policy-signal-page').waitFor({ state: 'visible' });
  });

  test('policy signal page renders', async ({ page }) => {
    await expect(page.getByTestId('policy-signal-page')).toBeVisible();
  });

  test('event list is visible', async ({ page }) => {
    await expect(page.getByTestId('ps-event-list')).toBeVisible();
  });

  test('at least 7 policy events', async ({ page }) => {
    const evts = page.locator('[data-testid^="ps-event-"]');
    const count = await evts.count();
    expect(count).toBeGreaterThanOrEqual(7);
  });

  test('first event has a date', async ({ page }) => {
    const txt = await page.getByTestId('ps-date-0').textContent();
    expect(txt).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  test('first event has a source', async ({ page }) => {
    await expect(page.getByTestId('ps-source-0')).toBeVisible();
  });

  test('first event signal is bullish bearish or neutral', async ({ page }) => {
    const txt = await page.getByTestId('ps-signal-0').textContent();
    expect(txt?.toLowerCase()).toMatch(/bullish|bearish|neutral/);
  });

  test('hash is displayed', async ({ page }) => {
    await expect(page.getByTestId('ps-hash')).toBeVisible();
  });
});

test.describe('Wave 10 — Risk Network Graph', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}risk-network`);
    await page.getByTestId('risk-network-page').waitFor({ state: 'visible' });
  });

  test('risk network page renders', async ({ page }) => {
    await expect(page.getByTestId('risk-network-page')).toBeVisible();
  });

  test('node count shows 10', async ({ page }) => {
    const txt = await page.getByTestId('rn-node-count').textContent();
    expect(txt).toContain('10');
  });

  test('edge count shows 12', async ({ page }) => {
    const txt = await page.getByTestId('rn-edge-count').textContent();
    expect(txt).toContain('12');
  });

  test('nodes list is visible', async ({ page }) => {
    await expect(page.getByTestId('rn-nodes-list')).toBeVisible();
  });

  test('at least 10 node entries', async ({ page }) => {
    const nodes = page.locator('[data-testid^="rn-node-"]');
    const count = await nodes.count();
    expect(count).toBeGreaterThanOrEqual(10);
  });

  test('first node label is visible', async ({ page }) => {
    await expect(page.getByTestId('rn-node-label-0')).toBeVisible();
  });

  test('hash is displayed', async ({ page }) => {
    await expect(page.getByTestId('rn-hash')).toBeVisible();
  });
});

test.describe('Wave 10 — Hedge Fund Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}hedge-fund`);
    await page.getByTestId('hedge-fund-page').waitFor({ state: 'visible' });
  });

  test('hedge fund page renders', async ({ page }) => {
    await expect(page.getByTestId('hedge-fund-page')).toBeVisible();
  });

  test('fund name is visible', async ({ page }) => {
    await expect(page.getByTestId('hf-fund-name')).toBeVisible();
  });

  test('YTD return shown', async ({ page }) => {
    const txt = await page.getByTestId('hf-ytd').textContent();
    expect(txt).toMatch(/%/);
  });

  test('NAV per share shown', async ({ page }) => {
    const txt = await page.getByTestId('hf-nav').textContent();
    expect(txt).toMatch(/\$/);
  });

  test('allocation table renders', async ({ page }) => {
    await expect(page.getByTestId('hf-allocation-table')).toBeVisible();
  });

  test('at least 6 allocation rows', async ({ page }) => {
    const rows = page.locator('[data-testid^="hf-row-"]');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test('hash is displayed', async ({ page }) => {
    await expect(page.getByTestId('hf-hash')).toBeVisible();
  });

  test('compliance page renders', async ({ page }) => {
    await page.goto(`${BASE}compliance`);
    await page.getByTestId('compliance-ui2-page').waitFor({ state: 'visible' });
    await expect(page.getByTestId('compliance-ui2-page')).toBeVisible();
  });

  test('performance analytics page renders', async ({ page }) => {
    await page.goto(`${BASE}performance`);
    await page.getByTestId('performance-ui2-page').waitFor({ state: 'visible' });
    await expect(page.getByTestId('performance-ui2-page')).toBeVisible();
  });
});
