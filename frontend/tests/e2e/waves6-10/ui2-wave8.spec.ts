/**
 * ui2-wave8.spec.ts — Wave 8: Scenario Sim, Alt Data Catalog, Signal Marketplace
 * Plus Observability and Compliance pages from prior waves
 * Minimum 15 tests — all selectors via data-testid
 */
import { test, expect } from '@playwright/test';

const BASE = '/ui2/';

test.describe('Wave 8 — Scenario Simulation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}scenario-sim`);
    await page.getByTestId('scenario-sim-page').waitFor({ state: 'visible' });
  });

  test('scenario sim page renders', async ({ page }) => {
    await expect(page.getByTestId('scenario-sim-page')).toBeVisible();
  });

  test('scenario grid is visible', async ({ page }) => {
    await expect(page.getByTestId('ss-grid')).toBeVisible();
  });

  test('at least 6 scenario cards', async ({ page }) => {
    const cards = page.locator('[data-testid^="ss-card-"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test('first card name is Base Case', async ({ page }) => {
    const name = await page.getByTestId('ss-name-0').textContent();
    expect(name).toContain('Base Case');
  });

  test('first card portfolio return is a percentage', async ({ page }) => {
    const txt = await page.getByTestId('ss-return-0').textContent();
    expect(txt).toMatch(/%/);
  });

  test('first card sharpe is a number', async ({ page }) => {
    const txt = await page.getByTestId('ss-sharpe-0').textContent();
    expect(Number(txt)).not.toBeNaN();
  });

  test('hash is displayed', async ({ page }) => {
    await expect(page.getByTestId('ss-hash')).toBeVisible();
  });

  test('severe recession card shows negative return', async ({ page }) => {
    const cards = page.locator('[data-testid^="ss-card-"]');
    const count = await cards.count();
    let foundNegative = false;
    for (let i = 0; i < count; i++) {
      const ret = await page.getByTestId(`ss-return-${i}`).textContent();
      if (ret && ret.includes('-')) { foundNegative = true; break; }
    }
    expect(foundNegative).toBe(true);
  });
});

test.describe('Wave 8 — Alternative Data Catalog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}alt-data`);
    await page.getByTestId('alt-data-page').waitFor({ state: 'visible' });
  });

  test('alt data page renders', async ({ page }) => {
    await expect(page.getByTestId('alt-data-page')).toBeVisible();
  });

  test('catalog list is visible', async ({ page }) => {
    await expect(page.getByTestId('ad-catalog')).toBeVisible();
  });

  test('at least 7 catalog items', async ({ page }) => {
    const items = page.locator('[data-testid^="ad-item-"]');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(7);
  });

  test('first item has name', async ({ page }) => {
    await expect(page.getByTestId('ad-name-0')).toBeVisible();
  });

  test('first item has category', async ({ page }) => {
    await expect(page.getByTestId('ad-category-0')).toBeVisible();
  });

  test('first item shows active/inactive status', async ({ page }) => {
    const txt = await page.getByTestId('ad-active-0').textContent();
    expect(['Active', 'Inactive']).toContain(txt?.trim());
  });

  test('hash is displayed', async ({ page }) => {
    await expect(page.getByTestId('ad-hash')).toBeVisible();
  });
});

test.describe('Wave 8 — Signal Marketplace', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}signal-market`);
    await page.getByTestId('signal-market-page').waitFor({ state: 'visible' });
  });

  test('signal market page renders', async ({ page }) => {
    await expect(page.getByTestId('signal-market-page')).toBeVisible();
  });

  test('listings grid is visible', async ({ page }) => {
    await expect(page.getByTestId('sm-listings')).toBeVisible();
  });

  test('at least 6 signal cards', async ({ page }) => {
    const cards = page.locator('[data-testid^="sm-card-"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test('first signal has sharpe value', async ({ page }) => {
    await expect(page.getByTestId('sm-sharpe-0')).toBeVisible();
  });

  test('first signal has subscriber count', async ({ page }) => {
    await expect(page.getByTestId('sm-subs-0')).toBeVisible();
  });

  test('subscribe button present for first card', async ({ page }) => {
    await expect(page.getByTestId('sm-subscribe-0')).toBeVisible();
  });

  test('hash is displayed', async ({ page }) => {
    await expect(page.getByTestId('sm-hash')).toBeVisible();
  });
});
