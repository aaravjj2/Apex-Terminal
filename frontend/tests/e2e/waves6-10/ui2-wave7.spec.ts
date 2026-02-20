/**
 * ui2-wave7.spec.ts — Wave 7: Anomalies, Portfolio Optimizer, Sandbox Runner
 * Minimum 15 tests — all selectors via data-testid
 */
import { test, expect } from '@playwright/test';

const BASE = '/ui2/';

test.describe('Wave 7 — Anomaly Detection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}anomalies`);
    await page.getByTestId('anomalies-page').waitFor({ state: 'visible' });
  });

  test('anomalies page renders', async ({ page }) => {
    await expect(page.getByTestId('anomalies-page')).toBeVisible();
  });

  test('anomaly list is displayed', async ({ page }) => {
    await expect(page.getByTestId('an-list')).toBeVisible();
  });

  test('at least 8 anomaly items rendered', async ({ page }) => {
    const items = page.locator('[data-testid^="an-item-"]');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(8);
  });

  test('first anomaly has visible symbol', async ({ page }) => {
    await expect(page.getByTestId('an-symbol-0')).toBeVisible();
  });

  test('first anomaly severity is one of critical/high/medium/low', async ({ page }) => {
    const sev = await page.getByTestId('an-severity-0').textContent();
    expect(['critical', 'high', 'medium', 'low']).toContain(sev?.toLowerCase().trim());
  });

  test('first anomaly z-score is present', async ({ page }) => {
    const txt = await page.getByTestId('an-zscore-0').textContent();
    expect(txt).toMatch(/z=/);
  });

  test('hash is displayed', async ({ page }) => {
    await expect(page.getByTestId('an-hash')).toBeVisible();
  });
});

test.describe('Wave 7 — Portfolio Optimizer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}portfolio-optimizer`);
    await page.getByTestId('portfolio-optimizer-page').waitFor({ state: 'visible' });
  });

  test('portfolio optimizer page renders', async ({ page }) => {
    await expect(page.getByTestId('portfolio-optimizer-page')).toBeVisible();
  });

  test('allocation table is present', async ({ page }) => {
    await expect(page.getByTestId('po-allocation-table')).toBeVisible();
  });

  test('at least 6 allocation rows', async ({ page }) => {
    const rows = page.locator('[data-testid^="po-alloc-"]');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test('SPY appears in allocations', async ({ page }) => {
    const syms = page.locator('[data-testid^="po-sym-"]');
    const texts = await syms.allTextContents();
    expect(texts).toContain('SPY');
  });

  test('portfolio sharpe summary block is visible', async ({ page }) => {
    await expect(page.getByTestId('po-sharpe')).toBeVisible();
  });

  test('sharpe value is a positive number', async ({ page }) => {
    const txt = await page.getByTestId('po-sharpe').textContent();
    const num = parseFloat(txt ?? '0');
    expect(num).toBeGreaterThan(0);
  });

  test('portfolio hash is displayed', async ({ page }) => {
    await expect(page.getByTestId('po-hash')).toBeVisible();
  });
});

test.describe('Wave 7 — Sandbox Runner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}sandbox-runner`);
    await page.getByTestId('sandbox-runner-page').waitFor({ state: 'visible' });
  });

  test('sandbox runner page renders', async ({ page }) => {
    await expect(page.getByTestId('sandbox-runner-page')).toBeVisible();
  });

  test('run agent button is visible', async ({ page }) => {
    await expect(page.getByTestId('sandbox-run-btn')).toBeVisible();
  });

  test('event log shows events', async ({ page }) => {
    await expect(page.getByTestId('sr-event-log')).toBeVisible();
    const events = page.locator('[data-testid^="sr-event-"]');
    const count = await events.count();
    expect(count).toBeGreaterThanOrEqual(8);
  });

  test('first event has sequence number', async ({ page }) => {
    await expect(page.getByTestId('sr-seq-0')).toBeVisible();
  });

  test('first event agent_id is arb_v1', async ({ page }) => {
    const txt = await page.getByTestId('sr-agent-0').textContent();
    expect(txt).toContain('arb_v1');
  });

  test('runner hash is shown', async ({ page }) => {
    await expect(page.getByTestId('sr-hash')).toBeVisible();
  });
});
