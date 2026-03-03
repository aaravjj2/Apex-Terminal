import { test, expect } from '@playwright/test';
const BASE = 'http://localhost:5100';

test('quick page load check', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));
  
  await page.goto(`${BASE}/ui2/dashboard`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForSelector('[data-testid="ui2-app-shell"]', { timeout: 15000 });
  
  const shell = await page.locator('[data-testid="ui2-app-shell"]').count();
  const topBar = await page.locator('[data-testid="ui2-topbar"]').count();
  const leftNav = await page.locator('[data-testid="ui2-leftnav"]').count();
  
  console.log(`Shell: ${shell}, TopBar: ${topBar}, LeftNav: ${leftNav}`);
  console.log(`Console errors: ${errors.length > 0 ? errors.slice(0, 3).join('; ') : 'none'}`);
  
  expect(shell).toBeGreaterThan(0);
  expect(topBar).toBeGreaterThan(0);
});
