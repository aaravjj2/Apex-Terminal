// Debug UI loading
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  // Take screenshot to see what loaded
  await page.screenshot({ 
    path: path.join(__dirname, 'artifacts/week2-risk-desk/debug_initial_load.png'),
    fullPage: true 
  });
  
  // Get all testids
  const testids = await page.$$eval('[data-testid]', els => els.map(el => el.getAttribute('data-testid')));
  console.log('Available data-testids:', testids);
  
  await browser.close();
})();
