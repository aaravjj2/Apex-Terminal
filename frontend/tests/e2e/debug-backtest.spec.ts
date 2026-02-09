/**
 * Debug script to reproduce Backtest panel crash
 */
import { test, expect } from '@playwright/test';

test.describe('Backtest Panel Debug', () => {
  test('Navigate to Backtest and check for errors', async ({ page }) => {
    // Listen for console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Listen for page errors
    page.on('pageerror', (error) => {
      errors.push(`Page error: ${error.message}`);
    });

    await page.goto('http://localhost:5100');
    await page.waitForTimeout(1000);

    // Navigate to Backtest (now a standalone nav item)
    await page.getByTestId('nav-item-backtest').click();
    await page.waitForTimeout(2000);

    // Check if panel loaded
    const backtestPanel = page.getByTestId('backtest-panel');
    const isVisible = await backtestPanel.isVisible().catch(() => false);

    console.log('=== DEBUG INFO ===');
    console.log('Backtest panel visible:', isVisible);
    console.log('Errors captured:', errors);

    // Take screenshot
    await page.screenshot({ path: 'backtest-debug.png', fullPage: true });

    // Try to find the strategy select
    const strategySelect = page.getByTestId('backtest-strategy-select');
    const selectVisible = await strategySelect.isVisible().catch(() => false);
    console.log('Strategy select visible:', selectVisible);

    if (selectVisible) {
      // Get options count
      const options = await strategySelect.locator('option').count();
      console.log('Strategy options count:', options);
    }

    // Report final status
    if (errors.length > 0) {
      console.log('\n=== ERRORS FOUND ===');
      errors.forEach((err, idx) => {
        console.log(`${idx + 1}. ${err}`);
      });
    } else {
      console.log('\n=== NO ERRORS ===');
    }
  });
});
