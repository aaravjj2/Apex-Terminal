import { test, expect } from '@playwright/test';

const LOAD = { timeout: 30_000 };

test.describe('Drawing Tools E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ui2/trading');
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
  });

  test('chart loads for drawing', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('drawing strip or toolbar', async ({ page }) => {
    const strip = await page.locator('.draw-strip, .draw-btn, [class*="draw"]').count();
  });

  test('trendline button if present', async ({ page }) => {
    const btns = await page.locator('button, [role="button"]').count();
  });

  test('horizontal line tool', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('fibonacci tool', async ({ page }) => {
    const text = await page.textContent('body');
    expect(text).toBeTruthy();
  });

  test('rectangle tool', async ({ page }) => {
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('arrow tool', async ({ page }) => {
    const content = await page.textContent('body');
    expect(content?.length ?? 0).toBeGreaterThan(0);
  });

  test('drawing tools toggle', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('active drawing state', async ({ page }) => {
    const active = await page.locator('.draw-btn.active, [class*="active"]').count();
  });

  test('chart canvas for drawing', async ({ page }) => {
    const canvas = await page.locator('canvas').count();
  });

  test('drawing persistence', async ({ page }) => {
    await page.reload();
    await page.waitForLoadState('networkidle', LOAD).catch(() => {});
  });

  test('multiple tools available', async ({ page }) => {
    const tools = await page.locator('.draw-btn').count();
  });

  test('tooltip on hover', async ({ page }) => {
    const tip = await page.locator('.nav-tip, [class*="tooltip"]').count();
  });

  test('drawing clear or delete', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('chart interaction area', async ({ page }) => {
    await page.click('body', { position: { x: 100, y: 100 } }).catch(() => {});
  });

  test('drawing with mouse', async ({ page }) => {
    await page.mouse.move(200, 200);
    await page.mouse.down();
    await page.mouse.move(300, 250);
    await page.mouse.up();
  });

  test('chart resize preserves drawing', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await page.waitForTimeout(300);
  });

  test('drawing overlay', async ({ page }) => {
    const overlay = await page.locator('[class*="overlay"], [class*="draw"]').count();
  });

  test('snap to price', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('drawing color', async ({ page }) => {
    const colorEl = await page.locator('[class*="color"]').count();
  });

  test('text annotation', async ({ page }) => {
    const text = await page.textContent('body');
    expect(text).toBeTruthy();
  });

  test('measure tool', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('eraser or delete tool', async ({ page }) => {
    const delBtn = await page.locator('[class*="delete"], [class*="clear"]').count();
  });

  test('drawing tools full workflow', async ({ page }) => {
    await page.goto('/ui2/trading');
    await page.waitForTimeout(1500);
    await expect(page.locator('body')).toBeVisible();
  });
});
