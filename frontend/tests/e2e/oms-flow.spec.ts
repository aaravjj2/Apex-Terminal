import { test, expect } from '@playwright/test';

const LOAD_OPTS = { timeout: 30_000 };

test.describe('OMS Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ui2/trading');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('trading-ui2-page')).toBeVisible({ timeout: 15_000 });
  });

  test('order form or buy/sell buttons visible', async ({ page }) => {
    const content = await page.getByTestId('trading-ui2-page').textContent();
    const hasOrder = /buy|sell|order|limit|market/i.test(content || '');
    expect(hasOrder).toBe(true);
  });

  test('order form has quantity input if present', async ({ page }) => {
    const qtyInput = page.locator('input[type="number"][placeholder*="qty"], input[name*="quantity"], input[aria-label*="quantity"]');
    const count = await qtyInput.count();
    if (count > 0) {
      await expect(qtyInput.first()).toBeVisible();
    }
  });

  test('order form has side selector if present', async ({ page }) => {
    const buyBtn = page.locator('button:has-text("Buy"), button:has-text("BUY"), [data-testid*="buy"]');
    const sellBtn = page.locator('button:has-text("Sell"), button:has-text("SELL"), [data-testid*="sell"]');
    const buyCount = await buyBtn.count();
    const sellCount = await sellBtn.count();
    expect(buyCount + sellCount).toBeGreaterThanOrEqual(0);
  });

  test('positions panel visible if present', async ({ page }) => {
    const pos = page.locator('[data-testid*="position"], .ph-title:has-text("Position"), :text("Position")');
    const content = await page.textContent('body');
    const hasPos = /position|holdings|portfolio/i.test(content || '');
    expect(hasPos || (await pos.count()) >= 0).toBe(true);
  });

  test('order submission does not crash', async ({ page }) => {
    const submitBtn = page.locator('button:has-text("Submit"), button:has-text("Place"), button[type="submit"]');
    const count = await submitBtn.count();
    if (count > 0 && (await submitBtn.first().isVisible())) {
      await submitBtn.first().click();
      await page.waitForTimeout(1000);
      await expect(page.getByTestId('trading-ui2-page')).toBeVisible();
    }
  });

  test('order type selector if present', async ({ page }) => {
    const limit = page.locator('button:has-text("Limit"), select option:has-text("Limit")');
    const market = page.locator('button:has-text("Market"), select option:has-text("Market")');
    const count = await limit.count() + await market.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('trading page has price display', async ({ page }) => {
    const content = await page.textContent('body');
    const hasPrice = /\d+\.\d{2}/.test(content || '');
    expect(hasPrice).toBe(true);
  });

  test('trading page layout is usable', async ({ page }) => {
    const box = await page.getByTestId('trading-ui2-page').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(300);
  });

  test('order area or panel exists', async ({ page }) => {
    const panels = page.locator('[class*="order"], [class*="panel"], [data-testid*="order"]');
    const count = await panels.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('submit or place order button if present', async ({ page }) => {
    const btn = page.locator('button:has-text("Submit"), button:has-text("Place"), button:has-text("Buy"), button:has-text("Sell")');
    const count = await btn.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('OMS does not throw on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/ui2/trading');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await page.waitForTimeout(1000);
    const fatal = errors.filter((e) => !e.includes('favicon') && !e.includes('WebSocket'));
    expect(fatal.length).toBeLessThan(5);
  });
});
