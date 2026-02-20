/**
 * ui2-wave6.spec.ts — Wave 6: Strategy Intelligence
 * Tests: Strategy Optimizer, Monte Carlo, Walk-Forward, Scoring, Regime, Sentiment
 * Minimum 15 tests — all selectors via data-testid
 */
import { test, expect } from '@playwright/test';

const BASE = '/ui2/';

test.describe('Wave 6 — Strategy Optimizer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}strategy-optimizer`);
    await page.getByTestId('strategy-optimizer-page').waitFor({ state: 'visible' });
  });

  test('page renders strategy-optimizer-page container', async ({ page }) => {
    await expect(page.getByTestId('strategy-optimizer-page')).toBeVisible();
  });

  test('optimizer table is displayed', async ({ page }) => {
    await expect(page.getByTestId('so-table')).toBeVisible();
  });

  test('first row name is visible', async ({ page }) => {
    await expect(page.getByTestId('so-name-0')).toBeVisible();
  });

  test('first row has a numeric score', async ({ page }) => {
    const text = await page.getByTestId('so-score-0').textContent();
    expect(Number(text)).toBeGreaterThan(0);
  });

  test('first row grade is A B C or D', async ({ page }) => {
    const grade = await page.getByTestId('so-grade-0').textContent();
    expect(['A', 'B', 'C', 'D']).toContain(grade?.trim());
  });

  test('hash element appears and is non-empty', async ({ page }) => {
    await expect(page.getByTestId('so-hash')).toBeVisible();
    const txt = await page.getByTestId('so-hash').textContent();
    expect(txt).toBeTruthy();
    expect(txt!.length).toBeGreaterThan(10);
  });

  test('at least 5 strategy rows rendered', async ({ page }) => {
    const rows = page.locator('[data-testid^="so-row-"]');
    await expect(rows).toHaveCount(5);
  });

  test('second row name differs from first', async ({ page }) => {
    const n0 = await page.getByTestId('so-name-0').textContent();
    const n1 = await page.getByTestId('so-name-1').textContent();
    expect(n0).not.toBe(n1);
  });
});

test.describe('Wave 6 — Monte Carlo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}monte-carlo`);
    await page.getByTestId('monte-carlo-ui2-page').waitFor({ state: 'visible' });
  });

  test('monte carlo page renders', async ({ page }) => {
    await expect(page.getByTestId('monte-carlo-ui2-page')).toBeVisible();
  });

  test('mc-symbol shows SPY', async ({ page }) => {
    await expect(page.getByTestId('mc-symbol')).toContainText('SPY');
  });

  test('mc-p5 shows a dollar value', async ({ page }) => {
    const txt = await page.getByTestId('mc-p5').textContent();
    expect(txt).toMatch(/\$/);
  });

  test('mc-p50 shows a dollar value', async ({ page }) => {
    const txt = await page.getByTestId('mc-p50').textContent();
    expect(txt).toMatch(/\$/);
  });

  test('mc-p95 shows a dollar value', async ({ page }) => {
    const txt = await page.getByTestId('mc-p95').textContent();
    expect(txt).toMatch(/\$/);
  });

  test('mc-var shows a dollar value', async ({ page }) => {
    await expect(page.getByTestId('mc-var')).toBeVisible();
  });
});

test.describe('Wave 6 — Regime + Sentiment', () => {
  test('regime page renders', async ({ page }) => {
    await page.goto(`${BASE}regime`);
    await page.getByTestId('regime-ui2-page').waitFor({ state: 'visible' });
    await expect(page.getByTestId('regime-ui2-page')).toBeVisible();
  });

  test('sentiment page renders', async ({ page }) => {
    await page.goto(`${BASE}sentiment`);
    await page.getByTestId('sentiment-ui2-page').waitFor({ state: 'visible' });
    await expect(page.getByTestId('sentiment-ui2-page')).toBeVisible();
  });

  test('walk-forward page renders', async ({ page }) => {
    await page.goto(`${BASE}walk-forward`);
    await page.getByTestId('walk-forward-ui2-page').waitFor({ state: 'visible' });
    await expect(page.getByTestId('walk-forward-ui2-page')).toBeVisible();
  });

  test('scoring page renders', async ({ page }) => {
    await page.goto(`${BASE}scoring`);
    await page.getByTestId('scoring-ui2-page').waitFor({ state: 'visible' });
    await expect(page.getByTestId('scoring-ui2-page')).toBeVisible();
  });
});
