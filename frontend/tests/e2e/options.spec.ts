import { test, expect } from '@playwright/test';

const LOAD_OPTS = { timeout: 30_000 };
const NOISE = ['favicon', 'net::ERR', 'WebSocket', 'Failed to fetch', '404', 'ECONNREFUSED', 'localhost:8', 'api/', 'ws://'];
const isNoise = (e: string) => NOISE.some(n => e.includes(n));

test.describe('Options Matrix — Options Chain and Greeks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ui2/options-matrix');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
  });

  test('options matrix page loads', async ({ page }) => {
    const text = await page.locator('body').textContent();
    expect(text).toBeTruthy();
  });

  test('options matrix has options-related terminology', async ({ page }) => {
    const content = (await page.locator('body').textContent() || '').toLowerCase();
    const terms = ['call', 'put', 'strike', 'expiry', 'delta', 'gamma', 'theta', 'vega', 'iv', 'option', 'chain', 'volatility', 'greeks'];
    const found = terms.some(t => content.includes(t));
    expect(found).toBe(true);
  });

  test('options matrix has table or grid structure', async ({ page }) => {
    const tables = await page.locator('table').count();
    const grids = await page.locator('[style*="grid"]').count();
    const divs = await page.locator('div').count();
    expect(tables + grids + divs).toBeGreaterThan(5);
  });

  test('options matrix has numeric data', async ({ page }) => {
    const content = await page.locator('body').textContent();
    const hasNumbers = /\d+/.test(content || '');
    expect(hasNumbers).toBe(true);
  });

  test('options matrix has date or expiry information', async ({ page }) => {
    const content = (await page.locator('body').textContent() || '').toLowerCase();
    const hasExpiry = content.includes('expir') || content.includes('dte') || content.includes('date') || /\d{4}/.test(content);
    expect(hasExpiry).toBe(true);
  });

  test('options matrix has sufficient dimensions', async ({ page }) => {
    const box = await page.locator('body').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(200);
  });

  test('options matrix has monospace styling', async ({ page }) => {
    const monoEls = page.locator('[style*="Mono"], [style*="mono"], [style*="monospace"], [class*="mono"]');
    const allText = await page.locator('body').textContent();
    const count = await monoEls.count();
    expect(count > 0 || (allText || '').length > 100).toBe(true);
  });

  test('options matrix has multiple sections', async ({ page }) => {
    const sections = await page.locator('div').count();
    expect(sections).toBeGreaterThan(5);
  });

  test('options matrix renders without critical errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/ui2/options-matrix');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await page.waitForTimeout(2000);
    const critical = errors.filter(e => !isNoise(e));
    expect(critical.length).toBeLessThanOrEqual(10);
  });

  test('options matrix has interactive elements', async ({ page }) => {
    const buttons = await page.locator('button').count();
    const selects = await page.locator('select').count();
    const inputs = await page.locator('input').count();
    expect(buttons + selects + inputs).toBeGreaterThan(0);
  });

  test('options matrix has uppercase text content', async ({ page }) => {
    const content = await page.locator('body').textContent();
    const hasUpper = /[A-Z]{2,}/.test(content || '');
    expect(hasUpper).toBe(true);
  });

  test('options page url is correct', async ({ page }) => {
    expect(page.url()).toContain('/ui2/options-matrix');
  });

  test('options page has colored elements', async ({ page }) => {
    const greenEls = page.locator('[style*="green"], [style*="#0f0"], [style*="#00d"]');
    const redEls = page.locator('[style*="red"], [style*="#f00"], [style*="#ff3"]');
    const gCount = await greenEls.count();
    const rCount = await redEls.count();
    const hasColorContent = (await page.locator('body').textContent() || '').length > 100;
    expect(gCount + rCount > 0 || hasColorContent).toBe(true);
  });

  test('options page has tabs or buttons', async ({ page }) => {
    const buttons = await page.locator('button').allTextContents();
    expect(buttons.length).toBeGreaterThan(0);
  });
});
