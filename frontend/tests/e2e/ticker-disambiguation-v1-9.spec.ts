/**
 * Ticker Disambiguation E2E Tests (v1.9 - Step 3)
 * =================================================
 * Validates the disambiguation dialog appears for ambiguous tickers
 * and that $ prefix / well-known tickers bypass it.
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5100';

async function openCommandPalette(page: Page) {
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(300);
}

test.describe('Ticker Disambiguation (v1.9)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="nav-item-dashboard"]', { timeout: 10000 });
  });

  test('v1.9-disambig-01 - Ambiguous ticker shows disambiguation dialog', async ({ page }) => {
    await openCommandPalette(page);

    // Type "ON" — an ambiguous ticker
    await page.locator('input[placeholder*="command"]').fill('ON');
    await page.waitForTimeout(200);

    // Select the "Switch to ON" item
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // Disambiguation dialog should appear
    await expect(page.getByTestId('ticker-disambiguation-dialog')).toBeVisible();
    await expect(page.getByTestId('disambiguation-symbol')).toHaveText('ON');

    await page.screenshot({ path: 'e2e-results/disambig-01-dialog.png', fullPage: true });
  });

  test('v1.9-disambig-02 - Confirm disambiguation applies the ticker', async ({ page }) => {
    await openCommandPalette(page);
    await page.locator('input[placeholder*="command"]').fill('ON');
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // Confirm
    await page.getByTestId('disambiguation-confirm').click();
    await page.waitForTimeout(300);

    // Dialog should close
    await expect(page.getByTestId('ticker-disambiguation-dialog')).not.toBeVisible();

    await page.screenshot({ path: 'e2e-results/disambig-02-confirmed.png', fullPage: true });
  });

  test('v1.9-disambig-03 - Cancel disambiguation does not apply ticker', async ({ page }) => {
    await openCommandPalette(page);
    await page.locator('input[placeholder*="command"]').fill('IT');
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // Dialog should show
    await expect(page.getByTestId('ticker-disambiguation-dialog')).toBeVisible();

    // Cancel
    await page.getByTestId('disambiguation-cancel').click();
    await page.waitForTimeout(300);

    // Dialog should close
    await expect(page.getByTestId('ticker-disambiguation-dialog')).not.toBeVisible();

    await page.screenshot({ path: 'e2e-results/disambig-03-cancelled.png', fullPage: true });
  });

  test('v1.9-disambig-04 - Well-known ticker bypasses dialog (AAPL)', async ({ page }) => {
    await openCommandPalette(page);
    await page.locator('input[placeholder*="command"]').fill('AAPL');
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // No disambiguation dialog should appear
    await expect(page.getByTestId('ticker-disambiguation-dialog')).not.toBeVisible();

    await page.screenshot({ path: 'e2e-results/disambig-04-wellknown.png', fullPage: true });
  });

  test('v1.9-disambig-05 - Dollar-prefix bypasses dialog ($ON)', async ({ page }) => {
    await openCommandPalette(page);
    await page.locator('input[placeholder*="command"]').fill('$ON');
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // No disambiguation dialog should appear
    await expect(page.getByTestId('ticker-disambiguation-dialog')).not.toBeVisible();

    await page.screenshot({ path: 'e2e-results/disambig-05-dollar.png', fullPage: true });
  });

  test('v1.9-disambig-06 - Disambiguation dialog has tip about $ prefix', async ({ page }) => {
    await openCommandPalette(page);
    await page.locator('input[placeholder*="command"]').fill('AI');
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    await expect(page.getByTestId('ticker-disambiguation-dialog')).toBeVisible();

    // Check for $ prefix tip text
    const dialogText = await page.getByTestId('ticker-disambiguation-dialog').textContent();
    expect(dialogText).toContain('$');

    await page.screenshot({ path: 'e2e-results/disambig-06-tip.png', fullPage: true });
  });

  test('v1.9-disambig-07 - Backdrop click cancels disambiguation', async ({ page }) => {
    await openCommandPalette(page);
    await page.locator('input[placeholder*="command"]').fill('SO');
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    await expect(page.getByTestId('ticker-disambiguation-dialog')).toBeVisible();

    // Click backdrop
    await page.getByTestId('disambiguation-backdrop').click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(300);

    await expect(page.getByTestId('ticker-disambiguation-dialog')).not.toBeVisible();

    await page.screenshot({ path: 'e2e-results/disambig-07-backdrop.png', fullPage: true });
  });
});
