import { test } from '@playwright/test';
test('debug portfolio', async ({ page }) => {
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  await page.goto('http://localhost:5100/ui2/portfolio');  
  await page.waitForTimeout(3000);
  console.log('HTML length:', (await page.locator('#root').innerHTML()).length);
  console.log('URL:', page.url());
  await page.screenshot({ path: 'artifacts/ui2-media/screenshots/debug-portfolio.png', fullPage: true });
});
