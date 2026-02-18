/**
 * Debug: Check if React loads on root path
 */

import { test } from '@playwright/test';

test('Debug - check root path /', async ({ page }) => {
  const consoleMessages: string[] = [];
  
  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleMessages.push(text);
    console.log(text);
  });

  page.on('pageerror', err => {
    console.log(`PAGE ERROR: ${err.message}`);
  });

  console.log('Navigating to / (root)...');
  await page.goto('http://localhost:5100/');
  
  console.log('Waiting 3 seconds...');
  await page.waitForTimeout(3000);

  console.log('Checking if #root has content...');
  const rootContent = await page.locator('#root').innerHTML();
  console.log('Root innerHTML length:', rootContent.length);
  console.log('Root innerHTML snippet:', rootContent.substring(0, 500));

  console.log('Console messages total:', consoleMessages.length);
  consoleMessages.slice(0, 10).forEach(msg => console.log('  ', msg));

  console.log('Taking screenshot...');
  await page.screenshot({ path: 'artifacts/ui2-media/screenshots/debug-root-page.png', fullPage: true });
});
