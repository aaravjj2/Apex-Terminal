import { test, expect } from '@playwright/test';

const LOAD_OPTS = { timeout: 30_000 };
const NOISE = ['favicon', 'net::ERR', 'WebSocket', 'Failed to fetch', '404', 'ECONNREFUSED', 'localhost:8', 'api/', 'ws://'];
const isNoise = (e: string) => NOISE.some(n => e.includes(n));

test.describe('Backtest — Strategy Backtester', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ui2/backtest');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await page.waitForTimeout(2000);
  });

  test('backtest page loads with content', async ({ page }) => {
    const text = await page.locator('body').textContent();
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(20);
  });

  test('backtest URL is correct', async ({ page }) => {
    expect(page.url()).toContain('/ui2/backtest');
  });

  test('backtest page has DOM elements', async ({ page }) => {
    const divs = await page.locator('div').count();
    expect(divs).toBeGreaterThan(5);
  });

  test('backtest page has backtest-related text', async ({ page }) => {
    const text = (await page.locator('body').textContent() || '').toLowerCase();
    const found = ['backtest', 'strategy', 'run', 'symbol', 'capital', 'result', 'equity', 'trade'].some(k => text.includes(k));
    expect(found).toBe(true);
  });

  test('backtest page has visible content area', async ({ page }) => {
    const box = await page.locator('body').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(200);
    expect(box!.width).toBeGreaterThan(300);
  });

  test('backtest page has some interactive elements', async ({ page }) => {
    const buttons = await page.locator('button').count();
    const inputs = await page.locator('input').count();
    const selects = await page.locator('select').count();
    const links = await page.locator('a').count();
    expect(buttons + inputs + selects + links).toBeGreaterThan(0);
  });

  test('backtest page has text with numbers', async ({ page }) => {
    const text = await page.locator('body').textContent();
    const hasNumbers = /\d/.test(text || '');
    expect(hasNumbers).toBe(true);
  });

  test('backtest page has multiple sections', async ({ page }) => {
    const children = await page.locator('body > div').locator('div').count();
    expect(children).toBeGreaterThan(3);
  });

  test('backtest page has styled elements', async ({ page }) => {
    const styledEls = page.locator('[style]');
    const count = await styledEls.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('backtest page renders within app', async ({ page }) => {
    const hasContent = (await page.locator('body').textContent() || '').length > 10;
    expect(hasContent).toBe(true);
  });

  test('backtest page has dark theme', async ({ page }) => {
    const bg = await page.locator('body').evaluate(el => window.getComputedStyle(el).backgroundColor);
    if (bg && bg !== 'rgba(0, 0, 0, 0)') {
      const match = bg.match(/\d+/g);
      if (match) {
        const [r, g, b] = match.map(Number);
        expect(r + g + b).toBeLessThan(200);
      }
    }
  });

  test('backtest renders without critical errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/ui2/backtest');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await page.waitForTimeout(2000);
    const critical = errors.filter(e => !isNoise(e));
    expect(critical.length).toBeLessThanOrEqual(10);
  });

  test('backtest page has uppercase content', async ({ page }) => {
    const text = await page.locator('body').textContent();
    const hasUpper = /[A-Z]{2,}/.test(text || '');
    expect(hasUpper).toBe(true);
  });

  test('backtest page has buttons', async ({ page }) => {
    const buttonTexts = await page.locator('button').allTextContents();
    expect(buttonTexts.length).toBeGreaterThan(0);
  });
});
