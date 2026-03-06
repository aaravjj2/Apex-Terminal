import { test, expect } from '@playwright/test';
import { writeFileSync } from 'fs';

test('debug test 4', async ({ page }) => {
  // Capture all console messages
  const consoleMsgs: string[] = [];
  page.on('console', msg => consoleMsgs.push(`[${msg.type()}] ${msg.text()}`));
  
  // Capture all errors
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));
  
  await page.goto('/legacy/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => (document.getElementById('root')?.childElementCount ?? 0) > 0, { timeout: 20000 });
  await page.waitForTimeout(1000);

  const optionsNav = page.locator('[data-testid="nav-item-options"]');
  await optionsNav.waitFor({ state: 'visible', timeout: 10000 });
  await optionsNav.click();
  await expect(page.getByTestId('options-heading')).toBeVisible({ timeout: 10000 });

  const riskDeskTab = page.locator('[data-testid="options-main-tab-risk-desk"]');
  await riskDeskTab.waitFor({ state: 'visible', timeout: 10000 });
  await riskDeskTab.click();
  await page.waitForTimeout(500);
  
  await expect(page.locator('[data-testid="risk-desk-panel"]')).toBeVisible({ timeout: 10000 });
  
  // Create a temp file
  const csvContent = 'symbol,option_type,strike,expiry,quantity,side,multiplier\nAAPL,call,220,03/21/2025,10,buy,100\n';
  const filePath = '/tmp/bad_expiry.csv';
  writeFileSync(filePath, csvContent);
  
  const fileInput = page.locator('[data-testid="file-input"]');
  await fileInput.setInputFiles(filePath);
  
  console.log('Waiting for run button to be enabled...');
  await expect(page.locator('[data-testid="run-button"]')).toBeEnabled({ timeout: 10000 });
  console.log('Run button is enabled, clicking...');
  
  await page.locator('[data-testid="run-button"]').click();
  console.log('Clicked run button, waiting for run-status...');
  
  // Wait briefly and then check what's on the DOM
  await page.waitForTimeout(5000);
  
  const runStatus = await page.locator('[data-testid="run-status"]').count();
  console.log('run-status count:', runStatus);
  console.log('run-status visible:', await page.locator('[data-testid="run-status"]').isVisible().catch(() => 'ERROR'));
  
  // Also try toBeVisible
  try {
    await expect(page.locator('[data-testid="run-status"]')).toBeVisible({ timeout: 5000 });
    console.log('toBeVisible: PASSED');
  } catch (e) {
    console.log('toBeVisible: FAILED', String(e).slice(0, 200));
  }
  
  const runState = await page.evaluate(() => {
    return document.querySelector('[data-testid="running-indicator"]')?.textContent;
  });
  console.log('running-indicator:', runState);
  
  const errorBanner = await page.locator('[data-testid="error-banner"]').count();
  console.log('error-banner count:', errorBanner);
  if (errorBanner > 0) {
    const text = await page.locator('[data-testid="error-banner"]').textContent();
    console.log('error-banner text:', text);
  }
  
  // Take screenshot
  await page.screenshot({ path: '/tmp/debug_test4.png' });
  
  console.log('ERRORS:', errors);
  console.log('CONSOLE (last 10):', consoleMsgs.slice(-10));
});
