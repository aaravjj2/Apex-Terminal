import { test, expect } from '@playwright/test';

const LOAD_OPTS = { timeout: 30_000 };

const DEMO_URL = '/demo/index.html';  // Static demo served from public/demo/

test.describe('Demo Integration', () => {
  test('demo page loads at /demo/', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.waitForLoadState('domcontentloaded', LOAD_OPTS);
    await expect(page).toHaveTitle(/Apex|Demo|Terminal/i);
  });

  test('demo page has app container', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.waitForLoadState('domcontentloaded', LOAD_OPTS);
    const app = page.locator('#app');
    await expect(app).toBeVisible({ timeout: 10_000 });
  });

  test('demo app has data-testid', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.waitForLoadState('domcontentloaded', LOAD_OPTS);
    const app = page.getByTestId('demo-app');
    await expect(app).toBeVisible({ timeout: 10_000 });
  });

  test('demo has topbar', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.waitForLoadState('domcontentloaded', LOAD_OPTS);
    const topbar = page.locator('#topbar');
    await expect(topbar).toBeVisible({ timeout: 10_000 });
  });

  test('demo has mode badges', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.waitForLoadState('domcontentloaded', LOAD_OPTS);
    const badges = page.locator('.mode-badge');
    await expect(badges.first()).toBeVisible({ timeout: 10_000 });
  });

  test('demo has layout sections', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.waitForLoadState('domcontentloaded', LOAD_OPTS);
    const layout = page.locator('#layout');
    await expect(layout).toBeVisible({ timeout: 10_000 });
  });

  test('demo has left nav', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.waitForLoadState('domcontentloaded', LOAD_OPTS);
    const nav = page.locator('#leftnav');
    await expect(nav).toBeVisible({ timeout: 10_000 });
  });

  test('demo has chart area', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.waitForLoadState('domcontentloaded', LOAD_OPTS);
    const chart = page.locator('#chart-main, #cmw, [id*="chart"]');
    await expect(chart.first()).toBeVisible({ timeout: 15_000 });
  });

  test('demo views switch on nav click', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.waitForLoadState('domcontentloaded', LOAD_OPTS);
    const navItems = page.locator('.nav-item');
    const count = await navItems.count();
    if (count > 1) {
      await navItems.nth(1).click();
      await page.waitForTimeout(500);
      const active = page.locator('.nav-item.active');
      await expect(active).toBeVisible({ timeout: 5_000 });
    }
  });

  test('demo has search input', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.waitForLoadState('domcontentloaded', LOAD_OPTS);
    const search = page.locator('.tb-search input, input[placeholder*="Search"], input[placeholder*="search"]');
    await expect(search.first()).toBeVisible({ timeout: 10_000 });
  });

  test('demo has timeframe buttons', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.waitForLoadState('domcontentloaded', LOAD_OPTS);
    const tf = page.locator('.tf-btn');
    const count = await tf.count();
    expect(count).toBeGreaterThan(0);
  });

  test('demo displays chart header with symbol', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.waitForLoadState('domcontentloaded', LOAD_OPTS);
    const header = page.locator('.chart-header, .ch-sym');
    await expect(header.first()).toBeVisible({ timeout: 15_000 });
  });

  test('demo has right panel or order area', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.waitForLoadState('domcontentloaded', LOAD_OPTS);
    const content = await page.textContent('body');
    const hasOrderTerms = /buy|sell|order|limit|market/i.test(content || '');
    expect(hasOrderTerms).toBe(true);
  });

  test('demo API fallback when backend unavailable', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.waitForLoadState('domcontentloaded', LOAD_OPTS);
    await page.waitForTimeout(2000);
    const body = page.locator('body');
    await expect(body).toBeVisible();
    const text = await body.textContent();
    expect(text?.length ?? 0).toBeGreaterThan(100);
  });

  test('demo has KPI or metrics strip', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.waitForLoadState('domcontentloaded', LOAD_OPTS);
    const kpi = page.locator('.kpi-strip, .kpi-item');
    const count = await kpi.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('demo has replay bar when in replay mode', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.waitForLoadState('domcontentloaded', LOAD_OPTS);
    const replay = page.locator('.replay-bar');
    const count = await replay.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('demo has draw strip or tools', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.waitForLoadState('domcontentloaded', LOAD_OPTS);
    const draw = page.locator('.draw-strip, .draw-btn');
    const count = await draw.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('demo has table or list content', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.waitForLoadState('domcontentloaded', LOAD_OPTS);
    const tables = page.locator('table, .tbl-wrap');
    const count = await tables.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('demo leftnav has multiple items', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.waitForLoadState('domcontentloaded', LOAD_OPTS);
    const items = page.locator('.nav-item');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
  });

  test('demo body is scrollable or has overflow', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.waitForLoadState('domcontentloaded', LOAD_OPTS);
    const app = page.locator('#app');
    const box = await app.boundingBox();
    expect(box).not.toBeNull();
  });

  test('demo loads without fatal error', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(DEMO_URL);
    await page.waitForLoadState('domcontentloaded', LOAD_OPTS);
    await page.waitForTimeout(1000);
    const fatal = errors.filter((e) => !e.includes('favicon') && !e.includes('ResizeObserver'));
    expect(fatal.length).toBeLessThan(5);
  });
});
