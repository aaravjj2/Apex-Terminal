/**
 * ui2-wave9.spec.ts — Wave 9: Microstructure Metrics, Liquidity Heatmap
 * Plus Kill-Switch, System Health, Market Hours
 * Minimum 15 tests — all selectors via data-testid
 */
import { test, expect } from '@playwright/test';

const BASE = '/ui2/';

test.describe('Wave 9 — Microstructure Metrics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}microstructure`);
    await page.getByTestId('microstructure-page').waitFor({ state: 'visible' });
  });

  test('microstructure page renders', async ({ page }) => {
    await expect(page.getByTestId('microstructure-page')).toBeVisible();
  });

  test('metrics grid is visible', async ({ page }) => {
    await expect(page.getByTestId('ms-grid')).toBeVisible();
  });

  test('at least 6 metric rows', async ({ page }) => {
    const rows = page.locator('[data-testid^="ms-row-"]');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test('AAPL row is present', async ({ page }) => {
    const syms = page.locator('[data-testid^="ms-symbol-"]');
    const texts = await syms.allTextContents();
    expect(texts).toContain('AAPL');
  });

  test('spread label shows numeric bps', async ({ page }) => {
    const txt = await page.getByTestId('ms-spread-0').textContent();
    expect(Number(txt)).toBeGreaterThan(0);
  });

  test('imbalance label shows ± value', async ({ page }) => {
    await expect(page.getByTestId('ms-imbalance-0')).toBeVisible();
  });

  test('hash is displayed', async ({ page }) => {
    await expect(page.getByTestId('ms-hash')).toBeVisible();
  });
});

test.describe('Wave 9 — Liquidity Heatmap', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}liquidity`);
    await page.getByTestId('liquidity-page').waitFor({ state: 'visible' });
  });

  test('liquidity page renders', async ({ page }) => {
    await expect(page.getByTestId('liquidity-page')).toBeVisible();
  });

  test('heatmap table is displayed', async ({ page }) => {
    await expect(page.getByTestId('lq-heatmap')).toBeVisible();
  });

  test('at least 6 symbol rows in heatmap', async ({ page }) => {
    const rows = page.locator('[data-testid^="lq-row-"]');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test('AAPL symbol appears in heatmap', async ({ page }) => {
    const syms = page.locator('[data-testid^="lq-sym-"]');
    const texts = await syms.allTextContents();
    expect(texts).toContain('AAPL');
  });

  test('first cell (0,0) shows a numeric score', async ({ page }) => {
    const txt = await page.getByTestId('lq-cell-0-0').textContent();
    expect(Number(txt)).toBeGreaterThan(0);
  });

  test('cell scores are in 0-100 range', async ({ page }) => {
    const cells = page.locator('[data-testid^="lq-cell-0-"]');
    const count = await cells.count();
    for (let i = 0; i < count; i++) {
      const txt = await cells.nth(i).textContent();
      const n = Number(txt);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(100);
    }
  });

  test('hash is displayed', async ({ page }) => {
    await expect(page.getByTestId('lq-hash')).toBeVisible();
  });
});

test.describe('Wave 9 — Kill Switch + System Health + Market Hours', () => {
  test('kill switch recovery page renders', async ({ page }) => {
    await page.goto(`${BASE}kill-switch-recovery`);
    await page.getByTestId('kill-switch-recovery-ui2-page').waitFor({ state: 'visible' });
    await expect(page.getByTestId('kill-switch-recovery-ui2-page')).toBeVisible();
  });

  test('system health page renders', async ({ page }) => {
    await page.goto(`${BASE}system-health`);
    await page.getByTestId('system-health-ui2-page').waitFor({ state: 'visible' });
    await expect(page.getByTestId('system-health-ui2-page')).toBeVisible();
  });

  test('market hours page renders', async ({ page }) => {
    await page.goto(`${BASE}market-hours`);
    await page.getByTestId('market-hours-ui2-page').waitFor({ state: 'visible' });
    await expect(page.getByTestId('market-hours-ui2-page')).toBeVisible();
  });
});
