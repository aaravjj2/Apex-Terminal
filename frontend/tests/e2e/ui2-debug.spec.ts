/**
 * UI2 Debug Spec - diagnose why pages aren't loading
 */

import { test, expect } from '@playwright/test';

test('UI2 Debug - check console and DOM', async ({ page }) => {
  const consoleMessages: string[] = [];
  const errors: string[] = [];

  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleMessages.push(text);
    console.log(text);
  });

  page.on('pageerror', err => {
    const text = `PAGE ERROR: ${err.message}\n${err.stack}`;
    errors.push(text);
    console.log(text);
  });

  page.on('requestfailed', request => {
    console.log(`REQUEST FAILED: ${request.url()} - ${request.failure()?.errorText}`);
  });

  console.log('Navigating to /ui2/portfolio...');
  const response = await page.goto('http://localhost:5100/ui2/portfolio');
  console.log('Navigation response status:', response?.status());
  
  console.log('Waiting 5 seconds for React to render...');
  await page.waitForTimeout(5000);

  console.log('Checking if #root has content...');
  const rootContent = await page.locator('#root').innerHTML();
  console.log('Root innerHTML length:', rootContent.length);
  console.log('Root innerHTML snippet:', rootContent.substring(0, 500));

  console.log('Looking for data-testid...');
  const testidElement = await page.locator('[data-testid="portfolio-ui2-page"]').count();
  console.log('Elements with portfolio-ui2-page testid:', testidElement);

  console.log('Looking for any UI2 text...');
  const ui2AppShell = await page.locator('[data-testid="ui2-app-shell"]').count();
  console.log('UI2 app shell elements:', ui2AppShell);

  console.log('Console messages count:', consoleMessages.length);
  console.log('All console messages:');
  consoleMessages.forEach(msg => console.log('  ', msg));

  console.log('Errors count:', errors.length);
  if (errors.length > 0) {
    console.log('ERRORS:');
    errors.forEach(err => console.log(err));
  }

  console.log('Taking screenshot...');
  await page.screenshot({ path: 'artifacts/ui2-media/screenshots/debug-portfolio-page.png', fullPage: true });

  // Check URL
  console.log('Current URL:', page.url());
});
